// lightbudget.js — the campus's point-light budget manager.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT THIS DOES                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// The venue builds 31 THREE.PointLights (suite 8, atrium 6, water 7, campus 5,
// hotel 3, dinner moment 2). three.js's forward renderer evaluates EVERY
// visible point light on EVERY lit fragment — the light count is compiled into
// the shader as NUM_POINT_LIGHTS and the loop has no early-out — but each of
// these lights has a finite `distance` (range) of only 7…34 m on a campus
// ~500 m across. A light on the hotel roof (world x 251) cannot possibly reach
// the presidential suite (x −17), yet before this module every suite fragment
// paid for it.
//
// So: the 31 built lights become LOGICAL lights — permanently `.visible =
// false`, pure data carriers — and a fixed pool of N real PointLights at the
// SCENE ROOT is re-pointed at the N most important logical lights every frame.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHY — measured, headless Metal ANGLE, 1600×900, 2026-08-04               ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   experiment                          moment          before    after
//   keep only the 8 nearest point lights  brunch          22.2      45.6  (+105 %)
//   keep only the 8 nearest point lights  setup (night)   17.2      45.0  (+162 %)
//   all point lights off (upper bound)    brunch          22.2      53.9
//   shadow map off                        brunch          22.2      25.0  (not worth it)
//   tickers off / matrixAutoUpdate off    brunch            —         —   (~0, not levers)
// Point lights were, by a wide margin, the single biggest lever on this page.
//
// WHAT THIS MODULE ACTUALLY DELIVERED, same harness, cold boot per side
// (`?lb=off` vs the default N = 12), vsync off, two runs that agreed:
//   moment       off     N=12      moment       off     N=12
//   brunch      34.0 →   62.5      cocktail    68.4 →  259.3
//   setup       30.8 →   80.6      dinner      64.2 →  203.9
//   ceremony    74.9 →  355.4      afterparty  81.1 →  163.8
// and it removed a REAL 570 ms stall: without it, switching to the Wedding
// Dinner takes the scene 29 → 31 visible point lights and recompiles the whole
// campus (114 → 179 programs) on that one frame. With it the same switch is
// 8–31 ms and the program count never moves.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE TRAP THIS DESIGN EXISTS TO AVOID — the light-count shader recompile  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// three.js bakes the number of VISIBLE lights into every material's program
// cache key. Change that number and EVERY material on the campus is recompiled
// on the next render — measured at 9.7 s of blocked main thread on a cold load
// when `setLanterns` used to take the scene 26 ⇄ 29 lights (see the banner in
// water.js `setLanterns`, and the night shader warm-up in main.js).
//
// Therefore, ABSOLUTELY LOAD-BEARING:
//   · the pool's size is fixed at init and NEVER changes at runtime;
//   · a pool slot with nothing to show gets `intensity = 0` and stays VISIBLE;
//   · the logical lights are hidden ONCE, at init, and never shown again.
// three.js skips invisible objects (and their whole subtree) at the top of
// `projectObject` — `if ( object.visible === false ) return;`, r180
// three.module.js:16551 — so an invisible light is never pushed into the render
// state and never counts toward NUM_POINT_LIGHTS. Verified empirically too:
// `renderer.info.programs.length` is stable across a sweep of all six moments,
// day and night, plus a fly-through.
//
// This is also why `initLightBudget` MUST be called BEFORE main.js's
// `compileAsync` warm-up: the warm-up compiles the whole campus for both the
// day and the night lighting state, and it has to compile them at the count the
// page will actually run at.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHY NO BUILDER NEEDED CHANGING                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// The logical light stays exactly where the builder put it in the scene graph,
// so:
//   · the five builders' night fan-outs keep mutating its `.intensity` and
//     `.color` and this module reads the live values every frame;
//   · moment-group visibility still applies to its ancestors, so a light in a
//     hidden moment is out of the running by construction;
//   · a light riding an animated parent (water.js's floating lanterns) has its
//     world position re-read from `matrixWorld` every frame.
// campus.js / water.js / suite.js / atrium.js / moments.js / sky.js are
// untouched.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ HOW TO TURN IT OFF                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   · from the console:  `__game.G.lightBudget.disable()` — every logical light
//     goes back to visible and the pool goes dark. That is the A/B harness AND
//     the escape hatch. (It changes the light count, so the first frame after
//     each toggle pays one recompile. Warm up before measuring.)
//   · from the URL:      `?lb=off` skips it entirely, `?lb=8` boots with N = 8.
//   · permanently:       delete the two wiring lines in main.js.

