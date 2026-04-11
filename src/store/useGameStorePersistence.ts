import { refreshItems } from '../shared/store/gameStateFactory';
import type { AppTab, CommanderState, MarketState, PriorityState, UniverseState } from '../shared/store/types';
import type { GameStore } from '../shared/store/storeTypes';

export interface PersistedDockedState {
  ui?: { activeTab?: AppTab };
  commander?: CommanderState;
  universe?: UniverseState;
  marketSession?: MarketState['session'];
  priority?: PriorityState;
  __isTravelling?: true;
}

export interface PersistedDockedEnvelope {
  state?: PersistedDockedState;
}

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}

/**
 * Local storage is wrapped once so the persistence rules are centralized:
 * travelling sessions should never overwrite the last good docked autosave.
 */
export const storageWrapper = {
  getItem: (name: string) => {
    const storage = getStorage();
    if (!storage) return null;
    const raw = storage.getItem(name);
    return raw ? JSON.parse(raw) : null;
  },
  setItem: (name: string, value: PersistedDockedEnvelope) => {
    const storage = getStorage();
    if (!storage) return;
    if (value.state && value.state.__isTravelling) {
      return;
    }
    storage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name: string) => {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(name);
  }
};

export function partializeDockedState(
  state: Pick<GameStore, 'travelSession' | 'ui' | 'commander' | 'universe' | 'market' | 'priority'>
): PersistedDockedState {
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
}

export function mergeDockedState(persistedState: unknown, currentState: GameStore) {
  if (!persistedState || typeof persistedState !== 'object') return currentState;
  const typedPersistedState = persistedState as PersistedDockedState;
  if (typedPersistedState.__isTravelling) return currentState;
  return {
    ...currentState,
    universe: typedPersistedState.universe ?? currentState.universe,
    commander: typedPersistedState.commander ?? currentState.commander,
    priority: typedPersistedState.priority ?? currentState.priority,
    market: typedPersistedState.marketSession ? refreshItems(typedPersistedState.marketSession) : currentState.market,
    ui: {
      ...currentState.ui,
      activeTab: typedPersistedState.ui?.activeTab ?? currentState.ui.activeTab
    }
  };
}
