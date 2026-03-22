import { clampAngle } from '../state';
import type { CombatEnemy, CombatStation } from '../types';

const HOSTILE_FRONT_GUARD_DISTANCE = 135;
const HOSTILE_BREAKAWAY_RESET_DISTANCE = 240;
const HOSTILE_BREAKAWAY_SIDE_OFFSET = 260;
const HOSTILE_BREAKAWAY_BACK_OFFSET = 70;

/**
 * Hostiles now fly a shallow boom-and-zoom loop:
 * 1. approach the player and take the shot
 * 2. keep moving through the pass instead of braking on the nose
 * 3. break to a committed side lane before lining up again
 *
 * This keeps enemies readable and aggressive while preventing the old
 * "park in front of the player and trade lasers" behavior.
 */
function updateHostileAttackRun(enemy: CombatEnemy, targetDx: number, targetDy: number, distanceToPlayer: number) {
  enemy.hostileAttackPhase ??= 'approach';
  enemy.hostileStrafeSign ??= enemy.y >= 0 ? 1 : -1;

  const alignmentToPlayer = Math.cos(Math.abs(clampAngle(Math.atan2(targetDy, targetDx) - enemy.angle)));
  const justFired = enemy.fireCooldown > 40;
  const tooCloseOnCenterline = distanceToPlayer <= HOSTILE_FRONT_GUARD_DISTANCE && alignmentToPlayer >= 0.92;

  if (enemy.hostileAttackPhase === 'approach' && (justFired || tooCloseOnCenterline)) {
    enemy.hostileAttackPhase = 'breakaway';
  } else if (enemy.hostileAttackPhase === 'breakaway' && distanceToPlayer >= HOSTILE_BREAKAWAY_RESET_DISTANCE) {
    enemy.hostileAttackPhase = 'approach';
  }
}

function getBreakawayTarget(enemy: CombatEnemy, targetDx: number, targetDy: number, distanceToPlayer: number) {
  const distance = Math.max(distanceToPlayer, 1);
  const toPlayerX = targetDx / distance;
  const toPlayerY = targetDy / distance;
  const sideX = -toPlayerY * enemy.hostileStrafeSign!;
  const sideY = toPlayerX * enemy.hostileStrafeSign!;

  // Aim for a flank point just off the player's side and slightly behind the
  // current attack vector so the ship vacates the center lane before resetting.
  const breakawayTargetX = enemy.x + targetDx + sideX * HOSTILE_BREAKAWAY_SIDE_OFFSET - toPlayerX * HOSTILE_BREAKAWAY_BACK_OFFSET;
  const breakawayTargetY = enemy.y + targetDy + sideY * HOSTILE_BREAKAWAY_SIDE_OFFSET - toPlayerY * HOSTILE_BREAKAWAY_BACK_OFFSET;
  return {
    x: breakawayTargetX - enemy.x,
    y: breakawayTargetY - enemy.y
  };
}

export function stepHostileSteering(
  enemy: CombatEnemy,
  _station: CombatStation | null,
  targetDx: number,
  targetDy: number,
  distanceToPlayer: number,
  dt: number,
  aggressionScale: number,
  avoidanceAngle?: number
) {
  if (avoidanceAngle === undefined) {
    updateHostileAttackRun(enemy, targetDx, targetDy, distanceToPlayer);
  } else {
    enemy.hostileAttackPhase = 'approach';
  }

  const steeringVector =
    avoidanceAngle === undefined && enemy.hostileAttackPhase === 'breakaway'
      ? getBreakawayTarget(enemy, targetDx, targetDy, distanceToPlayer)
      : { x: targetDx, y: targetDy };
  const targetAngle = avoidanceAngle ?? Math.atan2(steeringVector.y, steeringVector.x);
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

  const thrustScale =
    enemy.hostileAttackPhase === 'breakaway'
      ? 1.15
      : distanceToPlayer > HOSTILE_FRONT_GUARD_DISTANCE
        ? 1
        : 0.35;
  enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * dt * thrustScale;
  enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * dt * thrustScale;
}
