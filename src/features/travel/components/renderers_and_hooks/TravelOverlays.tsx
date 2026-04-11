import { TravelPerfOverlay } from './TravelPerfOverlay';
import type { TravelPerfSnapshot } from './travelSessionPerf';

interface TravelOverlaysProps {
  perf: TravelPerfSnapshot;
  showPerfOverlay: boolean;
  message: string;
  gameOverVisible: boolean;
}

/**
 * Separates transient overlays from the main HUD so the screen component can
 * stay focused on composition rather than conditional presentation logic.
 */
export function TravelOverlays({ perf, showPerfOverlay, message, gameOverVisible }: TravelOverlaysProps) {
  return (
    <>
      {showPerfOverlay ? <TravelPerfOverlay perf={perf} /> : null}
      <div className="travel-screen__message">{message}</div>
      {gameOverVisible ? (
        <div className="travel-screen__game-over" aria-live="polite">
          <div className="travel-screen__game-over-title">GAME OVER</div>
        </div>
      ) : null}
    </>
  );
}
