import type { InstalledEquipmentState, LaserMountState, LegalStatus } from '../commander';
import type { MissionExternalEvent, MissionVariant } from '../missions';
import type { LaserMountPosition } from '../shipCatalog';

export type FlightPhase = 'READY' | 'PLAYING' | 'JUMPING' | 'ARRIVED' | 'GAMEOVER';
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
export type BlueprintFileId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M' | 'N' | 'O' | 'P';
export type CombatBehavior = 'hostile' | 'civilian' | 'police' | 'stationTraffic' | 'thargoid';

export interface RandomSource {
  nextFloat: () => number;
  nextByte: () => number;
}

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
  missionTag?: 'constrictor' | 'thargoid-plans';
}

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
}

export interface CombatParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface CombatPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  shields: number;
  maxShields: number;
  maxSpeed: number;
  fireCooldown: number;
  tallyKills: number;
  rechargeRate: number;
}

export interface CombatStation {
  x: number;
  y: number;
  radius: number;
  angle: number;
  rotSpeed: number;
  safeZoneRadius: number;
}

export interface CombatEncounterState {
  mcnt: number;
  rareTimer: number;
  ev: number;
  safeZone: boolean;
  stationHostile: boolean;
  ecmTimer: number;
  copsNearby: number;
  benignCooldown: number;
  activeBlueprintFile: BlueprintFileId;
}

export interface CombatMessage {
  id: string;
  text: string;
  duration: number;
}

export interface CombatPlayerLoadout {
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  missilesInstalled: number;
}

export interface TravelCombatState {
  player: CombatPlayer;
  playerLoadout: CombatPlayerLoadout;
  enemies: CombatEnemy[];
  projectiles: CombatProjectile[];
  particles: CombatParticle[];
  station: CombatStation | null;
  encounter: CombatEncounterState;
  legalValue: number;
  legalStatus: LegalStatus;
  score: number;
  nextId: number;
  currentGovernment: number;
  currentTechLevel: number;
  missionTP: number;
  missionVariant: MissionVariant;
  witchspace: boolean;
  thargoidContactTriggered: boolean;
  constrictorSpawned: boolean;
  messages: CombatMessage[];
  missionEvents: MissionExternalEvent[];
  salvageCargo: Record<string, number>;
  salvageFuel: number;
  lastPlayerArc: LaserMountPosition;
}

export interface TravelCombatInit {
  legalValue: number;
  government: number;
  techLevel: number;
  missionTP: number;
  missionVariant: MissionVariant;
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  missilesInstalled: number;
}

export interface CombatInput {
  thrust: number;
  turn: number;
  fire: boolean;
  activateEcm?: boolean;
  triggerEnergyBomb?: boolean;
  autoDock?: boolean;
}

export interface CombatTickResult {
  state: TravelCombatState;
  playerDestroyed: boolean;
  playerEscaped: boolean;
  autoDocked: boolean;
}

export interface DockingAssessment {
  slotAngle: number;
  slotOffset: number;
  noseAlignment: number;
  distance: number;
  speed: number;
  isInsideSlot: boolean;
  isFacingHangar: boolean;
  isInDockingGap: boolean;
  collidesWithHull: boolean;
  canDock: boolean;
}
