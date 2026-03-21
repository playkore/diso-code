import { getLaserProjectileProfile, projectileId } from '../state';
import type { TravelCombatState } from '../types';
import type { LaserId, LaserMountPosition } from '../../shipCatalog';

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

export function getPlayerFiringMounts(state: TravelCombatState): LaserMountPosition[] {
  return (['front', 'left', 'right', 'rear'] as const).filter((mount) => Boolean(state.playerLoadout.laserMounts[mount]));
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
