import type { CombatBlueprint } from '../types';

export const cobraMk3PirateBlueprint: CombatBlueprint = {
  id: 'cobra-mk3-pirate',
  label: 'Cobra Mk III',
  behavior: 'hostile',
  maxEnergy: 150,
  laserPower: 2,
  missiles: 2,
  targetableArea: 320,
  laserRange: 340,
  topSpeed: 6.0,
  acceleration: 0.1,
  turnRate: 0.045,
  roles: { pirate: true, hostile: true },
  packHunter: true,
  loneBounty: true
};
