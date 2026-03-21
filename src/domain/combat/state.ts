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

/**
 * Shields should never drop below zero or exceed their configured maximum.
 */
export function clampShields(value: number, maxShields: number): number {
  return Math.max(0, Math.min(maxShields, value));
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
 * Extra energy unit affects shield recharge during flight.
 */
function getPlayerRechargeRate(installedEquipment: TravelCombatInit['installedEquipment']): number {
  return installedEquipment.extra_energy_unit ? 0.2 : 0.09;
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
      shields: 100,
      maxShields: 100,
      maxSpeed,
      fireCooldown: 0,
      tallyKills: 0,
      rechargeRate: getPlayerRechargeRate(init.installedEquipment)
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
