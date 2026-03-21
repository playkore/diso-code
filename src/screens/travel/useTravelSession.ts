import { useEffect, useRef } from 'react';
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
  setCombatSystemContext,
  stepTravelCombat,
  type FlightPhase
} from '../../domain/travelCombat';
import { hasMissionFlag } from '../../domain/missions';
import type { TravelState } from '../../store/types';
import { renderCanvas } from './renderCanvas';
import { createStars } from './renderers/starsRenderer';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './renderers/constants';
import { createTravelInput, bindTravelInput } from './useTravelInput';
import { getHudState } from './travelViewModel';

interface TravelRefs {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  messageRef: React.RefObject<HTMLDivElement | null>;
  scoreRef: React.RefObject<HTMLSpanElement | null>;
  shieldsRef: React.RefObject<HTMLSpanElement | null>;
  jumpRef: React.RefObject<HTMLSpanElement | null>;
  legalRef: React.RefObject<HTMLSpanElement | null>;
  threatRef: React.RefObject<HTMLSpanElement | null>;
  arcRef: React.RefObject<HTMLSpanElement | null>;
  knobRef: React.RefObject<HTMLDivElement | null>;
  jumpButtonRef: React.RefObject<HTMLButtonElement | null>;
  fireButtonRef: React.RefObject<HTMLButtonElement | null>;
  ecmButtonRef: React.RefObject<HTMLButtonElement | null>;
  bombButtonRef: React.RefObject<HTMLButtonElement | null>;
  dockButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export function useTravelSession(
  refs: TravelRefs,
  session: TravelState | null,
  commander: CommanderState,
  completeTravel: (report?: Parameters<ReturnType<typeof import('../../store/useGameStore').useGameStore.getState>['completeTravel']>[0]) => void,
  cancelTravel: () => void,
  navigate: (to: string, options?: { replace?: boolean }) => void
) {
  const joyActiveRef = useRef(false);

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
    const messageNode = refs.messageRef.current;
    const scoreNode = refs.scoreRef.current;
    const shieldsNode = refs.shieldsRef.current;
    const jumpNode = refs.jumpRef.current;
    const legalNode = refs.legalRef.current;
    const threatNode = refs.threatRef.current;
    const arcNode = refs.arcRef.current;
    const knobNode = refs.knobRef.current;
    const jumpButton = refs.jumpButtonRef.current;
    const fireButton = refs.fireButtonRef.current;
    const ecmButton = refs.ecmButtonRef.current;
    const bombButton = refs.bombButtonRef.current;
    const dockButton = refs.dockButtonRef.current;
    if (!canvas || !viewport || !messageNode || !scoreNode || !shieldsNode || !jumpNode || !legalNode || !threatNode || !arcNode || !knobNode || !jumpButton || !fireButton || !ecmButton || !bombButton || !dockButton) {
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

    const input = createTravelInput();
    const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ' ': false, j: false, J: false, e: false, E: false, b: false, B: false, d: false, D: false };
    let flightState: FlightPhase = 'READY';
    let jumpTimer = 0;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let stationaryTicks = 0;
    let stars = createStars();
    let overlayMessage = '';
    let overlayTimer = 0;
    let jumpCompleted = false;

    const onResize = () => resize();
    window.addEventListener('resize', onResize);
    const unbindInput = bindTravelInput({
      viewport,
      knobNode,
      jumpButton,
      fireButton,
      ecmButton,
      bombButton,
      dockButton,
      input,
      keys,
      joyActiveRef
    });

    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      messageNode.textContent = text;
    };

