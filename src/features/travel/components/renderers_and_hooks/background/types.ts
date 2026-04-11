/**
 * Shared point primitive for line-based travel artwork.
 *
 * Background scenery and debug previews use the same normalized coordinate
 * system so one catalog definition can feed both preview tooling and future
 * in-flight scene assembly.
 */
export type LinePoint = readonly [number, number];

/**
 * One drawable contour inside a line-based shape.
 *
 * Closed contours are used for hull-like silhouettes, while open contours
 * cover cracks, antennae, support struts, and other broken geometry details.
 */
export interface LineContour {
  points: LinePoint[];
  closed?: boolean;
}

/**
 * A complete wireframe shape composed from one or more contours.
 */
export type LineShape = LineContour[];

/**
 * Static definition for a background object preview.
 *
 * The debug playground reads these records directly so the list UI and preview
 * canvas stay in sync with the object catalog later reused by gameplay code.
 */
export interface BackgroundObjectDefinition {
  id: string;
  label: string;
  kind: 'asteroid' | 'wreck' | 'ruinedStation' | 'debrisCluster' | 'station';
  color: string;
  lineDash?: readonly number[];
  defaultScale: number;
  defaultAngle: number;
  shape: LineShape;
}
