import { getLegalStatus, type InstalledEquipmentState, type LaserMountState, type LegalStatus } from './commander';
import { getCargoBadness } from './legal';
import { COMMODITIES, cargoSpaceRequired } from './market';
import { hasMissionFlag, type MissionExternalEvent, type MissionVariant } from './missions';
import { type LaserId, type LaserMountPosition } from './shipCatalog';

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

export interface CombatPlayerLoadout {
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  missilesInstalled: number;
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

const BLUEPRINTS: Record<BlueprintId, CombatBlueprint> = {
  sidewinder: { id: 'sidewinder', label: 'Sidewinder', maxEnergy: 70, laserPower: 2, missiles: 0, targetableArea: 210, laserRange: 290, topSpeed: 6.2, acceleration: 0.11, turnRate: 0.05, roles: { pirate: true, hostile: true }, packHunter: true },
  mamba: { id: 'mamba', label: 'Mamba', maxEnergy: 90, laserPower: 2, missiles: 2, targetableArea: 220, laserRange: 320, topSpeed: 6.7, acceleration: 0.12, turnRate: 0.055, roles: { pirate: true, hostile: true }, packHunter: true },
  krait: { id: 'krait', label: 'Krait', maxEnergy: 80, laserPower: 2, missiles: 0, targetableArea: 200, laserRange: 300, topSpeed: 6.5, acceleration: 0.12, turnRate: 0.058, roles: { pirate: true, hostile: true }, packHunter: true },
  adder: { id: 'adder', label: 'Adder', maxEnergy: 85, laserPower: 2, missiles: 0, targetableArea: 190, laserRange: 280, topSpeed: 6.0, acceleration: 0.1, turnRate: 0.052, roles: { pirate: true, hostile: true }, packHunter: true },
  gecko: { id: 'gecko', label: 'Gecko', maxEnergy: 70, laserPower: 2, missiles: 0, targetableArea: 185, laserRange: 270, topSpeed: 6.1, acceleration: 0.11, turnRate: 0.055, roles: { pirate: true, hostile: true }, packHunter: true },
  'cobra-mk1': { id: 'cobra-mk1', label: 'Cobra Mk I', maxEnergy: 90, laserPower: 2, missiles: 2, targetableArea: 250, laserRange: 310, topSpeed: 6.4, acceleration: 0.11, turnRate: 0.05, roles: { pirate: true, hostile: true }, packHunter: true },
  worm: { id: 'worm', label: 'Worm', maxEnergy: 65, laserPower: 1, missiles: 0, targetableArea: 170, laserRange: 250, topSpeed: 6.8, acceleration: 0.13, turnRate: 0.06, roles: { pirate: true, hostile: true }, packHunter: true },
  'cobra-mk3-pirate': { id: 'cobra-mk3-pirate', label: 'Cobra Mk III', maxEnergy: 150, laserPower: 2, missiles: 2, targetableArea: 320, laserRange: 340, topSpeed: 6.0, acceleration: 0.1, turnRate: 0.045, roles: { pirate: true, hostile: true }, packHunter: true, loneBounty: true },
  'cobra-mk3-trader': { id: 'cobra-mk3-trader', label: 'Cobra Trader', maxEnergy: 130, laserPower: 1, missiles: 1, targetableArea: 320, laserRange: 300, topSpeed: 5.4, acceleration: 0.08, turnRate: 0.04, roles: { trader: true, innocent: true } },
  'asp-mk2': { id: 'asp-mk2', label: 'Asp Mk II', maxEnergy: 150, laserPower: 5, missiles: 1, targetableArea: 280, laserRange: 380, topSpeed: 6.6, acceleration: 0.12, turnRate: 0.06, roles: { bountyHunter: true }, loneBounty: true },
  'python-pirate': { id: 'python-pirate', label: 'Python', maxEnergy: 170, laserPower: 3, missiles: 3, targetableArea: 360, laserRange: 360, topSpeed: 5.1, acceleration: 0.08, turnRate: 0.038, roles: { pirate: true, hostile: true }, loneBounty: true },
  'python-trader': { id: 'python-trader', label: 'Python Trader', maxEnergy: 170, laserPower: 1, missiles: 0, targetableArea: 360, laserRange: 290, topSpeed: 4.9, acceleration: 0.06, turnRate: 0.035, roles: { trader: true, innocent: true } },
  'fer-de-lance': { id: 'fer-de-lance', label: 'Fer-de-Lance', maxEnergy: 160, laserPower: 2, missiles: 2, targetableArea: 260, laserRange: 340, topSpeed: 6.7, acceleration: 0.12, turnRate: 0.06, roles: { bountyHunter: true }, loneBounty: true },
  viper: { id: 'viper', label: 'Viper', maxEnergy: 120, laserPower: 3, missiles: 1, targetableArea: 230, laserRange: 350, topSpeed: 7.0, acceleration: 0.14, turnRate: 0.065, roles: { cop: true, hostile: true, stationDefense: true } },
  constrictor: { id: 'constrictor', label: 'Constrictor', maxEnergy: 220, laserPower: 5, missiles: 4, targetableArea: 300, laserRange: 420, topSpeed: 7.4, acceleration: 0.15, turnRate: 0.065, roles: { hostile: true, pirate: true } },
  thargoid: { id: 'thargoid', label: 'Thargoid', maxEnergy: 180, laserPower: 4, missiles: 6, targetableArea: 330, laserRange: 380, topSpeed: 6.2, acceleration: 0.11, turnRate: 0.055, roles: { hostile: true } },
  thargon: { id: 'thargon', label: 'Thargon', maxEnergy: 55, laserPower: 1, missiles: 0, targetableArea: 150, laserRange: 240, topSpeed: 7.6, acceleration: 0.18, turnRate: 0.08, roles: { hostile: true } }
};

const BLUEPRINT_FILES: Record<BlueprintFileId, BlueprintId[]> = {
  A: ['sidewinder', 'mamba', 'cobra-mk3-trader', 'python-trader', 'viper'],
  B: ['sidewinder', 'adder', 'cobra-mk3-trader', 'python-trader', 'viper'],
  C: ['sidewinder', 'mamba', 'krait', 'thargoid', 'thargon', 'viper'],
  D: ['adder', 'gecko', 'cobra-mk1', 'thargoid', 'thargon', 'viper'],
  E: ['sidewinder', 'mamba', 'krait', 'adder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate'],
  F: ['sidewinder', 'mamba', 'adder', 'cobra-mk1', 'cobra-mk3-pirate', 'asp-mk2'],
  G: ['sidewinder', 'krait', 'gecko', 'worm', 'cobra-mk3-pirate', 'asp-mk2'],
  H: ['sidewinder', 'mamba', 'cobra-mk1', 'worm', 'cobra-mk3-pirate', 'fer-de-lance'],
  I: ['cobra-mk3-trader', 'python-trader', 'viper', 'sidewinder', 'adder'],
  J: ['cobra-mk3-trader', 'python-trader', 'viper', 'mamba', 'gecko'],
  K: ['cobra-mk3-trader', 'python-trader', 'viper', 'cobra-mk1', 'asp-mk2'],
  L: ['cobra-mk3-trader', 'python-trader', 'viper', 'cobra-mk3-pirate', 'fer-de-lance'],
  M: ['sidewinder', 'mamba', 'krait', 'adder', 'cobra-mk1', 'cobra-mk3-pirate', 'python-pirate'],
  N: ['sidewinder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate', 'python-pirate'],
  O: ['mamba', 'krait', 'cobra-mk3-pirate', 'asp-mk2', 'fer-de-lance', 'viper'],
  P: ['adder', 'gecko', 'cobra-mk3-pirate', 'python-pirate', 'fer-de-lance', 'viper']
};

const PACK_SEQUENCE: BlueprintId[] = ['sidewinder', 'mamba', 'krait', 'adder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate'];
const LONE_BOUNTY_SEQUENCE: BlueprintId[] = ['cobra-mk3-pirate', 'asp-mk2', 'python-pirate', 'fer-de-lance'];
const SAFE_ZONE_ENEMY_MARGIN = 18;
const SAFE_ZONE_AVOIDANCE_DISTANCE = 96;
const STATION_TRAFFIC_HOLD_DISTANCE = 148;
const STATION_TRAFFIC_SLOT_DISTANCE = 30;
const STATION_TRAFFIC_DOCKING_RADIUS = 96;
const STATION_LAUNCH_DISTANCE = 240;
// TODO increase when jump is implemented
const HYPERSPACE_ARRIVAL_MIN_DISTANCE = 10_000;
const HYPERSPACE_ARRIVAL_MAX_DISTANCE = 20_000;

function clampAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
}

