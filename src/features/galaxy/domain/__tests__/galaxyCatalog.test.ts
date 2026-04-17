import { describe, expect, it } from 'vitest';
import { getGalaxySystems, getStartingSystemName, getSystemDistance, getSystemByName, getSystemHeading, getWrappedChartDelta, getWrappedChartHeading } from '../galaxyCatalog';
import type { SystemData } from '../systemData';

const STARTING_SYSTEM = getStartingSystemName(0);
const TARGET_SYSTEM = getGalaxySystems(0).find((system) => system.data.name !== STARTING_SYSTEM)?.data.name ?? STARTING_SYSTEM;

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

describe('galaxy catalog geometry', () => {
  it('returns direct chart deltas without seam wrapping', () => {
    expect(getWrappedChartDelta(createSystem(2, 4), createSystem(250, 252))).toEqual({ dx: 248, dy: 124 });
    expect(getWrappedChartDelta(createSystem(250, 252), createSystem(2, 4))).toEqual({ dx: -248, dy: -124 });
  });

  it('does not show opposite-edge systems on the local map anymore', () => {
    const systems = getGalaxySystems(0);
    const origin = systems.find((system) => system.data.x <= 8);
    expect(origin).toBeDefined();

    const seamNeighbor = systems.find((system) => {
      if (!origin || system.data.name === origin.data.name || system.data.x < 240) {
        return false;
      }
      const wrapped = getWrappedChartDelta(origin.data, system.data);
      return Math.abs(wrapped.dx) <= 26 && Math.abs(wrapped.dy) <= 22;
    });

    expect(seamNeighbor).toBeUndefined();
  });

  it('measures jump distance using the direct chart route', () => {
    const distance = getSystemDistance(STARTING_SYSTEM, TARGET_SYSTEM, 0);
    const origin = getSystemByName(STARTING_SYSTEM, 0);
    const target = getSystemByName(TARGET_SYSTEM, 0);
    expect(origin).toBeDefined();
    expect(target).toBeDefined();
    const directDistance = Math.hypot(target!.data.x - origin!.data.x, (target!.data.y - origin!.data.y) / 2) * 0.4;
    expect(distance).toBeCloseTo(directDistance, 5);
  });

  it('converts the direct chart delta into a flight heading', () => {
    expect(getWrappedChartHeading(createSystem(10, 10), createSystem(20, 10))).toBeCloseTo(0);
    expect(getWrappedChartHeading(createSystem(10, 10), createSystem(10, 20))).toBeCloseTo(Math.PI / 2);
    expect(getWrappedChartHeading(createSystem(2, 4), createSystem(250, 252))).toBeCloseTo(Math.atan2(124, 248));
  });

  it('returns a system heading using the same direct map route as jump distance', () => {
    const origin = getSystemByName(STARTING_SYSTEM, 0);
    const target = getSystemByName(TARGET_SYSTEM, 0);
    expect(origin).toBeDefined();
    expect(target).toBeDefined();
    expect(getSystemHeading(STARTING_SYSTEM, TARGET_SYSTEM, 0)).toBeCloseTo(getWrappedChartHeading(origin!.data, target!.data));
  });

  it('returns different system catalogs for different galaxies', () => {
    const firstGalaxy = getGalaxySystems(0);
    const secondGalaxy = getGalaxySystems(1);
    expect(firstGalaxy[0]?.data.name).not.toBe(secondGalaxy[0]?.data.name);
  });
});
