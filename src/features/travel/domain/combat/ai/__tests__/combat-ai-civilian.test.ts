import { describe, expect, it } from 'vitest';
import { stepStationTraffic } from '../stationTrafficAi';
import { createTestEnemy } from '../../__tests__/combatTestUtils';

describe('travel combat civilian AI', () => {
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
