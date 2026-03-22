import { describe, expect, it } from 'vitest';
import { getVisibleRadarContacts, isMassNearby, isPlayerInStationSafeZone, MASS_LOCK_DISTANCE, RADAR_SHIP_RANGE, stepTravelCombat } from '../travelCombat';
import { createCombatState, createTestEnemy } from './combatTestUtils';

describe('travel combat navigation rules', () => {
  it('treats nearby ships and stations as mass lock sources for local jump', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 100;
    state.player.y = 0;
    expect(isMassNearby(state, MASS_LOCK_DISTANCE)).toBe(true);

    state.station = null;
    state.player.x = 0;
    state.enemies.push(createTestEnemy({
      id: 2,
      x: 300,
      roles: { hostile: true }
    }));
    expect(isMassNearby(state, MASS_LOCK_DISTANCE)).toBe(true);
  });

  it('accelerates the player to local jump speed only while jump is engaged', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.player.angle = Math.PI / 2;
    state.player.vx = 5;
    state.player.vy = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, jump: true }, 1, 'JUMPING', {}, { nextByte: () => 0, nextFloat: () => 0 });
    expect(Math.hypot(state.player.vx, state.player.vy)).toBeCloseTo(60, 5);
    expect(state.player.vx).toBeCloseTo(0, 5);
    expect(state.player.vy).toBeCloseTo(60, 5);

    state.player.vx = 200;
    state.player.vy = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, jump: false }, 1, 'PLAYING', {}, { nextByte: () => 0, nextFloat: () => 0 });
    expect(Math.hypot(state.player.vx, state.player.vy)).toBeCloseTo(6, 5);
  });

  it('limits radar ship contacts to the configured range', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.enemies.push(
      createTestEnemy({
        id: 1,
        label: 'Near',
        x: RADAR_SHIP_RANGE - 1,
        angle: 0,
        roles: { hostile: true }
      }),
      createTestEnemy({
        id: 2,
        label: 'Far',
        x: RADAR_SHIP_RANGE + 1,
        angle: 0,
        roles: { hostile: true }
      })
    );

    expect(getVisibleRadarContacts(state, RADAR_SHIP_RANGE).map((enemy) => enemy.id)).toEqual([1]);
  });

  it('blocks hyperspace only inside the station safe zone', () => {
    const state = createCombatState([0, 0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 100;
    state.player.y = 0;
    state.enemies.push(createTestEnemy({
      id: 3,
      label: 'Nearby ship',
      x: 200,
      angle: 0,
      roles: { hostile: true }
    }));
    expect(isPlayerInStationSafeZone(state)).toBe(true);

    state.player.x = 500;
    expect(isPlayerInStationSafeZone(state)).toBe(false);
    expect(isMassNearby(state, MASS_LOCK_DISTANCE)).toBe(true);
  });
});
