import type { BlueprintId } from '../../../domain/combat/types';
import { BufferGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Sprite, SpriteMaterial, Texture, type Object3D } from 'three';
import { STATION_MESH_DEFINITION } from '../../../domain/combat/station/stationGeometry';
import { getEliteShipMeshDefinition, type ShipMeshDefinition } from './eliteShipGeometry';

import { CGA_BLACK, CGA_GREEN, CGA_YELLOW } from './constants';

export type EnemyShipMeshId = BlueprintId;

interface ShipDebugOptions {
  showFaceLabels: boolean;
  showVertexLabels: boolean;
  doubleSidedHull: boolean;
}

const shipDebugOptions: ShipDebugOptions = {
  showFaceLabels: false,
  showVertexLabels: false,
  doubleSidedHull: false
};

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

function createFaceLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  const bootstrap = canvas.getContext('2d');
  if (!bootstrap) {
    return null;
  }
  bootstrap.font = 'bold 24px "Courier New", monospace';
  const metrics = bootstrap.measureText(text);
  canvas.width = Math.max(16, Math.ceil(metrics.width) + 10);
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.font = 'bold 24px "Courier New", monospace';
  ctx.fillStyle = CGA_GREEN;
  ctx.textBaseline = 'top';
  ctx.fillText(text, 5, 2);
  const texture = new Texture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  const sprite = new Sprite(
    new SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    })
  );
  sprite.center.set(0.5, 0.5);
  sprite.scale.set(canvas.width * 0.024, canvas.height * 0.024, 1);
  return sprite;
}

function createVertexLabelSprite(text: string) {
  const canvas = document.createElement('canvas');
  const bootstrap = canvas.getContext('2d');
  if (!bootstrap) {
    return null;
  }
  bootstrap.font = 'bold 64px "Courier New", monospace';
  const metrics = bootstrap.measureText(text);
  canvas.width = Math.max(48, Math.ceil(metrics.width) + 24);
  canvas.height = 84;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  ctx.font = 'bold 64px "Courier New", monospace';
  ctx.fillStyle = CGA_YELLOW;
  ctx.textBaseline = 'top';
  ctx.fillText(text, 12, 4);
  const texture = new Texture(canvas);
  texture.flipY = false;
  texture.needsUpdate = true;
  const sprite = new Sprite(
    new SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false
    })
  );
  sprite.center.set(0.5, 0.5);
  sprite.scale.set(canvas.width * 0.045, canvas.height * 0.045, 1);
  return sprite;
}

function createWireframeMeshObject(definition: ShipMeshDefinition, edgeColor: string) {
  const showLabelDebug = shipDebugOptions.showFaceLabels || shipDebugOptions.showVertexLabels;
  const hull = new Mesh(
    createTriangleGeometry(definition.hullTriangles),
    new MeshBasicMaterial({
      color: CGA_BLACK,
      side: shipDebugOptions.doubleSidedHull ? DoubleSide : FrontSide,
      transparent: showLabelDebug,
      opacity: showLabelDebug ? 0.35 : 1,
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
      // Double-sided debug hulls intentionally reveal triangles that are
      // normally culled. In that mode the edge overlay must ignore depth tests
      // or thin details such as the Cobra nose antenna get buried behind newly
      // visible faces and stop being useful as winding diagnostics.
      depthTest: !shipDebugOptions.doubleSidedHull,
      depthWrite: false
    })
  );

  const ship = new Group();
  ship.rotation.set(0, 0, 0);
  hull.renderOrder = 0;
  edges.renderOrder = 1;
  ship.add(hull);
  ship.add(edges);
  if (shipDebugOptions.showFaceLabels) {
    for (const label of definition.faceLabels) {
      const sprite = createFaceLabelSprite(String(label.index));
      if (!sprite) {
        continue;
      }
      // Labels sit slightly above the face along the authored normal so they
      // remain legible without z-fighting against the hull itself.
      sprite.position.set(
        label.position[0] + label.normal[0] * 0.14,
        label.position[1] + label.normal[1] * 0.14,
        label.position[2] + label.normal[2] * 0.14
      );
      sprite.renderOrder = 2;
      ship.add(sprite);
    }
  }
  if (shipDebugOptions.showVertexLabels) {
    for (const label of definition.vertexLabels) {
      const sprite = createVertexLabelSprite(String(label.index));
      if (!sprite) {
        continue;
      }
      // Vertex labels sit slightly above and to the starboard/up side so they
      // stay readable without being mistaken for the vertex position itself.
      sprite.position.set(label.position[0], label.position[1] + 0.18, label.position[2] + 0.18);
      sprite.renderOrder = 3;
      ship.add(sprite);
    }
  }
  return ship;
}

/**
 * The player Cobra has two engine nozzles on the stern. Rendering each plume
 * as its own narrow wedge keeps the silhouette aligned with the authored hull
 * instead of collapsing both engines into one centered exhaust streak.
 */
const STATION_MESH: ShipMeshDefinition = {
  ...STATION_MESH_DEFINITION,
  faceLabels: [],
  vertexLabels: []
};

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
 * The station mesh follows the original BBC Elite Coriolis blueprint: a
 * rotating octagonal body with a rectangular docking slot cut into the front
 * face rather than a synthetic protruding tunnel.
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

/**
 * The start-screen showcase can enable face ids and double-sided hulls while
 * debugging mesh winding. Keeping this mutable toggle local to the presenter
 * avoids threading debug-only flags through the live combat store.
 */
export function setShipPresenterDebugOptions(options: Partial<ShipDebugOptions>) {
  shipDebugOptions.showFaceLabels = options.showFaceLabels ?? shipDebugOptions.showFaceLabels;
  shipDebugOptions.showVertexLabels = options.showVertexLabels ?? shipDebugOptions.showVertexLabels;
  shipDebugOptions.doubleSidedHull = options.doubleSidedHull ?? shipDebugOptions.doubleSidedHull;
}
