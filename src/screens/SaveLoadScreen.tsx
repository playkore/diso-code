import { useState } from 'react';
import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

export function SaveLoadScreen() {
  const quickSave = useGameStore((state) => state.quickSave);
  const loadFromSave = useGameStore((state) => state.loadFromSave);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const saveState = useGameStore((state) => state.saveState);
  const commander = useGameStore((state) => state.commander);
  const universe = useGameStore((state) => state.universe);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const savedCommander = saveState?.snapshot.commander;
  const savedUniverse = saveState?.snapshot.universe;
  const currentCargo = cargoUsedTonnes(commander.cargo);
  const savedCargo = savedCommander ? cargoUsedTonnes(savedCommander.cargo) : 0;

  return (
    <section className="screen">
      <h2>Save / Load</h2>
      <div className="save-actions">
        <button type="button" onClick={quickSave}>
          Save Slot 1
        </button>
        <button type="button" onClick={loadFromSave} disabled={!saveState}>
          Load Slot 1
        </button>
        <button type="button" className="button-danger" onClick={() => setIsConfirmingReset(true)}>
          New Game
        </button>
      </div>
      <div className="save-panels">
        <section className="save-panel">
          <p className="dialog-kicker">Current Commander</p>
          <dl className="detail-grid">
            <dt>Name</dt>
            <dd>{commander.name}</dd>
            <dt>System</dt>
            <dd>{commander.currentSystem}</dd>
            <dt>Credits</dt>
            <dd>{formatCredits(commander.cash)}</dd>
            <dt>Fuel</dt>
            <dd>{formatLightYears(commander.fuel)}</dd>
            <dt>Cargo</dt>
            <dd>
              {currentCargo} / {commander.cargoCapacity} t
            </dd>
            <dt>Stardate</dt>
            <dd>{universe.stardate}</dd>
          </dl>
        </section>
        <section className="save-panel">
          <p className="dialog-kicker">Slot 1</p>
          {savedCommander && savedUniverse ? (
            <>
              <p className="muted">Saved {new Date(saveState.savedAt).toLocaleString()}</p>
              <dl className="detail-grid">
                <dt>Name</dt>
                <dd>{savedCommander.name}</dd>
                <dt>System</dt>
                <dd>{savedCommander.currentSystem}</dd>
                <dt>Credits</dt>
                <dd>{formatCredits(savedCommander.cash)}</dd>
                <dt>Fuel</dt>
                <dd>{formatLightYears(savedCommander.fuel)}</dd>
                <dt>Cargo</dt>
                <dd>
                  {savedCargo} / {savedCommander.cargoCapacity} t
                </dd>
                <dt>Stardate</dt>
                <dd>{savedUniverse.stardate}</dd>
              </dl>
            </>
          ) : (
            <p className="muted">No commander saved in Slot 1 yet.</p>
          )}
        </section>
      </div>
      {isConfirmingReset ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="new-game-title">
            <p className="dialog-kicker">New Commander</p>
            <h3 id="new-game-title">Start a new game?</h3>
            <p>
              This resets the current commander to a fresh start in Lave. Slot 1 stays untouched until you save over it.
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
