import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../store/useGameStore';

interface StarPoint {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

function hashName(name: string): number {
  let hash = 2166136261;
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createNearbyPoint(name: string, order: number): StarPoint {
  const hash = hashName(name);
  const angle = ((hash % 360) * Math.PI) / 180;
  const radius = 42 + (hash % 28) + order * 2;

  return {
    name,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    isCurrent: false
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
      { name: universe.currentSystem, x: 0, y: 0, isCurrent: true },
      ...universe.nearbySystems
        .filter((name) => name !== universe.currentSystem)
        .map((name, index) => createNearbyPoint(name, index))
    ],
    [universe.currentSystem, universe.nearbySystems]
  );

  const economyBySystem: Record<string, number> = {
    Leesti: 4,
    Diso: 2,
    Zaonce: 7,
    Reorte: 5
  };

  return (
    <section className="screen">
      <h2>Local Star Map</h2>
      <p>Select a nearby system, then confirm travel.</p>
      <div className="star-map" role="img" aria-label={`Map of stars around ${universe.currentSystem}`}>
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle className="star-map__range" cx="0" cy="0" r="72" />
          {starPoints.map((star) => (
            <g
              key={star.name}
              transform={`translate(${star.x} ${star.y})`}
              className={`star-map__point ${star.isCurrent ? 'is-current' : ''} ${selectedSystem === star.name ? 'is-selected' : ''}`}
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
      {selectedSystem ? (
        <div className="star-map__actions">
          <p>
            Selected destination: <strong>{selectedSystem}</strong>
          </p>
          <button
            type="button"
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
