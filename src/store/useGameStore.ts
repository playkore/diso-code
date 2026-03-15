import { create } from 'zustand';
import { createDefaultCommander, cargoUsedTonnes } from '../domain/commander';
import {
  decodeCommanderBinary256,
  encodeCommanderBinary256
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
import { getNearbySystemNames, getSystemByName, getSystemDistance } from '../domain/galaxyCatalog';
import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getJumpFuelCost, getJumpFuelUnits, getRefuelCost, MAX_FUEL } from '../domain/fuel';
import type { AppTab, CommanderState, MarketState, MissionsState, UiMessage, UiState, UniverseState } from './types';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';
import { loadGameJson, serializeGameJson, type GameSnapshot } from '../domain/gamePersistence';

interface SaveState {
  savedAt: string;
  json: string;
  binary: Uint8Array;
  snapshot: GameSnapshot;
}

const SAVE_SLOT_STORAGE_KEY = 'diso-code:slot-1';

interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  missions: MissionsState;
  ui: UiState;
  saveState?: SaveState;
  setActiveTab: (tab: AppTab) => void;
  dockAtSystem: (systemName: string) => void;
  buyFuel: (units: number) => void;
  buyCommodity: (commodityKey: string, amount: number) => void;
  sellCommodity: (commodityKey: string, amount: number) => void;
  triggerMissionExternalEvent: (event: MissionExternalEvent) => void;
  quickSave: () => void;
  loadFromSave: () => void;
  startNewGame: () => void;
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

function createInitialGameState(commander: CommanderState) {
  const system = getSystemByName(commander.currentSystem);
  const economy = system?.data.economy ?? 5;

  return {
    universe: {
      currentSystem: commander.currentSystem,
      nearbySystems: getNearbySystemNames(commander.currentSystem),
      stardate: 3124,
      economy,
      marketFluctuation: 0
    },
    commander,
    market: createMarketState(commander.currentSystem, economy, 0),
    missions: updateMissionLog(commander)
  };
}

function createSnapshot(state: Pick<GameStore, 'commander' | 'universe' | 'market'>): GameSnapshot {
  return {
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session
  };
}

function restoreSnapshot(snapshot: GameSnapshot) {
  const missionProgress = applyDockingMissionState({
    tp: snapshot.commander.missionTP,
    variant: snapshot.commander.missionVariant
  });
  const commander = {
    ...snapshot.commander,
    missionTP: missionProgress.tp
  };

  return {
    commander,
    universe: {
      ...snapshot.universe,
      currentSystem: commander.currentSystem,
      nearbySystems: getNearbySystemNames(commander.currentSystem)
    },
    market: refreshItems(snapshot.marketSession),
    missions: {
      missionLog: getMissionMessagesForDocking(missionProgress)
    }
  };
}

function persistSaveState(saveState: SaveState | undefined) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  if (!saveState) {
    window.localStorage.removeItem(SAVE_SLOT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    SAVE_SLOT_STORAGE_KEY,
    JSON.stringify({
      savedAt: saveState.savedAt,
      json: saveState.json,
      binary: Array.from(saveState.binary)
    })
  );
}

