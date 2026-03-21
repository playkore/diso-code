import type { CombatBlueprint } from '../types';

export const geckoBlueprint: CombatBlueprint = {
  id: 'gecko',
  label: 'Gecko',
  behavior: 'hostile',
  maxEnergy: 70,
  laserPower: 2,
  missiles: 0,
  targetableArea: 185,
  laserRange: 270,
  topSpeed: 6.1,
  acceleration: 0.11,
  turnRate: 0.055,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
