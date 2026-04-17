import type { TravelJoystickView, TravelPressHandlers, TravelTapHandlers } from './useTravelInput';
import type { BombUiState, EcmUiState } from './travelSessionState';

interface TravelControlsProps {
  joystickView: TravelJoystickView;
  hyperspaceHidden: boolean;
  bomb: BombUiState;
  ecm: EcmUiState;
  jumpButtonHandlers: TravelPressHandlers;
  hyperspaceButtonHandlers: TravelTapHandlers;
  ecmButtonHandlers: TravelTapHandlers;
  bombButtonHandlers: TravelTapHandlers;
  onOpenConsole: () => void;
}

/**
 * Keeps all flight controls in one place so the screen component no longer has
 * to interleave layout markup with store data and session logic.
 */
export function TravelControls({
  joystickView,
  hyperspaceHidden,
  bomb,
  ecm,
  jumpButtonHandlers,
  hyperspaceButtonHandlers,
  ecmButtonHandlers,
  bombButtonHandlers,
  onOpenConsole
}: TravelControlsProps) {
  return (
    <div className="travel-screen__controls">
      <div
        className={`travel-screen__joystick${joystickView.active ? ' travel-screen__joystick--active' : ''}`}
        style={{ left: joystickView.left, top: joystickView.top, bottom: joystickView.bottom }}
      >
        <div className="travel-screen__joystick-knob" style={{ left: joystickView.knobLeft, top: joystickView.knobTop }} />
      </div>
      <div className="travel-screen__controls-cluster">
        {(ecm.visible || bomb.visible) ? (
          <div className="travel-screen__controls-aux">
            {ecm.visible ? (
              <button type="button" className="travel-screen__button travel-screen__button--aux" {...ecmButtonHandlers}>
                ECM
              </button>
            ) : null}
            {bomb.visible ? (
              <button type="button" className="travel-screen__button travel-screen__button--aux" {...bombButtonHandlers}>
                BOMB
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="travel-screen__controls-primary">
          <button
            type="button"
            className={`travel-screen__button travel-screen__button--hyperspace${hyperspaceHidden ? ' travel-screen__button--hidden' : ''}`}
            {...hyperspaceButtonHandlers}
          >
            HYPER
          </button>
          <button type="button" className="travel-screen__button travel-screen__button--jump" {...jumpButtonHandlers}>
            JUMP
          </button>
          <button
            type="button"
            className="travel-screen__button travel-screen__button--console"
            onClick={onOpenConsole}
          >
            CONSOLE
          </button>
        </div>
      </div>
    </div>
  );
}
