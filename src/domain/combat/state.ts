import { getLegalStatus } from '../commander';
import type { LaserId } from '../shipCatalog';
import { selectBlueprintFile } from './encounters/spawnRules';
import type { RandomSource, TravelCombatInit, TravelCombatState } from './types';

/**
 * Core combat-state helpers
 * -------------------------
 *
 * This module owns low-level state concerns that are shared by multiple combat
 * subsystems:
 * - numeric clamps and angle normalization
 * - random source creation
 * - creation of a fresh combat state
 * - generic message / particle helpers
 * - extraction of the data that must be merged back into the main game store
 */

/**
 * Normalizes an angle into the canonical [-PI, PI] range so steering math stays
 * stable and comparisons never have to care about wrap-around.
 */
export function clampAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Utility clamp used by rules that still think in "byte-like" values.
 */
export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
}

export const PLAYER_MAX_SHIELD = 100;
export const ECM_ENERGY_COST = 32;
export const SHIELD_RECHARGE_RATE = 1;
export const SHIELD_RECHARGE_DELAY = 45;

/**
 * Player defensive stats are still modeled as byte-like values, so every write
 * goes through explicit clamps to preserve Elite-style bounds.
 */
export function clampShield(value: number, maxShield: number): number {
  return Math.max(0, Math.min(maxShield, value));
}

export function clampEnergy(value: number, maxEnergy: number): number {
  return Math.max(0, Math.min(maxEnergy, value));
}

/**
 * Every transient runtime entity shares the same id sequence.
 */
export function projectileId(state: TravelCombatState): number {
  return state.nextId++;
}

/**
 * Production randomness source for real gameplay.
 */
export function createMathRandomSource(): RandomSource {
  return {
    nextFloat: () => Math.random(),
    nextByte: () => Math.floor(Math.random() * 256) & 0xff
  };
}

/**
 * Deterministic randomness source for tests. The stream loops when it reaches
 * the end of the provided byte array.
 */
export function createDeterministicRandomSource(bytes: number[]): RandomSource {
  let index = 0;
  return {
    nextFloat: () => ((bytes[index++ % bytes.length] ?? 0) & 0xff) / 255,
    nextByte: () => (bytes[index++ % bytes.length] ?? 0) & 0xff
  };
}

/**
 * Placeholder for future speed tuning by ship/loadout. The current prototype
 * keeps player max speed fixed, but the hook remains explicit.
 */
function getPlayerMaxSpeed(_laserMounts: TravelCombatInit['laserMounts']): number {
  return 8;
}

/**
 * Extra energy unit doubles passive bank regeneration during flight.
 */
function getPlayerEnergyRegenRate(installedEquipment: TravelCombatInit['installedEquipment']): number {
  return installedEquipment.extra_energy_unit ? 2 : 1;
}

/**
 * Damage always strips the shared shield first and then spills the remainder
 * into the banked energy reserve. This keeps one canonical damage pipeline for
 * lasers, missiles, and collision logic.
 */
export function applyPlayerDamage(state: TravelCombatState, damage: number) {
  const appliedDamage = Math.max(0, damage);
  if (appliedDamage <= 0) {
    return;
  }

  const absorbedByShield = Math.min(state.player.shield, appliedDamage);
  state.player.shield = clampShield(state.player.shield - absorbedByShield, state.player.maxShield);
  // Any successful hit resets the shield recharge timer so incoming fire keeps
  // pressure on the player instead of letting the bar climb back immediately.
  state.player.shieldRechargeDelay = SHIELD_RECHARGE_DELAY;
  const overflow = appliedDamage - absorbedByShield;
  if (overflow > 0) {
    state.player.energy = clampEnergy(state.player.energy - overflow, state.player.maxEnergy);
  }
}

/**
 * Some systems spend energy instantly rather than waiting for incoming damage.
 * Returning a boolean keeps callers honest about the affordability check.
 */
export function spendPlayerEnergy(state: TravelCombatState, amount: number) {
  const cost = Math.max(0, amount);
  if (state.player.energy < cost) {
    return false;
  }
  state.player.energy = clampEnergy(state.player.energy - cost, state.player.maxEnergy);
  return true;
}

/**
 * The travel loop only regenerates once the player stops firing. While the
 * trigger is held down, sustained laser output should visibly walk the energy
 * banks downward instead of being canceled out by passive recovery.
 *
 * Once firing stops, banks regenerate first and the shield then siphons charge
 * back from those banks. That ordering matches the intended "energy funds
 * recovery" feel while avoiding free shield regeneration.
 */
export function rechargePlayerDefense(state: TravelCombatState, dt: number, options: { firing: boolean }) {
  state.player.shieldRechargeDelay = Math.max(0, state.player.shieldRechargeDelay - dt);
  if (options.firing) {
    return;
  }
  state.player.energy = clampEnergy(state.player.energy + state.player.energyRegenRate * dt, state.player.maxEnergy);
  if (state.player.shield >= state.player.maxShield || state.player.energy <= 0 || state.player.shieldRechargeDelay > 0) {
    return;
  }

  const shieldGap = state.player.maxShield - state.player.shield;
  const transfer = Math.min(shieldGap, state.player.shieldRechargeRate * dt, state.player.energy);
  if (transfer <= 0) {
    return;
  }
  state.player.shield = clampShield(state.player.shield + transfer, state.player.maxShield);
  state.player.energy = clampEnergy(state.player.energy - transfer, state.player.maxEnergy);
}

