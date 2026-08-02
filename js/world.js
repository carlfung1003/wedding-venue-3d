// world.js — the integrator. Owns nothing visual itself: it calls each builder
// module in order, holds the ground-truth height function, owns the day↔night
// switch that every module answers to, and — since 2026-08-01 — owns THE
// ENCLAVE TRANSFORM.
//
// The venue is The Westin Sanya Haitang Bay, 隐逸居 clubhouse enclave.
// WHERE everything sits is site.js; WHAT it looks like is the builders below.
//
// ── the enclave transform ────────────────────────────────────────────────────
// Carl asked for the whole clubhouse to be turned 90° clockwise and pushed into
// the map's south-west corner, with NOTHING outside it moving — not the lagoon,
// the resort villas, the hotel crescent, the road, the beach or the ocean.
//
// Every enclave builder bakes its frame in ("the glass wall faces +Z", "the
// pool's long axis is Z", "the pavilion run marches along Z"), so the enclave is
// built exactly as before and re-parented, as a rigid body, under one group
// carrying SITE.ENCLAVE. Three things do NOT follow a group transform and are
// fixed up by hand here:
//   1. campus.js has a MIXED root — the lounge/lawn/pergola/sign/stair belong to
//      the enclave, but the hotel crescent, the arrival road and the ~50
//      backdrop RESORT_VILLAS share it, and worse, the ten guest villas share
//      InstancedMesh buckets with the backdrop villas and the road furniture.
//      Named enclave groups are re-parented; the instanced buckets are split
//      per-instance and the enclave instances have the transform BAKED into
//      their matrices (see relocateInstances).
//   2. water.js also has a mixed root — the LAGOON is a resort feature and must
//      stay. Water's children are classified by world position, not by index,
//      because that file is edited independently and child order is not stable.
//   3. G.colliders is a flat world-space {x,z,r} list that no group transform
//      touches. Every collider pushed by an enclave builder is rewritten
//      through the same map, or the player is blocked by invisible walls where
//      the buildings used to be and walks through the ones that are there now.
import * as THREE from 'three';
import { CFG } from './config.js';
import { SITE, siteFloorY, ENCLAVE, enclaveToWorld, worldToEnclave, isEnclaveLocal } from './site.js';

import { buildSky, setSkyNight } from './sky.js';
import { buildNature, setNatureNight } from './nature.js';
import { buildWater, setWaterNight, setLanterns } from './water.js';
import { buildCampus, setCampusNight } from './campus.js';
import { buildAtrium, setAtriumNight } from './atrium.js';
import { buildSuite, setSuiteNight } from './suite.js';

/* The single source of ground truth (lassen `getHeight` pattern). Player,
   prop placement and the fly-mode altitude clamp all read this — never nudge
   camera height directly.
   ── since 2026-08-02 it is a real HEIGHT FIELD ──────────────────────────────
   site.js owns the registry of walkable regions (the suite's stair and 2F, the
   atrium's gallery and stair, the lounge plinth, the pool plinth, the exterior
   stair) and resolves them; world.js keeps delegating, and injects the tuning
   because site.js cannot import CFG (config.js imports site.js).
   THE THIRD ARGUMENT IS THE CONTRACT: pass the walker's current feet height and
   you get the surface they are standing on; omit it and you get bare terrain.
   Everything that is not the walker — prop placement, the fly-mode clamp,
   main.js's fly→walk landing — deliberately omits it, so a 3.8 m platform can
   never shove a flyer around or drop a palm tree on a balcony.
   ONE region is not in site.js's registry — the cabana boardwalk, patched on
   below because this change did not own that file. Read that comment before
   adding a second one here; the registry is still where these belong. */
export function floorY(x, z, fromY) {
  const y = siteFloorY(x, z, fromY, CFG.STEP_UP, CFG.HEAD_CLEAR);
  if (typeof fromY !== 'number') return y;   // no feet, no platforms (see above)
  return boardwalkY(x, z, fromY, y);
}

