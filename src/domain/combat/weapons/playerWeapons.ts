import { getLaserProjectileProfile, projectileId } from '../state';
import type { CombatEnemy, TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../shipCatalog';

function getClosestEnemy(state: TravelCombatState): CombatEnemy | null {
  let closest: CombatEnemy | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = enemy;
    }
  }

  return closest;
}

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

export function determinePlayerArc(state: TravelCombatState): LaserMountPosition {
  const enemy = getClosestEnemy(state);
  if (!enemy) {
    return 'front';
  }

  const bearing = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
  const delta = Math.atan2(Math.sin(bearing - state.player.angle), Math.cos(bearing - state.player.angle));
  if (Math.abs(delta) < Math.PI / 4) {
    return 'front';
  }
  if (Math.abs(delta) > (Math.PI * 3) / 4) {
    return 'rear';
  }
  return delta < 0 ? 'left' : 'right';
}

export function spawnPlayerLaser(state: TravelCombatState, mount: LaserMountPosition, laserId: LaserId) {
  const profile = getLaserProjectileProfile(laserId);
  const angle = getMountAngle(state.player.angle, mount);
  state.projectiles.push({
    id: projectileId(state),
    kind: 'laser',
    owner: 'player',
    x: state.player.x + Math.cos(angle) * 12,
    y: state.player.y + Math.sin(angle) * 12,
    vx: Math.cos(angle) * profile.speed + state.player.vx,
    vy: Math.sin(angle) * profile.speed + state.player.vy,
    damage: profile.damage,
    life: profile.life
  });
  state.player.fireCooldown = profile.cooldown;
  state.lastPlayerArc = mount;
}
