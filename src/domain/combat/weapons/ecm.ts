import { ECM_ENERGY_COST, pushMessage, spawnParticles, spendPlayerEnergy } from '../state';
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
  if (!spendPlayerEnergy(state, ECM_ENERGY_COST)) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }
  state.encounter.ecmTimer = 80;
  clearEnemyMissiles(state);
  pushMessage(state, 'ECM ACTIVE', 900);
  return true;
}
