import type { FlightPhase } from '../../../domain/travelCombat';
import { CGA_RED, CGA_YELLOW } from './constants';

/**
 * Starfield renderer.
 *
 * Normal flight uses static parallax dots. Local jump and hyperspace reuse the
 * same stars as streaks, changing only color and velocity emphasis to signal
 * the current drive mode without leaving the CGA palette.
 */
export interface StarPoint {
  x: number;
  y: number;
  z: number;
}

export function createStars() {
  const stars: StarPoint[] = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * 0.8 + 0.2
    });
  }
  return stars;
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: StarPoint[],
  flightState: FlightPhase,
  cw: number,
  ch: number,
  player: { x: number; y: number; vx: number; vy: number }
) {
  for (const star of stars) {
    const sx = ((star.x - player.x * star.z) % cw + cw) % cw;
    const sy = ((star.y - player.y * star.z) % ch + ch) % ch;

    if (flightState === 'HYPERSPACE') {
      ctx.strokeStyle = CGA_RED;
      ctx.shadowBlur = 2;
      ctx.shadowColor = CGA_RED;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - player.vx * star.z * 2, sy - player.vy * star.z * 2);
      ctx.stroke();
    } else if (flightState === 'JUMPING') {
      ctx.strokeStyle = CGA_YELLOW;
      ctx.shadowBlur = 2;
      ctx.shadowColor = CGA_YELLOW;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - player.vx * star.z * 2, sy - player.vy * star.z * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = CGA_YELLOW;
      ctx.shadowBlur = 2;
      ctx.shadowColor = CGA_YELLOW;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }

  ctx.shadowBlur = 0;
}
