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

/**
 * Global application store
 * ------------------------
 *
 * This is the single source of truth for the docked game state:
 * - universe position / local economy
 * - commander state
 * - current docked market
 * - mission log
 * - active travel session, if the player is in flight
 * - UI preferences and recent activity messages
 *
 * The public API remains flat for the rest of the app, but the implementation
 * is assembled from focused slices:
 * - travelSlice: route lifecycle and travel completion
 * - tradeSlice: commodity/fuel economy actions
 * - outfittingSlice: equipment, lasers and missiles
 * - missionSlice: external mission progress events
 * - saveLoadSlice: persistence and new game flow
 */
export const useGameStore = create<GameStore>((set, get, api) => {
  // Boot sequence:
  // 1. create a default commander
  // 2. derive the initial docked world state for that commander
  // 3. rehydrate persisted save slots and player settings
  const initialCommander = createDefaultCommander();
  const initialState = createInitialGameState(initialCommander);
  const persistedSaveStates = loadPersistedSaveStates();
  const instantTravelEnabled = loadInstantTravelEnabled();

  return {
    // Base state for a fresh session before any user actions occur.
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

    // Small UI-only helpers stay here rather than in their own slice because
    // they are stateless wrappers around `set`.
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

    // The flat public API is composed from internal slices to keep domain
    // responsibilities separate without making callers import multiple stores.
    ...createTravelSlice(set, get, api),
    ...createTradeSlice(set, get, api),
    ...createOutfittingSlice(set, get, api),
    ...createMissionSlice(set, get, api),
    ...createSaveLoadSlice(set, get, api)
  };
});
