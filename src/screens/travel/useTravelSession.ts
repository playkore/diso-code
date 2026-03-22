import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getSystemByName, getSystemHeading } from '../../domain/galaxyCatalog';
import { applyLegalFloor, type CommanderState } from '../../domain/commander';
import {
  assessDockingApproach,
  consumeEscapePod,
  createMathRandomSource,
  createTravelCombatState,
  enterArrivalSpace,
  enterStationSpace,
  getPlayerCombatSnapshot,
  isMassNearby,
  isPlayerInStationSafeZone,
  setCombatSystemContext,
  stepTravelCombat,
  type FlightPhase
} from '../../domain/travelCombat';
import { hasMissionFlag } from '../../domain/missions';
import type { TravelState } from '../../store/types';
import { renderCanvas } from './renderCanvas';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './renderers/constants';
import { createStars } from './renderers/starsRenderer';
import { getHyperspaceDurationFrames } from './travelTiming';
import { getHudState } from './travelViewModel';
import { useTravelInput } from './useTravelInput';
import type { TravelPerfSnapshot } from './TravelPerfOverlay';

/**
 * Owns the real-time travel session that bridges React UI and the mutable
 * combat simulation.
 *
 * React state here is intentionally limited to data that affects rendering and
 * must trigger re-renders: HUD text/colors, overlay messages, and joystick UI.
 * The combat state, phase machine, timers, and star field remain mutable locals
 * inside the effect so the animation loop can advance them every frame without
 * paying React reconciliation costs.
 */
const INITIAL_HUD = {
  score: '0',
  shields: '100',
  shieldsColor: CGA_GREEN,
  jump: 'READY',
  jumpColor: CGA_GREEN,
  hyperspace: 'SAFE ZONE',
  hyperspaceColor: CGA_RED,
  legal: 'clean 0',
  legalColor: CGA_GREEN,
  threat: 'F- / 0',
  threatColor: CGA_GREEN,
  arc: 'FRONT',
  arcColor: CGA_RED
};

interface TravelRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
}

const PERF_REPORT_INTERVAL_MS = 500;
const PERF_SAMPLE_CAP = 120;
const EMPTY_PERF_SNAPSHOT: TravelPerfSnapshot = {
  fps: 0,
  frameAvgMs: 0,
  frameP95Ms: 0,
  frameMaxMs: 0,
  workAvgMs: 0,
  workP95Ms: 0,
  workMaxMs: 0,
  reactCommitsPerSecond: 0,
  reactAvgMs: 0,
  reactMaxMs: 0,
  longTaskCount: 0,
  longTaskMaxMs: 0
};

interface PerfAccumulator {
  windowStart: number;
  frameDeltas: number[];
  workDurations: number[];
  reactCommitCount: number;
  reactCommitTotalMs: number;
  reactCommitMaxMs: number;
  longTaskCount: number;
  longTaskMaxMs: number;
}

function pushPerfSample(samples: number[], value: number) {
  samples.push(value);
  if (samples.length > PERF_SAMPLE_CAP) {
    samples.shift();
  }
}

function average(samples: number[]) {
  return samples.length === 0 ? 0 : samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
}

function max(samples: number[]) {
  return samples.length === 0 ? 0 : Math.max(...samples);
}

