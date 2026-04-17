import { getCommanderXpProgress, getDosCombatRatingProgress, getLegalStatus } from '../domain/commander';
import { useGameStore } from '../../../store/useGameStore';
import { formatCredits } from '../../../shared/utils/money';
import { formatLightYears } from '../../../shared/utils/distance';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);
  const galaxyIndex = useGameStore((state) => state.universe.galaxyIndex);
  const ratingProgress = getDosCombatRatingProgress(commander.combatRatingScore);
  const xpProgress = getCommanderXpProgress(commander);

  return (
    <section className="screen">
      <h2>Status</h2>
      <dl className="detail-grid">
        <dt>Commander</dt>
        <dd>{commander.name}</dd>
        <dt>Credits</dt>
        <dd>{formatCredits(commander.cash)}</dd>
        <dt>Fuel</dt>
        <dd>{formatLightYears(commander.fuel)}</dd>
        <dt>Level</dt>
        <dd>{commander.level}</dd>
        <dt>HP</dt>
        <dd>
          {commander.hp} / {commander.maxHp}
        </dd>
        <dt>Attack</dt>
        <dd>{commander.attack}</dd>
        <dt>XP</dt>
        <dd className="rating-progress">
          <span className="rating-progress__label">{xpProgress.current}</span>
          <span className="rating-progress__track" aria-hidden="true">
            <span className="rating-progress__fill" style={{ width: `${xpProgress.progressRatio * 100}%` }} />
          </span>
          <span className="rating-progress__meta">Next level in {xpProgress.remainingXp} XP</span>
        </dd>
        <dt>Legal</dt>
        <dd>{getLegalStatus(commander.legalValue, { docked: true })} ({commander.legalValue})</dd>
        <dt>Rating</dt>
        <dd className="rating-progress">
          <span className="rating-progress__label">{ratingProgress.current}</span>
          {/* The commander rank line mirrors DOS-style thresholds with a compact
              progress bar so players can see how close the next promotion is. */}
          <span className="rating-progress__track" aria-hidden="true">
            <span className="rating-progress__fill" style={{ width: `${ratingProgress.progressRatio * 100}%` }} />
          </span>
          <span className="rating-progress__meta">
            {ratingProgress.next ? `Next: ${ratingProgress.next} (${ratingProgress.remainingScore})` : 'Max rank'}
          </span>
        </dd>
        <dt>Galaxy</dt>
        <dd>{galaxyIndex + 1}</dd>
        <dt>Tally</dt>
        <dd>{commander.tally}</dd>
        <dt>Ship</dt>
        <dd>Cobra Mk III</dd>
        <dt>Missiles</dt>
        <dd>
          {commander.missilesInstalled} / {commander.missileCapacity}
        </dd>
      </dl>
    </section>
  );
}
