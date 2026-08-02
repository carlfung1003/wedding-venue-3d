// atrium.js — 隐逸居 clubhouse atrium: the central open-air courtyard, the
// arrival heart of the enclave. Every villa entry opens off it, including the
// presidential suite's north doors.
//
// Modelled 1:1 from reference/photos/clubhouse-atrium.jpeg. The four things
// that make the photo recognisable, in priority order:
//   1. warm reddish-brown mahogany PLANK SOFFITS overhead (the dominant surface)
//   2. near-black square polished stone COLUMNS running the full two storeys
//   3. absolutely mirror-flat black-green PONDS in raised black granite edging,
//      set in grey crushed-stone gravel with a paler beige patch
//   4. cloud-pruned niwaki TOPIARY + the open-riser stair with its COPPER handrail
//
// Footprint comes from SITE.ATRIUM and nowhere else (site.js is the master plan).
// Only mulberry32 is imported from materials.js — every texture/material below
// is local to this module (house rule: builders own their own finishes).

import * as THREE from 'three';
import { SITE } from './site.js';
import { mulberry32 } from './materials.js';

/* ────────────────────────────────────────────────────────────── footprint ── */

const A = SITE.ATRIUM;

const X0 = A.cx - A.w / 2,  X1 = A.cx + A.w / 2;              // -14 .. 30
const Z0 = A.cz - A.d / 2,  Z1 = A.cz + A.d / 2;              // -54 .. -28
const CX0 = A.cx - A.courtW / 2, CX1 = A.cx + A.courtW / 2;   //  -7 .. 23
const CZ0 = A.cz - A.courtD / 2, CZ1 = A.cz + A.courtD / 2;   // -48.5 .. -33.5

const H1 = A.floorH;                 // 3.6  — 2F deck level
const H2 = A.floorH * A.floors;      // 7.2  — roof level
const SLAB = 0.35;                   // gallery slab thickness
const SOF1 = H1 - SLAB;              // 3.25 — 1F soffit (the photo's ceiling)
const SOF2 = H2 - SLAB;              // 6.85 — 2F soffit
const WALL_T = 0.30;                 // perimeter wall thickness
const COL = A.colR * 2;              // 0.56 — square column side

// ground datums, stacked so nothing z-fights with the campus ground plane
const Y_GRAVEL = 0.03;
const Y_PAVE   = 0.055;
const Y_DECK   = 0.09;

// the two walking routes kept clear of gravel + planting (a T through the court)
const PATH_NS = { x0: 5.4, x1: 8.6, z0: CZ0, z1: CZ1 };        // between the ponds
const PATH_EW = { x0: CX0, x1: CX1, z0: -35.7, z1: -33.5 };    // south run

// the way through to the presidential suite (SITE.SUITE is due south)
const PORTAL = { x0: -5, x1: 5 };
// and a side door east toward the 隐逸居 lounge (SITE.LOUNGE)
const LOUNGE_DOOR = { z0: -33.2, z1: -30.0 };

// open-riser stair — SITE.ATRIUM.stair is its centre; it rises NORTH (-Z) from
// the court floor onto the 2F west gallery, clear of pond A's north edge.
const STAIR = {
  x: A.stair.x,            // -8
  w: 1.6,
  risers: 16,
  rise: H1 / 16,           // 0.225
  going: 0.45,
  zFoot: A.stair.z + 3.1,  // -43.9  (pond A's north edge is -43.75)
};
STAIR.zTop = STAIR.zFoot - STAIR.risers * STAIR.going;   // -51.1
STAIR.angle = Math.atan2(H1, STAIR.risers * STAIR.going);
// the stairwell void punched through the 2F deck
const WELL = { x0: STAIR.x - 1.0, x1: CX0, z0: STAIR.zTop, z1: -42.5 };

/* ────────────────────────────────────────────────────── texture plumbing ── */

function cvsTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;      // colour maps only — house rule
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

/* the hero material: warm reddish-brown mahogany plank ceiling */
function texMahogany() {
  return cvsTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6B3520'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(4211);
    const pw = 46;                                   // plank width, px
    for (let i = 0; i * pw < w + pw; i++) {
      const x = i * pw, t = rnd();
      const r = 0x58 + t * 0x36, gg = 0x28 + t * 0x20, b = 0x16 + t * 0x14;
      g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.fillRect(x, 0, pw - 1, h);
      for (let k = 0; k < 22; k++) {                 // grain
        g.strokeStyle = `rgba(${(r * .55) | 0},${(gg * .5) | 0},${(b * .5) | 0},${.08 + rnd() * .2})`;
        g.lineWidth = .6 + rnd() * 1.7;
        const gx = x + 2 + rnd() * (pw - 5), ph = rnd() * 300;
        g.beginPath(); g.moveTo(gx, 0);
        for (let y = 0; y <= h; y += 28) g.lineTo(gx + Math.sin((y + ph) * .013) * 2.6, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(16,6,3,.8)';  g.fillRect(x + pw - 1.6, 0, 1.6, h);   // seam
      g.fillStyle = 'rgba(255,196,146,.06)'; g.fillRect(x + pw, 0, 1, h);      // highlight
    }
  });
}

/* darker walking-surface timber — gallery decking */
function texDeck() {
  return cvsTex(512, 512, (g, w, h) => {
    g.fillStyle = '#432619'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(6607);
    const bw = 58;
    for (let i = 0; i * bw < w + bw; i++) {
      const x = i * bw, t = rnd();
      g.fillStyle = `rgb(${(0x3a + t * 0x22) | 0},${(0x20 + t * 0x14) | 0},${(0x14 + t * 0x0e) | 0})`;
      g.fillRect(x, 0, bw - 3, h);
      for (let k = 0; k < 16; k++) {
        g.strokeStyle = `rgba(24,12,6,${.08 + rnd() * .14})`;
        g.lineWidth = .7 + rnd();
        const gx = x + 3 + rnd() * (bw - 8);
        g.beginPath(); g.moveTo(gx, 0); g.lineTo(gx + (rnd() - .5) * 4, h); g.stroke();
      }
      g.fillStyle = 'rgba(10,5,2,.9)'; g.fillRect(x + bw - 3, 0, 3, h);        // board gap
    }
  });
}

/* near-black polished stone — columns, pond edging piers */
function texBlackStone() {
  return cvsTex(256, 256, (g, w, h) => {
    g.fillStyle = '#131417'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(9013);
    for (let i = 0; i < 1400; i++) {
      const v = 20 + rnd() * 46;
      g.fillStyle = `rgba(${v | 0},${(v + 2) | 0},${(v + 6) | 0},${.05 + rnd() * .18})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    for (let i = 0; i < 16; i++) {                    // faint mineral veining
      g.strokeStyle = `rgba(150,152,160,${.03 + rnd() * .05})`;
      g.lineWidth = .6 + rnd() * 1.2;
      g.beginPath();
      let x = rnd() * w, y = 0;
      g.moveTo(x, y);
      while (y < h) { y += 12; x += (rnd() - .5) * 16; g.lineTo(x, y); }
      g.stroke();
    }
  });
}

/* black granite tile — the raised pond edging, mitred grid */
function texGranite() {
  return cvsTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16181a'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(2749);
    for (let i = 0; i < 1800; i++) {
      const v = 22 + rnd() * 52;
      g.fillStyle = `rgba(${v | 0},${(v + 3) | 0},${(v + 5) | 0},${.06 + rnd() * .2})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 2);
    }
    const s = 64;                                     // tile joints
    g.strokeStyle = 'rgba(6,7,8,.85)'; g.lineWidth = 1.6;
    for (let i = 0; i <= w / s; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
    g.strokeStyle = 'rgba(190,195,205,.07)'; g.lineWidth = 1;
    for (let i = 0; i <= w / s; i++) {
      g.beginPath(); g.moveTo(i * s + 1.4, 0); g.lineTo(i * s + 1.4, h); g.stroke();
    }
  });
}