function percentile95(samples: number[]) {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

function createPerfAccumulator(now: number): PerfAccumulator {
  return {
    windowStart: now,
    frameDeltas: [],
    workDurations: [],
    reactCommitCount: 0,
    reactCommitTotalMs: 0,
    reactCommitMaxMs: 0,
    longTaskCount: 0,
    longTaskMaxMs: 0
  };
}

export function useTravelSession(
  refs: TravelRefs,
  session: TravelState | null,
  commander: CommanderState,
  completeTravel: (report?: Parameters<ReturnType<typeof import('../../store/useGameStore').useGameStore.getState>['completeTravel']>[0]) => void,
  navigate: (to: string, options?: { replace?: boolean }) => void
) {
  const [hud, setHud] = useState(INITIAL_HUD);
  const [message, setMessage] = useState('');
  const [hyperspaceHidden, setHyperspaceHidden] = useState(false);
  const [perf, setPerf] = useState(EMPTY_PERF_SNAPSHOT);
  const hudRef = useRef(hud);
  const messageRef = useRef(message);
  const hyperspaceHiddenRef = useRef(hyperspaceHidden);
  const perfRef = useRef<PerfAccumulator>(createPerfAccumulator(typeof performance === 'undefined' ? 0 : performance.now()));
  const {
    inputRef,
    keysRef,
    joyActiveRef,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    fireButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    dockButtonHandlers,
    resetInput
  } = useTravelInput(refs.viewportRef);

  const setHudState = (next: typeof INITIAL_HUD) => {
    const previous = hudRef.current;
    if (
      previous.score === next.score &&
      previous.shields === next.shields &&
      previous.shieldsColor === next.shieldsColor &&
      previous.jump === next.jump &&
      previous.jumpColor === next.jumpColor &&
      previous.hyperspace === next.hyperspace &&
      previous.hyperspaceColor === next.hyperspaceColor &&
      previous.legal === next.legal &&
      previous.legalColor === next.legalColor &&
      previous.threat === next.threat &&
      previous.threatColor === next.threatColor &&
      previous.arc === next.arc &&
      previous.arcColor === next.arcColor
    ) {
      return;
    }
    hudRef.current = next;
    setHud(next);
  };

  const setMessageState = (next: string) => {
    if (messageRef.current === next) {
      return;
    }
    messageRef.current = next;
    setMessage(next);
  };

  const setHyperspaceHiddenState = (next: boolean) => {
    if (hyperspaceHiddenRef.current === next) {
      return;
    }
    hyperspaceHiddenRef.current = next;
    setHyperspaceHidden(next);
  };

  const publishPerfSnapshot = useCallback((now: number) => {
    const accumulator = perfRef.current;
    const elapsedMs = Math.max(1, now - accumulator.windowStart);
    const nextPerf: TravelPerfSnapshot = {
      fps: accumulator.frameDeltas.length * (1000 / elapsedMs),
      frameAvgMs: average(accumulator.frameDeltas),
      frameP95Ms: percentile95(accumulator.frameDeltas),
      frameMaxMs: max(accumulator.frameDeltas),
      workAvgMs: average(accumulator.workDurations),
      workP95Ms: percentile95(accumulator.workDurations),
      workMaxMs: max(accumulator.workDurations),
      reactCommitsPerSecond: accumulator.reactCommitCount * (1000 / elapsedMs),
      reactAvgMs: accumulator.reactCommitCount === 0 ? 0 : accumulator.reactCommitTotalMs / accumulator.reactCommitCount,
      reactMaxMs: accumulator.reactCommitMaxMs,
      longTaskCount: accumulator.longTaskCount,
      longTaskMaxMs: accumulator.longTaskMaxMs
    };
    setPerf((previous) => {
      if (
        previous.fps === nextPerf.fps &&
        previous.frameAvgMs === nextPerf.frameAvgMs &&
        previous.frameP95Ms === nextPerf.frameP95Ms &&
        previous.frameMaxMs === nextPerf.frameMaxMs &&
        previous.workAvgMs === nextPerf.workAvgMs &&
        previous.workP95Ms === nextPerf.workP95Ms &&
        previous.workMaxMs === nextPerf.workMaxMs &&
        previous.reactCommitsPerSecond === nextPerf.reactCommitsPerSecond &&
        previous.reactAvgMs === nextPerf.reactAvgMs &&
        previous.reactMaxMs === nextPerf.reactMaxMs &&
        previous.longTaskCount === nextPerf.longTaskCount &&
        previous.longTaskMaxMs === nextPerf.longTaskMaxMs
      ) {
        return previous;
      }
      return nextPerf;
    });
    perfRef.current = createPerfAccumulator(now);
  }, []);

  const recordReactCommit = useCallback((actualDuration: number) => {
    const accumulator = perfRef.current;
    accumulator.reactCommitCount += 1;
    accumulator.reactCommitTotalMs += actualDuration;
    accumulator.reactCommitMaxMs = Math.max(accumulator.reactCommitMaxMs, actualDuration);
  }, []);

  useEffect(() => {
    // Long-task entries capture unrelated main-thread stalls as well, which is
    // useful because a dropped frame can come from work outside the travel loop.
    if (typeof PerformanceObserver === 'undefined') {
      return undefined;
    }
    const supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? [];
    if (!supportedEntryTypes.includes('longtask')) {
      return undefined;
    }
    const observer = new PerformanceObserver((list) => {
      const accumulator = perfRef.current;
      for (const entry of list.getEntries()) {
        accumulator.longTaskCount += 1;
        accumulator.longTaskMaxMs = Math.max(accumulator.longTaskMaxMs, entry.duration);
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    // Resolve all fixed session dependencies up front. If any of them are
    // missing, the travel view bails out instead of running a partial loop.
    const originSystem = getSystemByName(session.originSystem)?.data;
    const destinationSystem = getSystemByName(session.destinationSystem)?.data;
    if (!originSystem || !destinationSystem) {
      return undefined;
    }

    const canvas = refs.canvasRef.current;
    const viewport = refs.viewportRef.current;
    if (!canvas || !viewport) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const random = createMathRandomSource();
    const combatState = createTravelCombatState(
      {
        legalValue: applyLegalFloor(commander.legalValue, commander.cargo),
        government: originSystem.government,
        techLevel: originSystem.techLevel,
        missionTP: commander.missionTP,
        missionVariant: commander.missionVariant,
        laserMounts: commander.laserMounts,
        installedEquipment: commander.installedEquipment,
        missilesInstalled: commander.missilesInstalled
      },
      random
    );

    let cw = 0;
    let ch = 0;
    const resize = () => {
      cw = canvas.width = viewport.clientWidth;
      ch = canvas.height = viewport.clientHeight;
    };
    resize();

    let flightState: FlightPhase = 'READY';
    let hyperspaceTimer = 0;
    let jumpActivationFrames = 0;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let stationaryTicks = 0;
    let stars = createStars();
    let overlayMessage = '';
    let overlayTimer = 0;
    let jumpCompleted = false;

    const getManualFlightState = (): FlightPhase => {
      if (jumpCompleted) {
        return 'ARRIVED';
      }
      return flightState === 'READY' ? 'READY' : 'PLAYING';
    };

    const updateHud = () => {
      const jumpBlocked = isMassNearby(combatState);
      const hyperspaceBlocked = !jumpCompleted && isPlayerInStationSafeZone(combatState);
      const nextHud = getHudState(combatState, flightState, { jumpBlocked, hyperspaceBlocked, jumpCompleted });
      setHudState({
        score: nextHud.score,
        shields: nextHud.shields,
        shieldsColor: combatState.player.shields <= 30 ? CGA_RED : CGA_GREEN,
        jump: nextHud.jump,
        jumpColor: nextHud.jump === 'MASS LOCK' ? CGA_RED : nextHud.jump === 'ENGAGED' ? CGA_YELLOW : CGA_GREEN,
        hyperspace: nextHud.hyperspace,
        hyperspaceColor: nextHud.hyperspace === 'SAFE ZONE' ? CGA_RED : nextHud.hyperspace === 'ENGAGED' ? CGA_YELLOW : CGA_GREEN,
        legal: nextHud.legal,
        legalColor: combatState.legalValue >= 50 ? CGA_RED : combatState.legalValue >= 1 ? CGA_YELLOW : CGA_GREEN,
        threat: nextHud.threat,
        threatColor: nextHud.hostileCount > 0 ? CGA_RED : CGA_GREEN,
        arc: nextHud.arc,
        arcColor: combatState.playerLoadout.laserMounts[combatState.lastPlayerArc] ? CGA_YELLOW : CGA_RED
      });
      setHyperspaceHiddenState(jumpCompleted);
    };

    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      setMessageState(text);
    };

    // All successful exits funnel through this helper so the store receives the
    // same snapshot shape whether docking happens manually or via auto-dock.
    const completeDocking = (dockSystemName: string, spendJumpFuel: boolean, missionEvents = [...combatState.missionEvents]) => {
      const snapshot = getPlayerCombatSnapshot(combatState);
      if (jumpCompleted && hasMissionFlag(combatState.missionTP, 'thargoidPlansBriefed') && !hasMissionFlag(combatState.missionTP, 'thargoidPlansCompleted')) {
        missionEvents.push({ type: 'combat:thargoid-plans-delivered' });
      }
      completeTravel({
        dockSystemName,
        spendJumpFuel,
        legalValue: combatState.legalValue,
        tallyDelta: combatState.player.tallyKills,
        missionEvents,
        cargo: snapshot.cargo,
        fuelDelta: snapshot.fuel,
        installedEquipment: snapshot.installedEquipment,
        missilesInstalled: snapshot.missilesInstalled
      });
      navigate('/', { replace: true });
    };

    const startLocalJump = () => {
      if (flightState === 'HYPERSPACE' || flightState === 'GAMEOVER') {
        return;
      }
      if (isMassNearby(combatState)) {
        showMessage('MASS LOCK', 900);
        inputRef.current.jump = false;
        flightState = getManualFlightState();
        updateHud();
        return;
      }
      flightState = 'JUMPING';
      jumpActivationFrames = 6;
      showMessage('JUMP ENGAGED', 900);
      updateHud();
    };

    // Hyperspace is a separate cinematic phase. Once engaged, normal combat
    // systems stop consuming player actions until the arrival context is seeded.
    const startHyperspace = () => {
      if (flightState === 'HYPERSPACE' || flightState === 'GAMEOVER' || jumpCompleted) {
        return;
      }
      if (isPlayerInStationSafeZone(combatState)) {
        showMessage('SAFE ZONE', 900);
        inputRef.current.hyperspace = false;
        updateHud();
        return;
      }
      // Align the ship with the selected chart route so the hyperspace tunnel
      // launches toward the destination the same way the maps present it.
      const hyperspaceHeading = getSystemHeading(session.originSystem, session.destinationSystem);
      if (hyperspaceHeading !== null) {
        combatState.player.angle = hyperspaceHeading;
      }
      flightState = 'HYPERSPACE';
      hyperspaceTimer = getHyperspaceDurationFrames(session.fuelCost);
      showMessage(`HYPERSPACE TO ${session.destinationSystem.toUpperCase()}`, 2000);
      combatState.player.vx = Math.cos(combatState.player.angle) * 5;
      combatState.player.vy = Math.sin(combatState.player.angle) * 5;
      updateHud();
    };

    // Reset builds a fresh mutable simulation object while keeping the same
    // effect-scoped references and React bindings alive for the next loop.
    const resetPrototype = () => {
      const fresh = createTravelCombatState(
        {
          legalValue: applyLegalFloor(commander.legalValue, commander.cargo),
          government: originSystem.government,
          techLevel: originSystem.techLevel,
          missionTP: commander.missionTP,
          missionVariant: commander.missionVariant,
          laserMounts: commander.laserMounts,
          installedEquipment: commander.installedEquipment,
          missilesInstalled: commander.missilesInstalled
        },
        random
      );
      Object.assign(combatState, fresh);
      setCombatSystemContext(combatState, { government: originSystem.government, techLevel: originSystem.techLevel, witchspace: false }, random);
      enterStationSpace(combatState, random, { message: 'CLEARED FROM STATION' });
      stars = createStars();
      jumpCompleted = false;
      flightState = 'READY';
      showMessage(`ROUTE ${session.originSystem.toUpperCase()} -> ${session.destinationSystem.toUpperCase()}`, 2400);
      updateHud();
      resetInput();
    };

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // The frame loop is the authoritative owner of mutable session state. It
    // folds together keyboard/touch input, advances the simulation, resolves
    // travel outcomes, then copies only render-facing state back into React.
    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const dt = Math.min(deltaMs, 32) / 16.6667;
      const workStart = performance.now();
      const perfAccumulator = perfRef.current;
      pushPerfSample(perfAccumulator.frameDeltas, deltaMs);
      const liveInput = inputRef.current;
      const keys = keysRef.current;

      if (flightState === 'GAMEOVER') {
        if (liveInput.fire || keys[' ']) {
          resetPrototype();
        }
        renderCanvas(ctx, combatState, stars, flightState, cw, ch, jumpCompleted ? session.destinationSystem : session.originSystem);
        pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
        if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
          publishPerfSnapshot(timestamp);
        }
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (keys.ArrowLeft) {
        liveInput.turn = -1;
      } else if (keys.ArrowRight) {
        liveInput.turn = 1;
      } else if (!joyActiveRef.current) {
        liveInput.turn = 0;
      }
      if (keys.ArrowUp) {
        liveInput.thrust = 1;
      } else if (!joyActiveRef.current) {
        liveInput.thrust = 0;
      }
      if (!joyActiveRef.current) {
        liveInput.vectorX = 0;
        liveInput.vectorY = 0;
        liveInput.vectorStrength = 0;
      }

      liveInput.fire = keys[' '] || liveInput.fire;
      liveInput.jump = keys.j || keys.J || liveInput.jump;
      liveInput.hyperspace = keys.h || keys.H || liveInput.hyperspace;
      liveInput.activateEcm = keys.e || keys.E || liveInput.activateEcm;
      liveInput.triggerEnergyBomb = keys.b || keys.B || liveInput.triggerEnergyBomb;
      liveInput.autoDock = keys.d || keys.D || liveInput.autoDock;

      if (flightState === 'READY' && (Math.abs(combatState.player.vx) > 0.02 || Math.abs(combatState.player.vy) > 0.02 || liveInput.thrust > 0 || Math.abs(liveInput.turn) > 0.1)) {
        flightState = 'PLAYING';
      }

      if (joyActiveRef.current && liveInput.vectorStrength > 0.08 && flightState !== 'HYPERSPACE' && flightState !== 'JUMPING') {
        combatState.player.angle = Math.atan2(liveInput.vectorY, liveInput.vectorX);
      }

      if (jumpActivationFrames > 0) {
        jumpActivationFrames -= 1;
      }
      const jumpRequested = liveInput.jump || jumpActivationFrames > 0;
      const jumpBlocked = isMassNearby(combatState);
      if (flightState === 'JUMPING' && (!jumpRequested || jumpBlocked)) {
        flightState = getManualFlightState();
        if (jumpBlocked) {
          showMessage('MASS LOCK', 900);
        }
      }

      const result = stepTravelCombat(
        combatState,
        {
          thrust: flightState === 'HYPERSPACE' || flightState === 'JUMPING' ? 0 : liveInput.thrust,
          turn: flightState === 'HYPERSPACE' || flightState === 'JUMPING' ? 0 : liveInput.turn,
          fire: flightState === 'HYPERSPACE' ? false : liveInput.fire,
          jump: flightState === 'JUMPING' && jumpRequested && !jumpBlocked,
          hyperspace: flightState === 'HYPERSPACE',
          activateEcm: flightState === 'HYPERSPACE' ? false : liveInput.activateEcm,
          triggerEnergyBomb: flightState === 'HYPERSPACE' ? false : liveInput.triggerEnergyBomb,
          autoDock: flightState === 'HYPERSPACE' ? false : liveInput.autoDock
        },
        dt,
        flightState,
        commander.cargo,
        random
      );

      if (result.autoDocked) {
        completeDocking(jumpCompleted ? session.destinationSystem : session.originSystem, jumpCompleted);
        return;
      }

      if ((flightState === 'READY' || flightState === 'PLAYING' || flightState === 'ARRIVED') && liveInput.jump) {
        startLocalJump();
      }

      if ((flightState === 'READY' || flightState === 'PLAYING') && liveInput.hyperspace) {
        startHyperspace();
      }

      if (flightState === 'HYPERSPACE') {
        // Hyperspace has its own movement profile instead of using
        // `stepTravelCombat`, because the player is locked into a scripted
        // transition until the destination system is activated.
        const totalHyperspaceDuration = getHyperspaceDurationFrames(session.fuelCost);
        const progress = 1 - hyperspaceTimer / totalHyperspaceDuration;
        const speedFactor = progress < 0.55 ? 1.05 : 0.97;
        combatState.player.vx *= speedFactor;
        combatState.player.vy *= speedFactor;
        combatState.player.x += combatState.player.vx * dt;
        combatState.player.y += combatState.player.vy * dt;
        hyperspaceTimer -= dt;
        if (hyperspaceTimer <= 0) {
          setCombatSystemContext(combatState, { government: destinationSystem.government, techLevel: destinationSystem.techLevel, witchspace: false }, random);
          enterArrivalSpace(combatState, random);
          jumpCompleted = true;
          flightState = 'ARRIVED';
          showMessage(`SYSTEM REACHED: ${session.destinationSystem.toUpperCase()}`, 1800);
        }
      }

      if (combatState.station && flightState !== 'HYPERSPACE') {
        // Manual docking is resolved outside the combat step so the hook can
        // decide whether to finish travel, bounce the ship, or show guidance.
        const docking = assessDockingApproach(combatState.station, combatState.player);
        if (docking.distance < combatState.station.radius + 15) {
          if (docking.collidesWithHull) {
            combatState.player.shields -= 20;
            combatState.player.vx *= -1.5;
            combatState.player.vy *= -1.5;
            showMessage('COLLISION WARNING', 1000);
          } else if (docking.isInDockingGap && docking.distance < combatState.station.radius - 18) {
            if (docking.canDock) {
              completeDocking(jumpCompleted ? session.destinationSystem : session.originSystem, jumpCompleted);
              return;
            }
            if (!docking.isFacingHangar || docking.speed >= 3.6) {
              showMessage('ENTER SLOT NOSE-IN AT LOW SPEED', 1000);
            }
          }
        }
      }

      if (result.playerDestroyed) {
        flightState = 'GAMEOVER';
        showMessage('SHIP DESTROYED - PRESS FIRE TO RESET', 99999);
      }

      if (result.playerEscaped) {
        consumeEscapePod(combatState);
        const snapshot = getPlayerCombatSnapshot(combatState);
        completeTravel({
          outcome: 'rescued',
          dockSystemName: jumpCompleted ? session.destinationSystem : session.originSystem,
          spendJumpFuel: jumpCompleted,
          legalValue: combatState.legalValue,
          tallyDelta: combatState.player.tallyKills,
          missionEvents: combatState.missionEvents,
          cargo: snapshot.cargo,
          fuelDelta: snapshot.fuel,
          installedEquipment: snapshot.installedEquipment,
          missilesInstalled: snapshot.missilesInstalled
        });
        navigate('/', { replace: true });
        return;
      }

      if (flightState === 'ARRIVED' && Math.hypot(combatState.player.vx, combatState.player.vy) < 0.05) {
        stationaryTicks += 1;
        if (stationaryTicks > 120) {
          showMessage('LINE UP WITH THE SPLIT IN THE STATION RING', 1400);
          stationaryTicks = 0;
        }
      } else {
        stationaryTicks = 0;
      }

      if (overlayTimer > 0) {
        overlayTimer -= deltaMs;
        if (overlayTimer <= 0) {
          overlayMessage = '';
        }
      }
      setMessageState(overlayMessage || combatState.messages[0]?.text || '');

      if (!keys[' ']) {
        liveInput.fire = false;
      }
      if (!keys.j && !keys.J) {
        liveInput.jump = false;
      }
      if (!keys.h && !keys.H) {
        liveInput.hyperspace = false;
      }
      if (!keys.e && !keys.E) {
        liveInput.activateEcm = false;
      }
      if (!keys.b && !keys.B) {
        liveInput.triggerEnergyBomb = false;
      }
      if (!keys.d && !keys.D) {
        liveInput.autoDock = false;
      }

      updateHud();
      renderCanvas(ctx, combatState, stars, flightState, cw, ch, jumpCompleted ? session.destinationSystem : session.originSystem);
      pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
      if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
        publishPerfSnapshot(timestamp);
      }
      animationFrameId = window.requestAnimationFrame(loop);
    };

    resetPrototype();
    perfRef.current = createPerfAccumulator(performance.now());
    setPerf(EMPTY_PERF_SNAPSHOT);
    animationFrameId = window.requestAnimationFrame(loop);
    return () => {
      // Pointer/keyboard state is cleared on teardown so a route change cannot
      // leak held inputs into the next session.
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      resetInput();
    };
  }, [commander, completeTravel, inputRef, joyActiveRef, keysRef, navigate, refs.canvasRef, refs.viewportRef, resetInput, session]);

  return {
    hud,
    message,
    hyperspaceHidden,
    perf,
    recordReactCommit,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    fireButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    dockButtonHandlers
  };
}
