// mirrorlayers.js — keep the far resort out of the hero pool's reflection.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHAT THIS DOES                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// THREE.Reflector renders the whole scene a SECOND time, from a camera mirrored
// through the pool's surface. This pass gives every renderable more than
// `RADIUS` metres from that pool its own layer, and enables that layer on the
// MAIN camera only — so the far resort keeps appearing in the direct view and
// stops being submitted to the mirror pass.
//
// It is a ONE-SHOT assignment. Distance from the pool is static (the pool never
// moves and neither does the crescent), so unlike js/detailcull.js — which must
// re-evaluate every frame because it measures against a camera that moves —
// this costs a single traverse at boot and then one bitwise OR per frame.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ ⚠ READ THIS BEFORE YOU EXPECT A BIG NUMBER — measured 2026-08-06,        ║
// ║   headless Metal ANGLE, 1600×900, uncapped (tickers + render + gl.finish) ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// The mirror IS the most expensive object on the campus. Hiding it outright is
// worth +36 fps at the pool deck at night, +139 at the Welcome Brunch. But
// almost none of that is reachable by a distance cull, and the reason is the one
// thing the plan did not account for:
//
//     THE MIRROR CAMERA'S OWN FRUSTUM ALREADY CULLS THE FAR CAMPUS.
//
// The virtual camera is the main camera reflected through a horizontal plane. At
// every viewpoint where the reflection is actually legible you are standing next
// to the pool, so that camera is also next to the pool, and its frustum is a
// narrow cone that never contained the crescent in the first place. Measured, as
// the mirror pass's OWN draw calls (total render minus the same frame with the
// Reflector hidden — exact, not sampled):
//
//   radius (m)      off    250    180    140    110     90     70     55     25
//   ── pool deck, night — the signature shot, and the campus's SLOWEST view ──
//   mirror calls   2486   2327   2167   2144   2144   2144   1942   1850    686
//   mirror tris    785k   712k   641k   633k   633k   633k   631k   630k   571k
//   fps            48.1   50.0   51.8   52.9    —      —     54.1   54.6   65.4
//   ── Welcome Brunch — 285 m up, so the mirror frustum is huge ──
//   mirror calls    899    894    822    804    803    795    718    638    309
//   fps            83.3   84.0   87.7   89.3   89.3   90.1   94.3   99.0  128.2
//   ── the great room at night (the Prewedding spawn) ──
//   mirror calls    920    920    920    920    920    920    920    918    890
//   fps            96.2   96.2   97.1   97.1   97.1   96.2   96.2   97.1   99.0
//
// Read the great-room row: from `off` all the way down to 55 m the mirror draws
// THE IDENTICAL 920 CALLS. There is nothing there to cull. Ceremony, Cocktail
// and the fly-overs are stronger still — the Reflector mesh itself is outside
// the main frustum, so three.js never calls its onBeforeRender and the mirror
// costs exactly ZERO.
//
// So this module is a small, free win at two viewpoints and provably nothing at
// the rest. It is worth having because it costs nothing per frame, but the lever
// that would actually halve the mirror is NOT this one — see THE REAL LEVER.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ WHY 120 m — it is the middle of a PLATEAU, not a knee                    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// Between 90 m and 140 m the mirror's content does not change at all: 2,144
// calls / 632,962 triangles at the pool deck for every radius in that band, and
// 795…804 at the brunch. Only 12 renderables on the whole campus have their
// nearest approach in 90…140 m. So the choice inside the band is arbitrary and
// the right move is to sit in the MIDDLE of it, with margin on both sides:
//
//   · below 90 m the next thing to go is the beachfront lawn's sea-edge band
//     and the far palm belt (70…90 m), which ARE in the reflection when you look
//     west across the water from the deck. That is the first visible loss and
//     the reason the radius does not go lower for the extra 1.5 fps.
//   · above 140 m the curve gives the win back (250 m recovers only 1.9 of the
//     4.8 fps at the deck) because the lagoon complex and the resort villa
//     fields at 140…250 m come back into the mirror.
//
// 120 m keeps EVERYTHING inside the 隐逸居 enclave, the whole grass ground, the
// palm grove, the beach and the ocean. What it drops is the Westin crescent and
// its rooftop (285 m), the ~29 backdrop villas, the river/lagoon complex east of
// the enclave, the swim-up bar and the arrival lane — the grazing-angle pixels
// the plan identified.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE FIVE THINGS THAT WOULD BREAK THIS SILENTLY                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// 1 · THE SKY IS EXEMPT, OUTRIGHT. A mirror with no sky is a black hole, and the
//     dome is 240 m of radius riding the camera — every distance test would
//     answer "far" for parts of it. `SKIP_ROOTS` holds it out of the pass the
//     same way js/detailcull.js does, and for a stronger reason.
//
// 2 · AN InstancedMesh's GEOMETRY BOUNDING SPHERE IS THE WRONG SPHERE. It is the
//     unit prototype sitting at the origin; the sphere that covers the instances
//     is the MESH's own `boundingSphere`. Get this wrong and every instanced
//     bucket on the campus measures as one small object at the enclave origin —
//     which is exactly what happened on the first pass here, and it "found"
//     +45 fps by deleting all 825 palms, all the hedges and the whole rooftop
//     from the reflection. three's own Frustum.intersectsObject prefers
//     `object.boundingSphere` when it exists; `sphereOf()` below matches it.
//     The consequence, and it is the right one: a bucket whose instances are
//     scattered over the campus has a huge radius, so its nearest approach is
//     negative and it is always KEPT.
//
// 3 · NEVER TOUCH A LIGHT. Not because layers hide one — they do not; three's
//     projectObject recurses into children whatever the parent's layer says, and
//     a Light is not a Mesh so it is never a candidate here — but because the
//     campus's whole performance story (js/lightbudget.js) rests on the visible
//     point-light count never changing. Verified after this pass: 40 logical,
//     12 visible, 114 programs, at every moment and both lighting states.
//
// 4 · WORLD.JS RE-PARENTS THE LATE CONTENT ON THE FIRST FRAME, so the assignment
//     runs on our first TICK and not in init — measure in init and every moment
//     prop is 90° and ~80 m from where it really stands. Same trap, same fix, as
//     detailcull.js's trap 4.
//
// 5 · IF ANYTHING EVER CALLS `camera.layers.set(0)` THE FAR CAMPUS DISAPPEARS
//     FROM THE DIRECT VIEW. Nothing does today. The ticker re-asserts
//     `enable(FAR_LAYER)` every frame anyway — one bitwise OR, genuinely free,
//     and it turns a catastrophic silent failure into a non-event.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ THE REAL LEVER, for whoever picks this up next                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
// three.js renders the mirror through the FULL reflected view frustum, not
// through the mirror quad's screen-space extent. At the Welcome Brunch the pool
// is a ~25-pixel sliver 285 m away and the mirror still submits 899 draw calls
// and 390k triangles at 1024×512. Narrowing the virtual camera's projection to
// the reflector's own on-screen bounds — and rebuilding `textureMatrix` from the
// same matrix, which is the only thing that has to stay consistent — would cut
// that to near zero and would RAISE the effective resolution of the reflection
// at the same time. It means forking Reflector.onBeforeRender rather than
// wrapping it, which is why it was not done here.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ HOW TO TURN IT OFF                                                       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//   · from the URL:      `?ml=off` skips it entirely (cold, for A/B);
//                        `?ml=<metres>` boots another radius, e.g. `?ml=60`.
//   · from the console:  `__game.G.mirrorLayers.disable()` puts every object
//                        back on layer 0; `.enable()`, `.setRadius(m)`,
//                        `.stats()`, `.probe()` are the instruments.
//   · permanently:       delete the initMirrorLayers call in water.js.

