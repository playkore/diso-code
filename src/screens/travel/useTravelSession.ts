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

/**
 * Travel screen lifecycle overview
 * -------------------------------
 *
 * This hook is the UI-side orchestrator for the real-time flight segment.
 *
 * Responsibilities:
 * - create one combat simulation state for the active route
 * - wire browser input into normalized combat input
 * - run the requestAnimationFrame loop
 * - translate simulation outcomes into store transitions/navigation
 * - keep the HUD and canvas synchronized with the live simulation
 *
 * In other words:
 * - combat rules live in `domain/combat/*`
 * - rendering primitives live in `screens/travel/render*`
 * - this hook is the bridge that turns those pieces into a playable screen
 */

/**
 * Collection of imperative refs used by the travel screen.
 *
 * The flight segment is intentionally ref-driven because the screen updates on
 * every animation frame and would be too expensive/noisy to re-render through
 * React state for each HUD change.
 */
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

/**
 * Runs one full travel session for the current route.
 *
 * A session starts when the component mounts on `/travel` and ends when the
 * player:
 * - docks,
 * - is rescued,
 * - aborts,
 * - or leaves the page.
 */
export function useTravelSession(
  refs: TravelRefs,
  session: TravelState | null,
  commander: CommanderState,
  completeTravel: (report?: Parameters<ReturnType<typeof import('../../store/useGameStore').useGameStore.getState>['completeTravel']>[0]) => void,
  cancelTravel: () => void,
  navigate: (to: string, options?: { replace?: boolean }) => void
) {
  // Shared mutable flag that lets keyboard and joystick input coexist cleanly.
  const joyActiveRef = useRef(false);

  useEffect(() => {
    // No route, no flight session.
    if (!session) {
      return undefined;
    }

    // Resolve both route endpoints up front. The flight screen only makes sense
    // when both the origin and destination systems are known.
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
    // The travel screen is fully imperative once mounted. If any required DOM
    // node is missing, we abort the session rather than run partially.
    if (!canvas || !viewport || !messageNode || !scoreNode || !shieldsNode || !jumpNode || !legalNode || !threatNode || !arcNode || !knobNode || !jumpButton || !fireButton || !ecmButton || !bombButton || !dockButton) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    // One RNG and one mutable combat state live for the entire mounted session.
    // The simulation mutates this object in place instead of rebuilding state
    // every frame.
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
    // Canvas size is kept locked to the viewport so the renderer can work in
    // actual device pixels rather than CSS guesses.
    const resize = () => {
      cw = canvas.width = viewport.clientWidth;
      ch = canvas.height = viewport.clientHeight;
    };
    resize();

    // `input` is the normalized control object consumed by the simulation.
    // Browser-specific event handling mutates this object, not React state.
    const input = createTravelInput();
    const keys: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ' ': false, j: false, J: false, e: false, E: false, b: false, B: false, d: false, D: false };

    // This local phase machine sits above the domain simulation. It models UI
    // flow such as the hyperspace transition and game-over reset behavior.
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

    /**
     * Shows a local overlay message that takes priority over ordinary combat
     * chatter. Used for route and docking guidance.
     */
    const showMessage = (text: string, duration: number) => {
      overlayMessage = text;
      overlayTimer = duration;
      messageNode.textContent = text;
    };

    /**
     * Updates the textual HUD. This stays imperative on purpose so the screen
     * does not re-render through React on every animation frame.
     */
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

    /**
     * Finalizes the route and merges the travel-combat outcome back into the
     * main game store.
     *
     * This is used by both:
     * - auto-docking
     * - manual docking through the station slot
     *
     * Keeping one shared completion path prevents subtle divergences in fuel,
     * mission-event or salvage handling.
     */
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

    /**
     * Enters the hyperspace tunnel phase from manual flight.
     */
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

    /**
     * Rebuilds the entire encounter in place after game over.
     *
     * This keeps the user on the same route screen while restoring all combat
     * state, stars and flight phase to a fresh starting point.
     */
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

    /**
     * Main animation frame loop.
     *
     * Loop order:
     * 1. derive normalized input from keyboard/joystick state
     * 2. advance the combat simulation
     * 3. resolve UI-level travel transitions (jump, docking, rescue, reset)
     * 4. update HUD and canvas
     * 5. schedule the next frame
     */
    const loop = (timestamp: number) => {
      const deltaMs = lastTimestamp === 0 ? 16.6667 : timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const dt = Math.min(deltaMs, 32) / 16.6667;

      // Game over freezes normal simulation and waits for the player to fire in
      // order to restart the prototype encounter.
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

      // The initial phase becomes "real flight" as soon as the player actually
      // applies movement input or the ship starts drifting.
      if (flightState === 'READY' && (Math.abs(combatState.player.vx) > 0.02 || Math.abs(combatState.player.vy) > 0.02 || input.thrust > 0 || Math.abs(input.turn) > 0.1)) {
        flightState = 'PLAYING';
      }

      // On touch/joystick input the ship points directly at the stick vector.
      if (joyActiveRef.current && input.vectorStrength > 0.08 && flightState !== 'JUMPING') {
        combatState.player.angle = Math.atan2(input.vectorY, input.vectorX);
      }

      // The domain layer handles combat rules. The UI layer only gates controls
      // during hyperspace and interprets the returned high-level outcome flags.
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

      // Hyperspace travel is still partially a UI concern because the tunnel
      // pacing and destination handoff are route-flow behavior rather than pure
      // dogfight simulation.
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

      // Manual docking/collision handling sits here because it needs to react
      // immediately with navigation and player guidance messages.
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

      // Total destruction transitions into the resetable local GAMEOVER phase.
      if (result.playerDestroyed) {
        flightState = 'GAMEOVER';
        showMessage('SHIP DESTROYED - PRESS FIRE TO RESET', 99999);
      }

      // Escape-pod rescue exits the flight screen and returns the outcome to the
      // store through the rescue-specific completion path.
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

      // Small UX aid: after arriving, a motionless player gets a hint about the
      // station slot instead of sitting with no feedback.
      if (flightState === 'ARRIVED' && Math.hypot(combatState.player.vx, combatState.player.vy) < 0.05) {
        stationaryTicks += 1;
        if (stationaryTicks > 120) {
          showMessage('LINE UP WITH THE SPLIT IN THE STATION RING', 1400);
          stationaryTicks = 0;
        }
      } else {
        stationaryTicks = 0;
      }

      // Local overlay messages intentionally override ordinary combat messages
      // for a short time.
      if (overlayTimer > 0) {
        overlayTimer -= deltaMs;
        if (overlayTimer <= 0) {
          overlayMessage = '';
        }
      }
      messageNode.textContent = overlayMessage || combatState.messages[0]?.text || '';

      // One-shot actions should not stay latched once the corresponding key is
      // released.
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

    // Boot the session into origin-system local space and start rendering.
    resetPrototype();
    animationFrameId = window.requestAnimationFrame(loop);
    return () => {
      // Standard full teardown for the mounted flight session.
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      unbindInput();
    };
  }, [refs, session, commander, completeTravel, cancelTravel, navigate]);
}
