import { describe, expect, it } from 'vitest';
import { getEnemyHealthBarState } from './projectilesRenderer';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './constants';
import type { CombatEnemy } from '../../../domain/travelCombat';

function createEnemy(overrides: Partial<CombatEnemy> = {}): CombatEnemy {
  return {
    id: 1,
    kind: 'ship',
    blueprintId: 'sidewinder',
    label: 'Sidewinder',
    behavior: 'hostile',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    energy: 70,
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
    fireCooldown: 0,
    missileCooldown: 0,
    isFiringLaser: false,
    ...overrides
  };
}

describe('getEnemyHealthBarState', () => {
  it('hides the bar for undamaged enemies', () => {
    expect(getEnemyHealthBarState(createEnemy())).toBeNull();
  });

  it('shows the bar and clamps the ratio for damaged enemies', () => {
    expect(getEnemyHealthBarState(createEnemy({ energy: 35 }))).toEqual({
      bankRatios: [1, 1, 0, 0],
      fillColor: CGA_YELLOW
    });

    expect(getEnemyHealthBarState(createEnemy({ energy: 120 }))).toBeNull();

    expect(getEnemyHealthBarState(createEnemy({ energy: -10 }))).toEqual({
      bankRatios: [0, 0, 0, 0],
      fillColor: CGA_RED
    });
  });

  it('splits partial energy into four Elite-style banks', () => {
    expect(getEnemyHealthBarState(createEnemy({ energy: 52.5, maxEnergy: 70 }))?.bankRatios).toEqual([1, 1, 1, 0]);
    expect(getEnemyHealthBarState(createEnemy({ energy: 43.75, maxEnergy: 70 }))?.bankRatios).toEqual([1, 1, 0.5, 0]);
  });

  it('uses CGA fill colors for high, mid, and low health', () => {
    expect(getEnemyHealthBarState(createEnemy({ energy: 55 }))?.fillColor).toBe(CGA_GREEN);
    expect(getEnemyHealthBarState(createEnemy({ energy: 28 }))?.fillColor).toBe(CGA_YELLOW);
    expect(getEnemyHealthBarState(createEnemy({ energy: 20 }))?.fillColor).toBe(CGA_RED);
  });
});
