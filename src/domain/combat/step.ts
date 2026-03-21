import { tryRareEncounter } from './encounters/spawnRules';
import { LOCAL_JUMP_SPEED_MULTIPLIER } from './navigation';
import { stepEnemy } from './ai';
import { assessDockingApproach } from './station/docking';
import { moveProjectiles } from './weapons/projectiles';
import { activatePlayerEcm } from './weapons/ecm';
import { triggerEnergyBomb } from './weapons/energyBomb';
import { determinePlayerArc, spawnPlayerLaser } from './weapons/playerWeapons';
import { clampShields, stepParticles } from './state';
import { updateLegalStatus } from './scoring/legalStatus';
import { spawnCop } from './spawn/spawnEnemy';
import type { CombatInput, CombatTickResult, FlightPhase, RandomSource, TravelCombatState } from './types';

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
  state.player.shields = clampShields(state.player.shields + state.player.rechargeRate * dt, state.player.maxShields);

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
        color: '#55ff55'
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
    if (input.fire && state.player.fireCooldown <= 0) {
      const mount = determinePlayerArc(state);
      const laserId = state.playerLoadout.laserMounts[mount];
      if (laserId) {
        spawnPlayerLaser(state, mount, laserId);
      } else {
        state.lastPlayerArc = mount;
      }
    }
  }

  if (phase !== 'HYPERSPACE') {
    state.encounter.rareTimer += dt;
    if (state.encounter.rareTimer >= 256) {
      state.encounter.rareTimer -= 256;
      tryRareEncounter(state, random, cargo);
    }
  }

  if (state.encounter.stationHostile && state.station && state.enemies.filter((enemy) => enemy.roles.cop).length < 2 && random.nextByte() >= 240) {
    spawnCop(state, random, true);
  }

  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    if (!enemy) {
      continue;
    }
    if (stepEnemy(state, enemy, dt, random)) {
      state.enemies.splice(index, 1);
    }
  }

  state.encounter.copsNearby = state.enemies.filter((enemy) => enemy.roles.cop).length;
  moveProjectiles(state, dt, random);
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
    playerDestroyed: state.player.shields <= 0 && !state.playerLoadout.installedEquipment.escape_pod,
    playerEscaped: state.player.shields <= 0 && state.playerLoadout.installedEquipment.escape_pod,
    autoDocked: Boolean(
      input.autoDock &&
      state.playerLoadout.installedEquipment.docking_computer &&
      state.station &&
      state.enemies.filter((enemy) => enemy.roles.hostile || enemy.missionTag).length === 0 &&
      assessDockingApproach(state.station, state.player).distance <= state.station.safeZoneRadius
    )
  };
}
