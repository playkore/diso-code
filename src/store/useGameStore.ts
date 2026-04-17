import { createWithEqualityFn } from 'zustand/traditional';
import { createDefaultCommander } from '../features/commander/domain/commander';
import {
  createInitialGameState,
  getMostRecentSaveSlotId,
  loadPersistedSaveStates,
  loadPersistedActiveSaveSlotId,
  loadInstantTravelEnabled,
  loadTravelPerfOverlayEnabled,
  restoreSnapshot
} from '../shared/store/gameStateFactory';
import { createOutfittingSlice } from '../features/commander/store/outfittingSlice';
import { createSaveLoadSlice } from '../features/persistence/store/saveLoadSlice';
import { createTradeSlice } from '../features/market/store/tradeSlice';
import { createTravelSlice } from '../features/travel/store/travelSlice';
import type { GameStore } from '../shared/store/storeTypes';
import { createSettingsActions } from './useGameStoreActions';

export type { GameStore, SaveSlotId, SaveState, TravelCompletionReport } from '../shared/store/storeTypes';

export const useGameStore = createWithEqualityFn<GameStore>()((set, get, api) => {
  const initialCommander = createDefaultCommander();
  const fallbackState = createInitialGameState(initialCommander);
  const persistedSaveStates = loadPersistedSaveStates();
  const instantTravelEnabled = loadInstantTravelEnabled();
  const showTravelPerfOverlay = loadTravelPerfOverlayEnabled();
  const persistedActiveSaveSlotId = loadPersistedActiveSaveSlotId(persistedSaveStates);
  const bootSaveSlotId = persistedActiveSaveSlotId ?? getMostRecentSaveSlotId(persistedSaveStates);
  const bootSaveState = bootSaveSlotId ? persistedSaveStates[bootSaveSlotId] : null;
  const bootState = bootSaveState ? restoreSnapshot(bootSaveState.snapshot) : fallbackState;

  return {
    universe: bootState.universe,
    commander: bootState.commander,
    market: bootState.market,
    travelSession: null,
    saveStates: persistedSaveStates,
    activeSaveSlotId: bootSaveSlotId,
    ui: {
      activeTab: 'status',
      selectedChartSystem: null,
      compactMode: true,
      instantTravelEnabled,
      showTravelPerfOverlay,
      startScreenVisible: true,
      activityLog: []
    },
    ...createSettingsActions(set),
    ...createTravelSlice(set, get, api),
    ...createTradeSlice(set, get, api),
    ...createOutfittingSlice(set, get, api),
    ...createSaveLoadSlice(set, get, api)
  };
});
