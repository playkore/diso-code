import { generateSystemData, type SystemData } from './systemData';
import { generateGalaxy, type SeedTriplet } from './universe';

export interface GalaxySystem {
  index: number;
  seed: SeedTriplet;
  data: SystemData;
}

const GALAXY_WIDTH = 256;
const GALAXY_HEIGHT = 256;
const galaxyCache = new Map<number, GalaxySystem[]>();

function getNormalizedGalaxyIndex(galaxyIndex: number) {
  const normalized = Math.trunc(galaxyIndex) % 8;
  return normalized < 0 ? normalized + 8 : normalized;
}

function getGalaxyCatalog(galaxyIndex: number) {
  const normalizedGalaxyIndex = getNormalizedGalaxyIndex(galaxyIndex);
  const cached = galaxyCache.get(normalizedGalaxyIndex);
  if (cached) {
    return cached;
  }
  const generated = generateGalaxy(normalizedGalaxyIndex).map((system) => ({
    index: system.index,
    seed: system.seed,
    data: generateSystemData(system.seed)
  }));
  galaxyCache.set(normalizedGalaxyIndex, generated);
  return generated;
}

/**
 * Returns the signed delta on one chart axis without seam wrapping.
 *
 * The original prototype treated the galaxy as a torus, which let left-edge
 * routes jump straight to the far right. The RPG build removes that looping,
 * so chart movement now uses plain Cartesian deltas.
 */
function getWrappedAxisDelta(origin: number, target: number, size: number): number {
  void size;
  return target - origin;
}

/**
 * Computes chart offsets while preserving the original half-height Y
 * projection used by Elite's maps.
 */
export function getWrappedChartDelta(origin: SystemData, target: SystemData) {
  return {
    dx: getWrappedAxisDelta(origin.x, target.x, GALAXY_WIDTH),
    dy: getWrappedAxisDelta(origin.y, target.y, GALAXY_HEIGHT) / 2
  };
}

/**
 * Converts a wrapped chart route into the heading used by the flight model.
 *
 * The star charts treat positive Y as "down" on screen, while travel combat
 * uses the same canvas-style orientation for ship movement. Returning the
 * chart angle here lets the jump sequence point toward the same target
 * direction the player sees on the maps without seam-crossing shortcuts.
 */
export function getWrappedChartHeading(origin: SystemData, target: SystemData): number {
  const { dx, dy } = getWrappedChartDelta(origin, target);
  return Math.atan2(dy, dx);
}

function chartDistance(a: SystemData, b: SystemData): number {
  const { dx, dy } = getWrappedChartDelta(a, b);
  return Math.hypot(dx, dy);
}

export function getGalaxySystems(galaxyIndex = 0): GalaxySystem[] {
  return getGalaxyCatalog(galaxyIndex);
}

/**
 * Returns the first generated system in a galaxy.
 *
 * The commander bootstrap and showcase scenes use this as a stable starting
 * anchor so a seed change automatically moves the whole game to a new
 * birthplace without hard-coding an old planet name.
 */
export function getStartingSystemName(galaxyIndex = 0): string {
  return getGalaxyCatalog(galaxyIndex)[0]?.data.name ?? 'Unknown';
}

export function getSystemByName(systemName: string, galaxyIndex = 0): GalaxySystem | undefined {
  return getGalaxyCatalog(galaxyIndex).find((system) => system.data.name === systemName);
}

export function getNearbySystemNames(systemName: string, galaxyIndex = 0, limit = 4): string[] {
  const origin = getSystemByName(systemName, galaxyIndex);
  if (!origin) {
    return [];
  }

  return getGalaxyCatalog(galaxyIndex)
    .filter((system) => system.data.name !== systemName)
    .sort((left, right) => chartDistance(origin.data, left.data) - chartDistance(origin.data, right.data))
    .slice(0, limit)
    .map((system) => system.data.name);
}

export function getVisibleSystems(systemName: string, galaxyIndex = 0, chartRadiusX = 26, chartRadiusY = 22): GalaxySystem[] {
  const origin = getSystemByName(systemName, galaxyIndex);
  if (!origin) {
    return [];
  }

  return getGalaxyCatalog(galaxyIndex).filter((system) => {
    const { dx, dy } = getWrappedChartDelta(origin.data, system.data);

    return Math.abs(dx) <= chartRadiusX && Math.abs(dy) <= chartRadiusY;
  });
}

export function getSystemDistance(systemName: string, targetSystemName: string, galaxyIndex = 0): number {
  const origin = getSystemByName(systemName, galaxyIndex);
  const target = getSystemByName(targetSystemName, galaxyIndex);
  if (!origin || !target) {
    return Infinity;
  }

  return chartDistance(origin.data, target.data) * 0.4;
}

/**
 * Resolves the inter-system heading visible on the charts.
 *
 * Consumers use this to align travel visuals with the selected route without
 * duplicating lookup and toroidal-wrap logic throughout the UI.
 */
export function getSystemHeading(systemName: string, targetSystemName: string, galaxyIndex = 0): number | null {
  const origin = getSystemByName(systemName, galaxyIndex);
  const target = getSystemByName(targetSystemName, galaxyIndex);
  if (!origin || !target) {
    return null;
  }

  return getWrappedChartHeading(origin.data, target.data);
}
