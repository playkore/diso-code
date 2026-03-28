import { describe, expect, it } from 'vitest';
import { selectShipPresenter } from './shipPresenter';
import { bucketStarsByParallax, createShipBankState, getPerspectiveCameraDistance, getPlayerBankAngle, getShipPresentationAngles, getWrappedStarScreenPosition, stepShipBankState } from './travelSceneMath';

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

describe('getPlayerBankAngle', () => {
  it('repeats the bank cycle every full turn for right turns', () => {
    expect(getPlayerBankAngle(0, 1)).toBeCloseTo(0, 5);
    expect(getPlayerBankAngle(Math.PI / 2, 1)).toBeCloseTo(0.95, 5);
    expect(getPlayerBankAngle(Math.PI, 1)).toBeCloseTo(0, 5);
    expect(getPlayerBankAngle((3 * Math.PI) / 2, 1)).toBeCloseTo(0.95, 5);
    expect(getPlayerBankAngle(2 * Math.PI, 1)).toBeCloseTo(0, 5);
  });

  it('mirrors the same periodic curve for left turns', () => {
    expect(getPlayerBankAngle(0, -1)).toBeCloseTo(0, 5);
    expect(getPlayerBankAngle(Math.PI / 2, -1)).toBeCloseTo(-0.95, 5);
    expect(getPlayerBankAngle(Math.PI, -1)).toBeCloseTo(0, 5);
    expect(getPlayerBankAngle((3 * Math.PI) / 2, -1)).toBeCloseTo(-0.95, 5);
    expect(getPlayerBankAngle(2 * Math.PI, -1)).toBeCloseTo(0, 5);
  });

  it('returns to neutral when steering stops regardless of turn progress', () => {
    expect(getPlayerBankAngle(Math.PI / 2, 0)).toBe(0);
  });
});

describe('stepShipBankState', () => {
  it('advances periodic bank progress from heading changes', () => {
    const next = stepShipBankState(createShipBankState(), {
      currentAngle: Math.PI / 2,
      previousAngle: 0,
      dt: 1
    });

    expect(next.turnProgress).toBeCloseTo(Math.PI / 2, 5);
    expect(next.turnSign).toBe(1);
    expect(next.visualAngle).toBeGreaterThan(0);
  });

  it('resets progress when the hull changes turn direction', () => {
    const turningRight = stepShipBankState(createShipBankState(), {
      currentAngle: Math.PI / 2,
      previousAngle: 0,
      dt: 1
    });
    const turningLeft = stepShipBankState(turningRight, {
      currentAngle: Math.PI / 4,
      previousAngle: Math.PI / 2,
      dt: 1
    });

    expect(turningLeft.turnSign).toBe(-1);
    expect(turningLeft.turnProgress).toBeCloseTo(Math.PI / 4, 5);
  });

  it('eases visual bank back toward neutral when steering stops', () => {
    const turning = {
      ...createShipBankState(),
      turnProgress: Math.PI / 2,
      turnSign: 1,
      visualAngle: 0.95
    };
    const released = stepShipBankState(turning, {
      currentAngle: Math.PI / 2,
      previousAngle: Math.PI / 2,
      dt: 1
    });

    expect(released.turnProgress).toBe(0);
    expect(released.turnSign).toBe(0);
    expect(released.visualAngle).toBeGreaterThan(0);
    expect(released.visualAngle).toBeLessThan(0.95);
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
  it('defaults to the low-poly ship presenter for both enemy and player meshes', () => {
    expect(selectShipPresenter()).toMatchObject({
      id: 'low-poly-ships',
      enemyGeometryMode: 'mesh',
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
