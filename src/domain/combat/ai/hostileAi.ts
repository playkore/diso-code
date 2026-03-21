import { clampAngle } from '../state';
import type { CombatEnemy, CombatStation } from '../types';

export function stepHostileSteering(
  enemy: CombatEnemy,
  _station: CombatStation | null,
  targetDx: number,
  targetDy: number,
  dt: number,
  aggressionScale: number,
  avoidanceAngle?: number
) {
  const targetAngle = avoidanceAngle ?? Math.atan2(targetDy, targetDx);
  const angleDiff = clampAngle(targetAngle - enemy.angle);
  enemy.angle += Math.sign(angleDiff) * enemy.turnRate * dt * aggressionScale;
  return angleDiff;
}

export function stepHostileThrust(enemy: CombatEnemy, dt: number, distanceToPlayer: number, mustAvoidSafeZone: boolean) {
  if (mustAvoidSafeZone) {
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * dt * 1.25;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * dt * 1.25;
    return;
  }

  if (distanceToPlayer > 110) {
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * dt;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * dt;
  }
}