import * as THREE from 'three';

/* The layer the far campus is moved to. Layer 0 is everything else, and the
   main camera is given both. The mirror's virtual camera is a bare
   `new PerspectiveCamera()` inside Reflector's closure — three never writes its
   `layers`, so it keeps the default layer-0-only mask and needs no cooperation
   from us. That is the whole mechanism. */
const FAR_LAYER = 1;

/* metres, measured in XZ from the mirror's world centre to each object's
   NEAREST APPROACH (sphere centre minus sphere radius). See the plateau note. */
const RADIUS = 120;

/* `sky` rides the camera and must always be in the reflection — see trap 1. */
const SKIP_ROOTS = new Set(['sky']);

const _c = new THREE.Vector3();

let M = null;   // the one live pass

/**
 * Move everything beyond `RADIUS` of the hero pool onto a layer the mirror's
 * camera cannot see.
 *
 * CALL IT: from buildWater, with the Reflector mesh. Nothing is assigned here —
 * the sweep happens on the first TICK, after world.js's adoption pass (trap 4).
 *
 * @param {object} G        the shared context (scene, camera, tickers)
 * @param {THREE.Mesh} mirror  the ONE Reflector
 * @param {object} [opts]   {radius}
 * @returns {object|null}   the debug handle, also published as G.mirrorLayers
 */
export function initMirrorLayers(G, mirror, opts = {}) {
  if (!G || !mirror) return null;

  let q = null;
  try { q = new URLSearchParams(location.search).get('ml'); } catch { q = null; }
  if (q === 'off') return null;

  let radius = opts.radius ?? RADIUS;
  if (q) {
    const n = Number(q);
    if (Number.isFinite(n) && n > 0) radius = n;
  }

  M = {
    G, mirror, radius,
    enabled: true,
    ready: false,
    recs: [],        // {o, d} for every candidate, d = nearest approach in XZ
    far: 0,          // how many are on FAR_LAYER right now
    px: 0, pz: 0,    // the mirror's world position
  };

  (G.tickers ||= []).push(tick);

  G.mirrorLayers = {
    get enabled() { return M.enabled; },
    get radius() { return M.radius; },
    stats,
    probe,
    disable() { setEnabled(false); },
    enable() { setEnabled(true); },
    setRadius(m) { M.radius = m; if (M.ready) assign(); },
    update: tick,
  };
  return G.mirrorLayers;
}

