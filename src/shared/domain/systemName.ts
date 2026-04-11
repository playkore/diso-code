import { advanceSeed, type SeedTriplet } from '../../features/galaxy/domain/universe';

const DIGRAMS = [
  'AL',
  'LE',
  'XE',
  'GE',
  'ZA',
  'CE',
  'BI',
  'SO',
  'US',
  'ES',
  'AR',
  'MA',
  'IN',
  'DI',
  'RE',
  'A',
  'ER',
  'AT',
  'EN',
  'BE',
  'RA',
  'LA',
  'VE',
  'TI',
  'ED',
  'OR',
  'QU',
  'AN',
  'TE',
  'IS',
  'RI',
  'ON'
] as const;

export function generateSystemName(seed: SeedTriplet): string {
  let localSeed = { ...seed };
  let output = '';
  const pairCount = localSeed.w0 & 0x40 ? 4 : 3;

  for (let i = 0; i < pairCount; i += 1) {
    const pairIndex = (localSeed.w2 >> 8) & 0x1f;
    if (pairIndex !== 0) {
      output += DIGRAMS[pairIndex] ?? '';
    }
    localSeed = advanceSeed(localSeed);
  }

  return output;
}
