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

function chartDistance(a: SystemData, b: SystemData): number {
  return Math.hypot(a.x - b.x, (a.y - b.y) / 2);
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

  return GALAXY_ONE_SYSTEMS.filter((system) => {
    const dx = system.data.x - origin.data.x;
    const dy = (system.data.y - origin.data.y) / 2;

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
