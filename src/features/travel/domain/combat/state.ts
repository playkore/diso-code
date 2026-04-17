import { getLegalStatus } from '../../../commander/domain/commander';
import { awardRpgXp } from '../../../commander/domain/rpgProgression';
import type { LaserId, LaserMountPosition } from '../../../commander/domain/shipCatalog';
import { CLASSIC_PLAYER_TOP_SPEED, toWorldSpeed } from './classicFlightModel';
import { selectBlueprintFile } from './encounters/spawnRules';
import { getSystemRpgLevel } from './spawn/rpgScaling';
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

export const PLAYER_MAX_LASER_HEAT = 100;
export const PLAYER_LASER_COOL_RATE = 12;

/**
 * Player HP is a straight RPG stat, so combat only clamps it into the valid
 * [0, maxHp] range rather than routing damage through separate shield banks.
 */
export function clampHp(value: number, maxHp: number) {
  return Math.max(0, Math.min(maxHp, value));
}

export function clampLaserHeat(value: number, maxLaserHeat: number): number {
  return Math.max(0, Math.min(maxLaserHeat, value));
}

/**
 * Applies a per-tick damping factor in a time-step aware way.
 *
 * The caller passes the amount that should remain after one canonical combat
 * tick, and this helper raises it to `dt` so the same motion feels consistent
 * whether the simulation advances in small or large steps.
 */
export function dampVelocity(value: number, dampingPerTick: number, dt: number): number {
  return value * Math.pow(dampingPerTick, dt);
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
 * The player always flies a Cobra Mk III, but classic Elite stores the
 * player's max throttle in `DELTA` rather than in the NPC Cobra blueprint.
 * Converting that canonical `DELTA=40` value through the shared world scale
 * keeps player speed aligned with the rendered ship size.
 */
function getPlayerMaxSpeed(_laserMounts: TravelCombatInit['laserMounts']): number {
  return toWorldSpeed(CLASSIC_PLAYER_TOP_SPEED);
}

/**
 * Incoming damage now lands directly on RPG HP so the travel combat loop and
 * the docked status UI both talk about the same survivability stat.
 */
export function applyPlayerDamage(state: TravelCombatState, damage: number) {
  const appliedDamage = Math.max(0, damage);
  if (appliedDamage <= 0) {
    return;
  }
  state.player.hp = clampHp(state.player.hp - appliedDamage, state.player.maxHp);
}

/**
 * XP rewards resolve immediately inside the live combat state so the HUD can
 * surface mid-flight level-ups before docking persists the updated commander.
 */
export function awardPlayerCombatXp(state: TravelCombatState, amount: number) {
  const { progression, grantedXp, levelUps } = awardRpgXp(
    {
      level: state.player.level,
      xp: state.player.xp,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      attack: state.player.attack
    },
    amount
  );
  state.player.level = progression.level;
  state.player.xp = progression.xp;
  state.player.hp = progression.hp;
  state.player.maxHp = progression.maxHp;
  state.player.attack = progression.attack;
  return {
    grantedXp,
    levelUps
  };
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
      level: init.level,
      xp: init.xp,
      hp: init.hp,
      maxHp: init.maxHp,
      attack: init.attack,
      laserHeat: createLaserHeatState(),
      maxLaserHeat: PLAYER_MAX_LASER_HEAT,
      laserHeatCooldownRate: PLAYER_LASER_COOL_RATE,
      maxSpeed,
      fireCooldown: 0,
      laserTrace: null,
      tallyKills: 0,
      // Rewards earned during the live encounter are buffered here until the
      // travel screen hands control back to the docked commander state.
      combatReward: 0
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
    currentSystemX: init.systemX,
    currentSystemLevel: getSystemRpgLevel(init.systemX),
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
    progression: {
      level: state.player.level,
      xp: state.player.xp,
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      attack: state.player.attack
    },
    installedEquipment: { ...state.playerLoadout.installedEquipment },
    missilesInstalled: state.playerLoadout.missilesInstalled
  };
}

/**
 * Central weapon tuning table for player laser mounts.
 *
 * Laser shots now resolve as instant hits, so this profile only carries the
 * per-shot damage bonus and the cooldown between shots.
 */
export function getLaserWeaponProfile(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
      return { damage: 24, cooldown: 8 };
    case 'beam_laser':
      return { damage: 16, cooldown: 10 };
    case 'mining_laser':
      return { damage: 10, cooldown: 14 };
    case 'pulse_laser':
    default:
      return { damage: 15, cooldown: 12 };
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
