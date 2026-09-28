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
//   compile (BOTH day and night — see the warm-up below) → first frame → card
//   off → window.__game.
// Nothing may be hoisted out of that order. In particular #begin is wired only
// after the world exists (and #overlay ships `inert` until then), and
// window.__game appears last, so it doubles as "the venue is up".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { CFG, momentIndex } from './config.js';
import { buildWorld, floorY, updateWorld, setNight, toggleNight, yieldFrame } from './world.js';
import { initPlayer, updatePlayer, lock } from './player.js';
import { initTouch } from './touch.js';
import { initMoments } from './moments.js';
import { initIntroCam, updateIntroCam, startDive } from './introcam.js';
import { initTour, updateTour } from './tour.js';
import { initUI } from './ui.js';
import { initLightBudget } from './lightbudget.js';
import { initDetailCull } from './detailcull.js';
import * as models from './models.js';
import { bindEnvKnobs, holdPhotos, setPhotoUploader } from './materials.js';
import { TIER, BASE_RATIO, initDynRes } from './perftier.js';
import { t, mt, onLang } from './i18n.js';
import { initSound } from './sound.js';

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
let phaseKey = null;   // the i18n key on the card now — re-rendered if the language changes

/* `label` is an i18n KEY (js/i18n.js 'ph.*'), not copy */
function setProgress(frac, label) {
  if (!loadEl) return;
  /* 99 is the ceiling until the scene is genuinely up — see finishLoading */
  const pct = Math.max(shownPct, frac >= 1 ? 100 : Math.min(99, Math.round(frac * 100)));
  shownPct = pct;
  loadBar.style.transform = `scaleX(${pct / 100})`;
  loadPct.textContent = pct + '%';
  loadTrack.setAttribute('aria-valuenow', String(pct));
  if (label) phaseKey = label;
  if (label || frac >= 1) paintPhase();
}
function paintPhase() {
  if (!loadEl || !phaseKey) return;
  loadPhase.textContent = t(phaseKey) + (shownPct < 100 ? '…' : '');
}
onLang(paintPhase);

/* Hand over to the title card. The orbit is already running behind it by the
   time this is called, so the card fades onto a live scene, never onto black.
   hogwarts-flight kills its #loading with a class; this one goes further and
   leaves the DOM, so a stuck opacity transition can never eat a click on
   "Step inside". */
function finishLoading() {
  setProgress(1, 'ph.ready');
  const ov = document.getElementById('overlay');
  ov.removeAttribute('inert');
  ov.classList.add('ready');   // KAN-218: runs the invitation's entrance
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
setProgress(.02, 'ph.tables');
await yieldFrame();

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: !touchMode, powerPreference: 'high-performance',
});
/* min(DPR, 2) on every tier, as before KAN-235; on the PHONE tier js/perftier.js
   then steps it down while frames are measurably slow (initDynRes, below) */
renderer.setPixelRatio(BASE_RATIO);
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
setProgress(.06, 'ph.lights');
await yieldFrame();
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
const envRT = pmrem.fromScene(new RoomEnvironment(), .04);
scene.environment = envRT.texture;
scene.environmentIntensity = CFG.LIGHT.ENV;

/* ── the Blender-authored props (assets/models/, KAN-207) ────────────────────
   Started HERE and awaited BEFORE buildWorld — and that await moved on
   2026-09-18, with the resort-furniture wave (ASSET_SPEC Group E). It used to
   sit after buildWorld so that fetching and decoding ~3 MB of GLB (network and
   worker time) overlapped the CPU-bound world build for free, and only
   initMoments needed the models. It cannot any more: campus.js now builds the
   rooftop loungers, daybeds, four-tops, stools and dining chairs and water.js
   the poolside loungers, the parasols and the kayak from
   models.geometry()/material(), SYNCHRONOUSLY, inside buildWorld. A model that
   is still in flight when the roof is built is not a late prop — it is a roof
   full of boxes for the rest of the session, because nothing rebuilds it.
   So the overlap is spent deliberately: the fetches still START before the
   world (the loading card is already up and the decode is parallel), but the
   build now waits for them.
   models.preload never rejects: a GLB that fails leaves models.has(name)
   false and every call site falls back to its old primitive path. Nothing here
   changes the light count — a GLB never carries a light — so the compileAsync
   warm-ups further down still see the same program cache keys they always did,
   and now also compile the GLB materials (the moment groups exist by then).
   .06 … .08 is the models' slice of the bar; buildWorld's own .08 … .54
   follows it, so the bar stays monotonic. */
