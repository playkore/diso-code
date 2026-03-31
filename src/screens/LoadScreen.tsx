import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAVE_SLOT_IDS } from '../store/gameStateFactory';
import { useGameStore } from '../store/useGameStore';

export function LoadScreen() {
  const navigate = useNavigate();
  const loadFromSlot = useGameStore((state) => state.loadFromSlot);
  const saveStates = useGameStore((state) => state.saveStates);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const [pendingLoadSlotId, setPendingLoadSlotId] = useState<(typeof SAVE_SLOT_IDS)[number] | null>(null);
  const [loadedSlotId, setLoadedSlotId] = useState<(typeof SAVE_SLOT_IDS)[number] | null>(null);

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
      <h2>Load</h2>
      <div className="save-panels">
        {SAVE_SLOT_IDS.map((slotId) => {
          const saveState = saveStates[slotId];
          const savedCommander = saveState?.snapshot.commander;
          const savedUniverse = saveState?.snapshot.universe;

          return (
            <button
              key={slotId}
              type="button"
              className="save-panel save-slot-button"
              onClick={() => setPendingLoadSlotId(slotId)}
              disabled={!saveState}
            >
              <div className="save-slot__header">
                <p className="dialog-kicker">Slot {slotId}</p>
                <p className="save-slot__cta">Load</p>
              </div>
              {savedCommander && savedUniverse ? (
                <>
                  <p className="muted">Saved {new Date(saveState.savedAt).toLocaleString()}</p>
                  <dl className="detail-grid">
                    <dt>Name</dt>
                    <dd>{savedCommander.name}</dd>
                    <dt>System</dt>
                    <dd>{savedCommander.currentSystem}</dd>
                    <dt>Stardate</dt>
                    <dd>{savedUniverse.stardate}</dd>
                  </dl>
                </>
              ) : (
                <p className="muted">Empty slot.</p>
              )}
            </button>
          );
        })}
      </div>
      {pendingLoadSlotId ? (
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
                  setLoadedSlotId(pendingLoadSlotId);
                  setPendingLoadSlotId(null);
                }}
              >
                Load Slot {pendingLoadSlotId}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {loadedSlotId ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="load-success-title">
            <p className="dialog-kicker">Load Complete</p>
            <h3 id="load-success-title">Slot {loadedSlotId} loaded successfully</h3>
            <p>Commander state restored. Press OK to return to the game.</p>
            <div className="dialog-actions dialog-actions--single">
              <button
                type="button"
                onClick={() => {
                  setLoadedSlotId(null);
                  navigate('/', { replace: true });
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
