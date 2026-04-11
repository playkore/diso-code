import type { BlueprintFileId, BlueprintId } from '../types';

const BLUEPRINT_FILES: Record<BlueprintFileId, BlueprintId[]> = {
  A: ['sidewinder', 'mamba', 'cobra-mk3-trader', 'python-trader', 'viper'],
  B: ['sidewinder', 'adder', 'cobra-mk3-trader', 'python-trader', 'viper'],
  C: ['sidewinder', 'mamba', 'krait', 'thargoid', 'thargon', 'viper'],
  D: ['adder', 'gecko', 'cobra-mk1', 'thargoid', 'thargon', 'viper'],
  E: ['sidewinder', 'mamba', 'krait', 'adder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate'],
  F: ['sidewinder', 'mamba', 'adder', 'cobra-mk1', 'cobra-mk3-pirate', 'asp-mk2'],
  G: ['sidewinder', 'krait', 'gecko', 'worm', 'cobra-mk3-pirate', 'asp-mk2'],
  H: ['sidewinder', 'mamba', 'cobra-mk1', 'worm', 'cobra-mk3-pirate', 'fer-de-lance'],
  I: ['cobra-mk3-trader', 'python-trader', 'viper', 'sidewinder', 'adder'],
  J: ['cobra-mk3-trader', 'python-trader', 'viper', 'mamba', 'gecko'],
  K: ['cobra-mk3-trader', 'python-trader', 'viper', 'cobra-mk1', 'asp-mk2'],
  L: ['cobra-mk3-trader', 'python-trader', 'viper', 'cobra-mk3-pirate', 'fer-de-lance'],
  M: ['sidewinder', 'mamba', 'krait', 'adder', 'cobra-mk1', 'cobra-mk3-pirate', 'python-pirate'],
  N: ['sidewinder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate', 'python-pirate'],
  O: ['mamba', 'krait', 'cobra-mk3-pirate', 'asp-mk2', 'fer-de-lance', 'viper'],
  P: ['adder', 'gecko', 'cobra-mk3-pirate', 'python-pirate', 'fer-de-lance', 'viper']
};

const PACK_SEQUENCE: BlueprintId[] = ['sidewinder', 'mamba', 'krait', 'adder', 'gecko', 'cobra-mk1', 'worm', 'cobra-mk3-pirate'];
const LONE_BOUNTY_SEQUENCE: BlueprintId[] = ['cobra-mk3-pirate', 'asp-mk2', 'python-pirate', 'fer-de-lance'];

export function getBlueprintAvailability(fileId: BlueprintFileId): BlueprintId[] {
  return [...BLUEPRINT_FILES[fileId]];
}

export function getAvailablePackHunters(fileId: BlueprintFileId): BlueprintId[] {
  return BLUEPRINT_FILES[fileId].filter((blueprintId) => PACK_SEQUENCE.includes(blueprintId));
}

export function getPackSequence() {
  return PACK_SEQUENCE;
}

export function getLoneBountySequence() {
  return LONE_BOUNTY_SEQUENCE;
}
