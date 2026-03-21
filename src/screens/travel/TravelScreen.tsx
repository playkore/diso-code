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
  const cancelTravel = useGameStore((state) => state.cancelTravel);

  const refs = {
    canvasRef: useRef<HTMLCanvasElement | null>(null),
    viewportRef: useRef<HTMLDivElement | null>(null),
    messageRef: useRef<HTMLDivElement | null>(null),
    scoreRef: useRef<HTMLSpanElement | null>(null),
    shieldsRef: useRef<HTMLSpanElement | null>(null),
    jumpRef: useRef<HTMLSpanElement | null>(null),
    legalRef: useRef<HTMLSpanElement | null>(null),
    threatRef: useRef<HTMLSpanElement | null>(null),
    arcRef: useRef<HTMLSpanElement | null>(null),
    knobRef: useRef<HTMLDivElement | null>(null),
    jumpButtonRef: useRef<HTMLButtonElement | null>(null),
    fireButtonRef: useRef<HTMLButtonElement | null>(null),
    ecmButtonRef: useRef<HTMLButtonElement | null>(null),
    bombButtonRef: useRef<HTMLButtonElement | null>(null),
    dockButtonRef: useRef<HTMLButtonElement | null>(null)
  };

  useTravelSession(refs, session, commander, completeTravel, cancelTravel, navigate);

  if (!session) {
    return <Navigate to="/star-map" replace />;
  }

  return (
    <section className="travel-screen">
      <div className="travel-screen__viewport" ref={refs.viewportRef}>
        <canvas ref={refs.canvasRef} className="travel-screen__canvas" />

        <div className="travel-screen__hud">
          <div className="travel-screen__hud-line">Route: {session.originSystem} -&gt; {session.destinationSystem}</div>
          <div className="travel-screen__hud-line">
            Fuel: {formatLightYears(session.fuelCost)} <span className="travel-screen__hud-subtle">on arrival jump</span>
          </div>
          <div className="travel-screen__hud-line">Score: <span ref={refs.scoreRef}>0</span></div>
          <div className="travel-screen__hud-line">Shields: <span ref={refs.shieldsRef}>100</span>%</div>
          <div className="travel-screen__hud-line">Jump Drive: <span ref={refs.jumpRef}>READY</span></div>
          <div className="travel-screen__hud-line">Legal: <span ref={refs.legalRef}>clean 0</span></div>
          <div className="travel-screen__hud-line">Threat: <span ref={refs.threatRef}>F- / 0</span></div>
          <div className="travel-screen__hud-line">Arc: <span ref={refs.arcRef}>FRONT</span></div>
        </div>

        <div ref={refs.messageRef} className="travel-screen__message" />

        <div className="travel-screen__controls">
          <div className="travel-screen__joystick">
            <div ref={refs.knobRef} className="travel-screen__joystick-knob" />
          </div>
          <button ref={refs.jumpButtonRef} type="button" className="travel-screen__button travel-screen__button--jump">
            JUMP
          </button>
          <button ref={refs.fireButtonRef} type="button" className="travel-screen__button travel-screen__button--fire">
            FIRE
          </button>
          <button ref={refs.ecmButtonRef} type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--ecm">
            ECM
          </button>
          <button ref={refs.bombButtonRef} type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--bomb">
            BOMB
          </button>
          <button ref={refs.dockButtonRef} type="button" className="travel-screen__button travel-screen__button--aux travel-screen__button--dock">
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
          Laser CNT: {canEnemyLaserFireByCnt(-32) ? 'FIRE' : 'HOLD'} / {canEnemyLaserHitByCnt(-35) ? 'HIT' : 'MISS'}
        </div>

        <div className="travel-screen__actions">
          <button
            type="button"
            className="button-danger"
            onClick={() => {
              cancelTravel();
              navigate('/star-map', { replace: true });
            }}
          >
            Abort Flight
          </button>
        </div>
      </div>
    </section>
  );
}
