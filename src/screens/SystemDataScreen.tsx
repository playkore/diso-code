import { getSystemByName } from '../domain/galaxyCatalog';
import { useGameStore } from '../store/useGameStore';

const ECONOMY_LABELS = [
  'Rich Industrial',
  'Average Industrial',
  'Poor Industrial',
  'Mainly Industrial',
  'Mainly Agricultural',
  'Rich Agricultural',
  'Average Agricultural',
  'Poor Agricultural'
] as const;

const GOVERNMENT_LABELS = [
  'Anarchy',
  'Feudal',
  'Multi-Government',
  'Dictatorship',
  'Communist',
  'Confederacy',
  'Democracy',
  'Corporate State'
] as const;

export function SystemDataScreen() {
  const universe = useGameStore((state) => state.universe);
  const system = getSystemByName(universe.currentSystem)?.data;

  if (!system) {
    return (
      <section className="screen">
        <h2>Data on System</h2>
        <p className="muted">System data unavailable.</p>
      </section>
    );
  }

  return (
    <section className="screen">
      <h2>Data on System</h2>
      <dl className="detail-grid">
        <dt>Name</dt>
        <dd>{system.name}</dd>
        <dt>Economy</dt>
        <dd>{ECONOMY_LABELS[system.economy] ?? 'Unknown'}</dd>
        <dt>Government</dt>
        <dd>{GOVERNMENT_LABELS[system.government] ?? 'Unknown'}</dd>
        <dt>Tech Level</dt>
        <dd>{system.techLevel}</dd>
        <dt>Population</dt>
        <dd>{system.population}</dd>
        <dt>Productivity</dt>
        <dd>{system.productivity} M CR</dd>
        <dt>Average Radius</dt>
        <dd>{system.radius} km</dd>
        <dt>Species</dt>
        <dd>{system.species}</dd>
        <dt>Chart Position</dt>
        <dd>
          {system.x}, {system.y >> 1}
        </dd>
      </dl>
    </section>
  );
}