/**
 * Creates a brand-new combat session from docked commander data.
 *
 * This is the main bridge from the turn-based/docked part of the game into the
 * real-time flight segment. The important design choices here are:
 * - everything starts from a fully initialized baseline
 * - encounter context is chosen up front via `selectBlueprintFile`
 * - the returned object is intentionally mutable and updated in place each frame
 */
export function createTravelCombatState(init: TravelCombatInit, random: RandomSource): TravelCombatState {
  const maxSpeed = getPlayerMaxSpeed(init.laserMounts);
  const maxEnergy = init.energyBanks * init.energyPerBank;
  const activeBlueprintFile = selectBlueprintFile({
    government: init.government,
    techLevel: init.techLevel,
    missionTP: init.missionTP,
    witchspace: false,
    randomByte: random.nextByte()
  });
  return {
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 12,
      energy: maxEnergy,
      maxEnergy,
      energyBanks: init.energyBanks,
      energyPerBank: init.energyPerBank,
      shield: PLAYER_MAX_SHIELD,
      maxShield: PLAYER_MAX_SHIELD,
      maxSpeed,
      fireCooldown: 0,
      tallyKills: 0,
      energyRegenRate: getPlayerEnergyRegenRate(init.installedEquipment),
      shieldRechargeRate: SHIELD_RECHARGE_RATE,
      shieldRechargeDelay: 0
    },
    playerLoadout: {
      laserMounts: { ...init.laserMounts },
      installedEquipment: { ...init.installedEquipment },
      missilesInstalled: init.missilesInstalled
    },
    enemies: [],
    projectiles: [],
    particles: [],
    station: null,
    encounter: {
      mcnt: 0,
      rareTimer: 0,
      ev: 0,
      safeZone: false,
      stationHostile: false,
      ecmTimer: 0,
      copsNearby: 0,
      benignCooldown: 0,
      activeBlueprintFile
    },
    legalValue: init.legalValue,
    legalStatus: getLegalStatus(init.legalValue),
    score: 0,
    nextId: 1,
    currentGovernment: init.government,
    currentTechLevel: init.techLevel,
    missionTP: init.missionTP,
    missionVariant: init.missionVariant,
    witchspace: false,
    thargoidContactTriggered: false,
    constrictorSpawned: false,
    messages: [],
    missionEvents: [],
    salvageCargo: {},
    salvageFuel: 0,
    lastPlayerArc: 'front'
  };
}

/**
 * Adds a short-lived simulation message to the queue displayed on the travel
 * screen. Messages are plain data so the UI can remain dumb about their origin.
 */
export function pushMessage(state: TravelCombatState, text: string, duration = 1400) {
  state.messages.push({ id: `${Date.now()}-${state.nextId}`, text, duration });
}

/**
 * Emits explosion/impact particles.
 *
 * Particle randomness is intentionally visual only. Gameplay logic should stay
 * deterministic even if particle jitter changes later.
 */
export function spawnParticles(state: TravelCombatState, x: number, y: number, color: string) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 20 + Math.random() * 12,
      color
    });
  }
}

/**
 * Advances particle positions and removes dead particles.
 */
export function stepParticles(state: TravelCombatState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

/**
 * Consumes the escape pod after the rescue flow is triggered.
 */
export function consumeEscapePod(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.escape_pod) {
    return;
  }
  state.playerLoadout.installedEquipment.escape_pod = false;
}

/**
 * Extracts the subset of combat state that must survive after the player docks
 * or is rescued: salvage, remaining equipment, and missile state.
 */
export function getPlayerCombatSnapshot(state: TravelCombatState) {
  return {
    cargo: { ...state.salvageCargo },
    fuel: state.salvageFuel,
    installedEquipment: { ...state.playerLoadout.installedEquipment },
    missilesInstalled: state.playerLoadout.missilesInstalled
  };
}

/**
 * Central weapon tuning table for player laser mounts.
 *
 * Keeping this here makes it easy to reason about the current combat balance
 * without hunting through fire-control logic.
 */
export function getLaserProjectileProfile(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
      return { damage: 24, speed: 18, life: 26, cooldown: 8 };
    case 'beam_laser':
      return { damage: 16, speed: 16, life: 22, cooldown: 10 };
    case 'mining_laser':
      return { damage: 10, speed: 14, life: 24, cooldown: 14 };
    case 'pulse_laser':
    default:
      return { damage: 12, speed: 14, life: 18, cooldown: 12 };
  }
}

/**
 * Laser energy cost stays detached from projectile damage so balance tweaks can
 * preserve the documented "tiered draw" behavior while remaining visible on a
 * 4 x 64 bank HUD. The values intentionally drain in bank-sized chunks rather
 * than tiny single digits, otherwise firing is hard to read at a glance.
 */
export function getLaserEnergyCost(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
    case 'mining_laser':
      return 24;
    case 'beam_laser':
      return 16;
    case 'pulse_laser':
    default:
      return 8;
  }
}
