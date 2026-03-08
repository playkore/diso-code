import { describe, expect, it } from 'vitest';
import { generateGalaxy, generateGalaxySeed, BASE_SEED } from '../universe';
import { generateSystemName } from '../systemName';
import { generateSystemData } from '../systemData';
import { cargoSpaceRequired, generateMarket } from '../market';

describe('universe generation', () => {
  it('keeps canonical base seed', () => {
    expect(BASE_SEED).toEqual({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });
  });

  it('generates deterministic first systems in galaxy 0', () => {
    const systems = generateGalaxy(0);
    expect(systems).toHaveLength(256);
    expect(systems[0].seed).toEqual({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });
    expect(systems[1].seed).toEqual({ w0: 0x6845, w1: 0x6f28, w2: 0xe5e8 });
  });

  it('applies galaxy transform per galaxy index', () => {
    const galaxyOne = generateGalaxySeed(1);
    expect(galaxyOne).toEqual({ w0: 0xb494, w1: 0x0490, w2: 0x6fa6 });
  });
});

describe('system names and data', () => {
  it('builds expected name for Lave seed', () => {
    expect(generateSystemName({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 })).toBe('LAVE');
  });

  it('builds deterministic derived values for Lave', () => {
    const data = generateSystemData({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });

    expect(data).toMatchObject({
      name: 'Lave',
      x: 0x02,
      y: 0x5a,
      economy: 5,
      government: 1,
      techLevel: 4,
      population: 23,
      productivity: 5520,
      radius: 41114,
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
    expect(market[16]).toMatchObject({ key: 'alienItems', quantity: 0, price: 448 });
  });

  it('only uses hold space for tonne cargo', () => {
    expect(cargoSpaceRequired('t', 4.8)).toBe(4);
    expect(cargoSpaceRequired('kg', 999)).toBe(0);
    expect(cargoSpaceRequired('g', 10000)).toBe(0);
  });
});
