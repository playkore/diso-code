import { useEffect, useRef } from 'react';
import { createDefaultCommander } from '../domain/commander';
import { createDefaultMissionTravelContext } from '../domain/missionContext';
import { spawnEnemyFromBlueprint } from '../domain/combat/spawn/spawnEnemy';
import { BLUEPRINTS, createMathRandomSource, createTravelCombatState, type BlueprintId } from '../domain/travelCombat';
import { createStars, TravelSceneRenderer } from '../screens/travel/TravelSceneRenderer';
import { getPerspectiveCameraDistance } from '../screens/travel/renderers/travelSceneMath';

const DEMO_SYSTEM_NAME = 'Lave';
const DEMO_CAMERA_FOV_DEGREES = 36;
const DEMO_STATION_RADIUS = 96;
const DEMO_SAFE_ZONE_RADIUS = 240;
const DEMO_STATION_SPIN_SPEED = 0.42;
const DEMO_STATION_CAMERA_DISTANCE_FACTOR = 1.4;
const DEMO_SHIP_CAMERA_DISTANCE_FACTOR = 0.07;
const DEMO_STARFIELD_SPEED_X = 42;
const DEMO_STATION_SHOWCASE_DURATION_SECONDS = 2.8;
const DEMO_SHIP_SHOWCASE_DURATION_SECONDS = 2.1;
const DEMO_PLAYER_SHOWCASE_DISTANCE = 0;
const DEMO_ENEMY_SHOWCASE_DISTANCE = 0;
const DEMO_HIDDEN_ENTITY_OFFSET = 10000;
const DEMO_STATION_LABEL = 'Coriolis Station';
const SHOWCASE_BLUEPRINT_IDS: readonly BlueprintId[] = [
  'sidewinder',
  'mamba',
  'krait',
  'adder',
  'gecko',
  'cobra-mk1',
  'cobra-mk3-pirate',
  'asp-mk2',
  'python-pirate',
  'fer-de-lance'
] as const;

type ShowcasePhase =
  | { kind: 'station' }
  | { kind: 'player' }
  | { kind: 'enemy'; blueprintId: BlueprintId };

export interface StartScreenSceneProps {
  onShowcaseLabelChange: (label: string) => void;
  onSceneReady?: () => void;
}

function getShowcasePhase(elapsedSeconds: number): ShowcasePhase {
  const cycleDuration =
    DEMO_STATION_SHOWCASE_DURATION_SECONDS + DEMO_SHIP_SHOWCASE_DURATION_SECONDS * (1 + SHOWCASE_BLUEPRINT_IDS.length);
  const cycleSeconds = elapsedSeconds % cycleDuration;
  if (cycleSeconds < DEMO_STATION_SHOWCASE_DURATION_SECONDS) {
    return { kind: 'station' };
  }

  const shipCycleSeconds = cycleSeconds - DEMO_STATION_SHOWCASE_DURATION_SECONDS;
  const shipSlotIndex = Math.floor(shipCycleSeconds / DEMO_SHIP_SHOWCASE_DURATION_SECONDS);
  if (shipSlotIndex === 0) {
    return { kind: 'player' };
  }

  return {
    kind: 'enemy',
    blueprintId: SHOWCASE_BLUEPRINT_IDS[(shipSlotIndex - 1) % SHOWCASE_BLUEPRINT_IDS.length]
  };
}

function getShowcaseLabel(phase: ShowcasePhase): string {
  if (phase.kind === 'station') {
    return DEMO_STATION_LABEL;
  }
  if (phase.kind === 'player') {
    return 'Cobra Mk III';
  }
  if (phase.kind === 'enemy') {
    return BLUEPRINTS[phase.blueprintId].label;
  }
  return '';
}

