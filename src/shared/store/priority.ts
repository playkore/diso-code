import type { PriorityState } from './types';

export const DEFAULT_PRIORITY_TARGET_CREDITS = 1000;
export const DEFAULT_PRIORITY_LABEL = `EARN ${DEFAULT_PRIORITY_TARGET_CREDITS} CR`;

/**
 * Fresh runs begin with a single machine-like profit target so the UI can
 * guide the player without introducing an explicit quest framework.
 */
export function createDefaultPriority(currentCredits: number): PriorityState {
  return {
    label: DEFAULT_PRIORITY_LABEL,
    targetCredits: DEFAULT_PRIORITY_TARGET_CREDITS,
    baselineCredits: Math.max(0, Math.trunc(currentCredits)),
    progressCredits: 0,
    pendingAnnouncement: false
  };
}

/**
 * Recomputes credit gain against the goal's starting balance so save/load and
 * any cash-changing action keep the status line consistent.
 */
export function syncPriorityProgress(priority: PriorityState, currentCredits: number): PriorityState {
  const normalizedCredits = Math.max(0, Math.trunc(currentCredits));
  return {
    ...priority,
    progressCredits: Math.max(0, normalizedCredits - priority.baselineCredits)
  };
}

