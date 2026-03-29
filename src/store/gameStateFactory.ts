import { createDefaultCommander, normalizeCommanderState, type CommanderState } from '../domain/commander';
import { encodeCommanderBinary256 } from '../domain/commanderPersistence';
import { loadGameJson, serializeGameJson, type GameSnapshot } from '../domain/gamePersistence';
import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../domain/fuel';
import { getNearbySystemNames, getSystemByName, getSystemDistance } from '../domain/galaxyCatalog';
import { createDockedMarketSession, getSessionMarketItems, type DockedMarketSession } from '../domain/market';
import { createScenarioSnapshot, getScenarioMissionPanel, type PersistedScenarioState } from '../domain/scenarios';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';
import { createUiMessage, withUiMessage } from './uiMessages';
import { createInitialMissionState } from './slices/missionSlice';
import type { GameStore, SaveSlotId, SaveState } from './storeTypes';
import type { AppTab, MarketState, MissionsState, ScenarioState } from './types';

/**
 * Store factory helpers
 * ---------------------
 *
 * This module contains the pure-ish state-construction helpers used by the
 * Zustand slices and the root store. If you want to understand how the docked
 * game is assembled or restored, start here.
 *
 * Responsibilities:
 * - build docked market state for a system
 * - derive mission log state after docking
 * - create the initial game state
 * - transition into a docked state after travel
 * - snapshot / restore save payloads
 * - persist and load local-storage preferences
 */

/**
 * Supported local save slots.
 */
export const SAVE_SLOT_IDS: SaveSlotId[] = [1, 2, 3];
export const SAVE_SLOT_STORAGE_KEY = 'diso-code:slots';
export const SETTINGS_STORAGE_KEY = 'diso-code:settings';
export const DOCKED_SESSION_STORAGE_KEY = 'diso-code:docked-session';

interface PersistedSettings {
  instantTravelEnabled?: boolean;
  showTravelPerfOverlay?: boolean;
}

interface PersistedDockedSession {
  activeTab: AppTab;
  json: string;
}

/**
 * Creates a docked market state for a given system. The market session holds
 * raw market mechanics, while `items` is the precomputed UI-facing projection.
 */
