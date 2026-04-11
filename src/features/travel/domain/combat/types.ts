import type { InstalledEquipmentState, LaserMountState, LegalStatus } from '../../../commander/domain/commander';
import type { MissionTravelContext } from '../missionContext';
import type { LaserMountPosition } from '../../../commander/domain/shipCatalog';

/**
 * Combat type system overview
 * ---------------------------
 *
 * This file defines the shared language for the entire real-time flight segment.
 * If you are trying to understand how travel combat works, start here:
 *
 * - `TravelCombatState` is the full mutable simulation state for one flight.
 * - `TravelCombatInit` is the docked-game data required to create that state.
 * - `CombatBlueprint` describes a ship archetype.
 * - `CombatEnemy` is a live spawned instance built from a blueprint.
 * - `CombatInput` is the normalized per-frame control signal.
 * - `CombatTickResult` is the simulation outcome returned each frame.
 *
 * The rest of the combat modules are intentionally built around these contracts.
 */

/**
 * High-level state of the flight segment.
 *
 * The UI, renderer and simulation all key off this value:
 * - `READY`: launched but not yet moving
 * - `PLAYING`: normal manual flight
 * - `JUMPING`: local in-system jump cruise
 * - `ARRIVED`: post-hyperspace local space near the destination
 * - `HYPERSPACE`: inter-system tunnel transition
 * - `GAMEOVER`: destruction/reset state
 */
export type FlightPhase = 'READY' | 'PLAYING' | 'JUMPING' | 'ARRIVED' | 'HYPERSPACE' | 'DOCKING_ANIMATION' | 'GAMEOVER';

/**
 * Stable identifier for every NPC ship archetype used in encounter space.
 *
 * Player ship configuration lives in `shipCatalog.ts`. This union is strictly
 * for non-player entities spawned during the travel/combat prototype.
 */
export type BlueprintId =
  | 'sidewinder'
  | 'mamba'
  | 'krait'
  | 'adder'
  | 'gecko'
  | 'cobra-mk1'
  | 'worm'
  | 'cobra-mk3-pirate'
  | 'cobra-mk3-trader'
  | 'asp-mk2'
  | 'python-pirate'
  | 'python-trader'
  | 'fer-de-lance'
  | 'viper'
  | 'constrictor'
  | 'thargoid'
  | 'thargon';

/**
 * "Blueprint files" are classic encounter tables. A flight is assigned one
 * active file depending on local system conditions and mission state.
 */
export type BlueprintFileId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P';

/**
 * Coarse behavior category used to route ships into the right AI module.
 *
 * The codebase deliberately uses role/data composition rather than a class per
 * ship type. Most differences are "same behavior, different stats".
 */
export type CombatBehavior = 'hostile' | 'civilian' | 'police' | 'stationTraffic' | 'thargoid';

/**
 * Tiny abstraction over randomness so tests can run the exact same combat logic
 * using deterministic byte streams.
 */
export interface RandomSource {
  nextFloat: () => number;
  nextByte: () => number;
}

/**
 * Semantic tags used by spawning, AI, legal rules and rendering.
 *
 * These are intentionally behavior-oriented. For example, a Viper can be a
 * `cop` and only become `hostile` once station defense escalates.
 */
export interface CombatShipRoles {
  trader?: boolean;
  bountyHunter?: boolean;
  hostile?: boolean;
  pirate?: boolean;
  docking?: boolean;
  innocent?: boolean;
  cop?: boolean;
  stationDefense?: boolean;
}

/**
 * Hostile ships now fly repeated attack runs rather than parking on the
 * player's nose forever. The phases are intentionally small:
 * - `approach`: line up and press the attack
 * - `breakaway`: peel to a chosen side and reset for another pass
 */
export type HostileAttackPhase = 'approach' | 'breakaway';

/**
 * Immutable definition of a ship archetype.
 *
 * A blueprint answers "what kind of thing can be spawned?" and contains:
 * - performance stats
 * - weapon capability
 * - behavior routing
 * - role flags used by higher-level systems
 */
