import { useEffect, useMemo, useState } from 'react';
import { getSystemByName, getSystemDistance, getVisibleSystems } from '../domain/galaxyCatalog';
import { useGameStore } from '../store/useGameStore';

interface StarPoint {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
  inRange: boolean;
}

const MAP_SCALE = 4;
const JUMP_RANGE = (7 / 0.4) * MAP_SCALE;

function getRelativePoint(currentSystem: string, targetSystem: string): StarPoint {
  const current = getSystemByName(currentSystem)?.data;
  const target = getSystemByName(targetSystem)?.data;
  const dx = ((target?.x ?? 0) - (current?.x ?? 0)) * MAP_SCALE;
  const dy = ((((target?.y ?? 0) - (current?.y ?? 0)) / 2)) * MAP_SCALE;
  const distance = getSystemDistance(currentSystem, targetSystem) * (MAP_SCALE / 0.4);

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
    () => getVisibleSystems(universe.currentSystem).map((system) => getRelativePoint(universe.currentSystem, system.data.name)),
    [universe.currentSystem]
  );

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
          <button
            type="button"
            disabled={!selectedPoint.inRange}
            onClick={() =>
              dockAtSystem(
                selectedSystem,
                getSystemByName(selectedSystem)?.data.economy ?? universe.economy,
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
