import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const cobraMk1Blueprint: CombatBlueprint = {
  id: 'cobra-mk1',
  label: 'Cobra Mk I',
  behavior: 'hostile',
  maxEnergy: 90,
  laserPower: 2,
  missiles: 2,
  targetableArea: 250,
  laserRange: 310,
  topSpeed: toWorldSpeed(26),
  acceleration: 0.11,
  turnRate: 0.05,
  roles: { pirate: true, hostile: true },
  packHunter: true
};
