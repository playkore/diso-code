import { describe, expect, it } from 'vitest';
import { generateGalaxy, generateGalaxySeed, BASE_SEED } from '../universe';
import { generateSystemName } from '../systemName';
import { generateSystemData } from '../systemData';
import {
  cargoSpaceRequired,
  generateMarket,
  createDockedMarketSession,
  getSessionMarketItems,
  applyLocalMarketTrade
} from '../market';
import {
  applyMissionExternalEvent,
  getMissionMessagesForDocking,
  hasMissionFlag,
  TP_MISSION_FLAGS
} from '../missions';
import { createDefaultCommander } from '../commander';
import {
  decodeCommanderBinary256,
  encodeCommanderBinary256,
  loadCommanderJson,
  serializeCommanderJson
} from '../commanderPersistence';

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
    const galaxyOne = generateGalaxySeed(1);
    expect(galaxyOne).toEqual({ w0: 0xb494, w1: 0x0490, w2: 0x6fa6 });
  });
});

describe('system names and data', () => {
  it('builds expected name for the canonical base seed', () => {
    expect(generateSystemName({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 })).toBe('TIBEDIED');
  });

  it('builds deterministic derived values for the canonical base system', () => {
    const data = generateSystemData({ w0: 0x5a4a, w1: 0x0248, w2: 0xb753 });

    expect(data).toMatchObject({
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
});

describe('missions and commander persistence', () => {
  it('advances TP flags from external events', () => {
    const progressed = applyMissionExternalEvent(
      { tp: 0, variant: 'classic' },
      { type: 'combat:constrictor-destroyed' }
    );

    expect(hasMissionFlag(progressed.tp, 'constrictorBriefed')).toBe(true);
    expect(hasMissionFlag(progressed.tp, 'constrictorCompleted')).toBe(true);
  });

  it('generates mission debriefing messages', () => {
    const messages = getMissionMessagesForDocking({
      tp: TP_MISSION_FLAGS.thargoidPlansCompleted,
      variant: 'classic'
    });

    expect(messages.some((message) => message.id === 'thargoid-plans-debriefing')).toBe(true);
  });

  it('round-trips commander through JSON and binary saves', () => {
    const commander = createDefaultCommander();
    commander.cash = 2222;
    commander.missionTP = 7;

    const json = serializeCommanderJson(commander);
    const fromJson = loadCommanderJson(json);
    const binary = encodeCommanderBinary256(commander);
    const fromBinary = decodeCommanderBinary256(binary);

    expect(fromJson.cash).toBe(2222);
    expect(fromBinary.missionTP).toBe(7);
  });
});
