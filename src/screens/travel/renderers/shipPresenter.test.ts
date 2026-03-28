import { Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createLowPolyPlayerObject, selectShipPresenter } from './shipPresenter';
import { CGA_BLACK, CGA_YELLOW } from './constants';

describe('createLowPolyPlayerObject', () => {
  it('builds a black-faced ship with a yellow wireframe edge overlay', () => {
    const ship = createLowPolyPlayerObject();
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
    expect(edges.geometry.getAttribute('position').count).toBe(32);
  });
});

describe('selectShipPresenter geometry split', () => {
  it('keeps enemy ships on the line-shape path while the player uses a mesh', () => {
    const presenter = selectShipPresenter();

    expect(presenter.enemyGeometryMode).toBe('line-shape');
    expect(presenter.playerGeometryMode).toBe('mesh');
    expect(presenter.createPlayerObject?.()).toBeInstanceOf(Group);
  });
});
