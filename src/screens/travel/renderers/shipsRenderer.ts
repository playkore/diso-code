import type { CombatProjectile, CombatShipRoles, TravelCombatState } from '../../../domain/travelCombat';
import { CGA_GREEN, CGA_RED, CGA_YELLOW, SHAPE_ENEMY, SHAPE_PLAYER, SHAPE_POLICE, SHAPE_THARGOID } from './constants';

export function getEnemyColor(roles: CombatShipRoles, missionTag?: TravelCombatState['enemies'][number]['missionTag']) {
  if (missionTag?.role === 'target') {
    return CGA_YELLOW;
  }
  if (missionTag?.role === 'blockade' || missionTag?.role === 'ambusher' || missionTag?.role === 'scan-hostile') {
    return CGA_RED;
  }
  if (roles.cop) {
    return CGA_GREEN;
  }
  if (roles.innocent || roles.trader) {
    return CGA_YELLOW;
  }
  return CGA_RED;
}

export function getEnemyShape(state: TravelCombatState['enemies'][number]) {
  if (state.roles.cop) {
    return SHAPE_POLICE;
  }
  if (state.blueprintId === 'thargoid' || state.blueprintId === 'thargon') {
    return SHAPE_THARGOID;
  }
  return SHAPE_ENEMY;
}

export function getProjectileColor(projectile: CombatProjectile) {
  if (projectile.kind === 'missile') {
    return CGA_YELLOW;
  }
  return projectile.owner === 'player' ? CGA_GREEN : CGA_RED;
}

export function drawWireframe(
  ctx: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
  x: number,
  y: number,
  angle: number,
  color = CGA_YELLOW,
  scale = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowBlur = 6;
  ctx.shadowColor = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, cw: number, ch: number, angle: number) {
  drawWireframe(ctx, SHAPE_PLAYER, cw / 2, ch / 2, angle, CGA_YELLOW);
}
