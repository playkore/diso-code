import type { UiMessage, UiState } from './types';

export function createUiMessage(tone: UiMessage['tone'], title: string, body: string): UiMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tone,
    title,
    body
  };
}

export function withUiMessage(ui: UiState, message: UiMessage): UiState {
  return {
    ...ui,
    latestEvent: message,
    activityLog: [message, ...ui.activityLog].slice(0, 4)
  };
}
