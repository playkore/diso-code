import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { getSystemByName, getSystemHeading } from '../../domain/galaxyCatalog';
import type { CommanderState } from '../../domain/commander';
import { clampAngle } from '../../domain/combat/state';
import {
  assessDockingApproach,
  consumeEscapePod,
  createMathRandomSource,
  createTravelCombatState,
  enterArrivalSpace,
  enterStationSpace,
  getPlayerCombatSnapshot,
  isMassNearby,
  canAutoDock,
  isPlayerInStationSafeZone,
  setCombatSystemContext,
  stepTravelCombat,
  type FlightPhase
} from '../../domain/travelCombat';
import type { TravelState } from '../../store/types';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './renderers/constants';
import { getHyperspaceDurationFrames } from './travelTiming';
import { getHudState } from './travelViewModel';
import { useTravelInput } from './useTravelInput';
import type { TravelPerfSnapshot } from './TravelPerfOverlay';
import { createAutoDockState, stepAutoDockState, type AutoDockState } from '../../domain/combat/station/autoDock';
import { getStationDockDirection, getStationDockMouthPoint } from '../../domain/combat/station/stationGeometry';
import { createStars, TravelSceneRenderer } from './TravelSceneRenderer';
import { createShipBankState, getPerspectiveCameraDistance, stepShipBankState, type ShipBankState } from './renderers/travelSceneMath';

interface PlayerDeathState {
  elapsedMs: number;
}

const PLAYER_DEATH_ANIMATION_MS = 1800;
const PLAYER_DEATH_GAME_OVER_MS = 900;
const PLAYER_DEATH_PROMPT_BLINK_MS = 320;

/**
 * Owns the real-time travel session that bridges React UI and the mutable
 * combat simulation.
 *
 * React state here is intentionally limited to data that affects rendering and
 * must trigger re-renders: HUD text/colors, overlay messages, and joystick UI.
 * The combat state, phase machine, timers, and star field remain mutable locals
 * inside the effect so the animation loop can advance them every frame without
 * paying React reconciliation costs, while the Three.js viewport consumes that
 * mutable snapshot strictly as a rendering concern.
 */
const INITIAL_HUD = {
  energyBanks: [1, 1, 1, 1],
  energyColor: CGA_GREEN,
  shieldRatio: 1,
  shieldColor: CGA_GREEN,
  laserHeat: [
    { mount: 'front', installed: true, ratio: 0, color: CGA_GREEN },
    { mount: 'rear', installed: false, ratio: 0, color: CGA_GREEN },
    { mount: 'left', installed: false, ratio: 0, color: CGA_GREEN },
    { mount: 'right', installed: false, ratio: 0, color: CGA_GREEN }
  ],
  jump: 'READY',
  jumpColor: CGA_GREEN,
  hyperspace: 'SAFE ZONE',
  hyperspaceColor: CGA_RED,
  legal: 'clean 0',
  legalColor: CGA_GREEN,
  threat: 'F- / 0',
  threatColor: CGA_GREEN,
  lasersActive: true,
  arc: 'FRONT',
  arcColor: CGA_RED
};

interface TravelRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
}

/**
 * Flight setup snapshot captured from the commander store.
 *
 * The combat effect must depend only on fields that define the active flight
 * simulation. Store updates such as live cash rewards should not rebuild the
 * whole session and silently respawn the ship near the station.
 */
interface CombatCommanderSnapshot {
  cargo: CommanderState['cargo'];
  legalValue: CommanderState['legalValue'];
  galaxyIndex: number;
  energyBanks: CommanderState['energyBanks'];
  energyPerBank: CommanderState['energyPerBank'];
  laserMounts: CommanderState['laserMounts'];
  installedEquipment: CommanderState['installedEquipment'];
  missilesInstalled: CommanderState['missilesInstalled'];
}

interface AutoDockUiState {
  visible: boolean;
  enabled: boolean;
  active: boolean;
}

