import { describe, expect, it } from 'vitest';
import { getEnemyHealthBarState, getEnemyLaserTrace } from '../travelVisuals';
import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './constants';
import { getCgaBarFillColor, getSegmentedBankRatios } from './bars';
import type { CombatEnemy, TravelCombatState } from '../../../domain/travelCombat';

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
    level: 1,
    hp: 70,
    maxHp: 70,
    attack: 7,
    xpReward: 10,
    creditReward: 50,
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
    // Renderer tests use hand-built enemies, so keep runtime bookkeeping fields
    // initialized here to match the live combat shape.
    lifetime: 0,
    ...overrides
  };
}

function createTraceState(enemyOverrides: Partial<CombatEnemy> = {}): TravelCombatState {
  return {
    player: {
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: 12,
      level: 1,
      xp: 0,
      hp: 60,
      maxHp: 60,
      attack: 9,
      maxSpeed: 6,
      fireCooldown: 0,
      laserTrace: null,
      tallyKills: 0,
      combatReward: 0
    },
    playerLoadout: {
      laserMounts: { front: 'pulse_laser', rear: null, left: null, right: null },
      installedEquipment: {
        shield_generator: false,
        fuel_scoops: false,
        ecm: false,
        docking_computer: false,
        galactic_hyperdrive: false,
        extra_energy_unit: false,
        energy_box_2: false,
        energy_box_3: false,
        energy_box_4: false,
        large_cargo_bay: false,
        escape_pod: false,
        energy_bomb: false
      },
      missilesInstalled: 0
    },
    playerTargetLock: null,
    enemies: [createEnemy(enemyOverrides)],
    projectiles: [],
    particles: [],
    station: null,
    encounter: {
      mcnt: 0,
      rareTimer: 0,
      ev: 0,
      safeZone: false,
      stationHostile: false,
      ecmTimer: 0,
      ecmFlashTimer: 0,
      bombEffectTimer: 0,
      copsNearby: 0,
      benignCooldown: 0,
      activeBlueprintFile: 'A'
    },
    legalValue: 0,
    legalStatus: 'clean',
    nextId: 1,
    currentSystemX: 20,
    currentSystemLevel: 1,
    currentGovernment: 0,
    currentTechLevel: 0,
    missionContext: {
      effectiveDestinationSystem: 'Lave',
      primaryObjectiveText: 'Travel to Lave.',
      pirateSpawnMultiplier: 1,
      policeHostile: false,
      policeSuppressed: false,
      blockadeAtDestination: false,
      missionTargetSystems: []
    },
    witchspace: false,
    pendingMissionMessages: [],
    missionSpawnBudget: 0,
    messages: [],
    missionEvents: [],
    salvageCargo: {},
    salvageFuel: 0,
    lastPlayerArc: 'front'
  };
}

describe('getEnemyHealthBarState', () => {
  it('hides the bar for undamaged enemies', () => {
    expect(getEnemyHealthBarState(createEnemy())).toBeNull();
  });

  it('shows the bar and clamps the ratio for damaged enemies', () => {
    expect(getEnemyHealthBarState(createEnemy({ hp: 35 }))).toEqual({
      ratio: 0.5,
      fillColor: CGA_YELLOW
    });

    expect(getEnemyHealthBarState(createEnemy({ hp: 120 }))).toBeNull();

    expect(getEnemyHealthBarState(createEnemy({ hp: -10 }))).toEqual({
      ratio: 0,
      fillColor: CGA_RED
    });
  });

  it('reports a normalized HP ratio for partial damage', () => {
    expect(getEnemyHealthBarState(createEnemy({ hp: 52.5, maxHp: 70 }))?.ratio).toBeCloseTo(0.75, 5);
    expect(getEnemyHealthBarState(createEnemy({ hp: 43.75, maxHp: 70 }))?.ratio).toBeCloseTo(0.625, 5);
  });

  it('uses CGA fill colors for high, mid, and low health', () => {
    expect(getEnemyHealthBarState(createEnemy({ hp: 55 }))?.fillColor).toBe(CGA_GREEN);
    expect(getEnemyHealthBarState(createEnemy({ hp: 28 }))?.fillColor).toBe(CGA_YELLOW);
    expect(getEnemyHealthBarState(createEnemy({ hp: 20 }))?.fillColor).toBe(CGA_RED);
  });
});

describe('travel bar helpers', () => {
  it('splits energy into segmented banks for HUD and overlays alike', () => {
    expect(getSegmentedBankRatios(256, 256, 4)).toEqual([1, 1, 1, 1]);
    expect(getSegmentedBankRatios(160, 256, 4)).toEqual([1, 1, 0.5, 0]);
    expect(getSegmentedBankRatios(0, 256, 4)).toEqual([0, 0, 0, 0]);
  });

  it('uses the same CGA thresholds for player and enemy bars', () => {
    expect(getCgaBarFillColor(0.9)).toBe(CGA_GREEN);
    expect(getCgaBarFillColor(0.5)).toBe(CGA_YELLOW);
    expect(getCgaBarFillColor(0.2)).toBe(CGA_RED);
  });
});

describe('enemy laser traces', () => {
  it('returns no trace when the enemy is not firing', () => {
    const state = createTraceState({ isFiringLaser: false });
    expect(getEnemyLaserTrace(state.enemies[0], state)).toBeNull();
  });

  it('aims visible enemy laser traces toward the player', () => {
    const state = createTraceState({ x: 0, y: 0, laserRange: 80, isFiringLaser: true });
    expect(getEnemyLaserTrace(state.enemies[0], state)).toEqual({
      startX: 10,
      startY: 0,
      endX: 80,
      endY: 0
    });
  });
});
