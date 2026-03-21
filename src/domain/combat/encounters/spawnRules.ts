import { getCargoBadness } from '../../legal';
import { hasMissionFlag } from '../../missions';
import { getCombatBlueprint } from '../blueprints';
import { getAvailablePackHunters, getBlueprintAvailability, getLoneBountySequence, getPackSequence } from './blueprintFiles';
import { pushMessage } from '../state';
import { getCargoPirateInterest } from '../scoring/salvage';
import { spawnCop, spawnEnemyFromBlueprint } from '../spawn/spawnEnemy';
import type { BlueprintFileId, RandomSource, TravelCombatState } from '../types';

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
  missionTP: number;
  witchspace: boolean;
  randomByte: number;
}): BlueprintFileId {
  if (params.witchspace || (hasMissionFlag(params.missionTP, 'thargoidPlansBriefed') && !hasMissionFlag(params.missionTP, 'thargoidPlansCompleted'))) {
    return (params.randomByte & 1) === 0 ? 'C' : 'D';
  }

  if (!hasMissionFlag(params.missionTP, 'constrictorCompleted') && hasMissionFlag(params.missionTP, 'constrictorBriefed')) {
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
  const size = (random.nextByte() & 3) + 1;
  state.encounter.ev = size - 1;
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
  const blueprintId = (random.nextByte() & 1) === 0 ? 'cobra-mk3-trader' : 'python-trader';
  spawnEnemyFromBlueprint(state, blueprintId, random, {
    roles: { trader: true, innocent: true, docking: true, hostile: false },
    aggression: 10,
    baseAggression: 10
  });
}

/**
 * Mission-only Constrictor encounter.
 */
function spawnConstrictor(state: TravelCombatState, random: RandomSource) {
  spawnEnemyFromBlueprint(state, 'constrictor', random, { missionTag: 'constrictor', aggression: 56, baseAggression: 56 });
  state.constrictorSpawned = true;
  pushMessage(state, 'NAVY ALERT: CONSTRICTOR CONTACT');
}

/**
 * Mission-only thargoid contact. The first spawn also emits a mission event so
 * the campaign can react later when the player returns.
 */
function spawnThargoidIntercept(state: TravelCombatState, random: RandomSource) {
  spawnEnemyFromBlueprint(state, 'thargoid', random, { missionTag: 'thargoid-plans', aggression: 58, baseAggression: 58 });
  pushMessage(state, 'THARGOID INTERCEPTOR');
  if (!state.thargoidContactTriggered) {
    state.thargoidContactTriggered = true;
    state.missionEvents.push({ type: 'travel:thargoid-contact-system' });
  }
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
  let badness = getCargoBadness(cargo) * 2;
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

  if (!state.witchspace && state.encounter.benignCooldown <= 0 && random.nextByte() < 33 && state.enemies.length < 6) {
    spawnBenignTrader(state, random);
    state.encounter.benignCooldown = 2;
  } else {
    state.encounter.benignCooldown = Math.max(0, state.encounter.benignCooldown - 1);
  }

  if (deepSpaceCopShouldSpawn(state, random, cargo) && state.enemies.filter((enemy) => enemy.roles.cop).length < 3) {
    spawnCop(state, random, true);
  }

  state.encounter.ev -= 1;
  if (state.encounter.ev >= 0) {
    return;
  }
  state.encounter.ev = 0;

  const thargoidMissionActive = hasMissionFlag(state.missionTP, 'thargoidPlansBriefed') && !hasMissionFlag(state.missionTP, 'thargoidPlansCompleted');
  const constrictorActive = hasMissionFlag(state.missionTP, 'constrictorBriefed') && !hasMissionFlag(state.missionTP, 'constrictorCompleted');
  if (constrictorActive && !state.constrictorSpawned) {
    spawnConstrictor(state, random);
    return;
  }
  if (thargoidMissionActive && random.nextByte() >= 200) {
    spawnThargoidIntercept(state, random);
    return;
  }
  if (state.currentGovernment !== 0) {
    const gate = random.nextByte();
    if (gate >= 120 || (gate & 7) < state.currentGovernment) {
      return;
    }
  }

  const pirateInterest = getCargoPirateInterest(cargo);
  if (pirateInterest > 0 && state.enemies.filter((enemy) => enemy.roles.pirate || enemy.roles.hostile).length < 2 && random.nextByte() < pirateInterest) {
    if (random.nextByte() >= 96) {
      spawnPackPirates(state, random);
    } else {
      spawnLoneBounty(state, random);
    }
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
    missionTP: state.missionTP,
    witchspace: params.witchspace,
    randomByte: random.nextByte()
  });
}
