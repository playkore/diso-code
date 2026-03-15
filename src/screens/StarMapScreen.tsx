import { useMemo } from 'react';
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

  const starPoints = useMemo<StarPoint[]>(
    () => [
      { name: universe.currentSystem, x: 0, y: 0, isCurrent: true },
      ...universe.nearbySystems.map((name, index) => createNearbyPoint(name, index))
    ],
    [universe.currentSystem, universe.nearbySystems]
  );

  return (
    <section className="screen">
      <h2>Local Star Map</h2>
      <p>Centered on {universe.currentSystem}</p>
      <div className="star-map" role="img" aria-label={`Map of stars around ${universe.currentSystem}`}>
        <svg viewBox="-100 -100 200 200" aria-hidden="true">
          <circle className="star-map__range" cx="0" cy="0" r="72" />
          {starPoints.map((star) => (
            <g key={star.name} transform={`translate(${star.x} ${star.y})`}>
              <circle className={`star-map__star ${star.isCurrent ? 'is-current' : ''}`} r={star.isCurrent ? 4 : 3} />
              <text className="star-map__label" y={star.isCurrent ? -8 : -6} textAnchor="middle">
                {star.name}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
