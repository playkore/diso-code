import { describe, expect, it } from 'vitest';
import { getGalaxySystems, getSystemDistance, getSystemByName, getSystemHeading, getVisibleSystems, getWrappedChartDelta, getWrappedChartHeading } from '../galaxyCatalog';
import type { SystemData } from '../systemData';

function createSystem(x: number, y: number): SystemData {
  return {
    name: `${x}-${y}`,
    x,
    y,
    economy: 0,
    government: 0,
    techLevel: 0,
    population: 0,
    productivity: 0,
    radius: 0,
    species: 'Human Colonials'
  };
}

describe('galaxy catalog toroidal geometry', () => {
  it('returns the shortest wrapped chart delta across both borders', () => {
    // The local and jump charts live on a torus, so seam-crossing routes should
    // use the shorter wrapped displacement instead of the long direct path.
    expect(getWrappedChartDelta(createSystem(2, 4), createSystem(250, 252))).toEqual({ dx: -8, dy: -4 });
    expect(getWrappedChartDelta(createSystem(250, 252), createSystem(2, 4))).toEqual({ dx: 8, dy: 4 });
  });

  it('shows opposite-edge systems on the local map when the seam route is closer', () => {
    const systems = getGalaxySystems();
    const origin = systems.find((system) => system.data.x <= 8);
    expect(origin).toBeDefined();

    const seamNeighbor = systems.find((system) => {
      if (!origin || system.data.name === origin.data.name || system.data.x < 240) {
        return false;
      }
      const wrapped = getWrappedChartDelta(origin.data, system.data);
      return Math.abs(wrapped.dx) <= 26 && Math.abs(wrapped.dy) <= 22;
    });

    expect(seamNeighbor).toBeDefined();
    expect(getVisibleSystems(origin!.data.name).map((system) => system.data.name)).toContain(seamNeighbor!.data.name);
  });

  it('measures jump distance across the seam using the wrapped route', () => {
    const systems = getGalaxySystems();
    const pair = systems.reduce<{ origin: string; target: string; distance: number } | null>((best, origin) => {
      if (origin.data.x > 8) {
        return best;
      }

      const candidate = systems.find((target) => {
        if (target.data.name === origin.data.name || target.data.x < 240) {
          return false;
        }
        const wrapped = getWrappedChartDelta(origin.data, target.data);
        return Math.abs(wrapped.dx) <= 26 && Math.abs(wrapped.dy) <= 22;
      });

      if (!candidate) {
        return best;
      }

      const distance = getSystemDistance(origin.data.name, candidate.data.name);
      if (!best || distance < best.distance) {
        return { origin: origin.data.name, target: candidate.data.name, distance };
      }
      return best;
    }, null);

    expect(pair).not.toBeNull();
    const origin = getSystemByName(pair!.origin);
    const target = getSystemByName(pair!.target);
    expect(origin).toBeDefined();
    expect(target).toBeDefined();

    const directDistance = Math.hypot(target!.data.x - origin!.data.x, (target!.data.y - origin!.data.y) / 2) * 0.4;
    expect(pair!.distance).toBeLessThan(directDistance);
  });

  it('converts the wrapped chart delta into a flight heading', () => {
    expect(getWrappedChartHeading(createSystem(10, 10), createSystem(20, 10))).toBeCloseTo(0);
    expect(getWrappedChartHeading(createSystem(10, 10), createSystem(10, 20))).toBeCloseTo(Math.PI / 2);
    expect(getWrappedChartHeading(createSystem(2, 4), createSystem(250, 252))).toBeCloseTo(Math.atan2(-4, -8));
  });

  it('returns a system heading using the same wrapped map route as jump distance', () => {
    const systems = getGalaxySystems();
    const pair = systems.reduce<{ origin: string; target: string } | null>((best, origin) => {
      if (best || origin.data.x > 8) {
        return best;
      }

      const candidate = systems.find((target) => {
        if (target.data.name === origin.data.name || target.data.x < 240) {
          return false;
        }
        const wrapped = getWrappedChartDelta(origin.data, target.data);
        return Math.abs(wrapped.dx) <= 26 && Math.abs(wrapped.dy) <= 22;
      });

      return candidate ? { origin: origin.data.name, target: candidate.data.name } : null;
    }, null);

    expect(pair).not.toBeNull();
    const origin = getSystemByName(pair!.origin);
    const target = getSystemByName(pair!.target);
    expect(origin).toBeDefined();
    expect(target).toBeDefined();
    expect(getSystemHeading(pair!.origin, pair!.target)).toBeCloseTo(getWrappedChartHeading(origin!.data, target!.data));
  });
});
