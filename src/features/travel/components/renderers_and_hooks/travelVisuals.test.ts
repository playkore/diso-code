import { describe, expect, it } from 'vitest';
import { createBackgroundStar } from './travelVisuals';

const seedA = { w0: 0x5a4a, w1: 0x0248, w2: 0xb753 };
const seedB = { w0: 0x5a4a, w1: 0x0248, w2: 0x1234 };
const yellowSeed = { w0: 0, w1: 0, w2: 32 };
const redSeed = { w0: 0, w1: 0, w2: 0 };
const greenSeed = { w0: 0, w1: 0, w2: 40 };

describe('createBackgroundStar', () => {
  it('produces stable position and size for the same seed', () => {
    const first = createBackgroundStar(seedA);
    const second = createBackgroundStar(seedA);

    expect(second).toEqual(first);
  });

  it('changes the background star when the system seed changes', () => {
    const first = createBackgroundStar(seedA);
    const second = createBackgroundStar(seedB);

    expect(second).not.toEqual(first);
    expect(second.diameter).not.toBe(first.diameter);
  });

  it('keeps the star very far away and large enough to read like a landmark', () => {
    const star = createBackgroundStar(seedA);
    const centerDistance = Math.hypot(star.x, star.y);

    expect(star.parallax).toBeLessThan(0.05);
    expect(star.parallax).toBeGreaterThan(0);
    expect(centerDistance).toBeGreaterThanOrEqual(120);
    expect(star.diameter).toBeGreaterThanOrEqual(30);
    expect(star.diameter).toBeLessThanOrEqual(50);
    expect(star.color).toMatch(/^#(ffff55|ff5555|55ff55)$/);
  });

  it('maps the seed stream into the requested color distribution', () => {
    expect(createBackgroundStar(yellowSeed).color).toBe('#ffff55');
    expect(createBackgroundStar(redSeed).color).toBe('#ff5555');
    expect(createBackgroundStar(greenSeed).color).toBe('#55ff55');
  });
});