const modelsP = models.preload((f, name) => {
  setProgress(.06 + f * .02, 'ph.florist');
});

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
    /* Settle onto the highest walkable surface AT OR BELOW the flyer's feet —
       the fromY argument is what makes landing on the rooftop terrace resolve
       the deck (26.60) instead of the grade 26 m under it. Without it floorY
       answers bare ground and landing over the roof teleported the player to
       the bottom of the building. The walk branch's collider pass still nudges
       us out of anything we landed inside next frame. */
    /* fromY is the EYE height, matching the fly clamp: a flyer held at the
       minimum clearance has feet BELOW the surface it hovers over, so a
       feet-based resolve would reject that surface and land at grade. */
    G.player.pos.y = floorY(G.player.pos.x, G.player.pos.z, G.player.pos.y - CFG.STEP_UP) + CFG.EYE_HEIGHT;
  }
  G.ui.setMode(mode);
  document.getElementById('touch').classList.toggle('flymode', mode === 'fly');
  if (!opts.quiet) {
    /* instructions, not narration — the compact 'system' card */
    const key = mode === 'fly' ? (G.touchMode ? 'mode.flyTouch' : 'mode.flyKeys') : 'mode.walk';
    G.ui.toast(() => t(key), 2.4, false, { kind: 'system', channel: 'mode' });
  }
};
G.toggleMode = () => G.setMode(G.mode === 'fly' ? 'walk' : 'fly');
/* the HUD's status pills + the controls sheet reach these without importing
   world.js / player.js (KAN-218) */
G.toggleNight = () => { if (G.started && !G.overlayOpen) toggleNight(G); };
G.lock = () => lock(G);

initUI(G);
/* KAN-235: the phone tier's dynamic resolution (a no-op controller on the full
   tier). Sampled from frame() below, so it is already converging on the title
   card's orbit, before the guest steps inside. */
G.tier = TIER;
initDynRes(G);

/* The long one. buildWorld reports each builder as it goes and yields between
   them; .08 … .54 is the world's share of the bar, which is roughly its share
   of the wall clock (the shader compile below is the other big slice — the
   geometry itself is only ~200 ms of it). Everything after this line depends on
   it having FINISHED — initMoments snapshots G.colliders as the world statics,
   initPlayer reads floorY, the intro orbit needs something to orbit. */
/* THE PROPS FIRST. campus.js and water.js read models.geometry()/material()
   while they build (see the preload banner above), so this await is part of
   buildWorld's contract now, not initMoments'. */
setProgress(.08, 'ph.florist');
await modelsP;

await buildWorld(G, (f, label) => setProgress(.08 + f * .46, label));

setProgress(.56, 'ph.places');
await yieldFrame();
initPlayer(G);
if (touchMode) initTouch(G);
initMoments(G);
/* KAN-211 wave F: every registered env knob gets scene.environment as its OWN
   envMap — the same texture, so no program changes, and from here on its
   envMapIntensity really binds (three r180 ignores it without one). AFTER the
   world + moments are built, so a material cloned during the build never
   inherits an envMap its clone is not registered to drive; BEFORE the
   compileAsync warm-up. */
bindEnvKnobs(scene.environment);
G.ui.buildChips(CFG.MOMENTS);
G.ui.setMode(G.mode);
/* KAN-233: the guided tour — builds its camera paths from site.js, wires the
   title card's "Take the tour", the HUD / touch / help-sheet buttons and the
   tour bar. It moves only the camera; nothing here touches lights or programs. */
initTour(G);

/* ── the point-light budget ──────────────────────────────────────────────────
   THIS LINE'S POSITION IS THE CONTRACT. It must come:
     · AFTER buildWorld and initMoments, so all 31 PointLights exist (the last
       two are the Wedding Dinner's) and moments.js's dinner-intensity ticker is
       registered before ours — G.tickers runs in push order and the budget has
       to read this frame's intensities, not last frame's;
     · BEFORE the two compileAsync calls below, and this is the load-bearing
       half. The warm-up compiles every material on the campus for BOTH lighting
       states, and three.js bakes the visible light count into every program's
       cache key. Init after the warm-up and the count changes 31 → 12 on the
       first budgeted frame, which recompiles the entire venue mid-dive — the
       exact multi-second stall the warm-up exists to prevent.
   The enclave adoption pass (world.js, first frame of updateWorld) re-parents
   the dinner moment AFTER this, and that is fine: the budget re-reads every
   light's matrixWorld every frame, so a change of parent is invisible to it.
   `?lb=off` skips it; `__game.G.lightBudget.disable()` is the A/B + escape
   hatch. See js/lightbudget.js. */
