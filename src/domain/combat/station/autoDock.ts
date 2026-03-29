import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation } from '../types';
import { getStationDockDirection, getStationDockMouthPoint, getStationTunnelHalfWidth } from './stationGeometry';

export type AutoDockPhase = 'approach' | 'align' | 'wait' | 'inward';

/**
 * The docking computer now runs a lead-angle intercept instead of circling the
 * station:
 * 1. stop on a safe staging radius outside the hull
 * 2. point the nose at the station center
 * 3. estimate the inward travel time to the docking mouth
 * 4. wait until the rotating slot reaches the required lead angle
 * 5. burn straight toward the center and let the door rotate onto that line
 */
export interface AutoDockState {
  phase: AutoDockPhase;
  stageRadius?: number;
}

export interface AutoDockTuning {
  leadTimeBias?: number;
}

/**
 * Frame-local steering output for the docking computer.
 *
 * `mode` is renderer/UI facing, while `phase` in `debug` exposes the exact
 * state-machine branch that produced the command.
 */
export interface AutoDockCommand {
  turn: number;
  thrust: number;
  mode: 'approach' | 'wait' | 'dock';
  debug: {
    phase: AutoDockPhase;
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
    leadAngle?: number;
    inwardTravelTime?: number;
    noseError?: number;
  };
}

export interface AutoDockStep {
  state: AutoDockState;
  command: AutoDockCommand;
}

const AUTO_DOCK_STAGE_MARGIN = 56;
const AUTO_DOCK_STAGE_RADIUS_BAND = 10;
const AUTO_DOCK_CAPTURE_SPEED = 0.55;
const AUTO_DOCK_INWARD_SPEED = 2.6;
const AUTO_DOCK_STOPPING_FACTOR = 70;
const AUTO_DOCK_STOPPING_BUFFER = 8;
const AUTO_DOCK_ALIGNMENT_WINDOW = 0.16;
const AUTO_DOCK_WAIT_ANGLE_WINDOW = 0.14;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getTargetTurn(currentAngle: number, desiredAngle: number) {
  return clampUnit(clampAngle(desiredAngle - currentAngle) / 0.12);
}

function steerToTarget(
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>,
  targetPoint: { x: number; y: number },
  speedLimit: number
) {
  const deltaX = targetPoint.x - player.x;
  const deltaY = targetPoint.y - player.y;
  const distance = Math.hypot(deltaX, deltaY);
  const direction = distance > 1e-6
    ? { x: deltaX / distance, y: deltaY / distance }
    : { x: 0, y: 0 };
  const forwardSpeed = player.vx * direction.x + player.vy * direction.y;
  const stoppingDistance = Math.max(0, forwardSpeed) * AUTO_DOCK_STOPPING_FACTOR + AUTO_DOCK_STOPPING_BUFFER;

  return {
    turn: getTargetTurn(player.angle, Math.atan2(deltaY, deltaX)),
    thrust: distance > 1 && distance > stoppingDistance && forwardSpeed < speedLimit ? 1 : 0
  };
}

function getCorridorMetrics(station: CombatStation, player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>) {
  const dockDirection = getStationDockDirection(station);
  const dockMouth = getStationDockMouthPoint(station);
  const offsetX = player.x - dockMouth.x;
  const offsetY = player.y - dockMouth.y;
  const axialOffset = offsetX * dockDirection.x + offsetY * dockDirection.y;
  const lateralOffset = offsetX * -dockDirection.y + offsetY * dockDirection.x;
  const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
  const inwardAngle = slotAngle + Math.PI;
  const noseAlignment = clampAngle(player.angle - inwardAngle);

  return {
    dockDirection,
    slotAngle,
    inwardAngle,
    axialOffset,
    lateralOffset,
    noseAlignment
  };
}

