import type { CombatStation } from '../types';

export type StationPoint3 = readonly [x: number, y: number, z: number];
export type StationTriangle = readonly [StationPoint3, StationPoint3, StationPoint3];
export type StationEdge = readonly [StationPoint3, StationPoint3];
export type StationSegment2 = readonly [
  start: readonly [x: number, y: number],
  end: readonly [x: number, y: number]
];

export interface StationMeshDefinition {
  hullTriangles: readonly StationTriangle[];
  wireEdges: readonly StationEdge[];
}

export const STATION_BASE_HALF_EXTENT = 18;
export const STATION_TUNNEL_HALF_WIDTH = 8;
export const STATION_TUNNEL_START_X = 18;
export const STATION_TUNNEL_END_X = 32;
export const STATION_DOCK_POINT_X = 31;

/**
 * Station geometry is shared between rendering and gameplay. The authored mesh
 * stays in local station space and is later scaled from `station.radius`, so
 * travel visuals and docking math can evolve from the same source data.
 */
export const STATION_MESH_DEFINITION: StationMeshDefinition = {
  hullTriangles: [
    [[-18, 18, 18], [-18, -18, -18], [-18, -18, 18]],
    [[-18, 18, 18], [-18, 18, -18], [-18, -18, -18]],
    [[18, 18, 18], [18, 18, -18], [-18, 18, -18]],
    [[18, 18, 18], [-18, 18, -18], [-18, 18, 18]],
    [[18, -18, 18], [-18, -18, 18], [-18, -18, -18]],
    [[18, -18, 18], [-18, -18, -18], [18, -18, -18]],
    [[18, 18, 18], [-18, 18, 18], [-18, -18, 18]],
    [[18, 18, 18], [-18, -18, 18], [18, -18, 18]],
    [[18, 18, -18], [18, -18, -18], [-18, -18, -18]],
    [[18, 18, -18], [-18, -18, -18], [-18, 18, -18]],
    [[18, 18, 18], [18, -18, 18], [18, -8, 8]],
    [[18, 18, 18], [18, -8, 8], [18, 8, 8]],
    [[18, -18, 18], [18, -18, -18], [18, -8, -8]],
    [[18, -18, 18], [18, -8, -8], [18, -8, 8]],
    [[18, 18, -18], [18, 8, -8], [18, -8, -8]],
    [[18, 18, -18], [18, -8, -8], [18, -18, -18]],
    [[18, 18, 18], [18, 8, 8], [18, 8, -8]],
    [[18, 18, 18], [18, 8, -8], [18, 18, -18]],
    [[18, 8, 8], [32, -8, 8], [32, 8, 8]],
    [[18, 8, 8], [18, -8, 8], [32, -8, 8]],
    [[18, -8, -8], [32, 8, -8], [32, -8, -8]],
    [[18, -8, -8], [18, 8, -8], [32, 8, -8]],
    [[18, -8, 8], [32, -8, -8], [32, -8, 8]],
    [[18, -8, 8], [18, -8, -8], [32, -8, -8]],
    [[18, 8, -8], [32, 8, 8], [32, 8, -8]],
    [[18, 8, -8], [18, 8, 8], [32, 8, 8]]
  ],
  wireEdges: [
    [[18, 18, 18], [18, -18, 18]],
    [[18, -18, 18], [18, -18, -18]],
    [[18, -18, -18], [18, 18, -18]],
    [[18, 18, -18], [18, 18, 18]],
    [[-18, 18, 18], [-18, -18, 18]],
    [[-18, -18, 18], [-18, -18, -18]],
    [[-18, -18, -18], [-18, 18, -18]],
    [[-18, 18, -18], [-18, 18, 18]],
    [[18, 18, 18], [-18, 18, 18]],
    [[18, -18, 18], [-18, -18, 18]],
    [[18, -18, -18], [-18, -18, -18]],
    [[18, 18, -18], [-18, 18, -18]],
    [[18, 8, 8], [18, -8, 8]],
    [[18, -8, 8], [18, -8, -8]],
    [[18, -8, -8], [18, 8, -8]],
    [[18, 8, -8], [18, 8, 8]],
    [[32, 8, 8], [32, -8, 8]],
    [[32, -8, 8], [32, -8, -8]],
    [[32, -8, -8], [32, 8, -8]],
    [[32, 8, -8], [32, 8, 8]],
    [[18, 8, 8], [32, 8, 8]],
    [[18, -8, 8], [32, -8, 8]],
    [[18, -8, -8], [32, -8, -8]],
    [[18, 8, -8], [32, 8, -8]]
  ]
} as const;

function rotateX([x, y, z]: StationPoint3, angle: number): StationPoint3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, y * cos - z * sin, y * sin + z * cos];
}

function rotateZ([x, y, z]: StationPoint3, angle: number): StationPoint3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x * cos - y * sin, x * sin + y * cos, z];
}