function clampShields(value: number, maxShields: number): number {
  return Math.max(0, Math.min(maxShields, value));
}

function isEnemyExcludedFromSafeZone(enemy: CombatEnemy): boolean {
  return !enemy.roles.cop && (enemy.roles.hostile || enemy.roles.pirate || enemy.roles.bountyHunter || enemy.kind === 'thargon' || Boolean(enemy.missionTag));
}

function isStationTraffic(enemy: CombatEnemy): boolean {
  return !enemy.roles.cop && !enemy.roles.hostile && !enemy.roles.pirate && !enemy.roles.bountyHunter && !enemy.missionTag && (enemy.roles.trader || enemy.roles.innocent || enemy.roles.docking);
}

function getDistanceFromStation(station: CombatStation, x: number, y: number): number {
  return Math.hypot(x - station.x, y - station.y);
}

function getSafeZoneEscapeAngle(station: CombatStation, enemy: CombatEnemy): number {
  const dx = enemy.x - station.x;
  const dy = enemy.y - station.y;
  if (dx === 0 && dy === 0) {
    return enemy.angle;
  }
  return Math.atan2(dy, dx);
}

function keepEnemyOutsideSafeZone(station: CombatStation, enemy: CombatEnemy) {
  const safeZoneBoundary = station.safeZoneRadius + SAFE_ZONE_ENEMY_MARGIN;
  const distanceFromStation = getDistanceFromStation(station, enemy.x, enemy.y);
  if (distanceFromStation >= safeZoneBoundary) {
    return;
  }

  const escapeAngle = getSafeZoneEscapeAngle(station, enemy);
  enemy.x = station.x + Math.cos(escapeAngle) * safeZoneBoundary;
  enemy.y = station.y + Math.sin(escapeAngle) * safeZoneBoundary;
  const outwardSpeed = Math.max(enemy.acceleration * 24, Math.hypot(enemy.vx, enemy.vy));
  enemy.vx = Math.cos(escapeAngle) * outwardSpeed;
  enemy.vy = Math.sin(escapeAngle) * outwardSpeed;
  enemy.angle = escapeAngle;
}

