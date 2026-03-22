import { createDefaultCommander } from '../commander';
import type { CombatEnemy } from '../combat/types';
import { createDeterministicRandomSource, createTravelCombatState } from '../travelCombat';

export function createCombatState(
  bytes: number[],
  overrides: Partial<Parameters<typeof createTravelCombatState>[0]> = {}
) {
  const commander = createDefaultCommander();
  return createTravelCombatState(
    {
      legalValue: 0,
      government: 0,
      techLevel: 7,
      missionTP: 0,
      missionVariant: 'classic',
      energyBanks: commander.energyBanks,
      energyPerBank: commander.energyPerBank,
      laserMounts: commander.laserMounts,
      installedEquipment: commander.installedEquipment,
      missilesInstalled: commander.missilesInstalled,
      ...overrides
    },
    createDeterministicRandomSource(bytes)
  );
}

/**
 * Shared enemy fixture for combat tests.
 *
 * Runtime spawns always initialize bookkeeping fields such as `lifetime`, so
 * tests should start from the same complete shape and override only the values
 * relevant to the scenario under test.
 */
export function createTestEnemy(overrides: Partial<CombatEnemy>): CombatEnemy {
  return {
    id: 1,
    kind: 'ship',
    blueprintId: 'sidewinder',
    label: 'Sidewinder',
    behavior: 'hostile',
    x: 100,
    y: 0,
    vx: 0,
    vy: 0,
    angle: Math.PI,
    energy: 70,
    maxEnergy: 70,
    laserPower: 2,
    missiles: 0,
    targetableArea: 210,
    laserRange: 290,
    topSpeed: 6,
    acceleration: 0.11,
    turnRate: 0.05,
    roles: { hostile: true },
    aggression: 42,
    baseAggression: 42,
    fireCooldown: 999,
    missileCooldown: 999,
    isFiringLaser: false,
    lifetime: 0,
    ...overrides
  };
}