/* ── the cabana boardwalk, patched onto the height field ────────────────────
   BELONGS IN site.js's WALK_REGIONS — this is a lodger, not a design. The next
   time that file is open, add

     rect('cabana-boardwalk', 11.9, -2.4, 14.4, 21.4, 0.30)

   to the registry (the numbers below are already in its enclave-local frame,
   which is what rect() wants) and delete everything down to the end of
   boardwalkY. It lives here only because this change did not own site.js.

   What it fixes: water.js's buildPavilions lays a timber deck with its top at
   y 0.30 behind the cabana run — local x ±(HALF + 1.4), z −0.1…2.4 — inside a
   group rotated +π/2 and parked at (CABANAS.x, (z0 + z1) / 2), so local (x,z)
   maps to enclave (CB.x + z, cz − x). No region covered it, so floorY answered
   0 and a walker crossing the planks sank to the shins in them. The two stone
   steps off the suite end are below 0.30 and inside STEP_UP of the deck, so
   they need no entry of their own — the lip is climbable from anywhere. */
const _CB = SITE.CABANAS;
const _BW_CZ = (_CB.z0 + _CB.z1) / 2;
const _BW_HALF = (_CB.z1 - _CB.z0) / 2 + 1.4;
const BOARDWALK = {
  y: 0.30,
  x0: _CB.x - 0.1, x1: _CB.x + 2.4,          // enclave x 11.9 … 14.4
  z0: _BW_CZ - _BW_HALF, z1: _BW_CZ + _BW_HALF,   // enclave z −2.4 … 21.4
};

function boardwalkY(x, z, fromY, ground) {
  const l = worldToEnclave(x, z);
  const B = BOARDWALK;
  if (l.x < B.x0 || l.x > B.x1 || l.z < B.z0 || l.z > B.z1) return ground;
  /* siteFloorY's own resolution rule: the highest surface still within a
     step-up of the feet wins. Open sky above the planks, so no headroom gate. */
  return (B.y > ground && B.y <= fromY + CFG.STEP_UP) ? B.y : ground;
}

/* ── build phases ───────────────────────────────────────────────────────────
   buildWorld is async so that the loading card can PAINT. Each builder is one
   phase; between phases the main thread goes back to the browser (yieldFrame)
   and the caller is told how far along we are. The weights below are measured,
   rounded costs — they exist only so the bar moves at a roughly even rate, and
   G.buildProfile records the real numbers every load if they ever need
   re-tuning (`__game.G.buildProfile` in the console). The ORDER is load-bearing
   (nature last — see the comment in buildWorld); the weights are not. */
const PHASES = [
  /* label                              weight   measured, ms (1× / 6× CPU) */
  ['Hanging the sky over Haitang Bay', 1],   //     3 /  15
  ['Filling the pool', 9],                   //    48 / 284
  ['Raising the villas', 4],                 //    16 /  90
  ['Setting the atrium stone', 9],           //    50 / 285
  ['Opening up the suite', 2],               //     6 /  35
  ['Turning the clubhouse to the sea', 1],   //     3 /  16
  ['Planting the palm grove', 12],           //    68 / 357
  ['Setting the hour', 1],                   //     0 /   2
];
/* NB 'Lighting the lanterns' is main.js's label for the night SHADER WARM,
   which runs after this and is the expensive half of the lighting work. This
   phase is only the initial applyNight fan-out — property writes, no compile —
   hence the two different names for what look like the same step. */

/* Hand the main thread back long enough for one frame to reach the screen.
   rAF alone is not enough: its callback runs just BEFORE the paint, so
   resolving there would let the next builder start and the frame would never
   be composited. The setTimeout inside it lands after the paint, which is the
   whole trick. (scheduler.yield() would be the modern spelling, but Safari
   does not have it and half the wedding party is on an iPhone.)
   The outer timer is a safety floor, not a race: a backgrounded tab never
   fires rAF at all, and the build still has to finish. */
export function yieldFrame() {
  return new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; res(); };
    requestAnimationFrame(() => setTimeout(fin, 0));
    setTimeout(fin, 250);
  });
}

