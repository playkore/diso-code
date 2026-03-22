import { clampAngle } from '../state';
import type { CombatPlayer, CombatStation, DockingAssessment } from '../types';

/**
 * Docking geometry helpers.
 *
 * Successful docking requires the ship to approach through the rotating slot,
 * face back toward the hangar opening, and slow below the allowed entry speed.
 * Anything that reaches the station hull outside that gap is treated as a
 * collision instead.
 *
 * A completed dock is recognized at the visible mouth of the slot rather than
 * deep inside the station model. That keeps the trigger aligned with what the
 * player sees on screen, especially now that auto-dock flies a full approach.
 */
export function getStationSlotAngle(stationAngle: number): number {
  return stationAngle + Math.PI / 2;
}

export function assessDockingApproach(
  station: CombatStation,
  player: Pick<CombatPlayer, 'x' | 'y' | 'vx' | 'vy' | 'angle'>
): DockingAssessment {
  const distance = Math.hypot(player.x - station.x, player.y - station.y);
  const speed = Math.hypot(player.vx, player.vy);
  const slotAngle = getStationSlotAngle(station.angle);
  const relativeAngle = Math.atan2(player.y - station.y, player.x - station.x);
  const slotOffset = clampAngle(relativeAngle - slotAngle);
  const noseAlignment = clampAngle(player.angle - (slotAngle + Math.PI));
  const isInsideSlot = Math.abs(slotOffset) < Math.PI / 7;
  const isFacingHangar = Math.abs(noseAlignment) < Math.PI / 3;
  const isInDockingGap = distance < station.radius + 6 && isInsideSlot;
  const collidesWithHull = distance < station.radius - 5 && !isInDockingGap;
  // Touching the visible doorway is enough to count as docked; asking the
  // player to travel deeper into the station model feels wrong on screen.
  const canDock = isInDockingGap && isFacingHangar;

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