initLightBudget(G);

/* ── the screen-size detail cull ─────────────────────────────────────────────
   Immediately after the light budget, and unlike it this line has NO ordering
   constraint against the compileAsync warm-up below: hiding a MESH does not
   change any material's program cache key (three.js keys on light counts,
   shadow state, fog and tone mapping, not on how many objects are drawn), and
   nothing is hidden until the first ticker run anyway — which is after both
   warm-ups, after the warm-up render, and after world.js's enclave adoption
   pass has re-parented the moment groups. What DOES matter is that it is here
   rather than earlier: G.tickers runs in push order, so we make the last
   visibility decision of the frame, on a camera updateIntroCam/updatePlayer
   have already finalised, immediately before renderer.render.
   `?dc=off` skips it; `?dc=16,3` boots other thresholds;
   `__game.G.detailCull.disable()` is the A/B + escape hatch.
   See js/detailcull.js. */
initDetailCull(G);

/* The title card plays over a drone orbit of the whole enclave — the aerial
   Carl photographed. The ceremony dressing is on the lawn below it. */
setProgress(.68, 'ph.drone');
await yieldFrame();
/* index resolved by id — the Welcome Brunch took index 0 on 2026-08-02 */
G.setMoment(momentIndex('ceremony'), { quiet: true });
initIntroCam(G);

/* The single biggest stall on this page is not the geometry — it is compiling
   every shader on the campus, which a naive first render does in one blocking
   call. Doing it here instead, behind the card, keeps the handoff instant and
   lets the driver compile in parallel where the extension exists. Guarded
   because it is the one call in this file three.js has not always had. */
setProgress(.72, 'ph.light');
await yieldFrame();
/* ── compile EVERY moment, not just the one on screen ────────────────────────
   renderer.compile() traverses only VISIBLE objects, so with one moment group
   shown the other five are skipped and their materials compile later, mid-game.
   That was free by accident until the GLB props landed: every moment's
   materials also existed in the ceremony (the moment dressed here), and the
   count sat at a constant 114. It is not free now — the festoon's
   LineBasicMaterial became dinner-only when the hat rack became a GLB, and the
   program count stepped 113 → 114 on the first switch to the Wedding Dinner.
   Showing all six across both warm-ups and the night render fixes it BY
   CONSTRUCTION, whatever a future pass puts in which moment.
   ⚠ Safe on all three counts that matter here:
     · LIGHTS — initLightBudget ran above and has already set every logical
       light .visible = false, the dinner's two included, so the visible light
       count does not move and no program's cache key changes;
     · THE DETAIL CULL — it collects candidates on its first ticker run, which
       is inside the first frame(), after this block has restored;
     · WHAT IS SEEN — the loading card is opaque over the canvas, and the
       groups are restored before the loop starts. */
const _mvis = Object.entries(G.momentGroups).map(([id, g]) => [g, g.visible]);
for (const [g] of _mvis) g.visible = true;
if (renderer.compileAsync) await renderer.compileAsync(scene, camera);

/* ── warm the OTHER half of the day, or pay for it mid-dive ──────────────────
   The compile above only covers the campus AS IT IS LIT RIGHT NOW. That is
   half the venue: three of the six moments are night, "Step inside" lands in
   the Prewedding, and N flips at will.
   The switch is not a repaint. `setLanterns` shows/hides the lantern group,
   and three of the nine floating lanterns carry a real PointLight — so the
   scene goes 26 → 29 point lights, three.js's program cache key changes for
   EVERY material on the campus, and every one of them is recompiled from
   scratch at the next render. Measured on the first cold load of this scene:
   9.7 SECONDS of blocked main thread on the frame the dive lands, with the
   camera frozen inside the great room. That is the "is it broken?" Carl hit on
   his phone.
   So compile the other lighting state too, here, where the card is up and
   there is a progress bar to explain the wait. Flip → compile → flip back:
   both variants are resident in the program cache before the title card
   appears, and no later night change — the landing, a moment switch, the N
   key — has anything left to compile.
   Written against G.night rather than a literal so CFG.START_AT_NIGHT keeps
   working: whatever we open on, this warms the opposite and restores. */
