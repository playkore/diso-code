import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation } from '../types';
import { getStationSlotAngle } from './docking';

/**
 * Auto-dock steering output for one simulation frame.
 *
 * The docking computer follows a simple radial procedure:
 * - point at the station center and fly inward
 * - release thrust early enough to stop just outside the wall
 * - wait there until the rotating slot is directly ahead
 * - thrust straight inward through the opening
 *
 * The command intentionally stays frame-local so the caller can cancel the
 * sequence immediately on manual input without recovering hidden AI state.
 */
export interface AutoDockCommand {
  turn: number;
  thrust: number;
  mode: 'approach' | 'wait' | 'dock';
  debug: {
    currentSlotAngle: number;
    expectedSlotAngle: number;
    playerRadialAngle: number;
    slotOffset: number;
    projectedSlotOffset: number;
    onStageRing: boolean;
    withinWaitBand: boolean;
    readyToWait: boolean;
    canEnterWait: boolean;
    doorInFront: boolean;
    distanceFromStation: number;
    stageRadius: number;
    radialSpeed: number;
    tangentialSpeed: number;
    stageRadiusError: number;
  };
}

const AUTO_DOCK_WALL_STANDOFF = 10;
const AUTO_DOCK_STAGE_RADIUS_PADDING = 3;
const AUTO_DOCK_DOCK_WINDOW = Math.PI / 20;
const AUTO_DOCK_APPROACH_SPEED = 0.75;
const AUTO_DOCK_INWARD_SPEED = 2.8;
const AUTO_DOCK_POSITION_HOLD_SPEED = 0.35;
const AUTO_DOCK_TANGENTIAL_HOLD_SPEED = 0.8;
const AUTO_DOCK_WAIT_ENTRY_SPEED = 0.6;
const AUTO_DOCK_WAIT_ENTRY_BAND = 10;
const AUTO_DOCK_STOPPING_FACTOR = 70;
const AUTO_DOCK_STOPPING_BUFFER = 8;
const AUTO_DOCK_CENTERING_THRUST = 0.35;
const AUTO_DOCK_SLOT_LEAD_FRAMES = 10;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getTargetTurn(currentAngle: number, desiredAngle: number) {
  return clampUnit(clampAngle(desiredAngle - currentAngle) / 0.12);
}

export function getAutoDockCommand(station: CombatStation, player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>): AutoDockCommand {
  const stageRadius = station.radius + AUTO_DOCK_WALL_STANDOFF;
  const distanceFromStation = Math.hypot(player.x - station.x, player.y - station.y);
  const slotAngle = getStationSlotAngle(station.angle);
  const relativeAngle = Math.atan2(player.y - station.y, player.x - station.x);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const projectedSlotAngle = getStationSlotAngle(station.angle + station.rotSpeed * AUTO_DOCK_SLOT_LEAD_FRAMES);
  const projectedSlotOffset = clampAngle(relativeAngle - projectedSlotAngle);
  const inwardAngle = Math.atan2(station.y - player.y, station.x - player.x);
  const outwardAngle = relativeAngle;
  const noseAlignment = clampAngle(player.angle - (slotAngle + Math.PI));
  const projectedNoseAlignment = clampAngle(player.angle - (projectedSlotAngle + Math.PI));
  const vx = player.vx;
  const vy = player.vy;
  const radialSpeed = vx * Math.cos(inwardAngle) + vy * Math.sin(inwardAngle);
  const tangentialSpeed = Math.abs(vx * Math.cos(relativeAngle + Math.PI / 2) + vy * Math.sin(relativeAngle + Math.PI / 2));
  const remainingDistance = Math.max(0, distanceFromStation - stageRadius);
  const stoppingDistance = Math.max(0, radialSpeed) * AUTO_DOCK_STOPPING_FACTOR + AUTO_DOCK_STOPPING_BUFFER;
  const onStageRing = Math.abs(distanceFromStation - stageRadius) <= AUTO_DOCK_STAGE_RADIUS_PADDING * 2;
  const withinWaitBand = Math.abs(distanceFromStation - stageRadius) <= AUTO_DOCK_WAIT_ENTRY_BAND;
  const readyToWait = Math.abs(radialSpeed) <= AUTO_DOCK_POSITION_HOLD_SPEED && tangentialSpeed <= AUTO_DOCK_TANGENTIAL_HOLD_SPEED;
  const canEnterWait = withinWaitBand && radialSpeed <= AUTO_DOCK_WAIT_ENTRY_SPEED;
  const doorInFront =
    (Math.abs(slotOffset) <= AUTO_DOCK_DOCK_WINDOW && Math.abs(noseAlignment) <= AUTO_DOCK_DOCK_WINDOW) ||
    (Math.abs(projectedSlotOffset) <= AUTO_DOCK_DOCK_WINDOW && Math.abs(projectedNoseAlignment) <= AUTO_DOCK_DOCK_WINDOW);

  if ((onStageRing || withinWaitBand) && readyToWait && doorInFront) {
    return {
      turn: getTargetTurn(player.angle, inwardAngle),
      thrust: Math.max(0, radialSpeed) < AUTO_DOCK_INWARD_SPEED ? 1 : 0,
      mode: 'dock',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: projectedSlotAngle,
        playerRadialAngle: relativeAngle,
        slotOffset,
        projectedSlotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceFromStation - stageRadius
      }
    };
  }

  if ((onStageRing && readyToWait) || canEnterWait) {
    return {
      // While waiting, keep the bow pointed at the center and only correct
      // radial drift. No tangential chase is allowed in this phase.
      turn: getTargetTurn(player.angle, inwardAngle),
      thrust: distanceFromStation > stageRadius + AUTO_DOCK_STAGE_RADIUS_PADDING ? AUTO_DOCK_CENTERING_THRUST : 0,
      mode: 'wait',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: projectedSlotAngle,
        playerRadialAngle: relativeAngle,
        slotOffset,
        projectedSlotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceFromStation - stageRadius
      }
    };
  }

  // Approach is intentionally radial: face the center and let the current
  // inward velocity bleed off near the wall by releasing thrust in advance.
  // If the ship drifts too close, point outward and back off to the staging
  // ring before trying again.
  if (distanceFromStation < stageRadius - AUTO_DOCK_STAGE_RADIUS_PADDING) {
    return {
      turn: getTargetTurn(player.angle, outwardAngle),
      thrust: 1,
      mode: 'approach',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: projectedSlotAngle,
        playerRadialAngle: relativeAngle,
        slotOffset,
        projectedSlotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceFromStation - stageRadius
      }
    };
  }

  const shouldBrake = remainingDistance <= stoppingDistance;
  const turn = getTargetTurn(player.angle, inwardAngle);
  const shouldThrust = !shouldBrake && radialSpeed < AUTO_DOCK_APPROACH_SPEED;

  return {
    turn,
    thrust: shouldThrust ? 1 : 0,
    mode: 'approach',
    debug: {
      currentSlotAngle: slotAngle,
      expectedSlotAngle: projectedSlotAngle,
      playerRadialAngle: relativeAngle,
      slotOffset,
      projectedSlotOffset,
      onStageRing,
      withinWaitBand,
      readyToWait,
      canEnterWait,
      doorInFront,
      distanceFromStation,
      stageRadius,
      radialSpeed,
      tangentialSpeed,
      stageRadiusError: distanceFromStation - stageRadius
    }
  };
}
