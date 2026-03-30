import type { CombatBlueprint } from '../types';
import { toWorldSpeed } from '../classicFlightModel';

export const aspMk2Blueprint: CombatBlueprint = {
  id: 'asp-mk2',
  label: 'Asp Mk II',
  behavior: 'hostile',
  maxEnergy: 150,
  laserPower: 5,
  missiles: 1,
  targetableArea: 280,
  laserRange: 380,
  topSpeed: toWorldSpeed(40),
  acceleration: 0.12,
  turnRate: 0.06,
  roles: { bountyHunter: true },
  loneBounty: true
};
