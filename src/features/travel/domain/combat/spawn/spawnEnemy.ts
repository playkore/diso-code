import { getCombatBlueprint } from '../blueprints';
import { projectileId, pushMessage } from '../state';
import { isEnemyExcludedFromSafeZone } from '../ai/safeZonePolicy';
import { keepEnemyOutsideSafeZone } from '../station/safeZone';
import { getEnemyRpgProfile } from './rpgScaling';
import type { BlueprintId, CombatEnemy, RandomSource, TravelCombatState } from '../types';

export function spawnEnemyFromBlueprint(
  state: TravelCombatState,
  blueprintId: BlueprintId,
  random: RandomSource,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const blueprint = getCombatBlueprint(blueprintId);
  const rpgProfile = getEnemyRpgProfile(blueprintId, state.currentSystemX);
  const spawnDistance = overrides.kind === 'thargon' ? 100 : 820;
  const angle = random.nextFloat() * Math.PI * 2;
  const enemy: CombatEnemy = {
    id: projectileId(state),
    kind: overrides.kind ?? (blueprintId === 'thargon' ? 'thargon' : 'ship'),
    blueprintId,
    label: blueprint.label,
    behavior: overrides.behavior ?? blueprint.behavior,
    x: overrides.x ?? state.player.x + Math.cos(angle) * spawnDistance,
    y: overrides.y ?? state.player.y + Math.sin(angle) * spawnDistance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    angle: overrides.angle ?? Math.atan2(Math.sin(angle + Math.PI), Math.cos(angle + Math.PI)),
    level: overrides.level ?? rpgProfile.level,
    hp: overrides.hp ?? rpgProfile.maxHp,
    maxHp: overrides.maxHp ?? rpgProfile.maxHp,
    attack: overrides.attack ?? rpgProfile.attack,
    xpReward: overrides.xpReward ?? rpgProfile.xpReward,
    creditReward: overrides.creditReward ?? rpgProfile.creditReward,
    laserPower: blueprint.laserPower,
    missiles: overrides.missiles ?? blueprint.missiles,
    targetableArea: blueprint.targetableArea,
    laserRange: blueprint.laserRange,
    topSpeed: blueprint.topSpeed,
    acceleration: blueprint.acceleration,
    turnRate: blueprint.turnRate,
    roles: { ...blueprint.roles, ...overrides.roles },
    aggression: overrides.aggression ?? (blueprint.roles.hostile ? 42 : 14),
    baseAggression: overrides.baseAggression ?? (blueprint.roles.hostile ? 42 : 14),
    fireCooldown: overrides.fireCooldown ?? random.nextFloat() * 40,
    missileCooldown: overrides.missileCooldown ?? 90 + random.nextFloat() * 60,
    isFiringLaser: false,
    hostileAttackPhase: overrides.hostileAttackPhase ?? 'approach',
    hostileStrafeSign: overrides.hostileStrafeSign ?? (((overrides.id ?? state.nextId) & 1) === 0 ? 1 : -1),
    lifetime: overrides.lifetime ?? 0,
    missionTag: overrides.missionTag
  };

  if (state.station && isEnemyExcludedFromSafeZone(enemy)) {
    keepEnemyOutsideSafeZone(state.station, enemy);
  }

  state.enemies.push(enemy);
  return enemy;
}

export function spawnCop(state: TravelCombatState, random: RandomSource, hostile = true) {
  spawnEnemyFromBlueprint(state, 'viper', random, {
    roles: { cop: true, hostile, stationDefense: true },
    aggression: hostile ? 52 : 20,
    baseAggression: hostile ? 52 : 20
  });
  pushMessage(state, hostile ? 'VIPER INTERCEPTOR INBOUND' : 'VIPER PATROL');
}
