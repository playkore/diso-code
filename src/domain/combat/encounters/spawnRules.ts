import { getCargoBadness } from '../../legal';
import { getCombatBlueprint } from '../blueprints';
import { getAvailablePackHunters, getBlueprintAvailability, getLoneBountySequence, getPackSequence } from './blueprintFiles';
import { pushMessage } from '../state';
import { getCargoPirateInterest } from '../scoring/salvage';
import { spawnCop, spawnEnemyFromBlueprint } from '../spawn/spawnEnemy';
import type { BlueprintFileId, RandomSource, TravelCombatState } from '../types';

const MAX_ACTIVE_ENEMIES = 12;
const MAX_ACTIVE_PIRATES = 4;
const MAX_ACTIVE_COPS = 3;
const MAX_ACTIVE_TRADERS = 2;

function getActivePirateCount(state: TravelCombatState) {
  return state.enemies.filter((enemy) => enemy.roles.pirate || enemy.roles.hostile).length;
}

function getFreeEnemySlots(state: TravelCombatState) {
  return Math.max(0, MAX_ACTIVE_ENEMIES - state.enemies.length);
}

/**
 * Global caps intentionally keep combat in the classic "small rotating
 * encounter" space instead of letting the simulation accumulate a backlog of
 * unresolved ships.
 */
function canSpawnEnemy(state: TravelCombatState, role: 'pirate' | 'cop' | 'trader') {
  if (getFreeEnemySlots(state) <= 0) {
    return false;
  }
  if (role === 'pirate') {
    return getActivePirateCount(state) < MAX_ACTIVE_PIRATES;
  }
  if (role === 'cop') {
    return state.enemies.filter((enemy) => enemy.roles.cop).length < MAX_ACTIVE_COPS;
  }
  return state.enemies.filter((enemy) => enemy.roles.trader || enemy.roles.docking).length < MAX_ACTIVE_TRADERS;
}

/**
 * Encounter spawning overview
 * --------------------------
 *
 * This module answers two questions:
 * 1. Which encounter table ("blueprint file") should be active in this system?
 * 2. When the encounter timer ticks, what kind of contact should appear next?
 *
 * The design preserves the old gameplay behavior while separating it from the
 * rest of the combat loop.
 */

/**
 * Chooses the active blueprint file for the current context.
 *
 * Priority order:
 * 1. witchspace / thargoid mission contact
 * 2. unfinished constrictor mission
 * 3. normal system danger table based on government + tech level
 *
 * The function intentionally mirrors the legacy mapping so the refactor does
 * not silently change encounter flavor.
 */
export function selectBlueprintFile(params: {
  government: number;
  techLevel: number;
  missionContext: TravelCombatState['missionContext'];
  witchspace: boolean;
  randomByte: number;
}): BlueprintFileId {
  if (params.witchspace) {
    return (params.randomByte & 1) === 0 ? 'C' : 'D';
  }
  if (params.missionContext.missionTargetSystems.length > 0 || params.missionContext.blockadeAtDestination) {
    return 'O';
  }

  const highTech = params.techLevel >= 10;
  const dangerousGov = params.government <= 2;
  const variant = (params.randomByte >> 1) & 0x03;
  const base = highTech ? (dangerousGov ? ['M', 'N', 'O', 'P'] : ['I', 'J', 'K', 'L']) : dangerousGov ? ['E', 'F', 'G', 'H'] : ['A', 'B', 'C', 'D'];
  return base[variant] as BlueprintFileId;
}

/**
 * Spawns a multi-ship pirate wave constrained by the current blueprint file.
 *
 * `encounter.ev` is reused as a pacing counter so larger pirate packs naturally
 * slow down subsequent dangerous spawns for a short time.
 */
function spawnPackPirates(state: TravelCombatState, random: RandomSource) {
  const remainingPirateSlots = Math.max(0, MAX_ACTIVE_PIRATES - getActivePirateCount(state));
  const remainingEnemySlots = getFreeEnemySlots(state);
  const maxSpawnSize = Math.min(4, remainingPirateSlots, remainingEnemySlots);
  if (maxSpawnSize <= 0) {
    return;
  }

  const requestedSize = (random.nextByte() & 3) + 1;
  const size = Math.min(requestedSize, maxSpawnSize);
  state.encounter.ev = Math.max(state.encounter.ev, size - 1);
  const available = getAvailablePackHunters(state.encounter.activeBlueprintFile);
  const sequence = getPackSequence();
  for (let i = 0; i < size; i += 1) {
    let index = (random.nextByte() & random.nextByte()) & 7;
    while (index > 0 && !available.includes(sequence[index])) {
      index -= 1;
    }
    const blueprintId = available.includes(sequence[index]) ? sequence[index] : available[0] ?? 'sidewinder';
    spawnEnemyFromBlueprint(state, blueprintId, random);
  }
  pushMessage(state, `PIRATE PACK DETECTED: ${size}`);
}

/**
 * Spawns a single notable hostile contact chosen from the "lone bounty" table.
 */
function spawnLoneBounty(state: TravelCombatState, random: RandomSource) {
  if (!canSpawnEnemy(state, 'pirate')) {
    return;
  }
  const candidate = getLoneBountySequence()[random.nextByte() & 3] ?? 'cobra-mk3-pirate';
  const available = new Set(getBlueprintAvailability(state.encounter.activeBlueprintFile));
  const blueprintId = available.has(candidate) ? candidate : 'fer-de-lance';
  spawnEnemyFromBlueprint(state, blueprintId, random);
  pushMessage(state, `CONTACT: ${getCombatBlueprint(blueprintId).label.toUpperCase()}`);
}

