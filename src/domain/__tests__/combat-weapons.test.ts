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
    expect(state.projectiles.map((projectile) => projectile.damage)).toEqual([12, 16, 10]);
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
    state.player.shields = 2;
    const result = stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    state.player.shields = 0;
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
});
