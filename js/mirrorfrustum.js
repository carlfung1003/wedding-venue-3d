// mirrorfrustum.js — render the hero pool's reflection through the mirror
// quad's SCREEN-SPACE EXTENT instead of the full reflected view frustum.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE LEVER js/mirrorlayers.js NAMED AND DID NOT PULL                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// THREE.Reflector copies the MAIN camera's projection onto its virtual camera,
// so the mirror pass draws the whole reflected view — every object in a 90°
// cone — even when the pool is a 25-pixel sliver 285 m away. At the Welcome
// Brunch that is ~900 draw calls and ~390k triangles rendered into a 1024×512
// target of which the quad samples about six hundred texels.
//
// This module forks `onBeforeRender` and narrows the virtual camera's
// projection to the quad's own on-screen box — and, crucially, renders into the
// MATCHING SUB-RECTANGLE of the same render target rather than into the whole
// of it.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHY THE REFLECTION CANNOT SLIDE — the whole design is this one identity  ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Write P for the main camera's projection, V for the virtual camera's view
// matrix and M for the mirror's world matrix. Stock three samples the target at
//
//     textureMatrix = bias · P · V · M ,        bias = ½·(x+1), ½·(y+1), …
//
// which is exact because the same P was used to render the target over the FULL
// viewport. Now narrow: choose a sub-rectangle of the target, `(vx, vy, vw, vh)`
// in texels, and build
//
//     S = the matrix that maps the NDC box  [nx0,nx1]×[ny0,ny1]  onto [-1,1]²,
//         nx0 = 2·vx/W − 1 ,  nx1 = 2·(vx+vw)/W − 1     (likewise y with H)
//
// so `P' = S·P` and render with viewport `(vx, vy, vw, vh)`. Writing hx = vw/W
// and cx = (2vx+vw)/W − 1 for the box's half-width and centre,
//
//     S : row0 ← (row0 − cx·row3)/hx ,  row1 ← (row1 − cy·row3)/hy
//
// The lookup must now land in that sub-rectangle, i.e. the bias becomes
//
//     T = scale(vw/W, vh/H) ∘ offset(vx/W, vy/H) ∘ bias
//
// and **T·S = bias, identically**. The x row of T·S is
//     (vw/2W)·(1/hx)·(row0 − cx·row3) + ((vx + vw/2)/W)·row3
//   = ½·row0 − ½·cx·row3 + ((vx + vw/2)/W)·row3        [since hx = vw/W]
//   = ½·row0 + ½·row3                                   [since cx = 2(vx+vw/2)/W − 1]
// which is the bias row it started as. So
//
//     textureMatrix = T · P' · V · M = bias · P · V · M — UNCHANGED.
//
// That is the correctness argument, and it is algebraic rather than empirical:
// **this file does not compute a new texture matrix at all.** It runs stock
// three's line, from stock three's `camera.projectionMatrix`, and the narrowing
// cancels out of it exactly. A reflection that slid would have to be a
// viewport/projection pair that disagrees, and the two are derived from one
// integer rectangle three lines apart.
//
// Two consequences fall out of the same identity and are the reason this is a
// viewport narrowing and not merely a projection narrowing:
//
// 1 · **The sampling density is IDENTICAL to stock.** The viewport transform
//     maps NDC' back onto exactly the texels the full-viewport render would
//     have written — `(ndc'·½+½)·vw + vx ≡ (ndc·½+½)·W` for every point, by the
//     same algebra. The reflection is not sharper, not softer, and does not
//     change resolution as the quad's screen extent changes. Narrowing the
//     projection ALONE would have raised the effective resolution — which
//     sounds like a bonus until you walk toward the pool and watch the
//     reflection sharpen frame by frame.
// 2 · **The ripple is untouched.** water.js's shader perturbs the projected
//     lookup by `wob` in target UV — that is, in TEXELS. Texel size did not
//     change, so the wobble's angular size did not change either. Under a
//     projection-only narrowing the same UV offset would have shrunk with the
//     quad, and the swell would have died away as you backed off.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT THE RECTANGLE IS, AND WHY IT IS QUANTISED                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// · The box is the projection of the quad's own bounding box through the
//   VIRTUAL camera — never the main one. Doing it in the virtual camera's own
//   space is what keeps the left/right mirror flip out of this file: a point on
//   the mirror plane lands at the x-mirrored main-camera position, and deriving
//   the box from the same matrix the render uses makes that a non-question.
// · Corners behind the near plane are CLIPPED, not projected. A naive
//   perspective divide through w ≈ 0 explodes and would hand back a garbage box
//   the moment you stand with the pool's far coping behind your ear. The box is
//   the projection of the near-clipped convex hull, obtained the exact way: the
//   surviving corners plus every edge/near-plane intersection.
// · The box is grown by `pad` TEXELS for the ripple. The shader's worst-case
//   perturbation is 2·MIRROR_RIPPLE_AMP in UV (each of the two normal taps
//   contributes ±1), so 2·amp·W texels in x, +1 for the bilinear tap and +2 of
//   slack. At the shipped amp of .006 that is 16 texels across and 10 down —
//   constant, cheap, and the reason nothing samples an unrendered texel.
// · **The viewport's SIZE moves on a 32-texel ladder; only its OFFSET moves
//   freely.** Any integer rectangle is exact, so the ladder costs nothing but a
//   little of the win — and it buys stability: three.js sizes its transmission
//   render target from the ACTIVE VIEWPORT, and the prewedding deck has
//   transmissive glassware in the mirror's list, so a size that changed every
//   frame would reallocate a half-float mip-mapped target every frame. It grows
//   the moment the box no longer fits and shrinks only once a whole step of
//   slack has opened, so it cannot flap on a rung. Measured over a 150-frame
//   walk of the pool: the size moves on 88 frames, and those frames cost
//   0.8 ms more than the ones where it does not — against a 2.1 ms saving.
//   Sweeping the rung, whole-path frame time against the un-narrowed build:
//   step 8 −6.6/−7.8 %, 16 −7.3/−6.6 %, 32 −7.7/−5.6 %, 64 −5.8 %, 128 −3.1 %,
//   256 −1.9 %. Below 32 it is flat, above 32 it decays; 32 also has the fewest
//   size changes of the three that tie.
// · If the box misses the screen entirely the render is SKIPPED outright and
//   nothing is touched — no texture matrix, no target. Nothing can sample the
//   stale target, because a quad whose whole projected box is off screen has no
//   fragment on screen. (three usually culls the mesh before we are called at
//   all; this is the case where the bounding SPHERE passes and the box does
//   not.)
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT IS PRESERVED FROM STOCK, LINE FOR LINE                             ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// The virtual camera's position/orientation/up, the facing-away early-out, the
// texture matrix, and — the load-bearing one — **the oblique near-plane clip**
// (`clipBias`, `clipPlane`, `q`, the third-row substitution from Lengyel).
// Without it the basin, the plinth and everything else below the water line
// leak back into their own reflection.
//
// ⚠ ONE DELIBERATE DEPARTURE, and it is worth the paragraph it costs, because
// it is the difference between "close enough" and "the same picture".
// Lengyel's `q` — the far corner in the clip plane's direction — is solved from
// the MAIN camera's projection, not from the narrowed one. Solve it from the
// narrowed matrix and row 2 comes out slightly different from stock's, which
// moves the far plane and flips distant objects in and out of the reflection:
// measured, +2 draw calls at the After Party and +6 at the grazing view (a
// NARROWER frustum drawing MORE), and a visual A/B that went from 0.0007 to
// 0.989 mean |Δ| inside the mirror at the great room, 266 pixels past 8/255.
// Solving it from the main camera's matrix makes row 2 bit-identical to stock's
// — same depth mapping, same precision, same far plane — and those numbers
// collapse to 0.0007 and 0 pixels. The near plane does not depend on the scale
// at all (row3 + row2 ∝ the clip plane whatever `q` was), so nothing is lost.
// See the note at the call site for the algebra.
//
// The rest is safe by shape: `S·P` is still a perspective matrix of exactly the
// form the formula assumes — row 3 untouched at (0,0,−1,0), rows 0 and 1 still
// (A,0,C,0)/(0,B,D,0) with A' = A/hx and C' = (C+cx)/hx — and the z row the
// clip overwrites is the one row the texture matrix never reads (texture2DProj
// uses x, y and w), so the two are independent.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT IT IS WORTH — measured 2026-08-06, headless Metal ANGLE, 1600×900   ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Mirror-pass draw calls are exact: the Reflector's own onBeforeRender called
// with `renderer.info.autoReset` off, so the counters hold that pass and
// nothing else. fps is a per-FRAME interleaved A/B (this laptop drifts 2× over
// a minute under load; anything coarser measures the thermals).
//
//   view                    mirror calls   mirror tris      fps        viewport
//   ── pool deck at night — THE SIGNATURE ────────────────────────────────────
//   deck, lanterns lit       288 → 288     294k → 294k    93.5 → 95.2   1024×288
//   ── the great room over the water (the Prewedding spawn) ──────────────────
//   great room               934 → 399     611k → 315k    51.3 → 62.1    384×64
//   ── the Welcome Brunch, 285 m up, the pool a 25-pixel sliver ──────────────
//   brunch                   818 → 552     340k → 305k    53.2 → 60.2     64×32
//   ── a flyover, and the After Party on the deck ────────────────────────────
//   flyover                  695 → 194     491k → 277k    39.2 → 67.6     96×96
//   after party              354 → 355     293k → 304k    64.5 → 69.0    832×96
//   ── the quad filling frame: nothing to save, and none is taken ────────────
//   mirrored suite, night   2948 → 2948    723k → 723k    30.6 → 31.0   1024×256
//   mirrored suite, day     2789 → 2789    698k → 698k    15.7 → 16.1   1024×256
//   grazing skim              289 → 291    292k → 292k    74.6 → 80.6   1024×128
//   quad nearly edge-on       396 → 385    298k → 296k    71.9 → 76.3    1024×32
//   ── quad behind the camera: the render is skipped outright ────────────────
//   pool behind you           145 → 1      299k → 2       70.9 → 94.3    skipped
//
// Read the deck row first: **at the signature shot this buys nothing**, because
// the quad's own box fills the screen and there is genuinely nothing outside it
// to cull. The win is at the views where the pool is small on screen, and the
// floor on the draw-call saving is real — ~45 renderables on this campus carry
// bounding spheres over 60 m (the ground planes, the ocean, the sky dome and
// every instanced bucket scattered across the enclave) and pass any frustum you
// point at the pool.
//
// ⚠ **A NARROWER FRUSTUM CAN DRAW ONE OR TWO MORE OBJECTS, and that is not a
// bug.** three culls by bounding SPHERE, and the "kept" set is not monotone in
// the frustum: offsetting two planes that share the camera's apex by −radius
// moves them apart in different directions, so a sphere can clear the tight
// plane and miss the wide one. Both of the +1/+2 rows above are one suite mesh
// with a 7 m sphere on 40 triangles. It costs a draw call and can only ADD
// content that is genuinely in view.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ HOW TO TURN IT OFF                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   · from the URL:      `?mf=off` boots the stock full-frustum mirror.
//   · from the console:  `__game.G.mirrorFrustum.disable()` / `.enable()` /
//                        `.stats()` — disable restores the full viewport on the
//                        next frame, so it is a true A/B at runtime.
//   · from the console:  `.setStep(n)` moves the size ladder's rung (see above),
//                        `.stats()` reports the live rectangle, its coverage of
//                        the target, the NDC box, and the warm-up counters.
//   · permanently:       delete the initMirrorFrustum call in water.js and the
//                        Reflector reverts to three's own onBeforeRender.
//
// ⚠ `?mf=off` is not an approximation of stock — it IS stock. With `enabled`
// false the fork runs three's own lines with three's own numbers, and it was
// checked against an untouched checkout of the repo served side by side: at six
// viewpoints, identical draw calls, identical triangles, identical program
// count, to the unit.

