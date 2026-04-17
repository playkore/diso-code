import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultCommander, normalizeCommanderState } from '../../features/commander/domain/commander';
import { getJumpFuelCost } from '../../shared/domain/fuel';
import { getGalaxySystems, getNearbySystemNames, getStartingSystemName, getSystemDistance } from '../../features/galaxy/domain/galaxyCatalog';
import { createDefaultMissionTravelContext } from '../../features/travel/domain/missionContext';
import {
  ACTIVE_SAVE_SLOT_STORAGE_KEY,
  SAVE_SLOT_STORAGE_KEY,
  loadPersistedActiveSaveSlotId
} from '../../shared/store/gameStateFactory';
import { useGameStore } from '../useGameStore';

const STARTING_SYSTEM = getStartingSystemName(0);
const STARTING_NEARBY_SYSTEMS = getNearbySystemNames(STARTING_SYSTEM, 0);
const TRAVEL_SYSTEM = STARTING_NEARBY_SYSTEMS[0] ?? STARTING_SYSTEM;
const SECOND_TRAVEL_SYSTEM = STARTING_NEARBY_SYSTEMS[1] ?? getGalaxySystems(0)[1]?.data.name ?? TRAVEL_SYSTEM;
const HIGH_TECH_SYSTEM = getGalaxySystems(0).find((system) => system.data.techLevel >= 12 && system.data.name !== STARTING_SYSTEM)?.data.name ?? STARTING_SYSTEM;

