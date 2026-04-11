import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAVE_SLOT_IDS } from '../../../shared/store/gameStateFactory';
import { useGameStore } from '../../../store/useGameStore';

export function SaveScreen() {
  const navigate = useNavigate();
  const saveToSlot = useGameStore((state) => state.saveToSlot);
  const saveStates = useGameStore((state) => state.saveStates);
  const commander = useGameStore((state) => state.commander);
  const universe = useGameStore((state) => state.universe);
  const setStartScreenVisible = useGameStore((state) => state.setStartScreenVisible);
  const [savedSlotId, setSavedSlotId] = useState<(typeof SAVE_SLOT_IDS)[number] | null>(null);

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
      <h2>Save</h2>
      <div className="save-panels">
        {/* Saving always starts from the live commander so the user can confirm
            which run will be written into the destination slot. */}
        <section className="save-panel">
          <p className="dialog-kicker">Current Commander</p>
          <dl className="detail-grid">
            <dt>Name</dt>
            <dd>{commander.name}</dd>
            <dt>System</dt>
            <dd>{commander.currentSystem}</dd>
            <dt>Stardate</dt>
            <dd>{universe.stardate}</dd>
          </dl>
        </section>
        {SAVE_SLOT_IDS.map((slotId) => {
          const saveState = saveStates[slotId];
          const savedCommander = saveState?.snapshot.commander;
          const savedUniverse = saveState?.snapshot.universe;

          return (
            <button
              key={slotId}
              type="button"
              className="save-panel save-slot-button"
              onClick={() => {
                saveToSlot(slotId);
                setSavedSlotId(slotId);
              }}
            >
              <div className="save-slot__header">
                <p className="dialog-kicker">Slot {slotId}</p>
                <p className="save-slot__cta">Save</p>
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
      {savedSlotId ? (
        <div className="dialog-backdrop" role="presentation">
          <div className="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="save-success-title">
            <p className="dialog-kicker">Save Complete</p>
            <h3 id="save-success-title">Slot {savedSlotId} saved successfully</h3>
            <p>Commander snapshot stored locally.</p>
            <div className="dialog-actions dialog-actions--single">
              <button type="button" onClick={() => setSavedSlotId(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
