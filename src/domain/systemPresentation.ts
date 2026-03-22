import type { SystemData } from './systemData';

export const ECONOMY_LABELS = [
  'Rich Industrial',
  'Average Industrial',
  'Poor Industrial',
  'Mainly Industrial',
  'Mainly Agricultural',
  'Rich Agricultural',
  'Average Agricultural',
  'Poor Agricultural'
] as const;

export const GOVERNMENT_LABELS = [
  'Anarchy',
  'Feudal',
  'Multi-Government',
  'Dictatorship',
  'Communist',
  'Confederacy',
  'Democracy',
  'Corporate State'
] as const;

/**
 * Normalizes raw procedural system bytes into the player-facing labels used by
 * the classic "Data on System" presentation and other destination summaries.
 */
export function getSystemFacts(system: SystemData) {
  return {
    economy: ECONOMY_LABELS[system.economy] ?? 'Unknown',
    government: GOVERNMENT_LABELS[system.government] ?? 'Unknown',
    techLevel: system.techLevel,
    population: system.population,
    productivity: `${system.productivity} M CR`,
    averageRadius: `${system.radius} km`,
    species: system.species
  };
}
