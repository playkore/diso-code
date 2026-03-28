import { describe, expect, it } from 'vitest';
import { selectShipPresenter } from './shipPresenter';
import { bucketStarsByParallax, getPerspectiveCameraDistance, getShipPresentationAngles, getWrappedStarScreenPosition } from './travelSceneMath';

describe('bucketStarsByParallax', () => {
  it('splits the generated starfield into stable depth bands', () => {
    const buckets = bucketStarsByParallax([
      { x: 0, y: 0, z: 0.2 },
      { x: 0, y: 0, z: 0.39 },
      { x: 0, y: 0, z: 0.4 },
      { x: 0, y: 0, z: 0.6 },
      { x: 0, y: 0, z: 0.8 },
      { x: 0, y: 0, z: 0.99 }
    ]);

    expect(buckets.map((bucket) => bucket.length)).toEqual([2, 2, 0, 2]);
  });
});

describe('getPerspectiveCameraDistance', () => {
  it('keeps the center-plane scale stable for the chosen field of view', () => {
    expect(getPerspectiveCameraDistance(720, 36)).toBeCloseTo(1107.966, 3);
  });
});

describe('getShipPresentationAngles', () => {
  it('tilts ships according to their screen-side offset without exceeding the travel limits', () => {
    expect(getShipPresentationAngles(400, -300, 800, 600)).toEqual({
      pitch: 0.18,
      yaw: 0.28
    });
    expect(getShipPresentationAngles(-800, 600, 800, 600)).toEqual({
      pitch: -0.18,
      yaw: -0.28
    });
  });
});

describe('getWrappedStarScreenPosition', () => {
  it('wraps star positions around the viewport edges', () => {
    expect(getWrappedStarScreenPosition({ x: -40, y: 650, z: 0.2 }, { x: 100, y: 100 }, 800, 600, 0.5)).toEqual({
      x: 710,
      y: 0
    });
  });
});

describe('selectShipPresenter', () => {
  it('defaults to the low-poly player presenter while keeping enemies as line shapes', () => {
    expect(selectShipPresenter()).toMatchObject({
      id: 'low-poly-player',
      enemyGeometryMode: 'line-shape',
      playerGeometryMode: 'mesh'
    });
  });

  it('keeps the flat wireframe presenter as an explicit fallback', () => {
    expect(selectShipPresenter('flat-wireframe')).toEqual({
      id: 'flat-wireframe',
      enemyGeometryMode: 'line-shape',
      playerGeometryMode: 'line-shape'
    });
  });
});
