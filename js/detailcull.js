// detailcull.js — the campus's screen-size visibility pass.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT THIS DOES                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Every frame, each plain Mesh on the campus is asked how big it is ON SCREEN:
//
//     px = (boundingSphere.radius × maxWorldScale × 2 / distanceToCamera)
//          × (viewportHeight / (2·tan(fov/2)))
//
// i.e. the diameter of its bounding sphere in device-independent pixels. A mesh
// below its threshold is hidden. There are TWO thresholds and the split is the
// whole point of the module — see the measurements below.
//
// It touches no builder. Like js/lightbudget.js it works by traversing the
// SCENE, which is the only thing all six builders, world.js's enclave adoption
// and moments.js's late groups have in common.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHY TWO THRESHOLDS — measured, headless Metal ANGLE, 1600×900, 2026-08-05║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Profiled at the WELCOME BRUNCH, which is the venue's worst view: you stand on
// the hotel roof and look back over the entire campus from 285 m, so almost
// nothing is frustum-culled and the whole enclave is on screen at once.
//
// FIRST, THE LEVER THAT LOOKS BIGGEST IS MOSTLY SOMETHING ELSE. "Hide every
// transparent mesh" is a huge win on paper, so it was decomposed, in-page,
// one class at a time (same page, same baseline, so read the deltas):
//
//   baseline                                       51.4 fps   1720 calls
//   hide 259 transparent PLAIN meshes              61.5      (+10.1)
//     + 11 transparent INSTANCED meshes            65.2       (+3.7)
//     + the Reflector — ONE mesh                  104.1      (+38.9)
//
// Four fifths of that lever is the hero pool's mirror, which renders the whole
// campus a SECOND time and is the one thing on this page that may never be
// culled — it is the venue's signature shot. What is actually available is the
// +10 fps in the 259 panes, and this module takes it.
//
// SECOND, DRAW-CALL COUNT IS NOT THE COST EITHER — but transparency is dear
// per mesh. From the two threshold sweeps in `TUNE` below, at the shipped
// settings:
//
//   transparent, 16 px:   67 meshes hidden → +5.7 fps  = 0.085 fps per mesh
//   opaque,       8 px:  715 meshes hidden → +10.7 fps = 0.015 fps per mesh
//
// A transparent mesh is worth about SIX opaque ones. That is overdraw: the
// folding walls, the villa glazing, the lobby curtain wall, the balustrades and
// the plunge-pool sheets all overlap in a small region of the screen at 285 m,
// and every pane is a blended, depth-sorted, depth-write-disabled draw over the
// same pixels — while an opaque mesh that small is a handful of fragments that
// the depth buffer mostly rejects.
//
// So the transparent threshold is aggressive and the opaque one is conservative.
// Both are tuned in `TUNE` below with their own measured curve.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT IT DELIVERS, AND WHAT IT COSTS — be honest about both              ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Cold boot per side, `?dc=off` vs the shipped 16 / 8, at each moment's own
// spawn (two independent runs — cold-boot pairs and same-page enable/disable
// medians — agreed to within 2 fps on every row):
//
//   moment       off      on     draw calls off → on
//   brunch      60.2 →  79.6     1720 → 913     ← the whole point
//   setup       80.1 →  80.0      962 → 962
//   ceremony   353.9 → 354.1       58 →  58
//   cocktail   264.8 → 267.1      211 → 211
//   dinner     214.5 → 201.9      201 → 201
//   afterparty 168.3 → 160.6      395 → 395
//
// ONE MOMENT GETS FASTER. Read the draw-call column to see why: at the other
// five, everything this pass hides was already outside the frustum, so the
// renderer was never drawing it. The Welcome Brunch is the only view on this
// campus that has the whole enclave on screen at once, and it is also the
// slowest — which is exactly the case worth fixing.
//
// AND FOUR MOMENTS GET SLIGHTLY SLOWER. The pass costs 0.062…0.073 ms of CPU
// per frame (500-call average at each moment), spent walking 2,146 parent
// chains and reading 2,146 world matrices. Where that is measurable it costs
// 3 % — dinner 213 → 207, after party 170 → 165 — at moments already running
// 40…200 % above a 120 Hz display. It is a real cost and it is priced in: the
// venue's worst view gains 20 fps below the refresh rate, and its best views
// lose 6 fps above it. If a future pass needs that back, the lever is a
// stride (process half the candidates per frame — the 0.30 s dwell has room
// for it), not a smaller candidate list.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE FOUR TRAPS THIS FILE IS SHAPED BY — every one of them fails silently ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// 1 · NEVER TOUCH A LIGHT. `.visible = false` on a light changes the scene's
//     light count, which is baked into every material's program cache key —
//     that is the multi-hundred-millisecond stall lightbudget.js exists to
//     prevent (and the 9.7 s one before it). A candidate is skipped if it IS a
//     light or CONTAINS one anywhere in its subtree, and lights are not Meshes
//     so the primary filter already excludes them. Program count is asserted
//     stable in the test suite; it must stay that way.
//
// 2 · THE REFLECTOR RENDERS THE SCENE A SECOND TIME, from a mirrored camera.
//     Our `.visible` decisions are global, so a pane culled for the main view
//     also vanishes from the pool's reflection — and that reflection is the
//     venue's signature shot. Therefore the size test is run against BOTH
//     cameras and the LARGER answer wins: the reflected image of an object can
//     never be culled by a decision made for the direct image. The mirrored
//     camera is derived from the Reflector's own world plane (§ `update`), not
//     from Reflector internals, which three.js does not expose.
//
// 3 · MOMENT GROUPS AND THE NIGHT SYSTEM ALSO WRITE `.visible`, and `.visible`
//     is a shared flag with no ownership protocol. Three rules keep us out of
//     their way:
//       · a mesh under a hidden ancestor is skipped entirely — never written,
//         so a hidden moment group can neither be resurrected nor deepened;
//       · a mesh that is ALREADY HIDDEN when we collect is never a candidate.
//         That is what excludes campus.js's `nightOnly()` roof flecks,
//         water.js's floating lanterns and sky.js's moon disc — everything the
//         day/night fan-out turns ON later;
//       · and the LOCK: if a mesh's `.visible` is ever seen to differ from the
//         value we last wrote, somebody else owns it — we adopt their value as
//         the new base AND retire the mesh from culling permanently.
//     We restore the value we found, never a literal `true`.
//     The sky is exempt outright (`SKIP_ROOTS`): sun and moon discs are the one
//     pair the day/night switch toggles that IS visible at collect time, and
//     nothing in a sky dome that rides the camera should ever be culled anyway.
//
// 4 · WORLD.JS RE-PARENTS THE LATE CONTENT ON THE FIRST FRAME. `updateWorld`
//     runs `adoptLateContent` and `worldifyLateRecords` and THEN the tickers, so
//     a ticker registered here first runs after the moment groups have joined
//     the enclave. Candidates are therefore collected on our first TICK, not in
//     `initDetailCull` — collect in init and every moment prop is measured at
//     the un-rotated enclave origin, 90° and ~80 m from where it really stands.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHERE IT IS WIRED, AND WHY THERE                                         ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// main.js calls `initDetailCull(G)` immediately after `initLightBudget(G)`.
// Unlike the light budget, this module has NO constraint relative to the
// `compileAsync` warm-up: hiding a mesh does not change any material's program
// cache key (three.js keys on light counts, shadow state, fog, tone mapping —
// not on how many objects are drawn), and in any case nothing is hidden until
// the first tick, which is after both warm-ups and after the warm-up render.
// It sits after the light budget so that `G.tickers` runs
//     moments' dinner-intensity → water's lantern drift → light budget → US,
// i.e. we make the last decision of the frame, on a camera that
// updateIntroCam/updatePlayer have already finalised, before renderer.render.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ HOW TO TURN IT OFF                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   · from the URL:      `?dc=off` skips it entirely (cold, for A/B);
//                        `?dc=<transparentPx>,<opaquePx>` boots other
//                        thresholds, e.g. `?dc=24,3`; `?dc=<px>` sets both.
//   · from the console:  `__game.G.detailCull.disable()` puts every mesh back
//                        exactly as its owner left it; `.enable()` resumes.
//                        `.stats()` / `.probe()` are the measuring instruments.
//   · permanently:       delete the two wiring lines in main.js.

