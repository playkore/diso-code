import { createUiMessage, withUiMessage } from '../shared/store/uiMessages';
import { persistInstantTravelEnabled, persistTravelPerfOverlayEnabled } from '../shared/store/gameStateFactory';
import type { AppTab, GameStore, PriorityState } from '../shared/store/storeTypes';

type StoreSetter = (
  partial: Partial<GameStore> | ((state: GameStore) => Partial<GameStore> | GameStore),
  replace?: boolean
) => void;

/**
 * Settings-related actions are grouped separately from the travel and economy
 * slice methods so the root store assembly reads as a composition of concerns
 * instead of one long action list.
 */
export function createSettingsActions(set: StoreSetter) {
  return {
    setActiveTab: (tab: AppTab) => set((state: GameStore) => ({ ui: { ...state.ui, activeTab: tab } })),
    setStartScreenVisible: (visible: boolean) => set((state: GameStore) => ({ ui: { ...state.ui, startScreenVisible: visible } })),
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
      })
  };
}
