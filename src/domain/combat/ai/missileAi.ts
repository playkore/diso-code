import type { CombatProjectile, TravelCombatState } from '../types';

export function stepEnemyMissile(projectile: CombatProjectile, state: TravelCombatState, dt: number) {
  const dx = state.player.x - projectile.x;
  const dy = state.player.y - projectile.y;
  const angle = Math.atan2(dy, dx);
  projectile.vx += Math.cos(angle) * 0.16 * dt;
  projectile.vy += Math.sin(angle) * 0.16 * dt;
}
