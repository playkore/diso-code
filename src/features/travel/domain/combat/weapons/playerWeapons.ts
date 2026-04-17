import { clampAngle, clampLaserHeat, getLaserHeatPerShot, getLaserWeaponProfile, pushMessage } from '../state';
import type { CombatEnemy, PlayerTargetLock, RandomSource, TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../../../commander/domain/shipCatalog';
import { PLAYER_TARGET_LOCK_RANGE } from '../navigation';
import { destroyEnemy } from '../scoring/salvage';

const PLAYER_LASER_SECTOR_HALF_ANGLE = Math.PI / 4;

function getMountAngle(playerAngle: number, mount: LaserMountPosition): number {
  switch (mount) {
    case 'rear':
      return playerAngle + Math.PI;
    case 'left':
      return playerAngle - Math.PI / 2;
    case 'right':
      return playerAngle + Math.PI / 2;
    case 'front':
    default:
      return playerAngle;
  }
}

/**
 * Converts an enemy bearing into the one 90-degree sector that currently owns
 * it. The sectors intentionally tile the full circle without overlap so a
 * target can hand off cleanly between mounts as it crosses a boundary.
 */
function getEnemySectorMount(state: TravelCombatState, enemy: CombatEnemy): LaserMountPosition {
  const dx = enemy.x - state.player.x;
  const dy = enemy.y - state.player.y;
  const relativeBearing = clampAngle(Math.atan2(dy, dx) - state.player.angle);

  if (relativeBearing > PLAYER_LASER_SECTOR_HALF_ANGLE && relativeBearing <= PLAYER_LASER_SECTOR_HALF_ANGLE * 3) {
    return 'right';
  }
  if (relativeBearing < -PLAYER_LASER_SECTOR_HALF_ANGLE && relativeBearing >= -PLAYER_LASER_SECTOR_HALF_ANGLE * 3) {
    return 'left';
  }
  if (Math.abs(relativeBearing) <= PLAYER_LASER_SECTOR_HALF_ANGLE) {
    return 'front';
  }
  return 'rear';
}

function getTargetSectorLaser(
  state: TravelCombatState,
  enemy: CombatEnemy
): { mount: LaserMountPosition; laserId: LaserId | null; distance: number } {
  const mount = getEnemySectorMount(state, enemy);
  const laserId = state.playerLoadout.laserMounts[mount];
  const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  return { mount, laserId, distance };
}

function findEnemyById(state: TravelCombatState, enemyId: number) {
  return state.enemies.find((enemy) => enemy.id === enemyId) ?? null;
}

function isHostileMissionRole(enemy: CombatEnemy) {
  return (
    enemy.missionTag?.role === 'target' ||
    enemy.missionTag?.role === 'ambusher' ||
    enemy.missionTag?.role === 'blockade' ||
    enemy.missionTag?.role === 'scan-hostile'
  );
}

/**
 * Hostility gating lives here so UI hit-testing and auto-fire both share the
 * exact same targeting rules.
 */
export function canEnemyBePlayerTarget(enemy: CombatEnemy) {
  return enemy.roles.hostile || isHostileMissionRole(enemy);
}

/**
 * Auto-targeting only considers hostiles that are currently inside an arc with
 * an installed laser and inside the tighter engagement radius. That keeps the
 * target indicator aligned with what the armed fire-control system should
 * actively track, not just anything visible in the wider camera/radar view.
 */
function getArmedTargetSector(state: TravelCombatState, enemy: CombatEnemy): { mount: LaserMountPosition; laserId: LaserId; distance: number } | null {
  const targetSector = getTargetSectorLaser(state, enemy);
  if (!targetSector.laserId || targetSector.distance > PLAYER_TARGET_LOCK_RANGE) {
    return null;
  }
  return { mount: targetSector.mount, laserId: targetSector.laserId, distance: targetSector.distance };
}

interface ResolvedPlayerTarget {
  enemy: CombatEnemy;
  mount: LaserMountPosition;
  laserId: LaserId | null;
  distance: number;
}

/**
 * Test helper for scenarios that need to seed or clear the renderer-visible
 * target snapshot before the next auto-target refresh runs.
 */
export function setPlayerTargetLock(state: TravelCombatState, enemyId: number | null): PlayerTargetLock | null {
  if (enemyId === null) {
    state.playerTargetLock = null;
    return null;
  }

  const enemy = findEnemyById(state, enemyId);
  if (!enemy || !canEnemyBePlayerTarget(enemy)) {
    state.playerTargetLock = null;
    return null;
  }

  const targetSector = getTargetSectorLaser(state, enemy);
  state.playerTargetLock = { enemyId: enemy.id, mount: targetSector.mount };
  return state.playerTargetLock;
}

/**
 * Resolves the current renderer-visible target snapshot back into live combat
 * data so firing, HUD state, and stale-lock cleanup all read one consistent
 * view of the world.
 */
function resolveCurrentPlayerTarget(state: TravelCombatState): ResolvedPlayerTarget | null {
  const targetLock = state.playerTargetLock;
  if (!targetLock) {
    return null;
  }

  const enemy = findEnemyById(state, targetLock.enemyId);
  if (!enemy) {
    return null;
  }

  const targetSector = getTargetSectorLaser(state, enemy);
  return {
    enemy,
    mount: targetSector.mount,
    laserId: targetSector.laserId,
    distance: targetSector.distance
  };
}

/**
 * Combat now auto-selects the nearest hostile among all arcs with installed
 * lasers. The resulting lock is purely a rendering/firing snapshot and may
 * switch from frame to frame as distances and sectors change.
 */
export function refreshPlayerTargetLock(state: TravelCombatState): PlayerTargetLock | null {
  let bestLock: PlayerTargetLock | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    if (!canEnemyBePlayerTarget(enemy)) {
      continue;
    }
    const targetSector = getArmedTargetSector(state, enemy);
    if (!targetSector || targetSector.distance >= bestDistance) {
      continue;
    }
    bestDistance = targetSector.distance;
    bestLock = { enemyId: enemy.id, mount: targetSector.mount };
  }

  state.playerTargetLock = bestLock;
  return bestLock;
}

