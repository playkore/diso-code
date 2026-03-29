import { describe, expect, it } from 'vitest';
import { createAutoDockState, stepAutoDockState } from '../combat/station/autoDock';
import { getStationDockDirection, getStationDockMouthPoint } from '../combat/station/stationGeometry';

const ORBIT_MARGIN = 56;

function getOrbitRadius(station: { x: number; y: number; radius: number; angle: number; rotSpeed: number; safeZoneRadius: number }) {
  const mouth = getStationDockMouthPoint(station);
  return Math.hypot(mouth.x - station.x, mouth.y - station.y) + ORBIT_MARGIN;
}

describe('auto-dock steering', () => {
  it('starts by approaching the orbit capture point', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.005, rotSpeed: 0.005, safeZoneRadius: 360 };
    const { state, command } = stepAutoDockState(createAutoDockState(), station, {
      x: 120,
      y: 180,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(state.phase).toBe('acquire-orbit');
    expect(command.mode).toBe('approach');
    expect(command.thrust).toBe(1);
  });

  it('captures the orbit radius and immediately burns inward when the lead angle already matches', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const orbitRadius = getOrbitRadius(station);
    const dockDirection = getStationDockDirection(station);
    const step = stepAutoDockState(createAutoDockState(), station, {
      x: station.x + dockDirection.x * orbitRadius,
      y: station.y + dockDirection.y * orbitRadius,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(step.state.phase).toBe('inward');
    expect(step.command.mode).toBe('dock');
  });

  it('keeps circling opposite the station rotation until the lead angle matches', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.4, rotSpeed: 0.005, safeZoneRadius: 360 };
    const orbitRadius = getOrbitRadius(station);
    const step = stepAutoDockState({ phase: 'orbit', orbitRadius }, station, {
      x: station.x,
      y: station.y + orbitRadius,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(step.state.phase).toBe('orbit');
    expect(step.command.mode).toBe('approach');
    expect(step.command.thrust).toBe(1);
  });

  it('switches from orbit to inward burn at the computed lead angle', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const orbitRadius = getOrbitRadius(station);
    const dockDirection = getStationDockDirection(station);
    const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
    const step = stepAutoDockState({ phase: 'orbit', orbitRadius }, station, {
      x: station.x + Math.cos(slotAngle) * orbitRadius,
      y: station.y + Math.sin(slotAngle) * orbitRadius,
      vx: 0,
      vy: 0,
      angle: slotAngle + Math.PI
    });

    expect(step.state.phase).toBe('inward');
    expect(step.command.mode).toBe('dock');
  });

  it('flies straight toward the station center during the inward burn', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const orbitRadius = getOrbitRadius(station);
    const dockDirection = getStationDockDirection(station);
    const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
    const step = stepAutoDockState({ phase: 'inward', orbitRadius }, station, {
      x: station.x + Math.cos(slotAngle) * orbitRadius,
      y: station.y + Math.sin(slotAngle) * orbitRadius,
      vx: 0,
      vy: 0,
      angle: slotAngle + Math.PI
    });

    expect(step.state.phase).toBe('inward');
    expect(step.command.mode).toBe('dock');
    expect(step.command.turn).toBeCloseTo(0, 1);
    expect(step.command.thrust).toBeGreaterThan(0);
  });
});
