import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const constrictorBlueprint: CombatBlueprint = {
  id: 'constrictor',
  label: 'Constrictor',
  behavior: 'hostile',
  maxEnergy: 220,
  laserPower: 5,
  missiles: 4,
  targetableArea: 300,
  laserRange: 420,
  topSpeed: toWorldSpeed(36),
  acceleration: 0.15,
  turnRate: 0.065,
  roles: { hostile: true, pirate: true }
};
