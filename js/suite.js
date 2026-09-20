// suite.js — THE HERO BUILDING: the Westin Sanya presidential suite.
//
// A two-storey glass villa modelled from Carl's 94 s walkthrough
// (reference/suite-interior-brief.md + reference/video/frames/*.jpg).
// Every footprint number comes from SITE.SUITE — nothing is invented here.
//
// Orientation (site convention): +X east, +Z south, y = 0 ground datum.
// The folding glass wall faces SOUTH (+Z) onto the deck and pool.
//
// Contract:
//   buildSuite(G)  -> THREE.Group (already added to G.scene)
//   setSuiteNight(on)
// G gives us: G.scene, G.camera, G.colliders (push {x,z,r}), G.tickers.
//
// All textures/materials are LOCAL to this module (only mulberry32 is shared).

import * as THREE from 'three';
import { SITE, MOMENT_PLACES, worldToEnclave, ARRIVAL_LOBBY_Y } from './site.js';
import { mulberry32 } from './materials.js';
import * as models from './models.js';

/* ══════════════════════════════════════════════════════════════════════
   1 · DIMENSIONS — everything derived from SITE.SUITE
   ══════════════════════════════════════════════════════════════════════ */
const S = SITE.SUITE;

/* ══════════════════════════════════════════════════════════════════════
   1a · THE MIRROR — read this before you touch a single X in this file
   ══════════════════════════════════════════════════════════════════════
   reference/suite-interior-brief.md §4 — the plan this whole file was built
   from — is REVERSED left-for-right. It was distilled from a handheld phone
   walkthrough, and handedness read off a moving camera flips easily. Carl has
   been to the suite and independently named four things on the wrong side
   (exterior stair, pantry shelf, interior staircase, spa) — which is every
   element the plan puts off the centre line. See the long note in
   site.js SITE.SUITE for the frame evidence (f048 / f050).

   The fix is a reflection of the WHOLE interior about the building's centre
   line, x = SITE.SUITE.cx = 0. This file keeps authoring in the old (brief)
   frame — 400-odd interior X coordinates, most of them offsets from a wall
   constant, and hand-negating them is exactly how a room ends up HALF
   mirrored, which is the bug we are fixing. Instead every primitive reflects
   its X on the way out through mx():

     · slab / box / cyl / col  — the four leaves everything else is built on,
       so wallRun, coffer, downlights, glazedBay, fascia, doubleDoor, chair,
       tableLamp, curtainPanel, levelRail and every collider follow for free;
     · the handful of direct .position.set() calls (stair soffit, chandelier,
       rakeRail, the spa's brass inlay, the folding leaves, buildLighting);
     · every rotation.y and rotation.z, which a reflection negates
       (M·R_y(θ) = R_y(−θ)·M for M = diag(−1,1,1)); rotation.x is unaffected,
       and .translateZ() is too — only .translateX() flips sign.

   Boxes and cylinders are symmetric about their own centres, so reflecting
   the CENTRE of an axis-aligned primitive is a true reflection of it. Nothing
   is scaled negative: winding order, normals and CanvasTexture text are all
   untouched.

   SITE.SUITE carries the CORRECTED coordinates. The anchors below read them
   back through mx() so the two files can never drift: change a side in
   site.js and this file follows. checkMirror() at the bottom re-derives the
   built positions and warns in the console if they ever disagree.           */
const mx = x => -x;

/* SITE anchors, pulled back into this file's (mirrored) authoring frame */
const LIVING_X = mx(S.livingX);          //  1.0
const DINING_X = mx(S.diningX);          // -5.5
const STAIR_X = mx(S.stairX);            //  6.0
const P = { ...S.pantry, cx: mx(S.pantry.cx) };   // cx -6.5
const SPA = { ...S.spa, cx: mx(S.spa.cx) };       // cx 10.5

const X0 = S.cx - S.w / 2;          //  -8    west wall
const X1 = S.cx + S.w / 2;          //  +8    east wall
const ZS = S.glassWallZ;            // -13.5  south face = folding glass plane
const ZN = ZS - S.d;                // -26.5  north wall
const H1 = S.floorH;                //  3.4   1F floor-to-ceiling
const YF2 = S.floorToFloor;         //  3.8   2F finished floor level
const H2 = S.floor2H;               //  3.0   2F floor-to-ceiling
const Y2C = YF2 + H2;               //  6.8   2F ceiling / underside of roof

/* ── THE ROOF IS THE SIGNATURE ELEMENT ────────────────────────────────────
   Every reference photo of 隐逸居 reads the same way: one wide, flat plane
   floating on a deep shadow gap, edged with a fat warm copper band, dark
   timber underneath, dark grey metal on top (see the aerial — none of the
   campus roofs are white). SITE owns the base overhang; the pool-facing
   south edge reaches further still — that deep cantilever over the balcony
   and deck is the whole character of the building. site.js belongs to
   another module, so the extra reach is derived here rather than edited
   there.                                                                  */
const OVER_N = S.roofOverhang;          // 2.20  north — stays clear of the atrium
const OVER_E = S.roofOverhang * 1.30;   // 2.86  east / west
const OVER_S = S.roofOverhang * 1.55;   // 3.41  SOUTH — over balcony + deck
const ROOF_T = 0.72;                    // slab depth (was a 0.46 wafer)
const FASCIA_H = 0.58;                  // copper band depth (brief: 0.5–0.7 m)
const FASCIA_T = 0.16;                  // how far it stands proud of the slab
const LOUVRE_H = 0.70;                  // horizontal bronze screen band, 2F head

const WT = 0.26;                    // interior partition thickness
const EWT = 0.36;                   // exterior wall thickness

/* THE 2F DOOR ONTO THE CLUBHOUSE'S UPPER WALKWAY (2026-08-04).
   SITE.ARRIVAL.SUITE_DOOR is stated in SITE coordinates, like everything in
   site.js; Z is not mirrored (only X is), so it carries straight over. The
   walkway arrives at ARRIVAL_LOBBY_Y and the 2F slab is at YF2 — a 0.20 m
   step, comfortably inside CFG.STEP_UP, which is the whole reason the two
   levels were allowed to differ. */
const LINK_DOOR = SITE.ARRIVAL.SUITE_DOOR;
/* ARRIVAL_LOBBY_Y is the walkway's own level and is read for real at the
   bottom of this file — the exterior stair's landing guard has to catch a
   walker standing on the walkway (3.60) as well as one on the landing (3.80). */

/* --- the annex: spa + corridor. SITE.SUITE.spa spans (mirrored frame) x 7..14,
   which laps 1 m inside the envelope; we clip its inner face to the envelope
   wall (x = 8) so the two volumes don't intersect. Centre stays within 0.5 m.
   Built here on the +X side and reflected out to the WEST by mx(). --- */
const ANX_X0 = X1;                                   //  8.0
const ANX_X1 = SPA.cx + SPA.w / 2;                   // 14.0
const CORW = S.corridorW;                            //  1.6 CLEAR corridor width
const COR_X1 = ANX_X0 + CORW + .3;                   //  9.9  corridor/spa partition
                                                     //  (clear width + the wall)
const SPA_ZS = SPA.cz + SPA.d / 2;                   // -19.5 spa south wall
const COR_ZS = SPA_ZS + 2.5;                         // -17.0 corridor runs on past
                                                     // the spa to its second door

/* --- pantry (SITE.SUITE.pantry), outer face clipped to the wall. Authored in
   the NW corner of this file's frame; mx() lands it in the real NE one. --- */
const P_X1 = P.cx + P.w / 2;                         // -4.5
const P_ZS = P.cz + P.d / 2;                         // -22.75

/* --- the staircase. L-shaped dog-leg, 22 risers over SITE floorToFloor.
   The mass is 3.8 m wide and hangs off the envelope wall, so its zone runs
   from 1.8 m inboard of SITE.SUITE.stairX out to the wall. --- */
const RISE = YF2 / 22;                               // 0.17273
const ST = {
  x0: STAIR_X - 1.8, x1: X1,  // 4.2 → 8.0, the whole stair zone
  zN: -24.4, zS: -19.28,      // north face of the mass / top of the upper flight
  w: 1.2,                     // clear flight width
  goLo: 0.30, goUp: 0.29,
  nLo: 8, nUp: 14,            // short lower flight + long upper flight
  // quarter landing, tucked into the NE corner of the zone
  lx0: 6.75, lx1: 7.95,
  lzN: -24.25, lzS: -23.05,
  lyY: 8 * RISE,              // 1.3818
};
ST.loX0 = ST.lx0 - 7 * ST.goLo;   // 4.65 — bottom nosing of the lower flight
/* Underside of the spine wall's header over the lower flight's mouth (see
   buildStair): the black mass keeps fronting the 2F lounge edge above this,
   while a walker (head 1.75 + margin) boards the flight beneath it. Both the
   slab and its y-ranged collider read this one number. */
ST.spineHeadY = 2.35;

/* --- the folding glass wall (SITE.SUITE glassWallW / leafW / leafH) --- */
const GW = {
  z: ZS,
  x0: -S.glassWallW / 2,      // -7.0
  x1: S.glassWallW / 2,       //  7.0
  leafW: S.leafW,             // 0.95
  leafH: S.leafH,             // 2.8
  /* Leaves closed from x0 to here (dining end); the rest of the frontage is
     the walk-in / fly-in opening. Was -1.3 — 6 closed leaves — which the
     mirror would have dropped 0.3 m from the PREWEDDING spawn (SITE local
     x = 1, i.e. x = -1 in this file's frame), pinning the spawn against the
     glazing collider. That spawn is also INTRO_PATH.land and must not move,
     so the wall gives way instead: two leaves more are folded away, and the
     stone pier marking the joint slides with them (buildGreatRoom +
     buildColliders keep the same "just inboard of closedX1" relationship).
     Kept on the 0.95 m leaf module (x0 + 4 × leafW) so the run stays flush.
     Opening is now SITE x -6.15 … 3.2 with the spawn 2.2 m inside it, and the
     pier ends up 2.3 m to the walker's left — the mirror of the 2.4 m it
     stood to their right before. */
  closedX1: -3.2,             // leaves closed from x0 to here (dining end)
  stackX0: 6.2,               // the folded concertina stacks here
};

/* ══════════════════════════════════════════════════════════════════════
   2 · SMALL HELPERS — every one of these reflects X through mx() (see §1a)
   ══════════════════════════════════════════════════════════════════════ */

/** Box spanning an explicit x/y/z range — the workhorse for architecture. */
function slab(parent, mat, x0, x1, y0, y1, z0, z1) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  if (w < 1e-4 || h < 1e-4 || d < 1e-4) return null;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(mx((x0 + x1) / 2), (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(m);
  return m;
}

/** Box by centre + size, with optional Y rotation. */
function box(parent, mat, w, h, d, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(mx(x), y, z);
  m.rotation.y = -ry;
  parent.add(m);
  return m;
}

function cyl(parent, mat, rt, rb, h, x, y, z, seg = 16, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
  m.position.set(mx(x), y, z);
  parent.add(m);
  return m;
}

/* ── the Blender-authored interiors (assets/models/, ASSET_SPEC Group G) ─────
   This file has no bucket system — campus.js instances, water.js clones, and
   suite.js builds plain Meshes into groups through slab()/box()/cyl(). So a
   GLB comes in the same way it does in water.js: ONE CLONE per prop, sharing
   the template's geometry and material, put through the SAME mirror the
   primitives use. `mdl()` is deliberately `box()`'s tail — x reflects through
   mx(), and ry is NEGATED exactly as box() negates its last argument — so a
   call site's yaw arithmetic reads identically whether it is drawing a box or
   a model, and §1a's rule ("every primitive reflects its X on the way out")
   keeps holding with nothing new to remember.

   ⚠ The mirror is a no-op on the SHAPE of all eight Group G assets: each is
   symmetric about its own X centre plane, so reflecting its centre is a true
   reflection of it, exactly as it is for a box. It is NOT automatically a
   no-op on the YAW — see the modular sofa in buildSecondFloor, which is the
   one asset in this file whose yaw is neither 0 nor π.

   `haveM(name)` is the ONE gate (assets/blender/INTEGRATION.md §1): true only
   when the GLB actually loaded AND came in as a single mesh. EVERY call site
   below keeps its old primitive path as the `else` branch — models.preload()
   never rejects, so a missing GLB degrades to slabs, not to an empty room.

   ⚠ Nothing here adds, removes or moves a light. A GLB never carries one; the
   table lamp's glowing mouth is an EMISSIVE MATERIAL (`table_lamp_shade`,
   whose name ends `_emit`), which is what the four cylinders were too. The
   suite's eight real PointLights are REAL_LIGHTS and nothing below touches
   them. And no collider moves: every asset was modelled to the primitive's
   own envelope (ASSET_SPEC Group G quotes the file:line of each). */
const haveM = (name) => models.has(name) && !!models.geometry(name);
function mdl(parent, name, x, y, z, ry = 0, s = 1) {
  const m = models.get(name);
  if (!m) return null;
  m.position.set(mx(x), y, z);
  m.rotation.y = -ry;
  if (s !== 1) m.scale.setScalar(s);
  parent.add(m);
  return m;
}

/**
 * A wall run with door/window openings punched in it.
 * axis 'z': runs along Z at x = fixed.  axis 'x': runs along X at z = fixed.
 * holes: [ [a0, a1, headY] ] in the running axis; the wall above headY is kept
 * as a lintel.
 */
function wallRun(parent, mat, axis, fixed, t, a0, a1, y0, y1, holes = []) {
  const put = (b0, b1, yy0, yy1) => {
    if (b1 - b0 <= 1e-4 || yy1 - yy0 <= 1e-4) return;
    if (axis === 'z') slab(parent, mat, fixed - t / 2, fixed + t / 2, yy0, yy1, b0, b1);
    else slab(parent, mat, b0, b1, yy0, yy1, fixed - t / 2, fixed + t / 2);
  };
  const hs = holes.slice().sort((p, q) => p[0] - q[0]);
  let cur = a0;
  for (const h of hs) {
    const [h0, h1, hy] = h;
    if (h0 > cur) put(cur, h0, y0, y1);
    if (hy < y1) put(h0, h1, hy, y1);
    cur = Math.max(cur, h1);
  }
  put(cur, a1, y0, y1);
}

/* ── colliders ─────────────────────────────────────────────────────────
   updatePlayer only understands {x,z,r} cylinders, so walls are chains of
   circles at a step <= r (house rule — widen it and corners get squeezable).
   Colliders are authored in the same mirrored frame as the geometry and go
   through mx() too, so they stay welded to the walls they belong to. They are
   still ENCLAVE-LOCAL at this point — world.js rewrites the slice buildSuite
   pushed through enclaveToWorld() once the enclave group is placed. */
let COL = null;
/* `yr` is the optional {y0,y1} feet-height range from the collider contract in
   player.js — omit it and the circle blocks at every height, as all of these
   did before 2026-08-02. Only the stair mass uses it. */
function col(x, z, r, yr) { COL.push(yr ? { x: mx(x), z, r, ...yr } : { x: mx(x), z, r }); }
function colLine(x1, z1, x2, z2, r, step, yr) {
  const st = step || r * 0.9;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / st));
  for (let i = 0; i <= n; i++) col(x1 + dx * i / n, z1 + dz * i / n, r, yr);
}
/** Ring of circles around an axis-aligned rectangle (furniture, masses). */
function colRect(x0, z0, x1, z1, r, yr) {
  colLine(x0, z0, x1, z0, r, 0, yr);
  colLine(x1, z0, x1, z1, r, 0, yr);
  colLine(x1, z1, x0, z1, r, 0, yr);
  colLine(x0, z1, x0, z0, r, 0, yr);
}
/** ⚠ A chain authored in SITE coordinates, NOT in this file's mirrored frame.
 *  Everything above reflects its X through mx() on the way out, because it is
 *  authored from the (reversed) interior brief — see §1a. A few things this
 *  file has to guard are stated in site.js in ALREADY-CORRECTED SITE
 *  coordinates (SITE.EXT_STAIR), and reflecting one of those a second time
 *  would put it on the far side of the building. This pushes straight through.
 *  Use it ONLY for geometry read out of SITE.*; use colLine for everything
 *  authored here. */
