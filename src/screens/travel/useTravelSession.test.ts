import { describe, expect, it } from 'vitest';
import { getJoystickProjectedThrust } from './useTravelSession';

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
