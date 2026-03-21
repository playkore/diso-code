import { pushMessage } from '../state';
import type { RandomSource, TravelCombatState } from '../types';

const STATION_LAUNCH_DISTANCE = 240;
const HYPERSPACE_ARRIVAL_MIN_DISTANCE = 10_000;
const HYPERSPACE_ARRIVAL_MAX_DISTANCE = 20_000;

export function enterStationSpace(
  state: TravelCombatState,
  random: RandomSource,
  options: { rewardScore?: boolean; message?: string } = {}
) {
  state.station = {
    x: Math.round((random.nextFloat() - 0.5) * 120),
    y: -320 - Math.round(random.nextFloat() * 60),
    radius: 80,
    angle: 0,
    rotSpeed: 0.005,
    safeZoneRadius: 360
  };
  state.player.x = state.station.x;
  state.player.y = state.station.y + STATION_LAUNCH_DISTANCE;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.angle = -Math.PI / 2;
  state.enemies = state.enemies.filter((enemy) => enemy.roles.cop || enemy.missionTag);
  state.projectiles = [];
  state.encounter.safeZone = false;
  if (options.rewardScore) {
    state.score += 250;
  }
  if (options.message) {
    pushMessage(state, options.message, 1800);
  }
}

export function enterArrivalSpace(state: TravelCombatState, random: RandomSource) {
  enterStationSpace(state, random, { rewardScore: true, message: 'SYSTEM REACHED' });
  if (!state.station) {
    return;
  }

  const arrivalDistance =
    HYPERSPACE_ARRIVAL_MIN_DISTANCE +
    Math.round(random.nextFloat() * (HYPERSPACE_ARRIVAL_MAX_DISTANCE - HYPERSPACE_ARRIVAL_MIN_DISTANCE));
  state.player.y = state.station.y + arrivalDistance;
  state.encounter.safeZone = false;
}