function scalePoint([x, y, z]: StationPoint3, scale: number): StationPoint3 {
  return [x * scale, y * scale, z * scale];
}

function transformStationPoint(station: CombatStation, point: StationPoint3): StationPoint3 {
  const scaled = scalePoint(point, getStationRenderScale(station));
  const banked = rotateX(scaled, station.angle);
  // Three.js applies `rotation.z = -station.angle` in a Y-up scene, while
  // gameplay still reasons in the legacy Y-down plane. Mirroring the rendered
  // result back into gameplay space flips the sign, so the equivalent 2D
  // transform here is `+station.angle`.
  return rotateZ(banked, station.angle);
}

function translatePoint(station: CombatStation, [x, y, z]: StationPoint3): StationPoint3 {
  return [station.x + x, station.y + y, z];
}

function getEdgePlaneIntersection(start: StationPoint3, end: StationPoint3) {
  const [x1, y1, z1] = start;
  const [x2, y2, z2] = end;
  const deltaZ = z2 - z1;
  if (Math.abs(deltaZ) < 1e-6) {
    return null;
  }
  const t = -z1 / deltaZ;
  if (t < 0 || t > 1) {
    return null;
  }
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t] as const;
}

function getTriangleSliceSegment(triangle: StationTriangle, station: CombatStation): StationSegment2 | null {
  const transformed: StationTriangle = [
    translatePoint(station, transformStationPoint(station, triangle[0])),
    translatePoint(station, transformStationPoint(station, triangle[1])),
    translatePoint(station, transformStationPoint(station, triangle[2]))
  ];
  const intersections = [
    getEdgePlaneIntersection(transformed[0], transformed[1]),
    getEdgePlaneIntersection(transformed[1], transformed[2]),
    getEdgePlaneIntersection(transformed[2], transformed[0])
  ].filter((point): point is readonly [number, number] => point !== null);

  if (intersections.length !== 2) {
    return null;
  }
  const [a, b] = intersections;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  if (dx * dx + dy * dy < 1e-6) {
    return null;
  }
  return [a, b];
}

function roundKey(value: number) {
  return Math.round(value * 1000) / 1000;
}

function getSegmentKey([a, b]: StationSegment2) {
  const aKey = `${roundKey(a[0])},${roundKey(a[1])}`;
  const bKey = `${roundKey(b[0])},${roundKey(b[1])}`;
  return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

export function getStationRenderScale(station: CombatStation) {
  return station.radius / STATION_BASE_HALF_EXTENT;
}

export function getStationDockDirection(station: CombatStation) {
  // Render space rotates the station by `-station.angle` in a Y-up world, but
  // gameplay coordinates still use the legacy Y-down convention. Mapping the
  // rendered dock axis back into gameplay space therefore mirrors the rotated
  // Y component and yields a `+station.angle` heading.
  const [x, y] = rotateZ([1, 0, 0], station.angle);
  return { x, y };
}

export function getStationDockAngle(stationAngle: number) {
  return stationAngle;
}

export function getStationDockMouthPoint(station: CombatStation) {
  const [x, y] = translatePoint(station, transformStationPoint(station, [STATION_TUNNEL_END_X, 0, 0]));
  return { x, y };
}

export function getStationDockPoint(station: CombatStation) {
  const [x, y] = translatePoint(station, transformStationPoint(station, [STATION_DOCK_POINT_X, 0, 0]));
  return { x, y };
}

export function getStationTunnelHalfWidth(station: CombatStation) {
  return STATION_TUNNEL_HALF_WIDTH * getStationRenderScale(station);
}

export function getStationSliceSegments(station: CombatStation) {
  const segments = new Map<string, StationSegment2>();
  for (const triangle of STATION_MESH_DEFINITION.hullTriangles) {
    const segment = getTriangleSliceSegment(triangle, station);
    if (!segment) {
      continue;
    }
    segments.set(getSegmentKey(segment), segment);
  }
  return [...segments.values()];
}

export function getDistanceToStationSlice(
  station: CombatStation,
  point: { x: number; y: number }
) {
  const segments = getStationSliceSegments(station);
  let minDistance = Number.POSITIVE_INFINITY;
  for (const [start, end] of segments) {
    const segmentDx = end[0] - start[0];
    const segmentDy = end[1] - start[1];
    const segmentLengthSquared = segmentDx * segmentDx + segmentDy * segmentDy;
    const projection = segmentLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start[0]) * segmentDx + (point.y - start[1]) * segmentDy) / segmentLengthSquared));
    const nearestX = start[0] + segmentDx * projection;
    const nearestY = start[1] + segmentDy * projection;
    minDistance = Math.min(minDistance, Math.hypot(point.x - nearestX, point.y - nearestY));
  }
  return minDistance;
}
