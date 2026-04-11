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
      energy: 255,
      maxEnergy: 255,
      energyBanks: 4,
      energyPerBank: 64,
      shield: 255,
      maxShield: 255,
      laserHeat: { front: 0, rear: 0, left: 0, right: 0 },
      maxLaserHeat: 100,
      laserHeatCooldownRate: 12,
      maxSpeed: 6,
      fireCooldown: 0,
      tallyKills: 0,
      combatReward: 0,
      energyRechargePerTick: 1,
      shieldRechargePerTick: 1,
      rechargeTickAccumulator: 0
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
    playerLasersActive: true,
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
