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
  w0: 0x5a4a,
  w1: 0x0248,
  w2: 0xb753
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

    for (let step = 0; step < 4; step += 1) {
      seed = advanceSeed(seed);
    }
  }

  return systems;
}
