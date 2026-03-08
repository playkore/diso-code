import { useGameStore } from '../store/useGameStore';

export function SystemDataScreen() {
  const universe = useGameStore((state) => state.universe);

  return (
    <section className="screen">
      <h2>Data on System</h2>
      <p>
        {universe.currentSystem} is a high-tech democracy with stable trade lanes and stardate{' '}
        {universe.stardate}.
      </p>
    </section>
  );
}
