import { destroyEnemy } from '../scoring/salvage';
import { pushMessage } from '../state';
import { getVisibleRadarContacts } from '../navigation';
import type { RandomSource, TravelCombatState } from '../types';

export function triggerEnergyBomb(state: TravelCombatState, random: RandomSource) {
  if (!state.playerLoadout.installedEquipment.energy_bomb) {
    return;
  }

  state.playerLoadout.installedEquipment.energy_bomb = false;
  pushMessage(state, 'ENERGY BOMB DETONATED', 1200);

  // The travel HUD radar is the authoritative blast envelope for the bomb: any
  // ship that is close enough to show on radar is destroyed, even if it is
  // currently off-screen in the main viewport.
  const visibleEnemyIds = new Set(getVisibleRadarContacts(state).map((enemy) => enemy.id));
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (!visibleEnemyIds.has(enemy.id)) {
      continue;
    }
    destroyEnemy(state, index, random);
  }
}