const openNight = G.night;
setProgress(.80, openNight ? 'ph.golden' : 'ph.lanterns');
await yieldFrame();
setNight(G, !openNight, { quiet: true });
if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
/* ── the mirror's programs, and every texture, BEFORE the hidden frame ───────
   Carl, 2026-09-26: "stuck at 80% for awhile" on a second phone. Measured: the
   night flip compiles nothing any more (the light budget keeps the count
   constant — 59 → 59 programs, 12 ms), and the whole 80% wait was the single
   render() below, one blocked task of 1.3–3.1 s on an M-series Mac, so several
   times that on a phone — with the bar frozen because nothing can repaint.
   Two things were inside it:
     · the Reflector's programs. It draws into its own render target, where
       three.js asks for NoToneMapping + linear output — a different program
       for every material. compile()/compileAsync() key programs off whatever
       render target is BOUND, so binding the Reflector's target and running
       compileAsync builds those ~53 in parallel (KHR_parallel_shader_compile)
       instead of synchronously inside render();
     · the first GPU upload of ~316 textures (atlases, photo maps, canvases),
       which render() does all at once. initTexture() does the same upload one
       texture at a time, so it is sliced ~40 ms at a go with the bar advancing.
   Same total work; the longest block went 3,086 → <250 ms at 1× CPU and
   2,035 → 361 ms at 4× throttle, and the bar moves the whole way. */
{
  const bound = renderer.getRenderTarget();
  const mirrors = [];
  scene.traverse(o => { if (o.isReflector) mirrors.push(o); });
  for (const m of mirrors) {
    renderer.setRenderTarget(m.getRenderTarget());
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  }
  renderer.setRenderTarget(bound);

  /* KAN-235: a photograph that lands after THIS collection waits for the title
     card instead of being uploaded inside the hidden frame below (materials.js) */
  holdPhotos();
  const textures = new Set();
  scene.traverse(o => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) for (const k in m) {
      const v = m[k];
      if (v && v.isTexture && !v.isRenderTargetTexture) textures.add(v);
    }
  });
  const label = openNight ? 'ph.golden' : 'ph.lanterns';
  let done = 0, slice = performance.now();
  for (const t of textures) {
    renderer.initTexture(t);
    done++;
    if (performance.now() - slice > 40) {
      setProgress(.80 + (done / textures.size) * .12, label);
      await yieldFrame();
      slice = performance.now();
    }
  }
}
/* …and then one real frame in that state. It is cheap now — the programs and
   textures above are resident — but it is still the only thing that creates
   the last few Reflector-pass programs and uploads the geometry buffers. The
   loading card is opaque and covers the canvas, so this frame is never seen. */
renderer.render(scene, camera);
setNight(G, openNight, { quiet: true });
for (const [g, v] of _mvis) g.visible = v;   // exactly as setMoment left them
setProgress(.94, 'ph.doors');
await yieldFrame();

/* ── DEEP LINKS (KAN-232) ─────────────────────────────────────────────────────
   ?m=<moment id>  (brunch · setup · ceremony · cocktail · dinner · afterparty —
   the ids in CFG.MOMENTS, resolved through momentIndex, never an index) opens
   straight into that moment. The title card STILL shows — "Step inside" has to
   stay a user gesture for the pointer lock — but its CTA names the moment
   ("Go to the Ceremony" / 「前往婚禮儀式」) and the landing goes there.
   ?night=1|0 overrides that moment's own lighting once landed. Anything else
   (an unknown id, night=2) falls back silently to the default opening. The URL
   then follows the guest (ui.js syncURL), so copying it shares where they are. */
const q = new URLSearchParams(location.search);
const deepIdx = momentIndex(q.get('m') || '');
const deepNight = q.get('night') === '1' ? true : q.get('night') === '0' ? false : null;
const SETUP = momentIndex('setup');
const landIdx = deepIdx >= 0 ? deepIdx : SETUP;
G.deepLink = deepIdx >= 0 ? { id: CFG.MOMENTS[deepIdx].id, night: deepNight } : null;

