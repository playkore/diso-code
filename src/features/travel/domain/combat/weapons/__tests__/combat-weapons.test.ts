import { describe, expect, it } from 'vitest';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt, consumeEscapePod, createDeterministicRandomSource, getPlayerCombatSnapshot, stepTravelCombat } from '../../../travelCombat';
import { createDefaultCommander } from '../../../../../commander/domain/commander';
import { createCombatState, createTestEnemy } from '../../__tests__/combatTestUtils';
import { moveProjectiles } from '../projectiles';
import { getLaserWeaponProfile } from '../../state';
import { canEnemyBePlayerTarget, getPlayerTargetIndicatorState, refreshPlayerTargetLock, setPlayerTargetLock } from '../playerWeapons';
import { PLAYER_TARGET_LOCK_RANGE, RADAR_SHIP_RANGE } from '../../navigation';
import { getEnemyRpgProfile } from '../../spawn/rpgScaling';

describe('travel combat weapons', () => {
  it('uses documented CNT thresholds for enemy laser fire and hit gating', () => {
    expect(canEnemyLaserFireByCnt(-32)).toBe(true);
    expect(canEnemyLaserFireByCnt(-31)).toBe(false);
    expect(canEnemyLaserHitByCnt(-35)).toBe(true);
    expect(canEnemyLaserHitByCnt(-34)).toBe(false);
  });

  it('spawns thargons instead of missiles for thargoids', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0]);
    state.enemies.push(createTestEnemy({
      id: 5,
      blueprintId: 'thargoid',
      label: 'Thargoid',
      behavior: 'thargoid',
      x: 100,
      hp: 180,
      maxHp: 180,
      attack: 13,
      missiles: 6,
      targetableArea: 330,
      laserRange: 380,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.055,
      roles: { hostile: true },
      aggression: 58,
      baseAggression: 58,
      fireCooldown: 999,
      missileCooldown: 0,
      isFiringLaser: false,
      missionTag: { missionId: 'hunt', templateId: 'named_pirate_hunt', role: 'ambusher' }
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.kind === 'thargon')).toBe(true);
    expect(state.projectiles).toHaveLength(0);
  });

  it('fires automatically at the nearest hostile ship inside an armed sector', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    commander.laserMounts.left = 'beam_laser';
    commander.laserMounts.rear = 'mining_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 11, x: 0, y: -180, hp: 400, maxHp: 400 }));
    state.enemies.push(createTestEnemy({ id: 12, x: -110, y: 0, hp: 400, maxHp: 400 }));
    state.enemies.push(createTestEnemy({ id: 13, x: 0, y: 220, hp: 400, maxHp: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserTrace).not.toBeNull();
    expect(state.enemies.find((enemy) => enemy.id === 12)?.hp).toBe(375);
    expect(state.playerTargetLock).toEqual({ enemyId: 12, mount: 'left' });
    expect(state.lastPlayerArc).toBe('left');
  });

  it('keeps tracking the nearest hostile while auto-fire hands off between arcs', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.playerLoadout.laserMounts.right = 'beam_laser';
    state.enemies.push(createTestEnemy({ id: 21, x: 0, y: -180, hp: 400, maxHp: 400 }));
    state.enemies.push(createTestEnemy({ id: 22, x: 220, y: -40, hp: 400, maxHp: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 21, mount: 'front' });
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserTrace).not.toBeNull();
    expect(state.enemies.find((enemy) => enemy.id === 21)?.hp).toBe(376);

    state.player.fireCooldown = 0;
    state.enemies[0].x = 160;
    state.enemies[0].y = -10;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 21, mount: 'right' });
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserTrace).not.toBeNull();
  });

  it('switches to the next nearest armed-sector hostile when the current target leaves range', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.playerLoadout.laserMounts.rear = 'beam_laser';
    state.enemies.push(createTestEnemy({ id: 31, x: 0, y: -180, hp: 400, maxHp: 400 }));
    state.enemies.push(createTestEnemy({ id: 32, x: 0, y: 220, hp: 400, maxHp: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 31, mount: 'front' });
    state.player.fireCooldown = 0;
    state.enemies[0].x = RADAR_SHIP_RANGE + 1;
    state.enemies[0].y = 0;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 32, mount: 'rear' });
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserTrace).not.toBeNull();
  });

  it('shows target indicator state for the current nearest armed-sector hostile', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.enemies.push(createTestEnemy({ id: 41, x: 0, y: -180, hp: 400, maxHp: 400 }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBe('ready');

    state.enemies[0].x = -180;
    state.enemies[0].y = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBeNull();
    expect(state.playerTargetLock).toBeNull();
  });

  it('does not fire when no hostile ship sits inside an armed sector', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    commander.laserMounts.left = 'beam_laser';
    commander.laserMounts.rear = 'mining_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 44, x: 180, y: 0, hp: 400, maxHp: 400 }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));

    expect(state.playerTargetLock).toBeNull();
    expect(state.projectiles).toHaveLength(0);
  });

  it('locks only enemies inside the dedicated engagement radius even when a farther ship shares the same arc', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.enemies.push(createTestEnemy({ id: 46, x: 0, y: -(PLAYER_TARGET_LOCK_RANGE - 10), hp: 400, maxHp: 400 }));
    state.enemies.push(createTestEnemy({ id: 47, x: 0, y: -(PLAYER_TARGET_LOCK_RANGE + 40), hp: 400, maxHp: 400 }));

    expect(refreshPlayerTargetLock(state)).toEqual({ enemyId: 46, mount: 'front' });

    state.enemies[0].y = -(PLAYER_TARGET_LOCK_RANGE + 5);

    expect(refreshPlayerTargetLock(state)).toBeNull();
    expect(state.playerTargetLock).toBeNull();
  });

  it('ignores friendly ships and picks the nearest hostile instead', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.enemies.push(createTestEnemy({ id: 51, roles: { trader: true, innocent: true }, behavior: 'civilian', x: 0, y: -160 }));

    expect(canEnemyBePlayerTarget(state.enemies[0])).toBe(false);
    state.enemies.push(createTestEnemy({ id: 52, x: 0, y: -180, roles: { hostile: true } }));
    expect(refreshPlayerTargetLock(state)).toEqual({ enemyId: 52, mount: 'front' });
    expect(state.playerTargetLock).toEqual({ enemyId: 52, mount: 'front' });
  });

  it('treats hostile mission-tagged ships as valid auto-targets even without hostile role flags', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(
      createTestEnemy({
        id: 61,
        x: 0,
        y: -160,
        roles: { trader: true },
        behavior: 'civilian',
        missionTag: { missionId: 'hunt', templateId: 'named_pirate_hunt', role: 'target' }
      })
    );

    expect(canEnemyBePlayerTarget(state.enemies[0])).toBe(true);
    expect(refreshPlayerTargetLock(state)).toEqual({ enemyId: 61, mount: 'front' });
  });

  it('drops the current target when no armed-sector hostile remains', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(createTestEnemy({ id: 71, x: 0, y: -160 }));
    setPlayerTargetLock(state, 71);
    state.enemies[0].roles = { trader: true, innocent: true };
    state.enemies[0].behavior = 'civilian';

    expect(refreshPlayerTargetLock(state)).toBeNull();
    expect(state.playerTargetLock).toBeNull();
  });

  it('uses player laser profiles for damage and cooldown only', () => {
    const pulse = getLaserWeaponProfile('pulse_laser');
    const beam = getLaserWeaponProfile('beam_laser');
    const mining = getLaserWeaponProfile('mining_laser');
    const military = getLaserWeaponProfile('military_laser');

    expect(pulse).toEqual({ damage: 15, cooldown: 12 });
    expect(beam).toEqual({ damage: 16, cooldown: 10 });
    expect(mining).toEqual({ damage: 10, cooldown: 14 });
    expect(military).toEqual({ damage: 24, cooldown: 8 });
  });

  it('uses ECM to clear missiles and suppresses further launches while active', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.ecm = true;
    const state = createCombatState([0, 0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.projectiles.push({ id: 5, x: 20, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.projectiles.push({ id: 6, x: 500, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.enemies.push(createTestEnemy({
      id: 9,
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 100,
      hp: 90,
      maxHp: 90,
      attack: 10,
      missiles: 2,
      targetableArea: 220,
      laserRange: 320,
      topSpeed: 6,
      acceleration: 0.12,
      turnRate: 0.055,
      roles: { hostile: true, pirate: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 0,
      isFiringLaser: false
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0, activateEcm: true }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles).toEqual([
      expect.objectContaining({ id: 6 })
    ]);
    expect(state.encounter.ecmTimer).toBeGreaterThan(0);
    expect(state.enemies[0].missiles).toBe(2);
  });

  it('keeps enemy missiles faster than the player while homing toward the ship', () => {
    const state = createCombatState([0, 0, 0]);
    state.player.vx = 6;
    state.projectiles.push({ id: 12, x: 120, y: 120, vx: 0, vy: 0, damage: 22, life: 20 });

    moveProjectiles(state, 1, createDeterministicRandomSource([0, 0, 0]));

    const missile = state.projectiles[0];
    const speed = Math.hypot(missile.vx, missile.vy);
    expect(speed).toBeGreaterThan(state.player.maxSpeed);
    expect(missile.vx).toBeLessThan(0);
    expect(missile.vy).toBeLessThan(0);
  });

  it('consumes energy bombs and destroys every ship visible on radar', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.enemies.push(createTestEnemy({
      id: 3,
      x: 100,
      roles: { hostile: true }
    }));
    state.enemies.push(createTestEnemy({
      id: 4,
      blueprintId: 'constrictor',
      label: 'Constrictor',
      x: 110,
      hp: 220,
      maxHp: 220,
      attack: 15,
      missiles: 4,
      targetableArea: 300,
      laserRange: 420,
      topSpeed: 7,
      acceleration: 0.15,
      turnRate: 0.065,
      roles: { hostile: true, pirate: true },
      aggression: 56,
      baseAggression: 56,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false,
      missionTag: { missionId: 'hunt', templateId: 'named_pirate_hunt', role: 'target' }
    }));
    state.enemies.push(createTestEnemy({
      id: 5,
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 590,
      hp: 90,
      maxHp: 90,
      attack: 11,
      missiles: 2,
      targetableArea: 220,
      laserRange: 320,
      topSpeed: 6,
      acceleration: 0.12,
      turnRate: 0.055,
      roles: { hostile: true, pirate: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    state.enemies.push(createTestEnemy({
      id: 6,
      blueprintId: 'adder',
      label: 'Adder',
      x: 610,
      hp: 85,
      maxHp: 85,
      attack: 9,
      roles: { hostile: true },
      aggression: 38,
      baseAggression: 38,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0, triggerEnergyBomb: true }, 1, 'PLAYING', {}, rng);
    expect(state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(state.encounter.bombEffectTimer).toBeGreaterThan(0);
    expect(state.particles.length).toBeGreaterThan(20);
    expect(state.enemies.some((enemy) => enemy.blueprintId === 'sidewinder')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.missionTag?.role === 'target')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.blueprintId === 'mamba')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.blueprintId === 'adder')).toBe(true);
  });

  it('uses the escape pod recovery flow and preserves consumable state', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.escape_pod = true;
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0], { installedEquipment: commander.installedEquipment });
    state.player.hp = 2;
    const result = stepTravelCombat(state, { thrust: 0, turn: 0, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    state.player.hp = 0;
    const escaped = stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(result.state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(escaped.playerEscaped).toBe(true);
    consumeEscapePod(state);
    expect(getPlayerCombatSnapshot(state).installedEquipment.escape_pod).toBe(false);
  });

  it('destroys enemies when a player projectile depletes their remaining HP', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(createTestEnemy({
      id: 11,
      x: 0,
      y: -10,
      hp: 8,
      maxHp: 8,
      topSpeed: 6.2,
      roles: { hostile: true, pirate: true },
      isFiringLaser: false
    }));
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    setPlayerTargetLock(state, 11);

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));

    expect(state.enemies).toHaveLength(0);
    expect(state.player.tallyKills).toBe(1);
    expect(state.player.combatReward).toBe(50);
  });

  it('awards RPG-scaled blueprint payouts and XP when multiple kills land', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    const mambaProfile = getEnemyRpgProfile('mamba', state.currentSystemX);
    const aspProfile = getEnemyRpgProfile('asp-mk2', state.currentSystemX);
    const ferDeLanceProfile = getEnemyRpgProfile('fer-de-lance', state.currentSystemX);
    const thargoidProfile = getEnemyRpgProfile('thargoid', state.currentSystemX);
    state.enemies.push(createTestEnemy({
      id: 21,
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 100,
      level: mambaProfile.level,
      hp: 8,
      maxHp: mambaProfile.maxHp,
      attack: mambaProfile.attack,
      xpReward: mambaProfile.xpReward,
      creditReward: mambaProfile.creditReward,
      roles: { hostile: true, pirate: true },
      isFiringLaser: false
    }));
    state.enemies.push(createTestEnemy({
      id: 22,
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 110,
      level: aspProfile.level,
      hp: 8,
      maxHp: aspProfile.maxHp,
      attack: aspProfile.attack,
      xpReward: aspProfile.xpReward,
      creditReward: aspProfile.creditReward,
      missiles: 1,
      targetableArea: 280,
      laserRange: 380,
      topSpeed: 6.6,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    state.enemies.push(createTestEnemy({
      id: 23,
      blueprintId: 'fer-de-lance',
      label: 'Fer-de-Lance',
      x: 115,
      level: ferDeLanceProfile.level,
      hp: 8,
      maxHp: ferDeLanceProfile.maxHp,
      attack: ferDeLanceProfile.attack,
      xpReward: ferDeLanceProfile.xpReward,
      creditReward: ferDeLanceProfile.creditReward,
      missiles: 2,
      targetableArea: 260,
      laserRange: 340,
      topSpeed: 6.7,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    state.enemies.push(createTestEnemy({
      id: 24,
      blueprintId: 'thargoid',
      label: 'Thargoid',
      behavior: 'thargoid',
      x: 120,
      level: thargoidProfile.level,
      hp: 8,
      maxHp: thargoidProfile.maxHp,
      attack: thargoidProfile.attack,
      xpReward: thargoidProfile.xpReward,
      creditReward: thargoidProfile.creditReward,
      missiles: 6,
      targetableArea: 330,
      laserRange: 380,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.055,
      roles: { hostile: true },
      aggression: 58,
      baseAggression: 58,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    }));

    stepTravelCombat(state, { thrust: 0, turn: 0, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));

    expect(state.enemies).toHaveLength(0);
    expect(state.player.tallyKills).toBe(4);
    expect(state.player.combatReward).toBe(
      mambaProfile.creditReward + aspProfile.creditReward + ferDeLanceProfile.creditReward + thargoidProfile.creditReward
    );
    expect(state.player.level).toBe(4);
    expect(state.player.attack).toBe(18);
    expect(state.messages.some((message) => message.text.includes('THARGOID L'))).toBe(true);
    expect(state.messages.some((message) => message.text.includes('+82 XP'))).toBe(true);
    expect(state.messages.some((message) => message.text.includes('LEVEL UP'))).toBe(true);
  });

  it('initializes the player RPG combat stats from the docked commander', () => {
    const state = createCombatState([0, 0, 0], { level: 3, xp: 17, hp: 74, maxHp: 88, attack: 15 });
    expect(state.player.level).toBe(3);
    expect(state.player.xp).toBe(17);
    expect(state.player.hp).toBe(74);
    expect(state.player.maxHp).toBe(88);
    expect(state.player.attack).toBe(15);
  });

  it('applies incoming damage directly to player HP', () => {
    const state = createCombatState([0, 0, 0]);
    state.player.hp = 20;
    state.projectiles.push({ id: 20, x: 0, y: 0, vx: 0, vy: 0, damage: 12, life: 20 });
    moveProjectiles(state, 0, createDeterministicRandomSource([0]));
    expect(state.player.hp).toBe(8);
  });

  it('ignores ECM activation when the ship does not have the equipment installed', () => {
    const state = createCombatState([0, 0, 0]);
    stepTravelCombat(state, { thrust: 0, turn: 0, activateEcm: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.encounter.ecmTimer).toBe(0);
    expect(state.messages.some((message) => message.text.startsWith('ECM'))).toBe(false);
  });

  it('keeps laser fire independent from the player HP pool', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'beam_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    state.player.hp = 1;
    state.enemies.push(createTestEnemy({ id: 41, x: 0, y: -180, hp: 400, maxHp: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserTrace).not.toBeNull();
    expect(state.enemies.find((enemy) => enemy.id === 41)?.hp).toBe(375);
    expect(state.player.hp).toBeCloseTo(1.05, 5);
  });

  it('passively regenerates player HP at five percent per second', () => {
    const state = createCombatState([0, 0, 0]);
    state.player.hp = 25;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 120, 'PLAYING', {}, createDeterministicRandomSource([0]));

    expect(state.player.hp).toBe(31);
  });
});
