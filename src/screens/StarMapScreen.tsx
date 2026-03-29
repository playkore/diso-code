import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemByName, getSystemDistance, getVisibleSystems, getWrappedChartDelta } from '../domain/galaxyCatalog';
import { MAX_FUEL, getFuelUnits, getJumpFuelCost, getJumpFuelUnits } from '../domain/fuel';
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

export function StarMapScreen() {
  const navigate = useNavigate();
  const universe = useGameStore((state) => state.universe);
  const currentFuel = useGameStore((state) => state.commander.fuel);
  const buyFuel = useGameStore((state) => state.buyFuel);
  const beginTravel = useGameStore((state) => state.beginTravel);
  const selectedChartSystem = useGameStore((state) => state.ui.selectedChartSystem);
  const setSelectedChartSystem = useGameStore((state) => state.setSelectedChartSystem);

  const starPoints = useMemo<StarPoint[]>(
    () =>
      getVisibleSystems(universe.currentSystem, universe.galaxyIndex).map((system) =>
        getRelativePoint(universe.currentSystem, system.data.name, universe.galaxyIndex, currentFuel)
      ),
    [currentFuel, universe.currentSystem, universe.galaxyIndex]
  );
  const selectedPoint = starPoints.find((star) => star.name === selectedChartSystem) ?? null;
  const selectedDistance = selectedChartSystem ? getJumpFuelCost(getSystemDistance(universe.currentSystem, selectedChartSystem, universe.galaxyIndex)) : null;
  const fuelAfterJump = selectedDistance === null ? null : Math.max(0, currentFuel - selectedDistance);
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(currentFuel));
  const detailsSystemName = selectedChartSystem ?? universe.currentSystem;
  const showingCurrentSystem = selectedChartSystem === null;

  return (
    <section className="screen">
      <h2>Short-range Chart</h2>
      <p className="muted">Galaxy {universe.galaxyIndex + 1}</p>
      <div className="star-map" role="img" aria-label={`Map of stars around ${universe.currentSystem}`}>
        <svg viewBox="-110 -110 220 220" aria-hidden="true">
          {/* The inner ring reflects current jump fuel, while the outer ring shows the ship's theoretical maximum range. */}
          <circle className="star-map__range" cx="0" cy="0" r={(currentFuel / 0.4) * MAP_SCALE} />
          <circle className="star-map__range star-map__range--max" cx="0" cy="0" r={MAX_JUMP_RANGE} />
          {starPoints.map((star) => (
            <g
              key={star.name}
              transform={`translate(${star.x} ${star.y})`}
              className={`star-map__point ${star.isCurrent ? 'is-current' : ''} ${selectedChartSystem === star.name ? 'is-selected' : ''} ${star.inRange ? 'is-in-range' : 'is-out-of-range'}`}
              onClick={() => {
                // Selecting the current system returns the chart to its neutral
                // "no destination" state, which doubles as the undock mode.
                setSelectedChartSystem(star.isCurrent ? null : star.name);
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
      <div className="star-map__actions">
        <p>
          Fuel: <strong>{formatLightYears(currentFuel)}</strong>
          {' / '}
          <strong>{formatLightYears(MAX_FUEL)}</strong>
        </p>
        <button type="button" disabled={missingFuelUnits < 1} onClick={() => buyFuel(missingFuelUnits)}>
          Fill Fuel to Full
        </button>
      </div>
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
        <p className="star-map__hint">Use Galaxy Chart to choose distant systems and Data on System to inspect planetary details.</p>
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
    </section>
  );
}
