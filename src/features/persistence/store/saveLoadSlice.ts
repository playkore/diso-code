import { createDefaultCommander } from '../../commander/domain/commander';
import { createFreshGameState, createSaveState, createSnapshot, persistSaveStates, restoreSnapshot } from '../../../shared/store/gameStateFactory';
import { createDefaultPriority } from '../../../shared/store/priority';
import { createUiMessage, withUiMessage } from '../../../shared/store/uiMessages';
import type { GameSlice, GameStore } from '../../../shared/store/storeTypes';
import { formatCredits } from '../../../shared/utils/money';

export const createSaveLoadSlice: GameSlice<
  Pick<GameStore, 'saveToSlot' | 'loadFromSlot' | 'beginNewGameBoot' | 'startNewGame' | 'resetAfterDeath'>
> = (set, get) => ({
  saveToSlot: (slotId) => {
    const state = get();
    // Slots store a full snapshot so loading can rebuild every docked subsystem
    // without replaying individual actions.
    const snapshot = createSnapshot(state);
    const saveState = createSaveState(snapshot);
    const nextSaveStates = {
      ...state.saveStates,
      [slotId]: saveState
    };
    persistSaveStates(nextSaveStates);
    set((current) => ({
      saveStates: nextSaveStates,
      ui: withUiMessage(current.ui, createUiMessage('info', `Slot ${slotId} saved`, `Saved ${snapshot.commander.name} at ${snapshot.commander.currentSystem}.`))
    }));
  },
  loadFromSlot: (slotId) => {
    const state = get();
    const saveState = state.saveStates[slotId];
    if (!saveState) {
      return;
    }
    const restoredState = restoreSnapshot(saveState.snapshot);
      set((current) => ({
        ...restoredState,
        // Travel sessions are intentionally transient and cannot survive a restore
        // because their mutable runtime state only exists in memory.
        travelSession: null,
        saveStates: state.saveStates,
        ui: withUiMessage(
          {
            ...current.ui,
            activeTab: 'market',
            selectedChartSystem: null,
            startScreenVisible: false,
            newGameBootVisible: false,
            newGamePowerOnVisible: false
          },
          createUiMessage('info', `Slot ${slotId} loaded`, `Commander restored at ${saveState.snapshot.commander.currentSystem} with ${formatCredits(saveState.snapshot.commander.cash)}.`)
        )
      }));
  },
  beginNewGameBoot: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        startScreenVisible: false,
        newGameBootVisible: true,
        newGamePowerOnVisible: false,
        latestEvent: undefined,
        activityLog: []
      }
    })),
  startNewGame: () => {
    createDefaultCommander();
    const freshState = createFreshGameState();
    set((state) => ({
      ...freshState,
      // A new game always returns to the docked market tab with no active trip.
      travelSession: null,
      priority: createDefaultPriority(freshState.commander.cash),
      ui: withUiMessage(
        {
          ...state.ui,
          activeTab: 'market',
          selectedChartSystem: null,
          startScreenVisible: false,
          newGameBootVisible: false,
          newGamePowerOnVisible: true
        },
        createUiMessage('info', 'New game started', 'Fresh commander created. Save when you want to overwrite Slot 1.')
      )
    }));
  },
  resetAfterDeath: () => {
    const freshState = createFreshGameState();
    set((state) => ({
      ...freshState,
      // Death without an escape pod mirrors the original game's trip back to
      // the title flow, so the attract gate is reopened over a fresh commander.
      travelSession: null,
      saveStates: state.saveStates,
      ui: {
        ...state.ui,
        activeTab: 'market',
        selectedChartSystem: null,
        startScreenVisible: true,
        newGameBootVisible: false,
        newGamePowerOnVisible: false,
        latestEvent: undefined,
        activityLog: []
      }
    }));
  }
});
