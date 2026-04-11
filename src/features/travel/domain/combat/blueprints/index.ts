import { adderBlueprint } from './adder';
import { aspMk2Blueprint } from './aspMk2';
import { cobraMk1Blueprint } from './cobraMk1';
import { cobraMk3PirateBlueprint } from './cobraMk3Pirate';
import { cobraMk3TraderBlueprint } from './cobraMk3Trader';
import { constrictorBlueprint } from './constrictor';
import { ferDeLanceBlueprint } from './ferDeLance';
import { geckoBlueprint } from './gecko';
import { kraitBlueprint } from './krait';
import { mambaBlueprint } from './mamba';
import { pythonPirateBlueprint } from './pythonPirate';
import { pythonTraderBlueprint } from './pythonTrader';
import { sidewinderBlueprint } from './sidewinder';
import { thargoidBlueprint } from './thargoid';
import { thargonBlueprint } from './thargon';
import { viperBlueprint } from './viper';
import { wormBlueprint } from './worm';
import type { BlueprintId, CombatBlueprint } from '../types';

export const BLUEPRINTS: Record<BlueprintId, CombatBlueprint> = {
  sidewinder: sidewinderBlueprint,
  mamba: mambaBlueprint,
  krait: kraitBlueprint,
  adder: adderBlueprint,
  gecko: geckoBlueprint,
  'cobra-mk1': cobraMk1Blueprint,
  worm: wormBlueprint,
  'cobra-mk3-pirate': cobraMk3PirateBlueprint,
  'cobra-mk3-trader': cobraMk3TraderBlueprint,
  'asp-mk2': aspMk2Blueprint,
  'python-pirate': pythonPirateBlueprint,
  'python-trader': pythonTraderBlueprint,
  'fer-de-lance': ferDeLanceBlueprint,
  viper: viperBlueprint,
  constrictor: constrictorBlueprint,
  thargoid: thargoidBlueprint,
  thargon: thargonBlueprint
};

export function getCombatBlueprint(id: BlueprintId): CombatBlueprint {
  return BLUEPRINTS[id];
}
