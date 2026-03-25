import { clampAngle, clampLaserHeat, getLaserEnergyCost, getLaserHeatPerShot, getLaserProjectileProfile, projectileId, pushMessage, spendPlayerEnergy } from '../state';
import type { CombatEnemy, PlayerTargetLock, TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../shipCatalog';

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

function getReachableLaserForEnemy(
  state: TravelCombatState,
  enemy: CombatEnemy
): { mount: LaserMountPosition; laserId: LaserId; distance: number } | null {
  const mount = getEnemySectorMount(state, enemy);
  const laserId = state.playerLoadout.laserMounts[mount];
  if (!laserId) {
    return null;
  }

  const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  const profile = getLaserProjectileProfile(laserId);
  if (distance > profile.speed * profile.life) {
    return null;
  }

  return { mount, laserId, distance };
}

function findEnemyById(state: TravelCombatState, enemyId: number) {
  return state.enemies.find((enemy) => enemy.id === enemyId) ?? null;
}

/**
 * Player lock state is sticky by default: we keep the current target while it
 * remains inside a sector backed by an installed, in-range laser. Only then do
 * we preserve focus; otherwise we fall back to the closest newly reachable foe.
 */
export function syncPlayerTargetLock(state: TravelCombatState): PlayerTargetLock | null {
  const currentLock = state.playerTargetLock;
  if (currentLock) {
    const currentEnemy = findEnemyById(state, currentLock.enemyId);
    if (currentEnemy) {
      const reachable = getReachableLaserForEnemy(state, currentEnemy);
      if (reachable) {
        state.playerTargetLock = { enemyId: currentEnemy.id, mount: reachable.mount };
        return state.playerTargetLock;
      }
    }
  }

  let bestLock: PlayerTargetLock | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    const reachable = getReachableLaserForEnemy(state, enemy);
    if (!reachable || reachable.distance >= bestDistance) {
      continue;
    }
    bestDistance = reachable.distance;
    bestLock = { enemyId: enemy.id, mount: reachable.mount };
  }

  state.playerTargetLock = bestLock;
  return bestLock;
}

function spawnPlayerLaser(state: TravelCombatState, mount: LaserMountPosition, laserId: LaserId, enemy: CombatEnemy) {
  const profile = getLaserProjectileProfile(laserId);
  const spawnAngle = getMountAngle(state.player.angle, mount);
  const originX = state.player.x + Math.cos(spawnAngle) * 12;
  const originY = state.player.y + Math.sin(spawnAngle) * 12;
  const aimDx = enemy.x - originX;
  const aimDy = enemy.y - originY;
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
    targetEnemyId: enemy.id
  });
  state.player.fireCooldown = profile.cooldown;
  state.lastPlayerArc = mount;
}

/**
 * Fire control now behaves like a target-lock system rather than a broadside.
 * Pressing fire acquires the closest reachable enemy, then only the sector-owning
 * mount spends energy and heat to keep that lock engaged.
 */
export function firePlayerLasers(state: TravelCombatState) {
  const targetLock = syncPlayerTargetLock(state);
  if (!targetLock) {
    return false;
  }

  const enemy = findEnemyById(state, targetLock.enemyId);
  if (!enemy) {
    state.playerTargetLock = null;
    return false;
  }

  const laserId = state.playerLoadout.laserMounts[targetLock.mount];
  if (!laserId) {
    state.playerTargetLock = null;
    return false;
  }

  const nextHeat = state.player.laserHeat[targetLock.mount] + getLaserHeatPerShot(laserId);
  if (state.player.laserHeat[targetLock.mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
    state.player.laserHeat[targetLock.mount] = state.player.maxLaserHeat;
    pushMessage(state, 'LASER OVERHEAT', 900);
    return false;
  }

  if (!spendPlayerEnergy(state, getLaserEnergyCost(laserId))) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }

  state.player.laserHeat[targetLock.mount] = clampLaserHeat(
    state.player.laserHeat[targetLock.mount] + getLaserHeatPerShot(laserId),
    state.player.maxLaserHeat
  );
  spawnPlayerLaser(state, targetLock.mount, laserId, enemy);
  return true;
}
