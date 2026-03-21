import { applyLegalFloor, normalizeCommanderState } from '../../domain/commander';
import { applyMissionExternalEvent } from '../../domain/missions';
import { getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../../domain/fuel';
import { getSystemDistance } from '../../domain/galaxyCatalog';
import { formatCredits } from '../../utils/money';
import { formatLightYears } from '../../utils/distance';
import { createArrivalState, createDockedState } from '../gameStateFactory';
import { createUiMessage, withUiMessage } from '../uiMessages';
import type { GameSlice, GameStore } from '../storeTypes';

export const createTravelSlice: GameSlice<
  Pick<GameStore, 'grantDebugCredits' | 'beginTravel' | 'cancelTravel' | 'completeTravel' | 'dockAtSystem'>
> = (set, get) => ({
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
  beginTravel: (systemName) => {
    const state = get();
    const distance = getSystemDistance(state.universe.currentSystem, systemName);
    const jumpFuelCost = getJumpFuelCost(distance);
    const jumpFuelUnits = getJumpFuelUnits(distance);
    const availableFuelUnits = getFuelUnits(state.commander.fuel);
    if (!Number.isFinite(distance) || jumpFuelUnits <= 0) {
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
    if (state.ui.instantTravelEnabled) {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return false;
      }
      set({ ...nextState, travelSession: null });
      return false;
    }

    const commander = {
      ...state.commander,
      legalValue: applyLegalFloor(state.commander.legalValue, state.commander.cargo)
    };
    set({
      commander,
      travelSession: {
        originSystem: state.universe.currentSystem,
        destinationSystem: systemName,
        fuelCost: jumpFuelCost,
        fuelUnits: jumpFuelUnits
      }
    });
    return true;
  },
  cancelTravel: () => set({ travelSession: null }),
  completeTravel: (report) =>
    set((state) => {
      if (!state.travelSession) {
        return state;
      }
      const mergedCargo = report?.outcome === 'rescued' ? {} : { ...state.commander.cargo };
      for (const [commodityKey, amount] of Object.entries(report?.cargo ?? {})) {
        mergedCargo[commodityKey] = (mergedCargo[commodityKey] ?? 0) + Math.max(0, Math.trunc(amount));
      }
      const insurancePenalty = report?.outcome === 'rescued' ? Math.min(state.commander.cash, Math.max(250, Math.trunc(state.commander.cash * 0.1))) : 0;

      let commander = normalizeCommanderState({
        ...state.commander,
        cash: state.commander.cash - insurancePenalty,
        legalValue: report?.legalValue ?? state.commander.legalValue,
        tally: state.commander.tally + (report?.tallyDelta ?? 0),
        cargo: mergedCargo,
        fuel: state.commander.fuel + (report?.fuelDelta ?? 0),
        installedEquipment: report?.installedEquipment ?? state.commander.installedEquipment,
        missilesInstalled: report?.missilesInstalled ?? state.commander.missilesInstalled
      });
      if (report?.missionEvents?.length) {
        const progress = report.missionEvents.reduce((current, event) => applyMissionExternalEvent(current, event), {
          tp: commander.missionTP,
          variant: commander.missionVariant
        });
        commander = normalizeCommanderState({
          ...commander,
          missionTP: progress.tp
        });
      }

      const dockSystemName = report?.dockSystemName ?? state.travelSession.destinationSystem;
      const spendJumpFuel = report?.spendJumpFuel ?? dockSystemName === state.travelSession.destinationSystem;
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
      return { ...nextState, travelSession: null };
    }),
  dockAtSystem: (systemName) =>
    set((state) => {
      const nextState = createArrivalState(state, systemName);
      if (!nextState) {
        return state;
      }
      return { ...nextState, travelSession: null };
    })
});
