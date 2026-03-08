import { advanceSeed, type SeedTriplet } from './universe';

const DIGRAM_TABLE = 'ABOUSEITILETSTONLONUTHNO..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';

function appendDigram(result: string, pairIndex: number): string {
  const first = DIGRAM_TABLE[pairIndex] ?? '';
  const second = DIGRAM_TABLE[pairIndex + 1] ?? '';

  return `${result}${first === '.' ? '' : first}${second === '.' ? '' : second}`;
}

export function generateSystemName(seed: SeedTriplet): string {
  let localSeed = { ...seed };
  let output = '';
  const pairCount = localSeed.w0 & 0x40 ? 4 : 3;

  for (let i = 0; i < pairCount; i += 1) {
    const pairIndex = 2 * ((localSeed.w2 >> 8) & 0x1f);
    output = appendDigram(output, pairIndex);
    localSeed = advanceSeed(localSeed);
  }

  return output;
}
