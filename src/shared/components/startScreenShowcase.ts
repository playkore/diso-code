import type { BlueprintId } from '../../features/travel/domain/combat/types';

export type StartScreenShowcaseEntry =
  | {
      kind: 'ship';
      id: BlueprintId;
      label: string;
    }
  | {
      kind: 'station';
      label: string;
    };

/**
 * The start screen and its 3D showcase share the same ordered carousel list so
 * button navigation and rendered hull selection cannot drift apart over time.
 */
export const START_SCREEN_SHOWCASE_ENTRIES: readonly StartScreenShowcaseEntry[] = [
  { kind: 'ship', id: 'cobra-mk3-trader', label: 'Cobra Mk III' },
  { kind: 'ship', id: 'adder', label: 'Adder' },
  { kind: 'ship', id: 'gecko', label: 'Gecko' },
  { kind: 'ship', id: 'krait', label: 'Krait' },
  { kind: 'ship', id: 'mamba', label: 'Mamba' },
  { kind: 'ship', id: 'asp-mk2', label: 'Asp Mk II' },
  { kind: 'ship', id: 'python-trader', label: 'Python' },
  { kind: 'ship', id: 'viper', label: 'Viper' },
  { kind: 'ship', id: 'sidewinder', label: 'Sidewinder' },
  { kind: 'ship', id: 'cobra-mk1', label: 'Cobra Mk I' },
  { kind: 'ship', id: 'python-pirate', label: 'Python Pirate' },
  { kind: 'ship', id: 'fer-de-lance', label: 'Fer-de-Lance' },
  { kind: 'ship', id: 'thargoid', label: 'Thargoid' },
  { kind: 'station', label: 'Coriolis / Dodecahedron station' }
] as const;

export const START_SCREEN_SHOWCASE_COUNT = START_SCREEN_SHOWCASE_ENTRIES.length;