function colSiteLine(x1, z1, x2, z2, r, yr) {
  const dx = x2 - x1, dz = z2 - z1;
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r * 0.9)));
  for (let i = 0; i <= n; i++) {
    COL.push({ x: x1 + dx * i / n, z: z1 + dz * i / n, r, ...(yr || {}) });
  }
}

/* ── day / night registry ──────────────────────────────────────────────
   Every emissive material and every real light registers here; setSuiteNight
   walks the list. Default state is NIGHT (the prewedding is the hero scene). */
let NIGHT = true;
const nightables = [];

function glow(mat, dayI, nightI) {
  mat.emissiveIntensity = NIGHT ? nightI : dayI;
  nightables.push({ mat, day: dayI, night: nightI });
  return mat;
}
function nightLight(light, dayI, nightI, dayHex, nightHex) {
  light.intensity = NIGHT ? nightI : dayI;
  light.color.setHex(NIGHT ? nightHex : dayHex);
  nightables.push({ light, day: dayI, night: nightI, dayHex, nightHex });
  return light;
}

export function setSuiteNight(on) {
  NIGHT = !!on;
  for (const n of nightables) {
    if (n.mat) n.mat.emissiveIntensity = NIGHT ? n.night : n.day;
    else if (n.light) {
      n.light.intensity = NIGHT ? n.night : n.day;
      n.light.color.setHex(NIGHT ? n.nightHex : n.dayHex);
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   3 · TEXTURES — all local CanvasTextures (hexes from the brief's §5 table)
   ══════════════════════════════════════════════════════════════════════ */
function tex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/* polished cream marble — #EDE8DF with warm-grey veining, big slabs */
function texMarble(rep) {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#ede8df'; g.fillRect(0, 0, w, h);
    const r = mulberry32(4409);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(203,195,180,${.16 + r() * .3})`;
      g.lineWidth = .6 + r() * 2.4;
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        const nx = x + (r() - .5) * 220, ny = y + (r() - .5) * 160;
        g.quadraticCurveTo(x + (r() - .5) * 90, y + (r() - .5) * 90, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    for (let i = 0; i < 300; i++) {           // faint warm mottle
      g.fillStyle = `rgba(255,252,244,${.05 + r() * .09})`;
      g.fillRect(r() * w, r() * h, 6 + r() * 40, 3 + r() * 14);
    }
    g.strokeStyle = 'rgba(186,178,163,.5)';    // slab joints, 1 per repeat
    g.lineWidth = 1.6;
    g.strokeRect(.8, .8, w - 1.6, h - 1.6);
  }, rep);
}

/* deep burgundy-maroon lacquered panelling — #4E2328, flush panels + reveals */
function texMaroon(rep) {
  return tex(256, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#5b2b30'); grad.addColorStop(.45, '#4e2328');
    grad.addColorStop(1, '#3d1b20');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const r = mulberry32(6607);
    for (let i = 0; i < 90; i++) {             // lacquer sheen streaks
      g.fillStyle = `rgba(140,70,74,${.03 + r() * .07})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 5, 20 + r() * 180);
    }
    g.fillStyle = 'rgba(22,10,12,.75)';        // vertical reveal joints
    g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h);
    g.fillStyle = 'rgba(150,90,90,.10)';
    g.fillRect(4, 0, 2, h);
  }, rep);
}

/* glossy black-brown stair spine — #1E1A18, horizontal grooves ~150 mm */
function texBlackGroove(rep) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#1e1a18'; g.fillRect(0, 0, w, h);
    const r = mulberry32(8821);
    for (let i = 0; i < 120; i++) {             // polished reflections
      g.fillStyle = `rgba(90,84,80,${.02 + r() * .06})`;
      g.fillRect(0, r() * h, w, 1 + r() * 3);
    }
    for (let y = 0; y < h; y += h / 4) {        // 4 grooves per repeat
      g.fillStyle = 'rgba(0,0,0,.85)';
      g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(120,112,106,.16)';
      g.fillRect(0, y + 3, w, 2);
    }
  }, rep);
}

/* reddish sapele — door frames, handrail, glass-wall frames */
function texSapele(rep) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#7b3f2a'; g.fillRect(0, 0, w, h);
    const r = mulberry32(1319);
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = `rgba(${60 + r() * 50 | 0},${28 + r() * 26 | 0},${18 + r() * 16 | 0},${.2 + r() * .4})`;
      g.lineWidth = .6 + r() * 1.8;
      const y = r() * h;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(w * .33, y + (r() - .5) * 12, w * .66, y + (r() - .5) * 12, w, y + (r() - .5) * 8);
      g.stroke();
    }
  }, rep);
}

/* espresso ribbed timber — sofa plinth, coffee table, dining table */
function texEspresso(rep) {
  return tex(128, 256, (g, w, h) => {
    g.fillStyle = '#2b1d16'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) {           // fine horizontal ribs
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(120,88,64,.18)'; g.fillRect(0, y + 3, w, 2);
    }
  }, rep);
}

/* backlit frosted louver glazing — milky white, horizontal louvers */
function texFrosted(rep) {
  return tex(128, 256, (g, w, h) => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = 'rgba(196,196,186,.55)'; g.fillRect(0, y, w, 3);
      g.fillStyle = 'rgba(255,255,252,.9)'; g.fillRect(0, y + 3, w, 6);
    }
  }, rep);
}

/* backlit onyx — warm white with soft veining (spa feature wall) */
function texOnyx(rep) {
  return tex(512, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#f6f2e8'); grad.addColorStop(.5, '#efeadf');
    grad.addColorStop(1, '#e2dccd');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const r = mulberry32(2711);
    for (let i = 0; i < 34; i++) {
      g.strokeStyle = `rgba(196,176,138,${.1 + r() * .22})`;
      g.lineWidth = 1 + r() * 5;
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        const nx = x + (r() - .5) * 260, ny = y + (r() - .5) * 70;
        g.quadraticCurveTo(x + (r() - .5) * 80, y + (r() - .5) * 40, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
  }, rep);
}

/* teal rug with pale swirl linework (2F lounge) */
function texRug() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#4e8e96'; g.fillRect(0, 0, w, h);
    const r = mulberry32(3803);
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(38,92,100,${.04 + r() * .08})`;
      g.fillRect(r() * w, r() * h, 3 + r() * 8, 3 + r() * 8);
    }
    g.strokeStyle = 'rgba(201,214,212,.5)'; g.lineWidth = 2.2;
    for (let i = 0; i < 16; i++) {
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 7; k++) {
        const nx = x + (r() - .5) * 200, ny = y + (r() - .5) * 200;
        g.quadraticCurveTo(x + (r() - .5) * 150, y + (r() - .5) * 150, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
  }, [1, 1]);
}

/* 2F lounge floor — dark glossy red-brown planks #4A2E22 */
function texDarkFloor(rep) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a2e22'; g.fillRect(0, 0, w, h);
    const r = mulberry32(5209);
    for (let i = 0; i < 200; i++) {
      g.strokeStyle = `rgba(${28 + r() * 40 | 0},${16 + r() * 24 | 0},${10 + r() * 14 | 0},.4)`;
      g.lineWidth = .5 + r() * 1.5;
      const y = r() * h;
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (r() - .5) * 5); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,.5)';
    for (let y = 0; y < h; y += 64) g.fillRect(0, y, w, 2);
  }, rep);
}

/* striated silver-grey stone (pantry column, exterior piers) */
function texGreyStone(rep) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#8c8f92'; g.fillRect(0, 0, w, h);
    const r = mulberry32(9403);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${100 + r() * 70 | 0},${104 + r() * 70 | 0},${108 + r() * 70 | 0},${.15 + r() * .35})`;
      g.fillRect(r() * w, 0, 1 + r() * 5, h);
    }
    g.fillStyle = 'rgba(46,48,50,.5)';
    for (let x = 0; x < w; x += 128) g.fillRect(x, 0, 2, h);
  }, rep);
}

/* honed grey spa floor #B9B4AB */
function texSpaFloor(rep) {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9b4ab'; g.fillRect(0, 0, w, h);
    const r = mulberry32(6113);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${150 + r() * 40 | 0},${146 + r() * 38 | 0},${138 + r() * 36 | 0},${.1 + r() * .2})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 10, 2 + r() * 10);
    }
    g.strokeStyle = 'rgba(120,116,108,.4)'; g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  }, rep);
}

/* champagne-gold crystal strands — colour map + a matching alpha map */
function crystalMaps() {
  const draw = (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const r = mulberry32(7717);
    for (let x = 0; x < w; x += 5) {
      if (r() < .12) continue;                 // gaps between strands
      for (let y = 2; y < h; y += 7) {
        const a = .55 + r() * .45;
        g.fillStyle = `rgba(${232 + r() * 20 | 0},${208 + r() * 26 | 0},${150 + r() * 40 | 0},${a})`;
        g.beginPath(); g.arc(x + 2, y + r() * 2, 1.9, 0, 7); g.fill();
      }
    }
  };
  return [tex(256, 256, draw, [4, 1], true), tex(256, 256, draw, [4, 1], false)];
}

/* amber mosaic (spa vanity backsplash) */
function texMosaic(rep) {
  return tex(128, 128, (g, w, h) => {
    const r = mulberry32(4127);
    for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) {
      g.fillStyle = `rgb(${170 + r() * 60 | 0},${120 + r() * 50 | 0},${52 + r() * 40 | 0})`;
      g.fillRect(x + 1, y + 1, 14, 14);
    }
  }, rep);
}

/* ══════════════════════════════════════════════════════════════════════
   4 · MATERIALS
   ══════════════════════════════════════════════════════════════════════ */
const [crystalMap, crystalAlpha] = crystalMaps();

const MT = {
  marble: new THREE.MeshStandardMaterial({
    map: texMarble([9, 8]), roughness: .12, metalness: .06, color: 0xffffff,
  }),
  marbleTread: new THREE.MeshStandardMaterial({ color: 0xe9e4db, roughness: .18, metalness: .04 }),
  maroon: new THREE.MeshStandardMaterial({ map: texMaroon([3, 1]), roughness: .26, metalness: .12 }),
  maroonTall: new THREE.MeshStandardMaterial({ map: texMaroon([4, 2]), roughness: .26, metalness: .12 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x8a6b3f, metalness: .85, roughness: .3 }),
  brassBright: new THREE.MeshStandardMaterial({ color: 0xa98c4f, metalness: .9, roughness: .24 }),
  black: new THREE.MeshStandardMaterial({ map: texBlackGroove([3, 4]), roughness: .1, metalness: .35 }),
  blackTall: new THREE.MeshStandardMaterial({ map: texBlackGroove([3, 8]), roughness: .1, metalness: .35 }),
  sapele: new THREE.MeshStandardMaterial({ map: texSapele([2, 2]), roughness: .42, metalness: .05 }),
  sapeleDark: new THREE.MeshStandardMaterial({ color: 0x5c3325, roughness: .45 }),
  espresso: new THREE.MeshStandardMaterial({ map: texEspresso([2, 1]), roughness: .4, metalness: .08 }),
  espressoPlain: new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: .45 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: .94 }),
  ceilingWarm: new THREE.MeshStandardMaterial({ color: 0xeeece5, roughness: .95 }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: .92 }),
  stonePier: new THREE.MeshStandardMaterial({ color: 0x35322e, roughness: .78, metalness: .06 }),
  greyStone: new THREE.MeshStandardMaterial({ map: texGreyStone([1, 2]), roughness: .55, metalness: .1 }),
  spaFloor: new THREE.MeshStandardMaterial({ map: texSpaFloor([5, 5]), roughness: .5, metalness: .04 }),
  dark2F: new THREE.MeshStandardMaterial({ map: texDarkFloor([7, 5]), roughness: .16, metalness: .1 }),
  rug: new THREE.MeshStandardMaterial({ map: texRug(), roughness: .92 }),
  ivory: new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: .82 }),
  ivoryWhite: new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: .58 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: .55 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x3fa8a4, roughness: .78 }),
  tealDeep: new THREE.MeshStandardMaterial({ color: 0x2e7f7c, roughness: .78 }),
  curtain: new THREE.MeshStandardMaterial({ color: 0x3f7c85, roughness: .96, side: THREE.DoubleSide }),
  sheer: new THREE.MeshStandardMaterial({
    color: 0xf5f4f0, roughness: 1, transparent: true, opacity: .34, side: THREE.DoubleSide,
  }),
  navy: new THREE.MeshStandardMaterial({ color: 0x23364a, roughness: .55 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0xcfe0e2, roughness: .04, metalness: .12,
    transparent: true, opacity: .16, side: THREE.DoubleSide,
  }),
  glassRail: new THREE.MeshStandardMaterial({
    color: 0xdcebee, roughness: .05, metalness: .1,
    transparent: true, opacity: .22, side: THREE.DoubleSide,
  }),
  water: new THREE.MeshStandardMaterial({ color: 0x2fa8b8, roughness: .08, metalness: .3 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: .1 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xc8cfd4, metalness: 1, roughness: .04 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb4763c, metalness: .82, roughness: .34 }),
  mosaic: new THREE.MeshStandardMaterial({ map: texMosaic([4, 2]), roughness: .35, metalness: .2 }),
  latticeRed: new THREE.MeshStandardMaterial({ color: 0x7a2e28, roughness: .35, metalness: .1 }),
  stoneTop: new THREE.MeshStandardMaterial({ color: 0xedeae2, roughness: .2, metalness: .05 }),
  bronzeMullion: new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: .5, metalness: .45 }),

  /* ── emissive kit (registered with glow() at build time) ── */
  frosted: glow(new THREE.MeshStandardMaterial({
    map: texFrosted([2, 6]), color: 0xffffff, roughness: .85,
    emissive: 0xfff2d8, emissiveMap: texFrosted([2, 6]),
  }), .18, 1.35),
  onyx: glow(new THREE.MeshStandardMaterial({
    map: texOnyx([1, 1]), roughness: .35,
    emissive: 0xffe6b4, emissiveMap: texOnyx([1, 1]),
  }), .12, 1.15),
  downlight: glow(new THREE.MeshStandardMaterial({
    color: 0xfff2dc, emissive: 0xffdcab, roughness: .4,
  }), .25, 2.4),
  cove: glow(new THREE.MeshStandardMaterial({
    color: 0xfff1d6, emissive: 0xffcf96, roughness: .6,
  }), .15, 1.9),
  lampShade: glow(new THREE.MeshStandardMaterial({
    color: 0x2a2320, emissive: 0xffc271, roughness: .8, side: THREE.DoubleSide,
  }), .05, 1.5),
  tv: glow(new THREE.MeshStandardMaterial({
    color: 0x0a0c10, emissive: 0x1c3550, roughness: .22,
  }), .1, .7),
  crystal: glow(new THREE.MeshStandardMaterial({
    map: crystalMap, alphaMap: crystalAlpha, transparent: true,
    color: 0xffffff, roughness: .12, metalness: .35,
    emissive: 0xd9c08a, emissiveMap: crystalMap, side: THREE.DoubleSide,
    depthWrite: false,
  }), .3, 2.6),
};

