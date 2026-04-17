import type { AppTab } from './shared/store/types';

/**
 * Docked tabs and routes intentionally share a single mapping so browser
 * refresh recovery, nav rendering, and redirect fallbacks cannot drift apart.
 */
export const TAB_ROUTE_MAP: Record<AppTab, string> = {
  equipment: '/equipment',
  status: '/status',
  'system-data': '/system-data',
  'short-range-chart': '/short-range-chart',
  'galaxy-chart': '/galaxy-chart'
};

export function getRouteForTab(tab: AppTab): string {
  return TAB_ROUTE_MAP[tab];
}
