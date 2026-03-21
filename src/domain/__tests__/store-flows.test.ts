import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultCommander, normalizeCommanderState } from '../commander';
import { getJumpFuelCost } from '../fuel';
import { getSystemDistance } from '../galaxyCatalog';
import { useGameStore } from '../../store/useGameStore';

describe('outfitting store flows', () => {
  beforeEach(() => {
    const commander = normalizeCommanderState(createDefaultCommander());
    useGameStore.setState((state) => ({
      ...state,
      commander,
      universe: {
        ...state.universe,
        currentSystem: commander.currentSystem,
        nearbySystems: ['Diso'],
        stardate: 3124,
        economy: 5,
        marketFluctuation: 0
      },
      travelSession: null
    }));
  });

  it('buys equipment, lasers, and missiles with store-side checks', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({ ...createDefaultCommander(), currentSystem: 'Lave', cash: 120000 }),
      universe: { ...state.universe, currentSystem: 'Lave' }
    }));
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

  it('lets the player redock at the origin without spending fuel', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Lave', spendJumpFuel: false });
    expect(useGameStore.getState().commander.currentSystem).toBe('Lave');
    expect(useGameStore.getState().commander.fuel).toBe(startingFuel);
  });

  it('spends fuel only after docking in the destination system', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    const expectedFuel = startingFuel - getJumpFuelCost(getSystemDistance('Lave', 'Diso'));
    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({ dockSystemName: 'Diso', spendJumpFuel: true });
    expect(useGameStore.getState().commander.currentSystem).toBe('Diso');
    expect(useGameStore.getState().commander.fuel).toBe(expectedFuel);
  });
});
