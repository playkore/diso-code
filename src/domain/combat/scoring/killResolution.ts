import { spawnParticles } from '../state';
import type { BlueprintId, CombatEnemy, TravelCombatState } from '../types';

/**
 * Explicit pirate rewards for blueprint ids that currently exist in the game.
 *
 * Requested entries that do not exist in this codebase, such as `anaconda`,
 * are intentionally left out so the table documents the live roster rather
 * than implying support for absent ship types.
 */
const PIRATE_KILL_REWARDS: Partial<Record<BlueprintId, number>> = {
  adder: 40,
  mamba: 60,
  krait: 80,
  gecko: 90,
  'cobra-mk1': 70,
  'cobra-mk3-pirate': 120,
  'python-pirate': 200
};

function getKillReward(enemy: CombatEnemy) {
  if (enemy.blueprintId === 'thargoid') {
    return 500;
  }
  if (enemy.roles.cop || enemy.blueprintId === 'viper') {
    return 0;
  }
  if (enemy.roles.trader || enemy.roles.innocent) {
    return 0;
  }
  if (enemy.blueprintId === 'asp-mk2') {
    // The requested table treats Asp as a pirate reward even though this
    // codebase currently models Asp Mk II as a bounty hunter blueprint.
    return 150;
  }
  if (enemy.roles.bountyHunter) {
    return 100;
  }
  return PIRATE_KILL_REWARDS[enemy.blueprintId] ?? 0;
}

export function recordKill(state: TravelCombatState, enemy: CombatEnemy) {
  // Combat kills affect the persistent commander tally after docking, but the
  // flight simulation no longer tracks a separate temporary score counter.
  // Instead it accumulates a cash payout that the travel-completion merge can
  // apply to the docked commander without leaking economy concerns into combat.
  if (enemy.roles.innocent) {
    state.legalValue = Math.max(state.legalValue, 32);
  }
  if (enemy.missionTag === 'constrictor') {
    state.missionEvents.push({ type: 'combat:constrictor-destroyed' });
  }
  state.player.tallyKills += 1;
  state.player.combatReward += getKillReward(enemy);
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}
