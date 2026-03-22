const FRAMES_PER_SECOND = 60;
const HYPERSPACE_BASE_SECONDS = 2;
const HYPERSPACE_SECONDS_PER_LIGHT_YEAR = 1;

/**
 * Converts route distance into the scripted hyperspace travel duration.
 *
 * The flight loop counts time in 60 Hz simulation frames rather than raw
 * milliseconds, so this helper keeps the cinematic timing rules in one place:
 * every jump lasts at least two seconds, then adds one more second for each
 * light year to the selected destination.
 */
export function getHyperspaceDurationFrames(distanceLightYears: number) {
  const safeDistance = Number.isFinite(distanceLightYears) ? Math.max(0, distanceLightYears) : 0;
  const durationSeconds = HYPERSPACE_BASE_SECONDS + safeDistance * HYPERSPACE_SECONDS_PER_LIGHT_YEAR;
  return durationSeconds * FRAMES_PER_SECOND;
}
