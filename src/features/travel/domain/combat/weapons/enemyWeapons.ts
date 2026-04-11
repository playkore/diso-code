import { applyPlayerDamage, pushMessage, projectileId, spawnParticles } from '../state';
import { spawnEnemyFromBlueprint } from '../spawn/spawnEnemy';
import { CLASSIC_MISSILE_TOP_SPEED, toWorldSpeed } from '../classicFlightModel';
import type { CombatEnemy, RandomSource, TravelCombatState } from '../types';

/**
 * Enemy weapon and hostility rules.
 *
 * This module keeps the combat-specific legacy heuristics in one place:
 * hostility escalation from legal state, the CNT alignment thresholds for
 * laser fire/hits, and the special Thargoid missile behavior that spawns
 * Thargons instead of a normal projectile.
 */
export function estimateCnt(angleDiff: number): number {
  const alignment = Math.max(0, Math.cos(Math.abs(angleDiff)));
  return -Math.round(alignment * 36);
}

export function canEnemyLaserFireByCnt(cnt: number): boolean {
  return cnt <= -32;
}

export function canEnemyLaserHitByCnt(cnt: number): boolean {
  return cnt <= -35;
}

export function applyEnemyHostility(state: TravelCombatState, enemy: CombatEnemy) {
  // BBC Micro Elite does not use the later "bounty hunters turn hostile at
  // FIST 40" rule, so this pass only re-evaluates aggression that can change
  // within the current encounter, such as safe-zone suppression and station
  // defense escalation.
  if (enemy.roles.pirate && enemy.roles.hostile && state.encounter.safeZone) {
    enemy.aggression = 0;
  } else {
    enemy.aggression = enemy.baseAggression;
  }
  if (enemy.roles.cop && state.encounter.stationHostile) {
    enemy.roles.hostile = true;
  }
}

export function spawnEnemyMissile(state: TravelCombatState, enemy: CombatEnemy) {
  const missileSpeed = toWorldSpeed(CLASSIC_MISSILE_TOP_SPEED);
  state.projectiles.push({
    id: projectileId(state),
    kind: 'missile',
    owner: 'enemy',
    x: enemy.x + Math.cos(enemy.angle) * 14,
    y: enemy.y + Math.sin(enemy.angle) * 14,
    vx: enemy.vx + Math.cos(enemy.angle) * missileSpeed,
    vy: enemy.vy + Math.sin(enemy.angle) * missileSpeed,
    damage: 22,
    life: 180,
    sourceEnemyId: enemy.id
  });
  pushMessage(state, `INCOMING MISSILE: ${enemy.label.toUpperCase()}`, 1000);
}

export function tryEnemyMissileLaunch(state: TravelCombatState, enemy: CombatEnemy, random: RandomSource) {
  if (enemy.missileCooldown > 0 || enemy.missiles <= 0 || state.encounter.ecmTimer > 0) {
    return;
  }
  if ((random.nextByte() & 31) >= enemy.missiles) {
    return;
  }

  enemy.missiles -= 1;
  enemy.missileCooldown = 150;
  if (enemy.blueprintId === 'thargoid') {
    // Thargoids deploy autonomous escorts in place of conventional missiles.
    spawnEnemyFromBlueprint(state, 'thargon', random, {
      kind: 'thargon',
      x: enemy.x + Math.cos(enemy.angle) * 24,
      y: enemy.y + Math.sin(enemy.angle) * 24,
      angle: enemy.angle,
      missionTag: enemy.missionTag
    });
    return;
  }

  spawnEnemyMissile(state, enemy);
}

export function tryEnemyLaserAttack(state: TravelCombatState, enemy: CombatEnemy, dist: number, angleDiff: number) {
  if (dist > enemy.laserRange || enemy.fireCooldown > 0) {
    return;
  }

  const cnt = estimateCnt(angleDiff);
  // Firing and hitting use slightly different CNT thresholds so enemies can
  // visibly shoot even when the shot is not precise enough to connect.
  if (!canEnemyLaserFireByCnt(cnt) || enemy.laserPower <= 0) {
    return;
  }

  enemy.isFiringLaser = true;
  enemy.fireCooldown = 45;
  if (!canEnemyLaserHitByCnt(cnt)) {
    return;
  }

  applyPlayerDamage(state, enemy.laserPower);
  enemy.vx *= 0.5;
  enemy.vy *= 0.5;
  spawnParticles(state, state.player.x, state.player.y, '#ff5555');
}
