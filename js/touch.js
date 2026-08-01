// Mobile play, ported from lassen-camp: floating virtual joystick (left thumb)
// to move, drag-to-look (right thumb), quick tap to interact, a round button
// for E. No pointer lock on touch devices — G.player.locked is pinned true.
//
// touchInput is owned HERE and imported by player.js (the reverse import of
// applyLook makes a deliberate, safe module cycle — both bindings are only
// dereferenced at call time).
import { applyLook } from './player.js';

export const touchInput = { x: 0, y: 0 };

export function initTouch(G) {
  G.player.locked = true;

  const ui = document.getElementById('touch');
  const stick = document.getElementById('stick');
  const nub = document.getElementById('stickNub');
  const canvas = G.canvas;

  const R = 46; // joystick throw radius (px)
  let stickId = null, lookId = null;
  let stickCX = 0, stickCY = 0;
  let lookX = 0, lookY = 0, lookStartT = 0, lookDist = 0;

  // left-and-lower region spawns the stick; everything else drags the view
  const inStickZone = (x, y) => x < innerWidth * 0.45 && y > innerHeight * 0.35;
  const playing = () => G.started && !G.overlayOpen;

  function setNub(dx, dy) { nub.style.transform = `translate(${dx}px, ${dy}px)`; }
  function placeStick(cx, cy) {
    stick.style.left = (cx - stick.offsetWidth / 2) + 'px';
    stick.style.top = (cy - stick.offsetHeight / 2) + 'px';
    stick.style.bottom = 'auto';
  }
  function restStick() {
    stick.style.left = ''; stick.style.top = ''; stick.style.bottom = '';
    setNub(0, 0);
    touchInput.x = 0; touchInput.y = 0;
  }

  function onStart(e) {
    if (!playing()) return;
    for (const t of e.changedTouches) {
      if (stickId === null && inStickZone(t.clientX, t.clientY)) {
        stickId = t.identifier;
        stickCX = t.clientX; stickCY = t.clientY;
        placeStick(stickCX, stickCY);
        stick.classList.add('live');
      } else if (lookId === null) {
        lookId = t.identifier;
        lookX = t.clientX; lookY = t.clientY;
        lookStartT = performance.now(); lookDist = 0;
      }
    }
    e.preventDefault();
  }

  function onMove(e) {
    if (!playing()) return;
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        let dx = t.clientX - stickCX, dy = t.clientY - stickCY;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        setNub(dx, dy);
        touchInput.x = dx / R;
        touchInput.y = dy / R;   // thumb up → negative → forward
      } else if (t.identifier === lookId) {
        const dx = t.clientX - lookX, dy = t.clientY - lookY;
        lookX = t.clientX; lookY = t.clientY;
        lookDist += Math.hypot(dx, dy);
        applyLook(dx, dy);
      }
    }
    e.preventDefault();
  }

  function onEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) {
        stickId = null;
        stick.classList.remove('live');
        restStick();
      } else if (t.identifier === lookId) {
        lookId = null;
        const held = performance.now() - lookStartT;
        // a quick, still tap uses whatever the prompt is showing
        if (playing() && held < 300 && lookDist < 12 && G.player.nearest) {
          G.player.nearest.use();
        }
      }
    }
    if (playing()) e.preventDefault();
  }

  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove', onMove, { passive: false });
  canvas.addEventListener('touchend', onEnd, { passive: false });
  canvas.addEventListener('touchcancel', onEnd, { passive: false });

  function tap(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => {
      e.preventDefault(); e.stopPropagation();
      el.classList.add('held');
    }, { passive: false });
    el.addEventListener('touchend', e => {
      e.preventDefault();
      el.classList.remove('held');
      if (playing()) fn();
    }, { passive: false });
    el.addEventListener('touchcancel', () => el.classList.remove('held'), { passive: false });
    return el;
  }

  /* press-and-hold buttons (fly ▲▼) — set a flag while touched */
  function hold(id, set) {
    const el = document.getElementById(id);
    const down = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('held'); set(true); };
    const up = e => { e.preventDefault(); el.classList.remove('held'); set(false); };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    return el;
  }

  G.btnInteract = tap('btnInteract', () => {
    if (G.player.nearest) G.player.nearest.use();
  });
  tap('btnFly', () => G.toggleMode());
  hold('btnUp', v => { G.flyUp = v; });
  hold('btnDown', v => { G.flyDown = v; });

  G.showTouchUI = () => ui.classList.remove('hidden');
}
