import { useCallback, useEffect, useRef, useState } from 'react';
import { getSystemByName, getSystemHeading } from '../../../galaxy/domain/galaxyCatalog';
import { clampAngle } from '../../domain/combat/state';
import {
  consumeEscapePod,
  createMathRandomSource,
  createTravelCombatState,
  getPlayerCombatSnapshot,
  isMassNearby,
  setCombatSystemContext,
  stepTravelCombat,
  type FlightPhase
} from '../../domain/travelCombat';
import type { TravelState } from '../../../../shared/store/types';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './renderers/constants';
import { getHyperspaceDurationFrames } from './travelTiming';
import { getHudState } from './travelViewModel';
import { useTravelInput } from './useTravelInput';
import { createBackgroundStar, createStars } from './travelVisuals';
import { TravelSceneRenderer } from './TravelSceneRenderer';
import { createShipBankState, getPerspectiveCameraDistance, stepShipBankState, type ShipBankState } from './renderers/travelSceneMath';
import type { TravelCompletionReport } from '../../../../shared/store/storeTypes';
import type { SeedTriplet } from '../../../galaxy/domain/universe';
import {
  areTravelSessionHudStatesEqual,
  INITIAL_HUD,
  type BombUiState,
  type CombatCommanderSnapshot,
  type EcmUiState,
  type GameOverOverlayState,
  type TravelRefs,
  type TravelSessionHudState
} from './travelSessionState';
import {
  EMPTY_PERF_SNAPSHOT,
  buildPerfSnapshot,
  createPerfAccumulator,
  pushPerfSample,
  resetPerfAccumulator,
  type PerfAccumulator
} from './travelSessionPerf';

interface PlayerDeathState {
  elapsedMs: number;
}

const PLAYER_DEATH_ANIMATION_MS = 1800;
const PLAYER_DEATH_GAME_OVER_MS = 900;
const PERF_REPORT_INTERVAL_MS = 500;
const RADAR_INSET_TOP = 20;
const RADAR_INSET_RIGHT = 20;

const JOYSTICK_TARGET_TURN_ANGLE = 0.12;

/**
 * Background scenery is keyed to the active system rather than the whole
 * travel session so the same system always reuses the same decorative star.
 */
