import { tryRareEncounter } from './encounters/spawnRules';
import { canAutoDock, LOCAL_JUMP_SPEED_MULTIPLIER, RADAR_SHIP_RANGE } from './navigation';
import { stepEnemy } from './ai';
import { assessDockingApproach } from './station/docking';
import { moveProjectiles } from './weapons/projectiles';
import { activatePlayerEcm } from './weapons/ecm';
import { triggerEnergyBomb } from './weapons/energyBomb';
import { firePlayerLasers, refreshPlayerTargetLock } from './weapons/playerWeapons';
import { clampLaserHeat, rechargePlayerDefense, stepParticles } from './state';
import type { LaserMountPosition } from '../shipCatalog';
import { updateLegalStatus } from './scoring/legalStatus';
import { spawnCop } from './spawn/spawnEnemy';
import type { CombatInput, CombatTickResult, FlightPhase, RandomSource, TravelCombatState } from './types';

const MAX_ACTIVE_ENEMIES = 12;
const ENEMY_DESPAWN_DISTANCE = RADAR_SHIP_RANGE * 3;

/**
 * Ambient contacts may leave the encounter once they drift far enough away,
 * but they are no longer removed just because a hidden lifetime counter ran
 * out. That prevents on-screen ships from vanishing mid-fight.
 */
function shouldDespawnEnemy(state: TravelCombatState, enemy: TravelCombatState['enemies'][number]) {
  if (enemy.missionTag) {
    return false;
  }
  if (enemy.roles.cop && state.encounter.stationHostile) {
    return false;
  }

  const distanceFromPlayer = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
  return distanceFromPlayer > ENEMY_DESPAWN_DISTANCE;
}

/**
 * Advances one real-time combat frame.
 *
 * The frame order is deliberate:
 * 1. recharge timers and player-only instant actions
 * 2. update station state and safe-zone flags
 * 3. apply player steering/thrust and laser-controller updates for manual-flight phases
 * 4. roll ambient encounters and station police reactions
 * 5. step enemies, projectiles, particles, and legal-state fallout
 * 6. age transient UI messages and compute exit conditions
 *
 * Most systems mutate `state` in place so callers can keep a single simulation
 * object alive across frames without rebuilding references for the renderer.
 */
