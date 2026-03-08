import { useGameStore } from '../store/useGameStore';

export function SystemDataScreen() {
  const universe = useGameStore((state) => state.universe);

  return (
    <section className="screen">
      <h2>Data on System</h2>
      <p>
        {universe.currentSystem} economy index {universe.economy} with market fluctuation byte {universe.marketFluctuation}.
      </p>
      <p>Stardate {universe.stardate}.</p>
    </section>
  );
}