function phaseRunner(G, onPhase) {
  const total = PHASES.reduce((s, p) => s + p[1], 0);
  let i = 0, done = 0, t0 = 0;
  G.buildProfile = [];
  const close = () => {
    if (i === 0) return;
    G.buildProfile.push([PHASES[i - 1][0], Math.round(performance.now() - t0)]);
    done += PHASES[i - 1][1];
  };
  return {
    /* report where we are + what is about to happen, let it paint, then work */
    async next() {
      close();
      onPhase?.(done / total, PHASES[i][0]);
      await yieldFrame();
      t0 = performance.now();
      i++;
    },
    end() { close(); onPhase?.(1, null); },
  };
}

/* campus.js root children that are enclave, by name. The rest of that root —
   'hotel', 'road', the unnamed conference block, and the shared
   'campus:*' InstancedMeshes — is handled separately below. */
const CAMPUS_ENCLAVE_GROUPS = new Set(['lounge', 'lawn', 'pergola', 'sign', 'extstair']);

const _box = new THREE.Box3();
const _ctr = new THREE.Vector3();
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();

/* ASYNC since 2026-08-02. `onPhase(fraction, label)` is called once per builder
   with the work completed so far — main.js drives the loading card off it. The
   awaits are not decoration: without them the browser never gets a rendering
   opportunity between here and the first frame, and the tab stays black for the
   whole build. main.js must await this before initPlayer/initMoments. */
export async function buildWorld(G, onPhase) {
  const P = phaseRunner(G, onPhase);

  G.tickers = G.tickers || [];
  G.colliders = G.colliders || [];
  G.night = !!CFG.START_AT_NIGHT;
  G.groups = {};

  /* The rigid body. rotation.y then position = exactly enclaveToWorld(). */
  const enclave = new THREE.Group();
  enclave.name = 'enclave';
  enclave.rotation.y = ENCLAVE.rotY;
  enclave.position.set(ENCLAVE.ox, 0, ENCLAVE.oz);
  enclave.updateMatrix();
  G.scene.add(enclave);
  G.groups.enclave = enclave;
  /* published so anything built later (moments.js) can join the enclave
     explicitly instead of relying on the adoption pass at the bottom */
  G.enclave = {
    group: enclave,
    rotY: ENCLAVE.rotY,
    matrix: enclave.matrix.clone(),
    toWorld: enclaveToWorld,
  };

  await P.next();
  G.groups.sky = buildSky(G);

  /* ── the enclave builders ── */
  const col0 = G.colliders.length;
  await P.next();
  G.groups.water = buildWater(G);
  await P.next();
  G.groups.campus = buildCampus(G);
  await P.next();
  G.groups.atrium = buildAtrium(G);
  await P.next();
  G.groups.suite = buildSuite(G);
  const col1 = G.colliders.length;

  await P.next();
  /* atrium + suite are wholly enclave — take the roots whole */
  enclave.add(G.groups.atrium);
  enclave.add(G.groups.suite);
  adoptWater(enclave, G.groups.water);
  adoptCampus(enclave, G.groups.campus, G.enclave.matrix);

  /* colliders are world-space and follow nothing — rewrite the slice the
     enclave builders just pushed, minus the backdrop content that shares it
     (the lagoon's coping, the resort villas, the hotel's arc ring) */
  for (let i = col0; i < col1; i++) {
    const c = G.colliders[i];
    if (!isEnclaveLocal(c.x, c.z)) continue;
    const w = enclaveToWorld(c.x, c.z);
    c.x = w.x; c.z = w.z;
  }

  /* nature runs LAST, deliberately. buildNature snapshots G.colliders.length on
     entry and keeps every palm clear of everything already standing — running
     it after the enclave means the palm population avoids the clubhouse WHERE
     IT NOW IS. Ground, ocean, sky and the palms themselves are global and must
     NOT be rotated.
     Its OTHER keep-out — nature's own exclusionZones() — reads SITE.SUITE /
     POOL / VILLAS / LAWN straight, i.e. in enclave-local coordinates, so it
     still guards the ground the enclave has left. The wall colliders alone are
     not enough (a 16 × 13 m great room is wall-lined but hollow, and the first
     run planted a palm through the middle of it), so the enclave's FOOTPRINTS
     go in as temporary keep-out circles for the duration of the nature build
     and come straight back out. */
  await P.next();
  const keepOut = enclaveKeepOut();
  const koStart = G.colliders.length;
  for (const k of keepOut) G.colliders.push(k);
  G.groups.nature = buildNature(G);
  G.colliders.splice(koStart, keepOut.length);
  /* the understory does NOT consult colliders — hedges, shrub clumps,
     bougainvillea and ground cover are placed against exclusionZones() alone,
     so the same stale rects let a shrub mass grow through the middle of the
     great room. They are static instances, so collapse the ones standing
     inside the relocated footprints. */
  cullUnderstoryInsideEnclave(G.groups.nature, keepOut);

  /* moments.js dresses the enclave and is initialised after buildWorld; these
     two counts are what the adoption pass measures against. */
  G.staticColliderCount = G.colliders.length;
  _baseline = new Set(G.scene.children);
  _adoptFor = G;

  await P.next();
  applyNight(G, G.night, true);
  P.end();
}