function getStationTrafficHoldPoint(station: CombatStation) {
  const slotAngle = getStationSlotAngle(station.angle);
  return {
    x: station.x + Math.cos(slotAngle) * STATION_TRAFFIC_HOLD_DISTANCE,
    y: station.y + Math.sin(slotAngle) * STATION_TRAFFIC_HOLD_DISTANCE,
    slotAngle
  };
}

function stepStationTraffic(enemy: CombatEnemy, station: CombatStation, dt: number) {
  const { x: holdX, y: holdY, slotAngle } = getStationTrafficHoldPoint(station);
  const holdDx = holdX - enemy.x;
  const holdDy = holdY - enemy.y;
  const holdDistance = Math.hypot(holdDx, holdDy);
  const distanceFromStation = getDistanceFromStation(station, enemy.x, enemy.y);
  const relativeAngle = Math.atan2(enemy.y - station.y, enemy.x - station.x);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const alignedForDocking = Math.abs(slotOffset) < Math.PI / 7;
  const shouldDock = holdDistance < 42 || (distanceFromStation < STATION_TRAFFIC_HOLD_DISTANCE + 8 && alignedForDocking);

  const targetX = shouldDock ? station.x + Math.cos(slotAngle) * STATION_TRAFFIC_SLOT_DISTANCE : holdX;
  const targetY = shouldDock ? station.y + Math.sin(slotAngle) * STATION_TRAFFIC_SLOT_DISTANCE : holdY;
  const targetAngle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
  const angleDiff = clampAngle(targetAngle - enemy.angle);
  enemy.angle += Math.sign(angleDiff) * enemy.turnRate * dt * 0.8;

  const thrustScale = shouldDock ? 0.48 : 0.34;
  enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * thrustScale * dt;
  enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * thrustScale * dt;
}

function isStationTrafficDocked(enemy: CombatEnemy, station: CombatStation): boolean {
  const slotAngle = getStationSlotAngle(station.angle);
  const dockingDistance = getDistanceFromStation(station, enemy.x, enemy.y);
  const dockingOffset = Math.abs(clampAngle(Math.atan2(enemy.y - station.y, enemy.x - station.x) - slotAngle));
  return dockingDistance <= STATION_TRAFFIC_DOCKING_RADIUS && dockingOffset < Math.PI / 5;
}

export function getStationSlotAngle(stationAngle: number): number {
  return stationAngle + Math.PI / 2;
}

export function assessDockingApproach(
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
): DockingAssessment {
  const distance = Math.hypot(player.x - station.x, player.y - station.y);
  const speed = Math.hypot(player.vx, player.vy);
  const slotAngle = getStationSlotAngle(station.angle);
  const relativeAngle = Math.atan2(player.y - station.y, player.x - station.x);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const noseAlignment = clampAngle(player.angle - (slotAngle + Math.PI));
  const isInsideSlot = Math.abs(slotOffset) < Math.PI / 7;
  const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;
  const isInDockingGap = distance < station.radius + 6 && isInsideSlot;
  const collidesWithHull = distance < station.radius - 5 && !isInDockingGap;
  const canDock = distance < station.radius - 18 && isInDockingGap && isFacingHangar && speed < 3.6;

  return {
    slotAngle,
    slotOffset,
    noseAlignment,
    distance,
    speed,
    isInsideSlot,
    isFacingHangar,
    isInDockingGap,
    collidesWithHull,
    canDock
  };
}

function projectileId(state: TravelCombatState): number {
  return state.nextId++;
}

export function createMathRandomSource(): RandomSource {
  return {
    nextFloat: () => Math.random(),
    nextByte: () => Math.floor(Math.random() * 256) & 0xff
  };
}

export function createDeterministicRandomSource(bytes: number[]): RandomSource {
  let index = 0;
  return {
    nextFloat: () => ((bytes[index++ % bytes.length] ?? 0) & 0xff) / 255,
    nextByte: () => (bytes[index++ % bytes.length] ?? 0) & 0xff
  };
}

