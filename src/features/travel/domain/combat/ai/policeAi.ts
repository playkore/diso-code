import { stepCivilianCruise } from './civilianAi';
import { stepHostileSteering, stepHostileThrust } from './hostileAi';
import type { CombatEnemy, CombatStation } from '../types';

export function stepPoliceEnemy(enemy: CombatEnemy, station: CombatStation | null, dt: number, dx: number, dy: number, dist: number) {
  if (enemy.roles.hostile) {
    // Police ships share the hostile steering model, but they never receive
    // safe-zone avoidance here because station-defense logic owns that choice.
    const angleDiff = stepHostileSteering(enemy, station, dx, dy, dist, dt, enemy.aggression > 0 ? 1 : 0.4);
    stepHostileThrust(enemy, dt, dist, false);
    return angleDiff;
  }

  stepCivilianCruise(enemy, station, dt);
  return 0;
}
