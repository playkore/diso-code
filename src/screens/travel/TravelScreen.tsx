import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import { useGameStore } from '../../store/useGameStore';
import { formatLightYears } from '../../utils/distance';
import { useTravelSession } from './useTravelSession';

export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const commander = useGameStore((state) => state.commander);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const travel = useTravelSession({ canvasRef, viewportRef }, session, commander, completeTravel, navigate);

  if (!session) {
    return <Navigate to="/star-map" replace />;
  }

  return (
    <section className="travel-screen">
      <div className="travel-screen__viewport" ref={viewportRef} {...travel.viewportHandlers}>
        <canvas ref={canvasRef} className="travel-screen__canvas" />

        <div className="travel-screen__hud">
          <div className="travel-screen__hud-line">Route: {session.originSystem} -&gt; {session.destinationSystem}</div>
          <div className="travel-screen__hud-line">
            Fuel: {formatLightYears(session.fuelCost)} <span className="travel-screen__hud-subtle">on arrival jump</span>
          </div>
          <div className="travel-screen__hud-line">Score: <span>{travel.hud.score}</span></div>
          <div className="travel-screen__hud-line">Shields: <span style={{ color: travel.hud.shieldsColor }}>{travel.hud.shields}</span>%</div>
          <div className="travel-screen__hud-line">Jump Drive: <span style={{ color: travel.hud.jumpColor }}>{travel.hud.jump}</span></div>
          <div className="travel-screen__hud-line">Hyperspace: <span style={{ color: travel.hud.hyperspaceColor }}>{travel.hud.hyperspace}</span></div>
          <div className="travel-screen__hud-line">Legal: <span style={{ color: travel.hud.legalColor }}>{travel.hud.legal}</span></div>
          <div className="travel-screen__hud-line">Threat: <span style={{ color: travel.hud.threatColor }}>{travel.hud.threat}</span></div>
          <div className="travel-screen__hud-line">Arc: <span style={{ color: travel.hud.arcColor }}>{travel.hud.arc}</span></div>
        </div>

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
  );
}
