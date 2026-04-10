import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation, DockingAssessment } from '../types';
import { getDistanceToStationSlice, getStationDockAngle, getStationDockDirection, getStationDockMouthPoint, getStationSliceSegments, getStationTunnelHalfWidth } from './stationGeometry';

const STATION_COLLISION_MARGIN = 5;
const STATION_DOCK_ENTRY_GRACE = 6;
const STATION_DOCK_PROGRESS_MARGIN = 6;
const STATION_ALIGN_OK_WINDOW = (10 * Math.PI) / 180;
const STATION_ROLL_SAFE_WINDOW = 0.34;
const STATION_DOOR_ROLL_PHASE_OFFSET = Math.PI / 2;

function wrapAngleToHalfTurn(angle: number) {
  const wrapped = clampAngle(angle);
  if (wrapped > Math.PI / 2) {
    return wrapped - Math.PI;
  }
  if (wrapped < -Math.PI / 2) {
    return wrapped + Math.PI;
  }
  return wrapped;
}

/**
 * Docking geometry helpers.
 *
 * Docking now follows the authored station mesh rather than a radial hull
 * approximation. The collision envelope comes from the live `z=0` slice of the
 * rotating Coriolis mesh, while the docking corridor is the front-face slot
 * from the original Elite blueprint.
 */
export function getStationSlotAngle(stationAngle: number): number {
  return getStationDockAngle(stationAngle);
}

export function assessDockingApproach(
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
): DockingAssessment {
  const speed = Math.hypot(player.vx, player.vy);
  const slotAngle = getStationSlotAngle(station.angle);
  const dockDirection = getStationDockDirection(station);
  const dockMouth = getStationDockMouthPoint(station);
  const centerOffsetX = player.x - station.x;
  const centerOffsetY = player.y - station.y;
  const axialOffset = centerOffsetX * dockDirection.x + centerOffsetY * dockDirection.y;
  const lateralOffset = centerOffsetX * -dockDirection.y + centerOffsetY * dockDirection.x;
  const mouthAxial = (dockMouth.x - station.x) * dockDirection.x + (dockMouth.y - station.y) * dockDirection.y;
  const tunnelHalfWidth = getStationTunnelHalfWidth(station);
  const noseAlignment = clampAngle(player.angle - (slotAngle + Math.PI));
  // The visible safe doorway orientation is quarter a turn away from the raw
  // mesh phase. Without this offset, the assist reports ROLL SAFE when the
  // door rectangle is actually turned 90 degrees away from the ship plane.
  const doorRoll = wrapAngleToHalfTurn((station.spinAngle ?? 0) - STATION_DOOR_ROLL_PHASE_OFFSET);
  const stationToPlayerAngle = Math.atan2(centerOffsetY, centerOffsetX);
  const axisAlignmentError = Math.abs(clampAngle(stationToPlayerAngle - slotAngle));
  const alignOk = axisAlignmentError <= STATION_ALIGN_OK_WINDOW;
  const rollSafe = Math.abs(doorRoll) <= STATION_ROLL_SAFE_WINDOW;
  const sliceExtents = getStationSliceSegments(station).flatMap(([start, end]) => {
    const startAxial = (start[0] - station.x) * dockDirection.x + (start[1] - station.y) * dockDirection.y;
    const startLateral = (start[0] - station.x) * -dockDirection.y + (start[1] - station.y) * dockDirection.x;
    const endAxial = (end[0] - station.x) * dockDirection.x + (end[1] - station.y) * dockDirection.y;
    const endLateral = (end[0] - station.x) * -dockDirection.y + (end[1] - station.y) * dockDirection.x;
    return [
      { axial: startAxial, lateral: startLateral },
      { axial: endAxial, lateral: endLateral }
    ];
  });
  const bodyHalfWidth = sliceExtents
    .filter((point) => point.axial <= mouthAxial + STATION_DOCK_ENTRY_GRACE)
    .reduce((max, point) => Math.max(max, Math.abs(point.lateral)), tunnelHalfWidth);
  const insideBodySlice =
    axialOffset >= -station.radius &&
    axialOffset <= mouthAxial &&
    Math.abs(lateralOffset) <= bodyHalfWidth;
  const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;
  // Manual docking help now promises that ALIGN OK + ROLL SAFE is a genuinely
  // safe entry window. When both are true near the front face, treat the ship
  // as being inside the usable doorway even if the strict rectangular slot
  // projection would clip a front-edge corner.
  const safeManualDockingCorridor =
    alignOk &&
    rollSafe &&
    isFacingHangar &&
    axialOffset >= -station.radius &&
    axialOffset <= mouthAxial + 40;
  const isInsideSlot = Math.abs(lateralOffset) <= getStationTunnelHalfWidth(station) || safeManualDockingCorridor;
  const isInDockingGap =
    isInsideSlot &&
    axialOffset >= mouthAxial - STATION_DOCK_ENTRY_GRACE &&
    axialOffset <= mouthAxial + STATION_DOCK_ENTRY_GRACE;
  const deepDockingCorridorHalfWidth = tunnelHalfWidth + 16;
  // Once the ship has passed the doorway plane and is still flying nose-in,
  // docking should win over further front-face collision checks. At that depth
  // the "angle from station center" heuristic is no longer a reliable proxy
  // for the slot the pilot already entered.
  const dockedDeepInside =
    isFacingHangar &&
    Math.abs(lateralOffset) <= deepDockingCorridorHalfWidth &&
    axialOffset <= mouthAxial - STATION_DOCK_PROGRESS_MARGIN &&
    axialOffset >= -station.radius;
  const collidesWithHull =
    ((insideBodySlice && !(isInsideSlot && axialOffset >= mouthAxial - STATION_DOCK_ENTRY_GRACE)) ||
      (getDistanceToStationSlice(station, player) <= STATION_COLLISION_MARGIN && !isInsideSlot)) &&
    !safeManualDockingCorridor &&
    !dockedDeepInside;
  // The original Coriolis slot sits flush with the front face rather than at
  // the end of a protruding tunnel, so docking should complete once the ship
  // crosses just inside the rotating aperture while still aligned with it.
  const canDock = (isInsideSlot || dockedDeepInside) && isFacingHangar && axialOffset <= mouthAxial - STATION_DOCK_PROGRESS_MARGIN;

  return {
    speed,
    axialOffset,
    lateralOffset,
    isInsideSlot,
    isFacingHangar,
    isInDockingGap,
    collidesWithHull,
    canDock
  };
}