import * as THREE from 'three';

/* ── tuning ─────────────────────────────────────────────────────────────────
   N = 12 is the shipped pool size, and it is the KNEE of the curve, measured
   cold-booted at each N (`?lb=<n>`) at the six moments' own spawns:

     N        8      12      14      16      20      24     (fps, Metal ANGLE)
     setup   83.4    81.0    71.3    63.2    52.0    41.6
     brunch  57.2    57.1    61.7    57.7    51.0    44.3
     ceremony 422     338     260     223     163     117

   8 → 12 costs 3 % at the worst moment; 12 → 16 costs 22 % and 12 → 20 costs
   36 %. Every slot is paid for on EVERY lit fragment whether it holds a light
   or not — three.js's point-light loop has no early-out, so an empty slot is
   not free, it is just dark.
   On the quality side (mean absolute pixel difference against the un-budgeted
   scene at sixteen viewpoints), N = 8 leaves a visible deficit in the suite
   (worst 0.99), N = 12 does not (worst 0.112), and going beyond 12 buys
   fractions of a grey level for a third of the frame rate. */
const DEFAULT_N = 12;

/* ── hysteresis ─────────────────────────────────────────────────────────────
   Two terms, and the second one was added because the first was not enough.
   MARGIN: a seated light keeps its slot unless a challenger beats it by 15 %.
   DWELL:  and even then, not until it has held the slot for 0.35 s.
   Measured on a 20 s continuous walk + fly through the enclave at night: with
   MARGIN alone the log showed a light taken out and put back inside 208 ms
   (`atrium#2`, three events in a fifth of a second) — the exact oscillation the
   brief calls a failure. DWELL removes it. A light that stops being a candidate
   at all (switched off, moment hidden, sphere out of frame) is still released
   IMMEDIATELY — dwell may not keep a dead light on screen. */
const MARGIN = 0.15;
const DWELL = 0.35;   // seconds

/* ── scoring ────────────────────────────────────────────────────────────────
   All four return "bigger is better" and are strictly POSITIVE, which is what
   lets the hysteresis margin below be a plain multiply. Each is multiplied by
   the frustum CLIP term (see `update`) before it is used.

   THE DEFAULT IS 'irradiance', AND IT WAS CHOSEN ON EVIDENCE, not taste. All
   four were A/B'd at N = 12 against the un-budgeted scene at fourteen
   viewpoints, scored by mean absolute pixel difference (identical camera,
   animation frozen; see the report). Worst viewpoint / sum over all fourteen:

       irradiance   0.112 / 0.228   ← shipped
       surface      0.301 / 0.505
       mixed        0.812 / 0.953
       contrib      1.038 / 1.183

   Why inverse-square wins on THIS campus, when the solid-angle argument says
   it should not: `contrib` values a wide light and a near light equally, and
   the widest lights here (the atrium's four 19 m gallery lamps) sit INSIDE a
   building. From the pool at night they scored 11th, 12th and 13th and took
   three of the twelve seats to light a gallery the suite is standing in front
   of, while the 7 m sign-pillar lamp 20 m away — whose whole lit patch is on
   screen — ranked 17th and was dropped. Inverse square is the light's own
   falloff law and it prefers the near field, which is also the part of the
   frame nothing is occluding. Occlusion is the term none of these can see, and
   distance is the cheapest proxy for it. */
const SCORES = {
  /* screen AREA × brightness: (range/dist)² is the solid angle the lit region
     subtends. Correct in vacuum, but it values a wide light exactly as much as
     a near one, and on this campus the wide ones are usually INSIDE a building
     you cannot see into. */
  contrib(intensity, range, dist) {
    if (!(range > 0)) return intensity;                 // distance 0 = unbounded
    const s = range / Math.max(range, dist);
    return intensity * s * s;
  },
  /* peak IRRADIANCE reaching the camera's neighbourhood — inverse square, the
     light's own falloff law. Strongly prefers the near field, which is also the
     part of the frame nothing is occluding. */
  irradiance(intensity, range, dist) {
    const d = Math.max(dist, 1);
    return intensity / (d * d);
  },
  /* the geometric middle of the two: intensity × angular RADIUS / distance.
     Keeps some of contrib's preference for a light that covers a lot of frame
     without letting a 19 m-reach light 55 m away outrank a 7 m one at 20. */
  mixed(intensity, range, dist) {
    const d = Math.max(dist, 1);
    return intensity * Math.max(range, 1) / (d * d);
  },
  /* the brief's literal ordering, kept switchable so the four can be A/B'd:
     distance from the camera to the sphere's SURFACE ascending, ties (camera
     inside the sphere) broken by intensity. */
  surface(intensity, range, dist) {
    const sd = (range > 0) ? Math.max(0, dist - range) : 0;
    return 1 / (1 + sd) + intensity * 1e-6;
  },
};