/* ── the enclave's footprints, as world-space keep-out circles ──────────────
   A transformed copy of what nature.js's exclusionZones() would have produced
   if it knew about the transform. Circles, because G.colliders only speaks
   {x,z,r}: a 5 m grid with r = 3.6 overlaps in both axes (half-diagonal of a
   5 × 5 cell is 3.54), so a rect is covered with no gaps a palm can slip into.
   Lives only for the duration of buildNature — see buildWorld. */
function keepOutRect(out, cx, cz, w, d, step = 5, r = 3.6) {
  const nx = Math.max(1, Math.ceil(w / step)), nz = Math.max(1, Math.ceil(d / step));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const p = enclaveToWorld(
        cx - w / 2 + (i + .5) * (w / nx),
        cz - d / 2 + (j + .5) * (d / nz),
      );
      out.push({ x: p.x, z: p.z, r });
    }
  }
}

function keepOutDisc(out, cx, cz, rad, step = 5, r = 3.6) {
  const n = Math.max(1, Math.ceil((rad * 2) / step));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const lx = cx - rad + (i + .5) * (rad * 2 / n);
      const lz = cz - rad + (j + .5) * (rad * 2 / n);
      if ((lx - cx) ** 2 + (lz - cz) ** 2 > rad * rad) continue;
      const p = enclaveToWorld(lx, lz);
      out.push({ x: p.x, z: p.z, r });
    }
  }
}

function enclaveKeepOut() {
  const S = SITE, V = S.VILLA, out = [];
  const rect = (cx, cz, w, d) => keepOutRect(out, cx, cz, w, d);

  rect(S.SUITE.cx, S.SUITE.cz,
    S.SUITE.w + S.SUITE.roofOverhang * 2, S.SUITE.d + S.SUITE.roofOverhang * 2);
  rect(S.SUITE.pantry.cx, S.SUITE.pantry.cz, S.SUITE.pantry.w, S.SUITE.pantry.d);
  rect(S.SUITE.spa.cx, S.SUITE.spa.cz, S.SUITE.spa.w, S.SUITE.spa.d);
  rect(S.DECK.cx, (S.DECK.z0 + S.DECK.z1) * .5, S.DECK.w, S.DECK.z1 - S.DECK.z0);
  rect(S.DECK.cx, (S.TURF.z0 + S.TURF.z1) * .5, S.DECK.w, S.TURF.z1 - S.TURF.z0);
  rect(S.POOL.cx, S.POOL.cz, S.POOL.w + 4, S.POOL.d + 4);
  rect(S.CABANAS.x, (S.CABANAS.z0 + S.CABANAS.z1) * .5, 7, S.CABANAS.z1 - S.CABANAS.z0 + 2);
  rect(S.LOUNGERS.x, (S.LOUNGERS.z0 + S.LOUNGERS.z1) * .5, 7, S.LOUNGERS.z1 - S.LOUNGERS.z0 + 2);
  rect(S.PERGOLA.cx, S.PERGOLA.cz, S.PERGOLA.w + 2, S.PERGOLA.d + 2);
  rect((S.PLAZA.x0 + S.PLAZA.x1) * .5, (S.PLAZA.z0 + S.PLAZA.z1) * .5,
    S.PLAZA.x1 - S.PLAZA.x0, S.PLAZA.z1 - S.PLAZA.z0);
  /* the atrium was never in nature's list at all — it is a courtyard the palms
     had no business standing in even before the move */
  rect(S.ATRIUM.cx, S.ATRIUM.cz, S.ATRIUM.w + 2, S.ATRIUM.d + 2);
  rect(S.LOUNGE.cx, S.LOUNGE.cz, S.LOUNGE.w + 3, S.LOUNGE.d + 3);
  rect(S.LOUNGE_POOL.cx, S.LOUNGE_POOL.cz, S.LOUNGE_POOL.w + 4, S.LOUNGE_POOL.d + 4);

  const vw = Math.max(V.w, V.w2, V.courtW) + 7;
  const vd = Math.max(V.d, V.d2, V.courtD) + 8;
  for (const [vx, vz] of S.VILLAS) rect(vx, vz, vw, vd);

  keepOutDisc(out, S.LAWN.cx, S.LAWN.cz, S.LAWN.hedgeR + 1.5);
  return out;
}

