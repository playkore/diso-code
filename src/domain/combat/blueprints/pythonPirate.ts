import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const pythonPirateBlueprint: CombatBlueprint = {
  id: 'python-pirate',
  label: 'Python',
  behavior: 'hostile',
  maxEnergy: 170,
  laserPower: 3,
  missiles: 3,
  targetableArea: 360,
  laserRange: 360,
  topSpeed: toWorldSpeed(20),
  acceleration: 0.08,
  turnRate: 0.038,
  roles: { pirate: true, hostile: true },
  loneBounty: true
};
