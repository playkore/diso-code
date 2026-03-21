import type { CombatBlueprint } from '../types';

export const thargonBlueprint: CombatBlueprint = {
  id: 'thargon',
  label: 'Thargon',
  behavior: 'thargoid',
  maxEnergy: 55,
  laserPower: 1,
  missiles: 0,
  targetableArea: 150,
  laserRange: 240,
  topSpeed: 7.6,
  acceleration: 0.18,
  turnRate: 0.08,
  roles: { hostile: true }
};
