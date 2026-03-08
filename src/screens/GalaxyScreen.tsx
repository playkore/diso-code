import { useGameStore } from '../store/useGameStore';

const economyBySystem: Record<string, number> = {
  Leesti: 4,
  Diso: 2,
  Zaonce: 7,
  Reorte: 5
};

export function GalaxyScreen() {
  const universe = useGameStore((state) => state.universe);
  const dockAtSystem = useGameStore((state) => state.dockAtSystem);

  return (
    <section className="screen">
      <h2>Galaxy / System Chart</h2>
      <p>Current system: {universe.currentSystem}</p>
      <ul className="chip-list">
        {universe.nearbySystems.map((system) => (
          <li key={system}>
            <button
              type="button"
              onClick={() => dockAtSystem(system, economyBySystem[system] ?? 5, (universe.stardate + system.length) & 0xff)}
            >
              Dock {system}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
