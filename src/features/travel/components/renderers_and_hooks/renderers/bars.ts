import { CGA_GREEN, CGA_RED, CGA_YELLOW } from './constants';

/**
 * Shared segmented-bar helpers for the travel HUD and enemy overlays.
 *
 * Elite presents energy as discrete banks rather than a single smooth meter.
 * Keeping the bank math here ensures player and enemy bars collapse in the
 * same left-to-right pattern and share the same CGA warning thresholds.
 */
export function getSegmentedBankRatios(current: number, maximum: number, bankCount: number) {
  const ratio = Math.max(0, Math.min(1, maximum > 0 ? current / maximum : 0));
  return Array.from({ length: bankCount }, (_unused, bankIndex) => Math.max(0, Math.min(1, ratio * bankCount - bankIndex)));
}

/**
 * Maps a normalized fill ratio onto the existing in-game palette so every bar
 * communicates "healthy / warning / critical" the same way.
 */
export function getCgaBarFillColor(ratio: number) {
  if (ratio <= 0.3) {
    return CGA_RED;
  }
  if (ratio <= 0.65) {
    return CGA_YELLOW;
  }
  return CGA_GREEN;
}
