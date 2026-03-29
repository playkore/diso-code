import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';

/**
 * The missions screen now serves as the contract board and mission inbox.
 * Offers, active objectives, and pending branch choices are all driven by the
 * same mission-state model the rest of the game uses.
 */
export function MissionsScreen() {
  const availableContracts = useGameStore((state) => state.missions.availableContracts);
  const activeMissionMessages = useGameStore((state) => state.missions.activeMissionMessages);
  const activeMissions = useGameStore((state) => state.commander.activeMissions);
  const completedMissions = useGameStore((state) => state.commander.completedMissions);
  const scenarioPanel = useGameStore((state) => state.scenario.missionPanel);
  const acceptMission = useGameStore((state) => state.acceptMission);
  const declineMission = useGameStore((state) => state.declineMission);
  const resolveMissionChoice = useGameStore((state) => state.resolveMissionChoice);
  const dismissMissionMessage = useGameStore((state) => state.dismissMissionMessage);

  return (
    <section className="screen">
      <h2>Missions</h2>

      <section className="subpanel">
        <p className="dialog-kicker">Available Contracts</p>
        <ul className="card-list">
          {availableContracts.map((offer) => (
            <li key={offer.id} className="mission-card">
              <strong>{offer.title}</strong>
              <span>Reward: {formatCredits(offer.reward)}</span>
              <span>{offer.objectiveText}</span>
              <span>{offer.briefing}</span>
              <div className="button-group">
                <button type="button" onClick={() => acceptMission(offer.id)}>
                  Accept
                </button>
                <button type="button" onClick={() => declineMission(offer.id)}>
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="subpanel">
        <p className="dialog-kicker">Active Missions</p>
        <ul className="card-list">
          {activeMissions.map((mission) => (
            <li key={mission.id} className="mission-card">
              <strong>{mission.title}</strong>
              <span>Reward: {formatCredits(mission.reward)}</span>
              <span>{mission.objectiveText}</span>
              <span>
                Destination: {mission.currentDestinationSystem} | Stage: {mission.stageId}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="subpanel">
        <p className="dialog-kicker">Scenario</p>
        {scenarioPanel ? (
          <ul className="card-list">
            <li className="mission-card">
              <strong>{scenarioPanel.title}</strong>
              <span className="status">{scenarioPanel.status}</span>
              <span>{scenarioPanel.progressLabel}</span>
              <span>{scenarioPanel.summary}</span>
              {scenarioPanel.detailLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </li>
          </ul>
        ) : (
          <p>No active scenario.</p>
        )}
      </section>

      <section className="subpanel">
        <p className="dialog-kicker">Mission Inbox</p>
        <ul className="card-list">
          {activeMissionMessages.map((message) => (
            <li key={message.id} className="mission-card">
              <strong>{message.title}</strong>
              <span className="status">{message.kind}</span>
              <span>{message.body}</span>
              {message.choices?.length ? (
                <div className="button-group">
                  {message.choices.map((choice) => (
                    <button key={choice.id} type="button" onClick={() => resolveMissionChoice(message.missionId, choice.id)}>
                      {choice.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="button-group">
                  <button type="button" onClick={() => dismissMissionMessage(message.id)}>
                    Dismiss
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="subpanel">
        <p className="dialog-kicker">Completed</p>
        <ul className="card-list">
          {completedMissions.map((entry) => (
            <li key={`${entry.missionId}:${entry.outcome}`} className="mission-card">
              <strong>{entry.title}</strong>
              <span className="status">{entry.outcome}</span>
              <span>{entry.summary}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
