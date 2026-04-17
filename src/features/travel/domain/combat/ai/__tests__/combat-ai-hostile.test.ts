import { describe, expect, it } from 'vitest';
import { createDefaultCommander } from '../../../../../commander/domain/commander';
import { createDeterministicRandomSource, stepTravelCombat } from '../../../travelCombat';
import { createCombatState, createTestEnemy } from '../../__tests__/combatTestUtils';

describe('travel combat hostile AI', () => {
  it('keeps bounty hunters neutral while suppressing pirate aggression in safe zones', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 40, government: 7, techLevel: 12 });
    state.enemies.push(createTestEnemy({
      id: 99,
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 100,
      hp: 100,
      maxHp: 150,
      attack: 13,
      missiles: 1,
      targetableArea: 280,
      laserRange: 380,
      topSpeed: 6,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 20,
      baseAggression: 20,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.enemies.push(createTestEnemy({
      id: 100,
      x: 120,
      hp: 50,
      roles: { pirate: true, hostile: true },
      fireCooldown: 0,
      isFiringLaser: false
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'ARRIVED', {}, rng);
    expect(state.enemies[0].roles.hostile).not.toBe(true);
    expect(state.enemies[1].aggression).toBe(0);
  });

  it('keeps hostile ships out of the station safe zone and prevents safe-zone laser hits', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.shield_generator = true;
    const state = createCombatState([0, 0, 0, 0], {
      installedEquipment: commander.installedEquipment
    });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.player.hp = 70;
    state.enemies.push(createTestEnemy({
      id: 8,
      x: 355,
      vx: -4,
      laserRange: 400,
      topSpeed: 6.2,
      roles: { pirate: true, hostile: true },
      fireCooldown: 0,
      isFiringLaser: false
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);
    // Pirates should now stay outside two full safe-zone radii instead of only
    // bouncing off the single-ring station perimeter.
    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(737.5);
    expect(state.player.hp).toBe(70);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('keeps bounty hunters out of the station safe zone before they turn hostile', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 0 });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.enemies.push(createTestEnemy({
      id: 9,
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 350,
      vx: -3,
      hp: 150,
      maxHp: 150,
      attack: 13,
      missiles: 1,
      targetableArea: 280,
      laserRange: 380,
      topSpeed: 6.6,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 20,
      baseAggression: 20,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    }));
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);
    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(377.5);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('does not restore enemy energy over time after they take damage', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(createTestEnemy({
      id: 10,
      x: 140,
      hp: 37,
      roles: { hostile: true, pirate: true },
      fireCooldown: 999,
      isFiringLaser: false
    }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 10, 'PLAYING', {}, rng);

    expect(state.enemies[0].hp).toBe(37);
  });

  it('breaks hostile ships to the side after a frontal attack run', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.player.x = 0;
    state.player.y = 0;
    state.enemies.push(createTestEnemy({
      id: 11,
      x: 120,
      roles: { hostile: true, pirate: true },
      fireCooldown: 44,
      isFiringLaser: false
    }));

    for (let index = 0; index < 40; index += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);
    }

    expect(state.enemies[0].hostileAttackPhase).toBe('breakaway');
    expect(Math.abs(state.enemies[0].y)).toBeGreaterThan(20);
    expect(state.enemies[0].x).toBeLessThan(120);
  });

  it('keeps hostile ships moving during close frontal passes instead of stopping dead', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.player.x = 0;
    state.player.y = 0;
    state.enemies.push(createTestEnemy({
      id: 12,
      x: 100,
      roles: { hostile: true, pirate: true },
      fireCooldown: 0,
      isFiringLaser: false
    }));

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);

    expect(Math.hypot(state.enemies[0].vx, state.enemies[0].vy)).toBeGreaterThan(0.03);
    expect(state.enemies[0].x).toBeLessThan(100);
  });
});