/* ── scratch (module-scope: this runs every frame) ── */
const _proj = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _camPos = new THREE.Vector3();

let B = null;   // the one live budget; there is only ever one scene

/**
 * Collect every PointLight in the scene as a logical light, hide them, and add
 * a fixed pool of real ones at the scene root.
 *
 * CALL IT: after buildWorld, after initMoments (so the dinner moment's two
 * lights exist and its intensity ticker is registered first), and BEFORE
 * main.js's compileAsync warm-up. See the recompile banner above.
 *
 * @param {object} G   the shared context (scene, camera, renderer, tickers)
 * @param {object} [opts]
 * @param {number} [opts.n]  pool size; overridden by `?lb=<n>` in the URL
 * @returns {object|null} the debug handle, also published as `G.lightBudget`
 */
export function initLightBudget(G, opts = {}) {
  /* URL overrides, so a test can boot a given N cold — no runtime recompile */
  let q = null;
  try { q = new URLSearchParams(location.search).get('lb'); } catch { q = null; }
  if (q === 'off') return null;

  let n = opts.n || DEFAULT_N;
  if (q && /^\d+$/.test(q)) n = Math.max(1, Math.min(64, +q));

  /* ── 1. the logical lights ──────────────────────────────────────────────
     Traverse rather than ask the builders: campus.js has a mixed root,
     water.js's lanterns hang off animated groups, and moments.js adds its
     groups to the scene after buildWorld. One traversal finds them all and
     needs nobody's cooperation. */
  const logical = [];
  G.scene.traverse(o => {
    if (!o.isPointLight) return;
    if (o.userData && o.userData.lightBudgetPool) return;   // never eat our own
    const chain = [];
    for (let p = o.parent; p; p = p.parent) chain.push(p.name || p.type);
    logical.push({
      light: o,
      id: logical.length,
      tag: (chain[0] || 'scene') + '#' + logical.length,
      wasVisible: o.visible,
      wp: new THREE.Vector3(),
      range: o.distance, dist: 0, clip: 1, score: 0, live: false,
    });
    o.visible = false;          // permanent: it is a data carrier from here on
  });

  /* ── 2. the pool, at the SCENE ROOT ────────────────────────────────────
     Root, so the enclave's 90° transform never applies to a position we
     computed in world space. `worldSpace` also keeps world.js's late-content
     adoption pass off them (it only adopts Groups, but say it anyway). */
  const pool = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.PointLight(0xffffff, 0, 1, 2);
    p.name = 'lightBudget:' + i;
    p.userData.lightBudgetPool = true;
    p.userData.worldSpace = true;
    p.castShadow = false;
    p.visible = true;           // ALWAYS. The count must never change.
    G.scene.add(p);
    pool.push(p);
  }

  B = {
    G, n, pool, logical,
    slot: new Array(n).fill(null),
    seatedAt: new Float64Array(n),      // seconds; drives DWELL
    enabled: true,
    scoreName: 'irradiance',
    score: SCORES.irradiance,
    margin: MARGIN,
    swaps: 0,
    frames: 0,
    /* [t, slot, outTag, inTag, outScore, inScore, topSeatedScore] — the tail
       three are what let a flicker test tell a visible hand-over from a
       bookkeeping one. Off by default; setSwapLog(true) to record. */
    swapLog: [],
    logSwaps: false,
  };

  /* ── 3. per frame ──────────────────────────────────────────────────────
     G.tickers is run by world.js's updateWorld, which main.js calls AFTER
     updateIntroCam/updatePlayer (the camera for this frame is final) and
     BEFORE renderer.render — exactly the window this needs. Registering here,
     after initMoments, also puts us LAST in the ticker list, so the dinner
     moment's `intensity = g.visible ? 16 : 0` ticker and water.js's lantern
     drift have both already run for this frame. */
  (G.tickers ||= []).push(update);

  G.lightBudget = {
    get n() { return B.n; },
    get enabled() { return B.enabled; },
    logicalCount: logical.length,
    active,
    stats,
    setN,
    setScore,
    setMargin(m) { B.margin = m; },
    disable() { setEnabled(false); },
    enable() { setEnabled(true); },
    update,                     // force an assignment outside the loop
    setSwapLog(on) { B.logSwaps = !!on; B.swapLog.length = 0; },
    swapLog() { return B.swapLog.slice(); },
  };

  update();                     // populate before the warm-up render
  return G.lightBudget;
}

