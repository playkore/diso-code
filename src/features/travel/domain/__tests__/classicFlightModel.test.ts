import { describe, expect, it } from 'vitest';
import { BLUEPRINTS } from '../travelCombat';
import { CLASSIC_COORDINATE_SCALE, CLASSIC_PLAYER_TOP_SPEED, getClassicBlueprintTopSpeed, toWorldSpeed } from '../combat/classicFlightModel';
import { createCombatState } from '../combat/__tests__/combatTestUtils';

describe('classic flight model scaling', () => {
  it('keeps the player Cobra top speed tied to the classic DELTA value', () => {
    const state = createCombatState([0, 0, 0, 0]);
    expect(state.player.maxSpeed).toBeCloseTo(toWorldSpeed(CLASSIC_PLAYER_TOP_SPEED));
  });

  it('uses exact classic blueprint top speeds in scaled world units', () => {
    for (const [id, blueprint] of Object.entries(BLUEPRINTS)) {
      expect(blueprint.topSpeed).toBeCloseTo(toWorldSpeed(getClassicBlueprintTopSpeed(blueprint.id)));
      expect(blueprint.topSpeed / CLASSIC_COORDINATE_SCALE).toBeCloseTo(getClassicBlueprintTopSpeed(id as keyof typeof BLUEPRINTS));
    }
  });
});
