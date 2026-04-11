import { createWithEqualityFn } from 'zustand/traditional';
import { persist } from 'zustand/middleware';
import { createDefaultCommander } from '../features/commander/domain/commander';
import {
  createInitialGameState,
  loadInstantTravelEnabled,
  loadPersistedSaveStates,
  loadTravelPerfOverlayEnabled,
  persistInstantTravelEnabled,
  persistTravelPerfOverlayEnabled,
  refreshItems
} from '../shared/store/gameStateFactory';
import { createOutfittingSlice } from '../features/commander/store/outfittingSlice';
import { createSaveLoadSlice } from '../features/persistence/store/saveLoadSlice';
import { createTradeSlice } from '../features/market/store/tradeSlice';
import { createTravelSlice } from '../features/travel/store/travelSlice';
import { syncPriorityProgress } from '../shared/store/priority';
import type { AppTab, GameStore, PriorityState } from '../shared/store/storeTypes';
import { createUiMessage, withUiMessage } from '../shared/store/uiMessages';

export type { GameStore, SaveSlotId, SaveState, TravelCompletionReport } from '../shared/store/storeTypes';

const storageWrapper = {
  getItem: (name: string) => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: (name: string, value: any) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    // If the partialize function flagged this as mid-travel, don't overwrite the good save!
    if (value.state && value.state.__isTravelling) {
      return;
    }
    window.localStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(name);
  }
};

export const useGameStore = createWithEqualityFn<GameStore>()(
  persist(
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

        setActiveTab: (tab: AppTab) => set((state: GameStore) => ({ ui: { ...state.ui, activeTab: tab } })),
        setStartScreenVisible: (visible: boolean) => set((state: GameStore) => ({ ui: { ...state.ui, startScreenVisible: visible } })),
        setNewGameBootVisible: (visible: boolean) => set((state: GameStore) => ({ ui: { ...state.ui, newGameBootVisible: visible } })),
        setNewGamePowerOnVisible: (visible: boolean) => set((state: GameStore) => ({ ui: { ...state.ui, newGamePowerOnVisible: visible } })),
        setSelectedChartSystem: (systemName: string | null) => set((state: GameStore) => ({ ui: { ...state.ui, selectedChartSystem: systemName } })),
        setInstantTravelEnabled: (enabled: boolean) =>
          set((state: GameStore) => {
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
        setPriority: (priority: PriorityState, options?: { announce?: boolean }) =>
          set(() => ({ priority: { ...priority, pendingAnnouncement: options?.announce ?? true } })),
        acknowledgePriorityAnnouncement: () =>
          set((state: GameStore) => ({ priority: { ...state.priority, pendingAnnouncement: false } })),
        setShowTravelPerfOverlay: (enabled: boolean) =>
          set((state: GameStore) => {
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

        ...createTravelSlice(set, get, api),
        ...createTradeSlice(set, get, api),
        ...createOutfittingSlice(set, get, api),
        ...createSaveLoadSlice(set, get, api)
      };
    },
    {
      name: 'diso-code:docked-session-v2',
      storage: storageWrapper,
      partialize: (state: any) => {
        if (state.travelSession) {
          return { __isTravelling: true };
        }
        return {
          ui: { activeTab: state.ui.activeTab },
          commander: state.commander,
          universe: state.universe,
          marketSession: state.market.session,
          priority: state.priority
        };
      },
      merge: (persistedState: any, currentState: any) => {
        if (!persistedState || persistedState.__isTravelling) return currentState;
        return {
          ...currentState,
          universe: persistedState.universe ?? currentState.universe,
          commander: persistedState.commander ?? currentState.commander,
          priority: persistedState.priority ?? currentState.priority,
          market: persistedState.marketSession ? refreshItems(persistedState.marketSession) : currentState.market,
          ui: {
            ...currentState.ui,
            activeTab: persistedState.ui?.activeTab ?? currentState.ui.activeTab
          }
        };
      }
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
