import type { CommanderState as DomainCommanderState } from '../domain/commander';
import type { DockedMarketSession, MarketCommodity } from '../domain/market';
import type { MissionMessage } from '../domain/missions';

export interface UniverseState {
  currentSystem: string;
  nearbySystems: string[];
  stardate: number;
  economy: number;
  marketFluctuation: number;
}

export type CommanderState = DomainCommanderState;

export interface MarketState {
  session: DockedMarketSession;
  items: MarketCommodity[];
  selectedCommodityId?: string;
}

export interface UiMessage {
  id: string;
  tone: 'info' | 'success' | 'error';
  title: string;
  body: string;
}

export interface MissionsState {
  missionLog: MissionMessage[];
}

export interface TravelState {
  originSystem: string;
  destinationSystem: string;
  fuelCost: number;
  fuelUnits: number;
}

export interface UiState {
  activeTab: AppTab;
  compactMode: boolean;
  latestEvent?: UiMessage;
  activityLog: UiMessage[];
}

export type AppTab =
  | 'market'
  | 'inventory'
  | 'system-data'
  | 'star-map'
  | 'missions'
  | 'save-load';