import * as THREE from 'three';

/* ── scratch, module-scope: this runs once per frame and allocates nothing ── */
const _reflectorPlane = new THREE.Plane();
const _normal = new THREE.Vector3();
const _mirrorPos = new THREE.Vector3();
const _cameraPos = new THREE.Vector3();
const _rotation = new THREE.Matrix4();
const _lookAt = new THREE.Vector3(0, 0, -1);
const _clipPlane = new THREE.Vector4();
const _view = new THREE.Vector3();
const _target = new THREE.Vector3();
const _q = new THREE.Vector4();
const _localToView = new THREE.Matrix4();
const _corner = new THREE.Vector3();

/* the geometry's 8 bounding-box corners, in view space, + one lerp scratch */
const _pts = [];
for (let i = 0; i < 8; i++) _pts.push(new THREE.Vector3());
const _cut = new THREE.Vector3();

/* the 12 edges of a box, as index pairs over the corner order below
   (bit 0 = x1, bit 1 = y1, bit 2 = z1) */
const EDGES = [
  [0, 1], [2, 3], [4, 5], [6, 7],   // along x
  [0, 2], [1, 3], [4, 6], [5, 7],   // along y
  [0, 4], [1, 5], [2, 6], [3, 7],   // along z
];

/* The viewport's SIZE moves on this ladder — a multiple of STEP texels, never
   less than STEP. Any integer rectangle is exact, so the ladder costs nothing
   but a little of the win; what it buys is that the size takes a handful of
   discrete values instead of a new one every frame. See the banner: three.js
   sizes its transmission render target off the ACTIVE VIEWPORT, and the
   prewedding deck has transmissive glassware inside the mirror's frustum, so a
   size that moved every frame would reallocate a half-float mip-mapped target
   every frame. The OFFSET is left free — it is not what three keys off. */
