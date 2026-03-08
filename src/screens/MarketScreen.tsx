import { useGameStore } from '../store/useGameStore';

export function MarketScreen() {
  const market = useGameStore((state) => state.market);

  return (
    <section className="screen">
      <h2>Market</h2>
      <ul className="card-list">
        {market.items.map((item) => (
          <li key={item.id} className="card-row">
            <span>{item.name}</span>
            <span>{item.price} cr</span>
            <span>{item.stock} t</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
