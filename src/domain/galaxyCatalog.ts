import { generateSystemData, type SystemData } from './systemData';
import { generateGalaxy, type SeedTriplet } from './universe';

export interface GalaxySystem {
  index: number;
  seed: SeedTriplet;
  data: SystemData;
}

const GALAXY_ONE_SYSTEMS: GalaxySystem[] = generateGalaxy(0).map((system) => ({
  index: system.index,
  seed: system.seed,
  data: generateSystemData(system.seed)
}));

const GALAXY_WIDTH = 256;
const GALAXY_HEIGHT = 256;

/**
 * Returns the shortest signed offset on a toroidal axis.
 *
 * The galaxy wraps on both axes, so moving left from x=0 enters on the far
 * right and moving up from y=0 enters on the bottom. This helper converts two
 * absolute chart coordinates into the shortest wrapped delta between them.
 */
function getWrappedAxisDelta(origin: number, target: number, size: number): number {
  const direct = target - origin;
  const wrappedForward = direct + size;
  const wrappedBackward = direct - size;
  let shortest = direct;

  if (Math.abs(wrappedForward) < Math.abs(shortest)) {
    shortest = wrappedForward;
  }
  if (Math.abs(wrappedBackward) < Math.abs(shortest)) {
    shortest = wrappedBackward;
  }

  return shortest;
}

/**
 * Computes toroidal chart offsets while preserving the original half-height Y
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
 * wrapped chart angle here lets the jump sequence point toward the same target
 * direction the player sees on the maps, including seam-crossing shortcuts.
 */
export function getWrappedChartHeading(origin: SystemData, target: SystemData): number {
  const { dx, dy } = getWrappedChartDelta(origin, target);
  return Math.atan2(dy, dx);
}

function chartDistance(a: SystemData, b: SystemData): number {
  const { dx, dy } = getWrappedChartDelta(a, b);
  return Math.hypot(dx, dy);
}

export function getGalaxySystems(): GalaxySystem[] {
  return GALAXY_ONE_SYSTEMS;
}

export function getSystemByName(systemName: string): GalaxySystem | undefined {
  return GALAXY_ONE_SYSTEMS.find((system) => system.data.name === systemName);
}

export function getNearbySystemNames(systemName: string, limit = 4): string[] {
  const origin = getSystemByName(systemName);
  if (!origin) {
    return [];
  }

  return GALAXY_ONE_SYSTEMS
    .filter((system) => system.data.name !== systemName)
    .sort((left, right) => chartDistance(origin.data, left.data) - chartDistance(origin.data, right.data))
    .slice(0, limit)
    .map((system) => system.data.name);
}

export function getVisibleSystems(systemName: string, chartRadiusX = 26, chartRadiusY = 22): GalaxySystem[] {
  const origin = getSystemByName(systemName);
  if (!origin) {
    return [];
  }

  // Visibility uses wrapped deltas too, so systems near the opposite edge of
  // the torus appear on the local map once they are close across the seam.
  return GALAXY_ONE_SYSTEMS.filter((system) => {
    const { dx, dy } = getWrappedChartDelta(origin.data, system.data);

    return Math.abs(dx) <= chartRadiusX && Math.abs(dy) <= chartRadiusY;
  });
}

export function getSystemDistance(systemName: string, targetSystemName: string): number {
  const origin = getSystemByName(systemName);
  const target = getSystemByName(targetSystemName);
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
export function getSystemHeading(systemName: string, targetSystemName: string): number | null {
  const origin = getSystemByName(systemName);
  const target = getSystemByName(targetSystemName);
  if (!origin || !target) {
    return null;
  }

  return getWrappedChartHeading(origin.data, target.data);
}
