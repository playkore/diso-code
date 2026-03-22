import { assessDockingApproach } from '../station/docking';
import { getAutoDockCommand } from '../station/autoDock';
import type { CombatEnemy, CombatStation } from '../types';

/**
 * Station traffic now reuses the same docking controller as the player so NPC
 * ships respect the same wall approach, wait, and door-entry geometry.
 */
export function stepStationTraffic(enemy: CombatEnemy, station: CombatStation, dt: number) {
  let command = getAutoDockCommand(station, enemy);
  if (command.debug.withinWaitBand && !command.debug.doorInFront) {
    // Match the player's sticky wait behavior: once traffic reaches the wall
    // band, it should hold position for the door instead of re-entering a
    // thrusting approach loop on minor drift.
    command = {
      ...command,
      mode: 'wait',
      thrust: 0
    };
  }
  // NPC traffic uses the same docking plan as the player, but needs a slightly
  // stronger wrapper because its ship stats are lower and it cannot rely on a
  // session-level wait latch the way the player auto-dock flow does.
  enemy.angle += command.turn * enemy.turnRate * dt * 1.6;
  if (command.thrust > 0) {
    const thrustScale = command.mode === 'dock' ? 0.75 : command.mode === 'wait' ? 0 : 0.58;
    enemy.vx += Math.cos(enemy.angle) * enemy.acceleration * thrustScale * command.thrust * dt;
    enemy.vy += Math.sin(enemy.angle) * enemy.acceleration * thrustScale * command.thrust * dt;
  }
}

export function isStationTrafficDocked(enemy: CombatEnemy, station: CombatStation): boolean {
  const docking = assessDockingApproach(station, enemy);
  return docking.isInDockingGap;
}
