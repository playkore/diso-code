export function SaveLoadScreen() {
  return (
    <section className="screen">
      <h2>Save / Load</h2>
      <div className="button-group">
        <button type="button">Quick Save</button>
        <button type="button">Load Slot 1</button>
      </div>
      <p className="muted">Persistent storage wiring comes next.</p>
    </section>
  );
}
