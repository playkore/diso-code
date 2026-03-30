import type { CommanderState as DomainCommanderState } from '../domain/commander';
import type { MissionTravelContext } from '../domain/missionContext';
import type { DockedMarketSession, MarketCommodity } from '../domain/market';

export interface UniverseState {
  galaxyIndex: number;
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

export interface TravelState {
  originSystem: string;
  destinationSystem: string;
  effectiveDestinationSystem: string;
  fuelCost: number;
  fuelUnits: number;
  primaryObjectiveText: string;
  missionContext: MissionTravelContext;
}

export interface UiState {
  activeTab: AppTab;
  selectedChartSystem: string | null;
  compactMode: boolean;
  instantTravelEnabled: boolean;
  showTravelPerfOverlay: boolean;
  startScreenVisible: boolean;
  latestEvent?: UiMessage;
  activityLog: UiMessage[];
}

export type AppTab =
  | 'market'
  | 'equipment'
  | 'status'
  | 'system-data'
  | 'short-range-chart'
  | 'galaxy-chart';