/* pale grey stone — coping band + court paving */
function texPaleStone(seed, base) {
  return cvsTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(seed);
    for (let i = 0; i < 1600; i++) {
      const v = 150 + rnd() * 70;
      g.fillStyle = `rgba(${v | 0},${v | 0},${(v - 4) | 0},${.05 + rnd() * .14})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3);
    }
    const s = 128;
    g.strokeStyle = 'rgba(90,92,92,.5)'; g.lineWidth = 1.4;
    for (let i = 0; i <= w / s; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
}

/* crushed-stone gravel speckle */
function texGravel(seed, base, lo, hi, count) {
  return cvsTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const v = lo + rnd() * (hi - lo);
      const x = rnd() * w, y = rnd() * h, r = 1.6 + rnd() * 4.2;
      g.fillStyle = `rgb(${v | 0},${(v + 2) | 0},${(v + 4) | 0})`;
      g.beginPath();
      g.ellipse(x, y, r, r * (.6 + rnd() * .6), rnd() * 3.14, 0, 6.29);
      g.fill();
      g.fillStyle = `rgba(0,0,0,${.1 + rnd() * .25})`;   // contact shadow
      g.beginPath();
      g.ellipse(x + r * .4, y + r * .5, r * .8, r * .5, 0, 0, 6.29);
      g.fill();
    }
  });
}

/* stacked-slate feature wall — horizontal courses of split stone */
function texSlate() {
  return cvsTex(256, 512, (g, w, h) => {
    g.fillStyle = '#1d1f21'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(1553);
    let y = 0;
    while (y < h) {
      const ch = 5 + rnd() * 9;
      let x = -rnd() * 40;
      while (x < w) {
        const sw = 22 + rnd() * 58, v = 38 + rnd() * 46;
        g.fillStyle = `rgb(${v | 0},${(v + 2) | 0},${(v + 4) | 0})`;
        g.fillRect(x, y, sw - 1.5, ch - 1.4);
        g.fillStyle = `rgba(255,255,255,${.02 + rnd() * .05})`;    // split face sheen
        g.fillRect(x, y, sw - 1.5, 1.2);
        x += sw;
      }
      g.fillStyle = 'rgba(0,0,0,.72)'; g.fillRect(0, y + ch - 1.6, w, 1.8);   // shadow line
      y += ch;
    }
  });
}

/* dark timber screen — vertical slats over a black reveal */
function texScreen() {
  return cvsTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0c0906'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3391);
    const sw = 16;
    for (let x = 0; x < w; x += sw) {
      const t = rnd();
      g.fillStyle = `rgb(${(0x46 + t * 0x24) | 0},${(0x24 + t * 0x14) | 0},${(0x14 + t * 0x0c) | 0})`;
      g.fillRect(x, 0, sw - 5, h);
      g.fillStyle = 'rgba(255,200,150,.07)'; g.fillRect(x, 0, 1.4, h);
      g.fillStyle = 'rgba(0,0,0,.55)';       g.fillRect(x + sw - 6.4, 0, 1.4, h);
    }
  });
}

/* the whole point of the ponds: a blurred mirror image painted onto the water.
   vertical streaks = timber soffit, sky, columns, and the copper handrail. */
function texPondMirror() {
  return cvsTex(256, 512, (g, w, h) => {
    const base = g.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#0a1512');
    base.addColorStop(.55, '#08120f');
    base.addColorStop(1, '#050b09');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8117);

    const streak = (x, sw, top, bot, col, a) => {
      const gr = g.createLinearGradient(0, top, 0, bot);
      gr.addColorStop(0, `rgba(${col},0)`);
      gr.addColorStop(.28, `rgba(${col},${a})`);
      gr.addColorStop(.75, `rgba(${col},${a * .55})`);
      gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr;
      for (let y = top; y < bot; y += 6) {                 // wavy edge = blur
        const jx = Math.sin(y * .05 + x) * 2.2;
        g.fillRect(x + jx - sw / 2, y, sw, 7);
      }
    };

    // warm mahogany soffit reflected across the whole far half
    streak(w * .5, w * 1.15, 0, h * .58, '116,54,26', .5);
    // pale sky / glazing between the roofs
    streak(w * .22, 34, 0, h * .5, '160,180,190', .3);
    streak(w * .78, 26, 0, h * .44, '150,172,186', .26);
    // black column reflections
    streak(w * .36, 20, 0, h * .82, '4,7,8', .8);
    streak(w * .62, 24, 0, h * .9, '3,6,7', .82);
    // the copper handrail — the one bright line in the photo's reflection
    streak(w * .45, 6, h * .06, h * .5, '214,122,54', .75);
    streak(w * .49, 3, h * .1, h * .42, '246,168,96', .5);
    // faint green algae mottling near the edges
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(26,54,42,${.03 + rnd() * .07})`;
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 26, 3 + rnd() * 10, 0, 0, 6.29);
      g.fill();
    }
    // vignette so the pond centre stays deepest
    const vg = g.createRadialGradient(w / 2, h / 2, h * .1, w / 2, h / 2, h * .62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });
}

/* villa number plaque — warm digits etched into dark bronze */
function texPlaque(n) {
  return cvsTex(128, 96, (g, w, h) => {
    g.fillStyle = '#1a1512'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(196,112,58,.55)'; g.lineWidth = 3;
    g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#ffd9a8';
    g.font = '600 46px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(n, w / 2, h / 2 + 2);
  });
}

/* the portal plaque over the way through to the presidential suite */
function texPortalPlaque() {
  return cvsTex(512, 128, (g, w, h) => {
    g.fillStyle = '#15100d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,118,62,.6)'; g.lineWidth = 3;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffe0b4';
    g.font = '600 46px "PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif';
    g.fillText('隐逸居 · 总统别墅', w / 2, h * .38);
    g.fillStyle = 'rgba(214,150,100,.9)';
    g.font = '500 22px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillText('PRESIDENTIAL   VILLA', w / 2, h * .74);
  });
}

/* ────────────────────────────────────────────── module state + registries ── */

let root = null;
let night = false;

const EMIS = [];    // { m, d, n }  — emissiveIntensity day/night
const ENVM = [];    // { m, d, n }  — envMapIntensity day/night (daylight response)
const PLIGHT = [];  // { l, d, n }  — real PointLight intensity day/night
let waterMats = [];

function reg(m, dayEnv = 1.0, nightEnv = 0.34) { ENVM.push({ m, d: dayEnv, n: nightEnv }); return m; }
function regE(m, d, n) { EMIS.push({ m, d, n }); return m; }

/* ───────────────────────────────────────────────────── geometry plumbing ── */

const geoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); geoCache.set(k, g); }
  return g;
}
function mkBox(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}
/* a flat slab lying in the XZ plane, w × d, top at y */
function mkPlate(parent, w, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
/* Clone a material with its map re-tiled for a different-sized surface.
   `rot90` turns the grain 90°: repeat is applied in UV space BEFORE the
   rotation (Texture.updateMatrix → setUvTransform), so the repeat values stay
   exactly the same — only the plank direction flips. */
function retile(mat, rx, ry, rot90) {
  const m = mat.clone();
  if (mat.map) {
    m.map = mat.map.clone();
    m.map.repeat.set(rx, ry);
    if (rot90) { m.map.center.set(.5, .5); m.map.rotation = Math.PI / 2; }
    m.map.needsUpdate = true;
  }
  if (mat.emissiveMap === mat.map) m.emissiveMap = m.map;
  ENVM.push({ m, d: 1.0, n: 0.34 });
  return m;
}

/* Does this footprint belong to the east/west run of the gallery ring?
   Those planks must run along X; the north/south runs' planks run along Z.
   Either way the boards cross the walkway, which is what the photo shows. */
const isSideRun = (az, bz) => {
  const zc = (az + bz) / 2;
  return zc > CZ0 && zc < CZ1;
};

/* ── static batching ────────────────────────────────────────────────────────
   The facade alone is ~500 little boxes. None of it moves, so after everything
   is authored we bake same-material meshes into one geometry each. Written by
   hand rather than pulled from BufferGeometryUtils so the module keeps its
   only-mulberry32 import surface. Every geometry here is Box/Plane/Sphere/
   Cylinder/Circle — all position + normal + uv, all indexed. */

function mergeSimple(list) {
  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    const p = g.attributes.position, nA = g.attributes.normal, uA = g.attributes.uv;
    pos.set(p.array, vo * 3);
    if (nA) nor.set(nA.array, vo * 3);
    if (uA) uv.set(uA.array, vo * 2);
    if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx[io++] = ia[i] + vo; }
    else for (let i = 0; i < p.count; i++) idx[io++] = i + vo;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/* Collapse every static single-material mesh under `node` into one mesh per
   material, in NODE-LOCAL space (so `node`'s own transform still animates).
   Subtrees marked userData.sway are left alone — they still move. */
function batchLocal(node) {
  node.updateMatrixWorld(true);
  const victims = [];
  const walk = (o, mat) => {
    for (const c of o.children.slice()) {
      if (c.userData.sway) continue;                 // animated — hands off
      const m = mat.clone().multiply(c.matrix);
      const g = c.geometry;
      if (c.isMesh && !c.isInstancedMesh && !Array.isArray(c.material)
        && g && g.attributes.position && g.attributes.normal && g.attributes.uv) {
        victims.push({ mesh: c, m });
        continue;
      }
      walk(c, m);
    }
  };
  walk(node, new THREE.Matrix4());

  const buckets = new Map();
  for (const v of victims) {
    let b = buckets.get(v.mesh.material);
    if (!b) { b = { list: [], order: v.mesh.renderOrder }; buckets.set(v.mesh.material, b); }
    b.list.push(v.mesh.geometry.clone().applyMatrix4(v.m));   // clone: boxGeo is shared
    v.mesh.removeFromParent();
  }
  for (const [mat, b] of buckets) {
    const merged = b.list.length === 1 ? b.list[0] : mergeSimple(b.list);
    if (b.list.length > 1) for (const g of b.list) g.dispose();
    const m = new THREE.Mesh(merged, mat);
    m.renderOrder = b.order;
    node.add(m);
  }
  return buckets.size;
}

/* chain of {x,z,r} cylinders along a wall segment (house collider pattern) */
function colLine(out, x0, z0, x1, z1, r, skip) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(len / (r * 0.92)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + dx * t, z = z0 + dz * t;
    if (skip && skip(x, z)) continue;
    out.push({ x, z, r });
  }
}
function colRect(out, x0, z0, x1, z1, r) {
  colLine(out, x0, z0, x1, z0, r);
  colLine(out, x1, z0, x1, z1, r);
  colLine(out, x1, z1, x0, z1, r);
  colLine(out, x0, z1, x0, z0, r);
}

const inRect = (x, z, R, pad = 0) =>
  x > R.x0 - pad && x < R.x1 + pad && z > R.z0 - pad && z < R.z1 + pad;

/* ═══════════════════════════════════════════════════════════════ builder ══ */

