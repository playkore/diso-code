import type { CombatEnemy, TravelCombatState } from '../../../domain/travelCombat';
import { CGA_BLACK, CGA_RED, CGA_YELLOW } from './constants';
import { getCgaBarFillColor, getSegmentedBankRatios } from './bars';
import { getEnemyColor, getEnemyShape, getProjectileColor, drawWireframe } from './shipsRenderer';

/**
 * Enemy/projectile overlay renderer.
 *
 * Ship wireframes are rendered here instead of in `shipsRenderer` because the
 * travel screen wants a single pass that keeps enemy hulls, health bars,
 * projectiles, and particles visually grouped above the background layers.
 */
export interface EnemyHealthBarState {
  bankRatios: number[];
  fillColor: string;
}

export interface EnemyLaserTrace {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export function getEnemyHealthBarState(enemy: CombatEnemy): EnemyHealthBarState | null {
  if (enemy.energy >= enemy.maxEnergy) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, enemy.maxEnergy > 0 ? enemy.energy / enemy.maxEnergy : 0));
  // Enemy overlays use the exact same bank decomposition as the player HUD so
  // the fight reads as one shared energy language across the whole screen.
  const bankRatios = getSegmentedBankRatios(enemy.energy, enemy.maxEnergy, 4);
  return {
    bankRatios,
    fillColor: getCgaBarFillColor(ratio)
  };
}

function drawEnemyHealthBar(ctx: CanvasRenderingContext2D, enemy: CombatEnemy, screenX: number, screenY: number) {
  const healthBar = getEnemyHealthBarState(enemy);
  if (!healthBar) {
    return;
  }

  const bankCount = 4;
  const bankWidth = 4;
  const bankGap = 1;
  const width = bankCount * bankWidth + (bankCount - 1) * bankGap;
  const height = 4;
  const x = Math.round(screenX - width / 2);
  const y = Math.round(screenY - 18);

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = CGA_BLACK;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.strokeStyle = CGA_YELLOW;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, width + 1, height + 1);
  for (let bankIndex = 0; bankIndex < bankCount; bankIndex += 1) {
    const bankX = x + bankIndex * (bankWidth + bankGap);
    const bankFillWidth = Math.round(bankWidth * healthBar.bankRatios[bankIndex]);

    // Red underlay keeps depleted banks visible, while a colored overlay marks
    // the live charge level in each discrete segment.
    ctx.fillStyle = CGA_RED;
    ctx.fillRect(bankX, y, bankWidth, height);
    if (bankFillWidth <= 0) {
      continue;
    }
    ctx.fillStyle = healthBar.fillColor;
    ctx.fillRect(bankX, y, bankFillWidth, height);
  }
  ctx.restore();
}

/**
 * Enemy laser fire is currently simulation-only. This helper turns the AI's
 * `isFiringLaser` flag into a short visible beam aimed at the player so shots
 * are readable even when no projectile object is spawned for laser damage.
 */
export function getEnemyLaserTrace(enemy: CombatEnemy, state: TravelCombatState): EnemyLaserTrace | null {
  if (!enemy.isFiringLaser) {
    return null;
  }

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    return null;
  }

  const maxTraceLength = Math.min(enemy.laserRange, distance);
  const directionX = dx / distance;
  const directionY = dy / distance;
  return {
    startX: enemy.x + directionX * 10,
    startY: enemy.y + directionY * 10,
    endX: enemy.x + directionX * maxTraceLength,
    endY: enemy.y + directionY * maxTraceLength
  };
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
  for (const enemy of state.enemies) {
    const laserTrace = getEnemyLaserTrace(enemy, state);
    if (!laserTrace) {
      continue;
    }
    ctx.strokeStyle = CGA_RED;
    ctx.shadowBlur = 5;
    ctx.shadowColor = CGA_RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(laserTrace.startX - camX, laserTrace.startY - camY);
    ctx.lineTo(laserTrace.endX - camX, laserTrace.endY - camY);
    ctx.stroke();
  }

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
    // Particles expand as they age so the engine trail reads as exhaust fire
    // instead of a static chain of dots.
    const lifeRatio = particle.maxLife > 0 ? Math.max(0, Math.min(1, particle.life / particle.maxLife)) : 0;
    const ageRatio = 1 - lifeRatio;
    const size = particle.color === '#55ff55' ? particle.size + ageRatio * 2.8 : particle.size + ageRatio * 1.8;
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 5;
    ctx.shadowColor = particle.color;
    ctx.fillRect(particle.x - camX - size / 2, particle.y - camY - size / 2, size, size);
  }
}