const STEP = 32;

/* ⚠ THE ONE THING NARROWING BREAKS IF YOU DO NOT ASK, and it is this project's
   oldest bug class — a shader compile landing mid-play.
   three compiles a SEPARATE program for every material the mirror draws,
   because the render target forces its own tone mapping and output encoding;
   js/main.js says so itself and spends a whole render behind the loading card
   buying them ("Nothing but an actual render through the mirror creates those,
   and they were the last 32 of the stall"). A narrowed warm-up render reaches
   far fewer materials, so the rest compile LATER — measured on a cold boot
   walk: the warm-up bought 101 programs instead of 112, and the missing 11
   landed on the first frame after the card came down (139.8 ms against 66.3)
   with two more 40 ms stalls out on the path.
   So: stay un-narrowed until the program cache has been quiet for WARM frames,
   and go un-narrowed again for WARM frames whenever it moves. One wide mirror
   pass costs a fraction of one compile, and it front-loads every neighbouring
   material in the same frame. */
const WARM = 30;

let F = null;   // the one live pass

/**
 * Fork the Reflector's onBeforeRender so the mirror renders only the part of
 * its target the quad can actually sample.
 *
 * CALL IT: from makeMirrorWater, on the Reflector, BEFORE any other wrapper —
 * water.js's every-Nth-frame gate wraps whatever `onBeforeRender` it finds, so
 * this has to be underneath it.
 *
 * @param {THREE.Mesh} mirror   the ONE Reflector
 * @param {object} [opts]
 * @param {number} [opts.clipBias]  the SAME clipBias the Reflector was built
 *                                  with — three keeps it in a closure and does
 *                                  not publish it, so it must be passed again.
 * @param {number} [opts.wobbleU]   the LARGEST |Δu| the fragment shader can add
 * @param {number} [opts.wobbleV]   the LARGEST |Δv| ditto — both in target UV.
 *                                  water.js measures these off the very normal
 *                                  map the shader samples, so they are the
 *                                  shader's own worst case rather than a
 *                                  guess. 0 is only right for a mirror that
 *                                  samples its projected UV exactly.
 * @returns {object|null} the debug handle — publish it as G.mirrorFrustum
 */
