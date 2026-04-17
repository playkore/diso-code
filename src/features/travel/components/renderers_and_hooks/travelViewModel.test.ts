import { describe, expect, it } from 'vitest';
import { createDefaultCommander } from '../../../../features/commander/domain/commander';
import { getDriveStatus, getHudState } from './travelViewModel';
import { createCombatState } from '../../domain/combat/__tests__/combatTestUtils';

describe('travel drive status', () => {
  it('reports mass lock and safe-zone blocking separately', () => {
    expect(getDriveStatus('PLAYING', { jumpBlocked: true, hyperspaceBlocked: true, jumpCompleted: false })).toEqual({
      jump: 'MASS LOCK',
      hyperspace: 'SAFE ZONE'
    });
  });

  it('reports engaged and completed states correctly', () => {
    expect(getDriveStatus('JUMPING', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: false }).jump).toBe('ENGAGED');
    expect(getDriveStatus('ARRIVED', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: true }).hyperspace).toBe('COMPLETE');
    expect(getDriveStatus('HYPERSPACE', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: false }).hyperspace).toBe('ENGAGED');
  });

  it('maps player RPG stats and laser heat for the HUD', () => {
    const commander = createDefaultCommander();
    const state = createCombatState([0, 0, 0], {
      installedEquipment: commander.installedEquipment
    });
    state.player.level = 3;
    state.player.hp = 32;
    state.player.maxHp = 88;
    state.player.xp = 24;
    state.player.attack = 15;
    state.player.laserHeat.front = 80;
    state.player.laserHeat.rear = 30;
    state.playerLoadout.laserMounts.rear = 'beam_laser';
    state.playerLoadout.installedEquipment.energy_bomb = true;
    const hud = getHudState(state, 'PLAYING', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: false });
    expect(hud.level).toBe(3);
    expect(hud.hpRatio).toBeCloseTo(32 / 88, 5);
    expect(hud.hpLabel).toBe('32 / 88');
    expect(hud.xpRatio).toBeCloseTo(24 / 88, 5);
    expect(hud.attackLabel).toBe('15');
    expect(hud.laserHeat).toEqual([
      { mount: 'front', installed: true, ratio: 0.8, color: '#ff5555' },
      { mount: 'rear', installed: true, ratio: 0.3, color: '#55ff55' },
      { mount: 'left', installed: false, ratio: 0, color: '#55ff55' },
      { mount: 'right', installed: false, ratio: 0, color: '#55ff55' }
    ]);
    expect(hud.bombVisible).toBe(true);
    expect(hud.lasersActive).toBe(true);
    expect(hud.arc).toContain('BOMB');
  });
});
