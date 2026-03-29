import { assessDockingApproach } from '../station/docking';
import { stepAutoDockState } from '../station/autoDock';
import type { CombatEnemy, CombatStation } from '../types';

/**
 * Station traffic reuses the same staged lead-angle docking plan as the
 * player. NPC ships therefore keep only the minimal persistent state needed to
 * continue the approach cleanly across simulation frames.
 */
export function stepStationTraffic(enemy: CombatEnemy, station: CombatStation, dt: number) {
  const autoDockStep = stepAutoDockState(
    {
      phase: enemy.autoDockPhase ?? 'approach',
      stageRadius: enemy.autoDockStageRadius
    },
    station,
    enemy
  );
  enemy.autoDockPhase = autoDockStep.state.phase;
  enemy.autoDockStageRadius = autoDockStep.state.stageRadius;

  const command = autoDockStep.command;
  // NPC traffic uses the same docking plan as the player, but keeps a slightly
  // stronger thrust scale because ambient traders have lower ship stats and
  // otherwise linger too long on the staging radius.
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