/* ══════════════════════════════════════════════════════════════════════
   5 · ENTRY POINT
   ══════════════════════════════════════════════════════════════════════ */
export function buildSuite(G) {
  const root = new THREE.Group();
  root.name = 'presidentialSuite';
  COL = (G.colliders ||= []);

  buildShell(root);
  buildFoldingGlassWall(root);
  buildGreatRoom(root);
  buildPantry(root);
  buildStair(root, G);
  buildAnnex(root);
  buildSecondFloor(root);
  buildLighting(root, G);
  buildColliders();
  checkMirror();

  G.scene.add(root);
  G.suite = root;
  return root;
}

/* ══════════════════════════════════════════════════════════════════════
   6 · SHELL — slabs, exterior walls, coffered ceilings, cantilevered roof
   ══════════════════════════════════════════════════════════════════════ */

/** Recessed white coffer: a dropped border ring with a cove LED strip inside. */
function coffer(parent, x0, x1, z0, z1, yCeil, drop = .16, band = .42) {
  slab(parent, MT.ceiling, x0, x1, yCeil - drop, yCeil - drop + .02, z0, z0 + band);
  slab(parent, MT.ceiling, x0, x1, yCeil - drop, yCeil - drop + .02, z1 - band, z1);
  slab(parent, MT.ceiling, x0, x0 + band, yCeil - drop, yCeil - drop + .02, z0, z1);
  slab(parent, MT.ceiling, x1 - band, x1, yCeil - drop, yCeil - drop + .02, z0, z1);
  slab(parent, MT.ceiling, x0, x1, yCeil - drop, yCeil, z0, z0 + .04);
  slab(parent, MT.ceiling, x0, x1, yCeil - drop, yCeil, z1 - .04, z1);
  slab(parent, MT.ceiling, x0, x0 + .04, yCeil - drop, yCeil, z0, z1);
  slab(parent, MT.ceiling, x1 - .04, x1, yCeil - drop, yCeil, z0, z1);
  /* cove LED — a thin emissive strip hidden in the step */
  const y = yCeil - drop + .05;
  slab(parent, MT.cove, x0 + band, x1 - band, y, y + .05, z0 + band - .06, z0 + band);
  slab(parent, MT.cove, x0 + band, x1 - band, y, y + .05, z1 - band, z1 - band + .06);
  slab(parent, MT.cove, x0 + band - .06, x0 + band, y, y + .05, z0 + band, z1 - band);
  slab(parent, MT.cove, x1 - band, x1 - band + .06, y, y + .05, z0 + band, z1 - band);
}

/** Grid of recessed downlights (emissive discs — no real lights). */
function downlights(parent, x0, x1, z0, z1, y, nx, nz, r = .075) {
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (x1 - x0) * (i + .5) / nx;
    const z = z0 + (z1 - z0) * (j + .5) / nz;
    cyl(parent, MT.downlight, r, r, .03, x, y - .015, z, 12);
  }
}

function buildShell(root) {
  /* ── 1F floor: polished cream marble across the whole great room ── */
  slab(root, MT.marble, X0, X1, -.08, 0, ZN, ZS);
  /* threshold strip out to the deck — flush, ~40 mm (brief §7) */
  slab(root, MT.marble, GW.x0, GW.x1, -.04, .01, ZS - .12, ZS + .16);

  /* ── exterior walls, 1F + 2F in one run ────────────────────────────
     North: entry double doors + the pantry service door.               */
  wallRun(root, MT.plaster, 'x', ZN, EWT, X0, X1, 0, Y2C, [
    [-7.4, -6.0, 2.2],     // pantry service double door
    [-3.4, -1.6, 2.4],     // villa entry double doors
  ]);
  /* West: solid to the south third, then a fixed corner glazing return.
     ⚠ In SITE coordinates this run is the suite's EAST wall (this file
     authors mirrored — see §1a), and since 2026-08-04 it carries the suite's
     2F door onto the clubhouse's upper walkway. Carl asked for the check-in
     lobby to give "access to presidential suite on second floor"; the walkway
     runs up the 2.2 m slot between this wall and Garden Room D1 at
     ARRIVAL_LOBBY_Y (3.60) and steps 0.20 up into the 2F lounge here. The
     hole is cut in the RUN, not drawn over it — a door drawn on a solid wall
     is the doubleDoor bug this project already paid for once. */
  wallRun(root, MT.plaster, 'z', X0, EWT, ZN, -16.6, 0, Y2C, [
    [LINK_DOOR.z0, LINK_DOOR.z1, YF2 + 2.35],
  ]);
  /* the reveal: a marble sill flush with the 2F floor, dark jambs, a copper
     head — the same language the atrium's gallery doors use */
  slab(root, MT.marble, X0 - EWT / 2 - .1, X0 + EWT / 2 + .35, YF2 - .06, YF2 + .01,
    LINK_DOOR.z0, LINK_DOOR.z1);
  for (const dz of [LINK_DOOR.z0, LINK_DOOR.z1]) {
    slab(root, MT.sapeleDark, X0 - EWT / 2 - .04, X0 + EWT / 2 + .04, YF2, YF2 + 2.35,
      dz - .07, dz + .07);
  }
  slab(root, MT.brass, X0 - EWT / 2 - .04, X0 + EWT / 2 + .04, YF2 + 2.30, YF2 + 2.40,
    LINK_DOOR.z0, LINK_DOOR.z1);
  wallRun(root, MT.plaster, 'z', X0, EWT, -16.6, ZS, YF2 - .4, Y2C);
  glazedBay(root, 'z', X0, -16.6, ZS, .1, 2.9, 3);          // 1F corner glazing
  /* East: shared with the annex to z = COR_ZS, then exterior.
     Holes: the corridor cased opening, the spa double doors, and the full-
     height slot where the backlit frosted stair glazing sits. */
  wallRun(root, MT.plaster, 'z', X1, EWT, ZN, COR_ZS, 0, Y2C, [
    [-26.25, -24.5, 2.4],          // cased opening → spa corridor (NE corner)
    [ST.zN + .3, -21.0, Y2C],      // frosted louver glazing (built in buildStair)
    [-19.2, -17.4, 2.4],           // double doors back from the spa corridor
  ]);
  wallRun(root, MT.plaster, 'z', X1, EWT, COR_ZS, ZS, 0, Y2C);

  /* ── south face: dark stone-clad piers flanking the 14 m glazing ── */
  for (const px of [X0 + .5, X1 - .5]) {
    slab(root, MT.stonePier, px - .5, px + .5, 0, Y2C, ZS - .5, ZS + .12);
  }
  /* the 2F spandrel above the folding wall (1F head to 2F floor) */
  slab(root, MT.plaster, GW.x0, GW.x1, 3.0, YF2, ZS - .18, ZS + .06);

  /* ── 2F floor slab (3.4 → 3.8), cut open over the stair void ── */
  slab(root, MT.ceiling, X0, ST.x0, H1, YF2, ZN, ZS);
  slab(root, MT.ceiling, ST.x0, X1, H1, YF2, ZN, ST.zN);
  slab(root, MT.ceiling, ST.x0, X1, H1, YF2, ST.zS, ZS);

  /* ── 1F ceiling: matte white with two stepped coffers + cove LED ── */
  /* the living coffer + its downlight grid deliberately stay over the SOUTH
     half — the open floor between the seating island and the folding wall.
     That is where people stand at the prewedding party and where the hero
     shot is framed from; it must not go dark just because the sofa moved. */
  coffer(root, -1.9, 4.1, -19.6, -14.0, H1);          // over the living/party floor
  coffer(root, -7.6, -2.6, -21.6, -16.4, H1);         // over the dining area
  downlights(root, -1.4, 3.6, -19.0, -14.6, H1 - .02, 4, 4);
  downlights(root, -7.2, -3.0, -21.2, -16.8, H1 - .02, 3, 3);
  downlights(root, 4.4, 7.6, -15.4, -13.9, H1 - .02, 3, 1);
  /* wall-washers grazing the maroon north wall */
  downlights(root, -1.2, 6.6, -26.0, -25.7, H1 - .02, 8, 1, .05);

  /* ── the cantilevered flat roof + copper/bronze fascia ──────────── */
  /* directional overhangs: deepest to the SOUTH over the balcony and pool deck,
     shallowest to the NORTH so the roof stays clear of the atrium */
  const rx0 = X0 - OVER_E, rx1 = X1 + OVER_E, rz0 = ZN - OVER_N, rz1 = ZS + OVER_S;
  slab(root, MT.ceilingWarm, rx0, rx1, Y2C, Y2C + ROOF_T - .1, rz0, rz1);   // soffit + slab
  slab(root, MT.plaster, rx0 + .1, rx1 - .1, Y2C + ROOF_T - .1, Y2C + ROOF_T, rz0 + .1, rz1 - .1);
  fascia(root, rx0, rx1, rz0, rz1, Y2C + .04, ROOF_T - .06, .14);

  /* single-storey roof over the east annex — spa block + corridor tail */
  slab(root, MT.ceilingWarm, ANX_X0, ANX_X1 + 1.2, H2, H2 + .3, ZN - 1.2, SPA_ZS + 1.0);
  fascia(root, ANX_X0, ANX_X1 + 1.2, ZN - 1.2, SPA_ZS + 1.0, H2 + .02, .3, .1);
  slab(root, MT.ceilingWarm, ANX_X0, COR_X1 + 1.0, H2, H2 + .3, SPA_ZS + 1.0, COR_ZS + 1.0);
  fascia(root, ANX_X0, COR_X1 + 1.0, SPA_ZS + 1.0, COR_ZS + 1.0, H2 + .02, .3, .1);

  /* the annex floor + ceilings */
  slab(root, MT.spaFloor, ANX_X0, ANX_X1, -.08, 0, ZN, SPA_ZS);
  slab(root, MT.marble, ANX_X0, COR_X1, -.08, 0, SPA_ZS, COR_ZS);
  slab(root, MT.ceiling, ANX_X0, ANX_X1, H2 - .06, H2, ZN, SPA_ZS);
  slab(root, MT.ceiling, ANX_X0, COR_X1, H2 - .06, H2, SPA_ZS, COR_ZS);
}

/** Copper/bronze fascia band wrapped around a roof slab. */
function fascia(parent, x0, x1, z0, z1, y, h, t) {
  slab(parent, MT.copper, x0, x1, y, y + h, z0, z0 + t);
  slab(parent, MT.copper, x0, x1, y, y + h, z1 - t, z1);
  slab(parent, MT.copper, x0, x0 + t, y, y + h, z0, z1);
  slab(parent, MT.copper, x1 - t, x1, y, y + h, z0, z1);
}

/* ══════════════════════════════════════════════════════════════════════
   7 · THE SOUTH FOLDING GLASS WALL
   Dark-sapele bi-fold leaves on SITE.SUITE.glassWallZ. Modelled FOLDED OPEN
   across the living section (leaves concertina'd at the east end) so you can
   walk — and fly — straight in from the pool deck. A few leaves stay closed
   at the dining end so the frames still read.
   ══════════════════════════════════════════════════════════════════════ */
function makeLeaf(w, h) {
  const g = new THREE.Group();
  const t = .09, f = .065;
  slab(g, MT.sapele, -w / 2, -w / 2 + f, 0, h, -t / 2, t / 2);
  slab(g, MT.sapele, w / 2 - f, w / 2, 0, h, -t / 2, t / 2);
  slab(g, MT.sapele, -w / 2, w / 2, 0, f, -t / 2, t / 2);
  slab(g, MT.sapele, -w / 2, w / 2, h - f, h, -t / 2, t / 2);
  slab(g, MT.sapele, -w / 2, w / 2, h * .52 - .035, h * .52 + .035, -t / 2, t / 2);
  slab(g, MT.glass, -w / 2 + f, w / 2 - f, f, h - f, -.018, .018);
  return g;
}

