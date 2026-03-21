import { getLegalStatus } from '../../commander';
import type { TravelCombatState } from '../types';

export function getLegalValueAfterCombat(currentLegalValue: number, delta: number): number {
  return Math.max(0, Math.min(255, Math.trunc(currentLegalValue + delta)));
}

export function updateLegalStatus(state: TravelCombatState) {
  state.legalStatus = getLegalStatus(state.legalValue);
}
