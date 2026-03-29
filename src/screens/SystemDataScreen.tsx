import { getSystemByName } from '../domain/galaxyCatalog';
import { getSystemFacts } from '../domain/systemPresentation';
import { useGameStore } from '../store/useGameStore';

export function SystemDataScreen() {
  const universe = useGameStore((state) => state.universe);
  const system = getSystemByName(universe.currentSystem, universe.galaxyIndex)?.data;

  if (!system) {
    return (
      <section className="screen">
        <h2>Data on System</h2>
        <p className="muted">System data unavailable.</p>
      </section>
    );
  }

  // The dedicated system screen and the star-map selection panel intentionally
  // share one formatter so every place that surfaces procedural system metadata
  // uses the same wording and fallback behavior.
  const facts = getSystemFacts(system);

  return (
    <section className="screen">
      <h2>Data on System</h2>
      <dl className="detail-grid">
        <dt>Galaxy</dt>
        <dd>{universe.galaxyIndex + 1}</dd>
        <dt>Name</dt>
        <dd>{system.name}</dd>
        <dt>Economy</dt>
        <dd>{facts.economy}</dd>
        <dt>Government</dt>
        <dd>{facts.government}</dd>
        <dt>Tech Level</dt>
        <dd>{facts.techLevel}</dd>
        <dt>Population</dt>
        <dd>{facts.population}</dd>
        <dt>Productivity</dt>
        <dd>{facts.productivity}</dd>
        <dt>Average Radius</dt>
        <dd>{facts.averageRadius}</dd>
        <dt>Species</dt>
        <dd>{facts.species}</dd>
      </dl>
    </section>
  );
}
