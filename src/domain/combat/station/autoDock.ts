import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation } from '../types';
import { getStationDockDirection, getStationDockMouthPoint, getStationDockPoint, getStationTunnelHalfWidth } from './stationGeometry';

export type AutoDockPhase = 'acquire-orbit' | 'orbit' | 'inward';

/**
 * Auto-dock now follows an explicit orbital interception plan:
 * 1. capture a circular holding orbit around the station at radius X
 * 2. move around that orbit opposite the station rotation
 * 3. compute when the rotating door will reach the ship's radial line
 * 4. burn straight inward toward the station center at that lead angle
 */
export interface AutoDockState {
  phase: AutoDockPhase;
  orbitRadius?: number;
}

/**
 * Frame-local steering output for the docking computer.
 *
 * `mode` is renderer/UI facing, while `phase` in `debug` describes the actual
 * state-machine branch used to generate this command.
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
    targetOrbitAngle?: number;
    orbitRadius?: number;
    leadAngle?: number;
  };
}

export interface AutoDockStep {
  state: AutoDockState;
  command: AutoDockCommand;
}

const AUTO_DOCK_ORBIT_MARGIN = 56;
const AUTO_DOCK_ORBIT_RADIUS_BAND = 10;
const AUTO_DOCK_ORBIT_SPEED = 0.95;
const AUTO_DOCK_ORBIT_CAPTURE_SPEED = 0.55;
const AUTO_DOCK_ORBIT_RADIAL_GAIN = 0.06;
const AUTO_DOCK_ORBIT_RADIAL_LIMIT = 0.75;
const AUTO_DOCK_ORBIT_ANGLE_WINDOW = 0.14;
const AUTO_DOCK_INWARD_SPEED = 2.6;
const AUTO_DOCK_STOPPING_FACTOR = 70;
const AUTO_DOCK_STOPPING_BUFFER = 8;
const AUTO_DOCK_ALIGNMENT_WINDOW = 0.22;

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function getTargetTurn(currentAngle: number, desiredAngle: number) {
  return clampUnit(clampAngle(desiredAngle - currentAngle) / 0.12);
}

function createDebug(
  phase: AutoDockPhase,
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>,
  targetPoint: { x: number; y: number },
  slotAngle: number,
  doorInFront: boolean,
  extras: Partial<Pick<AutoDockCommand['debug'], 'targetOrbitAngle' | 'orbitRadius' | 'leadAngle'>> = {}
): AutoDockCommand['debug'] {
  const dockDirection = getStationDockDirection(station);
  const offsetX = player.x - targetPoint.x;
  const offsetY = player.y - targetPoint.y;
  const distanceToTarget = Math.hypot(offsetX, offsetY);
  const radialSpeed = -(player.vx * dockDirection.x + player.vy * dockDirection.y);
  const tangentialSpeed = Math.abs(player.vx * -dockDirection.y + player.vy * dockDirection.x);
  const slotOffset = (player.x - station.x) * -dockDirection.y + (player.y - station.y) * dockDirection.x;

  return {
    phase,
    currentSlotAngle: slotAngle,
    expectedSlotAngle: slotAngle,
    playerRadialAngle: Math.atan2(player.y - station.y, player.x - station.x),
    slotOffset,
    projectedSlotOffset: slotOffset,
    onStageRing: distanceToTarget <= AUTO_DOCK_ORBIT_RADIUS_BAND,
    withinWaitBand: distanceToTarget <= AUTO_DOCK_ORBIT_RADIUS_BAND,
    readyToWait: Math.hypot(player.vx, player.vy) <= AUTO_DOCK_ORBIT_CAPTURE_SPEED,
    canEnterWait: distanceToTarget <= AUTO_DOCK_ORBIT_RADIUS_BAND,
    doorInFront,
    distanceFromStation: Math.hypot(player.x - station.x, player.y - station.y),
    stageRadius: distanceToTarget,
    radialSpeed,
    tangentialSpeed,
    stageRadiusError: distanceToTarget,
    ...extras
  };
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
    thrust: distance > 1 && distance > stoppingDistance && forwardSpeed < speedLimit ? 1 : 0,
    distance
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

export function createAutoDockState(): AutoDockState {
  return { phase: 'acquire-orbit' };
}

export function stepAutoDockState(
  state: AutoDockState,
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
): AutoDockStep {
  const corridor = getCorridorMetrics(station, player);
  const tunnelHalfWidth = getStationTunnelHalfWidth(station);
  const dockMouth = getStationDockMouthPoint(station);
  const mouthRadius = Math.hypot(dockMouth.x - station.x, dockMouth.y - station.y);
  const orbitRadius = state.orbitRadius ?? mouthRadius + AUTO_DOCK_ORBIT_MARGIN;
  if (state.orbitRadius === undefined) {
    state = { ...state, orbitRadius };
  }
  const playerOffsetX = player.x - station.x;
  const playerOffsetY = player.y - station.y;
  const playerRadius = Math.hypot(playerOffsetX, playerOffsetY);
  const playerAngle = Math.atan2(playerOffsetY, playerOffsetX);
  const rotSign = station.rotSpeed >= 0 ? 1 : -1;
  const outwardDirection = playerRadius > 1e-6
    ? { x: playerOffsetX / playerRadius, y: playerOffsetY / playerRadius }
    : { x: Math.cos(playerAngle), y: Math.sin(playerAngle) };
  // Orbiting must be tangent to the ship's own radius around the station, not
  // tangent to the current door angle. Using the door axis here makes the
  // ship drift across the hull instead of circling cleanly at radius X.
  const oppositeTangentialDirection = rotSign >= 0
    ? { x: outwardDirection.y, y: -outwardDirection.x }
    : { x: -outwardDirection.y, y: outwardDirection.x };
  const currentSpeed = Math.hypot(player.vx, player.vy);
  const inwardTravelTime = Math.max(0, orbitRadius - mouthRadius) / AUTO_DOCK_INWARD_SPEED;
  const leadAngle = Math.abs(station.rotSpeed) * inwardTravelTime;
  // The inward burn preserves the ship's current polar angle while the door
  // continues rotating. To meet the opening, the ship must start its radial
  // run from the door's future angle, not from a lagging angle behind it.
  const targetOrbitAngle = corridor.slotAngle + rotSign * leadAngle;
  const orbitAngleError = clampAngle(targetOrbitAngle - playerAngle);
  const doorInFront =
    Math.abs(corridor.lateralOffset) <= tunnelHalfWidth * 0.5 &&
    corridor.axialOffset >= -8 &&
    Math.abs(corridor.noseAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW;

  if (state.phase === 'inward') {
    const dockPoint = getStationDockPoint(station);
    const inwardSpeed = Math.max(0, -(player.vx * corridor.dockDirection.x + player.vy * corridor.dockDirection.y));
    const shouldThrust =
      Math.abs(corridor.noseAlignment) <= AUTO_DOCK_ALIGNMENT_WINDOW &&
      inwardSpeed < AUTO_DOCK_INWARD_SPEED;

    if (Math.abs(clampAngle(corridor.slotAngle - playerAngle)) > leadAngle + 0.3) {
      state = { phase: 'orbit', orbitRadius };
    } else {
      return {
        state,
        command: {
          turn: getTargetTurn(player.angle, Math.atan2(station.y - player.y, station.x - player.x)),
          thrust: shouldThrust ? 1 : 0,
          mode: 'dock',
          debug: createDebug(state.phase, station, player, dockPoint, corridor.slotAngle, doorInFront, {
            targetOrbitAngle,
            orbitRadius,
            leadAngle
          })
        }
      };
    }
  }

  if (state.phase === 'orbit') {
    const radialCorrection = Math.max(
      -AUTO_DOCK_ORBIT_RADIAL_LIMIT,
      Math.min(AUTO_DOCK_ORBIT_RADIAL_LIMIT, (orbitRadius - playerRadius) * AUTO_DOCK_ORBIT_RADIAL_GAIN)
    );
    const desiredVelocity = {
      x: oppositeTangentialDirection.x * AUTO_DOCK_ORBIT_SPEED + outwardDirection.x * radialCorrection,
      y: oppositeTangentialDirection.y * AUTO_DOCK_ORBIT_SPEED + outwardDirection.y * radialCorrection
    };
    const desiredSpeed = Math.hypot(desiredVelocity.x, desiredVelocity.y);
    const desiredHeading = desiredSpeed > 1e-6 ? Math.atan2(desiredVelocity.y, desiredVelocity.x) : player.angle;
    const forwardSpeed = desiredSpeed > 1e-6 ? player.vx * (desiredVelocity.x / desiredSpeed) + player.vy * (desiredVelocity.y / desiredSpeed) : 0;

    if (Math.abs(playerRadius - orbitRadius) <= AUTO_DOCK_ORBIT_RADIUS_BAND && Math.abs(orbitAngleError) <= AUTO_DOCK_ORBIT_ANGLE_WINDOW) {
      state = { phase: 'inward', orbitRadius };
      return stepAutoDockState(state, station, player);
    }

    return {
      state,
        command: {
          turn: getTargetTurn(player.angle, desiredHeading),
          thrust: forwardSpeed < desiredSpeed && currentSpeed < AUTO_DOCK_ORBIT_SPEED + 0.5 ? 1 : 0,
          mode: 'approach',
          debug: createDebug(
          state.phase,
          station,
          player,
            {
              x: station.x + Math.cos(targetOrbitAngle) * orbitRadius,
              y: station.y + Math.sin(targetOrbitAngle) * orbitRadius
            },
            corridor.slotAngle,
            doorInFront,
            {
              targetOrbitAngle,
              orbitRadius,
              leadAngle
            }
          )
        }
      };
  }

  const orbitTarget = {
    // Orbit capture should only push the ship onto the desired radius. If this
    // point itself rotates with the door, the ship ends up chasing a moving
    // target and can cut inward into the station before ever reaching orbit.
    x: station.x + outwardDirection.x * orbitRadius,
    y: station.y + outwardDirection.y * orbitRadius
  };
  const steering = steerToTarget(player, orbitTarget, AUTO_DOCK_ORBIT_SPEED);

  if (Math.abs(playerRadius - orbitRadius) <= AUTO_DOCK_ORBIT_RADIUS_BAND && currentSpeed <= AUTO_DOCK_ORBIT_CAPTURE_SPEED) {
    state = { phase: 'orbit', orbitRadius };
    return stepAutoDockState(state, station, player);
  }

  return {
    state,
    command: {
      turn: steering.turn,
      thrust: steering.thrust,
      mode: 'approach',
      debug: createDebug(state.phase, station, player, orbitTarget, corridor.slotAngle, doorInFront, {
        targetOrbitAngle,
        orbitRadius,
        leadAngle
      })
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
