import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/useGameStore';

export function DebugScreen() {
  const navigate = useNavigate();
  const instantTravelEnabled = useGameStore((state) => state.ui.instantTravelEnabled);
  const showTravelPerfOverlay = useGameStore((state) => state.ui.showTravelPerfOverlay);
  const setInstantTravelEnabled = useGameStore((state) => state.setInstantTravelEnabled);
  const setShowTravelPerfOverlay = useGameStore((state) => state.setShowTravelPerfOverlay);
  const grantDebugCredits = useGameStore((state) => state.grantDebugCredits);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);

  return (
    <section className="screen">
      <div className="screen__toolbar">
        <button
          type="button"
          className="screen__back"
          onClick={() => {
            setStartScreenVisible(true);
            navigate('/', { replace: true });
          }}
        >
          Back
        </button>
      </div>
      <h2>Debug</h2>
      <section className="save-panel save-panel--settings">
        {/* These controls affect simulation speed and diagnostics globally, so
            they stay grouped on their own debug screen instead of mixing with
            slot-management actions. */}
        <p className="dialog-kicker">Settings</p>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={instantTravelEnabled}
            onChange={(event) => setInstantTravelEnabled(event.target.checked)}
          />
          <span>Bypass space travel arcade segment</span>
        </label>
        <p className="muted">When enabled, travelling from the star map docks instantly at the destination.</p>
        <div className="save-panel__actions">
          <button type="button" onClick={() => grantDebugCredits(100000)}>
            Add 10000 Cr
          </button>
        </div>
        <p className="muted">Debug helper for quickly funding outfitting and trading tests.</p>
        <label className="settings-toggle">
          <input
            type="checkbox"
            checked={showTravelPerfOverlay}
            onChange={(event) => setShowTravelPerfOverlay(event.target.checked)}
          />
          <span>Show space flight performance overlay</span>
        </label>
        <p className="muted">Adds a live readout for frame timing, React commits, and main-thread stalls while travelling.</p>
      </section>
    </section>
  );
}
