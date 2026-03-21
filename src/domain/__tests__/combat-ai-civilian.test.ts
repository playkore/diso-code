import { describe, expect, it } from 'vitest';
import { createDeterministicRandomSource, stepTravelCombat } from '../travelCombat';
import { createCombatState } from './combatTestUtils';

describe('travel combat civilian AI', () => {
  it('routes station traffic into the docking slot instead of orbiting the player', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 220;
    state.player.y = 250;
    state.enemies.push({
      id: 10,
      kind: 'ship',
      blueprintId: 'cobra-mk3-trader',
      label: 'Cobra Trader',
      behavior: 'stationTraffic',
      x: 210,
      y: 250,
      vx: 0,
      vy: 0,
      angle: 0,
      energy: 130,
      maxEnergy: 130,
      laserPower: 1,
      missiles: 0,
      targetableArea: 320,
      laserRange: 300,
      topSpeed: 5.4,
      acceleration: 0.08,
      turnRate: 0.04,
      roles: { trader: true, innocent: true, docking: true, hostile: false },
      aggression: 10,
      baseAggression: 10,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });
    for (let index = 0; index < 180 && state.enemies.length > 0; index += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 4, 'JUMPING', {}, rng);
    }
    expect(state.enemies).toHaveLength(0);
  });
});