export type PlayerTargetIndicatorState = 'ready' | 'warning' | 'overheated';

/**
 * Renderer-facing lock status is derived from the same sector ownership logic
 * as firing so the reticle color always matches the HUD heat meter for the
 * currently armed mount.
 */
export function getPlayerTargetIndicatorState(state: TravelCombatState): PlayerTargetIndicatorState | null {
  const resolvedTarget = resolveCurrentPlayerTarget(state);
  if (!resolvedTarget || resolvedTarget.distance > PLAYER_TARGET_LOCK_RANGE) {
    return null;
  }

  const laserId = resolvedTarget.laserId;
  if (!laserId) {
    return null;
  }

  const heatRatio =
    state.player.maxLaserHeat > 0 ? state.player.laserHeat[resolvedTarget.mount] / state.player.maxLaserHeat : 0;
  if (heatRatio >= 0.8) {
    return 'overheated';
  }
  if (heatRatio >= 0.45) {
    return 'warning';
  }

  return 'ready';
}

function firePlayerLaser(state: TravelCombatState, mount: LaserMountPosition, laserId: LaserId, enemy: CombatEnemy, random: RandomSource) {
  const profile = getLaserWeaponProfile(laserId);
  const spawnAngle = getMountAngle(state.player.angle, mount);
  const originX = state.player.x + Math.cos(spawnAngle) * 12;
  const originY = state.player.y + Math.sin(spawnAngle) * 12;
  const targetDx = enemy.x - originX;
  const targetDy = enemy.y - originY;
  const targetDistance = Math.hypot(targetDx, targetDy);
  const directionX = targetDistance > 0.001 ? targetDx / targetDistance : Math.cos(spawnAngle);
  const directionY = targetDistance > 0.001 ? targetDy / targetDistance : Math.sin(spawnAngle);

  state.player.laserTrace = {
    startX: originX + directionX * 10,
    startY: originY + directionY * 10,
    endX: enemy.x,
    endY: enemy.y
  };

  // Weapon tiers now add onto the commander's RPG attack stat instead of
  // drawing from a separate ship-energy pool, so progression affects every
  // mounted laser without removing the reason to upgrade the hardware.
  enemy.hp = Math.max(0, enemy.hp - (profile.damage + state.player.attack));
  if (enemy.hp <= 0) {
    const enemyIndex = state.enemies.findIndex((candidate) => candidate.id === enemy.id);
    if (enemyIndex >= 0) {
      destroyEnemy(state, enemyIndex, random);
    }
  }
  state.player.fireCooldown = profile.cooldown;
  state.lastPlayerArc = mount;
}

/**
 * Auto-fire always prefers the currently published auto-target lock. If no
 * hostile ship sits inside an armed arc, the weapon controller simply idles.
 */
export function firePlayerLasers(state: TravelCombatState, random: RandomSource) {
  const resolvedTarget = resolveCurrentPlayerTarget(state);
  if (!resolvedTarget) {
    return true;
  }

  if (resolvedTarget.distance > PLAYER_TARGET_LOCK_RANGE) {
    state.playerTargetLock = null;
    return false;
  }

  state.playerTargetLock = { enemyId: resolvedTarget.enemy.id, mount: resolvedTarget.mount };
  const laserId = resolvedTarget.laserId;
  if (!laserId) {
    return false;
  }

  const nextHeat = state.player.laserHeat[resolvedTarget.mount] + getLaserHeatPerShot(laserId);
  if (state.player.laserHeat[resolvedTarget.mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
    state.player.laserHeat[resolvedTarget.mount] = state.player.maxLaserHeat;
    pushMessage(state, 'LASER OVERHEAT', 900);
    return false;
  }

  state.player.laserHeat[resolvedTarget.mount] = clampLaserHeat(
    state.player.laserHeat[resolvedTarget.mount] + getLaserHeatPerShot(laserId),
    state.player.maxLaserHeat
  );
  firePlayerLaser(state, resolvedTarget.mount, laserId, resolvedTarget.enemy, random);
  return true;
}
