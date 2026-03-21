import type { CombatBlueprint } from '../types';

export const pythonPirateBlueprint: CombatBlueprint = {
  id: 'python-pirate',
  label: 'Python',
  behavior: 'hostile',
  maxEnergy: 170,
  laserPower: 3,
  missiles: 3,
  targetableArea: 360,
  laserRange: 360,
  topSpeed: 5.1,
  acceleration: 0.08,
  turnRate: 0.038,
  roles: { pirate: true, hostile: true },
  loneBounty: true
};