import * as THREE from 'three';

/* ── tuning ─────────────────────────────────────────────────────────────────
   Both numbers are the diameter of the object's bounding sphere in CSS pixels
   at 1600×900. They are NOT symmetrical and must not be "tidied" into one
   number — see the overdraw finding in the banner.

   THE CURVE, measured at the brunch spawn — ONE COLD BOOT PER POINT
   (`?dc=<t>,<o>`), each side the same build, un-culled baseline 58.9 fps /
   1,720 draw calls. Each sweep holds the other threshold at 0 (= off):

     transparent px  0(off)   8     12     16     20     24     32
     fps              58.9   61.8   64.6   64.6   65.5   66.4   66.9
     meshes hidden       0     38     64     67     69     81     89
     draw calls       1720   1673   1626   1620   1616   1594   1581

     opaque px       0(off)   2      3      4      6      8     12     16
     fps              58.9   63.4   64.7   65.6   66.5   69.6   76.2   81.5
     meshes hidden       0    345    454    505    567    715    936   1028
     draw calls       1720   1383   1274   1223   1161   1013    792    697

     shipped 16 / 8   79.6 fps, 782 hidden (67 transparent + 715 opaque), 913
                      draw calls — the two levers are very nearly additive
                      (+5.7 and +10.7 alone, +20.7 together).

   TWO THINGS THE CURVE SAYS, and both shaped the shipped pair:

   · THE TRANSPARENT CURVE SATURATES AT 16 and the count barely moves after it
     (67 → 69 → 81 → 89). Past 16 px the only transparent meshes left are the
     big ones — the folding walls, the water sheets, the curtain wall — and
     those are the campus, not detail. 16 is the knee, not a compromise.
   · THE OPAQUE CURVE DOES NOT SATURATE — 16 px would give another 2 fps — but
     it buys them by deleting 1,028 of 2,146 meshes, and the visual difference
     grows with it: at 24/16 the high fly-over measures 0.114 mean absolute
     difference against 0.039 at 16/8. 8 px is where the fps is still nearly
     free and every measured viewpoint is under 0.04/255.

   ⚠ Note the RATIO in that table: the transparent lever hides 67 meshes for
   +5.7 fps, the opaque one hides 715 for +10.7. Per mesh hidden, transparency
   is worth about SIX TIMES what opacity is — which is the overdraw finding in
   the banner, restated. Do not "simplify" this into one threshold. */
