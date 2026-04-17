import type { BlueprintId } from '../types';
import { xpForEnemyLevel } from '../../../../commander/domain/rpgProgression';

/**
 * Systems on the left side of the galaxy are the safer onboarding space, while
 * systems further right ramp enemy levels toward the late-game range.
 */
export function getSystemRpgLevel(systemX: number) {
  const normalizedX = Math.max(0, Math.min(255, Math.trunc(systemX)));
  return Math.max(1, Math.min(10, Math.floor((normalizedX / 256) * 10) + 1));
}

function getZoneBonus(level: number) {
  if (level <= 3) {
    return 0;
  }
  if (level <= 6) {
    return 1;
  }
  return 2;
}

/**
 * Ship class still matters inside one system, but horizontal galaxy position
 * stays the dominant source of level pressure so the world reads predictably.
 */
function getBlueprintThreatOffset(blueprintId: BlueprintId) {
  switch (blueprintId) {
    case 'sidewinder':
    case 'adder':
    case 'worm':
    case 'cobra-mk3-trader':
    case 'python-trader':
      return 0;
    case 'gecko':
    case 'cobra-mk1':
      return 1;
    case 'krait':
    case 'mamba':
    case 'viper':
    case 'thargon':
      return 2;
    case 'cobra-mk3-pirate':
    case 'asp-mk2':
    case 'python-pirate':
    case 'fer-de-lance':
      return 3;
    case 'constrictor':
    case 'thargoid':
      return 4;
    default:
      return 0;
  }
}

function getBaseKillCredits(blueprintId: BlueprintId) {
  switch (blueprintId) {
    case 'sidewinder':
      return 50;
    case 'adder':
      return 40;
    case 'gecko':
      return 55;
    case 'cobra-mk1':
      return 75;
    case 'worm':
      return 25;
    case 'krait':
      return 100;
    case 'mamba':
      return 150;
    case 'cobra-mk3-pirate':
      return 175;
    case 'asp-mk2':
      return 200;
    case 'python-pirate':
      return 220;
    case 'fer-de-lance':
      return 240;
    case 'constrictor':
      return 320;
    case 'thargoid':
      return 500;
    case 'thargon':
      return 50;
    default:
      return 0;
  }
}

/**
 * Enemy HP / attack / reward scaling is copied from the RPG prototype and then
 * blended with classic ship-class offsets so the current combat roster keeps
 * its recognisable hierarchy without ignoring system position.
 */
export function getEnemyRpgProfile(blueprintId: BlueprintId, systemX: number) {
  const systemLevel = getSystemRpgLevel(systemX);
  const threatOffset = getBlueprintThreatOffset(blueprintId);
  const level = Math.max(1, Math.min(12, systemLevel + threatOffset));
  const zoneBonus = getZoneBonus(level);
  const maxHp = 28 + level * 11 + zoneBonus * 8;
  const attack = 5 + level * 2 + zoneBonus;
  const xpReward = xpForEnemyLevel(level);
  const creditReward = Math.max(getBaseKillCredits(blueprintId), 30 + level * 20 + zoneBonus * 20 + threatOffset * 15);
  return {
    systemLevel,
    level,
    maxHp,
    attack,
    xpReward,
    creditReward
  };
}
