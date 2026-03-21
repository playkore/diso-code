import type { CombatBlueprint } from '../types';

export const cobraMk3TraderBlueprint: CombatBlueprint = {
  id: 'cobra-mk3-trader',
  label: 'Cobra Trader',
  behavior: 'stationTraffic',
  maxEnergy: 130,
  laserPower: 1,
  missiles: 1,
  targetableArea: 320,
  laserRange: 300,
  topSpeed: 5.4,
  acceleration: 0.08,
  turnRate: 0.04,
  roles: { trader: true, innocent: true }
};
