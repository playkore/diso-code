import type { FlightPhase } from '../../../domain/travelCombat';
import { CGA_YELLOW } from './constants';

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
  ctx.fillStyle = CGA_YELLOW;
  ctx.strokeStyle = CGA_YELLOW;
  ctx.shadowBlur = 2;
  ctx.shadowColor = CGA_YELLOW;

  for (const star of stars) {
    const sx = ((star.x - player.x * star.z) % cw + cw) % cw;
    const sy = ((star.y - player.y * star.z) % ch + ch) % ch;

    if (flightState === 'HYPERSPACE') {
      const dx = sx - cw / 2;
      const dy = sy - ch / 2;
      const scale = 0.28 + star.z * 0.85;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dx * scale, sy + dy * scale);
      ctx.stroke();
    } else if (flightState === 'JUMPING') {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - player.vx * star.z * 2, sy - player.vy * star.z * 2);
      ctx.stroke();
    } else {
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }

  ctx.shadowBlur = 0;
}