function buildFoldingGlassWall(root) {
  const g = new THREE.Group();
  root.add(g);

  /* head beam + floor track run the whole 14 m frontage */
  slab(g, MT.sapele, GW.x0, GW.x1, GW.leafH, GW.leafH + .18, ZS - .1, ZS + .1);
  slab(g, MT.sapeleDark, GW.x0, GW.x1, -.02, .02, ZS - .07, ZS + .07);
  /* jambs */
  slab(g, MT.sapele, GW.x0 - .09, GW.x0, 0, GW.leafH + .18, ZS - .1, ZS + .1);
  slab(g, MT.sapele, GW.x1, GW.x1 + .09, 0, GW.leafH + .18, ZS - .1, ZS + .1);

  /* ── closed leaves, dining end ── */
  const nClosed = Math.round((GW.closedX1 - GW.x0) / GW.leafW);
  for (let i = 0; i < nClosed; i++) {
    const leaf = makeLeaf(GW.leafW, GW.leafH);
    /* makeLeaf's own slabs are already reflected, so the group only needs its
       position and rotation reflected — see §1a. translateX flips with the
       rotation; translateZ would not. */
    leaf.position.set(mx(GW.x0 + GW.leafW * (i + .5)), 0, ZS);
    g.add(leaf);
  }
  /* one leaf swung open on its hinge — the "swing-door mode" of the video */
  const swing = makeLeaf(GW.leafW, GW.leafH);
  swing.position.set(mx(GW.closedX1 + .06), 0, ZS - .04);
  swing.rotation.y = 1.15;
  swing.translateX(-GW.leafW / 2);
  g.add(swing);

  /* ── the folded concertina: 8 leaves stacked at the east end ──
     hinges alternate between the wall plane and 0.94 m inboard. */
  const depth = .94;
  const dx = Math.sqrt(GW.leafW * GW.leafW - depth * depth);   // 0.1375
  const hz = j => (j % 2 === 0 ? ZS : ZS - depth);
  for (let j = 0; j < 8; j++) {
    const x0 = GW.stackX0 + j * dx, x1 = GW.stackX0 + (j + 1) * dx;
    const z0 = hz(j), z1 = hz(j + 1);
    const leaf = makeLeaf(GW.leafW, GW.leafH);
    leaf.position.set(mx((x0 + x1) / 2), 0, (z0 + z1) / 2);
    leaf.rotation.y = -Math.atan2(-(z1 - z0), x1 - x0);
    g.add(leaf);
  }
  /* stack post the leaves park against */
  slab(g, MT.sapele, GW.stackX0 + 8 * dx, GW.stackX0 + 8 * dx + .1, 0, GW.leafH, ZS - depth, ZS + .05);
}

/**
 * A run of fixed glazing in a dark bronze mullion grid.
 * axis 'z' → the wall runs along Z at x = fixed; 'x' → along X at z = fixed.
 */
function glazedBay(parent, axis, fixed, a0, a1, y0, y1, bays, mat = MT.glass) {
  const t = .07, mw = .07;
  const put = (b0, b1, yy0, yy1, m) => {
    if (axis === 'z') slab(parent, m, fixed - t / 2, fixed + t / 2, yy0, yy1, b0, b1);
    else slab(parent, m, b0, b1, yy0, yy1, fixed - t / 2, fixed + t / 2);
  };
  put(a0, a1, y0, y1, mat);
  for (let i = 0; i <= bays; i++) {
    const a = a0 + (a1 - a0) * i / bays;
    put(a - mw / 2, a + mw / 2, y0, y1, MT.bronzeMullion);
  }
  put(a0, a1, y0, y0 + .08, MT.bronzeMullion);
  put(a0, a1, y1 - .08, y1, MT.bronzeMullion);
}

/* ══════════════════════════════════════════════════════════════════════
   8 · 1F GREAT ROOM — one open volume: living (centre/east) + dining (west)
   ══════════════════════════════════════════════════════════════════════ */
function buildGreatRoom(root) {
  const g = new THREE.Group();
  root.add(g);

  /* ── north wall: maroon lacquer panels + brass skirting + entry doors ── */
  const nz = ZN + EWT / 2 + .06;
  wallRun(g, MT.maroon, 'x', nz, .12, P_X1, X1, 0, H1, [[-3.4, -1.6, 2.4]]);
  slab(g, MT.brass, P_X1, X1, 0, .09, nz - .09, nz + .07);          // 80 mm skirting
  slab(g, MT.brass, P_X1, X1, H1 - .06, H1, nz - .08, nz + .06);    // cornice reveal

  /* the entry double doors themselves — STANDING OPEN onto the atrium portal
     (site.js: "EVERY villa entry opens off it, including the presidential
     suite's north double doors"). The gallery rule from atrium.js applies:
     an open door reads as a way through, a closed one reads as decoration.
     dir +1 swings the leaves into the great room, clear of the portal slot.
     buildColliders breaks the north chain over this same span. */
  doubleDoor(g, 'x', nz - .02, -3.4, -1.6, 2.4, true, 1);
  /* marble sill through the exterior wall depth — same recipe as the folding
     glass wall's threshold strip (buildShell). The route is grade-to-grade:
     suite marble tops at y 0, the portal slot and the atrium gallery answer
     0 too, so this is dressing, not a WALK_REGION. */
  slab(g, MT.marble, -3.4, -1.6, -.04, .01, ZN - .22, ZN + .18);

  /* ── west wall lining (dining end) ── */
  const wx = X0 + EWT / 2 + .06;
  wallRun(g, MT.maroon, 'z', wx, .12, ZN, -16.6, 0, H1);
  slab(g, MT.brass, wx - .09, wx + .07, 0, .09, ZN, -16.6);

  /* ── east wall lining, south of the stair ── */
  const ex = X1 - EWT / 2 - .06;
  wallRun(g, MT.maroon, 'z', ex, .12, -17.4, ZS - .6, 0, H1);
  slab(g, MT.brass, ex - .07, ex + .09, 0, .09, -17.4, ZS - .6);

  /* ── TV wall + two low burgundy credenzas on the north wall ──
     (the room is on the +z side of the lining plane at nz) */
  for (const cx of [.6, 3.4]) {
    slab(g, MT.maroon, cx - 1.15, cx + 1.15, .13, .68, nz + .04, nz + .55);
    for (const lx of [cx - 1.0, cx + 1.0]) {
      slab(g, MT.brass, lx - .04, lx + .04, 0, .13, nz + .09, nz + .17);
      slab(g, MT.brass, lx - .04, lx + .04, 0, .13, nz + .40, nz + .48);
    }
  }
  slab(g, MT.espressoPlain, .3, 3.7, 1.05, 2.45, nz + .04, nz + .12);   // dark TV panel
  slab(g, MT.tv, .55, 3.45, 1.2, 2.3, nz + .12, nz + .16);
  /* a small ornament + table lamp on the west credenza (f030) */
  cyl(g, MT.espressoPlain, .09, .11, .1, -.2, .73, nz + .3, 12);
  tableLamp(g, -.2, .78, nz + .3, .3);

  /* ── the sofa island: 6 × 4 m on an espresso plinth ────────────────
     two back-to-back chaise platforms, ivory cushions, ~12 teal pillows,
     and the big ribbed coffee table on the pool side (f012/f016).
     sz sits the island in the NORTH half of the room, facing the TV wall,
     because the south half is circulation: the folding wall's open span
     (x −1.3 … 6.15) has to stay walkable end to end. At sz = −16.6 the
     plinth's south edge landed 1.1 m from the glass, which — with its
     collider rect — walled the great room off from the deck except for a
     0.7 m slot at the east end, and swallowed the PREWEDDING spawn whole. */
  const sx = LIVING_X, sz = -21.2;
  slab(g, MT.espresso, sx - 3, sx + 3, 0, .32, sz - 2, sz + 2);
  slab(g, MT.espressoPlain, sx - 3.02, sx + 3.02, .3, .34, sz - 2.02, sz + 2.02);
  /* THE ISLAND'S THREE MODULES. `suite_sofa` is ONE 1.00 m slice of the
     back-to-back chaise — the shared low back plus the 1.00 m TV-side seat
     and the 1.05 m pool-side seat — so three of them at sx − 1, sx, sx + 1
     rebuild the 3.00 m run the three slabs below drew.
     · ORIGIN is the footprint centre AT THE PLINTH'S TOP FACE, y .32, which
       is why the plinth above stays: it is the ground here, and
       colRect(LIVING_X ± 2.85, −23.05 … −19.35, r .22) is measured on it.
     · z = sz − .70 puts the module's own 2.50 m over the platforms' own
       sz −1.95 … +.55, and .32 + .743 tops out at 1.063 against the
       backrest's 1.06.
     · FRONT −Z is the TV-facing chaise, which is this room's −z: ry = 0, and
       0 is its own negative, so the file's mirror is a no-op on the yaw. The
       module is X-symmetric, so it is a no-op on the shape too, and mx()
       carries {−1, 0, +1} to {+1, 0, −1} — the same three places.
     NOT in the GLB and still drawn below: the plinth and its cap (above), the
     two ARM blocks (the island's ends — a repeating module cannot carry one)
     and the ~12 teal pillows (a per-instance tint stream one baked atlas
     cannot reproduce). */
  if (haveM('suite_sofa')) {
    for (const k of [-1, 0, 1]) mdl(g, 'suite_sofa', sx + k, .32, sz - .70, 0);
  } else {
    /* shared central backrest */
    slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, 1.06, sz - .95, sz - .5);
    /* two seat platforms, back to back */
    slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, .70, sz - .5, sz + .55);
    slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, .70, sz - 1.95, sz - .95);
  }
  /* arm blocks */
  for (const ax of [sx - 1.5, sx + 1.5]) {
    slab(g, MT.ivory, ax - .18, ax + .18, .32, .82, sz - 1.95, sz + .55);
  }
  /* ~12 teal pillows against both faces of the backrest */
  for (let i = 0; i < 6; i++) {
    const px = sx - 1.15 + i * .46;
    const p1 = box(g, MT.teal, .42, .42, .16, px, .88, sz - .38, .12 * (i % 2 ? 1 : -1));
    p1.rotation.x = -.22;
    const p2 = box(g, i % 2 ? MT.tealDeep : MT.teal, .42, .42, .16, px, .88, sz - 1.07, .12 * (i % 2 ? -1 : 1));
    p2.rotation.x = .22;
  }
  /* the big ribbed coffee table, pool side.
     Origin is the plinth's top face too (it stands on the plinth, not on the
     marble), so y .32 and z sz + 1.40 put its 2.68 × 1.08 × 0.31 exactly over
     the two slabs' sx ± 1.34 / sz + .86 … + 1.94 / .32 … .63. The RIBS are
     geometry in the GLB — MT.espresso's grooves are a canvas texture and a
     baked atlas cannot carry a rib the model does not have. ry = 0 (symmetric
     on both axes), its own negative under the mirror. No collider of its own:
     the island's ring covers it. */
  if (haveM('coffee_table')) {
    mdl(g, 'coffee_table', sx, .32, sz + 1.40, 0);
  } else {
    slab(g, MT.espresso, sx - 1.3, sx + 1.3, .32, .60, sz + .9, sz + 1.9);
    slab(g, MT.espressoPlain, sx - 1.34, sx + 1.34, .58, .63, sz + .86, sz + 1.94);
  }

  /* a dark stone-clad pier between the closed and folded glazing (f016).
     Moved 1.9 m with GW.closedX1 when the plan was mirrored — it marks that
     joint, and left where it was it stood in the PREWEDDING spawn's way out
     to the deck. Keep the two in step (buildColliders has the matching rect). */
  slab(g, MT.stonePier, -3.95, -3.3, 0, H1, ZS - .95, ZS - .35);
  /* floor register plates in the marble */
  for (const rx of [-.6, 3.2]) slab(g, MT.brass, rx - .28, rx + .28, .001, .012, -14.5, -14.34);

  /* ── dining: 3.0 × 1.2 espresso table, 8 white high-back chairs ── */
  const dx = DINING_X, dz = -19.5;
  /* 3.000 × 1.200 × 0.770 on its two ribbed plinth legs, origin floor centre
     and exact (top and both legs are symmetric about (dx, dz)); front −Z is
     nominal, so ry = 0. colRect(DINING_X ± 1.50, −20.1, −18.9, r .36) is
     measured on the TOP's footprint and nothing here exceeds it. */
  if (haveM('suite_dining_table')) {
    mdl(g, 'suite_dining_table', dx, 0, dz, 0);
  } else {
    slab(g, MT.espresso, dx - 1.5, dx + 1.5, .70, .77, dz - .6, dz + .6);
    slab(g, MT.espressoPlain, dx - 1.05, dx - .55, 0, .70, dz - .42, dz + .42);
    slab(g, MT.espressoPlain, dx + .55, dx + 1.05, 0, .70, dz - .42, dz + .42);
  }
  for (let i = 0; i < 4; i++) {
    const cx = dx - 1.12 + i * .75;
    chair(g, cx, dz - 1.05, 0);
    chair(g, cx, dz + 1.05, Math.PI);
  }
  /* sideboard on the west wall + two dark-shade table lamps */
  slab(g, MT.maroon, wx + .06, wx + .58, .12, .82, dz - 1.2, dz + 1.2);
  slab(g, MT.espressoPlain, wx + .04, wx + .62, .80, .86, dz - 1.24, dz + 1.24);
  tableLamp(g, wx + .34, .86, dz - .8, .42);
  tableLamp(g, wx + .34, .86, dz + .8, .42);
  /* brass spots over the table */
  downlights(g, dx - 1.2, dx + 1.2, dz - .3, dz + .3, H1 - .18, 3, 1, .055);

  /* ── teal blackout curtains stacked at both ends of the glass wall ── */
  curtainPanel(g, -7.05, ZS - .28, .8, 2.95);
  curtainPanel(g, -6.25, ZS - .28, .7, 2.95);
  curtainPanel(g, 6.9, ZS - .28, .8, 2.95);
  slab(g, MT.espressoPlain, GW.x0 - .1, GW.x1 + .1, 2.96, 3.06, ZS - .38, ZS - .22);   // curtain pelmet
}