const TUNE = {
  PX_TRANSPARENT: 16,
  PX_OPAQUE: 8,

  /* ── hysteresis: a dead band plus a one-directional dwell ────────────────
     SHOW_FACTOR: hide below T, show again only above T × 1.25. In distance
     terms that is a 20 % band, which at walking pace (3.2 m/s) takes ~1.5 s to
     cross at 40 m — a mesh physically cannot be toggled by camera jitter.
     HIDE_DWELL: and even then, a mesh must have been under its threshold for
     0.30 s continuously before it is actually hidden. The dwell is deliberately
     ONE-DIRECTIONAL — showing is INSTANT, hiding is delayed — because the
     failure that matters is a thing popping INTO frame late, never one
     lingering 0.3 s too long.
     Measured: 0 flips in 2.0 s of standing still at every one of the six
     moments; over a scripted 30 s walk (6,964 frames) 191 flips = 6.4/s; over a
     30 s fly climbing to 134 m and traversing 300 m, 2,161 flips = 72/s, which
     is the campus receding, not thrash — ZERO meshes made a round trip inside
     one second, and the busiest single mesh changed 7 times in 60 s on a path
     that deliberately returns to where it started. */
  SHOW_FACTOR: 1.25,
  HIDE_DWELL: 0.30,       // seconds

  /* ── the hard floor, and it EARNED its value ─────────────────────────────
     Nothing within this distance of the camera is culled, whatever the
     arithmetic says. Measured against the SPHERE SURFACE, not its centre, so a
     large object you are standing next to is inside the floor even if its
     centre is not.
     70 m, not the 35 m it was first written at, and the difference is the only
     visible regression this module ever produced. From the pool deck at night,
     looking back at the suite across the lantern water — the venue's signature
     shot — the prewedding festoon's bulb glows sit 36…40 m away and measure
     ~9 px, so at 35 m they fell outside the floor and were culled: mean
     absolute difference 0.033/255 over 822 pixels, a visibly fainter string of
     lights. Swept against that view:

       NEAR_KEEP        35      50      70     100
       mean diff    0.0332  0.0029  0.0000  0.0000
       brunch fps   unchanged at every value — hidden 782 in all four

     70 removes it completely and costs NOTHING, because every view the cull
     actually pays off at is 150–285 m out. A guarantee that is free is not a
     compromise; take it. */
  NEAR_KEEP: 70,          // metres
};

