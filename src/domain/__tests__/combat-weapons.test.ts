import { describe, expect, it } from 'vitest';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt, consumeEscapePod, createDeterministicRandomSource, getPlayerCombatSnapshot, stepTravelCombat } from '../travelCombat';
import { createDefaultCommander } from '../commander';
import { createCombatState, createTestEnemy } from './combatTestUtils';
import { moveProjectiles } from '../combat/weapons/projectiles';
import { getLaserProjectileProfile } from '../combat/state';
import { canEnemyBePlayerTarget, getPlayerTargetIndicatorState, refreshPlayerTargetLock, setPlayerTargetLock } from '../combat/weapons/playerWeapons';
import { PLAYER_TARGET_LOCK_RANGE, RADAR_SHIP_RANGE } from '../combat/navigation';

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
      energy: 180,
      maxEnergy: 180,
      laserPower: 4,
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
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile')).toBe(false);
  });

  it('fires automatically at the nearest hostile ship inside an armed sector', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    commander.laserMounts.left = 'beam_laser';
    commander.laserMounts.rear = 'mining_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 11, x: 0, y: -180, energy: 400, maxEnergy: 400 }));
    state.enemies.push(createTestEnemy({ id: 12, x: -110, y: 0, energy: 400, maxEnergy: 400 }));
    state.enemies.push(createTestEnemy({ id: 13, x: 0, y: 220, energy: 400, maxEnergy: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]).toEqual(
      expect.objectContaining({
        damage: 16,
        sourceMount: 'left',
        targetEnemyId: 12
      })
    );
    expect(state.playerTargetLock).toEqual({ enemyId: 12, mount: 'left' });
    expect(state.lastPlayerArc).toBe('left');
  });

  it('keeps tracking the nearest hostile while auto-fire hands off between arcs', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.playerLoadout.laserMounts.right = 'beam_laser';
    state.enemies.push(createTestEnemy({ id: 21, x: 0, y: -180, energy: 400, maxEnergy: 400 }));
    state.enemies.push(createTestEnemy({ id: 22, x: 220, y: -40, energy: 400, maxEnergy: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 21, mount: 'front' });
    expect(state.projectiles[0]).toEqual(expect.objectContaining({ sourceMount: 'front', targetEnemyId: 21 }));

    state.player.fireCooldown = 0;
    state.enemies[0].x = 160;
    state.enemies[0].y = -10;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 21, mount: 'right' });
    expect(state.projectiles[1]).toEqual(expect.objectContaining({ sourceMount: 'right', targetEnemyId: 21, damage: 16 }));
  });

  it('switches to the next nearest armed-sector hostile when the current target leaves range', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.playerLoadout.laserMounts.rear = 'beam_laser';
    state.enemies.push(createTestEnemy({ id: 31, x: 0, y: -180, energy: 400, maxEnergy: 400 }));
    state.enemies.push(createTestEnemy({ id: 32, x: 0, y: 220, energy: 400, maxEnergy: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 31, mount: 'front' });
    state.projectiles.length = 0;
    state.player.fireCooldown = 0;
    state.enemies[0].x = RADAR_SHIP_RANGE + 1;
    state.enemies[0].y = 0;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toEqual({ enemyId: 32, mount: 'rear' });
    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0]).toEqual(expect.objectContaining({ sourceMount: 'rear', targetEnemyId: 32 }));
  });

  it('shows target indicator state for the current nearest armed-sector hostile', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.enemies.push(createTestEnemy({ id: 41, x: 0, y: -180, energy: 400, maxEnergy: 400 }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBe('ready');

    state.enemies[0].x = -180;
    state.enemies[0].y = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBeNull();
    expect(state.playerTargetLock).toBeNull();

    state.enemies[0].x = 0;
    state.enemies[0].y = -180;
    state.player.laserHeat.front = 60;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBe('warning');

    state.player.laserHeat.front = 97;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(getPlayerTargetIndicatorState(state)).toBe('overheated');
  });

  it('does not fire when no hostile ship sits inside an armed sector', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    commander.laserMounts.left = 'beam_laser';
    commander.laserMounts.rear = 'mining_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 44, x: 180, y: 0, energy: 400, maxEnergy: 400 }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));

    expect(state.playerTargetLock).toBeNull();
    expect(state.projectiles).toHaveLength(0);
  });

  it('locks only enemies inside the dedicated engagement radius even when a farther ship shares the same arc', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.playerLoadout.laserMounts.front = 'pulse_laser';
    state.enemies.push(createTestEnemy({ id: 46, x: 0, y: -(PLAYER_TARGET_LOCK_RANGE - 10), energy: 400, maxEnergy: 400 }));
    state.enemies.push(createTestEnemy({ id: 47, x: 0, y: -(PLAYER_TARGET_LOCK_RANGE + 40), energy: 400, maxEnergy: 400 }));

    expect(refreshPlayerTargetLock(state)).toEqual({ enemyId: 46, mount: 'front' });

    state.enemies[0].y = -(PLAYER_TARGET_LOCK_RANGE + 5);

    expect(refreshPlayerTargetLock(state)).toBeNull();
    expect(state.playerTargetLock).toBeNull();
  });

  it('stops auto-fire immediately when the laser master switch is turned off', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 45, x: 0, y: -180, energy: 400, maxEnergy: 400 }));

    stepTravelCombat(state, { thrust: 0, turn: 0, toggleLasers: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerLasersActive).toBe(false);

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.playerTargetLock).toBeNull();
    expect(state.projectiles).toHaveLength(0);
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

  it('gives player lasers roughly triple the previous reach while preserving per-laser range differences', () => {
    const pulse = getLaserProjectileProfile('pulse_laser');
    const beam = getLaserProjectileProfile('beam_laser');
    const mining = getLaserProjectileProfile('mining_laser');
    const military = getLaserProjectileProfile('military_laser');

    expect(pulse.speed * pulse.life).toBe(14 * 18 * 3);
    expect(beam.speed * beam.life).toBe(16 * 22 * 3);
    expect(mining.speed * mining.life).toBe(14 * 24 * 3);
    expect(military.speed * military.life).toBe(18 * 26 * 3);
    expect(new Set([pulse.speed * pulse.life, beam.speed * beam.life, mining.speed * mining.life, military.speed * military.life]).size).toBe(4);
  });

  it('uses ECM to clear missiles and suppresses further launches while active', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.ecm = true;
    const state = createCombatState([0, 0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.projectiles.push({ id: 5, kind: 'missile', owner: 'enemy', x: 20, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.projectiles.push({ id: 6, kind: 'missile', owner: 'enemy', x: 500, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.enemies.push(createTestEnemy({
      id: 9,
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 100,
      energy: 90,
      maxEnergy: 90,
      laserPower: 2,
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
      expect.objectContaining({ id: 6, kind: 'missile', owner: 'enemy' })
    ]);
    expect(state.encounter.ecmTimer).toBeGreaterThan(0);
    expect(state.player.energy).toBe(state.player.maxEnergy - state.player.energyPerBank);
  });

  it('keeps enemy missiles faster than the player while homing toward the ship', () => {
    const state = createCombatState([0, 0, 0]);
    state.player.vx = 6;
    state.projectiles.push({ id: 12, kind: 'missile', owner: 'enemy', x: 120, y: 120, vx: 0, vy: 0, damage: 22, life: 20 });

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
      energy: 220,
      maxEnergy: 220,
      laserPower: 5,
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
      energy: 90,
      maxEnergy: 90,
      laserPower: 3,
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
      energy: 85,
      maxEnergy: 85,
      laserPower: 2,
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
    state.player.energy = 2;
    const result = stepTravelCombat(state, { thrust: 0, turn: 0, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    state.player.energy = 0;
    const escaped = stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(result.state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(escaped.playerEscaped).toBe(true);
    consumeEscapePod(state);
    expect(getPlayerCombatSnapshot(state).installedEquipment.escape_pod).toBe(false);
  });

  it('destroys enemies when a player projectile depletes their remaining energy', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(createTestEnemy({
      id: 11,
      x: 10,
      energy: 8,
      topSpeed: 6.2,
      roles: { hostile: true, pirate: true },
      isFiringLaser: false
    }));
    state.projectiles.push({
      id: 12,
      kind: 'laser',
      owner: 'player',
      x: 0,
      y: 0,
      vx: 10,
      vy: 0,
      damage: 12,
      life: 20
    });

    moveProjectiles(state, 1, createDeterministicRandomSource([0, 0, 0, 0]));

    expect(state.enemies).toHaveLength(0);
    expect(state.player.tallyKills).toBe(1);
    expect(state.player.combatReward).toBe(50);
  });

  it('awards classic blueprint bounties instead of role-based payouts', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.enemies.push(createTestEnemy({
      id: 21,
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 100,
      energy: 8,
      maxEnergy: 90,
      roles: { hostile: true, pirate: true },
      isFiringLaser: false
    }));
    state.enemies.push(createTestEnemy({
      id: 22,
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 110,
      energy: 8,
      maxEnergy: 150,
      laserPower: 5,
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
      energy: 8,
      maxEnergy: 160,
      laserPower: 2,
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
      energy: 8,
      maxEnergy: 180,
      laserPower: 4,
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
    expect(state.player.combatReward).toBe(850);
    expect(state.messages.some((message) => message.text === 'MAMBA DESTROYED: 15.0 Cr')).toBe(true);
    expect(state.messages.some((message) => message.text === 'ASP MK II DESTROYED: 20.0 Cr')).toBe(true);
    expect(state.messages.some((message) => message.text === 'FER-DE-LANCE DESTROYED: 0.0 Cr')).toBe(true);
    expect(state.messages.some((message) => message.text === 'THARGOID DESTROYED: 50.0 Cr')).toBe(true);
  });

  it('initializes the player energy pool from commander bank data', () => {
    const state = createCombatState([0, 0, 0], { energyBanks: 4, energyPerBank: 64 });
    expect(state.player.energyBanks).toBe(4);
    expect(state.player.energyPerBank).toBe(64);
    expect(state.player.maxEnergy).toBe(255);
    expect(state.player.energy).toBe(255);
  });

  it('lets the shield absorb damage before energy banks collapse', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.shield_generator = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.player.shield = 5;
    state.projectiles.push({ id: 20, kind: 'laser', owner: 'enemy', x: 0, y: 0, vx: 0, vy: 0, damage: 12, life: 20 });
    moveProjectiles(state, 0, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(0);
    expect(state.player.energy).toBe(state.player.maxEnergy - 7);
  });

  it('blocks ECM activation when the player cannot afford the energy cost', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.ecm = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.player.energy = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0, activateEcm: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.encounter.ecmTimer).toBe(0);
    expect(state.messages.some((message) => message.text === 'ENERGY LOW')).toBe(true);
  });

  it('drains energy when firing and suppresses fire when energy is too low', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'beam_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 41, x: 0, y: -180, energy: 400, maxEnergy: 400 }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.projectiles).toHaveLength(1);
    expect(state.player.energy).toBe(state.player.maxEnergy - 0.8);

    state.projectiles.length = 0;
    state.player.fireCooldown = 0;
    state.player.energy = 0.5;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.projectiles).toHaveLength(0);
    expect(state.messages.some((message) => message.text === 'ENERGY LOW')).toBe(true);
  });

  it('keeps laser energy drain low enough that heat remains the main sustained-fire limiter', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    // Sustained-fire coverage needs a durable hostile inside the engagement
    // bubble so the pulse laser can keep heating without the lock dropping.
    state.enemies.push(createTestEnemy({ id: 51, x: 0, y: -(PLAYER_TARGET_LOCK_RANGE - 20), energy: 5000, maxEnergy: 5000 }));
    const startingEnergy = state.player.energy;

    for (let frame = 0; frame < 24; frame += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    }

    expect(state.player.energy).toBe(startingEnergy);
    expect(state.player.laserHeat.front).toBeGreaterThan(0);
  });

  it('tracks heat per mount and preserves heat on inactive sectors', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'beam_laser';
    commander.laserMounts.rear = 'military_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push(createTestEnemy({ id: 61, x: 0, y: -180, energy: 400, maxEnergy: 400 }));
    setPlayerTargetLock(state, 61);

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.laserHeat.front).toBe(6);
    expect(state.player.laserHeat.rear).toBe(0);
    expect(state.player.laserHeat.left).toBe(0);

    state.player.fireCooldown = 0;
    state.enemies[0].x = 0;
    state.enemies[0].y = 180;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.laserHeat.front).toBeCloseTo(5.8);
    expect(state.player.laserHeat.rear).toBe(4);

    state.playerLasersActive = false;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 60, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.laserHeat.front).toBe(0);
    expect(state.player.laserHeat.rear).toBe(0);
  });

  it('uses another available sector when a different mount is overheated', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'military_laser';
    commander.laserMounts.rear = 'beam_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    state.player.laserHeat.front = 97;
    state.player.laserHeat.rear = 0;
    state.enemies.push(createTestEnemy({ id: 71, x: 0, y: 180, energy: 400, maxEnergy: 400 }));
    setPlayerTargetLock(state, 71);

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));

    expect(state.projectiles).toHaveLength(1);
    expect(state.projectiles[0].damage).toBe(16);
    expect(state.projectiles[0].sourceMount).toBe('rear');
    expect(state.player.laserHeat.front).toBe(97);
    expect(state.player.laserHeat.rear).toBe(6);
    expect(state.messages.some((message) => message.text === 'LASER OVERHEAT')).toBe(false);
  });

  it('recharges shields on the classic cadence and only above half energy', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.shield_generator = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.player.shield = 250;
    state.player.energy = 200;

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 9, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(250);

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(251);
    expect(state.player.energy).toBe(200);

    state.player.shield = 250;
    state.player.energy = 100;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 10, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(250);
    expect(state.player.energy).toBe(101);
  });
});
