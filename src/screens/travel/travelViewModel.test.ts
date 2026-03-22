import { describe, expect, it } from 'vitest';
import { getDriveStatus, getHudState } from './travelViewModel';
import { createCombatState } from '../../domain/__tests__/combatTestUtils';

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
    const state = createCombatState([0, 0, 0]);
    state.player.energy = 160;
    state.player.shield = 50;
    const hud = getHudState(state, 'PLAYING', { jumpBlocked: false, hyperspaceBlocked: false, jumpCompleted: false });
    expect(hud.energyBanks).toEqual([1, 1, 0.5, 0]);
    expect(hud.shieldRatio).toBe(0.5);
  });
});
