import { getDosCombatRatingProgress, getLegalStatus, totalCargoUsedTonnes } from '../domain/commander';
import { useGameStore } from '../store/useGameStore';
import { formatCredits } from '../utils/money';
import { formatLightYears } from '../utils/distance';

export function InventoryScreen() {
  const commander = useGameStore((state) => state.commander);
  const galaxyIndex = useGameStore((state) => state.universe.galaxyIndex);
  const cargoUsed = totalCargoUsedTonnes(commander.cargo);
  const ratingProgress = getDosCombatRatingProgress(commander.combatRatingScore);

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
        <dt>Cargo</dt>
        <dd>
          {cargoUsed} / {commander.cargoCapacity} t
        </dd>
        <dt>Missiles</dt>
        <dd>
          {commander.missilesInstalled} / {commander.missileCapacity}
        </dd>
      </dl>
    </section>
  );
}