export interface CombatBlueprint {
  id: BlueprintId;
  label: string;
  behavior: CombatBehavior;
  maxEnergy: number;
  laserPower: number;
  missiles: number;
  targetableArea: number;
  laserRange: number;
  topSpeed: number;
  acceleration: number;
  turnRate: number;
  roles: CombatShipRoles;
  packHunter?: boolean;
  loneBounty?: boolean;
}

/**
 * Mutable runtime representation of one NPC ship/thargon inside a live combat
 * session. This is what the simulation updates every frame.
 */
export interface CombatEnemy {
  id: number;
  kind: 'ship' | 'thargon';
  blueprintId: BlueprintId;
  label: string;
  behavior: CombatBehavior;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  energy: number;
  maxEnergy: number;
  laserPower: number;
  missiles: number;
  targetableArea: number;
  laserRange: number;
  topSpeed: number;
  acceleration: number;
  turnRate: number;
  roles: CombatShipRoles;
  aggression: number;
  baseAggression: number;
  fireCooldown: number;
  missileCooldown: number;
  isFiringLaser: boolean;
  /**
   * Attack-run state for hostile ships.
   *
   * These fields are optional so older fixtures can omit them, but live spawns
   * always initialize them. The strafe sign is stable per enemy so repeated
   * passes feel deliberate instead of jittering left/right every frame.
   */
  hostileAttackPhase?: HostileAttackPhase;
  hostileStrafeSign?: -1 | 1;
  /**
   * Station-traffic ships reuse the same staged lead-angle auto-dock plan as
   * the player. They only persist the current phase and chosen staging radius
   * because every other steering value can be recomputed from live geometry.
   */
  autoDockPhase?: 'approach' | 'align' | 'wait' | 'inward';
  autoDockStageRadius?: number;
  /**
   * Age in classic 60 Hz ticks.
   *
   * Encounter cleanup uses this instead of wall-clock timestamps so tests and
   * live gameplay share the exact same despawn thresholds.
   */
  lifetime: number;
  missionTag?: {
    missionId: string;
    templateId: string;
    role: 'target' | 'escort' | 'ambusher' | 'blockade' | 'scan-hostile';
  };
}

/**
 * Runtime projectile. Projectiles are intentionally simple data objects because
 * all special handling happens in dedicated projectile-processing code.
 */
export interface CombatProjectile {
  id: number;
  kind: 'laser' | 'missile';
  owner: 'player' | 'enemy';
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  sourceEnemyId?: number;
  /**
   * Player lasers now store the mount that fired and the target they were
   * aimed at so the simulation and tests can reason about sector handoffs.
   */
  sourceMount?: LaserMountPosition;
  targetEnemyId?: number;
}

/**
 * Player fire control exposes the currently auto-selected hostile ship so the
 * HUD and renderer can show which contact the laser controller is tracking.
 */
export interface PlayerTargetLock {
  enemyId: number;
  mount: LaserMountPosition;
}

/**
 * Purely visual particle used for explosions, impacts and engine trails.
 * Particles never affect gameplay rules.
 */
export interface CombatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

/**
 * Combat-only projection of the commander ship.
 *
 * This is kept separate from the docked commander model so the real-time loop
 * can remain small, mutable and testable without dragging in economy concerns.
 */
export interface CombatPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  energy: number;
  maxEnergy: number;
  energyBanks: number;
  energyPerBank: number;
  shield: number;
  maxShield: number;
  laserHeat: Record<LaserMountPosition, number>;
  maxLaserHeat: number;
  laserHeatCooldownRate: number;
  maxSpeed: number;
  fireCooldown: number;
  tallyKills: number;
  combatReward: number;
  energyRechargePerTick: number;
  shieldRechargePerTick: number;
  rechargeTickAccumulator: number;
}

/**
 * Minimal station representation required for:
 * - docking geometry
 * - safe-zone protection
 * - renderer placement
 */
