import type { TravelCombatState } from './types';

export const MASS_LOCK_DISTANCE = 600;
export const RADAR_SHIP_RANGE = 600;
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

/**
 * Auto-dock may only be requested once the commander owns the docking computer
 * and has flown back into the protected station approach corridor.
 */
export function canAutoDock(state: TravelCombatState) {
  return state.playerLoadout.installedEquipment.docking_computer && isPlayerInStationSafeZone(state);
}

export function getVisibleRadarContacts(state: TravelCombatState, distance = RADAR_SHIP_RANGE) {
  return state.enemies.filter((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) <= distance);
}
