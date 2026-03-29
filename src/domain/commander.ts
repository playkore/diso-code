import type { MissionCargoItem, MissionHistoryEntry, MissionInstance } from './missions';
import { PLAYER_SHIP, type EquipmentId, type LaserId, type LaserMountPosition, type ShipType } from './shipCatalog';

/**
 * Canonical commander-state model and normalization rules.
 *
 * All save/load, outfitting, and store flows should pass partial or legacy
 * commander objects through `normalizeCommanderState` before persisting them.
 * That function is the authority for:
 * - default values for missing fields
 * - migration from legacy `legalStatus` and `equipment` shapes
 * - canonical DOS Elite Plus derivation of rating from a dedicated rank score
 * - preservation of the stored legal byte across docked saves
 * - equipment-derived capacity defaults such as the cargo bay upgrade
 */
export type LegalStatus = 'clean' | 'offender' | 'fugitive';
export type CombatRating =
  | 'Harmless'
  | 'Mostly Harmless'
  | 'Poor'
  | 'Average'
  | 'Above Average'
  | 'Competent'
  | 'Dangerous'
  | 'Deadly'
  | 'Elite';

interface CombatRatingThreshold {
  minimumScore: number;
  label: CombatRating;
}

export type LaserMountState = Record<LaserMountPosition, LaserId | null>;
export type InstalledEquipmentState = Record<EquipmentId, boolean>;

export interface CommanderState {
  name: string;
  cash: number;
  fuel: number;
  maxFuel: number;
  legalValue: number;
  shipType: ShipType;
  baseCargoCapacity: number;
  cargoCapacity: number;
  maxCargoCapacity: number;
  cargo: Record<string, number>;
  energyBanks: number;
  energyPerBank: number;
  missileCapacity: number;
  missilesInstalled: number;
  laserMounts: LaserMountState;
  installedEquipment: InstalledEquipmentState;
  tally: number;
  combatRatingScore: number;
  rating: CombatRating;
  currentSystem: string;
  activeMissions: MissionInstance[];
  completedMissions: MissionHistoryEntry[];
  missionCargo: MissionCargoItem[];
}

export const PLAYER_STARTING_ENERGY_BANKS = 1;

function createInstalledEquipmentState(installed: EquipmentId[] = []): InstalledEquipmentState {
  return {
    shield_generator: installed.includes('shield_generator'),
    fuel_scoops: installed.includes('fuel_scoops'),
    ecm: installed.includes('ecm'),
    docking_computer: installed.includes('docking_computer'),
    galactic_hyperdrive: installed.includes('galactic_hyperdrive'),
    extra_energy_unit: installed.includes('extra_energy_unit'),
    energy_box_2: installed.includes('energy_box_2'),
    energy_box_3: installed.includes('energy_box_3'),
    energy_box_4: installed.includes('energy_box_4'),
    large_cargo_bay: installed.includes('large_cargo_bay'),
    escape_pod: installed.includes('escape_pod'),
    energy_bomb: installed.includes('energy_bomb')
  };
}

function createDefaultLaserMounts(front: LaserId | null = PLAYER_SHIP.defaultLasers.front): LaserMountState {
  return {
    front,
    rear: PLAYER_SHIP.defaultLasers.rear,
    left: PLAYER_SHIP.defaultLasers.left,
    right: PLAYER_SHIP.defaultLasers.right
  };
}

export function createDefaultCommander(): CommanderState {
  return {
    name: 'Cmdr. Nova',
    cash: 1000,
    fuel: PLAYER_SHIP.maxFuel,
    maxFuel: PLAYER_SHIP.maxFuel,
    legalValue: 0,
    shipType: PLAYER_SHIP.id,
    baseCargoCapacity: PLAYER_SHIP.baseCargoCapacity,
    cargoCapacity: PLAYER_SHIP.baseCargoCapacity,
    maxCargoCapacity: PLAYER_SHIP.maxCargoCapacity,
    cargo: {},
    // New commanders begin with a stripped-down Cobra so the current
    // outfitting loop still has early upgrades to sell.
    energyBanks: PLAYER_STARTING_ENERGY_BANKS,
    energyPerBank: PLAYER_SHIP.energyPerBank,
    missileCapacity: PLAYER_SHIP.missileCapacity,
    missilesInstalled: 0,
    laserMounts: createDefaultLaserMounts(),
    installedEquipment: createInstalledEquipmentState(),
    tally: 0,
    // DOS Elite Plus stores rating progression separately from the visible
    // label, so rank is derived from this dedicated score rather than from the
    // legacy tally field.
    combatRatingScore: 0,
    rating: getDosCombatRating(0),
    currentSystem: 'Lave',
    activeMissions: [],
    completedMissions: [],
    missionCargo: []
  };
}

export function cargoUsedTonnes(cargo: Record<string, number>): number {
  return Object.values(cargo).reduce((sum, amount) => sum + Math.max(0, Math.trunc(amount)), 0);
}

