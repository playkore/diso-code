import { Profiler, useRef, type ProfilerOnRenderCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { shallow } from 'zustand/shallow';
import { getRouteForTab } from '../../appRoutes';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import type { LaserMountPosition } from '../../domain/shipCatalog';
import { useGameStore } from '../../store/useGameStore';
import type { ScenarioState } from '../../store/types';
import { formatLightYears } from '../../utils/distance';
import { formatCredits } from '../../utils/money';
import { TravelPerfOverlay } from './TravelPerfOverlay';
import { useTravelSession } from './useTravelSession';

export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const commanderCash = useGameStore((state) => state.commander.cash);
  const commanderFuel = useGameStore((state) => state.commander.fuel);
  const scenario = useGameStore((state) => state.scenario) as ScenarioState;
  const clearScenarioToast = useGameStore((state) => state.clearScenarioToast);
  const combatCommander = useGameStore(
    (state) => ({
      cargo: state.commander.cargo,
      missionCargo: state.commander.missionCargo,
      legalValue: state.commander.legalValue,
      galaxyIndex: state.universe.galaxyIndex,
      energyBanks: state.commander.energyBanks,
      energyPerBank: state.commander.energyPerBank,
      laserMounts: state.commander.laserMounts,
      installedEquipment: state.commander.installedEquipment,
      missilesInstalled: state.commander.missilesInstalled
    }),
    shallow
  );
  const grantCombatCredits = useGameStore((state) => state.grantCombatCredits);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const showTravelPerfOverlay = useGameStore((state) => state.ui.showTravelPerfOverlay);
  const activeTab = useGameStore((state) => state.ui.activeTab);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const travel = useTravelSession({ canvasRef, viewportRef }, session, combatCommander, scenario, clearScenarioToast, grantCombatCredits, completeTravel, navigate);
  const handleRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    travel.recordReactCommit(actualDuration);
  };

  if (!session) {
    // A browser refresh during flight restores the last docked autosave instead
    // of trying to rebuild the transient simulation runtime.
    return <Navigate to={getRouteForTab(activeTab)} replace />;
  }

  // Undocking reuses the travel screen with a zero-cost local-space session.
  // In that mode there is no selected hyperspace destination, so the HUD should
  // present the route as absent and fuel as the ship's remaining reserve.
  const hasHyperspaceRoute = session.fuelUnits > 0 && session.originSystem !== session.destinationSystem;
  const routeLabel = hasHyperspaceRoute ? `${session.originSystem} -> ${session.destinationSystem}` : 'none';
  const fuelLabel = hasHyperspaceRoute ? formatLightYears(session.fuelCost) : formatLightYears(commanderFuel);

  const energyBanks = travel.hud.energyBanks.map((ratio, index) => (
    <span key={`energy-bank-${index}`} className="travel-screen__hud-bank">
      <span className="travel-screen__hud-bank-fill" style={{ width: `${ratio * 100}%`, backgroundColor: travel.hud.energyColor }} />
    </span>
  ));
  const mountLabels: Record<LaserMountPosition, string> = { front: 'F', rear: 'A', left: 'L', right: 'R' };
  // Heat reserves a fixed slot for each mount so the row does not jump around
  // between ships, but empty hardpoints stay visually hidden.
  const laserHeat = travel.hud.laserHeat.map((entry) => (
    <span key={`laser-heat-${entry.mount}`} className={`travel-screen__hud-heat-cell${entry.installed ? '' : ' travel-screen__hud-heat-cell--inactive'}`}>
      <span className="travel-screen__hud-heat-label">{mountLabels[entry.mount as LaserMountPosition]}</span>
      <span className="travel-screen__hud-meter travel-screen__hud-meter--heat">
        <span className="travel-screen__hud-meter-fill" style={{ width: `${entry.ratio * 100}%`, backgroundColor: entry.color }} />
      </span>
    </span>
  ));

  return (
    <Profiler id="travel-screen" onRender={handleRender}>
      <section className="travel-screen">
        <div className="travel-screen__viewport" ref={viewportRef} {...travel.viewportHandlers}>
          <canvas ref={canvasRef} className="travel-screen__canvas" />

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
                <span className="travel-screen__hud-key">Energy</span>
                <span className="travel-screen__hud-banks">{energyBanks}</span>
              </span>
              <span className="travel-screen__hud-stat travel-screen__hud-stat--bar">
                <span className="travel-screen__hud-key">Shield</span>
                <span className="travel-screen__hud-meter">
                  <span className="travel-screen__hud-meter-fill" style={{ width: `${travel.hud.shieldRatio * 100}%`, backgroundColor: travel.hud.shieldColor }} />
                </span>
              </span>
              <span className="travel-screen__hud-stat travel-screen__hud-stat--heat">
                <span className="travel-screen__hud-key">Heat</span>
                <span className="travel-screen__hud-heat-grid">{laserHeat}</span>
              </span>
              <span className="travel-screen__hud-stat">
                <span className="travel-screen__hud-key">Drive</span>
                <span className="travel-screen__hud-value" style={{ color: travel.hud.jumpColor }}>{travel.hud.jump}</span>
              </span>
              <span className="travel-screen__hud-stat">
                <span className="travel-screen__hud-key">Hyper</span>
                <span className="travel-screen__hud-value" style={{ color: travel.hud.hyperspaceColor }}>{travel.hud.hyperspace}</span>
              </span>
              <span className="travel-screen__hud-stat">
                <span className="travel-screen__hud-key">Legal</span>
                <span className="travel-screen__hud-value" style={{ color: travel.hud.legalColor }}>{travel.hud.legal}</span>
              </span>
              <span className="travel-screen__hud-stat">
                <span className="travel-screen__hud-key">Threat</span>
                <span className="travel-screen__hud-value" style={{ color: travel.hud.threatColor }}>{travel.hud.threat}</span>
              </span>
              <span className="travel-screen__hud-stat">
                <span className="travel-screen__hud-key">Arc</span>
                <span className="travel-screen__hud-value" style={{ color: travel.hud.arcColor }}>{travel.hud.arc}</span>
              </span>
            </div>
          </div>

          {showTravelPerfOverlay ? <TravelPerfOverlay perf={travel.perf} /> : null}

          <div className="travel-screen__message">{travel.message}</div>

          <div className="travel-screen__controls">
            <div
              className={`travel-screen__joystick${travel.joystickView.active ? ' travel-screen__joystick--active' : ''}`}
              style={{ left: travel.joystickView.left, top: travel.joystickView.top, bottom: travel.joystickView.bottom }}
            >
              <div
                className="travel-screen__joystick-knob"
                style={{ left: travel.joystickView.knobLeft, top: travel.joystickView.knobTop }}
              />
            </div>
            {/* The combat buttons travel as a single anchored cluster so mobile
                spacing is controlled by stack gaps instead of hand-tuned
                per-button coordinates that can overlap on short viewports. */}
            <div className="travel-screen__controls-cluster">
              {(travel.ecm.visible || travel.bomb.visible || travel.autoDock.visible) ? (
                <div className="travel-screen__controls-aux">
                  {travel.ecm.visible ? (
                    <button type="button" className="travel-screen__button travel-screen__button--aux" {...travel.ecmButtonHandlers}>
                      ECM
                    </button>
                  ) : null}
                  {travel.bomb.visible ? (
                    <button type="button" className="travel-screen__button travel-screen__button--aux" {...travel.bombButtonHandlers}>
                      BOMB
                    </button>
                  ) : null}
                  {travel.autoDock.visible ? (
                    <button
                      type="button"
                      aria-disabled={!travel.autoDock.enabled}
                      aria-pressed={travel.autoDock.active}
                      className={`travel-screen__button travel-screen__button--aux travel-screen__button--dock${
                        travel.autoDock.enabled ? '' : ' travel-screen__button--dock-disabled'
                      }${travel.autoDock.active ? ' travel-screen__button--dock-active' : ''}`}
                      {...(travel.autoDock.enabled ? travel.dockButtonHandlers : {})}
                    >
                      DOCK
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="travel-screen__controls-primary">
                <button
                  type="button"
                  className={`travel-screen__button travel-screen__button--hyperspace${travel.hyperspaceHidden ? ' travel-screen__button--hidden' : ''}`}
                  {...travel.hyperspaceButtonHandlers}
                >
                  HYPER
                </button>
                <button type="button" className="travel-screen__button travel-screen__button--jump" {...travel.jumpButtonHandlers}>
                  JUMP
                </button>
                <button
                  type="button"
                  aria-pressed={travel.hud.lasersActive}
                  className={`travel-screen__button travel-screen__button--laser${
                    travel.hud.lasersActive ? ' travel-screen__button--laser-on' : ' travel-screen__button--laser-off'
                  }`}
                  {...travel.toggleLasersButtonHandlers}
                >
                  LASER
                </button>
              </div>
            </div>
          </div>

          <div className="travel-screen__help">
            Space Laser On/Off / J Jump / H Hyper / CNT {canEnemyLaserFireByCnt(-32) ? 'FIRE' : 'HOLD'} {canEnemyLaserHitByCnt(-35) ? 'HIT' : 'MISS'}
          </div>
        </div>
      </section>
    </Profiler>
  );
}
