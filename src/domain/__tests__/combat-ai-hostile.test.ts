import { describe, expect, it } from 'vitest';
import { createDeterministicRandomSource, stepTravelCombat } from '../travelCombat';
import { createCombatState } from './combatTestUtils';

describe('travel combat hostile AI', () => {
  it('turns bounty hunters hostile at FIST 40 and suppresses pirate aggression in safe zones', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 40, government: 7, techLevel: 12 });
    state.enemies.push({
      id: 99,
      kind: 'ship',
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      behavior: 'hostile',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 100,
      maxEnergy: 150,
      laserPower: 5,
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
    });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.enemies.push({
      id: 100,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      behavior: 'hostile',
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 50,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { pirate: true, hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'ARRIVED', {}, rng);
    expect(state.enemies[0].roles.hostile).toBe(true);
    expect(state.enemies[1].aggression).toBe(0);
  });

  it('keeps hostile ships out of the station safe zone and prevents safe-zone laser hits', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.player.shields = 70;
    state.player.rechargeRate = 0;
    state.enemies.push({
      id: 8,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      behavior: 'hostile',
      x: 355,
      y: 0,
      vx: -4,
      vy: 0,
      angle: Math.PI,
      energy: 70,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 400,
      topSpeed: 6.2,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { pirate: true, hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);
    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(377.5);
    expect(state.player.shields).toBe(70);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('keeps bounty hunters out of the station safe zone before they turn hostile', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 0 });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.enemies.push({
      id: 9,
      kind: 'ship',
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      behavior: 'hostile',
      x: 350,
      y: 0,
      vx: -3,
      vy: 0,
      angle: Math.PI,
      energy: 150,
      maxEnergy: 150,
      laserPower: 5,
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
    });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);
    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(377.5);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('does not restore enemy energy over time after they take damage', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push({
      id: 10,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      behavior: 'hostile',
      x: 140,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 37,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { hostile: true, pirate: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 10, 'PLAYING', {}, rng);

    expect(state.enemies[0].energy).toBe(37);
  });
});
