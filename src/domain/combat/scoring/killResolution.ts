import { spawnParticles } from '../state';
import type { CombatEnemy, TravelCombatState } from '../types';

export function recordKill(state: TravelCombatState, enemy: CombatEnemy) {
  if (enemy.roles.innocent) {
    state.legalValue = Math.max(state.legalValue, 32);
  }
  if (enemy.missionTag === 'constrictor') {
    state.missionEvents.push({ type: 'combat:constrictor-destroyed' });
  }
  state.player.tallyKills += 1;
  state.score += enemy.missionTag ? 400 : 100;
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}
