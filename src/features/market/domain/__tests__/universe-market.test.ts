import { describe, expect, it } from 'vitest';
import { generateGalaxy, generateGalaxySeed, BASE_SEED } from '../../../galaxy/domain/universe';
import { generateSystemName } from '../../../../shared/domain/systemName';
import { generateSystemData } from '../../../galaxy/domain/systemData';
import { applyLocalMarketTrade, cargoSpaceRequired, createDockedMarketSession, generateMarket, getSessionMarketItems } from '../market';
import { getLaserOffersForSystem, getAvailableEquipmentForSystem, isMissileAvailableAtTechLevel } from '../../../commander/domain/outfitting';
import { createDefaultCommander } from '../../../commander/domain/commander';

describe('universe generation', () => {
  it('keeps canonical base seed', () => {
    expect(BASE_SEED).toEqual({ w0: 0x1f2d, w1: 0x3b4a, w2: 0x6c7e });
  });

  it('generates deterministic first systems in galaxy 0', () => {
    const systems = generateGalaxy(0);
    expect(systems).toHaveLength(256);
    expect(systems[0].seed).toEqual({ w0: 0x1f2d, w1: 0x3b4a, w2: 0x6c7e });
    expect(systems[1].seed).toEqual({ w0: 0x6ebd, w1: 0xa230, w2: 0xd7e2 });
  });

  it('applies galaxy transform per galaxy index', () => {
    expect(generateGalaxySeed(1)).toEqual({ w0: 0x3e5a, w1: 0x7694, w2: 0xd8fc });
  });
});

describe('system names and data', () => {
  it('builds expected name for the canonical base seed', () => {
    expect(generateSystemName({ w0: 0x1f2d, w1: 0x3b4a, w2: 0x6c7e })).toBe('INBIRE');
  });

  it('builds deterministic derived values for the canonical base system', () => {
    expect(generateSystemData({ w0: 0x1f2d, w1: 0x3b4a, w2: 0x6c7e })).toMatchObject({
      name: 'Inbire',
      x: 0x3b,
      y: 0x1f,
      economy: 7,
      government: 1,
      techLevel: 4,
      population: 25,
      productivity: 3000,
      radius: 5919,
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
