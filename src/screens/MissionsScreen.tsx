import { useGameStore } from '../store/useGameStore';

export function MissionsScreen() {
  const missionLog = useGameStore((state) => state.missions.missionLog);
  const triggerMissionExternalEvent = useGameStore((state) => state.triggerMissionExternalEvent);

  return (
    <section className="screen">
      <h2>Missions</h2>
      <div className="button-group">
        <button type="button" onClick={() => triggerMissionExternalEvent({ type: 'combat:constrictor-destroyed' })}>
          Simulate Constrictor Kill
        </button>
        <button type="button" onClick={() => triggerMissionExternalEvent({ type: 'combat:thargoid-plans-delivered' })}>
          Simulate Plans Delivery
        </button>
      </div>
      <ul className="card-list">
        {missionLog.map((message) => (
          <li key={message.id} className="mission-card">
            <strong>{message.title}</strong>
            <span className="status">{message.kind}</span>
            <span>{message.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