export function stepTravelCombat(
  state: TravelCombatState,
  input: CombatInput,
  dt: number,
  phase: FlightPhase,
  cargo: Record<string, number>,
  random: RandomSource
): CombatTickResult {
  if (phase === 'GAMEOVER') {
    return { state, playerDestroyed: true, playerEscaped: false, autoDocked: false };
  }

  state.encounter.ecmTimer = Math.max(0, state.encounter.ecmTimer - dt);
  state.encounter.ecmFlashTimer = Math.max(0, state.encounter.ecmFlashTimer - dt);
  state.encounter.bombEffectTimer = Math.max(0, state.encounter.bombEffectTimer - dt);
  for (const mount of ['front', 'rear', 'left', 'right'] as LaserMountPosition[]) {
    state.player.laserHeat[mount] = clampLaserHeat(
      state.player.laserHeat[mount] - state.player.laserHeatCooldownRate * (dt / 60),
      state.player.maxLaserHeat
    );
  }
  rechargePlayerDefense(state, dt);

  if (input.toggleLasers) {
    // The travel UI owns the switch gesture, but the simulation owns the armed
    // state so tests and live gameplay share the exact same behavior.
    state.playerLasersActive = !state.playerLasersActive;
    if (!state.playerLasersActive) {
      state.playerTargetLock = null;
    }
  }

  if (input.activateEcm) {
    activatePlayerEcm(state);
  }
  if (input.triggerEnergyBomb) {
    triggerEnergyBomb(state, random);
  }

  if (state.station) {
    state.station.angle += state.station.rotSpeed * dt;
    state.encounter.safeZone = Math.hypot(state.player.x - state.station.x, state.player.y - state.station.y) <= state.station.safeZoneRadius;
  } else {
    state.encounter.safeZone = false;
  }

  // READY, PLAYING, ARRIVED, and JUMPING all share the same low-level flight
  // model; only the caller decides which controls are allowed in each phase.
  if (phase === 'PLAYING' || phase === 'ARRIVED' || phase === 'READY' || phase === 'JUMPING') {
    const jumpActive = Boolean(input.jump);
    if (!jumpActive) {
      state.player.angle += input.turn * 0.08 * dt;
    }
    if (input.thrust > 0 && !jumpActive) {
      state.player.vx += Math.cos(state.player.angle) * input.thrust * 0.2 * dt;
      state.player.vy += Math.sin(state.player.angle) * input.thrust * 0.2 * dt;
      state.particles.push({
        x: state.player.x - Math.cos(state.player.angle) * 15,
        y: state.player.y - Math.sin(state.player.angle) * 15,
        vx: -state.player.vx * 0.5,
        vy: -state.player.vy * 0.5,
        life: 10,
        maxLife: 10,
        color: '#55ff55',
        size: 1.4
      });
    }

    state.player.vx *= 0.99;
    state.player.vy *= 0.99;
    if (jumpActive) {
      const jumpSpeed = state.player.maxSpeed * LOCAL_JUMP_SPEED_MULTIPLIER;
      state.player.vx = Math.cos(state.player.angle) * jumpSpeed;
      state.player.vy = Math.sin(state.player.angle) * jumpSpeed;
    }
    const speed = Math.hypot(state.player.vx, state.player.vy);
    const speedLimit = state.player.maxSpeed * (jumpActive ? LOCAL_JUMP_SPEED_MULTIPLIER : 1);
    if (speed > speedLimit) {
      state.player.vx = (state.player.vx / speed) * speedLimit;
      state.player.vy = (state.player.vy / speed) * speedLimit;
    }

    state.player.x += state.player.vx * dt;
    state.player.y += state.player.vy * dt;
    state.player.fireCooldown = Math.max(0, state.player.fireCooldown - dt);
    const targetLock = state.playerLasersActive ? refreshPlayerTargetLock(state) : null;
    if (!state.playerLasersActive) {
      state.playerTargetLock = null;
    }
    if (state.playerLasersActive && targetLock && state.player.fireCooldown <= 0) {
      firePlayerLasers(state);
    }
  }

  if (phase !== 'HYPERSPACE') {
    state.encounter.rareTimer += dt;
    if (state.encounter.rareTimer >= 256) {
      state.encounter.rareTimer -= 256;
      tryRareEncounter(state, random, cargo);
    }
  }

  if (
    state.encounter.stationHostile &&
    state.station &&
    state.enemies.length < MAX_ACTIVE_ENEMIES &&
    state.enemies.filter((enemy) => enemy.roles.cop).length < 2 &&
    random.nextByte() >= 240
  ) {
    spawnCop(state, random, true);
  }

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (!enemy) {
      continue;
    }
    if (stepEnemy(state, enemy, dt, random)) {
      state.enemies.splice(index, 1);
      continue;
    }

    enemy.lifetime += dt;
    if (shouldDespawnEnemy(state, enemy)) {
      state.enemies.splice(index, 1);
    }
  }

  state.encounter.copsNearby = state.enemies.filter((enemy) => enemy.roles.cop).length;
  moveProjectiles(state, dt, random);
  if (state.playerLasersActive) {
    refreshPlayerTargetLock(state);
  } else {
    state.playerTargetLock = null;
  }
  stepParticles(state, dt);
  updateLegalStatus(state);

  for (let i = state.messages.length - 1; i >= 0; i -= 1) {
    state.messages[i].duration -= dt * 16.6667;
    if (state.messages[i].duration <= 0) {
      state.messages.splice(i, 1);
    }
  }

  return {
    state,
    playerDestroyed: state.player.energy <= 0 && !state.playerLoadout.installedEquipment.escape_pod,
    playerEscaped: state.player.energy <= 0 && state.playerLoadout.installedEquipment.escape_pod,
    autoDocked: Boolean(
      // Auto-dock is intentionally conservative: the docking computer only
      // resolves the final approach after the player requests it, owns the
      // equipment, is inside the station safe zone, and has cleared all
      // hostile traffic.
      input.autoDock &&
      canAutoDock(state) &&
      state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length === 0 &&
      state.station &&
      assessDockingApproach(state.station, state.player).distance <= state.station.safeZoneRadius
    )
  };
}
