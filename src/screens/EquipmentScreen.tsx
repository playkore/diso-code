import { getSystemByName } from '../domain/galaxyCatalog';
import {
  canBuyMissile,
  getAvailableEquipmentForSystem,
  isMissileAvailableAtTechLevel,
  getLaserOffersForSystem
} from '../domain/outfitting';
import { LASER_CATALOG, MISSILE_CATALOG, type LaserMountPosition } from '../domain/shipCatalog';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

const LASER_MOUNTS: LaserMountPosition[] = ['front', 'rear', 'left', 'right'];

export function EquipmentScreen() {
  const commander = useGameStore((state) => state.commander);
  const currentSystem = useGameStore((state) => state.universe.currentSystem);
  const galaxyIndex = useGameStore((state) => state.universe.galaxyIndex);
  const buyEquipment = useGameStore((state) => state.buyEquipment);
  const buyLaser = useGameStore((state) => state.buyLaser);
  const buyMissile = useGameStore((state) => state.buyMissile);
  const useGalacticHyperdrive = useGameStore((state) => state.useGalacticHyperdrive);
  const techLevel = getSystemByName(currentSystem, galaxyIndex)?.data.techLevel ?? 0;
  const equipmentOffers = getAvailableEquipmentForSystem(techLevel, commander);
  const missileState = canBuyMissile(commander, techLevel);
  const missileVisible = isMissileAvailableAtTechLevel(techLevel);

  return (
    <section className="screen">
      <h2>Equip Ship</h2>
      <p className="muted">
        Galaxy {galaxyIndex + 1} · {currentSystem} tech level {techLevel} · Cash {formatCredits(commander.cash)} · Fuel {formatLightYears(commander.fuel)} · Missiles{' '}
        {commander.missilesInstalled}/{commander.missileCapacity}
      </p>

      <section className="subpanel">
        {/* Weapons are split from general equipment because lasers are priced per mount and missiles use rack capacity. */}
        <div className="section-heading">
          <div>
            <p className="dialog-kicker">Weapons</p>
            <p className="muted">Directional lasers are purchased per mount.</p>
          </div>
          {missileVisible ? (
            <button type="button" onClick={() => buyMissile()} disabled={!missileState.ok}>
              Buy Missile {formatCredits(MISSILE_CATALOG.price)}
            </button>
          ) : null}
        </div>
        {missileVisible && !missileState.ok ? <p className="muted">{missileState.reason}</p> : null}
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
        {/* General equipment offers are prefiltered by the outfitting domain helpers for this tech level. */}
        <div className="section-heading">
          <p className="dialog-kicker">Equipment Market</p>
          {commander.installedEquipment.galactic_hyperdrive ? (
            <button type="button" onClick={() => useGalacticHyperdrive()}>
              Use Galactic Hyperdrive
            </button>
          ) : null}
        </div>
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
