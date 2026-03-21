import { getLegalStatus, type CommanderState } from '../../domain/commander';
import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';

export function getJumpStatus(flightState: FlightPhase) {
  switch (flightState) {
    case 'READY':
      return 'READY';
    case 'PLAYING':
      return 'CHARGED';
    case 'JUMPING':
      return 'ENGAGED';
    case 'ARRIVED':
      return 'COMPLETE';
    default:
      return 'OFFLINE';
  }
}

export function getHudState(state: TravelCombatState, flightState: FlightPhase) {
  const hostileCount = state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length;
  return {
    score: String(state.score),
    shields: String(Math.max(0, Math.round(state.player.shields))),
    jump: getJumpStatus(flightState),
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
