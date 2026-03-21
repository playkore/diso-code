import type { TravelCombatState } from '../../../domain/travelCombat';
import { getEnemyColor, getEnemyShape, getProjectileColor, drawWireframe } from './shipsRenderer';

export function drawShips(ctx: CanvasRenderingContext2D, state: TravelCombatState, camX: number, camY: number) {
  for (const enemy of state.enemies) {
    drawWireframe(ctx, getEnemyShape(enemy), enemy.x - camX, enemy.y - camY, enemy.angle, getEnemyColor(enemy.roles, enemy.missionTag));
  }
}

export function drawProjectilesAndParticles(ctx: CanvasRenderingContext2D, state: TravelCombatState, camX: number, camY: number) {
  ctx.lineWidth = 2;
  for (const projectile of state.projectiles) {
    ctx.strokeStyle = getProjectileColor(projectile);
    ctx.shadowBlur = 5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(projectile.x - camX, projectile.y - camY);
    ctx.lineTo(projectile.x - camX - projectile.vx, projectile.y - camY - projectile.vy);
    ctx.stroke();
  }

  for (const particle of state.particles) {
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 5;
    ctx.shadowColor = particle.color;
    ctx.fillRect(particle.x - camX, particle.y - camY, 2, 2);
  }
}
