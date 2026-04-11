import { describe, expect, it } from 'vitest';
import { getJoystickProjectedThrust, getTravelBackgroundStarSeed } from './useTravelSession';

const originSeed = { w0: 0x1111, w1: 0x2222, w2: 0x3333 };
const destinationSeed = { w0: 0x4444, w1: 0x5555, w2: 0x6666 };

describe('getJoystickProjectedThrust', () => {
  it('keeps full thrust when the joystick points through the nose', () => {
    expect(getJoystickProjectedThrust(1, 0, 0)).toBeCloseTo(1, 6);
    expect(getJoystickProjectedThrust(0, 0.75, Math.PI / 2)).toBeCloseTo(0.75, 6);
  });

  it('drops thrust to zero when the joystick is perpendicular to the nose', () => {
    expect(getJoystickProjectedThrust(0, 1, 0)).toBeCloseTo(0, 6);
  });

  it('clamps thrust to zero when the joystick points behind the ship', () => {
    expect(getJoystickProjectedThrust(-1, 0, 0)).toBeCloseTo(0, 6);
    expect(getJoystickProjectedThrust(0, -0.6, Math.PI / 2)).toBeCloseTo(0, 6);
  });
});

describe('getTravelBackgroundStarSeed', () => {
  it('keeps the star tied to the origin system until hyperspace completes', () => {
    expect(getTravelBackgroundStarSeed(originSeed, destinationSeed, false)).toEqual(originSeed);
  });

  it('switches the star to the destination system after hyperspace completes', () => {
    expect(getTravelBackgroundStarSeed(originSeed, destinationSeed, true)).toEqual(destinationSeed);
  });
});