export function selectBlueprintFile(params: {
  government: number;
  techLevel: number;
  missionTP: number;
  witchspace: boolean;
  randomByte: number;
}): BlueprintFileId {
  if (params.witchspace || hasMissionFlag(params.missionTP, 'thargoidPlansBriefed') && !hasMissionFlag(params.missionTP, 'thargoidPlansCompleted')) {
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

export function getBlueprintAvailability(fileId: BlueprintFileId): BlueprintId[] {
  return BLUEPRINT_FILES[fileId];
}

export function getAvailablePackHunters(fileId: BlueprintFileId): BlueprintId[] {
  const set = new Set(getBlueprintAvailability(fileId));
  return PACK_SEQUENCE.filter((id) => set.has(id));
}

export function getLegalValueAfterCombat(currentLegalValue: number, delta: number): number {
  return Math.max(0, Math.min(255, Math.trunc(currentLegalValue + delta)));
}

export function createTravelCombatState(init: TravelCombatInit, random: RandomSource): TravelCombatState {
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
      maxSpeed: 8,
      fireCooldown: 0,
      tallyKills: 0,
      rechargeRate: init.installedEquipment.extra_energy_unit ? 0.2 : 0.09
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

function pushMessage(state: TravelCombatState, text: string, duration = 1400) {
  state.messages.push({ id: `${Date.now()}-${state.nextId}`, text, duration });
}

function spawnParticles(state: TravelCombatState, x: number, y: number, color: string) {
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

function spawnEnemyFromBlueprint(
  state: TravelCombatState,
  blueprintId: BlueprintId,
  random: RandomSource,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const blueprint = BLUEPRINTS[blueprintId];
  const spawnDistance = overrides.kind === 'thargon' ? 100 : 820;
  const angle = random.nextFloat() * Math.PI * 2;
  const enemy: CombatEnemy = {
    id: projectileId(state),
    kind: overrides.kind ?? (blueprintId === 'thargon' ? 'thargon' : 'ship'),
    blueprintId,
    label: blueprint.label,
    x: overrides.x ?? state.player.x + Math.cos(angle) * spawnDistance,
    y: overrides.y ?? state.player.y + Math.sin(angle) * spawnDistance,
    vx: overrides.vx ?? 0,
    vy: overrides.vy ?? 0,
    angle: overrides.angle ?? clampAngle(angle + Math.PI),
    energy: overrides.energy ?? blueprint.maxEnergy,
    maxEnergy: blueprint.maxEnergy,
    laserPower: blueprint.laserPower,
    missiles: overrides.missiles ?? blueprint.missiles,
    targetableArea: blueprint.targetableArea,
    laserRange: blueprint.laserRange,
    topSpeed: blueprint.topSpeed,
    acceleration: blueprint.acceleration,
    turnRate: blueprint.turnRate,
    roles: { ...blueprint.roles, ...overrides.roles },
    aggression: overrides.aggression ?? (blueprint.roles.hostile ? 42 : 14),
    baseAggression: overrides.baseAggression ?? (blueprint.roles.hostile ? 42 : 14),
    fireCooldown: overrides.fireCooldown ?? random.nextFloat() * 40,
    missileCooldown: overrides.missileCooldown ?? 90 + random.nextFloat() * 60,
    isFiringLaser: false,
    missionTag: overrides.missionTag
  };

  if (state.station && isEnemyExcludedFromSafeZone(enemy)) {
    keepEnemyOutsideSafeZone(state.station, enemy);
  }

  state.enemies.push(enemy);
  return enemy;
}

function spawnPackPirates(state: TravelCombatState, random: RandomSource) {
  const size = (random.nextByte() & 3) + 1;
  state.encounter.ev = size - 1;
  const available = getAvailablePackHunters(state.encounter.activeBlueprintFile);
  for (let i = 0; i < size; i += 1) {
    let index = (random.nextByte() & random.nextByte()) & 7;
    while (index > 0 && !available.includes(PACK_SEQUENCE[index])) {
      index -= 1;
    }
    const blueprintId = available.includes(PACK_SEQUENCE[index]) ? PACK_SEQUENCE[index] : available[0] ?? 'sidewinder';
    spawnEnemyFromBlueprint(state, blueprintId, random);
  }
  pushMessage(state, `PIRATE PACK DETECTED: ${size}`);
}

function spawnLoneBounty(state: TravelCombatState, random: RandomSource) {
  const candidate = LONE_BOUNTY_SEQUENCE[random.nextByte() & 3] ?? 'cobra-mk3-pirate';
  const available = new Set(getBlueprintAvailability(state.encounter.activeBlueprintFile));
  const blueprintId = available.has(candidate) ? candidate : 'fer-de-lance';
  spawnEnemyFromBlueprint(state, blueprintId, random);
  pushMessage(state, `CONTACT: ${BLUEPRINTS[blueprintId].label.toUpperCase()}`);
}

function spawnBenignTrader(state: TravelCombatState, random: RandomSource) {
  const blueprintId = (random.nextByte() & 1) === 0 ? 'cobra-mk3-trader' : 'python-trader';
  spawnEnemyFromBlueprint(state, blueprintId, random, {
    roles: { trader: true, innocent: true, docking: true, hostile: false },
    aggression: 10,
    baseAggression: 10
  });
}

function spawnCop(state: TravelCombatState, random: RandomSource, hostile = true) {
  spawnEnemyFromBlueprint(state, 'viper', random, {
    roles: { cop: true, hostile, stationDefense: true },
    aggression: hostile ? 52 : 20,
    baseAggression: hostile ? 52 : 20
  });
  pushMessage(state, hostile ? 'VIPER INTERCEPTOR INBOUND' : 'VIPER PATROL');
}

function spawnConstrictor(state: TravelCombatState, random: RandomSource) {
  spawnEnemyFromBlueprint(state, 'constrictor', random, { missionTag: 'constrictor', aggression: 56, baseAggression: 56 });
  state.constrictorSpawned = true;
  pushMessage(state, 'NAVY ALERT: CONSTRICTOR CONTACT');
}

function spawnThargoidIntercept(state: TravelCombatState, random: RandomSource) {
  spawnEnemyFromBlueprint(state, 'thargoid', random, { missionTag: 'thargoid-plans', aggression: 58, baseAggression: 58 });
  pushMessage(state, 'THARGOID INTERCEPTOR');
  if (!state.thargoidContactTriggered) {
    state.thargoidContactTriggered = true;
    state.missionEvents.push({ type: 'travel:thargoid-contact-system' });
  }
}

function updateLegalStatus(state: TravelCombatState) {
  state.legalStatus = getLegalStatus(state.legalValue);
}

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

function tryRareEncounter(state: TravelCombatState, random: RandomSource, cargo: Record<string, number>) {
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
    if (gate >= 120) {
      return;
    }
    if ((gate & 7) < state.currentGovernment) {
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

export function enterStationSpace(
  state: TravelCombatState,
  random: RandomSource,
  options: { rewardScore?: boolean; message?: string } = {}
) {
  state.station = {
    x: Math.round((random.nextFloat() - 0.5) * 120),
    y: -320 - Math.round(random.nextFloat() * 60),
    radius: 80,
    angle: 0,
    rotSpeed: 0.005,
    safeZoneRadius: 360
  };
  state.player.x = state.station.x;
  state.player.y = state.station.y + STATION_LAUNCH_DISTANCE;
  state.player.vx = 0;
  state.player.vy = 0;
  state.player.angle = -Math.PI / 2;
  state.enemies = state.enemies.filter((enemy) => enemy.roles.cop || enemy.missionTag);
  state.projectiles = [];
  state.encounter.safeZone = false;
  if (options.rewardScore) {
    state.score += 250;
  }
  if (options.message) {
    pushMessage(state, options.message, 1800);
  }
}

export function enterArrivalSpace(state: TravelCombatState, random: RandomSource) {
  enterStationSpace(state, random, { rewardScore: true, message: 'SYSTEM REACHED' });
  if (!state.station) {
    return;
  }

  const arrivalDistance =
    HYPERSPACE_ARRIVAL_MIN_DISTANCE +
    Math.round(random.nextFloat() * (HYPERSPACE_ARRIVAL_MAX_DISTANCE - HYPERSPACE_ARRIVAL_MIN_DISTANCE));
  state.player.y = state.station.y + arrivalDistance;
  state.encounter.safeZone = false;
}

function estimateCnt(angleDiff: number): number {
  const alignment = Math.max(0, Math.cos(Math.abs(angleDiff)));
  return -Math.round(alignment * 36);
}

export function canEnemyLaserFireByCnt(cnt: number): boolean {
  return cnt <= -32;
}

export function canEnemyLaserHitByCnt(cnt: number): boolean {
  return cnt <= -35;
}

function applyEnemyHostility(state: TravelCombatState, enemy: CombatEnemy) {
  if (enemy.roles.bountyHunter && state.legalValue >= 40) {
    enemy.roles.hostile = true;
  }

  if (enemy.roles.pirate && enemy.roles.hostile && state.encounter.safeZone) {
    enemy.aggression = 0;
  } else {
    enemy.aggression = enemy.baseAggression;
  }

  if (enemy.roles.cop && state.encounter.stationHostile) {
    enemy.roles.hostile = true;
  }
}

function spawnEnemyMissile(state: TravelCombatState, enemy: CombatEnemy) {
  state.projectiles.push({
    id: projectileId(state),
    kind: 'missile',
    owner: 'enemy',
    x: enemy.x + Math.cos(enemy.angle) * 14,
    y: enemy.y + Math.sin(enemy.angle) * 14,
    vx: enemy.vx + Math.cos(enemy.angle) * 6,
    vy: enemy.vy + Math.sin(enemy.angle) * 6,
    damage: 22,
    life: 180,
    sourceEnemyId: enemy.id
  });
  pushMessage(state, `INCOMING MISSILE: ${enemy.label.toUpperCase()}`, 1000);
}

function getLaserProjectileProfile(laserId: LaserId) {
  switch (laserId) {
    case 'pulse_laser':
      return { damage: 10, cooldown: 10, speed: 18, life: 28 };
    case 'beam_laser':
      return { damage: 16, cooldown: 13, speed: 20, life: 32 };
    case 'military_laser':
      return { damage: 26, cooldown: 13, speed: 22, life: 34 };
    case 'mining_laser':
      return { damage: 22, cooldown: 20, speed: 16, life: 20 };
  }
}

function getCargoPirateInterest(cargo: Record<string, number>): number {
  let weightedValue = 0;
  for (const commodity of COMMODITIES) {
    const amount = Math.max(0, Number(cargo[commodity.key] ?? 0));
    if (amount <= 0) {
      continue;
    }
    const tonnes = cargoSpaceRequired(commodity.unit, amount);
    const scalar = commodity.unit === 't' ? 1 : commodity.unit === 'kg' ? 0.08 : 0.01;
    weightedValue += commodity.basePrice * Math.max(tonnes, amount * scalar);
  }
  return clampByte(weightedValue / 28);
}

function getClosestEnemy(state: TravelCombatState): CombatEnemy | null {
  let closest: CombatEnemy | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = enemy;
    }
  }
  return closest;
}

function getMountAngle(playerAngle: number, mount: LaserMountPosition): number {
  switch (mount) {
    case 'rear':
      return playerAngle + Math.PI;
    case 'left':
      return playerAngle - Math.PI / 2;
    case 'right':
      return playerAngle + Math.PI / 2;
    default:
      return playerAngle;
  }
}

function determinePlayerArc(state: TravelCombatState): LaserMountPosition {
  const enemy = getClosestEnemy(state);
  if (!enemy) {
    return 'front';
  }

  const bearing = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
  const diff = clampAngle(bearing - state.player.angle);
  if (Math.abs(diff) <= Math.PI / 4) {
    return 'front';
  }
  if (Math.abs(diff) >= (3 * Math.PI) / 4) {
    return 'rear';
  }
  return diff < 0 ? 'left' : 'right';
}

function spawnPlayerLaser(state: TravelCombatState, mount: LaserMountPosition, laserId: LaserId) {
  const projectile = getLaserProjectileProfile(laserId);
  const angle = getMountAngle(state.player.angle, mount);
  state.projectiles.push({
    id: projectileId(state),
    kind: 'laser',
    owner: 'player',
    x: state.player.x + Math.cos(angle) * 15,
    y: state.player.y + Math.sin(angle) * 15,
    vx: state.player.vx + Math.cos(angle) * projectile.speed,
    vy: state.player.vy + Math.sin(angle) * projectile.speed,
    damage: projectile.damage,
    life: projectile.life
  });
  state.player.fireCooldown = projectile.cooldown;
  state.lastPlayerArc = mount;
}

function clearEnemyMissiles(state: TravelCombatState) {
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    if (projectile.kind === 'missile' && projectile.owner === 'enemy') {
      spawnParticles(state, projectile.x, projectile.y, '#ffff55');
      state.projectiles.splice(index, 1);
    }
  }
}

function activatePlayerEcm(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.ecm || state.encounter.ecmTimer > 0 || state.player.shields < 12) {
    return;
  }

  state.player.shields = clampShields(state.player.shields - 12, state.player.maxShields);
  state.encounter.ecmTimer = 90;
  clearEnemyMissiles(state);
  pushMessage(state, 'E.C.M. ACTIVE', 1000);
}

function recordKill(state: TravelCombatState, enemy: CombatEnemy) {
  if (enemy.roles.innocent) {
    state.legalValue = getLegalValueAfterCombat(state.legalValue, 24);
    updateLegalStatus(state);
  }
  if (enemy.missionTag === 'constrictor') {
    state.missionEvents.push({ type: 'combat:constrictor-destroyed' });
  }
  state.player.tallyKills += 1;
  state.score += enemy.missionTag ? 400 : 100;
  spawnParticles(state, enemy.x, enemy.y, '#ff5555');
}

function maybeScoopSalvage(state: TravelCombatState, enemy: CombatEnemy, random: RandomSource) {
  if (!state.playerLoadout.installedEquipment.fuel_scoops) {
    return;
  }

  const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  if (distance > 180) {
    return;
  }

  if ((random.nextByte() & 1) === 0) {
    const salvageKeys = ['alloys', 'machinery', 'radioactives', 'gold'];
    const commodityKey = salvageKeys[random.nextByte() % salvageKeys.length] ?? 'alloys';
    state.salvageCargo[commodityKey] = (state.salvageCargo[commodityKey] ?? 0) + 1;
    pushMessage(state, `SALVAGE SCOOPED: ${commodityKey.toUpperCase()}`, 900);
    return;
  }

  state.salvageFuel = Math.min(1.5, state.salvageFuel + 0.2);
  pushMessage(state, 'FUEL SCOOPED', 900);
}

function destroyEnemy(state: TravelCombatState, enemyIndex: number, random: RandomSource) {
  const enemy = state.enemies[enemyIndex];
  if (!enemy) {
    return;
  }
  maybeScoopSalvage(state, enemy, random);
  recordKill(state, enemy);
  state.enemies.splice(enemyIndex, 1);
}

function triggerEnergyBomb(state: TravelCombatState, random: RandomSource) {
  if (!state.playerLoadout.installedEquipment.energy_bomb) {
    return;
  }

  state.playerLoadout.installedEquipment.energy_bomb = false;
  clearEnemyMissiles(state);
  let kills = 0;

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (enemy.missionTag) {
      enemy.energy = Math.max(1, enemy.energy - 50);
      continue;
    }
    if (Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) > 920) {
      continue;
    }
    destroyEnemy(state, index, random);
    kills += 1;
  }

  state.player.shields = clampShields(state.player.shields - 20, state.player.maxShields);
  pushMessage(state, kills > 0 ? `ENERGY BOMB DETONATED: ${kills}` : 'ENERGY BOMB DETONATED', 1200);
}

