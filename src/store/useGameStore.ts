import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { createDefaultCommander } from '../features/commander/domain/commander';
import {
  createInitialGameState,
  loadPersistedSaveStates,
  loadInstantTravelEnabled,
  loadTravelPerfOverlayEnabled
} from '../shared/store/gameStateFactory';
import { createOutfittingSlice } from '../features/commander/store/outfittingSlice';
import { createSaveLoadSlice } from '../features/persistence/store/saveLoadSlice';
import { createTradeSlice } from '../features/market/store/tradeSlice';
import { createTravelSlice } from '../features/travel/store/travelSlice';
import { syncPriorityProgress } from '../shared/store/priority';
import type { GameStore } from '../shared/store/storeTypes';
import { createSettingsActions } from './useGameStoreActions';
import {
  type PersistedDockedState,
  mergeDockedState,
  partializeDockedState,
  storageWrapper
} from './useGameStorePersistence';

export type { GameStore, SaveSlotId, SaveState, TravelCompletionReport } from '../shared/store/storeTypes';

export const useGameStore = createWithEqualityFn<GameStore>()(
  persist<GameStore, [], [], PersistedDockedState>(
    (set, get, api) => {
      const initialCommander = createDefaultCommander();
      const bootState = createInitialGameState(initialCommander);
      const persistedSaveStates = loadPersistedSaveStates();
      const instantTravelEnabled = loadInstantTravelEnabled();
      const showTravelPerfOverlay = loadTravelPerfOverlayEnabled();

      return {
        universe: bootState.universe,
        commander: bootState.commander,
        market: bootState.market,
        travelSession: null,
        priority: bootState.priority,
        saveStates: persistedSaveStates,
        ui: {
          activeTab: 'market',
          selectedChartSystem: null,
          compactMode: true,
          instantTravelEnabled,
          showTravelPerfOverlay,
          startScreenVisible: true,
          newGameBootVisible: false,
          newGamePowerOnVisible: false,
          activityLog: []
        },
        ...createSettingsActions(set),
        ...createTravelSlice(set, get, api),
        ...createTradeSlice(set, get, api),
        ...createOutfittingSlice(set, get, api),
        ...createSaveLoadSlice(set, get, api)
      };
    },
    {
      name: 'diso-code:docked-session-v2',
      storage: storageWrapper,
      partialize: partializeDockedState,
      merge: mergeDockedState
    }
  )
);

useGameStore.subscribe((state) => {
  const syncedPriority = syncPriorityProgress(state.priority, state.commander.cash);
  if (syncedPriority.progressCredits === state.priority.progressCredits) {
    return;
  }
  useGameStore.setState({ priority: syncedPriority });
});
