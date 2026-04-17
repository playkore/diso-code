import type { TravelSessionHudState } from './travelSessionState';
import { formatCredits } from '../../../../shared/utils/money';

interface TravelHudPanelProps {
  routeLabel: string;
  fuelLabel: string;
  commanderCash: number;
  hud: TravelSessionHudState;
}

/**
 * Renders the flight telemetry block as a standalone component so the screen
 * container can stay focused on wiring and route fallback behavior.
 */
export function TravelHudPanel({ routeLabel, fuelLabel, commanderCash, hud }: TravelHudPanelProps) {
  return (
    <div className="travel-screen__hud">
      <div className="travel-screen__hud-panel" aria-label="Flight telemetry">
        <span className="travel-screen__hud-stat travel-screen__hud-stat--route">
          <span className="travel-screen__hud-key">Route</span>
          <span className="travel-screen__hud-value">{routeLabel}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Fuel</span>
          <span className="travel-screen__hud-value">{fuelLabel}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Credits</span>
          <span className="travel-screen__hud-value">{formatCredits(commanderCash)}</span>
        </span>
        <span className="travel-screen__hud-stat travel-screen__hud-stat--bar">
          <span className="travel-screen__hud-key">HP</span>
          <span className="travel-screen__hud-meter">
            <span className="travel-screen__hud-meter-fill" style={{ width: `${hud.hpRatio * 100}%`, backgroundColor: hud.hpColor }} />
          </span>
        </span>
        <span className="travel-screen__hud-stat travel-screen__hud-stat--bar">
          <span className="travel-screen__hud-key">XP</span>
          <span className="travel-screen__hud-meter">
            <span className="travel-screen__hud-meter-fill" style={{ width: `${hud.xpRatio * 100}%`, backgroundColor: hud.xpColor }} />
          </span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Level</span>
          <span className="travel-screen__hud-value">{hud.level}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Attack</span>
          <span className="travel-screen__hud-value">{hud.attackLabel}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">HP Readout</span>
          <span className="travel-screen__hud-value">{hud.hpLabel}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">XP Readout</span>
          <span className="travel-screen__hud-value">{hud.xpLabel}</span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Drive</span>
          <span className="travel-screen__hud-value" style={{ color: hud.jumpColor }}>
            {hud.jump}
          </span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Hyper</span>
          <span className="travel-screen__hud-value" style={{ color: hud.hyperspaceColor }}>
            {hud.hyperspace}
          </span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Legal</span>
          <span className="travel-screen__hud-value" style={{ color: hud.legalColor }}>
            {hud.legal}
          </span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Threat</span>
          <span className="travel-screen__hud-value" style={{ color: hud.threatColor }}>
            {hud.threat}
          </span>
        </span>
        <span className="travel-screen__hud-stat">
          <span className="travel-screen__hud-key">Arc</span>
          <span className="travel-screen__hud-value" style={{ color: hud.arcColor }}>
            {hud.arc}
          </span>
        </span>
      </div>
    </div>
  );
}
