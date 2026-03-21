import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

/**
 * Travel input adapter.
 *
 * The travel loop reads a single mutable input object every frame. This hook
 * merges keyboard state, pointer-captured hold buttons, and the virtual
 * joystick into that object while exposing only the renderable joystick state
 * through React.
 */
export interface TravelInputState {
  turn: number;
  thrust: number;
  fire: boolean;
  jump: boolean;
  hyperspace: boolean;
  activateEcm: boolean;
  triggerEnergyBomb: boolean;
  autoDock: boolean;
  vectorX: number;
  vectorY: number;
  vectorStrength: number;
}

export interface TravelJoystickView {
  active: boolean;
  left: string;
  top: string;
  bottom: string;
  knobLeft: string;
  knobTop: string;
}

export interface TravelPressHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

export interface TravelTapHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onContextMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}

const JOYSTICK_RADIUS = 60;
const JOYSTICK_MAX_DIST = 40;

const DEFAULT_JOYSTICK_VIEW: TravelJoystickView = {
  active: false,
  left: '1.8rem',
  top: 'auto',
  bottom: '1.8rem',
  knobLeft: '40px',
  knobTop: '40px'
};

export function createTravelInput(): TravelInputState {
  return { turn: 0, thrust: 0, fire: false, jump: false, hyperspace: false, activateEcm: false, triggerEnergyBomb: false, autoDock: false, vectorX: 0, vectorY: 0, vectorStrength: 0 };
}

