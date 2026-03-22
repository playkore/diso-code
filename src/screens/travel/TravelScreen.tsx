import { Profiler, useRef, type ProfilerOnRenderCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import { cargoUsedTonnes } from '../../domain/commander';
import type { LaserMountPosition } from '../../domain/shipCatalog';
import { useGameStore } from '../../store/useGameStore';
import { formatLightYears } from '../../utils/distance';
import { formatCredits } from '../../utils/money';
import { TravelPerfOverlay } from './TravelPerfOverlay';
import { useTravelSession } from './useTravelSession';

export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const commander = useGameStore((state) => state.commander);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const showTravelPerfOverlay = useGameStore((state) => state.ui.showTravelPerfOverlay);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const travel = useTravelSession({ canvasRef, viewportRef }, session, commander, completeTravel, navigate);
  const handleRender: ProfilerOnRenderCallback = (_id, _phase, actualDuration) => {
    travel.recordReactCommit(actualDuration);
  };

  if (!session) {
    return <Navigate to="/star-map" replace />;
  }

  const cargoUsed = cargoUsedTonnes(commander.cargo);
  const fuelRatio = commander.maxFuel > 0 ? Math.max(0, Math.min(1, commander.fuel / commander.maxFuel)) : 0;
  const axisMarkerX = `${(travel.hud.velocityXRatio + 1) * 50}%`;
  const axisMarkerY = `${(travel.hud.velocityYRatio + 1) * 50}%`;
  const mountLabels: Record<LaserMountPosition, string> = { front: 'F', rear: 'A', left: 'L', right: 'R' };
  const sliderRows: Array<{ label: string; ratio: number; color: string; inactive?: boolean }> = [
    { label: 'Shield', ratio: travel.hud.shieldRatio, color: travel.hud.shieldColor, inactive: false },
    { label: 'Fuel', ratio: fuelRatio, color: fuelRatio > 0.65 ? '#55ff55' : fuelRatio > 0.3 ? '#ffff55' : '#ff5555', inactive: false },
    ...travel.hud.energyBanks.map((ratio, index) => ({ label: `Energy ${index + 1}`, ratio, color: travel.hud.energyColor })),
    ...travel.hud.laserHeat.map((entry) => ({
      label: `Laser ${mountLabels[entry.mount as LaserMountPosition]}`,
      ratio: entry.ratio,
      color: entry.installed ? entry.color : '#000000',
      inactive: !entry.installed
    }))
  ];

  return (
    <Profiler id="travel-screen" onRender={handleRender}>
      <section className="travel-screen">
        <div className="travel-screen__viewport" ref={viewportRef} {...travel.viewportHandlers}>
          <canvas ref={canvasRef} className="travel-screen__canvas" />

          <div className="travel-screen__hud">
            {/* The travel HUD mirrors the mock's "telemetry strip + slider wing"
                layout so the arcade view reads like a single instrument panel. */}
            <section className="travel-screen__hud-top-strip" aria-label="Secondary flight telemetry">
              <div className="travel-screen__telemetry-chip travel-screen__telemetry-chip--route">
                <span className="travel-screen__telemetry-label">Route</span>
                <span className="travel-screen__telemetry-value">
                  {session.originSystem} -&gt; {session.destinationSystem}
                </span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Score</span>
                <span className="travel-screen__telemetry-value">{travel.hud.score.padStart(4, '0')}</span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Jump</span>
                <span className="travel-screen__telemetry-value" style={{ color: travel.hud.jumpColor }}>
                  {travel.hud.jump}
                </span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Hyper</span>
                <span className="travel-screen__telemetry-value" style={{ color: travel.hud.hyperspaceColor }}>
                  {travel.hud.hyperspace}
                </span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Legal</span>
                <span className="travel-screen__telemetry-value" style={{ color: travel.hud.legalColor }}>
                  {travel.hud.legal}
                </span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Threat</span>
                <span className="travel-screen__telemetry-value" style={{ color: travel.hud.threatColor }}>
                  {travel.hud.threat}
                </span>
              </div>
              <div className="travel-screen__telemetry-chip">
                <span className="travel-screen__telemetry-label">Arc</span>
                <span className="travel-screen__telemetry-value" style={{ color: travel.hud.arcColor }}>
                  {travel.hud.arc}
                </span>
              </div>
            </section>

            <section className="travel-screen__hud-frame" aria-label="Primary travel HUD">
              <section className="travel-screen__hud-wing" aria-label="Flight systems sliders">
                {sliderRows.slice(0, 6).map((row) => (
                  <div key={row.label} className={`travel-screen__hud-row${row.inactive ? ' travel-screen__hud-row--inactive' : ''}`}>
                    <span className="travel-screen__hud-row-label">{row.label}</span>
                    <span className="travel-screen__hud-fill-bar" aria-hidden="true">
                      <span className="travel-screen__hud-fill-bar-fill" style={{ width: `${row.ratio * 100}%`, backgroundColor: row.color }} />
                    </span>
                  </div>
                ))}
                <div className="travel-screen__hud-row travel-screen__hud-row--axis">
                  <span className="travel-screen__hud-row-label">Speed X</span>
                  <span className="travel-screen__hud-axis-bar" aria-hidden="true">
                    <span className="travel-screen__hud-axis-center" />
                    <span className="travel-screen__hud-axis-marker" style={{ left: axisMarkerX }} />
                  </span>
                </div>
                <div className="travel-screen__hud-row travel-screen__hud-row--axis">
                  <span className="travel-screen__hud-row-label">Speed Y</span>
                  <span className="travel-screen__hud-axis-bar" aria-hidden="true">
                    <span className="travel-screen__hud-axis-center" />
                    <span className="travel-screen__hud-axis-marker" style={{ left: axisMarkerY }} />
                  </span>
                </div>
                {sliderRows.slice(6).map((row) => (
                  <div key={row.label} className={`travel-screen__hud-row${row.inactive ? ' travel-screen__hud-row--inactive' : ''}`}>
                    <span className="travel-screen__hud-row-label">{row.label}</span>
                    <span className="travel-screen__hud-fill-bar" aria-hidden="true">
                      <span className="travel-screen__hud-fill-bar-fill" style={{ width: `${row.ratio * 100}%`, backgroundColor: row.color }} />
                    </span>
                  </div>
                ))}
              </section>

              <section className="travel-screen__hud-center" aria-label="Radar readouts">
                <header className="travel-screen__hud-center-message">{travel.message || 'Cruise'}</header>
                <div className="travel-screen__hud-radar-readouts">
                  <div className="travel-screen__hud-radar-readout">
                    <span className="travel-screen__hud-radar-readout-label">Missiles</span>
                    <span className="travel-screen__hud-radar-readout-value">
                      {commander.missilesInstalled} / {commander.missileCapacity}
                    </span>
                  </div>
                  <div className="travel-screen__hud-radar-readout">
                    <span className="travel-screen__hud-radar-readout-label">Cargo</span>
                    <span className="travel-screen__hud-radar-readout-value">
                      {cargoUsed} / {commander.cargoCapacity} t
                    </span>
                  </div>
                  <div className="travel-screen__hud-radar-readout">
                    <span className="travel-screen__hud-radar-readout-label">Credits</span>
                    <span className="travel-screen__hud-radar-readout-value">{formatCredits(commander.cash)}</span>
                  </div>
                  <div className="travel-screen__hud-radar-readout">
                    <span className="travel-screen__hud-radar-readout-label">Fuel</span>
                    <span className="travel-screen__hud-radar-readout-value">
                      {formatLightYears(commander.fuel)} / {formatLightYears(commander.maxFuel)}
                    </span>
                  </div>
                  <div className="travel-screen__hud-radar-readout">
                    <span className="travel-screen__hud-radar-readout-label">Jump Cost</span>
                    <span className="travel-screen__hud-radar-readout-value">{formatLightYears(session.fuelCost)}</span>
                  </div>
                </div>
              </section>
            </section>
          </div>

          {showTravelPerfOverlay ? <TravelPerfOverlay perf={travel.perf} /> : null}

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
            <button type="button" className="travel-screen__button travel-screen__button--jump" {...travel.jumpButtonHandlers}>
              JUMP
            </button>
            <button
              type="button"
              className={`travel-screen__button travel-screen__button--hyperspace${travel.hyperspaceHidden ? ' travel-screen__button--hidden' : ''}`}
              {...travel.hyperspaceButtonHandlers}
            >
              HYPER
            </button>
            <button type="button" className="travel-screen__button travel-screen__button--fire" {...travel.fireButtonHandlers}>
              FIRE
            </button>
            <button type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--ecm" {...travel.ecmButtonHandlers}>
              ECM
            </button>
            <button type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--bomb" {...travel.bombButtonHandlers}>
              BOMB
            </button>
            <button type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--dock" {...travel.dockButtonHandlers}>
              DOCK
            </button>
          </div>

          <div className="travel-screen__help">
            Arrow Keys: Turn/Thrust
            <br />
            Space: Fire
            <br />
            J: Jump
            <br />
            H: Hyperspace
            <br />
            Laser CNT: {canEnemyLaserFireByCnt(-32) ? 'FIRE' : 'HOLD'} / {canEnemyLaserHitByCnt(-35) ? 'HIT' : 'MISS'}
          </div>
        </div>
      </section>
    </Profiler>
  );
}