export function getTravelBackgroundStarSeed(originSeed: SeedTriplet, destinationSeed: SeedTriplet, jumpCompleted: boolean) {
  return jumpCompleted ? destinationSeed : originSeed;
}

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getStationClampedCameraOverride(
  combatState: ReturnType<typeof createTravelCombatState>,
  cameraDistance: number
) {
  if (!combatState.station) {
    return null;
  }

  const cameraPosition = { x: combatState.player.x, y: combatState.player.y, z: cameraDistance };
  const stationOffsetX = cameraPosition.x - combatState.station.x;
  const stationOffsetY = cameraPosition.y - combatState.station.y;
  const stationDistance = Math.hypot(stationOffsetX, stationOffsetY);
  const clampRadius = combatState.station.safeZoneRadius;
  if (stationDistance >= clampRadius) {
    return null;
  }

  const fallbackAngle = combatState.player.angle + Math.PI;
  const radialDirection =
    stationDistance > 1e-6
      ? { x: stationOffsetX / stationDistance, y: stationOffsetY / stationDistance }
      : { x: Math.cos(fallbackAngle), y: Math.sin(fallbackAngle) };

  return {
    position: {
      x: combatState.station.x + radialDirection.x * clampRadius,
      y: combatState.station.y + radialDirection.y * clampRadius,
      z: cameraDistance
    },
    // The camera still frames the ship itself; only the viewpoint slides onto
    // the safe-zone ring once the usual follow camera would dive too close to
    // the station.
    lookAt: {
      x: combatState.player.x,
      y: combatState.player.y,
      z: 0
    }
  };
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
  completeTravel: (report?: TravelCompletionReport) => void,
  resetAfterDeath: () => void,
  navigate: (to: string, options?: { replace?: boolean }) => void,
  isConsoleOpen: boolean
) {
  const [hud, setHud] = useState(INITIAL_HUD);
  const [message, setMessage] = useState('');
  const [hyperspaceHidden, setHyperspaceHidden] = useState(false);
  const [bomb, setBomb] = useState<BombUiState>({
    visible: commander.installedEquipment.energy_bomb
  });
  const [ecm, setEcm] = useState<EcmUiState>({
    visible: commander.installedEquipment.ecm
  });
  const [perf, setPerf] = useState(EMPTY_PERF_SNAPSHOT);
  const [gameOverOverlay, setGameOverOverlay] = useState<GameOverOverlayState>({ visible: false });
  const hudRef = useRef(hud);
  const messageRef = useRef(message);
  const hyperspaceHiddenRef = useRef(hyperspaceHidden);
  const bombRef = useRef(bomb);
  const ecmRef = useRef(ecm);
  const pausedRef = useRef(isConsoleOpen);
  const perfRef = useRef<PerfAccumulator>(createPerfAccumulator(typeof performance === 'undefined' ? 0 : performance.now()));
  const {
    inputRef,
    keysRef,
    joyActiveRef,
    jumpPointerIdRef,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    resetInput
  } = useTravelInput(refs.viewportRef);

  const setHudState = (next: TravelSessionHudState) => {
    if (areTravelSessionHudStatesEqual(hudRef.current, next)) {
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
    const nextPerf = buildPerfSnapshot(accumulator, now);
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
    perfRef.current = resetPerfAccumulator(now);
  }, []);

  const recordReactCommit = useCallback((actualDuration: number) => {
    const accumulator = perfRef.current;
    accumulator.reactCommitCount += 1;
    accumulator.reactCommitTotalMs += actualDuration;
    accumulator.reactCommitMaxMs = Math.max(accumulator.reactCommitMaxMs, actualDuration);
  }, []);

  useEffect(() => {
    pausedRef.current = isConsoleOpen;
    if (isConsoleOpen) {
      resetInput();
    }
  }, [isConsoleOpen, resetInput]);

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
    const originSystem = getSystemByName(session.originSystem, commander.galaxyIndex);
    const destinationSystem = getSystemByName(session.destinationSystem, commander.galaxyIndex);
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
        government: originSystem.data.government,
        techLevel: originSystem.data.techLevel,
        systemX: originSystem.data.x,
        missionContext: session.missionContext,
        level: commander.level,
        xp: commander.xp,
        hp: commander.hp,
        maxHp: commander.maxHp,
        attack: commander.attack,
        laserMounts: commander.laserMounts,
        installedEquipment: commander.installedEquipment,
        missilesInstalled: commander.missilesInstalled
      },
      random
    );
    // Travel sessions now begin in open space. The combat state still keeps
    // the current system metadata, but there is no station entry or undock
    // sequence to complete before the player can fly.

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
    let stars = createStars();
    let backgroundStar = createBackgroundStar(getTravelBackgroundStarSeed(originSystem.seed, destinationSystem.seed, false));
    let overlayMessage = '';
    let overlayTimer = 0;
    let jumpCompleted = false;
    let creditedCombatReward = 0;
    let playerDeathState: PlayerDeathState | null = null;
    let playerBankState = createShipBankState();
    let enemyBankStates = new Map<number, ShipBankState>();
    let continueAfterDeathRequested = false;
    const onAnyContinueInput = () => {
      if (playerDeathState && playerDeathState.elapsedMs >= PLAYER_DEATH_ANIMATION_MS) {
        continueAfterDeathRequested = true;
      }
    };
    const getManualFlightState = (): FlightPhase => {
      if (jumpCompleted) {
        return 'ARRIVED';
      }
      return flightState === 'READY' ? 'READY' : 'PLAYING';
    };

    const updateHud = () => {
      const jumpBlocked = isMassNearby(combatState);
      const nextHud = getHudState(combatState, flightState, { jumpBlocked, hyperspaceBlocked: false, jumpCompleted });
      setHudState({
        level: nextHud.level,
        hpRatio: nextHud.hpRatio,
        hpColor: nextHud.hpColor,
        hpLabel: nextHud.hpLabel,
        xpRatio: nextHud.xpRatio,
        xpColor: nextHud.xpColor,
        xpLabel: nextHud.xpLabel,
        attackLabel: nextHud.attackLabel,
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
    };

    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      setMessageState(text);
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
          playerProgress: snapshot.progression,
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
      combatState.player.vx = 0;
      combatState.player.vy = 0;
      playerDeathState = { elapsedMs: 0 };
      continueAfterDeathRequested = false;
      overlayMessage = '';
      overlayTimer = 0;
      setMessageState('');
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

    const finalizeFrame = (timestamp: number, workStart: number, perfAccumulator: PerfAccumulator) => {
      pushPerfSample(perfAccumulator.workDurations, performance.now() - workStart);
      if (timestamp - perfAccumulator.windowStart >= PERF_REPORT_INTERVAL_MS) {
        publishPerfSnapshot(timestamp);
      }
      animationFrameId = window.requestAnimationFrame(loop);
    };

    const stepHyperspaceFlight = (dt: number) => {
      if (flightState !== 'HYPERSPACE') {
        return;
      }

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
        setCombatSystemContext(
          combatState,
          { government: destinationSystem.data.government, techLevel: destinationSystem.data.techLevel, systemX: destinationSystem.data.x, witchspace: false },
          random
        );
        backgroundStar = createBackgroundStar(getTravelBackgroundStarSeed(originSystem.seed, destinationSystem.seed, true));
        jumpCompleted = true;
        flightState = 'ARRIVED';
        combatState.player.vx = 0;
        combatState.player.vy = 0;
        showMessage(`SYSTEM REACHED: ${session.destinationSystem.toUpperCase()}`, 1800);
      }
    };

    const runPlayerDeathFrame = (timestamp: number, deltaMs: number, dt: number, workStart: number, perfAccumulator: PerfAccumulator) => {
      if (!playerDeathState) {
        return false;
      }

      playerDeathState.elapsedMs += deltaMs;
      const showGameOver = playerDeathState.elapsedMs >= PLAYER_DEATH_GAME_OVER_MS;
      const showPrompt = playerDeathState.elapsedMs >= PLAYER_DEATH_ANIMATION_MS;
      const deathWorldFlightState: FlightPhase = jumpCompleted ? 'ARRIVED' : 'PLAYING';
      if (showPrompt && continueAfterDeathRequested) {
        finishPlayerLoss();
        return true;
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
          jump: false,
          hyperspace: false,
          activateEcm: false,
          triggerEnergyBomb: false
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
      setGameOverOverlay({ visible: showGameOver });
      updateHud();
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState: deathWorldFlightState,
        systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
        showTargetLock: false,
        playerBankAngle: 0,
        enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
        backgroundStar,
        playerDeathEffect: {
          elapsedMs: playerDeathState.elapsedMs,
          showGameOver: false,
          showPrompt: false
        },
        radarInsetTop,
        radarInsetRight
      });
      finalizeFrame(timestamp, workStart, perfAccumulator);
      return true;
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
      const dt = Math.min(deltaMs, 32) / 16.6667;
      const workStart = performance.now();
      const perfAccumulator = perfRef.current;
      pushPerfSample(perfAccumulator.frameDeltas, deltaMs);
      if (runPlayerDeathFrame(timestamp, deltaMs, dt, workStart, perfAccumulator)) {
        return;
      }
      if (pausedRef.current) {
        updateHud();
        setGameOverOverlay({ visible: false });
        travelSceneRenderer.renderFrame({
          combatState,
          stars,
          flightState,
          systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
          showTargetLock: Boolean(combatState.playerTargetLock),
          playerBankAngle: playerBankState.visualAngle,
          enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
          backgroundStar,
          playerDeathEffect: null,
          radarInsetTop,
          radarInsetRight
        });
        finalizeFrame(timestamp, workStart, perfAccumulator);
        return;
      }
      const liveInput = inputRef.current;
      const keys = keysRef.current;

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

      liveInput.jump = keys.j || keys.J || liveInput.jump;
      liveInput.hyperspace = keys.h || keys.H || liveInput.hyperspace;
      liveInput.activateEcm = keys.e || keys.E || liveInput.activateEcm;
      liveInput.triggerEnergyBomb = keys.b || keys.B || liveInput.triggerEnergyBomb;

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

      const playerTurnCommand = flightState === 'HYPERSPACE' || flightState === 'JUMPING'
        ? 0
        : joystickHeading === null ? liveInput.turn : getJoystickTurnCommand(combatState.player.angle, joystickHeading);
      const previousPlayerAngle = combatState.player.angle;
      const previousEnemyAngles = new Map<number, number>(combatState.enemies.map((enemy) => [enemy.id, enemy.angle]));
      const result = stepTravelCombat(
        combatState,
        {
          thrust: flightState === 'HYPERSPACE' || flightState === 'JUMPING' ? 0 : joystickThrust ?? liveInput.thrust,
          turn: playerTurnCommand,
          jump: flightState === 'JUMPING' && jumpRequested && !jumpBlocked,
          hyperspace: flightState === 'HYPERSPACE',
          activateEcm: flightState === 'HYPERSPACE' ? false : liveInput.activateEcm,
          triggerEnergyBomb: flightState === 'HYPERSPACE' ? false : liveInput.triggerEnergyBomb
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

      if ((flightState === 'READY' || flightState === 'PLAYING' || flightState === 'ARRIVED') && liveInput.jump) {
        startLocalJump();
      }

      if ((flightState === 'READY' || flightState === 'PLAYING') && liveInput.hyperspace) {
        startHyperspace();
      }

      stepHyperspaceFlight(dt);

      if (result.playerDestroyed) {
        startPlayerDeathSequence();
        finalizeFrame(timestamp, workStart, perfAccumulator);
        return;
      }

      if (result.playerEscaped) {
        finishPlayerLoss();
        return;
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
      if (!keys.h && !keys.H) {
        liveInput.hyperspace = false;
      }
      if (!keys.e && !keys.E) {
        liveInput.activateEcm = false;
      }
      if (!keys.b && !keys.B) {
        liveInput.triggerEnergyBomb = false;
      }

      updateHud();
      setGameOverOverlay({ visible: false });
      const defaultCameraDistance = getPerspectiveCameraDistance(ch, 36);
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState,
        systemLabel: jumpCompleted ? session.destinationSystem : session.originSystem,
        showTargetLock: Boolean(combatState.playerTargetLock),
        playerBankAngle: playerBankState.visualAngle,
        enemyBankAngles: new Map(Array.from(enemyBankStates, ([enemyId, state]) => [enemyId, state.visualAngle])),
        backgroundStar,
        playerDeathEffect: null,
        cameraOverride: getStationClampedCameraOverride(combatState, defaultCameraDistance) ?? undefined,
        radarInsetTop,
        radarInsetRight
      });
      finalizeFrame(timestamp, workStart, perfAccumulator);
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
    gameOverOverlay,
    hyperspaceHidden,
    bomb,
    ecm,
    perf,
    recordReactCommit,
    joystickView,
    viewportHandlers,
    jumpButtonHandlers,
    hyperspaceButtonHandlers,
    ecmButtonHandlers,
    bombButtonHandlers,
    resetInput
  };
}