/* ── small furniture helpers ─────────────────────────────────────────── */

/** White high-back leather dining chair on dark legs. */
function chair(parent, x, z, ry) {
  /* `dining_chair_white` is the CHAIR FAMILY, the one exception to
     ASSET_SPEC's "front faces −Z": its front is +Z, which is the same +Z this
     helper's own back panel sits behind (z −.26 … −.18). So the caller's yaw
     drops straight in — `chair(g, cx, dz − 1.05, 0)` still faces the table,
     and the far row keeps its own π. The origin is the SEAT centre (not the
     bbox: the back's 20 mm overhang would have put the group 10 mm out), which
     is exactly where this group's origin was. mdl() applies the same mx() and
     the same −ry the Group did, and the chair is X-symmetric, so the mirror is
     a no-op on it. No collider of its own — the chairs are walked through
     today and still will be. */
  if (haveM('dining_chair_white')) return mdl(parent, 'dining_chair_white', x, 0, z, ry);
  const c = new THREE.Group();
  slab(c, MT.ivoryWhite, -.24, .24, .44, .50, -.24, .24);
  slab(c, MT.ivoryWhite, -.24, .24, .50, 1.10, -.26, -.18);
  for (const lx of [-.2, .2]) for (const lz of [-.2, .2]) {
    slab(c, MT.espressoPlain, lx - .025, lx + .025, 0, .44, lz - .025, lz + .025);
  }
  c.position.set(mx(x), 0, z);
  c.rotation.y = -ry;
  parent.add(c);
  return c;
}

/* The shade's shared material is registered for day/night exactly ONCE, the
   first time a lamp is built — see the ⚠ in tableLamp(). models.material()
   hands out one material for every instance, so a second glow() registration
   would double-apply the night intensity. */
let _shadeGlowed = false;

/** Table lamp: slim base, dark shade with a glowing mouth. */
function tableLamp(parent, x, y, z, h = .42) {
  /* TWO GLBs, one point. `table_lamp` is the BRASS half — foot and stem;
     `table_lamp_shade` is the whole shade, drum and mouth together, on material
     `shade_emit` — models.js's /_emit$/ rule keeps it emissive, and an
     emissive material may not be mixed with lit ones inside one GLB. Both are
     BASE-origin, so both go at (x, y, z) with y the SURFACE, exactly as the
     four cylinders were placed. Front −Z is nominal: ry = 0.
     ⚠ GATED ON BOTH. The shade is the whole reason this prop reads at night,
     so if only half the pair loaded we keep all four primitives rather than
     stand an unlit lamp on the sideboard.
     ⚠ FOUR CALL SITES, THREE HEIGHTS — .30 at the west credenza, .42 at the
     dining sideboard pair (which is what is modelled) and .40 on the 2F
     console. The other two are a uniform h / .42 off it; no single mesh can
     serve all three exactly, because the code scales the stem, shade and
     mouth by h and leaves the foot and the stem's radius constant.
     ⚠ NO LIGHT CHANGES HANDS. Both halves are meshes, as the cylinders were;
     MT.downlight keeps its day/night registration for the ceiling grids that
     downlights() draws, and the suite's eight PointLights are untouched.
     ⚠ THE WHOLE DRUM IS THE LAMP. MT.lampShade below is EMISSIVE —
     glow(.05, 1.5), DoubleSide, open-ended — so the primitive's entire drum
     lights up after dark, and that is what a night scene reads as "the lamp is
     on", not the mouth. The first cut of this prop left the drum in the brass
     GLB as a plain dielectric and only lit the recessed mouth disc, and the
     suite's lamps went dark at night. The drum is on the emissive half now, and
     it takes the SAME day/night pair the primitive had, through the same
     glow() registry — without which the loader's floor of emissiveIntensity 1
     on any *_emit material would leave it lit in broad daylight. */
  if (haveM('table_lamp') && haveM('table_lamp_shade')) {
    const s = h / .42;
    mdl(parent, 'table_lamp', x, y, z, 0, s);
    mdl(parent, 'table_lamp_shade', x, y, z, 0, s);
    if (!_shadeGlowed) {
      const sm = models.material('table_lamp_shade');
      if (sm) { glow(sm, .05, 1.5); _shadeGlowed = true; }
    }
    return;
  }
  cyl(parent, MT.brass, .07, .1, .04, x, y + .02, z, 12);
  cyl(parent, MT.brass, .018, .018, h * .55, x, y + h * .3, z, 8);
  cyl(parent, MT.lampShade, h * .34, h * .44, h * .5, x, y + h * .75, z, 16, true);
  cyl(parent, MT.downlight, h * .3, h * .3, .02, x, y + h * .52, z, 12);
}

/** Full-height teal blackout curtain panel with soft vertical folds. */
function curtainPanel(parent, x, z, w, h) {
  const n = Math.max(3, Math.round(w / .18));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const cx = x - w / 2 + w * t;
    const d = .07 + .05 * Math.sin(t * Math.PI * 5);
    slab(parent, MT.curtain, cx - w / n / 2, cx + w / n / 2, 0, h, z - d, z + d);
  }
}

/**
 * Oversized sapele double door in a wall (axis as per wallRun).
 * `open` swings both leaves flat against the reveal on the `dir` side, so the
 * opening stays walkable — the collider chain leaves the same gap.
 */
function doubleDoor(parent, axis, fixed, a0, a1, h, open = false, dir = 1) {
  const mid = (a0 + a1) / 2, t = .07;
  /* `d` is the half-DEPTH of the piece being placed. It defaults to the frame's
     t; the closed leaves and their handles pass deeper values so no two faces
     end up coplanar (see the closed branch). */
  const put = (b0, b1, y0, y1, m, d = t) => {
    if (axis === 'x') slab(parent, m, b0, b1, y0, y1, fixed - d, fixed + d);
    else slab(parent, m, fixed - d, fixed + d, y0, y1, b0, b1);
  };
  if (open) {
    /* a real cased opening — jambs + head only. The old branch drew the
       closed state's full "frame + head" slab first, which FILLS the
       doorway: an "open" door read as a shut dark panel from both sides,
       and wherever the collider chain had a matching gap the walker could
       ghost straight through the panel — exactly the "gap behind closed
       door geometry" state CLAUDE.md warns is worse than either. */
    put(a0 - .09, a0, 0, h + .09, MT.sapeleDark);           // west/near jamb
    put(a1, a1 + .09, 0, h + .09, MT.sapeleDark);           // east/far jamb
    put(a0, a1, h, h + .09, MT.sapeleDark);                 // head
    const lw = (a1 - a0) / 2 - .03;
    for (const a of [a0, a1]) {
      if (axis === 'x') slab(parent, MT.maroon, a - .035, a + .035, 0, h,
        fixed + dir * .05, fixed + dir * (.05 + lw));
      else slab(parent, MT.maroon, fixed + dir * .05, fixed + dir * (.05 + lw),
        0, h, a - .035, a + .035);
    }
    return;
  }
  /* CLOSED: sapele frame slab with the two maroon leaves standing 20 mm PROUD
     of it on BOTH faces (t .07 → .09), and the handles 20 mm proud of the
     leaves again (→ .11). Drawn at the same depth they were coplanar with the
     backing slab and z-fought at close range — the long-standing "closed door
     shimmers" bug from CLAUDE.md. 20 mm edge-to-edge is the house minimum. */
  put(a0 - .09, a1 + .09, 0, h + .09, MT.sapeleDark);      // frame + head
  put(a0, mid - .015, 0, h, MT.maroon, t + .02);           // leaves, proud of the frame
  put(mid + .015, a1, 0, h, MT.maroon, t + .02);
  put(mid - .32, mid - .28, .95, 1.15, MT.brass, t + .04); // handles, proud of the leaves
  put(mid + .28, mid + .32, .95, 1.15, MT.brass, t + .04);
}

/* ══════════════════════════════════════════════════════════════════════
   9 · PANTRY / BAR — NW corner (SITE.SUITE.pantry)
   Red lattice display screen, burgundy island with a white stone top, back
   counter + sink + mirror splash, striated grey stone column (f021–f024).
   ══════════════════════════════════════════════════════════════════════ */
function buildPantry(root) {
  const g = new THREE.Group();
  root.add(g);

  const nz = ZN + EWT / 2 + .06;            // -26.32 wall face
  const wx = X0 + EWT / 2 + .06;            //  -7.82 wall face

  /* maroon lining on the pantry's own walls */
  wallRun(g, MT.maroon, 'x', nz, .12, X0, P_X1, 0, H1, [[-7.4, -6.0, 2.2]]);
  wallRun(g, MT.maroon, 'z', wx, .12, ZN, P_ZS, 0, H1);
  doubleDoor(g, 'x', nz - .02, -7.4, -6.0, 2.2);          // service door
  /* part-height partition to the dining area */
  wallRun(g, MT.maroon, 'z', P_X1, WT, ZN, -24.6, 0, H1);

  /* ── red lattice display screen (south face of the pantry) ── */
  const lz = P_ZS, lx0 = X0 + .2, lx1 = -5.55, lh = 2.45;
  for (const x of [lx0, -7.2, -6.5, -6.0, lx1]) {
    slab(g, MT.latticeRed, x - .045, x + .045, .95, lh, lz - .14, lz + .14);
  }
  for (const y of [.95, 1.36, 1.78, 2.16, lh]) {
    slab(g, MT.latticeRed, lx0, lx1, y - .04, y + .04, lz - .14, lz + .14);
  }
  slab(g, MT.latticeRed, lx0, lx1, .0, .95, lz - .16, lz + .16);      // solid base
  /* a couple of ornaments on the lattice shelves */
  cyl(g, MT.stoneTop, .14, .1, .09, -6.85, 1.45, lz, 14);
  slab(g, MT.stoneTop, -6.3, -5.85, 1.82, 1.92, lz - .1, lz + .1);
  cyl(g, MT.ivoryWhite, .1, .07, .22, -7.5, 2.27, lz, 12);

  /* ── island: 2.0 × 0.9, burgundy body + white stone top ── */
  slab(g, MT.maroon, -7.3, -5.3, 0, .86, -24.75, -23.85);
  slab(g, MT.stoneTop, -7.36, -5.24, .86, .93, -24.81, -23.79);

  /* ── back counter + sink + mirror backsplash (room is +z of nz) ── */
  slab(g, MT.maroon, X0 + .15, -5.2, 0, .88, nz + .02, nz + .62);
  slab(g, MT.stoneTop, X0 + .15, -5.2, .88, .94, nz + .02, nz + .66);
  slab(g, MT.chrome, -6.9, -6.3, .84, .89, nz + .12, nz + .52);       // sink basin
  cyl(g, MT.chrome, .022, .022, .3, -6.6, 1.09, nz + .5, 10);          // tap
  slab(g, MT.mirror, X0 + .15, -5.2, .96, 1.95, nz + .01, nz + .04);
  slab(g, MT.maroon, X0 + .15, -5.2, 1.95, H1 - .1, nz + .02, nz + .38);
  downlights(g, X0 + .4, -5.4, nz + .2, nz + .5, 1.94, 4, 1, .04);

  /* ── striated silver-grey stone column (the big one in f022) ── */
  slab(g, MT.greyStone, -5.2, -4.35, 0, H1, -24.05, -23.2);

  slab(g, MT.ceiling, X0, P_X1, H1 - .04, H1, ZN, P_ZS);
  downlights(g, X0 + .5, P_X1 - .5, ZN + .6, P_ZS - .6, H1 - .06, 3, 2);
}

/* ══════════════════════════════════════════════════════════════════════
   10 · THE STAIRCASE — the hero element
   L-shaped dog-leg with a quarter landing: long upper flight (14 risers,
   N–S) → landing → short lower flight (8 risers, E→W) landing facing the
   sofa. White marble treads, frameless glass balustrade + round sapele
   handrail, glossy black horizontal-grooved spine wall on the inner side,
   backlit frosted-louver glazing on the outer side, and a 3-tier
   champagne-gold crystal chandelier in the double-height void.
   ══════════════════════════════════════════════════════════════════════ */
