import type { StateCreator } from 'zustand';
import type { MissionExternalEvent } from '../domain/missions';
import type { EquipmentId, LaserId, LaserMountPosition } from '../domain/shipCatalog';
import type { GameSnapshot } from '../domain/gamePersistence';
import type { AppTab, CommanderState, MarketState, MissionsState, TravelState, UiState, UniverseState } from './types';

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

/**
 * Outcome object returned by the real-time travel screen when it hands control
 * back to the docked game.
 */
export interface TravelCompletionReport {
  outcome?: 'arrived' | 'rescued';
  dockSystemName?: string;
  spendJumpFuel?: boolean;
  legalValue?: number;
  tallyDelta?: number;
  missionEvents?: MissionExternalEvent[];
  cargo?: Record<string, number>;
  fuelDelta?: number;
  installedEquipment?: CommanderState['installedEquipment'];
  missilesInstalled?: number;
}

/**
 * Full public store API exposed to the rest of the application.
 *
 * Data sections:
 * - `universe`: star-system position and economy context
 * - `commander`: player progression, cargo, equipment and money
 * - `market`: current docked market session
 * - `missions`: current docked mission log
 * - `travelSession`: active route being flown, if any
 * - `ui`: lightweight UI preferences and recent messages
 * - `saveStates`: loaded save slots
 *
 * Action sections:
 * - navigation / settings
 * - travel lifecycle
 * - trading
 * - outfitting
 * - mission triggers
 * - save/load/new game
 */
export interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  missions: MissionsState;
  travelSession: TravelState | null;
  ui: UiState;
  saveStates: Partial<Record<SaveSlotId, SaveState>>;
  setActiveTab: (tab: AppTab) => void;
  setInstantTravelEnabled: (enabled: boolean) => void;
  grantDebugCredits: (amount: number) => void;
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
  triggerMissionExternalEvent: (event: MissionExternalEvent) => void;
  saveToSlot: (slotId: SaveSlotId) => void;
  loadFromSlot: (slotId: SaveSlotId) => void;
  startNewGame: () => void;
}

/**
 * Helper type for authoring slices that plug into the root store.
 */
export type GameSlice<T> = StateCreator<GameStore, [], [], T>;