export function initMirrorFrustum(mirror, opts = {}) {
  if (!mirror || !mirror.isReflector) return null;

  let q = null;
  try { q = new URLSearchParams(location.search).get('mf'); } catch { q = null; }

  const rt = mirror.getRenderTarget();
  const vcam = mirror.camera;
  const texMat = mirror.material?.uniforms?.textureMatrix?.value;
  if (!rt || !vcam || !texMat) return null;

  const W = rt.width, H = rt.height;
  const wobU = Math.max(0, opts.wobbleU ?? 0);
  const wobV = Math.max(0, opts.wobbleV ?? 0);

  F = {
    mirror, rt, vcam, texMat, W, H,
    clipBias: opts.clipBias || 0,
    /* the shader's worst-case lookup offset, in texels, + 1 for the bilinear
       tap and 2 of slack. This is the ONLY thing standing between the ripple
       and an unrendered texel, so it is measured, not estimated. */
    padX: Math.ceil(wobU * W) + 3,
    padY: Math.ceil(wobV * H) + 3,
    enabled: q !== 'off',
    step: STEP,
    /* the live rectangle, in target texels */
    vx: 0, vy: 0, vw: W, vh: H,
    /* the last NDC box, for the instruments */
    ndc: [-1, -1, 1, 1],
    lastProgs: -1, warm: WARM, warmups: 0,
    frames: 0, skipped: 0, narrowed: 0, classChanges: 0,
    full: true,       // is the viewport currently the whole target?
  };

  mirror.onBeforeRender = onBeforeRender;

  return {
    get enabled() { return F.enabled; },
    get step() { return F.step; },
    enable() { F.enabled = true; },
    disable() { F.enabled = false; },
    /* the size ladder's rung, in target texels. Coarser = fewer distinct
       viewport sizes (and so fewer transmission-target reallocations) at the
       cost of a looser frustum; finer = a tighter cull and more churn. See the
       banner — 32 is where the two curves cross on this campus. */
    setStep(n) { F.step = Math.max(8, Math.min(F.W, n | 0)); },
    stats,
  };
}

