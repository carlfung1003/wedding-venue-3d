// water.js — every body of water on the 隐逸居 campus, plus the hardscape that
// frames it: the hero infinity pool at the presidential suite, its basalt deck
// and turf apron with the 3D "THE WESTIN" letters, the white portal-frame
// cabana pavilions and lounger row that make the far-side silhouette, the
// lounge terrace pool, the free-form lagoon, and ten villa plunge pools.
//
// Every footprint comes from SITE (js/site.js) — nothing here invents a
// coordinate. All materials are defined locally so this module owns no shared
// state beyond the G context.
//
// Reference: reference/photos/Yinyiju main pool.webp (the hero composition),
// "Yinyiju pool view.webp" (portal frames, niches, hanging slatted lanterns),
// "Yinyiju view pool.webp" (pool from the 2F balcony), reference/
// suite-interior-brief.md §7, reference/clubhouse-pdf-brief.md (p5, p14).
//
// Contract:  buildWater(G) -> THREE.Group ,  setWaterNight(on) ,  setLanterns(on)
//   G.scene       the scene to add to
//   G.camera      used for billboarding the lantern glows
//   G.colliders   {x,z,r} cylinder chains pushed for plinths + pavilion piers
//   G.tickers     per-frame callbacks (dt, t)

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SITE } from './site.js';
import { mulberry32 } from './materials.js';

/* ─────────────────────────────── constants ─────────────────────────────── */

const SEED = 20270320;              // 2027.03.20 — mirrors CFG.SEED (kept local
                                    // so water.js has no config.js dependency)

/* Every number a reviewer is likely to want to nudge lives here. The pool in
   Carl's photos is a nearly MIRROR-FLAT turquoise sheet that carries the
   building, the cabanas and the palms — so the reflection does the visual work
   and the ripple/caustic texture is only a whisper underneath it. */
const TUNE = {
  /* ── planar mirror — THE HERO POOL ONLY (one extra scene render) ──────────
     Set MIRROR:false to fall back to the cheap MeshPhysical sheet everywhere. */
  MIRROR: true,
  MIRROR_W: 1024, MIRROR_H: 512,    // reflection RT size — drop to 512×256 if slow
  MIRROR_EVERY: 1,                  // render the mirror every Nth frame (perf knob)
  MIRROR_F0_DAY: .16,               // reflectance looking STRAIGHT DOWN (0 = glass)
  MIRROR_F0_NIGHT: .30,             // night water is a harder, blacker mirror
  MIRROR_POW: 2.4,                  // Fresnel falloff — LOWER = mirror sooner
  MIRROR_STRENGTH_DAY: 1.0,
  MIRROR_STRENGTH_NIGHT: 1.18,
  MIRROR_RIPPLE_AMP: .006,          // reflection wobble. >.02 = funhouse mirror
  MIRROR_RIPPLE_SCALE: .085,        // ripple tiles per metre (small = long swells)
  MIRROR_TINT: 0xf4fbff,            // reflection tint (Reflector `color`)
  BODY_ALPHA_DAY: .52,              // how much turquoise body hides the tile grid
  BODY_ALPHA_NIGHT: .40,            // lower at night so the lit basin glows through
  SHEEN: .07,                       // large-scale surface sheen. >.25 reads as a PATTERN

  /* ── surface texture on the cheap pools: a sheen, never a readable pattern ── */
  NORMAL_DAY: .07, NORMAL_NIGHT: .045,   // was .3 — that was the "white noodles"
  SCROLL_U: .010, SCROLL_V: .007,        // slow drift, in ripple-tiles/second
  ROUGH_DAY: .045, ROUGH_NIGHT: .022,
  ENV_DAY: 2.4, ENV_NIGHT: 1.25,         // envMapIntensity — reflection does the work
  BODY_OPACITY: .78,

  /* ── caustics live on the BASIN TILES, never on the surface plane ── */
  CAUSTIC_DAY: .22, CAUSTIC_NIGHT: .10,
  CAUSTIC_U: .010, CAUSTIC_V: .007,

  /* ── night: the pool must read as a black mirror CARRYING LIGHT ── */
  TILE_EMIT_NIGHT: 1.5,             // hero basin self-glow (others get a fifth of it)
  UW_GLOW_NIGHT: .70,               // underwater pools of light inside the volume
  UW_LIGHT_NIGHT: 16,               // the 2 real PointLights in the hero basin
  LANTERN_POOL_NIGHT: .85,          // lantern glow ON the water surface (9 overlap)
  LANTERN_STREAK_NIGHT: .34,        // fake reflection column — low, the mirror does it now

  /* ── the hero of the night scene: BIG floating lanterns ── */
  LANTERN_R: .70,                   // paper globe radius (was .42)
  LANTERN_EMIT_NIGHT: 2.9,          // paper shell emissive — "lit from within"
  LANTERN_HALO_NIGHT: 1.0,          // billboarded corona around each globe
  LANTERN_LIGHT_NIGHT: 11,          // the 3 real PointLights among the 9 lanterns

  /* ── "THE WESTIN" letters ── */
  LETTER_H: .62, LETTER_T: .09,     // cap height / extrusion depth
};

const C = {
  turquoise:  0x2fa8b8,             // suite-brief §5 "pool water"
  turqNight:  0x0d3c4a,
  lagoon:     0x37bcd0,
  lagoonNight:0x11485c,
  stone:      0x17191a,             // black pool plinth / coping
  stoneLight: 0x24282a,
  basalt:     0x4c4f4e,             // deck pavers
  turf:       0x4e7a3c,
  white:      0xf2f1ec,             // stucco / PVC furniture
  teal:       0x2e9fae,             // umbrellas (clubhouse brief: teal, not blue)
  blue:       0x2b7fc4,             // lagoon umbrellas
  timber:     0x6b3f2a,
  sand:       0xd9c9a8,
  hedge:      0x2f5a2c,
  lanternWarm:0xffb45a,
  uwCyan:     0x66d8e6,             // underwater fittings, warm-cyan
};

/* ───────────────────────────── module state ────────────────────────────── */

let ROOT = null;                    // the group returned by buildWater
let CAM = null;
let night = false;
let lanternsVisible = true;
let T = 0;                          // own accumulator — never trust the caller's t

const scrolls = [];                 // { tex, u, v } — animated texture offsets
const nightBits = [];               // on => {...} closures, applied by setWaterNight
const floaters = [];                // floating-lantern records
let lanternGroup = null;
let mirrorU = null;                 // the hero mirror's uniform block (driven in tick)

/* ───────────────────────── canvas / texture plumbing ───────────────────── */

const _canvases = {};
function canv(key, make) {
  return _canvases[key] || (_canvases[key] = make());
}

function paint(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function pixels(size, fill) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  fill(img.data, size);
  g.putImageData(img, 0, 0);
  return c;
}

/* A THREE texture over a cached canvas. Repeats differ per surface, so each
   distinct repeat needs its own Texture object (a Texture owns its transform)
   — but two surfaces asking for the SAME repeat can share one, which matters:
   ten identical villa pools would otherwise upload thirty copies of the mosaic.
   Animated textures must never be shared, or the scroll loop advances the same
   offset N times per frame — those go through texOf directly. */
function texOf(canvas, rx = 1, ry = 1, srgb = false) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;   // colour maps only (house rule)
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(rx, ry);
  return t;
}

const _texCache = new Map();
function sharedTex(key, canvas, rx, ry, srgb) {
  const k = `${key}|${rx.toFixed(4)}|${ry.toFixed(4)}`;
  let t = _texCache.get(k);
  if (!t) { t = texOf(canvas, rx, ry, srgb); _texCache.set(k, t); }
  return t;
}

/* ── mosaic: ~10 cm turquoise glass tiles, the grid reads through the water ── */
function mosaicCanvas() {
  return paint(384, 384, (g, w, h) => {
    const rnd = mulberry32(SEED + 41), n = 6, s = w / n, j = 2.2;
    g.fillStyle = '#0d6c7c'; g.fillRect(0, 0, w, h);            // grout
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = rnd();
      g.fillStyle = `rgb(${38 + k * 34 | 0},${152 + k * 54 | 0},${168 + k * 48 | 0})`;
      g.fillRect(x * s + j, y * s + j, s - j * 2, s - j * 2);
      const gl = g.createLinearGradient(x * s, y * s, x * s, y * s + s);
      gl.addColorStop(0, `rgba(255,255,255,${.07 + rnd() * .1})`);
      gl.addColorStop(1, 'rgba(0,40,50,.06)');
      g.fillStyle = gl;
      g.fillRect(x * s + j, y * s + j, s - j * 2, s - j * 2);
    }
  });
}
const mosaic = (rx, ry) => sharedTex('mosaic', canv('mosaic', mosaicCanvas), rx, ry, true);

/* ── pale plaster for the lagoon basin (bright resort blue-white) ── */
function plasterCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#8fd6e0'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 77);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${190 + rnd() * 50 | 0},${225 + rnd() * 26 | 0},${232 + rnd() * 22 | 0},${.05 + rnd() * .18})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 7, 2 + rnd() * 7);
    }
  });
}
const plaster = (rx, ry) => sharedTex('plaster', canv('plaster', plasterCanvas), rx, ry, true);

/* ── dark basalt pavers, 0.8 m grid, light joints (4 modules = 3.2 m) ── */
function paverCanvas() {
  return paint(512, 512, (g, w, h) => {
    const rnd = mulberry32(SEED + 11), n = 4, s = w / n, j = 3;
    g.fillStyle = '#333735'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = rnd();
      g.fillStyle = `rgb(${66 + k * 20 | 0},${69 + k * 20 | 0},${68 + k * 20 | 0})`;
      g.fillRect(x * s + j, y * s + j, s - j * 2, s - j * 2);
      for (let i = 0; i < 46; i++) {          // basalt flecks
        g.fillStyle = `rgba(${160 + rnd() * 70 | 0},${160 + rnd() * 70 | 0},${155 + rnd() * 70 | 0},${.04 + rnd() * .1})`;
        g.fillRect(x * s + j + rnd() * (s - j * 2), y * s + j + rnd() * (s - j * 2), 1 + rnd() * 2.4, 1 + rnd() * 2.4);
      }
      g.fillStyle = 'rgba(255,255,255,.04)';
      g.fillRect(x * s + j, y * s + j, s - j * 2, 2);
    }
    g.strokeStyle = 'rgba(196,192,180,.42)'; g.lineWidth = 2.6;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke();
      g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke();
    }
  });
}
const paver = (rx, ry) => sharedTex('paver', canv('paver', paverCanvas), rx, ry, true);

