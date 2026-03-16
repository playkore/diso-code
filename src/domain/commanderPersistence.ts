import { normalizeCommanderState, type CommanderState } from './commander';

export const COMMANDER_SCHEMA_VERSION = 1;

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

  const payload = JSON.stringify(normalized).slice(0, 220);
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

  return normalizeCommanderState(JSON.parse(payloadChars.join('')) as CommanderState);
}
