import { COMMODITIES, cargoSpaceRequired } from '../../market';
import { recordKill } from './killResolution';
import type { RandomSource, TravelCombatState } from '../types';

export function getCargoPirateInterest(cargo: Record<string, number>): number {
  let interest = 0;
  for (const [key, amount] of Object.entries(cargo)) {
    if (amount <= 0) {
      continue;
    }
    switch (key) {
      case 'computers':
      case 'luxuries':
      case 'gold':
      case 'platinum':
      case 'gemStones':
        interest += amount * 8;
        break;
      case 'firearms':
      case 'narcotics':
      case 'alienItems':
        interest += amount * 12;
        break;
      default:
        interest += amount * 2;
    }
  }
  return Math.min(255, interest);
}

export function maybeScoopSalvage(state: TravelCombatState, enemy: TravelCombatState['enemies'][number], random: RandomSource) {
  if (!state.playerLoadout.installedEquipment.fuel_scoops) {
    return;
  }

  const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  if (distance > 90) {
    return;
  }

  if (random.nextByte() < 96) {
    state.salvageFuel = Math.min(7, state.salvageFuel + 0.1);
    return;
  }

  const item = COMMODITIES[(random.nextByte() >> 4) % COMMODITIES.length];
  const current = state.salvageCargo[item.key] ?? 0;
  if (item.unit === 't') {
    const used = Object.entries(state.salvageCargo).reduce((sum, [key, amount]) => {
      const commodity = COMMODITIES.find((entry: (typeof COMMODITIES)[number]) => entry.key === key);
      return sum + (commodity ? cargoSpaceRequired(commodity.unit, amount) : 0);
    }, 0);
    if (used + cargoSpaceRequired(item.unit, 1) > 35) {
      return;
    }
  }
  state.salvageCargo[item.key] = current + 1;
}

export function destroyEnemy(state: TravelCombatState, enemyIndex: number, random: RandomSource) {
  const enemy = state.enemies[enemyIndex];
  if (!enemy) {
    return;
  }
  maybeScoopSalvage(state, enemy, random);
  recordKill(state, enemy);
  state.enemies.splice(enemyIndex, 1);
}
