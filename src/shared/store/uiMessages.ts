import type { UiMessage, UiState } from './types';

/**
 * Appends a transient UI message and keeps the recent activity list trimmed to
 * the small on-screen history the game actually renders.
 */
export function setUiMessage(ui: UiState, tone: UiMessage['tone'], title: string, body: string): UiState {
  const message: UiMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    title,
    body
  };
  return {
    ...ui,
    latestEvent: message,
    activityLog: [message, ...ui.activityLog].slice(0, 4)
  };
}
