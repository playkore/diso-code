import { useState } from 'react';
import { cargoUsedTonnes } from '../domain/commander';
import type { MarketCommodity } from '../domain/market';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';

function formatMarketTablePrice(price: number) {
  return (price / 10).toFixed(1);
}

export function MarketScreen() {
  const market = useGameStore((state) => state.market);
  const commander = useGameStore((state) => state.commander);
  const buyCommodity = useGameStore((state) => state.buyCommodity);
  const sellCommodity = useGameStore((state) => state.sellCommodity);
  const [selectedCommodityKey, setSelectedCommodityKey] = useState<string | null>(null);
  const cargoUsed = cargoUsedTonnes(commander.cargo);
  const freeCargo = commander.cargoCapacity - cargoUsed;
  const selectedItem = selectedCommodityKey
    ? market.items.find((item) => item.key === selectedCommodityKey) ?? null
    : null;

  return (
    <section className="screen">
      {/* A real table keeps every column aligned while still exposing each
          commodity row as the trade-dialog trigger. */}
      <div className="market-table-wrap">
        <table className="market-table">
          <thead>
            <tr>
              <th scope="col">Commodity</th>
              <th scope="col">Price</th>
              <th scope="col">Market</th>
              <th scope="col">Cargo</th>
            </tr>
          </thead>
          <tbody>
            {market.items.map((item) => {
              const owned = commander.cargo[item.key] ?? 0;

              return (
                <tr
                  key={item.key}
                  className="market-table__row"
                  onClick={() => setSelectedCommodityKey(item.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedCommodityKey(item.key);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-haspopup="dialog"
                >
                  <th scope="row" className="market-table__name">
                    {item.name}
                  </th>
                  {/* The table omits the credit suffix so the numeric column can
                      stay compact without truncating prices like 18.8 Cr. */}
                  <td className="market-table__price">{formatMarketTablePrice(item.price)}</td>
                  <td className="market-table__metric">{item.quantity}</td>
                  <td className="market-table__metric">{owned}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectedItem ? (
        <CommodityTradeDialog
          availableCargo={freeCargo}
          cash={commander.cash}
          owned={commander.cargo[selectedItem.key] ?? 0}
          onBuy={buyCommodity}
          onClose={() => setSelectedCommodityKey(null)}
          onSell={sellCommodity}
          item={selectedItem}
        />
      ) : null}
    </section>
  );
}

interface CommodityTradeDialogProps {
  availableCargo: number;
  cash: number;
  item: MarketCommodity;
  onBuy: (commodityKey: string, amount: number) => void;
  onClose: () => void;
  onSell: (commodityKey: string, amount: number) => void;
  owned: number;
}

function CommodityTradeDialog({
  availableCargo,
  cash,
  item,
  onBuy,
  onClose,
  onSell,
  owned
}: CommodityTradeDialogProps) {
  const canBuyOne = item.quantity >= 1 && cash >= item.price && (item.unit !== 't' || availableCargo > 0);
  const maxAffordableUnits = Math.floor(cash / item.price);
  const maxCargoUnits = item.unit === 't' ? availableCargo : item.quantity;
  // Max buy mirrors the trade-slice rules so the dialog never offers a button
  // that would obviously fail due to cash, stock, or tonne cargo constraints.
  const buyMaxUnits = Math.min(item.quantity, maxAffordableUnits, maxCargoUnits);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`commodity-trade-title-${item.key}`}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="dialog-kicker">Commodity Trade</p>
        <h3 id={`commodity-trade-title-${item.key}`}>{item.name}</h3>
        <dl className="detail-grid market-dialog__details">
          <dt>Price</dt>
          <dd>{formatCredits(item.price)}</dd>
          <dt>Available</dt>
          <dd>
            {item.quantity} {item.unit}
          </dd>
          <dt>Owned</dt>
          <dd>
            {owned} {item.unit}
          </dd>
          <dt>Cash</dt>
          <dd>{formatCredits(cash)}</dd>
          {item.unit === 't' ? (
            <>
              <dt>Free Hold</dt>
              <dd>{availableCargo} t</dd>
            </>
          ) : null}
        </dl>
        <div className="button-group market-dialog__actions">
          <button type="button" onClick={() => onBuy(item.key, 1)} disabled={!canBuyOne}>
            Buy 1
          </button>
          <button type="button" onClick={() => onBuy(item.key, buyMaxUnits)} disabled={buyMaxUnits < 1}>
            Buy Max
          </button>
          <button type="button" onClick={() => onSell(item.key, 1)} disabled={owned < 1}>
            Sell 1
          </button>
          <button type="button" onClick={() => onSell(item.key, owned)} disabled={owned < 1}>
            Sell All
          </button>
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
