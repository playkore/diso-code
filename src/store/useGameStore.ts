import { create } from 'zustand';
import { applyLegalFloor, createDefaultCommander, cargoUsedTonnes, normalizeCommanderState } from '../domain/commander';
import {
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
import type { AppTab, CommanderState, MarketState, MissionsState, TravelState, UiMessage, UiState, UniverseState } from './types';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';
import { loadGameJson, serializeGameJson, type GameSnapshot } from '../domain/gamePersistence';

interface SaveState {
  savedAt: string;
  json: string;
  binary: Uint8Array;
  snapshot: GameSnapshot;
}

type SaveSlotId = 1 | 2 | 3;

interface TravelCompletionReport {
  legalValue?: number;
  tallyDelta?: number;
  missionEvents?: MissionExternalEvent[];
}

const SAVE_SLOT_IDS: SaveSlotId[] = [1, 2, 3];
const SAVE_SLOT_STORAGE_KEY = 'diso-code:slots';
const SETTINGS_STORAGE_KEY = 'diso-code:settings';

interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  missions: MissionsState;
  travelSession: TravelState | null;
  ui: UiState;
  saveStates: Partial<Record<SaveSlotId, SaveState>>;
  setActiveTab: (tab: AppTab) => void;
  setInstantTravelEnabled: (enabled: boolean) => void;
  beginTravel: (systemName: string) => boolean;
  cancelTravel: () => void;
  completeTravel: (report?: TravelCompletionReport) => void;
  dockAtSystem: (systemName: string) => void;
  buyFuel: (units: number) => void;
  buyCommodity: (commodityKey: string, amount: number) => void;
  sellCommodity: (commodityKey: string, amount: number) => void;
  triggerMissionExternalEvent: (event: MissionExternalEvent) => void;
  saveToSlot: (slotId: SaveSlotId) => void;
  loadFromSlot: (slotId: SaveSlotId) => void;
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
  const normalizedCommander = normalizeCommanderState(commander);
  const system = getSystemByName(normalizedCommander.currentSystem);
  const economy = system?.data.economy ?? 5;

  return {
    universe: {
      currentSystem: normalizedCommander.currentSystem,
      nearbySystems: getNearbySystemNames(normalizedCommander.currentSystem),
      stardate: 3124,
      economy,
      marketFluctuation: 0
    },
    commander: normalizedCommander,
    market: createMarketState(normalizedCommander.currentSystem, economy, 0),
    missions: updateMissionLog(normalizedCommander)
  };
}

function createSnapshot(state: Pick<GameStore, 'commander' | 'universe' | 'market'>): GameSnapshot {
  return {
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session
  };
}

function createArrivalState(state: Pick<GameStore, 'universe' | 'commander' | 'ui'>, systemName: string) {
  const distance = getSystemDistance(state.universe.currentSystem, systemName);
  const jumpFuelCost = getJumpFuelCost(distance);
  const jumpFuelUnits = getJumpFuelUnits(distance);
  const availableFuelUnits = getFuelUnits(state.commander.fuel);

  if (!Number.isFinite(distance) || jumpFuelUnits <= 0 || jumpFuelUnits > availableFuelUnits) {
    return null;
  }

  const nextCommander = normalizeCommanderState({ ...state.commander, currentSystem: systemName });
  nextCommander.fuel = clampFuel(fuelUnitsToLightYears(availableFuelUnits - jumpFuelUnits));
  nextCommander.legalValue = applyLegalFloor(nextCommander.legalValue, nextCommander.cargo);
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
}

function restoreSnapshot(snapshot: GameSnapshot) {
  const missionProgress = applyDockingMissionState({
    tp: snapshot.commander.missionTP,
    variant: snapshot.commander.missionVariant
  });
  const commander = normalizeCommanderState({
    ...snapshot.commander,
    missionTP: missionProgress.tp
  });

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

function persistSaveStates(saveStates: Partial<Record<SaveSlotId, SaveState>>) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const payload = Object.fromEntries(
    SAVE_SLOT_IDS.flatMap((slotId) => {
      const saveState = saveStates[slotId];
      if (!saveState) {
        return [];
      }

      return [[
        String(slotId),
        {
          savedAt: saveState.savedAt,
          json: saveState.json,
          binary: Array.from(saveState.binary)
        }
      ]];
    })
  );

  window.localStorage.setItem(SAVE_SLOT_STORAGE_KEY, JSON.stringify(payload));
}

function loadPersistedSaveStates(): Partial<Record<SaveSlotId, SaveState>> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  const raw = window.localStorage.getItem(SAVE_SLOT_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, { savedAt: string; json: string; binary: number[] }>;
    const saveStates: Partial<Record<SaveSlotId, SaveState>> = {};

    for (const slotId of SAVE_SLOT_IDS) {
      const slot = parsed[String(slotId)];
      if (!slot) {
        continue;
      }

      const gameSave = loadGameJson(slot.json);
      saveStates[slotId] = {
        savedAt: gameSave.savedAt,
        json: slot.json,
        binary: Uint8Array.from(slot.binary),
        snapshot: gameSave.snapshot
      };
    }

    return saveStates;
  } catch {
    window.localStorage.removeItem(SAVE_SLOT_STORAGE_KEY);
    return {};
  }
}

function loadInstantTravelEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { instantTravelEnabled?: boolean };
    return parsed.instantTravelEnabled === true;
  } catch {
    return false;
  }
}

