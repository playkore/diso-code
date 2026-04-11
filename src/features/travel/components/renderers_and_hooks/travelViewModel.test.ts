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

  it('maps player energy banks and shield fill for the HUD', () => {
    const commander = createDefaultCommander();
    commander.installedEquipment.shield_generator = true;
    const state = createCombatState([0, 0, 0], {
      installedEquipment: commander.installedEquipment,
      energyBanks: 4
    });
    state.player.energy = 160;
    state.player.shield = 128;
    state.player.laserHeat.front = 80;
    state.player.laserHeat.rear = 30;
    state.playerLoadout.laserMounts.rear = 'beam_laser';
    state.playerLoadout.installedEquipment.energy_bomb = true;
    const hud = getHudState(state, 'PLAYING', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: false });
    expect(hud.energyBanks[0]).toBe(1);
    expect(hud.energyBanks[1]).toBe(1);
    expect(hud.energyBanks[2]).toBeCloseTo(0.5098, 3);
    expect(hud.energyBanks[3]).toBe(0);
    expect(hud.shieldRatio).toBeCloseTo(128 / 255, 5);
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
