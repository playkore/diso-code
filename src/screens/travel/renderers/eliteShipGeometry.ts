import type { BlueprintId } from '../../../domain/combat/types';
import { CLASSIC_COORDINATE_SCALE } from '../../../domain/combat/classicFlightModel';
import { RAW_ELITE_SHIP_MODELS } from './rawEliteShipModels';

type HullPoint = readonly [x: number, y: number, z: number];
type Triangle = readonly [HullPoint, HullPoint, HullPoint];
type Edge = readonly [HullPoint, HullPoint];

export interface ShipFaceLabelAnchor {
  index: number;
  position: HullPoint;
  normal: HullPoint;
}

export interface ShipMeshDefinition {
  hullTriangles: readonly Triangle[];
  wireEdges: readonly Edge[];
  faceLabels: readonly ShipFaceLabelAnchor[];
}

export type EliteShipModelId = BlueprintId | 'cobra-mk3-player';

type RawModelKey = keyof typeof RAW_ELITE_SHIP_MODELS;
type RawVertex = (typeof RAW_ELITE_SHIP_MODELS)[RawModelKey]['vertices'][number];
type RawFace = (typeof RAW_ELITE_SHIP_MODELS)[RawModelKey]['faces'][number];

/**
 * Elite's authored ship data uses a conventional "x right, y up, z nose"
 * coordinate system. The Three.js presenter expects "x nose, y wing span,
 * z dorsal height", so this remap rotates every point into the renderer's
 * native axes without changing handedness.
 */
function toScenePoint([x, y, z]: RawVertex): HullPoint {
  return [z * CLASSIC_COORDINATE_SCALE, x * CLASSIC_COORDINATE_SCALE, y * CLASSIC_COORDINATE_SCALE];
}

function toSceneNormal([x, y, z]: RawFace): HullPoint {
  return [z, x, y];
}

function subtractPoint(a: HullPoint, b: HullPoint): HullPoint {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function crossProduct(a: HullPoint, b: HullPoint): HullPoint {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function dotProduct(a: HullPoint, b: HullPoint) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalizeVector(vector: HullPoint): HullPoint {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length === 0) {
    return [0, 0, 1];
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function averagePoint(points: readonly HullPoint[]): HullPoint {
  const sum = points.reduce<HullPoint>(
    (accumulator, point) => [accumulator[0] + point[0], accumulator[1] + point[1], accumulator[2] + point[2]],
    [0, 0, 0]
  );
  return [sum[0] / points.length, sum[1] / points.length, sum[2] / points.length];
}

function getFaceVertexIndexes(edges: readonly (readonly [number, number, number, number])[], faceIndex: number) {
  const indexes = new Set<number>();
  for (const [start, end, faceA, faceB] of edges) {
    if (faceA === faceIndex || faceB === faceIndex) {
      indexes.add(start);
      indexes.add(end);
    }
  }
  return [...indexes];
}

function orderFaceVertices(points: readonly HullPoint[], normal: HullPoint) {
  const center = points.reduce<HullPoint>(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1], sum[2] + point[2]],
    [0, 0, 0]
  );
  const centroid: HullPoint = [center[0] / points.length, center[1] / points.length, center[2] / points.length];
  const planeNormal = normalizeVector(normal);
  const referenceAxis: HullPoint = Math.abs(planeNormal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const axisU = normalizeVector(crossProduct(planeNormal, referenceAxis));
  const axisV = normalizeVector(crossProduct(planeNormal, axisU));

  const ordered = [...points].sort((left, right) => {
    const leftOffset = subtractPoint(left, centroid);
    const rightOffset = subtractPoint(right, centroid);
    const leftAngle = Math.atan2(dotProduct(leftOffset, axisV), dotProduct(leftOffset, axisU));
    const rightAngle = Math.atan2(dotProduct(rightOffset, axisV), dotProduct(rightOffset, axisU));
    return leftAngle - rightAngle;
  });

  if (ordered.length >= 3) {
    const winding = dotProduct(
      crossProduct(subtractPoint(ordered[1], ordered[0]), subtractPoint(ordered[2], ordered[0])),
      planeNormal
    );
    if (winding < 0) {
      ordered.reverse();
    }
  }

  return ordered;
}

function triangulateFace(
  vertices: readonly HullPoint[],
  edges: readonly (readonly [number, number, number, number])[],
  face: RawFace,
  faceIndex: number
) {
  const vertexIndexes = getFaceVertexIndexes(edges, faceIndex);
  if (vertexIndexes.length < 3) {
    return { triangles: [] as Triangle[], label: null };
  }
  const faceNormal = normalizeVector(toSceneNormal(face));
  const orderedVertices = orderFaceVertices(vertexIndexes.map((index) => vertices[index]), faceNormal);
  const triangles: Triangle[] = [];
  for (let index = 1; index < orderedVertices.length - 1; index += 1) {
    triangles.push([orderedVertices[0], orderedVertices[index], orderedVertices[index + 1]]);
  }
  return {
    triangles,
    label: {
      index: faceIndex,
      position: averagePoint(orderedVertices),
      normal: faceNormal
    } satisfies ShipFaceLabelAnchor
  };
}

function buildShipMeshDefinition(modelKey: RawModelKey): ShipMeshDefinition {
  const rawModel = RAW_ELITE_SHIP_MODELS[modelKey];
  const vertices = rawModel.vertices.map((vertex) => toScenePoint(vertex));
  const triangulatedFaces = rawModel.faces.map((face, faceIndex) => triangulateFace(vertices, rawModel.edges, face, faceIndex));
  return {
    hullTriangles: triangulatedFaces.flatMap((entry) => entry.triangles),
    wireEdges: rawModel.edges.map(([start, end]) => [vertices[start], vertices[end]] as const),
    faceLabels: triangulatedFaces.flatMap((entry) => (entry.label ? [entry.label] : []))
  };
}

// Models are derived once at module load so the presenter can cheaply clone the
// same canonical ship geometry for every spawned combat entity.
const ELITE_SHIP_MESHES: Record<EliteShipModelId, ShipMeshDefinition> = {
  sidewinder: buildShipMeshDefinition('sidewinder'),
  mamba: buildShipMeshDefinition('mamba'),
  krait: buildShipMeshDefinition('krait'),
  adder: buildShipMeshDefinition('adder'),
  gecko: buildShipMeshDefinition('gecko'),
  'cobra-mk1': buildShipMeshDefinition('cobraMk1'),
  worm: buildShipMeshDefinition('worm'),
  'cobra-mk3-pirate': buildShipMeshDefinition('cobraMk3Pirate'),
  'cobra-mk3-trader': buildShipMeshDefinition('cobraMk3'),
  'asp-mk2': buildShipMeshDefinition('aspMk2'),
  'python-pirate': buildShipMeshDefinition('pythonPirate'),
  'python-trader': buildShipMeshDefinition('python'),
  'fer-de-lance': buildShipMeshDefinition('ferDeLance'),
  viper: buildShipMeshDefinition('viper'),
  constrictor: buildShipMeshDefinition('constrictor'),
  thargoid: buildShipMeshDefinition('thargoid'),
  thargon: buildShipMeshDefinition('thargon'),
  'cobra-mk3-player': buildShipMeshDefinition('cobraMk3')
};

export function getEliteShipMeshDefinition(id: EliteShipModelId) {
  return ELITE_SHIP_MESHES[id];
}
