import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultCommander, normalizeCommanderState } from '../commander';
import { getJumpFuelCost } from '../fuel';
import { getSystemDistance } from '../galaxyCatalog';
import { DOCKED_SESSION_STORAGE_KEY, loadPersistedDockedSession } from '../../store/gameStateFactory';
import { useGameStore } from '../../store/useGameStore';

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
      commander,
      universe: {
        ...state.universe,
        galaxyIndex: 0,
        currentSystem: commander.currentSystem,
        nearbySystems: ['Diso'],
        stardate: 3124,
        economy: 5,
        marketFluctuation: 0
      },
      travelSession: null,
      ui: {
        ...state.ui,
        activeTab: 'market',
        instantTravelEnabled: false
      }
    }));
  });

  it('buys equipment, lasers, and missiles with store-side checks', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: 'Zaonce', cash: 120000 }),
      universe: { ...state.universe, currentSystem: 'Zaonce' }
    }));
    useGameStore.getState().buyEquipment('shield_generator');
    expect(useGameStore.getState().commander.installedEquipment.shield_generator).toBe(true);
    useGameStore.getState().buyEquipment('energy_box_2');
    expect(useGameStore.getState().commander.energyBanks).toBe(2);
    useGameStore.getState().buyEquipment('large_cargo_bay');
    expect(useGameStore.getState().commander.cargoCapacity).toBe(35);
    useGameStore.getState().buyLaser('rear', 'beam_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBe('beam_laser');
    useGameStore.getState().buyMissile();
    expect(useGameStore.getState().commander.missilesInstalled).toBe(1);
  });

  it('adds debug credits from settings helpers', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: 'Lave', cash: 100 }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));
    useGameStore.getState().grantDebugCredits(100000);
    expect(useGameStore.getState().commander.cash).toBe(100100);
  });

  it('rejects low-tech and duplicate outfitting purchases', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Zaonce',
        cash: 20000,
        installedEquipment: { ...createDefaultCommander().installedEquipment, ecm: true }
      }),
      universe: { ...state.universe, currentSystem: 'Zaonce' }
    }));
    useGameStore.getState().buyEquipment('ecm');
    expect(useGameStore.getState().commander.installedEquipment.ecm).toBe(true);
    useGameStore.getState().buyLaser('rear', 'military_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBeNull();
  });

  it('rejects higher energy-box tiers until the previous box is installed', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: 'Zaonce', cash: 120000 }),
      universe: { ...state.universe, currentSystem: 'Zaonce' }
    }));

    useGameStore.getState().buyEquipment('energy_box_3');
    expect(useGameStore.getState().commander.energyBanks).toBe(1);
    useGameStore.getState().buyEquipment('energy_box_2');
    useGameStore.getState().buyEquipment('energy_box_3');
    expect(useGameStore.getState().commander.energyBanks).toBe(3);
  });

  it('lets the player redock at the origin without spending fuel', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Lave', spendJumpFuel: false });
    expect(useGameStore.getState().commander.currentSystem).toBe('Lave');
    expect(useGameStore.getState().commander.fuel).toBe(startingFuel);
  });

  it('spends fuel only after docking in the destination system', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    const expectedFuel = startingFuel - getJumpFuelCost(getSystemDistance('Lave', 'Diso', 0));
    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Diso', spendJumpFuel: true });
    expect(useGameStore.getState().commander.currentSystem).toBe('Diso');
    expect(useGameStore.getState().commander.fuel).toBe(expectedFuel);
  });

  it('does not mutate legal status simply by launching with contraband', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        legalValue: 0,
        cargo: { narcotics: 2, firearms: 1 }
      }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));

    expect(useGameStore.getState().commander.legalValue).toBe(0);
    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    expect(useGameStore.getState().commander.legalValue).toBe(0);
  });

  it('halves legal value across a successful jump when no contraband floor applies', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));

    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Diso', spendJumpFuel: true });
    expect(useGameStore.getState().commander.currentSystem).toBe('Diso');
    expect(useGameStore.getState().commander.legalValue).toBe(10);
  });

  it('does not decay legal value when the player only redocks at the origin', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));

    expect(useGameStore.getState().beginTravel('Lave')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Lave', spendJumpFuel: false });
    expect(useGameStore.getState().commander.legalValue).toBe(20);
  });

  it('keeps contraband as a minimum legal floor after a successful jump', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        legalValue: 2,
        cargo: { narcotics: 2, firearms: 1 }
      }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));

    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Diso', spendJumpFuel: true });
    expect(useGameStore.getState().commander.legalValue).toBe(5);
  });

  it('applies the same legal decay rule in instant-travel mode', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        legalValue: 20
      }),
      universe: { ...state.universe, currentSystem: 'Lave' },
      ui: {
        ...state.ui,
        instantTravelEnabled: true
      }
    }));

    expect(useGameStore.getState().beginTravel('Diso')).toBe(false);
    expect(useGameStore.getState().commander.currentSystem).toBe('Diso');
    expect(useGameStore.getState().commander.legalValue).toBe(10);
  });

  it('credits combat rewards immediately through the travel slice helper', () => {
    const startingCash = useGameStore.getState().commander.cash;
    useGameStore.getState().grantCombatCredits(710);
    expect(useGameStore.getState().commander.cash).toBe(startingCash + 710);
  });

  it('persists the last docked session for refresh recovery', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: 'Diso', cash: 4242 }),
      universe: {
        ...state.universe,
        currentSystem: 'Diso',
        nearbySystems: ['Lave'],
        economy: 6
      }
    }));
    useGameStore.getState().setActiveTab('missions');

    const persistedRaw = window.localStorage.getItem(DOCKED_SESSION_STORAGE_KEY);
    expect(persistedRaw).toBeTruthy();

    const restoredSession = loadPersistedDockedSession();
    expect(restoredSession?.activeTab).toBe('missions');
    expect(restoredSession?.restoredState.commander.currentSystem).toBe('Diso');
    expect(restoredSession?.restoredState.commander.cash).toBe(4242);
  });

  it('uses Galactic Hyperdrive to move to the next galaxy and consume the item', () => {
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
  });

  it('keeps the last docked autosave while travel is in progress', () => {
    useGameStore.getState().setActiveTab('equipment');
    const persistedBeforeTravel = window.localStorage.getItem(DOCKED_SESSION_STORAGE_KEY);

    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);

    expect(window.localStorage.getItem(DOCKED_SESSION_STORAGE_KEY)).toBe(persistedBeforeTravel);
    expect(loadPersistedDockedSession()?.activeTab).toBe('equipment');
    expect(loadPersistedDockedSession()?.restoredState.commander.currentSystem).toBe('Lave');
  });
});
