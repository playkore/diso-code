import { useGameStore } from '../store/useGameStore';

export function MissionsScreen() {
  const missions = useGameStore((state) => state.missions.list);

  return (
    <section className="screen">
      <h2>Missions</h2>
      <ul className="card-list">
        {missions.map((mission) => (
          <li key={mission.id} className="mission-card">
            <strong>{mission.title}</strong>
            <span>Destination: {mission.destination}</span>
            <span>Reward: {mission.reward} cr</span>
            <span className="status">{mission.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
