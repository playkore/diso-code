import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation, DockingAssessment } from '../types';
import { getDistanceToStationSlice, getStationDockAngle, getStationDockDirection, getStationDockMouthPoint, getStationDockPoint, getStationSliceSegments, getStationTunnelHalfWidth } from './stationGeometry';

const STATION_COLLISION_MARGIN = 5;
const STATION_DOCK_CAPTURE_RADIUS = 10;
const STATION_DOCK_ENTRY_GRACE = 6;

/**
 * Docking geometry helpers.
 *
 * Docking now follows the authored station mesh rather than a radial hull
 * approximation. The collision envelope comes from the live `z=0` slice of the
 * rotating station mesh, while the docking corridor is the square tunnel that
 * protrudes from the station's +X face in local space.
 */
export function getStationSlotAngle(stationAngle: number): number {
  return getStationDockAngle(stationAngle);
}

export function assessDockingApproach(
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
): DockingAssessment {
  const distance = Math.hypot(player.x - station.x, player.y - station.y);
  const speed = Math.hypot(player.vx, player.vy);
  const slotAngle = getStationSlotAngle(station.angle);
  const dockDirection = getStationDockDirection(station);
  const dockMouth = getStationDockMouthPoint(station);
  const dockPoint = getStationDockPoint(station);
  const centerOffsetX = player.x - station.x;
  const centerOffsetY = player.y - station.y;
  const axialOffset = centerOffsetX * dockDirection.x + centerOffsetY * dockDirection.y;
  const lateralOffset = centerOffsetX * -dockDirection.y + centerOffsetY * dockDirection.x;
  const mouthAxial = (dockMouth.x - station.x) * dockDirection.x + (dockMouth.y - station.y) * dockDirection.y;
  const dockAxial = (dockPoint.x - station.x) * dockDirection.x + (dockPoint.y - station.y) * dockDirection.y;
  const tunnelHalfWidth = getStationTunnelHalfWidth(station);
  const slotOffset = lateralOffset / Math.max(1, tunnelHalfWidth);
  const noseAlignment = clampAngle(player.angle - (slotAngle + Math.PI));
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
  const isInsideSlot = Math.abs(lateralOffset) <= getStationTunnelHalfWidth(station);
  const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;
  const isInDockingGap = isInsideSlot && axialOffset >= dockAxial - STATION_DOCK_CAPTURE_RADIUS && axialOffset <= mouthAxial + STATION_DOCK_ENTRY_GRACE;
  const collidesWithHull = (insideBodySlice && !(isInsideSlot && axialOffset >= station.radius)) || (getDistanceToStationSlice(station, player) <= STATION_COLLISION_MARGIN && !isInsideSlot);
  const canDock = isInsideSlot && isFacingHangar && Math.abs(axialOffset - dockAxial) <= STATION_DOCK_CAPTURE_RADIUS;

  return {
    slotAngle,
    slotOffset,
    noseAlignment,
    distance,
    speed,
    isInsideSlot,
    isFacingHangar,
    isInDockingGap,
    collidesWithHull,
    canDock
  };
}
