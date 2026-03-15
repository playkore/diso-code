import { create } from 'zustand';
import { createDefaultCommander, cargoUsedTonnes } from '../domain/commander';
import {
  decodeCommanderBinary256,
  encodeCommanderBinary256,
  loadCommanderJson,
  serializeCommanderJson
} from '../domain/commanderPersistence';
import {
  applyLocalMarketTrade,
  createDockedMarketSession,
  getSessionMarketItems,
  type DockedMarketSession
} from '../domain/market';
import {
  applyDockingMissionState,
  applyMissionExternalEvent,
  getMissionMessagesForDocking,
  type MissionExternalEvent
} from '../domain/missions';
import { getNearbySystemNames, getSystemByName } from '../domain/galaxyCatalog';
import type { AppTab, CommanderState, MarketState, MissionsState, UiMessage, UiState, UniverseState } from './types';

interface SaveState {
  json: string;
  binary: Uint8Array;
}

interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  missions: MissionsState;
  ui: UiState;
  saveState?: SaveState;
  setActiveTab: (tab: AppTab) => void;
  dockAtSystem: (systemName: string, economy: number, fluctuation: number) => void;
  buyCommodity: (commodityKey: string, amount: number) => void;
  sellCommodity: (commodityKey: string, amount: number) => void;
  triggerMissionExternalEvent: (event: MissionExternalEvent) => void;
  quickSave: () => void;
  loadFromSave: () => void;
}

function createMarketState(systemName: string, economy: number, fluctuation: number): MarketState {
  const session = createDockedMarketSession(systemName, economy, fluctuation);
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

function updateMissionLog(commander: CommanderState): MissionsState {
  const progress = applyDockingMissionState({ tp: commander.missionTP, variant: commander.missionVariant });
  return {
    missionLog: getMissionMessagesForDocking(progress)
  };
}

function refreshItems(session: DockedMarketSession): MarketState {
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

function createUiMessage(tone: UiMessage['tone'], title: string, body: string): UiMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    title,
    body
  };
}

function withUiMessage(ui: UiState, message: UiMessage): UiState {
  return {
    ...ui,
    latestEvent: message,
    activityLog: [message, ...ui.activityLog].slice(0, 4)
  };
}

function getCheapestCommodity(session: DockedMarketSession) {
  return getSessionMarketItems(session).reduce((lowest, item) => (item.price < lowest.price ? item : lowest));
}

