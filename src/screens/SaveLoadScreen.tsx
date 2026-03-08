import { useGameStore } from '../store/useGameStore';

export function SaveLoadScreen() {
  const quickSave = useGameStore((state) => state.quickSave);
  const loadFromSave = useGameStore((state) => state.loadFromSave);
  const saveState = useGameStore((state) => state.saveState);

  return (
    <section className="screen">
      <h2>Save / Load</h2>
      <div className="button-group">
        <button type="button" onClick={quickSave}>
          Quick Save
        </button>
        <button type="button" onClick={loadFromSave}>
          Load Slot 1
        </button>
      </div>
      <p className="muted">commander.json schema v1 with checksum plus optional 256-byte binary adapter.</p>
      {saveState ? (
        <>
          <p className="muted">JSON preview:</p>
          <pre className="save-preview">{saveState.json}</pre>
        </>
      ) : (
        <p className="muted">No save created yet.</p>
      )}
    </section>
  );
}
