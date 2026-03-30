import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createDefaultCommander } from '../domain/commander';
import { createDefaultMissionTravelContext } from '../domain/missionContext';
import { BLUEPRINTS, createMathRandomSource, createTravelCombatState, type BlueprintId } from '../domain/travelCombat';
import { spawnEnemyFromBlueprint } from '../domain/combat/spawn/spawnEnemy';
import { createStars, TravelSceneRenderer } from '../screens/travel/TravelSceneRenderer';
import { getPerspectiveCameraDistance } from '../screens/travel/renderers/travelSceneMath';

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

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

function isMobilePlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.userAgent || '';
  const touches = navigator.maxTouchPoints || 0;
  const isMobileAgent = /android|iphone|ipad|ipod|mobile/i.test(platform);
  const isTouchMac = navigator.platform === 'MacIntel' && touches > 1;
  const prefersCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

  // The gate is limited to mobile-class devices where browser chrome tends to
  // consume a meaningful part of the viewport and immersive mode matters.
  return isMobileAgent || (isTouchMac && prefersCoarsePointer);
}

function isDocumentFullscreen(doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

async function requestDocumentFullscreen(): Promise<void> {
  const root = document.documentElement as FullscreenElement;

  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return;
  }

  if (root.webkitRequestFullscreen) {
    await root.webkitRequestFullscreen();
  }
}

function StartScreenScene({ onShowcaseLabelChange }: { onShowcaseLabelChange: (label: string) => void }) {
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
  }, [onShowcaseLabelChange]);

  return (
    <span className="mobile-fullscreen-gate__scene" ref={viewportRef} aria-hidden="true">
      <canvas ref={canvasRef} className="mobile-fullscreen-gate__scene-canvas" />
      <span className="mobile-fullscreen-gate__scene-overlay" />
    </span>
  );
}

export function StartScreenGate() {
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showcaseLabel, setShowcaseLabel] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === 'undefined') {
      return false;
    }

    return isDocumentFullscreen(document as FullscreenDocument);
  });

  useEffect(() => {
    if (!mobilePlatform) {
      return undefined;
    }

    const syncFullscreenState = () => {
      setIsFullscreen(isDocumentFullscreen(document as FullscreenDocument));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    document.addEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
      document.removeEventListener('webkitfullscreenchange', syncFullscreenState as EventListener);
    };
  }, [mobilePlatform]);

  if (isDismissed) {
    return null;
  }

  const handleContinue = () => {
    if (!mobilePlatform || isFullscreen) {
      setIsDismissed(true);
      return;
    }

    // Browsers require fullscreen requests to originate from a direct user
    // gesture, so the title overlay owns the hand-off into the game on touch
    // devices. Desktop skips fullscreen and simply dismisses the attract mode.
    requestDocumentFullscreen()
      .catch(() => {
        setIsFullscreen(isDocumentFullscreen(document as FullscreenDocument));
      })
      .finally(() => {
        setIsDismissed(true);
      });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      return;
    }
    if (event.key !== ' ' && event.key !== 'Spacebar' && event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    handleContinue();
  };

  return (
    <div className="mobile-fullscreen-gate" role="presentation">
      <div
        role="button"
        tabIndex={0}
        className="mobile-fullscreen-gate__button"
        onClick={handleContinue}
        onKeyDown={handleKeyDown}
        aria-label={mobilePlatform ? 'Press spacebar to start game in fullscreen' : 'Press spacebar to start game'}
      >
        <span className="mobile-fullscreen-gate__frame">
          <span className="mobile-fullscreen-gate__title">DISO CODE</span>
          <StartScreenScene onShowcaseLabelChange={setShowcaseLabel} />
          <span className="mobile-fullscreen-gate__ship-label" aria-live="polite">
            {showcaseLabel}
          </span>
          <span className="mobile-fullscreen-gate__prompt">Press spacebar to start game</span>
          <span className="mobile-fullscreen-gate__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
    </div>
  );
}
