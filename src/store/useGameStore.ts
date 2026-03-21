import { create } from 'zustand';
import { createDefaultCommander } from '../domain/commander';
import { createInitialGameState, loadInstantTravelEnabled, loadPersistedSaveStates, persistInstantTravelEnabled } from './gameStateFactory';
import { createMissionSlice } from './slices/missionSlice';
import { createOutfittingSlice } from './slices/outfittingSlice';
import { createSaveLoadSlice } from './slices/saveLoadSlice';
import { createTradeSlice } from './slices/tradeSlice';
import { createTravelSlice } from './slices/travelSlice';
import type { GameStore } from './storeTypes';
import { createUiMessage, withUiMessage } from './uiMessages';

export type { GameStore, SaveSlotId, SaveState, TravelCompletionReport } from './storeTypes';

export const useGameStore = create<GameStore>((set, get, api) => {
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
    ...createTravelSlice(set, get, api),
    ...createTradeSlice(set, get, api),
    ...createOutfittingSlice(set, get, api),
    ...createMissionSlice(set, get, api),
    ...createSaveLoadSlice(set, get, api)
  };
});
