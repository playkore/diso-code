import { getLegalStatus, type CommanderState } from '../../domain/commander';
import type { FlightPhase, TravelCombatState } from '../../domain/travelCombat';
import { getCgaBarFillColor, getSegmentedBankRatios } from './renderers/bars';
import type { LaserMountPosition } from '../../domain/shipCatalog';

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
  energyBanks: number[];
  energyColor: string;
  shieldRatio: number;
  shieldColor: string;
  laserHeat: { mount: LaserMountPosition; installed: boolean; ratio: number; color: string }[];
  jump: string;
  hyperspace: string;
  legal: string;
  hostileCount: number;
  threat: string;
  arc: string;
  bombVisible: boolean;
  lasersActive: boolean;
}

function getHeatColor(heatRatio: number) {
  return heatRatio >= 0.8 ? '#ff5555' : heatRatio >= 0.45 ? '#ffff55' : '#55ff55';
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
  const energyRatio = state.player.maxEnergy > 0 ? state.player.energy / state.player.maxEnergy : 0;
  const shieldRatio = state.player.maxShield > 0 ? state.player.shield / state.player.maxShield : 0;
  const bombVisible = state.playerLoadout.installedEquipment.energy_bomb;
  const laserHeat = (['front', 'rear', 'left', 'right'] as LaserMountPosition[]).map((mount) => {
    const installed = Boolean(state.playerLoadout.laserMounts[mount]);
    const heatRatio = installed && state.player.maxLaserHeat > 0 ? state.player.laserHeat[mount] / state.player.maxLaserHeat : 0;
    return {
      mount,
      installed,
      ratio: Math.max(0, Math.min(1, heatRatio)),
      color: getHeatColor(heatRatio)
    };
  });
  return {
    energyBanks: getSegmentedBankRatios(state.player.energy, state.player.maxEnergy, state.player.energyBanks),
    energyColor: getCgaBarFillColor(energyRatio),
    shieldRatio: Math.max(0, Math.min(1, shieldRatio)),
    shieldColor: getCgaBarFillColor(shieldRatio),
    laserHeat,
    jump: drives.jump,
    hyperspace: drives.hyperspace,
    legal: `${getLegalStatus(state.legalValue, { docked: false })} ${state.legalValue}`,
    hostileCount,
    threat: `F${state.encounter.activeBlueprintFile} / ${hostileCount}`,
    arc: `${state.lastPlayerArc.toUpperCase()} ${state.encounter.ecmTimer > 0 ? ' ECM' : ''}${bombVisible ? ' BOMB' : ''}`,
    bombVisible,
    lasersActive: state.playerLasersActive
  };
}

export function createCombatInit(
  commander: CommanderState,
  originSystem: { government: number; techLevel: number },
  missionContext: import('../../domain/missions').MissionTravelContext
) {
  return {
    legalValue: Math.max(commander.legalValue, 0),
    government: originSystem.government,
    techLevel: originSystem.techLevel,
    missionContext,
    energyBanks: commander.energyBanks,
    energyPerBank: commander.energyPerBank,
    laserMounts: commander.laserMounts,
    installedEquipment: commander.installedEquipment,
    missilesInstalled: commander.missilesInstalled
  };
}
