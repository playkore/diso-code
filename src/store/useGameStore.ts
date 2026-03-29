import { create } from 'zustand';
import { createDefaultCommander } from '../domain/commander';
import {
  createInitialGameState,
  loadPersistedDockedSession,
  loadInstantTravelEnabled,
  loadPersistedSaveStates,
  loadTravelPerfOverlayEnabled,
  persistDockedSession,
  persistInstantTravelEnabled,
  persistTravelPerfOverlayEnabled
} from './gameStateFactory';
import { createOutfittingSlice } from './slices/outfittingSlice';
import { createSaveLoadSlice } from './slices/saveLoadSlice';
import { createTradeSlice } from './slices/tradeSlice';
import { createTravelSlice } from './slices/travelSlice';
import type { GameStore } from './storeTypes';
import { createUiMessage, withUiMessage } from './uiMessages';

export type { GameStore, SaveSlotId, SaveState, TravelCompletionReport } from './storeTypes';

/**
 * Reduces the docked portion of the store to the fields that define the
 * refresh-restorable session. Activity log chatter is intentionally excluded so
 * notification spam does not trigger extra writes.
 */
function getDockedSessionSignature(state: Pick<GameStore, 'commander' | 'universe' | 'market' | 'travelSession' | 'ui'>) {
  if (state.travelSession) {
    return null;
  }
  return JSON.stringify({
    activeTab: state.ui.activeTab,
    commander: state.commander,
    universe: state.universe,
    marketSession: state.market.session
  });
}

/**
 * Global application store
 * ------------------------
 *
 * This is the single source of truth for the docked game state:
 * - universe position / local economy
 * - commander state
 * - current docked market
 * - active travel session, if the player is in flight
 * - UI preferences and recent activity messages
 *
 * The public API remains flat for the rest of the app, but the implementation
 * is assembled from focused slices:
 * - travelSlice: route lifecycle and travel completion
 * - tradeSlice: commodity/fuel economy actions
 * - outfittingSlice: equipment, lasers and missiles
 * - saveLoadSlice: persistence and new game flow
 */
export const useGameStore = create<GameStore>((set, get, api) => {
  // Boot sequence:
  // 1. create a default commander
  // 2. derive the initial docked world state for that commander
  // 3. rehydrate persisted save slots and player settings
  const initialCommander = createDefaultCommander();
  const initialState = createInitialGameState(initialCommander);
  const persistedDockedSession = loadPersistedDockedSession();
  const persistedSaveStates = loadPersistedSaveStates();
  const instantTravelEnabled = loadInstantTravelEnabled();
  const showTravelPerfOverlay = loadTravelPerfOverlayEnabled();
  const bootState = persistedDockedSession?.restoredState ?? initialState;

  return {
    // Base state for a fresh session before any user actions occur.
    universe: bootState.universe,
    commander: bootState.commander,
    market: bootState.market,
    travelSession: null,
    saveStates: persistedSaveStates,
    ui: {
      activeTab: persistedDockedSession?.activeTab ?? 'market',
      selectedChartSystem: null,
      compactMode: true,
      instantTravelEnabled,
      showTravelPerfOverlay,
      activityLog: []
    },

    // Small UI-only helpers stay here rather than in their own slice because
    // they are stateless wrappers around `set`.
    setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } })),
    setSelectedChartSystem: (systemName) =>
      set((state) => ({
        ui: {
          ...state.ui,
          selectedChartSystem: systemName
        }
      })),
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
    setShowTravelPerfOverlay: (enabled) =>
      set((state) => {
        persistTravelPerfOverlayEnabled(enabled);
        return {
          ui: withUiMessage(
            { ...state.ui, showTravelPerfOverlay: enabled },
            createUiMessage(
              'info',
              enabled ? 'Travel perf overlay enabled' : 'Travel perf overlay disabled',
              enabled ? 'Space flight now shows a live frame and React commit overlay.' : 'Space flight hides the live performance overlay.'
            )
          )
        };
      }),

    // The flat public API is composed from internal slices to keep domain
    // responsibilities separate without making callers import multiple stores.
    ...createTravelSlice(set, get, api),
    ...createTradeSlice(set, get, api),
    ...createOutfittingSlice(set, get, api),
    ...createSaveLoadSlice(set, get, api)
  };
});

let lastDockedSessionSignature = getDockedSessionSignature(useGameStore.getState());

useGameStore.subscribe((state) => {
  const nextDockedSessionSignature = getDockedSessionSignature(state);
  if (!nextDockedSessionSignature || nextDockedSessionSignature === lastDockedSessionSignature) {
    return;
  }
  lastDockedSessionSignature = nextDockedSessionSignature;
  persistDockedSession(state);
});
