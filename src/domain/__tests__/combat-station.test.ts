import { describe, expect, it } from 'vitest';
import { assessDockingApproach, createDeterministicRandomSource, enterArrivalSpace, getStationSlotAngle, stepTravelCombat } from '../travelCombat';
import { createCombatState } from './combatTestUtils';

describe('travel combat station rules', () => {
  it('places hyperspace arrivals well outside the station safe zone', () => {
    const rng = createDeterministicRandomSource([128, 0, 0, 0]);
    const state = createCombatState([0, 0, 0, 0]);
    state.player.angle = Math.PI / 3;
    enterArrivalSpace(state, rng);
    expect(state.station).not.toBeNull();
    expect(Math.hypot(state.player.x - state.station!.x, state.player.y - state.station!.y)).toBeGreaterThanOrEqual(10_000);
    expect(Math.hypot(state.player.x - state.station!.x, state.player.y - state.station!.y)).toBeLessThanOrEqual(20_000);
    expect(state.player.angle).toBe(Math.PI / 3);
    expect(Math.hypot(state.player.vx, state.player.vy)).toBeCloseTo(state.player.maxSpeed);
    expect(state.encounter.safeZone).toBe(false);
  });

  it('destroys enemy missiles at the station safe-zone edge while the player is inside', () => {
    const rng = createDeterministicRandomSource([0, 0, 0]);
    const state = createCombatState([0, 0, 0]);
    state.station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    state.player.x = 0;
    state.player.y = 0;
    state.player.shield = 70;
    state.player.energyRegenRate = 0;
    state.player.shieldRechargeRate = 0;
    state.projectiles.push({ id: 7, kind: 'missile', owner: 'enemy', x: 361, y: 0, vx: -5, vy: 0, damage: 22, life: 100 });
    stepTravelCombat(state, { thrust: 0, turn: 0, fire: false }, 1, 'PLAYING', {}, rng);
    expect(state.projectiles.some((projectile) => projectile.kind === 'missile' && projectile.owner === 'enemy')).toBe(false);
    expect(state.player.shield).toBe(70);
  });

  it('treats the visible station split as open for docking', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const player = {
      x: Math.cos(slotAngle) * 60,
      y: Math.sin(slotAngle) * 60,
      vx: 0.5,
      vy: 0.5,
      angle: slotAngle + Math.PI
    };
    const docking = assessDockingApproach(station, player);
    expect(docking.isInsideSlot).toBe(true);
    expect(docking.isInDockingGap).toBe(true);
    expect(docking.collidesWithHull).toBe(false);
    expect(docking.canDock).toBe(true);
  });

  it('collides when crossing the ring away from the visible split', () => {
    const station = { x: 0, y: 0, radius: 80, angle: 0, rotSpeed: 0, safeZoneRadius: 360 };
    const slotAngle = getStationSlotAngle(station.angle);
    const player = {
      x: Math.cos(slotAngle + Math.PI / 2) * 70,
      y: Math.sin(slotAngle + Math.PI / 2) * 70,
      vx: 0.5,
      vy: 0.5,
      angle: slotAngle + Math.PI
    };
    const docking = assessDockingApproach(station, player);
    expect(docking.isInsideSlot).toBe(false);
    expect(docking.collidesWithHull).toBe(true);
    expect(docking.canDock).toBe(false);
  });
});
