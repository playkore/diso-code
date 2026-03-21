import { destroyEnemy } from '../scoring/salvage';
import { pushMessage } from '../state';
import type { RandomSource, TravelCombatState } from '../types';

export function triggerEnergyBomb(state: TravelCombatState, random: RandomSource) {
  if (!state.playerLoadout.installedEquipment.energy_bomb) {
    return;
  }

  state.playerLoadout.installedEquipment.energy_bomb = false;
  pushMessage(state, 'ENERGY BOMB DETONATED', 1200);

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (enemy.missionTag) {
      enemy.energy = Math.max(1, enemy.energy - 50);
      continue;
    }
    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) > 920) {
      continue;
    }
    destroyEnemy(state, index, random);
  }
}
