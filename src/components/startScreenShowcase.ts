import type { BlueprintId } from '../domain/travelCombat';

/**
 * The start screen and its 3D showcase share the same ordered carousel list so
 * button navigation and rendered hull selection cannot drift apart over time.
 */
export const START_SCREEN_SHOWCASE_SHIP_IDS: readonly BlueprintId[] = [
  'sidewinder',
  'mamba',
  'krait',
  'adder',
  'gecko',
  'cobra-mk1',
  'cobra-mk3-pirate',
  'asp-mk2',
  'python-pirate',
  'fer-de-lance'
] as const;

export const START_SCREEN_SHOWCASE_COUNT = START_SCREEN_SHOWCASE_SHIP_IDS.length;