/* ── artificial turf, 2 m per tile ── */
function turfCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#4a7539'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 23);
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * w, y = rnd() * h, k = rnd();
      g.strokeStyle = `rgba(${58 + k * 52 | 0},${102 + k * 62 | 0},${44 + k * 40 | 0},${.3 + k * .5})`;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 3, y - 2 - rnd() * 4); g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 10;    // mower bands
    for (let y = 0; y < h; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
const turf = (rx, ry) => sharedTex('turf', canv('turf', turfCanvas), rx, ry, true);

/* ── warm sand deck for the lagoon ── */
function sandCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#d6c6a4'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 31);
    for (let i = 0; i < 4200; i++) {
      const k = rnd();
      g.fillStyle = `rgba(${188 + k * 60 | 0},${172 + k * 58 | 0},${140 + k * 56 | 0},${.15 + k * .45})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + k * 2.4, 1 + k * 2.4);
    }
  });
}
const sand = (rx, ry) => sharedTex('sand', canv('sand', sandCanvas), rx, ry, true);

/* ── teak boardwalk / villa deck planks ── */
function timberCanvas() {
  return paint(256, 256, (g, w, h) => {
    const rnd = mulberry32(SEED + 53), rows = 8, s = h / rows;
    for (let r = 0; r < rows; r++) {
      const k = rnd();
      g.fillStyle = `rgb(${96 + k * 34 | 0},${56 + k * 22 | 0},${36 + k * 16 | 0})`;
      g.fillRect(0, r * s, w, s);
      g.strokeStyle = 'rgba(255,214,170,.08)'; g.lineWidth = 1;
      for (let i = 3; i < s; i += 5) {
        g.beginPath(); g.moveTo(0, r * s + i); g.lineTo(w, r * s + i + (rnd() - .5) * 3); g.stroke();
      }
      g.fillStyle = 'rgba(24,12,6,.55)'; g.fillRect(0, r * s, w, 2);   // plank gap
    }
  });
}
const timber = (rx, ry) => sharedTex('timber', canv('timber', timberCanvas), rx, ry, true);

/* ── black river pebbles for the overflow trough ── */
function pebbleCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#101112'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 67);
    for (let i = 0; i < 260; i++) {
      const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 6, k = rnd();
      const gr = g.createRadialGradient(x - r * .3, y - r * .35, r * .1, x, y, r);
      gr.addColorStop(0, `rgba(${86 + k * 44 | 0},${88 + k * 44 | 0},${90 + k * 44 | 0},1)`);
      gr.addColorStop(1, 'rgba(14,15,16,1)');
      g.fillStyle = gr;
      g.beginPath(); g.ellipse(x, y, r, r * (.7 + rnd() * .3), rnd() * 3, 0, 7); g.fill();
    }
  });
}
const pebble = (rx, ry) => sharedTex('pebble', canv('pebble', pebbleCanvas), rx, ry, true);

/* ── clipped hedge wall behind the pavilions ── */
function hedgeCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#22401f'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 83);
    for (let i = 0; i < 3400; i++) {
      const k = rnd();
      g.fillStyle = `rgba(${34 + k * 52 | 0},${74 + k * 66 | 0},${30 + k * 40 | 0},${.35 + k * .55})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 1.4 + k * 3.4, 0, 7); g.fill();
    }
    for (let i = 0; i < 26; i++) {          // bougainvillea flecks
      g.fillStyle = `rgba(${196 + rnd() * 50 | 0},${40 + rnd() * 50 | 0},${96 + rnd() * 60 | 0},.75)`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, 2 + rnd() * 4, 0, 7); g.fill();
    }
  });
}
const hedgeTex = (rx, ry) => sharedTex('hedge', canv('hedge', hedgeCanvas), rx, ry, true);

