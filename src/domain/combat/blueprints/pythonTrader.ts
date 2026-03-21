import type { CombatBlueprint } from '../types';

export const pythonTraderBlueprint: CombatBlueprint = {
  id: 'python-trader',
  label: 'Python Trader',
  behavior: 'stationTraffic',
  maxEnergy: 170,
  laserPower: 1,
  missiles: 0,
  targetableArea: 360,
  laserRange: 290,
  topSpeed: 4.9,
  acceleration: 0.06,
  turnRate: 0.035,
  roles: { trader: true, innocent: true }
};
