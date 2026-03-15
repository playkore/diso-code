import { useEffect, useMemo, useState } from 'react';
import { getSystemChartCoordinates } from '../domain/localSystemCatalog';
import { useGameStore } from '../store/useGameStore';

interface StarPoint {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
  inRange: boolean;
}

const JUMP_RANGE = 72;

function getRelativePoint(currentSystem: string, targetSystem: string): StarPoint {
  const current = getSystemChartCoordinates(currentSystem);
  const target = getSystemChartCoordinates(targetSystem);
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);

  return {
    name: targetSystem,
    x: dx,
    y: dy,
    isCurrent: currentSystem === targetSystem,
    inRange: distance <= JUMP_RANGE
  };
}

export function StarMapScreen() {
  const universe = useGameStore((state) => state.universe);
  const dockAtSystem = useGameStore((state) => state.dockAtSystem);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSystem(null);
  }, [universe.currentSystem]);

  const starPoints = useMemo<StarPoint[]>(
    () => [
      getRelativePoint(universe.currentSystem, universe.currentSystem),
      ...universe.nearbySystems
        .filter((name) => name !== universe.currentSystem)
        .map((name) => getRelativePoint(universe.currentSystem, name))
    ],
    [universe.currentSystem, universe.nearbySystems]
  );

  const economyBySystem: Record<string, number> = {
    Leesti: 4,
    Diso: 2,
    Zaonce: 7,
    Reorte: 5
  };

  const selectedPoint = starPoints.find((star) => star.name === selectedSystem) ?? null;

  return (
    <section className="screen">
      <h2>Local Star Map</h2>
      <p>Select a nearby system, then confirm travel.</p>
      <div className="star-map" role="img" aria-label={`Map of stars around ${universe.currentSystem}`}>
        <svg viewBox="-110 -110 220 220" aria-hidden="true">
          <circle className="star-map__range" cx="0" cy="0" r={JUMP_RANGE} />
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
      {selectedSystem && selectedPoint ? (
        <div className="star-map__actions">
          <p>
            Selected destination: <strong>{selectedSystem}</strong>
          </p>
          {!selectedPoint.inRange ? <p className="status">This system is outside jump range.</p> : null}
          <button
            type="button"
            disabled={!selectedPoint.inRange}
            onClick={() =>
              dockAtSystem(
                selectedSystem,
                economyBySystem[selectedSystem] ?? 5,
                (universe.stardate + selectedSystem.length) & 0xff
              )
            }
          >
            Travel to {selectedSystem}
          </button>
        </div>
      ) : null}
    </section>
  );
}
