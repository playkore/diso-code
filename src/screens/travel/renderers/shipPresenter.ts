import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, type Object3D } from 'three';

import { CGA_BLACK, CGA_YELLOW } from './constants';

type HullPoint = readonly [x: number, y: number, z: number];
type Triangle = readonly [HullPoint, HullPoint, HullPoint];
type Edge = readonly [HullPoint, HullPoint];

export interface ShipPresenter {
  id: 'flat-wireframe' | 'low-poly-player';
  enemyGeometryMode: 'line-shape';
  playerGeometryMode: 'line-shape' | 'mesh';
  createPlayerObject?: () => Object3D;
}

export type RequestedShipPresenter = ShipPresenter['id'];

/**
 * Builds a non-indexed triangle list because this renderer values explicit
 * face ownership over vertex deduplication. That keeps the low-poly ship easy
 * to reshape and lets the hull surface and edge overlay share the exact same
 * triangle layout instead of depending on a separate authored line asset.
 */
function createTriangleGeometry(triangles: readonly Triangle[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(triangles.flatMap((triangle) => triangle.flat()), 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The wire overlay is authored explicitly instead of derived from triangle
 * edges. That keeps the visible frame symmetric even when the fill geometry
 * needs uneven triangulation under the hood.
 */
function createEdgeGeometry(edges: readonly Edge[]) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(edges.flatMap((edge) => [...edge[0], ...edge[1]]), 3));
  return geometry;
}

/**
 * The player hull uses the renderer's native Three.js axes:
 * - `+X` points toward the nose
 * - `+Y` spans the ship's left/right silhouette in screen space
 * - `+Z` lifts the dorsal hump toward the camera
 *
 * Travel rendering never enables scene lights, so the player ship now gets its
 * depth from silhouette and edge definition rather than shaded faces. The hull
 * stays pure black so it never leaves the CGA palette, while a yellow edge
 * overlay keeps the low-poly form readable against the starfield.
 */
export function createLowPolyPlayerObject() {
  const nose: HullPoint = [15, 0, 0];
  const leftShoulder: HullPoint = [4, 9, 2];
  const rightShoulder: HullPoint = [4, -9, 2];
  const cockpit: HullPoint = [1, 0, 5];
  const leftTail: HullPoint = [-12, 6, 1];
  const rightTail: HullPoint = [-12, -6, 1];
  const spine: HullPoint = [-14, 0, 2];
  const leftKeel: HullPoint = [-7, 4, -3];
  const rightKeel: HullPoint = [-7, -4, -3];
  const exhaust: HullPoint = [-15, 0, -1];

  const hullGeometry = createTriangleGeometry([
    [nose, leftShoulder, cockpit],
    [nose, cockpit, rightShoulder],
    [leftShoulder, leftTail, cockpit],
    [cockpit, leftTail, spine],
    [cockpit, spine, rightTail],
    [cockpit, rightTail, rightShoulder],
    [nose, rightShoulder, rightKeel],
    [nose, rightKeel, leftKeel],
    [nose, leftKeel, leftShoulder],
    [leftShoulder, leftKeel, leftTail],
    [leftTail, leftKeel, exhaust],
    [exhaust, rightKeel, rightTail],
    [rightTail, rightKeel, rightShoulder]
  ]);
  const edgeGeometry = createEdgeGeometry([
    [nose, leftShoulder],
    [leftShoulder, leftTail],
    [leftTail, spine],
    [spine, rightTail],
    [rightTail, rightShoulder],
    [rightShoulder, nose],
    [nose, cockpit],
    [cockpit, spine],
    [nose, leftKeel],
    [leftKeel, exhaust],
    [exhaust, rightKeel],
    [rightKeel, nose],
    [leftShoulder, leftKeel],
    [rightShoulder, rightKeel],
    [leftTail, exhaust],
    [rightTail, exhaust]
  ]);

  const ship = new Group();
  const hull = new Mesh(
    hullGeometry,
    new MeshBasicMaterial({
      color: CGA_BLACK,
      // The face fill should sit just behind the wire overlay so the depth
      // buffer does not randomly punch holes through diagonal line segments.
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1
    })
  );
  const edges = new LineSegments(
    edgeGeometry,
    new LineBasicMaterial({
      color: CGA_YELLOW,
      depthWrite: false
    })
  );
  // The player ship now stays aligned with the shared world plane so its
  // silhouette reads as a strict front-facing wireframe instead of a tilted
  // pseudo-3D object. Heading still comes from the parent object's Z rotation
  // inside the travel scene renderer.
  ship.rotation.set(0, 0, 0);
  hull.renderOrder = 0;
  edges.renderOrder = 1;
  ship.add(hull);
  // The edge pass carries the visual identity now: the face fill stays black,
  // and the yellow contour gives the hull a deliberate "wireframe" read.
  ship.add(edges);
  return ship;
}

export const FLAT_WIREFRAME_SHIP_PRESENTER: ShipPresenter = {
  id: 'flat-wireframe',
  enemyGeometryMode: 'line-shape',
  playerGeometryMode: 'line-shape'
};

export const LOW_POLY_PLAYER_SHIP_PRESENTER: ShipPresenter = {
  id: 'low-poly-player',
  enemyGeometryMode: 'line-shape',
  playerGeometryMode: 'mesh',
  createPlayerObject: createLowPolyPlayerObject
};

export function selectShipPresenter(requested: RequestedShipPresenter = 'low-poly-player'): ShipPresenter {
  if (requested === 'flat-wireframe') {
    return FLAT_WIREFRAME_SHIP_PRESENTER;
  }
  return LOW_POLY_PLAYER_SHIP_PRESENTER;
}
