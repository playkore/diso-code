import { normalizeCommanderState } from '../../domain/commander';
import { createScenarioState, createDockedState, createArrivalState } from '../gameStateFactory';
import { dispatchScenarioEvent } from '../../domain/scenarios';
import { applyMissionEvent, evaluateDockingMissionState, getMissionCargoForActiveMissions, getMissionInbox, getMissionTravelContext, settleCompletedMissions } from '../../domain/missions';
import { getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../../domain/fuel';
import { getSystemDistance } from '../../domain/galaxyCatalog';
import { formatCredits } from '../../utils/money';
import { formatLightYears } from '../../utils/distance';
import { createUiMessage, withUiMessage } from '../uiMessages';
import type { GameSlice, GameStore } from '../storeTypes';

/**
 * Travel slice
 * ------------
 *
 * This slice owns route lifecycle and the commander updates that happen when a
 * travel segment begins or ends.
 *
 * It answers:
 * - can the player start a jump?
 * - should the route open the real-time flight screen or instant-arrive?
 * - how do salvage, fuel, legal changes and mission events get merged back?
 */
export const createTravelSlice: GameSlice<
  Pick<GameStore, 'grantDebugCredits' | 'grantCombatCredits' | 'beginTravel' | 'cancelTravel' | 'completeTravel' | 'dockAtSystem'>
> = (set, get) => ({
  /**
   * Debug-only helper used while balancing and UI-testing the economy.
   */
  grantDebugCredits: (amount) =>
    set((state) => {
      const credits = Math.max(0, Math.trunc(amount));
      if (credits < 1) {
        return state;
      }
      return {
        commander: {
          ...state.commander,
          cash: state.commander.cash + credits
        },
        ui: withUiMessage(state.ui, createUiMessage('success', 'Debug credits added', `${formatCredits(credits)} credited for debugging.`))
      };
    }),
  /**
   * Credits live combat rewards immediately so the travel HUD balance updates
   * as soon as the player destroys an eligible ship.
   */
  grantCombatCredits: (amount) =>
    set((state) => {
      const credits = Math.max(0, Math.trunc(amount));
      if (credits < 1) {
        return state;
      }
      return {
        commander: {
          ...state.commander,
          cash: state.commander.cash + credits
        }
      };
    }),
  /**
   * Starts travel to a nearby system if the commander has enough fuel.
   *
   * Return value:
   * - `true`: real-time travel segment should open
   * - `false`: travel did not start, or instant-travel already completed it
   */
  beginTravel: (systemName) => {
    const state = get();
    const isUndocking = systemName === state.universe.currentSystem;
    const distance = getSystemDistance(state.universe.currentSystem, systemName, state.universe.galaxyIndex);
    const jumpFuelCost = isUndocking ? 0 : getJumpFuelCost(distance);
    const jumpFuelUnits = isUndocking ? 0 : getJumpFuelUnits(distance);
    const availableFuelUnits = getFuelUnits(state.commander.fuel);
    if ((!isUndocking && !Number.isFinite(distance)) || (!isUndocking && jumpFuelUnits <= 0)) {
      return false;
    }
    if (jumpFuelUnits > availableFuelUnits) {
      set({
        ui: withUiMessage(
          state.ui,
          createUiMessage('error', `Insufficient fuel for ${systemName}`, `Jump needs ${formatLightYears(jumpFuelCost)} but only ${formatLightYears(state.commander.fuel)} remain.`)
        )
      });
      return false;
    }
    // Instant-travel mode skips the real-time flight screen entirely and
    // immediately performs the same docked arrival transition.
    if (state.ui.instantTravelEnabled) {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return false;
      }
      set({ ...nextState, travelSession: null });
      return false;
    }

      const missionContext = getMissionTravelContext(state.commander.activeMissions, {
        originSystem: state.universe.currentSystem,
        destinationSystem: systemName
      });
      set({
        commander: state.commander,
        travelSession: {
          originSystem: state.universe.currentSystem,
          destinationSystem: systemName,
          effectiveDestinationSystem: missionContext.effectiveDestinationSystem,
          fuelCost: jumpFuelCost,
          fuelUnits: jumpFuelUnits,
          // Undocking reuses the same travel session contract as hyperspace,
          // but it should present as a local launch rather than a destination jump.
          primaryObjectiveText: isUndocking ? `Undock from ${state.universe.currentSystem}.` : missionContext.primaryObjectiveText,
          missionContext
        }
      });
      get().dispatchGameEvent({
        type: 'travel:session-started',
        originSystem: state.universe.currentSystem,
        destinationSystem: systemName,
        effectiveDestinationSystem: missionContext.effectiveDestinationSystem
      });
    return true;
  },
  /**
   * Clears the in-progress route without applying any arrival effects.
   */
  cancelTravel: () => set({ travelSession: null }),

  /**
   * Merges the outcome of the real-time travel segment back into the main store.
   *
   * The travel screen reports:
   * - where the player ended up
   * - whether hyperspace fuel should be spent
   * - combat salvage / rescue effects
   * - legal/tally/mission changes
   *
   * This function converts that report into the normal docked game state.
   */
  completeTravel: (report) =>
    set((state) => {
      if (!state.travelSession) {
        return state;
      }

      // Rescue clears existing cargo before applying any explicitly preserved
      // salvage from the combat snapshot.
      const mergedCargo = report?.outcome === 'rescued' ? {} : { ...state.commander.cargo };
      for (const [commodityKey, amount] of Object.entries(report?.cargo ?? {})) {
        mergedCargo[commodityKey] = (mergedCargo[commodityKey] ?? 0) + Math.max(0, Math.trunc(amount));
      }
      const insurancePenalty = report?.outcome === 'rescued' ? Math.min(state.commander.cash, Math.max(250, Math.trunc(state.commander.cash * 0.1))) : 0;
      let missionCargo = report?.missionCargoDelta ?? state.commander.missionCargo;
      let scenarioSnapshot =
        report?.scenarioRuntimeState ?? {
          activePluginId: state.scenario.activePluginId,
          runtimeState: state.scenario.runtimeState
        };
      let scenarioToast = report?.scenarioLastToast ?? state.scenario.lastToast;

      const dockSystemName = report?.dockSystemName ?? state.travelSession.effectiveDestinationSystem;
      const spendJumpFuel = report?.spendJumpFuel ?? dockSystemName === state.travelSession.destinationSystem;
      // First, merge all direct commander deltas from the travel report.
      let commander = normalizeCommanderState({
        ...state.commander,
        // Live combat rewards already hit commander cash during flight, so
        // travel completion only needs to settle rescue-side penalties here.
        cash: state.commander.cash - insurancePenalty,
        legalValue: report?.legalValue ?? state.commander.legalValue,
        tally: state.commander.tally + (report?.tallyDelta ?? 0),
        combatRatingScore: state.commander.combatRatingScore + (report?.tallyDelta ?? 0),
        cargo: mergedCargo,
        missionCargo,
        fuel: state.commander.fuel + (report?.fuelDelta ?? 0),
        installedEquipment: report?.installedEquipment ?? state.commander.installedEquipment,
        missilesInstalled: report?.missilesInstalled ?? state.commander.missilesInstalled
      });
      let activeMissions = state.commander.activeMissions;
      if (report?.missionEvents?.length) {
        activeMissions = report.missionEvents.reduce((missions, event) => applyMissionEvent(missions, event), activeMissions);
      }

      // Finally choose the appropriate docked transition:
      // - rescue recovery
      // - normal destination arrival
      // - origin re-dock without fuel spend
      const nextState =
        report?.outcome === 'rescued'
          ? createDockedState({ ...state, commander }, dockSystemName, {
              spendJumpFuel,
              title: `Recovered at ${dockSystemName}`,
              body: `Escape pod recovery complete. Insurance docked you at ${dockSystemName} with cargo losses applied.`,
              stardateDelta: 1
            })
          : spendJumpFuel
            ? createArrivalState({ ...state, commander }, dockSystemName)
            : createDockedState({ ...state, commander }, dockSystemName, {
                spendJumpFuel: false,
                title: `Docked at ${dockSystemName}`,
                body: `Returned to ${dockSystemName} station without jumping. Fuel remains ${formatLightYears(commander.fuel)}.`,
                stardateDelta: 0
              });
      if (!nextState) {
        return {
          ...state,
          travelSession: null,
          ui: withUiMessage(state.ui, createUiMessage('error', 'Travel failed', 'The hyperspace solution collapsed before arrival.'))
        };
      }
      const dockingMissionEvents = evaluateDockingMissionState(activeMissions, { currentSystem: dockSystemName });
      if (dockingMissionEvents.length) {
        activeMissions = dockingMissionEvents.reduce((missions, event) => applyMissionEvent(missions, event), activeMissions);
      }
      if (scenarioSnapshot.activePluginId) {
        const arrivedResult = dispatchScenarioEvent(scenarioSnapshot, { type: 'travel:arrived-in-system', systemName: dockSystemName }, { currentSystem: dockSystemName });
        scenarioSnapshot = arrivedResult.snapshot;
        scenarioToast = arrivedResult.toast ?? scenarioToast;
        const dockedResult = dispatchScenarioEvent(scenarioSnapshot, { type: 'system:docked', systemName: dockSystemName }, { currentSystem: dockSystemName });
        scenarioSnapshot = dockedResult.snapshot;
        scenarioToast = dockedResult.toast ?? scenarioToast;
      }
      const settlement = settleCompletedMissions(activeMissions, state.commander.completedMissions);
      missionCargo = getMissionCargoForActiveMissions(settlement.activeMissions);
      return {
        ...nextState,
        commander: normalizeCommanderState({
          ...nextState.commander,
          cash: nextState.commander.cash + (report?.rewardDelta ?? 0) + settlement.cashDelta,
          activeMissions: settlement.activeMissions,
          completedMissions: settlement.completedMissions,
          missionCargo
        }),
        missions: {
          ...nextState.missions,
          activeMissionMessages: getMissionInbox(settlement.activeMissions, { currentSystem: dockSystemName })
        },
        scenario: {
          ...createScenarioState(scenarioSnapshot, dockSystemName),
          lastToast: scenarioToast
        },
        travelSession: null
      };
    }),

  /**
   * Debug/helper action that immediately docks the player at a target system.
   */
  dockAtSystem: (systemName) =>
    set((state) => {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return state;
      }
      return { ...nextState, travelSession: null };
    })
});
