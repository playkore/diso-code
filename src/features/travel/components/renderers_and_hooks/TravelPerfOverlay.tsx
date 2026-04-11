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

interface TravelPerfOverlayProps {
  perf: TravelPerfSnapshot;
}

/**
 * Presents the rolling travel-session performance sample in the same palette as
 * the rest of the flight HUD so debug instrumentation does not change the look.
 */
export function TravelPerfOverlay({ perf }: TravelPerfOverlayProps) {
  return (
    <aside className="travel-screen__perf" aria-live="off">
      <div className="travel-screen__perf-title">PERF</div>
      <div>FPS {perf.fps.toFixed(1)}</div>
      <div>FRAME {perf.frameAvgMs.toFixed(1)} / {perf.frameP95Ms.toFixed(1)} / {perf.frameMaxMs.toFixed(1)} ms</div>
      <div>WORK {perf.workAvgMs.toFixed(1)} / {perf.workP95Ms.toFixed(1)} / {perf.workMaxMs.toFixed(1)} ms</div>
      <div>REACT {perf.reactCommitsPerSecond.toFixed(1)} cps</div>
      <div>COMMIT {perf.reactAvgMs.toFixed(2)} / {perf.reactMaxMs.toFixed(2)} ms</div>
      <div>LONG {perf.longTaskCount} / {perf.longTaskMaxMs.toFixed(1)} ms</div>
    </aside>
  );
}
