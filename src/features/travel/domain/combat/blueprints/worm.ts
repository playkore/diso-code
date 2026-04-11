import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const wormBlueprint: CombatBlueprint = {
  id: 'worm',
  label: 'Worm',
  behavior: 'hostile',
  maxEnergy: 65,
  laserPower: 1,
  missiles: 0,
  targetableArea: 170,
  laserRange: 250,
  topSpeed: toWorldSpeed(23),
  acceleration: 0.13,
  turnRate: 0.06,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