describe('outfitting store flows', () => {
  const createLocalStorageMock = () => {
    const storage = new Map<string, string>();
    return {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      }
    };
  };

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: createLocalStorageMock() }
    });
    const commander = normalizeCommanderState(createDefaultCommander());
    useGameStore.setState((state) => ({
      ...state,
      saveStates: {},
      activeSaveSlotId: null,
      commander,
      universe: {
        ...state.universe,
        galaxyIndex: 0,
        currentSystem: commander.currentSystem,
        nearbySystems: STARTING_NEARBY_SYSTEMS,
        stardate: 3124,
        economy: 5,
        marketFluctuation: 0
      },
      travelSession: null,
      ui: {
        ...state.ui,
        activeTab: 'status',
        instantTravelEnabled: false
      }
    }));
  });

  it('buys equipment, lasers, and missiles with store-side checks', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: HIGH_TECH_SYSTEM, cash: 120000 }),
      universe: { ...state.universe, currentSystem: HIGH_TECH_SYSTEM }
    }));
    useGameStore.getState().buyEquipment('ecm');
    expect(useGameStore.getState().commander.installedEquipment.ecm).toBe(true);
    useGameStore.getState().buyEquipment('fuel_scoops');
    expect(useGameStore.getState().commander.installedEquipment.fuel_scoops).toBe(true);
    useGameStore.getState().buyLaser('rear', 'beam_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBe('beam_laser');
    useGameStore.getState().buyMissile();
    expect(useGameStore.getState().commander.missilesInstalled).toBe(1);
  });

  it('autosaves fuel purchases into the active slot', () => {
    useGameStore.getState().startNewGame(1);
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...state.commander,
        fuel: 2
      })
    }));
    const beforeFuel = useGameStore.getState().commander.fuel;

    useGameStore.getState().buyFuel(1);

    expect(useGameStore.getState().saveStates[1]?.snapshot.commander.fuel).toBeGreaterThan(beforeFuel);
    expect(window.localStorage.getItem(ACTIVE_SAVE_SLOT_STORAGE_KEY)).toBe('1');
    expect(window.localStorage.getItem(SAVE_SLOT_STORAGE_KEY)).not.toBeNull();
  });

  it('removes commodity trading actions from the store surface', () => {
    const storeState = useGameStore.getState() as unknown as Record<string, unknown>;
    expect(storeState.buyCommodity).toBeUndefined();
    expect(storeState.sellCommodity).toBeUndefined();
  });

  it('autosaves outfitting purchases into the active slot', () => {
    useGameStore.getState().startNewGame(1);
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: HIGH_TECH_SYSTEM,
        cash: 120000
      }),
      universe: { ...state.universe, currentSystem: HIGH_TECH_SYSTEM }
    }));

    useGameStore.getState().buyEquipment('ecm');

    expect(useGameStore.getState().saveStates[1]?.snapshot.commander.installedEquipment.ecm).toBe(true);
    expect(useGameStore.getState().saveStates[1]?.snapshot.commander.currentSystem).toBe(HIGH_TECH_SYSTEM);
  });

  it('adds debug credits from settings helpers', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: STARTING_SYSTEM, cash: 100 }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM }
    }));
    useGameStore.getState().grantDebugCredits(100000);
    expect(useGameStore.getState().commander.cash).toBe(100100);
  });

  it('rejects low-tech and duplicate outfitting purchases', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: HIGH_TECH_SYSTEM,
        cash: 20000,
        installedEquipment: { ...createDefaultCommander().installedEquipment, ecm: true }
      }),
      universe: { ...state.universe, currentSystem: HIGH_TECH_SYSTEM }
    }));
    useGameStore.getState().buyEquipment('ecm');
    expect(useGameStore.getState().commander.installedEquipment.ecm).toBe(true);
    useGameStore.getState().buyLaser('rear', 'military_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBeNull();
  });

  it('rejects retired shield, energy, and cargo upgrades', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: HIGH_TECH_SYSTEM, cash: 120000 }),
      universe: { ...state.universe, currentSystem: HIGH_TECH_SYSTEM }
    }));

    useGameStore.getState().buyEquipment('shield_generator');
    useGameStore.getState().buyEquipment('energy_box_3');
    useGameStore.getState().buyEquipment('large_cargo_bay');

    expect(useGameStore.getState().commander.installedEquipment.shield_generator).toBe(false);
    expect(useGameStore.getState().commander.installedEquipment.energy_box_3).toBe(false);
    expect(useGameStore.getState().commander.installedEquipment.large_cargo_bay).toBe(false);
    expect(useGameStore.getState().commander.cargoCapacity).toBe(createDefaultCommander().cargoCapacity);
  });

  it('lets the player redock at the origin without spending fuel', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: STARTING_SYSTEM, spendJumpFuel: false });
    expect(useGameStore.getState().commander.currentSystem).toBe(STARTING_SYSTEM);
    expect(useGameStore.getState().commander.fuel).toBe(startingFuel);
  });

  it('spends fuel only after docking in the destination system', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    const expectedFuel = startingFuel - getJumpFuelCost(getSystemDistance(STARTING_SYSTEM, TRAVEL_SYSTEM, 0));
    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: TRAVEL_SYSTEM, spendJumpFuel: true });
    expect(useGameStore.getState().commander.currentSystem).toBe(TRAVEL_SYSTEM);
    expect(useGameStore.getState().commander.fuel).toBe(expectedFuel);
  });

  it('does not mutate legal status simply by launching with contraband', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: STARTING_SYSTEM,
        legalValue: 0,
        cargo: { narcotics: 2, firearms: 1 }
      }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM }
    }));

    expect(useGameStore.getState().commander.legalValue).toBe(0);
    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    expect(useGameStore.getState().commander.legalValue).toBe(0);
  });

  it('halves legal value across a successful jump when no contraband floor applies', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: STARTING_SYSTEM,
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM }
    }));

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: TRAVEL_SYSTEM, spendJumpFuel: true });
    expect(useGameStore.getState().commander.currentSystem).toBe(TRAVEL_SYSTEM);
    expect(useGameStore.getState().commander.legalValue).toBe(10);
  });

  it('does not decay legal value when the player only redocks at the origin', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: STARTING_SYSTEM,
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM }
    }));

    expect(useGameStore.getState().beginTravel(STARTING_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: STARTING_SYSTEM, spendJumpFuel: false });
    expect(useGameStore.getState().commander.legalValue).toBe(20);
  });

  it('ignores retired contraband cargo when settling post-jump legal value', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: STARTING_SYSTEM,
        legalValue: 2,
        cargo: { narcotics: 2, firearms: 1 }
      }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM }
    }));

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: TRAVEL_SYSTEM, spendJumpFuel: true });
    expect(useGameStore.getState().commander.legalValue).toBe(1);
  });

  it('applies the same legal decay rule in instant-travel mode', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: STARTING_SYSTEM,
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM },
      ui: {
        ...state.ui,
        instantTravelEnabled: true
      }
    }));

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(false);
    expect(useGameStore.getState().commander.currentSystem).toBe(TRAVEL_SYSTEM);
    expect(useGameStore.getState().commander.legalValue).toBe(10);
  });

  it('still opens the travel session for undocking when instant travel is enabled', () => {
    useGameStore.setState((state) => ({
      ...state,
      universe: { ...state.universe, currentSystem: STARTING_SYSTEM },
      ui: {
        ...state.ui,
        instantTravelEnabled: true
      }
    }));

    expect(useGameStore.getState().beginTravel(STARTING_SYSTEM)).toBe(true);
    expect(useGameStore.getState().travelSession?.originSystem).toBe(STARTING_SYSTEM);
    expect(useGameStore.getState().travelSession?.destinationSystem).toBe(STARTING_SYSTEM);
    expect(useGameStore.getState().commander.currentSystem).toBe(STARTING_SYSTEM);
  });

  it('credits combat rewards immediately through the travel slice helper', () => {
    const startingCash = useGameStore.getState().commander.cash;
    useGameStore.getState().grantCombatCredits(710);
    expect(useGameStore.getState().commander.cash).toBe(startingCash + 710);
  });

  it('persists the active slot id and boots from that slot after reload', async () => {
    useGameStore.getState().startNewGame(2);
    expect(window.localStorage.getItem(ACTIVE_SAVE_SLOT_STORAGE_KEY)).toBe('2');

    expect(useGameStore.getState().beginTravel(SECOND_TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: SECOND_TRAVEL_SYSTEM, spendJumpFuel: true });
    expect(useGameStore.getState().saveStates[2]?.snapshot.commander.currentSystem).toBe(SECOND_TRAVEL_SYSTEM);
    expect(loadPersistedActiveSaveSlotId(useGameStore.getState().saveStates)).toBe(2);

    vi.resetModules();
    const { useGameStore: reloadedStore } = await import('../useGameStore');
    expect(reloadedStore.getState().activeSaveSlotId).toBe(2);
    expect(reloadedStore.getState().commander.currentSystem).toBe(SECOND_TRAVEL_SYSTEM);
  });

  it('stores selected chart systems separately from the current system and clears them after travel', () => {
    useGameStore.getState().setSelectedChartSystem(SECOND_TRAVEL_SYSTEM);
    expect(useGameStore.getState().ui.selectedChartSystem).toBe(SECOND_TRAVEL_SYSTEM);

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: TRAVEL_SYSTEM, spendJumpFuel: true });

    expect(useGameStore.getState().ui.selectedChartSystem).toBeNull();
  });

  it('resets to a fresh commander and reopens the start gate after death without an escape pod', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: TRAVEL_SYSTEM,
        cash: 4242,
        fuel: 3.2,
        cargo: { food: 4 }
      }),
      universe: {
        ...state.universe,
        currentSystem: TRAVEL_SYSTEM,
        nearbySystems: [STARTING_SYSTEM]
      },
      travelSession: {
        originSystem: STARTING_SYSTEM,
        destinationSystem: TRAVEL_SYSTEM,
        effectiveDestinationSystem: TRAVEL_SYSTEM,
        fuelCost: 0.4,
        fuelUnits: 4,
        primaryObjectiveText: 'Test run',
        missionContext: createDefaultMissionTravelContext(TRAVEL_SYSTEM)
      },
      ui: {
        ...state.ui,
        startScreenVisible: false,
        latestEvent: {
          id: 'dead',
          tone: 'error',
          title: 'Ship destroyed',
          body: 'Should be cleared.'
        },
        activityLog: [
          {
            id: 'dead',
            tone: 'error',
            title: 'Ship destroyed',
            body: 'Should be cleared.'
          }
        ]
      }
    }));

    useGameStore.getState().resetAfterDeath();

    expect(useGameStore.getState().commander.currentSystem).toBe(STARTING_SYSTEM);
    expect(useGameStore.getState().commander.cash).toBe(1000);
    expect(useGameStore.getState().commander.cargo).toEqual({});
    expect(useGameStore.getState().travelSession).toBeNull();
    expect(useGameStore.getState().ui.startScreenVisible).toBe(true);
    expect(useGameStore.getState().ui.latestEvent).toBeUndefined();
    expect(useGameStore.getState().ui.activityLog).toEqual([]);
  });

  it('starts a fresh commander immediately when a new game is launched', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: TRAVEL_SYSTEM,
        cash: 4242,
        cargo: { food: 4 }
      }),
      universe: {
        ...state.universe,
        currentSystem: TRAVEL_SYSTEM,
        nearbySystems: [STARTING_SYSTEM]
      },
      ui: {
        ...state.ui,
        startScreenVisible: true,
        activeTab: 'equipment',
        selectedChartSystem: SECOND_TRAVEL_SYSTEM
      }
    }));

    useGameStore.getState().startNewGame(2);

    expect(useGameStore.getState().commander.currentSystem).toBe(STARTING_SYSTEM);
    expect(useGameStore.getState().commander.cash).toBe(1000);
    expect(useGameStore.getState().commander.cargo).toEqual({});
    expect(useGameStore.getState().travelSession).toBeNull();
    expect(useGameStore.getState().ui.startScreenVisible).toBe(false);
    expect(useGameStore.getState().ui.activeTab).toBe('status');
    expect(useGameStore.getState().ui.selectedChartSystem).toBeNull();
    expect(useGameStore.getState().ui.latestEvent).toBeUndefined();
    expect(useGameStore.getState().activeSaveSlotId).toBe(2);
    expect(useGameStore.getState().saveStates[2]?.snapshot.commander.currentSystem).toBe(STARTING_SYSTEM);
  });

  it('autosaves the active slot when docking completes', () => {
    useGameStore.getState().startNewGame(3);
    const beforeTravelSnapshot = JSON.stringify(useGameStore.getState().saveStates[3]);

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: TRAVEL_SYSTEM, spendJumpFuel: true });

    expect(useGameStore.getState().activeSaveSlotId).toBe(3);
    expect(useGameStore.getState().saveStates[3]?.snapshot.commander.currentSystem).toBe(TRAVEL_SYSTEM);
    expect(JSON.stringify(useGameStore.getState().saveStates[3])).not.toBe(beforeTravelSnapshot);
  });

  it('autosaves the loaded slot when the player docks again', () => {
    useGameStore.getState().startNewGame(2);
    useGameStore.getState().loadFromSlot(2);

    expect(useGameStore.getState().beginTravel(SECOND_TRAVEL_SYSTEM)).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: SECOND_TRAVEL_SYSTEM, spendJumpFuel: true });

    expect(useGameStore.getState().saveStates[2]?.snapshot.commander.currentSystem).toBe(SECOND_TRAVEL_SYSTEM);
    expect(useGameStore.getState().saveStates[2]?.snapshot.universe.currentSystem).toBe(SECOND_TRAVEL_SYSTEM);
  });

  it('uses Galactic Hyperdrive to move to the next galaxy and consume the item', () => {
    useGameStore.getState().startNewGame(1);
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        installedEquipment: {
          ...createDefaultCommander().installedEquipment,
          galactic_hyperdrive: true
        }
      })
    }));

    useGameStore.getState().useGalacticHyperdrive();

    expect(useGameStore.getState().universe.galaxyIndex).toBe(1);
    expect(useGameStore.getState().commander.installedEquipment.galactic_hyperdrive).toBe(false);
    expect(useGameStore.getState().saveStates[1]?.snapshot.universe.galaxyIndex).toBe(1);
    expect(useGameStore.getState().saveStates[1]?.snapshot.commander.installedEquipment.galactic_hyperdrive).toBe(false);
  });

  it('keeps the last docked autosave while travel is in progress', () => {
    useGameStore.getState().startNewGame(1);
    const persistedBeforeTravel = window.localStorage.getItem(ACTIVE_SAVE_SLOT_STORAGE_KEY);

    expect(useGameStore.getState().beginTravel(TRAVEL_SYSTEM)).toBe(true);

    expect(window.localStorage.getItem(ACTIVE_SAVE_SLOT_STORAGE_KEY)).toBe(persistedBeforeTravel);
    expect(loadPersistedActiveSaveSlotId(useGameStore.getState().saveStates)).toBe(1);
  });
});
