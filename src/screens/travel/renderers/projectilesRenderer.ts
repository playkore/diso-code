import type { CombatEnemy, TravelCombatState } from '../../../domain/travelCombat';
import { CGA_BLACK, CGA_GREEN, CGA_RED, CGA_YELLOW } from './constants';
import { getEnemyColor, getEnemyShape, getProjectileColor, drawWireframe } from './shipsRenderer';

/**
 * Enemy/projectile overlay renderer.
 *
 * Ship wireframes are rendered here instead of in `shipsRenderer` because the
 * travel screen wants a single pass that keeps enemy hulls, health bars,
 * projectiles, and particles visually grouped above the background layers.
 */
export interface EnemyHealthBarState {
  ratio: number;
  fillColor: string;
}

export function getEnemyHealthBarState(enemy: CombatEnemy): EnemyHealthBarState | null {
  if (enemy.energy >= enemy.maxEnergy) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, enemy.maxEnergy > 0 ? enemy.energy / enemy.maxEnergy : 0));
  return {
    ratio,
    fillColor: ratio <= 0.3 ? CGA_RED : ratio <= 0.65 ? CGA_YELLOW : CGA_GREEN
  };
}

function drawEnemyHealthBar(ctx: CanvasRenderingContext2D, enemy: CombatEnemy, screenX: number, screenY: number) {
  const healthBar = getEnemyHealthBarState(enemy);
  if (!healthBar) {
    return;
  }

  const width = 20;
  const height = 4;
  const x = Math.round(screenX - width / 2);
  const y = Math.round(screenY - 18);
  const fillWidth = Math.round(width * healthBar.ratio);

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = CGA_BLACK;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.strokeStyle = CGA_YELLOW;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
  ctx.fillStyle = CGA_RED;
  ctx.fillRect(x, y, width, height);
  if (fillWidth > 0) {
    ctx.fillStyle = healthBar.fillColor;
    ctx.fillRect(x, y, fillWidth, height);
  }
  ctx.restore();
}

export function drawShips(ctx: CanvasRenderingContext2D, state: TravelCombatState, camX: number, camY: number) {
  for (const enemy of state.enemies) {
    const screenX = enemy.x - camX;
    const screenY = enemy.y - camY;
    drawWireframe(ctx, getEnemyShape(enemy), screenX, screenY, enemy.angle, getEnemyColor(enemy.roles, enemy.missionTag));
    drawEnemyHealthBar(ctx, enemy, screenX, screenY);
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