function persistInstantTravelEnabled(enabled: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ instantTravelEnabled: enabled }));
}

export const useGameStore = create<GameStore>((set, get) => {
  const initialCommander = createDefaultCommander();
  const initialState = createInitialGameState(initialCommander);
  const persistedSaveStates = loadPersistedSaveStates();
  const instantTravelEnabled = loadInstantTravelEnabled();
  return {
    universe: initialState.universe,
    commander: initialState.commander,
    market: initialState.market,
    missions: initialState.missions,
    travelSession: null,
    saveStates: persistedSaveStates,
    ui: {
      activeTab: 'market',
      compactMode: true,
      instantTravelEnabled,
      activityLog: []
    },
    setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
    setInstantTravelEnabled: (enabled) =>
      set((state) => {
        persistInstantTravelEnabled(enabled);
        return {
          ui: withUiMessage(
            { ...state.ui, instantTravelEnabled: enabled },
            createUiMessage(
              'info',
              enabled ? 'Instant travel enabled' : 'Space travel enabled',
              enabled ? 'Travel now skips the arcade flight segment.' : 'Travel now opens the space flight segment before docking.'
            )
          )
        };
      }),
    beginTravel: (systemName) => {
      const state = get();
      const distance = getSystemDistance(state.universe.currentSystem, systemName);
      const jumpFuelCost = getJumpFuelCost(distance);
      const jumpFuelUnits = getJumpFuelUnits(distance);
      const availableFuelUnits = getFuelUnits(state.commander.fuel);

      if (!Number.isFinite(distance) || jumpFuelUnits <= 0) {
        return false;
      }

      if (jumpFuelUnits > availableFuelUnits) {
        set({
          ui: withUiMessage(
            state.ui,
            createUiMessage(
              'error',
              `Insufficient fuel for ${systemName}`,
              `Jump needs ${formatLightYears(jumpFuelCost)} but only ${formatLightYears(state.commander.fuel)} remain.`
            )
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
          travelSession: null
        });
        return false;
      }

      const commander = {
        ...state.commander,
        legalValue: applyLegalFloor(state.commander.legalValue, state.commander.cargo)
      };

      set({
        commander,
        travelSession: {
          originSystem: state.universe.currentSystem,
          destinationSystem: systemName,
          fuelCost: jumpFuelCost,
          fuelUnits: jumpFuelUnits
        }
      });
      return true;
    },
    cancelTravel: () => set({ travelSession: null }),
    completeTravel: (report) =>
      set((state) => {
        if (!state.travelSession) {
          return state;
        }

        let commander = normalizeCommanderState({
          ...state.commander,
          legalValue: report?.legalValue ?? state.commander.legalValue,
          tally: state.commander.tally + (report?.tallyDelta ?? 0)
        });

        if (report?.missionEvents?.length) {
          const progress = report.missionEvents.reduce(
            (current, event) => applyMissionExternalEvent(current, event),
            { tp: commander.missionTP, variant: commander.missionVariant }
          );
          commander = normalizeCommanderState({
            ...commander,
            missionTP: progress.tp
          });
        }

        const nextState = createArrivalState(
          {
            ...state,
            commander
          },
          state.travelSession.destinationSystem
        );
        if (!nextState) {
          return {
            ...state,
            travelSession: null,
            ui: withUiMessage(
              state.ui,
              createUiMessage('error', 'Travel failed', 'The hyperspace solution collapsed before arrival.')
            )
          };
        }

        return {
          ...nextState,
          travelSession: null
        };
      }),
    dockAtSystem: (systemName) =>
      set((state) => {
        const nextState = createArrivalState(state, systemName);
        if (!nextState) {
          return state;
        }

        return {
          ...nextState,
          travelSession: null
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
    saveToSlot: (slotId) => {
      const state = get();
      const snapshot = createSnapshot(state);
      const savedAt = new Date().toISOString();
      const json = serializeGameJson(snapshot, savedAt);
      const binary = encodeCommanderBinary256(snapshot.commander);
      const saveState = { savedAt, json, binary, snapshot };
      const nextSaveStates = {
        ...state.saveStates,
        [slotId]: saveState
      };

      persistSaveStates(nextSaveStates);

      set((current) => ({
        saveStates: nextSaveStates,
        ui: withUiMessage(
          current.ui,
          createUiMessage('info', `Slot ${slotId} saved`, `Saved ${snapshot.commander.name} at ${snapshot.commander.currentSystem}.`)
        )
      }));
    },
    loadFromSlot: (slotId) => {
      const state = get();
      const saveState = state.saveStates[slotId];
      if (!saveState) {
        return;
      }
      const restoredState = restoreSnapshot(saveState.snapshot);

      set((current) => ({
        ...restoredState,
        travelSession: null,
        saveStates: state.saveStates,
        ui: withUiMessage(
          current.ui,
          createUiMessage(
            'info',
            `Slot ${slotId} loaded`,
            `Commander restored at ${saveState.snapshot.commander.currentSystem} with ${formatCredits(saveState.snapshot.commander.cash)}.`
          )
        )
      }));
    },
    startNewGame: () => {
      const freshCommander = createDefaultCommander();
      const freshState = createInitialGameState(freshCommander);

      set((state) => ({
        ...freshState,
        travelSession: null,
        ui: withUiMessage(
          { ...state.ui, activeTab: 'market' },
          createUiMessage('info', 'New game started', 'Fresh commander created. Save when you want to overwrite Slot 1.')
        )
      }));
    }
  };
});
