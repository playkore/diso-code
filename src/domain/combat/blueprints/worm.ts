import type { CombatBlueprint } from '../types';

export const wormBlueprint: CombatBlueprint = {
  id: 'worm',
  label: 'Worm',
  behavior: 'hostile',
  maxEnergy: 65,
  laserPower: 1,
  missiles: 0,
  targetableArea: 170,
  laserRange: 250,
  topSpeed: 6.8,
  acceleration: 0.13,
  turnRate: 0.06,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
