import { useGameStore } from '../store/useGameStore';

export function GalaxyScreen() {
  const universe = useGameStore((state) => state.universe);

  return (
    <section className="screen">
      <h2>Galaxy / System Chart</h2>
      <p>Current system: {universe.currentSystem}</p>
      <ul className="chip-list">
        {universe.nearbySystems.map((system) => (
          <li key={system}>{system}</li>
        ))}
      </ul>
    </section>
  );
}
