import type { CombatProjectile, CombatShipRoles, TravelCombatState } from '../../../domain/travelCombat';
import { CGA_GREEN, CGA_RED, CGA_YELLOW, SHAPE_ENEMY, SHAPE_PLAYER, SHAPE_POLICE, SHAPE_THARGOID } from './constants';
import { drawLineShape } from './lineShapeRenderer';

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
  // Ships still use a single closed contour, but they now flow through the
  // shared line-shape renderer so debug previews and future background objects
  // match the exact same stroke treatment.
  drawLineShape(
    ctx,
    [
      {
        points: points.map((point) => [point[0], point[1]] as [number, number]),
        closed: true
      }
    ],
    x,
    y,
    angle,
    color,
    scale
  );
}

export function drawPlayer(ctx: CanvasRenderingContext2D, cw: number, ch: number, angle: number) {
  drawWireframe(ctx, SHAPE_PLAYER, cw / 2, ch / 2, angle, CGA_YELLOW);
}
