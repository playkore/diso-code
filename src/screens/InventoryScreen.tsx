import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);
  const cargoUsed = cargoUsedTonnes(commander.cargo);

  return (
    <section className="screen">
      <h2>Inventory / Status</h2>
      <dl className="detail-grid">
        <dt>Commander</dt>
        <dd>{commander.name}</dd>
        <dt>Credits</dt>
        <dd>{commander.cash} cr</dd>
        <dt>Fuel</dt>
        <dd>{commander.fuel.toFixed(1)} LY</dd>
        <dt>Legal</dt>
        <dd>{commander.legalStatus}</dd>
        <dt>Rating</dt>
        <dd>{commander.rating}</dd>
        <dt>Tally</dt>
        <dd>{commander.tally}</dd>
        <dt>Cargo</dt>
        <dd>
          {cargoUsed} / {commander.cargoCapacity} t
        </dd>
      </dl>
    </section>
  );
}
