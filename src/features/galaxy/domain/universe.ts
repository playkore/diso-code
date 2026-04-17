/**
 * Procedural galaxy seed helpers.
 *
 * The original-style universe is defined by a three-word seed. Each system is
 * generated from the current seed, then the seed advances four times before the
 * next system. Rotating all seed bytes yields the next galaxy.
 */
export interface SeedTriplet {
  w0: number;
  w1: number;
  w2: number;
}

export interface GalaxySystemSeed {
  index: number;
  seed: SeedTriplet;
}

export const BASE_SEED: SeedTriplet = {
  // Changing this seed shifts the entire procedural galaxy while preserving
  // the same generation rules for names, coordinates, and downstream systems.
  w0: 0x1f2d,
  w1: 0x3b4a,
  w2: 0x6c7e
};

const WORD_MASK = 0xffff;

export function advanceSeed(seed: SeedTriplet): SeedTriplet {
  const next = (seed.w0 + seed.w1 + seed.w2) & WORD_MASK;

  return {
    w0: seed.w1,
    w1: seed.w2,
    w2: next
  };
}

function rotateWordBytesLeft(word: number): number {
  const lowByte = word & 0xff;
  const highByte = (word >> 8) & 0xff;

  const rotatedLow = ((lowByte << 1) & 0xff) | (lowByte >> 7);
  const rotatedHigh = ((highByte << 1) & 0xff) | (highByte >> 7);

  return (rotatedHigh << 8) | rotatedLow;
}

export function transformGalaxy(seed: SeedTriplet): SeedTriplet {
  return {
    w0: rotateWordBytesLeft(seed.w0),
    w1: rotateWordBytesLeft(seed.w1),
    w2: rotateWordBytesLeft(seed.w2)
  };
}

export function generateGalaxySeed(galaxyIndex: number): SeedTriplet {
  const turns = Math.max(0, Math.trunc(galaxyIndex));
  let seed = { ...BASE_SEED };

  for (let i = 0; i < turns; i += 1) {
    seed = transformGalaxy(seed);
  }

  return seed;
}

export function generateGalaxy(galaxyIndex: number): GalaxySystemSeed[] {
  const systems: GalaxySystemSeed[] = [];
  let seed = generateGalaxySeed(galaxyIndex);

  for (let index = 0; index < 256; index += 1) {
    systems.push({
      index,
      seed: { ...seed }
    });

    // Downstream naming/system-data code expects this exact four-step stride.
    for (let step = 0; step < 4; step += 1) {
      seed = advanceSeed(seed);
    }
  }

  return systems;
}
