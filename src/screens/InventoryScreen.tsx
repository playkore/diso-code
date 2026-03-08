import { useGameStore } from '../store/useGameStore';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);

  return (
    <section className="screen">
      <h2>Inventory / Status</h2>
      <dl className="detail-grid">
        <dt>Commander</dt>
        <dd>{commander.name}</dd>
        <dt>Credits</dt>
        <dd>{commander.credits} cr</dd>
        <dt>Fuel</dt>
        <dd>{commander.fuel.toFixed(1)} LY</dd>
        <dt>Cargo</dt>
        <dd>{commander.cargoCapacity} t max</dd>
      </dl>
    </section>
  );
}
