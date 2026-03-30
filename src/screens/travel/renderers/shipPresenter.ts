import type { BlueprintId } from '../../../domain/combat/types';
import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { STATION_MESH_DEFINITION } from '../../../domain/combat/station/stationGeometry';
import { getEliteShipMeshDefinition, type ShipMeshDefinition } from './eliteShipGeometry';

import { CGA_BLACK, CGA_YELLOW } from './constants';

export type EnemyShipMeshId = BlueprintId;

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
function createTriangleGeometry(triangles: ShipMeshDefinition['hullTriangles']) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flatMap((triangle) => triangle.flat()), 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createEdgeGeometry(edges: ShipMeshDefinition['wireEdges']) {
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
  return createWireframeMeshObject(getEliteShipMeshDefinition('cobra-mk3-player'), CGA_YELLOW);
}

export function createLowPolyEnemyObject(shipId: EnemyShipMeshId, edgeColor: string) {
  return createWireframeMeshObject(getEliteShipMeshDefinition(shipId), edgeColor);
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
