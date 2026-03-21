import type { TravelCombatState } from '../../../domain/travelCombat';
import { CGA_GREEN, CGA_RED, CGA_YELLOW, SHAPE_STATION } from './constants';

function drawStationWithSplit(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1.8, 1.8);
  ctx.strokeStyle = CGA_YELLOW;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 6;
  ctx.shadowColor = CGA_YELLOW;

  ctx.beginPath();
  ctx.moveTo(SHAPE_STATION[0][0], SHAPE_STATION[0][1]);
  ctx.lineTo(SHAPE_STATION[1][0], SHAPE_STATION[1][1]);
  ctx.lineTo(SHAPE_STATION[2][0], SHAPE_STATION[2][1]);
  ctx.lineTo(SHAPE_STATION[3][0], SHAPE_STATION[3][1]);
  ctx.lineTo(SHAPE_STATION[4][0], SHAPE_STATION[4][1]);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(SHAPE_STATION[5][0], SHAPE_STATION[5][1]);
  ctx.lineTo(SHAPE_STATION[0][0], SHAPE_STATION[0][1]);
  ctx.stroke();

  ctx.restore();
}

export function drawStation(ctx: CanvasRenderingContext2D, state: TravelCombatState, camX: number, camY: number) {
  if (!state.station) {
    return;
  }

  const stationX = state.station.x - camX;
  const stationY = state.station.y - camY;
  drawStationWithSplit(ctx, stationX, stationY, state.station.angle);
  ctx.save();
  ctx.translate(stationX, stationY);
  ctx.strokeStyle = state.encounter.safeZone ? CGA_GREEN : CGA_RED;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, state.station.safeZoneRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);
}
