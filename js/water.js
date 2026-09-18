// water.js — every body of water on the 隐逸居 campus, plus the hardscape that
// frames it: the hero infinity pool at the presidential suite, its basalt deck
// and turf apron with the 3D "THE WESTIN" letters, the solid stepped white
// cabana blocks and lounger row that make the far-side silhouette, the
// lounge terrace pool, the free-form lagoon, and ten villa plunge pools.
//
// Every footprint comes from SITE (js/site.js) — nothing here invents a
// coordinate. All materials are defined locally so this module owns no shared
// state beyond the G context.
//
// Reference: reference/photos/IMG_8099.jpg (Rachel's ground-level shot — the
// spec for the cabana blocks), "Yinyiju main pool.webp" (the hero composition
// and the block detail), "Yinyiju view pool.webp" (pool from the 2F balcony),
// reference/suite-interior-brief.md §7, reference/clubhouse-pdf-brief.md p5.
// NOT the deck's p14 close-up — that was read as open portal frames and is
// wrong; see the note over buildPavilions.
//
// Contract:  buildWater(G) -> THREE.Group ,  setWaterNight(on) ,  setLanterns(on)
//   G.scene       the scene to add to
//   G.camera      used for billboarding the lantern glows
//   G.colliders   {x,z,r} cylinder chains pushed for plinths + the cabana run
//   G.tickers     per-frame callbacks (dt, t)

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SITE } from './site.js';
import { mulberry32 } from './materials.js';
/* nature.js owns the ONE coconut palm this campus uses. The river cannot
   plant through nature's own scatter (it avoids G.colliders, and the channel's
   colliders are exactly what would reject a palm leaning over the water), so
   it hands nature explicit positions instead and gets the real model back —
   in nature's instanced buckets, for no extra draw calls. See requestPalms(). */
import { requestPalms } from './nature.js';
/* The mirror is the most expensive object on the campus (js/detailcull.js's
   banner has the decomposition). This keeps the far resort out of its second
   scene render via THREE.Layers — a one-shot assignment, no per-frame cost, and
   NOT a change to the Reflector: no shader, no tint, no resolution, still one
   mirror. Read that file's banner before touching the radius; the measured
   answer is smaller than it looks, and the reason is instructive. */
import { initMirrorLayers } from './mirrorlayers.js';
/* …and this is the lever mirrorlayers.js's banner named and did not pull: the
   mirror pass renders through the FULL reflected frustum, not the quad's
   screen-space extent. mirrorfrustum.js forks Reflector.onBeforeRender to
   narrow the virtual camera's projection to the quad's own on-screen box AND
   to render into the matching sub-rectangle of the same target — which is what
   keeps the sampling density, the ripple and the texture matrix bit-identical
   to stock. Read its banner before touching either number here. */
import { initMirrorFrustum } from './mirrorfrustum.js';
/* The Blender-authored props (assets/models/, KAN-207 Group E: the resort
   furniture). ⚠ main.js awaits models.preload() BEFORE buildWorld for this —
   every call site below reads models.geometry()/material() synchronously while
   the water is being built, exactly as moments.js does after it. */
import * as models from './models.js';

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
let CTX = null;                     // the G handed to buildWater (river cull pass)
let night = false;
let lanternsVisible = true;
let T = 0;                          // own accumulator — never trust the caller's t

const scrolls = [];                 // { tex, u, v } — animated texture offsets
const nightBits = [];               // on => {...} closures, applied by setWaterNight
const floaters = [];                // floating-lantern records
let lanternGroup = null;
let mirrorU = null;                 // the hero mirror's uniform block (driven in tick)
let mirrorMesh = null;              // the ONE Reflector — mirrorlayers.js needs it
let mirrorFrustum = null;           // the screen-extent pass's debug handle

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

/* THE SHADER'S OWN WORST-CASE LOOKUP OFFSET, measured off the very canvas it
   samples. The mirror fragment shader perturbs the projected reflection lookup
   by `(n1.xy + n2.xy) * uRipple`, where each tap is `tex.xyz * 2 − 1` on this
   normal map — so the largest |Δu| it can ever ask for is
   `2 · uRipple · max|R·2−1|` and likewise |Δv| off the G channel.
   js/mirrorfrustum.js turns that into the pad it renders BEYOND the mirror
   quad's own screen box, and an under-estimate here is a fringe of unrendered
   texels along the water's edge. Derived rather than typed for exactly that
   reason: retune MIRROR_RIPPLE_AMP or reseed the wave set and the pad follows.
   One 256² pass at boot; the canvas is cached so it costs a single scan. */
let _wobble = null;
function mirrorWobbleUV() {
  if (_wobble) return _wobble;
  const c = canv('normal', normalCanvas);
  let mx = 0, my = 0;
  try {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      const nx = Math.abs(d[i] / 255 * 2 - 1);
      const ny = Math.abs(d[i + 1] / 255 * 2 - 1);
      if (nx > mx) mx = nx;
      if (ny > my) my = ny;
    }
  } catch {
    mx = my = 1;                     // unreadable canvas → the absolute bound
  }
  const a = TUNE.MIRROR_RIPPLE_AMP;
  _wobble = { u: 2 * a * mx, v: 2 * a * my };
  return _wobble;
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
   are a mirror: the white cabana blocks, the pergola, the palms and (at night)
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
  /* ⚠ three keeps clipBias in the Reflector's closure and never publishes it,
     so mirrorfrustum.js — which re-implements the oblique clip — has to be
     handed the SAME number. One const, passed twice; a second literal here is
     a silent reflection bug waiting to happen. */
  const CLIP_BIAS = .0032;

  const mirror = new Reflector(new THREE.PlaneGeometry(w, d), {
    clipBias: CLIP_BIAS,
    textureWidth: TUNE.MIRROR_W,
    textureHeight: TUNE.MIRROR_H,
    color: TUNE.MIRROR_TINT,
    shader: MirrorShader,
    multisample: 4,
  });

  const u = mirror.material.uniforms;
  u.tNormal.value = normalTex(1, 1);          // repeat handled in-shader, NOT here
  mirrorU = u;
  mirrorMesh = mirror;

  mirror.material.transparent = true;
  mirror.material.depthWrite = false;
  mirror.material.fog = true;                 // must be set before first compile
  mirror.renderOrder = 3;

  /* ── narrow the mirror pass to the quad's own screen extent ──────────────
     FIRST, so the every-Nth-frame gate below wraps the forked onBeforeRender
     rather than the other way round. `ripple` sizes the pad that keeps the
     shader's projected-lookup wobble inside the rendered sub-rectangle — it is
     measured off the SAME normal canvas the fragment shader samples, so if
     MIRROR_RIPPLE_AMP or the wave seed ever moves the pad follows for free. */
  const wob = mirrorWobbleUV();
  mirrorFrustum = initMirrorFrustum(mirror, {
    clipBias: CLIP_BIAS,
    wobbleU: wob.u, wobbleV: wob.v,
  });

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

/* ── the GLB props ──────────────────────────────────────────────────────────
   `have(name)` is the ONE gate (assets/blender/INTEGRATION.md §1): true only
   when the model loaded AND came in as a single mesh. Every call site below
   keeps its old primitive path as the `else` branch — models.preload() never
   rejects, so a missing GLB degrades to boxes and cones, not to a blank deck.

   `mdl(name)` hands back a fresh clone wrapped in NOTHING: the caller owns the
   transform. `mdlProto(name, ry)` wraps one in a Group that pre-applies a yaw,
   which is how a prototype whose front faces the other way from the primitive
   it replaces (the sun lounger) keeps every call site's own `rotation.y`.

   ⚠ `canopy_tint` is the one material the game is meant to colour — the parasol
   canopy ships PURE WHITE and the deck multiplies its own hex in. A clone per
   COLOUR (never per umbrella) does it: three.js keys its program cache on the
   material's shape, not its identity, so N colour clones are still one program.  */
const have = (name) => models.has(name) && !!models.geometry(name);
const mdl = (name) => models.get(name);
function mdlProto(name, ry = 0) {
  const g = new THREE.Group();
  const m = models.get(name);
  if (!m) return null;
  m.rotation.y = ry;
  g.add(m);
  return g;
}
const _tintMats = new Map();
function tintedMat(name, hex) {
  const k = name + ':' + hex;
  let m = _tintMats.get(k);
  if (!m) {
    const base = models.material(name);
    if (!base) return null;
    m = base.clone();
    m.color.setHex(hex);
    _tintMats.set(k, m);
  }
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

  /* the surface — a planar mirror for the hero, a cheap sheet for the rest.
     The Reflector is guarded: a blown shader compile or a missing addon must
     cost us a nice pool, never the whole page. */
  let water = null;
  if (mirror && TUNE.MIRROR) {
    try {
      water = makeMirrorWater(w - .04, d - .04);
    } catch (err) {
      console.warn('[water] Reflector unavailable — falling back to the flat sheet:', err);
      water = null;
      mirrorU = null;
      mirrorMesh = null;
    }
  }
  if (!water) {
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
   This is the money shot: a mirror-flat turquoise sheet with the white stepped
   cabana blocks and the palms reflected across it.
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
      /* The fitting's light spreading through the water volume. renderOrder 4
         puts it AFTER the surface (3) on purpose: from the suite the view is so
         grazing that Fresnel makes the mirror ~90% opaque, and anything drawn
         under it disappears — which is exactly how the pool went missing at
         night. A real lit pool glows from every angle, so this one adds ON TOP.
         Still depth-tested against the basin, so it stays inside the water. */
      const uw = new THREE.Mesh(uwGlowGeo, uwGlowMat);
      uw.rotation.x = -Math.PI / 2;
      uw.position.set(x, P.waterY - .72, side * (hd - 2.4));   // stays inside the basin
      uw.renderOrder = 4;
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

  /* A second still "reflecting trough" used to sit beside the pool here. It
     came from a reading of deck photo p3/p14, but Rachel's ground-level shots
     (reference/photos/IMG_8099.jpg) show no such basin — just lawn and the
     pebble trough at the water's edge — and once the pool rotated it read as a
     stray glassy slab floating in the middle of the composition. Removed. */

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
  const APRON = 15.6;
  /* The deck apron now has to reach past the SOUTH END of a pool that runs
     away from the suite (CABANAS became a Z-run, so CABANAS.z no longer
     exists — reading it here produced NaN and corrupted the whole deck). */
  const SOUTH = SITE.POOL.cz + SITE.POOL.d / 2 + 3.4;
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
  /* ── the lounger-flank turf strip (Carl's dinner-lawns clip, 2026-08-03).
     The video shows a narrow band of mown grass, dotted with flush drain
     covers, running the LENGTH of the pool's near (lounger) long edge
     between the coping and the paved terrace — the build paved that flank
     solid. The strip lives on the WEST (−X) flank: the chairs are on the
     west long side (Carl on site — see SITE.CABANAS/LOUNGERS), and the east
     flank has no coping→terrace ground at all (the cabana masses stand hard
     against the pebble trough — buildPavilions' FRONT note, x 6.39/6.70).
     Surface only: same ground level, no collider, nothing moves — the
     terrace paving simply starts TSW further out. It runs TU.z1→pz1 so it
     meets the WESTIN letters' turf band at the pool's NW corner; south of
     pz1 the full-width apron already paves. */
  const TSW = 1.5;
  /* the two flank pieces STOP at pz1 — the full-width apron below covers
     everything south of it. They used to run on to SOUTH, which laid each
     flank's pavers coplanar over the apron's (same PY) south of pz1 —
     z-fight at distance. Campus rule: bands/slabs edge-to-edge, never
     stacked. Coverage is unchanged: flank z pz0…pz1, apron z pz1…SOUTH. */
  pv(-APRON, pz0, px0 - TSW, pz1);
  pv(px1, pz0, APRON, pz1);
  pv(-APRON, pz1, APRON, SOUTH);
  slab(g, px0 - TSW, TU.z1, px0, pz1, 0, new THREE.MeshStandardMaterial({
    map: turf(TSW / 2, (pz1 - TU.z1) / 2), roughness: .95,
  }), .1);
  {  /* flush dark drain covers — the same fixture family as the big lawn's */
    const drains = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(.17, .17, .028, 12), MAT.pebbleRock, 6);
    const dm = new THREE.Matrix4();
    for (let i = 0; i < 6; i++) {
      dm.setPosition(px0 - TSW / 2, .012, pz0 + 2.2 + i * (pz1 - pz0 - 4.4) / 5);
      drains.setMatrixAt(i, dm);
    }
    drains.instanceMatrix.needsUpdate = true;
    drains.computeBoundingSphere();
    drains.name = 'poolTurfDrains';
    g.add(drains);
  }

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

  /* hedge closing the far (south) end of the pool — the pavilion run has its
     own hedge along the east side, added in buildPavilions */
  box(g, APRON * 2, .95, 1.1, 0, .475, SOUTH - .55, MAT.hedge);
  return g;
}

/* ═══════════════ SOLID STEPPED "THE WESTIN" CABANA BLOCKS ═════════════════
   Rebuilt 2026-08-02 from Rachel's ground-level shot of the presidential pool
   (reference/photos/IMG_8099.jpg, corroborated by the hotel's own
   "Yinyiju main pool" frame). The previous build read the clubhouse deck's
   p14 close-up as OPEN post-and-beam portals with a slatted lantern hung in
   each gap. It is not that. The run is a line of SOLID white stucco masses
   standing right at the water's edge, and the whole design is in the STEP:

     · a heavy L-shaped FRAME — a cap band across the top plus one full-height
       pier at one end — proud of everything else,
     · a SCREEN PANEL recessed 0.35 m inside that L, slightly cooler in tone,
     · small punched RECTANGULAR SLOTS through the panel at staggered heights,
       each a real hole 0.2 m deep with a dark niche behind it,
     · a LOW WING at the pier's foot, projecting a little further toward the
       pool — the third plateau, and the thing that makes the bottom of the run
       step as well as the top,
     · a small `THE WESTIN` wordmark low on each panel.

   Cap height, panel top and wing top give every block three plateaus; the
   seven blocks then carry authored (not random) heights that fall away from
   the suite in a zig-zag, so the silhouette across the water reads as designed
   rather than noisy. Blocks are OPAQUE: you no longer see through the run.

   Budget: every white box in the run is one InstancedMesh (frame + wing), the
   recessed panels a second, the niches a third, the stone bases a fourth — four
   draw calls for what used to be ~145 separate meshes plus seven hanging
   lanterns.

   FRAME OF REFERENCE. The run still lines the pool's EAST (+X) long side and
   faces WEST across the water (Carl confirmed that on site), and it is still
   authored in a LOCAL frame — marching along local +X, pool at local −Z — with
   the group rotated +90° about Y and dropped at SITE.CABANAS.x. For a +90° Y
   rotation local (x,z) ↦ world (cx + z, cz − x); the old collider transform
   used cx − z and put every pier ~0.8 m east of its own wall. Fixed here.
   ═════════════════════════════════════════════════════════════════════════ */