/**
 * Mission cargo can reserve hold space independently of normal market goods.
 * The tonnage is explicit per item so documents can consume 0 t while a rescue
 * payload or decoy crates use real hold capacity.
 */
export function missionCargoUsedTonnes(missionCargo: MissionCargoItem[]): number {
  return missionCargo.reduce((sum, item) => sum + Math.max(0, Math.trunc(item.amount)) * Math.max(0, item.tonnagePerUnit), 0);
}

export function totalCargoUsedTonnes(cargo: Record<string, number>, missionCargo: MissionCargoItem[]): number {
  return cargoUsedTonnes(cargo) + missionCargoUsedTonnes(missionCargo);
}

export function clampLegalValue(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
}

const DOS_COMBAT_RATING_THRESHOLDS: CombatRatingThreshold[] = [
  { minimumScore: 0, label: 'Harmless' },
  { minimumScore: 2, label: 'Mostly Harmless' },
  { minimumScore: 4, label: 'Poor' },
  { minimumScore: 9, label: 'Average' },
  { minimumScore: 20, label: 'Above Average' },
  { minimumScore: 35, label: 'Competent' },
  { minimumScore: 90, label: 'Dangerous' },
  { minimumScore: 155, label: 'Deadly' },
  { minimumScore: 1000, label: 'Elite' }
];

/**
 * Maps DOS Elite Plus rating-score thresholds onto the classic rank labels.
 *
 * Elite Plus stores a separate numeric rank score and uses DOS-specific
 * thresholds rather than the BBC 1984 TALLY cutoffs.
 */
export function getDosCombatRating(score: number): CombatRating {
  const normalizedScore = Math.max(0, Math.trunc(score));
  for (let index = DOS_COMBAT_RATING_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (normalizedScore >= DOS_COMBAT_RATING_THRESHOLDS[index].minimumScore) {
      return DOS_COMBAT_RATING_THRESHOLDS[index].label;
    }
  }
  return 'Harmless';
}

/**
 * Returns the current DOS rating band and normalized progress within that band.
 *
 * The status screen uses this to show how far the commander is from the next
 * Elite Plus rank without duplicating threshold math in the UI layer.
 */
export function getDosCombatRatingProgress(score: number) {
  const normalizedScore = Math.max(0, Math.trunc(score));
  let currentIndex = 0;
  for (let index = DOS_COMBAT_RATING_THRESHOLDS.length - 1; index >= 0; index -= 1) {
    if (normalizedScore >= DOS_COMBAT_RATING_THRESHOLDS[index].minimumScore) {
      currentIndex = index;
      break;
    }
  }
  const current = DOS_COMBAT_RATING_THRESHOLDS[Math.max(0, currentIndex)] ?? DOS_COMBAT_RATING_THRESHOLDS[0];
  const next = DOS_COMBAT_RATING_THRESHOLDS[currentIndex + 1] ?? null;
  if (!next) {
    return {
      current: current.label,
      next: null,
      progressRatio: 1,
      remainingScore: 0
    };
  }
  const bandSize = Math.max(1, next.minimumScore - current.minimumScore);
  const progressRatio = Math.max(0, Math.min(1, (normalizedScore - current.minimumScore) / bandSize));
  return {
    current: current.label,
    next: next.label,
    progressRatio,
    remainingScore: Math.max(0, next.minimumScore - normalizedScore)
  };
}

/**
 * Elite Plus savegames only persist Clean and Offender because saving is
 * docked-only. Docked screens therefore project any positive legal byte as
 * Offender, while the flight HUD can still escalate higher values to Fugitive.
 */
export function getLegalStatus(legalValue: number, options: { docked?: boolean } = {}): LegalStatus {
  const normalizedLegalValue = clampLegalValue(legalValue);
  if (normalizedLegalValue <= 0) {
    return 'clean';
  }
  if (options.docked) {
    return 'offender';
  }
  if (normalizedLegalValue >= 16) {
    return 'fugitive';
  }
  return 'offender';
}

export function getCargoBadness(cargo: Record<string, number>): number {
  const slaves = Math.max(0, Math.trunc(cargo.slaves ?? 0));
  const narcotics = Math.max(0, Math.trunc(cargo.narcotics ?? 0));
  const firearms = Math.max(0, Math.trunc(cargo.firearms ?? 0));

  return (slaves + narcotics) * 2 + firearms;
}

export function getMissionCargoLegalBadness(missionCargo: MissionCargoItem[]): number {
  return missionCargo.reduce(
    (sum, item) => sum + Math.max(0, Math.trunc(item.amount)) * Math.max(0, Math.trunc(item.legalBadnessPerUnit)),
    0
  );
}

export function getMinimumLegalValue(cargo: Record<string, number>): number {
  return clampLegalValue(getCargoBadness(cargo));
}

function legacyLegalValue(status?: string): number {
  if (status === 'fugitive') {
    return 16;
  }

  if (status === 'offender') {
    return 1;
  }

  return 0;
}

