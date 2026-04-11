import { describe, expect, it } from 'vitest';
import { createBackgroundStar } from './travelVisuals';

const seedA = { w0: 0x5a4a, w1: 0x0248, w2: 0xb753 };
const seedB = { w0: 0x5a4a, w1: 0x0248, w2: 0xb754 };

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
  });

  it('keeps the star very far away and large enough to read like a landmark', () => {
    const star = createBackgroundStar(seedA);
    const centerDistance = Math.hypot(star.x, star.y);

    expect(star.parallax).toBeLessThan(0.05);
    expect(star.parallax).toBeGreaterThan(0);
    expect(centerDistance).toBeGreaterThanOrEqual(120);
    expect(star.diameter).toBeGreaterThanOrEqual(112);
    expect(star.diameter).toBeLessThanOrEqual(152);
    expect(star.color).toBe('#ff5555');
  });
});
