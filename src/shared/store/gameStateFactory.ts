import { createDefaultCommander, getLegalValueAfterHyperspaceJump, normalizeCommanderState, patchCommanderState, type CommanderState } from '../../features/commander/domain/commander';
import { encodeCommanderBinary256 } from '../../features/persistence/domain/commanderPersistence';
import { loadGameJson, serializeGameJson, type GameSnapshot } from '../../features/persistence/domain/gamePersistence';
import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getJumpFuelUnits } from '../domain/fuel';
import { getGalaxySystems, getNearbySystemNames, getSystemByName, getSystemDistance } from '../../features/galaxy/domain/galaxyCatalog';
import { createDockedMarketSession, getSessionMarketItems, type DockedMarketSession } from '../../features/market/domain/market';
import { setUiMessage } from './uiMessages';
import type { GameStore, SaveSlotId, SaveState } from './storeTypes';
import type { AppTab, MarketState } from './types';

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
export const DOCKED_SESSION_STORAGE_KEY = 'diso-code:docked-session-v2';

interface PersistedSettings {
  instantTravelEnabled?: boolean;
  showTravelPerfOverlay?: boolean;
  startMenuMusicEnabled?: boolean;
  startMenuFullscreenEnabled?: boolean;
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
  const galaxyIndex = 0;
  const system = getSystemByName(normalizedCommander.currentSystem, galaxyIndex);
  const economy = system?.data.economy ?? 5;

  return {
    universe: {
      galaxyIndex,
      currentSystem: normalizedCommander.currentSystem,
      nearbySystems: getNearbySystemNames(normalizedCommander.currentSystem, galaxyIndex),
      stardate: 3124,
      economy,
      marketFluctuation: 0
    },
    commander: normalizedCommander,
    market: createMarketState(normalizedCommander.currentSystem, economy, 0)
  };
}

/**
 * Reduces live store state to the subset that belongs in a save file.
 *
 * The save payload intentionally tracks only the durable docked world state:
 * commander, universe, and the current market session.
 */
export function createSnapshot(state: Pick<GameStore, 'commander' | 'universe' | 'market'>): GameSnapshot {
  return {
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session
  };
}

/**
 * Safe lookup for a system's tech level.
 */
export function getCurrentTechLevel(systemName: string, galaxyIndex = 0): number {
  return getSystemByName(systemName, galaxyIndex)?.data.techLevel ?? 0;
}

/**
 * Core "arrive docked at a system" transition used by all travel completion
 * paths, including normal arrival, re-docking at origin and rescue recovery.
 */
export function createDockedState(
  state: Pick<GameStore, 'universe' | 'commander' | 'ui'>,
  systemName: string,
  options: { spendJumpFuel: boolean; title?: string; body?: string; stardateDelta?: number }
) {
  // Validate the jump before mutating anything if this transition is supposed
  // to consume hyperspace fuel.
  const distance = getSystemDistance(state.universe.currentSystem, systemName, state.universe.galaxyIndex);
  const jumpFuelUnits = getJumpFuelUnits(distance);
  const availableFuelUnits = getFuelUnits(state.commander.fuel);
  if (options.spendJumpFuel && (!Number.isFinite(distance) || jumpFuelUnits <= 0 || jumpFuelUnits > availableFuelUnits)) {
    return null;
  }

  // Commander state is normalized after system transfer so any legacy or
  // partial state stays consistent.
  const nextCommander = patchCommanderState(state.commander, { currentSystem: systemName });
  if (options.spendJumpFuel) {
    nextCommander.fuel = clampFuel(fuelUnitsToLightYears(availableFuelUnits - jumpFuelUnits));
  }
  const nextSystem = getSystemByName(systemName, state.universe.galaxyIndex);
  const nextEconomy = nextSystem?.data.economy ?? state.universe.economy;
  const fluctuation = (state.universe.stardate + systemName.length) & 0xff;
  const nextMarket = createMarketState(systemName, nextEconomy, fluctuation);

  // The returned object is intentionally a complete docked-state fragment that
  // callers can spread into the store directly.
  const nextUi =
    options.title && options.body !== undefined
      ? setUiMessage(state.ui, 'info', options.title, options.body)
      : state.ui;

  return {
    universe: {
      ...state.universe,
      currentSystem: systemName,
      nearbySystems: getNearbySystemNames(systemName, state.universe.galaxyIndex),
      economy: nextEconomy,
      marketFluctuation: fluctuation,
      stardate: state.universe.stardate + (options.stardateDelta ?? 1)
    },
    commander: nextCommander,
    market: nextMarket,
    // Docked transitions do not inherently require a toast/log entry. Callers
    // opt in only when the transition carries actionable player-facing news.
    ui: nextUi
  };
}

/**
 * Specialized helper for successful hyperspace arrival. It builds on
 * `createDockedState` and then adds the arrival-specific UI summary.
 */
export function createArrivalState(state: Pick<GameStore, 'universe' | 'commander' | 'ui'>, systemName: string) {
  const arrivalCommander = patchCommanderState(state.commander, {
    legalValue: getLegalValueAfterHyperspaceJump(state.commander.legalValue, state.commander.cargo)
  });
  return createDockedState({ ...state, commander: arrivalCommander }, systemName, {
    spendJumpFuel: true,
    stardateDelta: 1
  });
}

