import { getSystemByName } from '../domain/galaxyCatalog';
import {
  canBuyMissile,
  getAvailableEquipmentForSystem,
  getInstalledEquipmentList,
  getLaserOffersForSystem
} from '../domain/outfitting';
import { LASER_CATALOG, MISSILE_CATALOG, PLAYER_SHIP, type LaserMountPosition } from '../domain/shipCatalog';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

const LASER_MOUNTS: LaserMountPosition[] = ['front', 'rear', 'left', 'right'];

export function EquipmentScreen() {
  const commander = useGameStore((state) => state.commander);
  const currentSystem = useGameStore((state) => state.universe.currentSystem);
  const buyEquipment = useGameStore((state) => state.buyEquipment);
  const buyLaser = useGameStore((state) => state.buyLaser);
  const buyMissile = useGameStore((state) => state.buyMissile);
  const techLevel = getSystemByName(currentSystem)?.data.techLevel ?? 0;
  const equipmentOffers = getAvailableEquipmentForSystem(techLevel, commander);
  const installedEquipment = getInstalledEquipmentList(commander);
  const missileState = canBuyMissile(commander, techLevel);

  return (
    <section className="screen">
      <h2>Equipment Market</h2>
      <p className="muted">
        {currentSystem} tech level {techLevel}
      </p>

      <section className="subpanel">
        <p className="dialog-kicker">Ship</p>
        <dl className="detail-grid">
          <dt>Hull</dt>
          <dd>{PLAYER_SHIP.name}</dd>
          <dt>Manufacturer</dt>
          <dd>{PLAYER_SHIP.manufacturer}</dd>
          <dt>Fuel Tank</dt>
          <dd>{formatLightYears(commander.fuel)} / {formatLightYears(commander.maxFuel)}</dd>
          <dt>Cargo Bay</dt>
          <dd>
            {commander.cargoCapacity} / {commander.maxCargoCapacity} t
          </dd>
          <dt>Energy Banks</dt>
          <dd>
            {commander.energyBanks} x {commander.energyPerBank}
          </dd>
          <dt>Missiles</dt>
          <dd>
            {commander.missilesInstalled} / {commander.missileCapacity}
          </dd>
        </dl>
        {installedEquipment.length ? (
          <ul className="chip-list">
            {installedEquipment.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="subpanel">
        <div className="section-heading">
          <div>
            <p className="dialog-kicker">Weapons</p>
            <p className="muted">Directional lasers are purchased per mount.</p>
          </div>
          <button type="button" onClick={() => buyMissile()} disabled={!missileState.ok}>
            Buy Missile {formatCredits(MISSILE_CATALOG.price)}
          </button>
        </div>
        {!missileState.ok ? <p className="muted">{missileState.reason}</p> : null}
        <ul className="card-list">
          {LASER_MOUNTS.map((mount) => {
            const installedLaserId = commander.laserMounts[mount];
            const offers = getLaserOffersForSystem(techLevel, commander, mount);
            return (
              <li key={mount} className="card-row">
                <div className="section-heading">
                  <strong>{mount.toUpperCase()}</strong>
                  <span>{installedLaserId ? LASER_CATALOG[installedLaserId].name : 'Empty'}</span>
                </div>
                <div className="equipment-grid">
                  {offers.map((laser) => (
                    <button
                      key={laser.id}
                      type="button"
                      className="equipment-choice"
                      onClick={() => buyLaser(mount, laser.id)}
                      disabled={!laser.available || commander.cash < laser.price || installedLaserId === laser.id}
                    >
                      <strong>{laser.name}</strong>
                      <span>{formatCredits(laser.price)}</span>
                      <span>TL {laser.requiredTechLevel}</span>
                      <span>{laser.damageTier} dmg</span>
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="subpanel">
        <p className="dialog-kicker">Equipment Market</p>
        <ul className="card-list">
          {equipmentOffers.map((equipment) => (
            <li key={equipment.id} className="card-row market-row">
              <div className="market-row__headline">
                <div className="market-row__summary">
                  <strong>{equipment.name}</strong>
                  <span>{equipment.description}</span>
                </div>
                <span className="market-row__price">{formatCredits(equipment.price)}</span>
              </div>
              <div className="section-heading">
                <span>Tech {equipment.requiredTechLevel}</span>
                <button type="button" onClick={() => buyEquipment(equipment.id)} disabled={equipment.installed || !equipment.available || commander.cash < equipment.price}>
                  {equipment.installed ? 'Installed' : 'Buy'}
                </button>
              </div>
              {!equipment.available || equipment.installed || commander.cash < equipment.price ? (
                <p className="muted">{equipment.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