function stepEnemy(state: TravelCombatState, enemy: CombatEnemy, dt: number, random: RandomSource): boolean {
  applyEnemyHostility(state, enemy);
  enemy.energy = Math.min(enemy.maxEnergy, enemy.energy + 0.08 * dt);

  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const dist = Math.hypot(dx, dy);
  const station = state.station;
  const stationTraffic = station ? isStationTraffic(enemy) : false;
  const safeZoneBoundary = station ? station.safeZoneRadius + SAFE_ZONE_ENEMY_MARGIN : 0;
  const enemyExcludedFromSafeZone = station ? isEnemyExcludedFromSafeZone(enemy) : false;
  const distanceFromStation = station ? getDistanceFromStation(station, enemy.x, enemy.y) : Number.POSITIVE_INFINITY;
  const mustAvoidSafeZone = enemyExcludedFromSafeZone && distanceFromStation <= safeZoneBoundary + SAFE_ZONE_AVOIDANCE_DISTANCE;
  let angleDiff = 0;
  if (!stationTraffic) {
    const targetAngle = mustAvoidSafeZone && station ? getSafeZoneEscapeAngle(station, enemy) : Math.atan2(dy, dx);
    angleDiff = clampAngle(targetAngle - enemy.angle);
    enemy.angle += Math.sign(angleDiff) * enemy.turnRate * dt * (enemy.aggression > 0 ? 1 : 0.4);
  }
  enemy.isFiringLaser = false;

  if (mustAvoidSafeZone && station) {
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * dt * 1.25;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * dt * 1.25;
  } else if (stationTraffic && station) {
    stepStationTraffic(enemy, station, dt);
  } else if (enemy.roles.hostile || enemy.missionTag || enemy.kind === 'thargon') {
    if (dist > 110) {
      enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * dt;
      enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * dt;
    }
  } else if (station) {
    const toStation = Math.atan2(station.y - enemy.y, station.x - enemy.x);
    enemy.angle += Math.sign(clampAngle(toStation - enemy.angle)) * enemy.turnRate * 0.4 * dt;
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * 0.4 * dt;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * 0.4 * dt;
  } else {
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * 0.2 * dt;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * 0.2 * dt;
  }

  const speed = Math.hypot(enemy.vx, enemy.vy);
  if (speed > enemy.topSpeed) {
    enemy.vx = (enemy.vx / speed) * enemy.topSpeed;
    enemy.vy = (enemy.vy / speed) * enemy.topSpeed;
  }

  enemy.vx *= 0.985;
  enemy.vy *= 0.985;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;

  if (stationTraffic && station && isStationTrafficDocked(enemy, station)) {
    return true;
  }

  if (enemyExcludedFromSafeZone && station) {
    keepEnemyOutsideSafeZone(station, enemy);
  }

  enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
  enemy.missileCooldown = Math.max(0, enemy.missileCooldown - dt);

  if (enemyExcludedFromSafeZone && station) {
    const finalDistanceFromStation = getDistanceFromStation(station, enemy.x, enemy.y);
    if (state.encounter.safeZone || finalDistanceFromStation <= safeZoneBoundary + SAFE_ZONE_ENEMY_MARGIN) {
      return false;
    }
  }

  if (!(enemy.roles.hostile || enemy.kind === 'thargon')) {
    return false;
  }

  if (enemy.missileCooldown <= 0 && enemy.missiles > 0 && state.encounter.ecmTimer <= 0) {
    if ((random.nextByte() & 31) < enemy.missiles) {
      enemy.missiles -= 1;
      enemy.missileCooldown = 150;
      if (enemy.blueprintId === 'thargoid') {
        spawnEnemyFromBlueprint(state, 'thargon', random, {
          kind: 'thargon',
          x: enemy.x + Math.cos(enemy.angle) * 24,
          y: enemy.y + Math.sin(enemy.angle) * 24,
          angle: enemy.angle,
          missionTag: enemy.missionTag
        });
      } else {
        spawnEnemyMissile(state, enemy);
      }
    }
  }

  if (dist > enemy.laserRange || enemy.fireCooldown > 0) {
    return false;
  }

  const cnt = estimateCnt(angleDiff);
  if (!canEnemyLaserFireByCnt(cnt) || enemy.laserPower <= 0) {
    return false;
  }

  enemy.isFiringLaser = true;
  enemy.fireCooldown = 45;

  if (!canEnemyLaserHitByCnt(cnt)) {
    return false;
  }

  state.player.shields = clampShields(state.player.shields - enemy.laserPower, state.player.maxShields);
  enemy.vx *= 0.5;
  enemy.vy *= 0.5;
  spawnParticles(state, state.player.x, state.player.y, '#ff5555');
  return false;
}

