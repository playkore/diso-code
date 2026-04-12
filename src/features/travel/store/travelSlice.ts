import { resolveTravelOutcome } from '../domain/travel';
import { createDefaultMissionTravelContext } from '../domain/missionContext';
import { getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../../../shared/domain/fuel';
import { getSystemDistance } from '../../galaxy/domain/galaxyCatalog';
import { formatCredits } from '../../../shared/utils/money';
import { formatLightYears } from '../../../shared/utils/distance';
import { createArrivalState, createDockedState } from '../../../shared/store/gameStateFactory';
import { setUiMessage } from '../../../shared/store/uiMessages';
import type { GameSlice, GameStore } from '../../../shared/store/storeTypes';

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
        ui: setUiMessage(state.ui, 'success', 'Debug credits added', `${formatCredits(credits)} credited for debugging.`)
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
        ui: setUiMessage(state.ui, 'error', `Insufficient fuel for ${systemName}`, `Jump needs ${formatLightYears(jumpFuelCost)} but only ${formatLightYears(state.commander.fuel)} remain.`)
      });
      return false;
    }
    // Instant travel is a jump shortcut, not a replacement for local launch.
    // Undocking still needs the travel session so the player can leave the
    // station and regain manual control in the same system.
    if (state.ui.instantTravelEnabled && !isUndocking) {
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

      const dockSystemName = report?.dockSystemName ?? state.travelSession.effectiveDestinationSystem;
      const spendJumpFuel = report?.spendJumpFuel ?? dockSystemName === state.travelSession.destinationSystem;
      const commander = resolveTravelOutcome(state.commander, report);

      const nextState =
        report?.outcome === 'rescued'
          ? createDockedState({ ...state, commander }, dockSystemName, {
              spendJumpFuel,
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
          ui: setUiMessage(state.ui, 'error', 'Travel failed', 'The hyperspace solution collapsed before arrival.')
        };
      }
      return {
        ...nextState,
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
