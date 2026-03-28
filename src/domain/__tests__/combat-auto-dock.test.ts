import { describe, expect, it } from 'vitest';
import { getAutoDockCommand } from '../combat/station/autoDock';
import { getStationSlotAngle } from '../travelCombat';
import { getStationDockDirection, getStationDockMouthPoint } from '../combat/station/stationGeometry';

describe('auto-dock steering', () => {
  it('faces the station center during the radial approach', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.005, rotSpeed: 0.005, safeZoneRadius: 360 };
    const command = getAutoDockCommand(station, {
      x: 120,
      y: 180,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(command.mode).toBe('approach');
    expect(command.turn).not.toBe(0);
    expect(command.thrust).toBe(1);
  });

  it('releases thrust early enough to brake near the wall', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const dockDirection = getStationDockDirection(station);
    const dockMouth = getStationDockMouthPoint(station);
    const command = getAutoDockCommand(station, {
      x: dockMouth.x + dockDirection.x * 24,
      y: dockMouth.y + dockDirection.y * 24,
      vx: -dockDirection.x,
      vy: -dockDirection.y,
      angle: getStationSlotAngle(station.angle) + Math.PI
    });

    expect(command.mode).toBe('approach');
    expect(command.thrust).toBe(0);
  });

  it('waits on the wall until the door lines up exactly in front', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.12, rotSpeed: 0.005, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const dockDirection = getStationDockDirection(station);
    const dockMouth = getStationDockMouthPoint(station);
    const command = getAutoDockCommand(station, {
      x: dockMouth.x + dockDirection.x * 8,
      y: dockMouth.y + dockDirection.y * 8,
      vx: 0,
      vy: 0,
      angle: slotAngle + Math.PI
    });

    expect(command.mode).toBe('wait');
    expect(command.thrust).toBe(0);
  });

  it('enters wait even with small sideways drift once radial motion has stopped', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.12, rotSpeed: 0.005, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const dockDirection = getStationDockDirection(station);
    const dockMouth = getStationDockMouthPoint(station);
    const command = getAutoDockCommand(station, {
      x: dockMouth.x + dockDirection.x * 8,
      y: dockMouth.y + dockDirection.y * 8,
      vx: 0.1,
      vy: -0.1,
      angle: slotAngle + Math.PI
    });

    expect(command.mode).toBe('wait');
  });

  it('turns nose-in and advances through the slot once lined up', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const dockDirection = getStationDockDirection(station);
    const dockMouth = getStationDockMouthPoint(station);
    const command = getAutoDockCommand(station, {
      x: dockMouth.x + dockDirection.x * 12,
      y: dockMouth.y + dockDirection.y * 12,
      vx: 0,
      vy: 0,
      angle: slotAngle + Math.PI
    });

    expect(command.mode).toBe('dock');
    expect(command.turn).toBeCloseTo(0, 1);
    expect(command.thrust).toBeGreaterThan(0);
  });
});