export function StartScreenScene({ onShowcaseLabelChange, onSceneReady }: StartScreenSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLSpanElement | null>(null);

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
        missionContext: createDefaultMissionTravelContext(DEMO_SYSTEM_NAME),
        energyBanks: commander.energyBanks,
        energyPerBank: commander.energyPerBank,
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
    let showcasedEnemyBlueprintId: BlueprintId | null = null;
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let elapsedSeconds = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let starfieldOffsetX = 0;

    // The attract scene reuses the real travel renderer, but it keeps its own
    // tiny self-contained choreography instead of stepping the real sim:
    // station-only showcase, then one large ship at a time in a loop.
    combatState.playerLasersActive = false;
    combatState.encounter.safeZone = true;

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
    onSceneReady?.();

    const renderFrame = (timestamp: number) => {
      const deltaSeconds = lastTimestamp === 0 ? 1 / 60 : Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      elapsedSeconds += deltaSeconds;
      starfieldOffsetX += deltaSeconds * DEMO_STARFIELD_SPEED_X;
      const showcaseAngle = elapsedSeconds * DEMO_STATION_SPIN_SPEED;
      const showcasePhase = getShowcasePhase(elapsedSeconds);
      const showcaseLabel = getShowcaseLabel(showcasePhase);

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

      if (showcasePhase.kind === 'station') {
        combatState.station = {
          x: 0,
          y: 0,
          radius: DEMO_STATION_RADIUS,
          angle: showcaseAngle,
          rotSpeed: DEMO_STATION_SPIN_SPEED,
          safeZoneRadius: DEMO_SAFE_ZONE_RADIUS
        };
      } else {
        // Once the station phase ends, the preview becomes a pure ship
        // carousel. The station is removed entirely so each hull owns the full
        // frame without competing geometry behind it.
        combatState.station = null;
      }

      if (showcasePhase.kind === 'player') {
        combatState.player.x = DEMO_PLAYER_SHOWCASE_DISTANCE;
        combatState.player.y = 0;
        combatState.player.angle = showcaseAngle;
      }

      if (showcasePhase.kind === 'enemy') {
        if (showcasedEnemyBlueprintId !== showcasePhase.blueprintId || showcasedEnemyId === null) {
          showcasedEnemyBlueprintId = showcasePhase.blueprintId;
          combatState.nextId += 1;
          showcasedEnemyId = combatState.nextId;
        }

        const showcasedEnemy = spawnEnemyFromBlueprint(combatState, showcasePhase.blueprintId, createMathRandomSource(), {
          id: showcasedEnemyId,
          x: DEMO_ENEMY_SHOWCASE_DISTANCE,
          y: 0,
          vx: 0,
          vy: 0,
          angle: showcaseAngle,
          aggression: 0,
          baseAggression: 0,
          fireCooldown: Number.POSITIVE_INFINITY,
          missileCooldown: Number.POSITIVE_INFINITY,
          lifetime: 0
        });
        enemyBankAngles.set(showcasedEnemy.id, showcaseAngle);
      } else {
        showcasedEnemyBlueprintId = null;
        showcasedEnemyId = null;
      }

      // The station keeps the original distant "traffic camera" framing, while
      // ships move much closer so each hull nearly fills the viewport on its
      // own and reads like a hero render instead of a gameplay camera.
      const cameraDistance = getPerspectiveCameraDistance(viewportHeight, DEMO_CAMERA_FOV_DEGREES)
        * (showcasePhase.kind === 'station' ? DEMO_STATION_CAMERA_DISTANCE_FACTOR : DEMO_SHIP_CAMERA_DISTANCE_FACTOR);
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState: 'PLAYING',
        systemLabel: DEMO_SYSTEM_NAME,
        showRadar: false,
        showSafeZoneRing: false,
        showTargetLock: false,
        playerBankAngle: showcasePhase.kind === 'player' ? showcaseAngle : 0,
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
        radarInsetTop: 0,
        radarInsetRight: 0
      });

      animationFrameId = window.requestAnimationFrame(renderFrame);
    };

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      travelSceneRenderer.dispose();
      onShowcaseLabelChange('');
    };
  }, [onSceneReady, onShowcaseLabelChange]);

  return (
    <span className="mobile-fullscreen-gate__scene" ref={viewportRef} aria-hidden="true">
      <canvas ref={canvasRef} className="mobile-fullscreen-gate__scene-canvas" />
      <span className="mobile-fullscreen-gate__scene-overlay" />
    </span>
  );
}
