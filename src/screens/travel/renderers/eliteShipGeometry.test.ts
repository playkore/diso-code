import { describe, expect, it } from 'vitest';
import { CLASSIC_COORDINATE_SCALE } from '../../../domain/combat/classicFlightModel';
import { getEliteShipMeshDefinition } from './eliteShipGeometry';

function toScenePoint([x, y, z]: [number, number, number]) {
  return [z * CLASSIC_COORDINATE_SCALE, x * CLASSIC_COORDINATE_SCALE, y * CLASSIC_COORDINATE_SCALE] as const;
}

function triangleUsesRawPoints(
  definition: ReturnType<typeof getEliteShipMeshDefinition>,
  points: [[number, number, number], [number, number, number], [number, number, number]]
) {
  const scenePoints = points.map((point) => toScenePoint(point));
  return definition.hullTriangles.some((triangle) =>
    scenePoints.every((scenePoint) =>
      triangle.some(
        ([x, y, z]) =>
          Math.abs(x - scenePoint[0]) < 0.0001 &&
          Math.abs(y - scenePoint[1]) < 0.0001 &&
          Math.abs(z - scenePoint[2]) < 0.0001
      )
    )
  );
}

describe('getEliteShipMeshDefinition', () => {
  it('keeps the Cobra Mk III nose antenna out of filled hull triangulation', () => {
    const definition = getEliteShipMeshDefinition('cobra-mk3-trader');
    const antennaTipX = 90 * CLASSIC_COORDINATE_SCALE;

    const hullUsesAntennaTip = definition.hullTriangles.some((triangle) =>
      triangle.some(([x, y, z]) => Math.abs(x - antennaTipX) < 0.0001 && Math.abs(y) < 0.0001 && Math.abs(z) < 0.0001)
    );

    expect(hullUsesAntennaTip).toBe(false);
  });

  it('keeps disconnected but non-degenerate face patches for Mamba and Krait hulls', () => {
    const mamba = getEliteShipMeshDefinition('mamba');
    const krait = getEliteShipMeshDefinition('krait');

    const usesPoint = (definition: ReturnType<typeof getEliteShipMeshDefinition>, point: [number, number, number]) => {
      const scenePoint = toScenePoint(point);
      return definition.hullTriangles.some((triangle) =>
        triangle.some(
          ([x, y, z]) =>
            Math.abs(x - scenePoint[0]) < 0.0001 &&
            Math.abs(y - scenePoint[1]) < 0.0001 &&
            Math.abs(z - scenePoint[2]) < 0.0001
        )
      );
    };

    // Mamba face 0 contains two small but valid filled patches around these
    // vertices; they disappeared when triangulation kept only the largest
    // connected component of the face graph.
    expect(usesPoint(mamba, [-24, -7, -20])).toBe(true);
    expect(usesPoint(mamba, [24, -7, -20])).toBe(true);

    // Krait face 4/5 contain small filled triangles near the engine housing.
    expect(usesPoint(krait, [18, 11, -39])).toBe(true);
    expect(usesPoint(krait, [-18, 11, -39])).toBe(true);
  });

  it('keeps Krait boundary cycles while discarding dangling detail spokes', () => {
    const krait = getEliteShipMeshDefinition('krait');

    // These are the two large hull triangles that disappeared when the
    // triangulator treated a triangle-plus-spoke component as one fan.
    expect(triangleUsesRawPoints(krait, [[-90, 0, -3], [0, 0, 96], [0, 18, -48]])).toBe(true);
    expect(triangleUsesRawPoints(krait, [[0, 0, 96], [90, 0, -3], [0, -18, -48]])).toBe(true);

    // The cockpit/vent spokes are open V-shapes, not filled cycles.
    expect(triangleUsesRawPoints(krait, [[0, 5, 53], [0, 7, 38], [-18, 7, 19]])).toBe(false);
    expect(triangleUsesRawPoints(krait, [[0, 5, 53], [0, 7, 38], [18, 7, 19]])).toBe(false);
  });
});