export function useTravelInput(viewportRef: RefObject<HTMLDivElement | null>) {
  const inputRef = useRef(createTravelInput());
  const keysRef = useRef<Record<string, boolean>>({
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ' ': false,
    j: false,
    J: false,
    h: false,
    H: false,
    e: false,
    E: false,
    b: false,
    B: false,
    d: false,
    D: false
  });
  const joyActiveRef = useRef(false);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyCenterRef = useRef({ x: 0, y: 0 });
  const jumpPointerIdRef = useRef<number | null>(null);
  const firePointerIdRef = useRef<number | null>(null);
  const [joystickView, setJoystickView] = useState<TravelJoystickView>(DEFAULT_JOYSTICK_VIEW);

  const setJoystickState = (next: TravelJoystickView) => {
    setJoystickView((previous) =>
      previous.active === next.active &&
      previous.left === next.left &&
      previous.top === next.top &&
      previous.bottom === next.bottom &&
      previous.knobLeft === next.knobLeft &&
      previous.knobTop === next.knobTop
        ? previous
        : next
    );
  };

  const resetJoystick = () => {
    joyActiveRef.current = false;
    joyPointerIdRef.current = null;
    inputRef.current.turn = 0;
    inputRef.current.thrust = 0;
    inputRef.current.vectorX = 0;
    inputRef.current.vectorY = 0;
    inputRef.current.vectorStrength = 0;
    setJoystickState(DEFAULT_JOYSTICK_VIEW);
  };

  const handleJoystick = (clientX: number, clientY: number) => {
    let dx = clientX - joyCenterRef.current.x;
    let dy = clientY - joyCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_MAX_DIST) {
      dx = (dx / dist) * JOYSTICK_MAX_DIST;
      dy = (dy / dist) * JOYSTICK_MAX_DIST;
    }

    inputRef.current.vectorX = dx / JOYSTICK_MAX_DIST;
    inputRef.current.vectorY = dy / JOYSTICK_MAX_DIST;
    inputRef.current.vectorStrength = Math.min(1, Math.hypot(inputRef.current.vectorX, inputRef.current.vectorY));
    inputRef.current.turn = inputRef.current.vectorX;
    inputRef.current.thrust = inputRef.current.vectorStrength;

    setJoystickView((previous) => {
      const next: TravelJoystickView = {
        ...previous,
        active: true,
        knobLeft: `${dx + 40}px`,
        knobTop: `${dy + 40}px`
      };
      return previous.active === next.active && previous.knobLeft === next.knobLeft && previous.knobTop === next.knobTop ? previous : next;
    });
  };

  const onViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || event.button !== 0) {
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest('.travel-screen__button, .travel-screen__actions button')) {
      return;
    }

    // The joystick claims pointer capture so drags continue to steer even if
    // the pointer leaves the viewport element.
    const viewportRect = viewport.getBoundingClientRect();
    const left = `${event.clientX - viewportRect.left - JOYSTICK_RADIUS}px`;
    const top = `${event.clientY - viewportRect.top - JOYSTICK_RADIUS}px`;
    joyActiveRef.current = true;
    joyPointerIdRef.current = event.pointerId;
    viewport.setPointerCapture(event.pointerId);
    joyCenterRef.current = { x: event.clientX, y: event.clientY };
    setJoystickState({
      active: true,
      left,
      top,
      bottom: 'auto',
      knobLeft: '40px',
      knobTop: '40px'
    });
    handleJoystick(event.clientX, event.clientY);
  };

  const onViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!joyActiveRef.current || joyPointerIdRef.current !== event.pointerId) {
      return;
    }
    handleJoystick(event.clientX, event.clientY);
  };

  const onViewportPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    if (joyPointerIdRef.current !== event.pointerId) {
      return;
    }
    if (viewport?.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    resetJoystick();
  };

  useEffect(() => {
    // Keyboard handlers only update refs; the animation loop decides how those
    // latched inputs interact with touch controls each frame.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key in keysRef.current) {
        keysRef.current[event.key] = true;
        if (event.key === ' ' || event.key === 'ArrowUp') {
          event.preventDefault();
        }
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key in keysRef.current) {
        keysRef.current[event.key] = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const createPressHandlers = (key: 'fire' | 'jump', activePointerIdRef: MutableRefObject<number | null>): TravelPressHandlers => {
    // Hold actions stay active until the same pointer releases or capture is lost.
    const release = (event?: ReactPointerEvent<HTMLButtonElement>) => {
      if (event && activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }
      if (event) {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }
      activePointerIdRef.current = null;
      inputRef.current[key] = false;
    };

    return {
      onPointerDown: (event) => {
        event.preventDefault();
        activePointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        inputRef.current[key] = true;
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (event) => {
        event.preventDefault();
      }
    };
  };

  const createTapHandlers = (key: 'hyperspace' | 'activateEcm' | 'triggerEnergyBomb' | 'autoDock'): TravelTapHandlers => ({
    // Tap actions are single-frame latches. The session loop clears them after
    // consuming the request.
    onPointerDown: (event) => {
      event.preventDefault();
      inputRef.current[key] = true;
    },
    onContextMenu: (event) => {
      event.preventDefault();
    }
  });

  const viewportHandlers = useMemo(
    () => ({
      onPointerDown: onViewportPointerDown,
      onPointerMove: onViewportPointerMove,
      onPointerUp: onViewportPointerUp,
      onPointerCancel: onViewportPointerUp
    }),
    []
  );
  const jumpButtonHandlers = useMemo(() => createPressHandlers('jump', jumpPointerIdRef), []);
  const fireButtonHandlers = useMemo(() => createPressHandlers('fire', firePointerIdRef), []);
  const hyperspaceButtonHandlers = useMemo(() => createTapHandlers('hyperspace'), []);
  const ecmButtonHandlers = useMemo(() => createTapHandlers('activateEcm'), []);
  const bombButtonHandlers = useMemo(() => createTapHandlers('triggerEnergyBomb'), []);
  const dockButtonHandlers = useMemo(() => createTapHandlers('autoDock'), []);
  const resetInput = useMemo(
    () => () => {
      // Reset clears both transient button latches and joystick-derived axes.
      Object.assign(inputRef.current, createTravelInput());
      Object.keys(keysRef.current).forEach((key) => {
        keysRef.current[key] = false;
      });
      resetJoystick();
    },
    []
  );

  return useMemo(
    () => ({
      inputRef,
      keysRef,
      joyActiveRef,
      joystickView,
      viewportHandlers,
      jumpButtonHandlers,
      fireButtonHandlers,
      hyperspaceButtonHandlers,
      ecmButtonHandlers,
      bombButtonHandlers,
      dockButtonHandlers,
      resetInput
    }),
    [
      bombButtonHandlers,
      dockButtonHandlers,
      ecmButtonHandlers,
      fireButtonHandlers,
      hyperspaceButtonHandlers,
      joystickView,
      jumpButtonHandlers,
      resetInput,
      viewportHandlers
    ]
  );
}
