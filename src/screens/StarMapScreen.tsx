import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSystemByName, getSystemDistance, getVisibleSystems } from '../domain/galaxyCatalog';
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

// The map is centered on the current system. Y is halved to mimic the classic
// chart aspect ratio used by the original short-range star map.
function getRelativePoint(currentSystem: string, targetSystem: string, availableFuel: number): StarPoint {
  const current = getSystemByName(currentSystem)?.data;
  const target = getSystemByName(targetSystem)?.data;
  const dx = ((target?.x ?? 0) - (current?.x ?? 0)) * MAP_SCALE;
  const dy = ((((target?.y ?? 0) - (current?.y ?? 0)) / 2)) * MAP_SCALE;
  const distance = getSystemDistance(currentSystem, targetSystem);

  return {
    name: targetSystem,
    x: dx,
    y: dy,
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
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSystem(null);
  }, [universe.currentSystem]);

  const starPoints = useMemo<StarPoint[]>(
    () => getVisibleSystems(universe.currentSystem).map((system) => getRelativePoint(universe.currentSystem, system.data.name, currentFuel)),
    [currentFuel, universe.currentSystem]
  );

  const selectedPoint = starPoints.find((star) => star.name === selectedSystem) ?? null;
  const selectedDistance = selectedSystem ? getJumpFuelCost(getSystemDistance(universe.currentSystem, selectedSystem)) : null;
  const fuelAfterJump = selectedDistance === null ? null : Math.max(0, currentFuel - selectedDistance);
  const missingFuelUnits = Math.max(0, getFuelUnits(MAX_FUEL) - getFuelUnits(currentFuel));

  return (
    <section className="screen">
      <h2>Local Star Map</h2>
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
                if (!star.isCurrent) {
                  setSelectedSystem(star.name);
                }
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
      {selectedSystem && selectedPoint ? (
        <div className="star-map__actions">
          {/* Selection is explicit: the player chooses a destination first, then commits to travel from the details panel. */}
          <p>
            Selected destination: <strong>{selectedSystem}</strong>
          </p>
          <p>
            Distance: <strong>{selectedDistance !== null ? formatLightYears(selectedDistance) : 'Unknown'}</strong>
            {' · '}
            Fuel after jump: <strong>{fuelAfterJump !== null ? formatLightYears(fuelAfterJump) : 'Unknown'}</strong>
          </p>
          <button
            type="button"
            disabled={!selectedPoint.inRange}
            onClick={() => {
              if (beginTravel(selectedSystem)) {
                navigate('/travel');
              }
            }}
          >
            Travel to {selectedSystem}
          </button>
        </div>
      ) : null}
    </section>
  );
}
