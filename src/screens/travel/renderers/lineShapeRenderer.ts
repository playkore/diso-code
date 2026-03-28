import type { LineShape } from '../background/types';

interface DrawLineShapeOptions {
  preserveScreenLineWidth?: boolean;
}

/**
 * Draws a multi-contour wireframe shape with the same visual treatment used by
 * the travel renderer's ship and station layers.
 */
export function drawLineShape(
  ctx: CanvasRenderingContext2D,
  shape: LineShape,
  x: number,
  y: number,
  angle: number,
  color: string,
  scale = 1,
  options: DrawLineShapeOptions = {}
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  // Debug previews can zoom far beyond in-flight scales, so they optionally
  // compensate for canvas transforms to keep the perceived stroke width equal
  // to the ship wireframe baseline instead of ballooning with zoom.
  ctx.lineWidth = options.preserveScreenLineWidth ? 1.5 / Math.max(Math.abs(scale), 0.0001) : 1.5;
  ctx.shadowBlur = 6;
  ctx.shadowColor = color;

  for (const contour of shape) {
    if (contour.points.length === 0) {
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(contour.points[0][0], contour.points[0][1]);
    for (let i = 1; i < contour.points.length; i += 1) {
      ctx.lineTo(contour.points[i][0], contour.points[i][1]);
    }
    if (contour.closed) {
      ctx.closePath();
    }
    ctx.stroke();
  }

  ctx.restore();
}