/* ── the per-frame pass ───────────────────────────────────────────────────── */
function update() {
  if (!B || !B.enabled) return;
  const { G, logical, pool, slot } = B;
  const cam = G.camera;

  /* The camera was written by syncCamera as position + rotation only, and
     nothing has flushed it to a matrix yet this frame — the renderer will do
     that after us. Do it here so the frustum is THIS frame's, not last
     frame's. Camera#updateWorldMatrix also refreshes matrixWorldInverse. */
  cam.updateWorldMatrix(true, false);
  _camPos.setFromMatrixPosition(cam.matrixWorld);
  _proj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_proj, cam.coordinateSystem);

  /* ── candidates ────────────────────────────────────────────────────────
     A logical light is a candidate when it is switched on, nothing above it in
     the graph is hidden, and its INFLUENCE SPHERE (not its point) touches the
     frustum. The sphere is the correctness-critical part: a hotel light 250 m
     away still lights the hotel, and testing the point alone would drop it the
     moment its own position left the near/far range. */
  let nLive = 0;
  for (let i = 0; i < logical.length; i++) {
    const r = logical[i], L = r.light;
    r.live = false;
    if (!(L.intensity > 0)) continue;

    let hidden = false;
    for (let p = L.parent; p; p = p.parent) { if (!p.visible) { hidden = true; break; } }
    if (hidden) continue;

    /* re-read every frame: water.js's lanterns ride an animated parent, and
       world.js re-parents the moment groups into the enclave on frame 1 */
    L.updateWorldMatrix(true, false);
    r.wp.setFromMatrixPosition(L.matrixWorld);

    /* THE CLIP TERM, and it earns its keep. Frustum.intersectsSphere is a
       yes/no, and yes/no is not enough: the lounge's three lights have a 22 m
       reach, and from the arrival court 100 m away their spheres still CLIP the
       edge of the frustum by a few centimetres — so they answered "visible" and
       took three of the twelve seats off lights that were filling the middle of
       the screen. Measured: it cost 4.5 % of the pixels on the signature shot.
       `worst` is the signed distance from the sphere's centre to the nearest
       frustum plane, so (range + worst) / range is the fraction of the light's
       REACH that is actually inside the view — 1 when the centre is in frame,
       →0 when the sphere only grazes. Squared, it is an area, and it multiplies
       the score below. It is the same six-plane loop intersectsSphere does; we
       just keep the number instead of throwing it away. */
    const range = L.distance;
    let clip = 1;
    if (range > 0) {
      let worst = Infinity;
      const pl = _frustum.planes;
      for (let k = 0; k < 6; k++) {
        const d = pl[k].distanceToPoint(r.wp);
        if (d < worst) worst = d;
      }
      if (worst <= -range) continue;                  // sphere wholly outside
      if (worst < 0) clip = (range + worst) / range;
    }
    r.range = range;
    r.clip = clip;
    r.dist = r.wp.distanceTo(_camPos);
    r.score = B.score(L.intensity, range, r.dist) * clip * clip;
    r.live = true;
    nLive++;
  }

  /* ── seating, with hysteresis ──────────────────────────────────────────
     1 · a slot whose light stopped being a candidate is freed AT ONCE (dwell
         must never keep a dead light on screen);
     2 · free slots take the best unseated candidates;
     3 · a seated light is only displaced by a challenger that beats it by
         `margin`, and only after it has held the slot for DWELL seconds.
     Without 3 the pool churns on sub-metre camera moves and pops. */
  const now = performance.now() / 1000;
  const seated = new Set();
  for (let i = 0; i < B.n; i++) {
    const s = slot[i];
    if (s && !s.live) { logSwap(i, s, null); slot[i] = null; }
    else if (s) seated.add(s);
  }

  const queue = [];
  for (let i = 0; i < logical.length; i++) {
    const r = logical[i];
    if (r.live && !seated.has(r)) queue.push(r);
  }
  queue.sort((a, b) => b.score - a.score);

  let qi = 0;
  for (let i = 0; i < B.n && qi < queue.length; i++) {
    if (slot[i]) continue;
    logSwap(i, null, queue[qi]);
    slot[i] = queue[qi++];
    B.seatedAt[i] = now;
  }

  if (qi < queue.length) {
    const idx = [];
    for (let i = 0; i < B.n; i++) if (slot[i] && now - B.seatedAt[i] >= DWELL) idx.push(i);
    idx.sort((a, b) => slot[a].score - slot[b].score);   // weakest first
    for (let k = 0; k < idx.length && qi < queue.length; k++) {
      const i = idx[k], chal = queue[qi];
      if (!(chal.score > slot[i].score * (1 + B.margin))) break;   // sorted: no later one can win either
      logSwap(i, slot[i], chal);
      slot[i] = chal;
      B.seatedAt[i] = now;
      qi++;
    }
  }

  /* ── publish into the pool ─────────────────────────────────────────────
     An empty slot goes to intensity 0 and STAYS VISIBLE — see the banner. */
  for (let i = 0; i < B.n; i++) {
    const p = pool[i], r = slot[i];
    if (!r) { p.intensity = 0; continue; }
    const L = r.light;
    p.position.copy(r.wp);
    p.color.copy(L.color);
    p.intensity = L.intensity;
    p.distance = L.distance;
    p.decay = L.decay;
  }

  B.frames++;
  B.liveCount = nLive;
}

