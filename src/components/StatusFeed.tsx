import type { UiMessage } from '../store/types';

interface StatusFeedProps {
  latestEvent?: UiMessage;
  activityLog: UiMessage[];
}

export function StatusFeed({ latestEvent, activityLog }: StatusFeedProps) {
  if (!latestEvent) {
    return null;
  }

  const hiddenCount = Math.max(0, activityLog.length - 1);

  return (
    <section className="status-feed" aria-live="polite">
      <div className={`status-banner is-${latestEvent.tone}`} role="status">
        <strong>{latestEvent.title}</strong>
        <span>{latestEvent.body}</span>
        {hiddenCount > 0 ? <small>{hiddenCount} more recent update{hiddenCount > 1 ? 's' : ''}</small> : null}
      </div>
    </section>
  );
}
