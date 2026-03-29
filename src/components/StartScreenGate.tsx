import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createDefaultCommander } from '../domain/commander';
import { createDefaultMissionTravelContext } from '../domain/missionContext';
import { createMathRandomSource, createTravelCombatState } from '../domain/travelCombat';
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
const DEMO_ORBIT_RADIUS_X = 322;
const DEMO_ORBIT_RADIUS_Y = 210;
const DEMO_ORBIT_SPEED = 0.38;
const DEMO_CAMERA_SIDE_OFFSET = 0;
const DEMO_CAMERA_HEIGHT_OFFSET = 0;
const DEMO_CAMERA_DISTANCE_FACTOR = 1.4;
const DEMO_STARFIELD_SPEED_X = 42;

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

function StartScreenScene() {
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
    let animationFrameId = 0;
    let lastTimestamp = 0;
    let elapsedSeconds = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let starfieldOffsetX = 0;

    // The attract scene reuses the real travel renderer, but it owns a tiny
    // self-contained state: one station, one player ship, no combat entities.
    combatState.playerLasersActive = false;
    combatState.station = {
      x: 0,
      y: 0,
      radius: DEMO_STATION_RADIUS,
      angle: 0,
      rotSpeed: DEMO_ORBIT_SPEED,
      safeZoneRadius: DEMO_SAFE_ZONE_RADIUS
    };
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

      const orbitAngle = elapsedSeconds * DEMO_ORBIT_SPEED;
      const playerX = Math.cos(orbitAngle) * DEMO_ORBIT_RADIUS_X;
      const playerY = Math.sin(orbitAngle) * DEMO_ORBIT_RADIUS_Y;
      const tangentX = -Math.sin(orbitAngle) * DEMO_ORBIT_RADIUS_X;
      const tangentY = Math.cos(orbitAngle) * DEMO_ORBIT_RADIUS_Y;
      starfieldOffsetX += deltaSeconds * DEMO_STARFIELD_SPEED_X;

      combatState.player.x = playerX;
      combatState.player.y = playerY;
      combatState.player.vx = tangentX * DEMO_ORBIT_SPEED;
      combatState.player.vy = tangentY * DEMO_ORBIT_SPEED;
      combatState.player.angle = Math.atan2(tangentY, tangentX);
      if (combatState.station) {
        combatState.station.angle += deltaSeconds * 0.42;
      }

      // Match the travel screen camera distance, but keep the shot centered on
      // the station instead of the player so the attract scene reads like a
      // remote traffic camera near the dock.
      const cameraDistance = getPerspectiveCameraDistance(viewportHeight, DEMO_CAMERA_FOV_DEGREES) * DEMO_CAMERA_DISTANCE_FACTOR;
      travelSceneRenderer.renderFrame({
        combatState,
        stars,
        flightState: 'PLAYING',
        systemLabel: DEMO_SYSTEM_NAME,
        showRadar: false,
        showSafeZoneRing: false,
        showTargetLock: false,
        playerBankAngle: Math.sin(elapsedSeconds * 1.2) * 0.22,
        enemyBankAngles,
        starfieldAnchor: {
          x: starfieldOffsetX,
          y: 0,
          vx: DEMO_STARFIELD_SPEED_X,
          vy: 0
        },
        cameraOverride: {
          position: {
            x: DEMO_CAMERA_SIDE_OFFSET,
            y: DEMO_CAMERA_HEIGHT_OFFSET,
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
    };
  }, []);

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
        aria-label={mobilePlatform ? 'Press any key to continue in fullscreen' : 'Press any key to continue'}
      >
        <span className="mobile-fullscreen-gate__frame">
          <span className="mobile-fullscreen-gate__title">DISO CODE</span>
          <StartScreenScene />
          <span className="mobile-fullscreen-gate__prompt">Press any key</span>
          <span className="mobile-fullscreen-gate__copyright">© Alexey Korepanov 2026</span>
        </span>
      </div>
    </div>
  );
}