    const updateHud = () => {
      const hud = getHudState(combatState, flightState);
      scoreNode.textContent = hud.score;
      shieldsNode.textContent = hud.shields;
      shieldsNode.style.color = combatState.player.shields <= 30 ? CGA_RED : CGA_GREEN;
      jumpNode.textContent = hud.jump;
      legalNode.textContent = hud.legal;
      legalNode.style.color = combatState.legalValue >= 50 ? CGA_RED : combatState.legalValue >= 1 ? CGA_YELLOW : CGA_GREEN;
      threatNode.textContent = hud.threat;
      threatNode.style.color = hud.hostileCount > 0 ? CGA_RED : CGA_GREEN;
      arcNode.textContent = hud.arc;
      arcNode.style.color = combatState.playerLoadout.laserMounts[combatState.lastPlayerArc] ? CGA_YELLOW : CGA_RED;
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

    const startJump = () => {
      if (flightState !== 'READY' && flightState !== 'PLAYING') {
        return;
      }
      flightState = 'JUMPING';
      jumpTimer = 100;
      showMessage(`HYPERSPACE TO ${session.destinationSystem.toUpperCase()}`, 2000);
      combatState.player.vx = Math.cos(combatState.player.angle) * 5;
      combatState.player.vy = Math.sin(combatState.player.angle) * 5;
      input.jump = false;
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
    };

    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const dt = Math.min(deltaMs, 32) / 16.6667;

      if (flightState === 'GAMEOVER') {
        if (input.fire || keys[' ']) {
          resetPrototype();
        }
        renderCanvas(ctx, combatState, stars, flightState, cw, ch, jumpCompleted ? session.destinationSystem : session.originSystem);
        animationFrameId = window.requestAnimationFrame(loop);
        return;
      }

      if (keys.ArrowLeft) {
        input.turn = -1;
      } else if (keys.ArrowRight) {
        input.turn = 1;
      } else if (!joyActiveRef.current) {
        input.turn = 0;
      }
      if (keys.ArrowUp) {
        input.thrust = 1;
      } else if (!joyActiveRef.current) {
        input.thrust = 0;
      }
      if (!joyActiveRef.current) {
        input.vectorX = 0;
        input.vectorY = 0;
        input.vectorStrength = 0;
      }

      input.fire = keys[' '] || input.fire;
      input.jump = keys.j || keys.J || input.jump;
      input.activateEcm = keys.e || keys.E || input.activateEcm;
      input.triggerEnergyBomb = keys.b || keys.B || input.triggerEnergyBomb;
      input.autoDock = keys.d || keys.D || input.autoDock;

      if (flightState === 'READY' && (Math.abs(combatState.player.vx) > 0.02 || Math.abs(combatState.player.vy) > 0.02 || input.thrust > 0 || Math.abs(input.turn) > 0.1)) {
        flightState = 'PLAYING';
      }
      if (joyActiveRef.current && input.vectorStrength > 0.08 && flightState !== 'JUMPING') {
        combatState.player.angle = Math.atan2(input.vectorY, input.vectorX);
      }

      const result = stepTravelCombat(
        combatState,
        {
          thrust: flightState === 'JUMPING' ? 0 : input.thrust,
          turn: flightState === 'JUMPING' ? 0 : input.turn,
          fire: flightState === 'JUMPING' ? false : input.fire,
          activateEcm: flightState === 'JUMPING' ? false : input.activateEcm,
          triggerEnergyBomb: flightState === 'JUMPING' ? false : input.triggerEnergyBomb,
          autoDock: flightState === 'JUMPING' ? false : input.autoDock
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
      if ((flightState === 'READY' || flightState === 'PLAYING') && input.jump) {
        startJump();
      }
      if (flightState === 'JUMPING') {
        combatState.player.vx *= 1.05;
        combatState.player.vy *= 1.05;
        combatState.player.x += combatState.player.vx * dt;
        combatState.player.y += combatState.player.vy * dt;
        jumpTimer -= dt;
        if (jumpTimer <= 0) {
          setCombatSystemContext(combatState, { government: destinationSystem.government, techLevel: destinationSystem.techLevel, witchspace: false }, random);
          enterArrivalSpace(combatState, random);
          jumpCompleted = true;
          flightState = 'ARRIVED';
          showMessage(`SYSTEM REACHED: ${session.destinationSystem.toUpperCase()}`, 1800);
        }
      }

      if (combatState.station && flightState !== 'JUMPING') {
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
      messageNode.textContent = overlayMessage || combatState.messages[0]?.text || '';

      if (!keys[' ']) {
        input.fire = false;
      }
      if (!keys.j && !keys.J) {
        input.jump = false;
      }
      if (!keys.e && !keys.E) {
        input.activateEcm = false;
      }
      if (!keys.b && !keys.B) {
        input.triggerEnergyBomb = false;
      }
      if (!keys.d && !keys.D) {
        input.autoDock = false;
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
      unbindInput();
    };
  }, [refs, session, commander, completeTravel, cancelTravel, navigate]);
}
