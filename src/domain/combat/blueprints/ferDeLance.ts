import type { CombatBlueprint } from '../types';

export const ferDeLanceBlueprint: CombatBlueprint = {
  id: 'fer-de-lance',
  label: 'Fer-de-Lance',
  behavior: 'hostile',
  maxEnergy: 160,
  laserPower: 2,
  missiles: 2,
  targetableArea: 260,
  laserRange: 340,
  topSpeed: 6.7,
  acceleration: 0.12,
  turnRate: 0.06,
  roles: { bountyHunter: true },
  loneBounty: true
};
