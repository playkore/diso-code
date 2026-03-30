import { normalizeCommanderState } from '../../domain/commander';
import { createDefaultMissionTravelContext } from '../../domain/missionContext';
import { getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../../domain/fuel';
import { getSystemDistance } from '../../domain/galaxyCatalog';
import { formatCredits } from '../../utils/money';
import { formatLightYears } from '../../utils/distance';
import { createArrivalState, createDockedState } from '../gameStateFactory';
import { createUiMessage, withUiMessage } from '../uiMessages';
import type { GameSlice, GameStore } from '../storeTypes';

/**
 * Travel slice
 * ------------
 *
 * This slice owns route lifecycle and the commander updates that happen when a
 * travel segment begins or ends.
 *
 * It answers:
 * - can the player start a jump?
 * - should the route open the real-time flight screen or instant-arrive?
 * - how do salvage, fuel, and legal changes get merged back?
 */
export const createTravelSlice: GameSlice<
  Pick<GameStore, 'grantDebugCredits' | 'grantCombatCredits' | 'beginTravel' | 'cancelTravel' | 'completeTravel' | 'dockAtSystem'>
> = (set, get) => ({
  /**
   * Debug-only helper used while balancing and UI-testing the economy.
   */
  grantDebugCredits: (amount) =>
    set((state) => {
      const credits = Math.max(0, Math.trunc(amount));
      if (credits < 1) {
        return state;
      }
      return {
        commander: {
          ...state.commander,
          cash: state.commander.cash + credits
        },
        ui: withUiMessage(state.ui, createUiMessage('success', 'Debug credits added', `${formatCredits(credits)} credited for debugging.`))
      };
    }),

  /**
   * Credits live combat rewards immediately so the travel HUD balance updates
   * as soon as the player destroys an eligible ship.
   */
  grantCombatCredits: (amount) =>
    set((state) => {
      const credits = Math.max(0, Math.trunc(amount));
      if (credits < 1) {
        return state;
      }
      return {
        commander: {
          ...state.commander,
          cash: state.commander.cash + credits
        }
      };
    }),

  /**
   * Starts travel to a nearby system if the commander has enough fuel.
   *
   * Return value:
   * - `true`: real-time travel segment should open
   * - `false`: travel did not start, or instant-travel already completed it
   */
  beginTravel: (systemName) => {
    const state = get();
    const isUndocking = systemName === state.universe.currentSystem;
    const distance = getSystemDistance(state.universe.currentSystem, systemName, state.universe.galaxyIndex);
    const jumpFuelCost = isUndocking ? 0 : getJumpFuelCost(distance);
    const jumpFuelUnits = isUndocking ? 0 : getJumpFuelUnits(distance);
    const availableFuelUnits = getFuelUnits(state.commander.fuel);
    if ((!isUndocking && !Number.isFinite(distance)) || (!isUndocking && jumpFuelUnits <= 0)) {
      return false;
    }
    if (jumpFuelUnits > availableFuelUnits) {
      set({
        ui: withUiMessage(
          state.ui,
          createUiMessage('error', `Insufficient fuel for ${systemName}`, `Jump needs ${formatLightYears(jumpFuelCost)} but only ${formatLightYears(state.commander.fuel)} remain.`)
        )
      });
      return false;
    }
    if (state.ui.instantTravelEnabled) {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return false;
      }
      set({
        ...nextState,
        ui: {
          ...nextState.ui,
          selectedChartSystem: null
        },
        travelSession: null
      });
      return false;
    }

    const missionContext = createDefaultMissionTravelContext(systemName);
    set({
      commander: state.commander,
      travelSession: {
        originSystem: state.universe.currentSystem,
        destinationSystem: systemName,
        effectiveDestinationSystem: missionContext.effectiveDestinationSystem,
        fuelCost: jumpFuelCost,
        fuelUnits: jumpFuelUnits,
        // Undocking reuses the same travel session contract as hyperspace,
        // but it should present as a local launch rather than a destination jump.
        primaryObjectiveText: isUndocking ? `Undock from ${state.universe.currentSystem}.` : missionContext.primaryObjectiveText,
        missionContext
      }
    });
    return true;
  },

  /**
   * Clears the in-progress route without applying any arrival effects.
   */
  cancelTravel: () => set({ travelSession: null }),

  /**
   * Merges the outcome of the real-time travel segment back into the main store.
   *
   * The travel screen reports:
   * - where the player ended up
   * - whether hyperspace fuel should be spent
   * - combat salvage / rescue effects
   * - legal and tally deltas
   *
   * This function converts that report into the normal docked game state.
   */
  completeTravel: (report) =>
    set((state) => {
      if (!state.travelSession) {
        return state;
      }

      const mergedCargo = report?.outcome === 'rescued' ? {} : { ...state.commander.cargo };
      for (const [commodityKey, amount] of Object.entries(report?.cargo ?? {})) {
        mergedCargo[commodityKey] = (mergedCargo[commodityKey] ?? 0) + Math.max(0, Math.trunc(amount));
      }
      const insurancePenalty = report?.outcome === 'rescued' ? Math.min(state.commander.cash, Math.max(250, Math.trunc(state.commander.cash * 0.1))) : 0;
      const dockSystemName = report?.dockSystemName ?? state.travelSession.effectiveDestinationSystem;
      const spendJumpFuel = report?.spendJumpFuel ?? dockSystemName === state.travelSession.destinationSystem;
      const commander = normalizeCommanderState({
        ...state.commander,
        // Live combat rewards already hit commander cash during flight, so
        // travel completion only needs to settle rescue-side penalties here.
        cash: state.commander.cash - insurancePenalty,
        legalValue: report?.legalValue ?? state.commander.legalValue,
        tally: state.commander.tally + (report?.tallyDelta ?? 0),
        combatRatingScore: state.commander.combatRatingScore + (report?.tallyDelta ?? 0),
        cargo: mergedCargo,
        fuel: state.commander.fuel + (report?.fuelDelta ?? 0),
        installedEquipment: report?.installedEquipment ?? state.commander.installedEquipment,
        missilesInstalled: report?.missilesInstalled ?? state.commander.missilesInstalled
      });

      const nextState =
        report?.outcome === 'rescued'
          ? createDockedState({ ...state, commander }, dockSystemName, {
              spendJumpFuel,
              title: `Recovered at ${dockSystemName}`,
              body: `Escape pod recovery complete. Insurance docked you at ${dockSystemName} with cargo losses applied.`,
              stardateDelta: 1
            })
          : spendJumpFuel
            ? createArrivalState({ ...state, commander }, dockSystemName)
            : createDockedState({ ...state, commander }, dockSystemName, {
                spendJumpFuel: false,
                stardateDelta: 0
              });
      if (!nextState) {
        return {
          ...state,
          travelSession: null,
          ui: withUiMessage(state.ui, createUiMessage('error', 'Travel failed', 'The hyperspace solution collapsed before arrival.'))
        };
      }
      return {
        ...nextState,
        commander: normalizeCommanderState({
          ...nextState.commander,
          cash: nextState.commander.cash + (report?.rewardDelta ?? 0)
        }),
        ui: {
          ...nextState.ui,
          selectedChartSystem: null
        },
        travelSession: null
      };
    }),

  /**
   * Debug/helper action that immediately docks the player at a target system.
   */
  dockAtSystem: (systemName) =>
    set((state) => {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return state;
      }
      return {
        ...nextState,
        ui: {
          ...nextState.ui,
          selectedChartSystem: null
        },
        travelSession: null
      };
    })
});
