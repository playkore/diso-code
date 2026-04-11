import type { BlueprintId } from '../../../domain/combat/types';
import { BufferGeometry, Float32BufferAttribute, FrontSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { STATION_MESH_DEFINITION } from '../../../domain/combat/station/stationGeometry';
import { getEliteShipMeshDefinition, type ShipMeshDefinition } from './eliteShipGeometry';

import { CGA_BLACK, CGA_YELLOW } from './constants';

export type EnemyShipMeshId = BlueprintId;

export interface ShipPresenter {
  id: 'low-poly-ships';
  createShipObject: (shipId: EnemyShipMeshId, edgeColor: string) => Object3D;
}

/**
 * Every rendered ship now uses the same authored mesh pipeline.
 *
 * The helper keeps the renderer-side Three.js object construction in one
 * place so callers only choose the blueprint and edge color; they never need
 * to care whether that ship is a player hull, an enemy hull, or a station.
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
      side: FrontSide,
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
      depthTest: true,
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

/**
 * The rendered ship uses the renderer's native Three.js axes:
 * - `+X` points toward the nose
 * - `+Y` spans the ship's left/right silhouette in screen space
 * - `+Z` lifts the dorsal hump toward the camera
 *
 * Travel rendering never enables scene lights, so every ship stays inside the
 * CGA palette by using black hull faces plus colored wire edges only.
 */
export function createShipObject(shipId: EnemyShipMeshId, edgeColor: string) {
  return createWireframeMeshObject(getEliteShipMeshDefinition(shipId), edgeColor);
}

/**
 * The station mesh follows the original BBC Elite Coriolis blueprint: a
 * rotating octagonal body with a rectangular docking slot cut into the front
 * face rather than a synthetic protruding tunnel.
 */
export function createStationObject() {
  return createWireframeMeshObject(STATION_MESH_DEFINITION, CGA_YELLOW);
}

export const SHIP_PRESENTER: ShipPresenter = {
  id: 'low-poly-ships',
  createShipObject
};
