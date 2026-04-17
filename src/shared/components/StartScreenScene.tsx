import { useEffect, useRef } from 'react';
import { createDefaultCommander } from '../../features/commander/domain/commander';
import { createDefaultMissionTravelContext } from '../../features/travel/domain/missionContext';
import { spawnEnemyFromBlueprint } from '../../features/travel/domain/combat/spawn/spawnEnemy';
import { createMathRandomSource, createTravelCombatState, type CombatStation } from '../../features/travel/domain/travelCombat';
import { createStars } from '../../features/travel/components/renderers_and_hooks/travelVisuals';
import { TravelSceneRenderer } from '../../features/travel/components/renderers_and_hooks/TravelSceneRenderer';
import { getPerspectiveCameraDistance } from '../../features/travel/components/renderers_and_hooks/renderers/travelSceneMath';
import { getStartingSystemName } from '../../features/galaxy/domain/galaxyCatalog';
import { START_SCREEN_SHOWCASE_COUNT, START_SCREEN_SHOWCASE_ENTRIES } from './startScreenShowcase';

const DEMO_SYSTEM_NAME = getStartingSystemName(0);
const DEMO_CAMERA_FOV_DEGREES = 36;
const DEMO_SHIP_CAMERA_DISTANCE_FACTOR = 0.07;
const DEMO_STARFIELD_SPEED_X = 42;
const DEMO_ENEMY_SHOWCASE_DISTANCE = 0;
const DEMO_HIDDEN_ENTITY_OFFSET = 10000;
const SHOWCASE_ROLL_SPEED = 1.8;
const SHOWCASE_PITCH_SPEED = 0.7;
const STATION_SHOWCASE_CAMERA_FACTOR = 0.21;
const STATION_SHOWCASE_RADIUS = 16;
const STATION_SHOWCASE_SPIN_SPEED = 0.9;
const TAU = Math.PI * 2;
const STATION_SHOWCASE: CombatStation = {
  x: 0,
  y: 0,
  radius: STATION_SHOWCASE_RADIUS,
  angle: Math.PI * 0.17,
  spinAngle: Math.PI * 0.35,
  rotSpeed: STATION_SHOWCASE_SPIN_SPEED / 60,
  safeZoneRadius: 360
};
export interface StartScreenSceneProps {
  showcaseIndex: number;
  onShowcaseLabelChange: (label: string) => void;
  onSceneReady?: (ready: boolean) => void;
}

