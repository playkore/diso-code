import { pushMessage } from '../state';
import { getStationSlotAngle } from './docking';
import { getStationRenderScale, STATION_TUNNEL_END_X } from './stationGeometry';
import type { RandomSource, TravelCombatState } from '../types';

const STATION_LAUNCH_CLEARANCE = 28;
const STATION_LAUNCH_SPEED = 2.4;
const HYPERSPACE_ARRIVAL_MIN_DISTANCE = 10_000;
const HYPERSPACE_ARRIVAL_MAX_DISTANCE = 20_000;

export function enterStationSpace(
  state: TravelCombatState,
  random: RandomSource,
  options: { message?: string; playerAngle?: number } = {}
) {
  const stationAngle = random.nextFloat() * Math.PI * 2;
  state.station = {
    x: Math.round((random.nextFloat() - 0.5) * 120),
    y: -320 - Math.round(random.nextFloat() * 60),
    radius: 80,
    // Launches should not always reveal the same station face first; seeding a
    // fresh rotation angle on each station-space entry makes departures feel
    // like they are joining an already-live world state.
    angle: stationAngle,
    rotSpeed: 0.005,
    safeZoneRadius: 360
  };
  const slotAngle = getStationSlotAngle(state.station.angle);
  const launchDistance = STATION_TUNNEL_END_X * getStationRenderScale(state.station) + STATION_LAUNCH_CLEARANCE;
  const launchAngle = slotAngle;
  // Launches start just outside the visible docking door and already drifting
  // outward so leaving a station reads as a continuation of motion rather than
  // a hard reset at an arbitrary point near the station.
  state.player.x = state.station.x + Math.cos(slotAngle) * launchDistance;
  state.player.y = state.station.y + Math.sin(slotAngle) * launchDistance;
  state.player.vx = Math.cos(launchAngle) * STATION_LAUNCH_SPEED;
  state.player.vy = Math.sin(launchAngle) * STATION_LAUNCH_SPEED;
  // When no explicit orientation is requested, align the ship nose with the
  // launch vector so the player starts pointed away from the docking door.
  state.player.angle = options.playerAngle ?? launchAngle;
  state.enemies = state.enemies.filter((enemy) => enemy.roles.cop || enemy.missionTag);
  state.projectiles = [];
  state.encounter.safeZone = false;
  if (options.message) {
    pushMessage(state, options.message, 1800);
  }
}

export function enterArrivalSpace(state: TravelCombatState, random: RandomSource) {
  const playerAngle = state.player.angle;
  enterStationSpace(state, random, { message: 'SYSTEM REACHED', playerAngle });
  if (!state.station) {
    return;
  }

  const arrivalDistance =
    HYPERSPACE_ARRIVAL_MIN_DISTANCE +
    Math.round(random.nextFloat() * (HYPERSPACE_ARRIVAL_MAX_DISTANCE - HYPERSPACE_ARRIVAL_MIN_DISTANCE));
  const arrivalAngle = random.nextFloat() * Math.PI * 2;
  // Hyperspace keeps the ship's nose from the tunnel exit, but the ship should
  // not always materialize on the same station radial. Sampling a fresh polar
  // offset preserves the legacy distance band while making the station appear
  // from any direction around the arrival point.
  state.player.x = state.station.x + Math.cos(arrivalAngle) * arrivalDistance;
  state.player.y = state.station.y + Math.sin(arrivalAngle) * arrivalDistance;
  state.player.vx = Math.cos(state.player.angle) * state.player.maxSpeed;
  state.player.vy = Math.sin(state.player.angle) * state.player.maxSpeed;
  state.encounter.safeZone = false;
}
