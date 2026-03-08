import { generateSystemName } from './systemName';
import type { SeedTriplet } from './universe';

export interface SystemData {
  name: string;
  x: number;
  y: number;
  economy: number;
  government: number;
  techLevel: number;
  population: number;
  productivity: number;
  radius: number;
  species: string;
}

const SPECIES_SIZE = ['Large', 'Fierce', 'Small'] as const;
const SPECIES_COLOR = ['Green', 'Red', 'Yellow', 'Blue', 'Black', 'Harmless'] as const;
const SPECIES_FEATURE = ['Slimy', 'Bug-Eyed', 'Horned', 'Bony', 'Fat', 'Furry'] as const;
const SPECIES_TYPE = ['Rodent', 'Frog', 'Lizard', 'Lobster', 'Bird', 'Humanoid', 'Feline', 'Insect'] as const;

function toTitleCase(value: string): string {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function buildSpecies(seed: SeedTriplet): string {
  if ((seed.w2 & 0x80) === 0) {
    return 'Human Colonials';
  }

  const size = SPECIES_SIZE[(seed.w2 >> 10) & 0x03] ?? '';
  const color = SPECIES_COLOR[(seed.w2 >> 13) & 0x07] ?? '';
  const feature = SPECIES_FEATURE[(seed.w0 >> 8) & 0x07] ?? '';
  const type = SPECIES_TYPE[(seed.w1 >> 8) & 0x07] ?? '';

  return `${size} ${color} ${feature} ${type}s`.replace(/\s+/g, ' ').trim();
}

export function generateSystemData(seed: SeedTriplet): SystemData {
  const government = (seed.w1 >> 3) & 0x07;
  let economy = (seed.w0 >> 8) & 0x07;

  if (government <= 1) {
    economy |= 0x02;
  }

  let techLevel = (economy ^ 0x07) + ((seed.w1 >> 8) & 0x03);
  techLevel += government >> 1;
  if ((government & 0x01) === 1) {
    techLevel += 1;
  }

  const population = 4 * techLevel + economy + government + 1;
  const productivity = ((economy ^ 0x07) + 3) * (government + 4) * population * 8;
  const radius = 256 * (((seed.w2 >> 8) & 0x0f) + 11) + ((seed.w0 >> 8) & 0xff);

  return {
    name: toTitleCase(generateSystemName(seed)),
    x: seed.w1 >> 8,
    y: seed.w0 >> 8,
    economy,
    government,
    techLevel,
    population,
    productivity,
    radius,
    species: buildSpecies(seed)
  };
}