export const useGameStore = create<GameStore>((set, get) => {
  const initialCommander = createDefaultCommander();
  const initialSystem = getSystemByName(initialCommander.currentSystem);
  return {
    universe: {
      currentSystem: initialCommander.currentSystem,
      nearbySystems: getNearbySystemNames(initialCommander.currentSystem),
      stardate: 3124,
      economy: initialSystem?.data.economy ?? 5,
      marketFluctuation: 0
    },
    commander: initialCommander,
    market: createMarketState(initialCommander.currentSystem, initialSystem?.data.economy ?? 5, 0),
    missions: updateMissionLog(initialCommander),
    ui: {
      activeTab: 'market',
      compactMode: true,
      activityLog: []
    },
    setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
    dockAtSystem: (systemName, _economy, fluctuation) =>
      set((state) => {
        const nextCommander = { ...state.commander, currentSystem: systemName };
        const progress = applyDockingMissionState({ tp: nextCommander.missionTP, variant: nextCommander.missionVariant });
        nextCommander.missionTP = progress.tp;
        const nextSystem = getSystemByName(systemName);
        const nextEconomy = nextSystem?.data.economy ?? state.universe.economy;
        const nextMarket = createMarketState(systemName, nextEconomy, fluctuation);
        const cheapest = getCheapestCommodity(nextMarket.session);
        const arrivalMessage = createUiMessage(
          'info',
          `Docked at ${systemName}`,
          `Market updated. Cheapest local price: ${cheapest.name} at ${cheapest.price} cr.`
        );

        return {
          universe: {
            ...state.universe,
            currentSystem: systemName,
            nearbySystems: getNearbySystemNames(systemName),
            economy: nextEconomy,
            marketFluctuation: fluctuation,
            stardate: state.universe.stardate + 1
          },
          commander: nextCommander,
          market: nextMarket,
          missions: {
            missionLog: getMissionMessagesForDocking(progress)
          },
          ui: withUiMessage(state.ui, arrivalMessage)
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
            ui: withUiMessage(
              state.ui,
              createUiMessage('error', `Cannot buy ${item.name}`, 'The station has no stock left in this session.')
            )
          };
        }

        const cargoUsed = cargoUsedTonnes(state.commander.cargo);
        if (item.unit === 't' && cargoUsed + units > state.commander.cargoCapacity) {
          return {
            ui: withUiMessage(
              state.ui,
              createUiMessage(
                'error',
                `Cargo full for ${item.name}`,
                `Only ${state.commander.cargoCapacity - cargoUsed} t of free space remains.`
              )
            )
          };
        }

        const spent = units * item.price;
        if (spent > state.commander.cash) {
          return {
            ui: withUiMessage(
              state.ui,
              createUiMessage(
                'error',
                `Not enough credits for ${item.name}`,
                `You need ${spent} cr but only have ${state.commander.cash} cr.`
              )
            )
          };
        }

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
          ui: withUiMessage(
            state.ui,
            createUiMessage('success', `Bought ${units} ${item.name}`, `Spent ${spent} cr. Balance now ${nextCash} cr.`)
          )
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
            ui: withUiMessage(
              state.ui,
              createUiMessage('error', `Cannot sell ${item.name}`, 'You do not have any units of this commodity.')
            )
          };
        }

        const nextSession = applyLocalMarketTrade(state.market.session, commodityKey, units);
        const earnings = units * item.price;
        const nextCash = state.commander.cash + earnings;

        return {
          commander: {
            ...state.commander,
            cash: nextCash,
            cargo: {
              ...state.commander.cargo,
              [commodityKey]: owned - units
            }
          },
          market: refreshItems(nextSession),
          ui: withUiMessage(
            state.ui,
            createUiMessage('success', `Sold ${units} ${item.name}`, `Earned ${earnings} cr. Balance now ${nextCash} cr.`)
          )
        };
      }),
    triggerMissionExternalEvent: (event) =>
      set((state) => {
        const progress = applyMissionExternalEvent(
          { tp: state.commander.missionTP, variant: state.commander.missionVariant },
          event
        );

        return {
          commander: {
            ...state.commander,
            missionTP: progress.tp
          },
          missions: {
            missionLog: getMissionMessagesForDocking(progress)
          }
        };
      }),
    quickSave: () => {
      const commander = get().commander;
      const json = serializeCommanderJson(commander);
      const binary = encodeCommanderBinary256(commander);
      set((state) => ({
        saveState: { json, binary },
        ui: withUiMessage(state.ui, createUiMessage('info', 'Quick save complete', 'Commander data stored in both JSON and binary format.'))
      }));
    },
    loadFromSave: () => {
      const state = get();
      if (!state.saveState) {
        return;
      }

      const commanderFromJson = loadCommanderJson(state.saveState.json);
      const commanderFromBin = decodeCommanderBinary256(state.saveState.binary);
      const commander = commanderFromJson.name ? commanderFromJson : commanderFromBin;

      set((current) => {
        const missionProgress = applyDockingMissionState({
          tp: commander.missionTP,
          variant: commander.missionVariant
        });

        return {
          commander: {
            ...commander,
            missionTP: missionProgress.tp
          },
          universe: {
            ...current.universe,
            currentSystem: commander.currentSystem,
            nearbySystems: getNearbySystemNames(commander.currentSystem),
            economy: getSystemByName(commander.currentSystem)?.data.economy ?? current.universe.economy
          },
          missions: {
            missionLog: getMissionMessagesForDocking(missionProgress)
          },
          ui: withUiMessage(
            current.ui,
            createUiMessage('info', 'Save loaded', `Commander restored at ${commander.currentSystem} with ${commander.cash} cr.`)
          )
        };
      });
    }
  };
});
