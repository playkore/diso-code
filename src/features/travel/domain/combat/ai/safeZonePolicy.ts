import { getDistanceFromStation, getEnemySafeZoneBoundary, getSafeZoneEscapeAngle, keepEnemyOutsideSafeZone, SAFE_ZONE_AVOIDANCE_DISTANCE } from '../station/safeZone';
import type { CombatEnemy, CombatStation } from '../types';

export function isEnemyExcludedFromSafeZone(enemy: CombatEnemy): boolean {
  return !enemy.roles.cop && (enemy.roles.hostile || enemy.roles.pirate || enemy.roles.bountyHunter || enemy.kind === 'thargon' || Boolean(enemy.missionTag));
}

export function isStationTraffic(enemy: CombatEnemy): boolean {
  return Boolean(
    !enemy.roles.cop &&
      !enemy.roles.hostile &&
      !enemy.roles.pirate &&
      !enemy.roles.bountyHunter &&
      !enemy.missionTag &&
      (enemy.roles.trader || enemy.roles.innocent || enemy.roles.docking)
  );
}

export function getSafeZoneContext(station: CombatStation | null, enemy: CombatEnemy) {
  // The boundary is role-aware because pirates use a larger exclusion ring than
  // other hostile traffic near the station.
  const safeZoneBoundary = station ? getEnemySafeZoneBoundary(station, enemy) : 0;
  const enemyExcludedFromSafeZone = station ? isEnemyExcludedFromSafeZone(enemy) : false;
  const distanceFromStation = station ? getDistanceFromStation(station, enemy.x, enemy.y) : Number.POSITIVE_INFINITY;
  const mustAvoidSafeZone = Boolean(
    station && enemyExcludedFromSafeZone && distanceFromStation <= safeZoneBoundary + SAFE_ZONE_AVOIDANCE_DISTANCE
  );

  return {
    safeZoneBoundary,
    enemyExcludedFromSafeZone,
    distanceFromStation,
    mustAvoidSafeZone
  };
}

export function getSafeZoneAvoidanceAngle(station: CombatStation, enemy: CombatEnemy) {
  return getSafeZoneEscapeAngle(station, enemy);
}

export function enforceSafeZone(station: CombatStation, enemy: CombatEnemy) {
  keepEnemyOutsideSafeZone(station, enemy);
}
