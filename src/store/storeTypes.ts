import type { StateCreator } from 'zustand';
import type { MissionExternalEvent } from '../domain/missions';
import type { EquipmentId, LaserId, LaserMountPosition } from '../domain/shipCatalog';
import type { GameSnapshot } from '../domain/gamePersistence';
import type { AppTab, CommanderState, MarketState, MissionsState, TravelState, UiState, UniverseState } from './types';

export interface SaveState {
  savedAt: string;
  json: string;
  binary: Uint8Array;
  snapshot: GameSnapshot;
}

export type SaveSlotId = 1 | 2 | 3;

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

export type GameSlice<T> = StateCreator<GameStore, [], [], T>;
