import type { MutableRefObject } from 'react';

export interface TravelInputState {
  turn: number;
  thrust: number;
  fire: boolean;
  jump: boolean;
  activateEcm: boolean;
  triggerEnergyBomb: boolean;
  autoDock: boolean;
  vectorX: number;
  vectorY: number;
  vectorStrength: number;
}

export function createTravelInput(): TravelInputState {
  return { turn: 0, thrust: 0, fire: false, jump: false, activateEcm: false, triggerEnergyBomb: false, autoDock: false, vectorX: 0, vectorY: 0, vectorStrength: 0 };
}

export function bindTravelInput(params: {
  viewport: HTMLDivElement;
  knobNode: HTMLDivElement;
  jumpButton: HTMLButtonElement;
  fireButton: HTMLButtonElement;
  ecmButton: HTMLButtonElement;
  bombButton: HTMLButtonElement;
  dockButton: HTMLButtonElement;
  input: TravelInputState;
  keys: Record<string, boolean>;
  joyActiveRef: MutableRefObject<boolean>;
}) {
  const { viewport, knobNode, jumpButton, fireButton, ecmButton, bombButton, dockButton, input, keys, joyActiveRef } = params;
  const joystickArea = viewport.querySelector('.travel-screen__joystick') as HTMLDivElement | null;
  const JOYSTICK_RADIUS = 60;
  const JOYSTICK_MAX_DIST = 40;
  let joyPointerId: number | null = null;
  let joyCenter = { x: 0, y: 0 };

  const setKnob = (dx: number, dy: number) => {
    knobNode.style.left = `${dx + 40}px`;
    knobNode.style.top = `${dy + 40}px`;
  };

  const handleJoystick = (clientX: number, clientY: number) => {
    let dx = clientX - joyCenter.x;
    let dy = clientY - joyCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > JOYSTICK_MAX_DIST) {
      dx = (dx / dist) * JOYSTICK_MAX_DIST;
      dy = (dy / dist) * JOYSTICK_MAX_DIST;
    }
    setKnob(dx, dy);
    input.vectorX = dx / JOYSTICK_MAX_DIST;
    input.vectorY = dy / JOYSTICK_MAX_DIST;
    input.vectorStrength = Math.min(1, Math.hypot(input.vectorX, input.vectorY));
    input.turn = input.vectorX;
    input.thrust = input.vectorStrength;
  };

  const resetJoystickPosition = () => {
    if (!joystickArea) {
      return;
    }
    joystickArea.style.left = '1.8rem';
    joystickArea.style.bottom = '1.8rem';
    joystickArea.style.top = 'auto';
  };

  const placeJoystickAt = (clientX: number, clientY: number) => {
    if (!joystickArea) {
      return;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const left = clientX - viewportRect.left - JOYSTICK_RADIUS;
    const top = clientY - viewportRect.top - JOYSTICK_RADIUS;
    joystickArea.style.left = `${left}px`;
    joystickArea.style.top = `${top}px`;
    joystickArea.style.bottom = 'auto';
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key in keys) {
      keys[event.key] = true;
      if (event.key === ' ' || event.key === 'ArrowUp') {
        event.preventDefault();
      }
    }
  };

  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key in keys) {
      keys[event.key] = false;
    }
  };

  const onJoyPointerDown = (event: PointerEvent) => {
    if (!joystickArea || event.button !== 0) {
      return;
    }
    const target = event.target as Element | null;
    if (target?.closest('.travel-screen__button, .travel-screen__actions button')) {
      return;
    }
    joyActiveRef.current = true;
    joyPointerId = event.pointerId;
    placeJoystickAt(event.clientX, event.clientY);
    const rect = joystickArea.getBoundingClientRect();
    joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    viewport.setPointerCapture(event.pointerId);
    handleJoystick(event.clientX, event.clientY);
  };

  const onJoyPointerMove = (event: PointerEvent) => {
    if (!joyActiveRef.current || joyPointerId !== event.pointerId) {
      return;
    }
    handleJoystick(event.clientX, event.clientY);
  };

  const onJoyPointerUp = (event: PointerEvent) => {
    if (joyPointerId !== event.pointerId) {
      return;
    }
    joyActiveRef.current = false;
    joyPointerId = null;
    input.turn = 0;
    input.thrust = 0;
    input.vectorX = 0;
    input.vectorY = 0;
    input.vectorStrength = 0;
    setKnob(0, 0);
    resetJoystickPosition();
  };

  const bindPressButton = (button: HTMLButtonElement, key: 'fire' | 'jump') => {
    const onPointerDown = () => {
      input[key] = true;
    };
    const onPointerUp = () => {
      input[key] = false;
    };
    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('pointerup', onPointerUp);
    button.addEventListener('pointerleave', onPointerUp);
    button.addEventListener('pointercancel', onPointerUp);
    return () => {
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('pointerup', onPointerUp);
      button.removeEventListener('pointerleave', onPointerUp);
      button.removeEventListener('pointercancel', onPointerUp);
    };
  };

  const bindTapButton = (button: HTMLButtonElement, key: 'activateEcm' | 'triggerEnergyBomb' | 'autoDock') => {
    const onPointerDown = () => {
      input[key] = true;
    };
    button.addEventListener('pointerdown', onPointerDown);
    return () => button.removeEventListener('pointerdown', onPointerDown);
  };

  resetJoystickPosition();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  viewport.addEventListener('pointerdown', onJoyPointerDown);
  viewport.addEventListener('pointermove', onJoyPointerMove);
  viewport.addEventListener('pointerup', onJoyPointerUp);
  viewport.addEventListener('pointercancel', onJoyPointerUp);

  const unbindJumpButton = bindPressButton(jumpButton, 'jump');
  const unbindFireButton = bindPressButton(fireButton, 'fire');
  const unbindEcmButton = bindTapButton(ecmButton, 'activateEcm');
  const unbindBombButton = bindTapButton(bombButton, 'triggerEnergyBomb');
  const unbindDockButton = bindTapButton(dockButton, 'autoDock');

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    viewport.removeEventListener('pointerdown', onJoyPointerDown);
    viewport.removeEventListener('pointermove', onJoyPointerMove);
    viewport.removeEventListener('pointerup', onJoyPointerUp);
    viewport.removeEventListener('pointercancel', onJoyPointerUp);
    unbindJumpButton();
    unbindFireButton();
    unbindEcmButton();
    unbindBombButton();
    unbindDockButton();
  };
}
