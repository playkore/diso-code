import { stepEnemyMissile } from '../ai/missileAi';
import { applyPlayerDamage, pushMessage, spawnParticles } from '../state';
import type { RandomSource, TravelCombatState } from '../types';

/**
 * Projectile simulation and collision side effects.
 *
 * This pass owns all transient projectile state after firing: homing missiles,
 * hit detection, station safe-zone penalties, player HP damage, and cleanup.
 */
export function moveProjectiles(state: TravelCombatState, dt: number, random: RandomSource) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const previousX = projectile.x;
    const previousY = projectile.y;
    stepEnemyMissile(projectile, state, dt);

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    let hit = false;
    if (Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y) < state.player.radius + 6) {
      applyPlayerDamage(state, projectile.damage);
      hit = true;
      spawnParticles(state, projectile.x, projectile.y, '#ff5555');
      pushMessage(state, 'MISSILE IMPACT', 900);
    }

    if (!hit && state.station && state.encounter.safeZone) {
      // Station defenses treat missiles crossing into the safe zone as neutralized
      // even if they have not yet reached the player.
      const previousDistanceFromStation = Math.hypot(previousX - state.station.x, previousY - state.station.y);
      const currentDistanceFromStation = Math.hypot(projectile.x - state.station.x, projectile.y - state.station.y);
      if (previousDistanceFromStation > state.station.safeZoneRadius && currentDistanceFromStation <= state.station.safeZoneRadius) {
        hit = true;
        spawnParticles(state, projectile.x, projectile.y, '#ffff55');
      }
    }

    if (hit || projectile.life <= 0) {
      state.projectiles.splice(i, 1);
    }
  }
}
