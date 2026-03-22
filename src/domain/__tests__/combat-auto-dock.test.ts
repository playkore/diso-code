import { describe, expect, it } from 'vitest';
import { getAutoDockCommand } from '../combat/station/autoDock';
import { getStationSlotAngle } from '../travelCombat';

describe('auto-dock steering', () => {
  it('steers toward the station hold point before committing to the slot', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const command = getAutoDockCommand(station, {
      x: 120,
      y: 220,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(command.mode).toBe('approach');
    expect(command.turn).not.toBe(0);
  });

  it('turns nose-in and advances through the slot once lined up', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const command = getAutoDockCommand(station, {
      x: Math.cos(slotAngle) * 110,
      y: Math.sin(slotAngle) * 110,
      vx: 0.5,
      vy: 0.5,
      angle: slotAngle + Math.PI
    });

    expect(command.mode).toBe('dock');
    expect(command.turn).toBeCloseTo(0, 1);
    expect(command.thrust).toBeGreaterThan(0);
  });
});
