import { pushMessage, spawnParticles } from '../state';
import type { TravelCombatState } from '../types';

const ECM_EFFECT_RADIUS = 360;
const ECM_ACTIVE_WINDOW = 80;
const ECM_FLASH_WINDOW = 10;

/**
 * ECM is a local defensive pulse in this prototype. Only missiles close enough
 * to threaten the player are neutralized, which makes timing matter and keeps
 * distant launches relevant until they close the gap.
 */
export function clearEnemyMissiles(state: TravelCombatState) {
  let clearedMissiles = 0;
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const distanceToPlayer = Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y);
    if (distanceToPlayer > ECM_EFFECT_RADIUS) {
      continue;
    }
    spawnParticles(state, projectile.x, projectile.y, '#ffff55');
    state.projectiles.splice(i, 1);
    clearedMissiles += 1;
  }
  return clearedMissiles;
}

export function activatePlayerEcm(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.ecm) {
    return false;
  }
  // The screen flash is intentionally much shorter than the gameplay effect so
  // pilots get instant tactile feedback without masking incoming contacts.
  state.encounter.ecmFlashTimer = ECM_FLASH_WINDOW;
  state.encounter.ecmTimer = ECM_ACTIVE_WINDOW;
  const clearedMissiles = clearEnemyMissiles(state);
  pushMessage(state, clearedMissiles > 0 ? 'ECM ACTIVE' : 'ECM CLEAR', 900);
  return true;
}