export function createMarketState(systemName: string, economy: number, fluctuation: number): MarketState {
  const session = createDockedMarketSession(systemName, economy, fluctuation);
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

/**
 * Rebuilds the UI-facing market item list after session quantities change.
 */
export function refreshItems(session: DockedMarketSession): MarketState {
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

/**
 * Docking is the canonical moment when mission logs are refreshed.
 */
export function updateMissionLog(commander: CommanderState): MissionsState {
  return {
    availableContracts: createInitialMissionState(commander.currentSystem, getNearbySystemNames(commander.currentSystem), 3124).availableContracts,
    activeMissionMessages: []
  };
}

/**
 * Used for arrival messaging so the UI can highlight an immediate market hook.
 */
export function getCheapestCommodity(session: DockedMarketSession) {
  return getSessionMarketItems(session).reduce((lowest, item) => (item.price < lowest.price ? item : lowest));
}

/**
 * Creates the initial docked game state for a commander.
 */
export function createInitialGameState(commander: CommanderState) {
  const normalizedCommander = normalizeCommanderState(commander);
  const system = getSystemByName(normalizedCommander.currentSystem);
  const economy = system?.data.economy ?? 5;
  const scenarioSnapshot = createScenarioSnapshot({ currentSystem: normalizedCommander.currentSystem });

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
    missions: updateMissionLog(normalizedCommander),
    scenario: createScenarioState(scenarioSnapshot, normalizedCommander.currentSystem)
  };
}

/**
 * Reduces live store state to the subset that belongs in a save file.
 */
export function createSnapshot(state: Pick<GameStore, 'commander' | 'universe' | 'market' | 'scenario'>): GameSnapshot {
  return {
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session,
    scenario: {
      activePluginId: state.scenario.activePluginId,
      runtimeState: state.scenario.runtimeState
    }
  };
}

/**
 * Safe lookup for a system's tech level.
 */
export function getCurrentTechLevel(systemName: string): number {
  return getSystemByName(systemName)?.data.techLevel ?? 0;
}

/**
 * Core "arrive docked at a system" transition used by all travel completion
 * paths, including normal arrival, re-docking at origin and rescue recovery.
 */
export function createDockedState(
  state: Pick<GameStore, 'universe' | 'commander' | 'ui'>,
  systemName: string,
  options: { spendJumpFuel: boolean; title: string; body: string; stardateDelta?: number }
) {
  // Validate the jump before mutating anything if this transition is supposed
  // to consume hyperspace fuel.
  const distance = getSystemDistance(state.universe.currentSystem, systemName);
  const jumpFuelUnits = getJumpFuelUnits(distance);
  const availableFuelUnits = getFuelUnits(state.commander.fuel);
  if (options.spendJumpFuel && (!Number.isFinite(distance) || jumpFuelUnits <= 0 || jumpFuelUnits > availableFuelUnits)) {
    return null;
  }

  // Commander state is normalized after system transfer so any legacy or
  // partial state stays consistent.
  const nextCommander = normalizeCommanderState({ ...state.commander, currentSystem: systemName });
  if (options.spendJumpFuel) {
    nextCommander.fuel = clampFuel(fuelUnitsToLightYears(availableFuelUnits - jumpFuelUnits));
  }
  const nextSystem = getSystemByName(systemName);
  const nextEconomy = nextSystem?.data.economy ?? state.universe.economy;
  const fluctuation = (state.universe.stardate + systemName.length) & 0xff;
  const nextMarket = createMarketState(systemName, nextEconomy, fluctuation);

  // The returned object is intentionally a complete docked-state fragment that
  // callers can spread into the store directly.
  return {
    universe: {
      ...state.universe,
      currentSystem: systemName,
      nearbySystems: getNearbySystemNames(systemName),
      economy: nextEconomy,
      marketFluctuation: fluctuation,
      stardate: state.universe.stardate + (options.stardateDelta ?? 1)
    },
    commander: nextCommander,
    market: nextMarket,
    missions: {
      ...createInitialMissionState(systemName, getNearbySystemNames(systemName), state.universe.stardate + (options.stardateDelta ?? 1)),
      activeMissionMessages: []
    },
    ui: withUiMessage(state.ui, createUiMessage('info', options.title, options.body))
  };
}

/**
 * Specialized helper for successful hyperspace arrival. It builds on
 * `createDockedState` and then adds the arrival-specific UI summary.
 */
export function createArrivalState(state: Pick<GameStore, 'universe' | 'commander' | 'ui'>, systemName: string) {
  const jumpFuelCost = getJumpFuelCost(getSystemDistance(state.universe.currentSystem, systemName));
  const nextState = createDockedState(state, systemName, {
    spendJumpFuel: true,
    title: `Docked at ${systemName}`,
    body: '',
    stardateDelta: 1
  });
  if (!nextState) {
    return null;
  }

  const cheapest = getCheapestCommodity(nextState.market.session);
  nextState.ui = withUiMessage(
    state.ui,
    createUiMessage(
      'info',
      `Docked at ${systemName}`,
      `Jumped ${formatLightYears(jumpFuelCost)}. Fuel now ${formatLightYears(nextState.commander.fuel)}. Cheapest local price: ${cheapest.name} at ${formatCredits(cheapest.price)}.`
    )
  );
  return nextState;
}

/**
 * Rehydrates a saved snapshot into live store-ready state.
 */
export function restoreSnapshot(snapshot: GameSnapshot) {
  const commander = normalizeCommanderState(snapshot.commander);
  const scenarioSnapshot = snapshot.scenario ?? createScenarioSnapshot({ currentSystem: commander.currentSystem });
  return {
    commander,
    universe: {
      ...snapshot.universe,
      currentSystem: commander.currentSystem,
      nearbySystems: getNearbySystemNames(commander.currentSystem)
    },
    market: refreshItems(snapshot.marketSession),
    missions: createInitialMissionState(commander.currentSystem, getNearbySystemNames(commander.currentSystem), snapshot.universe.stardate),
    scenario: createScenarioState(scenarioSnapshot, commander.currentSystem)
  };
}

/**
 * Rebuilds the UI-facing scenario projection from the persisted runtime state.
 *
 * Save files store only the plugin id and opaque runtime data. This helper is
 * the single place that recreates the mission-panel view after boot or load.
 */
export function createScenarioState(snapshot: PersistedScenarioState, currentSystem: string): ScenarioState {
  return {
    activePluginId: snapshot.activePluginId,
    runtimeState: snapshot.runtimeState,
    missionPanel: getScenarioMissionPanel(snapshot, { currentSystem })
  };
}

/**
 * Validates a persisted tab before it is trusted to drive navigation.
 */
function isAppTab(value: unknown): value is AppTab {
  return (
    value === 'market' ||
    value === 'equipment' ||
    value === 'inventory' ||
    value === 'system-data' ||
    value === 'star-map' ||
    value === 'missions' ||
    value === 'save-load'
  );
}

/**
 * Persists the last fully docked session so a browser refresh can rehydrate
 * the commander, economy, and current station without forcing the player to
 * use a manual save slot. Real-time travel state is deliberately excluded
 * because the flight runtime is an in-memory simulation rather than a stable
 * snapshot format.
 */
export function persistDockedSession(state: Pick<GameStore, 'commander' | 'universe' | 'market' | 'scenario' | 'ui'>) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const savedAt = new Date().toISOString();
  const payload: PersistedDockedSession = {
    activeTab: state.ui.activeTab,
    json: serializeGameJson(createSnapshot(state), savedAt)
  };
  window.localStorage.setItem(DOCKED_SESSION_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Loads the last docked session snapshot. Corrupt autosave data is discarded
 * wholesale so startup always falls back to a clean new-game bootstrap.
 */
export function loadPersistedDockedSession() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  const raw = window.localStorage.getItem(DOCKED_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as PersistedDockedSession;
    if (!isAppTab(parsed.activeTab)) {
      throw new Error('Invalid docked session tab.');
    }
    const gameSave = loadGameJson(parsed.json);
    return {
      activeTab: parsed.activeTab,
      restoredState: restoreSnapshot(gameSave.snapshot)
    };
  } catch {
    window.localStorage.removeItem(DOCKED_SESSION_STORAGE_KEY);
    return null;
  }
}

/**
 * Writes all existing save slots into local storage as a compact serializable
 * payload.
 */
export function persistSaveStates(saveStates: Partial<Record<SaveSlotId, SaveState>>) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const payload = Object.fromEntries(
    SAVE_SLOT_IDS.flatMap((slotId) => {
      const saveState = saveStates[slotId];
      if (!saveState) {
        return [];
      }
      return [[String(slotId), { savedAt: saveState.savedAt, json: saveState.json, binary: Array.from(saveState.binary) }]];
    })
  );
  window.localStorage.setItem(SAVE_SLOT_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Loads save slots from local storage. Corrupt data is discarded rather than
 * causing partial-store failures on startup.
 */
export function loadPersistedSaveStates(): Partial<Record<SaveSlotId, SaveState>> {
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

/**
 * Reads the instant-travel preference from local storage.
 */
export function loadInstantTravelEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as PersistedSettings;
    return parsed.instantTravelEnabled === true;
  } catch {
    return false;
  }
}

/**
 * Persists the instant-travel preference.
 */
export function persistInstantTravelEnabled(enabled: boolean) {
  persistSettings({ instantTravelEnabled: enabled });
}

/**
 * Reads the travel-performance overlay preference from local storage.
 */
export function loadTravelPerfOverlayEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return false;
    }
    const parsed = JSON.parse(raw) as PersistedSettings;
    return parsed.showTravelPerfOverlay === true;
  } catch {
    return false;
  }
}

/**
 * Persists the travel-performance overlay preference.
 */
export function persistTravelPerfOverlayEnabled(enabled: boolean) {
  persistSettings({ showTravelPerfOverlay: enabled });
}

/**
 * Settings share one storage key so multiple toggles can evolve together
 * without each writer accidentally erasing the others.
 */
function persistSettings(partial: PersistedSettings) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  let current: PersistedSettings = {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    current = raw ? (JSON.parse(raw) as PersistedSettings) : {};
  } catch {
    current = {};
  }
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
}

/**
 * Builds the persisted payload for one save slot.
 */
export function createSaveState(snapshot: GameSnapshot) {
  const savedAt = new Date().toISOString();
  return {
    savedAt,
    json: serializeGameJson(snapshot, savedAt),
    binary: encodeCommanderBinary256(snapshot.commander),
    snapshot
  };
}

/**
 * Creates a brand-new game state for the "new game" action.
 */
export function createFreshGameState() {
  const freshCommander = createDefaultCommander();
  return createInitialGameState(freshCommander);
}
