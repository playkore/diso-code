import type { CommanderState } from './commander';
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_ORDER,
  LASER_CATALOG,
  LASER_ORDER,
  MISSILE_CATALOG,
  PLAYER_SHIP,
  type EquipmentDefinition,
  type EquipmentId,
  type LaserDefinition,
  type LaserId,
  type LaserMountPosition
} from './shipCatalog';

export interface EquipmentOffer extends EquipmentDefinition {
  available: boolean;
  installed: boolean;
  reason?: string;
}

export interface LaserOffer extends LaserDefinition {
  available: boolean;
  reason?: string;
}

export function getFreeCargoSpace(commander: CommanderState): number {
  return Math.max(0, commander.cargoCapacity - Object.values(commander.cargo).reduce((sum, amount) => sum + Math.max(0, Math.trunc(amount)), 0));
}

export function canInstallLaser(
  commander: CommanderState,
  techLevel: number,
  mount: LaserMountPosition,
  laserId: LaserId
): { ok: boolean; reason?: string } {
  const laser = LASER_CATALOG[laserId];
  if (techLevel < laser.requiredTechLevel) {
    return { ok: false, reason: `Requires tech level ${laser.requiredTechLevel}.` };
  }
  if (!laser.mountPositions.includes(mount)) {
    return { ok: false, reason: 'Laser cannot mount on that arc.' };
  }
  if (commander.cash < laser.price) {
    return { ok: false, reason: 'Insufficient credits.' };
  }
  if (commander.laserMounts[mount] === laserId) {
    return { ok: false, reason: 'Laser already installed on that mount.' };
  }
  return { ok: true };
}

export function canBuyEquipment(
  commander: CommanderState,
  techLevel: number,
  equipmentId: EquipmentId
): { ok: boolean; reason?: string } {
  const equipment = EQUIPMENT_CATALOG[equipmentId];
  if (techLevel < equipment.requiredTechLevel) {
    return { ok: false, reason: `Requires tech level ${equipment.requiredTechLevel}.` };
  }
  if (commander.installedEquipment[equipmentId]) {
    return { ok: false, reason: 'Already installed.' };
  }
  if (commander.cash < equipment.price) {
    return { ok: false, reason: 'Insufficient credits.' };
  }
  return { ok: true };
}

export function canBuyMissile(commander: CommanderState, techLevel: number): { ok: boolean; reason?: string } {
  if (techLevel < MISSILE_CATALOG.requiredTechLevel) {
    return { ok: false, reason: `Requires tech level ${MISSILE_CATALOG.requiredTechLevel}.` };
  }
  if (commander.missilesInstalled >= commander.missileCapacity) {
    return { ok: false, reason: 'Missile rack is full.' };
  }
  if (commander.cash < MISSILE_CATALOG.price) {
    return { ok: false, reason: 'Insufficient credits.' };
  }
  return { ok: true };
}

export function isMissileAvailableAtTechLevel(techLevel: number): boolean {
  return techLevel >= MISSILE_CATALOG.requiredTechLevel;
}

export function getAvailableEquipmentForSystem(techLevel: number, commander: CommanderState): EquipmentOffer[] {
  return EQUIPMENT_ORDER.filter((id) => techLevel >= EQUIPMENT_CATALOG[id].requiredTechLevel).map((id) => {
    const equipment = EQUIPMENT_CATALOG[id];
    const result = canBuyEquipment(commander, techLevel, id);
    return {
      ...equipment,
      available: true,
      installed: commander.installedEquipment[id],
      reason: result.ok ? undefined : result.reason
    };
  });
}

export function getLaserOffersForSystem(techLevel: number, commander: CommanderState, mount: LaserMountPosition): LaserOffer[] {
  return LASER_ORDER.filter((id) => techLevel >= LASER_CATALOG[id].requiredTechLevel).map((id) => {
    const laser = LASER_CATALOG[id];
    const result = canInstallLaser(commander, techLevel, mount, id);
    return {
      ...laser,
      available: true,
      reason: result.ok ? undefined : result.reason
    };
  });
}

export function getInstalledEquipmentList(commander: CommanderState): string[] {
  return EQUIPMENT_ORDER.filter((id) => commander.installedEquipment[id]).map((id) => EQUIPMENT_CATALOG[id].name);
}

export function getShipSummaryLines(commander: CommanderState): string[] {
  return [
    PLAYER_SHIP.name,
    `Cargo ${commander.cargoCapacity}/${commander.maxCargoCapacity} t`,
    `Fuel ${commander.fuel.toFixed(1)}/${commander.maxFuel.toFixed(1)} LY`,
    `Energy ${commander.energyBanks}x${commander.energyPerBank}`,
    `Missiles ${commander.missilesInstalled}/${commander.missileCapacity}`
  ];
}
