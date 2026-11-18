// input.js — keyboard state and mouse-look. Keys are tracked by code so the
// layout is the same on every machine; edges (justPressed) drive one-shot
// actions like entering a car or pausing.

export const keys = new Set();
const pressed = new Set();
let mouseDX = 0, mouseDY = 0;
let clickQueued = false;

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('mousedown', (e) => {
    if (e.button === 0) clickQueued = true;
    if (document.pointerLockElement !== canvas && canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  });
}

export function justPressed(code) {
  return pressed.has(code);
}

export function endFrameInput() {
  pressed.clear();
  mouseDX = 0; mouseDY = 0;
  clickQueued = false;
}

export function takeMouse() {
  return { dx: mouseDX, dy: mouseDY };
}

export function takeClick() {
  const c = clickQueued;
  clickQueued = false;
  return c;
}

// Driving + walking axes read by player.js and main.js.
export function driveInput() {
  const fwd = keys.has('KeyW') || keys.has('ArrowUp');
  const back = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  return {
    throttle: fwd ? 1 : back ? -0.7 : 0,
    steer: (left ? 1 : 0) - (right ? 1 : 0),
    brake: keys.has('Space') && !back,
    reverse: back,
    handbrake: keys.has('Space'),
    fwd, back, left, right,
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}