/* A swap is only VISIBLE in proportion to what the outgoing light was still
   contributing, so the log carries the scores: a slot handed from a light
   scoring 0.0001 to one scoring 0.02 cannot flicker, however often it happens.
   `top` is the strongest seated score this frame, i.e. the yardstick. */
function logSwap(i, out, into) {
  B.swaps++;
  if (!B.logSwaps) return;
  let top = 0;
  for (const s of B.slot) if (s && s.score > top) top = s.score;
  B.swapLog.push([+performance.now().toFixed(1), i,
    out ? out.tag : null, into ? into.tag : null,
    out ? +out.score.toFixed(5) : 0, into ? +into.score.toFixed(5) : 0,
    +top.toFixed(5)]);
}

/* ── debug handle ─────────────────────────────────────────────────────────── */

function active() {
  const out = [];
  for (let i = 0; i < B.n; i++) {
    const r = B.slot[i];
    out.push(r ? {
      slot: i, tag: r.tag, intensity: +r.light.intensity.toFixed(2),
      distance: r.range, dist: +r.dist.toFixed(1), score: +r.score.toFixed(3),
      clip: +r.clip.toFixed(3),
      pos: [+r.wp.x.toFixed(1), +r.wp.y.toFixed(1), +r.wp.z.toFixed(1)],
    } : { slot: i, tag: null });
  }
  return out;
}

function stats() {
  return {
    n: B.n, enabled: B.enabled, logical: B.logical.length,
    live: B.liveCount || 0, used: B.slot.filter(Boolean).length,
    swaps: B.swaps, frames: B.frames,
    score: B.scoreName, margin: B.margin,
  };
}

function setScore(name) {
  if (!SCORES[name]) return false;
  B.scoreName = name;
  B.score = SCORES[name];
  return true;
}

/* ⚠ CHANGES THE LIGHT COUNT → one full shader recompile on the next render.
   Debug/measurement only; boot with `?lb=<n>` to compare N cold instead. */
function setN(n) {
  n = Math.max(1, Math.min(64, n | 0));
  if (n === B.n) return B.n;
  while (B.pool.length > n) {
    const p = B.pool.pop();
    B.G.scene.remove(p);
    p.dispose?.();
  }
  while (B.pool.length < n) {
    const p = new THREE.PointLight(0xffffff, 0, 1, 2);
    p.name = 'lightBudget:' + B.pool.length;
    p.userData.lightBudgetPool = true;
    p.userData.worldSpace = true;
    p.castShadow = false;
    p.visible = B.enabled;
    B.G.scene.add(p);
    B.pool.push(p);
  }
  B.n = n;
  B.slot = new Array(n).fill(null);
  B.seatedAt = new Float64Array(n);
  update();
  return B.n;
}

/* The A/B harness and the escape hatch. `disable()` puts the scene back exactly
   as the builders left it: every logical light visible, the pool dark. */
function setEnabled(on) {
  if (!B || B.enabled === on) return;
  B.enabled = on;
  for (const r of B.logical) r.light.visible = on ? false : r.wasVisible;
  for (const p of B.pool) { p.visible = on; if (!on) p.intensity = 0; }
  if (on) { B.slot.fill(null); B.seatedAt.fill(0); update(); }
}