/* ── the fork ────────────────────────────────────────────────────────────── */
function onBeforeRender(renderer, scene, camera) {
  const { mirror, rt, vcam, texMat } = F;

  /* ══ stock three, verbatim: build the virtual camera ══════════════════ */
  _mirrorPos.setFromMatrixPosition(mirror.matrixWorld);
  _cameraPos.setFromMatrixPosition(camera.matrixWorld);

  _rotation.extractRotation(mirror.matrixWorld);
  _normal.set(0, 0, 1).applyMatrix4(_rotation);

  _view.subVectors(_mirrorPos, _cameraPos);

  /* facing away — three renders nothing and neither do we */
  if (_view.dot(_normal) > 0 && mirror.forceUpdate === false) return;

  _view.reflect(_normal).negate().add(_mirrorPos);

  _rotation.extractRotation(camera.matrixWorld);
  _lookAt.set(0, 0, -1).applyMatrix4(_rotation).add(_cameraPos);

  _target.subVectors(_mirrorPos, _lookAt).reflect(_normal).negate().add(_mirrorPos);

  vcam.position.copy(_view);
  vcam.up.set(0, 1, 0).applyMatrix4(_rotation).reflect(_normal);
  vcam.lookAt(_target);
  vcam.far = camera.far;                    // used by WebGLBackground
  vcam.updateMatrixWorld();

  /* ══ the texture matrix — stock, from the MAIN camera's projection ══════
     Not from the narrowed one, and not corrected afterwards: the narrowing and
     the viewport cancel out of it exactly (see the banner's identity). This is
     three's own line, and it is the whole reason nothing can drift. ══════ */
  texMat.set(
    0.5, 0.0, 0.0, 0.5,
    0.0, 0.5, 0.0, 0.5,
    0.0, 0.0, 0.5, 0.5,
    0.0, 0.0, 0.0, 1.0,
  );
  texMat.multiply(camera.projectionMatrix);
  texMat.multiply(vcam.matrixWorldInverse);
  texMat.multiply(mirror.matrixWorld);

  /* ══ the projection: stock, then narrowed to the quad's own box ═════════ */
  vcam.projectionMatrix.copy(camera.projectionMatrix);

  F.frames++;

  /* the warm-up gate: a program cache that is still moving means materials are
     still meeting this render target for the first time, and those are exactly
     the ones a narrowed pass would defer into a stutter. See WARM. */
  const nProgs = renderer.info.programs.length;
  if (nProgs !== F.lastProgs) { F.lastProgs = nProgs; F.warm = WARM; F.warmups++; }
  const warming = F.warm > 0;
  if (warming) F.warm--;

  let narrow = false;
  if (F.enabled && !warming && camera.isPerspectiveCamera) {
    const box = ndcBox(camera);
    if (box === null) { F.skipped++; return; }   // off screen — nothing to draw
    narrow = fitViewport(box);
  }

  if (narrow) {
    F.narrowed++;
    applySubRect(vcam.projectionMatrix, F.vx, F.vy, F.vw, F.vh, F.W, F.H);
    rt.viewport.set(F.vx, F.vy, F.vw, F.vh);
    rt.scissor.set(F.vx, F.vy, F.vw, F.vh);
    rt.scissorTest = true;
    F.full = false;
  } else if (!F.full) {
    /* back to stock — the A/B hatch and the "quad fills the screen" case take
       the same path, so there is only one way to be un-narrowed */
    F.vx = 0; F.vy = 0; F.vw = F.W; F.vh = F.H;
    rt.viewport.set(0, 0, F.W, F.H);
    rt.scissor.set(0, 0, F.W, F.H);
    rt.scissorTest = false;
    F.full = true;
  }

  /* ══ the oblique near-plane clip — stock's SUBSTITUTION, stock's q ══════
     The clip itself is Lengyel's, unchanged, and it is load-bearing: without
     it the basin, the plinth and everything under the water line leak back
     into their own reflection.

     ⚠ ONE DELIBERATE DEPARTURE, and it is a fix rather than a liberty. `q` is
     the frustum corner in the clip plane's direction, and the scale solved
     from it lands ONLY in row 2 — the depth row. Solve it from the NARROWED
     projection and that row comes out slightly different from stock's, which
     moves the far plane (row3 − row2) and flips a handful of distant objects
     into the reflection that stock had clipped: measured, +2 draw calls at the
     After Party and +6 at the grazing view, i.e. narrowing the frustum made
     the pass draw MORE. Solving `q` from the MAIN camera's projection — the
     one stock would have used — makes row 2 bit-identical to stock's, so the
     depth mapping, the depth precision and the far plane are all exactly what
     they were, and rows 0/1 are the only thing this file changes.

     It stays correct because the near plane does not depend on the scale at
     all: row3 + row2 = (clip.x, clip.y, clip.z − clipBias, clip.w) ∝ the clip
     plane whatever `q` was. Only where NDC z = 1 lands moves, and that is
     precisely what we want to leave alone. ══════════════════════════════ */
  _reflectorPlane.setFromNormalAndCoplanarPoint(_normal, _mirrorPos);
  _reflectorPlane.applyMatrix4(vcam.matrixWorldInverse);

  _clipPlane.set(
    _reflectorPlane.normal.x, _reflectorPlane.normal.y,
    _reflectorPlane.normal.z, _reflectorPlane.constant,
  );

  const projectionMatrix = vcam.projectionMatrix;
  const base = camera.projectionMatrix.elements;      // stock's, pre-narrowing

  _q.x = (Math.sign(_clipPlane.x) + base[8]) / base[0];
  _q.y = (Math.sign(_clipPlane.y) + base[9]) / base[5];
  _q.z = -1.0;
  _q.w = (1.0 + base[10]) / base[14];

  _clipPlane.multiplyScalar(2.0 / _clipPlane.dot(_q));

  projectionMatrix.elements[2] = _clipPlane.x;
  projectionMatrix.elements[6] = _clipPlane.y;
  projectionMatrix.elements[10] = _clipPlane.z + 1.0 - F.clipBias;
  projectionMatrix.elements[14] = _clipPlane.w;

  /* ══ stock three, verbatim: render ══════════════════════════════════════ */
  mirror.visible = false;

  const currentRenderTarget = renderer.getRenderTarget();
  const currentXrEnabled = renderer.xr.enabled;
  const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

  renderer.xr.enabled = false;
  renderer.shadowMap.autoUpdate = false;

  renderer.setRenderTarget(rt);            // picks up rt.viewport / rt.scissor

  renderer.state.buffers.depth.setMask(true);

  if (renderer.autoClear === false) renderer.clear();
  renderer.render(scene, vcam);

  renderer.xr.enabled = currentXrEnabled;
  renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

  renderer.setRenderTarget(currentRenderTarget);

  const viewport = camera.viewport;
  if (viewport !== undefined) renderer.state.viewport(viewport);

  mirror.visible = true;
  mirror.forceUpdate = false;
}