const beginLbl = document.getElementById('beginLbl');
function paintBegin() {
  if (!beginLbl) return;
  beginLbl.textContent = deepIdx >= 0 ? t('inv.go', { name: mt(CFG.MOMENTS[deepIdx], 'name') }) : t('inv.begin');
  document.getElementById('begin').classList.toggle('deep', deepIdx >= 0);
}
paintBegin();
onLang(paintBegin);
const applyNightParam = () => { if (deepNight !== null) setNight(G, deepNight); };

/* ── begin ──
   The default (and ?m=setup): fly down out of the sky, over the pool, in
   through the folded-open glass wall, and land standing in the great room.
   Any other ?m=: the dive would land in the wrong building, so the orbit hands
   straight over under the veil (ui.go's before/after hooks) — same fade and
   title reveal as a timeline switch. The pointer lock is taken INSIDE the click
   on that path, while the gesture is still live. */
document.getElementById('begin').addEventListener('click', e => {
  e.currentTarget.blur();   // Space is fly-ascend — a focused button would re-click
  G.overlayOpen = false;
  G.ui.hideOverlay();
  if (landIdx === SETUP) {
    startDive(G, () => {
      G.started = true;
      G.ui.showHUD();
      if (G.touchMode) G.showTouchUI();
      else lock(G);   // Esc naturally drops the lock; clicking the view re-locks
      G.momentIndex = -1;   // force the switch even though the ceremony is dressed
      G.setMoment(SETUP);   // the dive lands in the great room
      applyNightParam();
      G.ui.revealMoment(CFG.MOMENTS[SETUP]);   // …and names where you are
    });
    return;
  }
  G.started = true;
  if (!G.touchMode) lock(G);
  G.momentIndex = -1;   // the title backdrop may already BE this moment (ceremony)
  G.ui.go(landIdx, {
    before() {
      G.introActive = false;   // the orbit stops under the veil
      G.ui.showHUD();
      if (G.touchMode) G.showTouchUI();
    },
    after: applyNightParam,
  });
});

/* ── ?tour=1 (KAN-233) ──
   The guided tour needs no pointer lock, so unlike Step inside it may start
   without a gesture: the invitation shows its entrance, then the film begins on
   its own — the link an older relative is sent just plays. Step inside or the
   help sheet before then wins (the language switch does not — it only
   re-letters the card). Combines with ?lang=, and with ?m=<id> to start the
   film at that moment. */
if (q.get('tour') === '1') {
  setTimeout(() => {
    if (G.started || G.helpOpen) return;
    const k = deepIdx >= 0 ? G.tour.segments.findIndex(s => s.id === CFG.MOMENTS[deepIdx].id) : 0;
    G.tour.start(Math.max(0, k));
  }, 2600);
}

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
  G.dynres.sample(now);          // KAN-235: raw rAF interval (before the clamp)

  if (G.introActive) updateIntroCam(G, dt);
  else if (G.tourActive) updateTour(G);          // the tour owns the camera (KAN-233)
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
/* KAN-235: the photographs still in flight (or held since the warm-up) now
   upload one file per frame, in their own slice, behind the invitation */
setPhotoUploader(renderer);

/* KAN-234 · the music + ambience (Carl's Suno tracks) — OFF by default. This
   only wires the toggles and the preference: no AudioContext, no <audio>
   element and no request under assets/audio/ until a guest turns it on (their
   tap is the gesture iOS needs). Here, not earlier, so a remembered "on" can
   only start from a gesture on a venue that is up. A small module imported
   statically above — nothing is lazily loaded when the guest taps. See
   js/sound.js. */
initSound(G);

/* ── debug hook, always on (house pattern) ──
   Assigned LAST on purpose: it is also the readiness signal. skipIntro() would
   throw against a half-built scene, so tests that poll for window.__game get a
   world that is genuinely up. */
window.__game = {
  G,
  setMoment: i => G.setMoment(i),
  tour: G.tour,
  toggleNight: () => toggleNight(G),
  /* skip the opening dive — tests and screenshots want the ground immediately */
  skipIntro() {
    G.introActive = false;
    G.overlayOpen = false;
    G.started = true;
    G.ui.hideOverlay();
    G.ui.showHUD();
    if (G.touchMode && G.showTouchUI) G.showTouchUI();
    G.momentIndex = -1;
    G.setMoment(momentIndex('setup'));
  },
  fastForward(seconds) {
    /* stub — there is no sim clock yet; when the day gets a timeline
       (lighting arcs, scheduled beats) it must advance through here so
       tests can drive it, lassen-style */
  },
};
