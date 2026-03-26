import { clampAngle, clampLaserHeat, getLaserEnergyCost, getLaserHeatPerShot, getLaserProjectileProfile, projectileId, pushMessage, spendPlayerEnergy } from '../state';
import type { CombatEnemy, PlayerTargetLock, TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../shipCatalog';
import { PLAYER_TARGET_LOCK_RANGE } from '../navigation';

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

export type PlayerTargetIndicatorState = 'missing-laser' | 'ready' | 'overheated';

/**
 * Renderer-facing lock status is derived from the same sector ownership logic
 * as firing so the reticle color always matches weapon availability.
 */
export function getPlayerTargetIndicatorState(state: TravelCombatState): PlayerTargetIndicatorState | null {
  const resolvedTarget = resolveCurrentPlayerTarget(state);
  if (!resolvedTarget || resolvedTarget.distance > PLAYER_TARGET_LOCK_RANGE) {
    return null;
  }

  const laserId = resolvedTarget.laserId;
  if (!laserId) {
    return 'missing-laser';
  }

  const nextHeat = state.player.laserHeat[resolvedTarget.mount] + getLaserHeatPerShot(laserId);
  if (state.player.laserHeat[resolvedTarget.mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
    return 'overheated';
  }

  return 'ready';
}

function spawnPlayerLaser(state: TravelCombatState, mount: LaserMountPosition, laserId: LaserId, enemy?: CombatEnemy) {
  const profile = getLaserProjectileProfile(laserId);
  const spawnAngle = getMountAngle(state.player.angle, mount);
  const originX = state.player.x + Math.cos(spawnAngle) * 12;
  const originY = state.player.y + Math.sin(spawnAngle) * 12;
  const aimDx = enemy ? enemy.x - originX : Math.cos(spawnAngle);
  const aimDy = enemy ? enemy.y - originY : Math.sin(spawnAngle);
  const aimDistance = Math.hypot(aimDx, aimDy);
  const directionX = aimDistance > 0.001 ? aimDx / aimDistance : Math.cos(spawnAngle);
  const directionY = aimDistance > 0.001 ? aimDy / aimDistance : Math.sin(spawnAngle);

  state.projectiles.push({
    id: projectileId(state),
    kind: 'laser',
    owner: 'player',
    x: originX,
    y: originY,
    vx: directionX * profile.speed + state.player.vx,
    vy: directionY * profile.speed + state.player.vy,
    damage: profile.damage,
    life: profile.life,
    sourceMount: mount,
    targetEnemyId: enemy?.id
  });
  state.player.fireCooldown = profile.cooldown;
  state.lastPlayerArc = mount;
}

/**
 * Auto-fire always prefers the currently published auto-target lock. If no
 * hostile ship sits inside an armed arc, the weapon controller simply idles.
 */
export function firePlayerLasers(state: TravelCombatState) {
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

  if (!spendPlayerEnergy(state, getLaserEnergyCost(laserId))) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }

  state.player.laserHeat[resolvedTarget.mount] = clampLaserHeat(
    state.player.laserHeat[resolvedTarget.mount] + getLaserHeatPerShot(laserId),
    state.player.maxLaserHeat
  );
  spawnPlayerLaser(state, resolvedTarget.mount, laserId, resolvedTarget.enemy);
  return true;
}
