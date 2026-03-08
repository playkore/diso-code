import { create } from 'zustand';
import type {
  AppTab,
  CommanderState,
  MarketState,
  MissionsState,
  UiState,
  UniverseState
} from './types';

interface GameStore {
  universe: UniverseState;
  commander: CommanderState;
  market: MarketState;
  missions: MissionsState;
  ui: UiState;
  setActiveTab: (tab: AppTab) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  universe: {
    currentSystem: 'Lave',
    nearbySystems: ['Leesti', 'Diso', 'Zaonce', 'Reorte'],
    stardate: 3124
  },
  commander: {
    name: 'Cmdr. Nova',
    credits: 1000,
    fuel: 7,
    cargoCapacity: 20
  },
  market: {
    items: [
      { id: 'food', name: 'Food', price: 8, stock: 52 },
      { id: 'textiles', name: 'Textiles', price: 11, stock: 37 },
      { id: 'alloys', name: 'Alloys', price: 27, stock: 14 }
    ]
  },
  missions: {
    list: [
      {
        id: 'm1',
        title: 'Courier Packet',
        destination: 'Leesti',
        reward: 120,
        status: 'available'
      },
      {
        id: 'm2',
        title: 'Medical Drop',
        destination: 'Diso',
        reward: 260,
        status: 'active'
      }
    ]
  },
  ui: {
    activeTab: 'market',
    compactMode: true
  },
  setActiveTab: (tab) => set((state) => ({ ui: { ...state.ui, activeTab: tab } }))
}));
