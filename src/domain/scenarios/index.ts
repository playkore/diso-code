import { secretPackagesScenarioPlugin } from './secretPackagesScenario';
import type {
  GameEvent,
  PersistedScenarioState,
  ScenarioFlightContext,
  ScenarioFlightOverlay,
  ScenarioMissionPanel,
  ScenarioMissionPanelContext,
  ScenarioPlugin,
  ScenarioSeedContext,
  ScenarioToast
} from './types';

export type {
  GameEvent,
  PersistedScenarioState,
  ScenarioCollectibleEntity,
  ScenarioFlightContext,
  ScenarioFlightOverlay,
  ScenarioMissionPanel,
  ScenarioMissionPanelContext,
  ScenarioOutcome,
  ScenarioPlugin,
  ScenarioSeedContext,
  ScenarioToast
} from './types';

export const DEFAULT_SCENARIO_PLUGIN_ID = secretPackagesScenarioPlugin.id;

const SCENARIO_PLUGINS: Record<string, ScenarioPlugin<unknown>> = {
  [secretPackagesScenarioPlugin.id]: secretPackagesScenarioPlugin as ScenarioPlugin<unknown>
};

/**
 * Transient output produced while processing one scenario event.
 *
 * The reducer remains pure from the caller's point of view: plugin APIs append
 * intent here, and the caller decides how to surface the resulting toast or
 * overlay message in the application shell.
 */
export interface ScenarioDispatchResult {
  snapshot: PersistedScenarioState;
  toast?: ScenarioToast;
  travelMessage?: string;
}

function createToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getScenarioPlugin(pluginId: string | null) {
  if (!pluginId) {
    return null;
  }
  return SCENARIO_PLUGINS[pluginId] ?? null;
}

export function createScenarioSnapshot(seedContext: ScenarioSeedContext, pluginId = DEFAULT_SCENARIO_PLUGIN_ID): PersistedScenarioState {
  const plugin = getScenarioPlugin(pluginId);
  if (!plugin) {
    return {
      activePluginId: null,
      runtimeState: null
    };
  }
  return {
    activePluginId: plugin.id,
    runtimeState: plugin.createInitialState(seedContext)
  };
}

/**
 * Feeds one event through the active plugin, including any synthetic events the
 * plugin emits while handling that event.
 */
export function dispatchScenarioEvent(snapshot: PersistedScenarioState, event: GameEvent, seedContext: ScenarioSeedContext): ScenarioDispatchResult {
  const plugin = getScenarioPlugin(snapshot.activePluginId);
  if (!plugin) {
    return { snapshot };
  }
  let runtimeState = snapshot.runtimeState ?? plugin.createInitialState(seedContext);
  const pendingEvents: GameEvent[] = [event];
  let toast: ScenarioToast | undefined;
  let travelMessage: string | undefined;

  while (pendingEvents.length > 0) {
    const nextEvent = pendingEvents.shift()!;
    runtimeState = plugin.reduce(runtimeState, nextEvent, {
      pushTravelMessage(text) {
        travelMessage = text;
      },
      queueUiToast(title, body) {
        toast = {
          id: createToastId(),
          title,
          body
        };
      },
      emitSyntheticEvent(syntheticEvent) {
        pendingEvents.push(syntheticEvent);
      }
    });
  }

  return {
    snapshot: {
      activePluginId: snapshot.activePluginId,
      runtimeState
    },
    toast,
    travelMessage
  };
}

export function getScenarioMissionPanel(snapshot: PersistedScenarioState, context: ScenarioMissionPanelContext): ScenarioMissionPanel | null {
  const plugin = getScenarioPlugin(snapshot.activePluginId);
  if (!plugin || snapshot.runtimeState == null) {
    return null;
  }
  return plugin.getMissionPanel(snapshot.runtimeState, context);
}

export function getScenarioFlightOverlay(snapshot: PersistedScenarioState, context: ScenarioFlightContext): ScenarioFlightOverlay {
  const plugin = getScenarioPlugin(snapshot.activePluginId);
  if (!plugin || snapshot.runtimeState == null) {
    return {
      entities: []
    };
  }
  return plugin.getFlightOverlay(snapshot.runtimeState, context);
}