/* Collapse nature's static understory instances that landed inside the
   relocated enclave. The palm InstancedMeshes are the ones nature marks
   DynamicDrawUsage (their matrices are rewritten every frame by the sway
   ticker) — they are skipped, both because they are global population and
   because anything written here would be overwritten on the next frame. */
const _zero = new THREE.Vector3(0, 0, 0);

function cullUnderstoryInsideEnclave(root, keepOut) {
  if (!root) return 0;
  let culled = 0;
  for (const child of root.children) {
    if (!child.isInstancedMesh) continue;
    if (child.instanceMatrix.usage === THREE.DynamicDrawUsage) continue;   // palms
    let touched = 0;
    for (let i = 0; i < child.count; i++) {
      child.getMatrixAt(i, _mat);
      _pos.setFromMatrixPosition(_mat);
      let hit = false;
      for (let k = 0; k < keepOut.length; k++) {
        const c = keepOut[k], dx = _pos.x - c.x, dz = _pos.z - c.z;
        if (dx * dx + dz * dz < c.r * c.r) { hit = true; break; }
      }
      if (!hit) continue;
      _mat.scale(_zero);            // keeps the translation, collapses the shape
      child.setMatrixAt(i, _mat);
      touched++;
    }
    if (touched) { child.instanceMatrix.needsUpdate = true; culled += touched; }
  }
  return culled;
}

/* ── water.js: everything except the LAGOON ─────────────────────────────────
   Classified by world position, never by child index — water.js is long, is
   edited independently, and its ROOT.add() order is not a contract. The lagoon
   is the only water body east of x = 84 (SITE.LAGOON spans x 92…152); the hero
   pool, deck, turf, cabanas, loungers, lanterns, lounge pool and the ten villa
   plunge pools all sit west of it. */
function adoptWater(enclave, root) {
  if (!root) return;
  for (const child of root.children.slice()) {
    _box.setFromObject(child);
    if (_box.isEmpty()) continue;
    _box.getCenter(_ctr);
    if (_ctr.x >= 84) continue;            // the lagoon stays exactly where it is
    enclave.add(child);
  }
}

/* ── campus.js: the mixed root ──────────────────────────────────────────────
   Named groups split cleanly. The InstancedMeshes do not: buildVillas() and
   buildResortVillas() push into the SAME buckets ('stucco', 'roofI', 'glass',
   'deckI', 'poolI', 'umbI'), and buildRoad() shares 'glowI' / 'darkI' /
   'hedgeI' / 'poleI' with the lounge, the villas and the ext stair. One
   InstancedMesh cannot be half-parented, so the enclave instances are baked
   instead: premultiplying the enclave matrix onto an instance matrix is exactly
   what parenting would have done to it. */
function adoptCampus(enclave, root, encM) {
  if (!root) return;
  for (const child of root.children.slice()) {
    if (CAMPUS_ENCLAVE_GROUPS.has(child.name)) { enclave.add(child); continue; }
    if (child.isInstancedMesh) relocateInstances(child, encM);
  }
}

