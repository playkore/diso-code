import { getLegalStatus } from '../commander';
import type { LaserId } from '../shipCatalog';
import { selectBlueprintFile } from './encounters/spawnRules';
import type { RandomSource, TravelCombatInit, TravelCombatState } from './types';

export function clampAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.trunc(value)));
}

export function clampShields(value: number, maxShields: number): number {
  return Math.max(0, Math.min(maxShields, value));
}

export function projectileId(state: TravelCombatState): number {
  return state.nextId++;
}

export function createMathRandomSource(): RandomSource {
  return {
    nextFloat: () => Math.random(),
    nextByte: () => Math.floor(Math.random() * 256) & 0xff
  };
}

export function createDeterministicRandomSource(bytes: number[]): RandomSource {
  let index = 0;
  return {
    nextFloat: () => ((bytes[index++ % bytes.length] ?? 0) & 0xff) / 255,
    nextByte: () => (bytes[index++ % bytes.length] ?? 0) & 0xff
  };
}

function getPlayerMaxSpeed(_laserMounts: TravelCombatInit['laserMounts']): number {
  return 8;
}

function getPlayerRechargeRate(installedEquipment: TravelCombatInit['installedEquipment']): number {
  return installedEquipment.extra_energy_unit ? 0.2 : 0.09;
}

export function createTravelCombatState(init: TravelCombatInit, random: RandomSource): TravelCombatState {
  const maxSpeed = getPlayerMaxSpeed(init.laserMounts);
  const activeBlueprintFile = selectBlueprintFile({
    government: init.government,
    techLevel: init.techLevel,
    missionTP: init.missionTP,
    witchspace: false,
    randomByte: random.nextByte()
  });
  return {
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: 12,
      shields: 100,
      maxShields: 100,
      maxSpeed,
      fireCooldown: 0,
      tallyKills: 0,
      rechargeRate: getPlayerRechargeRate(init.installedEquipment)
    },
    playerLoadout: {
      laserMounts: { ...init.laserMounts },
      installedEquipment: { ...init.installedEquipment },
      missilesInstalled: init.missilesInstalled
    },
    enemies: [],
    projectiles: [],
    particles: [],
    station: null,
    encounter: {
      mcnt: 0,
      rareTimer: 0,
      ev: 0,
      safeZone: false,
      stationHostile: false,
      ecmTimer: 0,
      copsNearby: 0,
      benignCooldown: 0,
      activeBlueprintFile
    },
    legalValue: init.legalValue,
    legalStatus: getLegalStatus(init.legalValue),
    score: 0,
    nextId: 1,
    currentGovernment: init.government,
    currentTechLevel: init.techLevel,
    missionTP: init.missionTP,
    missionVariant: init.missionVariant,
    witchspace: false,
    thargoidContactTriggered: false,
    constrictorSpawned: false,
    messages: [],
    missionEvents: [],
    salvageCargo: {},
    salvageFuel: 0,
    lastPlayerArc: 'front'
  };
}

export function pushMessage(state: TravelCombatState, text: string, duration = 1400) {
  state.messages.push({ id: `${Date.now()}-${state.nextId}`, text, duration });
}

export function spawnParticles(state: TravelCombatState, x: number, y: number, color: string) {
  for (let i = 0; i < 12; i += 1) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 20 + Math.random() * 12,
      color
    });
  }
}

export function stepParticles(state: TravelCombatState, dt: number) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const particle = state.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

export function consumeEscapePod(state: TravelCombatState) {
  if (!state.playerLoadout.installedEquipment.escape_pod) {
    return;
  }
  state.playerLoadout.installedEquipment.escape_pod = false;
}

export function getPlayerCombatSnapshot(state: TravelCombatState) {
  return {
    cargo: { ...state.salvageCargo },
    fuel: state.salvageFuel,
    installedEquipment: { ...state.playerLoadout.installedEquipment },
    missilesInstalled: state.playerLoadout.missilesInstalled
  };
}

export function getLaserProjectileProfile(laserId: LaserId) {
  switch (laserId) {
    case 'military_laser':
      return { damage: 24, speed: 18, life: 26, cooldown: 8 };
    case 'beam_laser':
      return { damage: 16, speed: 16, life: 22, cooldown: 10 };
    case 'mining_laser':
      return { damage: 10, speed: 14, life: 24, cooldown: 14 };
    case 'pulse_laser':
    default:
      return { damage: 12, speed: 14, life: 18, cooldown: 12 };
  }
}
