import { describe, expect, it } from 'vitest';
import { applyLegalFloor, createDefaultCommander, getCargoBadness, getLegalStatus, normalizeCommanderState } from '../commander';
import { decodeCommanderBinary256, encodeCommanderBinary256, loadCommanderJson, serializeCommanderJson } from '../commanderPersistence';
import { getJumpFuelCost, getJumpFuelUnits, getRefuelCost } from '../fuel';
import { loadGameJson, serializeGameJson } from '../gamePersistence';
import { applyMissionExternalEvent, getMissionMessagesForDocking, hasMissionFlag, TP_MISSION_FLAGS } from '../missions';
import { createDockedMarketSession } from '../market';
import { PLAYER_SHIP } from '../shipCatalog';

describe('missions and commander persistence', () => {
  it('computes contraband badness and legal labels from numeric values', () => {
    expect(getCargoBadness({ slaves: 2, narcotics: 3, firearms: 5 })).toBe(15);
    expect(getLegalStatus(0)).toBe('clean');
    expect(getLegalStatus(10)).toBe('offender');
    expect(getLegalStatus(50)).toBe('fugitive');
  });

  it('applies contraband floor when normalizing commander state', () => {
    const normalized = normalizeCommanderState({
      ...createDefaultCommander(),
      legalValue: 0,
      cargo: { firearms: 8 }
    });
    expect(normalized.legalValue).toBe(8);
    expect(applyLegalFloor(3, { slaves: 4 })).toBe(8);
  });

  it('advances TP flags from external events', () => {
    const progressed = applyMissionExternalEvent({ tp: 0, variant: 'classic' }, { type: 'combat:constrictor-destroyed' });
    expect(hasMissionFlag(progressed.tp, 'constrictorBriefed')).toBe(true);
    expect(hasMissionFlag(progressed.tp, 'constrictorCompleted')).toBe(true);
  });

  it('generates mission debriefing messages', () => {
    const messages = getMissionMessagesForDocking({ tp: TP_MISSION_FLAGS.thargoidPlansCompleted, variant: 'classic' });
    expect(messages.some((message) => message.id === 'thargoid-plans-debriefing')).toBe(true);
  });

  it('round-trips commander through JSON and binary saves', () => {
    const commander = createDefaultCommander();
    commander.cash = 2222;
    commander.missionTP = 7;
    commander.installedEquipment.ecm = true;
    commander.laserMounts.rear = 'beam_laser';
    const json = serializeCommanderJson(commander);
    const fromJson = loadCommanderJson(json);
    const binary = encodeCommanderBinary256(commander);
    const fromBinary = decodeCommanderBinary256(binary);
    expect(fromJson.cash).toBe(2222);
    expect(fromJson.installedEquipment.ecm).toBe(true);
    expect(fromBinary.missionTP).toBe(7);
    expect(fromBinary.laserMounts.rear).toBe('beam_laser');
  });

  it('round-trips a full game snapshot through save slot JSON', () => {
    const commander = createDefaultCommander();
    const json = serializeGameJson(
      {
        commander,
        universe: {
          currentSystem: 'Lave',
          nearbySystems: ['Leesti'],
          stardate: 3124,
          economy: 5,
          marketFluctuation: 0
        },
        marketSession: createDockedMarketSession('Lave', 5, 0)
      },
      '2026-03-15T00:00:00.000Z'
    );
    const save = loadGameJson(json);
    expect(save.snapshot.commander.currentSystem).toBe('Lave');
    expect(save.snapshot.universe.stardate).toBe(3124);
    expect(save.savedAt).toBe('2026-03-15T00:00:00.000Z');
  });

  it('keeps independent save payloads for different slot snapshots', () => {
    const first = serializeGameJson(
      {
        commander: createDefaultCommander(),
        universe: { currentSystem: 'Lave', nearbySystems: ['Leesti'], stardate: 3124, economy: 5, marketFluctuation: 0 },
        marketSession: createDockedMarketSession('Lave', 5, 0)
      },
      '2026-03-15T00:00:00.000Z'
    );
    const secondCommander = createDefaultCommander();
    secondCommander.currentSystem = 'Diso';
    const second = serializeGameJson(
      {
        commander: secondCommander,
        universe: { currentSystem: 'Diso', nearbySystems: ['Lave'], stardate: 3125, economy: 0, marketFluctuation: 4 },
        marketSession: createDockedMarketSession('Diso', 0, 4)
      },
      '2026-03-16T00:00:00.000Z'
    );
    expect(loadGameJson(first).snapshot.commander.currentSystem).toBe('Lave');
    expect(loadGameJson(second).snapshot.commander.currentSystem).toBe('Diso');
  });

  it('uses tenths-of-a-light-year fuel costs', () => {
    expect(getJumpFuelCost(4.04)).toBe(4);
    expect(getJumpFuelUnits(4.04)).toBe(40);
    expect(getRefuelCost(10)).toBe(20);
  });

  it('migrates legacy equipment arrays into structured ship state', () => {
    const commander = normalizeCommanderState({
      name: 'Legacy',
      cash: 1500,
      fuel: 6.5,
      cargo: {},
      equipment: ['pulseLaser', 'cargoExpansion', 'ecm']
    });
    expect(commander.shipType).toBe('cobra_mk_iii');
    expect(commander.laserMounts.front).toBe('pulse_laser');
    expect(commander.installedEquipment.ecm).toBe(true);
    expect(commander.cargoCapacity).toBe(PLAYER_SHIP.maxCargoCapacity);
  });
});
