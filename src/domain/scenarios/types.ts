/**
 * Scenario plugin contracts
 * -------------------------
 *
 * Scenarios are "game mode" extensions that layer on top of the base docked
 * and travel simulation without taking arbitrary write access to the store.
 *
 * The contract deliberately separates:
 * - event reduction (`reduce`) for persistent progress
 * - mission-panel projection for docked UI
 * - flight-overlay projection for travel HUD/world rendering
 *
 * That split keeps scenario state testable and lets the rest of the app treat
 * scenario output as plain data rather than plugin-owned UI components.
 */

export type GameEvent =
  | {
      type: 'travel:session-started';
      originSystem: string;
      destinationSystem: string;
      effectiveDestinationSystem: string;
    }
  | {
      type: 'travel:arrived-in-system';
      systemName: string;
    }
  | {
      type: 'flight:tick';
      dt: number;
      elapsedMs: number;
      systemName: string;
      phase: string;
    }
  | {
      type: 'flight:player-moved';
      systemName: string;
      x: number;
      y: number;
      angle: number;
      phase: string;
    }
  | {
      type: 'flight:collectible-picked';
      collectibleId: string;
      systemName: string;
    }
  | {
      type: 'system:docked';
      systemName: string;
    };

export interface ScenarioToast {
  id: string;
  title: string;
  body: string;
}

export interface ScenarioCollectibleEntity {
  id: string;
  kind: 'package';
  x: number;
  y: number;
  heading: number;
  spinPhase: number;
  pickupRadius: number;
  collected: boolean;
}

export interface ScenarioFlightOverlay {
  directionHint?: {
    angleRelativeToPlayer: number;
    active: boolean;
  };
  entities: ScenarioCollectibleEntity[];
  statusLine?: string;
}

export interface ScenarioMissionPanel {
  title: string;
  progressLabel: string;
  status: 'active' | 'completed';
  summary: string;
  detailLines: string[];
}

export interface ScenarioOutcome {
  completed: boolean;
  summary: string;
}

export interface ScenarioSeedContext {
  currentSystem: string;
}

export interface ScenarioMissionPanelContext {
  currentSystem: string;
}

export interface ScenarioFlightContext {
  currentSystem: string;
  player: {
    x: number;
    y: number;
    angle: number;
  };
  station?: {
    x: number;
    y: number;
  };
  phase: string;
}

export interface ScenarioApi {
  pushTravelMessage(text: string): void;
  queueUiToast(title: string, body: string): void;
  emitSyntheticEvent(event: GameEvent): void;
}

export interface ScenarioPlugin<TState> {
  id: string;
  title: string;
  version: string;
  createInitialState(context: ScenarioSeedContext): TState;
  reduce(state: TState, event: GameEvent, api: ScenarioApi): TState;
  getFlightOverlay(state: TState, context: ScenarioFlightContext): ScenarioFlightOverlay;
  getMissionPanel(state: TState, context: ScenarioMissionPanelContext): ScenarioMissionPanel | null;
  getCompletion(state: TState): ScenarioOutcome | null;
}

/**
 * Persistent slice of scenario state stored in saves and autosaves.
 *
 * Derived UI projections such as mission panels and transient toasts are kept
 * outside this payload so save files remain compact and deterministic.
 */
export interface PersistedScenarioState {
  activePluginId: string | null;
  runtimeState: unknown | null;
}
