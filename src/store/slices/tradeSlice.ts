import { totalCargoUsedTonnes } from '../../domain/commander';
import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getRefuelCost, MAX_FUEL } from '../../domain/fuel';
import { applyMissionEvent, evaluateTradeMissionState, getMissionInbox, settleCompletedMissions } from '../../domain/missions';
import { applyLocalMarketTrade } from '../../domain/market';
import { formatCredits } from '../../utils/money';
import { formatLightYears } from '../../utils/distance';
import { refreshItems } from '../gameStateFactory';
import { createUiMessage, withUiMessage } from '../uiMessages';
import type { GameSlice, GameStore } from '../storeTypes';

export const createTradeSlice: GameSlice<Pick<GameStore, 'buyFuel' | 'buyCommodity' | 'sellCommodity'>> = (set) => ({
  buyFuel: (units) =>
    set((state) => {
      const requestedUnits = Math.max(0, Math.trunc(units));
      const currentFuelUnits = getFuelUnits(state.commander.fuel);
      const missingUnits = Math.max(0, getFuelUnits(MAX_FUEL) - currentFuelUnits);
      const purchasedUnits = Math.min(requestedUnits, missingUnits);
      if (purchasedUnits <= 0) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', 'Fuel tank full', `The tank already holds ${formatLightYears(state.commander.fuel)}.`))
        };
      }
      const cost = getRefuelCost(purchasedUnits);
      if (cost > state.commander.cash) {
        return {
          ui: withUiMessage(
            state.ui,
            createUiMessage('error', 'Not enough credits for fuel', `You need ${formatCredits(cost)} but only have ${formatCredits(state.commander.cash)}.`)
          )
        };
      }
      const nextFuel = clampFuel(fuelUnitsToLightYears(currentFuelUnits + purchasedUnits));
      const nextCash = state.commander.cash - cost;
      return {
        commander: {
          ...state.commander,
          cash: nextCash,
          fuel: nextFuel
        },
        ui: withUiMessage(
          state.ui,
          createUiMessage('success', 'Fuel purchased', `Added ${formatLightYears(fuelUnitsToLightYears(purchasedUnits))}. Fuel now ${formatLightYears(nextFuel)}. Balance ${formatCredits(nextCash)}.`)
        )
      };
    }),
  buyCommodity: (commodityKey, amount) =>
    set((state) => {
      const item = state.market.items.find((entry) => entry.key === commodityKey);
      if (!item) {
        return state;
      }
      const available = state.market.session.localQuantities[commodityKey] ?? 0;
      const units = Math.min(Math.max(0, Math.trunc(amount)), available);
      if (units <= 0) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Cannot buy ${item.name}`, 'The station has no stock left in this session.'))
        };
      }
      const cargoUsed = totalCargoUsedTonnes(state.commander.cargo, state.commander.missionCargo);
      if (item.unit === 't' && cargoUsed + units > state.commander.cargoCapacity) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Cargo full for ${item.name}`, `Only ${state.commander.cargoCapacity - cargoUsed} t of free space remains.`))
        };
      }
      const spent = units * item.price;
      if (spent > state.commander.cash) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Not enough credits for ${item.name}`, `You need ${formatCredits(spent)} but only have ${formatCredits(state.commander.cash)}.`))
        };
      }
      // Buying always updates commander cargo/cash and the docked market
      // session together so inventory and station stock never drift apart.
      const nextSession = applyLocalMarketTrade(state.market.session, commodityKey, -units);
      const nextCash = state.commander.cash - spent;
      return {
        commander: {
          ...state.commander,
          cash: nextCash,
          cargo: {
            ...state.commander.cargo,
            [commodityKey]: (state.commander.cargo[commodityKey] ?? 0) + units
          }
        },
        market: refreshItems(nextSession),
        ui: withUiMessage(state.ui, createUiMessage('success', `Bought ${units} ${item.name}`, `Spent ${formatCredits(spent)}. Balance now ${formatCredits(nextCash)}.`))
      };
    }),
  sellCommodity: (commodityKey, amount) =>
    set((state) => {
      const item = state.market.items.find((entry) => entry.key === commodityKey);
      if (!item) {
        return state;
      }
      const owned = state.commander.cargo[commodityKey] ?? 0;
      const units = Math.min(Math.max(0, Math.trunc(amount)), owned);
      if (units <= 0) {
        return {
          ui: withUiMessage(state.ui, createUiMessage('error', `Cannot sell ${item.name}`, 'You do not have any units of this commodity.'))
        };
      }
      // Selling uses the same lockstep rule in reverse: increase local station
      // stock, decrease commander cargo, then report the completed trade once.
      const nextSession = applyLocalMarketTrade(state.market.session, commodityKey, units);
      const earnings = units * item.price;
      const nextCash = state.commander.cash + earnings;
      const missionEvents = evaluateTradeMissionState(state.commander.activeMissions, {
        systemName: state.universe.currentSystem,
        commodityKey,
        amount: units
      });
      const progressedMissions = missionEvents.reduce((missions, event) => applyMissionEvent(missions, event), state.commander.activeMissions);
      const settlement = settleCompletedMissions(progressedMissions, state.commander.completedMissions);
      return {
        commander: {
          ...state.commander,
          cash: nextCash + settlement.cashDelta,
          cargo: {
            ...state.commander.cargo,
            [commodityKey]: owned - units
          },
          activeMissions: settlement.activeMissions,
          completedMissions: settlement.completedMissions
        },
        market: refreshItems(nextSession),
        missions: {
          ...state.missions,
          activeMissionMessages: getMissionInbox(settlement.activeMissions, { currentSystem: state.universe.currentSystem })
        },
        ui: withUiMessage(
          state.ui,
          createUiMessage(
            'success',
            `Sold ${units} ${item.name}`,
            `Earned ${formatCredits(earnings + settlement.cashDelta)}. Balance now ${formatCredits(nextCash + settlement.cashDelta)}.`
          )
        )
      };
    })
});
