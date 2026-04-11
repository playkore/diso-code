import type { CombatEnemy, CombatStation } from '../types';

export const SAFE_ZONE_ENEMY_MARGIN = 18;
export const SAFE_ZONE_AVOIDANCE_DISTANCE = 96;
export const PIRATE_SAFE_ZONE_RADIUS_MULTIPLIER = 2;

export function getDistanceFromStation(station: CombatStation, x: number, y: number): number {
  return Math.hypot(x - station.x, y - station.y);
}

/**
 * Hostile traffic does not all share the same perimeter around the station.
 *
 * Pirates now keep a wider buffer so they never drift into the station approach
 * corridor: they must stay outside two full safe-zone radii. Other excluded
 * ships still use the original single safe-zone boundary plus the usual margin.
 */
export function getEnemySafeZoneBoundary(station: CombatStation, enemy: CombatEnemy): number {
  const exclusionRadius = enemy.roles.pirate ? station.safeZoneRadius * PIRATE_SAFE_ZONE_RADIUS_MULTIPLIER : station.safeZoneRadius;
  return exclusionRadius + SAFE_ZONE_ENEMY_MARGIN;
}

export function getSafeZoneEscapeAngle(station: CombatStation, enemy: CombatEnemy): number {
  const dx = enemy.x - station.x;
  const dy = enemy.y - station.y;
  if (dx === 0 && dy === 0) {
    return enemy.angle;
  }
  return Math.atan2(dy, dx);
}

export function keepEnemyOutsideSafeZone(station: CombatStation, enemy: CombatEnemy) {
  const safeZoneBoundary = getEnemySafeZoneBoundary(station, enemy);
  const distanceFromStation = getDistanceFromStation(station, enemy.x, enemy.y);
  if (distanceFromStation >= safeZoneBoundary) {
    return;
  }

  const escapeAngle = getSafeZoneEscapeAngle(station, enemy);
  enemy.x = station.x + Math.cos(escapeAngle) * safeZoneBoundary;
  enemy.y = station.y + Math.sin(escapeAngle) * safeZoneBoundary;
  const outwardSpeed = Math.max(enemy.acceleration * 24, Math.hypot(enemy.vx, enemy.vy));
  enemy.vx = Math.cos(escapeAngle) * outwardSpeed;
  enemy.vy = Math.sin(escapeAngle) * outwardSpeed;
  enemy.angle = escapeAngle;
}
