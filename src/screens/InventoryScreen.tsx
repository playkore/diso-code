import { cargoUsedTonnes, getLegalStatus } from '../domain/commander';
import { MAX_FUEL, getFuelUnits } from '../domain/fuel';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);
  const buyFuel = useGameStore((state) => state.buyFuel);
  const cargoUsed = cargoUsedTonnes(commander.cargo);
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(commander.fuel));

  return (
    <section className="screen">
      <h2>Inventory / Status</h2>
      <dl className="detail-grid">
        <dt>Commander</dt>
        <dd>{commander.name}</dd>
        <dt>Credits</dt>
        <dd>{formatCredits(commander.cash)}</dd>
        <dt>Fuel</dt>
        <dd>{formatLightYears(commander.fuel)}</dd>
        <dt>Legal</dt>
        <dd>{getLegalStatus(commander.legalValue)} ({commander.legalValue})</dd>
        <dt>Rating</dt>
        <dd>{commander.rating}</dd>
        <dt>Tally</dt>
        <dd>{commander.tally}</dd>
        <dt>Cargo</dt>
        <dd>
          {cargoUsed} / {commander.cargoCapacity} t
        </dd>
      </dl>
      <div className="fuel-actions">
        <button type="button" onClick={() => buyFuel(1)} disabled={missingFuelUnits < 1}>
          Buy 0.1 LY
        </button>
        <button type="button" onClick={() => buyFuel(missingFuelUnits)} disabled={missingFuelUnits < 1}>
          Fill Tank
        </button>
      </div>
    </section>
  );
}