/**
 * Spawns civilian traffic. These ships are not just cosmetic: they exercise
 * station approach, safe-zone and legal-response rules.
 */
function spawnBenignTrader(state: TravelCombatState, random: RandomSource) {
  if (!canSpawnEnemy(state, 'trader')) {
    return;
  }
  const blueprintId = (random.nextByte() & 1) === 0 ? 'cobra-mk3-trader' : 'python-trader';
  spawnEnemyFromBlueprint(state, blueprintId, random, {
    roles: { trader: true, innocent: true, docking: true, hostile: false },
    aggression: 10,
    baseAggression: 10
  });
}

function spawnMissionTarget(state: TravelCombatState, random: RandomSource) {
  if (state.missionContext.missionTargetSystems.length === 0) {
    return;
  }
  // The travel layer no longer owns bespoke contract definitions, so the
  // encounter system falls back to one canonical "named target" spawn when a
  // scripted route marks the current system as a mission target.
  spawnEnemyFromBlueprint(state, 'constrictor', random, {
    missionTag: {
      missionId: 'mission-target',
      templateId: 'canonical-target',
      role: 'target'
    },
    aggression: 56,
    baseAggression: 56
  });
  state.missionSpawnBudget += 1;
  pushMessage(state, `TARGET CONTACT: ${getCombatBlueprint('constrictor').label.toUpperCase()}`);
}

function spawnBlockadeWave(state: TravelCombatState, random: RandomSource) {
  const spawnCount = Math.min(3, Math.max(1, getFreeEnemySlots(state)));
  for (let i = 0; i < spawnCount; i += 1) {
    spawnEnemyFromBlueprint(state, 'cobra-mk3-pirate', random, {
      missionTag: {
        missionId: 'mission-blockade',
        templateId: 'station_blockade',
        role: 'blockade'
      },
      aggression: 54,
      baseAggression: 54
    });
  }
  state.missionSpawnBudget += spawnCount;
  pushMessage(state, 'BLOCKADE CONTACTS DETECTED');
}

/**
 * Determines whether contraband / legal pressure should attract police.
 *
 * Cops are intentionally suppressed while inside the station safe zone to avoid
 * absurd "fresh spawn inside protection radius" behavior.
 */
function deepSpaceCopShouldSpawn(state: TravelCombatState, random: RandomSource, cargo: Record<string, number>): boolean {
  if (state.encounter.safeZone) {
    return false;
  }
  if (state.missionContext.policeSuppressed) {
    return false;
  }
  let badness = getCargoBadness(cargo) * 2;
  if (state.missionContext.policeHostile) {
    badness = Math.max(badness, 40);
  }
  if (state.encounter.copsNearby > 0) {
    badness |= state.legalValue;
  }
  return random.nextByte() < badness;
}

/**
 * Periodic encounter driver called by the main combat tick.
 *
 * The order matters:
 * - ambient traders first, so space does not feel empty
 * - police pressure from cargo/legal status
 * - scripted mission encounters
 * - ordinary pirate / hostile contacts
 */
export function tryRareEncounter(state: TravelCombatState, random: RandomSource, cargo: Record<string, number>) {
  state.encounter.mcnt += 1;

  if (!state.witchspace && state.encounter.benignCooldown <= 0 && random.nextByte() < 33 && canSpawnEnemy(state, 'trader')) {
    spawnBenignTrader(state, random);
    state.encounter.benignCooldown = 2;
  } else {
    state.encounter.benignCooldown = Math.max(0, state.encounter.benignCooldown - 1);
  }

  if (deepSpaceCopShouldSpawn(state, random, cargo) && canSpawnEnemy(state, 'cop')) {
    spawnCop(state, random, true);
  }

  state.encounter.ev -= 1;
  if (state.encounter.ev >= 0) {
    return;
  }
  state.encounter.ev = 0;

  if (state.missionContext.missionTargetSystems.length > 0 && state.missionSpawnBudget === 0) {
    spawnMissionTarget(state, random);
    return;
  }
  if (state.missionContext.blockadeAtDestination && state.missionSpawnBudget === 0) {
    spawnBlockadeWave(state, random);
    return;
  }
  if (state.currentGovernment !== 0) {
    const gate = random.nextByte();
    if (gate >= 120 || (gate & 7) < state.currentGovernment) {
      return;
    }
  }

  const pirateInterest = Math.min(255, Math.round(getCargoPirateInterest(cargo) * state.missionContext.pirateSpawnMultiplier));
  if (pirateInterest > 0 && canSpawnEnemy(state, 'pirate') && random.nextByte() < pirateInterest) {
    if (random.nextByte() >= 96) {
      spawnPackPirates(state, random);
    } else {
      spawnLoneBounty(state, random);
    }
    return;
  }

  if (!canSpawnEnemy(state, 'pirate')) {
    return;
  }
  if (random.nextByte() >= 100) {
    spawnPackPirates(state, random);
  } else {
    spawnLoneBounty(state, random);
  }
}

/**
 * Rebinds a running combat state to a new system context, typically after a
 * jump or when resetting the prototype flight at the origin system.
 */
export function setCombatSystemContext(
  state: TravelCombatState,
  params: { government: number; techLevel: number; witchspace: boolean },
  random: RandomSource
) {
  state.currentGovernment = params.government;
  state.currentTechLevel = params.techLevel;
  state.witchspace = params.witchspace;
  state.encounter.activeBlueprintFile = selectBlueprintFile({
    government: params.government,
    techLevel: params.techLevel,
    missionContext: state.missionContext,
    witchspace: params.witchspace,
    randomByte: random.nextByte()
  });
  state.missionSpawnBudget = 0;
}