/* Subtrees never considered. `sky` is `buildSky`'s root: it rides the camera,
   its dome/haze are always the whole screen, its stars are Points (not Meshes),
   and its sun and moon discs are the only day/night `.visible` pair that is
   VISIBLE at collect time — i.e. the one case rule 3 in the banner could not
   catch on its own. Exempting the root is cheaper and more honest than
   special-casing two discs. */
const SKIP_ROOTS = new Set(['sky']);

/* ── scratch (module scope: this runs every frame over ~2,000 meshes) ── */
const _camPos = new THREE.Vector3();
const _mirPos = new THREE.Vector3();
const _mirN = new THREE.Vector3();
const _mirP = new THREE.Vector3();
const _c = new THREE.Vector3();
const _v = new THREE.Vector3();
const _size = new THREE.Vector2();
const _sphere = new THREE.Sphere();

let D = null;   // the one live pass; there is only ever one scene

/**
 * Register the per-frame screen-size cull.
 *
 * CALL IT: after buildWorld, after initMoments, after initLightBudget. Nothing
 * is collected here — see trap 4 in the banner: the candidate sweep happens on
 * the first TICK, which world.js runs after its enclave adoption pass.
 *
 * @param {object} G      the shared context (scene, camera, renderer, tickers)
 * @param {object} [opts] {pxTransparent, pxOpaque} — overridden by `?dc=`
 * @returns {object|null} the debug handle, also published as `G.detailCull`
 */
export function initDetailCull(G, opts = {}) {
  /* URL override, so a test can boot a threshold pair cold and both sides of an
     A/B are the same build. `off` is the A/B's OFF side. */
  let q = null;
  try { q = new URLSearchParams(location.search).get('dc'); } catch { q = null; }
  if (q === 'off') return null;

  let pxT = opts.pxTransparent ?? TUNE.PX_TRANSPARENT;
  let pxO = opts.pxOpaque ?? TUNE.PX_OPAQUE;
  if (q) {
    const p = q.split(',').map(Number).filter(n => Number.isFinite(n) && n >= 0);
    if (p.length === 1) pxT = pxO = p[0];
    else if (p.length >= 2) { pxT = p[0]; pxO = p[1]; }
  }

  D = {
    G, pxT, pxO,
    showFactor: TUNE.SHOW_FACTOR,
    dwell: TUNE.HIDE_DWELL,
    near: TUNE.NEAR_KEEP,
    enabled: true,
    ready: false,
    K: 0,               // viewportHeight / (2·tan(fov/2)) — refreshed per frame
    recs: [],
    reflector: null,
    frames: 0,
    hidden: 0,          // how many are hidden right now
    flips: 0,           // lifetime visibility changes we caused
    flipsFrame: 0,      // …this frame
    locked: 0,          // retired because somebody else writes their .visible
    skipped: 0,         // under a hidden ancestor this frame
    logFlips: false,
    flipLog: [],        // [t, tag, shown?] — the pop test reads this
  };

  (G.tickers ||= []).push(update);

  G.detailCull = {
    get enabled() { return D.enabled; },
    get thresholds() { return { transparent: D.pxT, opaque: D.pxO }; },
    stats,
    probe,
    update,
    disable() { setEnabled(false); },
    enable() { setEnabled(true); },
    setThresholds(t, o) { D.pxT = t; D.pxO = o; },
    setNear(m) { D.near = m; },
    setFlipLog(on) { D.logFlips = !!on; D.flipLog.length = 0; },
    flipLog() { return D.flipLog.slice(); },
  };
  return G.detailCull;
}

