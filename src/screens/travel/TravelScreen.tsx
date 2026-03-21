import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { canEnemyLaserFireByCnt, canEnemyLaserHitByCnt } from '../../domain/travelCombat';
import { useGameStore } from '../../store/useGameStore';
import { formatLightYears } from '../../utils/distance';
import { useTravelSession } from './useTravelSession';

/**
 * Declarative shell for the travel screen.
 *
 * This component intentionally stays light:
 * - it selects the minimum store state needed to run a travel session
 * - it creates the refs used by the imperative flight subsystem
 * - it renders the static DOM scaffold that the session hook updates
 *
 * The real-time behavior lives in `useTravelSession`.
 */
export function TravelScreen() {
  const navigate = useNavigate();
  const session = useGameStore((state) => state.travelSession);
  const commander = useGameStore((state) => state.commander);
  const completeTravel = useGameStore((state) => state.completeTravel);
  const cancelTravel = useGameStore((state) => state.cancelTravel);

  // The flight UI is ref-driven. The session hook updates HUD nodes and canvas
  // directly every frame instead of routing every change through React state.
  const refs = {
    canvasRef: useRef<HTMLCanvasElement | null>(null),
    viewportRef: useRef<HTMLDivElement | null>(null),
    messageRef: useRef<HTMLDivElement | null>(null),
    scoreRef: useRef<HTMLSpanElement | null>(null),
    shieldsRef: useRef<HTMLSpanElement | null>(null),
    jumpRef: useRef<HTMLSpanElement | null>(null),
    hyperspaceRef: useRef<HTMLSpanElement | null>(null),
    legalRef: useRef<HTMLSpanElement | null>(null),
    threatRef: useRef<HTMLSpanElement | null>(null),
    arcRef: useRef<HTMLSpanElement | null>(null),
    knobRef: useRef<HTMLDivElement | null>(null),
    jumpButtonRef: useRef<HTMLButtonElement | null>(null),
    hyperspaceButtonRef: useRef<HTMLButtonElement | null>(null),
    fireButtonRef: useRef<HTMLButtonElement | null>(null),
    ecmButtonRef: useRef<HTMLButtonElement | null>(null),
    bombButtonRef: useRef<HTMLButtonElement | null>(null),
    dockButtonRef: useRef<HTMLButtonElement | null>(null)
  };

  // Mount the live flight session for the current route.
  useTravelSession(refs, session, commander, completeTravel, cancelTravel, navigate);

  // If the user opens `/travel` without an active route, bounce back to the
  // star map where travel can be started properly.
  if (!session) {
    return <Navigate to="/star-map" replace />;
  }

  return (
    <section className="travel-screen">
      {/* The viewport contains the canvas, HUD, overlay messages and touch UI. */}
      <div className="travel-screen__viewport" ref={refs.viewportRef}>
        <canvas ref={refs.canvasRef} className="travel-screen__canvas" />

        {/* HUD values are filled imperatively by the session hook. */}
        <div className="travel-screen__hud">
          <div className="travel-screen__hud-line">Route: {session.originSystem} -&gt; {session.destinationSystem}</div>
          <div className="travel-screen__hud-line">
            Fuel: {formatLightYears(session.fuelCost)} <span className="travel-screen__hud-subtle">on arrival jump</span>
          </div>
          <div className="travel-screen__hud-line">Score: <span ref={refs.scoreRef}>0</span></div>
          <div className="travel-screen__hud-line">Shields: <span ref={refs.shieldsRef}>100</span>%</div>
          <div className="travel-screen__hud-line">Jump Drive: <span ref={refs.jumpRef}>READY</span></div>
          <div className="travel-screen__hud-line">Hyperspace: <span ref={refs.hyperspaceRef}>SAFE ZONE</span></div>
          <div className="travel-screen__hud-line">Legal: <span ref={refs.legalRef}>clean 0</span></div>
          <div className="travel-screen__hud-line">Threat: <span ref={refs.threatRef}>F- / 0</span></div>
          <div className="travel-screen__hud-line">Arc: <span ref={refs.arcRef}>FRONT</span></div>
        </div>

        <div ref={refs.messageRef} className="travel-screen__message" />

        {/* On-screen controls are required for touch devices. */}
        <div className="travel-screen__controls">
          <div className="travel-screen__joystick">
            <div ref={refs.knobRef} className="travel-screen__joystick-knob" />
          </div>
          <button ref={refs.jumpButtonRef} type="button" className="travel-screen__button travel-screen__button--jump">
            JUMP
          </button>
          <button ref={refs.hyperspaceButtonRef} type="button" className="travel-screen__button travel-screen__button--hyperspace">
            HYPER
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

        {/* Compact reminder of keyboard controls and the current CNT thresholds. */}
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
