// input.js — keyboard state, edge presses, pointer-lock mouse look and the
// attack click. Everything else reads from here; nothing else touches the DOM.
export const keys = {};
const pressed = new Set();
let mouseDX = 0, mouseDY = 0;
let attackHeld = false, attackEdge = false;
let canvas = null, canLock = null;

export function initInput(c, opts = {}) {
  canvas = c;
  canLock = opts.canLock || (() => true);
  window.addEventListener("keydown", (e) => {
    if (!keys[e.code]) pressed.add(e.code);
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
  canvas.addEventListener("click", () => {
    if (canLock() && document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  });
  document.addEventListener("mousedown", (e) => {
    if (e.button === 0 && document.pointerLockElement === canvas) {
      if (!attackHeld) attackEdge = true;
      attackHeld = true;
    }
  });
  document.addEventListener("mouseup", (e) => { if (e.button === 0) attackHeld = false; });
}

export function wasPressed(code) { return pressed.has(code); }
export function endFrame() { pressed.clear(); }
export function consumeMouse() {
  const out = { dx: mouseDX, dy: mouseDY };
  mouseDX = 0; mouseDY = 0;
  return out;
}
export function consumeAttack() {
  const a = attackEdge;
  attackEdge = false;
  return a;
}
export function isAttackHeld() { return attackHeld; }
