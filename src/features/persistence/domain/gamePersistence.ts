import type { CommanderState } from '../../commander/domain/commander';
import type { DockedMarketSession } from '../../market/domain/market';
import type { UniverseState } from '../../../shared/store/types';

export const GAME_SAVE_SCHEMA_VERSION = 4;
// Version 3 saves are still accepted so removing the priority mechanic does
// not invalidate a player's existing local files.
const SUPPORTED_GAME_SAVE_SCHEMA_VERSIONS = new Set([3, 4]);

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

export function buildGameSave(snapshot: GameSnapshot, savedAt = new Date().toISOString(), version = GAME_SAVE_SCHEMA_VERSION): GameSaveFile {
  const snapshotJson = JSON.stringify(snapshot);
  return {
    version,
    checksum: fnv1a32(`${version}:${savedAt}:${snapshotJson}`),
    savedAt,
    snapshot
  };
}

export function serializeGameJson(snapshot: GameSnapshot, savedAt?: string): string {
  return JSON.stringify(buildGameSave(snapshot, savedAt), null, 2);
}

export function loadGameJson(jsonText: string): GameSaveFile {
  const parsed = JSON.parse(jsonText) as GameSaveFile;

  if (!SUPPORTED_GAME_SAVE_SCHEMA_VERSIONS.has(parsed.version)) {
    throw new Error(`Unsupported game save version: ${parsed.version}`);
  }

  const expectedChecksum = buildGameSave(parsed.snapshot, parsed.savedAt, parsed.version).checksum;
  if (expectedChecksum !== parsed.checksum) {
    throw new Error('Game save checksum mismatch');
  }

  return parsed;
}
