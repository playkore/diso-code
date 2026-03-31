import { describe, expect, it } from 'vitest';
import { CLASSIC_COORDINATE_SCALE } from '../../../domain/combat/classicFlightModel';
import { getEliteShipMeshDefinition } from './eliteShipGeometry';

describe('getEliteShipMeshDefinition', () => {
  it('keeps the Cobra Mk III nose antenna out of filled hull triangulation', () => {
    const definition = getEliteShipMeshDefinition('cobra-mk3-player');
    const antennaTipX = 90 * CLASSIC_COORDINATE_SCALE;

    const hullUsesAntennaTip = definition.hullTriangles.some((triangle) =>
      triangle.some(([x, y, z]) => Math.abs(x - antennaTipX) < 0.0001 && Math.abs(y) < 0.0001 && Math.abs(z) < 0.0001)
    );

    expect(hullUsesAntennaTip).toBe(false);
  });
});
