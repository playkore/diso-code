import { normalizeCommanderState, type CommanderState } from './commander';
import type { LaserId } from './shipCatalog';

/**
 * Persistence adapters for commander saves.
 *
 * The game keeps two wire formats in parallel:
 * - a readable JSON wrapper used by browser storage and export/import flows
 * - a fixed 256-byte binary image that mimics classic compact save files
 *
 * Both formats normalize commander state before encoding so legacy inputs are
 * upgraded once at the boundary, then protected with checksums on readback.
 */
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
  string
];

/**
 * The compact payload packs boolean equipment flags into a single integer so
 * the JSON string stored inside the binary format stays below the 216-byte
 * payload budget.
 */
function encodeInstalledEquipmentBits(commander: CommanderState): number {
  return (
    (commander.installedEquipment.shield_generator ? 1 << 0 : 0) |
    (commander.installedEquipment.fuel_scoops ? 1 << 1 : 0) |
    (commander.installedEquipment.ecm ? 1 << 2 : 0) |
    (commander.installedEquipment.docking_computer ? 1 << 3 : 0) |
    (commander.installedEquipment.extra_energy_unit ? 1 << 4 : 0) |
    (commander.installedEquipment.energy_box_2 ? 1 << 5 : 0) |
    (commander.installedEquipment.energy_box_3 ? 1 << 6 : 0) |
    (commander.installedEquipment.energy_box_4 ? 1 << 7 : 0) |
    (commander.installedEquipment.large_cargo_bay ? 1 << 8 : 0) |
    (commander.installedEquipment.escape_pod ? 1 << 9 : 0) |
    (commander.installedEquipment.energy_bomb ? 1 << 10 : 0)
  );
}

function decodeInstalledEquipmentBits(bits: number) {
  return {
    shield_generator: (bits & (1 << 0)) !== 0,
    fuel_scoops: (bits & (1 << 1)) !== 0,
    ecm: (bits & (1 << 2)) !== 0,
    docking_computer: (bits & (1 << 3)) !== 0,
    extra_energy_unit: (bits & (1 << 4)) !== 0,
    energy_box_2: (bits & (1 << 5)) !== 0,
    energy_box_3: (bits & (1 << 6)) !== 0,
    energy_box_4: (bits & (1 << 7)) !== 0,
    large_cargo_bay: (bits & (1 << 8)) !== 0,
    escape_pod: (bits & (1 << 9)) !== 0,
    energy_bomb: (bits & (1 << 10)) !== 0
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
    commander.currentSystem
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
    currentSystem: payload[17]
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

  // Offsets 0-15 are reserved for fixed-width header fields that are cheap to
  // inspect without decoding the trailing JSON payload.
  view.setUint32(0, COMMANDER_SCHEMA_VERSION, true);
  view.setUint32(4, normalized.cash, true);
  view.setFloat32(8, normalized.fuel, true);
  // The binary format intentionally stays mission-agnostic so it can keep the
  // original fixed-size footprint even as the richer JSON snapshot evolves.
  view.setUint8(12, 0);
  view.setUint16(13, normalized.tally & 0xffff, true);

  // The visible commander name gets its own ASCII slot so old tooling can read
  // it even if it ignores the compact payload entirely.
  const name = normalized.name.slice(0, 20);
  for (let i = 0; i < name.length; i += 1) {
    view.setUint8(16 + i, name.charCodeAt(i) & 0xff);
  }

  // Offsets 36-251 hold the compact JSON payload. The serializer relies on the
  // tuple layout above staying append-only compatible with future readers.
  const payload = JSON.stringify(toCompactPayload(normalized));
  if (payload.length > 216) {
    throw new Error('Commander payload exceeds 256-byte binary save capacity');
  }
  for (let i = 0; i < payload.length; i += 1) {
    view.setUint8(36 + i, payload.charCodeAt(i) & 0xff);
  }

  // The checksum covers every byte except the checksum field itself at 252-255.
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
  // Payload bytes are null-padded, so decoding stops at the first zero byte.
  for (let i = 36; i < 252; i += 1) {
    const code = view.getUint8(i);
    if (code === 0) {
      break;
    }
    payloadChars.push(String.fromCharCode(code));
  }

  return fromCompactPayload(JSON.parse(payloadChars.join('')) as CompactCommanderPayload);
}
