import { describe, expect, it } from 'vitest';
import { getHyperspaceDurationFrames } from './travelTiming';

describe('travel timing', () => {
  it('uses a two-second minimum hyperspace duration', () => {
    expect(getHyperspaceDurationFrames(0)).toBe(120);
  });

  it('adds one second of hyperspace time per light year', () => {
    expect(getHyperspaceDurationFrames(3.5)).toBe(330);
  });

  it('clamps invalid distances to the base duration', () => {
    expect(getHyperspaceDurationFrames(Number.NaN)).toBe(120);
    expect(getHyperspaceDurationFrames(-4)).toBe(120);
  });
});
