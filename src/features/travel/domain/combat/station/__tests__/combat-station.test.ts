import { describe, expect, it } from 'vitest';
import { clampAngle } from '../../state';
import { assessDockingApproach, getStationSlotAngle } from '../docking';
import { getStationDockDirection, getStationDockMouthPoint, getStationDockPoint, getStationRenderScale, STATION_TUNNEL_END_X } from '../stationGeometry';

describe('travel combat station rules', () => {
  it('keeps the docking geometry helpers stable', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const dockPoint = getStationDockPoint(station);
    const dockMouth = getStationDockMouthPoint(station);
    const dockDirection = getStationDockDirection(station);

    expect(Number.isFinite(getStationSlotAngle(station.angle))).toBe(true);
    expect(getStationRenderScale(station)).toBeGreaterThan(0);
    expect(STATION_TUNNEL_END_X).toBeGreaterThan(0);
    expect(dockPoint.x).not.toBe(dockMouth.x);
    expect(Math.hypot(dockDirection.x, dockDirection.y)).toBeCloseTo(1);
  });

  it('classifies the visible docking gap as dockable', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const dockMouth = getStationDockMouthPoint(station);
    const player = {
      x: dockMouth.x - 6,
      y: dockMouth.y,
      vx: -0.3,
      vy: 0,
      angle: slotAngle + Math.PI
    };

    const docking = assessDockingApproach(station, player);
    expect(docking.isInDockingGap).toBe(true);
    expect(docking.canDock).toBe(true);
  });

  it('keeps the docking geometry angle math normalized', () => {
    expect(clampAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
  });
});
