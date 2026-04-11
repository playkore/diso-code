import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const viperBlueprint: CombatBlueprint = {
  id: 'viper',
  label: 'Viper',
  behavior: 'police',
  maxEnergy: 120,
  laserPower: 3,
  missiles: 1,
  targetableArea: 230,
  laserRange: 350,
  topSpeed: toWorldSpeed(32),
  acceleration: 0.14,
  turnRate: 0.065,
  roles: { cop: true, hostile: true, stationDefense: true }
};
