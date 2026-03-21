import { describe, expect, it } from 'vitest';
import { generateGalaxy, generateGalaxySeed, BASE_SEED } from '../universe';
import { generateSystemName } from '../systemName';
import { generateSystemData } from '../systemData';
import { applyLocalMarketTrade, cargoSpaceRequired, createDockedMarketSession, generateMarket, getSessionMarketItems } from '../market';
import { getLaserOffersForSystem, getAvailableEquipmentForSystem, isMissileAvailableAtTechLevel } from '../outfitting';
import { createDefaultCommander } from '../commander';

describe('universe generation', () => {
  it('keeps canonical base seed', () => {
    expect(BASE_SEED).toEqual({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });
  });

  it('generates deterministic first systems in galaxy 0', () => {
    const systems = generateGalaxy(0);
    expect(systems).toHaveLength(256);
    expect(systems[0].seed).toEqual({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });
    expect(systems[1].seed).toEqual({ w0: 0xcd80, w1: 0x98b8, w2: 0x7a1d });
  });

  it('applies galaxy transform per galaxy index', () => {
    expect(generateGalaxySeed(1)).toEqual({ w0: 0xb494, w1: 0x0490, w2: 0x6fa6 });
  });
});

describe('system names and data', () => {
  it('builds expected name for the canonical base seed', () => {
    expect(generateSystemName({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 })).toBe('TIBEDIED');
  });

  it('builds deterministic derived values for the canonical base system', () => {
    expect(generateSystemData({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 })).toMatchObject({
      name: 'Tibedied',
      x: 0x02,
      y: 0x5a,
      economy: 2,
      government: 1,
      techLevel: 8,
      population: 36,
      productivity: 11520,
      radius: 4698,
      species: 'Human Colonials'
    });
  });
});

describe('market generation', () => {
  it('builds deterministic market values with wrapping rules', () => {
    const market = generateMarket(5, 0);
    expect(market[0]).toMatchObject({ key: 'food', quantity: 16, price: 36 });
    expect(market[5]).toMatchObject({ key: 'luxuries', quantity: 14, price: 944 });
    expect(market[13]).toMatchObject({ key: 'gold', quantity: 7, price: 368 });
    expect(market[16]).toMatchObject({ key: 'alienItems', quantity: 53, price: 512 });
  });

  it('only uses hold space for tonne cargo', () => {
    expect(cargoSpaceRequired('t', 4.8)).toBe(4);
    expect(cargoSpaceRequired('kg', 999)).toBe(0);
    expect(cargoSpaceRequired('g', 10000)).toBe(0);
  });

  it('keeps price stable in docked sessions and only mutates local quantity', () => {
    const session = createDockedMarketSession('Lave', 5, 0);
    const before = getSessionMarketItems(session).find((entry) => entry.key === 'food');
    const tradedSession = applyLocalMarketTrade(session, 'food', -3);
    const after = getSessionMarketItems(tradedSession).find((entry) => entry.key === 'food');
    expect(before?.price).toBe(after?.price);
    expect(after?.quantity).toBe((before?.quantity ?? 0) - 3);
  });

  it('omits tech-locked outfitting offers from system markets', () => {
    const commander = createDefaultCommander();
    const equipmentOffers = getAvailableEquipmentForSystem(1, commander);
    const laserOffers = getLaserOffersForSystem(1, commander, 'front');
    expect(equipmentOffers.every((offer) => offer.requiredTechLevel <= 1)).toBe(true);
    expect(laserOffers.every((offer) => offer.requiredTechLevel <= 1)).toBe(true);
    expect(isMissileAvailableAtTechLevel(0)).toBe(false);
    expect(isMissileAvailableAtTechLevel(1)).toBe(true);
  });
});
