import { normalizeCommanderState, type CommanderState } from '../../commander/domain/commander';

/**
 * Outcome object returned by the real-time travel screen when it hands control
 * back to the docked game.
 */
export interface TravelCompletionReport {
  outcome?: 'arrived' | 'rescued';
  dockSystemName?: string;
  rerouteDestination?: string;
  spendJumpFuel?: boolean;
  legalValue?: number;
  tallyDelta?: number;
  cargo?: Record<string, number>;
  fuelDelta?: number;
  rewardDelta?: number;
  playerProgress?: Pick<CommanderState, 'level' | 'xp' | 'hp' | 'maxHp' | 'attack'>;
  choicePrompts?: string[];
  installedEquipment?: CommanderState['installedEquipment'];
  missilesInstalled?: number;
}

/**
 * Merges the outcome of a travel segment back into a commander's state.
 * This is a pure domain function extracted from the Zustand travel slice.
 */
export function resolveTravelOutcome(
  commander: CommanderState,
  report?: TravelCompletionReport
): CommanderState {
  const mergedCargo = report?.outcome === 'rescued' ? {} : { ...commander.cargo };
  for (const [commodityKey, amount] of Object.entries(report?.cargo ?? {})) {
    mergedCargo[commodityKey] = (mergedCargo[commodityKey] ?? 0) + Math.max(0, Math.trunc(amount));
  }
  
  const insurancePenalty =
    report?.outcome === 'rescued'
      ? Math.min(commander.cash, Math.max(250, Math.trunc(commander.cash * 0.1)))
      : 0;
  const repairedProgress = report?.playerProgress
    ? {
        ...report.playerProgress,
        // Docked repairs fully restore hull integrity once the commander makes
        // it back to a station, whether that was a normal docking or a rescue.
        hp: report.playerProgress.maxHp
      }
    : {
        hp: commander.maxHp
      };

  return normalizeCommanderState({
    ...commander,
    // Live combat rewards already hit commander cash during flight, so
    // travel completion only needs to settle rescue-side penalties + eventual rewards here.
    cash: commander.cash - insurancePenalty + (report?.rewardDelta ?? 0),
    legalValue: report?.legalValue ?? commander.legalValue,
    tally: commander.tally + (report?.tallyDelta ?? 0),
    combatRatingScore: commander.combatRatingScore + (report?.tallyDelta ?? 0),
    cargo: mergedCargo,
    fuel: commander.fuel + (report?.fuelDelta ?? 0),
    ...repairedProgress,
    installedEquipment: report?.installedEquipment ?? commander.installedEquipment,
    missilesInstalled: report?.missilesInstalled ?? commander.missilesInstalled
  });
}
