export type CommodityUnit = 't' | 'kg' | 'g';

export interface Commodity {
  key: string;
  name: string;
  basePrice: number;
  gradient: number;
  baseQuantity: number;
  mask: number;
  unit: CommodityUnit;
}

export interface MarketCommodity extends Commodity {
  price: number;
  quantity: number;
}

export interface DockedMarketSession {
  systemName: string;
  economy: number;
  fluctuation: number;
  baseline: MarketCommodity[];
  localQuantities: Record<string, number>;
}

export const COMMODITIES: Commodity[] = [
  { key: 'food', name: 'Food', basePrice: 0x13, gradient: -0x02, baseQuantity: 0x06, mask: 0x01, unit: 't' },
  { key: 'textiles', name: 'Textiles', basePrice: 0x14, gradient: -0x01, baseQuantity: 0x0a, mask: 0x03, unit: 't' },
  { key: 'radioactives', name: 'Radioactives', basePrice: 0x41, gradient: -0x03, baseQuantity: 0x02, mask: 0x07, unit: 't' },
  { key: 'slaves', name: 'Slaves', basePrice: 0x28, gradient: -0x05, baseQuantity: 0xe2, mask: 0x1f, unit: 't' },
  { key: 'liquorWines', name: 'Liquor/Wines', basePrice: 0x53, gradient: -0x05, baseQuantity: 0xfb, mask: 0x0f, unit: 't' },
  { key: 'luxuries', name: 'Luxuries', basePrice: 0xc4, gradient: 0x08, baseQuantity: 0x36, mask: 0x03, unit: 't' },
  { key: 'narcotics', name: 'Narcotics', basePrice: 0xeb, gradient: 0x1d, baseQuantity: 0x08, mask: 0x78, unit: 't' },
  { key: 'computers', name: 'Computers', basePrice: 0x9a, gradient: 0x0e, baseQuantity: 0x38, mask: 0x03, unit: 't' },
  { key: 'machinery', name: 'Machinery', basePrice: 0x75, gradient: 0x06, baseQuantity: 0x28, mask: 0x07, unit: 't' },
  { key: 'alloys', name: 'Alloys', basePrice: 0x4e, gradient: 0x01, baseQuantity: 0x11, mask: 0x1f, unit: 't' },
  { key: 'firearms', name: 'Firearms', basePrice: 0x7c, gradient: 0x0d, baseQuantity: 0x1d, mask: 0x07, unit: 't' },
  { key: 'furs', name: 'Furs', basePrice: 0xb0, gradient: -0x09, baseQuantity: 0xdc, mask: 0x3f, unit: 't' },
  { key: 'minerals', name: 'Minerals', basePrice: 0x20, gradient: -0x01, baseQuantity: 0x35, mask: 0x03, unit: 't' },
  { key: 'gold', name: 'Gold', basePrice: 0x61, gradient: -0x01, baseQuantity: 0x42, mask: 0x07, unit: 'kg' },
  { key: 'platinum', name: 'Platinum', basePrice: 0xab, gradient: -0x02, baseQuantity: 0x37, mask: 0x1f, unit: 'kg' },
  { key: 'gemStones', name: 'Gem-Stones', basePrice: 0x2d, gradient: -0x01, baseQuantity: 0xfa, mask: 0x0f, unit: 'g' },
  { key: 'alienItems', name: 'Alien Items', basePrice: 0x35, gradient: 0x0f, baseQuantity: 0xc0, mask: 0x07, unit: 't' }
];

function wrap8(value: number): number {
  return value & 0xff;
}

export function generateMarket(systemEconomy: number, fluctByte: number): MarketCommodity[] {
  const economy = systemEconomy & 0xff;
  const fluct = fluctByte & 0xff;

  return COMMODITIES.map((commodity) => {
    const changing = fluct & commodity.mask;
    const product = economy * commodity.gradient;

    const quantityRaw = wrap8(commodity.baseQuantity + changing - product);
    const quantity = quantityRaw > 0x7f ? 0 : quantityRaw & 0x3f;

    const priceRaw = wrap8(commodity.basePrice + changing + product);
    const price = priceRaw * 4;

    return {
      ...commodity,
      quantity,
      price
    };
  });
}

export function cargoSpaceRequired(unit: CommodityUnit, amount: number): number {
  if (unit !== 't') {
    return 0;
  }

  return Math.max(0, Math.trunc(amount));
}

export function createDockedMarketSession(
  systemName: string,
  economy: number,
  fluctuation: number
): DockedMarketSession {
  const baseline = generateMarket(economy, fluctuation);
  const localQuantities = Object.fromEntries(baseline.map((item) => [item.key, item.quantity]));

  return {
    systemName,
    economy,
    fluctuation,
    baseline,
    localQuantities
  };
}

export function getSessionMarketItems(session: DockedMarketSession): MarketCommodity[] {
  return session.baseline.map((item) => ({
    ...item,
    quantity: session.localQuantities[item.key] ?? item.quantity
  }));
}

export function applyLocalMarketTrade(
  session: DockedMarketSession,
  commodityKey: string,
  deltaQuantity: number
): DockedMarketSession {
  const current = session.localQuantities[commodityKey] ?? 0;
  const next = Math.max(0, current + deltaQuantity);

  return {
    ...session,
    localQuantities: {
      ...session.localQuantities,
      [commodityKey]: next
    }
  };
}
