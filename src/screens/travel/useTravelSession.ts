import { useEffect, useRef, useState, type RefObject } from 'react';
import { getSystemByName } from '../../domain/galaxyCatalog';
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
import { getHudState } from './travelViewModel';
import { useTravelInput } from './useTravelInput';

const HYPERSPACE_DURATION = 160;

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
  const hudRef = useRef(hud);
  const messageRef = useRef(message);
  const hyperspaceHiddenRef = useRef(hyperspaceHidden);
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

  useEffect(() => {
    if (!session) {
      return undefined;
    }

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
      flightState = 'HYPERSPACE';
      hyperspaceTimer = HYPERSPACE_DURATION;
      showMessage(`HYPERSPACE TO ${session.destinationSystem.toUpperCase()}`, 2000);
      combatState.player.vx = Math.cos(combatState.player.angle) * 5;
      combatState.player.vy = Math.sin(combatState.player.angle) * 5;
      updateHud();
    };

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

    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const dt = Math.min(deltaMs, 32) / 16.6667;
      const liveInput = inputRef.current;
      const keys = keysRef.current;

      if (flightState === 'GAMEOVER') {
        if (liveInput.fire || keys[' ']) {
          resetPrototype();
        }
        renderCanvas(ctx, combatState, stars, flightState, cw, ch, jumpCompleted ? session.destinationSystem : session.originSystem);
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
        const progress = 1 - hyperspaceTimer / HYPERSPACE_DURATION;
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
      animationFrameId = window.requestAnimationFrame(loop);
    };

    resetPrototype();
    animationFrameId = window.requestAnimationFrame(loop);
    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      resetInput();
    };
  }, [commander, completeTravel, inputRef, joyActiveRef, keysRef, navigate, refs.canvasRef, refs.viewportRef, resetInput, session]);

  return {
    hud,
    message,
    hyperspaceHidden,
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
