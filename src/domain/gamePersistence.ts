import type { CommanderState } from './commander';
import type { DockedMarketSession } from './market';
import type { UniverseState } from '../store/types';

export const GAME_SAVE_SCHEMA_VERSION = 1;

export interface GameSnapshot {
  commander: CommanderState;
  universe: UniverseState;
  marketSession: DockedMarketSession;
}

export interface GameSaveFile {
  version: number;
  checksum: number;
  savedAt: string;
  snapshot: GameSnapshot;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function buildGameSave(snapshot: GameSnapshot, savedAt = new Date().toISOString()): GameSaveFile {
  const snapshotJson = JSON.stringify(snapshot);
  return {
    version: GAME_SAVE_SCHEMA_VERSION,
    checksum: fnv1a32(`${GAME_SAVE_SCHEMA_VERSION}:${savedAt}:${snapshotJson}`),
    savedAt,
    snapshot
  };
}

export function serializeGameJson(snapshot: GameSnapshot, savedAt?: string): string {
  return JSON.stringify(buildGameSave(snapshot, savedAt), null, 2);
}

export function loadGameJson(jsonText: string): GameSaveFile {
  const parsed = JSON.parse(jsonText) as GameSaveFile;

  if (parsed.version !== GAME_SAVE_SCHEMA_VERSION) {
    throw new Error(`Unsupported game save version: ${parsed.version}`);
  }

  const expectedChecksum = buildGameSave(parsed.snapshot, parsed.savedAt).checksum;
  if (expectedChecksum !== parsed.checksum) {
    throw new Error('Game save checksum mismatch');
  }

  return parsed;
}
