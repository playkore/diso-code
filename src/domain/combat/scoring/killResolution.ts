import { formatCredits } from '../../../utils/money';
import { pushMessage, spawnParticles } from '../state';
import type { BlueprintId, CombatEnemy, TravelCombatState } from '../types';

/**
 * Classic Elite stores bounty directly on the ship blueprint rather than
 * deriving it from a coarse role such as "pirate" or "bounty hunter".
 *
 * The travel prototype mirrors that model using tenths of a credit so the HUD
 * formatter can render values without introducing floating-point drift. Entries
 * omitted here intentionally fall back to zero because the original roster also
 * contains hostile or pirate-tagged ships with no cash reward.
 */
const SHIP_KILL_REWARDS: Partial<Record<BlueprintId, number>> = {
  sidewinder: 50,
  adder: 40,
  gecko: 55,
  'cobra-mk1': 75,
  worm: 0,
  krait: 100,
  mamba: 150,
  'cobra-mk3-pirate': 175,
  'asp-mk2': 200,
  'python-pirate': 200,
  'fer-de-lance': 0,
  constrictor: 0,
  thargoid: 500,
  thargon: 50
};

function getKillReward(enemy: CombatEnemy) {
  if (enemy.roles.cop || enemy.blueprintId === 'viper') {
    return 0;
  }
  if (enemy.roles.trader || enemy.roles.innocent) {
    return 0;
  }
  return SHIP_KILL_REWARDS[enemy.blueprintId] ?? 0;
}

/**
 * Kill notifications are composed in one place so the transient HUD message,
 * the credited reward, and the ship label always stay in sync.
 */
function getKillMessage(enemy: CombatEnemy, reward: number) {
  return `${enemy.label.toUpperCase()} DESTROYED: ${formatCredits(reward)}`;
}

export function recordKill(state: TravelCombatState, enemy: CombatEnemy) {
  // Combat kills affect the persistent commander tally after docking, but the
  // flight simulation no longer tracks a separate temporary score counter.
  // Instead it accumulates a cash payout that the travel-completion merge can
  // apply to the docked commander without leaking economy concerns into combat.
  const reward = getKillReward(enemy);
  if (enemy.roles.innocent) {
    state.legalValue = Math.max(state.legalValue, 32);
  }
  if (enemy.missionTag?.role === 'target') {
    state.missionEvents.push({ type: 'mission:target-destroyed', missionId: enemy.missionTag.missionId });
  }
  state.player.tallyKills += 1;
  state.player.combatReward += reward;
  pushMessage(state, getKillMessage(enemy, reward), 1600);
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}
