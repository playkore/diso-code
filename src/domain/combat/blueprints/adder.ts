import type { CombatBlueprint } from '../types';

export const adderBlueprint: CombatBlueprint = {
  id: 'adder',
  label: 'Adder',
  behavior: 'hostile',
  maxEnergy: 85,
  laserPower: 2,
  missiles: 0,
  targetableArea: 190,
  laserRange: 280,
  topSpeed: 6.0,
  acceleration: 0.1,
  turnRate: 0.052,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
