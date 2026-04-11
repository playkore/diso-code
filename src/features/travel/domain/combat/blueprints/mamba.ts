import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const mambaBlueprint: CombatBlueprint = {
  id: 'mamba',
  label: 'Mamba',
  behavior: 'hostile',
  maxEnergy: 90,
  laserPower: 2,
  missiles: 2,
  targetableArea: 220,
  laserRange: 320,
  topSpeed: toWorldSpeed(30),
  acceleration: 0.12,
  turnRate: 0.055,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
