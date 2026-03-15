import { useState } from 'react';
import { useGameStore } from '../store/useGameStore';

export function SaveLoadScreen() {
  const quickSave = useGameStore((state) => state.quickSave);
  const loadFromSave = useGameStore((state) => state.loadFromSave);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const saveState = useGameStore((state) => state.saveState);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  return (
    <section className="screen">
      <h2>Save / Load</h2>
      <div className="save-actions">
        <button type="button" onClick={quickSave}>
          Quick Save
        </button>
        <button type="button" onClick={loadFromSave}>
          Load Slot 1
        </button>
        <button type="button" className="button-danger" onClick={() => setIsConfirmingReset(true)}>
          New Game
        </button>
      </div>
      {saveState ? (
        <>
          <p className="muted">JSON preview:</p>
          <pre className="save-preview">{saveState.json}</pre>
        </>
      ) : (
        <p className="muted">No save created yet.</p>
      )}
      {isConfirmingReset ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="new-game-title">
            <p className="dialog-kicker">New Commander</p>
            <h3 id="new-game-title">Start a new game?</h3>
            <p>
              This will replace the current commander state with a fresh start in Lave. Your saved slot will remain available.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setIsConfirmingReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="button-danger"
                onClick={() => {
                  startNewGame();
                  setIsConfirmingReset(false);
                }}
              >
                Start New Game
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
