import { useGameStore } from '../store/useGameStore';

export function MarketScreen() {
  const market = useGameStore((state) => state.market);
  const buyCommodity = useGameStore((state) => state.buyCommodity);
  const sellCommodity = useGameStore((state) => state.sellCommodity);

  return (
    <section className="screen">
      <h2>Market</h2>
      <p className="muted">Prices are locked for the current docked session.</p>
      <ul className="card-list">
        {market.items.map((item) => (
          <li key={item.key} className="card-row">
            <span>{item.name}</span>
            <span>{item.price} cr</span>
            <span>{item.quantity} {item.unit}</span>
            <div className="button-group">
              <button type="button" onClick={() => buyCommodity(item.key, 1)}>
                Buy 1
              </button>
              <button type="button" onClick={() => sellCommodity(item.key, 1)}>
                Sell 1
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
