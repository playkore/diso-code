import type { MissionVariant } from './missions';

export type LegalStatus = 'clean' | 'offender' | 'fugitive';

export interface CommanderState {
  name: string;
  cash: number;
  fuel: number;
  legalStatus: LegalStatus;
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
    legalStatus: 'clean',
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
