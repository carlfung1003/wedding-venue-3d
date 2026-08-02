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
import { SITE } from './site.js';
import { mulberry32 } from './materials.js';

/* ══════════════════════════════════════════════════════════════════════
   1 · DIMENSIONS — everything derived from SITE.SUITE
   ══════════════════════════════════════════════════════════════════════ */
const S = SITE.SUITE;

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

/* --- east annex: spa + corridor. SITE.SUITE.spa spans x 7..14, which laps
   1 m inside the envelope; we clip its west face to the envelope's east wall
   (x = 8) so the two volumes don't intersect. Centre stays within 0.5 m. --- */
const SPA = S.spa;                                   // {cx:10.5, cz:-22, w:7, d:5}
const ANX_X0 = X1;                                   //  8.0
const ANX_X1 = SPA.cx + SPA.w / 2;                   // 14.0
const CORW = S.corridorW;                            //  1.6 CLEAR corridor width
const COR_X1 = ANX_X0 + CORW + .3;                   //  9.9  corridor/spa partition
                                                     //  (clear width + the wall)
const SPA_ZS = SPA.cz + SPA.d / 2;                   // -19.5 spa south wall
const COR_ZS = SPA_ZS + 2.5;                         // -17.0 corridor runs on past
                                                     // the spa to its second door

/* --- pantry, NW corner (SITE.SUITE.pantry), west face clipped to the wall --- */
const P = S.pantry;                                  // {cx:-6.5, cz:-24.5, w:4, d:3.5}
const P_X1 = P.cx + P.w / 2;                         // -4.5
const P_ZS = P.cz + P.d / 2;                         // -22.75

/* --- the staircase. L-shaped dog-leg, 22 risers over SITE floorToFloor --- */
const RISE = YF2 / 22;                               // 0.17273
const ST = {
  x0: 4.2, x1: X1,            // the whole stair zone
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

/* --- the folding glass wall (SITE.SUITE glassWallW / leafW / leafH) --- */
const GW = {
  z: ZS,
  x0: -S.glassWallW / 2,      // -7.0
  x1: S.glassWallW / 2,       //  7.0
  leafW: S.leafW,             // 0.95
  leafH: S.leafH,             // 2.8
  closedX1: -1.3,             // leaves closed from x0 to here (dining end)
  stackX0: 6.2,               // the folded concertina stacks here
};

/* 1F room anchors straight off SITE */
const LIVING_X = S.livingX, DINING_X = S.diningX;

/* ══════════════════════════════════════════════════════════════════════
   2 · SMALL HELPERS
   ══════════════════════════════════════════════════════════════════════ */

/** Box spanning an explicit x/y/z range — the workhorse for architecture. */
function slab(parent, mat, x0, x1, y0, y1, z0, z1) {
  const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
  if (w < 1e-4 || h < 1e-4 || d < 1e-4) return null;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(m);
  return m;
}

/** Box by centre + size, with optional Y rotation. */
function box(parent, mat, w, h, d, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}

function cyl(parent, mat, rt, rb, h, x, y, z, seg = 16, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
  m.position.set(x, y, z);
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
   circles at a step <= r (house rule — widen it and corners get squeezable). */
let COL = null;
function col(x, z, r) { COL.push({ x, z, r }); }
function colLine(x1, z1, x2, z2, r, step) {
  const st = step || r * 0.9;
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / st));
  for (let i = 0; i <= n; i++) col(x1 + dx * i / n, z1 + dz * i / n, r);
}
/** Ring of circles around an axis-aligned rectangle (furniture, masses). */
function colRect(x0, z0, x1, z1, r) {
  colLine(x0, z0, x1, z0, r);
  colLine(x1, z0, x1, z1, r);
  colLine(x1, z1, x0, z1, r);
  colLine(x0, z1, x0, z0, r);
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
  /* West: solid to the south third, then a fixed corner glazing return. */
  wallRun(root, MT.plaster, 'z', X0, EWT, ZN, -16.6, 0, Y2C);
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
  coffer(root, -1.9, 4.1, -19.6, -14.0, H1);          // over the living area
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
    leaf.position.set(GW.x0 + GW.leafW * (i + .5), 0, ZS);
    g.add(leaf);
  }
  /* one leaf swung open on its hinge — the "swing-door mode" of the video */
  const swing = makeLeaf(GW.leafW, GW.leafH);
  swing.position.set(GW.closedX1 + .06, 0, ZS - .04);
  swing.rotation.y = -1.15;
  swing.translateX(GW.leafW / 2);
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
    leaf.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    leaf.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
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

  /* the entry double doors themselves */
  doubleDoor(g, 'x', nz - .02, -3.4, -1.6, 2.4);

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
     and the big ribbed coffee table on the pool side (f012/f016). */
  const sx = LIVING_X, sz = -16.6;
  slab(g, MT.espresso, sx - 3, sx + 3, 0, .32, sz - 2, sz + 2);
  slab(g, MT.espressoPlain, sx - 3.02, sx + 3.02, .3, .34, sz - 2.02, sz + 2.02);
  /* shared central backrest */
  slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, 1.06, sz - .95, sz - .5);
  /* two seat platforms, back to back */
  slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, .70, sz - .5, sz + .55);
  slab(g, MT.ivory, sx - 1.5, sx + 1.5, .32, .70, sz - 1.95, sz - .95);
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
  /* the big ribbed coffee table, pool side */
  slab(g, MT.espresso, sx - 1.3, sx + 1.3, .32, .60, sz + .9, sz + 1.9);
  slab(g, MT.espressoPlain, sx - 1.34, sx + 1.34, .58, .63, sz + .86, sz + 1.94);

  /* a dark stone-clad pier between the closed and folded glazing (f016) */
  slab(g, MT.stonePier, -2.05, -1.4, 0, H1, ZS - .95, ZS - .35);
  /* floor register plates in the marble */
  for (const rx of [-.6, 3.2]) slab(g, MT.brass, rx - .28, rx + .28, .001, .012, -14.5, -14.34);

  /* ── dining: 3.0 × 1.2 espresso table, 8 white high-back chairs ── */
  const dx = DINING_X, dz = -19.5;
  slab(g, MT.espresso, dx - 1.5, dx + 1.5, .70, .77, dz - .6, dz + .6);
  slab(g, MT.espressoPlain, dx - 1.05, dx - .55, 0, .70, dz - .42, dz + .42);
  slab(g, MT.espressoPlain, dx + .55, dx + 1.05, 0, .70, dz - .42, dz + .42);
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
  const c = new THREE.Group();
  slab(c, MT.ivoryWhite, -.24, .24, .44, .50, -.24, .24);
  slab(c, MT.ivoryWhite, -.24, .24, .50, 1.10, -.26, -.18);
  for (const lx of [-.2, .2]) for (const lz of [-.2, .2]) {
    slab(c, MT.espressoPlain, lx - .025, lx + .025, 0, .44, lz - .025, lz + .025);
  }
  c.position.set(x, 0, z);
  c.rotation.y = ry;
  parent.add(c);
  return c;
}