/* ── warm rice paper with vertical ribs — the floating lantern shells ── */
function paperCanvas() {
  return paint(256, 128, (g, w, h) => {
    g.fillStyle = '#ffd79a'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 97);
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = `rgba(255,${226 + rnd() * 26 | 0},${180 + rnd() * 50 | 0},${.05 + rnd() * .12})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 1 + rnd() * 3);
    }
    g.strokeStyle = 'rgba(150,86,30,.30)'; g.lineWidth = 2.4;
    for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(150,86,30,.16)'; g.lineWidth = 3;
    for (let y = 10; y < h; y += 34) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
const paperTex = () => sharedTex('paper', canv('paper', paperCanvas), 1, 1, true);

/* ── water ripple NORMAL map — tileable sum of sines, analytic derivative ── */
function normalCanvas() {
  const rnd = mulberry32(SEED + 5);
  const waves = [];
  for (let i = 0; i < 8; i++) {
    let fx = Math.round((rnd() * 2 - 1) * 5), fy = Math.round((rnd() * 2 - 1) * 5);
    if (fx === 0 && fy === 0) { fx = 1; fy = 2; }
    waves.push({ fx, fy, a: .1 + rnd() * .42, p: rnd() * Math.PI * 2 });
  }
  const TAU = Math.PI * 2;
  return pixels(256, (d, N) => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        let dx = 0, dy = 0;
        for (const wv of waves) {
          const c = Math.cos(TAU * (wv.fx * u + wv.fy * v) + wv.p) * wv.a * TAU;
          dx += c * wv.fx; dy += c * wv.fy;
        }
        const s = .028;
        const nx = -dx * s, ny = -dy * s, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        const i = (y * N + x) * 4;
        d[i]     = (nx / l * .5 + .5) * 255;
        d[i + 1] = (ny / l * .5 + .5) * 255;
        d[i + 2] = (nz / l * .5 + .5) * 255;
        d[i + 3] = 255;
      }
    }
  });
}
function normalTex(rx, ry) {
  const t = texOf(canv('normal', normalCanvas), rx, ry, false);   // linear — not a colour map
  return t;
}

/* ── caustic web — thin bright interference lines, used additively ── */
function causticCanvas() {
  const rnd = mulberry32(SEED + 13);
  const waves = [];
  for (let i = 0; i < 5; i++) {
    let fx = Math.round((rnd() * 2 - 1) * 4), fy = Math.round((rnd() * 2 - 1) * 4);
    if (fx === 0 && fy === 0) { fx = 2; fy = 1; }
    waves.push({ fx, fy, p: rnd() * Math.PI * 2 });
  }
  const TAU = Math.PI * 2;
  return pixels(256, (d, N) => {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;
        let s = 0;
        for (const wv of waves) s += Math.sin(TAU * (wv.fx * u + wv.fy * v) + wv.p);
        const a = Math.abs(s) / waves.length;
        let c = Math.pow(Math.max(0, 1 - a * 3.1), 3);
        c = Math.min(1, c * 1.7);
        const i = (y * N + x) * 4;
        d[i]     = c * 210;
        d[i + 1] = c * 250;
        d[i + 2] = c * 245;
        d[i + 3] = 255;
      }
    }
  });
}
const causticTex = (rx, ry) => texOf(canv('caustic', causticCanvas), rx, ry, true);

/* ── soft radial glow (lantern halos, pools of light on the water) ── */
function glowCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0,   'rgba(255,238,205,1)');
    gr.addColorStop(.16, 'rgba(255,205,140,.72)');
    gr.addColorStop(.42, 'rgba(255,168,84,.24)');
    gr.addColorStop(1,   'rgba(255,150,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
const glowTex = () => sharedTex('glow', canv('glow', glowCanvas), 1, 1, true);

/* ── vertical reflection column under a lantern (billboarded at night) ── */
function streakCanvas() {
  return pixels(128, (d, N) => {
    const rnd = mulberry32(SEED + 29);
    const bands = [];
    for (let i = 0; i < 6; i++) bands.push({ f: 2 + i * 3, p: rnd() * 6.28, a: .5 / (1 + i * .5) });
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const u = x / N, v = y / N;                     // v=0 top (at the waterline)
        const across = 1 - Math.abs(u * 2 - 1);
        let wob = 0;
        for (const b of bands) wob += Math.sin(v * b.f * 6.28 + b.p) * b.a;
        const wide = Math.pow(Math.max(0, across), 1.6 + v * 2.2);
        const fade = Math.pow(Math.max(0, 1 - v), 1.5);
        const c = Math.max(0, Math.min(1, wide * fade * (.55 + wob * .55)));
        const i = (y * N + x) * 4;
        d[i] = c * 255; d[i + 1] = c * 196; d[i + 2] = c * 118; d[i + 3] = 255;
      }
    }
  });
}
const streakTex = () => sharedTex('streak', canv('streak', streakCanvas), 1, 1, true);

/* ── falling water film for the infinity-edge spill ── */
function spillCanvas() {
  return paint(128, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 19);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * w, ww = .8 + rnd() * 3.4;
      const gr = g.createLinearGradient(0, 0, 0, h);
      const a = .18 + rnd() * .5;
      gr.addColorStop(0, `rgba(226,248,252,${a})`);
      gr.addColorStop(.55, `rgba(180,232,242,${a * .7})`);
      gr.addColorStop(1, `rgba(150,214,228,${a * .25})`);
      g.fillStyle = gr;
      g.fillRect(x, 0, ww, h);
    }
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 0, w, 5);   // the lip
  });
}
const spillTex = (rx, ry) => texOf(canv('spill', spillCanvas), rx, ry, true);

/* ──────────────────────────── the material set ─────────────────────────── */

const MAT = {};

function buildMaterials() {
  MAT.stone = new THREE.MeshStandardMaterial({ color: C.stone, roughness: .42, metalness: .05 });
  MAT.coping = new THREE.MeshStandardMaterial({ color: C.stoneLight, roughness: .3, metalness: .06 });
  MAT.pebbleRock = new THREE.MeshStandardMaterial({ color: 0x2a2d2f, roughness: .5 });
  MAT.white = new THREE.MeshStandardMaterial({ color: C.white, roughness: .78, metalness: 0 });
  MAT.whiteFrame = new THREE.MeshStandardMaterial({ color: 0xf6f5f0, roughness: .72 });
  MAT.darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: .62 });
  MAT.chrome = new THREE.MeshStandardMaterial({ color: 0xdadfe4, metalness: 1, roughness: .25 });
  MAT.hedge = new THREE.MeshStandardMaterial({ map: hedgeTex(10, 1), color: 0xcfe0c4, roughness: .95 });
  MAT.teal = new THREE.MeshStandardMaterial({ color: C.teal, roughness: .68, side: THREE.DoubleSide });
  MAT.blue = new THREE.MeshStandardMaterial({ color: C.blue, roughness: .68, side: THREE.DoubleSide });
  MAT.sandM = new THREE.MeshStandardMaterial({ map: sand(1, 1), roughness: .96 });
  MAT.timberDeck = new THREE.MeshStandardMaterial({ map: timber(1, 1), roughness: .68 });
  MAT.greenery = new THREE.MeshStandardMaterial({ color: 0x39702f, roughness: .95 });
}

/* ── one water surface material per body (each needs its own normal repeat) ──
   Deliberately BORING: near-zero roughness, a hard clearcoat and a big
   envMapIntensity, so `scene.environment` and the sky supply the interest. The
   normal map is a whisper (TUNE.NORMAL_DAY) — enough to break the sheet up when
   it catches the sun, never enough to read as a pattern. Anything squiggly you
   can name on the SURFACE is a bug. */
function waterMat(rx, ry, o = {}) {
  const nrm = normalTex(rx, ry);
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color ?? C.turquoise,
    roughness: TUNE.ROUGH_DAY,
    metalness: 0,
    transparent: true,
    opacity: o.opacity ?? TUNE.BODY_OPACITY,
    depthWrite: false,
    normalMap: nrm,
    normalScale: new THREE.Vector2(TUNE.NORMAL_DAY, TUNE.NORMAL_DAY),
    clearcoat: 1,
    clearcoatRoughness: .02,
    reflectivity: .72,
    envMapIntensity: TUNE.ENV_DAY,
    side: THREE.FrontSide,
  });
  scrolls.push({ tex: nrm, u: (o.su ?? TUNE.SCROLL_U), v: (o.sv ?? TUNE.SCROLL_V) });

  const dayCol = new THREE.Color(o.color ?? C.turquoise);
  const nightCol = new THREE.Color(o.nightColor ?? C.turqNight);
  const dayOp = o.opacity ?? TUNE.BODY_OPACITY;
  const nightOp = Math.min(.95, dayOp + .10);
  nightBits.push(on => {
    m.color.copy(on ? nightCol : dayCol);
    m.opacity = on ? nightOp : dayOp;
    m.roughness = on ? TUNE.ROUGH_NIGHT : TUNE.ROUGH_DAY;
    m.envMapIntensity = on ? TUNE.ENV_NIGHT : TUNE.ENV_DAY;
    const ns = on ? TUNE.NORMAL_NIGHT : TUNE.NORMAL_DAY;
    m.normalScale.set(ns, ns);
  });
  return m;
}

/* ═══════════════════ THE HERO POOL'S PLANAR MIRROR SURFACE ════════════════
   A real THREE.Reflector — one extra scene render, on ONE pool. Carl's photos
   are a mirror: the white portal blocks, the pergola, the palms and (at night)
   the lanterns and the lit suite all land on the water. No amount of animated
   colour texture fakes that, which is why the old caustic sheet had to go.

   Reflector renders the scene from the mirrored camera into a HalfFloat RT and
   hands us `tDiffuse` + `textureMatrix`; the oblique near plane it installs
   clips everything below the water line, so the basin never doubles back into
   its own reflection. Our custom shader adds the three things Reflector's stock
   shader has no idea about:
     · a Schlick Fresnel on the world-space view vector, so looking DOWN shows
       tiles and looking ACROSS shows the building,
     · a tiny world-space normal-map wobble on the projected lookup (a mirror
       that is perfectly sharp reads as ice, not water),
     · alpha, so the mosaic basin underneath still shows through.

   Blending maths: the framebuffer already holds the tiles. We want
     out = refl·F + body·bodyA·(1−F) + tiles·(1−F)(1−bodyA)
   so alpha = F + (1−F)·bodyA and rgb = premultiplied ÷ alpha.
   ═══════════════════════════════════════════════════════════════════════════ */
const MirrorShader = {
  name: 'PoolMirrorShader',
  uniforms: {
    /* the three Reflector itself writes — names are load-bearing */
    color:         { value: null },
    tDiffuse:      { value: null },
    textureMatrix: { value: null },
    /* ours */
    tNormal:    { value: null },
    uRipple:    { value: TUNE.MIRROR_RIPPLE_AMP },
    uNScale:    { value: TUNE.MIRROR_RIPPLE_SCALE },
    uOffA:      { value: new THREE.Vector2() },
    uOffB:      { value: new THREE.Vector2() },
    uWaterCol:  { value: new THREE.Color(C.turquoise) },
    uWaterAlpha:{ value: TUNE.BODY_ALPHA_DAY },
    uF0:        { value: TUNE.MIRROR_F0_DAY },
    uFPow:      { value: TUNE.MIRROR_POW },
    uStrength:  { value: TUNE.MIRROR_STRENGTH_DAY },
    uSheen:     { value: TUNE.SHEEN },
    /* fog — three refreshes these itself once material.fog === true */
    fogColor:   { value: new THREE.Color(0xffffff) },
    fogDensity: { value: .00025 },
    fogNear:    { value: 1 },
    fogFar:     { value: 2000 },
  },

  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;

    #include <common>
    #include <fog_pars_vertex>
    #include <logdepthbuf_pars_vertex>

    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vec4 wp = modelMatrix * vec4( position, 1.0 );
      vWorld = wp.xyz;
      vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
      gl_Position = projectionMatrix * mvPosition;
      #include <logdepthbuf_vertex>
      #include <fog_vertex>
    }`,

  fragmentShader: /* glsl */`
    uniform vec3      color;
    uniform sampler2D tDiffuse;
    uniform sampler2D tNormal;
    uniform float uRipple;
    uniform float uNScale;
    uniform vec2  uOffA;
    uniform vec2  uOffB;
    uniform vec3  uWaterCol;
    uniform float uWaterAlpha;
    uniform float uF0;
    uniform float uFPow;
    uniform float uStrength;
    uniform float uSheen;

    varying vec4 vUv;
    varying vec3 vWorld;

    #include <common>
    #include <fog_pars_fragment>
    #include <logdepthbuf_pars_fragment>

    void main() {
      #include <logdepthbuf_fragment>

      /* UVs from WORLD xz, so the swell never shows the plane's seams */
      vec2 base = vWorld.xz * uNScale;
      vec3 n1 = texture2D( tNormal, base + uOffA ).xyz * 2.0 - 1.0;
      vec3 n2 = texture2D( tNormal, base * 0.57 - uOffB ).xyz * 2.0 - 1.0;
      vec2 wob = ( n1.xy + n2.xy ) * uRipple;

      vec4 puv = vUv;
      puv.xy += wob * puv.w;                 // perturb IN projective space
      vec3 refl = texture2DProj( tDiffuse, puv ).rgb * color;

      /* Schlick, against the plane's +Y normal */
      vec3 V = normalize( cameraPosition - vWorld );
      float ct = clamp( abs( V.y ), 0.0, 1.0 );
      float F = clamp( ( uF0 + ( 1.0 - uF0 ) * pow( 1.0 - ct, uFPow ) ) * uStrength, 0.0, 1.0 );

      /* the ONLY surface "texture": a very low-frequency brightness sheen */
      float sh = texture2D( tNormal, base * 0.16 + uOffA * 0.5 ).x - 0.5;
      vec3 body = uWaterCol * ( 1.0 + sh * uSheen );

      float a = F + ( 1.0 - F ) * uWaterAlpha;
      vec3 rgb = ( refl * F + body * uWaterAlpha * ( 1.0 - F ) ) / max( a, 1e-4 );

      gl_FragColor = vec4( rgb, a );

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
};

/* Build the hero pool's mirror plane. Returns the Reflector mesh (already
   configured for transparency) — the caller parents it like any other mesh. */
function makeMirrorWater(w, d) {
  const mirror = new Reflector(new THREE.PlaneGeometry(w, d), {
    clipBias: .0032,
    textureWidth: TUNE.MIRROR_W,
    textureHeight: TUNE.MIRROR_H,
    color: TUNE.MIRROR_TINT,
    shader: MirrorShader,
    multisample: 4,
  });

  const u = mirror.material.uniforms;
  u.tNormal.value = normalTex(1, 1);          // repeat handled in-shader, NOT here
  mirrorU = u;

  mirror.material.transparent = true;
  mirror.material.depthWrite = false;
  mirror.material.fog = true;                 // must be set before first compile
  mirror.renderOrder = 3;

  /* perf gate: skip the reflection render on all but every Nth frame */
  const inner = mirror.onBeforeRender;
  let f = 0;
  mirror.onBeforeRender = function (...args) {
    const every = Math.max(1, TUNE.MIRROR_EVERY | 0);
    if (f++ % every !== 0) return;            // stale RT is reused — invisible at 1–2
    inner.apply(this, args);
  };

  const dayCol = new THREE.Color(C.turquoise);
  const nightCol = new THREE.Color(0x123a46);   // near-black, still reads as water
  nightBits.push(on => {
    u.uWaterCol.value.copy(on ? nightCol : dayCol);
    u.uWaterAlpha.value = on ? TUNE.BODY_ALPHA_NIGHT : TUNE.BODY_ALPHA_DAY;
    u.uF0.value = on ? TUNE.MIRROR_F0_NIGHT : TUNE.MIRROR_F0_DAY;
    u.uStrength.value = on ? TUNE.MIRROR_STRENGTH_NIGHT : TUNE.MIRROR_STRENGTH_DAY;
  });

  return mirror;
}

/* ── additive overlay (caustics, shimmer, glows, spill) ── */
function addMat(map, opacity, dayOp, nightOp, side = THREE.FrontSide) {
  const m = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, side, fog: true,
  });
  if (dayOp !== undefined) nightBits.push(on => { m.opacity = on ? nightOp : dayOp; });
  return m;
}

/* ───────────────────────────── small helpers ───────────────────────────── */

function box(parent, w, h, d, x, y, z, mat, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}

/* a horizontal slab whose TOP sits at y (so floorY stays the ground truth) */
function slab(parent, x0, z0, x1, z1, y, mat, t = .1) {
  const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, d), mat);
  m.position.set((x0 + x1) / 2, y - t / 2, (z0 + z1) / 2);
  parent.add(m);
  return m;
}

function colLine(list, x1, z1, x2, z2, r) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(len / r));      // step ≤ r so nothing squeezes through
  for (let i = 0; i <= n; i++) {
    list.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r });
  }
}

/* rectangle collider chain, optionally rotated about its own centre (villas) */
function colRect(list, cx, cz, w, d, r, rotY = 0) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const p = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const a = p(-w / 2, -d / 2), b = p(w / 2, -d / 2), e = p(w / 2, d / 2), f = p(-w / 2, d / 2);
  colLine(list, a[0], a[1], b[0], b[1], r);
  colLine(list, b[0], b[1], e[0], e[1], r);
  colLine(list, e[0], e[1], f[0], f[1], r);
  colLine(list, f[0], f[1], a[0], a[1], r);
}

/* ───────────────────── generic rectangular pool ("basin") ──────────────── */
/*
   Builds plinth frame + coping + tiled basin + caustics + water surface, all in
   a group placed at (cx,0,cz) and rotated by rotY. Returns the pieces the
   caller may want to dress further.
*/
function makeRectPool(G, o) {
  const {
    cx, cz, w, d, rotY = 0,
    plinth = .45, waterY = .4, depth = 1.5, coping = .55,
    tile = .6,                 // metres per mosaic block
    ripple = 2.2,              // metres per ripple tile
    colliderR = .5,
    opacity = TUNE.BODY_OPACITY,
    color = C.turquoise,
    nightColor = C.turqNight,
    su = TUNE.SCROLL_U, sv = TUNE.SCROLL_V,
    mirror = false,            // true → THREE.Reflector surface (hero pool only)
    tileEmit = .34,            // how much the basin self-glows at night
  } = o;

  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  g.rotation.y = rotY;
  ROOT.add(g);

  const hw = w / 2, hd = d / 2;
  const ow = w + coping * 2, od = d + coping * 2;
  const fy = waterY - depth;                       // basin floor
  const wallH = (plinth - .01) - fy;
  const wallCY = fy + wallH / 2;

  /* black-stone plinth built as a picture frame so the basin stays open */
  box(g, ow, plinth, coping, 0, plinth / 2, -hd - coping / 2, MAT.stone);
  box(g, ow, plinth, coping, 0, plinth / 2,  hd + coping / 2, MAT.stone);
  box(g, coping, plinth, d, -hw - coping / 2, plinth / 2, 0, MAT.stone);
  box(g, coping, plinth, d,  hw + coping / 2, plinth / 2, 0, MAT.stone);

  /* honed coping band on top — a hair proud so the edge catches light */
  const cy = plinth + .012;
  box(g, ow + .05, .025, coping + .02, 0, cy, -hd - coping / 2, MAT.coping);
  box(g, ow + .05, .025, coping + .02, 0, cy,  hd + coping / 2, MAT.coping);
  box(g, coping + .02, .025, d, -hw - coping / 2, cy, 0, MAT.coping);
  box(g, coping + .02, .025, d,  hw + coping / 2, cy, 0, MAT.coping);

  /* tiled basin — 4 inward-facing walls + floor.
     The mosaic carries a night emissive so the pool reads as a lit VOLUME after
     dark instead of the dark band it used to be; `tileEmit` scales it per pool
     (the hero basin gets ~3× the villas'). */
  const tileMats = [];
  const tileMat = ns => {
    const m = new THREE.MeshStandardMaterial({
      map: ns, roughness: .28, metalness: .02,
      emissive: new THREE.Color(C.uwCyan), emissiveMap: ns, emissiveIntensity: 0,
    });
    tileMats.push(m);
    return m;
  };
  nightBits.push(on => {
    for (const m of tileMats) m.emissiveIntensity = on ? tileEmit : 0;
  });
  const wallNS = new THREE.PlaneGeometry(w, wallH);
  const wallEW = new THREE.PlaneGeometry(d, wallH);
  const mNS = tileMat(mosaic(w / tile, wallH / tile));
  const mEW = tileMat(mosaic(d / tile, wallH / tile));

  const n = new THREE.Mesh(wallNS, mNS); n.position.set(0, wallCY, -hd + .01); g.add(n);
  const s = new THREE.Mesh(wallNS, mNS); s.position.set(0, wallCY,  hd - .01); s.rotation.y = Math.PI; g.add(s);
  const wst = new THREE.Mesh(wallEW, mEW); wst.position.set(-hw + .01, wallCY, 0); wst.rotation.y = Math.PI / 2; g.add(wst);
  const est = new THREE.Mesh(wallEW, mEW); est.position.set(hw - .01, wallCY, 0); est.rotation.y = -Math.PI / 2; g.add(est);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tileMat(mosaic(w / tile, d / tile)));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = fy;
  g.add(floor);

  /* Caustics belong DOWN HERE, on the tiles, under a metre and a half of water
     — dim, slow, and half-hidden by the body colour. They used to be mirrored
     by a second additive sheet floating over the surface; that sheet was the
     "white noodles" and it is gone. */
  const cTex = causticTex(w / 3.4, d / 3.4);
  scrolls.push({ tex: cTex, u: TUNE.CAUSTIC_U, v: TUNE.CAUSTIC_V });
  const caust = new THREE.Mesh(new THREE.PlaneGeometry(w - .08, d - .08),
    addMat(cTex, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_NIGHT));
  caust.rotation.x = -Math.PI / 2;
  caust.position.y = fy + .02;
  caust.renderOrder = 1;
  g.add(caust);

  /* the surface — a planar mirror for the hero, a cheap sheet for the rest */
  let water;
  if (mirror && TUNE.MIRROR) {
    water = makeMirrorWater(w - .04, d - .04);
  } else {
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(w - .04, d - .04, 8, 4),
      waterMat(w / ripple, d / ripple, { opacity, color, nightColor, su, sv }));
    water.renderOrder = 3;
  }
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  g.add(water);

  colRect(G.colliders, cx, cz, ow, od, colliderR, rotY);

  return { group: g, water, hw, hd, ow, od, fy, wallH, waterY, plinth, coping };
}

/* ═══════════════════════════════ HERO POOL ═════════════════════════════════
   SITE.POOL — 25 × 10 m, raised 0.45 m on black stone, overflow edges into a
   pebble trough at grade, tiled turquoise, underwater lights for the night.
   This is the money shot: a mirror-flat turquoise sheet with the white portal
   pavilions and palms reflected across it.
   ═══════════════════════════════════════════════════════════════════════════ */
function buildHeroPool(G) {
  const P = SITE.POOL;
  const b = makeRectPool(G, {
    cx: P.cx, cz: P.cz, w: P.w, d: P.d,
    plinth: P.plinth, waterY: P.waterY, depth: P.depth,
    coping: .55, tile: .6, ripple: 2.4, colliderR: .5,
    mirror: true,                       // ← THE upgrade: a real planar mirror
    tileEmit: TUNE.TILE_EMIT_NIGHT,     // the basin glows after dark
  });
  const g = b.group;
  const hw = b.hw, hd = b.hd, cop = b.coping;
  const ox = hw + cop, oz = hd + cop;               // plinth outer half extents

  /* ── infinity-edge spill: a film of water sheeting down all four faces ── */
  const spillH = P.plinth - .08;
  const faces = [
    { w: ox * 2, x: 0, z: -oz - .012, ry: Math.PI },
    { w: ox * 2, x: 0, z:  oz + .012, ry: 0 },
    { w: oz * 2, x: -ox - .012, z: 0, ry: -Math.PI / 2 },
    { w: oz * 2, x:  ox + .012, z: 0, ry: Math.PI / 2 },
  ];
  for (const f of faces) {
    const t = spillTex(f.w / 1.6, 1);
    scrolls.push({ tex: t, u: 0, v: .55 });         // scroll downward = falling water
    const m = new THREE.Mesh(new THREE.PlaneGeometry(f.w, spillH),
      new THREE.MeshBasicMaterial({
        map: t, transparent: true, opacity: .42, depthWrite: false,
        side: THREE.DoubleSide,
      }));
    m.position.set(f.x, .06 + spillH / 2, f.z);
    m.rotation.y = f.ry;
    m.renderOrder = 2;
    g.add(m);
    nightBits.push(on => { m.material.opacity = on ? .26 : .42; });
  }

  /* ── pebble-filled overflow trough at grade, all the way round ── */
  const tw = .42;                                    // trough width
  const troughY = .055;
  const troughs = [
    [ox * 2 + tw * 2, tw, 0, -oz - tw / 2],
    [ox * 2 + tw * 2, tw, 0,  oz + tw / 2],
    [tw, oz * 2, -ox - tw / 2, 0],
    [tw, oz * 2,  ox + tw / 2, 0],
  ];
  for (const [tW, tD, tx, tz] of troughs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(tW, .1, tD),
      new THREE.MeshStandardMaterial({
        map: pebble(Math.max(1, tW / .5), Math.max(1, tD / .5)), roughness: .6,
      }));
    m.position.set(tx, troughY - .05, tz);
    g.add(m);
  }
  /* loose pebbles for close-up richness — one instanced draw */
  const rnd = mulberry32(SEED + 401);
  const per = 420;
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.055, 0), MAT.pebbleRock, per);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3();
  const perim = (ox + tw / 2) * 2 * 2 + (oz + tw / 2) * 2 * 2;
  for (let i = 0; i < per; i++) {
    let t = (i / per) * perim + rnd() * .1;
    const W = (ox + tw / 2) * 2, D = (oz + tw / 2) * 2;
    let px, pz;
    if (t < W) { px = -W / 2 + t; pz = -D / 2; }
    else if (t < W + D) { px = W / 2; pz = -D / 2 + (t - W); }
    else if (t < W * 2 + D) { px = W / 2 - (t - W - D); pz = D / 2; }
    else { px = -W / 2; pz = D / 2 - (t - W * 2 - D); }
    px += (rnd() - .5) * tw * .8; pz += (rnd() - .5) * tw * .8;
    e.set(rnd() * 3, rnd() * 3, rnd() * 3);
    q.setFromEuler(e);
    sc.set(.7 + rnd() * .8, .5 + rnd() * .4, .7 + rnd() * .8);
    mtx.compose(new THREE.Vector3(px, troughY - .01, pz), q, sc);
    pebbles.setMatrixAt(i, mtx);
  }
  pebbles.instanceMatrix.needsUpdate = true;
  pebbles.computeBoundingSphere();
  g.add(pebbles);

  /* ── underwater lights ──────────────────────────────────────────────────
     Three layers, because at night this pool has to READ from 25 m away
     through a glass wall: (1) emissive fittings in the long walls, (2) a soft
     halo on each fitting, (3) a horizontal additive quad hanging in the water
     VOLUME per fitting — that last one is what turns the black band into a
     glowing basin. Only two real PointLights (budget). ── */
  const discGeo = new THREE.CircleGeometry(.17, 18);
  const haloGeo = new THREE.CircleGeometry(.62, 18);
  const discMat = new THREE.MeshBasicMaterial({ color: C.uwCyan, transparent: true, opacity: 0 });
  const haloMat = addMat(glowTex(), 0, 0, .95);
  haloMat.color = new THREE.Color(0x9ce8f2);
  nightBits.push(on => { discMat.opacity = on ? 1 : .06; });

  /* the glow that fills the water volume — one shared additive material */
  const uwGlowMat = addMat(glowTex(), 0, 0, TUNE.UW_GLOW_NIGHT);
  uwGlowMat.color = new THREE.Color(0x7fdcee);
  const uwGlowGeo = new THREE.PlaneGeometry(6.4, 4.6);

  for (const x of [-8.4, -2.8, 2.8, 8.4]) {
    for (const side of [-1, 1]) {
      const y = P.waterY - .62;
      const dsc = new THREE.Mesh(discGeo, discMat);
      dsc.position.set(x, y, side * (hd - .02));
      dsc.rotation.y = side < 0 ? 0 : Math.PI;
      g.add(dsc);
      const hl = new THREE.Mesh(haloGeo, haloMat);
      hl.position.set(x, y, side * (hd - .06));
      hl.rotation.y = side < 0 ? 0 : Math.PI;
      hl.renderOrder = 2;
      g.add(hl);
      /* the fitting's light spreading through the water, seen from above */
      const uw = new THREE.Mesh(uwGlowGeo, uwGlowMat);
      uw.rotation.x = -Math.PI / 2;
      uw.position.set(x, P.waterY - .72, side * (hd - 2.4));   // stays inside the basin
      uw.renderOrder = 2;                    // BELOW the water surface (3)
      g.add(uw);
    }
  }
  /* the only two real underwater lights (budget) */
  for (const x of [-6.5, 6.5]) {
    const L = new THREE.PointLight(0x7fe0ec, 0, 14, 2);
    L.position.set(x, P.waterY - .5, 0);
    g.add(L);
    nightBits.push(on => { L.intensity = on ? TUNE.UW_LIGHT_NIGHT : 0; });
  }

  /* ── a still black-stone reflecting trough east of the pool (photo p3/p14):
     a recessed basin, NOT a slab — a solid slab at grade would bury the water
     plane underneath it. ── */
  const rt = new THREE.Group();
  ROOT.add(rt);
  /* far enough east to leave a walkable corridor round the pool's end */
  const rtx = ox + P.cx + 3.6, rtz = P.cz + 1.4;
  const trW = 1.5, trD = 5.6, rim = .35;
  slab(rt, rtx - trW / 2, rtz - trD / 2, rtx + trW / 2, rtz + trD / 2, -.22, MAT.stone, .2);  // basin floor
  box(rt, trW + rim * 2, .3, rim, rtx, .07, rtz - trD / 2 - rim / 2, MAT.stone);              // rim, 4 bars
  box(rt, trW + rim * 2, .3, rim, rtx, .07, rtz + trD / 2 + rim / 2, MAT.stone);
  box(rt, rim, .3, trD, rtx - trW / 2 - rim / 2, .07, rtz, MAT.stone);
  box(rt, rim, .3, trD, rtx + trW / 2 + rim / 2, .07, rtz, MAT.stone);
  const rw = new THREE.Mesh(new THREE.PlaneGeometry(trW, trD),
    waterMat(trW / 2, trD / 2, { opacity: .9, color: 0x123138, nightColor: 0x08181d, su: .004, sv: .003 }));
  rw.rotation.x = -Math.PI / 2;
  rw.position.set(rtx, .09, rtz);
  rw.renderOrder = 3;
  rt.add(rw);
  colRect(G.colliders, rtx, rtz, trW + rim * 2, trD + rim * 2, .4);

  return b;
}

/* ═══════════════════ DECK · TURF · "THE WESTIN" LETTERS ═══════════════════ */

/* Compact rect-vector font — only the glyphs THE WESTIN needs.
   Unit box 0..1 in x and y; each entry is [x, y, w, h, rot?] with x,y the
   lower-left of the UNROTATED rect and rot a rotation about its own centre.
   The whole letter group is scaled 0.72 in x, which squeezes the drawing
   exactly like a condensed cap would be. */
const GLYPHS = {
  T: [[0, .82, 1, .18], [.41, 0, .18, .82]],
  H: [[0, 0, .18, 1], [.82, 0, .18, 1], [.18, .41, .64, .18]],
  E: [[0, 0, .18, 1], [.18, .82, .72, .18], [.18, .41, .62, .18], [.18, 0, .72, .18]],
  W: [[.04, -.0155, .17, 1.031, .2449], [.29, -.021, .17, .762, -.334],
      [.54, -.021, .17, .762, .334], [.79, -.0155, .17, 1.031, -.2449]],
  S: [[0, .82, 1, .18], [0, .55, .18, .30], [0, .41, 1, .18], [.82, .14, .18, .30], [0, 0, 1, .18]],
  I: [[.41, 0, .18, 1]],
  N: [[0, 0, .18, 1], [.82, 0, .18, 1], [.41, -.1465, .18, 1.293, .687]],
};

function buildLetters(parent, text, H, thick, mat) {
  const root = new THREE.Group();
  const XS = .72;                                  // condensed x-scale
  const adv = XS * H + .13, spaceAdv = .34;
  let total = 0;
  for (const ch of text) total += (ch === ' ' ? spaceAdv : adv);
  total -= .13;
  let cur = -total / 2;
  for (const ch of text) {
    if (ch === ' ') { cur += spaceAdv; continue; }
    const rects = GLYPHS[ch];
    if (!rects) { cur += adv; continue; }
    const gl = new THREE.Group();
    gl.scale.set(XS, 1, 1);
    gl.position.x = cur;
    for (const [x, y, w, h, rot] of rects) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w * H, h * H, thick), mat);
      m.position.set((x + w / 2) * H, (y + h / 2) * H, 0);
      if (rot) m.rotation.z = rot;
      gl.add(m);
    }
    root.add(gl);
    cur += adv;
  }
  parent.add(root);
  return root;
}

function buildDeckAndTurf(G) {
  const g = new THREE.Group();
  ROOT.add(g);

  const D = SITE.DECK, TU = SITE.TURF, P = SITE.POOL;
  const ox = P.w / 2 + .55, oz = P.d / 2 + .55;
  const px0 = P.cx - ox, px1 = P.cx + ox, pz0 = P.cz - oz, pz1 = P.cz + oz;
  const APRON = 15.6, SOUTH = 12.7;      // paving reaches past the boardwalk
  const PY = -.004;                        // pavers a hair below datum, turf at 0

  const pv = (x0, z0, x1, z1) => {
    const m = slab(g, x0, z0, x1, z1, PY, new THREE.MeshStandardMaterial({
      map: paver(Math.abs(x1 - x0) / 3.2, Math.abs(z1 - z0) / 3.2),
      roughness: .82, metalness: .04,
    }), .12);
    return m;
  };

  /* villa deck — 7 m of dark basalt between the glass wall and the turf band */
  pv(-APRON, D.z0, APRON, D.z1);
  /* flanks beside the turf band, then the pool surround */
  pv(-APRON, TU.z0, -ox, TU.z1);
  pv(ox, TU.z0, APRON, TU.z1);
  pv(-APRON, pz0, px0, SOUTH);
  pv(px1, pz0, APRON, SOUTH);
  pv(-APRON, pz1, APRON, SOUTH);

  /* the 2.5 m turf band that carries the letters */
  slab(g, px0 - .55, TU.z0, px1 + .55, TU.z1, 0, new THREE.MeshStandardMaterial({
    map: turf((ox + .55) * 2 / 2, (TU.z1 - TU.z0) / 2), roughness: .95,
  }), .1);

  /* THE WESTIN — 0.62 m white letters standing on the turf band.
     ── the mirrored-letters bug, for the record ──────────────────────────────
     The previous build put TWO extruded slabs 60 mm apart, the rear one turned
     180°, hoping each side would get its own readable face. Extruded letters
     are SOLID: from the suite you saw the near (correct) slab AND the far one's
     mirrored silhouette poking out around it — the union of "THE WESTIN" and
     "ИITꙄƎW ƎHT", which is the illegible mush in the night screenshot. Two
     back-to-back copies can never work; only one copy may exist.

     Which way must the one copy face? buildLetters advances glyphs along local
     +X and its faces look down local +Z. The player stands NORTH of the sign
     (PREWEDDING x1 z−18, AFTERPARTY x0 z−10, both yaw π = facing +Z) while the
     turf band sits at z ≈ −5.25. A camera looking along +Z has world −X on its
     right (right × up = −forward ⇒ r = (−1,0,0)). So the group must be turned
     180° about Y: local +X maps to world −X, which is the viewer's right, and
     both the glyph order AND every glyph's internal shape read forwards.
     Unrotated, the sign only reads from across the water. Suite side wins —
     that is where every spawn, the intro dive and the hero night shot are. */
  const letterMat = new THREE.MeshStandardMaterial({
    color: 0xfbfaf6, roughness: .55, metalness: .02,
    emissive: 0xfff0d0, emissiveIntensity: 0,
  });
  nightBits.push(on => { letterMat.emissiveIntensity = on ? .55 : 0; });
  const lz = (TU.z0 + TU.z1) / 2;
  const sign = buildLetters(g, 'THE WESTIN', TUNE.LETTER_H, TUNE.LETTER_T, letterMat);
  sign.position.set(P.cx, .005, lz);
  sign.rotation.y = Math.PI;          // ← reads from the SUITE side. Do not remove.
  /* small in-ground uplights washing the letters at night — on the SUITE side
     of the band (lz − .28), i.e. the face the player actually reads */
  const upMat = addMat(glowTex(), 0, 0, .8);
  for (let i = -2; i <= 2; i++) {
    const u = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3), upMat);
    u.rotation.x = -Math.PI / 2;
    u.position.set(P.cx + i * 1.4, .022, (TU.z0 + TU.z1) / 2 - .28);
    u.renderOrder = 2;
    g.add(u);
  }

  /* clipped hedge wall + bougainvillea behind the pavilion boardwalk, which
     ends at CABANAS.z + 2.4 = 10.9 (palms behind it are nature.js's) */
  box(g, APRON * 2, .95, 1.1, 0, .475, SOUTH - .55, MAT.hedge);
  return g;
}

/* ════════════════ WHITE PORTAL-FRAME CABANA PAVILIONS ════════════════════
   The enclave's signature architecture (clubhouse-pdf-brief p14): minimalist
   white post-and-beam gates you can see THROUGH, a rectangular niche grid set
   into the thick pier, a dark-slatted lantern hanging inside each opening, all
   linked by a timber boardwalk over lawn strips with stone steps down to the
   pool deck.

   SITE.CABANAS gives 7 pavilions between x0 and x1 — pitch 2.08 m. The frames
   are therefore built as 8 piers / 7 openings so the run is continuous (a
   2.6–3.4 m free-standing frame per pavilion would overlap its neighbour);
   pier widths and heights vary across the run so the rhythm reads as designed.
   ═════════════════════════════════════════════════════════════════════════ */
function buildPavilions(G) {
  const g = new THREE.Group();
  ROOT.add(g);
  const CB = SITE.CABANAS;
  const rnd = mulberry32(SEED + 211);
  const pitch = (CB.x1 - CB.x0) / (CB.count - 1);
  const nPiers = CB.count + 1;

  /* niche + hanging-lantern night materials */
  const nicheMat = new THREE.MeshStandardMaterial({
    color: 0x2b2a26, roughness: .9, emissive: 0xffca7a, emissiveIntensity: 0,
  });
  nightBits.push(on => { nicheMat.emissiveIntensity = on ? .7 : 0; });

  const slatMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: .7 });
  const lampCoreMat = new THREE.MeshStandardMaterial({
    color: 0x3a2c14, emissive: 0xffb257, emissiveIntensity: .25, roughness: .9,
  });
  nightBits.push(on => { lampCoreMat.emissiveIntensity = on ? 3.2 : .25; });
  const lampHaloMat = addMat(glowTex(), .05, .05, .8);

  const piers = [];
  for (let i = 0; i < nPiers; i++) {
    const x = CB.x0 - pitch / 2 + i * pitch;
    const thick = (i % 2 === 0);
    const w = thick ? .95 + rnd() * .38 : .38 + rnd() * .18;
    const h = CB.hMin + rnd() * (CB.hMax - CB.hMin);
    const dep = .62 + rnd() * .34;
    const zFront = CB.z - dep / 2 - (rnd() - .5) * .55;     // staggered setbacks
    piers.push({ x, w, h, dep, z: zFront, thick });
  }

  for (const p of piers) {
    box(g, p.w, p.h, p.dep, p.x, p.h / 2, p.z, MAT.whiteFrame);
    /* dark stone base the pier stands on */
    box(g, p.w + .16, .18, p.dep + .16, p.x, .09, p.z, MAT.stone);
    if (!p.thick) continue;
    /* rectangular niches punched into the pool-facing (-Z) face */
    const cols = p.w > 1.15 ? 2 : 1, rows = 2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const nw = .17, nh = .42;
      const nx = p.x + (cols === 1 ? 0 : (c - .5) * (p.w * .44));
      const ny = p.h * (.46 + r * .21);
      box(g, nw, nh, .1, nx, ny, p.z - p.dep / 2 + .03, nicheMat);
    }
  }

  /* lintels spanning each opening, at the lower of the two adjacent piers */
  for (let i = 0; i < CB.count; i++) {
    const a = piers[i], b = piers[i + 1];
    const x0 = a.x + a.w / 2, x1 = b.x - b.w / 2;
    const openW = x1 - x0;
    if (openW <= .1) continue;
    const h = Math.min(a.h, b.h);
    const beam = .34 + rnd() * .12;
    const dep = Math.min(a.dep, b.dep);
    const z = (a.z + b.z) / 2;
    box(g, openW + .04, beam, dep, (x0 + x1) / 2, h - beam / 2, z, MAT.whiteFrame);

    /* dark-slatted lantern hanging inside the opening */
    const lx = (x0 + x1) / 2, ly = h - beam - .34;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .38, 6), MAT.darkWood);
    cord.position.set(lx, h - beam - .19, z);
    g.add(cord);
    const core = box(g, .25, .40, .25, lx, ly - .06, z, lampCoreMat);
    core.renderOrder = 0;
    for (let k = 0; k < 5; k++) {                 // real slats with gaps between
      box(g, .33, .036, .33, lx, ly - .24 + k * .095, z, slatMat);
    }
    for (const [ox2, oz2] of [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]]) {
      box(g, .032, .46, .032, lx + ox2, ly - .06, z + oz2, slatMat);
    }
    box(g, .30, .04, .30, lx, ly + .19, z, slatMat);    // little cap
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), lampHaloMat);
    halo.position.set(lx, ly - .06, z - .3);
    halo.renderOrder = 6;
    g.add(halo);
  }

  /* colliders on the piers only — the portal openings stay walkable */
  for (const p of piers) {
    G.colliders.push({ x: p.x, z: p.z, r: Math.max(p.w, p.dep) * .5 });
  }

  /* timber boardwalk over lawn strips, linking the run */
  const bwX0 = piers[0].x - .9, bwX1 = piers[piers.length - 1].x + .9;
  const bwZ0 = SITE.CABANAS.z - .1, bwZ1 = SITE.CABANAS.z + 2.4;
  slab(g, bwX0, bwZ0, bwX1, bwZ1, .3, new THREE.MeshStandardMaterial({
    map: timber((bwX1 - bwX0) / 2.4, (bwZ1 - bwZ0) / 2.4), roughness: .68,
  }), .16);
  slab(g, bwX0, bwZ0, bwX1, bwZ1, .1, MAT.greenery, .2);     // lawn strip beneath

  /* two stone steps from the boardwalk down to the pool deck */
  const sz = SITE.POOL.cz + SITE.POOL.d / 2 + .55;
  slab(g, bwX0 + 1.2, sz + .5, bwX0 + 4.2, sz + 1.15, .2, MAT.coping, .22);
  slab(g, bwX0 + 1.2, sz + 1.15, bwX0 + 4.2, sz + 1.8, .1, MAT.coping, .22);

  return g;
}

/* ═══════════════════════ POOLSIDE FURNITURE ═══════════════════════════════ */

function makeLounger() {
  const g = new THREE.Group();
  const w = MAT.white;
  /* seat pan (long axis along local Z, head at -Z toward the pool) */
  box(g, .66, .1, 1.35, 0, .38, .18, w);
  /* raked backrest */
  const back = box(g, .66, .1, .84, 0, .58, -.72, w);
  back.rotation.x = .62;
  /* legs */
  for (const [lx, lz] of [[-.28, -.32], [.28, -.32], [-.28, .74], [.28, .74]]) {
    box(g, .06, .34, .06, lx, .17, lz, w);
  }
  /* a folded towel for a little colour */
  box(g, .5, .05, .34, 0, .44, .32, MAT.teal);
  return g;
}

function makeUmbrella(colour, radius, height, sides) {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, height, 8), MAT.white);
  mast.position.y = height / 2;
  g.add(mast);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(radius, .42, sides), colour);
  canopy.position.y = height - .1;
  if (sides === 4) canopy.rotation.y = Math.PI / 4;
  g.add(canopy);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * .99, radius * .99, .05, sides, 1, true), colour);
  rim.position.y = height - .3;
  if (sides === 4) rim.rotation.y = Math.PI / 4;
  g.add(rim);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.34, .38, .1, 12), MAT.stone);
  base.position.y = .05;
  g.add(base);
  return g;
}

function buildPoolside(G) {
  const g = new THREE.Group();
  ROOT.add(g);
  const LG = SITE.LOUNGERS;

  /* Loungers deliberately carry NO collider. The row sits 1.05 m off the pool
     coping; a collider there would meet the plinth ring and seal the entire
     south apron (verified by flood fill), and knee-high furniture is the wrong
     thing to wall a walkway with. Umbrella poles collide, but only as poles. */
  const loungerProto = makeLounger();
  const step = (LG.x1 - LG.x0) / (LG.count - 1);
  for (let i = 0; i < LG.count; i++) {
    const l = loungerProto.clone();
    l.position.set(LG.x0 + i * step, 0, LG.z);
    l.rotation.y = Math.PI;                     // head end toward the pool (-Z)
    g.add(l);
  }

  /* teal umbrellas — clubhouse deck calls the enclave's umbrellas teal */
  const umProto = makeUmbrella(MAT.teal, 1.55, 2.5, 8);
  for (let i = 0; i < LG.umbrellas; i++) {
    const x = LG.x0 + (i + .5) * (LG.x1 - LG.x0) / LG.umbrellas;
    const u = umProto.clone();
    u.position.set(x, 0, LG.z + 1.5);
    u.rotation.y = i * .3;
    g.add(u);
    G.colliders.push({ x, z: LG.z + 1.5, r: .2 });
  }

  /* two white ring stools by the villa door (suite brief §6) */
  const ringGeo = new THREE.TorusGeometry(.34, .16, 10, 22);
  for (const [x, z] of [[-2.5, SITE.DECK.z0 + 1.2], [2.6, SITE.DECK.z0 + 1.5]]) {
    const r = new THREE.Mesh(ringGeo, MAT.white);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, .42, z);
    g.add(r);
    G.colliders.push({ x, z, r: .48 });
  }
  return g;
}

/* ═════════════════════════ FLOATING LANTERNS ══════════════════════════════
   THE signature shot — Carl's night prewedding party. Big paper globes and
   lotus forms drifting on the hero pool, each throwing a warm pool of light
   and a reflection column onto the water. Only 3 of the 9 carry a real
   PointLight; everything else is emissive + additive.
   ═════════════════════════════════════════════════════════════════════════ */
function buildLanterns(G) {
  const P = SITE.POOL;
  lanternGroup = new THREE.Group();
  ROOT.add(lanternGroup);

  const rnd = mulberry32(SEED + 617);
  const paper = paperTex();
  const R = TUNE.LANTERN_R;                     // everything below is in units of R

  /* The paper shell must read LIT FROM WITHIN, not painted.
     Three cooperating pieces:
       · shell — emissive rice paper at opacity .88. depthWrite stays TRUE:
         the water surface is also transparent (renderOrder 3) and would paint
         straight over a non-depth-writing lantern.
       · core  — an opaque hot sphere inside it, drawn in the OPAQUE pass, so it
         shows through the paper wherever the paper is thinnest.
       · rim   — a slightly larger BackSide additive sphere. Its far hemisphere
         depth-fails behind the shell, so all that survives is a tight glowing
         ring hugging the silhouette. That ring is the whole "translucent". */
  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x4a3a20, map: paper, emissive: 0xffc074, emissiveMap: paper,
    emissiveIntensity: 1.35, roughness: .95, metalness: 0,
    transparent: true, opacity: .88,
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: 0x5a4526, emissive: 0xffd9a2, emissiveIntensity: 1.1,
    roughness: .95, side: THREE.DoubleSide,
  });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff2d2 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: .8 });
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: .14,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
  });
  nightBits.push(on => {
    shellMat.emissiveIntensity = on ? TUNE.LANTERN_EMIT_NIGHT : 1.0;
    petalMat.emissiveIntensity = on ? TUNE.LANTERN_EMIT_NIGHT * .8 : .8;
    rimMat.opacity = on ? .45 : .14;
  });

  const haloMat = addMat(glowTex(), .3, .3, TUNE.LANTERN_HALO_NIGHT);
  const poolMat = addMat(glowTex(), .12, .12, TUNE.LANTERN_POOL_NIGHT);
  const streakMat = addMat(streakTex(), 0, .05, TUNE.LANTERN_STREAK_NIGHT);

  const globeGeo = new THREE.SphereGeometry(R, 24, 16);
  const rimGeo = new THREE.SphereGeometry(R * 1.16, 18, 12);
  const ribGeo = new THREE.TorusGeometry(R * 1.012, R * .038, 6, 24);
  const petalGeo = new THREE.ConeGeometry(R * .37, R * 1.24, 5);
  const coreGeo = new THREE.SphereGeometry(R * .46, 12, 10);
  const baseGeo = new THREE.TorusGeometry(R * .81, R * .17, 6, 18);
  const haloGeo = new THREE.PlaneGeometry(R * 5.6, R * 5.6);
  const poolGeo = new THREE.PlaneGeometry(R * 6.6, R * 6.6);   // ≈4.6 m of warm water
  const streakGeo = new THREE.PlaneGeometry(R * 1.5, R * 4.4);
  streakGeo.translate(0, -R * 2.2, 0);          // hangs from the waterline down

  const hy = R * 1.10;                          // shell centre above the waterline
  const halfY = R * .86;                        // shell vertical half-extent

  /* two loose rows so the spread reads across the whole 25 m sheet */
  const rowA = [-9.4, -4.7, 0, 4.7, 9.4], rowB = [-7.1, -2.4, 2.4, 7.1];
  const seats = [];
  for (const x of rowA) seats.push([x, P.cz - 1.5]);
  for (const x of rowB) seats.push([x, P.cz + 2.5]);

  const lightIdx = new Set([0, 4, 7]);          // 3 real PointLights (budget ≤ 4)

  for (let i = 0; i < P.lanterns; i++) {
    const [bx, bz] = seats[i % seats.length];
    const home = {
      x: P.cx + bx + (rnd() - .5) * .8,
      z: bz + (rnd() - .5) * 1.0,
    };
    const lot = new THREE.Group();
    lot.position.set(home.x, P.waterY, home.z);
    lanternGroup.add(lot);

    const isLotus = i % 3 === 2;
    if (isLotus) {
      const pad = new THREE.Mesh(new THREE.CircleGeometry(R * 1.24, 20), petalMat);
      pad.rotation.x = -Math.PI / 2;
      pad.position.y = R * .14;
      lot.add(pad);
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        const p = new THREE.Mesh(petalGeo, petalMat);
        p.position.set(Math.cos(a) * R * .57, R * .62, Math.sin(a) * R * .57);
        /* Euler XYZ: rotation.z = -0.78 tips the cone's axis toward +X, then
           rotation.y = -a swings that tip round to the petal's own bearing —
           so every petal leans OUTWARD, not across the flower. */
        p.rotation.set(0, -a, -.78);
        lot.add(p);
      }
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = R * .71;
      lot.add(core);
    } else {
      const shell = new THREE.Mesh(globeGeo, shellMat);
      shell.scale.set(1, .86, 1);
      shell.position.y = hy;
      lot.add(shell);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.scale.set(1, .86, 1);
      rim.position.y = hy;
      rim.renderOrder = 5;             // after the water sheet (3), before the halo
      lot.add(rim);
      /* three bamboo ribs, sized to the sphere's silhouette at their height */
      for (const f of [.28, .5, .72]) {
        const rib = new THREE.Mesh(ribGeo, baseMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.y = hy + halfY * (2 * f - 1);
        rib.scale.setScalar(Math.sin(Math.PI * f) * .99 + .04);
        lot.add(rib);
      }
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = hy;
      lot.add(core);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.rotation.x = Math.PI / 2;
      base.position.y = R * .12;
      lot.add(base);
    }

    /* billboarded halo */
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = hy;
    halo.renderOrder = 6;
    lot.add(halo);

    /* flat pool of light on the water (world space, always horizontal) */
    const disc = new THREE.Mesh(poolGeo, poolMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(home.x, P.waterY + .014, home.z);
    disc.renderOrder = 5;
    lanternGroup.add(disc);

    /* reflection column, yaw-billboarded, hanging into the water */
    const streak = new THREE.Mesh(streakGeo, streakMat);
    streak.position.set(home.x, P.waterY - .002, home.z);
    streak.renderOrder = 5;
    lanternGroup.add(streak);

    let light = null;
    if (lightIdx.has(i)) {
      light = new THREE.PointLight(C.lanternWarm, 1.2, 13, 2);
      light.position.y = hy;
      lot.add(light);
      nightBits.push(on => { light.intensity = on ? TUNE.LANTERN_LIGHT_NIGHT : 1.2; });
    }

    floaters.push({
      lot, disc, streak, light, halo, home,
      ph: rnd() * Math.PI * 2,
      ph2: rnd() * Math.PI * 2,
      spin: (rnd() - .5) * .12,
      ax: .35 + rnd() * .35,
      az: .28 + rnd() * .3,
      wx: .045 + rnd() * .035,
      wz: .033 + rnd() * .03,
    });
  }
  return lanternGroup;
}

function tickLanterns(dt) {
  const P = SITE.POOL;
  const cam = CAM;
  for (const f of floaters) {
    const x = f.home.x + Math.sin(T * f.wx * 6.283 + f.ph) * f.ax
                       + Math.sin(T * .037 + f.ph2) * .25;
    const z = f.home.z + Math.cos(T * f.wz * 6.283 + f.ph2) * f.az
                       + Math.sin(T * .029 + f.ph) * .2;
    const bob = Math.sin(T * .9 + f.ph) * .035 + Math.sin(T * 1.7 + f.ph2) * .016;
    f.lot.position.set(x, P.waterY + bob, z);
    f.lot.rotation.y += f.spin * dt;
    f.lot.rotation.z = Math.sin(T * .8 + f.ph) * .035;
    f.lot.rotation.x = Math.cos(T * .7 + f.ph2) * .03;

    f.disc.position.set(x, P.waterY + .014, z);
    const pulse = 1 + Math.sin(T * 1.3 + f.ph) * .05;
    f.disc.scale.setScalar(pulse);

    f.streak.position.set(x, P.waterY - .002, z);
    if (cam) {
      /* yaw-only billboard: the plane's +Z face turns to the camera, so the
         column always reads as a reflection running toward the viewer */
      f.streak.rotation.y = Math.atan2(cam.position.x - x, cam.position.z - z);
      f.halo.lookAt(cam.position);        // lookAt handles the rotated parent
    }
  }
}

/* ═════════════════════ LOUNGE TERRACE POOL (cocktail hour) ════════════════ */
function buildLoungePool(G) {
  const LP = SITE.LOUNGE_POOL;
  const g = new THREE.Group();
  ROOT.add(g);

  /* stone terrace around it */
  const x0 = LP.cx - LP.w / 2 - 4.5, x1 = LP.cx + LP.w / 2 + 4.5;
  const z0 = LP.cz - LP.d / 2 - 5.0, z1 = LP.cz + LP.d / 2 + 4.0;
  slab(g, x0, z0, x1, z1, -.004, new THREE.MeshStandardMaterial({
    map: paver((x1 - x0) / 3.2, (z1 - z0) / 3.2), roughness: .82, metalness: .04,
  }), .12);

  makeRectPool(G, {
    cx: LP.cx, cz: LP.cz, w: LP.w, d: LP.d,
    plinth: .3, waterY: .26, depth: 1.25, coping: .45,
    tile: .6, ripple: 2.2, colliderR: .55, opacity: .8,
  });

  /* teal umbrellas along both long sides + a handful of loungers */
  const umProto = makeUmbrella(MAT.teal, 1.5, 2.45, 8);
  const loungerProto = makeLounger();
  /* umbrellas stand well clear of the coping — MOMENT_PLACES.COCKTAIL spawns
     at (36, -18), i.e. on the north walkway, which must stay open */
  const per = Math.ceil(LP.umbrellas / 2);
  for (let i = 0; i < LP.umbrellas; i++) {
    const side = i < per ? -1 : 1;
    const k = i % per;
    const x = LP.cx - LP.w / 2 + (k + .5) * (LP.w / per);
    const z = LP.cz + side * (LP.d / 2 + 3.5);
    const u = umProto.clone();
    u.position.set(x, 0, z);
    u.rotation.y = i * .4;
    g.add(u);
    G.colliders.push({ x, z, r: .2 });
  }
  for (let i = 0; i < 6; i++) {                 // loungers, no collider (see above)
    const l = loungerProto.clone();
    l.position.set(LP.cx - LP.w / 2 + (i + .5) * (LP.w / 6), 0, LP.cz + LP.d / 2 + 1.15);
    l.rotation.y = Math.PI;
    g.add(l);
  }
  return g;
}

/* ═════════════════════════════ LAGOON POOL ════════════════════════════════
   Big free-form resort pool — the aerial shows it snaking. The outline is a
   seeded sum of low harmonics, so it is organic yet perfectly stable across
   loads (house rule: never Math.random).
   ═════════════════════════════════════════════════════════════════════════ */
function lagoonOutline(N) {
  const L = SITE.LAGOON;
  const rnd = mulberry32(SEED + 909);
  const harm = [];
  for (let k = 1; k <= 6; k++) {
    harm.push({ k, a: (.125 - (k - 1) * .015) * (.6 + rnd() * .8), p: rnd() * Math.PI * 2 });
  }
  const pts = [];
  for (let i = 0; i < N; i++) {
    const th = i / N * Math.PI * 2;
    let f = 1;
    for (const h of harm) f += h.a * Math.sin(h.k * th + h.p);
    f = Math.max(.68, Math.min(1.2, f));
    pts.push([L.cx + Math.cos(th) * L.rx * f, L.cz + Math.sin(th) * L.rz * f]);
  }
  return pts;
}

/* Shape lives in the XY plane; rotating -90° about X maps local +Y to world -Z,
   so points go in as (x, -z) and land at world (x, y, z). */
function shapeFrom(pts) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  s.closePath();
  return s;
}
function pathFrom(pts) {
  const p = new THREE.Path();
  p.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], -pts[i][1]);
  p.closePath();
  return p;
}
function scaleAbout(pts, cx, cz, k) {
  return pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
}

function buildLagoon(G) {
  const L = SITE.LAGOON;
  const g = new THREE.Group();
  ROOT.add(g);

  const N = 108;
  const edge = lagoonOutline(N);
  const outer = scaleAbout(edge, L.cx, L.cz, 1.17);
  const DEPTH = 1.05, WY = -.06;

  /* sand deck ring: outer shape with the lagoon punched out as a hole */
  const ring = shapeFrom(outer);
  ring.holes.push(pathFrom(edge));
  const sandMesh = new THREE.Mesh(new THREE.ShapeGeometry(ring),
    new THREE.MeshStandardMaterial({ map: sand(.34, .34), roughness: .96 }));
  sandMesh.rotation.x = -Math.PI / 2;
  sandMesh.position.y = 0;
  g.add(sandMesh);

  /* dark coping line right at the water's edge */
  const lip = shapeFrom(scaleAbout(edge, L.cx, L.cz, 1.022));
  lip.holes.push(pathFrom(edge));
  const lipMesh = new THREE.Mesh(new THREE.ShapeGeometry(lip), MAT.coping);
  lipMesh.rotation.x = -Math.PI / 2;
  lipMesh.position.y = .012;
  g.add(lipMesh);

  /* basin floor */
  const floorShape = shapeFrom(edge);
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(floorShape),
    new THREE.MeshStandardMaterial({ map: plaster(.3, .3), roughness: .35 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -DEPTH;
  g.add(floor);

  /* caustics on the floor — under the water, never over it */
  const cTex = causticTex(.3, .3);
  scrolls.push({ tex: cTex, u: TUNE.CAUSTIC_U, v: TUNE.CAUSTIC_V });
  const caust = new THREE.Mesh(new THREE.ShapeGeometry(floorShape),
    addMat(cTex, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_NIGHT));
  caust.rotation.x = -Math.PI / 2;
  caust.position.y = -DEPTH + .02;
  caust.renderOrder = 1;
  g.add(caust);

  /* basin wall: a ribbon from grade down to the floor */
  const pos = [], uv = [];
  let run = 0;
  for (let i = 0; i < N; i++) {
    const a = edge[i], b = edge[(i + 1) % N];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const u0 = run / 3, u1 = (run + seg) / 3;
    run += seg;
    // two triangles: a-top, b-top, b-bot / a-top, b-bot, a-bot
    pos.push(a[0], .02, a[1],  b[0], .02, b[1],  b[0], -DEPTH, b[1]);
    uv.push(u0, 1, u1, 1, u1, 0);
    pos.push(a[0], .02, a[1],  b[0], -DEPTH, b[1],  a[0], -DEPTH, a[1]);
    uv.push(u0, 1, u1, 0, u0, 0);
  }
  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  wallGeo.computeVertexNormals();
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({
    map: plaster(1, .35), roughness: .4, side: THREE.DoubleSide,
  }));
  g.add(wall);

  /* the water sheet. NOTE the missing shimmer sheet — the lagoon used to carry
     an extra additive caustic plane ON TOP of the surface, same as the hero
     pool did. That was the "cartoon noodles"; reflection carries the surface
     now (low roughness + high envMapIntensity in waterMat). */
  const water = new THREE.Mesh(new THREE.ShapeGeometry(floorShape),
    waterMat(.42, .42, {
      opacity: .78, color: C.lagoon, nightColor: C.lagoonNight,
      su: TUNE.SCROLL_U * .7, sv: TUNE.SCROLL_V * .7,
    }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = WY;
  water.renderOrder = 3;
  g.add(water);

  /* two planted islands rising out of the water */
  const rnd = mulberry32(SEED + 313);
  for (const [ang, dist, r] of [[2.1, .42, 2.6], [5.0, .5, 1.9]]) {
    const ix = L.cx + Math.cos(ang) * L.rx * dist;
    const iz = L.cz + Math.sin(ang) * L.rz * dist;
    const isl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, DEPTH + .5, 22), MAT.sandM);
    isl.position.set(ix, -DEPTH + (DEPTH + .5) / 2 - .05, iz);
    g.add(isl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, .12, 6, 26), MAT.coping);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(ix, .38, iz);
    g.add(rim);
    for (let k = 0; k < 6; k++) {
      const a = rnd() * 6.283, dd = rnd() * r * .7;
      const sh = new THREE.Mesh(new THREE.SphereGeometry(.35 + rnd() * .4, 8, 6), MAT.greenery);
      sh.position.set(ix + Math.cos(a) * dd, .5 + rnd() * .3, iz + Math.sin(a) * dd);
      sh.scale.y = .75;
      g.add(sh);
    }
    G.colliders.push({ x: ix, z: iz, r: r + .3 });
  }

  /* blue umbrellas + a few loungers on the sand ring */
  const umbPts = scaleAbout(edge, L.cx, L.cz, 1.1);
  const umProto = makeUmbrella(MAT.blue, 1.5, 2.45, 8);
  const loungerProto = makeLounger();
  for (let i = 0; i < L.umbrellas; i++) {
    const idx = Math.floor(i * N / L.umbrellas);
    const [ux, uz] = umbPts[idx];
    const u = umProto.clone();
    u.position.set(ux, 0, uz);
    u.rotation.y = Math.atan2(L.cx - ux, L.cz - uz);
    g.add(u);
    G.colliders.push({ x: ux, z: uz, r: .2 });
    if (i % 2 === 0) {
      const l = loungerProto.clone();
      l.position.set(ux + (L.cx - ux) * .06, 0, uz + (L.cz - uz) * .06);
      l.rotation.y = Math.atan2(L.cx - ux, L.cz - uz) + Math.PI;
      g.add(l);
    }
  }

  /* keep walkers out of the water */
  const colPts = scaleAbout(edge, L.cx, L.cz, 1.0);
  for (let i = 0; i < N; i++) {
    const a = colPts[i], b = colPts[(i + 1) % N];
    colLine(G.colliders, a[0], a[1], b[0], b[1], .95);
  }
  return g;
}

/* ═══════════════════════ VILLA PLUNGE POOLS ═══════════════════════════════
   Water beside every guest key, sized to its real room type (site.js VILLAS):
     type 1  花园泳池双卧套房 — the full courtyard plunge pool (VILLA.poolW ×
             poolD) with the black stone water wall and three spouts (pdf p11)
     type 2  花园三卧套房 — the two-storey key; the balcony overlooks a slightly
             smaller pool under a flat white canopy (pdf p9)
     type 0  花园客房 — no pool, but a sunlit soaking-tub court (阳光泡浴空间),
             which is what the small light wells in the aerials are
   Every one is offset to the villa's south face and rotated with the villa.
   ═══════════════════════════════════════════════════════════════════════════ */
function buildVillaPools(G) {
  const V = SITE.VILLA;
  const g = new THREE.Group();
  ROOT.add(g);

  for (const [vx, vz, ry, type] of SITE.VILLAS) {
    const vd = type === 2 ? V.d2 : V.d;          // villa footprint depth
    const off = vd / 2 + (type === 0 ? 2.6 : 3.2);
    /* local (0, off) rotated by the villa's yaw — three's Y-rotation maps
       local (x,z) to world (x cos + z sin, -x sin + z cos) */
    const px = vx + Math.sin(ry) * off;
    const pz = vz + Math.cos(ry) * off;

    const pw = type === 0 ? 2.6 : type === 2 ? 6.4 : V.poolW;
    const pd = type === 0 ? 2.6 : type === 2 ? 3.0 : V.poolD;

    const deck = new THREE.Group();
    deck.position.set(px, 0, pz);
    deck.rotation.y = ry;
    g.add(deck);

    /* paved apron + a timber landing on the villa side */
    const dw = pw + 4.4, dd = pd + 4.0;
    const pave = new THREE.Mesh(new THREE.BoxGeometry(dw, .12, dd),
      new THREE.MeshStandardMaterial({ map: paver(dw / 3.2, dd / 3.2), roughness: .82 }));
    pave.position.y = -.066;
    deck.add(pave);
    const tw = pw + 1.2;
    const tdeck = new THREE.Mesh(new THREE.BoxGeometry(tw, .14, 1.9),
      new THREE.MeshStandardMaterial({ map: timber(tw / 2.4, .8), roughness: .68 }));
    tdeck.position.set(0, .02, -pd / 2 - 1.9);
    deck.add(tdeck);

    makeRectPool(G, {
      cx: px, cz: pz, w: pw, d: pd, rotY: ry,
      plinth: .28, waterY: .24, depth: type === 0 ? .8 : 1.05, coping: .4,
      tile: .5, ripple: 1.6, colliderR: .8, opacity: .78,
      su: .012, sv: .007,
    });

    if (type === 0) {
      /* soaking court: a low white privacy wall on three sides */
      box(deck, pw + 1.6, 2.2, .22, 0, 1.1, pd / 2 + .8, MAT.white);
      box(deck, .22, 2.2, pd + 1.6, -(pw / 2 + .8), 1.1, 0, MAT.white);
      box(deck, .22, 2.2, pd + 1.6, pw / 2 + .8, 1.1, 0, MAT.white);
      continue;
    }

    /* a pair of loungers on the paved side */
    const lp = makeLounger();
    for (const sx of [-1.7, .1]) {
      const l = lp.clone();
      l.position.set(sx, 0, pd / 2 + 1.5);
      l.rotation.y = Math.PI;
      deck.add(l);
    }

    if (type === 2) {
      /* flat white canopy on four slim posts over the far end (pdf p9) */
      box(deck, 3.4, .16, 3.0, pw / 2 - 1.4, 2.62, 0, MAT.white);
      for (const [cxp, czp] of [[-1.5, -1.3], [1.5, -1.3], [1.5, 1.3], [-1.5, 1.3]]) {
        box(deck, .12, 2.54, .12, pw / 2 - 1.4 + cxp, 1.27, czp, MAT.white);
      }
      continue;
    }

    /* type 1 — black stone water-feature wall with three spouts (pdf p11) */
    const wallX = -pw / 2 - .55;
    box(deck, .35, 1.5, pd + .5, wallX, .75, 0, MAT.stone);
    for (const sz of [-1, 0, 1]) {
      const spout = new THREE.Mesh(new THREE.BoxGeometry(.06, .04, .34), MAT.chrome);
      spout.position.set(wallX + .2, 1.32, sz * (pd / 3.4));
      deck.add(spout);
      const fallTex = spillTex(1, 1);
      scrolls.push({ tex: fallTex, u: 0, v: .8 });
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(.3, 1.05),
        new THREE.MeshBasicMaterial({
          map: fallTex, transparent: true, opacity: .5,
          depthWrite: false, side: THREE.DoubleSide,
        }));
      fall.position.set(wallX + .34, .78, sz * (pd / 3.4));
      fall.rotation.y = Math.PI / 2;
      deck.add(fall);
    }
  }
  return g;
}

/* ═══════════════════════════════ per-frame ════════════════════════════════ */

function tick(dt) {
  const d = Math.max(0, Math.min(.05, dt || 0));
  T += d;
  for (const s of scrolls) {
    s.tex.offset.x += s.u * d;
    s.tex.offset.y += s.v * d;
    if (s.tex.offset.x > 1e4 || s.tex.offset.x < -1e4) s.tex.offset.x = 0;
    if (s.tex.offset.y > 1e4 || s.tex.offset.y < -1e4) s.tex.offset.y = 0;
  }
  /* the mirror tiles its normal map in the shader, so its drift is a uniform,
     not a texture offset. Two counter-running sets = a swell, not a conveyor. */
  if (mirrorU) {
    const a = T % 1e4;
    mirrorU.uOffA.value.set(a * TUNE.SCROLL_U, a * TUNE.SCROLL_V);
    mirrorU.uOffB.value.set(-a * TUNE.SCROLL_U * .73, a * TUNE.SCROLL_V * .61);
  }
  if (lanternsVisible && lanternGroup) tickLanterns(d);
}

/* ═══════════════════════════════ public API ═══════════════════════════════ */

/**
 * Build every water feature on the campus.
 * @param {object} G  the shared context ({scene, camera, colliders, tickers})
 * @returns {THREE.Group} the root group (also added to G.scene)
 */
export function buildWater(G) {
  ROOT = new THREE.Group();
  ROOT.name = 'water';
  CAM = G.camera || null;
  G.scene.add(ROOT);

  buildMaterials();

  buildDeckAndTurf(G);
  buildHeroPool(G);
  buildPavilions(G);
  buildPoolside(G);
  buildLanterns(G);
  buildLoungePool(G);
  buildLagoon(G);
  buildVillaPools(G);

  (G.tickers ||= []).push((dt) => tick(dt));

  setWaterNight(false);
  setLanterns(true);
  return ROOT;
}

/**
 * Day ⇄ night. Night: deeper, darker, cooler water; underwater fittings and
 * cabana lanterns lit; floating lanterns at full glow; caustics dialled back.
 * @param {boolean} on
 */
export function setWaterNight(on) {
  night = !!on;
  for (const f of nightBits) f(night);
}

/**
 * Show/hide the floating lanterns (and their real lights).
 * @param {boolean} on
 */
export function setLanterns(on) {
  lanternsVisible = !!on;
  if (lanternGroup) lanternGroup.visible = lanternsVisible;
  for (const f of floaters) {
    if (f.light) {
      f.light.intensity = lanternsVisible ? (night ? TUNE.LANTERN_LIGHT_NIGHT : 1.2) : 0;
    }
  }
}
