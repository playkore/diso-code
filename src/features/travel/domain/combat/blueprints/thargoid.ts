import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const thargoidBlueprint: CombatBlueprint = {
  id: 'thargoid',
  label: 'Thargoid',
  behavior: 'thargoid',
  maxEnergy: 180,
  laserPower: 4,
  missiles: 6,
  targetableArea: 330,
  laserRange: 380,
  topSpeed: toWorldSpeed(39),
  acceleration: 0.11,
  turnRate: 0.055,
  roles: { hostile: true }
};
