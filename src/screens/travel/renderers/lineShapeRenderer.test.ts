import { describe, expect, it, vi } from 'vitest';
import { drawLineShape } from './lineShapeRenderer';
import type { LineShape } from '../background/types';

function createMockContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    shadowBlur: 0,
    shadowColor: '',
    strokeStyle: '',
    lineWidth: 0
  } as unknown as CanvasRenderingContext2D;
}

describe('drawLineShape', () => {
  it('closes contours flagged as closed', () => {
    const ctx = createMockContext();
    const shape: LineShape = [
      {
        points: [
          [0, 0],
          [10, 0],
          [10, 10]
        ],
        closed: true
      }
    ];

    drawLineShape(ctx, shape, 100, 120, 0.5, '#ffff55', 2);

    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.translate).toHaveBeenCalledWith(100, 120);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });

  it('renders multiple contours without forcing open contours closed', () => {
    const ctx = createMockContext();
    const shape: LineShape = [
      {
        points: [
          [0, 0],
          [8, 0],
          [8, 8]
        ],
        closed: true
      },
      {
        points: [
          [2, 2],
          [4, 6],
          [6, 2]
        ]
      }
    ];

    drawLineShape(ctx, shape, 0, 0, 0, '#55ff55', 1);

    expect(ctx.beginPath).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
  });

  it('can preserve the screen-space line width while zooming', () => {
    const ctx = createMockContext();
    const shape: LineShape = [
      {
        points: [
          [0, 0],
          [8, 0]
        ]
      }
    ];

    drawLineShape(ctx, shape, 0, 0, 0, '#ffff55', 4, { preserveScreenLineWidth: true });

    expect(ctx.lineWidth).toBeCloseTo(0.375);
  });

  it('applies dashed strokes when requested', () => {
    const ctx = createMockContext();
    const shape: LineShape = [
      {
        points: [
          [0, 0],
          [8, 0]
        ]
      }
    ];

    drawLineShape(ctx, shape, 0, 0, 0, '#ffff55', 2, {
      preserveScreenLineWidth: true,
      lineDash: [1, 3]
    });

    expect(ctx.setLineDash).toHaveBeenCalledWith([0.5, 1.5]);
  });
});
