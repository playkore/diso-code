import type { TravelCombatState } from './types';

export const MASS_LOCK_DISTANCE = 600;
export const RADAR_SHIP_RANGE = 600;
/**
 * Auto-target lock intentionally uses a tighter radius than the full radar
 * sweep so the fire-control system only tracks ships inside the player's local
 * engagement bubble instead of contacts that merely happen to be on screen.
 */
export const PLAYER_TARGET_LOCK_RANGE = 320;
export const LOCAL_JUMP_SPEED_MULTIPLIER = 10;

export function getDistanceToStation(state: TravelCombatState) {
  if (!state.station) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(state.station.x - state.player.x, state.station.y - state.player.y);
}

export function isMassNearby(state: TravelCombatState, distance = MASS_LOCK_DISTANCE) {
  if (getDistanceToStation(state) <= distance) {
    return true;
  }
  return state.enemies.some((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= distance);
}

export function isPlayerInStationSafeZone(state: TravelCombatState) {
  return Boolean(state.station && getDistanceToStation(state) <= state.station.safeZoneRadius);
}

export function getVisibleRadarContacts(state: TravelCombatState, distance = RADAR_SHIP_RANGE) {
  return state.enemies.filter((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= distance);
}