interface BombUiState {
  visible: boolean;
}

interface EcmUiState {
  visible: boolean;
}

interface DockingAnimationState {
  elapsedMs: number;
  dockSystemName: string;
  spendJumpFuel: boolean;
}

const PERF_REPORT_INTERVAL_MS = 500;
const PERF_SAMPLE_CAP = 120;
const DOCKING_ANIMATION_DURATION_MS = 1100;
const DOCKING_ANIMATION_FORWARD_SPEED = 3.4;
const DOCKING_CAMERA_FOLLOW_DISTANCE = 13;
const DOCKING_CAMERA_SIDE_OFFSET = 6;
const DOCKING_CAMERA_HEIGHT_FACTOR = 0.58;
const DOCKING_CAMERA_LOOKAHEAD = 8;
const DOCKING_CAMERA_MOUTH_FOCUS = 0.78;
const RADAR_INSET_TOP = 20;
const RADAR_INSET_RIGHT = 20;
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

const JOYSTICK_TARGET_TURN_ANGLE = 0.12;

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

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getJoystickTurnCommand(currentAngle: number, targetAngle: number) {
  return clampUnit(clampAngle(targetAngle - currentAngle) / JOYSTICK_TARGET_TURN_ANGLE);
}

/**
 * Projects the joystick vector onto the ship's forward axis.
 *
 * The virtual joystick still chooses a target heading from its full 2D vector,
 * but thrust must only come from the component that already points through the
 * nose. Pulling behind the ship therefore produces zero forward thrust until
 * the hull rotates far enough for that same joystick vector to move into the
 * forward hemisphere.
 */
export function getJoystickProjectedThrust(vectorX: number, vectorY: number, shipAngle: number) {
  const noseX = Math.cos(shipAngle);
  const noseY = Math.sin(shipAngle);
  return Math.max(0, vectorX * noseX + vectorY * noseY);
}

