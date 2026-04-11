import { clampAngle } from '../state';
import type { CombatEnemy, CombatStation } from '../types';

export function stepCivilianCruise(enemy: CombatEnemy, station: CombatStation | null, dt: number) {
  if (station) {
    const toStation = Math.atan2(station.y - enemy.y, station.x - enemy.x);
    enemy.angle += Math.sign(clampAngle(toStation - enemy.angle)) * enemy.turnRate * 0.4 * dt;
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * 0.4 * dt;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * 0.4 * dt;
    return;
  }

  enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * 0.2 * dt;
  enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * 0.2 * dt;
}