/** Table lamp: slim base, dark shade with a glowing mouth. */
function tableLamp(parent, x, y, z, h = .42) {
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
  const put = (b0, b1, y0, y1, m) => {
    if (axis === 'x') slab(parent, m, b0, b1, y0, y1, fixed - t, fixed + t);
    else slab(parent, m, fixed - t, fixed + t, y0, y1, b0, b1);
  };
  put(a0 - .09, a1 + .09, 0, h + .09, MT.sapeleDark);      // frame + head
  if (open) {
    const lw = (a1 - a0) / 2 - .03;
    for (const a of [a0, a1]) {
      if (axis === 'x') slab(parent, MT.maroon, a - .035, a + .035, 0, h,
        fixed + dir * .05, fixed + dir * (.05 + lw));
      else slab(parent, MT.maroon, fixed + dir * .05, fixed + dir * (.05 + lw),
        0, h, a - .035, a + .035);
    }
    return;
  }
  put(a0, mid - .015, 0, h, MT.maroon);
  put(mid + .015, a1, 0, h, MT.maroon);
  put(mid - .32, mid - .28, .95, 1.15, MT.brass);          // handles
  put(mid + .28, mid + .32, .95, 1.15, MT.brass);
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
    m.position.set((ST.lx0 + ST.lx1) / 2, (ST.lyY + YF2) / 2 - .17,
      (ST.lzS + ST.zS) / 2);
    m.rotation.x = -upAng;
    g.add(m);
  }

  /* ── the glossy black horizontal-grooved spine ────────────────────
     A full-height slab on the living-room side (west) and a full-height
     return across the north. Wall A stops at z = -22.0 so the double-height
     void — and the chandelier in it — reads from the great room. */
  slab(g, MT.blackTall, ST.x0, ST.x0 + .3, 0, Y2C, ST.zN, -21.0);
  slab(g, MT.blackTall, ST.x0, X1, 0, Y2C, ST.zN - .22, ST.zN);
  slab(g, MT.black, ST.x0, ST.lx0, 0, .5, ST.lzS, ST.lzS + .16);     // low base rail

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
  chand.position.set(5.6, 0, -20.6);   // in the void, framed by the 2F slot
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
    chand.rotation.y += dt * .06;
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
    if (axis === 'z') { m.position.set(fixed, mid[1], mid[0]); m.rotation.x = -ang; }
    else { m.position.set(mid[0], mid[1], fixed); m.rotation.z = ang; }
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
    r.rotation.z = Math.PI / 2;
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
    m.position.set(ox + .05, .55 + i * .62, -23.3);
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

  /* two navy massage beds on blond folding legs */
  for (const bx of [11.85, 13.05]) {
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
    const seat = box(g, MT.ivoryWhite, 1.25, .42, 1.0, cx, YF2 + .21, cz, -a);
    const back = box(g, MT.ivoryWhite, 1.25, .5, .28, cx, YF2 + .55, cz - .0, -a);
    back.translateZ(-.42);
    box(g, i % 2 ? MT.teal : MT.tealDeep, .34, .32, .13, cx, YF2 + .52, cz, -a + .2)
      .translateZ(-.26);
    void seat;
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
    l.position.set(x, y, z);
    nightLight(l, dayI, nightI, dayHex, nightHex);
    root.add(l);
  }
}

