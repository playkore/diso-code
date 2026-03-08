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
import type { AppTab, CommanderState, MarketState, MissionsState, UiState, UniverseState } from './types';

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

export const useGameStore = create<GameStore>((set, get) => {
  const initialCommander = createDefaultCommander();
  return {
    universe: {
      currentSystem: 'Lave',
      nearbySystems: ['Leesti', 'Diso', 'Zaonce', 'Reorte'],
      stardate: 3124,
      economy: 5,
      marketFluctuation: 0
    },
    commander: initialCommander,
    market: createMarketState('Lave', 5, 0),
    missions: updateMissionLog(initialCommander),
    ui: {
      activeTab: 'market',
      compactMode: true
    },
    setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
    dockAtSystem: (systemName, economy, fluctuation) =>
      set((state) => {
        const nextCommander = { ...state.commander, currentSystem: systemName };
        const progress = applyDockingMissionState({ tp: nextCommander.missionTP, variant: nextCommander.missionVariant });
        nextCommander.missionTP = progress.tp;

        return {
          universe: {
            ...state.universe,
            currentSystem: systemName,
            economy,
            marketFluctuation: fluctuation,
            stardate: state.universe.stardate + 1
          },
          commander: nextCommander,
          market: createMarketState(systemName, economy, fluctuation),
          missions: {
            missionLog: getMissionMessagesForDocking(progress)
          }
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
          return state;
        }

        const cargoUsed = cargoUsedTonnes(state.commander.cargo);
        if (item.unit === 't' && cargoUsed + units > state.commander.cargoCapacity) {
          return state;
        }

        const spent = units * item.price;
        if (spent > state.commander.cash) {
          return state;
        }

        const nextSession = applyLocalMarketTrade(state.market.session, commodityKey, -units);

        return {
          commander: {
            ...state.commander,
            cash: state.commander.cash - spent,
            cargo: {
              ...state.commander.cargo,
              [commodityKey]: (state.commander.cargo[commodityKey] ?? 0) + units
            }
          },
          market: refreshItems(nextSession)
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
          return state;
        }

        const nextSession = applyLocalMarketTrade(state.market.session, commodityKey, units);

        return {
          commander: {
            ...state.commander,
            cash: state.commander.cash + units * item.price,
            cargo: {
              ...state.commander.cargo,
              [commodityKey]: owned - units
            }
          },
          market: refreshItems(nextSession)
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
      set({ saveState: { json, binary } });
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
            currentSystem: commander.currentSystem
          },
          missions: {
            missionLog: getMissionMessagesForDocking(missionProgress)
          }
        };
      });
    }
  };
});