export function StartScreenScene({
  showcaseIndex,
  onShowcaseLabelChange,
  onSceneReady
}: StartScreenSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLSpanElement | null>(null);
  const showcaseIndexRef = useRef(showcaseIndex);

  useEffect(() => {
    showcaseIndexRef.current = showcaseIndex;
  }, [showcaseIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return undefined;
    }

    const travelSceneRenderer = new TravelSceneRenderer(canvas);
    const commander = createDefaultCommander();
    const combatState = createTravelCombatState(
      {
        legalValue: commander.legalValue,
        government: 0,
        techLevel: 7,
        systemX: 20,
        missionContext: createDefaultMissionTravelContext(DEMO_SYSTEM_NAME),
        level: commander.level,
        xp: commander.xp,
        hp: commander.hp,
        maxHp: commander.maxHp,
        attack: commander.attack,
        laserMounts: commander.laserMounts,
        installedEquipment: commander.installedEquipment,
        missilesInstalled: commander.missilesInstalled
      },
      createMathRandomSource()
    );
    const stars = createStars();
    const enemyBankAngles = new Map<number, number>();
    let lastShowcaseLabel = '';
    let showcasedEnemyId: number | null = null;
    let showcasedEntryKey: string | null = null;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let starfieldOffsetX = 0;
    let stationSpinAngle = STATION_SHOWCASE.spinAngle ?? 0;
    let dragAnchorX = 0;
    let dragAnchorY = 0;
    let manualShowcaseRoll = 0;
    let manualShowcasePitch = 0;
    let autoShowcaseRoll = 0;
    let autoShowcasePitch = 0;
    let activePointerId: number | null = null;

    // The attract scene reuses the real travel renderer, but it keeps a frozen
    // simulation state so only one hull is visible at a time and controls stay
    // deterministic while the user browses ships manually.
    combatState.playerLasersActive = false;
    combatState.encounter.safeZone = true;
    combatState.station = null;

    const resize = () => {
      viewportWidth = Math.max(1, viewport.clientWidth);
      viewportHeight = Math.max(1, viewport.clientHeight);
      canvas.width = viewportWidth;
      canvas.height = viewportHeight;
      travelSceneRenderer.resize(viewportWidth, viewportHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    resize();
    // The gate prompt swaps from "Loading" to the start instruction only after
    // the showcase module is mounted and has a real canvas to render into.
    onSceneReady?.(true);

    const renderFrame = (timestamp: number) => {
      const deltaSeconds = lastTimestamp === 0 ? 1 / 60 : Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      starfieldOffsetX += deltaSeconds * DEMO_STARFIELD_SPEED_X;
      autoShowcaseRoll = (autoShowcaseRoll + deltaSeconds * SHOWCASE_ROLL_SPEED) % TAU;
      autoShowcasePitch = (autoShowcasePitch + deltaSeconds * SHOWCASE_PITCH_SPEED) % TAU;
      const showcaseEntry = START_SCREEN_SHOWCASE_ENTRIES[showcaseIndexRef.current % START_SCREEN_SHOWCASE_COUNT];
      const showcaseLabel = showcaseEntry.label;
      // The auto-rotation is a true two-axis spin, with independent angular
      // velocities so the hull never falls into an obvious synchronized loop.
      const showcasePitch = manualShowcasePitch + autoShowcasePitch;
      const showcaseRoll = manualShowcaseRoll + autoShowcaseRoll;

      // The overlay label only needs to update when the carousel advances to a
      // new showcase target, so React avoids re-rendering every animation tick.
      if (showcaseLabel !== lastShowcaseLabel) {
        lastShowcaseLabel = showcaseLabel;
        onShowcaseLabelChange(showcaseLabel);
      }

      combatState.player.x = DEMO_HIDDEN_ENTITY_OFFSET;
      combatState.player.y = DEMO_HIDDEN_ENTITY_OFFSET;
      combatState.player.vx = 0;
      combatState.player.vy = 0;
      combatState.player.angle = 0;
      combatState.enemies.length = 0;
      enemyBankAngles.clear();
      combatState.station = null;

      if (showcaseEntry.kind === 'ship') {
        if (showcasedEntryKey !== showcaseEntry.id || showcasedEnemyId === null) {
          showcasedEntryKey = showcaseEntry.id;
          combatState.nextId += 1;
          showcasedEnemyId = combatState.nextId;
        }

        const showcasedEnemy = spawnEnemyFromBlueprint(combatState, showcaseEntry.id, createMathRandomSource(), {
          id: showcasedEnemyId,
          x: DEMO_ENEMY_SHOWCASE_DISTANCE,
          y: 0,
          vx: 0,
          vy: 0,
          angle: 0,
          aggression: 0,
          baseAggression: 0,
          fireCooldown: Number.POSITIVE_INFINITY,
          missileCooldown: Number.POSITIVE_INFINITY,
          lifetime: 0
        });
        enemyBankAngles.set(showcasedEnemy.id, 0);
      } else {
        showcasedEntryKey = 'station';
        showcasedEnemyId = null;
        stationSpinAngle = (stationSpinAngle + deltaSeconds * STATION_SHOWCASE_SPIN_SPEED) % TAU;
        combatState.station = {
          ...STATION_SHOWCASE,
          spinAngle: stationSpinAngle
        };
      }

      // The start screen keeps a close camera so every showcased hull reads as
      // a large hero render instead of a distant gameplay object.
      const cameraDistance =
        getPerspectiveCameraDistance(viewportHeight, DEMO_CAMERA_FOV_DEGREES)
        * (showcaseEntry.kind === 'station' ? STATION_SHOWCASE_CAMERA_FACTOR : DEMO_SHIP_CAMERA_DISTANCE_FACTOR);
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState: 'PLAYING',
        systemLabel: DEMO_SYSTEM_NAME,
        showRadar: false,
        showSafeZoneRing: false,
        showTargetLock: false,
        playerBankAngle: 0,
        enemyBankAngles,
        starfieldAnchor: {
          x: starfieldOffsetX,
          y: 0,
          vx: DEMO_STARFIELD_SPEED_X,
          vy: 0
        },
        cameraOverride: {
          position: {
            x: 0,
            y: 0,
            z: cameraDistance
          },
          lookAt: {
            x: 0,
            y: 0,
            z: 0
          }
        },
        showcaseOrientationOverride: {
          roll: showcaseRoll,
          pitch: showcasePitch,
        },
        showPlayer: false,
        radarInsetTop: 0,
        radarInsetRight: 0
      });

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    // The showcase keeps roll and pitch separate so horizontal and vertical
    // drag gestures stay mapped to their own axes.
    const handlePointerDown = (event: PointerEvent) => {
      if (activePointerId !== null) {
        return;
      }
      activePointerId = event.pointerId;
      dragAnchorX = event.clientX;
      dragAnchorY = event.clientY;
      viewport.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }
      const deltaX = event.clientX - dragAnchorX;
      const deltaY = event.clientY - dragAnchorY;
      manualShowcaseRoll += deltaX * 0.008;
      manualShowcasePitch += deltaY * 0.008;
      dragAnchorX = event.clientX;
      dragAnchorY = event.clientY;
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== activePointerId) {
        return;
      }
      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }
      activePointerId = null;
    };

    viewport.addEventListener('pointerdown', handlePointerDown);
    viewport.addEventListener('pointermove', handlePointerMove);
    viewport.addEventListener('pointerup', handlePointerEnd);
    viewport.addEventListener('pointercancel', handlePointerEnd);

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      viewport.removeEventListener('pointerdown', handlePointerDown);
      viewport.removeEventListener('pointermove', handlePointerMove);
      viewport.removeEventListener('pointerup', handlePointerEnd);
      viewport.removeEventListener('pointercancel', handlePointerEnd);
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      travelSceneRenderer.dispose();
      onShowcaseLabelChange('');
    };
  }, [onSceneReady, onShowcaseLabelChange]);

  return (
    <span className="start-menu__scene" ref={viewportRef} aria-hidden="true">
      <canvas ref={canvasRef} className="start-menu__scene-canvas" />
      <span className="start-menu__scene-overlay" />
    </span>
  );
}
