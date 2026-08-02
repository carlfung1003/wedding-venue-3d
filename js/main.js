// Bootstrap: renderer (modeled on alice-lunch-party — PMREM RoomEnvironment,
// sRGB output, ACES tone mapping, no post for now), the G context object,
// the begin-button flow, and the clock loop.
//
// ── this module boots WITH AWAITS, and that is the point ─────────────────────
// Building the campus is ~2,900 meshes / ~300k triangles, every CanvasTexture,
// and the Reflector's shader. Run end to end it pins the main thread for a
// second or more (much longer on a phone) and the browser never gets to paint —
// guests were shown a black tab and no way to tell it apart from a broken link.
// So: the loading card is static markup in index.html, and everything below
// yields between phases so that card can actually reach the screen and report
// where it has got to. Top-level await, in source order, is deliberate — the
// sequence IS the contract:
//   renderer → env probe → buildWorld → player/moments → intro orbit → shader
//   compile → first frame → card off → window.__game.
// Nothing may be hoisted out of that order. In particular #begin is wired only
// after the world exists (and #overlay ships `inert` until then), and
// window.__game appears last, so it doubles as "the venue is up".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CFG } from './config.js';
import { buildWorld, floorY, updateWorld, toggleNight, yieldFrame } from './world.js';
import { initPlayer, updatePlayer, lock } from './player.js';
import { initTouch } from './touch.js';
import { initMoments } from './moments.js';
import { initIntroCam, updateIntroCam, startDive } from './introcam.js';
import { initUI } from './ui.js';

/* ── the loading card ────────────────────────────────────────────────────────
   The card is already on screen (index.html) — this only drives its copy, its
   bar and its percentage. Progress is REAL: every step below reports after the
   work it names has finished, and 100% is reserved for the frame after the
   drone orbit has actually been drawn. A bar that reaches the end and then
   sits there is the thing we are replacing. */
const loadEl = document.getElementById('loading');
const loadBar = document.getElementById('loadBar');
const loadTrack = document.getElementById('loadTrack');
const loadPhase = document.getElementById('loadPhase');
const loadPct = document.getElementById('loadPct');
let shownPct = 0;

function setProgress(frac, label) {
  if (!loadEl) return;
  /* 99 is the ceiling until the scene is genuinely up — see finishLoading */
  const pct = Math.max(shownPct, frac >= 1 ? 100 : Math.min(99, Math.round(frac * 100)));
  shownPct = pct;
  loadBar.style.transform = `scaleX(${pct / 100})`;
  loadPct.textContent = pct + '%';
  loadTrack.setAttribute('aria-valuenow', String(pct));
  if (label) loadPhase.textContent = label + (pct < 100 ? '…' : '');
}

/* Hand over to the title card. The orbit is already running behind it by the
   time this is called, so the card fades onto a live scene, never onto black.
   hogwarts-flight kills its #loading with a class; this one goes further and
   leaves the DOM, so a stuck opacity transition can never eat a click on
   "Step inside". */
function finishLoading() {
  setProgress(1, 'Ready when you are');
  document.getElementById('overlay').removeAttribute('inert');
  if (!loadEl) return;
  loadEl.classList.add('gone');
  setTimeout(() => loadEl.remove(), 700);
}

/* ── renderer ── */
const canvas = document.getElementById('scene');
const touchMode = matchMedia('(pointer: coarse)').matches;
if (touchMode) document.body.classList.add('touch');

/* THE FIRST YIELD, and the most important one: everything above is DOM, and
   everything below touches WebGL. Without this the whole boot can land in the
   same task as the parser and the card never paints at all. */
setProgress(.02, 'Setting the tables');
await yieldFrame();

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

/* ── resize ──
   Registered HERE rather than after the build: the build now spans a second or
   more of real time, and a phone rotated during it would otherwise keep a
   stretched projection until it was rotated again. */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* environment probe — real reflections in the marble, gold and mirror ball */
setProgress(.06, 'Warming the lights');
await yieldFrame();
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

/* The long one. buildWorld reports each builder as it goes and yields between
   them; .08 … .54 is the world's share of the bar, which is roughly its share
   of the wall clock (the shader compile below is the other big slice — the
   geometry itself is only ~200 ms of it). Everything after this line depends on
   it having FINISHED — initMoments snapshots G.colliders as the world statics,
   initPlayer reads floorY, the intro orbit needs something to orbit. */
await buildWorld(G, (f, label) => setProgress(.08 + f * .46, label));

setProgress(.56, 'Laying the places');
await yieldFrame();
initPlayer(G);
if (touchMode) initTouch(G);
initMoments(G);
G.ui.buildChips(CFG.MOMENTS);
G.ui.setMode(G.mode);

/* The title card plays over a drone orbit of the whole enclave — the aerial
   Carl photographed. The ceremony dressing is on the lawn below it. */
setProgress(.68, 'Sending up the drone');
await yieldFrame();
G.setMoment(1, { quiet: true });
initIntroCam(G);

/* The single biggest stall on this page is not the geometry — it is compiling
   every shader on the campus, which a naive first render does in one blocking
   call. Doing it here instead, behind the card, keeps the handoff instant and
   lets the driver compile in parallel where the extension exists. Guarded
   because it is the one call in this file three.js has not always had. */
setProgress(.76, 'Waiting on the light');
await yieldFrame();
if (renderer.compileAsync) await renderer.compileAsync(scene, camera);

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

/* The loop is live — wait for one frame to be DRAWN before taking the card
   down. Hide it any earlier and the handoff is loading card → black → orbit,
   which is the same broken-looking beat we just spent this whole file
   removing. Cheap now that compileAsync above has already paid for the
   shaders; it was ~0.5 s of blocked main thread before it did. */
await yieldFrame();
finishLoading();

/* ── debug hook, always on (house pattern) ──
   Assigned LAST on purpose: it is also the readiness signal. skipIntro() would
   throw against a half-built scene, so tests that poll for window.__game get a
   world that is genuinely up. */
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
