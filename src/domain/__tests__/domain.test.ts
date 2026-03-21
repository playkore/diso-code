import { beforeEach, describe, expect, it } from 'vitest';
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
import { getLaserOffersForSystem, isMissileAvailableAtTechLevel } from '../outfitting';
import {
  applyMissionExternalEvent,
  getMissionMessagesForDocking,
  hasMissionFlag,
  TP_MISSION_FLAGS
} from '../missions';
import { applyLegalFloor, createDefaultCommander, getCargoBadness, getLegalStatus, normalizeCommanderState } from '../commander';
import { getJumpFuelCost, getJumpFuelUnits, getRefuelCost } from '../fuel';
import { canBuyEquipment, canBuyMissile, canInstallLaser, getAvailableEquipmentForSystem } from '../outfitting';
import {
  decodeCommanderBinary256,
  encodeCommanderBinary256,
  loadCommanderJson,
  serializeCommanderJson
} from '../commanderPersistence';
import { loadGameJson, serializeGameJson } from '../gamePersistence';
import { PLAYER_SHIP } from '../shipCatalog';
import { useGameStore } from '../../store/useGameStore';
import { getSystemDistance } from '../galaxyCatalog';
import {
  assessDockingApproach,
  canEnemyLaserFireByCnt,
  canEnemyLaserHitByCnt,
  consumeEscapePod,
  createDeterministicRandomSource,
  createTravelCombatState,
  enterArrivalSpace,
  getPlayerCombatSnapshot,
  getBlueprintAvailability,
  getAvailablePackHunters,
  getStationSlotAngle,
  selectBlueprintFile,
  stepTravelCombat
} from '../travelCombat';