function loadPersistedSaveState(): SaveState | undefined {
  if (typeof window === 'undefined' || !window.localStorage) {
    return undefined;
  }

  const raw = window.localStorage.getItem(SAVE_SLOT_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as { savedAt: string; json: string; binary: number[] };
    const gameSave = loadGameJson(parsed.json);
    return {
      savedAt: gameSave.savedAt,
      json: parsed.json,
      binary: Uint8Array.from(parsed.binary),
      snapshot: gameSave.snapshot
    };
  } catch {
    window.localStorage.removeItem(SAVE_SLOT_STORAGE_KEY);
    return undefined;
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  const initialCommander = createDefaultCommander();
  const initialState = createInitialGameState(initialCommander);
  const persistedSaveState = loadPersistedSaveState();
  return {
    universe: initialState.universe,
    commander: initialState.commander,
    market: initialState.market,
    missions: initialState.missions,
    saveState: persistedSaveState,
    ui: {
      activeTab: 'market',
      compactMode: true,
      activityLog: []
    },
    setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
    dockAtSystem: (systemName) =>
      set((state) => {
        const distance = getSystemDistance(state.universe.currentSystem, systemName);
        const jumpFuelCost = getJumpFuelCost(distance);
        const jumpFuelUnits = getJumpFuelUnits(distance);
        const availableFuelUnits = getFuelUnits(state.commander.fuel);
        if (!Number.isFinite(distance) || jumpFuelUnits <= 0) {
          return state;
        }

        if (jumpFuelUnits > availableFuelUnits) {
          return {
            ui: withUiMessage(
              state.ui,
              createUiMessage(
                'error',
                `Insufficient fuel for ${systemName}`,
                `Jump needs ${formatLightYears(jumpFuelCost)} but only ${formatLightYears(state.commander.fuel)} remain.`
              )
            )
          };
        }

        const nextCommander = { ...state.commander, currentSystem: systemName };
        nextCommander.fuel = clampFuel(fuelUnitsToLightYears(availableFuelUnits - jumpFuelUnits));
        const progress = applyDockingMissionState({ tp: nextCommander.missionTP, variant: nextCommander.missionVariant });
        nextCommander.missionTP = progress.tp;
        const nextSystem = getSystemByName(systemName);
        const nextEconomy = nextSystem?.data.economy ?? state.universe.economy;
        const fluctuation = (state.universe.stardate + systemName.length) & 0xff;
        const nextMarket = createMarketState(systemName, nextEconomy, fluctuation);
        const cheapest = getCheapestCommodity(nextMarket.session);
        const arrivalMessage = createUiMessage(
          'info',
          `Docked at ${systemName}`,
          `Jumped ${formatLightYears(jumpFuelCost)}. Fuel now ${formatLightYears(nextCommander.fuel)}. Cheapest local price: ${cheapest.name} at ${formatCredits(cheapest.price)}.`
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
    buyFuel: (units) =>
      set((state) => {
        const requestedUnits = Math.max(0, Math.trunc(units));
        const currentFuelUnits = getFuelUnits(state.commander.fuel);
        const missingUnits = Math.max(0, getFuelUnits(MAX_FUEL) - currentFuelUnits);
        const purchasedUnits = Math.min(requestedUnits, missingUnits);

        if (purchasedUnits <= 0) {
          return {
            ui: withUiMessage(
              state.ui,
              createUiMessage('error', 'Fuel tank full', `The tank already holds ${formatLightYears(state.commander.fuel)}.`)
            )
          };
        }

        const cost = getRefuelCost(purchasedUnits);
        if (cost > state.commander.cash) {
          return {
            ui: withUiMessage(
              state.ui,
              createUiMessage(
                'error',
                'Not enough credits for fuel',
                `You need ${formatCredits(cost)} but only have ${formatCredits(state.commander.cash)}.`
              )
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
            createUiMessage(
              'success',
              'Fuel purchased',
              `Added ${formatLightYears(fuelUnitsToLightYears(purchasedUnits))}. Fuel now ${formatLightYears(nextFuel)}. Balance ${formatCredits(nextCash)}.`
            )
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
                `You need ${formatCredits(spent)} but only have ${formatCredits(state.commander.cash)}.`
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
            createUiMessage(
              'success',
              `Bought ${units} ${item.name}`,
              `Spent ${formatCredits(spent)}. Balance now ${formatCredits(nextCash)}.`
            )
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
            createUiMessage(
              'success',
              `Sold ${units} ${item.name}`,
              `Earned ${formatCredits(earnings)}. Balance now ${formatCredits(nextCash)}.`
            )
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
      const state = get();
      const snapshot = createSnapshot(state);
      const savedAt = new Date().toISOString();
      const json = serializeGameJson(snapshot, savedAt);
      const binary = encodeCommanderBinary256(snapshot.commander);
      const saveState = { savedAt, json, binary, snapshot };

      persistSaveState(saveState);

      set((current) => ({
        saveState,
        ui: withUiMessage(
          current.ui,
          createUiMessage('info', 'Slot 1 saved', `Saved ${snapshot.commander.name} at ${snapshot.commander.currentSystem}.`)
        )
      }));
    },
    loadFromSave: () => {
      const state = get();
      if (!state.saveState) {
        return;
      }
      const commanderFromBinary = decodeCommanderBinary256(state.saveState.binary);
      const restoredState = restoreSnapshot(state.saveState.snapshot);

      set((current) => ({
        ...restoredState,
        saveState: state.saveState,
        ui: withUiMessage(
          current.ui,
          createUiMessage(
            'info',
            'Slot 1 loaded',
            `Commander restored at ${commanderFromBinary.currentSystem} with ${formatCredits(commanderFromBinary.cash)}.`
          )
        )
      }));
    },
    startNewGame: () => {
      const freshCommander = createDefaultCommander();
      const freshState = createInitialGameState(freshCommander);

      set((state) => ({
        ...freshState,
        ui: withUiMessage(
          { ...state.ui, activeTab: 'market' },
          createUiMessage('info', 'New game started', 'Fresh commander created. Save when you want to overwrite Slot 1.')
        )
      }));
    }
  };
});
