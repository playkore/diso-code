import type { CombatProjectile, TravelCombatState } from '../types';

const ENEMY_MISSILE_ACCELERATION = 0.3;
const ENEMY_MISSILE_TURN_BLEND = 0.14;
const ENEMY_MISSILE_MIN_SPEED = 6.8;
const ENEMY_MISSILE_MAX_SPEED = 7.6;

/**
 * Enemy missiles should stay threatening without feeling impossible: they turn
 * toward the current player position every frame and settle into a speed band
 * that is slower than older tuning, but still above the Cobra's top speed.
 */
export function stepEnemyMissile(projectile: CombatProjectile, state: TravelCombatState, dt: number) {
  const dx = state.player.x - projectile.x;
  const dy = state.player.y - projectile.y;
  const angle = Math.atan2(dy, dx);
  const desiredVx = Math.cos(angle) * ENEMY_MISSILE_MAX_SPEED;
  const desiredVy = Math.sin(angle) * ENEMY_MISSILE_MAX_SPEED;

  projectile.vx += (desiredVx - projectile.vx) * ENEMY_MISSILE_TURN_BLEND * dt;
  projectile.vy += (desiredVy - projectile.vy) * ENEMY_MISSILE_TURN_BLEND * dt;
  projectile.vx += Math.cos(angle) * ENEMY_MISSILE_ACCELERATION * dt;
  projectile.vy += Math.sin(angle) * ENEMY_MISSILE_ACCELERATION * dt;

  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed <= 0.0001) {
    projectile.vx = Math.cos(angle) * ENEMY_MISSILE_MIN_SPEED;
    projectile.vy = Math.sin(angle) * ENEMY_MISSILE_MIN_SPEED;
    return;
  }

  const clampedSpeed = Math.max(ENEMY_MISSILE_MIN_SPEED, Math.min(ENEMY_MISSILE_MAX_SPEED, speed));
  projectile.vx = (projectile.vx / speed) * clampedSpeed;
  projectile.vy = (projectile.vy / speed) * clampedSpeed;
}