/* ── the one-time candidate sweep ───────────────────────────────────────────
   Runs on the FIRST TICK. By then world.js has re-parented moments.js's groups
   into the rotated enclave, so `updateMatrixWorld` below produces the world
   positions the campus is actually standing at.

   A candidate is a plain Mesh with a usable bounding sphere that is visible,
   light-free and not in a skipped subtree. Explicitly NOT candidates:
     · InstancedMesh — one draw call already, and its instances are scattered
       over 500 m of campus, so a single per-object size test is meaningless for
       it (the campus's ~13k blooms, chairs, pavers and palms are all instanced);
     · the Reflector — hiding the mirror is exactly the thing the venue exists
       for, and it is 25 m across so no threshold would ever have reached it;
     · anything already hidden, or containing a light (see traps 1 and 3);
     · Points / Line / Sprite — not `isMesh`, never reached. */
function collect() {
  const { G } = D;
  D.ready = true;
  G.scene.updateMatrixWorld(true);

  const skip = new Set();
  for (const child of G.scene.children) {
    if (SKIP_ROOTS.has(child.name)) child.traverse(o => skip.add(o));
  }

  G.scene.traverse(o => {
    if ((o.isReflector || o.type === 'Reflector') && !D.reflector) D.reflector = o;
    if (!o.isMesh || o.isInstancedMesh) return;
    if (skip.has(o)) return;
    if (o.userData && o.userData.noDetailCull) return;
    if (!o.visible) return;                       // trap 3: owner-toggled
    if (o.isReflector || o.type === 'Reflector') return;

    const g = o.geometry;
    if (!g) return;
    if (!g.boundingSphere) { try { g.computeBoundingSphere(); } catch { return; } }
    const bs = g.boundingSphere;
    if (!bs || !(bs.radius > 0) || !Number.isFinite(bs.radius)) return;

    /* a mesh with a light anywhere under it must never be hidden — hiding it
       hides the light, which changes NUM_POINT_LIGHTS and recompiles the campus */
    let hasLight = false;
    o.traverse(k => { if (k.isLight) hasLight = true; });
    if (hasLight) return;

    D.recs.push({
      mesh: o,
      tag: (o.name || o.material?.name || o.geometry.type || 'mesh') + '#' + D.recs.length,
      cx: bs.center.x, cy: bs.center.y, cz: bs.center.z,
      r0: bs.radius,
      r02: bs.radius * bs.radius,
      d2: Infinity, sc2: 1,      // last frame's squared distance / squared scale
      base: true,          // owner's intent — everything here is visible
      written: true,       // what WE last wrote
      culled: false,
      locked: false,
      smallSince: 0,
    });
  });
}

