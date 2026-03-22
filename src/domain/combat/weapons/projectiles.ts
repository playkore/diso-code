import { stepEnemyMissile } from '../ai/missileAi';
import { destroyEnemy } from '../scoring/salvage';
import { getLegalValueAfterCombat, updateLegalStatus } from '../scoring/legalStatus';
import { applyPlayerDamage, pushMessage, spawnParticles } from '../state';
import type { RandomSource, TravelCombatState } from '../types';

/**
 * Projectile simulation and collision side effects.
 *
 * This pass owns all transient projectile state after firing: homing missiles,
 * hit detection, station safe-zone penalties, player shield/energy damage, and cleanup.
 */
export function moveProjectiles(state: TravelCombatState, dt: number, random: RandomSource) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const previousX = projectile.x;
    const previousY = projectile.y;
    if (projectile.kind === 'missile' && projectile.owner === 'enemy') {
      stepEnemyMissile(projectile, state, dt);
    }

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    let hit = false;
    if (projectile.owner === 'player') {
      // Player shots resolve against enemies first because friendly-fire
      // consequences depend on which target was struck inside the safe zone.
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        const distanceSq = (projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2;
        if (distanceSq <= enemy.targetableArea) {
          enemy.energy -= projectile.damage;
          hit = true;
          spawnParticles(state, projectile.x, projectile.y, '#55ff55');
          if (enemy.roles.innocent && state.encounter.safeZone) {
            state.encounter.stationHostile = true;
            state.legalValue = getLegalValueAfterCombat(state.legalValue, 32);
            updateLegalStatus(state);
            pushMessage(state, 'STATION DEFENSE ALERT', 1600);
          }
          if (enemy.energy <= 0) {
            destroyEnemy(state, j, random);
          }
          break;
        }
      }
    } else if (Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y) < state.player.radius + (projectile.kind === 'missile' ? 6 : 0)) {
      const shieldBeforeHit = state.player.shield;
      applyPlayerDamage(state, projectile.damage);
      hit = true;
      spawnParticles(state, projectile.x, projectile.y, '#ff5555');
      if (projectile.kind === 'missile' && shieldBeforeHit > 0) {
        pushMessage(state, 'MISSILE IMPACT', 900);
      }
    }

    if (!hit && projectile.kind === 'missile' && projectile.owner === 'enemy' && state.station && state.encounter.safeZone) {
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