/* ── the quad's box in the VIRTUAL camera's NDC, near-plane clipped ───────
   Returns [x0, y0, x1, y1] clamped to the screen, or null when the quad has no
   pixel on it. Everything is measured against the MAIN camera's projection,
   which is what the virtual camera is about to start from. */
function ndcBox(camera) {
  const { mirror, vcam } = F;

  const g = mirror.geometry;
  if (!g) return null;
  if (!g.boundingBox) g.computeBoundingBox();
  const bb = g.boundingBox;
  if (!bb || !Number.isFinite(bb.min.x) || !Number.isFinite(bb.max.x)) return null;

  _localToView.multiplyMatrices(vcam.matrixWorldInverse, mirror.matrixWorld);

  for (let i = 0; i < 8; i++) {
    _corner.set(
      (i & 1) ? bb.max.x : bb.min.x,
      (i & 2) ? bb.max.y : bb.min.y,
      (i & 4) ? bb.max.z : bb.min.z,
    );
    _pts[i].copy(_corner).applyMatrix4(_localToView);
  }

  /* view space looks down −z, so "in front of the near plane" is z ≤ −near */
  const zLim = -camera.near;
  const e = camera.projectionMatrix.elements;

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;

  const acc = (p) => {
    const w = e[3] * p.x + e[7] * p.y + e[11] * p.z + e[15];
    if (!(w > 1e-6)) return;                      // degenerate — drop it
    const xc = e[0] * p.x + e[4] * p.y + e[8] * p.z + e[12];
    const yc = e[1] * p.x + e[5] * p.y + e[9] * p.z + e[13];
    const nx = xc / w, ny = yc / w;
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    if (nx < x0) x0 = nx;
    if (nx > x1) x1 = nx;
    if (ny < y0) y0 = ny;
    if (ny > y1) y1 = ny;
    n++;
  };

  for (let i = 0; i < 8; i++) if (_pts[i].z <= zLim) acc(_pts[i]);

  /* THE CASE A NAIVE PROJECTION GETS WRONG: a corner behind the camera. The
     projection of the clipped hull is the hull of the projections of ITS
     vertices, and those are the surviving corners plus the points where each
     edge crosses the near plane. Nothing else can extend the box. */
  for (let i = 0; i < EDGES.length; i++) {
    const a = _pts[EDGES[i][0]], b = _pts[EDGES[i][1]];
    const ina = a.z <= zLim, inb = b.z <= zLim;
    if (ina === inb) continue;
    const dz = b.z - a.z;
    if (Math.abs(dz) < 1e-12) continue;
    const t = (zLim - a.z) / dz;
    _cut.copy(a).lerp(b, t);
    _cut.z = zLim;                                // kill the rounding
    acc(_cut);
  }

  if (n === 0) return null;                       // entirely behind the camera

  /* entirely off one side — every fragment of the quad is off screen */
  if (x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) return null;

  return [
    Math.max(-1, x0), Math.max(-1, y0),
    Math.min(1, x1), Math.min(1, y1),
  ];
}

