import type { StarPoint } from './starsRenderer';

/**
 * Fixed star depth bands for the WebGL renderer.
 *
 * The old canvas renderer let every star carry its own parallax scalar. The
 * Three.js scene groups those stars into a few stable layers so the background
 * reads as deliberate depth planes and can later map cleanly onto richer 3D
 * presentation without changing the star generator contract.
 */
export interface ParallaxLayerConfig {
  parallax: number;
  streakScale: number;
}

export const PARALLAX_LAYER_CONFIGS: readonly ParallaxLayerConfig[] = [
  { parallax: 0.24, streakScale: 0.8 },
  { parallax: 0.42, streakScale: 1.05 },
  { parallax: 0.62, streakScale: 1.3 },
  { parallax: 0.82, streakScale: 1.6 }
] as const;

export interface ShipPresentationAngles {
  pitch: number;
  yaw: number;
}

const MAX_PLAYER_BANK_RADIANS = 0.95;
const PLAYER_BANK_RESPONSE = 0.18;

export interface ShipBankState {
  turnProgress: number;
  turnSign: number;
  visualAngle: number;
}

export interface StepShipBankArgs {
  currentAngle: number;
  previousAngle: number;
  dt: number;
}

export function createShipBankState(): ShipBankState {
  return {
    turnProgress: 0,
    turnSign: 0,
    visualAngle: 0
  };
}

/**
 * Buckets stars into a few parallax layers while preserving deterministic star
 * membership for a given generated field.
 */
export function bucketStarsByParallax(
  stars: readonly StarPoint[],
  layerConfigs: readonly ParallaxLayerConfig[] = PARALLAX_LAYER_CONFIGS
) {
  const buckets = layerConfigs.map(() => [] as StarPoint[]);
  for (const star of stars) {
    const normalizedDepth = Math.max(0, Math.min(0.9999, (star.z - 0.2) / 0.8));
    const bucketIndex = Math.min(layerConfigs.length - 1, Math.floor(normalizedDepth * layerConfigs.length));
    buckets[bucketIndex].push(star);
  }
  return buckets;
}

/**
 * Keeps the combat plane at roughly one world unit per screen pixel near the
 * center of the frame, which preserves the feel of the original canvas view
 * while still using a perspective camera.
 */
export function getPerspectiveCameraDistance(viewportHeight: number, fovDegrees: number) {
  const safeHeight = Math.max(1, viewportHeight);
  const fovRadians = (fovDegrees * Math.PI) / 180;
  return safeHeight / 2 / Math.tan(fovRadians / 2);
}

/**
 * The current ships are still flat line shapes, so the renderer tilts them
 * gently based on where they sit on screen. That gives the scene a future-3D
 * feel now without changing the underlying 2D combat simulation.
 */
export function getShipPresentationAngles(
  offsetX: number,
  offsetY: number,
  viewportWidth: number,
  viewportHeight: number
): ShipPresentationAngles {
  const xRatio = Math.max(-1, Math.min(1, offsetX / Math.max(1, viewportWidth * 0.5)));
  const yRatio = Math.max(-1, Math.min(1, offsetY / Math.max(1, viewportHeight * 0.5)));
  return {
    pitch: -yRatio * 0.18,
    yaw: xRatio * 0.28
  };
}

/**
 * Banking follows the accumulated turn progress of the active steering action.
 *
 * - 0° turn progress: no bank
 * - 90° turn progress: maximum bank
 * - 180° turn progress: back to zero bank
 * - 270° turn progress: maximum bank again
 * - 360° turn progress: back to zero bank again
 *
 * The magnitude is periodic, while the sign still comes from steering
 * direction so left/right turns lean onto opposite sides of the hull.
 */
export function getPlayerBankAngle(turnProgress: number, turnInput: number) {
  const turnSign = Math.sign(turnInput);
  if (turnSign === 0) {
    return 0;
  }
  return turnSign * Math.abs(Math.sin(turnProgress)) * MAX_PLAYER_BANK_RADIANS;
}

/**
 * Ship-bank state advances purely from the ship's real heading delta. That
 * keeps player and enemy visuals on the same rule: any hull that is actually
 * turning accumulates bank progress, changes bank side when the turn direction
 * flips, and eases back toward neutral after rotation stops.
 */
export function stepShipBankState(state: ShipBankState, args: StepShipBankArgs): ShipBankState {
  const next: ShipBankState = { ...state };
  const headingDelta = Math.atan2(Math.sin(args.currentAngle - args.previousAngle), Math.cos(args.currentAngle - args.previousAngle));
  const turnSign = Math.sign(headingDelta);
  if (turnSign === 0) {
    next.turnProgress = 0;
    next.turnSign = 0;
  } else {
    if (next.turnSign !== turnSign) {
      next.turnProgress = 0;
      next.turnSign = turnSign;
    }
    const signedHeadingDelta = headingDelta * turnSign;
    if (signedHeadingDelta > 0) {
      next.turnProgress += signedHeadingDelta;
    }
  }

  const targetVisualAngle = getPlayerBankAngle(next.turnProgress, next.turnSign);
  next.visualAngle += (targetVisualAngle - next.visualAngle) * Math.min(1, PLAYER_BANK_RESPONSE * args.dt);
  if (Math.abs(next.visualAngle) < 0.0001) {
    next.visualAngle = 0;
  }
  return next;
}

/**
 * Screen-space wrapping keeps the starfield effectively infinite without
 * polluting the combat world with huge coordinates that never affect gameplay.
 */
export function getWrappedStarScreenPosition(
  star: StarPoint,
  player: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
  parallax: number
) {
  const x = ((star.x - player.x * parallax) % viewportWidth + viewportWidth) % viewportWidth;
  const y = ((star.y - player.y * parallax) % viewportHeight + viewportHeight) % viewportHeight;
  return { x, y };
}
