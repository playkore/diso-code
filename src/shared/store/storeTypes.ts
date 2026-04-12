import type { StateCreator } from 'zustand';
import type { EquipmentId, LaserId, LaserMountPosition } from '../../features/commander/domain/shipCatalog';
import type { GameSnapshot } from '../../features/persistence/domain/gamePersistence';
import type { AppTab, CommanderState, MarketState, PriorityState, TravelState, UiState, UniverseState } from './types';
export type { AppTab, CommanderState, MarketState, PriorityState, TravelState, UiState, UniverseState };

/**
 * Store contract overview
 * -----------------------
 *
 * This file defines the public shape of the Zustand store and the helper types
 * used by internal slices.
 *
 * If you want to understand what global state exists in the app and what the
 * rest of the UI is allowed to do, this is the top-level contract to read.
 */

/**
 * One persisted save-slot payload as stored in memory after loading from local
 * storage.
 */
export interface SaveState {
  savedAt: string;
  json: string;
  binary: Uint8Array;
  snapshot: GameSnapshot;
}

export type SaveSlotId = 1 | 2 | 3;

import type { TravelCompletionReport } from '../../features/travel/domain/travel';
export type { TravelCompletionReport };

/**
 * Full public store API exposed to the rest of the application.
 *
 * Data sections:
 * - `universe`: star-system position and economy context
 * - `commander`: player progression, cargo, equipment and money
 * - `market`: current docked market session
 * - `travelSession`: active route being flown, if any
 * - `priority`: one compact hidden goal surfaced in the status UI
 * - `ui`: lightweight UI preferences and recent messages
 * - `saveStates`: loaded save slots
 *
 * Action sections:
 * - navigation / settings
 * - travel lifecycle
 * - trading
 * - outfitting
 * - save/load/new game
 */
export interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  travelSession: TravelState | null;
  priority: PriorityState;
  ui: UiState;
  saveStates: Partial<Record<SaveSlotId, SaveState>>;
  setActiveTab: (tab: AppTab) => void;
  setStartScreenVisible: (visible: boolean) => void;
  setSelectedChartSystem: (systemName: string | null) => void;
  setInstantTravelEnabled: (enabled: boolean) => void;
  setShowTravelPerfOverlay: (enabled: boolean) => void;
  setPriority: (priority: PriorityState, options?: { announce?: boolean }) => void;
  acknowledgePriorityAnnouncement: () => void;
  grantDebugCredits: (amount: number) => void;
  grantCombatCredits: (amount: number) => void;
  beginTravel: (systemName: string) => boolean;
  cancelTravel: () => void;
  completeTravel: (report?: TravelCompletionReport) => void;
  dockAtSystem: (systemName: string) => void;
  buyFuel: (units: number) => void;
  buyCommodity: (commodityKey: string, amount: number) => void;
  sellCommodity: (commodityKey: string, amount: number) => void;
  buyEquipment: (equipmentId: EquipmentId) => void;
  buyLaser: (mount: LaserMountPosition, laserId: LaserId) => void;
  buyMissile: () => void;
  useGalacticHyperdrive: () => void;
  saveToSlot: (slotId: SaveSlotId) => void;
  loadFromSlot: (slotId: SaveSlotId) => void;
  startNewGame: () => void;
  resetAfterDeath: () => void;
}

/**
 * Helper type for authoring slices that plug into the root store.
 */
export type GameSlice<T> = StateCreator<GameStore, [], [], T>;
