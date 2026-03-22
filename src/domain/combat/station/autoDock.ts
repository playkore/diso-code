import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation } from '../types';
import { getStationSlotAngle } from './docking';

/**
 * Auto-dock steering output for one simulation frame.
 *
 * The docking computer uses a simple two-stage path:
 * - gather at a hold point just outside the slot
 * - turn nose-in and fly through the station opening
 *
 * The command intentionally stays frame-local so the caller can cancel the
 * sequence immediately on manual input without recovering hidden AI state.
 */
export interface AutoDockCommand {
  turn: number;
  thrust: number;
  mode: 'orbit' | 'approach' | 'dock';
}

const AUTO_DOCK_HOLD_DISTANCE = 148;
const AUTO_DOCK_COMMIT_DISTANCE = 42;
const AUTO_DOCK_SLOT_DISTANCE = 30;
const AUTO_DOCK_ORBIT_RADIUS = 182;
const AUTO_DOCK_ORBIT_LEAD = Math.PI / 3;
const AUTO_DOCK_SLOT_ALIGN_WINDOW = Math.PI / 8;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function getAutoDockCommand(station: CombatStation, player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>): AutoDockCommand {
  const slotAngle = getStationSlotAngle(station.angle);
  const relativeAngle = Math.atan2(player.y - station.y, player.x - station.x);
  const holdX = station.x + Math.cos(slotAngle) * AUTO_DOCK_HOLD_DISTANCE;
  const holdY = station.y + Math.sin(slotAngle) * AUTO_DOCK_HOLD_DISTANCE;
  const holdDx = holdX - player.x;
  const holdDy = holdY - player.y;
  const holdDistance = Math.hypot(holdDx, holdDy);
  const distanceFromStation = Math.hypot(player.x - station.x, player.y - station.y);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const alignedForDocking = Math.abs(slotOffset) < AUTO_DOCK_SLOT_ALIGN_WINDOW;

  // The docking computer must not cut straight through the station body. When
  // the ship is on the wrong side or the slot has rotated away, it first aims
  // for an orbit point outside the hull and only then settles onto the hold
  // point directly in front of the live slot.
  const shouldOrbit = distanceFromStation < AUTO_DOCK_ORBIT_RADIUS && Math.abs(slotOffset) > AUTO_DOCK_SLOT_ALIGN_WINDOW;
  const orbitAngle = slotAngle + Math.sign(slotOffset || 1) * AUTO_DOCK_ORBIT_LEAD;
  const orbitX = station.x + Math.cos(orbitAngle) * AUTO_DOCK_ORBIT_RADIUS;
  const orbitY = station.y + Math.sin(orbitAngle) * AUTO_DOCK_ORBIT_RADIUS;

  // The final tunnel run starts only after the ship has reached the slot side
  // of the station and the rotating opening is still approximately centered.
  const commitToDock = !shouldOrbit && alignedForDocking && holdDistance < AUTO_DOCK_COMMIT_DISTANCE;
  const targetX = shouldOrbit ? orbitX : station.x + Math.cos(slotAngle) * (commitToDock ? AUTO_DOCK_SLOT_DISTANCE : AUTO_DOCK_HOLD_DISTANCE);
  const targetY = shouldOrbit ? orbitY : station.y + Math.sin(slotAngle) * (commitToDock ? AUTO_DOCK_SLOT_DISTANCE : AUTO_DOCK_HOLD_DISTANCE);
  const desiredAngle = commitToDock ? slotAngle + Math.PI : Math.atan2(targetY - player.y, targetX - player.x);
  const angleDiff = clampAngle(desiredAngle - player.angle);
  const turn = clampUnit(angleDiff / 0.12);
  const speed = Math.hypot(player.vx, player.vy);
  const targetDistance = Math.hypot(targetX - player.x, targetY - player.y);

  // Thrust ramps down near the slot so the existing docking rule can accept
  // the ship without an instant-complete teleport.
  const desiredSpeed = commitToDock ? Math.min(3, Math.max(1.1, targetDistance / 24)) : shouldOrbit ? Math.min(4.8, Math.max(1.6, targetDistance / 56)) : Math.min(4.2, Math.max(1.2, targetDistance / 52));
  const alignmentFactor = Math.max(0, 1 - Math.abs(angleDiff) / (Math.PI / 2));
  const thrust = speed < desiredSpeed && alignmentFactor > 0.2 ? Math.max(0.28, Math.min(1, alignmentFactor)) : 0;

  return {
    turn,
    thrust,
    mode: commitToDock ? 'dock' : shouldOrbit ? 'orbit' : 'approach'
  };
}
