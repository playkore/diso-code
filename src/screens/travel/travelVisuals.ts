import type { CombatEnemy, CombatProjectile, CombatShipRoles, TravelCombatState } from '../../domain/travelCombat';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './renderers/constants';
import { getCgaBarFillColor, getSegmentedBankRatios } from './renderers/bars';

/**
 * Shared visual-state helpers for the travel screens.
 *
 * The Three.js scene, the start-screen showcase, and the unit tests all need
 * the same starfield seeds, ship colors, projectile colors, and enemy overlay
 * state. Keeping that logic here avoids duplicating draw code while preserving
 * the runtime scene as the single owner of actual rendering.
 */
export interface StarPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * The starfield is only data here; the renderer decides whether that data is
 * turned into points, streaks, or parallax layers.
 */
export function createStars() {
  const stars: StarPoint[] = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      z: Math.random() * 0.8 + 0.2
    });
  }
  return stars;
}

export function getEnemyColor(roles: CombatShipRoles, missionTag?: TravelCombatState['enemies'][number]['missionTag']) {
  if (missionTag?.role === 'target') {
    return CGA_YELLOW;
  }
  if (missionTag?.role === 'blockade' || missionTag?.role === 'ambusher' || missionTag?.role === 'scan-hostile') {
    return CGA_RED;
  }
  if (roles.cop) {
    return CGA_GREEN;
  }
  if (roles.innocent || roles.trader) {
    return CGA_YELLOW;
  }
  return CGA_RED;
}

export function getProjectileColor(projectile: CombatProjectile) {
  if (projectile.kind === 'missile') {
    return CGA_YELLOW;
  }
  return projectile.owner === 'player' ? CGA_GREEN : CGA_RED;
}

export interface EnemyHealthBarState {
  bankRatios: number[];
  fillColor: string;
}

export function getEnemyHealthBarState(enemy: CombatEnemy): EnemyHealthBarState | null {
  if (enemy.energy >= enemy.maxEnergy) {
    return null;
  }

  const ratio = Math.max(0, Math.min(1, enemy.maxEnergy > 0 ? enemy.energy / enemy.maxEnergy : 0));
  // Enemy overlays use the exact same bank decomposition as the player HUD so
  // the fight reads as one shared energy language across the whole screen.
  const bankRatios = getSegmentedBankRatios(enemy.energy, enemy.maxEnergy, 4);
  return {
    bankRatios,
    fillColor: getCgaBarFillColor(ratio)
  };
}

export interface EnemyLaserTrace {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/**
 * Enemy laser fire is currently simulation-only. This helper turns the AI's
 * `isFiringLaser` flag into a short visible beam aimed at the player so shots
 * are readable even when no projectile object is spawned for laser damage.
 */
export function getEnemyLaserTrace(enemy: CombatEnemy, state: TravelCombatState): EnemyLaserTrace | null {
  if (!enemy.isFiringLaser) {
    return null;
  }

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    return null;
  }

  const maxTraceLength = Math.min(enemy.laserRange, distance);
  const directionX = dx / distance;
  const directionY = dy / distance;
  return {
    startX: enemy.x + directionX * 10,
    startY: enemy.y + directionY * 10,
    endX: enemy.x + directionX * maxTraceLength,
    endY: enemy.y + directionY * maxTraceLength
  };
}
