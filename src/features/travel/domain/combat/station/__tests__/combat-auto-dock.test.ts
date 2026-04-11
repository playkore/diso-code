import { describe, expect, it } from 'vitest';
import { createAutoDockState, stepAutoDockState } from '../autoDock';
import { getStationDockDirection, getStationDockMouthPoint } from '../stationGeometry';

const STAGE_MARGIN = 56;

function getStageRadius(station: { x: number; y: number; radius: number; angle: number; rotSpeed: number; safeZoneRadius: number }) {
  const mouth = getStationDockMouthPoint(station);
  return Math.hypot(mouth.x - station.x, mouth.y - station.y) + STAGE_MARGIN;
}

describe('auto-dock steering', () => {
  it('starts by approaching the staging radius', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.005, rotSpeed: 0.005, safeZoneRadius: 360 };
    const { state, command } = stepAutoDockState(createAutoDockState(), station, {
      x: 120,
      y: 180,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(state.phase).toBe('approach');
    expect(command.mode).toBe('approach');
    expect(command.thrust).toBe(1);
  });

  it('captures the staging radius and then switches into alignment before waiting', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const stageRadius = getStageRadius(station);
    const dockDirection = getStationDockDirection(station);
    const step = stepAutoDockState(createAutoDockState(), station, {
      x: station.x + dockDirection.x * stageRadius,
      y: station.y + dockDirection.y * stageRadius,
      vx: 0,
      vy: 0,
      angle: 0
    });

    expect(step.state.phase).toBe('align');
    expect(step.command.mode).toBe('wait');
  });

  it('holds position while the station rotates into the lead angle', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0.4, spinAngle: 0.4, rotSpeed: 0.005, safeZoneRadius: 360 };
    const stageRadius = getStageRadius(station);
    const step = stepAutoDockState({ phase: 'wait', stageRadius }, station, {
      x: station.x,
      y: station.y + stageRadius,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2
    });

    expect(step.state.phase).toBe('wait');
    expect(step.command.mode).toBe('wait');
    expect(step.command.thrust).toBe(0);
  });

  it('switches from wait to inward burn at the computed lead angle', () => {
    const station = { x: 0, y: 0, radius: 80, angle: Math.PI / 2, spinAngle: Math.PI / 2, rotSpeed: 0, safeZoneRadius: 360 };
    const stageRadius = getStageRadius(station);
    const dockDirection = getStationDockDirection(station);
    const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
    const step = stepAutoDockState({ phase: 'wait', stageRadius }, station, {
      x: station.x + Math.cos(slotAngle) * stageRadius,
      y: station.y + Math.sin(slotAngle) * stageRadius,
      vx: 0,
      vy: 0,
      angle: slotAngle + Math.PI
    });

    expect(step.state.phase).toBe('inward');
    expect(step.command.mode).toBe('dock');
  });

  it('flies straight toward the station center during the inward burn', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const stageRadius = getStageRadius(station);
    const dockDirection = getStationDockDirection(station);
    const slotAngle = Math.atan2(dockDirection.y, dockDirection.x);
    const step = stepAutoDockState({ phase: 'inward', stageRadius }, station, {
      x: station.x + Math.cos(slotAngle) * stageRadius,
      y: station.y + Math.sin(slotAngle) * stageRadius,
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
