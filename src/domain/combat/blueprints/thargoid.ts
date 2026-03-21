import type { CombatBlueprint } from '../types';

export const thargoidBlueprint: CombatBlueprint = {
  id: 'thargoid',
  label: 'Thargoid',
  behavior: 'thargoid',
  maxEnergy: 180,
  laserPower: 4,
  missiles: 6,
  targetableArea: 330,
  laserRange: 380,
  topSpeed: 6.2,
  acceleration: 0.11,
  turnRate: 0.055,
  roles: { hostile: true }
};