function createCombatState(
  bytes: number[],
  overrides: Partial<Parameters<typeof createTravelCombatState>[0]> = {}
) {
  const commander = createDefaultCommander();
  return createTravelCombatState(
    {
      legalValue: 0,
      government: 0,
      techLevel: 7,
      missionTP: 0,
      missionVariant: 'classic',
      laserMounts: commander.laserMounts,
      installedEquipment: commander.installedEquipment,
      missilesInstalled: commander.missilesInstalled,
      ...overrides
    },
    createDeterministicRandomSource(bytes)
  );
}

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
    const secondCommander = createDefaultCommander();
    secondCommander.currentSystem = 'Diso';
    const second = serializeGameJson(
      {
        commander: secondCommander,
        universe: {
          currentSystem: 'Diso',
          nearbySystems: ['Lave'],
          stardate: 3125,
          economy: 0,
          marketFluctuation: 4
        },
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

describe('outfitting rules', () => {
  it('gates equipment by tech level and install state', () => {
    const commander = createDefaultCommander();
    commander.cash = 20000;
    const lowTechOffers = getAvailableEquipmentForSystem(2, commander);
    const highTechOffers = getAvailableEquipmentForSystem(10, commander);

    expect(lowTechOffers.find((offer) => offer.id === 'docking_computer')).toBeUndefined();
    expect(highTechOffers.find((offer) => offer.id === 'docking_computer')?.available).toBe(true);
  });

  it('enforces purchase and mount constraints for outfitting', () => {
    const commander = createDefaultCommander();
    commander.cash = 20000;

    expect(canBuyEquipment(commander, 2, 'ecm').ok).toBe(true);
    expect(canBuyEquipment(commander, 1, 'ecm').ok).toBe(false);
    expect(canInstallLaser(commander, 4, 'rear', 'beam_laser').ok).toBe(true);
    expect(canInstallLaser(commander, 2, 'rear', 'beam_laser').ok).toBe(false);
    commander.cash = 2000;
    expect(canBuyMissile(commander, 1).ok).toBe(false);
  });
});

describe('outfitting store flows', () => {
  beforeEach(() => {
    const commander = normalizeCommanderState(createDefaultCommander());
    useGameStore.setState((state) => ({
      ...state,
      commander,
      universe: {
        ...state.universe,
        currentSystem: commander.currentSystem,
        nearbySystems: ['Diso'],
        stardate: 3124,
        economy: 5,
        marketFluctuation: 0
      },
      travelSession: null
    }));
  });

  it('buys equipment, lasers, and missiles with store-side checks', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        cash: 120000
      }),
      universe: {
        ...state.universe,
        currentSystem: 'Lave'
      }
    }));

    useGameStore.getState().buyEquipment('large_cargo_bay');
    expect(useGameStore.getState().commander.cargoCapacity).toBe(35);

    useGameStore.getState().buyLaser('rear', 'beam_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBe('beam_laser');

    useGameStore.getState().buyMissile();
    expect(useGameStore.getState().commander.missilesInstalled).toBe(1);
  });

  it('adds debug credits from settings helpers', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Lave',
        cash: 100
      }),
      universe: {
        ...state.universe,
        currentSystem: 'Lave'
      }
    }));

    useGameStore.getState().grantDebugCredits(100000);
    expect(useGameStore.getState().commander.cash).toBe(100100);
  });

  it('rejects low-tech and duplicate outfitting purchases', () => {
    useGameStore.setState((state) => ({
      ...state,
      commander: normalizeCommanderState({
        ...createDefaultCommander(),
        currentSystem: 'Zaonce',
        cash: 20000,
        installedEquipment: {
          ...createDefaultCommander().installedEquipment,
          ecm: true
        }
      }),
      universe: {
        ...state.universe,
        currentSystem: 'Zaonce'
      }
    }));

    useGameStore.getState().buyEquipment('ecm');
    expect(useGameStore.getState().commander.installedEquipment.ecm).toBe(true);

    useGameStore.getState().buyLaser('rear', 'military_laser');
    expect(useGameStore.getState().commander.laserMounts.rear).toBeNull();
  });

  it('lets the player redock at the origin without spending fuel', () => {
    const startingFuel = useGameStore.getState().commander.fuel;

    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({
      dockSystemName: 'Lave',
      spendJumpFuel: false
    });

    expect(useGameStore.getState().commander.currentSystem).toBe('Lave');
    expect(useGameStore.getState().commander.fuel).toBe(startingFuel);
  });

  it('spends fuel only after docking in the destination system', () => {
    const startingFuel = useGameStore.getState().commander.fuel;
    const expectedFuel = startingFuel - getJumpFuelCost(getSystemDistance('Lave', 'Diso'));

    expect(useGameStore.getState().beginTravel('Diso')).toBe(true);
    useGameStore.getState().completeTravel({
      dockSystemName: 'Diso',
      spendJumpFuel: true
    });

    expect(useGameStore.getState().commander.currentSystem).toBe('Diso');
    expect(useGameStore.getState().commander.fuel).toBe(expectedFuel);
  });
});

