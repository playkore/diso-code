import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGalaxySystems, getSystemByName, getSystemDistance, getVisibleSystems, getWrappedChartDelta } from '../domain/galaxyCatalog';
import { MAX_FUEL, getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../domain/fuel';
import { getSystemFacts } from '../domain/systemPresentation';
import { useGameStore } from '../store/useGameStore';
import { formatLightYears } from '../utils/distance';

interface StarPoint {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
  inRange: boolean;
}

const MAP_SCALE = 4;
const MAX_JUMP_RANGE = (7 / 0.4) * MAP_SCALE;
const GALAXY_MAP_WIDTH = 260;
const GALAXY_MAP_HEIGHT = 132;
const GALAXY_MAP_PADDING = 4;

type MapMode = 'local' | 'galaxy';

function getRelativePoint(currentSystem: string, targetSystem: string, galaxyIndex: number, availableFuel: number): StarPoint {
  const current = getSystemByName(currentSystem, galaxyIndex)?.data;
  const target = getSystemByName(targetSystem, galaxyIndex)?.data;
  const { dx, dy } = current && target ? getWrappedChartDelta(current, target) : { dx: 0, dy: 0 };
  const distance = getSystemDistance(currentSystem, targetSystem, galaxyIndex);

  return {
    name: targetSystem,
    x: dx * MAP_SCALE,
    y: dy * MAP_SCALE,
    isCurrent: currentSystem === targetSystem,
    inRange: getJumpFuelUnits(distance) <= getFuelUnits(availableFuel)
  };
}

function getGalaxyPoint(targetSystem: string, currentSystem: string, galaxyIndex: number) {
  const target = getSystemByName(targetSystem, galaxyIndex)?.data;

  return {
    name: targetSystem,
    // The galaxy overview uses the raw generated coordinates and keeps the same
    // half-height Y axis as the classic charts so the large map matches local navigation.
    x: target?.x ?? 0,
    y: (target?.y ?? 0) / 2,
    isCurrent: targetSystem === currentSystem
  };
}

export function StarMapScreen() {
  const navigate = useNavigate();
  const universe = useGameStore((state) => state.universe);
  const currentFuel = useGameStore((state) => state.commander.fuel);
  const buyFuel = useGameStore((state) => state.buyFuel);
  const beginTravel = useGameStore((state) => state.beginTravel);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>('local');

  useEffect(() => {
    setSelectedSystem(null);
  }, [universe.currentSystem, universe.galaxyIndex]);

  const starPoints = useMemo<StarPoint[]>(
    () =>
      getVisibleSystems(universe.currentSystem, universe.galaxyIndex).map((system) =>
        getRelativePoint(universe.currentSystem, system.data.name, universe.galaxyIndex, currentFuel)
      ),
    [currentFuel, universe.currentSystem, universe.galaxyIndex]
  );
  const galaxyPoints = useMemo(
    () => getGalaxySystems(universe.galaxyIndex).map((system) => getGalaxyPoint(system.data.name, universe.currentSystem, universe.galaxyIndex)),
    [universe.currentSystem, universe.galaxyIndex]
  );

  const selectedPoint = starPoints.find((star) => star.name === selectedSystem) ?? null;
  const selectedSystemData = selectedSystem ? getSystemByName(selectedSystem, universe.galaxyIndex)?.data ?? null : null;
  const selectedSystemFacts = selectedSystemData ? getSystemFacts(selectedSystemData) : null;
  const selectedDistance = selectedSystem ? getJumpFuelCost(getSystemDistance(universe.currentSystem, selectedSystem, universe.galaxyIndex)) : null;
  const fuelAfterJump = selectedDistance === null ? null : Math.max(0, currentFuel - selectedDistance);
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(currentFuel));
  const currentSystemData = getSystemByName(universe.currentSystem, universe.galaxyIndex)?.data ?? null;
  const currentSystemFacts = currentSystemData ? getSystemFacts(currentSystemData) : null;
  const detailsSystemName = selectedSystem ?? universe.currentSystem;
  const detailsSystemFacts = selectedSystemFacts ?? currentSystemFacts;
  const showingCurrentSystem = selectedSystem === null;

  return (
    <section className="screen">
      <h2>Local Star Map</h2>
      <p className="muted">Galaxy {universe.galaxyIndex + 1}</p>
      <div className="segment-control" role="tablist" aria-label="Star map mode">
        <button
          type="button"
          className={`segment-control__button ${mapMode === 'local' ? 'is-active' : ''}`}
          aria-pressed={mapMode === 'local'}
          onClick={() => setMapMode('local')}
        >
          Local Map
        </button>
        <button
          type="button"
          className={`segment-control__button ${mapMode === 'galaxy' ? 'is-active' : ''}`}
          aria-pressed={mapMode === 'galaxy'}
          onClick={() => setMapMode('galaxy')}
        >
          Galaxy Map
        </button>
      </div>
      {mapMode === 'local' ? (
        <div className="star-map" role="img" aria-label={`Map of stars around ${universe.currentSystem}`}>
          <svg viewBox="-110 -110 220 220" aria-hidden="true">
            {/* The inner ring reflects current jump fuel, while the outer ring shows the ship's theoretical maximum range. */}
            <circle className="star-map__range" cx="0" cy="0" r={(currentFuel / 0.4) * MAP_SCALE} />
            <circle className="star-map__range star-map__range--max" cx="0" cy="0" r={MAX_JUMP_RANGE} />
            {starPoints.map((star) => (
              <g
                key={star.name}
                transform={`translate(${star.x} ${star.y})`}
                className={`star-map__point ${star.isCurrent ? 'is-current' : ''} ${selectedSystem === star.name ? 'is-selected' : ''} ${star.inRange ? 'is-in-range' : 'is-out-of-range'}`}
                onClick={() => {
                  // Selecting the current system returns the map to its neutral
                  // "no destination" state, which doubles as the undock mode.
                  setSelectedSystem(star.isCurrent ? null : star.name);
                }}
              >
                {!star.isCurrent ? <circle className="star-map__target" r="9" /> : null}
                <circle className={`star-map__star ${star.isCurrent ? 'is-current' : ''}`} r={star.isCurrent ? 4 : 3} />
                <text className="star-map__label" y={star.isCurrent ? -8 : -6} textAnchor="middle">
                  {star.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      ) : (
        <div className="star-map star-map--galaxy" role="img" aria-label={`Galaxy map with current position at ${universe.currentSystem}`}>
          <svg
            viewBox={`${-GALAXY_MAP_PADDING} ${-GALAXY_MAP_PADDING} ${GALAXY_MAP_WIDTH + GALAXY_MAP_PADDING * 2} ${GALAXY_MAP_HEIGHT + GALAXY_MAP_PADDING * 2}`}
            aria-hidden="true"
          >
            {/* The galaxy overview is intentionally read-only so travel still happens from the detailed local chart. */}
            {galaxyPoints.map((star) => (
              <circle
                key={star.name}
                className={`star-map__galaxy-star ${star.isCurrent ? 'is-current' : ''}`}
                cx={star.x}
                cy={star.y}
                r={star.isCurrent ? 2.8 : 1.3}
                onClick={() => {
                  if (star.isCurrent) {
                    setSelectedSystem(null);
                  }
                }}
              />
            ))}
          </svg>
        </div>
      )}
      <div className="star-map__actions">
        <p>
          Fuel: <strong>{formatLightYears(currentFuel)}</strong>
          {' / '}
          <strong>{formatLightYears(MAX_FUEL)}</strong>
        </p>
        {mapMode === 'galaxy' ? <p className="star-map__hint">Galaxy map is informational only. Use Local Map to pick a destination.</p> : null}
        <button type="button" disabled={missingFuelUnits < 1} onClick={() => buyFuel(missingFuelUnits)}>
          Fill Fuel to Full
        </button>
      </div>
      {mapMode === 'local' ? (
        <div className="star-map__actions">
          <p>
            {showingCurrentSystem ? (
              <>
                Current system: <strong>{detailsSystemName}</strong>
              </>
            ) : (
              <>
                Selected destination: <strong>{detailsSystemName}</strong>
              </>
            )}
          </p>
          {!showingCurrentSystem ? (
            <p>
              Distance: <strong>{selectedDistance !== null ? formatLightYears(selectedDistance) : 'Unknown'}</strong>
              {' · '}
              Fuel after jump: <strong>{fuelAfterJump !== null ? formatLightYears(fuelAfterJump) : 'Unknown'}</strong>
            </p>
          ) : null}
          {detailsSystemFacts ? (
            <dl className="detail-grid star-map__details">
              <dt>Economy</dt>
              <dd>{detailsSystemFacts.economy}</dd>
              <dt>Government</dt>
              <dd>{detailsSystemFacts.government}</dd>
              <dt>Tech Level</dt>
              <dd>{detailsSystemFacts.techLevel}</dd>
              <dt>Population</dt>
              <dd>{detailsSystemFacts.population}</dd>
              <dt>Productivity</dt>
              <dd>{detailsSystemFacts.productivity}</dd>
              <dt>Average Radius</dt>
              <dd>{detailsSystemFacts.averageRadius}</dd>
              <dt>Species</dt>
              <dd>{detailsSystemFacts.species}</dd>
            </dl>
          ) : null}
          <button
            type="button"
            disabled={!showingCurrentSystem && !selectedPoint?.inRange}
            onClick={() => {
              if (beginTravel(detailsSystemName)) {
                navigate('/travel');
              }
            }}
          >
            {showingCurrentSystem ? 'Undock' : `Travel to ${detailsSystemName}`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
