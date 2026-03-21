import type { CombatBlueprint } from '../types';

export const sidewinderBlueprint: CombatBlueprint = {
  id: 'sidewinder',
  label: 'Sidewinder',
  behavior: 'hostile',
  maxEnergy: 70,
  laserPower: 2,
  missiles: 0,
  targetableArea: 210,
  laserRange: 290,
  topSpeed: 6.2,
  acceleration: 0.11,
  turnRate: 0.05,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
