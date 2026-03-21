import { describe, expect, it } from 'vitest';
import { getDriveStatus } from './travelViewModel';

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
});
