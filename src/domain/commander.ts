import type { MissionVariant } from './missions';
import { PLAYER_SHIP, type EquipmentId, type LaserId, type LaserMountPosition, type ShipType } from './shipCatalog';

/**
 * Canonical commander-state model and normalization rules.
 *
 * All save/load, outfitting, and store flows should pass partial or legacy
 * commander objects through `normalizeCommanderState` before persisting them.
 * That function is the authority for:
 * - default values for missing fields
 * - migration from legacy `legalStatus` and `equipment` shapes
 * - minimum legal-value enforcement based on illegal cargo
 * - equipment-derived capacity defaults such as the cargo bay upgrade
 */
export type LegalStatus = 'clean' | 'offender' | 'fugitive';

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
  rating: string;
  currentSystem: string;
  missionTP: number;
  missionVariant: MissionVariant;
}

function createInstalledEquipmentState(installed: EquipmentId[] = []): InstalledEquipmentState {
  return {
    fuel_scoops: installed.includes('fuel_scoops'),
    ecm: installed.includes('ecm'),
    docking_computer: installed.includes('docking_computer'),
    extra_energy_unit: installed.includes('extra_energy_unit'),
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
    energyBanks: PLAYER_SHIP.energyBanks,
    energyPerBank: PLAYER_SHIP.energyPerBank,
    missileCapacity: PLAYER_SHIP.missileCapacity,
    missilesInstalled: 0,
    laserMounts: createDefaultLaserMounts(),
    installedEquipment: createInstalledEquipmentState(),
    tally: 0,
    rating: 'Harmless',
    currentSystem: 'Lave',
    missionTP: 0,
    missionVariant: 'classic'
  };
}

export function cargoUsedTonnes(cargo: Record<string, number>): number {
  return Object.values(cargo).reduce((sum, amount) => sum + Math.max(0, Math.trunc(amount)), 0);
}

export function clampLegalValue(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
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

export function getMinimumLegalValue(cargo: Record<string, number>): number {
  return clampLegalValue(getCargoBadness(cargo));
}

export function applyLegalFloor(legalValue: number, cargo: Record<string, number>): number {
  return Math.max(clampLegalValue(legalValue), getMinimumLegalValue(cargo));
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
  commander: CommanderState | (Partial<CommanderState> & { legalStatus?: string; equipment?: string[] })
): CommanderState {
  // Legacy saves may only carry a status label, but modern flows treat the
  // numeric legal value as the source of truth because cargo can raise it.
  const legacyStatus = 'legalStatus' in commander ? commander.legalStatus : undefined;
  const legalValue = applyLegalFloor(
    typeof commander.legalValue === 'number' ? commander.legalValue : legacyLegalValue(legacyStatus),
    commander.cargo ?? {}
  );
  const legacyEquipment = 'equipment' in commander && Array.isArray(commander.equipment) ? commander.equipment : [];
  const installedEquipment = commander.installedEquipment ?? createInstalledEquipmentState(mapLegacyEquipment(legacyEquipment));
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
    energyBanks: commander.energyBanks ?? PLAYER_SHIP.energyBanks,
    energyPerBank: commander.energyPerBank ?? PLAYER_SHIP.energyPerBank,
    missileCapacity: commander.missileCapacity ?? PLAYER_SHIP.missileCapacity,
    missilesInstalled: commander.missilesInstalled ?? 0,
    laserMounts: {
      ...createDefaultLaserMounts(legacyFrontLaser),
      ...commander.laserMounts
    },
    installedEquipment,
    tally: commander.tally ?? 0,
    rating: commander.rating ?? 'Harmless',
    currentSystem: commander.currentSystem ?? 'Lave',
    missionTP: commander.missionTP ?? 0,
    missionVariant: commander.missionVariant ?? 'classic'
  };
}
