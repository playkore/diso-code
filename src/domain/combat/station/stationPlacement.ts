import { pushMessage } from '../state';
import { getStationSlotAngle } from './docking';
import { getStationRenderScale, STATION_TUNNEL_END_X } from './stationGeometry';
import type { RandomSource, TravelCombatState } from '../types';
import type { SeedTriplet } from '../../universe';

const STATION_LAUNCH_CLEARANCE = 28;
const STATION_LAUNCH_SPEED = 2.4;
const HYPERSPACE_ARRIVAL_MIN_DISTANCE = 10_000;
const HYPERSPACE_ARRIVAL_MAX_DISTANCE = 20_000;
const STATION_ROTATION_PERIOD_SECONDS = 20;
const CLASSIC_SIMULATION_TICKS_PER_SECOND = 60;
const STATION_ROTATION_SPEED = (Math.PI * 2) / (STATION_ROTATION_PERIOD_SECONDS * CLASSIC_SIMULATION_TICKS_PER_SECOND);

function getStationAxisAngleFromSystemSeed(seed: SeedTriplet) {
  // Station door direction should be stable per system but still vary across
  // systems. A tiny integer hash over the canonical Elite seed gives us a
  // deterministic pseudo-random angle without storing extra world data.
  let hash = 0x811c9dc5;
  hash = Math.imul(hash ^ seed.w0, 0x01000193);
  hash = Math.imul(hash ^ seed.w1, 0x01000193);
  hash = Math.imul(hash ^ seed.w2, 0x01000193);
  return ((hash >>> 0) / 0x1_0000_0000) * Math.PI * 2;
}

export function enterStationSpace(
  state: TravelCombatState,
  random: RandomSource,
  options: { message?: string; playerAngle?: number; systemSeed?: SeedTriplet } = {}
) {
  const stationAngle = options.systemSeed ? getStationAxisAngleFromSystemSeed(options.systemSeed) : random.nextFloat() * Math.PI * 2;
  const stationSpinAngle = random.nextFloat() * Math.PI * 2;
  state.station = {
    x: Math.round((random.nextFloat() - 0.5) * 120),
    y: -320 - Math.round(random.nextFloat() * 60),
    radius: 80,
    // The docking-axis direction is deterministic per system, so the same
    // system always presents the same door bearing while different systems do
    // not all line up identically.
    angle: stationAngle,
    // The visible octagon should also start at a random phase around that
    // axis; otherwise every launch would reveal the same face arrangement.
    spinAngle: stationSpinAngle,
    // `dt=1` represents one classic 60 Hz simulation tick, so a full turn in
    // 80 seconds maps to `2π / (80 * 60)` radians per tick.
    rotSpeed: STATION_ROTATION_SPEED,
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

export function enterArrivalSpace(
  state: TravelCombatState,
  random: RandomSource,
  options: { systemSeed?: SeedTriplet } = {}
) {
  const playerAngle = state.player.angle;
  enterStationSpace(state, random, { message: 'SYSTEM REACHED', playerAngle, systemSeed: options.systemSeed });
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
