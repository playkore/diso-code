import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { STATION_MESH_DEFINITION } from '../../../domain/combat/station/stationGeometry';

import { CGA_BLACK, CGA_YELLOW } from './constants';

type HullPoint = readonly [x: number, y: number, z: number];
type Triangle = readonly [HullPoint, HullPoint, HullPoint];
type Edge = readonly [HullPoint, HullPoint];

export type EnemyShipMeshId = 'enemy' | 'police' | 'thargoid';

export interface ShipMeshDefinition {
  hullTriangles: readonly Triangle[];
  wireEdges: readonly Edge[];
}

export interface ShipPresenter {
  id: 'flat-wireframe' | 'low-poly-ships';
  enemyGeometryMode: 'line-shape' | 'mesh';
  playerGeometryMode: 'line-shape' | 'mesh';
  createEnemyObject?: (shipId: EnemyShipMeshId, edgeColor: string) => Object3D;
  createPlayerObject?: () => Object3D;
}

export type RequestedShipPresenter = ShipPresenter['id'];

/**
 * Every 3D ship now has an explicit authored mesh definition instead of being
 * derived from the legacy 2D contour on the fly. That keeps renderer logic
 * simple and lets each hull evolve independently in the future.
 */
function createTriangleGeometry(triangles: readonly Triangle[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flatMap((triangle) => triangle.flat()), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createEdgeGeometry(edges: readonly Edge[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(edges.flatMap((edge) => [...edge[0], ...edge[1]]), 3));
  return geometry;
}

function createWireframeMeshObject(definition: ShipMeshDefinition, edgeColor: string) {
  const hull = new Mesh(
    createTriangleGeometry(definition.hullTriangles),
    new MeshBasicMaterial({
      color: CGA_BLACK,
      // Faces stay slightly behind the edge overlay so role-colored outlines do
      // not flicker or break when the camera compresses diagonal segments.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );
  const edges = new LineSegments(
    createEdgeGeometry(definition.wireEdges),
    new LineBasicMaterial({
      color: edgeColor,
      depthWrite: false
    })
  );

  const ship = new Group();
  ship.rotation.set(0, 0, 0);
  hull.renderOrder = 0;
  edges.renderOrder = 1;
  ship.add(hull);
  ship.add(edges);
  return ship;
}

const PLAYER_MESH: ShipMeshDefinition = {
  hullTriangles: [
    [[15, 0, 0], [4, 9, 2], [1, 0, 5]],
    [[15, 0, 0], [1, 0, 5], [4, -9, 2]],
    [[4, 9, 2], [-12, 6, 1], [1, 0, 5]],
    [[1, 0, 5], [-12, 6, 1], [-14, 0, 2]],
    [[1, 0, 5], [-14, 0, 2], [-12, -6, 1]],
    [[1, 0, 5], [-12, -6, 1], [4, -9, 2]],
    [[15, 0, 0], [4, -9, 2], [-7, -4, -3]],
    [[15, 0, 0], [-7, -4, -3], [-7, 4, -3]],
    [[15, 0, 0], [-7, 4, -3], [4, 9, 2]],
    [[4, 9, 2], [-7, 4, -3], [-12, 6, 1]],
    [[-12, 6, 1], [-7, 4, -3], [-15, 0, -1]],
    [[-15, 0, -1], [-7, -4, -3], [-12, -6, 1]],
    [[-12, -6, 1], [-7, -4, -3], [4, -9, 2]]
  ],
  wireEdges: [
    [[15, 0, 0], [4, 9, 2]],
    [[4, 9, 2], [-12, 6, 1]],
    [[-12, 6, 1], [-14, 0, 2]],
    [[-14, 0, 2], [-12, -6, 1]],
    [[-12, -6, 1], [4, -9, 2]],
    [[4, -9, 2], [15, 0, 0]],
    [[15, 0, 0], [1, 0, 5]],
    [[1, 0, 5], [-14, 0, 2]],
    [[15, 0, 0], [-7, 4, -3]],
    [[-7, 4, -3], [-15, 0, -1]],
    [[-15, 0, -1], [-7, -4, -3]],
    [[-7, -4, -3], [15, 0, 0]],
    [[4, 9, 2], [-7, 4, -3]],
    [[4, -9, 2], [-7, -4, -3]],
    [[-12, 6, 1], [-15, 0, -1]],
    [[-12, -6, 1], [-15, 0, -1]]
  ]
};

const ENEMY_MESH: ShipMeshDefinition = {
  hullTriangles: [
    [[12, 0, 0], [-2, 9, 2], [-2, -9, 2]],
    [[12, 0, 0], [-2, -9, 2], [-8, 0, 5]],
    [[12, 0, 0], [-8, 0, 5], [-2, 9, 2]],
    [[12, 0, 0], [-2, 6, -3], [-6, 0, -4]],
    [[12, 0, 0], [-6, 0, -4], [-2, -6, -3]],
    [[12, 0, 0], [-2, -6, -3], [-2, 6, -3]],
    [[-2, 9, 2], [-8, 0, 5], [-8, 10, 0]],
    [[-2, -9, 2], [-8, -10, 0], [-8, 0, 5]],
    [[-2, 6, -3], [-8, 10, 0], [-6, 0, -4]],
    [[-2, -6, -3], [-6, 0, -4], [-8, -10, 0]],
    [[-8, 10, 0], [-8, 0, 5], [-8, -10, 0]],
    [[-8, 10, 0], [-8, -10, 0], [-6, 0, -4]]
  ],
  wireEdges: [
    [[12, 0, 0], [-2, 9, 2]],
    [[12, 0, 0], [-2, -9, 2]],
    [[12, 0, 0], [-2, 6, -3]],
    [[12, 0, 0], [-2, -6, -3]],
    [[-2, 9, 2], [-8, 10, 0]],
    [[-2, -9, 2], [-8, -10, 0]],
    [[-2, 6, -3], [-6, 0, -4]],
    [[-2, -6, -3], [-6, 0, -4]],
    [[-8, 10, 0], [-8, 0, 5]],
    [[-8, 0, 5], [-8, -10, 0]],
    [[-8, 10, 0], [-6, 0, -4]],
    [[-6, 0, -4], [-8, -10, 0]]
  ]
};

const POLICE_MESH: ShipMeshDefinition = {
  hullTriangles: [
    [[13, 0, 0], [0, 0, 5], [0, 12, 0]],
    [[13, 0, 0], [0, -12, 0], [0, 0, 5]],
    [[13, 0, 0], [0, 12, 0], [0, 0, -5]],
    [[13, 0, 0], [0, 0, -5], [0, -12, 0]],
    [[0, 12, 0], [-10, 0, 0], [0, 0, 5]],
    [[0, 0, 5], [-10, 0, 0], [0, -12, 0]],
    [[0, 12, 0], [0, 0, -5], [-10, 0, 0]],
    [[0, 0, -5], [0, -12, 0], [-10, 0, 0]]
  ],
  wireEdges: [
    [[13, 0, 0], [0, 12, 0]],
    [[13, 0, 0], [0, -12, 0]],
    [[13, 0, 0], [0, 0, 5]],
    [[13, 0, 0], [0, 0, -5]],
    [[0, 12, 0], [-10, 0, 0]],
    [[-10, 0, 0], [0, -12, 0]],
    [[0, 12, 0], [0, 0, 5]],
    [[0, 0, 5], [0, -12, 0]],
    [[0, 12, 0], [0, 0, -5]],
    [[0, 0, -5], [0, -12, 0]],
    [[0, 0, 5], [-10, 0, 0]],
    [[-10, 0, 0], [0, 0, -5]]
  ]
};

const THARGOID_MESH: ShipMeshDefinition = {
  hullTriangles: [
    [[12, 0, 0], [4, 12, 0], [0, 0, 5]],
    [[4, 12, 0], [-8, 8, 0], [0, 0, 5]],
    [[-8, 8, 0], [-12, 0, 0], [0, 0, 5]],
    [[-12, 0, 0], [-8, -8, 0], [0, 0, 5]],
    [[-8, -8, 0], [4, -12, 0], [0, 0, 5]],
    [[4, -12, 0], [12, 0, 0], [0, 0, 5]],
    [[4, 12, 0], [12, 0, 0], [0, 0, -5]],
    [[-8, 8, 0], [4, 12, 0], [0, 0, -5]],
    [[-12, 0, 0], [-8, 8, 0], [0, 0, -5]],
    [[-8, -8, 0], [-12, 0, 0], [0, 0, -5]],
    [[4, -12, 0], [-8, -8, 0], [0, 0, -5]],
    [[12, 0, 0], [4, -12, 0], [0, 0, -5]]
  ],
  wireEdges: [
    [[12, 0, 0], [4, 12, 0]],
    [[4, 12, 0], [-8, 8, 0]],
    [[-8, 8, 0], [-12, 0, 0]],
    [[-12, 0, 0], [-8, -8, 0]],
    [[-8, -8, 0], [4, -12, 0]],
    [[4, -12, 0], [12, 0, 0]],
    [[12, 0, 0], [0, 0, 5]],
    [[4, 12, 0], [0, 0, 5]],
    [[-8, 8, 0], [0, 0, 5]],
    [[-12, 0, 0], [0, 0, 5]],
    [[-8, -8, 0], [0, 0, 5]],
    [[4, -12, 0], [0, 0, 5]],
    [[12, 0, 0], [0, 0, -5]],
    [[4, 12, 0], [0, 0, -5]],
    [[-8, 8, 0], [0, 0, -5]],
    [[-12, 0, 0], [0, 0, -5]],
    [[-8, -8, 0], [0, 0, -5]],
    [[4, -12, 0], [0, 0, -5]]
  ]
};

const ENEMY_SHIP_MESHES: Record<EnemyShipMeshId, ShipMeshDefinition> = {
  enemy: ENEMY_MESH,
  police: POLICE_MESH,
  thargoid: THARGOID_MESH
};

const STATION_MESH: ShipMeshDefinition = STATION_MESH_DEFINITION;

/**
 * The player hull uses the renderer's native Three.js axes:
 * - `+X` points toward the nose
 * - `+Y` spans the ship's left/right silhouette in screen space
 * - `+Z` lifts the dorsal hump toward the camera
 *
 * Travel rendering never enables scene lights, so every ship stays inside the
 * CGA palette by using black hull faces plus colored wire edges only.
 */
export function createLowPolyPlayerObject() {
  return createWireframeMeshObject(PLAYER_MESH, CGA_YELLOW);
}

export function createLowPolyEnemyObject(shipId: EnemyShipMeshId, edgeColor: string) {
  return createWireframeMeshObject(ENEMY_SHIP_MESHES[shipId], edgeColor);
}

/**
 * The station uses a simple cube hull plus a short square docking tunnel on
 * the +X face. The tunnel keeps the target readable in motion without forcing
 * the renderer to cut a more complex opening through the whole station body.
 */
export function createStationObject() {
  return createWireframeMeshObject(STATION_MESH, CGA_YELLOW);
}

export const FLAT_WIREFRAME_SHIP_PRESENTER: ShipPresenter = {
  id: 'flat-wireframe',
  enemyGeometryMode: 'line-shape',
  playerGeometryMode: 'line-shape'
};

export const LOW_POLY_SHIP_PRESENTER: ShipPresenter = {
  id: 'low-poly-ships',
  enemyGeometryMode: 'mesh',
  playerGeometryMode: 'mesh',
  createEnemyObject: createLowPolyEnemyObject,
  createPlayerObject: createLowPolyPlayerObject
};

export function selectShipPresenter(requested: RequestedShipPresenter = 'low-poly-ships'): ShipPresenter {
  if (requested === 'flat-wireframe') {
    return FLAT_WIREFRAME_SHIP_PRESENTER;
  }
  return LOW_POLY_SHIP_PRESENTER;
}