/* warm off-white render, the enclave's stucco */
function stuccoCanvas() {
  return paint(256, 256, (g, w, h) => {
    g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(SEED + 519);
    for (let i = 0; i < 1500; i++) {
      const v = 228 + rnd() * 24 | 0;
      g.fillStyle = `rgba(${v},${v - 3},${v - 13},${.04 + rnd() * .13})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 5, 1 + rnd() * 5);
    }
  });
}
const stucco = (rx, ry) => sharedTex('stucco', canv('stucco', stuccoCanvas), rx, ry, true);

/* the wordmark itself — letter-spaced caps on transparent, alpha-tested onto
   the panel. One 512 × 96 canvas serves all seven blocks; drawing it with
   buildLetters() instead would cost 28 boxes × 7 = 196 extra draw calls. */
function westinCanvas() {
  return paint(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4a463d';
    g.textBaseline = 'middle';
    g.font = '400 42px Georgia, "Times New Roman", Times, serif';
    const txt = 'THE WESTIN', track = 12;
    let total = -track;
    for (const ch of txt) total += g.measureText(ch).width + track;
    let x = (w - total) / 2;
    for (const ch of txt) { g.fillText(ch, x, h * .54); x += g.measureText(ch).width + track; }
  });
}
const westinTex = () => sharedTex('westin', canv('westin', westinCanvas), 1, 1, true);

/* one InstancedMesh over a unit box — every block part is an axis-aligned box,
   so a single geometry + per-instance scale covers the whole run */
function emitBoxes(parent, list, mat, name) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  const m = new THREE.Matrix4();
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    m.makeScale(b.w, b.h, b.d);
    m.setPosition(b.x, b.y, b.z);
    im.setMatrixAt(i, m);
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.name = name;
  parent.add(im);
  return im;
}

/* the same, for camera-facing quads (the wordmark, the night halos) — planes
   look down local +Z, the blocks face local −Z, hence the half-turn */
function emitPlanes(parent, list, mat, name) {
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, Math.PI, 0);
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    q.setFromEuler(e);
    p.set(b.x, b.y, b.z);
    s.set(b.w, b.h, 1);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
  }
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.name = name;
  parent.add(im);
  return im;
}

function buildPavilions(G) {
  const g = new THREE.Group();
  g.name = 'cabanas';
  ROOT.add(g);
  const CB = SITE.CABANAS;
  const rnd = mulberry32(SEED + 211);

  const run = CB.z1 - CB.z0;              // 21 m of pool edge
  const pitch = run / (CB.count - 1);     // 3.5 m centres
  const HALF = run / 2;

  /* ── the section, in local Z (local −Z is the pool) ──────────────────────
     FRONT sits the masses hard against the pool's pebble trough (local z
     −5.30 ⇒ enclave x 6.70; the trough's outer lip is x 6.39), which is what
     the photo shows — no promenade between the water and the walls. The whole
     walkway is BEHIND the run instead: enclave x ≈ 8.1 → 14, the old paver
     apron plus the timber boardwalk, and it is open at both ends of the run. */
  const FRONT = -5.30;                    // pool-facing face of the frame
  const FRAME_D = 0.95;                   // depth of the L-frame mass
  const RECESS = 0.35;                    // how far the screen panel sits back
  const PANEL_D = FRAME_D - RECESS;       // panel is flush with the frame's BACK
  const PANEL_Z = FRONT + RECESS;         // panel front face
  const SLOT_DEEP = 0.20;                 // reveal depth of a punched slot

  /* ── the rhythm. Index 0 is the FAR (+Z world, seaward) end, index 6 the
     suite end: local x = −HALF + i·pitch and local x ↦ world z = cz0 − x.
     Heights are authored, not rolled — the run has to fall away from the suite
     in steps, with two deliberate reversals so it never reads as a staircase. */
  const HT = [0.06, 0.40, 0.14, 0.58, 0.30, 0.78, 1.00];   // t into [hMin,hMax]
  const SIDE = [1, -1, 1, 1, -1, 1, -1];                   // which end holds the pier
  const NSLOT = [2, 3, 2, 3, 2, 3, 3];

  const frame = [];      // bright stucco: cap, pier, low wing
  const panels = [];     // recessed screen, a shade cooler
  const niches = [];     // dark blind backs behind the punched slots
  const bases = [];      // black stone plinth under each block
  const marks = [];      // THE WESTIN wordmark quads
  const halos = [];      // night glow in each slot mouth

  for (let i = 0; i < CB.count; i++) {
    const gx = -HALF + i * pitch;
    const gap = 0.50 + rnd() * 0.34;
    const w = Math.min(CB.wMax, Math.max(CB.wMin, pitch - gap));
    const h = CB.hMin + HT[i] * (CB.hMax - CB.hMin);
    const capH = 0.40 + rnd() * 0.15;
    const pierW = 0.58 + rnd() * 0.24;
    const side = SIDE[i];
    const panelTop = h - capH;
    const panelW = w - pierW;
    const panelCx = gx - side * pierW / 2;
    const panelX0 = panelCx - panelW / 2, panelX1 = panelCx + panelW / 2;

    /* cap band across the whole width, and the full-height pier at one end */
    frame.push({ x: gx, y: h - capH / 2, z: FRONT + FRAME_D / 2, w, h: capH, d: FRAME_D });
    frame.push({
      x: gx + side * (w / 2 - pierW / 2), y: h / 2, z: FRONT + FRAME_D / 2,
      w: pierW, h, d: FRAME_D,
    });

    /* the low wing at the pier's foot — steps down, and projects 0.18 m
       further toward the water than the frame does */
    const wingW = 0.95 + rnd() * 0.55;
    const wingH = 0.72 + rnd() * 0.40;
    const wingD = FRAME_D + 0.30;
    frame.push({
      x: gx + side * (w / 2 + wingW / 2 - 0.42), y: wingH / 2,
      z: FRONT - 0.18 + wingD / 2, w: wingW, h: wingH, d: wingD,
    });

    /* the block's BACK. Without it the walkway behind the run stares at 21 m of
       unbroken dark timber; with it the same stepped white rhythm reads from
       both sides and the bay's timber only shows in the gaps — which is where
       the photo shows it too. */
    frame.push({
      x: gx, y: h / 2, z: FRONT + FRAME_D + 0.18, w, h, d: 0.36,
    });

    /* black stone base the whole block stands on */
    bases.push({
      x: gx, y: 0.08, z: FRONT - 0.24 + (FRAME_D + 0.48) / 2,
      w: w + 0.14, h: 0.16, d: FRAME_D + 0.48,
    });

    /* ── punched slots. Laid out one per cell so they never overlap in x,
       which is what lets the panel below be cut into strips and fills and
       still be a real hole rather than a dark rectangle painted on. ── */
    const n = NSLOT[i];
    const margin = 0.26;
    const cell = (panelW - margin * 2) / n;
    const slots = [];
    for (let k = 0; k < n; k++) {
      const sw = Math.min(0.30 + rnd() * 0.07, cell - 0.18);
      const sx = panelX0 + margin + (k + 0.5) * cell + (rnd() - 0.5) * (cell - sw - 0.08);
      const room = panelTop - 0.22 - 1.15;
      const sh = Math.max(0.42, Math.min(0.55 + rnd() * 0.28, room - 0.04));
      const sy = 1.15 + rnd() * Math.max(0.02, room - sh);
      slots.push({ x0: sx - sw / 2, x1: sx + sw / 2, y0: sy, y1: sy + sh });
      niches.push({
        x: sx, y: sy + sh / 2, z: PANEL_Z + SLOT_DEEP + (PANEL_D - SLOT_DEEP) / 2,
        w: sw + 0.02, h: sh + 0.02, d: PANEL_D - SLOT_DEEP,
      });
      halos.push({ x: sx, y: sy + sh / 2, z: PANEL_Z - 0.05, w: sw * 4.2, h: sh * 2.6 });
    }
    slots.sort((a, b) => a.x0 - b.x0);

    /* the panel, cut around those holes: full-height strips between the slots,
       then a fill below and above each slot column */
    const pz = PANEL_Z + PANEL_D / 2;
    const strip = (x0, x1, y0, y1) => {
      if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
      panels.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: pz, w: x1 - x0, h: y1 - y0, d: PANEL_D });
    };
    let cur = panelX0;
    for (const s of slots) {
      strip(cur, s.x0, 0, panelTop);            // full-height strip before the slot
      strip(s.x0, s.x1, 0, s.y0);               // under the slot
      strip(s.x0, s.x1, s.y1, panelTop);        // over the slot
      cur = s.x1;
    }
    strip(cur, panelX1, 0, panelTop);           // and the strip after the last

    /* THE WESTIN, low on the panel, clear of every slot (slots start at 1.15) */
    marks.push({ x: panelCx, y: 0.98, z: PANEL_Z - 0.007, w: Math.min(1.45, panelW - 0.4), h: 0.19 });
  }

  /* ── materials. Frame vs panel differ by a few percent of value on purpose:
     it guarantees the recess reads even when the sun is behind the run. ── */
  const stucT = stucco(1.6, 1.6);
  const frameMat = new THREE.MeshStandardMaterial({ map: stucT, color: 0xfdfcf7, roughness: .88 });
  const panelMat = new THREE.MeshStandardMaterial({ map: stucT, color: 0xe6e3d9, roughness: .9 });
  /* The blind back of each punched slot, and the thing that makes the run read
     after dark. NOT black: in the photo the niche is white plaster in shadow,
     so a mid warm grey with the reveal's own cast shadow doing the darkening is
     what reads as "punched" rather than "hole cut in a cardboard model". */
  const nicheMat = new THREE.MeshStandardMaterial({
    color: 0x5e5951, roughness: .95, emissive: 0xffc27a, emissiveIntensity: 0,
  });
  nightBits.push(on => { nicheMat.emissiveIntensity = on ? 2.4 : 0; });
  const markMat = new THREE.MeshStandardMaterial({
    map: westinTex(), transparent: false, alphaTest: .5, roughness: .8,
    emissive: 0xffe6bd, emissiveIntensity: 0, side: THREE.FrontSide,
  });
  nightBits.push(on => { markMat.emissiveIntensity = on ? .45 : 0; });
  const haloMat = addMat(glowTex(), 0, 0, .60);
  haloMat.color = new THREE.Color(0xffc98a);

  emitBoxes(g, frame, frameMat, 'cabana:frame');
  emitBoxes(g, panels, panelMat, 'cabana:panel');
  emitBoxes(g, niches, nicheMat, 'cabana:niche');
  emitBoxes(g, bases, MAT.stone, 'cabana:base');
  emitPlanes(g, marks, markMat, 'cabana:westin');
  const haloI = emitPlanes(g, halos, haloMat, 'cabana:halo');
  haloI.renderOrder = 6;

  /* two real wall lamps' worth of light, night only (budget: the pool already
     carries two underwater PointLights and the floating lanterns three) */
  for (const lx of [-HALF * 0.55, HALF * 0.55]) {
    const L = new THREE.PointLight(0xffc489, 0, 13, 2);
    L.position.set(lx, 2.3, FRONT + 0.35);
    g.add(L);
    nightBits.push(on => { L.intensity = on ? 1.6 : 0; });
  }

  /* ── the shaded bay behind the run ───────────────────────────────────────
     What you actually see through the 0.5–0.9 m gaps in Rachel's photo is not
     the garden — it is the cabana's own dark recess: near-black timber, a low
     soffit edge, dark stone underfoot. Without this the gaps show hedge and
     bougainvillea and the run reads as a fence with holes in it. One wall, one
     soffit lip and one floor band, sized to stay UNDER the shortest block's cap
     (2.56 m) so it never breaks the silhouette. ── */
  const bayX = HALF + 1.4;
  const bayMat = new THREE.MeshStandardMaterial({
    map: timber(bayX * 2 / 2.2, 2.30 / 2.2), color: 0x6a5949, roughness: .74,
  });
  box(g, bayX * 2, 2.30, .25, 0, 1.15, FRONT + FRAME_D + .18, bayMat);
  box(g, bayX * 2, .16, .55, 0, 2.30, FRONT + FRAME_D - .12, MAT.darkWood);
  slab(g, -bayX, FRONT - .30, bayX, FRONT + FRAME_D + .30, .03, MAT.stone, .06);

  /* ── kept from the previous build: the timber boardwalk over its lawn strip,
     the two stone steps down to the pool deck, and the clipped hedge screening
     the run from the villa gardens. They sit BEHIND the blocks now, and the
     paved band between the two is the walkway. ── */
  const bwX0 = -HALF - 1.4, bwX1 = HALF + 1.4;
  const bwZ0 = -.1, bwZ1 = 2.4;
  slab(g, bwX0, bwZ0, bwX1, bwZ1, .3, new THREE.MeshStandardMaterial({
    map: timber((bwX1 - bwX0) / 2.4, (bwZ1 - bwZ0) / 2.4), roughness: .68,
  }), .16);
  slab(g, bwX0, bwZ0, bwX1, bwZ1, .1, MAT.greenery, .2);     // lawn strip beneath

  /* stone steps down off the boardwalk, at the SUITE end of the run where the
     deck actually delivers people */
  slab(g, bwX1 - 3.2, -1.1, bwX1 - 0.2, -.45, .2, MAT.coping, .22);
  slab(g, bwX1 - 3.2, -1.75, bwX1 - 0.2, -1.1, .1, MAT.coping, .22);

  /* clipped hedge behind the run */
  box(g, run + 4, .95, 1.1, 0, .475, 3.3, MAT.hedge);

  /* ── local → world: face west across the pool, sit on the east long side ── */
  g.rotation.y = Math.PI / 2;                 // local −Z → world −X
  g.position.set(CB.x, 0, (CB.z0 + CB.z1) / 2);

  /* Colliders are enclave-space (world.js rotates this slice afterwards) and do
     NOT follow the group transform, so they are written by hand. For rotation.y
     = +π/2, local (x,z) ↦ (CB.x + z, cz0 − x) — the old code used CB.x − z and
     stood every pier's collider ~0.8 m east of its own wall.
     ONE capsule chain down the run: with the shaded bay wall closing the backs,
     blocks + bay are a single solid mass 1.33 m deep, so r 0.67 on the centre
     line is the honest shape. The gaps between blocks are NOT passable any
     more — that is what "solid" means. Circulation goes round the ENDS of the
     run, into the 5.8 m paved walkway behind it (flood-fill verified). */
  const cz0 = (CB.z0 + CB.z1) / 2;
  const colZ = (FRONT - .18 + FRONT + FRAME_D + .30) / 2;   // wing front → bay back
  const colX = CB.x + colZ;
  colLine(G.colliders, colX, cz0 - bayX, colX, cz0 + bayX, .67);

  return g;
}

/* ═══════════════════════ POOLSIDE FURNITURE ═══════════════════════════════ */

function makeLounger() {
  /* `sun_lounger` — slatted timber frame, ivory squab, a rolled towel at the
     head. ⚠ THE π LIVES HERE, once, for all three call sites. The GLB's front
     is −Z = the FEET (campus.js's rooftop row wants exactly that), but this
     factory's primitive points its HEAD at −Z and every caller below yaws the
     prototype on that assumption. Pre-rotating the model inside its own group
     is the `ry + π` ASSET_SPEC Group E asks for, spent in one place instead of
     three. Measured: the GLB is 0.819 W × 2.063 L against these boxes' 0.66 ×
     1.946 (seat pan .66 × 1.35 at z +.18, raked back reaching z −1.091), so it
     is 0.16 m wider and 0.12 m longer. The row carries NO COLLIDER at all —
     buildPoolside says why — so neither delta moves anything. */
  if (have('sun_lounger')) {
    const p = mdlProto('sun_lounger', Math.PI);
    if (p) return p;
  }
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
  /* `pool_umbrella` (weighted base, tapered pole, ferrule, hub, 8 ribs,
     finial) + `pool_umbrella_canopy` as its own mesh so the deck can colour
     it. Both halves share ONE origin — the floor at the pole foot — so one
     scale drives both: the model is authored at r 1.55 on a 2.50 m pole with
     its rim at 2.20, and `[radius/1.55, height/2.5, radius/1.55]` reproduces
     each call site's cone exactly (the 1.5 × 2.45 deck lands at rim 2.156
     against the primitive's height − .3 = 2.15).
     ⚠ The canopy's APEX is 2.76, not the cone's 2.64 — a deliberate deviation
     (ASSET_SPEC Group E): at the code's .44 m rise the canopy read as a flat
     plate in-engine. The RIM, the dimension a head clears, is unchanged. */
  if (have('pool_umbrella') && have('pool_umbrella_canopy')) {
    const u = new THREE.Group();
    const pole = mdl('pool_umbrella');
    const can = mdl('pool_umbrella_canopy');
    const tint = tintedMat('pool_umbrella_canopy', colour.color.getHex());
    if (pole && can && tint) {
      can.traverse(n => { if (n.isMesh) n.material = tint; });
      u.add(pole, can);
      u.scale.set(radius / 1.55, height / 2.5, radius / 1.55);
      return u;
    }
  }
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
  /* The row now runs along Z down the pool's east long side, each lounger
     turned to face west across the water (makeLounger points its head at
     local −Z, so −90° about Y aims it at −X). */
  const loungerProto = makeLounger();
  const step = (LG.z1 - LG.z0) / (LG.count - 1);
  for (let i = 0; i < LG.count; i++) {
    const l = loungerProto.clone();
    l.position.set(LG.x, 0, LG.z0 + i * step);
    l.rotation.y = Math.PI / 2;   // head toward the water, which is now EAST of the row
    g.add(l);
  }

  /* teal umbrellas — clubhouse deck calls the enclave's umbrellas teal */
  const umProto = makeUmbrella(MAT.teal, 1.55, 2.5, 8);
  /* set back 1.5 m from the lounger row — i.e. further EAST, away from the
     water, now that the row runs along Z */
  const ux = LG.x - 1.5;   // set back from the water — loungers are now on the WEST side
  for (let i = 0; i < LG.umbrellas; i++) {
    const z = LG.z0 + (i + .5) * (LG.z1 - LG.z0) / LG.umbrellas;
    const u = umProto.clone();
    u.position.set(ux, 0, z);
    u.rotation.y = i * .3;
    g.add(u);
    G.colliders.push({ x: ux, z, r: .2 });
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

  /* The pool's long axis is Z, so the lanterns must string DOWN its length,
     receding from the suite — two loose files 2.4 m either side of the
     centreline. (They used to sit in rows across a 25 m-wide sheet; after the
     rotation that put them in a line abreast on a 10 m-wide pool, with the
     outer ones on the grass.) Seats are pool-local; `home` adds P.cx/P.cz. */
  const fileA = [-10.4, -5.2, 0, 5.2, 10.4], fileB = [-7.8, -2.6, 2.6, 7.8];
  const seats = [];
  for (const z of fileA) seats.push([-2.4, z]);
  for (const z of fileB) seats.push([2.4, z]);

  const lightIdx = new Set([0, 4, 7]);          // 3 real PointLights (budget ≤ 4)

  for (let i = 0; i < P.lanterns; i++) {
    const [bx, bz] = seats[i % seats.length];
    const home = {
      x: P.cx + bx + (rnd() - .5) * .8,
      z: P.cz + bz + (rnd() - .5) * 1.0,
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
const _camLocal = new THREE.Vector3();   // camera in pool-local space (see below)

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
      /* x/z here are POOL-LOCAL but cam.position is world, and the whole pool
         now hangs under the rotated enclave group — so the camera has to be
         brought into the same frame or the reflection streaks billboard to a
         bearing 90° off. Object3D.lookAt (used by the halo) handles this
         itself; a hand-rolled atan2 does not. */
      f.streak.parent.worldToLocal(_camLocal.copy(cam.position));
      f.streak.rotation.y = Math.atan2(_camLocal.x - x, _camLocal.z - z);
      f.halo.lookAt(cam.position);        // lookAt handles the rotated parent
    }
  }
}

/* ═════════════════════ LOUNGE TERRACE POOL (cocktail hour) ════════════════ */
/* ── a closed polygon's signed area, and the two shape helpers the free-form
      pool needs. Kept here rather than in the river's toolbox because the
      river never triangulates — it fans. ── */
function polyArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
}
/** a horizontal THREE.Shape from world-XZ points (+ optional hole), at y. */
function flatShape(outer, hole) {
  const to2 = p => new THREE.Vector2(p[0], -p[1]);       // rotateX(-π/2) flips z
  const o = polyArea(outer) > 0 ? outer : [...outer].reverse();
  const sh = new THREE.Shape(o.map(to2));
  if (hole) {
    /* three's ShapeUtils wants the contour CCW and every hole CW */
    const h = polyArea(hole) < 0 ? hole : [...hole].reverse();
    sh.holes.push(new THREE.Path(h.map(to2)));
  }
  const geo = new THREE.ShapeGeometry(sh);
  geo.rotateX(-Math.PI / 2);
  return geo;
}
/** outward miter offset of a star-shaped polygon about (cx, cz) */
function offsetPoly(pts, cx, cz, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i - 1 + n) % n], v = pts[i], q = pts[(i + 1) % n];
    const l1 = Math.hypot(v[0] - p[0], v[1] - p[1]) || 1;
    const l2 = Math.hypot(q[0] - v[0], q[1] - v[1]) || 1;
    const e1x = (v[0] - p[0]) / l1, e1z = (v[1] - p[1]) / l1;
    const e2x = (q[0] - v[0]) / l2, e2z = (q[1] - v[1]) / l2;
    let nx = -e1z - e2z, nz = e1x + e2x;
    const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
    if ((v[0] - cx) * nx + (v[1] - cz) * nz < 0) { nx = -nx; nz = -nz; }
    /* miter length, clamped: a 30° notch would otherwise throw a spike */
    const m = Math.min(1.9, 1 / Math.max(.42, Math.sqrt((1 + (e1x * e2x + e1z * e2z)) / 2)));
    out.push([v[0] + nx * d * m, v[1] + nz * d * m]);
  }
  return out;
}

/* ═══════════════════════════ THE SECOND POOL ═══════════════════════════════
   SITE.LOUNGE_POOL — the 3-BR suites' pool, on the presidential pool's local
   −X flank. FREE-FORM as of 2026-08-02: it was a rectangle standing in for the
   plan that `SITE.LOUNGE_POOL.OUTLINE` had already published (traced off
   reference/photos/lawn-dinner-strips-and-2nd-pool.png), which is the last
   item the ceremony/dinner pass left in the polish backlog.

   The outline is normalised (u = x/w, v = z/d, both −0.5…+0.5, first point not
   repeated) and its AABB is exactly w × d, so NOTHING MOVES — today's rectangle
   was its bounding box, and the terrace slab, the umbrellas, the loungers and
   the two dinner lawns beside it are all still where they were.

   Two constraints from that backlog entry, both honoured:
     · the straight `v = −0.5` run is the edge facing the lounge's folding
       glass, and it stays straight — it is the first two outline points and
       nothing here rounds it;
     · this pool must NOT add a mirror pass. The hero pool owns water.js's one
       Reflector; this is the same flat sheet makeRectPool() gave it.
   ═══════════════════════════════════════════════════════════════════════════ */
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

  {
    const PLINTH = .30, WY = .26, DEPTH = 1.25, COPE = .45, TILE = .6;
    const FY = WY - DEPTH;
    /* the published outline, scaled into world metres about (cx, cz) */
    const edge = LP.OUTLINE.map(([u, v]) => [LP.cx + u * LP.w, LP.cz + v * LP.d]);
    const lip = offsetPoly(edge, LP.cx, LP.cz, COPE);

    /* ── the black-stone plinth: an outward skirt on the lip line ── */
    const skirt = acc(false);
    for (let i = 0, n = lip.length; i < n; i++) {
      const a = lip[i], b = lip[(i + 1) % n];
      const u0 = i * .9, u1 = u0 + .9;
      /* DoubleSide, so the winding around a concave notch cannot flip a panel */
      quad(skirt, [b[0], PLINTH, b[1], u1, 0], [a[0], PLINTH, a[1], u0, 0],
                  [a[0], -.35, a[1], u0, 1], [b[0], -.35, b[1], u1, 1]);
    }
    const stoneM = new THREE.MeshStandardMaterial({
      color: C.stone, roughness: .42, metalness: .05, side: THREE.DoubleSide });
    const sm = bake(skirt, stoneM, 'lounge-pool:plinth');
    if (sm) g.add(sm);

    /* ── the honed coping ring: the lip polygon with the water punched out ── */
    const cope = new THREE.Mesh(flatShape(lip, edge), MAT.coping);
    cope.position.y = PLINTH + .012;
    g.add(cope);

    /* ── the tiled basin: walls down from the coping, then the floor ── */
    const tileMats = [];
    const tileMat = ns => {
      const m = new THREE.MeshStandardMaterial({
        map: ns, roughness: .28, metalness: .02, side: THREE.DoubleSide,
        emissive: new THREE.Color(C.uwCyan), emissiveMap: ns, emissiveIntensity: 0,
      });
      tileMats.push(m); return m;
    };
    nightBits.push(on => { for (const m of tileMats) m.emissiveIntensity = on ? .34 : 0; });

    const wall = acc(false);
    let run = 0;
    for (let i = 0, n = edge.length; i < n; i++) {
      const a = edge[i], b = edge[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const u0 = run / TILE, u1 = (run + len) / TILE;
      run += len;
      const vh = (PLINTH - .01 - FY) / TILE;
      quad(wall, [b[0], PLINTH - .01, b[1], u1, 0], [a[0], PLINTH - .01, a[1], u0, 0],
                 [a[0], FY, a[1], u0, vh], [b[0], FY, b[1], u1, vh]);
    }
    const wm = bake(wall, tileMat(mosaic(1, 1)), 'lounge-pool:basin-wall');
    if (wm) g.add(wm);

    const floorGeo = flatShape(edge);
    const fuv = floorGeo.attributes.uv;
    for (let i = 0; i < fuv.count; i++) {          // ShapeGeometry UVs are metres
      fuv.setXY(i, fuv.getX(i) / TILE, fuv.getY(i) / TILE);
    }
    fuv.needsUpdate = true;
    const floor = new THREE.Mesh(floorGeo, tileMat(mosaic(1, 1)));
    floor.position.y = FY;
    g.add(floor);

    /* caustics on the tiles, on a copy of the outline shrunk 4 % */
    const inner = offsetPoly(edge, LP.cx, LP.cz, -.35);
    const cGeo = flatShape(inner);
    const cTex = causticTex(1, 1);
    scrolls.push({ tex: cTex, u: TUNE.CAUSTIC_U, v: TUNE.CAUSTIC_V });
    const cuv = cGeo.attributes.uv;
    for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) / 3.4, cuv.getY(i) / 3.4);
    cuv.needsUpdate = true;
    const caust = new THREE.Mesh(cGeo,
      addMat(cTex, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_DAY, TUNE.CAUSTIC_NIGHT));
    caust.position.y = FY + .02;
    caust.renderOrder = 1;
    g.add(caust);

    /* ── the surface. A flat sheet, NOT a Reflector (see the header) ── */
    const wGeo = flatShape(offsetPoly(edge, LP.cx, LP.cz, -.02));
    const wuv = wGeo.attributes.uv;
    for (let i = 0; i < wuv.count; i++) wuv.setXY(i, wuv.getX(i) / 2.2, wuv.getY(i) / 2.2);
    wuv.needsUpdate = true;
    const water = new THREE.Mesh(wGeo, waterMat(1, 1, { opacity: .8 }));
    water.position.y = WY;
    water.renderOrder = 3;
    g.add(water);

    /* ── colliders: the chain follows the LIP, not four straight runs ── */
    for (let i = 0, n = lip.length; i < n; i++) {
      colLine(G.colliders, lip[i][0], lip[i][1], lip[(i + 1) % n][0], lip[(i + 1) % n][1], .55);
    }
  }

  /* teal umbrellas along both long sides + a handful of loungers */
  const umProto = makeUmbrella(MAT.teal, 1.5, 2.45, 8);
  const loungerProto = makeLounger();
  /* umbrellas stand well clear of the coping. (A previous comment said the
     COCKTAIL spawn was on the north walkway — cocktail moved to the beach
     lawn on 2026-08-02; the walkway stays open for the dinner-lawn routes.) */
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

/* ═══════════════════════ THE RESORT RIVER ═════════════════════════════════
   The Westin's serpentine lazy-river system — the dominant feature of the
   resort's middle ground, and the thing you actually read from fly mode.
   Reference: reference/photos/river-lazy-river-detail.png (Carl's crop) and
   reference/photos/westin-site-map.jpeg. Footprint: SITE.RIVER + SITE.LAGOON.

   WHAT REPLACED WHAT.  This used to be `buildLagoon()`: one free-form blob
   built as a ShapeGeometry with a scaled copy punched out for the deck. The
   aerial is nothing like a blob — it is a *route*: circular pool → long
   winding channel → basin → hairpin → circular pool. So the shape is now
   driven by two authored CENTRELINES (SITE.RIVER.SPINE / .SPUR, [x, z,
   halfWidth]) plus four star-shaped BASINS, and everything else — banks,
   coping, sand deck, skirt, paths, planting — is generated from those.

   Four decisions worth knowing before editing:

   1 · THE WATER IS OPAQUE, and carries its depth as a VERTEX-COLOUR ramp
       (pale at the bank, deep in the middle) instead of as transparency over
       a tiled basin. Two reasons. Cost: this is ~4,000 m² of backdrop seen
       from directly overhead in fly mode, and a transparent sheet over a lit
       basin floor is three overlapping near-fullscreen layers for something
       100 m away. Correctness: the channels and the basins OVERLAP by
       construction (the river runs *into* the lagoon), and two coplanar
       transparent sheets double-blend into a visible dark seam. Opaque water
       makes the overlap free — the channel is simply built 25 mm lower and
       the basin wins the depth test. water.js reserves its one Reflector for
       the hero pool; nothing here adds a second mirror pass.

   2 · BASINS ARE RADIAL FANS, not ShapeGeometry. The old free-form outline
       technique is kept (a seeded sum of low harmonics on an ellipse, so the
       shape is organic but identical on every load — house rule: never
       Math.random), but earcut triangulation puts every vertex ON the
       contour, which leaves nothing in the middle to carry the depth ramp.
       A fan over rings of the same outline gives interior vertices for free,
       and the outline is star-shaped about its centre by construction, so the
       fan can never self-intersect.

   3 · IT IS ALL BAKED INTO A HANDFUL OF MESHES. Per-feature meshes cost ~100
       draw calls (the old lagoon's ten cloned umbrellas alone were 40); the
       whole system is accumulated into one buffer per material and every
       repeated object is instanced.

   4 · WINDING IS LOAD-BEARING. Every horizontal surface here is FrontSide, so
       a quad wound the wrong way is invisible from above — which is the only
       view that matters. See quad() for the rule and both emitters for how it
       flips between the two sides of a channel.

   Deliberately NOT modelled from the reference: the water slides and the
   inner-tube dock at the head of the real lazy river, the pool bar's stools,
   the shade sails, and the second, smaller loop that runs behind the hotel's
   north wing — all close-up detail on a backdrop you fly past.
   ═══════════════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const WHITE = new THREE.Color(0xffffff);

const RC = {
  shallow:       new THREE.Color(0x59cfe4),
  deep:          new THREE.Color(0x0a6796),
  nightTint:     new THREE.Color(0x35576b),   // multiplies the vertex ramp
  nightEmissive: new THREE.Color(0x0a5f77),
  lampWarm:      new THREE.Color(0xffc274),
};

/* a small LUT so the depth ramp costs no allocation per vertex */
const RAMP = Array.from({ length: 12 }, (_, i) => RC.shallow.clone().lerp(RC.deep, i / 11));
const ramp = k => RAMP[Math.max(0, Math.min(11, Math.round(k * 11)))];

/* ── geometry accumulators ──────────────────────────────────────────────── */
function acc(colour) { return { p: [], t: [], c: colour ? [] : null }; }

/* One quad = two triangles; each vertex is [x, y, z, u, v, colour?].
   WINDING (three r180, don't guess): for a face pointing +Y the cross product
   (B−A)×(C−A) must come out positive, which means A must be the corner with
   the LARGER lateral offset when walking a ribbon, and the SMALLER radius
   when walking a ring. Both are derived in place at the call sites. */
function quad(a, A, B, C, D) {
  for (const v of [A, B, C, A, C, D]) {
    a.p.push(v[0], v[1], v[2]);
    a.t.push(v[3], v[4]);
    if (a.c) { const c = v[5] || RC.shallow; a.c.push(c.r, c.g, c.b); }
  }
}

/* One triangle, same vertex format. A centre fan over a star-shaped basin is
   quad()'s ring case with the inner ring collapsed to the centre — so the
   winding is (centre, edge@t1, edge@t0), NOT the other way round. */
function tri(a, A, B, C) {
  for (const v of [A, B, C]) {
    a.p.push(v[0], v[1], v[2]);
    a.t.push(v[3], v[4]);
    if (a.c) { const c = v[5] || RC.shallow; a.c.push(c.r, c.g, c.b); }
  }
}

function bake(a, mat, name) {
  if (!a.p.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.t, 2));
  if (a.c) g.setAttribute('color', new THREE.Float32BufferAttribute(a.c, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  return m;
}

/* UVs are WORLD-PLANAR (u = x/S, v = −z/S) on every horizontal surface, so one
   merged buffer tiles consistently across features and never stretches through
   a bend. The textures are therefore taken at repeat 1 and the scale lives in
   the UVs. */
const UVS = 1 / 6;
const pu = x => x * UVS, pv = z => -z * UVS;

/* ── the free-form outline: organic, seeded, star-shaped about its centre ──
   Amplitudes are normalised so `amp` is the actual maximum deviation from the
   base ellipse — otherwise a seed that rolls high on every harmonic pins the
   shape against the clamp and the "organic" blob comes out with flat circular
   arcs cut into it. */
function outlineFn(seed, amp, harmonics = 5) {
  const rnd = mulberry32(seed);
  const harm = [];
  let tot = 0;
  for (let k = 2; k <= harmonics + 1; k++) {
    const a = (1 - (k - 2) * .16) * (.45 + rnd());
    harm.push({ k, a, p: rnd() * TAU });
    tot += a;
  }
  for (const h of harm) h.a *= amp / (tot || 1);
  return th => {
    let f = 1;
    for (const h of harm) f += h.a * Math.sin(h.k * th + h.p);
    return Math.max(.7, Math.min(1.32, f));
  };
}

/* a basin in world space, with the two operations everything else needs:
   a point on (or offset from) its outline, and an exact inside test */
function makeBasin(o) {
  const b = { ...o, rm: (o.rx + o.rz) * .5 };
  b.at = (th, off = 0) => {
    const f = b.fr(th);
    const dx = Math.cos(th) * b.rx * f, dz = Math.sin(th) * b.rz * f;
    const L = Math.hypot(dx, dz) || 1;
    return [b.cx + dx + dx / L * off, b.cz + dz + dz / L * off];
  };
  /* normalising by (rx, rz) turns the outline into exactly fr(θ), so this is
     exact for any star-shaped blob — not a bounding-circle approximation */
  b.inside = (x, z, off = 0) => {
    const nx = (x - b.cx) / b.rx, nz = (z - b.cz) / b.rz;
    return Math.hypot(nx, nz) < b.fr(Math.atan2(nz, nx)) + off / b.rm;
  };
  return b;
}

/* ── centreline sampler ─────────────────────────────────────────────────────
   The half-width rides in the curve's unused Y channel, so it interpolates
   with exactly the same centripetal Catmull-Rom that smooths the path — no
   second curve to keep in sync, and no way for width and position to drift
   apart when a control point moves. Samples are arc-length even (getPointAt),
   so the ribbon's quads stay square-ish through the tight reversals. */
function centreline(ctrl, step) {
  const curve = new THREE.CatmullRomCurve3(
    ctrl.map(([x, z, hw]) => new THREE.Vector3(x, hw, z)), false, 'centripetal', .5);
  const n = Math.max(8, Math.round(curve.getLength() / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n);
    out.push({ x: p.x, z: p.z, hw: p.y, t: i / n });
  }
  for (let i = 0; i <= n; i++) {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(n, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    out[i].tx = dx / L;  out[i].tz = dz / L;
    out[i].nx = -dz / L; out[i].nz = dx / L;        // unit left normal
  }
  return out;
}

/* lateral point on a centreline: |u| = 1 is the bank, `extra` walks further
   out (coping, sand bank, planting) on the same side */
function lat(s, u, extra = 0) {
  const d = s.hw * u + (u < 0 ? -extra : extra);
  return [s.x + s.nx * d, s.z + s.nz * d];
}

/* ── THE MOSAIC SWIRL FLOOR ─────────────────────────────────────────────────
   reference/resort-pool-complex-brief.md §2b. Broad, soft-edged ribbons of
   saturated ultramarine brushed across the pale turquoise floor — the pool
   complex's signature, and the one thing Carl called out as missing.

   A seeded CanvasTexture, not geometry, and the choice is the opposite of the
   one the beach pool's concentric rings made two lines below — for a reason.
   A MEDALLION is a hard-edged circle whose radius is a stated dimension, so
   geometry gets it exactly right and a texture would have to fight the river's
   world-planar 1/6 m UVs. A SWIRL is soft-edged, and the whole read is the
   alpha falloff at a ribbon's shoulder; as quads that is either a hard cut or
   ten times the triangles. So this is 768² of canvas (ONE texture, shared by
   all four basins) painted at SITE.RIVER.SWIRL.span metres across, and the
   geometry under it is a bare centre fan.

   Two things make it correct rather than merely cheap:
     · it is drawn as ALPHA ONLY — the pale field is not painted, because the
       river's own shallow→deep vertex ramp already IS the field (measured:
       reference #2cb6d4 sits between RC.shallow 0x59cfe4 and RC.deep 0x0a6796).
       So the ribbons overlay the ramp and every basin keeps its depth read,
       its animated normal map and its night flip underneath.
     · it TILES SEAMLESSLY on both axes: each ribbon is a sine whose period
       divides the tile exactly, drawn from −w to 2w so no line cap ever lands
       inside the tile, and stamped at three vertical offsets. Basins address
       it with RepeatWrapping and a per-basin offset, so one canvas gives four
       different-looking floors. */
function swirlCanvas() {
  const N = 768;
  return paint(N, N, (g, w, h) => {
    const S = SITE.RIVER.SWIRL;
    const ppm = w / S.span;                 // pixels per metre — widths are REAL
    const rnd = mulberry32(SEED + 523);
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineJoin = 'round';

    /* the measured ribbon colour, #1379ca, with a slightly deeper core so a
       wide ribbon reads as a brushstroke rather than as a flat band */
    const CORE = '10,58,166', EDGE = '19,110,198';
    const strokes = [];
    for (let i = 0; i < S.ribbons; i++) {
      /* the measured spread is skewed — most ribbons 2–5 m with a few broad
         masses — so square the draw rather than take it flat */
      const k01 = rnd();
      const wpx = (S.wMin + k01 * k01 * (S.wMax - S.wMin)) * ppm;
      strokes.push({
        wpx,
        y0: rnd() * h,
        amp: (.045 + rnd() * .13) * h,      // how far the sweep wanders, 1.8…6.8 m
        k: 1 + ((rnd() * 2) | 0),           // whole sweeps per tile — keeps the wrap exact
        ph: rnd() * TAU,
        taper: .82 + rnd() * .36,           // per-ribbon brush weight
        /* several run roughly parallel for 15–25 m before diverging (§2b): a
           companion at a small constant offset does exactly that */
        twin: rnd() < .40 ? (.55 + rnd() * .7) : 0,
      });
    }
    /* ONE continuous path per pass. A segmented stroke with a per-segment
       lineWidth was tried first, to taper the brush along its length, and it
       staircases visibly at this scale whatever the cap style — the ribbon is
       up to 130 px wide and every join is a step in its shoulder. The swell is
       carried by the SPREAD of widths across ribbons instead, which is what
       the measurement actually describes. */
    const lay = (s, dy, wMul, alpha, colour) => {
      g.strokeStyle = `rgba(${colour},${alpha})`;
      g.lineWidth = s.wpx * wMul * s.taper;
      g.beginPath();
      for (let x = -w; x <= w * 2; x += 8) {
        const y = s.y0 + dy + s.amp * Math.sin(s.k * TAU * x / w + s.ph);
        if (x === -w) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    };
    /* halo → mid → core, three passes, so the shoulder is soft; and three
       vertical stamps so the tile wraps in v as well as in u */
    for (const dy of [-h, 0, h]) {
      for (const s of strokes) {
        for (const off of s.twin ? [0, s.wpx * (1 + s.twin)] : [0]) {
          const t = { ...s, y0: s.y0 + off };
          lay(t, dy, 2.30, .13, EDGE);
          lay(t, dy, 1.45, .30, EDGE);
          lay(t, dy, 1.00, .82, CORE);
        }
      }
    }
  });
}
const swirlTex = () => sharedTex('swirl', canv('swirl', swirlCanvas), 1, 1, true);

/* the system's water footprint, kept for cullPlantsInRiver */
let riverWater = null;

/* ═══════════════════════════ the builder ══════════════════════════════════ */
function buildRiver(G) {
  const R = SITE.RIVER, L = SITE.LAGOON;
  const g = new THREE.Group();
  g.name = 'river';
  /* ONE group for the WHOLE system, and it is AUTHORED IN WORLD SPACE.
     ⚠ 2026-08-02 (proportion pass) — `worldSpace` is the whole fix.
     world.js's adoptWater() used to classify water.js's root children by the x
     of their bounding-box CENTRE and sweep anything under x = 84 into the
     rotated 隐逸居 enclave. The river was spared that only by accident: its box
     happened to average out east of the threshold. Extend it west toward the
     beach — which is exactly what the resort's aerial asks for — and the centre
     crosses 84, and the ENTIRE system silently swings 90° and runs north–south
     along the sand. That is what capped SITE.RIVER.WEST at cx −82 and stopped
     the beach pool reaching the beach.
     A positional guess is now a stated fact: this group is world space, whatever
     its extent. world.js honours the same flag it already honours for the
     Welcome Brunch's late adoption, so there is one rule, not two. */
  g.userData.worldSpace = true;
  ROOT.add(g);

  const WY = R.BASIN_Y, CY = R.WATER_Y;   // basin water, channel water

  /* ── materials ── */
  /* the UVs are world-planar at 1/6 m, so a repeat of .45 puts the ripple
     tile at ~13 m — big enough that it never reads as a repeating pattern
     from directly above, which is the only angle this water is really seen at */
  const nrm = normalTex(.45, .45);
  scrolls.push({ tex: nrm, u: TUNE.SCROLL_U * .5, v: TUNE.SCROLL_V * .5 });
  /* Roughness/env are deliberately DULL. The hero pool is a mirror because
     Carl's photos are a mirror; this one is read from 150 m up, and a mirror
     seen from straight above reflects nothing but sky — the first pass came
     out white. The reference reads as flat, saturated turquoise, so the
     vertex ramp does the work and the environment only puts a sheen on it. */
  const waterM = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .34, metalness: 0,
    normalMap: nrm, normalScale: new THREE.Vector2(.06, .06),
    envMapIntensity: .55,
  });
  nightBits.push(on => {
    waterM.color.copy(on ? RC.nightTint : WHITE);
    waterM.emissive.copy(RC.nightEmissive);
    waterM.emissiveIntensity = on ? .5 : 0;
    waterM.roughness = on ? .16 : .34;
    waterM.envMapIntensity = on ? .35 : .55;
    /* a whisper. At .16 the wave texture read as diagonal banding straight
       down from fly mode — the plan shape is the point, not the ripple. */
    const ns = on ? .045 : .06;
    waterM.normalScale.set(ns, ns);
  });

  const sandM = new THREE.MeshStandardMaterial({
    map: sand(1, 1), color: 0xc4b795, roughness: .96 });
  const copeM = new THREE.MeshStandardMaterial({ color: C.stoneLight, roughness: .34, metalness: .05 });
  const skirtM = new THREE.MeshStandardMaterial({
    map: plaster(1, 1), roughness: .4, side: THREE.DoubleSide,
  });
  const pathM = new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: .94 });

  /* ── the basins, west → east ────────────────────────────────────────────
     Four became eight on 2026-08-02, closing the gaps the general pass was
     asked to close against reference/photos/resort-water-features.jpeg:
       · `east2`  the SECOND round pool by the hotel — the aerial has two, not
                  one, and the smaller has its own dark island in the middle
       · `hotel0…2`  the pool complex in the crook of the crescent, which was
                  simply missing. Three overlapping lobes, elongated along the
                  building's face (rz > rx: the crescent's concave wall runs
                  roughly north–south where they sit), which is what the aerial
                  shows — one water body with planted fingers between the lobes.
     `coarse` on a basin only changes how densely riverColliders fills its
     interior. These four are 250 m from the nearest spawn and exist to be seen
     from the air; filling them at the enclave's 2.6 m pitch would have cost
     ~300 colliders for water nobody swims in. */
  const basins = [
    makeBasin({ key: 'west', cx: R.WEST.cx, cz: R.WEST.cz, rx: R.WEST.r, rz: R.WEST.r,
      deck: R.WEST.deck, segs: 88, fr: outlineFn(SEED + 909, .155) }),
    makeBasin({ key: 'mid', cx: R.MID.cx, cz: R.MID.cz, rx: R.MID.r, rz: R.MID.r,
      deck: R.MID.deck, segs: 32, fr: outlineFn(SEED + 231, .18, 4) }),
    makeBasin({ key: 'lagoon', cx: L.cx, cz: L.cz, rx: L.rx, rz: L.rz,
      deck: L.deck, segs: 76, fr: outlineFn(SEED + 447, .22) }),
    makeBasin({ key: 'east', cx: R.EAST.cx, cz: R.EAST.cz, rx: R.EAST.r, rz: R.EAST.r,
      deck: R.EAST.deck, segs: 56, fr: outlineFn(SEED + 613, .05, 3) }),
    makeBasin({ key: 'east2', cx: R.EAST2.cx, cz: R.EAST2.cz, rx: R.EAST2.r, rz: R.EAST2.r,
      deck: R.EAST2.deck, segs: 40, fr: outlineFn(SEED + 881, .06, 3), coarse: true }),
    ...SITE.HOTEL_POOLS.map((p, i) => makeBasin({
      key: 'hotel' + i, cx: p.cx, cz: p.cz,
      rx: p.r * (i === 1 ? .92 : .80), rz: p.r * (i === 1 ? 1.18 : 1.28),
      deck: p.deck, segs: 60, fr: outlineFn(SEED + 700 + i * 37, .23), coarse: true })),
  ];
  const inWater = (x, z) => basins.some(b => b.inside(x, z));
  const inDeck = (x, z) => basins.some(b => b.inside(x, z, b.deck + R.COPING));

  const W = acc(true), S = acc(false), K = acc(false), B = acc(false), P = acc(false);
  const V = (x, y, z, col) => [x, y, z, pu(x), pv(z), col];
  const skirtV = (x, y, z, v) => [x, y, z, pu(x) + pv(z), v];

  /* ── 1 · basins: water fan, coping ring, sand deck ring, skirt ────────── */
  const RINGS = [0, .26, .46, .63, .77, .89, 1];
  for (const b of basins) {
    for (let j = 0; j < b.segs; j++) {
      const t0 = j / b.segs * TAU, t1 = (j + 1) / b.segs * TAU;
      const e0 = b.at(t0), e1 = b.at(t1);

      /* water — concentric rings of the same outline, so the shallow→deep
         ramp has interior vertices to live on. Walking θ upward with the
         inner ring first is the +Y winding for a ring (see quad). */
      for (let k = 0; k < RINGS.length - 1; k++) {
        const r0 = RINGS[k], r1 = RINGS[k + 1];
        const c0 = ramp(1 - Math.pow(r0, 1.4)), c1 = ramp(1 - Math.pow(r1, 1.4));
        const ax = b.cx + (e0[0] - b.cx) * r0, az = b.cz + (e0[1] - b.cz) * r0;
        const bx = b.cx + (e1[0] - b.cx) * r0, bz = b.cz + (e1[1] - b.cz) * r0;
        const cx = b.cx + (e1[0] - b.cx) * r1, cz = b.cz + (e1[1] - b.cz) * r1;
        const dx = b.cx + (e0[0] - b.cx) * r1, dz = b.cz + (e0[1] - b.cz) * r1;
        quad(W, V(ax, WY, az, c0), V(bx, WY, bz, c0), V(cx, WY, cz, c1), V(dx, WY, dz, c1));
      }

      /* dark coping lip at the water's edge, then the sand deck beyond it */
      const k0 = b.at(t0, R.COPING), k1 = b.at(t1, R.COPING);
      quad(K, V(e0[0], R.COPE_Y, e0[1]), V(e1[0], R.COPE_Y, e1[1]),
              V(k1[0], R.COPE_Y, k1[1]), V(k0[0], R.COPE_Y, k0[1]));
      const d0 = b.at(t0, R.COPING + b.deck), d1 = b.at(t1, R.COPING + b.deck);
      quad(S, V(k0[0], R.DECK_Y, k0[1]), V(k1[0], R.DECK_Y, k1[1]),
              V(d1[0], R.DECK_Y, d1[1]), V(d0[0], R.DECK_Y, d0[1]));

      /* skirt: the coping's underside carried below the water line, so the
         edge reads as a pool wall and not as a paper cut-out at grazing
         angles. DoubleSide — you see the far bank's inner face across the
         water and the near bank's outer face from the deck. */
      quad(B, skirtV(e0[0], R.COPE_Y, e0[1], 0), skirtV(e1[0], R.COPE_Y, e1[1], 0),
              skirtV(e1[0], -R.DEPTH * .5, e1[1], .12), skirtV(e0[0], -R.DEPTH * .5, e0[1], .12));
    }
  }

  /* ── 1b · THE BEACH POOL'S CONCENTRIC RINGS ─────────────────────────────
     "a large circular/oval pool with concentric-ring patterns on its floor."
     In beach-pool-circular.png the floor carries half a dozen overlapping
     medallions of concentric circles in a deeper blue — it is the single thing
     that identifies this pool from the air, and it is why it is worth six
     medallions of geometry rather than a texture: the whole river system is
     UV-mapped world-planar at 1/6 m and a decal would have had to fight that.

     Drawn 6 mm OVER the basin water rather than under it. The water here is
     opaque (vertexColors, no blend — see the note on WATER_Y), so a pattern on
     the true floor would never be seen; from the air, pattern-on-surface and
     pattern-seen-through-water are the same picture. polygonOffset rather than
     a bigger gap, because at 6 mm the depth buffer cannot separate them and at
     60 mm the rings would visibly float at a grazing angle. */
  {
    const b = basins[0], W0 = R.WEST;
    const ringM = new THREE.MeshStandardMaterial({
      color: 0x2f86ad, roughness: .38, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    nightBits.push(on => {
      ringM.color.setHex(on ? 0x14364a : 0x2f86ad);
      ringM.emissive.setHex(0x0d5f7d);
      ringM.emissiveIntensity = on ? .45 : 0;
    });
    const RGa = acc(false);
    const RY = R.BASIN_Y + .006, BAND = .40, SEG = 40;
    for (const [dx, dz, rr] of W0.RINGS) {
      const ox = b.cx + dx * W0.r, oz = b.cz + dz * W0.r, R0 = rr * W0.r;
      for (let k = 1; k <= 3; k++) {
        const rad = R0 * (k / 3);
        for (let j = 0; j < SEG; j++) {
          const t0 = j / SEG * TAU, t1 = (j + 1) / SEG * TAU;
          const P = (t, q) => [ox + Math.cos(t) * q, oz + Math.sin(t) * q];
          const i0 = P(t0, rad - BAND / 2), i1 = P(t1, rad - BAND / 2);
          const o0 = P(t0, rad + BAND / 2), o1 = P(t1, rad + BAND / 2);
          /* trimmed to the pool: a medallion that ran onto the coping would
             read as paint on the sand */
          if (!b.inside(i0[0], i0[1], -.5) || !b.inside(o1[0], o1[1], -.5)) continue;
          quad(RGa, V(i0[0], RY, i0[1]), V(i1[0], RY, i1[1]),
                    V(o1[0], RY, o1[1]), V(o0[0], RY, o0[1]));
        }
      }
    }
    const rm = bake(RGa, ringM, 'river:beach-pool-rings');
    if (rm) g.add(rm);
  }

  /* ── 1c · THE LAGOON'S + HOTEL POOLS' MOSAIC SWIRL FLOOR ─────────────────
     See swirlCanvas() above for what it is and why it is a texture where the
     beach pool's medallions are geometry. Applied to the four basins the
     aerial actually shows it on — LAGOON and the three HOTEL_POOLS — and to
     no others: WEST already has its own (different, circular) floor artwork,
     and EAST/EAST2/MID are the small drum pools, which the photograph shows
     plain.

     Drawn 6 mm OVER the basin water, the same offset and the same reason as
     the medallions: this water is OPAQUE (vertexColors, no blend), so a
     pattern on the true floor would never be seen, and from the air
     pattern-on-surface and pattern-through-water are the same picture. */
  {
    const SW = R.SWIRL;
    /* SPAN is published in site.js as the lagoon's own full width. Assert it,
       because the whole point of a span in METRES is that a ribbon is 2–7 m on
       every basin — a silent drift here would make it a fraction again. */
    if (Math.abs(SW.span - L.rx * 2) > 1e-6) {
      console.warn(`water.js: SITE.RIVER.SWIRL.span (${SW.span}) is no longer `
        + `SITE.LAGOON.rx * 2 (${L.rx * 2}); ribbon widths are no longer metres.`);
    }
    const swirlM = new THREE.MeshStandardMaterial({
      map: swirlTex(), transparent: true, depthWrite: false,
      roughness: .40, metalness: 0, envMapIntensity: .5,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    nightBits.push(on => {
      /* ⚠ the ribbons must stay DARKER than the water at night, not merely
         dimmer with it. The first version copied waterM's own night treatment
         exactly (RC.nightTint + RC.nightEmissive at .5) and the swirl
         disappeared — a dark pattern on a dark sheet lit identically is one
         flat sheet. It keeps a fifth of the water's self-glow instead, which
         is the same ratio the basin tiles use against the hero pool. */
      swirlM.color.setHex(on ? 0x2b4a60 : 0xffffff);
      swirlM.emissive.copy(RC.nightEmissive);
      swirlM.emissiveIntensity = on ? .10 : 0;
    });

    const SWa = acc(false);
    const SY = R.BASIN_Y + .006;
    const srnd = mulberry32(SEED + 604);
    for (const b of basins) {
      if (!(b.key === 'lagoon' || b.key.startsWith('hotel'))) continue;
      /* ribbons follow the basin's own LONG axis (§2b: "they appear to follow
         the basin's long axis rather than cutting across it"). The canvas is
         painted with the ribbons running along +u, so a basin that is deeper
         than it is wide reads the axes the other way round. */
      const swap = b.rz > b.rx;
      /* a per-basin offset on the same tiling canvas — four different floors
         out of one texture. Drawn unconditionally so the stream never shifts. */
      const ou = srnd(), ov = srnd();
      const SV = (x, z) => {
        const a = (swap ? z - b.cz : x - b.cx) / SW.span + .5 + ou;
        const c = (swap ? x - b.cx : -(z - b.cz)) / SW.span + .5 + ov;
        return [x, SY, z, a, c];
      };
      const C0 = SV(b.cx, b.cz);
      for (let j = 0; j < b.segs; j++) {
        /* pulled 0.25 m inside the water line so a ribbon never bleeds onto
           the coping — the same trim the medallions take */
        const e0 = b.at(j / b.segs * TAU, -.25), e1 = b.at((j + 1) / b.segs * TAU, -.25);
        tri(SWa, C0, SV(e1[0], e1[1]), SV(e0[0], e0[1]));
      }
    }
    const sm = bake(SWa, swirlM, 'river:mosaic-swirl');
    if (sm) { sm.renderOrder = 1; g.add(sm); }
  }

  /* ── 2 · the channels ─────────────────────────────────────────────────── */
  const DIV = [-1, -.6, -.24, .24, .6, 1];
  const lines = { spine: centreline(R.SPINE, 1.6), spur: centreline(R.SPUR, 1.6) };

  /* bridge sites resolved up front, so the collider chain can leave a gap
     under each one — a walker must still be able to cross the river */
  const bridges = R.BRIDGES.map(([which, t]) => {
    const pts = lines[which];
    const s = pts[Math.round(t * (pts.length - 1))];
    return { s, x: s.x, z: s.z, w: s.hw * 2 + 3.0 };
  });

  for (const key of ['spine', 'spur']) {
    const pts = lines[key];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], q = pts[i + 1];

      /* water, trimmed where the channel is already inside a basin. Built at
         WATER_Y, 25 mm under BASIN_Y, so the overlap the trim cannot avoid
         (a straddling quad) resolves in the basin's favour and never
         z-fights. Both are opaque, so there is no blend seam either. */
      if (!(inWater(a.x, a.z) && inWater(q.x, q.z))) {
        for (let j = 0; j < DIV.length - 1; j++) {
          const u0 = DIV[j], u1 = DIV[j + 1];
          const c0 = ramp((1 - u0 * u0) * .72), c1 = ramp((1 - u1 * u1) * .72);
          const A = lat(a, u1), Bp = lat(q, u1), Cp = lat(q, u0), D = lat(a, u0);
          quad(W, V(A[0], CY, A[1], c1), V(Bp[0], CY, Bp[1], c1),
                  V(Cp[0], CY, Cp[1], c0), V(D[0], CY, D[1], c0));
        }
      }

      /* coping + skirt + a narrow pale bank on both sides, trimmed where the
         channel has run onto a basin's deck */
      if (inDeck(a.x, a.z) && inDeck(q.x, q.z)) continue;
      for (const sgn of [1, -1]) {
        const e0 = lat(a, sgn), e1 = lat(q, sgn);
        const k0 = lat(a, sgn, R.COPING), k1 = lat(q, sgn, R.COPING);
        const n0 = lat(a, sgn, R.COPING + R.BANK), n1 = lat(q, sgn, R.COPING + R.BANK);
        /* the −1 side's "outward" is the more NEGATIVE lateral offset, so the
           ring is walked the other way round and the quad order must flip —
           otherwise half of every band faces the ground */
        const band = (A, i0, i1, o0, o1, y) => {
          const v = [V(o0[0], y, o0[1]), V(o1[0], y, o1[1]), V(i1[0], y, i1[1]), V(i0[0], y, i0[1])];
          quad(A, ...(sgn > 0 ? v : [v[3], v[2], v[1], v[0]]));
        };
        band(K, e0, e1, k0, k1, R.COPE_Y);
        band(S, k0, k1, n0, n1, R.DECK_Y);
        quad(B, skirtV(e0[0], R.COPE_Y, e0[1], 0), skirtV(e1[0], R.COPE_Y, e1[1], 0),
                skirtV(e1[0], -R.DEPTH * .45, e1[1], .12), skirtV(e0[0], -R.DEPTH * .45, e0[1], .12));
      }
    }
  }

  /* ── 3 · the pale walking paths ───────────────────────────────────────── */
  for (const ctrl of R.PATHS) {
    const pts = centreline(ctrl.map(([x, z]) => [x, z, R.PATH_W]), 2.4);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], q = pts[i + 1];
      const A = lat(a, 1), Bp = lat(q, 1), Cp = lat(q, -1), D = lat(a, -1);
      quad(P, V(A[0], R.PATH_Y, A[1]), V(Bp[0], R.PATH_Y, Bp[1]),
              V(Cp[0], R.PATH_Y, Cp[1]), V(D[0], R.PATH_Y, D[1]));
    }
  }

  for (const [a, m, n] of [[W, waterM, 'river:water'], [S, sandM, 'river:sand'],
                           [K, copeM, 'river:coping'], [B, skirtM, 'river:skirt'],
                           [P, pathM, 'river:paths']]) {
    const mesh = bake(a, m, n);
    if (mesh) g.add(mesh);
  }

  const islandShrubs = buildRiverIslands(G, g, basins, R, L);
  /* THE RESORT POOL COMPLEX PASS (2026-08-04) — three new objects inside the
     lagoon's EXISTING footprint. They sit between the islands and the dressing
     because they must be built before the dressing's palm/shrub scatter reads
     G.colliders, and because they draw NO rnd() of their own: both seeded
     streams either side of them are untouched. */
  const bLag = basins.find(b => b.key === 'lagoon');
  if (bLag) {
    buildLagoonIsle(G, g, bLag, R, L);
    buildLagoonPavilion(G, g, bLag, R, L);
  }
  buildKayak(g, lines, R);
  buildRiverDressing(G, g, basins, R, lines, islandShrubs, inWater);
  buildRiverBridges(g, bridges);
  riverColliders(G, basins, lines, bridges);
  /* An EXACT footprint for the understory cull below — the collider chains are
     a circle approximation tuned for the walker and for nature's palm test,
     and a shrub is small enough to sit in the slack between two of them. */
  riverWater = { basins, lines };
  return g;
}

/* ── ONE broadleaf shade tree ───────────────────────────────────────────────
   Four overlapping crown blobs on a flared trunk. Authored for the beach
   pool's enormous tree (beach-pool-circular.png) and reused verbatim for the
   lagoon's tree island (resort-pool-complex-brief.md §2c), which is the whole
   point of pulling it out of that block: the two trees differ only by their
   T record in site.js and by the ground they stand on.
   ⚠ It draws NO rnd() — the lobes are a fixed table. Both call sites sit
   inside seeded streams that must not shift. */
function shadeTree(g, x, z, baseY, T, crownM) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(T.r * .062, T.r * .125, T.h * .62, 10), MAT.darkWood);
  trunk.position.set(x, baseY + T.h * .31, z);
  g.add(trunk);
  const lobes = [[0, 0, 1.0, .90], [-.42, .30, .74, .78],
                 [.46, -.24, .70, .80], [.10, -.50, .62, .72]];
  for (const [lx, lz, s, ly] of lobes) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(T.r * s, 1), crownM);
    blob.position.set(x + lx * T.r, baseY + T.h * ly, z + lz * T.r);
    blob.scale.y = .62;
    g.add(blob);
  }
}

/* ── islands, the round island bar, the east pool's centre feature ──────── */
function buildRiverIslands(G, g, basins, R, L) {
  const bEast = basins.find(b => b.key === 'east');
  const rnd = mulberry32(SEED + 313);

  /* ONE crown material for BOTH shade trees (it was local to the beach pool's
     block; the lagoon's tree would otherwise have wanted a second copy of the
     material AND a second nightBits closure for the same two hexes) */
  const crownM = new THREE.MeshStandardMaterial({ color: 0x2f6b2b, roughness: .95 });
  nightBits.push(on => crownM.color.setHex(on ? 0x14301a : 0x2f6b2b));

  /* ── THE LAGOON'S TREE ISLAND ────────────────────────────────────────────
     resort-pool-complex-brief.md §2c: "a substantial single-crown shade tree
     … sitting on a small mound that reads as fully surrounded by water on
     every side, casting a long dramatic shadow across the lagoon's surface."
     It used to be a plain green cylinder — a flat disc from the air with no
     silhouette and no shadow, which is delta #2 in the brief. The mound
     stays (it IS the island); what is new is the tree standing on it. */
  const ix = L.cx + L.rx * R.ISLAND.dx, iz = L.cz + L.rz * R.ISLAND.dz;
  const ir = R.ISLAND.r, ih = R.DEPTH + .55;
  const isl = new THREE.Mesh(new THREE.CylinderGeometry(ir, ir * 1.12, ih, 20), MAT.greenery);
  isl.position.set(ix, -R.DEPTH + ih / 2 - .05, iz);
  g.add(isl);
  const islandTopY = -R.DEPTH + ih - .05;          // the mound's own surface
  /* ⚠ OPEN-ENDED, and that is a fix. The coping rim is a LIP round the
     island's waterline, but it was a closed cylinder whose top cap (r + .16,
     y .51, MAT.coping = 0x24282a) sat 10 mm ABOVE the mound's own surface —
     so from the air the "planted island" was a black disc with a green rim,
     which is most of why it did not read as an island at all. */
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(ir + .16, ir + .16, .22, 20, 1, true), MAT.coping);
  rim.position.set(ix, .40, iz);
  g.add(rim);
  shadeTree(g, ix, iz, islandTopY, R.ISLAND.TREE, crownM);
  G.colliders.push(worldCollider(ix, iz, ir + .4));

  /* the east pool's central round feature — a raised dark-timber drum ringed
     in pale stone, which is what the aerial shows sitting in that circle */
  const er = R.EAST.islandR, eh = R.DEPTH + .9;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(er, er * 1.06, eh, 24), MAT.darkWood);
  drum.position.set(bEast.cx, -R.DEPTH + eh / 2 - .05, bEast.cz);
  g.add(drum);
  const drumTop = new THREE.Mesh(new THREE.CylinderGeometry(er + .3, er + .3, .18, 24), MAT.coping);
  drumTop.position.set(bEast.cx, .84, bEast.cz);
  g.add(drumTop);
  G.colliders.push(worldCollider(bEast.cx, bEast.cz, er + .6));

  /* the second round pool's island: a smaller dark drum, same idea */
  const bE2 = basins.find(b => b.key === 'east2');
  if (bE2) {
    const r2 = R.EAST2.islandR, h2 = R.DEPTH + .7;
    const d2 = new THREE.Mesh(new THREE.CylinderGeometry(r2, r2 * 1.06, h2, 18), MAT.darkWood);
    d2.position.set(bE2.cx, -R.DEPTH + h2 / 2 - .05, bE2.cz);
    g.add(d2);
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(r2 + .26, r2 + .26, .16, 18), MAT.coping);
    t2.position.set(bE2.cx, .64, bE2.cz);
    g.add(t2);
    G.colliders.push(worldCollider(bE2.cx, bE2.cz, r2 + .5));
  }

  /* ── THE BIG SHADE TREE on the beach pool's north-west rim ────────────────
     beach-pool-circular.png is dominated by one enormous broadleaf whose crown
     hangs over the deck and half the umbrellas — it is the second thing you see
     after the rings. Everything else out here is a palm, so this is built
     explicitly rather than left to nature.js's scatter: four overlapping
     crown blobs on a flared trunk, ~9 m to the canopy. */
  {
    const T = R.WEST.TREE;
    const tx = R.WEST.cx + T.dx * R.WEST.r, tz = R.WEST.cz + T.dz * R.WEST.r;
    /* the trunk's radii used to be typed 0.52 / 1.05 here — at T.r 8.4 those
       are exactly r × .062 and r × .125, which is what shadeTree() derives, so
       this tree is geometrically unchanged and the lagoon's is its scale model */
    shadeTree(g, tx, tz, 0, T, crownM);
    G.colliders.push(worldCollider(tx, tz, 1.5));
  }

  /* the round island bar on the beach pool's south-west rim: a sand terrace, a
     dark timber counter and a low conical roof on four posts. Its soffit is
     the river's one warm light at night. */
  const BA = R.BAR;
  const terr = new THREE.Mesh(new THREE.CylinderGeometry(BA.r, BA.r + .25, .42, 26), MAT.sandM);
  terr.position.set(BA.cx, .21, BA.cz);
  g.add(terr);
  const counter = new THREE.Mesh(
    new THREE.CylinderGeometry(BA.r * .58, BA.r * .58, 1.1, 20, 1, true), MAT.darkWood);
  counter.position.set(BA.cx, .97, BA.cz);
  g.add(counter);
  const roofM = new THREE.MeshStandardMaterial({ color: 0x7a5637, roughness: .93 });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(BA.r * .95, 1.5, 14), roofM);
  roof.position.set(BA.cx, BA.h + .4, BA.cz);
  g.add(roof);
  const soffitM = new THREE.MeshStandardMaterial({
    color: 0x6b4a30, roughness: .9, side: THREE.DoubleSide,
    emissive: RC.lampWarm, emissiveIntensity: 0,
  });
  const soffit = new THREE.Mesh(new THREE.CircleGeometry(BA.r * .9, 14), soffitM);
  soffit.rotation.x = Math.PI / 2;
  soffit.position.set(BA.cx, BA.h - .32, BA.cz);
  g.add(soffit);
  nightBits.push(on => { soffitM.emissiveIntensity = on ? 1.6 : 0; });
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + .4;
    box(g, .14, BA.h - .3, .14,
      BA.cx + Math.cos(a) * BA.r * .78, (BA.h - .3) / 2 + .4,
      BA.cz + Math.sin(a) * BA.r * .78, MAT.darkWood);
  }
  G.colliders.push(worldCollider(BA.cx, BA.cz, BA.r + .3));

  /* planting for the island, handed to the shared instanced bucket below */
  const out = [];
  for (let k = 0; k < 8; k++) {
    const a = rnd() * TAU, d = rnd() * ir * .7;
    out.push([ix + Math.cos(a) * d, iz + Math.sin(a) * d, 1.1 + rnd() * 1.3, .5 + rnd() * .28]);
  }
  return out;
}

/* ── one unit-box InstancedMesh per material ────────────────────────────────
   buildRiverBridges' trick, generalised: a BoxGeometry(1,1,1) carrying a
   per-instance scale is every rectangular member on a structure — deck, post,
   batten, bed, pillow — for ONE draw call per material. `place` takes WORLD
   position, WORLD yaw and the three extents. */
function boxBucket() {
  const list = [];
  return {
    push: (x, y, z, sx, sy, sz, yaw = 0) => list.push([x, y, z, sx, sy, sz, yaw]),
    bake(g, mat, name) {
      if (!list.length) return null;
      const d = new THREE.Object3D();
      const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
      list.forEach(([x, y, z, sx, sy, sz, yaw], i) => {
        d.position.set(x, y, z); d.rotation.set(0, yaw, 0); d.scale.set(sx, sy, sz);
        d.updateMatrix(); m.setMatrixAt(i, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.name = name;
      g.add(m);
      return m;
    },
  };
}

/* ═════════════ THE GRASS ISLET AND ITS CABANA RING (SITE.LAGOON.ISLE) ══════
   reference/resort-pool-complex-brief.md §2d + §2e, delta #3 and #4 — the
   single most legible feature in the aerial and the reason the basin reads
   empty in the middle without it. A round grass islet with a ring path,
   surrounded by seven cabanas, each on its own timber deck jutting into the
   water, in the TWO styles the photographs actually show:

     'pav'  the timber-framed pavilion — vertical batten side walls on three
            sides, open front, on posts, under the WHITE PEAKED roof the
            aerial shows ringing this islet (§2e far-bank type A + the aerial)
     'pod'  the dark woven-rattan dome on its arched frame with a white
            cushioned daybed inside — the near/foreground type, which
            resort-pool-cabana-view.webp is taken from INSIDE (§2e)

   Every number is SITE.LAGOON.ISLE's, scaled to the BUILT 39 × 31 m basin and
   not to the real assembly — see the site.js note; at reality's 20–28 m this
   ring alone would be two thirds of our water.

   ⚠ It draws no rnd(). It is called between buildRiverIslands and
   buildRiverDressing, which own two different seeded streams, and a draw here
   would shift neither — but the ring is regular in the photograph anyway. */
function buildLagoonIsle(G, g, b, R, L) {
  const I = L.ISLE;
  const cx = L.cx + L.rx * I.dx, cz = L.cz + L.rz * I.dz;

  /* the islet itself: the same mound section the tree island uses, so the two
     read as one family of object and sit at exactly the same height */
  const ih = R.DEPTH + .47;
  const topY = -R.DEPTH + ih - .05;            // = .42, the grass surface
  const mound = new THREE.Mesh(new THREE.CylinderGeometry(I.r, I.r * 1.10, ih, 28), MAT.greenery);
  mound.position.set(cx, -R.DEPTH + ih / 2 - .05, cz);
  g.add(mound);

  /* mown grass on top, brighter than the mound's flank — from the air this
     disc IS the feature, and MAT.greenery alone reads as another shrub */
  /* ⚠ the tint is a LIFT on turfCanvas's own #4a7539, not a colour: a
     mid-green multiplied by a mid-green is nearly black, which is what
     0x86ad5e gave on the first pass */
  const grassM = new THREE.MeshStandardMaterial({ map: turf(3, 3), color: 0xd6e6b0, roughness: .95 });
  nightBits.push(on => grassM.color.setHex(on ? 0x53663f : 0xd6e6b0));
  const grass = new THREE.Mesh(new THREE.CircleGeometry(I.r - I.path, 28), grassM);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, topY + .012, cz);
  g.add(grass);

  /* the ring path round its edge (§2d) — an annulus, not a disc, so the grass
     shows through the middle */
  const pathM = new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: .94 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(I.r - I.path, I.r, 28), pathM);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(cx, topY + .014, cz);
  g.add(ring);

  /* the dark coping lip at the water line, exactly the tree island's */
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(I.r + .16, I.r + .16, .22, 28, 1, true), MAT.coping);
  rim.position.set(cx, .40, cz);
  g.add(rim);

  const timberB = boxBucket(), whiteB = boxBucket(), rattanB = boxBucket();
  const roofs = [], domes = [];

  /* the deck bridges the islet's edge to open water: its depth is DERIVED as
     twice the gap between the islet and the ring, so its inner edge lands
     exactly on the islet however either number moves */
  const deckD = 2 * (I.ringR - I.r);
  const deckY = topY;                          // decks flush with the grass

  I.styles.forEach((style, i) => {
    const th = (i + .5) / I.styles.length * TAU;
    const ax = cx + Math.cos(th) * I.ringR, az = cz + Math.sin(th) * I.ringR;
    /* three's Y-rotation sends local +Z to (sin yaw, cos yaw); we want local
       +Z to point OUTWARD, i.e. along (cos th, sin th) — so yaw = π/2 − th.
       Everything below is authored in that local frame and pushed through F. */
    const yaw = Math.PI / 2 - th;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const F = (lx, lz) => [ax + lx * cy + lz * sy, az - lx * sy + lz * cy];

    const put = (bucket, lx, ly, lz, sx, sh, sz) => {
      const [x, z] = F(lx, lz);
      bucket.push(x, ly, z, sx, sh, sz, yaw);
    };

    put(timberB, 0, deckY - .06, 0, I.cab, .12, deckD);          // the deck slab
    const W = I.cab * .5;

    if (style === 'pav') {
      const PH = 2.45;                                            // eaves height
      for (const sx of [-1, 1]) for (const sz of [-1, 1])
        put(timberB, sx * W * .88, deckY + PH / 2, sz * deckD * .36, .13, PH, .13);
      /* vertical battens: SEVEN per side wall, three walls (§2e "vertical
         batten/slat side walls on three sides, open front"). Four read as a
         row of posts at this distance; the pitch has to be tighter than the
         batten is wide before the eye calls it a slatted wall. */
      const NB = 7;
      for (const sx of [-1, 1]) for (let k = 0; k < NB; k++)
        put(timberB, sx * W * .90, deckY + .90, (k / (NB - 1) - .90) * deckD * .62, .055, 1.45, .13);
      for (let k = 0; k < NB; k++)
        put(timberB, (k / (NB - 1) - .5) * I.cab * .80, deckY + .90, -deckD * .34, .13, 1.45, .055);
      /* one lounger inside, facing the open front */
      put(whiteB, 0, deckY + .27, deckD * .16, .70, .16, 1.90);
      roofs.push({ x: ax, y: deckY + PH + .58, z: az, r: I.cab * .82, h: 1.15, yaw });
    } else {
      /* the rattan pod: a dome on an arched frame over a white daybed */
      domes.push({ x: ax, y: deckY + .06, z: az, r: I.cab * .50, h: I.cab * .62, yaw });
      put(whiteB, 0, deckY + .26, 0, I.cab * .72, .34, I.cab * .58);      // the bed
      for (const sx of [-1, 1])
        put(whiteB, sx * I.cab * .18, deckY + .52, -I.cab * .18, .52, .18, .34);  // pillows
      /* a low rattan kerb round the pod's foot, which is what the arched
         wicker frame reads as from anywhere but inside it */
      put(rattanB, 0, deckY + .10, -I.cab * .30, I.cab * .78, .20, .10);
    }
  });

  timberB.bake(g, MAT.timberDeck, 'lagoon-isle:timber');
  whiteB.bake(g, MAT.white, 'lagoon-isle:cushions');

  /* the woven rattan reads DARK in resort-pool-cabana-view.webp, but the first
     value (0x241a13) rendered as an opaque black egg from the air — the photo
     is taken from inside the pod, where the weave is backlit, and none of that
     survives at 60 m up. 0x4a3626 keeps it the darkest object on the islet
     while still showing its own form. */
  const rattanM = new THREE.MeshStandardMaterial({
    color: 0x4a3626, roughness: .88, metalness: 0, side: THREE.DoubleSide });
  nightBits.push(on => rattanM.color.setHex(on ? 0x1d1510 : 0x4a3626));
  rattanB.bake(g, rattanM, 'lagoon-isle:rattan');

  const dummy = new THREE.Object3D();
  if (roofs.length) {
    /* a four-sided cone IS a pyramid; turned 45° its faces square up with the
       deck below, which is what makes it read as a peaked canvas roof rather
       than as a cone */
    const rm = new THREE.InstancedMesh(
      new THREE.ConeGeometry(1, 1, 4), MAT.whiteFrame, roofs.length);
    roofs.forEach((r, i) => {
      dummy.position.set(r.x, r.y, r.z);
      dummy.rotation.set(0, r.yaw + Math.PI / 4, 0);
      dummy.scale.set(r.r, r.h, r.r);
      dummy.updateMatrix(); rm.setMatrixAt(i, dummy.matrix);
    });
    rm.instanceMatrix.needsUpdate = true; rm.computeBoundingSphere();
    rm.name = 'lagoon-isle:roofs';
    g.add(rm);
  }
  if (domes.length) {
    /* SphereGeometry's phi is measured from −X, so phi = π/2 is +Z: opening
       the sweep at π/2 + gap/2 leaves the missing wedge centred on local +Z,
       which is the side facing the water. Getting this wrong faces every pod
       at the grass. */
    const GAP = 1.55;
    const dm = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 16, 9, Math.PI / 2 + GAP / 2, TAU - GAP, 0, Math.PI * .5),
      rattanM, domes.length);
    domes.forEach((o, i) => {
      dummy.position.set(o.x, o.y, o.z);
      dummy.rotation.set(0, o.yaw, 0);
      dummy.scale.set(o.r, o.h, o.r);
      dummy.updateMatrix(); dm.setMatrixAt(i, dummy.matrix);
    });
    dm.instanceMatrix.needsUpdate = true; dm.computeBoundingSphere();
    dm.name = 'lagoon-isle:pods';
    g.add(dm);
  }

  /* one collider for the whole assembly. It stands in open water that the
     basin's own interior fill already blocks, so this is for nature.js's palm
     test — a crown planted on the islet would hang over every cabana. */
  G.colliders.push(worldCollider(cx, cz, I.ringR + I.cab * .5));
  /* the mound's own planting, handed to the shared instanced bucket */
  return { cx, cz, r: I.r };
}

/* ═════════════ THE SPOKED PAVILION (SITE.LAGOON.PAVILION) ═════════════════
   §2f, delta #5 — "a standalone circular structure on a small deck at the
   water's edge … white ribs radiating from a central point like an umbrella,
   panels between the ribs taut fabric or open lattice". A hero object: one of
   them, no instancing needed for the whole thing, only for its own ribs and
   posts. Sized and placed entirely from SITE.LAGOON.PAVILION. */
function buildLagoonPavilion(G, g, b, R, L) {
  const P = L.PAVILION;
  const [px, pz] = b.at(P.th, 0);              // centred ON the water line
  const deckY = .42;                           // the isle decks' height
  const apexY = deckY + P.h;

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(P.r, P.r * 1.02, .24, 26), MAT.timberDeck);
  deck.position.set(px, deckY - .12, pz);
  g.add(deck);

  const fabricM = new THREE.MeshStandardMaterial({
    color: 0xe4dfd1, roughness: .78, metalness: 0, side: THREE.DoubleSide });
  nightBits.push(on => {
    /* the roof is the object's whole silhouette; at night it keeps a soft
       warm wash off the lamps rather than going black, the same treatment the
       island bar's soffit gets */
    fabricM.emissive.copy(RC.lampWarm);
    fabricM.emissiveIntensity = on ? .16 : 0;
  });

  /* the taut fabric between the ribs: an open cone with exactly `ribs` radial
     segments, so every facet lands between two ribs */
  const CONE_H = P.h * .46;
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(P.r, CONE_H, P.ribs, 1, true), fabricM);
  cone.position.set(px, apexY - CONE_H / 2, pz);
  g.add(cone);

  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(.13, .17, P.h - CONE_H + .3, 10), MAT.whiteFrame);
  column.position.set(px, deckY + (P.h - CONE_H + .3) / 2, pz);
  g.add(column);

  /* the ribs. Aimed with Object3D.lookAt rather than by composing an XYZ
     Euler — the same class of bug the chandelier poles hit: a Z-rotation
     composed with a Y-rotation through one Euler bends the member sideways
     instead of tipping it. lookAt orients local +Z at the target, so the rib
     is a unit box scaled on Z alone. */
  const dummy = new THREE.Object3D();
  const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.whiteFrame, P.ribs);
  const rimY = apexY - CONE_H;
  /* ⚠ the ribs must stand PROUD of the fabric. A rib drawn from the apex to a
     rim point lies exactly ON the cone's surface — it is the same straight
     line — so the first version z-fought with the panel it was supposed to
     stand on and the pavilion read as a plain white umbrella with no spokes at
     all. 60 mm of lift, radially and vertically, is enough at any distance
     this object is ever seen from. */
  const LIFT = .06;
  for (let i = 0; i < P.ribs; i++) {
    const a = i / P.ribs * TAU;
    const rx = px + Math.cos(a) * (P.r + LIFT), rz = pz + Math.sin(a) * (P.r + LIFT);
    const ay = apexY + LIFT, ry = rimY + LIFT;
    const mx = (px + rx) / 2, mz = (pz + rz) / 2, my = (ay + ry) / 2;
    dummy.position.set(mx, my, mz);
    dummy.scale.set(1, 1, 1);
    dummy.lookAt(rx, ry, rz);
    dummy.scale.set(.085, .085, Math.hypot(P.r + LIFT, CONE_H));
    dummy.updateMatrix(); ribs.setMatrixAt(i, dummy.matrix);
  }
  ribs.instanceMatrix.needsUpdate = true; ribs.computeBoundingSphere();
  ribs.name = 'lagoon-pavilion:ribs';
  g.add(ribs);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(P.r, .065, 6, 30), MAT.whiteFrame);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(px, rimY, pz);
  g.add(rim);

  const posts = boxBucket();
  for (let i = 0; i < 6; i++) {
    const a = (i + .5) / 6 * TAU;
    posts.push(px + Math.cos(a) * P.r * .94, deckY + (rimY - deckY) / 2,
      pz + Math.sin(a) * P.r * .94, .10, rimY - deckY, .10, -a);
  }
  posts.bake(g, MAT.whiteFrame, 'lagoon-pavilion:posts');

  /* ONE collider for the whole object, exactly what the island bar at
     SITE.RIVER.BAR already does — the pavilion is a solid to walk around, and
     a collider that is stricter than the geometry is the house rule. Its
     inner half is already inside the basin's own rim chain. */
  G.colliders.push(worldCollider(px, pz, P.r + .3));
  return { x: px, z: pz };
}

/* ═════════════ THE KAYAK (SITE.RIVER.KAYAK) ═══════════════════════════════
   Carl, with resort-kayak-channel.webp: *"the main water feature real life
   picture looks like this for kayak to pass by."* Resolved against the
   centreline, never typed, so it cannot drift off the water — and see the
   site.js note for why the channel around it was measured and NOT widened. */
function buildKayak(g, lines, R) {
  const K = R.KAYAK;
  const pts = lines[K.which];
  const s = pts[Math.round(K.t * (pts.length - 1))];
  /* three's Y-rotation sends local +Z to (sin yaw, cos yaw); the channel runs
     along (tx, tz), so the hull points down it */
  const yaw = Math.atan2(s.tx, s.tz);
  const k = new THREE.Group();
  k.name = 'river:kayak';
  k.position.set(s.x, R.WATER_Y, s.z);
  k.rotation.y = yaw;
  g.add(k);

  const trimM = new THREE.MeshStandardMaterial({ color: 0x1f6fae, roughness: .42, metalness: .05 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xc98f63, roughness: .8 });

  /* `kayak` — white lofted hull, blue moulded deck, a dished seat well with a
     proud coaming, forward hatch, carry toggles and the paddle across the
     deck, in one mesh.
     ⚠ ITS ORIGIN IS THE KEEL, not the waterline, so the drop-in sits at
     −0.24 inside this group (which is already at R.WATER_Y) — that is the
     0.24 m of draught the sphere hull carried as `keel .24 below the water
     line`. Its front is +Z = the BOW and `k.rotation.y = yaw` already runs
     local +Z down the channel, so there is no extra rotation here.
     The PADDLER is not in the GLB and stays a game object, below. */
  if (have('kayak')) {
    const hull = mdl('kayak');
    hull.position.y = -0.24;
    k.add(hull);
  } else {
    const hullM = new THREE.MeshStandardMaterial({ color: 0xf0f2f2, roughness: .38, metalness: .05 });
    /* the hull is a scaled sphere sunk to its own waterline — the photograph is
       straight down, so the plan silhouette is the whole read */
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 9), hullM);
    hull.scale.set(K.beam / 2, .30, K.len / 2);
    hull.position.y = .06;
    k.add(hull);
    /* the two-tone deck: the reference kayak is white below and blue on top */
    const top = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 6, 0, TAU, 0, Math.PI * .42), trimM);
    top.scale.set(K.beam / 2 * .93, .16, K.len / 2 * .95);
    top.position.y = .16;
    k.add(top);
    /* the cockpit, a dark well the paddler sits in */
    const well = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .10, 14), MAT.darkWood);
    well.scale.set(K.beam * .34, 1, K.len * .17);
    well.position.set(0, .21, -K.len * .06);
    k.add(well);
    /* the paddle across the coaming, blades outboard both sides */
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(2.05, .045, .045), MAT.darkWood);
    paddle.position.set(0, .42, K.len * .02);
    paddle.rotation.y = .22;
    k.add(paddle);
    const blades = boxBucket();
    for (const sgn of [-1, 1])
      blades.push(sgn * Math.cos(.22) * .92, .42, -sgn * Math.sin(.22) * .92, .17, .035, .46, .22);
    blades.bake(k, trimM, 'river:kayak-blades');
  }

  /* the paddler — lying back, as in the photograph. A game object in BOTH
     paths: the GLB is the boat, never the person in it. */
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.19, .52, 4, 8), trimM);
  torso.rotation.x = Math.PI * .38;
  torso.position.set(0, .38, -K.len * .10);
  k.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.115, 10, 7), skinM);
  head.position.set(0, .56, -K.len * .22);
  k.add(head);

  return k;
}

/* ── instanced dressing ─────────────────────────────────────────────────────
   Every repeated object in the river is an InstancedMesh. The old lagoon spent
   ~75 draw calls on ten umbrellas and five loungers cloned as Groups; the
   whole population here — 24 umbrellas, 28 loungers, ~150 planting clumps and
   22 path lanterns — costs seven. */
function buildRiverDressing(G, g, basins, R, lines, islandShrubs, inWater) {
  const rnd = mulberry32(SEED + 771);
  const umbs = [], loungers = [], shrubs = [], lamps = [];

  const byKey = k => basins.find(b => b.key === k);
  const bWest = byKey('west'), bMid = byKey('mid'), bLag = byKey('lagoon'), bEast = byKey('east');

  /* umbrellas + loungers ring the big decks, set out on the sand.
     ⚠ The BEACH POOL's are WHITE, and go in their own list: in
     beach-pool-circular.png that pool is ringed with white umbrellas and white
     loungers, while the rest of the resort's water is under the Westin's blue
     ones. One shared blue bucket is what the first pass had, and it made the
     pool Carl asked for look like every other basin from the air. */
  const whiteUmbs = [];
  for (const [b, n, white] of [[bWest, R.WEST.umbrellas, true],
                               [bLag, SITE.LAGOON.umbrellas, false],
                               [bEast, R.EAST.umbrellas, false],
                               [byKey('east2'), SITE.RIVER.EAST2.umbrellas, false],
                               ...SITE.HOTEL_POOLS.map((p, i) => [byKey('hotel' + i), p.umbrellas, false])]) {
    if (!b) continue;
    for (let i = 0; i < n; i++) {
      /* UMB_PHASE, not a literal .35 — campus.js placed the swim-up bar in the
         gap between two of THESE umbrellas and swimMouth() re-derives the same
         bearing, so the three must read one number. Same value as before. */
      const th = (i + UMB_PHASE) / n * TAU;
      const [ux, uz] = b.at(th, R.COPING + b.deck * .58);
      (white ? whiteUmbs : umbs).push([ux, uz, rnd() * TAU]);
      for (const k of [-.28, .28]) {
        const [lx, lz] = b.at(th + k / n, R.COPING + b.deck * .24);
        loungers.push([lx, lz, Math.atan2(b.cx - lx, b.cz - lz)]);
      }
    }
  }
  for (let i = 0; i < 4; i++) {                        // the little mid-river basin
    const th = (i + .5) / 4 * TAU;
    const [lx, lz] = bMid.at(th, R.COPING + bMid.deck * .45);
    loungers.push([lx, lz, Math.atan2(bMid.cx - lx, bMid.cz - lz)]);
  }

  /* planting: clumps pressed right up against both banks of both channels and
     scattered around every deck. The reference threads the whole river
     through dense low greenery, and from 60 m up this is what carries it —
     nature.js's palm scatter is campus-wide and far too thin on its own. */
  for (const key of ['spine', 'spur']) {
    const pts = lines[key];
    /* same width rule as the bank palms below: the wide connecting reach gets
       its clumps every 4th point rather than every 2nd, so the water is edged
       rather than buried */
    for (let i = 2; i < pts.length - 2; i += (pts[i].hw > 1.55 ? 4 : 2)) {
      const s = pts[i];
      for (const sgn of [1, -1]) {
        /* the three rnd() calls stay unconditional (nature.js's pattern) so
           rejecting a clump never shifts the seeded sequence for the rest */
        const skip = rnd() < .34, off = R.COPING + R.BANK + 1.5 + rnd() * 3.2;
        const sc = 1.1 + rnd() * 1.6;
        const [x, z] = lat(s, sgn, off);
        /* a tight meander puts the outside of one bend on the inside of the
           next, so a bank clump can land in the water two loops downstream */
        if (skip || inWater(x, z)) continue;
        shrubs.push([x, z, sc, .42 + rnd() * .28]);
      }
    }
  }
  for (const b of basins) {
    const n = Math.round(b.rm * 2.4);
    for (let i = 0; i < n; i++) {
      const [x, z] = b.at(rnd() * TAU, R.COPING + b.deck + .8 + rnd() * 4.2);
      const sc = 1.1 + rnd() * 1.8, sy = .42 + rnd() * .28;
      if (inWater(x, z)) continue;          // the basins sit close together
      shrubs.push([x, z, sc, sy]);
    }
  }
  for (const s of islandShrubs) shrubs.push(s);

  /* ── PALMS OVER THE CHANNEL ────────────────────────────────────────────────
     "palm crowns overhanging it from both sides." That is the other half of
     narrowing the river: in lazy-river-closeup.png you barely see the water for
     fronds, and a 2.6 m channel with nothing over it reads as a drainage ditch
     from the air, not as a lazy river.

     nature.js's own scatter cannot do this — it plants against G.colliders, and
     every collider on this channel exists precisely to keep planting clear of
     the water. So the river names the positions and nature.js plants them:
     requestPalms() hands back the REAL coconut palm (tapering ring-scarred
     trunk, a full crown of arching, drooping fronds, coconuts) in nature's own
     instanced buckets, which is why this whole 150 m fringe costs zero draw
     calls. It used to build its own — a bare 6-sided pole under nine flat
     boxes — and from the air the river read as a cheaper resort than the ground
     either side of it (Carl, 2026-08-02: "these trees are very very low
     fidelity compared to the other trees").

     Sampled every THIRD centreline point rather than every fourth. The old
     flat-box crown was a ~2.5 m star and 35 of them still left long naked
     runs; nature's crown is a real 4–5 m one and closing the canopy is the
     stated intent (lazy-river-closeup.png), so the extra dozen palms are the
     point rather than a cost — they are instances in a bucket that already
     exists, i.e. no draw call and ~300 triangles each.

     ⚠ The three rnd() draws per candidate are unconditional (nature.js's
     pattern) so a rejected candidate never shifts the stream for the rest. */
  /* ⚠ THE SAMPLING STEP IS NOW A FUNCTION OF THE CHANNEL'S WIDTH (2026-08-02,
     the proportion pass). Every third point at a 1.6 m resample is a palm every
     ~2.9 m of bank, which closes the canopy over a 2.6 m channel — right, and
     the whole point where the reference photograph applies. The proportion pass
     added a 140 m WEST REACH carrying the eye from the beach pool to the rest
     of the resort, and widened it to 2.5…4.3 m to do that job. At the old
     density the same canopy simply covered it: in the first top-down of this
     pass the connection Carl had asked for read as a hedge, not as water. Two
     rows of palms cannot close a 4 m channel anyway, so the step opens to every
     fifth point wherever the water is wider than 3.1 m. The narrow east half is
     sampled exactly as before, to the palm. */
  const bankPalms = [];
  for (const key of ['spine', 'spur']) {
    const pts = lines[key];
    for (let i = 3; i < pts.length - 3; i += (pts[i].hw > 1.55 ? 5 : 3)) {
      const s = pts[i];
      for (const sgn of [1, -1]) {
        const keep = rnd() < .82, off = R.COPING + R.BANK + .9 + rnd() * 1.5;
        const h = 6.4 + rnd() * 3.4, lean = (rnd() - .5) * .30;
        const [x, z] = lat(s, sgn, off);
        if (!keep || inWater(x, z)) continue;
        /* lean BACK over the water: `sgn` is the bank it stands on, so the
           channel is at −normal from here. A real coconut leans out over open
           water and that is what closes the canopy across a 2.6 m channel. */
        bankPalms.push({
          x, z, h,
          dir: [-s.nx * sgn, -s.nz * sgn],
          tilt: .06 + Math.abs(lean) * .30,
          /* no collider: these stand within a metre or two of the channel,
             whose bank chain already blocks the walker, and the towpath and
             the five footbridges run through this same strip. 35 new trunk
             circles there would only pinch a route the river just opened. */
          collide: false,
        });
      }
    }
  }
  requestPalms(bankPalms);

  /* path lanterns — the river's night silhouette from the air */
  const pPts = centreline(R.PATHS[0].map(([x, z]) => [x, z, R.PATH_W]), 2.4);
  for (let i = 0; i < R.LAMPS; i++) {
    const s = pPts[Math.round((i + .5) / R.LAMPS * (pPts.length - 1))];
    const [x, z] = lat(s, i % 2 ? 1 : -1, .8);
    lamps.push([x, z]);
  }

  const dummy = new THREE.Object3D();
  const inst = (geo, mat, list, place) => {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    for (let i = 0; i < list.length; i++) {
      dummy.position.set(0, 0, 0); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      place(i, dummy);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    g.add(m);
    return m;
  };

  /* the parasols — `pool_umbrella` + `pool_umbrella_canopy` (KAN-207 Group E).
     Both halves stand on the floor at the pole foot, so the placement is the
     ground, not the old cones' mid-heights.
     ⚠ THE WHITE RUN IS A WIDER CANOPY ON THE SAME POLE, not a bigger parasol:
     the code gives both runs the identical .05/.06 × 2.5 mast and only the
     cone grows, 1.55 → 1.70, with the rim staying at 2.20. So the white
     canopy is scaled 1.10 in X and Z and left alone in Y — a uniform 1.10
     would lift the rim to 2.42 and change the height a guest's head clears,
     which the envelope rule forbids.
     The canopy's material is a per-COLOUR clone of the white `canopy_tint`
     bake (blue 2b7fc4 for the lagoon, whiteFrame for the beach). */
  if (have('pool_umbrella') && have('pool_umbrella_canopy')) {
    const uGeo = models.geometry('pool_umbrella'), uMat = models.material('pool_umbrella');
    const cGeo = models.geometry('pool_umbrella_canopy');
    const foot = (list) => (i, d) => {
      d.position.set(list[i][0], 0, list[i][1]);
      d.rotation.y = list[i][2];
    };
    inst(uGeo, uMat, umbs, foot(umbs));
    inst(cGeo, tintedMat('pool_umbrella_canopy', C.blue), umbs, foot(umbs));
    inst(uGeo, uMat, whiteUmbs, foot(whiteUmbs));
    inst(cGeo, tintedMat('pool_umbrella_canopy', MAT.whiteFrame.color.getHex()),
      whiteUmbs, (i, d) => { foot(whiteUmbs)(i, d); d.scale.set(1.10, 1, 1.10); });
  } else {
    inst(new THREE.CylinderGeometry(.05, .06, 2.5, 6), MAT.white, umbs,
      (i, d) => d.position.set(umbs[i][0], 1.25, umbs[i][1]));
    inst(new THREE.ConeGeometry(1.55, .44, 8), MAT.blue, umbs, (i, d) => {
      d.position.set(umbs[i][0], 2.42, umbs[i][1]);
      d.rotation.y = umbs[i][2];
    });
    inst(new THREE.CylinderGeometry(.05, .06, 2.5, 6), MAT.white, whiteUmbs,
      (i, d) => d.position.set(whiteUmbs[i][0], 1.25, whiteUmbs[i][1]));
    inst(new THREE.ConeGeometry(1.7, .48, 8), MAT.whiteFrame, whiteUmbs, (i, d) => {
      d.position.set(whiteUmbs[i][0], 2.44, whiteUmbs[i][1]);
      d.rotation.y = whiteUmbs[i][2];
    });
  }

  /* a lounger is one raked slab. At 60 m up that is exactly as much lounger as
     reads; the enclave's own deck has the modelled ones. */
  inst(new THREE.BoxGeometry(.68, .14, 1.95), MAT.white, loungers, (i, d) => {
    d.position.set(loungers[i][0], .36, loungers[i][1]);
    d.rotation.set(-.16, loungers[i][2], 0);
  });

  /* Planting gets its OWN material so it can carry per-instance colour.
     `instanceColor` compiles USE_INSTANCING_COLOR into the material's program,
     so it must never be set on a material a non-instanced mesh also uses —
     MAT.greenery is shared, this one is not. */
  const plantM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, metalness: 0 });
  /* Detail-1 icosahedron (80 tris). This is over half the river's triangle
     budget and a 6×4 sphere would be 36 — but a 6-segment sphere seen from
     STRAIGHT ABOVE is a hexagon, and the whole point of this planting is the
     plan view. Trim the count before you trim the mesh. */
  const plantMesh = inst(new THREE.IcosahedronGeometry(1, 1), plantM, shrubs, (i, d) => {
    const [x, z, s, sy] = shrubs[i];
    d.position.set(x, s * sy * .78, z);
    d.rotation.set((i % 5) * .09, i * 1.13, (i % 7) * .07);
    d.scale.set(s, s * sy, s * (.86 + (i % 4) * .07));
  });
  if (plantMesh) {
    /* Explicit sRGB hexes, NOT setHSL. Color.setHSL defaults to the WORKING
       colour space, which is Linear-sRGB — an l of 0.3 there is a mid-bright
       green once it is displayed, and the first pass came out as a field of
       pale mint balls that flattened the whole aerial. `new Color(hex)`
       converts sRGB→linear for us, so these are the greens they look like. */
    const PALETTE = [0x2c5228, 0x37662f, 0x27492a, 0x426f33, 0x1f4526, 0x365e39];
    const col = new THREE.Color();
    for (let i = 0; i < shrubs.length; i++) {
      col.setHex(PALETTE[(rnd() * PALETTE.length) | 0]);
      col.multiplyScalar(.82 + rnd() * .42);
      plantMesh.setColorAt(i, col);
    }
    if (plantMesh.instanceColor) plantMesh.instanceColor.needsUpdate = true;
  }

  /* (the bank palms used to be instanced here — two meshes, a bare pole and a
     star of flat boxes. They are nature.js's coconut palm now; see the
     requestPalms() call above. Their day↔night is nature's MAT.bark / MAT.frond
     through setNatureNight, so nothing about them belongs in `nightBits`.) */

  const lampM = new THREE.MeshStandardMaterial({
    color: 0xf4e6cf, roughness: .5, emissive: RC.lampWarm, emissiveIntensity: 0,
  });
  nightBits.push(on => { lampM.emissiveIntensity = on ? 2.8 : 0; });
  inst(new THREE.CylinderGeometry(.045, .055, 1.0, 5), MAT.stone, lamps,
    (i, d) => d.position.set(lamps[i][0], .5, lamps[i][1]));
  inst(new THREE.SphereGeometry(.17, 6, 5), lampM, lamps,
    (i, d) => d.position.set(lamps[i][0], 1.1, lamps[i][1]));
}

/* ── footbridges: two instanced buckets for the whole set ───────────────── */
function buildRiverBridges(g, bridges) {
  const dummy = new THREE.Object3D();
  const decks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.timberDeck, bridges.length);
  const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.darkWood, bridges.length * 2);
  bridges.forEach((br, i) => {
    /* three's Y-rotation maps local +Z to (sin y, cos y), so this aims the
       deck's long axis along the channel's normal — i.e. across the water */
    const yaw = Math.atan2(br.s.nx, br.s.nz);
    dummy.position.set(br.x, .62, br.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(2.0, .16, br.w);
    dummy.updateMatrix(); decks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 2; k++) {
      const s = k ? .95 : -.95;
      dummy.position.set(br.x + br.s.tx * s, 1.06, br.z + br.s.tz * s);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(.1, .72, br.w);
      dummy.updateMatrix(); rails.setMatrixAt(i * 2 + k, dummy.matrix);
    }
  });
  decks.instanceMatrix.needsUpdate = true; rails.instanceMatrix.needsUpdate = true;
  decks.computeBoundingSphere(); rails.computeBoundingSphere();
  g.add(decks); g.add(rails);
}

/* ── a WORLD-SPACE collider ─────────────────────────────────────────────────
   world.js maps every collider an enclave builder pushed through
   enclaveToWorld(), and it decides which ones BY POSITION ALONE:
   isEnclaveLocal() is essentially `x < 84`. water.js is a MIXED builder — the
   hero pool is enclave, the river is resort backdrop — and the river's west
   pool sits at x ≈ 65, so on the first pass its ~120 colliders were quietly
   teleported into the palm grove at (−92…−68, 87…111): invisible walls on the
   walk to the beach, and NO keep-out left at the pool, which is why nature.js
   was free to plant in it.

   The old SITE.LAGOON never hit this because it began at x = 92. Rather than
   shorten the river back behind that line, these colliders say what they are:
   `x` and `z` are accessors whose setter is a deliberate no-op, so world.js's
   in-place rewrite is a silent, harmless miss. Same intent as the
   `userData.worldSpace` opt-out world.js already honours for late geometry —
   there is just no flag for colliders yet. If one ever lands, delete this and
   set the flag.

   (Pre-compensating instead — pushing worldToEnclave(x, z) so the rewrite maps
   it back — cannot work here: the pre-image of anything east of x = 22 lands
   at z ≤ −80, where isEnclaveLocal is false and the rewrite never fires.) */
function worldCollider(x, z, r, y0, y1) {
  const c = { r };
  if (y0 !== undefined) c.y0 = y0;
  if (y1 !== undefined) c.y1 = y1;
  Object.defineProperty(c, 'x', { get: () => x, set: () => {}, enumerable: true });
  Object.defineProperty(c, 'z', { get: () => z, set: () => {}, enumerable: true });
  return c;
}

/* ═══════════ THE SWIM-UP BAR'S MOUTH — you can swim to it now ══════════════
   Carl's swim-up bar (campus.js § 12, from reference/photos/resort-swim-up-bar.webp)
   stands on the lagoon's north-north-west rim with its counter at the water
   line and five submerged stools in front of it. Until now you could look at
   those stools and never reach them: riverColliders() fills EVERY basin
   interior with a 2.6 m grid of r 2.0 circles, so the water in front of the
   counter was a solid wall. Mapped before the fix, in the bar's own frame, at
   1 m pitch — "#" blocked, "." open:

       v =  +2   .........##..#..##........#      the deck and the bar itself
       v =   0   ###....################.###      the water's edge
       v =  −1   ###########################  ←   every cell, all the way out
       v = −16   ###########################

   ── WHAT IS OPENED — TWO PIECES, AND THE SECOND ONE IS THE HONEST PART ────
   1 · THE POCKET. The interior grid, inside one rectangle of the bar's own
       (u, v) frame: |u| ≤ 7, −11 ≤ v ≤ 0.6. That is the water in front of the
       counter, and clearing it alone was NOT enough — measured.
   2 · TWO CIRCLES OF THE RIM CHAIN, and no more. The rim runs unbroken across
       the bar's whole frontage at ~1.95 m pitch (measured in this frame:
       u = … −3.18, −1.17, +0.85, +2.84, +4.79, +6.74, +8.70 …) and each blocks
       1.95 m, so the pocket was sealed off from the deck by a solid wall. The
       swimmer has to get IN somewhere; a swim-up bar without an entry is the
       bug we were sent to fix, one metre further out.

   So the mouth is ONE DOORWAY, at the west end of the counter. `pickEntry`
   takes the TWO rim circles nearest u = +5.75 — two by count, never by window,
   so the opening's width cannot change if the seeded outline ever reshuffles.
   Their surviving neighbours are 5.99 m apart centre to centre, which leaves
   **2.09 m of clear walking** against the 0.70 m player. Everywhere else on
   the lagoon's ~110 m rim the chain is exactly as it was — verified by walking
   it, not by reading it.

   ⚠ WHY THE DOORWAY IS AT THE COUNTER'S END AND NOT IN FRONT OF IT. In front,
   the bar's own plinth (a solid rectCollider, 7.6 × 3.8) already blocks
   |u| ≤ 4.70, so a gap there would open nothing. At the end, the plinth stops
   and the doorway is real — and it reads as what it is, the steps beside a
   pool bar.

   ⚠ AND THE CIRCLES ARE NOT DELETED — THEY BECOME PHANTOMS. nature.js's
   placePalms() rejects any throw within (collider.r + 1.4) and IGNORES the
   y-range, while updatePlayer skips a collider whose [y0, y1) does not cover
   the walker's feet. So the mouth's circles are re-emitted at feet-height 80 m
   (campus.js's own pattern for the arrival court): the palm scatter still sees
   an unbroken keep-out and cannot plant in the water, the swimmer walks
   through. Delete them instead and the scatter is free to stand a coconut palm
   in the open water in front of the bar — silently, and only visible from the
   air. Because the circles are re-emitted rather than dropped, the collider
   COUNT is unchanged too (10,764 either way), which is what makes the seeded
   planting provably identical: 217 static instance buckets, 0 differing.

   ── NO FALL, AND NO WALK_REGION NEEDED ────────────────────────────────────
   The whole river system is drawn AT GRADE: SITE.RIVER.BASIN_Y is 0.045 and
   the "depth" is a vertex-colour ramp plus a skirt below the coping, not an
   excavation. siteFloorY answers 0.000 across the entire lagoon, so a swimmer
   here wades at feet 0.000 and there is no hole to fall through — which is
   also why the bar's submerged stool line needs no registration. If the basin
   is ever really dug out, THIS is the comment that says the mouth then needs a
   walkable ramp and the stools a standable surface.

   ── THE FRAME IS DERIVED, NOT TYPED ───────────────────────────────────────
   campus.js could not edit site.js when it built the bar, so it placed it from
   published SITE.LAGOON values: the midpoint of the gap between lagoon
   umbrellas 7 and 8, where the umbrella bearings are water.js's OWN rule,
   (i + UMB_PHASE) / n × 2π. We re-derive the identical frame from the identical
   numbers here. That is a duplicated *rule*, but not a duplicated *coordinate*:
   change SITE.LAGOON's size, position or umbrella count, or UMB_PHASE, and the
   bar and this mouth move together, because both are functions of those. */
const SWIM = {
  /* half-width of the mouth along the counter. The plinth is 7.6 m wide and
     its own collider blocks to |u| 4.70, so 7.0 leaves a 2.3 m lane round each
     end of the bar — wide enough for the 0.70 m walker with margin, narrow
     enough that the mouth reads as the bar's own approach and not as an
     opening in the lagoon. */
  U: 7.0,
  /* how far the pocket runs into the water. It does not need to be exact: the
     cabana islet's own keep-out (SITE.LAGOON.ISLE, r ringR + cab/2 = 6.9) sits
     12.3 m from the counter and bounds the swimmable water at ~5 m regardless,
     so this is only the point where the interior grid resumes. Kept at 11 so
     the islet is the bound, not this number — if the islet ever moves, the
     mouth needs no edit. */
  V_IN: -11.0,
  /* the landward limit. +0.6 is past the counter (v −0.1) and into the plinth,
     which keeps its own solid collider — so this bound can never open the bar
     itself, only the water in front of it. */
  V_OUT: 0.6,
  /* the doorway: the TWO rim circles nearest this u. +5.75 is the midpoint of
     the first two beyond the plinth's own block (|u| 4.70), i.e. hard against
     the west end of the counter. */
  ENTRY_U: 5.75,
  ENTRY_N: 2,
  /* feet height for the phantoms — campus.js's arrival court uses the same 80. */
  PHANTOM_Y0: 80, PHANTOM_Y1: 80.01,
};

/* water.js's own umbrella phase, hoisted so buildRiverDressing and the swim
   mouth cannot drift apart. It was `(i + .35)` inline in one place and
   re-typed as SUB_UMB_PHASE = .35 in campus.js; all three are now the same
   number reached from the same rule. */
const UMB_PHASE = .35;

/* The bar's (u, v) frame: u along the bank, v OUTWARD from the water (so the
   water is v < 0). Returns null if SITE.LAGOON ever stops publishing what the
   derivation needs. */
function swimMouth() {
  /* `?swim=off` restores the sealed basin, cold, for the A/B — the same escape
     hatch shape as ?lb / ?dc / ?ml. */
  try {
    if (new URLSearchParams(location.search).get('swim') === 'off') return null;
  } catch { /* no location (a test harness) — build the mouth */ }

  const L = SITE.LAGOON;
  if (!L || !L.umbrellas) return null;

  /* the midpoint of the gap between umbrellas 7 and 8 — campus.js's bearing */
  const T = (7.5 + UMB_PHASE) / L.umbrellas * TAU;
  const rimX = L.cx + L.rx * Math.cos(T);
  const rimZ = L.cz + L.rz * Math.sin(T);
  /* outward normal of the published ellipse — ∇((x/rx)² + (z/rz)²) */
  let nX = (rimX - L.cx) / (L.rx * L.rx), nZ = (rimZ - L.cz) / (L.rz * L.rz);
  const nL = Math.hypot(nX, nZ) || 1;
  nX /= nL; nZ /= nL;
  const tX = nZ, tZ = -nX;          // along the bank, matching campus.js
  const U0 = .8;                    // campus.js's nudge off the centre line

  const local = (x, z) => {
    const dx = x - rimX, dz = z - rimZ;
    return { u: dx * tX + dz * tZ - U0, v: dx * nX + dz * nZ };
  };

  return {
    local,
    /* is this world point inside the pocket? */
    inside(x, z) {
      const { u, v } = local(x, z);
      return Math.abs(u) <= SWIM.U && v <= SWIM.V_OUT && v >= SWIM.V_IN;
    },
    /* THE DOORWAY. Given the lagoon's rim chain as [{x, z}], return the indices
       of the SWIM.ENTRY_N circles nearest SWIM.ENTRY_U along the bank — by
       COUNT, deliberately, so the opening is always the same number of circles
       wide however the seeded outline lands. Candidates are restricted to the
       bar's own side of the basin (|u| ≤ 3 × SWIM.U and v inside the pocket's
       span, padded) so a circle on the far rim can never be picked by being
       numerically closest in a degenerate frame. */
    pickEntry(rim) {
      const cand = [];
      for (let i = 0; i < rim.length; i++) {
        const { u, v } = local(rim[i].x, rim[i].z);
        if (Math.abs(u) > SWIM.U * 3) continue;
        if (v > SWIM.V_OUT + 2 || v < SWIM.V_IN) continue;
        cand.push({ i, d: Math.abs(u - SWIM.ENTRY_U) });
      }
      cand.sort((a, b) => a.d - b.d);
      const out = new Set(cand.slice(0, SWIM.ENTRY_N).map(c => c.i));
      if (out.size < SWIM.ENTRY_N) {
        console.warn('[water] the swim-up bar\'s mouth found only ' + out.size
          + ' rim circles to open (wanted ' + SWIM.ENTRY_N
          + ') — SITE.LAGOON has moved under swimMouth(); you cannot swim to the bar.');
      }
      return out;
    },
  };
}

/* ── colliders ──────────────────────────────────────────────────────────────
   Coarse on purpose. The river is ~120 m from the nearest spawn and is read
   from the air, so this is really two jobs: keep a wandering walker out of the
   water, and — because nature.js plants its palms against G.colliders rather
   than against SITE — keep the palm population out of the channel. Only
   SITE.LAGOON is big enough to also need nature's own keep-out disc; every
   other basin and the whole channel are covered by what is pushed here.
   The bridge sites are deliberately left OPEN: a chain across them would seal
   the only way over the river.
   Returns the same circles as a keep-out list (see cullPlantsInRiver). */
function riverColliders(G, basins, lines, bridges) {
  const nearBridge = (x, z) => bridges.some(b =>
    (x - b.x) ** 2 + (z - b.z) ** 2 < (b.w * .62) ** 2);
  const mouth = swimMouth();          // the lagoon's swim-up approach, or null

  for (const key of ['spine', 'spur']) {
    const pts = lines[key];
    let run = 1e3;
    for (let i = 0; i < pts.length; i++) {
      const s = pts[i];
      if (i) run += Math.hypot(s.x - pts[i - 1].x, s.z - pts[i - 1].z);
      /* the step used to be hw × 0.9 alone. Halving the river's width on
         2026-08-02 would have doubled this chain for no gain: the circles are
         `hw + 1.2` across, so a 1.5 m step still overlaps every neighbour by
         more than a metre. The floor keeps the collider count flat while the
         water got narrower. */
      if (run < Math.max(1.5, s.hw * .9)) continue;
      run = 0;
      /* r is padded past the actual bank on purpose: nature.js clears a palm
         by collider.r + 1.4, and a palm CROWN is ~4 m across, so a trunk
         planted at the bank line hangs its fronds over the whole channel */
      if (!nearBridge(s.x, s.z)) G.colliders.push(worldCollider(s.x, s.z, s.hw + 1.2));
    }
  }

  for (const b of basins) {
    const n = Math.max(16, Math.round(b.rm * 3.4));
    const gated = mouth && b.key === 'lagoon';
    /* the chain is built first and pushed second, because the doorway is chosen
       by looking at the WHOLE chain (the two circles nearest the bar) rather
       than by testing each circle against a window — see pickEntry */
    const rim = [];
    for (let j = 0; j < n; j++) {
      const [x, z] = b.at(j / n * TAU, -.4);
      rim.push({ x, z });
    }
    const door = gated ? mouth.pickEntry(rim) : null;
    for (let j = 0; j < n; j++) {
      const s = rim[j];
      /* a doorway circle is still PUSHED, at feet-height 80 m: the palm scatter
         keeps its unbroken keep-out, the walker passes. Count is unchanged. */
      if (door && door.has(j)) {
        G.colliders.push(worldCollider(s.x, s.z, 1.6, SWIM.PHANTOM_Y0, SWIM.PHANTOM_Y1));
      } else {
        G.colliders.push(worldCollider(s.x, s.z, 1.6));
      }
    }
    /* Fill the middle, or nature plants a palm in open water. Two numbers
       have to line up or the fill leaks:
         · STEP ≤ r·√2, else the grid's corners are holes (2.6 grid, r 2.0 →
           1.84 m half-diagonal, covered);
         · the outermost qualifying point is (1.2 + step) inside, so its circle
           still reaches 1.8 m inside — and the rim chain above covers from
           1.72 m inside outwards, so the two bands overlap. */
    /* `coarse` basins (the hotel's own pools, the second round pool) are pure
       backdrop 250 m east of everything, so they fill at 4.0 m with r 3.0 —
       still inside the STEP ≤ r·√2 rule (4.0 ≤ 4.24), a third of the circles. */
    const step = b.coarse ? 4.0 : 2.6, cr = b.coarse ? 3.0 : 2.0;
    for (let x = b.cx - b.rx; x <= b.cx + b.rx; x += step) {
      for (let z = b.cz - b.rz; z <= b.cz + b.rz; z += step) {
        if (!b.inside(x, z, -1.2)) continue;
        /* THE SWIM-UP BAR'S MOUTH — see the banner over swimMouth(). Inside it
           the circle is still PUSHED, at feet-height 80 m: placePalms ignores
           the y-range so the keep-out is intact and nothing plants in the
           water, while updatePlayer skips it entirely and the swimmer walks
           through. The rim chain above is untouched, so the basin's
           containment is unchanged. */
        if (mouth && b.key === 'lagoon' && mouth.inside(x, z)) {
          G.colliders.push(worldCollider(x, z, cr, SWIM.PHANTOM_Y0, SWIM.PHANTOM_Y1));
          continue;
        }
        G.colliders.push(worldCollider(x, z, cr));
      }
    }
  }
}

/* ── keep nature's understory out of the water ──────────────────────────────
   nature.js runs AFTER water.js and dart-throws its shrub masses and ground
   cover against exclusionZones() ALONE — it never consults G.colliders, which
   is what keeps the *palms* out. SITE.LAGOON is the only river footprint in
   that list, so without this pass two or three shrub clumps float in the west
   pool and the channel on every load, which is exactly the kind of thing you
   only see in a top-down screenshot.

   Same technique world.js uses for the enclave: on the first frame (nature is
   built by then) collapse the offending instances to zero scale, keeping the
   translation. Palm buckets are skipped — they are marked DynamicDrawUsage
   because the sway ticker rewrites their matrices every frame, so anything
   written here would be gone by the next one. Runs once. */
const _cm = new THREE.Matrix4(), _cp = new THREE.Vector3(), _cz = new THREE.Vector3(0, 0, 0);
let riverCullDone = false;

function cullPlantsInRiver(G) {
  riverCullDone = true;
  const root = G.groups && G.groups.nature;
  if (!root || !riverWater) return 0;
  const { basins, lines } = riverWater;
  const chan = [];
  for (const key of ['spine', 'spur']) for (const s of lines[key]) chan.push(s);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  const grow = (x, z, r) => {
    x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r);
    z0 = Math.min(z0, z - r); z1 = Math.max(z1, z + r);
  };
  for (const b of basins) grow(b.cx, b.cz, Math.max(b.rx, b.rz) * 1.4);
  for (const s of chan) grow(s.x, s.z, s.hw + 1);
  const inRiver = (x, z) => {
    for (const b of basins) if (b.inside(x, z, .3)) return true;
    for (const s of chan) {
      const dx = x - s.x, dz = z - s.z, r = s.hw + .3;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  };
  let culled = 0;
  for (const child of root.children) {
    if (!child.isInstancedMesh) continue;
    if (child.instanceMatrix.usage === THREE.DynamicDrawUsage) continue;   // palms
    let touched = 0;
    for (let i = 0; i < child.count; i++) {
      child.getMatrixAt(i, _cm);
      _cp.setFromMatrixPosition(_cm);
      if (_cp.x < x0 || _cp.x > x1 || _cp.z < z0 || _cp.z > z1) continue;
      if (!inRiver(_cp.x, _cp.z)) continue;
      _cm.scale(_cz);
      child.setMatrixAt(i, _cm);
      touched++;
    }
    if (touched) { child.instanceMatrix.needsUpdate = true; culled += touched; }
  }
  return culled;
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
  /* one-shot, on the first frame: nature.js is built after water.js, so the
     river can only evict the shrubs that landed in it once they exist */
  if (!riverCullDone && CTX) cullPlantsInRiver(CTX);
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
  CTX = G;
  G.scene.add(ROOT);

  buildMaterials();

  buildDeckAndTurf(G);
  buildHeroPool(G);
  buildPavilions(G);
  buildPoolside(G);
  buildLanterns(G);
  buildLoungePool(G);
  buildRiver(G);
  buildVillaPools(G);

  (G.tickers ||= []).push((dt) => tick(dt));

  /* ── keep the far resort out of the mirror's second scene render ──────────
     AFTER every builder above, so the Reflector exists — but the assignment
     itself deliberately waits for the first TICK, because world.js has not
     rotated the enclave (or adopted moments.js's groups) yet and a distance
     measured here would be taken 90° from where the campus really stands.
     Guarded on mirrorMesh: with TUNE.MIRROR false, or after the Reflector's
     own fallback above, there is no second pass to cull for. */
  if (mirrorMesh) initMirrorLayers(G, mirrorMesh);
  /* the screen-extent pass is installed in makeMirrorWater (it has to sit under
     the every-Nth-frame gate); this only publishes its handle, and only if the
     Reflector actually came up. */
  if (mirrorFrustum) G.mirrorFrustum = mirrorFrustum;

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
  /* ⚠ THE GROUP STAYS VISIBLE FOREVER. Three of these nine lanterns carry real
     PointLights, and three.js bakes the scene's VISIBLE light count into every
     material's shader program. Hiding the group hid those three lights too, so
     toggling the lanterns took the campus 26 ⇄ 29 lights and silently
     invalidated the shader of every surface in the venue — they all recompiled
     in one frame, which is the 15–20 s stall Carl hit on the dive.
     So: hide the VISUALS, and leave the lights resident at zero intensity. The
     light count never changes, and nothing recompiles. */
  if (lanternGroup) lanternGroup.visible = true;
  for (const f of floaters) {
    for (const c of f.lot.children) if (!c.isLight) c.visible = lanternsVisible;
    if (f.disc) f.disc.visible = lanternsVisible;
    if (f.streak) f.streak.visible = lanternsVisible;
    if (f.halo) f.halo.visible = lanternsVisible;
    if (f.light) {
      f.light.intensity = lanternsVisible ? (night ? TUNE.LANTERN_LIGHT_NIGHT : 1.2) : 0;
    }
  }
}
