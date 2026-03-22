import { createDefaultCommander } from '../commander';
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