function deriveEnergyBanks(installedEquipment: InstalledEquipmentState, explicitEnergyBanks?: number): number {
  if (typeof explicitEnergyBanks === 'number') {
    return Math.max(PLAYER_STARTING_ENERGY_BANKS, Math.min(PLAYER_SHIP.energyBanks, Math.trunc(explicitEnergyBanks)));
  }

  // Energy boxes are purchased in sequence, so the first missing upgrade caps
  // the effective bank count even if a malformed save has later flags set.
  let banks = PLAYER_STARTING_ENERGY_BANKS;
  if (installedEquipment.energy_box_2) {
    banks = 2;
  } else {
    return banks;
  }
  if (installedEquipment.energy_box_3) {
    banks = 3;
  } else {
    return banks;
  }
  if (installedEquipment.energy_box_4) {
    banks = 4;
  }
  return banks;
}

// Older save formats stored equipment as ad-hoc camelCase strings. They are
// translated once here so the rest of the app can stay on typed catalog ids.
function mapLegacyEquipment(legacyEquipment: string[]): EquipmentId[] {
  return legacyEquipment.flatMap((entry) => {
    switch (entry) {
      case 'fuelScoops':
        return ['fuel_scoops'];
      case 'ecm':
        return ['ecm'];
      case 'dockingComputer':
        return ['docking_computer'];
      case 'energyUnit':
        return ['extra_energy_unit'];
      case 'cargoExpansion':
        return ['large_cargo_bay'];
      case 'escapePod':
        return ['escape_pod'];
      case 'energyBomb':
        return ['energy_bomb'];
      default:
        return [];
    }
  });
}

export function normalizeCommanderState(
  commander:
    | CommanderState
    | (Partial<CommanderState> & { legalStatus?: string; equipment?: string[]; missionTP?: number; missionVariant?: string; rating?: string })
): CommanderState {
  // Legacy saves may only carry a status label. Elite Plus keeps the raw legal
  // byte as stored state and derives the docked label from it later.
  const legacyStatus = 'legalStatus' in commander ? commander.legalStatus : undefined;
  const tally = Math.max(0, Math.trunc(commander.tally ?? 0));
  const combatRatingScore = Math.max(
    0,
    Math.trunc(typeof commander.combatRatingScore === 'number' ? commander.combatRatingScore : tally)
  );
  const legalValue = clampLegalValue(typeof commander.legalValue === 'number' ? commander.legalValue : legacyLegalValue(legacyStatus));
  const legacyEquipment = 'equipment' in commander && Array.isArray(commander.equipment) ? commander.equipment : [];
  // New equipment ids can appear after an old save was written, so the
  // normalized commander always merges persisted flags onto a full default map.
  const installedEquipment = {
    ...createInstalledEquipmentState(mapLegacyEquipment(legacyEquipment)),
    ...commander.installedEquipment
  };
  // Cargo capacity defaults from installed equipment unless a caller already
  // provided an explicit capacity, which lets restored saves keep custom values.
  const cargoCapacity =
    commander.cargoCapacity ??
    (installedEquipment.large_cargo_bay ? PLAYER_SHIP.maxCargoCapacity : PLAYER_SHIP.baseCargoCapacity);
  const legacyFrontLaser: LaserId | null = legacyEquipment.includes('pulseLaser') ? 'pulse_laser' : PLAYER_SHIP.defaultLasers.front;

  return {
    name: commander.name ?? 'Cmdr. Nova',
    cash: commander.cash ?? 1000,
    fuel: commander.fuel ?? PLAYER_SHIP.maxFuel,
    maxFuel: commander.maxFuel ?? PLAYER_SHIP.maxFuel,
    legalValue,
    shipType: commander.shipType ?? PLAYER_SHIP.id,
    baseCargoCapacity: commander.baseCargoCapacity ?? PLAYER_SHIP.baseCargoCapacity,
    cargoCapacity,
    maxCargoCapacity: commander.maxCargoCapacity ?? PLAYER_SHIP.maxCargoCapacity,
    cargo: commander.cargo ?? {},
    energyBanks: deriveEnergyBanks(installedEquipment, commander.energyBanks),
    energyPerBank: commander.energyPerBank ?? PLAYER_SHIP.energyPerBank,
    missileCapacity: commander.missileCapacity ?? PLAYER_SHIP.missileCapacity,
    missilesInstalled: commander.missilesInstalled ?? 0,
    laserMounts: {
      ...createDefaultLaserMounts(legacyFrontLaser),
      ...commander.laserMounts
    },
    installedEquipment,
    tally,
    combatRatingScore,
    // Persisted rating strings are compatibility baggage only; Elite Plus
    // recalculates the visible rank from its dedicated combat score.
    rating: getDosCombatRating(combatRatingScore),
    currentSystem: commander.currentSystem ?? 'Lave',
    activeMissions: commander.activeMissions ?? [],
    completedMissions: commander.completedMissions ?? [],
    missionCargo: commander.missionCargo ?? []
  };
}
