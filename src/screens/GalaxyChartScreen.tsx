import { useMemo } from 'react';
import { getGalaxySystems } from '../domain/galaxyCatalog';
import { useGameStore } from '../store/useGameStore';

interface GalaxyPoint {
  name: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

const GALAXY_MAP_WIDTH = 260;
const GALAXY_MAP_HEIGHT = 132;
const GALAXY_MAP_PADDING = 4;

function getGalaxyPoint(targetSystem: string, currentSystem: string, galaxyIndex: number): GalaxyPoint {
  const target = getGalaxySystems(galaxyIndex).find((system) => system.data.name === targetSystem)?.data;
  return {
    name: targetSystem,
    // The galaxy overview mirrors the classic long-range chart by using raw
    // generated coordinates instead of the centered local-chart projection.
    x: target?.x ?? 0,
    y: (target?.y ?? 0) / 2,
    isCurrent: targetSystem === currentSystem
  };
}

export function GalaxyChartScreen() {
  const universe = useGameStore((state) => state.universe);
  const selectedChartSystem = useGameStore((state) => state.ui.selectedChartSystem);
  const setSelectedChartSystem = useGameStore((state) => state.setSelectedChartSystem);
  const galaxyPoints = useMemo(
    () => getGalaxySystems(universe.galaxyIndex).map((system) => getGalaxyPoint(system.data.name, universe.currentSystem, universe.galaxyIndex)),
    [universe.currentSystem, universe.galaxyIndex]
  );
  const detailsSystemName = selectedChartSystem ?? universe.currentSystem;

  return (
    <section className="screen">
      <h2>Galaxy Chart</h2>
      <p className="muted">Galaxy {universe.galaxyIndex + 1}</p>
      <div className="star-map star-map--galaxy" role="img" aria-label={`Galaxy chart centred on ${universe.currentSystem}`}>
        <svg
          viewBox={`${-GALAXY_MAP_PADDING} ${-GALAXY_MAP_PADDING} ${GALAXY_MAP_WIDTH + GALAXY_MAP_PADDING * 2} ${GALAXY_MAP_HEIGHT + GALAXY_MAP_PADDING * 2}`}
          aria-hidden="true"
        >
          {galaxyPoints.map((star) => (
            <circle
              key={star.name}
              className={`star-map__galaxy-star ${star.isCurrent ? 'is-current' : ''} ${selectedChartSystem === star.name ? 'is-selected' : ''}`}
              cx={star.x}
              cy={star.y}
              r={star.isCurrent ? 2.8 : 1.3}
              onClick={() => setSelectedChartSystem(star.isCurrent ? null : star.name)}
            />
          ))}
        </svg>
      </div>
      <div className="star-map__actions">
        <p>
          Selected system: <strong>{detailsSystemName}</strong>
        </p>
        <p className="star-map__hint">Use Data on System for full planetary details. Travel still launches from Short-range Chart.</p>
      </div>
    </section>
  );
}
