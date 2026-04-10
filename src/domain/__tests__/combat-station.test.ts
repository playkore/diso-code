import { describe, expect, it } from 'vitest';
import { createDefaultCommander } from '../commander';
import { assessDockingApproach, createDeterministicRandomSource, enterArrivalSpace, enterStationSpace, getStationSlotAngle, stepTravelCombat } from '../travelCombat';
import { clampAngle } from '../combat/state';
import { getStationDockDirection, getStationDockMouthPoint, getStationDockPoint, getStationRenderScale, STATION_TUNNEL_END_X } from '../combat/station/stationGeometry';
import { createCombatState } from './combatTestUtils';

describe('travel combat station rules', () => {
  it('randomizes station rotation when launching from a station', () => {
    const rng = createDeterministicRandomSource([64, 128, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    enterStationSpace(state, rng);

    expect(state.station).not.toBeNull();
    expect(state.station!.angle).toBeCloseTo((64 / 255) * Math.PI * 2);
  });

  it('launches just outside the docking door and already moving away from the station', () => {
    const rng = createDeterministicRandomSource([64, 128, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    enterStationSpace(state, rng);

    expect(state.station).not.toBeNull();
    const slotAngle = getStationSlotAngle(state.station!.angle);
    const dx = state.player.x - state.station!.x;
    const dy = state.player.y - state.station!.y;
    const distance = Math.hypot(dx, dy);
    const radialAngle = Math.atan2(dy, dx);
    const speed = Math.hypot(state.player.vx, state.player.vy);
    const outwardVelocity = dx * state.player.vx + dy * state.player.vy;

    expect(distance).toBeCloseTo(STATION_TUNNEL_END_X * getStationRenderScale(state.station!) + 28);
    expect(clampAngle(radialAngle - slotAngle)).toBeCloseTo(0);
    expect(clampAngle(state.player.angle - slotAngle)).toBeCloseTo(0);
    expect(speed).toBeCloseTo(2.4);
    expect(outwardVelocity).toBeGreaterThan(0);
  });

  it('places hyperspace arrivals well outside the station safe zone', () => {
    const rng = createDeterministicRandomSource([128, 0, 0, 64, 32]);
    const state = createCombatState([0, 0, 0, 0]);
    state.player.angle = Math.PI / 3;
    enterArrivalSpace(state, rng);
    expect(state.station).not.toBeNull();
    const dx = state.player.x - state.station!.x;
    const dy = state.player.y - state.station!.y;
    const distance = Math.hypot(dx, dy);
    const radialAngle = Math.atan2(dy, dx);
    // `enterStationSpace` now consumes one extra random float for the initial
    // spin phase, so the looping deterministic stream reuses the first byte for
    // the final arrival bearing sample.
    const expectedArrivalAngle = (128 / 255) * Math.PI * 2;

    expect(distance).toBeGreaterThanOrEqual(10_000);
    expect(distance).toBeLessThanOrEqual(20_000);
    expect(clampAngle(radialAngle - expectedArrivalAngle)).toBeCloseTo(0);
    expect(dy).not.toBeCloseTo(distance);
    expect(state.player.angle).toBe(Math.PI / 3);
    expect(Math.hypot(state.player.vx, state.player.vy)).toBeCloseTo(state.player.maxSpeed);
    expect(state.encounter.safeZone).toBe(false);
  });

  it('destroys enemy missiles at the station safe-zone edge while the player is inside', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const commander = createDefaultCommander();
    commander.installedEquipment.shield_generator = true;
    const state = createCombatState([0, 0, 0], { installedEquipment: commander.installedEquipment });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.player.shield = 70;
    state.player.energyRechargePerTick = 0;
    state.player.shieldRechargePerTick = 0;
    state.projectiles.push({ id: 7, kind: 'missile', owner: 'enemy', x: 361, y: 0, vx: -5, vy: 0, damage: 22, life: 100 });
    stepTravelCombat(state, { thrust: 0, turn: 0 }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile' && projectile.owner === 'enemy')).toBe(false);
    expect(state.player.shield).toBe(70);
  });

  it('treats the visible station split as open for docking', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const dockPoint = getStationDockPoint(station);
    const slotAngle = getStationSlotAngle(station.angle);
    const player = {
      x: dockPoint.x,
      y: dockPoint.y,
      vx: 0.5,
      vy: 0,
      angle: slotAngle + Math.PI
    };
    const docking = assessDockingApproach(station, player);
    expect(docking.isInsideSlot).toBe(true);
    expect(docking.isInDockingGap).toBe(true);
    expect(docking.collidesWithHull).toBe(false);
    expect(docking.canDock).toBe(true);
  });

  it('counts the visible docking-door mouth as docked', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const dockMouth = getStationDockMouthPoint(station);
    const player = {
      x: dockMouth.x - 6,
      y: dockMouth.y,
      vx: -0.3,
      vy: 0,
      angle: slotAngle + Math.PI
    };
    const docking = assessDockingApproach(station, player);
    expect(docking.isInDockingGap).toBe(true);
    expect(docking.canDock).toBe(true);
  });

  it('collides when crossing the ring away from the visible split', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const dockDirection = getStationDockDirection(station);
    const player = {
      x: station.x - dockDirection.y * 40,
      y: station.y + dockDirection.x * 40,
      vx: 0.5,
      vy: 0.5,
      angle: Math.PI
    };
    const docking = assessDockingApproach(station, player);
    expect(docking.isInsideSlot).toBe(false);
    expect(docking.collidesWithHull).toBe(true);
    expect(docking.canDock).toBe(false);
  });

  it('allows auto-dock only inside the station safe zone', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const commander = createDefaultCommander();
    const state = createCombatState([0, 0, 0], {
      installedEquipment: { ...commander.installedEquipment, docking_computer: true }
    });
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 400;
    state.player.y = 0;

    const outsideSafeZone = stepTravelCombat(state, { thrust: 0, turn: 0, autoDock: true }, 1, 'PLAYING', {}, rng);
    expect(outsideSafeZone.autoDocked).toBe(false);

    state.player.x = 200;
    const insideSafeZone = stepTravelCombat(state, { thrust: 0, turn: 0, autoDock: true }, 1, 'PLAYING', {}, rng);
    expect(insideSafeZone.autoDocked).toBe(true);
  });

  it('rejects auto-dock when the docking computer is not installed', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const state = createCombatState([0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 200;
    state.player.y = 0;

    const result = stepTravelCombat(state, { thrust: 0, turn: 0, autoDock: true }, 1, 'PLAYING', {}, rng);
    expect(result.autoDocked).toBe(false);
  });
});
