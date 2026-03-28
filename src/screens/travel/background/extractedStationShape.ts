import extractedStationShapeData from './extractedStationShape.json';
import type { LineShape } from './types';

/**
 * Full station wireframe extracted from the user-provided segment list and
 * normalized around the source bounding-box center.
 *
 * The shape is stored as data so the catalog can preview every source segment
 * without hand-maintaining a massive TypeScript literal.
 */
export const extractedStationShape = extractedStationShapeData as unknown as LineShape;
