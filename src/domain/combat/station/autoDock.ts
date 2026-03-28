import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation } from '../types';
import { getStationDockDirection, getStationDockMouthPoint, getStationDockPoint, getStationTunnelHalfWidth } from './stationGeometry';

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

const AUTO_DOCK_WALL_STANDOFF = 12;
const AUTO_DOCK_STAGE_RADIUS_PADDING = 4;
const AUTO_DOCK_DOCK_WINDOW = 6;
const AUTO_DOCK_APPROACH_SPEED = 0.75;
const AUTO_DOCK_INWARD_SPEED = 2.8;
const AUTO_DOCK_POSITION_HOLD_SPEED = 0.35;
const AUTO_DOCK_TANGENTIAL_HOLD_SPEED = 0.8;
const AUTO_DOCK_WAIT_ENTRY_SPEED = 0.6;
const AUTO_DOCK_WAIT_ENTRY_BAND = 10;
const AUTO_DOCK_STOPPING_FACTOR = 70;
const AUTO_DOCK_STOPPING_BUFFER = 8;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getTargetTurn(currentAngle: number, desiredAngle: number) {
  return clampUnit(clampAngle(desiredAngle - currentAngle) / 0.12);
}

export function getAutoDockCommand(station: CombatStation, player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>): AutoDockCommand {
  const dockDirection = getStationDockDirection(station);
  const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
  const inwardAngle = slotAngle + Math.PI;
  const dockMouth = getStationDockMouthPoint(station);
  const dockPoint = getStationDockPoint(station);
  const stagePoint = {
    x: dockMouth.x + dockDirection.x * AUTO_DOCK_WALL_STANDOFF,
    y: dockMouth.y + dockDirection.y * AUTO_DOCK_WALL_STANDOFF
  };
  const offsetX = player.x - stagePoint.x;
  const offsetY = player.y - stagePoint.y;
  const distanceFromStation = Math.hypot(player.x - station.x, player.y - station.y);
  const distanceToStage = Math.hypot(offsetX, offsetY);
  const slotOffset = offsetX * -dockDirection.y + offsetY * dockDirection.x;
  const vx = player.vx;
  const vy = player.vy;
  const radialSpeed = -(vx * dockDirection.x + vy * dockDirection.y);
  const tangentialSpeed = Math.abs(vx * -dockDirection.y + vy * dockDirection.x);
  const remainingDistance = Math.max(0, distanceToStage);
  const stoppingDistance = Math.max(0, radialSpeed) * AUTO_DOCK_STOPPING_FACTOR + AUTO_DOCK_STOPPING_BUFFER;
  const onStageRing = distanceToStage <= AUTO_DOCK_STAGE_RADIUS_PADDING * 2;
  const withinWaitBand = distanceToStage <= AUTO_DOCK_WAIT_ENTRY_BAND;
  const readyToWait = Math.abs(radialSpeed) <= AUTO_DOCK_POSITION_HOLD_SPEED && tangentialSpeed <= AUTO_DOCK_TANGENTIAL_HOLD_SPEED;
  const canEnterWait = withinWaitBand && radialSpeed <= AUTO_DOCK_WAIT_ENTRY_SPEED;
  const noseAlignment = clampAngle(player.angle - inwardAngle);
  const doorInFront = Math.abs(slotOffset) <= Math.min(AUTO_DOCK_DOCK_WINDOW, getStationTunnelHalfWidth(station)) && Math.abs(noseAlignment) <= AUTO_DOCK_DOCK_WINDOW * 0.05;

  if (distanceToStage <= AUTO_DOCK_STAGE_RADIUS_PADDING && doorInFront) {
    return {
      turn: getTargetTurn(player.angle, inwardAngle),
      thrust: Math.hypot(player.x - dockPoint.x, player.y - dockPoint.y) > 8 && Math.max(0, radialSpeed) < AUTO_DOCK_INWARD_SPEED ? 1 : 0,
      mode: 'dock',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: slotAngle,
        playerRadialAngle: Math.atan2(player.y - station.y, player.x - station.x),
        slotOffset,
        projectedSlotOffset: slotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius: distanceToStage,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceToStage
      }
    };
  }

  if ((onStageRing && readyToWait) || canEnterWait) {
    return {
      // While waiting, keep the bow pointed at the center and only correct
      // attitude. The ship must not thrust in this phase or it will creep away
      // from the wall and miss the door timing again.
      turn: getTargetTurn(player.angle, inwardAngle),
      thrust: 0,
      mode: 'wait',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: slotAngle,
        playerRadialAngle: Math.atan2(player.y - station.y, player.x - station.x),
        slotOffset,
        projectedSlotOffset: slotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius: distanceToStage,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceToStage
      }
    };
  }

  // Approach now aims at the tunnel mouth staging point instead of the station
  // center, so both manual docking and auto-dock converge on the visible tube.
  if (distanceToStage < AUTO_DOCK_STAGE_RADIUS_PADDING) {
    return {
      turn: getTargetTurn(player.angle, slotAngle),
      thrust: 1,
      mode: 'approach',
      debug: {
        currentSlotAngle: slotAngle,
        expectedSlotAngle: slotAngle,
        playerRadialAngle: Math.atan2(player.y - station.y, player.x - station.x),
        slotOffset,
        projectedSlotOffset: slotOffset,
        onStageRing,
        withinWaitBand,
        readyToWait,
        canEnterWait,
        doorInFront,
        distanceFromStation,
        stageRadius: distanceToStage,
        radialSpeed,
        tangentialSpeed,
        stageRadiusError: distanceToStage
      }
    };
  }

  const shouldBrake = remainingDistance <= stoppingDistance;
  const turn = getTargetTurn(player.angle, Math.atan2(stagePoint.y - player.y, stagePoint.x - player.x));
  const shouldThrust = !shouldBrake && radialSpeed < AUTO_DOCK_APPROACH_SPEED;

  return {
    turn,
    thrust: shouldThrust ? 1 : 0,
    mode: 'approach',
    debug: {
      currentSlotAngle: slotAngle,
      expectedSlotAngle: slotAngle,
      playerRadialAngle: Math.atan2(player.y - station.y, player.x - station.x),
      slotOffset,
      projectedSlotOffset: slotOffset,
      onStageRing,
      withinWaitBand,
      readyToWait,
      canEnterWait,
      doorInFront,
      distanceFromStation,
      stageRadius: distanceToStage,
      radialSpeed,
      tangentialSpeed,
      stageRadiusError: distanceToStage
    }
  };
}