/* every ancestor visible? a mesh under a hidden moment group is not ours */
function chainVisible(o) {
  for (let p = o.parent; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/* three.js sorts into the transparent queue on `material.transparent` alone, so
   that is exactly the test. Re-read every frame rather than cached: the night
   fan-out rewrites opacities and a future one could rewrite the flag. */
function isTransparent(m) {
  if (!m) return false;
  if (Array.isArray(m)) {
    for (let i = 0; i < m.length; i++) if (m[i] && m[i].transparent) return true;
    return false;
  }
  return !!m.transparent;
}

/* ── the per-frame pass ───────────────────────────────────────────────────── */
function update() {
  if (!D || !D.enabled) return;
  if (!D.ready) collect();

  const { G, recs } = D;
  const cam = G.camera;

  /* syncCamera wrote position + rotation and nothing has flushed them to a
     matrix yet this frame — the renderer will, after us. Do it here so the test
     is against THIS frame's camera, not last frame's. (Every OTHER matrixWorld
     we read below is last frame's, which is correct to within one frame for
     static geometry and invisible for the two animated parents on this campus.) */
  cam.updateWorldMatrix(true, false);
  _camPos.setFromMatrixPosition(cam.matrixWorld);

  G.renderer.getSize(_size);                      // CSS px; no layout flush
  const K = _size.y / (2 * Math.tan(cam.fov * THREE.MathUtils.DEG2RAD / 2));
  D.K = K;
  /* THE WHOLE TEST IS DONE SQUARED, and that is not micro-optimisation for its
     own sake — it is three square roots per candidate over ~2,100 candidates
     every frame. `px = 2·r₀·scale·K / d < T` is exactly `(2·r₀·K)²·scale² <
     T²·d²`, and both sides are non-negative, so the comparison is identical.
     The only sqrt left is inside the near-guard branch, which is reached only
     by a mesh that is about to be hidden. Measured over 500 calls at each of
     the six moments: 0.067…0.077 → 0.062…0.071 ms per frame, about 7 %. The
     square roots were NOT the bottleneck — walking 2,146 parent chains and
     reading 2,146 world matrices is — but they were free to remove. */
  const kk2 = 4 * K * K;
  const pxT2 = D.pxT * D.pxT, pxO2 = D.pxO * D.pxO;
  const band2 = D.showFactor * D.showFactor;

  /* ── trap 2: the mirrored camera ────────────────────────────────────────
     The Reflector renders the scene again from the camera reflected through its
     own plane, and it does it with OUR visibility decisions. three.js keeps its
     virtual camera in a closure, so derive the mirror from the mesh's world
     matrix instead: a PlaneGeometry faces local +Z, so the plane's normal is
     +Z through matrixWorld and its point is the mesh's world position. Then
     `camMirror = cam − 2((cam − p)·n)n`, and the reflected image of an object is
     exactly as far from that point as the direct image is from the real camera.
     Computed whenever the mirror is live, not only when it is on screen —
     conservative on purpose, and it costs one subtract and one distance per
     candidate. */
  let mirrored = false;
  const R = D.reflector;
  if (R && R.visible && chainVisible(R)) {
    R.updateWorldMatrix(true, false);
    _mirN.set(0, 0, 1).transformDirection(R.matrixWorld).normalize();
    _mirP.setFromMatrixPosition(R.matrixWorld);
    const s = _v.copy(_camPos).sub(_mirP).dot(_mirN);
    _mirPos.copy(_camPos).addScaledVector(_mirN, -2 * s);
    mirrored = true;
  }

  const now = performance.now() / 1000;
  const near = D.near, near2 = near * near;
  let hidden = 0, skipped = 0;
  D.flipsFrame = 0;

  for (let i = 0; i < recs.length; i++) {
    const r = recs[i], mesh = r.mesh;

    /* ── ownership: did somebody else write this .visible? ────────────────
       If so their value is the new base — and the mesh is retired, because a
       flag with two writers and no protocol cannot be shared safely. Retiring
       costs one mesh and removes a whole class of silent bug (the night
       fan-out hiding something we had already hidden, then us "restoring" it
       into a scene it does not belong in). */
    if (mesh.visible !== r.written) {
      r.base = mesh.visible;
      if (!r.locked) { r.locked = true; D.locked++; }
      r.culled = false;
      r.written = mesh.visible;
    }
    /* retired: its owner has it, and `hidden` below counts only OUR hides */
    if (r.locked) continue;

    /* a hidden ancestor means this mesh is not drawn and not ours to touch */
    if (!chainVisible(mesh)) { skipped++; continue; }

    const m = mesh.matrixWorld;
    _c.set(r.cx, r.cy, r.cz).applyMatrix4(m);
    const e = m.elements;
    const sc2 = Math.max(
      e[0] * e[0] + e[1] * e[1] + e[2] * e[2],
      e[4] * e[4] + e[5] * e[5] + e[6] * e[6],
      e[8] * e[8] + e[9] * e[9] + e[10] * e[10]);

    const d2 = Math.max(1e-6, _c.distanceToSquared(_camPos));
    /* the mirror term: the reflected image is as far from the mirrored camera
       as the direct image is from the real one, and the LARGER apparent size
       wins — i.e. the SMALLER of the two distances */
    let e2 = d2;
    if (mirrored) {
      const dm2 = Math.max(1e-6, _c.distanceToSquared(_mirPos));
      if (dm2 < e2) e2 = dm2;
    }
    r.d2 = e2; r.sc2 = sc2;

    const lhs = r.r02 * kk2 * sc2;                 // (2·r₀·K·scale)²
    const T2 = isTransparent(mesh.material) ? pxT2 : pxO2;
    /* dead band: hide under T, show again only over T × showFactor */
    let want = lhs < (r.culled ? T2 * band2 : T2) * e2;
    /* The hard floor — measured to the sphere's SURFACE, on the REAL camera's
       distance (the mirror may make a thing look bigger, but it may not make a
       thing you are standing next to safe to delete).
       Two steps, because the first one is free and answers almost every case:
       a centre inside the floor is inside it whatever the radius, and INSIDE a
       building — the dinner and after-party views — that is most of the
       candidate list. Only a mesh that is both small on screen AND beyond the
       floor pays for the two square roots, and that mesh is about to be hidden
       anyway, so the count is bounded by what we cull. */
    if (want) {
      if (d2 <= near2) want = false;
      else if (Math.sqrt(d2) - r.r0 * Math.sqrt(sc2) < near) want = false;
    }

    if (want) {
      if (!r.culled) {
        if (!r.smallSince) r.smallSince = now;
        if (now - r.smallSince >= D.dwell) r.culled = true;
      }
    } else {
      r.smallSince = 0;
      r.culled = false;                            // showing is instant
    }

    const target = r.base && !r.culled;
    if (mesh.visible !== target) {
      mesh.visible = target;
      D.flips++; D.flipsFrame++;
      if (D.logFlips) D.flipLog.push([+now.toFixed(3), r.tag, target]);
    }
    r.written = target;
    if (!target) hidden++;
  }

  D.hidden = hidden;
  D.skipped = skipped;
  D.frames++;
}

/* ── debug handle ─────────────────────────────────────────────────────────── */

function stats() {
  if (!D) return null;
  return {
    enabled: D.enabled, ready: D.ready,
    candidates: D.recs.length,
    hidden: D.hidden, skipped: D.skipped, locked: D.locked,
    flips: D.flips, flipsFrame: D.flipsFrame, frames: D.frames,
    pxTransparent: D.pxT, pxOpaque: D.pxO,
    showFactor: D.showFactor, dwell: D.dwell, near: D.near,
    reflector: !!D.reflector,
  };
}

/* One row per candidate as of the last pass — the instrument the threshold
   curve in TUNE was measured with. `px` is reconstructed here rather than
   stored, because the hot loop deliberately never takes its square roots.
   Heavy; call it from a test, not a ticker. */
function probe(limit = 0) {
  if (!D || !D.ready) return [];
  const out = [];
  for (const r of D.recs) {
    const px = 2 * r.r0 * Math.sqrt(r.sc2) * (D.K || 0) / Math.sqrt(r.d2);
    out.push({
      tag: r.tag, px: +px.toFixed(2),
      transparent: isTransparent(r.mesh.material),
      culled: r.culled, locked: r.locked, base: r.base,
      visible: r.mesh.visible, chain: chainVisible(r.mesh),
    });
  }
  out.sort((a, b) => a.px - b.px);
  return limit ? out.slice(0, limit) : out;
}

/* The A/B harness and the escape hatch. `disable()` puts every candidate back
   exactly as its owner left it — `base`, never a literal `true`. */
function setEnabled(on) {
  if (!D || D.enabled === on) return;
  D.enabled = on;
  if (!on) {
    for (const r of D.recs) {
      if (r.locked) continue;
      if (r.mesh.visible !== r.base) r.mesh.visible = r.base;
      r.written = r.base;
      r.culled = false;
      r.smallSince = 0;
    }
    D.hidden = 0;
  } else {
    update();
  }
}

/* Cover the case where a moment/night switch happens while we are disabled: on
   re-enable the ownership check above sees `mesh.visible !== r.written` and
   adopts, exactly as it does when we are enabled. Nothing else to do. */
