import { getLegalStatus, type CommanderState } from '../../../commander/domain/commander';
import { xpToNextLevel } from '../../../commander/domain/rpgProgression';
import type { MissionTravelContext } from '../../domain/missionContext';
import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';
import { getCgaBarFillColor } from './renderers/bars';
import { CGA_YELLOW } from './renderers/constants';

/**
 * Maps combat simulation data into HUD-friendly strings.
 *
 * Keeping this translation separate lets the simulation stay numeric while the
 * UI decides how to present drive states, threat counts, and weapon cues.
 */
export interface TravelDriveStatus {
  jump: string;
  hyperspace: string;
}

export interface TravelHudState {
  level: number;
  hpRatio: number;
  hpColor: string;
  hpLabel: string;
  xpRatio: number;
  xpColor: string;
  xpLabel: string;
  attackLabel: string;
  jump: string;
  hyperspace: string;
  legal: string;
  hostileCount: number;
  threat: string;
  arc: string;
  bombVisible: boolean;
  lasersActive: boolean;
}

export function getDriveStatus(flightState: FlightPhase, options: { jumpBlocked: boolean; hyperspaceBlocked: boolean; jumpCompleted: boolean }): TravelDriveStatus {
  const jump = flightState === 'JUMPING' ? 'ENGAGED' : options.jumpBlocked ? 'MASS LOCK' : 'READY';
  const hyperspace =
    options.jumpCompleted ? 'COMPLETE' : flightState === 'HYPERSPACE' ? 'ENGAGED' : options.hyperspaceBlocked ? 'SAFE ZONE' : 'READY';
  return { jump, hyperspace };
}

export function getHudState(
  state: TravelCombatState,
  flightState: FlightPhase,
  options: { jumpBlocked: boolean; hyperspaceBlocked: boolean; jumpCompleted: boolean }
): TravelHudState {
  const hostileCount = state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length;
  const drives = getDriveStatus(flightState, options);
  const hpRatio = state.player.maxHp > 0 ? state.player.hp / state.player.maxHp : 0;
  const xpThreshold = xpToNextLevel(state.player.level);
  const xpRatio = xpThreshold > 0 ? state.player.xp / xpThreshold : 1;
  const bombVisible = state.playerLoadout.installedEquipment.energy_bomb;
  return {
    level: state.player.level,
    hpRatio: Math.max(0, Math.min(1, hpRatio)),
    hpColor: getCgaBarFillColor(hpRatio),
    hpLabel: `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`,
    xpRatio: Math.max(0, Math.min(1, xpRatio)),
    xpColor: CGA_YELLOW,
    xpLabel: `${state.player.xp} / ${xpThreshold}`,
    attackLabel: `${state.player.attack}`,
    jump: drives.jump,
    hyperspace: drives.hyperspace,
    legal: `${getLegalStatus(state.legalValue, { docked: false })} ${state.legalValue}`,
    hostileCount,
    threat: `F${state.encounter.activeBlueprintFile} / ${hostileCount} / L${state.currentSystemLevel}`,
    arc: `${state.lastPlayerArc.toUpperCase()} ${state.encounter.ecmTimer > 0 ? ' ECM' : ''}${bombVisible ? ' BOMB' : ''}`,
    bombVisible,
    lasersActive: state.playerLasersActive
  };
}

export function createCombatInit(
  commander: CommanderState,
  originSystem: { government: number; techLevel: number; x: number },
  missionContext: MissionTravelContext
) {
  return {
    legalValue: Math.max(commander.legalValue, 0),
    government: originSystem.government,
    techLevel: originSystem.techLevel,
    systemX: originSystem.x,
    missionContext,
    level: commander.level,
    xp: commander.xp,
    hp: commander.hp,
    maxHp: commander.maxHp,
    attack: commander.attack,
    laserMounts: commander.laserMounts,
    installedEquipment: commander.installedEquipment,
    missilesInstalled: commander.missilesInstalled
  };
}
