import { describe, expect, it } from 'vitest';
import {
  applyLegalFloor,
  createDefaultCommander,
  getCargoBadness,
  getLegalStatus,
  getMissionCargoLegalBadness,
  missionCargoUsedTonnes,
  normalizeCommanderState
} from '../commander';
import { decodeCommanderBinary256, encodeCommanderBinary256, loadCommanderJson, serializeCommanderJson } from '../commanderPersistence';
import { getJumpFuelCost, getJumpFuelUnits, getRefuelCost } from '../fuel';
import { loadGameJson, serializeGameJson } from '../gamePersistence';
import { acceptMissionOffer, applyMissionEvent, generateMissionOffers, getMissionInbox, settleCompletedMissions } from '../missions';
import { createDockedMarketSession } from '../market';
import { createScenarioSnapshot } from '../scenarios';
import { PLAYER_SHIP } from '../shipCatalog';

describe('missions and commander persistence', () => {
  it('computes contraband badness and legal labels from numeric values', () => {
    expect(getCargoBadness({ slaves: 2, narcotics: 3, firearms: 5 })).toBe(15);
    expect(getLegalStatus(0)).toBe('clean');
    expect(getLegalStatus(10)).toBe('offender');
    expect(getLegalStatus(50)).toBe('fugitive');
  });

  it('accounts for mission cargo tonnage and legal badness', () => {
    const missionCargo = [
      { missionId: 'm1', key: 'dispatches', name: 'Dispatches', amount: 1, tonnagePerUnit: 0, legalBadnessPerUnit: 2, sellable: false, dumpable: false }
    ];
    expect(missionCargoUsedTonnes(missionCargo)).toBe(0);
    expect(getMissionCargoLegalBadness(missionCargo)).toBe(2);
    expect(applyLegalFloor(0, {}, missionCargo)).toBe(2);
  });

  it('accepts offers and generates inbox messages from mission state', () => {
    const offers = generateMissionOffers({ currentSystem: 'Lave', nearbySystems: ['Diso', 'Leesti', 'Zaonce'], stardate: 3124 });
    const accepted = acceptMissionOffer(offers[0]);
    const progressed = applyMissionEvent([accepted.mission], { type: 'travel:jump-completed', destinationSystem: accepted.mission.destinationSystem });
    const messages = getMissionInbox(progressed, { currentSystem: 'Lave' });
    expect(messages.some((message) => message.kind === 'reveal' || message.kind === 'briefing')).toBe(true);
  });

  it('settles completed missions into cash and history', () => {
    const offer = generateMissionOffers({ currentSystem: 'Lave', nearbySystems: ['Diso', 'Leesti', 'Zaonce'], stardate: 3124 })[0];
    const accepted = acceptMissionOffer(offer);
    const completed = applyMissionEvent([accepted.mission], { type: 'mission:cargo-delivered', missionId: accepted.mission.id, systemName: accepted.mission.destinationSystem });
    const settlement = settleCompletedMissions(completed, []);
    expect(settlement.cashDelta).toBe(offer.reward);
    expect(settlement.completedMissions[0]?.outcome).toBe('completed');
  });

  it('round-trips commander through JSON and binary saves', () => {
    const commander = createDefaultCommander();
    commander.cash = 2222;
    commander.installedEquipment.ecm = true;
    commander.installedEquipment.shield_generator = true;
    commander.installedEquipment.energy_box_2 = true;
    commander.energyBanks = 2;
    commander.laserMounts.rear = 'beam_laser';
    const accepted = acceptMissionOffer(generateMissionOffers({ currentSystem: 'Lave', nearbySystems: ['Diso', 'Leesti', 'Zaonce'], stardate: 3124 })[0]);
    commander.activeMissions = [accepted.mission];
    commander.missionCargo = accepted.missionCargo;
    const json = serializeCommanderJson(commander);
    const fromJson = loadCommanderJson(json);
    const binary = encodeCommanderBinary256(commander);
    const fromBinary = decodeCommanderBinary256(binary);
    expect(fromJson.cash).toBe(2222);
    expect(fromJson.installedEquipment.ecm).toBe(true);
    expect(fromJson.installedEquipment.shield_generator).toBe(true);
    expect(fromJson.activeMissions).toHaveLength(1);
    expect(fromBinary.activeMissions).toEqual([]);
    expect(fromBinary.missionCargo).toEqual([]);
    expect(fromBinary.laserMounts.rear).toBe('beam_laser');
    expect(fromBinary.energyBanks).toBe(2);
    expect(fromBinary.installedEquipment.shield_generator).toBe(true);
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
        marketSession: createDockedMarketSession('Lave', 5, 0),
        scenario: createScenarioSnapshot({ currentSystem: 'Lave' })
      },
      '2026-03-15T00:00:00.000Z'
    );
    const save = loadGameJson(json);
    expect(save.snapshot.commander.currentSystem).toBe('Lave');
    expect(save.snapshot.universe.stardate).toBe(3124);
    expect(save.snapshot.scenario?.activePluginId).toBe('secret-packages-20');
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