function buildStair(root, G) {
  const g = new THREE.Group();
  root.add(g);

  const upAng = Math.atan2(13 * RISE, 13 * ST.goUp);     // upper flight rake
  const loAng = Math.atan2(7 * RISE, 7 * ST.goLo);       // lower flight rake

  /* ── lower flight: 7 treads + the landing as the 8th riser, running E→W ── */
  for (let i = 1; i <= 7; i++) {
    const x0 = ST.loX0 + (i - 1) * ST.goLo, x1 = x0 + ST.goLo;
    slab(g, MT.marbleTread, x0, x1 + .03, 0, i * RISE, ST.lzN, ST.lzS);
  }
  /* ── quarter landing ── */
  slab(g, MT.marbleTread, ST.lx0, ST.lx1, 0, ST.lyY, ST.lzN, ST.lzS);

  /* ── upper flight: 13 treads climbing south from the landing ── */
  for (let i = 1; i <= 13; i++) {
    const z0 = ST.lzS + (i - 1) * ST.goUp, z1 = z0 + ST.goUp;
    const y = ST.lyY + i * RISE;
    slab(g, MT.marbleTread, ST.lx0, ST.lx1, y - .06, y, z0, z1 + .03);   // tread
    slab(g, MT.marbleTread, ST.lx0, ST.lx1, y - RISE, y - .06, z0, z0 + .05);  // riser
  }
  /* raking soffit under the upper flight — the diagonal read from the room */
  {
    const len = Math.hypot(13 * ST.goUp, 13 * RISE) + .5;
    const m = new THREE.Mesh(new THREE.BoxGeometry(ST.w, .22, len), MT.black);
    m.position.set(mx((ST.lx0 + ST.lx1) / 2), (ST.lyY + YF2) / 2 - .17,
      (ST.lzS + ST.zS) / 2);
    m.rotation.x = -upAng;
    g.add(m);
  }

  /* ── the glossy black horizontal-grooved spine ────────────────────
     A black slab on the living-room side and a full-height return across the
     north. SPLIT 2026-08-04: wall A used to run the stair zone's full z span
     (zN … −21.0) at full height — which stood a wall directly ACROSS the
     lower flight's mouth. The brief (suite-interior-brief.md §3, f011) says
     the lower flight LANDS FACING THE SOFA — the mouth is open to the room —
     so over the flight's own band (zN … lzS) the spine is now a deep black
     HEADER from ST.spineHeadY up: the dark mass still reads from the great
     room (f029–f031) and still fronts the 2F lounge slab edge, but a walker
     boards the stair head-on beneath it. Full height remains beside the
     double-height void (lzS … −21.0), where the chandelier hangs. The
     matching collider split is in buildColliders. */
  slab(g, MT.blackTall, ST.x0, ST.x0 + .3, 0, Y2C, ST.lzS, -21.0);
  slab(g, MT.blackTall, ST.x0, ST.x0 + .3, ST.spineHeadY, Y2C, ST.zN, ST.lzS);
  slab(g, MT.blackTall, ST.x0, X1, 0, Y2C, ST.zN - .22, ST.zN);
  /* REMOVED 2026-08-02 — the "low base rail": a 0.5 m solid black kerb that ran
     the FULL width of the stair zone (x0 → lx0) along the lower flight's south
     face. That face is the only approach to the stair from the great room, so
     the kerb walled the staircase off: 0.5 m is taller than CFG.STEP_UP (0.40),
     and it carried a collider besides. It is the dark mass across the foot of
     the flight in Carl's screenshot. The raking glass balustrade below
     (rakeRail 'x') already guards that edge, which is what a base rail is for —
     so this was redundant as well as wrong. Do not reinstate it without
     stopping it short of ST.loX0 + 1.4. */

  /* ── backlit frosted louver glazing, outer side (bronze mullion grid) ── */
  const fz0 = ST.zN + .3, fz1 = -21.0;
  slab(g, MT.frosted, X1 - .16, X1 + .04, 0, Y2C, fz0, fz1);
  for (let y = .5; y < Y2C; y += .58) {
    slab(g, MT.bronzeMullion, X1 - .19, X1 + .06, y - .025, y + .025, fz0, fz1);
  }
  for (let z = fz0; z <= fz1 + .01; z += (fz1 - fz0) / 4) {
    slab(g, MT.bronzeMullion, X1 - .19, X1 + .06, 0, Y2C, z - .035, z + .035);
  }
  slab(g, MT.bronzeMullion, X1 - .19, X1 + .06, 0, .12, fz0, fz1);
  slab(g, MT.bronzeMullion, X1 - .19, X1 + .06, Y2C - .12, Y2C, fz0, fz1);

  /* ── frameless glass balustrades + round sapele handrails ── */
  // raking, west edge of the upper flight
  rakeRail(g, 'z', ST.lx0 - .02, ST.lzS, ST.lyY, ST.zS, YF2, upAng);
  // raking, south edge of the lower flight
  rakeRail(g, 'x', ST.lzS + .02, ST.loX0, 0, ST.lx0, ST.lyY, loAng);
  // level, around the 2F void edges
  levelRail(g, 'z', ST.x0 - .02, -21.0, ST.zS, YF2);
  levelRail(g, 'x', ST.zS + .02, ST.x0, ST.lx0, YF2);

  /* ── the chandelier: 3 tiers of champagne-gold crystal strands ── */
  const chand = new THREE.Group();
  chand.position.set(mx(5.6), 0, -20.6);   // in the void, framed by the 2F slot
  g.add(chand);
  cyl(chand, MT.brassBright, .12, .12, .06, 0, Y2C - .05, 0, 16);
  cyl(chand, MT.brassBright, .022, .022, .5, 0, Y2C - .32, 0, 8);
  const tiers = [[.62, 1.55, 6.42], [.50, 1.55, 5.22], [.39, 1.55, 4.02]];
  for (const [r, h, top] of tiers) {
    cyl(chand, MT.crystal, r, r, h, 0, top - h / 2, 0, 26, true);
    cyl(chand, MT.brassBright, r + .02, r + .02, .05, 0, top, 0, 26, true);
  }
  cyl(chand, MT.crystal, .12, .01, .3, 0, 2.55, 0, 14, true);

  /* slow rotation + a gentle crystal shimmer */
  (G.tickers ||= []).push((dt, t) => {
    chand.rotation.y -= dt * .06;   // mirrored, like every other rotation.y
    const base = NIGHT ? 2.6 : .3;
    MT.crystal.emissiveIntensity = base * (1 + .07 * Math.sin(t * 1.7));
  });
}

/** Raking glass balustrade + round sapele handrail along a flight. */
function rakeRail(parent, axis, fixed, a0, y0, a1, y1, ang) {
  const len = Math.hypot(a1 - a0, y1 - y0) + .1;
  const mid = [(a0 + a1) / 2, (y0 + y1) / 2 + .5, fixed];
  const mk = (mat, w, h) => {
    const geo = axis === 'z' ? new THREE.BoxGeometry(w, h, len)
      : new THREE.BoxGeometry(len, h, w);
    const m = new THREE.Mesh(geo, mat);
    /* mirrored: X reflects, rotation.z negates with it, rotation.x doesn't */
    if (axis === 'z') { m.position.set(mx(fixed), mid[1], mid[0]); m.rotation.x = -ang; }
    else { m.position.set(mx(mid[0]), mid[1], fixed); m.rotation.z = -ang; }
    parent.add(m);
    return m;
  };
  mk(MT.glassRail, .022, .96);
  const hr = mk(MT.sapele, .062, .062);
  hr.position.y += .53;
}

