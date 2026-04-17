import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getRefuelCost, MAX_FUEL } from '../../../shared/domain/fuel';
import { formatCredits } from '../../../shared/utils/money';
import { formatLightYears } from '../../../shared/utils/distance';
import { setUiMessage } from '../../../shared/store/uiMessages';
import type { GameSlice, GameStore } from '../../../shared/store/storeTypes';

export const createTradeSlice: GameSlice<Pick<GameStore, 'buyFuel'>> = (set, get) => ({
  buyFuel: (units) => {
    let committed = false;
    set((state) => {
      const requestedUnits = Math.max(0, Math.trunc(units));
      const currentFuelUnits = getFuelUnits(state.commander.fuel);
      const missingUnits = Math.max(0, getFuelUnits(MAX_FUEL) - currentFuelUnits);
      const purchasedUnits = Math.min(requestedUnits, missingUnits);
      if (purchasedUnits <= 0) {
        return {
          ui: setUiMessage(state.ui, 'error', 'Fuel tank full', `The tank already holds ${formatLightYears(state.commander.fuel)}.`)
        };
      }
      const cost = getRefuelCost(purchasedUnits);
      if (cost > state.commander.cash) {
        return {
          ui: setUiMessage(state.ui, 'error', 'Not enough credits for fuel', `You need ${formatCredits(cost)} but only have ${formatCredits(state.commander.cash)}.`)
        };
      }
      committed = true;
      const nextFuel = clampFuel(fuelUnitsToLightYears(currentFuelUnits + purchasedUnits));
      const nextCash = state.commander.cash - cost;
      // Fuel purchases update durable commander state only after the station
      // confirms the transaction, so autosave must happen after this commit.
      return {
        commander: {
          ...state.commander,
          cash: nextCash,
          fuel: nextFuel
        },
        ui: setUiMessage(state.ui, 'success', 'Fuel purchased', `Added ${formatLightYears(fuelUnitsToLightYears(purchasedUnits))}. Fuel now ${formatLightYears(nextFuel)}. Balance ${formatCredits(nextCash)}.`)
      };
    });
    if (committed) {
      get().autosaveDockedState();
    }
  }
});
