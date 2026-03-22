import { describe, expect, it } from 'vitest';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt, consumeEscapePod, createDeterministicRandomSource, getPlayerCombatSnapshot, stepTravelCombat } from '../travelCombat';
import { TP_MISSION_FLAGS } from '../missions';
import { createDefaultCommander } from '../commander';
import { createCombatState } from './combatTestUtils';
import { moveProjectiles } from '../combat/weapons/projectiles';

describe('travel combat weapons', () => {
  it('uses documented CNT thresholds for enemy laser fire and hit gating', () => {
    expect(canEnemyLaserFireByCnt(-32)).toBe(true);
    expect(canEnemyLaserFireByCnt(-31)).toBe(false);
    expect(canEnemyLaserHitByCnt(-35)).toBe(true);
    expect(canEnemyLaserHitByCnt(-34)).toBe(false);
  });

  it('spawns thargons instead of missiles for thargoids', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0], { missionTP: TP_MISSION_FLAGS.thargoidPlansBriefed });
    state.enemies.push({
      id: 5,
      kind: 'ship',
      blueprintId: 'thargoid',
      label: 'Thargoid',
      behavior: 'thargoid',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
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
      missionTag: 'thargoid-plans'
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.kind === 'thargon')).toBe(true);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile')).toBe(false);
  });

  it('fires every installed laser mount at the same time', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    commander.laserMounts.left = 'beam_laser';
    commander.laserMounts.rear = 'mining_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles).toHaveLength(3);
    expect(state.projectiles.map((projectile) => projectile.damage)).toEqual([15, 16, 10]);
    expect(state.lastPlayerArc).toBe('rear');
  });

  it('uses ECM to clear missiles and suppresses further launches while active', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.ecm = true;
    const state = createCombatState([0, 0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.projectiles.push({ id: 5, kind: 'missile', owner: 'enemy', x: 20, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.enemies.push({
      id: 9,
      kind: 'ship',
      blueprintId: 'mamba',
      label: 'Mamba',
      behavior: 'hostile',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
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
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, activateEcm: true }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile')).toBe(false);
    expect(state.encounter.ecmTimer).toBeGreaterThan(0);
    expect(state.player.energy).toBe(state.player.maxEnergy);
  });

  it('consumes energy bombs and preserves mission enemies', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.enemies.push({
      id: 3,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      behavior: 'hostile',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 70,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });
    state.enemies.push({
      id: 4,
      kind: 'ship',
      blueprintId: 'constrictor',
      label: 'Constrictor',
      behavior: 'hostile',
      x: 110,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
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
      missionTag: 'constrictor'
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, triggerEnergyBomb: true }, 1, 'PLAYING', {}, rng);
    expect(state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(state.enemies.some((enemy) => enemy.blueprintId === 'sidewinder')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.missionTag === 'constrictor')).toBe(true);
  });

  it('uses the escape pod recovery flow and preserves consumable state', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.escape_pod = true;
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0], { installedEquipment: commander.installedEquipment });
    state.player.energy = 2;
    const result = stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    state.player.energy = 0;
    const escaped = stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(result.state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(escaped.playerEscaped).toBe(true);
    consumeEscapePod(state);
    expect(getPlayerCombatSnapshot(state).installedEquipment.escape_pod).toBe(false);
  });

  it('destroys enemies when a player projectile depletes their remaining energy', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push({
      id: 11,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      behavior: 'hostile',
      x: 10,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 8,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6.2,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { hostile: true, pirate: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });
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
    expect(state.score).toBe(100);
  });

  it('initializes the player energy pool from commander bank data', () => {
    const state = createCombatState([0, 0, 0], { energyBanks: 4, energyPerBank: 64 });
    expect(state.player.energyBanks).toBe(4);
    expect(state.player.energyPerBank).toBe(64);
    expect(state.player.maxEnergy).toBe(255);
    expect(state.player.energy).toBe(255);
  });

  it('lets the shield absorb damage before energy banks collapse', () => {
    const state = createCombatState([0, 0, 0]);
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
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, activateEcm: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.encounter.ecmTimer).toBe(0);
    expect(state.messages.some((message) => message.text === 'ENERGY LOW')).toBe(true);
  });

  it('drains energy when firing and suppresses fire when energy is too low', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'beam_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.projectiles).toHaveLength(1);
    expect(state.player.energy).toBe(state.player.maxEnergy - 0.8);

    state.projectiles.length = 0;
    state.player.fireCooldown = 0;
    state.player.energy = 0.5;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.projectiles).toHaveLength(0);
    expect(state.messages.some((message) => message.text === 'ENERGY LOW')).toBe(true);
  });

  it('keeps laser energy drain low enough that heat remains the main sustained-fire limiter', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'pulse_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    const startingEnergy = state.player.energy;

    for (let frame = 0; frame < 24; frame += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    }

    expect(state.player.energy).toBe(startingEnergy);
    expect(state.player.laserHeat).toBeGreaterThan(0);
  });

  it('tracks one shared laser heat meter and cools it over time', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'beam_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.laserHeat).toBe(10);

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 60, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.laserHeat).toBe(0);
  });

  it('blocks firing when the shared heat meter is full', () => {
    const commander = createDefaultCommander();
    commander.laserMounts.front = 'military_laser';
    const state = createCombatState([0, 0, 0], { laserMounts: commander.laserMounts });
    state.player.laserHeat = 97;

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));

    expect(state.projectiles).toHaveLength(0);
    expect(state.player.laserHeat).toBe(state.player.maxLaserHeat);
    expect(state.messages.some((message) => message.text === 'LASER OVERHEAT')).toBe(true);
  });

  it('recharges shields on the classic cadence and only above half energy', () => {
    const state = createCombatState([0, 0, 0]);
    state.player.shield = 250;
    state.player.energy = 200;

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 9, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(250);

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(251);
    expect(state.player.energy).toBe(200);

    state.player.shield = 250;
    state.player.energy = 100;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 10, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(state.player.shield).toBe(250);
    expect(state.player.energy).toBe(101);
  });
});
