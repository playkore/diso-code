import { getSystemByName } from '../../galaxy/domain/galaxyCatalog';
import { MAX_FUEL, getFuelUnits } from '../../../shared/domain/fuel';
import { useGameStore } from '../../../store/useGameStore';
import { formatCredits } from '../../../shared/utils/money';
import { formatLightYears } from '../../../shared/utils/distance';
import { xpToNextLevel } from '../../commander/domain/rpgProgression';

/**
 * The old commodity market route is now the docked station-services screen.
 *
 * Fuel purchases remain here because they are the one station-side transaction
 * that still matters after trading was removed from the game loop.
 */
export function MarketScreen() {
  const commander = useGameStore((state) => state.commander);
  const universe = useGameStore((state) => state.universe);
  const buyFuel = useGameStore((state) => state.buyFuel);
  const currentSystem = getSystemByName(universe.currentSystem, universe.galaxyIndex)?.data;
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(commander.fuel));

  return (
    <section className="screen">
      <h2>Station Services</h2>
      <p className="muted">
        {universe.currentSystem}
        {currentSystem ? ` · Tech level ${currentSystem.techLevel}` : ''}
        {' · '}
        Bounties replace commodity trading in this build.
      </p>

      <section className="subpanel">
        <div className="section-heading">
          <div>
            <p className="dialog-kicker">Commander</p>
            <p className="muted">
              Level {commander.level} · HP {commander.hp}/{commander.maxHp} · Attack {commander.attack}
            </p>
          </div>
          <strong>{formatCredits(commander.cash)}</strong>
        </div>
        <dl className="detail-grid">
          <dt>XP</dt>
          <dd>
            {commander.xp} / {xpToNextLevel(commander.level)}
          </dd>
          <dt>Fuel</dt>
          <dd>{formatLightYears(commander.fuel)}</dd>
          <dt>Missiles</dt>
          <dd>
            {commander.missilesInstalled} / {commander.missileCapacity}
          </dd>
        </dl>
      </section>

      <section className="subpanel">
        <div className="section-heading">
          <div>
            <p className="dialog-kicker">Fuel Depot</p>
            <p className="muted">Hyperspace still consumes fuel, so stations only sell refuels now.</p>
          </div>
          <span>{missingFuelUnits > 0 ? `${(missingFuelUnits / 10).toFixed(1)} LY missing` : 'Tank full'}</span>
        </div>
        <div className="button-group">
          <button type="button" onClick={() => buyFuel(1)} disabled={missingFuelUnits < 1}>
            Buy 0.1 LY
          </button>
          <button type="button" onClick={() => buyFuel(10)} disabled={missingFuelUnits < 10}>
            Buy 1.0 LY
          </button>
          <button type="button" onClick={() => buyFuel(missingFuelUnits)} disabled={missingFuelUnits < 1}>
            Fill Tank
          </button>
        </div>
      </section>
    </section>
  );
}