/* three's own preference, and getting it wrong is trap 2: an InstancedMesh (and
   a BatchedMesh) carries the sphere that covers its INSTANCES on the object;
   everything else keeps it on the geometry. */
function sphereOf(o) {
  if (o.boundingSphere !== undefined) {
    if (o.boundingSphere === null) {
      try { o.computeBoundingSphere(); } catch { /* leave it null → fall through */ }
    }
    if (o.boundingSphere) return o.boundingSphere;
  }
  const g = o.geometry;
  if (!g) return null;
  if (!g.boundingSphere) {
    try { g.computeBoundingSphere(); } catch { return null; }
  }
  return g.boundingSphere;
}

/* ── the one-time candidate sweep, on the first tick ─────────────────────── */
function collect() {
  const { G, mirror } = M;
  M.ready = true;
  G.scene.updateMatrixWorld(true);

  mirror.updateWorldMatrix(true, false);
  _c.setFromMatrixPosition(mirror.matrixWorld);
  M.px = _c.x; M.pz = _c.z;

  const skip = new Set();
  for (const child of G.scene.children) {
    if (SKIP_ROOTS.has(child.name)) child.traverse(o => skip.add(o));
  }

  G.scene.traverse(o => {
    if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine || o.isSprite)) return;
    if (o === mirror || o.isReflector || o.type === 'Reflector') return;
    if (skip.has(o)) return;
    /* the escape hatch a builder can use to pin something into the reflection
       whatever the arithmetic says */
    if (o.userData && o.userData.mirrorKeep) return;

    const bs = sphereOf(o);
    if (!bs || !(bs.radius > 0) || !Number.isFinite(bs.radius)) return;

    const m = o.matrixWorld.elements;
    const wx = m[0] * bs.center.x + m[4] * bs.center.y + m[8] * bs.center.z + m[12];
    const wz = m[2] * bs.center.x + m[6] * bs.center.y + m[10] * bs.center.z + m[14];
    const sc = Math.sqrt(Math.max(
      m[0] * m[0] + m[1] * m[1] + m[2] * m[2],
      m[4] * m[4] + m[5] * m[5] + m[6] * m[6],
      m[8] * m[8] + m[9] * m[9] + m[10] * m[10]));

    /* NEAREST APPROACH, not centre distance: a 200 m ground plane whose centre
       is 300 m away still reaches the pool, and dropping it would put a hole in
       the reflection. Negative for anything that overlaps the pool at all. */
    const d = Math.hypot(wx - M.px, wz - M.pz) - bs.radius * sc;
    M.recs.push({ o, d });
  });

  assign();
}

function assign() {
  let far = 0;
  for (const r of M.recs) {
    if (M.enabled && r.d > M.radius) { r.o.layers.set(FAR_LAYER); far++; }
    else r.o.layers.set(0);
  }
  M.far = far;
  M.G.camera.layers.enable(FAR_LAYER);
}

/* Per frame: nothing but trap 5's insurance. One bitwise OR. */
function tick() {
  if (!M) return;
  if (!M.ready) { collect(); return; }
  if (M.enabled) M.G.camera.layers.enable(FAR_LAYER);
}

/* ── debug handle ─────────────────────────────────────────────────────────── */

function setEnabled(on) {
  if (!M || M.enabled === on) return;
  M.enabled = on;
  if (!M.ready) return;
  assign();
  if (!on) M.G.camera.layers.set(0);
}

function stats() {
  if (!M) return null;
  return {
    enabled: M.enabled, ready: M.ready, radius: M.radius,
    candidates: M.recs.length, far: M.far,
    mirrorAt: { x: +M.px.toFixed(2), z: +M.pz.toFixed(2) },
    cameraMask: M.G.camera.layers.mask,
  };
}

/* One row per candidate, nearest first — the instrument the radius curve in the
   banner was measured with. Heavy; call it from a test, not a ticker. */
function probe(limit = 0) {
  if (!M || !M.ready) return [];
  const out = M.recs.map(r => ({
    tag: r.o.name || r.o.material?.name || r.o.geometry?.type || 'mesh',
    d: +r.d.toFixed(1),
    instances: r.o.isInstancedMesh ? r.o.count : 0,
    far: r.o.layers.mask === (1 << FAR_LAYER),
  })).sort((a, b) => a.d - b.d);
  return limit ? out.slice(0, limit) : out;
}
