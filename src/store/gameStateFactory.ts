import { applyLegalFloor, createDefaultCommander, normalizeCommanderState, type CommanderState } from '../domain/commander';
import { encodeCommanderBinary256 } from '../domain/commanderPersistence';
import { loadGameJson, serializeGameJson, type GameSnapshot } from '../domain/gamePersistence';
import { clampFuel, fuelUnitsToLightYears, getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../domain/fuel';
import { getNearbySystemNames, getSystemByName, getSystemDistance } from '../domain/galaxyCatalog';
import { applyDockingMissionState, getMissionMessagesForDocking } from '../domain/missions';
import { createDockedMarketSession, getSessionMarketItems, type DockedMarketSession } from '../domain/market';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';
import { createUiMessage, withUiMessage } from './uiMessages';
import type { GameStore, SaveSlotId, SaveState } from './storeTypes';
import type { MarketState, MissionsState } from './types';

export const SAVE_SLOT_IDS: SaveSlotId[] = [1, 2, 3];
export const SAVE_SLOT_STORAGE_KEY = 'diso-code:slots';
export const SETTINGS_STORAGE_KEY = 'diso-code:settings';

export function createMarketState(systemName: string, economy: number, fluctuation: number): MarketState {
  const session = createDockedMarketSession(systemName, economy, fluctuation);
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

export function refreshItems(session: DockedMarketSession): MarketState {
  return {
    session,
    items: getSessionMarketItems(session)
  };
}

export function updateMissionLog(commander: CommanderState): MissionsState {
  const progress = applyDockingMissionState({ tp: commander.missionTP, variant: commander.missionVariant });
  return {
    missionLog: getMissionMessagesForDocking(progress)
  };
}

export function getCheapestCommodity(session: DockedMarketSession) {
  return getSessionMarketItems(session).reduce((lowest, item) => (item.price < lowest.price ? item : lowest));
}

export function createInitialGameState(commander: CommanderState) {
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

export function createSnapshot(state: Pick<GameStore, 'commander' | 'universe' | 'market'>): GameSnapshot {
  return {
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session
  };
}

export function getCurrentTechLevel(systemName: string): number {
  return getSystemByName(systemName)?.data.techLevel ?? 0;
}

export function createDockedState(
  state: Pick<GameStore, 'universe' | 'commander' | 'ui'>,
  systemName: string,
  options: { spendJumpFuel: boolean; title: string; body: string; stardateDelta?: number }
) {
  const distance = getSystemDistance(state.universe.currentSystem, systemName);
  const jumpFuelUnits = getJumpFuelUnits(distance);
  const availableFuelUnits = getFuelUnits(state.commander.fuel);
  if (options.spendJumpFuel && (!Number.isFinite(distance) || jumpFuelUnits <= 0 || jumpFuelUnits > availableFuelUnits)) {
    return null;
  }

  const nextCommander = normalizeCommanderState({ ...state.commander, currentSystem: systemName });
  if (options.spendJumpFuel) {
    nextCommander.fuel = clampFuel(fuelUnitsToLightYears(availableFuelUnits - jumpFuelUnits));
  }
  nextCommander.legalValue = applyLegalFloor(nextCommander.legalValue, nextCommander.cargo);
  const progress = applyDockingMissionState({ tp: nextCommander.missionTP, variant: nextCommander.missionVariant });
  nextCommander.missionTP = progress.tp;
  const nextSystem = getSystemByName(systemName);
  const nextEconomy = nextSystem?.data.economy ?? state.universe.economy;
  const fluctuation = (state.universe.stardate + systemName.length) & 0xff;
  const nextMarket = createMarketState(systemName, nextEconomy, fluctuation);

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
      missionLog: getMissionMessagesForDocking(progress)
    },
    ui: withUiMessage(state.ui, createUiMessage('info', options.title, options.body))
  };
}

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

export function restoreSnapshot(snapshot: GameSnapshot) {
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

export function loadInstantTravelEnabled(): boolean {
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

export function persistInstantTravelEnabled(enabled: boolean) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ instantTravelEnabled: enabled }));
}

export function createSaveState(snapshot: GameSnapshot) {
  const savedAt = new Date().toISOString();
  return {
    savedAt,
    json: serializeGameJson(snapshot, savedAt),
    binary: encodeCommanderBinary256(snapshot.commander),
    snapshot
  };
}

export function createFreshGameState() {
  const freshCommander = createDefaultCommander();
  return createInitialGameState(freshCommander);
}
