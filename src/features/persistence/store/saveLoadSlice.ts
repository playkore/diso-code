import {
  createFreshGameState,
  createSaveState,
  createSnapshot,
  persistActiveSaveSlotId,
  persistSaveStates,
  restoreSnapshot
} from '../../../shared/store/gameStateFactory';
import { setUiMessage } from '../../../shared/store/uiMessages';
import type { GameSlice, GameStore } from '../../../shared/store/storeTypes';
import { formatCredits } from '../../../shared/utils/money';

export const createSaveLoadSlice: GameSlice<
  Pick<GameStore, 'saveToSlot' | 'loadFromSlot' | 'startNewGame' | 'resetAfterDeath'>
> = (set, get) => ({
  saveToSlot: (slotId) => {
    const state = get();
    // Slots store a full snapshot so loading can rebuild every docked subsystem
    // without replaying individual actions. The same helper is reused for the
    // automatic dock-save, so this function stays silent and idempotent.
    const snapshot = createSnapshot(state);
    const saveState = createSaveState(snapshot);
    const nextSaveStates = {
      ...state.saveStates,
      [slotId]: saveState
    };
    persistSaveStates(nextSaveStates);
    persistActiveSaveSlotId(slotId);
    set({
      saveStates: nextSaveStates,
      activeSaveSlotId: slotId
    });
  },
  loadFromSlot: (slotId) => {
    const state = get();
    const saveState = state.saveStates[slotId];
    if (!saveState) {
      return;
    }
    const restoredState = restoreSnapshot(saveState.snapshot);
    persistActiveSaveSlotId(slotId);
    set((current) => ({
      ...restoredState,
      // Travel sessions are intentionally transient and cannot survive a restore
      // because their mutable runtime state only exists in memory.
      travelSession: null,
      activeSaveSlotId: slotId,
      saveStates: state.saveStates,
      ui: setUiMessage(
        {
          ...current.ui,
          activeTab: 'market',
          selectedChartSystem: null,
          startScreenVisible: false
        },
        'info',
        `Slot ${slotId} loaded`,
        `Commander restored at ${saveState.snapshot.commander.currentSystem} with ${formatCredits(saveState.snapshot.commander.cash)}.`
      )
    }));
  },
  startNewGame: (slotId) => {
    const freshState = createFreshGameState();
    const snapshot = createSnapshot(freshState);
    const saveState = createSaveState(snapshot);
    const nextSaveStates = {
      ...get().saveStates,
      [slotId]: saveState
    };
    persistSaveStates(nextSaveStates);
    persistActiveSaveSlotId(slotId);
    // Starting a new run now skips all staged intro effects and swaps directly
    // to the freshly initialized docked state. The chosen slot becomes the
    // active autosave target immediately so the next station dock preserves it.
    set((state) => ({
      ...freshState,
      saveStates: nextSaveStates,
      activeSaveSlotId: slotId,
      // A new game always returns to the docked market tab with no active trip.
      travelSession: null,
      // The docked shell no longer renders a transient banner, so new-game
      // setup only resets navigation state here.
      ui: {
        ...state.ui,
        activeTab: 'market',
        selectedChartSystem: null,
        startScreenVisible: false
      }
    }));
  },
  resetAfterDeath: () => {
    const freshState = createFreshGameState();
    persistActiveSaveSlotId(null);
    set((state) => ({
      ...freshState,
      // Death without an escape pod mirrors the original game's trip back to
      // the title flow, so the attract gate is reopened over a fresh commander.
      travelSession: null,
      saveStates: state.saveStates,
      activeSaveSlotId: null,
      ui: {
        ...state.ui,
        activeTab: 'market',
        selectedChartSystem: null,
        startScreenVisible: true,
        latestEvent: undefined,
        activityLog: []
      }
    }));
  }
});