function createDebug(
  phase: AutoDockPhase,
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>,
  stageRadius: number,
  corridor: ReturnType<typeof getCorridorMetrics>,
  centerAlignment: number,
  leadAngle: number,
  inwardTravelTime: number
): AutoDockCommand['debug'] {
  const playerOffsetX = player.x - station.x;
  const playerOffsetY = player.y - station.y;
  const playerRadius = Math.hypot(playerOffsetX, playerOffsetY);
  const playerAngle = Math.atan2(playerOffsetY, playerOffsetX);
  const radialDirection = playerRadius > 1e-6
    ? { x: playerOffsetX / playerRadius, y: playerOffsetY / playerRadius }
    : { x: Math.cos(playerAngle), y: Math.sin(playerAngle) };
  const radialSpeed = -(player.vx * radialDirection.x + player.vy * radialDirection.y);
  const tangentialSpeed = Math.abs(player.vx * -radialDirection.y + player.vy * radialDirection.x);
  const stageRadiusError = playerRadius - stageRadius;
  const leadError = clampAngle((playerAngle - corridor.slotAngle) - leadAngle);

  return {
    phase,
    currentSlotAngle: corridor.slotAngle,
    expectedSlotAngle: corridor.slotAngle + leadAngle,
    playerRadialAngle: playerAngle,
    slotOffset: corridor.lateralOffset,
    projectedSlotOffset: leadError,
    onStageRing: Math.abs(stageRadiusError) <= AUTO_DOCK_STAGE_RADIUS_BAND,
    withinWaitBand: Math.abs(leadError) <= AUTO_DOCK_WAIT_ANGLE_WINDOW,
    readyToWait: Math.hypot(player.vx, player.vy) <= AUTO_DOCK_CAPTURE_SPEED,
    canEnterWait:
      Math.abs(stageRadiusError) <= AUTO_DOCK_STAGE_RADIUS_BAND &&
      Math.abs(corridor.noseAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW &&
      Math.hypot(player.vx, player.vy) <= AUTO_DOCK_CAPTURE_SPEED,
    doorInFront:
      Math.abs(corridor.lateralOffset) <= getStationTunnelHalfWidth(station) * 0.5 &&
      corridor.axialOffset >= -8 &&
      Math.abs(centerAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW,
    distanceFromStation: playerRadius,
    stageRadius,
    radialSpeed,
    tangentialSpeed,
    stageRadiusError,
    leadAngle,
    inwardTravelTime,
    noseError: centerAlignment
  };
}

export function createAutoDockState(): AutoDockState {
  return { phase: 'approach' };
}

export function stepAutoDockState(
  state: AutoDockState,
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>,
  tuning: AutoDockTuning = {}
): AutoDockStep {
  const corridor = getCorridorMetrics(station, player);
  const dockMouth = getStationDockMouthPoint(station);
  const mouthRadius = Math.hypot(dockMouth.x - station.x, dockMouth.y - station.y);
  const stageRadius = state.stageRadius ?? mouthRadius + AUTO_DOCK_STAGE_MARGIN;
  if (state.stageRadius === undefined) {
    state = { ...state, stageRadius };
  }

  const playerOffsetX = player.x - station.x;
  const playerOffsetY = player.y - station.y;
  const playerRadius = Math.hypot(playerOffsetX, playerOffsetY);
  const playerAngle = Math.atan2(playerOffsetY, playerOffsetX);
  const currentSpeed = Math.hypot(player.vx, player.vy);
  const radialDirection = playerRadius > 1e-6
    ? { x: playerOffsetX / playerRadius, y: playerOffsetY / playerRadius }
    : { x: Math.cos(playerAngle), y: Math.sin(playerAngle) };
  const stageTarget = {
    x: station.x + radialDirection.x * stageRadius,
    y: station.y + radialDirection.y * stageRadius
  };
  const inwardHeading = Math.atan2(station.y - player.y, station.x - player.x);
  const centerAlignment = clampAngle(player.angle - inwardHeading);
  const inwardTravelDistance = Math.max(0, playerRadius - mouthRadius);
  const inwardTravelTime = Math.max(0, inwardTravelDistance / AUTO_DOCK_INWARD_SPEED + (tuning.leadTimeBias ?? 0));
  const leadAngle = station.rotSpeed * inwardTravelTime;
  const leadError = clampAngle((playerAngle - corridor.slotAngle) - leadAngle);
  const debug = createDebug(state.phase, station, player, stageRadius, corridor, centerAlignment, leadAngle, inwardTravelTime);

  if (state.phase === 'approach') {
    const steering = steerToTarget(player, stageTarget, AUTO_DOCK_CAPTURE_SPEED);
    if (Math.abs(playerRadius - stageRadius) <= AUTO_DOCK_STAGE_RADIUS_BAND && currentSpeed <= AUTO_DOCK_CAPTURE_SPEED) {
      state = { phase: 'align', stageRadius };
      return stepAutoDockState(state, station, player, tuning);
    }

    return {
      state,
      command: {
        turn: steering.turn,
        thrust: steering.thrust,
        mode: 'approach',
        debug
      }
    };
  }

  if (Math.abs(playerRadius - stageRadius) > AUTO_DOCK_STAGE_RADIUS_BAND * 1.5) {
    state = { phase: 'approach', stageRadius };
    return stepAutoDockState(state, station, player, tuning);
  }

  if (state.phase === 'align') {
    if (Math.abs(centerAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW) {
      state = { phase: 'wait', stageRadius };
      return stepAutoDockState(state, station, player, tuning);
    }

    return {
      state,
      command: {
        turn: getTargetTurn(player.angle, inwardHeading),
        thrust: 0,
        mode: 'wait',
        debug
      }
    };
  }

  if (state.phase === 'wait') {
    if (Math.abs(centerAlignment) > AUTO_DOCK_ALIGNMENT_WINDOW * 1.25) {
      state = { phase: 'align', stageRadius };
      return stepAutoDockState(state, station, player, tuning);
    }
    if (Math.abs(leadError) <= AUTO_DOCK_WAIT_ANGLE_WINDOW) {
      state = { phase: 'inward', stageRadius };
      return stepAutoDockState(state, station, player, tuning);
    }

    return {
      state,
      command: {
        turn: getTargetTurn(player.angle, inwardHeading),
        thrust: 0,
        mode: 'wait',
        debug
      }
    };
  }

  const inwardSpeed = Math.max(0, -(player.vx * radialDirection.x + player.vy * radialDirection.y));
  const shouldThrust = Math.abs(centerAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW && inwardSpeed < AUTO_DOCK_INWARD_SPEED;
  return {
    state,
    command: {
      turn: getTargetTurn(player.angle, inwardHeading),
      thrust: shouldThrust ? 1 : 0,
      mode: 'dock',
      debug
    }
  };
}

/**
 * Stateless compatibility wrapper for older callers such as ambient station
 * traffic. The player-facing docking computer uses `stepAutoDockState(...)`
 * so it can preserve its phase machine across frames.
 */
export function getAutoDockCommand(
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
) {
  return stepAutoDockState(createAutoDockState(), station, player).command;
}
