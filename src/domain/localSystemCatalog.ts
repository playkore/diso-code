import type { SeedTriplet } from './universe';

export interface LocalSystemDefinition {
  name: string;
  seed: SeedTriplet;
}

// Local chart subset for the prototype. Screen coordinates are derived from these seeds
// using the documented chart rules (x = s1_hi, chartY = s0_hi >> 1).
export const LOCAL_SYSTEM_CATALOG: Record<string, LocalSystemDefinition> = {
  Lave: { name: 'Lave', seed: { w0: 0x7d4a, w1: 0x6048, w2: 0xb753 } },
  Diso: { name: 'Diso', seed: { w0: 0x8a4a, w1: 0x4c48, w2: 0x9f53 } },
  Leesti: { name: 'Leesti', seed: { w0: 0x544a, w1: 0x8648, w2: 0xa153 } },
  Zaonce: { name: 'Zaonce', seed: { w0: 0x374a, w1: 0x3848, w2: 0xc253 } },
  Reorte: { name: 'Reorte', seed: { w0: 0x954a, w1: 0x9748, w2: 0x8853 } }
};

export function getSystemChartCoordinates(systemName: string): { x: number; y: number } {
  const definition = LOCAL_SYSTEM_CATALOG[systemName];
  if (!definition) {
    return { x: 0, y: 0 };
  }

  return {
    x: definition.seed.w1 >> 8,
    y: (definition.seed.w0 >> 8) >> 1
  };
}
