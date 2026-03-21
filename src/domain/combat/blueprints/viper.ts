import type { CombatBlueprint } from '../types';

export const viperBlueprint: CombatBlueprint = {
  id: 'viper',
  label: 'Viper',
  behavior: 'police',
  maxEnergy: 120,
  laserPower: 3,
  missiles: 1,
  targetableArea: 230,
  laserRange: 350,
  topSpeed: 7.0,
  acceleration: 0.14,
  turnRate: 0.065,
  roles: { cop: true, hostile: true, stationDefense: true }
};
