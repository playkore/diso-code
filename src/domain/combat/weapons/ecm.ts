import { pushMessage, spawnParticles } from '../state';
import type { TravelCombatState } from '../types';

export function clearEnemyMissiles(state: TravelCombatState) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    if (state.projectiles[i].kind === 'missile' && state.projectiles[i].owner === 'enemy') {
      spawnParticles(state, state.projectiles[i].x, state.projectiles[i].y, '#ffff55');
      state.projectiles.splice(i, 1);
    }
  }
}

export function activatePlayerEcm(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.ecm) {
    return false;
  }
  if (state.player.energy <= 0) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }
  state.encounter.ecmTimer = 80;
  clearEnemyMissiles(state);
  pushMessage(state, 'ECM ACTIVE', 900);
  return true;
}