describe('travel combat rules', () => {
  it('selects blueprint files from system danger and mission state', () => {
    expect(selectBlueprintFile({ government: 0, techLevel: 7, missionTP: 0, witchspace: false, randomByte: 0 })).toBe('E');
    expect(selectBlueprintFile({ government: 7, techLevel: 12, missionTP: 0, witchspace: false, randomByte: 6 })).toBe('L');
    expect(selectBlueprintFile({ government: 4, techLevel: 8, missionTP: TP_MISSION_FLAGS.thargoidPlansBriefed, witchspace: false, randomByte: 1 })).toBe('D');
  });

  it('keeps pack-hunter availability tied to the active blueprint file', () => {
    expect(getBlueprintAvailability('E')).toContain('cobra-mk3-pirate');
    expect(getAvailablePackHunters('A')).toEqual(['sidewinder', 'mamba']);
  });

  it('uses EV gating to delay dangerous spawns until the rare timer expires', () => {
    const rng = createDeterministicRandomSource([0, 255, 255, 255, 255, 255]);
    const state = createCombatState([0, 255, 255, 255, 255, 255]);
    state.encounter.ev = 1;

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.roles.hostile || enemy.roles.pirate || enemy.missionTag)).toBe(false);

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', {}, rng);
    expect(state.enemies.length).toBeGreaterThan(0);
  });

  it('spawns cops more readily when cargo badness is present', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0], { government: 7, techLevel: 12 });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', { narcotics: 10 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(true);
  });

  it('places hyperspace arrivals well outside the station safe zone', () => {
    const rng = createDeterministicRandomSource([128, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);

    enterArrivalSpace(state, rng);

    expect(state.station).not.toBeNull();
    expect(Math.hypot(state.player.x - state.station!.x, state.player.y - state.station!.y)).toBeGreaterThan(state.station!.safeZoneRadius);
    expect(state.player.angle).toBe(-Math.PI / 2);
    expect(state.encounter.safeZone).toBe(false);
  });

  it('turns bounty hunters hostile at FIST 40 and suppresses pirate aggression in safe zones', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 40, government: 7, techLevel: 12 });

    state.enemies.push({
      id: 99,
      kind: 'ship',
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 100,
      maxEnergy: 150,
      laserPower: 5,
      missiles: 1,
      targetableArea: 280,
      laserRange: 380,
      topSpeed: 6,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 20,
      baseAggression: 20,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.enemies.push({
      id: 100,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      x: 120,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 50,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { pirate: true, hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'ARRIVED', {}, rng);
    expect(state.enemies[0].roles.hostile).toBe(true);
    expect(state.enemies[1].aggression).toBe(0);
  });

  it('uses documented CNT thresholds for enemy laser fire and hit gating', () => {
    expect(canEnemyLaserFireByCnt(-32)).toBe(true);
    expect(canEnemyLaserFireByCnt(-31)).toBe(false);
    expect(canEnemyLaserHitByCnt(-35)).toBe(true);
    expect(canEnemyLaserHitByCnt(-34)).toBe(false);
  });

  it('spawns thargons instead of missiles for thargoids', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0], { missionTP: TP_MISSION_FLAGS.thargoidPlansBriefed });
    state.enemies.push({
      id: 5,
      kind: 'ship',
      blueprintId: 'thargoid',
      label: 'Thargoid',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 180,
      maxEnergy: 180,
      laserPower: 4,
      missiles: 6,
      targetableArea: 330,
      laserRange: 380,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.055,
      roles: { hostile: true },
      aggression: 58,
      baseAggression: 58,
      fireCooldown: 999,
      missileCooldown: 0,
      isFiringLaser: false,
      missionTag: 'thargoid-plans'
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);
    expect(state.enemies.some((enemy) => enemy.kind === 'thargon')).toBe(true);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile')).toBe(false);
  });

  it('fires the installed laser in the active arc and respects empty arcs', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.laserMounts.left = 'beam_laser';
    const state = createCombatState([0, 0, 0, 0], { laserMounts: commander.laserMounts });
    state.enemies.push({
      id: 1,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      x: -120,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI / 2,
      energy: 70,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, rng);
    expect(state.lastPlayerArc).toBe('left');
    expect(state.projectiles[0]?.damage).toBe(16);

    state.projectiles = [];
    state.player.fireCooldown = 0;
    state.enemies[0].x = 120;
    state.enemies[0].y = 0;
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: true }, 1, 'PLAYING', {}, rng);
    expect(state.lastPlayerArc).toBe('right');
    expect(state.projectiles).toHaveLength(0);
  });

  it('uses ECM to clear missiles and suppresses further launches while active', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.ecm = true;
    const state = createCombatState([0, 0, 0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.projectiles.push({ id: 5, kind: 'missile', owner: 'enemy', x: 20, y: 0, vx: 0, vy: 0, damage: 22, life: 20 });
    state.enemies.push({
      id: 9,
      kind: 'ship',
      blueprintId: 'mamba',
      label: 'Mamba',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 90,
      maxEnergy: 90,
      laserPower: 2,
      missiles: 2,
      targetableArea: 220,
      laserRange: 320,
      topSpeed: 6,
      acceleration: 0.12,
      turnRate: 0.055,
      roles: { hostile: true, pirate: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 0,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, activateEcm: true }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile')).toBe(false);
    expect(state.encounter.ecmTimer).toBeGreaterThan(0);
  });

  it('destroys enemy missiles at the station safe-zone edge while the player is inside', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const state = createCombatState([0, 0, 0]);
    state.station = {
      x: 0,
      y: 0,
      radius: 80,
      angle: 0,
      rotSpeed: 0,
      safeZoneRadius: 360
    };
    state.player.x = 0;
    state.player.y = 0;
    state.player.shields = 70;
    state.player.rechargeRate = 0;
    state.projectiles.push({
      id: 7,
      kind: 'missile',
      owner: 'enemy',
      x: 361,
      y: 0,
      vx: -5,
      vy: 0,
      damage: 22,
      life: 100
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);

    expect(state.projectiles.some((projectile) => projectile.kind === 'missile' && projectile.owner === 'enemy')).toBe(false);
    expect(state.player.shields).toBe(70);
  });

  it('keeps hostile ships out of the station safe zone and prevents safe-zone laser hits', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.station = {
      x: 0,
      y: 0,
      radius: 80,
      angle: 0,
      rotSpeed: 0,
      safeZoneRadius: 360
    };
    state.player.x = 0;
    state.player.y = 0;
    state.player.shields = 70;
    state.player.rechargeRate = 0;
    state.enemies.push({
      id: 8,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      x: 355,
      y: 0,
      vx: -4,
      vy: 0,
      angle: Math.PI,
      energy: 70,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 400,
      topSpeed: 6.2,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { pirate: true, hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);

    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(377.5);
    expect(state.player.shields).toBe(70);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('keeps bounty hunters out of the station safe zone before they turn hostile', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0], { legalValue: 0 });
    state.station = {
      x: 0,
      y: 0,
      radius: 80,
      angle: 0,
      rotSpeed: 0,
      safeZoneRadius: 360
    };
    state.player.x = 0;
    state.player.y = 0;
    state.enemies.push({
      id: 9,
      kind: 'ship',
      blueprintId: 'asp-mk2',
      label: 'Asp Mk II',
      x: 350,
      y: 0,
      vx: -3,
      vy: 0,
      angle: Math.PI,
      energy: 150,
      maxEnergy: 150,
      laserPower: 5,
      missiles: 1,
      targetableArea: 280,
      laserRange: 380,
      topSpeed: 6.6,
      acceleration: 0.12,
      turnRate: 0.06,
      roles: { bountyHunter: true },
      aggression: 20,
      baseAggression: 20,
      fireCooldown: 0,
      missileCooldown: 999,
      isFiringLaser: false
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);

    expect(Math.hypot(state.enemies[0].x - state.station.x, state.enemies[0].y - state.station.y)).toBeGreaterThan(377.5);
    expect(state.enemies[0].isFiringLaser).toBe(false);
  });

  it('boosts shield recharge with the extra energy unit', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.extra_energy_unit = true;
    const boosted = createCombatState([0], { installedEquipment: commander.installedEquipment });
    const baseline = createCombatState([0]);
    boosted.player.shields = 50;
    baseline.player.shields = 50;

    stepTravelCombat(boosted, { thrust: 0, turn: 0, fire: false }, 10, 'PLAYING', {}, createDeterministicRandomSource([0]));
    stepTravelCombat(baseline, { thrust: 0, turn: 0, fire: false }, 10, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(boosted.player.shields).toBeGreaterThan(baseline.player.shields);
    expect(boosted.player.maxShields).toBe(100);
  });

  it('consumes energy bombs and preserves mission enemies', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.enemies.push({
      id: 3,
      kind: 'ship',
      blueprintId: 'sidewinder',
      label: 'Sidewinder',
      x: 100,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 70,
      maxEnergy: 70,
      laserPower: 2,
      missiles: 0,
      targetableArea: 210,
      laserRange: 290,
      topSpeed: 6,
      acceleration: 0.11,
      turnRate: 0.05,
      roles: { hostile: true },
      aggression: 42,
      baseAggression: 42,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false
    });
    state.enemies.push({
      id: 4,
      kind: 'ship',
      blueprintId: 'constrictor',
      label: 'Constrictor',
      x: 110,
      y: 0,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      energy: 220,
      maxEnergy: 220,
      laserPower: 5,
      missiles: 4,
      targetableArea: 300,
      laserRange: 420,
      topSpeed: 7,
      acceleration: 0.15,
      turnRate: 0.065,
      roles: { hostile: true, pirate: true },
      aggression: 56,
      baseAggression: 56,
      fireCooldown: 999,
      missileCooldown: 999,
      isFiringLaser: false,
      missionTag: 'constrictor'
    });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, triggerEnergyBomb: true }, 1, 'PLAYING', {}, rng);
    expect(state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(state.enemies.some((enemy) => enemy.blueprintId === 'sidewinder')).toBe(false);
    expect(state.enemies.some((enemy) => enemy.missionTag === 'constrictor')).toBe(true);
  });

  it('spawns pirate pressure from valuable legal cargo without cops', () => {
    const rng = createDeterministicRandomSource([0, 0, 0, 0, 0, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0, 0, 0, 0, 0], { government: 0, techLevel: 12 });

    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 256, 'PLAYING', { luxuries: 12, computers: 8 }, rng);
    expect(state.enemies.some((enemy) => enemy.roles.pirate || enemy.roles.hostile)).toBe(true);
    expect(state.enemies.some((enemy) => enemy.roles.cop)).toBe(false);
  });

  it('uses the escape pod recovery flow and preserves consumable state', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.escape_pod = true;
    commander.installedEquipment.energy_bomb = true;
    const state = createCombatState([0], { installedEquipment: commander.installedEquipment });
    state.player.shields = 2;

    const result = stepTravelCombat(state, { thrust: 0, turn: 0, fire: false, triggerEnergyBomb: true }, 1, 'PLAYING', {}, createDeterministicRandomSource([0]));
    state.player.shields = 0;
    const escaped = stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 0, 'PLAYING', {}, createDeterministicRandomSource([0]));
    expect(result.state.playerLoadout.installedEquipment.energy_bomb).toBe(false);
    expect(escaped.playerEscaped).toBe(true);
    consumeEscapePod(state);
    expect(getPlayerCombatSnapshot(state).installedEquipment.escape_pod).toBe(false);
  });

  it('treats the visible station split as open for docking', () => {
    const station = {
      x: 0,
      y: 0,
      radius: 80,
      angle: 0,
      rotSpeed: 0,
      safeZoneRadius: 360
    };
    const slotAngle = getStationSlotAngle(station.angle);
    const player = {
      x: Math.cos(slotAngle) * 60,
      y: Math.sin(slotAngle) * 60,
      vx: 0.5,
      vy: 0.5,
      angle: slotAngle + Math.PI
    };

    const docking = assessDockingApproach(station, player);

    expect(docking.isInsideSlot).toBe(true);
    expect(docking.isInDockingGap).toBe(true);
    expect(docking.collidesWithHull).toBe(false);
    expect(docking.canDock).toBe(true);
  });

  it('collides when crossing the ring away from the visible split', () => {
    const station = {
      x: 0,
      y: 0,
      radius: 80,
      angle: 0,
      rotSpeed: 0,
      safeZoneRadius: 360
    };
    const slotAngle = getStationSlotAngle(station.angle);
    const player = {
      x: Math.cos(slotAngle + Math.PI / 2) * 70,
      y: Math.sin(slotAngle + Math.PI / 2) * 70,
      vx: 0.5,
      vy: 0.5,
      angle: slotAngle + Math.PI
    };

    const docking = assessDockingApproach(station, player);

    expect(docking.isInsideSlot).toBe(false);
    expect(docking.collidesWithHull).toBe(true);
    expect(docking.canDock).toBe(false);
  });
});
