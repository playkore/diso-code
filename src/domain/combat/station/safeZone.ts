import type { CombatEnemy, CombatStation } from '../types';

export const SAFE_ZONE_ENEMY_MARGIN = 18;
export const SAFE_ZONE_AVOIDANCE_DISTANCE = 96;

export function getDistanceFromStation(station: CombatStation, x: number, y: number): number {
  return Math.hypot(x - station.x, y - station.y);
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
  const safeZoneBoundary = station.safeZoneRadius + SAFE_ZONE_ENEMY_MARGIN;
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