function moveProjectiles(state: TravelCombatState, dt: number, random: RandomSource) {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const previousX = projectile.x;
    const previousY = projectile.y;
    if (projectile.kind === 'missile' && projectile.owner === 'enemy') {
      const dx = state.player.x - projectile.x;
      const dy = state.player.y - projectile.y;
      const angle = Math.atan2(dy, dx);
      projectile.vx += Math.cos(angle) * 0.16 * dt;
      projectile.vy += Math.sin(angle) * 0.16 * dt;
    }

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;

    let hit = false;
    if (projectile.owner === 'player') {
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = state.enemies[j];
        const distanceSq = (projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2;
        if (distanceSq <= enemy.targetableArea) {
          enemy.energy -= projectile.damage;
          hit = true;
          spawnParticles(state, projectile.x, projectile.y, '#55ff55');
          if (enemy.roles.innocent && state.encounter.safeZone) {
            state.encounter.stationHostile = true;
            state.legalValue = getLegalValueAfterCombat(state.legalValue, 32);
            updateLegalStatus(state);
            pushMessage(state, 'STATION DEFENSE ALERT', 1600);
          }

          if (enemy.energy <= 0) {
            destroyEnemy(state, j, random);
          }
          break;
        }
      }
    } else if (Math.hypot(projectile.x - state.player.x, projectile.y - state.player.y) < state.player.radius + (projectile.kind === 'missile' ? 6 : 0)) {
      state.player.shields = clampShields(state.player.shields - projectile.damage, state.player.maxShields);
      hit = true;
      spawnParticles(state, projectile.x, projectile.y, '#ff5555');
      if (projectile.kind === 'missile' && state.player.shields > 0) {
        pushMessage(state, 'MISSILE IMPACT', 900);
      }
    }

    if (!hit && projectile.kind === 'missile' && projectile.owner === 'enemy' && state.station && state.encounter.safeZone) {
      const previousDistanceFromStation = Math.hypot(previousX - state.station.x, previousY - state.station.y);
      const currentDistanceFromStation = Math.hypot(projectile.x - state.station.x, projectile.y - state.station.y);
      if (previousDistanceFromStation > state.station.safeZoneRadius && currentDistanceFromStation <= state.station.safeZoneRadius) {
        hit = true;
        spawnParticles(state, projectile.x, projectile.y, '#ffff55');
      }
    }

    if (hit || projectile.life <= 0) {
      state.projectiles.splice(i, 1);
    }
  }
}

