import type { BlueprintId } from '../../../domain/combat/types';
import { CLASSIC_COORDINATE_SCALE } from '../../../domain/combat/classicFlightModel';
import { RAW_ELITE_SHIP_MODELS } from './rawEliteShipModels';

type HullPoint = readonly [x: number, y: number, z: number];
type Triangle = readonly [HullPoint, HullPoint, HullPoint];
type Edge = readonly [HullPoint, HullPoint];
type VertexPair = readonly [number, number];

export interface ShipFaceLabelAnchor {
  index: number;
  position: HullPoint;
  normal: HullPoint;
}

export interface ShipVertexLabelAnchor {
  index: number;
  position: HullPoint;
}

export interface ShipMeshDefinition {
  hullTriangles: readonly Triangle[];
  wireEdges: readonly Edge[];
  faceLabels: readonly ShipFaceLabelAnchor[];
  vertexLabels: readonly ShipVertexLabelAnchor[];
}

export type EliteShipModelId = BlueprintId;

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

function getFaceEdges(edges: readonly (readonly [number, number, number, number])[], faceIndex: number) {
  return edges
    .filter(([_start, _end, faceA, faceB]) => faceA === faceIndex || faceB === faceIndex)
    .map(([start, end]) => [start, end] as const);
}

/**
 * BBC Elite face graphs often mix a real boundary cycle with extra decorative
 * spokes or antenna segments. Triangulating "all vertices in the component"
 * therefore creates fake quads and drops legitimate faces on ships like the
 * Krait. We instead keep the raw face-edge graph, split it into connected
 * components, and later extract only the closed cycles from each component.
 */
function getFaceEdgeComponents(faceEdges: readonly VertexPair[]) {
  if (faceEdges.length === 0) {
    return [] as VertexPair[][];
  }

  const adjacency = new Map<number, Set<number>>();
  for (const [start, end] of faceEdges) {
    if (!adjacency.has(start)) {
      adjacency.set(start, new Set());
    }
    if (!adjacency.has(end)) {
      adjacency.set(end, new Set());
    }
    adjacency.get(start)?.add(end);
    adjacency.get(end)?.add(start);
  }

  const edgeKey = (start: number, end: number) => (start < end ? `${start}:${end}` : `${end}:${start}`);
  const edgesByKey = new Map(faceEdges.map((edge) => [edgeKey(edge[0], edge[1]), edge] as const));
  const unvisited = new Set(adjacency.keys());
  const components: VertexPair[][] = [];
  while (unvisited.size > 0) {
    const [seed] = unvisited;
    if (seed === undefined) {
      break;
    }
    const queue = [seed];
    const componentVertices = new Set<number>();
    unvisited.delete(seed);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }
      componentVertices.add(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!unvisited.has(neighbor)) {
          continue;
        }
        unvisited.delete(neighbor);
        queue.push(neighbor);
      }
    }

    const componentEdges: VertexPair[] = [];
    for (const vertex of componentVertices) {
      for (const neighbor of adjacency.get(vertex) ?? []) {
        const key = edgeKey(vertex, neighbor);
        const edge = edgesByKey.get(key);
        if (!edge || componentEdges.includes(edge)) {
          continue;
        }
        componentEdges.push(edge);
      }
    }
    components.push(componentEdges);
  }

  return components;
}

/**
 * Repeatedly removing leaves gives the 2-core of the component graph, which is
 * exactly the part that can participate in a closed boundary cycle. Decorative
 * branches disappear during this pruning step, while real polygon loops stay.
 *
 * The resulting subgraph may still contain multiple cycles, so the caller
 * receives the surviving edges and can extract each loop separately.
 */