export function buildAtrium(G) {
  root = new THREE.Group();
  root.name = 'atrium';
  EMIS.length = 0; ENVM.length = 0; PLIGHT.length = 0;
  waterMats = [];
  const rnd = mulberry32(20270320);

  /* ────────────────────────────────────────────────────────── materials ── */

  const mahoganyTex = texMahogany();
  const M = {
    soffit: reg(new THREE.MeshStandardMaterial({
      map: mahoganyTex, color: 0xffffff, roughness: .68, metalness: .04,
    }), 0.9, 0.3),
    deck: reg(new THREE.MeshStandardMaterial({
      map: texDeck(), roughness: .82, metalness: .02,
    }), 0.85, 0.28),
    column: reg(new THREE.MeshStandardMaterial({
      map: texBlackStone(), color: 0x9aa0a8, roughness: .21, metalness: .42,
    }), 1.25, 0.5),
    granite: reg(new THREE.MeshStandardMaterial({
      map: texGranite(), color: 0xa8adb4, roughness: .16, metalness: .38,
    }), 1.3, 0.5),
    coping: reg(new THREE.MeshStandardMaterial({
      map: texPaleStone(5107, '#9d9e9a'), roughness: .42, metalness: .1,
    }), 1.0, 0.32),
    paving: reg(new THREE.MeshStandardMaterial({
      map: texPaleStone(6211, '#8d8e8a'), roughness: .68, metalness: .05,
    }), 0.9, 0.28),
    gravel: reg(new THREE.MeshStandardMaterial({
      map: texGravel(7717, '#6e7074', 74, 186, 5200), roughness: .96, metalness: .0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }), 0.85, 0.26),
    gravelPale: reg(new THREE.MeshStandardMaterial({
      map: texGravel(4409, '#b6ac96', 150, 232, 2600), roughness: .95, metalness: .0,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }), 0.85, 0.26),
    pebble: reg(new THREE.MeshStandardMaterial({
      color: 0x7c7e82, roughness: .88, metalness: .04, flatShading: true,
    }), 0.9, 0.3),
    slate: reg(new THREE.MeshStandardMaterial({
      map: texSlate(), roughness: .78, metalness: .1,
    }), 0.95, 0.3),
    screen: reg(new THREE.MeshStandardMaterial({
      map: texScreen(), roughness: .8, metalness: .04,
    }), 0.9, 0.3),
    bronze: reg(new THREE.MeshStandardMaterial({
      color: 0x2b2620, roughness: .34, metalness: .86,
    }), 1.1, 0.42),
    steel: reg(new THREE.MeshStandardMaterial({
      color: 0x22262a, roughness: .38, metalness: .78,
    }), 1.1, 0.42),
    copper: reg(new THREE.MeshStandardMaterial({
      color: 0xc4703a, roughness: .27, metalness: .92,
      emissive: 0x3a1a08, emissiveIntensity: .18,
    }), 1.35, 0.6),
    fascia: reg(new THREE.MeshStandardMaterial({
      color: 0x9b5a2c, roughness: .38, metalness: .78,
    }), 1.15, 0.42),
    /* Warm mid-grey standing seam, matched to the villa roofs in campus.js.
       This was 0x4b4d4c with metalness .3, which under ACES read as a black
       slab from the air — a hole punched in the middle of the campus. */
    roofTop: reg(new THREE.MeshStandardMaterial({
      color: 0x8b8781, roughness: .82, metalness: .12,
    }), 0.9, 0.3),
    darkWall: reg(new THREE.MeshStandardMaterial({
      color: 0x1a1a1c, roughness: .72, metalness: .12,
    }), 0.85, 0.28),
    glass: reg(new THREE.MeshPhysicalMaterial({
      color: 0xa9bcc2, roughness: .06, metalness: .0, reflectivity: .55,
      transparent: true, opacity: .2, side: THREE.DoubleSide,
      clearcoat: 1, clearcoatRoughness: .04, depthWrite: false,
    }), 1.5, 0.7),
    trunk: reg(new THREE.MeshStandardMaterial({
      color: 0x33261c, roughness: .9, metalness: .02,
    }), 0.8, 0.26),
    planter: reg(new THREE.MeshStandardMaterial({
      color: 0x1b1c1e, roughness: .55, metalness: .18,
    }), 1.0, 0.32),
    soil: reg(new THREE.MeshStandardMaterial({
      color: 0x241f1a, roughness: .98, metalness: .0,
    }), 0.7, 0.22),
  };

  /* emissives — everything that glows without costing a real light */
  const E = {
    down: regE(new THREE.MeshStandardMaterial({
      color: 0x2a1c12, emissive: 0xffce93, emissiveIntensity: .8,
      roughness: .5, metalness: .1,
    }), .8, 2.6),
    uplight: regE(new THREE.MeshStandardMaterial({
      color: 0x1a1410, emissive: 0xffb974, emissiveIntensity: .5,
      roughness: .6, metalness: .1,
    }), .5, 2.2),
    step: regE(new THREE.MeshStandardMaterial({
      color: 0x1c1712, emissive: 0xffc487, emissiveIntensity: .6,
      roughness: .6, metalness: .1,
    }), .6, 2.4),
    doorGlow: regE(new THREE.MeshStandardMaterial({
      color: 0x3a2a1c, emissive: 0xffc07a, emissiveIntensity: .45,
      roughness: .9, metalness: .0,
    }), .45, 1.9),
    pondLamp: regE(new THREE.MeshStandardMaterial({
      color: 0x14201c, emissive: 0x9fd8c4, emissiveIntensity: .5,
      roughness: .5, metalness: .1,
    }), .5, 2.0),
    portalStrip: regE(new THREE.MeshStandardMaterial({
      color: 0x2a1c12, emissive: 0xffbe80, emissiveIntensity: .7,
      roughness: .6, metalness: .1,
    }), .7, 2.4),
  };

  /* the 12 villa-number plaque materials (11 keys in 隐逸居 + a spare) */
  const plaqueMats = [];
  for (let i = 1; i <= 12; i++) {
    const t = texPlaque(String(i).padStart(2, '0'));
    plaqueMats.push(regE(new THREE.MeshStandardMaterial({
      map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .55,
      roughness: .55, metalness: .2, side: THREE.DoubleSide,
    }), .55, 1.7));
  }

  /* the black mirror water — very low roughness, high reflectivity, and a
     painted reflection so it shows the building even without a real reflector */
  const mirrorTex = texPondMirror();
  function waterMat() {
    const t = mirrorTex.clone();
    t.needsUpdate = true;
    const m = new THREE.MeshPhysicalMaterial({
      map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .12,
      color: 0xffffff, roughness: .025, metalness: .0, reflectivity: 1.0,
      clearcoat: 1, clearcoatRoughness: .0, ior: 1.5,
    });
    m.envMapIntensity = 2.1;
    ENVM.push({ m, d: 2.1, n: 1.0 });
    EMIS.push({ m, d: .12, n: .5 });
    waterMats.push(m);
    return m;
  }

  /* ───────────────────────────────────────────── court floor: gravel beds ── */

  const court = new THREE.Group();
  root.add(court);

  mkPlate(court, A.courtW, A.courtD,
    retile(M.gravel, A.courtW / 3.2, A.courtD / 3.2), A.cx, Y_GRAVEL, A.cz);

  // paler beige gravel patches — the photo's warm patch in the grey field
  for (const p of [[17.4, -45.0, 2.8], [1.6, -45.9, 2.5]]) {
    const SEG = 20;
    const g = new THREE.CircleGeometry(p[2], SEG);
    const pos = g.attributes.position;
    const jr = mulberry32(1201 + p[0] * 7 | 0);
    // CircleGeometry emits centre + SEG+1 rim verts, the last duplicating the
    // first for the UV seam — they must get the SAME jitter or the blob splits.
    const sc = [];
    for (let i = 0; i < SEG; i++) sc.push(.74 + jr() * .42);
    for (let i = 1; i < pos.count; i++) {
      const s = sc[(i - 1) % SEG];
      pos.setX(i, pos.getX(i) * s);
      pos.setY(i, pos.getY(i) * s);
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, retile(M.gravelPale, p[2] / 1.6, p[2] / 1.6));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p[0], Y_GRAVEL + 0.012, p[1]);
    court.add(m);
  }

  // stone paving on the walking routes (the T through the court)
  for (const P of [PATH_NS, PATH_EW]) {
    const w = P.x1 - P.x0, d = P.z1 - P.z0;
    mkPlate(court, w, d, retile(M.paving, w / 1.5, d / 1.5),
      (P.x0 + P.x1) / 2, Y_PAVE, (P.z0 + P.z1) / 2);
  }

  /* ─────────────────────────────────────── gallery decking (ground floor) ── */

  const GAL = [
    [X0, Z0, X1, CZ0],     // north gallery
    [X0, CZ1, X1, Z1],     // south gallery
    [X0, CZ0, CX0, CZ1],   // west gallery
    [CX1, CZ0, X1, CZ1],   // east gallery
  ];
  for (const [ax, az, bx, bz] of GAL) {
    const w = bx - ax, d = bz - az;
    mkBox(root, w, Y_DECK, d, retile(M.deck, w / 2.6, d / 2.6, isSideRun(az, bz)),
      (ax + bx) / 2, Y_DECK / 2, (az + bz) / 2);
  }

  /* ────────────────────────────────────────────── the two reflecting ponds ── */

  const pondLightPos = [];
  for (let i = 0; i < A.PONDS.length; i++) {
    buildPond(root, M, E, waterMat(), A.PONDS[i], i);
    pondLightPos.push([A.PONDS[i][0], A.PONDS[i][1]]);
  }

  /* ─────────────────────────────────────── loose pebbles for the silhouette ── */

  buildPebbles(root, M.pebble, rnd);

  /* ──────────────────────────────────────────────────── the black columns ── */

  const colXs = [-7, -1, 5, 11, 17, 23];                       // long sides
  const colZs = [-48.5, -44.75, -41, -37.25, -33.5];           // short sides
  const colPts = [];
  for (const x of colXs) { colPts.push([x, CZ0]); colPts.push([x, CZ1]); }
  for (const z of colZs) {
    if (z === CZ0 || z === CZ1) continue;                      // corners already in
    colPts.push([CX0, z]); colPts.push([CX1, z]);
  }
  const colMat = retile(M.column, 1, H2 / 2.4);
  const capMat = M.bronze;
  for (const [x, z] of colPts) {
    mkBox(root, COL, H2, COL, colMat, x, H2 / 2, z);
    mkBox(root, COL + .1, .06, COL + .1, capMat, x, .05, z);   // base shoe
    mkBox(root, COL + .08, .05, COL + .08, capMat, x, H1 - .04, z);
  }

  /* column uplights — fake, one emissive disc per column base */
  {
    const g = new THREE.CircleGeometry(.13, 12);
    const inst = new THREE.InstancedMesh(g, E.uplight, colPts.length);
    const d = new THREE.Object3D();
    colPts.forEach(([x, z], i) => {
      d.position.set(x + COL / 2 + .13, Y_DECK + .012, z);
      d.rotation.set(-Math.PI / 2, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    root.add(inst);
  }

  /* ───────────────────────── the gallery slabs: timber soffits + copper fascia ── */

  // 2F deck / 1F ceiling — punched for the stairwell
  const slab1 = [
    [X0, Z0, WELL.x0, CZ0],          // north, west of the well
    [WELL.x1, Z0, X1, CZ0],          // north, east of the well
    [WELL.x0, Z0, WELL.x1, WELL.z0], // north, above the stair landing
    [X0, CZ1, X1, Z1],               // south
    [X0, CZ0, WELL.x0, CZ1],         // west, outer strip
    [WELL.x0, WELL.z1, WELL.x1, CZ1],// west, inner strip south of the well
    [CX1, CZ0, X1, CZ1],             // east
  ];
  for (const [ax, az, bx, bz] of slab1) buildSlab(root, M, ax, az, bx, bz, H1, false);

  // roof over the galleries, open to the sky in the middle
  const slab2 = [
    [X0, Z0, X1, CZ0], [X0, CZ1, X1, Z1],
    [X0, CZ0, CX0, CZ1], [CX1, CZ0, X1, CZ1],
  ];
  for (const [ax, az, bx, bz] of slab2) buildSlab(root, M, ax, az, bx, bz, H2, true);

  // slim copper reveal along the court edge of the 2F slab (the photo's warm line)
  const rev = [
    [A.cx, CZ0 - .03, A.courtW, .06], [A.cx, CZ1 + .03, A.courtW, .06],
  ];
  for (const [x, z, w, t] of rev) mkBox(root, w, .1, t, M.copper, x, H1 - SLAB - .05, z);
  mkBox(root, .06, .1, A.courtD, M.copper, CX0 - .03, H1 - SLAB - .05, A.cz);
  mkBox(root, .06, .1, A.courtD, M.copper, CX1 + .03, H1 - SLAB - .05, A.cz);

  /* ──────────────────────────────────── recessed downlights in both soffits ── */

  buildDownlights(root, E.down, SOF1 - .01, true);
  buildDownlights(root, E.down, SOF2 - .01, false);

  /* ─────────────────────────────────────────────────── perimeter facades ── */

  const plaques = [];            // { x, y, z, ry, variant }
  const walls = [
    // [cx, cz, dirX, dirZ, outX, outZ, length, rotY]
    [A.cx, Z1, 1, 0, 0, 1, A.w, 0],            // south — faces the suite
    [A.cx, Z0, -1, 0, 0, -1, A.w, Math.PI],    // north
    [X0, A.cz, 0, 1, -1, 0, A.d, -Math.PI / 2],// west
    [X1, A.cz, 0, -1, 1, 0, A.d, Math.PI / 2], // east
  ];
  const wallGaps = [
    // south: the way through to the presidential suite (local x = world x - cx)
    [[PORTAL.x0 - A.cx, PORTAL.x1 - A.cx]],
    [],
    [],
    // east: the side door toward the 隐逸居 lounge (local x = -(z - cz))
    [[-(LOUNGE_DOOR.z1 - A.cz), -(LOUNGE_DOOR.z0 - A.cz)]],
  ];
  const holes = { south: null, east: null };
  for (let w = 0; w < walls.length; w++) {
    for (let f = 0; f < A.floors; f++) {
      const h = buildFacade(root, M, E, plaqueMats, plaques, walls[w],
        f === 0 ? wallGaps[w] : [], f * H1, H1, rnd, f);
      if (f === 0 && h.length) {
        if (w === 0) holes.south = h[0];
        if (w === 3) holes.east = h[0];
      }
    }
  }
  buildPlaques(root, plaqueMats, plaques);

  /* the framed portal through to the presidential suite, sized to the real
     hole the facade left (module skipping rounds it outward) */
  buildPortal(root, M, E, holes.south || { x0: PORTAL.x0, x1: PORTAL.x1 });
  if (holes.east) buildSideOpening(root, M, holes.east);

  /* the four wall runs meet at the envelope corners but each stops on its own
     inner face — a 0.3 m notch is left over. Close it with a corner post. */
  for (const cx of [X0, X1]) for (const cz of [Z0, Z1]) {
    mkBox(root, WALL_T + .06, H2, WALL_T + .06, M.darkWall,
      cx + (cx === X0 ? -1 : 1) * WALL_T / 2,
      H2 / 2,
      cz + (cz === Z0 ? -1 : 1) * WALL_T / 2);
  }

  /* ──────────────────────────────────── upper gallery balustrade + handrail ── */

  // NB: the west court edge between CZ0 and WELL.z1 is the stairwell void — the
  // rail steps back to the well's outer edge there instead.
  const rails = [
    [CX0, CZ1, CX1, CZ1],                  // south court edge
    [CX1, CZ1, CX1, CZ0],                  // east court edge
    [CX1, CZ0, CX0, CZ0],                  // north court edge
    [CX0, WELL.z1, CX0, CZ1],              // west court edge, south of the well
    [CX0, WELL.z0, CX0, CZ0],              // west edge of the north-gallery deck
    [WELL.x0, WELL.z0, WELL.x0, WELL.z1],  // stairwell outer edge
    [WELL.x0, WELL.z1, CX0, WELL.z1],      // stairwell end cap
  ];
  for (const [ax, az, bx, bz] of rails) buildBalustrade(root, M, ax, az, bx, bz, H1, 0);

  /* ─────────────────────────────────────────────── the open-riser stair ── */

  buildStair(root, M, E);

  /* ────────────────────────────────── cloud-pruned topiary + broad-leaf shrubs ── */

  const planted = [];
  buildPlanting(root, M, rnd, planted);

  /* ─────────────────────────────────────────────────────── real lights (6) ── */

  const gal = [
    [-10.5, -45.0], [26.5, -41.0], [A.cx, -30.6], [A.cx, -51.2],
  ];
  for (const [x, z] of gal) {
    const l = new THREE.PointLight(0xffbe80, 7, 19, 2);
    l.position.set(x, SOF1 - .35, z);
    root.add(l);
    PLIGHT.push({ l, d: 7, n: 26 });
  }
  for (const [x, z] of pondLightPos) {
    const l = new THREE.PointLight(0xbfe6d6, 2.2, 10, 2);
    l.position.set(x, .16, z);
    root.add(l);
    PLIGHT.push({ l, d: 2.2, n: 9 });
  }

  /* ─────────────────────────────────────────────────────────── colliders ── */

  const C = (G.colliders ||= []);
  const before = C.length;

  // perimeter walls. The two walking gaps use the hole the facade ACTUALLY cut
  // (module skipping rounds outward) so the collider never seals a visible hole.
  const sGap = holes.south || { x0: PORTAL.x0, x1: PORTAL.x1 };
  const eGap = holes.east || { z0: LOUNGE_DOOR.z0, z1: LOUNGE_DOOR.z1 };
  colLine(C, X0, Z0, X1, Z0, .95);                                   // north
  colLine(C, X0, Z1, X1, Z1, .95, x => x > sGap.x0 - .1 && x < sGap.x1 + .1);
  colLine(C, X0, Z0, X0, Z1, .95);                                   // west
  colLine(C, X1, Z0, X1, Z1, .95,
    (x, z) => z > eGap.z0 - .1 && z < eGap.z1 + .1);                 // east
  // columns
  for (const [x, z] of colPts) C.push({ x, z, r: A.colR + .18 });
  // raised pond edging — a modest r keeps the gravel walk BETWEEN the two
  // ponds (the photo's route) comfortably wide while still sealing the chain
  for (const [pcx, pcz, pw, pd] of A.PONDS)
    colRect(C, pcx - pw / 2, pcz - pd / 2, pcx + pw / 2, pcz + pd / 2, .7);
  // planters
  for (const p of planted) C.push(p);
  // the stair's low end, so you can't walk into the underside of the flight
  colLine(C, STAIR.x, STAIR.zFoot, STAIR.x, STAIR.zFoot - 4.1, .95);

  /* ──────────────────────────────────────────────────────── static batching ── */

  // Nothing above this line moves except the marked canopies, so bake it down:
  // ~950 little boxes collapse into one mesh per material.
  const batched = batchLocal(root);

  /* ───────────────────────────────────────────────────────────── tickers ── */

  const tickers = (G.tickers ||= []);

  // the water: mirror-flat by design — this is a drift, not a ripple
  tickers.push((dt, t) => {
    for (let i = 0; i < waterMats.length; i++) {
      const m = waterMats[i];
      if (!m.map) continue;
      m.map.offset.y = Math.sin(t * 0.055 + i * 1.7) * 0.004;
      m.map.offset.x = Math.cos(t * 0.041 + i) * 0.003;
      const base = night ? .5 : .12;
      m.emissiveIntensity = base * (1 + Math.sin(t * .5 + i * 2.1) * .07);
    }
  });

  // niwaki + shrubs: the barest breath of movement
  const swayers = [];
  root.traverse(o => { if (o.userData.sway) swayers.push(o); });
  tickers.push((dt, t) => {
    for (let i = 0; i < swayers.length; i++) {
      const o = swayers[i], p = o.userData.sway;
      o.rotation.z = p.base + Math.sin(t * p.spd + p.ph) * p.amp;
    }
  });

  G.scene.add(root);
  root.userData.colliderCount = C.length - before;
  root.userData.batches = batched;

  /* apply the day values once so envMapIntensity/emissives are never left at
     the constructor defaults if world.js never flips the day↔night switch */
  setAtriumNight(false);
  return root;
}

/* ═══════════════════════════════════════════════════════ sub-builders ══════ */

/* a gallery slab: timber deck (or metal roof) on top, mahogany soffit below,
   copper fascia on the exposed edges. BoxGeometry material order is
   [+x, -x, +y, -y, +z, -z] — that gives us the soffit for free. */
function buildSlab(parent, M, ax, az, bx, bz, yTop, isRoof) {
  const w = bx - ax, d = bz - az;
  const side = isSideRun(az, bz);
  const soffit = retile(M.soffit, w / 5.0, d / 5.0, side);
  const top = isRoof ? M.roofTop : retile(M.deck, w / 2.6, d / 2.6, side);
  const edge = isRoof ? M.fascia : M.darkWall;
  const mats = [edge, edge, top, soffit, edge, edge];
  const m = new THREE.Mesh(boxGeo(w, SLAB, d), mats);
  m.position.set((ax + bx) / 2, yTop - SLAB / 2, (az + bz) / 2);
  parent.add(m);
  return m;
}

/* recessed warm downlights punched into a soffit plane, gallery ring only */
function buildDownlights(parent, mat, y, isFloor1) {
  const pts = [];
  for (let x = X0 + 1.55; x <= X1 - 1.4; x += 2.7) {
    for (let z = Z0 + 1.55; z <= Z1 - 1.4; z += 2.7) {
      if (x > CX0 && x < CX1 && z > CZ0 && z < CZ1) continue;        // open to sky
      if (isFloor1 && x > WELL.x0 - .2 && x < WELL.x1 + .2
        && z > WELL.z0 - .2 && z < WELL.z1 + .2) continue;           // stairwell
      pts.push([x, z]);
    }
  }
  const g = new THREE.CircleGeometry(.085, 10);
  const inst = new THREE.InstancedMesh(g, mat, pts.length);
  const d = new THREE.Object3D();
  pts.forEach(([x, z], i) => {
    d.position.set(x, y, z);
    d.rotation.set(Math.PI / 2, 0, 0);          // face straight down
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  parent.add(inst);
  return inst;
}

/* a still reflecting pool: raised black granite edging, fine mitred lighter
   coping, near-black water sitting just under the cap. */
function buildPond(parent, M, E, water, spec, idx) {
  const [pcx, pcz, pw, pd] = spec;
  const RIM = 0.40;          // raised edging height
  const T = 0.42;            // edging thickness
  const WY = RIM - 0.055;    // water surface, just under the coping

  const g = new THREE.Group();
  g.name = `pond${idx}`;
  parent.add(g);

  const gm = retile(M.granite, pw / 1.2, RIM / 1.2);
  // four sides of the raised basin
  mkBox(g, pw, RIM, T, gm, pcx, RIM / 2, pcz - pd / 2 + T / 2);
  mkBox(g, pw, RIM, T, gm, pcx, RIM / 2, pcz + pd / 2 - T / 2);
  mkBox(g, T, RIM, pd - T * 2, gm, pcx - pw / 2 + T / 2, RIM / 2, pcz);
  mkBox(g, T, RIM, pd - T * 2, gm, pcx + pw / 2 - T / 2, RIM / 2, pcz);

  // thin lighter stone band capping the edge — a fine mitred coping
  // picture-frame layout: the long bars run full width, the short bars stop
  // between them — overlapping them would z-fight along the mitre.
  const cm = retile(M.coping, pw / .9, 1);
  const CW = T + 0.1, CH = 0.035;
  const shortLen = Math.max(.2, pd - T - CW);
  mkBox(g, pw + .1, CH, CW, cm, pcx, RIM + CH / 2, pcz - pd / 2 + T / 2);
  mkBox(g, pw + .1, CH, CW, cm, pcx, RIM + CH / 2, pcz + pd / 2 - T / 2);
  mkBox(g, CW, CH, shortLen, cm, pcx - pw / 2 + T / 2, RIM + CH / 2, pcz);
  mkBox(g, CW, CH, shortLen, cm, pcx + pw / 2 - T / 2, RIM + CH / 2, pcz);

  // dark basin floor so nothing shows through at grazing angles
  mkBox(g, pw - T * 2, .06, pd - T * 2, M.darkWall, pcx, .04, pcz);

  // THE water — one flat plane, no ripple geometry: stillness is the point
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(pw - T * 2, pd - T * 2), water);
  wm.rotation.x = -Math.PI / 2;
  wm.position.set(pcx, WY, pcz);
  wm.renderOrder = 1;
  g.add(wm);

  // submerged lamps (fake — the real PointLight sits above them)
  const lampG = new THREE.CircleGeometry(.11, 10);
  const n = Math.max(2, Math.round(pw / 3.2));
  const inst = new THREE.InstancedMesh(lampG, E.pondLamp, n);
  const dm = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    dm.position.set(pcx - pw / 2 + T + 0.6 + i * ((pw - T * 2 - 1.2) / Math.max(1, n - 1)),
      .075, pcz);
    dm.rotation.set(-Math.PI / 2, 0, 0);
    dm.scale.set(1, 1, 1);
    dm.updateMatrix();
    inst.setMatrixAt(i, dm.matrix);
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  g.add(inst);
  return g;
}

/* loose pebbles hugging the pond edges — silhouette, not surface */
function buildPebbles(parent, mat, rnd) {
  const pts = [];
  for (const [pcx, pcz, pw, pd] of SITE.ATRIUM.PONDS) {
    for (let i = 0; i < 110; i++) {
      const side = Math.floor(rnd() * 4);
      const off = .34 + rnd() * 1.5;
      let x, z;
      if (side === 0) { x = pcx - pw / 2 + rnd() * pw; z = pcz - pd / 2 - off; }
      else if (side === 1) { x = pcx - pw / 2 + rnd() * pw; z = pcz + pd / 2 + off; }
      else if (side === 2) { x = pcx - pw / 2 - off; z = pcz - pd / 2 + rnd() * pd; }
      else { x = pcx + pw / 2 + off; z = pcz - pd / 2 + rnd() * pd; }
      if (x < CX0 - .4 || x > CX1 - .1 || z < CZ0 + .2 || z > CZ1 - .2) continue;
      pts.push([x, z, rnd()]);
    }
  }
  if (!pts.length) return null;
  const g = new THREE.IcosahedronGeometry(1, 0);
  const inst = new THREE.InstancedMesh(g, mat, pts.length);
  const d = new THREE.Object3D();
  pts.forEach(([x, z, t], i) => {
    const s = .05 + t * .10;
    d.position.set(x, Y_GRAVEL + s * .45, z);
    d.rotation.set(t * 6.28, t * 3.14, t * 4.71);
    d.scale.set(s * (1 + t * .5), s * .62, s);
    d.updateMatrix();
    inst.setMatrixAt(i, d.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.computeBoundingSphere();
  parent.add(inst);
  return inst;
}

/* one storey of perimeter facade: floor-to-ceiling glazing in dark bronze
   frames (the villa entries), stacked slate panels, dark timber screens. */
function buildFacade(parent, M, E, plaqueMats, plaques, wall, gaps, y0, h, rnd, floor) {
  const [ox, oz, dx, dz, nx, nz, len, ry] = wall;
  const n = Math.max(4, Math.round(len / 2.95));
  const mw = len / n;

  // wall-local (lx, ly, lz) → world; lz grows OUTWARD from the court
  const wx = (lx, lz) => ox + dx * lx + nx * lz;
  const wz = (lx, lz) => oz + dz * lx + nz * lz;
  const put = (w, hh, d, mat, lx, ly, lz) =>
    mkBox(parent, w, hh, d, mat, wx(lx, lz), y0 + ly, wz(lx, lz), ry);

  // module size is constant per wall+floor, so tile the panel finishes once
  const slateMat = retile(M.slate, mw / 1.3, h / 1.3);
  const screenMat = retile(M.screen, mw / .9, h / 1.8);

  // a module is dropped if its span touches a gap; record what actually went
  const cut = gaps.map(() => ({ a: Infinity, b: -Infinity }));
  const inGap = lx => {
    for (let k = 0; k < gaps.length; k++) {
      const [a, b] = gaps[k];
      if (lx + mw * .5 > a && lx - mw * .5 < b) {
        cut[k].a = Math.min(cut[k].a, lx - mw * .5);
        cut[k].b = Math.max(cut[k].b, lx + mw * .5);
        return true;
      }
    }
    return false;
  };

  let doorNo = floor * 6;
  for (let i = 0; i < n; i++) {
    const lx = -len / 2 + (i + .5) * mw;
    if (inGap(lx)) continue;

    // every module gets a dark backing so nothing reads as a hole
    put(mw, h, WALL_T, M.darkWall, lx, h / 2, WALL_T / 2);

    const isDoor = i % 2 === 0;
    if (isDoor) {
      /* ── a villa entry: bronze frame, two glass leaves, warm glow behind ── */
      const dw = mw * .78, dh = h - .55;
      put(dw + .14, dh + .14, .12, M.bronze, lx, dh / 2 + .04, -.02);      // frame
      put(dw, dh, .05, M.glass, lx, dh / 2 + .04, -.06);                   // leaves
      put(.05, dh, .07, M.bronze, lx, dh / 2 + .04, -.07);                 // meeting stile
      put(dw + .18, .1, .16, M.bronze, lx, dh + .14, -.03);                // head
      // interior glow sits in FRONT of the opaque backing (whose face is at
      // lz = 0) and BEHIND the glass leaves at lz = -.06 — otherwise it is
      // buried inside the wall and never seen.
      put(dw * .92, dh * .9, .02, E.doorGlow, lx, dh / 2 + .04, -.015);
      // transom above the door
      put(mw * .84, .3, .05, M.glass, lx, dh + .34, -.03);
      // number plaque beside the door
      plaques.push({
        x: wx(lx + mw * .43, -.04), y: y0 + 1.55, z: wz(lx + mw * .43, -.04),
        ry, v: (doorNo++) % plaqueMats.length,
      });
    } else {
      const kind = rnd();
      if (kind < .42) {
        /* ── stacked slate feature panel, proud of the wall face ── */
        put(mw * .96, h - .12, .18, slateMat, lx, h / 2, -.02);
        put(mw * .96, .05, .22, M.bronze, lx, h - .06, -.03);
      } else if (kind < .72) {
        /* ── dark timber screen ── */
        put(mw * .94, h - .3, .1, screenMat, lx, h / 2, -.01);
        put(mw * .96, .09, .14, M.bronze, lx, h - .12, -.02);
        put(mw * .96, .09, .14, M.bronze, lx, .1, -.02);
      } else {
        /* ── floor-to-ceiling glazing in slim bronze mullions ── */
        put(mw * .92, h - .35, .05, M.glass, lx, h / 2, -.04);
        put(.07, h - .35, .1, M.bronze, lx, h / 2, -.05);
        put(mw * .96, .1, .14, M.bronze, lx, h - .18, -.04);
        put(mw * .96, .1, .14, M.bronze, lx, .12, -.04);
        put(mw * .84, (h - .35) * .8, .02, E.doorGlow, lx, h / 2, -.015);
      }
    }
  }

  /* world-space extent of each hole actually cut, for the framing pieces */
  return cut.filter(c => c.b > c.a).map(c => ({
    x0: Math.min(wx(c.a, 0), wx(c.b, 0)), x1: Math.max(wx(c.a, 0), wx(c.b, 0)),
    z0: Math.min(wz(c.a, 0), wz(c.b, 0)), z1: Math.max(wz(c.a, 0), wz(c.b, 0)),
    ry,
  }));
}

/* all villa-number plaques as a handful of InstancedMeshes (one per number) */
function buildPlaques(parent, mats, list) {
  const byVariant = new Map();
  for (const p of list) {
    if (!byVariant.has(p.v)) byVariant.set(p.v, []);
    byVariant.get(p.v).push(p);
  }
  const g = new THREE.PlaneGeometry(.24, .18);
  const d = new THREE.Object3D();
  for (const [v, arr] of byVariant) {
    const inst = new THREE.InstancedMesh(g, mats[v], arr.length);
    arr.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, p.ry + Math.PI, 0);      // face into the gallery
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      inst.setMatrixAt(i, d.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    parent.add(inst);
  }
}

/* the framed way through to the presidential suite, south side.
   `hole` is the span the facade actually cut (module skipping rounds outward),
   so the piers always land on solid wall with no sliver left open. */
function buildPortal(parent, M, E, hole) {
  const z = Z1, hh = H1;
  const pw = .9;
  const hx0 = hole.x0, hx1 = hole.x1;
  for (const s of [-1, 1]) {
    mkBox(parent, pw, hh, WALL_T + .5, M.column,
      (s < 0 ? hx0 : hx1) + s * pw / 2, hh / 2, z);
  }
  const span = (hx1 - hx0) + pw * 2;
  const cx = (hx0 + hx1) / 2;
  mkBox(parent, span, .62, WALL_T + .5, M.darkWall, cx, hh - .31, z);      // header
  mkBox(parent, span, .1, WALL_T + .58, M.copper, cx, hh - .66, z);        // copper reveal
  mkBox(parent, span - .5, .05, .06, E.portalStrip, cx, hh - .76, z - .3); // warm strip

  const t = texPortalPlaque();
  const m = new THREE.MeshStandardMaterial({
    map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .6,
    roughness: .5, metalness: .25, side: THREE.DoubleSide,
  });
  EMIS.push({ m, d: .6, n: 1.8 });
  ENVM.push({ m, d: 1.0, n: .4 });
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .48), m);
  pl.position.set(cx, hh - 1.35, z - .32);
  pl.rotation.y = Math.PI;
  parent.add(pl);
}

/* the side door east toward the 隐逸居 lounge — a plain bronze reveal */
function buildSideOpening(parent, M, hole) {
  const cx = (hole.x0 + hole.x1) / 2, cz = (hole.z0 + hole.z1) / 2;
  const along = Math.max(hole.x1 - hole.x0, hole.z1 - hole.z0);
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = hole.ry;
  parent.add(g);
  mkBox(g, along + .5, .5, WALL_T + .4, M.darkWall, 0, H1 - .25, 0);   // header
  mkBox(g, along + .5, .09, WALL_T + .48, M.copper, 0, H1 - .54, 0);   // copper reveal
  for (const s of [-1, 1]) mkBox(g, .32, H1, WALL_T + .4, M.bronze, s * (along / 2 + .16), H1 / 2, 0);
}

/* glass balustrade in slim dark frames + the copper handrail.
   `tilt` (radians, negative = rises toward the far end) lets the same builder
   follow the stair. Two nested groups keep the yaw and the tilt from fighting
   over Euler order — each group carries exactly one rotation. */
function buildBalustrade(parent, M, ax, az, bx, bz, y, tilt, runLen) {
  const dx = bx - ax, dz = bz - az;
  const span = Math.hypot(dx, dz);
  if (span < .05) return null;
  const len = runLen || span;
  const ry = Math.atan2(dx, dz);          // align local +Z with the run
  const cx = (ax + bx) / 2, cz = (az + bz) / 2;

  const outer = new THREE.Group();
  outer.position.set(cx, y, cz);
  outer.rotation.y = ry;
  parent.add(outer);

  const g = new THREE.Group();
  if (tilt) g.rotation.x = tilt;
  outer.add(g);

  const RH = 1.05;
  mkBox(g, .05, .78, len - .12, M.glass, 0, .5, 0);                 // glass infill
  mkBox(g, .07, .07, len, M.steel, 0, .1, 0);                       // bottom shoe
  const posts = Math.max(2, Math.round(len / 2.1));
  for (let i = 0; i <= posts; i++) {
    const t = -len / 2 + (len * i) / posts;
    mkBox(g, .05, RH, .05, M.steel, 0, RH / 2, t);
  }
  // the copper handrail — the signature line of this courtyard
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(.032, .032, len, 10), M.copper);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(0, RH, 0);
  g.add(rail);
  return g;
}

/* the open-riser stair: floating dark treads on a single folded-plate stringer,
   glass balustrade on the court side, copper handrail, step lights. */
function buildStair(parent, M, E) {
  const g = new THREE.Group();
  g.name = 'atrium-stair';
  parent.add(g);

  const { x, w, risers, rise, going, zFoot, angle } = STAIR;
  const slope = Math.hypot(risers * going, H1);

  // stringer — one plate on the gallery side, treads cantilever off it
  const st = new THREE.Mesh(boxGeo(.1, .42, slope + .3), M.steel);
  st.position.set(x - w / 2 - .07, H1 / 2 - .12, (zFoot + STAIR.zTop) / 2);
  st.rotation.x = angle;
  g.add(st);

  // a second, slimmer plate under the open side keeps the treads reading solid
  const st2 = new THREE.Mesh(boxGeo(.06, .26, slope + .2), M.steel);
  st2.position.set(x + w / 2 + .05, H1 / 2 - .16, (zFoot + STAIR.zTop) / 2);
  st2.rotation.x = angle;
  g.add(st2);

  const treadMat = retile(M.column, 1.6, .5);
  for (let i = 0; i < risers; i++) {
    const ty = (i + 1) * rise;
    const tz = zFoot - (i + .5) * going;
    mkBox(g, w, .065, going * .82, treadMat, x, ty - .03, tz);          // floating tread
    // a slim copper lip on the front edge only — the treads themselves stay dark
    mkBox(g, w + .02, .022, .03, M.copper, x, ty - .012, tz + going * .41);
    if (i % 3 === 1) {                                                  // step light
      mkBox(g, .05, .035, going * .5, E.step, x - w / 2 - .1, ty - .12, tz);
    }
  }

  // sloped glass balustrade + copper handrail on the open (court) side.
  // local +Z runs foot→top, so a NEGATIVE tilt makes that direction rise.
  buildBalustrade(g, M, x + w / 2 + .12, zFoot, x + w / 2 + .12, STAIR.zTop,
    H1 / 2 + .11, -angle, slope);

  // a short landing rail where the flight meets the 2F deck
  buildBalustrade(g, M, x - w / 2, STAIR.zTop - .06, x + w / 2 + .12, STAIR.zTop - .06,
    H1, 0);
  return g;
}

/* cloud-pruned niwaki + broad-leaf shrub clusters, the courtyard's signature
   planting. Placement hugs the pond edges exactly as the photo shows. */
function buildPlanting(parent, M, rnd, colliders) {
  const P = SITE.ATRIUM.PONDS;

  const blocked = (x, z, pad) => {
    if (x < CX0 + .7 || x > CX1 - .7 || z < CZ0 + .7 || z > CZ1 - .7) return true;
    for (const [pcx, pcz, pw, pd] of P) {
      if (x > pcx - pw / 2 - pad && x < pcx + pw / 2 + pad
        && z > pcz - pd / 2 - pad && z < pcz + pd / 2 + pad) return true;
    }
    if (inRect(x, z, PATH_NS, .5) || inRect(x, z, PATH_EW, .5)) return true;
    return false;
  };
  const spot = (minOff, maxOff) => {
    const p = P[rnd() < .55 ? 0 : 1];
    const [pcx, pcz, pw, pd] = p;
    const side = Math.floor(rnd() * 4);
    const off = minOff + rnd() * (maxOff - minOff);
    if (side === 0) return [pcx - pw / 2 + rnd() * pw, pcz - pd / 2 - off];
    if (side === 1) return [pcx - pw / 2 + rnd() * pw, pcz + pd / 2 + off];
    if (side === 2) return [pcx - pw / 2 - off, pcz - pd / 2 + rnd() * pd];
    return [pcx + pw / 2 + off, pcz - pd / 2 + rnd() * pd];
  };

  const foliageMats = [];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Color().setHSL(.26 - i * .012, .40 + i * .05, .17 + i * .035);
    foliageMats.push(new THREE.MeshStandardMaterial({
      color: c, roughness: .88, metalness: .0, flatShading: true,
    }));
    ENVM.push({ m: foliageMats[i], d: .9, n: .3 });
  }
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x4a7a3c, roughness: .8, metalness: .0, flatShading: true,
  });
  ENVM.push({ m: leafMat, d: .95, n: .32 });

  const placed = [];
  // Rejection sampling into a fairly narrow band (the gravel between the pond
  // edging and the walking routes), so give it plenty of attempts — running out
  // would silently under-plant the courtyard.
  const tryPlace = (minOff, maxOff, sep) => {
    for (let k = 0; k < 600; k++) {
      const [x, z] = spot(minOff, maxOff);
      if (blocked(x, z, .55)) continue;
      let ok = true;
      for (const q of placed) if (Math.hypot(q[0] - x, q[1] - z) < sep) { ok = false; break; }
      if (!ok) continue;
      placed.push([x, z]);
      return [x, z];
    }
    return null;
  };

  /* ── the topiary ── */
  for (let i = 0; i < SITE.ATRIUM.topiary; i++) {
    const at = tryPlace(1.0, 2.9, 1.9);
    if (!at) break;
    const [x, z] = at;
    const g = new THREE.Group();
    g.position.set(x, Y_GRAVEL, z);
    g.rotation.y = rnd() * 6.28;
    parent.add(g);

    // low planter
    const pr = .62 + rnd() * .3;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr * .94, .22, 14), M.planter);
    pot.position.y = .11; g.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(pr * .9, pr * .9, .04, 14), M.soil);
    soil.position.y = .23; g.add(soil);

    // short dark trunk, slightly leaning
    const th = .5 + rnd() * .55;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(.045, .075, th, 7), M.trunk);
    tr.position.set(0, .24 + th / 2, 0);
    tr.rotation.z = (rnd() - .5) * .22;
    g.add(tr);

    // 3–5 irregular stacked foliage clouds — the niwaki read.
    // They live in their own group so the sway animates ONE object and the
    // clouds themselves can be baked into a single mesh.
    const canopy = new THREE.Group();
    canopy.userData.sway = {
      base: 0, amp: .012 + rnd() * .012, spd: .5 + rnd() * .5, ph: rnd() * 6.28,
    };
    g.add(canopy);
    const fm = foliageMats[Math.floor(rnd() * foliageMats.length)];  // one green per plant
    const clouds = 3 + Math.floor(rnd() * 3);
    let y = .24 + th * .72;
    for (let c = 0; c < clouds; c++) {
      const r = .30 + rnd() * .30 - c * .028;
      const rr = Math.max(.16, r);
      const arm = c === 0 ? 0 : (.16 + rnd() * .5);
      const ang = rnd() * 6.28;
      const bx = Math.cos(ang) * arm, bz = Math.sin(ang) * arm;

      if (arm > .1) {                                  // the branch out to the cloud
        const bl = Math.hypot(arm, .16);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(.026, .034, bl, 6), M.trunk);
        br.position.set(bx / 2, y - .06, bz / 2);
        br.rotation.z = Math.atan2(bx, .16) * .85;
        br.rotation.x = -Math.atan2(bz, .16) * .85;
        g.add(br);
      }
      const cl = new THREE.Mesh(new THREE.SphereGeometry(rr, 8, 6), fm);
      cl.position.set(bx, y, bz);
      cl.scale.set(1 + rnd() * .28, .56 + rnd() * .2, 1 + rnd() * .28);
      cl.rotation.set(rnd() * .4, rnd() * 6.28, rnd() * .4);
      canopy.add(cl);
      y += rr * (.62 + rnd() * .35);
    }
    batchLocal(canopy);                    // clouds → one mesh, still swayable
    colliders.push({ x, z, r: pr + .18 });
  }

  /* ── broad-leaf shrub clusters right at the pond edge ── */
  for (let i = 0; i < 7; i++) {
    const at = tryPlace(.55, 1.3, 1.5);
    if (!at) break;
    const [x, z] = at;
    const g = new THREE.Group();
    g.position.set(x, Y_GRAVEL, z);
    g.rotation.y = rnd() * 6.28;
    g.userData.sway = {
      base: 0, amp: .016 + rnd() * .016, spd: .45 + rnd() * .6, ph: rnd() * 6.28,
    };
    parent.add(g);
    const blobs = 6 + Math.floor(rnd() * 4);
    const bm = rnd() < .5 ? leafMat : foliageMats[3];
    for (let b = 0; b < blobs; b++) {
      const r = .34 + rnd() * .4;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), bm);
      m.position.set((rnd() - .5) * 1.5, r * .58 + rnd() * .35, (rnd() - .5) * 1.5);
      m.scale.set(1 + rnd() * .5, .5 + rnd() * .26, 1 + rnd() * .5);
      m.rotation.set(rnd() * .5, rnd() * 6.28, rnd() * .5);
      g.add(m);
    }
    batchLocal(g);                         // blobs → one mesh, still swayable
    colliders.push({ x, z, r: 1.0 });
  }
}

/* ══════════════════════════════════════════════════════════ day ↔ night ══ */

export function setAtriumNight(on) {
  night = !!on;
  for (const e of EMIS) e.m.emissiveIntensity = on ? e.n : e.d;
  for (const e of ENVM) e.m.envMapIntensity = on ? e.n : e.d;
  for (const p of PLIGHT) p.l.intensity = on ? p.n : p.d;

  // the ponds go from dark glass to true black mirror at night
  for (const m of waterMats) {
    m.roughness = on ? .012 : .025;
    m.color.setHex(on ? 0xd8e4e0 : 0xffffff);
  }
}