function relocateInstances(mesh, encM) {
  let touched = 0;
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, _mat);
    _pos.setFromMatrixPosition(_mat);
    if (!isEnclaveLocal(_pos.x, _pos.z)) continue;
    _mat.premultiply(encM);
    mesh.setMatrixAt(i, _mat);
    touched++;
  }
  if (touched) {
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  return touched;
}

/* ── late content: the moment dressing ──────────────────────────────────────
   moments.js builds its five prop groups from SITE.* — i.e. in ENCLAVE-LOCAL
   coordinates — and adds them straight to the scene from main.js, after
   buildWorld has returned. It also registers enclave-local {x,z} interactables
   and per-moment collider lists. Until that module joins the enclave
   explicitly (it is owned elsewhere right now), world.js adopts whatever
   appeared on the scene after buildWorld on the first frame.

   Idempotent and opt-out-able on purpose, so this can be deleted the moment
   moments.js does it properly:
     · a group already parented under the enclave is never re-adopted;
     · anything flagged `obj.userData.worldSpace = true` is left alone;
     · colliders/interactables carry a `__world` flag once mapped. */
let _baseline = null;
let _adoptFor = null;

function adoptLateContent(G) {
  const enclave = G.groups && G.groups.enclave;
  if (!enclave) return;
  for (const child of G.scene.children.slice()) {
    if (child === enclave) continue;
    if (_baseline && _baseline.has(child)) continue;
    /* GROUPS ONLY. player.js does `G.scene.add(G.camera)` in initPlayer, which
       also runs after buildWorld — parenting the camera under the enclave would
       turn every camera.position.set() into a local one and wreck the view. */
    if (!child.isGroup || child.isCamera || child.isLight) continue;
    if (child.userData && child.userData.worldSpace) continue;
    enclave.add(child);
  }
  _baseline = null;
}

/* The live moment's colliders and the interactable registry are plain
   world-space {x,z} records that no group transform reaches. setMoment rebuilds
   G.colliders as `statics + cols[moment]` on every switch, and those tail
   entries are the SAME objects each time — so mapping one in place fixes it for
   good. Guarded by __world, and cheap: the tail is a couple of dozen records. */
function worldifyLateRecords(G) {
  const cols = G.colliders;
  for (let i = G.staticColliderCount || 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c || c.__world) continue;
    const w = enclaveToWorld(c.x, c.z);
    c.x = w.x; c.z = w.z; c.__world = true;
  }
  for (const it of G.interactables || []) {
    if (it.__world) continue;
    const w = enclaveToWorld(it.x, it.z);
    it.x = w.x; it.z = w.z; it.__world = true;
  }
}

/* The N key, and each moment's `night` flag, flip the whole campus between
   golden hour and the lantern-lit night. Every module owns its own response;
   world.js just fans the call out. */
function applyNight(G, on, quiet) {
  G.night = on;
  setSkyNight(on);
  setNatureNight(on);
  setWaterNight(on);
  setCampusNight(on);
  setAtriumNight(on);
  setSuiteNight(on);
  setLanterns(on);

  const L = CFG.LIGHT;
  G.scene.environmentIntensity = on ? L.ENV_NIGHT : L.ENV_DAY;
  G.renderer.toneMappingExposure = on ? L.EXPOSURE_NIGHT : L.EXPOSURE_DAY;

  if (!quiet && G.ui) {
    G.ui.toast(on ? '🌙 Night over Haitang Bay.' : '☀️ Golden hour.', 2.2);
  }
}

export function setNight(G, on, opts = {}) {
  if (G.night === on) return;
  applyNight(G, on, opts.quiet);
}

export function toggleNight(G) { setNight(G, !G.night); }

/* Advance every registered animation — water ripples, frond sway, drifting
   lanterns, window flicker. Builders register via (G.tickers ||= []).push(fn). */
export function updateWorld(G, dt, t) {
  if (_adoptFor === G) { _adoptFor = null; adoptLateContent(G); }
  worldifyLateRecords(G);
  for (const fn of G.tickers) fn(dt, t);
}

export { SITE };
