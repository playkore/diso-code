import { describe, expect, it } from 'vitest';
import { createDeterministicRandomSource, getAvailablePackHunters, getBlueprintAvailability, getCombatBlueprint, selectBlueprintFile, stepTravelCombat } from '../travelCombat';
import type { MissionTravelContext } from '../missions';
import { createCombatState } from './combatTestUtils';

const EMPTY_MISSION_CONTEXT: MissionTravelContext = {
  effectiveDestinationSystem: 'Lave',
  primaryObjectiveText: 'Travel to Lave.',
  activeEffects: [],
  pirateSpawnMultiplier: 1,
  policeHostile: false,
  policeSuppressed: false,
  blockadeAtDestination: false,
  missionTargetSystems: [],
  missionMessages: []
};

describe('travel combat encounters', () => {
  it('selects blueprint files from system danger and mission state', () => {
    expect(selectBlueprintFile({ government: 0, techLevel: 7, missionContext: EMPTY_MISSION_CONTEXT, witchspace: false, randomByte: 0 })).toBe('E');
    expect(selectBlueprintFile({ government: 7, techLevel: 12, missionContext: EMPTY_MISSION_CONTEXT, witchspace: false, randomByte: 6 })).toBe('L');
    expect(
      selectBlueprintFile({
        government: 4,
        techLevel: 8,
        missionContext: { ...EMPTY_MISSION_CONTEXT, missionTargetSystems: ['Diso'] },
        witchspace: false,
        randomByte: 1
      })
    ).toBe('O');
  });

  it('keeps pack-hunter availability tied to the active blueprint file', () => {
    expect(getBlueprintAvailability('E')).toContain('cobra-mk3-pirate');
    expect(getAvailablePackHunters('A')).toEqual(['sidewinder', 'mamba']);
  });

  it('uses EV gating to delay dangerous spawns until the rare timer expires', () => {
    const rng = createDeterministicRandomSource([0, 255, 255, 255, 255, 255]);
    const state = createCombatState([0, 255, 255, 255, 255, 255]);
    state.encounter.ev = 1;
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.roles.hostile || enemy.roles.pirate || enemy.missionTag)).toBe(false);
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('spawns cops more readily when cargo badness is present', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0], { government: 7, techLevel: 12 });
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 256, 'PLAYING', { narcotics: 10 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(true);
  });

  it('spawns pirate pressure from valuable legal cargo without cops', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0], { government: 0, techLevel: 12 });
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 256, 'PLAYING', { luxuries: 12, computers: 8 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.pirate || enemy.roles.hostile)).toBe(true);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(false);
  });

  it('caps pirate encounters so repeated rare ticks do not accumulate endless packs', () => {
    const bytes = new Array(128).fill(255);
    const rng = createDeterministicRandomSource(bytes);
    const state = createCombatState(bytes, { government: 0, techLevel: 12 });

    for (let i = 0; i < 12; i += 1) {
      stepTravelCombat(state, { thrust: 0, turn: 0 }, 256, 'PLAYING', {}, rng);
    }

    expect(state.enemies.filter((enemy) => enemy.roles.pirate || enemy.roles.hostile).length).toBeLessThanOrEqual(4);
    expect(state.enemies.length).toBeLessThanOrEqual(12);
  });

  it('despawns ambient pirates once they drift far from the player', () => {
    const state = createCombatState([0, 0, 0, 0]);
    const blueprint = getCombatBlueprint('sidewinder');
    state.enemies.push({
      id: 1,
      kind: 'ship',
      blueprintId: blueprint.id,
      label: blueprint.label,
      behavior: blueprint.behavior,
      x: 2_000,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      energy: blueprint.maxEnergy,
      maxEnergy: blueprint.maxEnergy,
      laserPower: blueprint.laserPower,
      missiles: blueprint.missiles,
      targetableArea: blueprint.targetableArea,
      laserRange: blueprint.laserRange,
      topSpeed: blueprint.topSpeed,
      acceleration: blueprint.acceleration,
      turnRate: blueprint.turnRate,
      roles: { ...blueprint.roles },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 0,
      isFiringLaser: false,
      lifetime: 0
    });

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));
    expect(state.enemies).toHaveLength(0);
  });

  it('keeps nearby ambient pirates alive even after a long time in the encounter', () => {
    const state = createCombatState([0, 0, 0, 0]);
    const blueprint = getCombatBlueprint('sidewinder');
    state.enemies.push({
      id: 1,
      kind: 'ship',
      blueprintId: blueprint.id,
      label: blueprint.label,
      behavior: blueprint.behavior,
      x: 150,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      energy: blueprint.maxEnergy,
      maxEnergy: blueprint.maxEnergy,
      laserPower: blueprint.laserPower,
      missiles: blueprint.missiles,
      targetableArea: blueprint.targetableArea,
      laserRange: blueprint.laserRange,
      topSpeed: blueprint.topSpeed,
      acceleration: blueprint.acceleration,
      turnRate: blueprint.turnRate,
      roles: { ...blueprint.roles },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 0,
      isFiringLaser: false,
      lifetime: 60 * 60
    });

    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, createDeterministicRandomSource([0, 0, 0, 0]));
    expect(state.enemies).toHaveLength(1);
    expect(state.enemies[0].id).toBe(1);
  });
});
