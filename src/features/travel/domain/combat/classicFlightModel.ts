import type { BlueprintId } from './types';

/**
 * Classic flight metrics shared by the combat simulation and renderer.
 *
 * BBC Elite authors ship geometry and top-speed values in the same coordinate
 * space. This clone already scales wireframe geometry down before rendering, so
 * flight speeds need the same conversion to preserve the original "lengths of
 * hull per tick" feel instead of making every ship several times too fast for
 * its on-screen size.
 */
export const CLASSIC_COORDINATE_SCALE = 0.12;

/**
 * The player Cobra Mk III is governed by the `DELTA` speed variable rather than
 * the NPC Cobra blueprint, so its canonical top speed is 40 coordinates per
 * classic main-loop iteration.
 */
export const CLASSIC_PLAYER_TOP_SPEED = 40;

/**
 * Missile speed is a separate classic constant and intentionally outruns the
 * player Cobra.
 */
export const CLASSIC_MISSILE_TOP_SPEED = 44;

/**
 * Exact NPC blueprint top speeds taken from the documented BBC Master ship
 * hardware table on Elite on the 6502. These values preserve the canonical
 * relative ship-speed ordering while the shared coordinate-scale conversion
 * keeps them compatible with this project's reduced world-space geometry.
 */
export const CLASSIC_BLUEPRINT_TOP_SPEEDS: Record<BlueprintId, number> = {
  adder: 24,
  'asp-mk2': 40,
  'cobra-mk1': 26,
  'cobra-mk3-pirate': 28,
  'cobra-mk3-trader': 28,
  constrictor: 36,
  'fer-de-lance': 30,
  gecko: 30,
  krait: 30,
  mamba: 30,
  'python-pirate': 20,
  'python-trader': 20,
  sidewinder: 37,
  thargoid: 39,
  thargon: 30,
  viper: 32,
  worm: 23
};

/**
 * Converts a classic velocity measured in Elite coordinates per main-loop
 * iteration into this clone's world-space units per simulation tick.
 */
export function toWorldSpeed(classicSpeed: number) {
  return classicSpeed * CLASSIC_COORDINATE_SCALE;
}

export function getClassicBlueprintTopSpeed(id: BlueprintId) {
  return CLASSIC_BLUEPRINT_TOP_SPEEDS[id];
}
