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
  mode: 'approach' | 'dock';
}

const AUTO_DOCK_HOLD_DISTANCE = 148;
const AUTO_DOCK_COMMIT_DISTANCE = 42;
const AUTO_DOCK_SLOT_DISTANCE = 30;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

export function getAutoDockCommand(station: CombatStation, player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>): AutoDockCommand {
  const slotAngle = getStationSlotAngle(station.angle);
  const holdX = station.x + Math.cos(slotAngle) * AUTO_DOCK_HOLD_DISTANCE;
  const holdY = station.y + Math.sin(slotAngle) * AUTO_DOCK_HOLD_DISTANCE;
  const holdDx = holdX - player.x;
  const holdDy = holdY - player.y;
  const holdDistance = Math.hypot(holdDx, holdDy);
  const distanceFromStation = Math.hypot(player.x - station.x, player.y - station.y);
  const slotOffset = clampAngle(Math.atan2(player.y - station.y, player.x - station.x) - slotAngle);
  const alignedForDocking = Math.abs(slotOffset) < Math.PI / 7;

  // Once the ship is close to the slot and already lined up with the station,
  // the autopilot stops orbiting the hold point and commits to the tunnel.
  const commitToDock = holdDistance < AUTO_DOCK_COMMIT_DISTANCE || (distanceFromStation < AUTO_DOCK_HOLD_DISTANCE + 8 && alignedForDocking);
  const targetX = station.x + Math.cos(slotAngle) * (commitToDock ? AUTO_DOCK_SLOT_DISTANCE : AUTO_DOCK_HOLD_DISTANCE);
  const targetY = station.y + Math.sin(slotAngle) * (commitToDock ? AUTO_DOCK_SLOT_DISTANCE : AUTO_DOCK_HOLD_DISTANCE);
  const desiredAngle = commitToDock ? slotAngle + Math.PI : Math.atan2(targetY - player.y, targetX - player.x);
  const angleDiff = clampAngle(desiredAngle - player.angle);
  const turn = clampUnit(angleDiff / 0.12);
  const speed = Math.hypot(player.vx, player.vy);
  const targetDistance = Math.hypot(targetX - player.x, targetY - player.y);

  // Thrust ramps down near the slot so the existing docking rule can accept
  // the ship without an instant-complete teleport.
  const desiredSpeed = commitToDock ? Math.min(3, Math.max(1.1, targetDistance / 24)) : Math.min(4.4, Math.max(1.4, targetDistance / 48));
  const alignmentFactor = Math.max(0, 1 - Math.abs(angleDiff) / (Math.PI / 2));
  const thrust = speed < desiredSpeed && alignmentFactor > 0.2 ? Math.max(0.28, Math.min(1, alignmentFactor)) : 0;

  return {
    turn,
    thrust,
    mode: commitToDock ? 'dock' : 'approach'
  };
}
