// Bootstrap: renderer (modeled on alice-lunch-party — PMREM RoomEnvironment,
// sRGB output, ACES tone mapping, no post for now), the G context object,
// the begin-button flow, and the clock loop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CFG } from './config.js';
import { buildWorld, floorY, updateWorld, toggleNight } from './world.js';
import { initPlayer, updatePlayer, lock } from './player.js';
import { initTouch } from './touch.js';
import { initMoments } from './moments.js';
import { initIntroCam, updateIntroCam, startDive } from './introcam.js';
import { initUI } from './ui.js';

/* ── renderer ── */
const canvas = document.getElementById('scene');
const touchMode = matchMedia('(pointer: coarse)').matches;
if (touchMode) document.body.classList.add('touch');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: !touchMode, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d1a);

const camera = new THREE.PerspectiveCamera(CFG.FOV, innerWidth / innerHeight, CFG.NEAR, CFG.FAR);

/* environment probe — real reflections in the marble, gold and mirror ball */
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromScene(new RoomEnvironment(), .04);
scene.environment = envRT.texture;
scene.environmentIntensity = CFG.LIGHT.ENV;

/* ── the one context object threaded through every builder ── */
const G = {
  canvas, renderer, scene, camera, touchMode,
  started: false,
  overlayOpen: true,
  cursorMode: false,
  mode: 'walk',       // 'walk' | 'fly'
  flyUp: false,       // held touch ▲▼ buttons (touch.js writes)
  flyDown: false,
  colliders: [],      // {x,z,r} — world statics + the live moment's props
  interactables: [],  // {x,z,r,label(),use(),enabled()}
  momentIndex: -1,
};

/* Tab: cursor mode — freeze the view, free the mouse to click the chips */
G.toggleCursorMode = () => {
  if (G.touchMode) return;
  G.cursorMode = !G.cursorMode;
  if (G.cursorMode) document.exitPointerLock?.();
  else lock(G);
};

/* F (or the FLY tbtn): walk ↔ spectator flight. Pointer lock is untouched —
   the look pipeline is identical in both modes. */
G.setMode = (mode, opts = {}) => {
  if (G.mode === mode) return;
  G.mode = mode;
  G.flyUp = G.flyDown = false;
  if (mode === 'walk') {
    // settle back onto the ground at the current x,z; the walk branch's
    // collider pass nudges us out of anything we landed inside next frame
    G.player.pos.y = floorY(G.player.pos.x, G.player.pos.z) + CFG.EYE_HEIGHT;
  }
  G.ui.setMode(mode);
  document.getElementById('touch').classList.toggle('flymode', mode === 'fly');
  if (!opts.quiet) {
    G.ui.toast(mode === 'fly'
      ? '🕊 Fly mode — Space / C for height, F to land'
      : 'Back on your feet.', 2.4);
  }
};
G.toggleMode = () => G.setMode(G.mode === 'fly' ? 'walk' : 'fly');

initUI(G);
buildWorld(G);
initPlayer(G);
if (touchMode) initTouch(G);
initMoments(G);
G.ui.buildChips(CFG.MOMENTS);
G.ui.setMode(G.mode);

/* The title card plays over a drone orbit of the whole enclave — the aerial
   Carl photographed. The ceremony dressing is on the lawn below it. */
G.setMoment(1, { quiet: true });
initIntroCam(G);

/* ── begin: fly down out of the sky, over the pool, in through the folded-open
   glass wall, and land standing in the great room ── */
document.getElementById('begin').addEventListener('click', e => {
  e.currentTarget.blur();   // Space is fly-ascend — a focused button would re-click
  G.overlayOpen = false;
  G.ui.hideOverlay();
  startDive(G, () => {
    G.started = true;
    G.ui.showHUD();
    if (G.touchMode) G.showTouchUI();
    else lock(G);   // Esc naturally drops the lock; clicking the view re-locks
    G.momentIndex = -1;   // force the switch even though 1 is dressed
    G.setMoment(0);       // the day starts the night before, in the suite
  });
});

/* N — golden hour ↔ the lantern-lit night, any time */
addEventListener('keydown', e => {
  if (e.code === 'KeyN' && G.started && !G.overlayOpen) toggleNight(G);
});

/* ── resize ── */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ── loop ── */
let last = performance.now();
let time = 0;

function frame(now) {
  /* clamp low as well as high — the first rAF timestamp can precede the
     performance.now() captured just before it (alice gotcha) */
  const dt = Math.max(0, Math.min(.05, (now - last) / 1000));
  last = now;
  time += dt;

  if (G.introActive) updateIntroCam(G, dt);
  else if (G.started && !G.overlayOpen) updatePlayer(G, dt);
  updateWorld(G, dt, time);
  G.ui.update(dt);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ── debug hook, always on (house pattern) ── */
window.__game = {
  G,
  setMoment: i => G.setMoment(i),
  toggleNight: () => toggleNight(G),
  /* skip the opening dive — tests and screenshots want the ground immediately */
  skipIntro() {
    G.introActive = false;
    G.overlayOpen = false;
    G.started = true;
    G.ui.hideOverlay();
    G.ui.showHUD();
    G.momentIndex = -1;
    G.setMoment(0);
  },
  fastForward(seconds) {
    /* stub — there is no sim clock yet; when the day gets a timeline
       (lighting arcs, scheduled beats) it must advance through here so
       tests can drive it, lassen-style */
  },
};