function getCycleEdges(componentEdges: readonly VertexPair[]) {
  const adjacency = new Map<number, Set<number>>();
  for (const [start, end] of componentEdges) {
    if (!adjacency.has(start)) {
      adjacency.set(start, new Set());
    }
    if (!adjacency.has(end)) {
      adjacency.set(end, new Set());
    }
    adjacency.get(start)?.add(end);
    adjacency.get(end)?.add(start);
  }

  const queue: number[] = [];
  for (const [vertex, neighbors] of adjacency) {
    if (neighbors.size < 2) {
      queue.push(vertex);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      continue;
    }
    const neighbors = adjacency.get(current);
    if (!neighbors || neighbors.size >= 2) {
      continue;
    }
    for (const neighbor of [...neighbors]) {
      adjacency.get(neighbor)?.delete(current);
      if ((adjacency.get(neighbor)?.size ?? 0) < 2) {
        queue.push(neighbor);
      }
    }
    adjacency.delete(current);
  }

  const cycleEdges: VertexPair[] = [];
  const seen = new Set<string>();
  for (const [start, neighbors] of adjacency) {
    for (const end of neighbors) {
      const key = start < end ? `${start}:${end}` : `${end}:${start}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      cycleEdges.push([start, end]);
    }
  }
  return cycleEdges;
}

function getOrderedCycleVertexIndexes(componentEdges: readonly VertexPair[]) {
  const cycleEdges = getCycleEdges(componentEdges);
  if (cycleEdges.length === 0) {
    return [] as number[][];
  }

  const adjacency = new Map<number, Set<number>>();
  for (const [start, end] of cycleEdges) {
    if (!adjacency.has(start)) {
      adjacency.set(start, new Set());
    }
    if (!adjacency.has(end)) {
      adjacency.set(end, new Set());
    }
    adjacency.get(start)?.add(end);
    adjacency.get(end)?.add(start);
  }

  const edgeKey = (start: number, end: number) => (start < end ? `${start}:${end}` : `${end}:${start}`);
  const unvisitedEdges = new Set(cycleEdges.map(([start, end]) => edgeKey(start, end)));
  const cycles: number[][] = [];
  while (unvisitedEdges.size > 0) {
    const [seedKey] = unvisitedEdges;
    if (!seedKey) {
      break;
    }
    const [seedStart, seedEnd] = seedKey.split(':').map(Number);
    const cycle = [seedStart];
    let previous = seedStart;
    let current = seedEnd;
    unvisitedEdges.delete(seedKey);

    while (current !== seedStart) {
      cycle.push(current);
      const nextCandidates = [...(adjacency.get(current) ?? [])].filter((neighbor) => neighbor !== previous);
      const next = nextCandidates[0];
      if (next === undefined) {
        break;
      }
      const nextKey = edgeKey(current, next);
      unvisitedEdges.delete(nextKey);
      previous = current;
      current = next;
    }

    if (current === seedStart && cycle.length >= 3) {
      cycles.push(cycle);
    }
  }

  return cycles;
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

function getPolygonArea(points: readonly HullPoint[], normal: HullPoint) {
  const ordered = orderFaceVertices(points, normal);
  if (ordered.length < 3) {
    return 0;
  }
  const planeNormal = normalizeVector(normal);
  let area = 0;
  for (let index = 1; index < ordered.length - 1; index += 1) {
    area += dotProduct(
      crossProduct(subtractPoint(ordered[index], ordered[0]), subtractPoint(ordered[index + 1], ordered[0])),
      planeNormal
    ) / 2;
  }
  return Math.abs(area);
}

function triangulateFace(
  vertices: readonly HullPoint[],
  edges: readonly (readonly [number, number, number, number])[],
  face: RawFace,
  faceIndex: number
) {
  const faceNormal = normalizeVector(toSceneNormal(face));
  const orderedComponents = getFaceEdgeComponents(getFaceEdges(edges, faceIndex))
    .flatMap((componentEdges) => getOrderedCycleVertexIndexes(componentEdges))
    .map((cycle) => cycle.map((index) => vertices[index]))
    .map((cycleVertices) => ({
      vertices: orderFaceVertices(cycleVertices, faceNormal),
      area: getPolygonArea(cycleVertices, faceNormal)
    }))
    .filter((component) => component.area > 0.000001)
    .sort((left, right) => right.area - left.area);

  if (orderedComponents.length === 0) {
    return { triangles: [] as Triangle[], label: null };
  }
  const triangles: Triangle[] = [];
  for (const component of orderedComponents) {
    for (let index = 1; index < component.vertices.length - 1; index += 1) {
      triangles.push([component.vertices[0], component.vertices[index], component.vertices[index + 1]]);
    }
  }
  const primaryVertices = orderedComponents[0]?.vertices ?? [];
  return {
    triangles,
    label: {
      index: faceIndex,
      position: averagePoint(primaryVertices),
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
    faceLabels: triangulatedFaces.flatMap((entry) => (entry.label ? [entry.label] : [])),
    // Vertex ids are stored in scene space so debug overlays can reference the
    // exact authored blueprint indexes without recomputing coordinate remaps.
    vertexLabels: vertices.map((position, index) => ({ index, position }))
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
  thargon: buildShipMeshDefinition('thargon')
};

export function getEliteShipMeshDefinition(id: EliteShipModelId) {
  return ELITE_SHIP_MESHES[id];
}
