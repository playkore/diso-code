import { useState } from 'react';
import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

const SAVE_SLOT_IDS = [1, 2, 3] as const;

export function SaveLoadScreen() {
  const saveToSlot = useGameStore((state) => state.saveToSlot);
  const loadFromSlot = useGameStore((state) => state.loadFromSlot);
  const startNewGame = useGameStore((state) => state.startNewGame);
  const instantTravelEnabled = useGameStore((state) => state.ui.instantTravelEnabled);
  const showTravelPerfOverlay = useGameStore((state) => state.ui.showTravelPerfOverlay);
  const setInstantTravelEnabled = useGameStore((state) => state.setInstantTravelEnabled);
  const setShowTravelPerfOverlay = useGameStore((state) => state.setShowTravelPerfOverlay);
  const grantDebugCredits = useGameStore((state) => state.grantDebugCredits);
  const saveStates = useGameStore((state) => state.saveStates);
  const commander = useGameStore((state) => state.commander);
  const universe = useGameStore((state) => state.universe);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [pendingLoadSlotId, setPendingLoadSlotId] = useState<(typeof SAVE_SLOT_IDS)[number] | null>(null);
  const currentCargo = cargoUsedTonnes(commander.cargo);

  return (
    <section className="screen">
      <h2>Save / Load</h2>
      <div className="save-panels">
        {/* Current commander summary and destructive new-game entry point. */}
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
          <div className="save-panel__actions">
            <button type="button" className="button-danger" onClick={() => setIsConfirmingReset(true)}>
              New Game
            </button>
          </div>
        </section>
        {SAVE_SLOT_IDS.map((slotId) => {
          const saveState = saveStates[slotId];
          const savedCommander = saveState?.snapshot.commander;
          const savedUniverse = saveState?.snapshot.universe;
          const savedCargo = savedCommander ? cargoUsedTonnes(savedCommander.cargo) : 0;

          return (
            // Each slot shows the saved snapshot summary plus direct save/load actions.
            <section key={slotId} className="save-panel">
              <div className="save-slot__header">
                <p className="dialog-kicker">Slot {slotId}</p>
                <div className="save-slot__actions">
                  <button type="button" onClick={() => saveToSlot(slotId)}>
                    Save
                  </button>
                  <button type="button" onClick={() => setPendingLoadSlotId(slotId)} disabled={!saveState}>
                    Load
                  </button>
                </div>
              </div>
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
                <p className="muted">Empty slot.</p>
              )}
            </section>
          );
        })}
      </div>
      {isConfirmingReset ? (
        // New game is gated behind a modal because it discards the in-memory run.
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
      {pendingLoadSlotId ? (
        // Loading is confirmed separately so accidental taps do not overwrite the current run.
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="load-game-title">
            <p className="dialog-kicker">Load Commander</p>
            <h3 id="load-game-title">Load Slot {pendingLoadSlotId}?</h3>
            <p>
              This will replace the current commander state with the saved run from Slot {pendingLoadSlotId}. Unsaved progress
              in the current run will be lost.
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingLoadSlotId(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  loadFromSlot(pendingLoadSlotId);
                  setPendingLoadSlotId(null);
                }}
              >
                Load Slot {pendingLoadSlotId}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <section className="save-panel save-panel--settings">
        {/* Settings/debug helpers live here because they affect the broader run rather than a slot. */}
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