export function useTravelSession(
  refs: TravelRefs,
  session: TravelState | null,
  commander: CombatCommanderSnapshot,
  grantCombatCredits: (amount: number) => void,
  completeTravel: (report?: Parameters<ReturnType<typeof import('../../store/useGameStore').useGameStore.getState>['completeTravel']>[0]) => void,
  resetAfterDeath: () => void,
  navigate: (to: string, options?: { replace?: boolean }) => void
) {
  const [hud, setHud] = useState(INITIAL_HUD);
  const [message, setMessage] = useState('');
  const [hyperspaceHidden, setHyperspaceHidden] = useState(false);
  const [autoDock, setAutoDock] = useState<AutoDockUiState>({
    visible: commander.installedEquipment.docking_computer,
    enabled: false,
    active: false
  });
  const [bomb, setBomb] = useState<BombUiState>({
    visible: commander.installedEquipment.energy_bomb
  });
  const [ecm, setEcm] = useState<EcmUiState>({
    visible: commander.installedEquipment.ecm
  });
  const [perf, setPerf] = useState(EMPTY_PERF_SNAPSHOT);
  const hudRef = useRef(hud);
  const messageRef = useRef(message);
  const hyperspaceHiddenRef = useRef(hyperspaceHidden);
  const autoDockRef = useRef(autoDock);
  const bombRef = useRef(bomb);
  const ecmRef = useRef(ecm);
  const perfRef = useRef<PerfAccumulator>(createPerfAccumulator(typeof performance === 'undefined' ? 0 : performance.now()));
  const {
    inputRef,
    keysRef,
    joyActiveRef,
    jumpPointerIdRef,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    toggleLasersButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    dockButtonHandlers,
    resetInput
  } = useTravelInput(refs.viewportRef);

  const setHudState = (next: typeof INITIAL_HUD) => {
    const previous = hudRef.current;
    if (
      previous.energyColor === next.energyColor &&
      previous.shieldRatio === next.shieldRatio &&
      previous.shieldColor === next.shieldColor &&
      previous.laserHeat.length === next.laserHeat.length &&
      previous.laserHeat.every(
        (entry, index) =>
          entry.mount === next.laserHeat[index].mount &&
          entry.installed === next.laserHeat[index].installed &&
          entry.ratio === next.laserHeat[index].ratio &&
          entry.color === next.laserHeat[index].color
      ) &&
      previous.energyBanks.length === next.energyBanks.length &&
      previous.energyBanks.every((ratio, index) => ratio === next.energyBanks[index]) &&
      previous.jump === next.jump &&
      previous.jumpColor === next.jumpColor &&
      previous.hyperspace === next.hyperspace &&
      previous.hyperspaceColor === next.hyperspaceColor &&
      previous.legal === next.legal &&
      previous.legalColor === next.legalColor &&
      previous.threat === next.threat &&
      previous.threatColor === next.threatColor &&
      previous.arc === next.arc &&
      previous.arcColor === next.arcColor &&
      previous.lasersActive === next.lasersActive
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

  const setAutoDockState = (next: AutoDockUiState) => {
    if (
      autoDockRef.current.visible === next.visible &&
      autoDockRef.current.enabled === next.enabled &&
      autoDockRef.current.active === next.active
    ) {
      return;
    }
    autoDockRef.current = next;
    setAutoDock(next);
  };

  const setBombState = (next: BombUiState) => {
    if (bombRef.current.visible === next.visible) {
      return;
    }
    bombRef.current = next;
    setBomb(next);
  };

  const setEcmState = (next: EcmUiState) => {
    if (ecmRef.current.visible === next.visible) {
      return;
    }
    ecmRef.current = next;
    setEcm(next);
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
    const originSystem = getSystemByName(session.originSystem, commander.galaxyIndex)?.data;
    const destinationSystem = getSystemByName(session.destinationSystem, commander.galaxyIndex)?.data;
    if (!originSystem || !destinationSystem) {
      return undefined;
    }
    // Undocking reuses the travel-session contract with origin===destination
    // and zero jump fuel. Treat that as "no hyperspace route selected" so the
    // HUD and controls do not imply a destination jump exists.
    const hasHyperspaceRoute = session.fuelUnits > 0 && session.originSystem !== session.destinationSystem;

    const canvas = refs.canvasRef.current;
    const viewport = refs.viewportRef.current;
    if (!canvas || !viewport) {
      return undefined;
    }

    const travelSceneRenderer = new TravelSceneRenderer(canvas);

    const random = createMathRandomSource();
    const combatState = createTravelCombatState(
      {
        legalValue: commander.legalValue,
        government: originSystem.government,
        techLevel: originSystem.techLevel,
        missionContext: session.missionContext,
        energyBanks: commander.energyBanks,
        energyPerBank: commander.energyPerBank,
        laserMounts: commander.laserMounts,
        installedEquipment: commander.installedEquipment,
        missilesInstalled: commander.missilesInstalled
      },
      random
    );
    // Every travel session starts in the origin system's station space. Routed
    // travel later rebinds the combat state to the destination system and calls
    // `enterArrivalSpace(...)`, which replaces this origin station with the
    // destination station after hyperspace completes.
    enterStationSpace(combatState, random);

    let cw = 0;
    let ch = 0;
    const radarInsetTop = RADAR_INSET_TOP;
    const radarInsetRight = RADAR_INSET_RIGHT;
    const resize = () => {
      cw = canvas.width = viewport.clientWidth;
      ch = canvas.height = viewport.clientHeight;
      travelSceneRenderer.resize(cw, ch);
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
    let creditedCombatReward = 0;
    let autoDockActive = false;
    let autoDockState: AutoDockState | null = null;
    let dockingAnimationState: DockingAnimationState | null = null;
    let playerDeathState: PlayerDeathState | null = null;
    let playerBankState = createShipBankState();
    let enemyBankStates = new Map<number, ShipBankState>();
    let elapsedFlightMs = 0;
    let continueAfterDeathRequested = false;
    const onAnyContinueInput = () => {
      if (playerDeathState && playerDeathState.elapsedMs >= PLAYER_DEATH_ANIMATION_MS) {
        continueAfterDeathRequested = true;
      }
    };
    const syncAutoDockUi = () => {
      setAutoDockState({
        visible: combatState.playerLoadout.installedEquipment.docking_computer,
        enabled: canAutoDock(combatState),
        active: autoDockActive
      });
    };

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
        energyBanks: nextHud.energyBanks,
        energyColor: nextHud.energyColor,
        shieldRatio: nextHud.shieldRatio,
        shieldColor: nextHud.shieldColor,
        laserHeat: nextHud.laserHeat,
        lasersActive: nextHud.lasersActive,
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
      // The bomb button is a live reflection of the mutable combat loadout, so
      // it disappears immediately after the single-use charge is spent.
      setBombState({
        visible: nextHud.bombVisible
      });
      // ECM is a purchased subsystem rather than a consumable, so visibility
      // mirrors equipment ownership and does not depend on transient flight state.
      setEcmState({
        visible: combatState.playerLoadout.installedEquipment.ecm
      });
      setHyperspaceHiddenState(!hasHyperspaceRoute || jumpCompleted);
      // The DOCK control is a purchased capability. Once owned, it stays on
      // screen so the player can see when station position enables it again,
      // and whether the docking computer currently owns the controls.
      syncAutoDockUi();
    };

    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      setMessageState(text);
    };

    // All successful exits funnel through this helper so the store receives the
    // same snapshot shape whether docking happens manually or via auto-dock.
    const completeDocking = (dockSystemName: string, spendJumpFuel: boolean) => {
      const snapshot = getPlayerCombatSnapshot(combatState);
      completeTravel({
        dockSystemName,
        spendJumpFuel,
        legalValue: combatState.legalValue,
        tallyDelta: combatState.player.tallyKills,
        cargo: snapshot.cargo,
        fuelDelta: snapshot.fuel,
        installedEquipment: snapshot.installedEquipment,
        missilesInstalled: snapshot.missilesInstalled
      });
      navigate('/', { replace: true });
    };

    const finishPlayerLoss = () => {
      if (combatState.playerLoadout.installedEquipment.escape_pod) {
        consumeEscapePod(combatState);
        const snapshot = getPlayerCombatSnapshot(combatState);
        completeTravel({
          outcome: 'rescued',
          dockSystemName: jumpCompleted ? session.destinationSystem : session.originSystem,
          spendJumpFuel: jumpCompleted,
          legalValue: combatState.legalValue,
          tallyDelta: combatState.player.tallyKills,
          cargo: snapshot.cargo,
          fuelDelta: snapshot.fuel,
          installedEquipment: snapshot.installedEquipment,
          missilesInstalled: snapshot.missilesInstalled
        });
        navigate('/', { replace: true });
        return;
      }

      // In classic Elite, destruction without an escape pod throws the player
      // back to the title flow rather than quietly respawning them in local
      // space. Reset the docked game and reopen the attract gate.
      resetAfterDeath();
      navigate('/', { replace: true });
    };

    const startPlayerDeathSequence = () => {
      if (combatState.playerLoadout.installedEquipment.escape_pod) {
        finishPlayerLoss();
        return;
      }
      if (playerDeathState) {
        return;
      }
      // Death is a presentation phase, not an immediate teardown: the rest of
      // the encounter stays visible while the player hull disintegrates and the
      // title prompt waits for explicit acknowledgement.
      flightState = 'GAMEOVER';
      autoDockActive = false;
      autoDockState = null;
      combatState.player.vx = 0;
      combatState.player.vy = 0;
      playerDeathState = { elapsedMs: 0 };
      continueAfterDeathRequested = false;
      overlayMessage = '';
      overlayTimer = 0;
      setMessageState('');
      updateHud();
    };

    const startDockingAnimation = (dockSystemName: string, spendJumpFuel: boolean) => {
      dockingAnimationState = {
        elapsedMs: 0,
        dockSystemName,
        spendJumpFuel
      };
      flightState = 'DOCKING_ANIMATION';
      autoDockActive = false;
      autoDockState = null;
      combatState.player.vx = 0;
      combatState.player.vy = 0;
      showMessage('DOCKING', DOCKING_ANIMATION_DURATION_MS);
      updateHud();
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
      if (!hasHyperspaceRoute) {
        inputRef.current.hyperspace = false;
        updateHud();
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
      const hyperspaceHeading = getSystemHeading(session.originSystem, session.destinationSystem, commander.galaxyIndex);
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

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onAnyContinueInput);
    viewport.addEventListener('pointerdown', onAnyContinueInput);

    // The frame loop is the authoritative owner of mutable session state. It
    // folds together keyboard/touch input, advances the simulation, resolves
    // travel outcomes, then copies only render-facing state back into React.
    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      elapsedFlightMs += deltaMs;
      const dt = Math.min(deltaMs, 32) / 16.6667;
      const workStart = performance.now();
      const perfAccumulator = perfRef.current;
      pushPerfSample(perfAccumulator.frameDeltas, deltaMs);
      const liveInput = inputRef.current;
      const keys = keysRef.current;
      if (flightState === 'DOCKING_ANIMATION' && dockingAnimationState && combatState.station) {
        const animationProgress = Math.min(1, dockingAnimationState.elapsedMs / DOCKING_ANIMATION_DURATION_MS);
        // Advance station rotation first so camera framing uses the same dock
        // orientation that the renderer will show on this exact frame.
        combatState.station.angle += combatState.station.rotSpeed * dt;
        const dockDirection = getStationDockDirection(combatState.station);
        const inwardDirection = {
          x: -dockDirection.x,
          y: -dockDirection.y
        };
        const lateralDirection = {
          // World rendering mirrors gameplay Y through `toSceneY(...)`, so the
          // visually consistent "camera on the ship's right" offset uses the
          // mirrored 2D perpendicular rather than the raw gameplay-space one.
          x: inwardDirection.y,
          y: -inwardDirection.x
        };
        combatState.player.angle = Math.atan2(inwardDirection.y, inwardDirection.x);
        combatState.player.x += inwardDirection.x * DOCKING_ANIMATION_FORWARD_SPEED * dt;
        combatState.player.y += inwardDirection.y * DOCKING_ANIMATION_FORWARD_SPEED * dt;
        playerBankState = createShipBankState();

        const cameraBlend = animationProgress * animationProgress * (3 - 2 * animationProgress);
        const baseCameraDistance = getPerspectiveCameraDistance(ch, 36);
        const dockMouth = getStationDockMouthPoint(combatState.station);
        // Docking readability matters more than a perfectly centered view. Keep
        // the camera trailing behind the ship and slightly off-axis so the hull
        // stays inside frame while the station mouth remains visible ahead.
        const cameraPosition = {
          x:
            combatState.player.x -
            inwardDirection.x * DOCKING_CAMERA_FOLLOW_DISTANCE +
            lateralDirection.x * DOCKING_CAMERA_SIDE_OFFSET * cameraBlend,
          y:
            combatState.player.y -
            inwardDirection.y * DOCKING_CAMERA_FOLLOW_DISTANCE +
            lateralDirection.y * DOCKING_CAMERA_SIDE_OFFSET * cameraBlend,
          z: baseCameraDistance * (1 - cameraBlend * (1 - DOCKING_CAMERA_HEIGHT_FACTOR))
        };
        const cameraLookAt = {
          // Focus the shot on the tunnel mouth instead of the station center.
          // Blending from the ship toward the mouth keeps entry readable while
          // still letting the player hull anchor the composition.
          x:
            combatState.player.x +
            inwardDirection.x * DOCKING_CAMERA_LOOKAHEAD * (1 - cameraBlend) +
            (dockMouth.x - combatState.player.x) * DOCKING_CAMERA_MOUTH_FOCUS * cameraBlend,
          y:
            combatState.player.y +
            inwardDirection.y * DOCKING_CAMERA_LOOKAHEAD * (1 - cameraBlend) +
            (dockMouth.y - combatState.player.y) * DOCKING_CAMERA_MOUTH_FOCUS * cameraBlend,
          z: 0
        };

        dockingAnimationState.elapsedMs += deltaMs;
        updateHud();
        travelSceneRenderer.renderFrame({
          combatState,
          stars,
          flightState,
          systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
          showTargetLock: false,
          playerBankAngle: 0,
          enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
          cameraOverride: {
            position: cameraPosition,
            lookAt: cameraLookAt
          },
          radarInsetTop,
          radarInsetRight
        });
        pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
        if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
          publishPerfSnapshot(timestamp);
        }
        if (dockingAnimationState.elapsedMs >= DOCKING_ANIMATION_DURATION_MS) {
          completeDocking(dockingAnimationState.dockSystemName, dockingAnimationState.spendJumpFuel);
          return;
        }
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (playerDeathState) {
        playerDeathState.elapsedMs += deltaMs;
        const showGameOver = playerDeathState.elapsedMs >= PLAYER_DEATH_GAME_OVER_MS;
        const showPrompt = playerDeathState.elapsedMs >= PLAYER_DEATH_ANIMATION_MS;
        const deathWorldFlightState: FlightPhase = jumpCompleted ? 'ARRIVED' : 'PLAYING';
        if (showPrompt && continueAfterDeathRequested) {
          finishPlayerLoss();
          return;
        }
        const previousEnemyAngles = new Map<number, number>(combatState.enemies.map((enemy) => [enemy.id, enemy.angle]));
        // Keep the encounter alive behind the death animation so station
        // rotation, enemy movement and projectiles continue instead of freezing
        // on the exact frame where the player died.
        stepTravelCombat(
          combatState,
          {
            thrust: 0,
            turn: 0,
            toggleLasers: false,
            jump: false,
            hyperspace: false,
            activateEcm: false,
            triggerEnergyBomb: false,
            autoDock: false
          },
          dt,
          deathWorldFlightState,
          commander.cargo,
          random
        );
        enemyBankStates = new Map<number, ShipBankState>(
          combatState.enemies.map((enemy) => {
            const previousAngle = previousEnemyAngles.get(enemy.id) ?? enemy.angle;
            const previousState = enemyBankStates.get(enemy.id) ?? createShipBankState();
            return [enemy.id, stepShipBankState(previousState, {
              currentAngle: enemy.angle,
              previousAngle,
              dt
            })];
          })
        );
        setMessageState('');
        updateHud();
        travelSceneRenderer.renderFrame({
          combatState,
          stars,
          flightState: deathWorldFlightState,
          systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
          showTargetLock: false,
          playerBankAngle: 0,
          enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
          playerDeathEffect: {
            elapsedMs: playerDeathState.elapsedMs,
            showGameOver,
            showPrompt,
            continueVisible: Math.floor(playerDeathState.elapsedMs / PLAYER_DEATH_PROMPT_BLINK_MS) % 2 === 0
          },
          radarInsetTop,
          radarInsetRight
        });
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

      const manualSteeringRequested = Math.abs(liveInput.turn) > 0.08 || liveInput.thrust > 0.08;
      if (autoDockActive && manualSteeringRequested) {
        autoDockActive = false;
        autoDockState = null;
        showMessage('AUTO-DOCK CANCELLED', 900);
      }
      if (autoDockActive && (!canAutoDock(combatState) || flightState === 'HYPERSPACE' || flightState === 'JUMPING')) {
        autoDockActive = false;
        autoDockState = null;
        showMessage('AUTO-DOCK CANCELLED', 900);
      }

      liveInput.jump = keys.j || keys.J || liveInput.jump;
      liveInput.hyperspace = keys.h || keys.H || liveInput.hyperspace;
      liveInput.activateEcm = keys.e || keys.E || liveInput.activateEcm;
      liveInput.triggerEnergyBomb = keys.b || keys.B || liveInput.triggerEnergyBomb;
      liveInput.autoDock = autoDockRef.current.enabled && (keys.d || keys.D || liveInput.autoDock);

      if (liveInput.autoDock && autoDockRef.current.enabled && !autoDockActive && flightState !== 'HYPERSPACE' && flightState !== 'JUMPING') {
        autoDockActive = true;
        autoDockState = createAutoDockState();
        showMessage('AUTO-DOCK ENGAGED', 900);
      }

      if (flightState === 'READY' && (Math.abs(combatState.player.vx) > 0.02 || Math.abs(combatState.player.vy) > 0.02 || liveInput.thrust > 0 || Math.abs(liveInput.turn) > 0.1)) {
        flightState = 'PLAYING';
      }

      const joystickHeadingActive = joyActiveRef.current && liveInput.vectorStrength > 0.08 && flightState !== 'HYPERSPACE' && flightState !== 'JUMPING';
      let joystickHeading: number | null = null;
      let joystickThrust: number | null = null;
      if (joystickHeadingActive) {
        joystickHeading = Math.atan2(liveInput.vectorY, liveInput.vectorX);
        joystickThrust = getJoystickProjectedThrust(liveInput.vectorX, liveInput.vectorY, combatState.player.angle);
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

      let autoDockCommand = null;
      if (autoDockActive && combatState.station && autoDockState) {
        const autoDockStep = stepAutoDockState(autoDockState, combatState.station, combatState.player);
        autoDockState = autoDockStep.state;
        autoDockCommand = autoDockStep.command;
      }

      const playerTurnCommand = flightState === 'HYPERSPACE' || flightState === 'JUMPING'
        ? 0
        : autoDockCommand?.turn ?? (joystickHeading === null ? liveInput.turn : getJoystickTurnCommand(combatState.player.angle, joystickHeading));
      const previousPlayerAngle = combatState.player.angle;
      const previousEnemyAngles = new Map<number, number>(combatState.enemies.map((enemy) => [enemy.id, enemy.angle]));
      const result = stepTravelCombat(
        combatState,
        {
          // While auto-dock is active, the docking computer injects the same
          // low-level turn/thrust controls a pilot would use, so the ship
          // still follows the normal flight model and station collision rules.
          thrust: flightState === 'HYPERSPACE' || flightState === 'JUMPING' ? 0 : autoDockCommand?.thrust ?? joystickThrust ?? liveInput.thrust,
          turn: playerTurnCommand,
          toggleLasers: flightState === 'HYPERSPACE' ? false : liveInput.toggleLasers,
          jump: flightState === 'JUMPING' && jumpRequested && !jumpBlocked,
          hyperspace: flightState === 'HYPERSPACE',
          activateEcm: flightState === 'HYPERSPACE' ? false : liveInput.activateEcm,
          triggerEnergyBomb: flightState === 'HYPERSPACE' ? false : liveInput.triggerEnergyBomb,
          autoDock: false
        },
        dt,
        flightState,
        commander.cargo,
        random
      );
      playerBankState = stepShipBankState(playerBankState, {
        currentAngle: combatState.player.angle,
        previousAngle: previousPlayerAngle,
        dt
      });
      enemyBankStates = new Map<number, ShipBankState>(
        combatState.enemies.map((enemy) => {
          const previousAngle = previousEnemyAngles.get(enemy.id) ?? enemy.angle;
          const previousState = enemyBankStates.get(enemy.id) ?? createShipBankState();
          return [enemy.id, stepShipBankState(previousState, {
            currentAngle: enemy.angle,
            previousAngle,
            dt
          })];
        })
      );

      if (combatState.player.combatReward > creditedCombatReward) {
        const newlyEarnedCredits = combatState.player.combatReward - creditedCombatReward;
        grantCombatCredits(newlyEarnedCredits);
        creditedCombatReward = combatState.player.combatReward;
      }

      if (result.autoDocked) {
        autoDockActive = false;
        autoDockState = null;
        completeDocking(jumpCompleted ? session.destinationSystem : session.originSystem, jumpCompleted);
        return;
      }

      if ((flightState === 'READY' || flightState === 'PLAYING' || flightState === 'ARRIVED') && liveInput.jump) {
        startLocalJump();
      }

      if ((flightState === 'READY' || flightState === 'PLAYING') && liveInput.hyperspace) {
        startHyperspace();
      }

      if ((keys.d || keys.D) && autoDockRef.current.visible && !autoDockRef.current.enabled && flightState !== 'HYPERSPACE') {
        showMessage('AUTO-DOCK REQUIRES SAFE ZONE', 900);
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
        if (docking.collidesWithHull) {
          // The station hull is unforgiving in the original game: clipping the
          // solid ring is a fatal mistake, not a recoverable bumper impact.
          combatState.player.energy = 0;
          startPlayerDeathSequence();
          pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
          if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
            publishPerfSnapshot(timestamp);
          }
          animationFrameId = window.requestAnimationFrame(loop);
          return;
        } else if (docking.isInDockingGap) {
          if (docking.canDock) {
            startDockingAnimation(jumpCompleted ? session.destinationSystem : session.originSystem, jumpCompleted);
            pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
            if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
              publishPerfSnapshot(timestamp);
            }
            animationFrameId = window.requestAnimationFrame(loop);
            return;
          }
          if (!docking.isFacingHangar || docking.speed >= 3.6) {
            showMessage('ENTER SLOT NOSE-IN AT LOW SPEED', 1000);
          }
        }
      }

      if (result.playerDestroyed) {
        startPlayerDeathSequence();
        pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
        if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
          publishPerfSnapshot(timestamp);
        }
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (result.playerEscaped) {
        finishPlayerLoss();
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

      if (!keys.j && !keys.J) {
        // Jump hold needs the same treatment as other held controls so touch presses can
        // sustain local jump for as long as the player keeps holding the button.
        liveInput.jump = jumpPointerIdRef.current !== null;
      }
      liveInput.toggleLasers = false;
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
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState,
        systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
        showTargetLock: Boolean(combatState.playerTargetLock),
        playerBankAngle: playerBankState.visualAngle,
        enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
        playerDeathEffect: null,
        radarInsetTop,
        radarInsetRight
      });
      pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
      if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
        publishPerfSnapshot(timestamp);
      }
      animationFrameId = window.requestAnimationFrame(loop);
    };

    showMessage(
      hasHyperspaceRoute ? `ROUTE ${session.originSystem.toUpperCase()} -> ${session.destinationSystem.toUpperCase()}` : `LOCAL SPACE: ${session.originSystem.toUpperCase()}`,
      2400
    );
    updateHud();
    resetInput();
    perfRef.current = createPerfAccumulator(performance.now());
    setPerf(EMPTY_PERF_SNAPSHOT);
    animationFrameId = window.requestAnimationFrame(loop);
    return () => {
      // Pointer/keyboard state is cleared on teardown so a route change cannot
      // leak held inputs into the next session.
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onAnyContinueInput);
      viewport.removeEventListener('pointerdown', onAnyContinueInput);
      travelSceneRenderer.dispose();
      resetInput();
    };
  }, [commander, completeTravel, inputRef, joyActiveRef, jumpPointerIdRef, keysRef, navigate, refs.canvasRef, refs.viewportRef, resetInput, session]);

  return {
    hud,
    message,
    hyperspaceHidden,
    autoDock,
    bomb,
    ecm,
    perf,
    recordReactCommit,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    toggleLasersButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    dockButtonHandlers
  };
}