export interface CombatStation {
  x: number;
  y: number;
  radius: number;
  /**
   * Screen-plane orientation of the station spin axis.
   *
   * The axis always passes through the station center and the docking slot
   * center. `angle = 0` means the axis points to the right on screen.
   */
  angle: number;
  /**
   * Current phase of the station tumbling around its own docking axis.
   *
   * Older fixtures can omit this field; runtime logic treats `undefined` as 0.
   */
  spinAngle?: number;
  rotSpeed: number;
  safeZoneRadius: number;
}

/**
 * Per-encounter counters and flags used by spawn pacing and policing rules.
 *
 * These values intentionally sit under one object so the main tick loop can
 * reason about encounter progression without hidden local state.
 */
export interface CombatEncounterState {
  mcnt: number;
  rareTimer: number;
  ev: number;
  safeZone: boolean;
  stationHostile: boolean;
  ecmTimer: number;
  ecmFlashTimer: number;
  bombEffectTimer: number;
  copsNearby: number;
  benignCooldown: number;
  activeBlueprintFile: BlueprintFileId;
}

/**
 * Time-bound UI message produced by the simulation.
 */
export interface CombatMessage {
  id: string;
  text: string;
  duration: number;
}

/**
 * Subset of commander equipment that matters during flight.
 */
export interface CombatPlayerLoadout {
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  missilesInstalled: number;
}

/**
 * Full mutable state for one active travel/combat session.
 *
 * If you want to understand what the simulation can possibly change, inspect
 * this interface. The main tick mutates this object in place every frame.
 */
export interface TravelCombatState {
  player: CombatPlayer;
  playerLoadout: CombatPlayerLoadout;
  /**
   * Master laser switch toggled from the travel UI.
   *
   * When armed, the combat step auto-selects the nearest hostile ship inside
   * any currently installed laser sector and keeps firing until no eligible
   * target remains or the pilot switches the controller off.
   */
  playerLasersActive: boolean;
  playerTargetLock: PlayerTargetLock | null;
  enemies: CombatEnemy[];
  projectiles: CombatProjectile[];
  particles: CombatParticle[];
  station: CombatStation | null;
  encounter: CombatEncounterState;
  legalValue: number;
  legalStatus: LegalStatus;
  nextId: number;
  currentGovernment: number;
  currentTechLevel: number;
  missionContext: MissionTravelContext;
  witchspace: boolean;
  pendingMissionMessages: string[];
  missionSpawnBudget: number;
  messages: CombatMessage[];
  missionEvents: Array<{ type: string; [key: string]: unknown }>;
  salvageCargo: Record<string, number>;
  salvageFuel: number;
  lastPlayerArc: LaserMountPosition;
}

/**
 * Data required to create a fresh travel combat session from the docked game.
 */
export interface TravelCombatInit {
  legalValue: number;
  government: number;
  techLevel: number;
  missionContext: MissionTravelContext;
  energyBanks: number;
  energyPerBank: number;
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  missilesInstalled: number;
}

/**
 * Normalized frame input consumed by the combat tick.
 *
 * The UI layer is free to combine keyboard, touch and button state into this
 * shape before handing control to the simulation.
 */
export interface CombatInput {
  thrust: number;
  turn: number;
  toggleLasers?: boolean;
  jump?: boolean;
  hyperspace?: boolean;
  activateEcm?: boolean;
  triggerEnergyBomb?: boolean;
  autoDock?: boolean;
}

/**
 * Small result object returned from each tick so the caller can react to major
 * transitions without re-deriving them from raw state.
 */
export interface CombatTickResult {
  state: TravelCombatState;
  playerDestroyed: boolean;
  playerEscaped: boolean;
  autoDocked: boolean;
}

/**
 * Geometric interpretation of the player's current docking approach.
 *
 * This lets the UI and game rules share one consistent understanding of:
 * - whether the ship is inside the slot
 * - whether it is nose-in
 * - whether it should dock or collide
 */
export interface DockingAssessment {
  speed: number;
  axialOffset: number;
  lateralOffset: number;
  isInsideSlot: boolean;
  isFacingHangar: boolean;
  isInDockingGap: boolean;
  collidesWithHull: boolean;
  canDock: boolean;
}
