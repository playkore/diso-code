import { getLegalStatus, type CommanderState } from '../../domain/commander';
import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';

export interface TravelDriveStatus {
  jump: string;
  hyperspace: string;
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
) {
  const hostileCount = state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length;
  const drives = getDriveStatus(flightState, options);
  return {
    score: String(state.score),
    shields: String(Math.max(0, Math.round(state.player.shields))),
    jump: drives.jump,
    hyperspace: drives.hyperspace,
    legal: `${getLegalStatus(state.legalValue)} ${state.legalValue}`,
    hostileCount,
    threat: `F${state.encounter.activeBlueprintFile} / ${hostileCount}`,
    arc: `${state.lastPlayerArc.toUpperCase()} ${state.encounter.ecmTimer > 0 ? ' ECM' : ''}${state.playerLoadout.installedEquipment.energy_bomb ? ' BOMB' : ''}`
  };
}

export function createCombatInit(commander: CommanderState, originSystem: { government: number; techLevel: number }) {
  return {
    legalValue: Math.max(commander.legalValue, 0),
    government: originSystem.government,
    techLevel: originSystem.techLevel,
    missionTP: commander.missionTP,
    missionVariant: commander.missionVariant,
    laserMounts: commander.laserMounts,
    installedEquipment: commander.installedEquipment,
    missilesInstalled: commander.missilesInstalled
  };
}