/* ══════════════════════════════════════════════════════════════════════
   14 · COLLIDERS — chains of {x,z,r} cylinders (house pattern)
   NOTE: the folded-open span of the glass wall (x -1.3 … 6.15) is left
   deliberately COLLIDER-FREE so a walker can stroll straight in from the
   pool deck — and a flyer can come in through the same gap.
   ══════════════════════════════════════════════════════════════════════ */
function buildColliders() {
  /* r is the GEOMETRY radius — CFG.PLAYER_R is added at test time (house rule),
     so keep it honest to the wall half-thickness or openings stop being
     walkable: every opening loses 2 × (r + PLAYER_R) ≈ 1.15 m of clear width. */
  const WR = .22;
  const nz = ZN + EWT / 2, wx = X0 + EWT / 2, ex = X1 - EWT / 2;

  /* ── main envelope ── */
  colLine(X0, nz, X1, nz, WR);                       // north
  colLine(wx, ZN, wx, ZS, WR);                       // west
  colLine(ex, ZN, ex, -26.3, WR);                    // east, north of the opening
  colLine(ex, -24.45, ex, -19.3, WR);                // east, between the two doors
  colLine(ex, -17.3, ex, ZS, WR);                    // east, south of the doors

  /* ── south face: corner piers + the CLOSED leaves only ── */
  colLine(X0, ZS - .2, X0 + 1.0, ZS - .2, WR);
  colLine(X1 - 1.0, ZS - .2, X1, ZS - .2, WR);
  colLine(GW.x0, ZS, GW.closedX1, ZS, .26);          // closed bi-fold leaves
  colRect(-2.05, ZS - .95, -1.4, ZS - .35, .3);      // stone pier
  colRect(6.15, ZS - 1.0, 7.4, ZS, .26);             // the folded leaf stack
  /* x −1.3 … 6.15 at z −13.5: intentionally nothing. Walk / fly straight in. */

  /* ── pantry ── */
  colLine(X0, P_ZS, -5.55, P_ZS, .28);               // red lattice screen
  colLine(P_X1, ZN, P_X1, -24.6, WR);                // partition to dining
  colRect(-7.3, -24.75, -5.3, -23.85, .34);          // island
  colLine(X0, nz + .62, -5.2, nz + .62, .34);        // back counter
  colRect(-5.2, -24.05, -4.35, -23.2, .32);          // grey stone column

  /* ── the stair mass ── */
  colRect(ST.loX0, ST.lzN, ST.lx0, ST.lzS, .3);      // lower flight
  colRect(ST.lx0, ST.lzN, ST.lx1, ST.zS, .3);        // landing + upper flight
  colLine(ST.x0 + .15, ST.zN, ST.x0 + .15, -21.0, .22);  // black spine wall
  colLine(ST.x0, ST.zN - .11, X1, ST.zN - .11, .22);     // black north return
  colLine(ST.x0, ST.lzS + .08, ST.lx0, ST.lzS + .08, .2); // base rail

  /* ── great-room furniture ── */
  colRect(LIVING_X - 3, -18.6, LIVING_X + 3, -14.6, .4);       // sofa island
  colRect(DINING_X - 1.5, -20.1, DINING_X + 1.5, -18.9, .36);  // dining table
  colLine(-.6, ZN + .62, 4.6, ZN + .62, .32);                  // credenzas
  colLine(wx + .6, -20.7, wx + .6, -18.3, .3);                 // sideboard

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
}
