import { normalizeCommanderState, type CommanderState } from './commander';
import type { MissionVariant } from './missions';
import type { LaserId } from './shipCatalog';

export const COMMANDER_SCHEMA_VERSION = 2;

export interface CommanderSaveFile {
  version: number;
  checksum: number;
  commander: CommanderState;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

type CompactCommanderPayload = [
  string,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  Record<string, number>,
  number,
  number,
  number,
  number,
  [LaserId | null, LaserId | null, LaserId | null, LaserId | null],
  number,
  number,
  string,
  string,
  number,
  MissionVariant
];

function encodeInstalledEquipmentBits(commander: CommanderState): number {
  return (
    (commander.installedEquipment.fuel_scoops ? 1 << 0 : 0) |
    (commander.installedEquipment.ecm ? 1 << 1 : 0) |
    (commander.installedEquipment.docking_computer ? 1 << 2 : 0) |
    (commander.installedEquipment.extra_energy_unit ? 1 << 3 : 0) |
    (commander.installedEquipment.large_cargo_bay ? 1 << 4 : 0) |
    (commander.installedEquipment.escape_pod ? 1 << 5 : 0) |
    (commander.installedEquipment.energy_bomb ? 1 << 6 : 0)
  );
}

function decodeInstalledEquipmentBits(bits: number) {
  return {
    fuel_scoops: (bits & (1 << 0)) !== 0,
    ecm: (bits & (1 << 1)) !== 0,
    docking_computer: (bits & (1 << 2)) !== 0,
    extra_energy_unit: (bits & (1 << 3)) !== 0,
    large_cargo_bay: (bits & (1 << 4)) !== 0,
    escape_pod: (bits & (1 << 5)) !== 0,
    energy_bomb: (bits & (1 << 6)) !== 0
  };
}

function toCompactPayload(commander: CommanderState): CompactCommanderPayload {
  return [
    commander.name,
    commander.cash,
    commander.fuel,
    commander.maxFuel,
    commander.legalValue,
    commander.baseCargoCapacity,
    commander.cargoCapacity,
    commander.maxCargoCapacity,
    commander.cargo,
    commander.energyBanks,
    commander.energyPerBank,
    commander.missileCapacity,
    commander.missilesInstalled,
    [
      commander.laserMounts.front,
      commander.laserMounts.rear,
      commander.laserMounts.left,
      commander.laserMounts.right
    ],
    encodeInstalledEquipmentBits(commander),
    commander.tally,
    commander.rating,
    commander.currentSystem,
    commander.missionTP,
    commander.missionVariant
  ];
}

function fromCompactPayload(payload: CompactCommanderPayload): CommanderState {
  return normalizeCommanderState({
    name: payload[0],
    cash: payload[1],
    fuel: payload[2],
    maxFuel: payload[3],
    legalValue: payload[4],
    baseCargoCapacity: payload[5],
    cargoCapacity: payload[6],
    maxCargoCapacity: payload[7],
    cargo: payload[8],
    energyBanks: payload[9],
    energyPerBank: payload[10],
    missileCapacity: payload[11],
    missilesInstalled: payload[12],
    laserMounts: {
      front: payload[13][0],
      rear: payload[13][1],
      left: payload[13][2],
      right: payload[13][3]
    },
    installedEquipment: decodeInstalledEquipmentBits(payload[14]),
    tally: payload[15],
    rating: payload[16],
    currentSystem: payload[17],
    missionTP: payload[18],
    missionVariant: payload[19]
  });
}

export function buildCommanderSave(commander: CommanderState): CommanderSaveFile {
  const normalized = normalizeCommanderState(commander);
  const commanderJson = JSON.stringify(normalized);
  return {
    version: COMMANDER_SCHEMA_VERSION,
    checksum: fnv1a32(`${COMMANDER_SCHEMA_VERSION}:${commanderJson}`),
    commander: normalized
  };
}

export function serializeCommanderJson(commander: CommanderState): string {
  return JSON.stringify(buildCommanderSave(commander), null, 2);
}

export function loadCommanderJson(jsonText: string): CommanderState {
  const parsed = JSON.parse(jsonText) as CommanderSaveFile;

  if (parsed.version !== COMMANDER_SCHEMA_VERSION) {
    throw new Error(`Unsupported commander save version: ${parsed.version}`);
  }

  const commander = normalizeCommanderState(parsed.commander);
  const expectedChecksum = buildCommanderSave(commander).checksum;
  if (expectedChecksum !== parsed.checksum) {
    throw new Error('Commander save checksum mismatch');
  }

  return commander;
}

export function encodeCommanderBinary256(commander: CommanderState): Uint8Array {
  const normalized = normalizeCommanderState(commander);
  const bytes = new Uint8Array(256);
  const view = new DataView(bytes.buffer);

  view.setUint32(0, COMMANDER_SCHEMA_VERSION, true);
  view.setUint32(4, normalized.cash, true);
  view.setFloat32(8, normalized.fuel, true);
  view.setUint8(12, normalized.missionTP & 0xff);
  view.setUint16(13, normalized.tally & 0xffff, true);

  const name = normalized.name.slice(0, 20);
  for (let i = 0; i < name.length; i += 1) {
    view.setUint8(16 + i, name.charCodeAt(i) & 0xff);
  }

  const payload = JSON.stringify(toCompactPayload(normalized));
  if (payload.length > 216) {
    throw new Error('Commander payload exceeds 256-byte binary save capacity');
  }
  for (let i = 0; i < payload.length; i += 1) {
    view.setUint8(36 + i, payload.charCodeAt(i) & 0xff);
  }

  const checksum = fnv1a32(Array.from(bytes.slice(0, 252)).join(','));
  view.setUint32(252, checksum, true);

  return bytes;
}

export function decodeCommanderBinary256(bytes: Uint8Array): CommanderState {
  if (bytes.length !== 256) {
    throw new Error('Expected 256-byte commander binary');
  }

  const view = new DataView(bytes.buffer);
  const checksum = view.getUint32(252, true);
  const expected = fnv1a32(Array.from(bytes.slice(0, 252)).join(','));

  if (checksum !== expected) {
    throw new Error('Commander binary checksum mismatch');
  }

  const payloadChars: string[] = [];
  for (let i = 36; i < 252; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) {
      break;
    }
    payloadChars.push(String.fromCharCode(code));
  }

  return fromCompactPayload(JSON.parse(payloadChars.join('')) as CompactCommanderPayload);
}
