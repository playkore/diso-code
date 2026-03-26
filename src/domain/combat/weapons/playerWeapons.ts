import { clampAngle, clampLaserHeat, getLaserEnergyCost, getLaserHeatPerShot, getLaserProjectileProfile, projectileId, pushMessage, spendPlayerEnergy } from '../state';
import type { CombatEnemy, PlayerTargetLock, TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../shipCatalog';
import { RADAR_SHIP_RANGE } from '../navigation';

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
 * Explicit target changes come from the travel UI. The stored mount is filled
 * from the current sector-owner so the HUD indicator can render immediately.
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
  if (targetSector.distance > RADAR_SHIP_RANGE) {
    state.playerTargetLock = null;
    return null;
  }

  state.playerTargetLock = { enemyId: enemy.id, mount: targetSector.mount };
  return state.playerTargetLock;
}

/**
 * Lock refresh is independent from button state:
 * - keep the selected hostile while it exists and stays in radar range
 * - drop immediately when the target dies, despawns, or leaves engagement range
 * - never auto-acquire a replacement target
 */
export function refreshPlayerTargetLock(state: TravelCombatState): PlayerTargetLock | null {
  const currentLock = state.playerTargetLock;
  if (!currentLock) {
    return null;
  }

  const currentEnemy = findEnemyById(state, currentLock.enemyId);
  if (!currentEnemy || !canEnemyBePlayerTarget(currentEnemy)) {
    state.playerTargetLock = null;
    return null;
  }

  const targetSector = getTargetSectorLaser(state, currentEnemy);
  if (targetSector.distance > RADAR_SHIP_RANGE) {
    state.playerTargetLock = null;
    return null;
  }

  state.playerTargetLock = { enemyId: currentEnemy.id, mount: targetSector.mount };
  return state.playerTargetLock;
}

export type PlayerTargetIndicatorState = 'missing-laser' | 'ready' | 'overheated';

/**
 * Renderer-facing lock status is derived from the same sector ownership logic
 * as firing so the reticle color always matches weapon availability.
 */
export function getPlayerTargetIndicatorState(state: TravelCombatState): PlayerTargetIndicatorState | null {
  const targetLock = state.playerTargetLock;
  if (!targetLock) {
    return null;
  }

  const enemy = findEnemyById(state, targetLock.enemyId);
  if (!enemy) {
    return null;
  }

  const targetSector = getTargetSectorLaser(state, enemy);
  const laserId = targetSector.laserId;
  if (!laserId) {
    return 'missing-laser';
  }

  const nextHeat = state.player.laserHeat[targetSector.mount] + getLaserHeatPerShot(laserId);
  if (state.player.laserHeat[targetSector.mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
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
 * Fire control prefers the held target lock, but if no ship is currently
 * locked it falls back to a straight shot from the front mount only.
 */
export function firePlayerLasers(state: TravelCombatState) {
  const targetLock = state.playerTargetLock;
  if (!targetLock) {
    const laserId = state.playerLoadout.laserMounts.front;
    if (!laserId) {
      return false;
    }

    const nextHeat = state.player.laserHeat.front + getLaserHeatPerShot(laserId);
    if (state.player.laserHeat.front >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
      state.player.laserHeat.front = state.player.maxLaserHeat;
      pushMessage(state, 'LASER OVERHEAT', 900);
      return false;
    }
    if (!spendPlayerEnergy(state, getLaserEnergyCost(laserId))) {
      pushMessage(state, 'ENERGY LOW', 900);
      return false;
    }

    state.player.laserHeat.front = clampLaserHeat(state.player.laserHeat.front + getLaserHeatPerShot(laserId), state.player.maxLaserHeat);
    spawnPlayerLaser(state, 'front', laserId);
    return true;
  }

  const enemy = findEnemyById(state, targetLock.enemyId);
  if (!enemy) {
    state.playerTargetLock = null;
    return false;
  }

  const targetSector = getTargetSectorLaser(state, enemy);
  state.playerTargetLock = { enemyId: enemy.id, mount: targetSector.mount };
  const laserId = targetSector.laserId;
  if (!laserId) {
    return false;
  }

  const nextHeat = state.player.laserHeat[targetSector.mount] + getLaserHeatPerShot(laserId);
  if (state.player.laserHeat[targetSector.mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
    state.player.laserHeat[targetSector.mount] = state.player.maxLaserHeat;
    pushMessage(state, 'LASER OVERHEAT', 900);
    return false;
  }

  if (!spendPlayerEnergy(state, getLaserEnergyCost(laserId))) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }

  state.player.laserHeat[targetSector.mount] = clampLaserHeat(
    state.player.laserHeat[targetSector.mount] + getLaserHeatPerShot(laserId),
    state.player.maxLaserHeat
  );
  spawnPlayerLaser(state, targetSector.mount, laserId, enemy);
  return true;
}
