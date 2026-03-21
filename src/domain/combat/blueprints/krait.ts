import type { CombatBlueprint } from '../types';

export const kraitBlueprint: CombatBlueprint = {
  id: 'krait',
  label: 'Krait',
  behavior: 'hostile',
  maxEnergy: 80,
  laserPower: 2,
  missiles: 0,
  targetableArea: 200,
  laserRange: 300,
  topSpeed: 6.5,
  acceleration: 0.12,
  turnRate: 0.058,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