/* ── pick the target sub-rectangle for that box ───────────────────────────
   Writes F.vx/vy/vw/vh and returns true when it is smaller than the whole
   target (i.e. worth narrowing at all). */
function fitViewport(box) {
  const { W, H, padX, padY } = F;
  F.ndc = box;

  let nx0 = Math.floor((box[0] * 0.5 + 0.5) * W) - padX;
  let nx1 = Math.ceil((box[2] * 0.5 + 0.5) * W) + padX;
  let ny0 = Math.floor((box[1] * 0.5 + 0.5) * H) - padY;
  let ny1 = Math.ceil((box[3] * 0.5 + 0.5) * H) + padY;

  nx0 = clampI(nx0, 0, W); nx1 = clampI(nx1, 0, W);
  ny0 = clampI(ny0, 0, H); ny1 = clampI(ny1, 0, H);

  const needW = Math.max(1, nx1 - nx0);
  const needH = Math.max(1, ny1 - ny0);

  const w = sizeClass(F.vw, needW, W);
  const h = sizeClass(F.vh, needH, H);
  if (w !== F.vw || h !== F.vh) F.classChanges++;

  /* the offset moves freely — only the SIZE is quantised, because only the
     size is what three.js keys its transmission target off */
  const cx = (nx0 + nx1) * 0.5, cy = (ny0 + ny1) * 0.5;
  F.vx = clampI(Math.round(cx - w * 0.5), 0, W - w);
  F.vy = clampI(Math.round(cy - h * 0.5), 0, H - h);
  F.vw = w; F.vh = h;

  return w < W || h < H;
}

