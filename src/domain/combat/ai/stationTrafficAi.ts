import { assessDockingApproach } from '../station/docking';
import { stepAutoDockState } from '../station/autoDock';
import type { CombatEnemy, CombatStation } from '../types';

const STATION_TRAFFIC_TURN_LEAD_TICKS = -6;

/**
 * Station traffic reuses the same orbital docking plan as the player. NPC
 * ships therefore keep a tiny amount of persistent docking state on the enemy
 * object itself instead of recalculating a fresh one-frame command each tick.
 */
export function stepStationTraffic(enemy: CombatEnemy, station: CombatStation, dt: number) {
  const autoDockStep = stepAutoDockState(
    {
      phase: enemy.autoDockPhase ?? 'acquire-orbit',
      orbitRadius: enemy.autoDockOrbitRadius
    },
    station,
    enemy,
    {
      // Ambient traders need their own lead tuning. In practice their softer
      // turn/thrust profile commits too late if we reuse the player's reserve,
      // so their orbit target is biased slightly back toward the current slot.
      turnLeadTicks: STATION_TRAFFIC_TURN_LEAD_TICKS
    }
  );
  console.log('[npc-auto-dock-debug]', {
    enemyId: enemy.id,
    phase: autoDockStep.state.phase,
    mode: autoDockStep.command.mode,
    stationAngle: Number(station.angle.toFixed(3)),
    slotAngle: Number(autoDockStep.command.debug.currentSlotAngle.toFixed(3)),
    playerRadialAngle: Number(autoDockStep.command.debug.playerRadialAngle.toFixed(3)),
    targetOrbitAngle: autoDockStep.command.debug.targetOrbitAngle === undefined
      ? null
      : Number(autoDockStep.command.debug.targetOrbitAngle.toFixed(3)),
    orbitAngleError: autoDockStep.command.debug.targetOrbitAngle === undefined
      ? null
      : Number((autoDockStep.command.debug.targetOrbitAngle - autoDockStep.command.debug.playerRadialAngle).toFixed(3)),
    leadAngle: autoDockStep.command.debug.leadAngle === undefined
      ? null
      : Number(autoDockStep.command.debug.leadAngle.toFixed(3)),
    orbitRadius: autoDockStep.command.debug.orbitRadius === undefined
      ? null
      : Number(autoDockStep.command.debug.orbitRadius.toFixed(1)),
    playerRadius: Number(autoDockStep.command.debug.distanceFromStation.toFixed(1)),
    orbitRadiusError: autoDockStep.command.debug.orbitRadius === undefined
      ? null
      : Number((autoDockStep.command.debug.distanceFromStation - autoDockStep.command.debug.orbitRadius).toFixed(1)),
    enemyAngle: Number(enemy.angle.toFixed(3)),
    enemyX: Number(enemy.x.toFixed(1)),
    enemyY: Number(enemy.y.toFixed(1)),
    vx: Number(enemy.vx.toFixed(2)),
    vy: Number(enemy.vy.toFixed(2)),
    turn: Number(autoDockStep.command.turn.toFixed(3)),
    thrust: autoDockStep.command.thrust
  });
  enemy.autoDockPhase = autoDockStep.state.phase;
  enemy.autoDockOrbitRadius = autoDockStep.state.orbitRadius;

  const command = autoDockStep.command;
  // NPC traffic uses the same docking plan as the player, but keeps a slightly
  // stronger thrust scale because ambient traders have lower ship stats and
  // otherwise linger too long outside the slot.
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
