import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const adderBlueprint: CombatBlueprint = {
  id: 'adder',
  label: 'Adder',
  behavior: 'hostile',
  maxEnergy: 85,
  laserPower: 2,
  missiles: 0,
  targetableArea: 190,
  laserRange: 280,
  topSpeed: toWorldSpeed(24),
  acceleration: 0.1,
  turnRate: 0.052,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