/**
 * Galactic hyperdrive is a docked-only world transition in this codebase. It
 * switches to the next generated galaxy, rebuilds the docked market context,
 * and consumes the installed drive without invoking the in-flight travel loop.
 */
export function createGalacticHyperdriveState(state: Pick<GameStore, 'commander' | 'universe' | 'ui'>) {
  const nextGalaxyIndex = (state.universe.galaxyIndex + 1) % 8;
  const currentSystem = getSystemByName(state.universe.currentSystem, state.universe.galaxyIndex);
  const nextGalaxySystems = getGalaxySystems(nextGalaxyIndex);
  const namedTarget = getSystemByName(state.universe.currentSystem, nextGalaxyIndex);
  const indexedTarget = typeof currentSystem?.index === 'number' ? nextGalaxySystems[currentSystem.index] : undefined;
  const destinationSystem = namedTarget ?? indexedTarget ?? nextGalaxySystems[0];
  if (!destinationSystem) {
    return null;
  }

  const commander = patchCommanderState(state.commander, {
    currentSystem: destinationSystem.data.name,
    installedEquipment: {
      ...state.commander.installedEquipment,
      galactic_hyperdrive: false
    }
  });
  const fluctuation = (state.universe.stardate + destinationSystem.data.name.length) & 0xff;
  const nearbySystems = getNearbySystemNames(destinationSystem.data.name, nextGalaxyIndex);

  return {
    commander,
    universe: {
      ...state.universe,
      galaxyIndex: nextGalaxyIndex,
      currentSystem: destinationSystem.data.name,
      nearbySystems,
      economy: destinationSystem.data.economy,
      marketFluctuation: fluctuation
    },
    market: createMarketState(destinationSystem.data.name, destinationSystem.data.economy, fluctuation),
    ui: setUiMessage(state.ui, 'success', 'Galactic Hyperdrive engaged', `Arrived in galaxy ${nextGalaxyIndex + 1} at ${destinationSystem.data.name}.`)
  };
}

/**
 * Rehydrates a saved snapshot into live store-ready state.
 *
 * Older save files may still contain now-ignored fields from before the
 * priority system was removed, but only the durable docked state is restored.
 */
export function restoreSnapshot(snapshot: GameSnapshot) {
  const commander = normalizeCommanderState(snapshot.commander);
  return {
    commander,
    universe: {
      ...snapshot.universe,
      currentSystem: commander.currentSystem,
      galaxyIndex: snapshot.universe.galaxyIndex ?? 0,
      nearbySystems: getNearbySystemNames(commander.currentSystem, snapshot.universe.galaxyIndex ?? 0)
    },
    market: refreshItems(snapshot.marketSession)
  };
}

/**
 * Validates a persisted tab before it is trusted to drive navigation.
 */
export function isAppTab(value: unknown): value is AppTab {
  return (
    value === 'market' ||
    value === 'equipment' ||
    value === 'status' ||
    value === 'system-data' ||
    value === 'short-range-chart' ||
    value === 'galaxy-chart'
  );
}

/**
 * Checks whether browser storage already contains a docked run that can be
 * resumed from the start menu without going through a manual slot load.
 */
export function hasPersistedDockedSession(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  return Boolean(window.localStorage.getItem(DOCKED_SESSION_STORAGE_KEY));
}

/**
 * Loads and rehydrates the last persisted docked session from local storage.
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
    const parsed = JSON.parse(raw);
    const state = parsed.state;
    if (!state || state.__isTravelling) {
      return null;
    }
    const restored = restoreSnapshot({
      commander: state.commander,
      universe: state.universe,
      marketSession: state.marketSession
    });
    return {
      activeTab: state.ui?.activeTab as AppTab,
      activeSaveSlotId: state.activeSaveSlotId ?? null,
      restoredState: restored
    };
  } catch {
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
 * Picks the most recently written save slot so older app versions can still
 * infer which slot should be treated as the active run after a reload.
 */
export function getMostRecentSaveSlotId(saveStates: Partial<Record<SaveSlotId, SaveState>>): SaveSlotId | null {
  const mostRecent = SAVE_SLOT_IDS.filter((slotId) => saveStates[slotId]).sort((left, right) => {
    const leftSavedAt = saveStates[left]?.savedAt ?? '';
    const rightSavedAt = saveStates[right]?.savedAt ?? '';
    return rightSavedAt.localeCompare(leftSavedAt);
  })[0];
  return mostRecent ?? null;
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
 * Reads the start-menu music preference from local storage.
 */
export function loadStartMenuMusicEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return true;
    }
    const parsed = JSON.parse(raw) as PersistedSettings;
    return parsed.startMenuMusicEnabled ?? true;
  } catch {
    return true;
  }
}

/**
 * Persists the start-menu music preference.
 */
export function persistStartMenuMusicEnabled(enabled: boolean) {
  persistSettings({ startMenuMusicEnabled: enabled });
}

/**
 * Reads the start-menu fullscreen preference from local storage.
 */
export function loadStartMenuFullscreenEnabled(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return true;
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return true;
    }
    const parsed = JSON.parse(raw) as PersistedSettings;
    return parsed.startMenuFullscreenEnabled ?? true;
  } catch {
    return true;
  }
}

/**
 * Persists the start-menu fullscreen preference.
 */
export function persistStartMenuFullscreenEnabled(enabled: boolean) {
  persistSettings({ startMenuFullscreenEnabled: enabled });
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
