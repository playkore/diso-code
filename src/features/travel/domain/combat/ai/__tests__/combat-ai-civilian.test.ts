import { describe, expect, it } from 'vitest';
import { createDeterministicRandomSource, stepTravelCombat } from '../../../travelCombat';
import { stepStationTraffic } from '../stationTrafficAi';
import { getStationDockMouthPoint } from '../../station/stationGeometry';
import { createCombatState, createTestEnemy } from '../../__tests__/combatTestUtils';

describe('travel combat civilian AI', () => {
  it('routes station traffic into the docking slot instead of orbiting the player', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    // This test exercises docking behavior, not ambient encounter spawning.
    state.encounter.rareTimer = -10_000;
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0.005, safeZoneRadius: 360 };
    const dockMouth = getStationDockMouthPoint(state.station);
    const stageRadius = Math.hypot(dockMouth.x - state.station.x, dockMouth.y - state.station.y) + 56;
    state.player.x = 220;
    state.player.y = 250;
    state.enemies.push(createTestEnemy({
      id: 10,
      blueprintId: 'cobra-mk3-trader',
      label: 'Cobra Trader',
      behavior: 'stationTraffic',
      x: state.station.x + stageRadius,
      y: state.station.y,
      vx: 0,
      vy: 0,
      angle: Math.PI,
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
    }));
    for (let index = 0; index < 1200 && state.enemies.some((enemy) => enemy.id === 10); index += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0 }, 4, 'JUMPING', {}, rng);
    }
    expect(state.enemies.some((enemy) => enemy.id === 10)).toBe(false);
  });

  it('keeps station-traffic docking phase between frames', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0.005, safeZoneRadius: 360 };
    const enemy = createTestEnemy({
      behavior: 'stationTraffic',
      x: 210,
      y: 250,
      vx: 0,
      vy: 0,
      angle: 0,
      topSpeed: 5.4,
      acceleration: 0.08,
      turnRate: 0.04,
      roles: { trader: true, innocent: true, docking: true, hostile: false },
      aggression: 10,
      baseAggression: 10
    });

    stepStationTraffic(enemy, station, 4);
    const phaseAfterFirstTick = enemy.autoDockPhase;
    const radiusAfterFirstTick = enemy.autoDockStageRadius;
    stepStationTraffic(enemy, station, 4);

    expect(phaseAfterFirstTick).toBeDefined();
    expect(enemy.autoDockPhase).toBeDefined();
    expect(enemy.autoDockStageRadius).toBe(radiusAfterFirstTick);
  });
});
