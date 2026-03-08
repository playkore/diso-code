export interface UniverseState {
  currentSystem: string;
  nearbySystems: string[];
  stardate: number;
}

export interface CommanderState {
  name: string;
  credits: number;
  fuel: number;
  cargoCapacity: number;
}

export interface MarketItem {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface MarketState {
  items: MarketItem[];
  selectedCommodityId?: string;
}

export interface Mission {
  id: string;
  title: string;
  destination: string;
  reward: number;
  status: 'available' | 'active' | 'completed';
}

export interface MissionsState {
  list: Mission[];
}

export interface UiState {
  activeTab: AppTab;
  compactMode: boolean;
}

export type AppTab =
  | 'market'
  | 'inventory'
  | 'galaxy'
  | 'system-data'
  | 'missions'
  | 'save-load';