function stepParticles(state: TravelCombatState, dt: number) {
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

export function stepTravelCombat(
  state: TravelCombatState,
  input: CombatInput,
  dt: number,
  phase: FlightPhase,
  cargo: Record<string, number>,
  random: RandomSource
): CombatTickResult {
  if (phase === 'GAMEOVER') {
    return { state, playerDestroyed: true, playerEscaped: false, autoDocked: false };
  }

  state.encounter.ecmTimer = Math.max(0, state.encounter.ecmTimer - dt);
  state.player.shields = clampShields(state.player.shields + state.player.rechargeRate * dt, state.player.maxShields);

  if (input.activateEcm) {
    activatePlayerEcm(state);
  }
  if (input.triggerEnergyBomb) {
    triggerEnergyBomb(state, random);
  }

  if (state.station) {
    state.station.angle += state.station.rotSpeed * dt;
    state.encounter.safeZone = Math.hypot(state.player.x - state.station.x, state.player.y - state.station.y) <= state.station.safeZoneRadius;
  } else {
    state.encounter.safeZone = false;
  }

  if (phase === 'PLAYING' || phase === 'ARRIVED' || phase === 'READY') {
    state.player.angle += input.turn * 0.08 * dt;
    if (input.thrust > 0) {
      state.player.vx += Math.cos(state.player.angle) * input.thrust * 0.2 * dt;
      state.player.vy += Math.sin(state.player.angle) * input.thrust * 0.2 * dt;
      state.particles.push({
        x: state.player.x - Math.cos(state.player.angle) * 15,
        y: state.player.y - Math.sin(state.player.angle) * 15,
        vx: -state.player.vx * 0.5,
        vy: -state.player.vy * 0.5,
        life: 10,
        color: '#55ff55'
      });
    }

    state.player.vx *= 0.99;
    state.player.vy *= 0.99;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    if (speed > state.player.maxSpeed) {
      state.player.vx = (state.player.vx / speed) * state.player.maxSpeed;
      state.player.vy = (state.player.vy / speed) * state.player.maxSpeed;
    }

    state.player.x += state.player.vx * dt;
    state.player.y += state.player.vy * dt;
    state.player.fireCooldown = Math.max(0, state.player.fireCooldown - dt);
    if (input.fire && state.player.fireCooldown <= 0) {
      const mount = determinePlayerArc(state);
      const laserId = state.playerLoadout.laserMounts[mount];
      if (laserId) {
        spawnPlayerLaser(state, mount, laserId);
      } else {
        state.lastPlayerArc = mount;
      }
    }
  }

  if (phase !== 'JUMPING') {
    state.encounter.rareTimer += dt;
    if (state.encounter.rareTimer >= 256) {
      state.encounter.rareTimer -= 256;
      tryRareEncounter(state, random, cargo);
    }
  }

  if (state.encounter.stationHostile && state.station && state.enemies.filter((enemy) => enemy.roles.cop).length < 2 && random.nextByte() >= 240) {
    spawnCop(state, random, true);
  }

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (!enemy) {
      continue;
    }
    if (stepEnemy(state, enemy, dt, random)) {
      state.enemies.splice(index, 1);
    }
  }

  state.encounter.copsNearby = state.enemies.filter((enemy) => enemy.roles.cop).length;
  moveProjectiles(state, dt, random);
  stepParticles(state, dt);
  updateLegalStatus(state);

  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    state.messages[i].duration -= dt * 16.6667;
    if (state.messages[i].duration <= 0) {
      state.messages.splice(i, 1);
    }
  }

  return {
    state,
    playerDestroyed: state.player.shields <= 0 && !state.playerLoadout.installedEquipment.escape_pod,
    playerEscaped: state.player.shields <= 0 && state.playerLoadout.installedEquipment.escape_pod,
    autoDocked: Boolean(
      input.autoDock &&
      state.playerLoadout.installedEquipment.docking_computer &&
      state.station &&
      state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length === 0 &&
      assessDockingApproach(state.station, state.player).distance <= state.station.safeZoneRadius
    )
  };
}

export function consumeEscapePod(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.escape_pod) {
    return;
  }
  state.playerLoadout.installedEquipment.escape_pod = false;
}

export function getPlayerCombatSnapshot(state: TravelCombatState) {
  return {
    cargo: { ...state.salvageCargo },
    fuel: state.salvageFuel,
    installedEquipment: { ...state.playerLoadout.installedEquipment },
    missilesInstalled: state.playerLoadout.missilesInstalled
  };
}
