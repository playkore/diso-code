import { formatCredits } from '../../../../../shared/utils/money';
import { awardPlayerCombatXp, pushMessage, spawnParticles } from '../state';
import type { CombatEnemy, TravelCombatState } from '../types';

function getKillReward(enemy: CombatEnemy) {
  if (enemy.roles.cop || enemy.blueprintId === 'viper') {
    return 0;
  }
  if (enemy.roles.trader || enemy.roles.innocent) {
    return 0;
  }
  return enemy.creditReward;
}

/**
 * Kill notifications are composed in one place so the transient HUD message,
 * the credited reward, XP, and the ship label always stay in sync.
 */
function getKillMessage(enemy: CombatEnemy, reward: number, xpReward: number, levelUps: number) {
  const levelUpSuffix = levelUps > 0 ? ` LEVEL UP x${levelUps}` : '';
  return `${enemy.label.toUpperCase()} L${enemy.level} DESTROYED: ${formatCredits(reward)} +${xpReward} XP${levelUpSuffix}`;
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
  const xpAward = enemy.roles.cop || enemy.roles.trader || enemy.roles.innocent ? 0 : enemy.xpReward;
  const { grantedXp, levelUps } = awardPlayerCombatXp(state, xpAward);
  state.player.tallyKills += 1;
  state.player.combatReward += reward;
  pushMessage(state, getKillMessage(enemy, reward, grantedXp, levelUps), 1800);
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}
