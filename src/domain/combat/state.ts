import { getLegalStatus } from '../commander';
import type { LaserId, LaserMountPosition } from '../shipCatalog';
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

export const PLAYER_MAX_ENERGY = 255;
export const PLAYER_MAX_SHIELD = 255;
export const PLAYER_MAX_LASER_HEAT = 100;
export const PLAYER_LASER_COOL_RATE = 12;
export const ELITE_RECHARGE_INTERVAL = (8 / 50) * 60;
export const ELITE_SHIELD_RECHARGE_THRESHOLD = 127;

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

export function clampLaserHeat(value: number, maxLaserHeat: number): number {
  return Math.max(0, Math.min(maxLaserHeat, value));
}

/**
 * Laser heat is tracked per mount so each arc can cut out and recover on its
 * own without forcing unrelated mounts to share one thermal budget.
 */
export function createLaserHeatState(value = 0): Record<LaserMountPosition, number> {
  return {
    front: value,
    rear: value,
    left: value,
    right: value
  };
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
 * keeps the player Cobra Mk III aligned with the pirate Cobra Mk III so the
 * player cannot simply outrun the common hostile baseline.
 */
function getPlayerMaxSpeed(_laserMounts: TravelCombatInit['laserMounts']): number {
  return 6;
}

function getPlayerMaxShield(installedEquipment: TravelCombatInit['installedEquipment']): number {
  return installedEquipment.shield_generator ? PLAYER_MAX_SHIELD : 0;
}

/**
 * Elite recharges one energy point on each classic recharge event, or two when
 * the extra energy unit is installed.
 */
function getPlayerEnergyRechargePerTick(installedEquipment: TravelCombatInit['installedEquipment']): number {
  return installedEquipment.extra_energy_unit ? 2 : 1;
}

/**
 * Damage follows Elite's original ordering: shield first, then energy overflow.
 */
export function applyPlayerDamage(state: TravelCombatState, damage: number) {
  const appliedDamage = Math.max(0, damage);
  if (appliedDamage <= 0) {
    return;
  }

  const absorbedByShield = Math.min(state.player.shield, appliedDamage);
  state.player.shield = clampShield(state.player.shield - absorbedByShield, state.player.maxShield);
  const overflow = appliedDamage - absorbedByShield;
  if (overflow > 0) {
    state.player.energy = clampEnergy(state.player.energy - overflow, state.player.maxEnergy);
  }
}

/**
 * Some systems still spend energy immediately in this clone, even though Elite
 * also has time-based drains such as ECM while active.
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
 * Elite updates energy and shield charging on a fixed cadence: once every
 * eight 50 Hz ticks. We emulate that cadence in the 60 fps render loop by
 * accumulating frame time and replaying one or more classic recharge events.
 *
 * Each recharge event:
 * - adds 1 energy, or 2 with the extra energy unit
 * - converts 1 energy into 1 shield only when energy is above 127
 *
 * ECM still has an active timer for UI feedback and temporary launch
 * suppression, but its energy cost is paid up front when the pilot presses the
 * control rather than hidden inside the recharge loop.
 */
export function rechargePlayerDefense(state: TravelCombatState, dt: number) {
  state.player.rechargeTickAccumulator += dt;
  while (state.player.rechargeTickAccumulator >= ELITE_RECHARGE_INTERVAL) {
    state.player.rechargeTickAccumulator -= ELITE_RECHARGE_INTERVAL;
    state.player.energy = clampEnergy(state.player.energy + state.player.energyRechargePerTick, state.player.maxEnergy);

    if (state.player.shield < state.player.maxShield && state.player.energy > ELITE_SHIELD_RECHARGE_THRESHOLD) {
      state.player.shield = clampShield(state.player.shield + state.player.shieldRechargePerTick, state.player.maxShield);
      state.player.energy = clampEnergy(state.player.energy - 1, state.player.maxEnergy);
    }
  }
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
  const maxEnergy = PLAYER_MAX_ENERGY;
  const maxShield = getPlayerMaxShield(init.installedEquipment);
  const activeBlueprintFile = selectBlueprintFile({
    government: init.government,
    techLevel: init.techLevel,
    missionContext: init.missionContext,
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
      energyPerBank: Math.ceil(maxEnergy / init.energyBanks),
      // Shield presence is now loadout-driven, so a fresh combat session starts
      // with either a full shield buffer or none at all.
      shield: maxShield,
      maxShield,
      laserHeat: createLaserHeatState(),
      maxLaserHeat: PLAYER_MAX_LASER_HEAT,
      laserHeatCooldownRate: PLAYER_LASER_COOL_RATE,
      maxSpeed,
      fireCooldown: 0,
      tallyKills: 0,
      // Rewards earned during the live encounter are buffered here until the
      // travel screen hands control back to the docked commander state.
      combatReward: 0,
      energyRechargePerTick: getPlayerEnergyRechargePerTick(init.installedEquipment),
      shieldRechargePerTick: 1,
      rechargeTickAccumulator: 0
    },
    playerLoadout: {
      laserMounts: { ...init.laserMounts },
      installedEquipment: { ...init.installedEquipment },
      missilesInstalled: init.missilesInstalled
    },
    // Lasers start armed so launch behavior stays aggressive by default; the
    // travel UI can toggle this switch off without touching equipment layout.
    playerLasersActive: true,
    // The combat step refreshes this from the nearest eligible hostile inside
    // an installed laser sector so the HUD reticle always matches auto-fire.
    playerTargetLock: null,
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
      // ECM keeps a separate flash timer so the renderer can show the control
      // feedback as a quick yellow pulse without coupling the effect to the
      // longer missile-suppression window.
      ecmTimer: 0,
      ecmFlashTimer: 0,
      bombEffectTimer: 0,
      copsNearby: 0,
      benignCooldown: 0,
      activeBlueprintFile
    },
    legalValue: init.legalValue,
    legalStatus: getLegalStatus(init.legalValue),
    nextId: 1,
    currentGovernment: init.government,
    currentTechLevel: init.techLevel,
    missionContext: init.missionContext,
    witchspace: false,
    pendingMissionMessages: [],
    missionSpawnBudget: 0,
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
    const life = 20 + Math.random() * 12;
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life,
      maxLife: life,
      color,
      size: 1.6 + Math.random() * 1.4
    });
  }
}

