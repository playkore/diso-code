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
 * - canonical BBC 1984 derivation of rating from TALLY
 * - preservation of the stored FIST byte while docked
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
    // New commanders begin with a stripped-down Cobra: one energy box fitted
    // and the shield generator left for the outfitting market.
    energyBanks: PLAYER_STARTING_ENERGY_BANKS,
    energyPerBank: PLAYER_SHIP.energyPerBank,
    missileCapacity: PLAYER_SHIP.missileCapacity,
    missilesInstalled: 0,
    laserMounts: createDefaultLaserMounts(),
    installedEquipment: createInstalledEquipmentState(),
    tally: 0,
    // BBC Micro Elite stores TALLY as an integer kill counter, so the visible
    // combat rating is always derived from thresholds rather than persisted as
    // independent progression state.
    rating: getCombatRating(0),
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

/**
 * Maps the BBC Micro 1984 TALLY thresholds onto the classic rank labels.
 *
 * In this ruleset every destroyed ship contributes exactly one kill, so rank
 * progression is a pure function of the integer tally value.
 */
export function getCombatRating(tally: number): CombatRating {
  const normalizedTally = Math.max(0, Math.trunc(tally));
  if (normalizedTally >= 0x1900) {
    return 'Elite';
  }
  if (normalizedTally >= 0x0a00) {
    return 'Deadly';
  }
  if (normalizedTally >= 0x0200) {
    return 'Dangerous';
  }
  if (normalizedTally >= 0x0080) {
    return 'Competent';
  }
  if (normalizedTally >= 0x0040) {
    return 'Above Average';
  }
  if (normalizedTally >= 0x0020) {
    return 'Average';
  }
  if (normalizedTally >= 0x0010) {
    return 'Poor';
  }
  if (normalizedTally >= 0x0008) {
    return 'Mostly Harmless';
  }
  return 'Harmless';
}

export function getLegalStatus(legalValue: number): LegalStatus {
  if (legalValue >= 50) {
    return 'fugitive';
  }

  if (legalValue >= 1) {
    return 'offender';
  }

  return 'clean';
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

/**
 * BBC Elite only forces contraband badness onto FIST when the commander
 * launches. While cargo remains aboard, the legal byte itself still represents
 * the current real status rather than a permanent cargo-derived maximum.
 */
export function applyLaunchLegalFloor(legalValue: number, cargo: Record<string, number>, missionCargo: MissionCargoItem[] = []): number {
  return Math.max(clampLegalValue(legalValue), clampLegalValue(getCargoBadness(cargo) + getMissionCargoLegalBadness(missionCargo)));
}

/**
 * After a successful hyperspace jump, BBC Elite cools FIST by shifting it
 * right one bit. This halves the legal pressure before the next launch.
 */
export function coolLegalValueAfterHyperspace(legalValue: number): number {
  return clampLegalValue(legalValue) >> 1;
}

function legacyLegalValue(status?: string): number {
  if (status === 'fugitive') {
    return 50;
  }

  if (status === 'offender') {
    return 40;
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
  // Legacy saves may only carry a status label, but BBC-style flows treat the
  // numeric FIST byte as the only source of truth while docked. Contraband can
  // temporarily floor it at launch, but normalization must not re-apply that.
  const legacyStatus = 'legalStatus' in commander ? commander.legalStatus : undefined;
  const tally = Math.max(0, Math.trunc(commander.tally ?? 0));
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
    // Persisted rating strings are compatibility baggage only; the canonical
    // BBC status screen always derives rank directly from TALLY.
    rating: getCombatRating(tally),
    currentSystem: commander.currentSystem ?? 'Lave',
    activeMissions: commander.activeMissions ?? [],
    completedMissions: commander.completedMissions ?? [],
    missionCargo: commander.missionCargo ?? []
  };
}
