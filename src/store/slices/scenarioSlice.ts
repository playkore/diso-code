import { createScenarioSnapshot, DEFAULT_SCENARIO_PLUGIN_ID, dispatchScenarioEvent } from '../../domain/scenarios';
import { createScenarioState } from '../gameStateFactory';
import { createUiMessage, withUiMessage } from '../uiMessages';
import type { GameSlice, GameStore } from '../storeTypes';

/**
 * Scenario slice
 * --------------
 *
 * Scenarios behave like lightweight plugins: they keep their own runtime state
 * and respond to generic game events, but only the slice is allowed to merge
 * their output back into global UI state. That keeps plugin effects explicit
 * and prevents scenarios from writing arbitrary store fields.
 */
export const createScenarioSlice: GameSlice<Pick<GameStore, 'startScenario' | 'dispatchGameEvent' | 'clearScenarioToast'>> = (set) => ({
  startScenario: (pluginId = DEFAULT_SCENARIO_PLUGIN_ID) =>
    set((state) => {
      const snapshot = createScenarioSnapshot({ currentSystem: state.universe.currentSystem }, pluginId);
      return {
        scenario: createScenarioState(snapshot, state.universe.currentSystem)
      };
    }),
  dispatchGameEvent: (event) =>
    set((state) => {
      if (!state.scenario.activePluginId) {
        return state;
      }
      const result = dispatchScenarioEvent(
        {
          activePluginId: state.scenario.activePluginId,
          runtimeState: state.scenario.runtimeState
        },
        event,
        { currentSystem: state.universe.currentSystem }
      );
      const nextScenario = {
        ...createScenarioState(result.snapshot, state.universe.currentSystem),
        lastToast: result.toast ?? state.scenario.lastToast
      };
      if (!result.toast) {
        return {
          scenario: nextScenario
        };
      }
      return {
        scenario: nextScenario,
        ui: withUiMessage(state.ui, createUiMessage('info', result.toast.title, result.toast.body))
      };
    }),
  clearScenarioToast: () =>
    set((state) => ({
      scenario: {
        ...state.scenario,
        lastToast: undefined
      }
    }))
});
