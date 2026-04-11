import { stepCivilianCruise } from './civilianAi';
import { stepHostileSteering, stepHostileThrust } from './hostileAi';
import { stepPoliceEnemy } from './policeAi';
import { enforceSafeZone, getSafeZoneAvoidanceAngle, getSafeZoneContext, isStationTraffic } from './safeZonePolicy';
import { isStationTrafficDocked, stepStationTraffic } from './stationTrafficAi';
import { applyEnemyHostility, tryEnemyLaserAttack, tryEnemyMissileLaunch } from '../weapons/enemyWeapons';
import type { CombatEnemy, RandomSource, TravelCombatState } from '../types';

/**
 * Main enemy-behavior dispatcher.
 *
 * Each frame routes an enemy through exactly one movement policy:
 * station traffic, police pursuit, hostile pursuit, or civilian cruise. Safe
 * zone helpers can override that movement by steering ships away from the
 * station, but weapon logic still runs afterward for hostile-capable enemies.
 */
export function stepEnemy(state: TravelCombatState, enemy: CombatEnemy, dt: number, random: RandomSource): boolean {
  applyEnemyHostility(state, enemy);

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  const station = state.station;
  const stationTraffic = station ? isStationTraffic(enemy) : false;
  const { safeZoneBoundary, enemyExcludedFromSafeZone, mustAvoidSafeZone } = getSafeZoneContext(station, enemy);

  let angleDiff = 0;
  if (stationTraffic && station) {
    stepStationTraffic(enemy, station, dt);
  } else if (enemy.roles.cop) {
    angleDiff = stepPoliceEnemy(enemy, station, dt, dx, dy, dist);
  } else if (enemy.roles.hostile || enemy.missionTag || enemy.kind === 'thargon') {
    angleDiff = stepHostileSteering(
      enemy,
      station,
      dx,
      dy,
      dist,
      dt,
      enemy.aggression > 0 ? 1 : 0.4,
      mustAvoidSafeZone && station ? getSafeZoneAvoidanceAngle(station, enemy) : undefined
    );
    stepHostileThrust(enemy, dt, dist, mustAvoidSafeZone);
  } else {
    stepCivilianCruise(enemy, station, dt);
  }

  enemy.isFiringLaser = false;
  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed > enemy.topSpeed) {
    enemy.vx = (enemy.vx / speed) * enemy.topSpeed;
    enemy.vy = (enemy.vy / speed) * enemy.topSpeed;
  }

  enemy.vx *= 0.985;
  enemy.vy *= 0.985;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;

  if (stationTraffic && station && isStationTrafficDocked(enemy, station)) {
    return true;
  }

  if (enemyExcludedFromSafeZone && station) {
    enforceSafeZone(station, enemy);
  }

  enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
  enemy.missileCooldown = Math.max(0, enemy.missileCooldown - dt);

  if (enemyExcludedFromSafeZone && station) {
    const finalDistanceFromStation = Math.hypot(enemy.x - station.x, enemy.y - station.y);
    if (state.encounter.safeZone || finalDistanceFromStation <= safeZoneBoundary + 18) {
      return false;
    }
  }

  if (!(enemy.roles.hostile || enemy.kind === 'thargon')) {
    return false;
  }

  // Weapons are evaluated after movement so range/alignment checks use the
  // enemy's final position for this frame.
  tryEnemyMissileLaunch(state, enemy, random);
  tryEnemyLaserAttack(state, enemy, dist, angleDiff);
  return false;
}
