import type { TravelJoystickView, TravelPressHandlers, TravelTapHandlers } from './useTravelInput';
import type { AutoDockUiState, BombUiState, EcmUiState } from './travelSessionState';

interface TravelControlsProps {
  joystickView: TravelJoystickView;
  hyperspaceHidden: boolean;
  hudLasersActive: boolean;
  autoDock: AutoDockUiState;
  bomb: BombUiState;
  ecm: EcmUiState;
  jumpButtonHandlers: TravelPressHandlers;
  toggleLasersButtonHandlers: TravelTapHandlers;
  hyperspaceButtonHandlers: TravelTapHandlers;
  ecmButtonHandlers: TravelTapHandlers;
  bombButtonHandlers: TravelTapHandlers;
  dockButtonHandlers: TravelTapHandlers;
}

/**
 * Keeps all flight controls in one place so the screen component no longer has
 * to interleave layout markup with store data and session logic.
 */
export function TravelControls({
  joystickView,
  hyperspaceHidden,
  hudLasersActive,
  autoDock,
  bomb,
  ecm,
  jumpButtonHandlers,
  toggleLasersButtonHandlers,
  hyperspaceButtonHandlers,
  ecmButtonHandlers,
  bombButtonHandlers,
  dockButtonHandlers
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
        {(ecm.visible || bomb.visible || autoDock.visible) ? (
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
            {autoDock.visible ? (
              <button
                type="button"
                aria-disabled={!autoDock.enabled}
                aria-pressed={autoDock.active}
                className={`travel-screen__button travel-screen__button--aux travel-screen__button--dock${
                  autoDock.enabled ? '' : ' travel-screen__button--dock-disabled'
                }${autoDock.active ? ' travel-screen__button--dock-active' : ''}`}
                {...(autoDock.enabled ? dockButtonHandlers : {})}
              >
                DOCK
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
            aria-pressed={hudLasersActive}
            className={`travel-screen__button travel-screen__button--laser${hudLasersActive ? ' travel-screen__button--laser-on' : ' travel-screen__button--laser-off'}`}
            {...toggleLasersButtonHandlers}
          >
            LASER
          </button>
        </div>
      </div>
    </div>
  );
}
