export interface TravelPerfSnapshot {
  fps: number;
  frameAvgMs: number;
  frameP95Ms: number;
  frameMaxMs: number;
  workAvgMs: number;
  workP95Ms: number;
  workMaxMs: number;
  reactCommitsPerSecond: number;
  reactAvgMs: number;
  reactMaxMs: number;
  longTaskCount: number;
  longTaskMaxMs: number;
}

export interface PerfAccumulator {
  windowStart: number;
  frameDeltas: number[];
  workDurations: number[];
  reactCommitCount: number;
  reactCommitTotalMs: number;
  reactCommitMaxMs: number;
  longTaskCount: number;
  longTaskMaxMs: number;
}

export const EMPTY_PERF_SNAPSHOT: TravelPerfSnapshot = {
  fps: 0,
  frameAvgMs: 0,
  frameP95Ms: 0,
  frameMaxMs: 0,
  workAvgMs: 0,
  workP95Ms: 0,
  workMaxMs: 0,
  reactCommitsPerSecond: 0,
  reactAvgMs: 0,
  reactMaxMs: 0,
  longTaskCount: 0,
  longTaskMaxMs: 0
};

const PERF_SAMPLE_CAP = 120;

export function createPerfAccumulator(now: number): PerfAccumulator {
  return {
    windowStart: now,
    frameDeltas: [],
    workDurations: [],
    reactCommitCount: 0,
    reactCommitTotalMs: 0,
    reactCommitMaxMs: 0,
    longTaskCount: 0,
    longTaskMaxMs: 0
  };
}

export function pushPerfSample(samples: number[], value: number) {
  samples.push(value);
  if (samples.length > PERF_SAMPLE_CAP) {
    samples.shift();
  }
}

export function average(samples: number[]) {
  return samples.length === 0 ? 0 : samples.reduce((sum, sample) => sum + sample, 0) / samples.length;
}

export function max(samples: number[]) {
  return samples.length === 0 ? 0 : Math.max(...samples);
}

export function percentile95(samples: number[]) {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

export function buildPerfSnapshot(accumulator: PerfAccumulator, now: number): TravelPerfSnapshot {
  const elapsedMs = Math.max(1, now - accumulator.windowStart);
  return {
    fps: accumulator.frameDeltas.length * (1000 / elapsedMs),
    frameAvgMs: average(accumulator.frameDeltas),
    frameP95Ms: percentile95(accumulator.frameDeltas),
    frameMaxMs: max(accumulator.frameDeltas),
    workAvgMs: average(accumulator.workDurations),
    workP95Ms: percentile95(accumulator.workDurations),
    workMaxMs: max(accumulator.workDurations),
    reactCommitsPerSecond: accumulator.reactCommitCount * (1000 / elapsedMs),
    reactAvgMs: accumulator.reactCommitCount === 0 ? 0 : accumulator.reactCommitTotalMs / accumulator.reactCommitCount,
    reactMaxMs: accumulator.reactCommitMaxMs,
    longTaskCount: accumulator.longTaskCount,
    longTaskMaxMs: accumulator.longTaskMaxMs
  };
}

export function resetPerfAccumulator(now: number): PerfAccumulator {
  return createPerfAccumulator(now);
}
