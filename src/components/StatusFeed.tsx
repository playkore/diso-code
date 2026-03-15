import type { UiMessage } from '../store/types';

interface StatusFeedProps {
  latestEvent?: UiMessage;
  activityLog: UiMessage[];
}

export function StatusFeed({ latestEvent, activityLog }: StatusFeedProps) {
  if (!latestEvent && activityLog.length === 0) {
    return null;
  }

  return (
    <section className="status-feed" aria-live="polite">
      {latestEvent ? (
        <div className={`status-banner is-${latestEvent.tone}`} role="status">
          <strong>{latestEvent.title}</strong>
          <span>{latestEvent.body}</span>
        </div>
      ) : null}
      {activityLog.length > 0 ? (
        <ul className="status-log">
          {activityLog.map((entry) => (
            <li key={entry.id} className={`status-log__entry is-${entry.tone}`}>
              <strong>{entry.title}</strong>
              <span>{entry.body}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
