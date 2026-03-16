import type { MissionVariant } from './missions';

export type LegalStatus = 'clean' | 'offender' | 'fugitive';

export interface CommanderState {
  name: string;
  cash: number;
  fuel: number;
  legalValue: number;
  cargoCapacity: number;
  cargo: Record<string, number>;
  equipment: string[];
  tally: number;
  rating: string;
  currentSystem: string;
  missionTP: number;
  missionVariant: MissionVariant;
}

export function createDefaultCommander(): CommanderState {
  return {
    name: 'Cmdr. Nova',
    cash: 1000,
    fuel: 7,
    legalValue: 0,
    cargoCapacity: 20,
    cargo: {},
    equipment: ['pulseLaser'],
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

export function normalizeCommanderState(commander: CommanderState | (Partial<CommanderState> & { legalStatus?: string })): CommanderState {
  const legacyStatus = 'legalStatus' in commander ? commander.legalStatus : undefined;
  const legalValue = applyLegalFloor(
    typeof commander.legalValue === 'number' ? commander.legalValue : legacyLegalValue(legacyStatus),
    commander.cargo ?? {}
  );

  return {
    name: commander.name ?? 'Cmdr. Nova',
    cash: commander.cash ?? 1000,
    fuel: commander.fuel ?? 7,
    legalValue,
    cargoCapacity: commander.cargoCapacity ?? 20,
    cargo: commander.cargo ?? {},
    equipment: commander.equipment ?? ['pulseLaser'],
    tally: commander.tally ?? 0,
    rating: commander.rating ?? 'Harmless',
    currentSystem: commander.currentSystem ?? 'Lave',
    missionTP: commander.missionTP ?? 0,
    missionVariant: commander.missionVariant ?? 'classic'
  };
}
