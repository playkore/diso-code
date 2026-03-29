import { getCombatRating, getLegalStatus, totalCargoUsedTonnes } from '../domain/commander';
import { MAX_FUEL, getFuelUnits } from '../domain/fuel';
import { getInstalledEquipmentList } from '../domain/outfitting';
import { LASER_CATALOG } from '../domain/shipCatalog';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);
  const buyFuel = useGameStore((state) => state.buyFuel);
  const cargoUsed = totalCargoUsedTonnes(commander.cargo, commander.missionCargo);
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(commander.fuel));
  const installedEquipment = getInstalledEquipmentList(commander);
  const rating = getCombatRating(commander.tally);
  const laserEntries = Object.entries(commander.laserMounts).map(([mount, laserId]) => ({
    mount,
    name: laserId ? LASER_CATALOG[laserId].name : 'Empty'
  }));

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
        <dd>{rating}</dd>
        <dt>Tally</dt>
        <dd>{commander.tally}</dd>
        <dt>Ship</dt>
        <dd>Cobra Mk III</dd>
        <dt>Cargo</dt>
        <dd>
          {cargoUsed} / {commander.cargoCapacity} t
        </dd>
        <dt>Missiles</dt>
        <dd>
          {commander.missilesInstalled} / {commander.missileCapacity}
        </dd>
      </dl>
      <section className="subpanel">
        <p className="dialog-kicker">Mission Cargo</p>
        {commander.missionCargo.length ? (
          <ul className="chip-list">
            {commander.missionCargo.map((item) => (
              <li key={`${item.missionId}:${item.key}`}>
                {item.name} x{item.amount}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No mission-specific cargo aboard.</p>
        )}
      </section>
      <section className="subpanel">
        <p className="dialog-kicker">Laser Mounts</p>
        <ul className="chip-list">
          {laserEntries.map((entry) => (
            <li key={entry.mount}>
              {entry.mount}: {entry.name}
            </li>
          ))}
        </ul>
      </section>
      <section className="subpanel">
        <p className="dialog-kicker">Installed Equipment</p>
        {installedEquipment.length ? (
          <ul className="chip-list">
            {installedEquipment.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No optional systems installed.</p>
        )}
      </section>
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