/**
 * Bomb detonations need a heavier burst than standard kill sparks so each
 * destroyed ship reads as a distinct explosion during the full-screen flash.
 */
export function spawnBombExplosion(state: TravelCombatState, x: number, y: number) {
  const colors = ['#ff5555', '#ffff55', '#ff5555', '#ffff55', '#55ff55'] as const;
  for (let i = 0; i < 24; i += 1) {
    const life = 18 + Math.random() * 16;
    const speed = 2 + Math.random() * 8;
    const angle = Math.random() * Math.PI * 2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      color: colors[i % colors.length],
      size: 2.8 + Math.random() * 3.6
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
const PLAYER_LASER_RANGE_MULTIPLIER = 3;

export function getLaserProjectileProfile(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
      return { damage: 24, speed: 18, life: 26 * PLAYER_LASER_RANGE_MULTIPLIER, cooldown: 8 };
    case 'beam_laser':
      return { damage: 16, speed: 16, life: 22 * PLAYER_LASER_RANGE_MULTIPLIER, cooldown: 10 };
    case 'mining_laser':
      return { damage: 10, speed: 14, life: 24 * PLAYER_LASER_RANGE_MULTIPLIER, cooldown: 14 };
    case 'pulse_laser':
    default:
      return { damage: 15, speed: 14, life: 18 * PLAYER_LASER_RANGE_MULTIPLIER, cooldown: 12 };
  }
}

/**
 * Laser energy cost stays detached from projectile damage so balance tweaks can
 * preserve the documented "tiered draw" behavior without overwhelming the
 * classic recharge loop. Heat, not energy, is meant to be the primary limiter.
 */
export function getLaserEnergyCost(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
    case 'mining_laser':
      return 1.2;
    case 'beam_laser':
      return 0.8;
    case 'pulse_laser':
    default:
      return 0.4;
  }
}

/**
 * Heat is tracked as one shared weapon temperature. Each firing batch raises
 * that meter, even when multiple mounts are installed, and the meter cools
 * continuously while the ship is not adding more heat. Pricier lasers are
 * deliberately more heat-efficient so upgrades feel like real combat hardware,
 * not just bigger damage spikes with faster lockouts.
 */
export function getLaserHeatPerShot(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
      return 4;
    case 'beam_laser':
      return 6;
    case 'mining_laser':
      return 7;
    case 'pulse_laser':
    default:
      return 8;
  }
}