/** Level glass balustrade + handrail along a 2F floor edge. */
function levelRail(parent, axis, fixed, a0, a1, y) {
  if (axis === 'z') {
    slab(parent, MT.glassRail, fixed - .011, fixed + .011, y, y + .98, a0, a1);
    const r = cyl(parent, MT.sapele, .031, .031, Math.abs(a1 - a0), fixed, y + 1.01, (a0 + a1) / 2, 10);
    r.rotation.x = Math.PI / 2;
  } else {
    slab(parent, MT.glassRail, a0, a1, y, y + .98, fixed - .011, fixed + .011);
    const r = cyl(parent, MT.sapele, .031, .031, Math.abs(a1 - a0), (a0 + a1) / 2, y + 1.01, fixed, 10);
    r.rotation.z = -Math.PI / 2;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   11 · EAST ANNEX — spa corridor + spa suite (SITE.SUITE.spa / corridorW)
   Corridor: mirror panel + cream daybed, a cased opening at the great room's
   NE corner and double doors back into the living room at its south end.
   Spa: backlit onyx wall w/ brass diagonal inlay, square jacuzzi in a dark
   wood surround, two navy massage beds, cream sofa, vanity, sheer-curtained
   glazing to a private courtyard (f033–f044).
   ══════════════════════════════════════════════════════════════════════ */
function buildAnnex(root) {
  const g = new THREE.Group();
  root.add(g);

  /* ── annex envelope ── */
  wallRun(g, MT.plaster, 'x', ZN, EWT, ANX_X0, ANX_X1, 0, H2);              // north
  wallRun(g, MT.plaster, 'z', ANX_X1, EWT, ZN, SPA_ZS, 0, H2, [[-25.2, -20.2, H2]]);
  wallRun(g, MT.plaster, 'x', SPA_ZS, EWT, COR_X1, ANX_X1, 0, H2, [[10.2, 13.2, H2]]);
  wallRun(g, MT.plaster, 'x', COR_ZS, EWT, ANX_X0, COR_X1, 0, H2, [[8.4, 9.3, 2.4]]);
  /* corridor / spa partition */
  wallRun(g, MT.maroon, 'z', COR_X1, WT, ZN, SPA_ZS, 0, H2, [[-23.6, -21.8, 2.4]]);
  wallRun(g, MT.plaster, 'z', COR_X1, WT, SPA_ZS, COR_ZS, 0, H2);
  /* the two courtyard glazings + their sheers */
  glazedBay(g, 'z', ANX_X1, -25.2, -20.2, .1, 2.7, 4);
  glazedBay(g, 'x', SPA_ZS, 10.2, 13.2, .1, 2.7, 3);
  glazedBay(g, 'x', COR_ZS, 8.4, 9.3, .1, 2.4, 1);
  slab(g, MT.sheer, ANX_X1 - .22, ANX_X1 - .18, .05, 2.72, -25.2, -20.2);
  slab(g, MT.sheer, 10.2, 13.2, .05, 2.72, SPA_ZS - .22, SPA_ZS - .18);
  curtainPanel(g, 13.72, -20.5, .5, 2.7);
  curtainPanel(g, 10.5, SPA_ZS - .3, .5, 2.7);

  /* ── corridor: mirror panel, cream daybed, stool ── */
  slab(g, MT.mirror, ANX_X0 + .04, ANX_X0 + .07, .35, 2.55, -26.2, -24.5);
  slab(g, MT.ivory, ANX_X0 + .12, ANX_X0 + .87, .18, .52, -25.9, -23.9);
  slab(g, MT.ivory, ANX_X0 + .12, ANX_X0 + .3, .52, .95, -25.9, -23.9);
  slab(g, MT.espressoPlain, ANX_X0 + .1, ANX_X0 + .9, .1, .2, -25.85, -23.95);
  cyl(g, MT.espressoPlain, .21, .19, .44, 9.1, .22, -22.4, 14);
  curtainPanel(g, 8.85, COR_ZS - .32, .9, 2.6);
  downlights(g, ANX_X0 + .3, COR_X1 - .3, ZN + .6, COR_ZS - .6, H2 - .06, 1, 5, .055);
  doubleDoor(g, 'z', X1, -19.2, -17.4, 2.4, true, 1);   // stands open into the corridor

  /* ── spa: backlit onyx feature wall + brass diagonal inlay ── */
  const ox = COR_X1 + .14;
  slab(g, MT.onyx, ox, ox + .06, 0, H2, -25.6, -21.0);
  for (let i = 0; i < 5; i++) {                       // diagonal brass inlay
    const m = new THREE.Mesh(new THREE.BoxGeometry(.02, .045, 4.3), MT.brassBright);
    m.position.set(mx(ox + .05), .55 + i * .62, -23.3);
    m.rotation.x = .34;
    g.add(m);
  }
  slab(g, MT.brassBright, ox, ox + .07, 0, .07, -25.6, -21.0);

  /* cream two-seat sofa against the onyx wall + side table */
  slab(g, MT.ivory, ox + .1, ox + 1.0, .16, .48, -24.3, -22.5);
  slab(g, MT.ivory, ox + .1, ox + .32, .48, .96, -24.3, -22.5);
  slab(g, MT.espressoPlain, ox + .08, ox + 1.02, .06, .16, -24.25, -22.55);
  box(g, MT.teal, .36, .34, .14, ox + .45, .68, -23.9, .2);
  cyl(g, MT.espressoPlain, .26, .24, .46, ox + .55, .23, -21.9, 16);

  /* square jacuzzi, 2.2 × 2.2, dark wood surround */
  slab(g, MT.sapeleDark, 11.3, 13.5, 0, .9, -25.7, -23.5);
  slab(g, MT.white, 11.42, 13.38, .82, .94, -25.58, -23.62);
  slab(g, MT.water, 11.6, 13.2, .74, .84, -25.4, -23.8);
  for (const hz of [-25.2, -24.0]) slab(g, MT.navy, 12.0, 12.55, .84, .92, hz - .1, hz + .1);

  /* two navy massage beds on blond folding legs.
     `massage_bed` is the whole table — pad, rolled bolster, tapered splayed
     legs, apron and two stretchers. Origin floor centre, exact (the pad IS
     the bbox in plan); FRONT −Z is the HEAD, the bolster end, which is this
     room's −z, so ry = 0 and the mirror is a no-op on both the shape and the
     yaw. z = −20.95 is the midpoint of the pad's own −21.90 … −20.00.
     ⚠ colRect(11.5, −21.9, 13.4, −20.0, r .3) is ONE ring round BOTH beds and
     it does not move: the GLB is 0.701 × 1.902 against the slabs' 0.700 ×
     1.900, i.e. 0.5 mm proud a side, three hundred times inside the 0.15 m
     the spec allows before a collider is even discussed. */
  for (const bx of [11.85, 13.05]) {
    if (haveM('massage_bed')) {
      mdl(g, 'massage_bed', bx, 0, -20.95, 0);
      continue;
    }
    slab(g, MT.navy, bx - .35, bx + .35, .62, .74, -21.9, -20.0);
    slab(g, MT.espressoPlain, bx - .3, bx + .3, .74, .82, -21.85, -21.55);   // bolster
    for (const bz of [-21.7, -20.2]) {
      slab(g, MT.ivoryWhite, bx - .3, bx - .25, 0, .62, bz - .03, bz + .03);
      slab(g, MT.ivoryWhite, bx + .25, bx + .3, 0, .62, bz - .03, bz + .03);
    }
  }

  /* vanity / powder corner: vessel basin, amber mosaic splash, mirror */
  const vz = ZN + EWT / 2 + .1;
  slab(g, MT.sapeleDark, 10.3, 12.3, .55, .85, vz, vz + .55);
  slab(g, MT.mosaic, 10.3, 12.3, .85, 1.65, vz - .02, vz + .04);
  slab(g, MT.mirror, 10.5, 12.1, 1.7, 2.55, vz - .02, vz + .01);
  cyl(g, MT.white, .19, .16, .16, 11.3, .93, vz + .28, 18);
  cyl(g, MT.chrome, .02, .02, .28, 11.3, 1.0, vz + .07, 10);
  downlights(g, 10.5, 12.1, vz + .2, vz + .4, H2 - .06, 3, 1, .05);
  downlights(g, 10.4, 13.6, -25.2, -20.6, H2 - .06, 3, 3, .06);
}

/* ══════════════════════════════════════════════════════════════════════
   12 · SECOND FLOOR — lounge + balcony + stair hall (+ a blocked-in bedroom
   wing that the video NEVER shows; see the UNVERIFIED note below)
   ══════════════════════════════════════════════════════════════════════ */
/* ══ THE 2F MODULAR SOFA'S YAW — THE ONE PLACE THE MIRROR IS NOT A NO-OP ══
   Every other Group G asset is placed at ry 0 or π, and those are their own
   negatives, so §1a's reflection leaves them alone. This one is not, and the
   sign here is the difference between a curved sofa and four boxes thrown at
   a rug. ASSET_SPEC Group G and INTEGRATION both state the rule as
   "rotation.y = a + Math.PI, i.e. the call site passes −(a + Math.PI)".
   ⚠ THAT IS ONE SIGN OUT, and it is out because the premise under it is:
   the spec says `rotation.y = a` "points the PRIMITIVE's +Z outward". It does
   not. Measured off the live build before this pass (the four seat boxes'
   own position/rotation, read out of the scene graph):

       i   a        built centre            rotation.y   radial bearing
       0  −1.05   ( 4.038, −18.131)           −1.05          +1.05
       1  −0.53   ( 3.188, −17.272)           −0.53          +0.53
       2  −0.01   ( 2.023, −16.950)           −0.01          +0.01
       3  +0.51   ( 0.853, −17.249)           +0.51          −0.51

   The modules sit on the ring at bearing −a (mx() negated the x that put them
   there) while box() left their rotation at +a, so each primitive is 2a out of
   radial — 120° at the ring's first module. The give-away in the old code is
   `back.translateZ(−.42)`: it should put every backrest on r 1.93, and it puts
   them on 2.588 / 2.176 / 1.930 / 2.161. The mirror pass reflected these
   POSITIONS and kept their ROTATIONS, which is the half-mirrored state §1a
   exists to prevent; it survived because four white boxes on a curve look
   scattered either way, and the pillow rides the same wrong yaw so nothing
   detaches.

   An annulus sector does NOT survive that. Its two side faces are radial
   planes, so it only abuts its neighbours when its own axis IS the radius:
       front (−Z) must point at the radial bearing −a
    →  rotation.y + π = −a
    →  rotation.y = −a − π   (≡ π − a)
   which is what this returns, since mdl() negates its argument exactly as
   box() does. Shot both ways at the same camera before choosing: π − a is one
   continuous crescent at the code's own r 1.79/2.85 and .52 rad pitch; the
   spec's a + π is four separate blocks with gaps between them and the end
   modules turned across the curve.

   The PRIMITIVE fallback below is deliberately left exactly as it was — this
   pass swaps furniture, it does not quietly re-point a fallback nobody will
   see — and the teal accent pillow (not in the GLB) keeps its own yaw too.
   All four pillows still land inside their own module's footprint. */
const GLB_2F_RY = (a) => a + Math.PI;

function buildSecondFloor(root) {
  const g = new THREE.Group();
  root.add(g);

  const BZ = -21.0;                       // lounge / bedroom-wing partition
  const balZ = ZS + S.balconyD;           // -11.5

  /* ── floor finishes ── */
  slab(g, MT.dark2F, X0, ST.x0, YF2 - .02, YF2 + .015, BZ, ZS);        // lounge
  slab(g, MT.marble, ST.x0, X1, YF2 - .02, YF2 + .015, ST.zS, ZS);     // stair hall
  slab(g, MT.dark2F, X0, ST.x0, YF2 - .02, YF2 + .015, ZN, BZ);        // bedroom wing

  /* ── 2F south glazing + the dark timber louver band at the window head ── */
  glazedBay(g, 'x', ZS, X0 + .6, X1 - .6, YF2 + .05, YF2 + 2.62, 12);
  slab(g, MT.espressoPlain, X0 + .5, X1 - .5, YF2 + 2.62, Y2C - .06, ZS - .16, ZS - .04);
  for (let y = YF2 + 2.7; y < Y2C - .1; y += .12) {
    slab(g, MT.sapeleDark, X0 + .5, X1 - .5, y, y + .05, ZS - .2, ZS - .16);
  }

  /* ── balcony: slab, glass balustrade, white outdoor dining set ── */
  slab(g, MT.spaFloor, X0 + .5, X1 - .5, YF2 - .18, YF2 - .02, ZS, balZ);
  levelRail(g, 'x', balZ - .06, X0 + .5, X1 - .5, YF2 - .02);
  levelRail(g, 'z', X0 + .56, ZS, balZ, YF2 - .02);
  levelRail(g, 'z', X1 - .56, ZS, balZ, YF2 - .02);
  slab(g, MT.white, -1.4, 1.4, YF2 + .68, YF2 + .74, balZ - 1.4, balZ - .6);
  for (const cx of [-1.1, 1.1]) for (const cz of [balZ - 1.25, balZ - .75]) {
    slab(g, MT.white, cx - .04, cx + .04, YF2 - .02, YF2 + .68, cz - .04, cz + .04);
  }
  for (let i = 0; i < 4; i++) {
    const cx = -.9 + i * .6;
    slab(g, MT.white, cx - .2, cx + .2, YF2 + .4, YF2 + .46, balZ - 1.2, balZ - .8);
    slab(g, MT.white, cx - .2, cx + .2, YF2 + .46, YF2 + .95, balZ - .84, balZ - .8);
  }

  /* ── teal blackout curtains, full height (f001) ── */
  for (const cx of [X0 + 1.1, -3.2, 2.2, X1 - 1.3]) {
    curtainPanel2F(g, cx, ZS - .3, 1.0, YF2 + .06, 2.6);
  }
  slab(g, MT.espressoPlain, X0 + .5, X1 - .5, YF2 + 2.66, YF2 + 2.76, ZS - .42, ZS - .26);

  /* ── the curved white modular sofa on a teal rug ── */
  slab(g, MT.rug, -4.6, .6, YF2 + .016, YF2 + .028, -19.4, -15.6);
  const arcC = [-2.0, -19.3], R = 2.35;
  for (let i = 0; i < 4; i++) {
    const a = -1.05 + i * .52;
    const cx = arcC[0] + Math.sin(a) * R, cz = arcC[1] + Math.cos(a) * R;
    /* ONE CURVED MODULE, origin on its own radial centre line at r 2.35 —
       the point box() puts the straight module at — so it drops in at
       (cx, YF2, cz) with no offset. The yaw is the whole story: see
       GLB_2F_RY above. NOT in the GLB and still drawn below: the teal accent
       pillow, the ottoman and the 2F coffee table. No colliders here at all
       (buildColliders registers nothing upstairs but walls and stair), so
       only the silhouette is load-bearing. */
    if (haveM('modular_sofa_2f')) {
      mdl(g, 'modular_sofa_2f', cx, YF2, cz, GLB_2F_RY(a));
    } else {
      const seat = box(g, MT.ivoryWhite, 1.25, .42, 1.0, cx, YF2 + .21, cz, -a);
      const back = box(g, MT.ivoryWhite, 1.25, .5, .28, cx, YF2 + .55, cz - .0, -a);
      back.translateZ(-.42);
      void seat;
    }
    box(g, i % 2 ? MT.teal : MT.tealDeep, .34, .32, .13, cx, YF2 + .52, cz, -a + .2)
      .translateZ(-.26);
  }
  cyl(g, MT.ivoryWhite, .62, .6, .38, -3.4, YF2 + .19, -16.6, 20);       // round ottoman
  slab(g, MT.espressoPlain, -2.6, -.9, YF2 + .02, YF2 + .36, -17.3, -16.3);  // coffee table

  /* ── TV on the dark panel wall + console with a brass lamp ── */
  wallRun(g, MT.maroonTall, 'x', BZ + .14, .14, X0, ST.x0, YF2, Y2C,
    [[-6.6, -5.6, YF2 + 2.35], [-1.6, -.6, YF2 + 2.35]]);   // heads are absolute Y
  slab(g, MT.espressoPlain, -4.6, -2.2, YF2 + .9, YF2 + 2.25, BZ + .2, BZ + .27);
  slab(g, MT.tv, -4.4, -2.4, YF2 + 1.0, YF2 + 2.12, BZ + .27, BZ + .3);
  slab(g, MT.espressoPlain, -4.9, -1.9, YF2 + .3, YF2 + .62, BZ + .2, BZ + .66);
  slab(g, MT.espressoPlain, ST.x0 - .95, ST.x0 - .1, YF2 + .68, YF2 + .76, -18.0, -16.4);
  tableLamp(g, ST.x0 - .5, YF2 + .76, -17.2, .4);
  /* two side chairs + a small table, west end */
  for (const cz of [-17.4, -16.2]) {
    slab(g, MT.ivoryWhite, X0 + .8, X0 + 1.5, YF2 + .36, YF2 + .46, cz - .34, cz + .34);
    slab(g, MT.ivoryWhite, X0 + .8, X0 + .92, YF2 + .46, YF2 + 1.0, cz - .34, cz + .34);
  }
  cyl(g, MT.espressoPlain, .25, .23, .45, X0 + 1.9, YF2 + .22, -16.8, 14);

  /* ── stair hall: maroon panels + the black spine already runs full height ── */
  wallRun(g, MT.maroonTall, 'z', ST.x0 - .16, .14, ST.zS, ZS - .8, YF2, Y2C);
  slab(g, MT.brass, ST.x0 - .24, ST.x0 - .08, YF2, YF2 + .09, ST.zS, ZS - .8);

  /* ── UNVERIFIED: bedroom wing. The walkthrough never enters it (brief §8.1),
     so this is a plausible block-in only — two doors off the lounge, two bed
     volumes, no detail. Replace when Carl supplies the 2F room tour. ── */
  wallRun(g, MT.plaster, 'z', -2.6, WT, ZN, BZ, YF2, Y2C);
  for (const [bx, bz] of [[-5.3, -23.6], [.6, -23.6]]) {
    slab(g, MT.ivory, bx - .95, bx + .95, YF2, YF2 + .55, bz - 1.05, bz + 1.05);
    slab(g, MT.ivoryWhite, bx - .95, bx + .95, YF2 + .55, YF2 + .68, bz - 1.05, bz + .75);
    slab(g, MT.sapeleDark, bx - 1.0, bx + 1.0, YF2 + .55, YF2 + 1.35, bz - 1.15, bz - 1.05);
    slab(g, MT.white, bx - .8, bx - .1, YF2 + .68, YF2 + .78, bz - .95, bz - .55);
    slab(g, MT.white, bx + .1, bx + .8, YF2 + .68, YF2 + .78, bz - .95, bz - .55);
  }
  downlights(g, X0 + 1, ST.x0 - 1, ZN + 1, BZ - 1, Y2C - .06, 3, 2);

  /* ── 2F ceiling: flat white with a coffer over the lounge ── */
  slab(g, MT.ceiling, X0, X1, Y2C - .05, Y2C, ZN, ZS);
  coffer(g, -6.4, 2.6, -19.8, -14.6, Y2C, .14, .38);
  downlights(g, -5.8, 2.0, -19.2, -15.2, Y2C - .02, 4, 3);
  downlights(g, ST.x0 + .4, X1 - .4, ST.zS + .4, ZS - .6, Y2C - .02, 2, 3);
}

/** Teal curtain panel that hangs from a 2F sill (y0) down a given height. */
function curtainPanel2F(parent, x, z, w, y0, h) {
  const n = Math.max(3, Math.round(w / .18));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const cx = x - w / 2 + w * t;
    const d = .07 + .05 * Math.sin(t * Math.PI * 5);
    slab(parent, MT.curtain, cx - w / n / 2, cx + w / n / 2, y0, y0 + h, z - d, z + d);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   13 · LIGHTING — 8 real PointLights, everything else emissive
   The downlight grids, coffer coves, frosted stair wall, onyx wall, table
   lamps, TVs and the chandelier crystals are all emissive materials; these
   eight lights are the only real ones inside the suite (budget ≤ 8).
   ══════════════════════════════════════════════════════════════════════ */
const REAL_LIGHTS = [
  // [x, y, z, dist, dayI, nightI, dayHex, nightHex]
  [LIVING_X, 2.95, -17.0, 17, 18, 40, 0xfff3e2, 0xffcf95],   // great room / living
  [DINING_X, 2.90, -19.5, 12, 12, 26, 0xfff3e2, 0xffcb8c],   // dining table
  [-6.30, 2.85, -24.30, 10, 8, 18, 0xfff3e2, 0xffd0a0],      // pantry / bar
  [5.60, 4.40, -20.60, 20, 14, 46, 0xfff0d0, 0xffd08a],      // the chandelier
  [7.40, 2.40, -22.80, 9, 6, 18, 0xf4f6ff, 0xfff0d2],        // backlit stair wall
  [11.80, 2.50, -23.00, 13, 10, 24, 0xfff3e2, 0xffd8ac],     // spa / onyx wall
  [8.80, 2.50, -23.50, 9, 5, 12, 0xfff3e2, 0xffd0a0],        // spa corridor
  [-2.00, 6.30, -17.20, 16, 14, 30, 0xfff3e2, 0xffcf95],     // 2F lounge
];

function buildLighting(root, G) {
  void G;
  for (const [x, y, z, dist, dayI, nightI, dayHex, nightHex] of REAL_LIGHTS) {
    const l = new THREE.PointLight(0xffffff, 1, dist, 2);
    l.position.set(mx(x), y, z);
    nightLight(l, dayI, nightI, dayHex, nightHex);
    root.add(l);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   14 · COLLIDERS — chains of {x,z,r} cylinders (house pattern)
   NOTE: the folded-open span of the glass wall (SITE-space x -6.15 … 3.2, i.e.
   -3.2 … 6.15 in this file's mirrored authoring frame) is left deliberately
   COLLIDER-FREE so a walker can stroll straight in from the pool deck — and a
   flyer can come in through the same gap. Authored X goes through mx().
   ══════════════════════════════════════════════════════════════════════ */
function buildColliders() {
  /* r is the GEOMETRY radius — CFG.PLAYER_R is added at test time (house rule),
     so keep it honest to the wall half-thickness or openings stop being
     walkable: every opening loses 2 × (r + PLAYER_R) ≈ 1.15 m of clear width. */
  const WR = .22;
  /* the 1F-furniture height window — see the great-room block below */
  const F1 = { y1: YF2 - .4 };
  const nz = ZN + EWT / 2, wx = X0 + EWT / 2, ex = X1 - EWT / 2;

  /* ── main envelope ── */
  /* north: BROKEN at the entry double doors (authoring x −3.4…−1.6, SITE
     x 1.6…3.4 after mx()) — the documented way out to the atrium portal.
     Each run stops 0.35 past its jamb (the atrium's SKIP_PAD): the passable
     band for the player's CENTRE is (−3.75 + WR + .35) … (−1.25 − WR − .35)
     = 1.36 m clear — over the 1.2 m house minimum, and still narrower than
     the 1.73 m the open leaves show, so the collider stays stricter than
     the geometry, never looser. The pantry service door (−7.4…−6.0) stays
     drawn closed and stays sealed. */
  colLine(X0, nz, -3.75, nz, WR);                    // north, W of the entry
  colLine(-1.25, nz, X1, nz, WR);                    // north, E of the entry
  /* west in THIS file's frame = the suite's EAST wall in SITE terms, and it
     now has a 2F door in it (see buildShell). The gap must exist ONLY up
     there: at 1F this is the solid wall behind the sofa island. So the run is
     split — full height either side of the door, and a y1-capped run across
     it that still stops a ground-floor walker. Each half stops SKIP_PAD-style
     0.32 past its jamb, leaving 2.0 − 2 × (.22 + .35) + 2 × .32 = 1.50 m of
     clear walking, wider than the house 1.2 m minimum and still narrower than
     the 2.0 m opening — stricter than the geometry, never looser. */
  colLine(wx, ZN, wx, LINK_DOOR.z0 - .32, WR);       // west, N of the 2F door
  colLine(wx, LINK_DOOR.z1 + .32, wx, ZS, WR);       // west, S of the 2F door
  colLine(wx, LINK_DOOR.z0 - .32, wx, LINK_DOOR.z1 + .32, WR, 0, { y1: YF2 - .4 });
  colLine(ex, ZN, ex, -26.3, WR);                    // east, north of the opening
  colLine(ex, -24.45, ex, -19.3, WR);                // east, between the two doors
  colLine(ex, -17.3, ex, ZS, WR);                    // east, south of the doors

  /* ── south face: corner piers + the CLOSED leaves only ── */
  colLine(X0, ZS - .2, X0 + 1.0, ZS - .2, WR);
  colLine(X1 - 1.0, ZS - .2, X1, ZS - .2, WR);
  /* ⚠ The CLOSED leaves keep an all-heights chain deliberately: the 2F is
     glazed on this plane too, so that run is the 2F glazing's guard as well. */
  colLine(GW.x0, ZS, GW.closedX1, ZS, .26);          // closed bi-fold leaves
  /* …the pier and the leaf stack do NOT. Both are 1F-only solids under the 2F
     slab — the pier is a slab(0 … H1) and the stack is 8 leaves of GW.leafH
     (2.8) — and without y1 each stood invisibly in the 2F rooms above. The
     leaf stack is CLAUDE.md's "the folded-leaf stack's colRect bleeds into the
     2F hall's SW corner (stall at lx −5.54)"; this is the fix for it. */
  colRect(-3.95, ZS - .95, -3.3, ZS - .35, .3, F1);  // stone pier (moves with closedX1)
  colRect(6.15, ZS - 1.0, 7.4, ZS, .26, F1);         // the folded leaf stack
  /* THIS FILE'S FRAME x −3.2 … 6.15 at z −13.5: intentionally nothing — after
     mx() that is SITE-space x −6.15 … 3.2, the walk-in / fly-in span, with the
     PREWEDDING spawn (SITE x = 1) 1.9 m inside it. Never close this. */

  /* ── pantry ──
     ⚠ y1 on the screen and the column too (2026-08-04): the lattice screen is
     0 … 2.45 and the stone column is a slab(0 … H1). Both are 1F solids under
     the 2F lounge and both were registered at every height. The partition wall
     beside them keeps its all-heights chain — it is a WALL, and the 2F above it
     is a room, not a void. */
  colLine(X0, P_ZS, -5.55, P_ZS, .28, 0, F1);        // red lattice screen
  colLine(P_X1, ZN, P_X1, -24.6, WR);                // partition to dining
  colRect(-7.3, -24.75, -5.3, -23.85, .34, F1);      // island
  colLine(X0, nz + .62, -5.2, nz + .62, .34, 0, F1);  // back counter
  colRect(-5.2, -24.05, -4.35, -23.2, .32, F1);      // grey stone column

  /* ── the stair mass ─────────────────────────────────────────────────────────
     REWORKED 2026-08-02. site.js registers this staircase as three walkable
     regions (suite-stair-lower / -landing / -upper) and floorY climbs them
     correctly — but the walker never reached them, because the mass carried two
     y-agnostic collider rings around exactly the footprint the ramps occupy.
     The height field said "climb"; the collider said "no". That is Carl's
     "can't walk upstairs".

       · the lower flight's own ring is GONE. Its footprint IS the ramp; the
         approach from the great room (walking north into the bay, south of the
         spine wall's z = −21.0 end) now lands you on a tread and the ramp lifts
         you. The raking glass balustrade still reads as the edge.
       · the landing + upper flight keeps its ring but only BELOW 0.85 m of feet
         height, so it still stops a ground-level walker strolling into the
         under-stair volume, and stops existing once you are actually on the
         stair. 0.85 is chosen against the arithmetic: the ring's west edge
         (r 0.3 + PLAYER_R 0.35) starts pushing at x = lx0 − 0.65, where the
         lower ramp has already lifted the feet to ≈ 0.95 m. Raise it and you
         re-seal the landing.
       · the base rail's collider went with the base rail (see buildStair). */
  colRect(ST.lx0, ST.lzN, ST.lx1, ST.zS, .3, { y1: 0.85 });   // landing + upper flight
  /* the spine wall's chain follows its 2026-08-04 split (see buildStair): the
     full-height mass beside the void keeps an all-heights chain; over the
     flight's mouth band the wall is now a HEADER from ST.spineHeadY up, so its
     chain carries y0 — it still guards the 2F lounge slab edge (feet 3.8)
     against walking off into the stair void, and no longer walls off the
     head-on approach at grade. This chain was the mouth's main pinch: r .22 +
     PLAYER_R .35 from x0+.15 stopped an approaching walker at 3.79 — 0.86 m
     short of the nosing at 4.65 — over the whole band. */
  colLine(ST.x0 + .15, ST.lzS, ST.x0 + .15, -21.0, .22);            // spine, beside the void
  colLine(ST.x0 + .15, ST.zN, ST.x0 + .15, ST.lzS, .22, 0,
    { y0: ST.spineHeadY - .05 });                                    // spine header over the mouth
  /* north return: r .22 (centred .11 inside the wall) blocked .46 past the
     visible face — with the sofa ring's old reach the two sealed the approach
     corridor north of the sofa to ~0.01 m. At r .12 the walker's body stops
     .01 shy of the visible face (.12 + PLAYER_R .35 − .11 half-thickness −
     PLAYER_R = .36 block past the face, .35 of it body) — still stricter than
     the geometry, never looser, and the corridor opens to a real lane. */
  colLine(ST.x0, ST.zN - .11, X1, ST.zN - .11, .12);     // black north return

  /* ── great-room furniture ─────────────────────────────────────────────────
     ⚠ EVERY chain in this block carries y1 as of 2026-08-04. They are 1F
     furniture under a 3.8 m slab and they were registered at every height, so
     each one stood invisibly in the middle of the 2F lounge — CLAUDE.md's
     backlog called this out ("1F furniture colliders carry no y1 and
     shadow-block the 2F lounge floor above them") and the new 2F door onto the
     clubhouse's upper walkway opens straight into two of them: the walker got
     through the wall and was stopped 0.4 m later by a dining table one storey
     below him. y1 = YF2 − 0.4 is the same arithmetic the stair mass uses: it
     stops existing exactly where a walker's feet can no longer be on the
     ground floor. */
  /* sofa island: the plinth is LIVING_X ± 3.02 / −23.22 … −19.18 and the ring
     used to sit ON that footprint at r .4 — a .75 block standoff whose NW
     corner, meeting the north return's old reach, was the other half of the
     seal across the stair approach. Pulled .15 inside the plinth at r .22 the
     body still stops .05 clear of the espresso edge on every side, and the
     lane between sofa and return wall is ~0.42 m of walkable centre-line. */
  colRect(LIVING_X - 2.85, -23.05, LIVING_X + 2.85, -19.35, .22, F1);  // sofa island (sz ± 2)
  colRect(DINING_X - 1.5, -20.1, DINING_X + 1.5, -18.9, .36, F1);  // dining table
  colLine(-.6, ZN + .62, 4.6, ZN + .62, .32, 0, F1);           // credenzas
  /* ⚠ y1. This is 1F furniture and its chain carried no height window, so it
     stood in mid-air across the 2F lounge exactly where the new 2F door onto
     the clubhouse's upper walkway opens — the walker got through the wall and
     was stopped 0.4 m later by a sideboard one storey below him. (CLAUDE.md's
     backlog already knew: "1F furniture colliders carry no y1 and shadow-block
     the 2F lounge floor above them". This was the one in the way; the other
     FOUR — the stone pier, the folded leaf stack, the pantry's lattice screen
     and its stone column — were closed on 2026-08-04, and with them every
     1F-only solid standing under a suite-2f-* walk region now carries y1.
     The spa/corridor furniture below deliberately does not: the annex has no
     storey over it, so a height window there would guard nothing.) */
  colLine(wx + .6, -20.7, wx + .6, -18.3, .3, 0, F1);          // sideboard

  /* ── east annex ── */
  colLine(ANX_X0, nz, ANX_X1, nz, WR);                          // annex north
  colLine(ANX_X1 - EWT / 2, ZN, ANX_X1 - EWT / 2, SPA_ZS, WR);  // annex east
  colLine(COR_X1, SPA_ZS - EWT / 2, ANX_X1, SPA_ZS - EWT / 2, WR);
  colLine(ANX_X0, COR_ZS - EWT / 2, COR_X1, COR_ZS - EWT / 2, WR);
  colLine(COR_X1, ZN, COR_X1, -23.6, WR);                       // corridor partition
  colLine(COR_X1, -21.8, COR_X1, COR_ZS, WR);
  colRect(11.3, -25.7, 13.5, -23.5, .34);                       // jacuzzi
  colRect(11.5, -21.9, 13.4, -20.0, .3);                        // massage beds
  colRect(COR_X1 + .1, -24.3, COR_X1 + 1.0, -22.5, .3);         // spa sofa
  colLine(ANX_X0 + .1, -25.9, ANX_X0 + .9, -25.9, .3);          // corridor daybed
  colLine(ANX_X0 + .1, -23.9, ANX_X0 + .9, -23.9, .3);

  /* ══ THE EXTERIOR STAIR'S 2F LANDING — ITS WEST EDGE (2026-08-04) ═════════
     campus.js builds the flight up this building's east flank and guards it
     with two balustrade chains at x 8.0 / 10.0 — but only over the FLIGHT
     (z −0.35 … −6.05). The LANDING at the top runs on to z −8.10 and its west
     edge, x 7.55, had nothing: a 3.80 m drop onto the pool deck. It was a dead
     end until 2026-08-04, when SITE.EXT_STAIR moved south and its landing
     became the junction between the pool deck and the clubhouse's upper
     walkway; the walkway's own west rail (campus.js `bal(SL.x0, −13.5,
     SL.x0, −8.1)`) deliberately stops where the landing begins, so this is the
     one open metre on that whole edge. Measured before this chain: from
     (9.2, −6.9), walk west → feet 3.800 → 0.000.

     ⚠ Derived from SITE.EXT_STAIR by the SAME arithmetic site.js uses for
     `rect('ext-stair-landing', …)` — the run, the top tread, the landing's
     back-set centre. Nothing is typed; move the stair and the guard follows.
     ⚠ SITE frame, so it goes through colSiteLine, NOT colLine (see §1a).
       r .15  — a glass balustrade; with PLAYER_R the body stops 0.15 m short.
       y0     — ARRIVAL_LOBBY_Y − .15 = 3.45, low enough to catch a walker on
                the 3.60 walkway as well as one on the 3.80 landing, and far
                above the pool deck this edge overhangs. It must NOT exist at
                grade: the deck under it is the AFTERPARTY's ground. */
  {
    const E = SITE.EXT_STAIR;
    const run = E.steps * E.tread;                       //  5.70
    const zFoot = E.z + run / 2;                         // −0.35, bottom
    const zTop = zFoot - run + E.tread;                  // −5.75, top tread
    const lx = E.x - Math.sign(E.x) * E.landingBack;     //  8.60, landing centre
    const wEdge = lx - E.landingW / 2;                   //  7.55, its WEST edge
    colSiteLine(wEdge, zTop - E.landingD - .35, wEdge, zTop + .2, .15,
      { y0: ARRIVAL_LOBBY_Y - .15 });
  }
}

/* ══════════════════════════════════════════════════════════════════════
   15 · MIRROR SELF-CHECK — cheap insurance for §1a
   This file authors in the mirrored brief frame and site.js holds the truth;
   the whole point of mx() is that the two can never drift, but a future edit
   that hand-negates one X "to fix it" would silently half-mirror the room
   again — the exact bug this file was rescued from. So re-derive three
   landmarks that carry literal coordinates and shout if they no longer land
   on the side SITE.SUITE says they do. Console warning only: a mis-sided
   sofa is a bug report, not a reason to refuse to draw the venue.
   ══════════════════════════════════════════════════════════════════════ */
function checkMirror() {
  const bad = [];
  const side = (built, want, what) => {
    if (Math.sign(built) !== Math.sign(want)) {
      bad.push(`${what}: built at x ${built.toFixed(2)}, SITE says ${want}`);
    }
  };
  side(mx((ST.x0 + ST.x1) / 2), S.stairX, 'stair mass');
  side(mx((-7.8 + -5.55) / 2), S.pantry.cx, 'pantry lattice shelf');
  side(mx((11.3 + 13.5) / 2), S.spa.cx, 'spa jacuzzi');
  side(mx(DINING_X), S.diningX, 'dining table');

  /* the folded-open span must still swallow the PREWEDDING spawn, which is
     also INTRO_PATH.land — the dive lands there and has to be able to walk
     out. Span in SITE space, plus a body radius (CFG.PLAYER_R 0.35) and the
     leaf collider radius (0.26). */
  const sp = worldToEnclave(MOMENT_PLACES.PREWEDDING.x, MOMENT_PLACES.PREWEDDING.z);
  const lo = Math.min(mx(GW.closedX1), mx(6.15)), hi = Math.max(mx(GW.closedX1), mx(6.15));
  if (sp.x < lo + .7 || sp.x > hi - .7) {
    bad.push(`PREWEDDING spawn x ${sp.x.toFixed(2)} is not clear inside the `
      + `open glass span ${lo.toFixed(2)}…${hi.toFixed(2)} — move the wall, not the spawn`);
  }
  if (bad.length) console.warn('[suite] mirror check:\n  ' + bad.join('\n  '));
}
