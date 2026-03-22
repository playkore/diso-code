import { Profiler, useRef, type ProfilerOnRenderCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import type { LaserMountPosition } from '../../domain/shipCatalog';
import { useGameStore } from '../../store/useGameStore';
import { formatLightYears } from '../../utils/distance';
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

  const energyBanks = travel.hud.energyBanks.map((ratio, index) => (
    <span key={`energy-bank-${index}`} className="travel-screen__hud-bank">
      <span className="travel-screen__hud-bank-fill" style={{ width: `${ratio * 100}%`, backgroundColor: travel.hud.energyColor }} />
    </span>
  ));
  const mountLabels: Record<LaserMountPosition, string> = { front: 'F', rear: 'A', left: 'L', right: 'R' };
  const laserHeat = travel.hud.laserHeat.map((entry) => (
    <span key={`laser-heat-${entry.mount}`} className={`travel-screen__hud-heat-cell${entry.installed ? '' : ' travel-screen__hud-heat-cell--inactive'}`}>
      <span className="travel-screen__hud-heat-label">{mountLabels[entry.mount as LaserMountPosition]}</span>
      <span className="travel-screen__hud-meter">
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
            <div className="travel-screen__hud-line">Route: {session.originSystem} -&gt; {session.destinationSystem}</div>
            <div className="travel-screen__hud-line">
              Fuel: {formatLightYears(session.fuelCost)} <span className="travel-screen__hud-subtle">on arrival jump</span>
            </div>
            <div className="travel-screen__hud-line">Score: <span>{travel.hud.score}</span></div>
            <div className="travel-screen__hud-line travel-screen__hud-line--bars">
              <span className="travel-screen__hud-label">Energy</span>
              <span className="travel-screen__hud-banks">{energyBanks}</span>
            </div>
            <div className="travel-screen__hud-line travel-screen__hud-line--bars">
              <span className="travel-screen__hud-label">Shield</span>
              <span className="travel-screen__hud-meter">
                <span className="travel-screen__hud-meter-fill" style={{ width: `${travel.hud.shieldRatio * 100}%`, backgroundColor: travel.hud.shieldColor }} />
              </span>
            </div>
            <div className="travel-screen__hud-line travel-screen__hud-line--bars">
              <span className="travel-screen__hud-label">Heat</span>
              <span className="travel-screen__hud-heat-grid">{laserHeat}</span>
            </div>
            <div className="travel-screen__hud-line">Jump Drive: <span style={{ color: travel.hud.jumpColor }}>{travel.hud.jump}</span></div>
            <div className="travel-screen__hud-line">Hyperspace: <span style={{ color: travel.hud.hyperspaceColor }}>{travel.hud.hyperspace}</span></div>
            <div className="travel-screen__hud-line">Legal: <span style={{ color: travel.hud.legalColor }}>{travel.hud.legal}</span></div>
            <div className="travel-screen__hud-line">Threat: <span style={{ color: travel.hud.threatColor }}>{travel.hud.threat}</span></div>
            <div className="travel-screen__hud-line">Arc: <span style={{ color: travel.hud.arcColor }}>{travel.hud.arc}</span></div>
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
