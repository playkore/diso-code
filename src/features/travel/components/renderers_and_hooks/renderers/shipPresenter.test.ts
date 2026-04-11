import { Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createShipObject, createStationObject, SHIP_PRESENTER } from './shipPresenter';
import { CGA_BLACK, CGA_RED, CGA_YELLOW } from './constants';
import { STATION_MESH_DEFINITION } from '../../../domain/combat/station/stationGeometry';

function subtractPoint(
  [ax, ay, az]: readonly [number, number, number],
  [bx, by, bz]: readonly [number, number, number]
) {
  return [ax - bx, ay - by, az - bz] as const;
}

function crossProduct(
  [ax, ay, az]: readonly [number, number, number],
  [bx, by, bz]: readonly [number, number, number]
) {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx] as const;
}

function dotProduct(
  [ax, ay, az]: readonly [number, number, number],
  [bx, by, bz]: readonly [number, number, number]
) {
  return ax * bx + ay * by + az * bz;
}

describe('createShipObject', () => {
  it('builds a black-faced ship with a yellow wireframe edge overlay', () => {
    const ship = createShipObject('cobra-mk3-trader', CGA_YELLOW);
    const hull = ship.children[0] as Mesh;
    const edges = ship.children[1] as LineSegments;
    const hullMaterial = hull.material as MeshBasicMaterial;
    const edgeMaterial = edges.material as LineBasicMaterial;

    expect(ship).toBeInstanceOf(Group);
    expect(ship.children).toHaveLength(2);
    expect(hull).toBeInstanceOf(Mesh);
    expect(edges).toBeInstanceOf(LineSegments);
    expect(hullMaterial.color.getHexString()).toBe(CGA_BLACK.slice(1));
    expect(hullMaterial.polygonOffset).toBe(true);
    expect(edgeMaterial.color.getHexString()).toBe(CGA_YELLOW.slice(1));
    expect(edgeMaterial.depthWrite).toBe(false);
    expect(edges.geometry.getAttribute('position').count).toBe(76);
  });
});

describe('SHIP_PRESENTER', () => {
  it('exposes the single mesh-backed ship presenter', () => {
    expect(SHIP_PRESENTER).toMatchObject({
      id: 'low-poly-ships'
    });
    expect(SHIP_PRESENTER.createShipObject('sidewinder', CGA_RED)).toBeInstanceOf(Group);
  });

  it('keeps separate authored 3D meshes for different ship blueprints', () => {
    const police = createShipObject('viper', CGA_YELLOW);
    const thargoid = createShipObject('thargoid', CGA_YELLOW);

    expect(police).toBeInstanceOf(Group);
    expect(thargoid).toBeInstanceOf(Group);
    expect((police.children[1] as LineSegments).geometry.getAttribute('position').count).not.toBe(
      (thargoid.children[1] as LineSegments).geometry.getAttribute('position').count
    );
  });
});

describe('createStationObject', () => {
  it('builds the authored Coriolis station mesh from the original Elite outline', () => {
    const station = createStationObject();
    const hull = station.children[0] as Mesh;
    const edges = station.children[1] as LineSegments;

    expect(station).toBeInstanceOf(Group);
    expect(hull).toBeInstanceOf(Mesh);
    expect(edges).toBeInstanceOf(LineSegments);
    expect(((hull.material as MeshBasicMaterial).color.getHexString())).toBe(CGA_BLACK.slice(1));
    expect(((edges.material as LineBasicMaterial).color.getHexString())).toBe(CGA_YELLOW.slice(1));
    expect(edges.geometry.getAttribute('position').count).toBe(56);
  });

  it('keeps every filled station triangle wound outward for back-face culling', () => {
    for (const triangle of STATION_MESH_DEFINITION.hullTriangles) {
      const [a, b, c] = triangle;
      const normal = crossProduct(subtractPoint(b, a), subtractPoint(c, a));
      const centroid = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3
      ] as const;

      // The Coriolis hull is centered at the origin, so outward-facing
      // triangles must have normals that point in the same direction as their
      // centroid vector. Negative dot products indicate reversed winding.
      expect(dotProduct(normal, centroid)).toBeGreaterThan(0);
    }
  });
});