/* the next rung at or above `need`: grow the moment the current one no longer
   fits, shrink only once a whole step of slack has opened under it (one full
   step of hysteresis, so a quad sitting exactly on a rung cannot flap) */
function sizeClass(cur, need, max) {
  const step = F.step;
  if (cur >= need && cur - need < step) return cur;
  return Math.min(max, Math.max(step, Math.ceil(need / step) * step));
}

/* ── S: map the NDC box the sub-rectangle covers onto the full [-1,1]² ─────
   In place, on a projection matrix. Written over all four entries of rows 0
   and 1 so it is correct for any projection of the form three builds, not just
   the symmetric one a default PerspectiveCamera happens to produce. */
function applySubRect(P, vx, vy, vw, vh, W, H) {
  const hx = vw / W, hy = vh / H;
  const cx = (2 * vx + vw) / W - 1;
  const cy = (2 * vy + vh) / H - 1;
  const e = P.elements;

  e[0] = (e[0] - cx * e[3]) / hx;
  e[4] = (e[4] - cx * e[7]) / hx;
  e[8] = (e[8] - cx * e[11]) / hx;
  e[12] = (e[12] - cx * e[15]) / hx;

  e[1] = (e[1] - cy * e[3]) / hy;
  e[5] = (e[5] - cy * e[7]) / hy;
  e[9] = (e[9] - cy * e[11]) / hy;
  e[13] = (e[13] - cy * e[15]) / hy;
}

function clampI(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

/* ── debug handle ─────────────────────────────────────────────────────────── */
function stats() {
  if (!F) return null;
  return {
    enabled: F.enabled, step: F.step,
    rt: { w: F.W, h: F.H },
    pad: { x: F.padX, y: F.padY },
    viewport: { x: F.vx, y: F.vy, w: F.vw, h: F.vh },
    /* the fraction of the target the mirror pass actually rasterises */
    cover: +((F.vw * F.vh) / (F.W * F.H)).toFixed(4),
    ndc: F.ndc.map(v => +v.toFixed(4)),
    frames: F.frames, narrowed: F.narrowed,
    skipped: F.skipped, classChanges: F.classChanges,
    /* how many times the program cache moved and re-opened the warm-up window,
       and how many frames of that window are left */
    warmups: F.warmups, warmLeft: F.warm, programs: F.lastProgs,
    full: F.full,
  };
}
