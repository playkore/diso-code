import { clampAngle } from '../state';
import { getStationSlotAngle } from '../station/docking';
import { getDistanceFromStation } from '../station/safeZone';
import type { CombatEnemy, CombatStation } from '../types';

/**
 * Station traffic follows a simple two-stage approach:
 * first queue at a hold point in front of the slot, then commit to the slot
 * once alignment and distance are good enough to finish the docking run.
 */
const STATION_TRAFFIC_HOLD_DISTANCE = 148;
const STATION_TRAFFIC_SLOT_DISTANCE = 30;
const STATION_TRAFFIC_DOCKING_RADIUS = 96;

export function getStationTrafficHoldPoint(station: CombatStation) {
  const slotAngle = getStationSlotAngle(station.angle);
  return {
    x: station.x + Math.cos(slotAngle) * STATION_TRAFFIC_HOLD_DISTANCE,
    y: station.y + Math.sin(slotAngle) * STATION_TRAFFIC_HOLD_DISTANCE,
    slotAngle
  };
}

export function stepStationTraffic(enemy: CombatEnemy, station: CombatStation, dt: number) {
  const { x: holdX, y: holdY, slotAngle } = getStationTrafficHoldPoint(station);
  const holdDx = holdX - enemy.x;
  const holdDy = holdY - enemy.y;
  const holdDistance = Math.hypot(holdDx, holdDy);
  const distanceFromStation = getDistanceFromStation(station, enemy.x, enemy.y);
  const relativeAngle = Math.atan2(enemy.y - station.y, enemy.x - station.x);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const alignedForDocking = Math.abs(slotOffset) < Math.PI / 7;
  // Traffic can skip straight to docking if it is already near the slot and
  // roughly aligned, which keeps loops from orbiting the station forever.
  const shouldDock = holdDistance < 42 || (distanceFromStation < STATION_TRAFFIC_HOLD_DISTANCE + 8 && alignedForDocking);

  const targetX = shouldDock ? station.x + Math.cos(slotAngle) * STATION_TRAFFIC_SLOT_DISTANCE : holdX;
  const targetY = shouldDock ? station.y + Math.sin(slotAngle) * STATION_TRAFFIC_SLOT_DISTANCE : holdY;
  const targetAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  const angleDiff = clampAngle(targetAngle - enemy.angle);
  enemy.angle += Math.sign(angleDiff) * enemy.turnRate * dt * 0.8;

  const thrustScale = shouldDock ? 0.48 : 0.34;
  enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * thrustScale * dt;
  enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * thrustScale * dt;
}

export function isStationTrafficDocked(enemy: CombatEnemy, station: CombatStation): boolean {
  const slotAngle = getStationSlotAngle(station.angle);
  const dockingDistance = getDistanceFromStation(station, enemy.x, enemy.y);
  const dockingOffset = Math.abs(clampAngle(Math.atan2(enemy.y - station.y, enemy.x - station.x) - slotAngle));
  return dockingDistance <= STATION_TRAFFIC_DOCKING_RADIUS && dockingOffset < Math.PI / 5;
}
