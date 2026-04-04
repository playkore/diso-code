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

/**
 * One hidden long-term system goal exposed to the player only as a compact
 * status-line priority rather than as a full quest log.
 */
export interface PriorityState {
  label: string;
  targetCredits: number;
  baselineCredits: number;
  progressCredits: number;
  pendingAnnouncement: boolean;
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
  newGameBootVisible: boolean;
  newGamePowerOnVisible: boolean;
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
