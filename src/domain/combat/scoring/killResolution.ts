import { spawnParticles } from '../state';
import type { CombatEnemy, TravelCombatState } from '../types';

export function recordKill(state: TravelCombatState, enemy: CombatEnemy) {
  // Combat kills affect the persistent commander tally after docking, but the
  // flight simulation no longer tracks a separate temporary score counter.
  if (enemy.roles.innocent) {
    state.legalValue = Math.max(state.legalValue, 32);
  }
  if (enemy.missionTag === 'constrictor') {
    state.missionEvents.push({ type: 'combat:constrictor-destroyed' });
  }
  state.player.tallyKills += 1;
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}
