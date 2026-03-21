import { describe, expect, it } from 'vitest';
import { createDeterministicRandomSource, getAvailablePackHunters, getBlueprintAvailability, selectBlueprintFile, stepTravelCombat } from '../travelCombat';
import { TP_MISSION_FLAGS } from '../missions';
import { createCombatState } from './combatTestUtils';

describe('travel combat encounters', () => {
  it('selects blueprint files from system danger and mission state', () => {
    expect(selectBlueprintFile({ government: 0, techLevel: 7, missionTP: 0, witchspace: false, randomByte: 0 })).toBe('E');
    expect(selectBlueprintFile({ government: 7, techLevel: 12, missionTP: 0, witchspace: false, randomByte: 6 })).toBe('L');
    expect(selectBlueprintFile({ government: 4, techLevel: 8, missionTP: TP_MISSION_FLAGS.thargoidPlansBriefed, witchspace: false, randomByte: 1 })).toBe('D');
  });

  it('keeps pack-hunter availability tied to the active blueprint file', () => {
    expect(getBlueprintAvailability('E')).toContain('cobra-mk3-pirate');
    expect(getAvailablePackHunters('A')).toEqual(['sidewinder', 'mamba']);
  });

  it('uses EV gating to delay dangerous spawns until the rare timer expires', () => {
    const rng = createDeterministicRandomSource([0, 255, 255, 255, 255, 255]);
    const state = createCombatState([0, 255, 255, 255, 255, 255]);
    state.encounter.ev = 1;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.roles.hostile || enemy.roles.pirate || enemy.missionTag)).toBe(false);
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('spawns cops more readily when cargo badness is present', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0], { government: 7, techLevel: 12 });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', { narcotics: 10 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(true);
  });

  it('spawns pirate pressure from valuable legal cargo without cops', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0], { government: 0, techLevel: 12 });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', { luxuries: 12, computers: 8 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.pirate || enemy.roles.hostile)).toBe(true);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(false);
  });
});
