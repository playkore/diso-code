import { describe, expect, it } from 'vitest';
import { BACKGROUND_OBJECT_DEFINITIONS, getBackgroundObjectDefinition } from './catalog';

describe('BACKGROUND_OBJECT_DEFINITIONS', () => {
  it('exposes stable unique ids for debug selection', () => {
    const ids = BACKGROUND_OBJECT_DEFINITIONS.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('stores multi-contour line shapes for preview rendering', () => {
    expect(BACKGROUND_OBJECT_DEFINITIONS.length).toBeGreaterThan(0);
    for (const definition of BACKGROUND_OBJECT_DEFINITIONS) {
      expect(definition.shape.length).toBeGreaterThan(0);
      for (const contour of definition.shape) {
        expect(contour.points.length).toBeGreaterThan(1);
      }
    }
  });

  it('returns definitions by id', () => {
    expect(getBackgroundObjectDefinition('wrecked-freighter')?.label).toBe('Wrecked Freighter');
    expect(getBackgroundObjectDefinition('missing-object')).toBeUndefined();
  });
});
