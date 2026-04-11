import type { RefObject } from 'react';
import type { CommanderState } from '../../../commander/domain/commander';
import type { LaserMountPosition } from '../../../commander/domain/shipCatalog';
import { CGA_GREEN, CGA_RED } from './renderers/constants';

export interface TravelSessionHudState {
  energyBanks: number[];
  energyColor: string;
  shieldRatio: number;
  shieldColor: string;
  laserHeat: { mount: LaserMountPosition; installed: boolean; ratio: number; color: string }[];
  jump: string;
  jumpColor: string;
  hyperspace: string;
  hyperspaceColor: string;
  legal: string;
  legalColor: string;
  threat: string;
  threatColor: string;
  lasersActive: boolean;
  arc: string;
  arcColor: string;
}

export interface TravelRefs {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
}

/**
 * Combat setup captured from the commander store when the travel screen
 * starts. The runtime reads only these fields so live wallet or UI updates do
 * not accidentally rebuild the simulation in the middle of a flight.
 */
export interface CombatCommanderSnapshot {
  cargo: CommanderState['cargo'];
  legalValue: CommanderState['legalValue'];
  galaxyIndex: number;
  energyBanks: CommanderState['energyBanks'];
  energyPerBank: CommanderState['energyPerBank'];
  laserMounts: CommanderState['laserMounts'];
  installedEquipment: CommanderState['installedEquipment'];
  missilesInstalled: CommanderState['missilesInstalled'];
}

export interface AutoDockUiState {
  visible: boolean;
  enabled: boolean;
  active: boolean;
}

export interface BombUiState {
  visible: boolean;
}

export interface EcmUiState {
  visible: boolean;
}

export interface GameOverOverlayState {
  visible: boolean;
}

export interface DockingAnimationState {
  elapsedMs: number;
  dockSystemName: string;
  spendJumpFuel: boolean;
  startX: number;
  startY: number;
}

export const INITIAL_HUD: TravelSessionHudState = {
  energyBanks: [1, 1, 1, 1],
  energyColor: CGA_GREEN,
  shieldRatio: 1,
  shieldColor: CGA_GREEN,
  laserHeat: [
    { mount: 'front', installed: true, ratio: 0, color: CGA_GREEN },
    { mount: 'rear', installed: false, ratio: 0, color: CGA_GREEN },
    { mount: 'left', installed: false, ratio: 0, color: CGA_GREEN },
    { mount: 'right', installed: false, ratio: 0, color: CGA_GREEN }
  ],
  jump: 'READY',
  jumpColor: CGA_GREEN,
  hyperspace: 'SAFE ZONE',
  hyperspaceColor: CGA_RED,
  legal: 'clean 0',
  legalColor: CGA_GREEN,
  threat: 'F- / 0',
  threatColor: CGA_GREEN,
  lasersActive: true,
  arc: 'FRONT',
  arcColor: CGA_RED
};

export function areTravelSessionHudStatesEqual(previous: TravelSessionHudState, next: TravelSessionHudState) {
  return (
    previous.energyColor === next.energyColor &&
    previous.shieldRatio === next.shieldRatio &&
    previous.shieldColor === next.shieldColor &&
    previous.laserHeat.length === next.laserHeat.length &&
    previous.laserHeat.every(
      (entry, index) =>
        entry.mount === next.laserHeat[index].mount &&
        entry.installed === next.laserHeat[index].installed &&
        entry.ratio === next.laserHeat[index].ratio &&
        entry.color === next.laserHeat[index].color
    ) &&
    previous.energyBanks.length === next.energyBanks.length &&
    previous.energyBanks.every((ratio, index) => ratio === next.energyBanks[index]) &&
    previous.jump === next.jump &&
    previous.jumpColor === next.jumpColor &&
    previous.hyperspace === next.hyperspace &&
    previous.hyperspaceColor === next.hyperspaceColor &&
    previous.legal === next.legal &&
    previous.legalColor === next.legalColor &&
    previous.threat === next.threat &&
    previous.threatColor === next.threatColor &&
    previous.arc === next.arc &&
    previous.arcColor === next.arcColor &&
    previous.lasersActive === next.lasersActive
  );
}
