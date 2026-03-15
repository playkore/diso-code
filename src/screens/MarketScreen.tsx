import { cargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';

export function MarketScreen() {
  const market = useGameStore((state) => state.market);
  const commander = useGameStore((state) => state.commander);
  const buyCommodity = useGameStore((state) => state.buyCommodity);
  const sellCommodity = useGameStore((state) => state.sellCommodity);
  const cargoUsed = cargoUsedTonnes(commander.cargo);
  const freeCargo = commander.cargoCapacity - cargoUsed;

  return (
    <section className="screen">
      <h2>Market</h2>
      <p className="muted">Prices are locked for the current docked session.</p>
      <p className="status">
        Balance: {commander.cash} cr · Free cargo: {freeCargo} t
      </p>
      <ul className="card-list">
        {market.items.map((item) => {
          const owned = commander.cargo[item.key] ?? 0;
          const canBuyOne = item.quantity >= 1 && commander.cash >= item.price && (item.unit !== 't' || freeCargo > 0);
          const maxAffordableUnits = Math.floor(commander.cash / item.price);
          const maxCargoUnits = item.unit === 't' ? freeCargo : item.quantity;
          const buyMaxUnits = Math.min(item.quantity, maxAffordableUnits, maxCargoUnits);

          return (
            <li key={item.key} className="card-row market-row">
              <div className="market-row__headline">
                <strong>{item.name}</strong>
                <span>{item.price} cr</span>
              </div>
              <div className="market-row__meta">
                <span>
                  Market: {item.quantity} {item.unit}
                </span>
                <span>
                  You own: {owned} {item.unit}
                </span>
              </div>
              <div className="market-row__projection">
                <span>{canBuyOne ? `After buy 1: ${commander.cash - item.price} cr` : 'After buy 1: unavailable'}</span>
                <span>After sell 1: {commander.cash + item.price} cr</span>
              </div>
              <div className="button-group">
                <button type="button" onClick={() => buyCommodity(item.key, 1)} disabled={!canBuyOne}>
                  Buy 1
                </button>
                <button
                  type="button"
                  onClick={() => buyCommodity(item.key, buyMaxUnits)}
                  disabled={buyMaxUnits < 1}
                >
                  Buy Max
                </button>
                <button type="button" onClick={() => sellCommodity(item.key, 1)} disabled={owned < 1}>
                  Sell 1
                </button>
                <button type="button" onClick={() => sellCommodity(item.key, owned)} disabled={owned < 1}>
                  Sell All
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
