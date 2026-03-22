import { clampLaserHeat, getLaserEnergyCost, getLaserHeatPerShot, getLaserProjectileProfile, projectileId, pushMessage, spendPlayerEnergy } from '../state';
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

/**
 * Each installed laser mount owns its own heat budget. The fire-control pass
 * therefore filters mounts by their individual overheat state, then spends
 * energy and adds heat only for the arcs that are actually able to fire.
 */
export function firePlayerLasers(state: TravelCombatState) {
  const firingMounts = getPlayerFiringMounts(state);
  if (firingMounts.length === 0) {
    state.lastPlayerArc = 'front';
    return false;
  }

  let totalCost = 0;
  let anyOverheated = false;
  const mountedLasers: Array<{ mount: LaserMountPosition; laserId: LaserId }> = [];
  for (const mount of firingMounts) {
    const laserId = state.playerLoadout.laserMounts[mount];
    if (!laserId) {
      continue;
    }
    const nextHeat = state.player.laserHeat[mount] + getLaserHeatPerShot(laserId);
    if (state.player.laserHeat[mount] >= state.player.maxLaserHeat || nextHeat > state.player.maxLaserHeat) {
      state.player.laserHeat[mount] = state.player.maxLaserHeat;
      anyOverheated = true;
      continue;
    }
    mountedLasers.push({ mount, laserId });
    totalCost += getLaserEnergyCost(laserId);
  }

  if (mountedLasers.length === 0) {
    if (anyOverheated) {
      pushMessage(state, 'LASER OVERHEAT', 900);
    }
    return false;
  }
  if (!spendPlayerEnergy(state, totalCost)) {
    pushMessage(state, 'ENERGY LOW', 900);
    return false;
  }

  for (const { mount, laserId } of mountedLasers) {
    state.player.laserHeat[mount] = clampLaserHeat(state.player.laserHeat[mount] + getLaserHeatPerShot(laserId), state.player.maxLaserHeat);
    spawnPlayerLaser(state, mount, laserId);
  }
  if (anyOverheated) {
    pushMessage(state, 'LASER OVERHEAT', 900);
  }
  return true;
}
