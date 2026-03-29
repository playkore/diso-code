import type { AppTab } from './store/types';

/**
 * Docked tabs and routes intentionally share a single mapping so browser
 * refresh recovery, nav rendering, and redirect fallbacks cannot drift apart.
 */
export const TAB_ROUTE_MAP: Record<AppTab, string> = {
  market: '/',
  equipment: '/equipment',
  inventory: '/inventory',
  'system-data': '/system-data',
  'star-map': '/star-map',
  'save-load': '/save-load'
};

export function getRouteForTab(tab: AppTab): string {
  return TAB_ROUTE_MAP[tab];
}
