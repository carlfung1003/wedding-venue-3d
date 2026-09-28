// Every CanvasTexture recipe lives here; the shared material set is exported
// as one M.* object (house pattern, from alice-lunch-party).
import * as THREE from 'three';
import { CFG } from './config.js';

/* ══ THE ENV KNOBS (KAN-211 wave F) ══════════════════════════════════════════
   ⚠ three r180 binds `material.envMapIntensity` ONLY for a material that has
   its OWN `envMap`. With `envMap === null` and a `scene.environment`, the
   renderer binds `scene.environmentIntensity` instead (WebGLRenderer setProgram:
   `isMeshStandardMaterial && envMap === null && scene.environment !== null`),
   so a per-material envMapIntensity on such a material is a silent no-op.
   Before wave F every registry in the build (atrium reg/retile/bakeMat, campus
   archMat + the MAT constructors, suite archFinish, the water.js / nature.js
   water, the mirror ball) was exactly that.

   envKnob(m, [d, n]) is now the ONE way to give a material an env level: it
   registers the pair, and bindEnvKnobs(scene.environment) (main.js, after the
   world + moments are built) gives every registered material the SAME texture
   as its own envMap — identical program parameters (envMap, cube-UV mode and
   height), so NO new program. setEnvKnobsNight(on) (world.js applyNight) flips
   every knob. Omit the pair and the knob tracks the scene (CFG.LIGHT.ENV_DAY /
   ENV_NIGHT) — exactly what the renderer bound before wave F.
   Only Standard/Physical materials are registered: an envMap on a Lambert /
   Basic / Phong material WOULD be a new program.
   ⚠ A material cloned AFTER the bind carries the envMap but is not in the
   registry — it would keep its day level at night. Register the clone. */
const ENVK = [];            // { m, d, n, label }
let envTex = null;
let envNight = false;
export const ENV_SCENE = Object.freeze([CFG.LIGHT.ENV_DAY, CFG.LIGHT.ENV_NIGHT]);
export function envKnob(m, env = null, label = '') {
  if (!m || !m.isMeshStandardMaterial) return m;
  const d = env ? env[0] : ENV_SCENE[0], n = env ? env[1] : ENV_SCENE[1];
  const e = ENVK.find(k => k.m === m);
  if (e) { e.d = d; e.n = n; e.label = label || e.label; }
  else ENVK.push({ m, d, n, label });
  m.userData.envKnob = label || m.userData.envKnob || 'envKnob';
  if (envTex && !m.envMap) m.envMap = envTex;
  m.envMapIntensity = envNight ? n : d;
  return m;
}
export function bindEnvKnobs(tex) {
  envTex = tex || null;
  if (!envTex) return;
  for (const e of ENVK) if (!e.m.envMap) e.m.envMap = envTex;
}
export function setEnvKnobsNight(on) {
  envNight = !!on;
  for (const e of ENVK) e.m.envMapIntensity = envNight ? e.n : e.d;
}
/* probes / tests only */
export function envKnobList() { return ENVK.slice(); }

/* ══ THE PHOTOGRAPHS — ONE DOWNLOAD, ONE DECODE, ONE GPU TEXTURE (KAN-235) ══════
   Six modules swap a generated photograph (assets/textures/*.webp) over a canvas
   stand-in, each with its own `new THREE.TextureLoader().load(url)`. The same
   file was therefore loaded as SEPARATE images — hedge.webp four times, shrub.webp
   five, boug.webp and floor_teak.webp twice — and three uploads a separate GPU
   texture per image: 1024² × 4 B × 4/3 = 5.3 MiB each, ~48 MiB of duplicates on a
   phone that already holds ~670 MiB of textures (measured, tools/perf-gpu.mjs).
   photoTexture(file, onLoad) loads each URL ONCE and hands every caller a
   `clone()` — its own wrap / repeat / colorSpace, the SAME Source — and three
   r180 shares one WebGLTexture between Textures with the same Source and the
   same upload parameters (wrap, filters, anisotropy, colour space). Pixels are
   identical; the call sites set exactly what they set before, on their clone.

   AND THE UPLOAD IS PACED. On a slow link these photographs are still arriving
   after the title card is up (nothing waits for them — they replace canvas
   stand-ins), and each one used to be decoded + uploaded + mipmapped inside
   whichever frame first drew it: 486–814 ms blocks behind the invitation at
   Fast 4G / 4–6× CPU (tools/perf-load.mjs). Now: `img.decode()` first (off
   the main thread where the browser can), then — once main.js has handed over
   the renderer (setPhotoUploader) — ONE file per animation frame: every waiting
   caller gets its clone in one batch (a clone bumps the shared Source's
   version, so cloning them together means one upload, not one per clone) and
   renderer.initTexture() uploads it right there, in its own slice.
   The boot has three states, and the middle one matters:
     · before main.js's warm-up collects its textures: a photo is applied at
       once, exactly as before — the warm-up's sliced initTexture pass uploads it;
     · holdPhotos() (main.js, just before that collection) until the title card
       is up: arrivals WAIT. Applied then, they were uploaded inside the hidden
       warm-up frame (a 1.4 s block at 94 % on a 10 Mbps / 6× phone), and paced
       then, they pushed the title card back ~1–2 s at Fast 4G / 6× (measured);
     · setPhotoUploader(renderer) (after the title card): the queue drains one
       file per frame, behind the invitation. */
const _photos = new Map();          // url -> { tex, waiting: [[onLoad, onError]], err }
let _uploader = null, _held = false;
const _jobs = [];
let _pumping = false;
export function holdPhotos() { _held = true; }
export function setPhotoUploader(renderer) { _uploader = renderer || null; _held = false; pumpPhotos(); }
function pumpPhotos() {
  if (_pumping || !_jobs.length || !_uploader) return;
  _pumping = true;
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true; _pumping = false;
    const job = _jobs.shift();
    if (job) job();
    pumpPhotos();
  };
  requestAnimationFrame(run);
  setTimeout(run, 250);             // a hidden tab has no frames; never strand a photo
}
function flushPhoto(e) {
  const w = e.waiting;
  e.waiting = [];
  if (!w.length) return;
  const clones = w.map(([ok]) => { const t = e.tex.clone(); ok(t); return t; });
  if (_uploader) for (const t of clones) _uploader.initTexture(t);
}
function schedulePhoto(e) {
  if (!_uploader && !_held) { flushPhoto(e); return; }
  _jobs.push(() => flushPhoto(e));
  pumpPhotos();
}
export function photoTexture(file, onLoad, onError) {
  const url = new URL(`../assets/textures/${file}`, import.meta.url).href;
  let e = _photos.get(url);
  if (!e) {
    e = { tex: null, waiting: [], err: null };
    _photos.set(url, e);
    new THREE.TextureLoader().load(url, (t) => {
      const img = t.image;
      const decoded = img && typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      decoded.then(() => { e.tex = t; schedulePhoto(e); });
    }, undefined, (err) => {
      e.err = err || new Error(url);
      const w = e.waiting;
      e.waiting = [];
      for (const [, no] of w) if (no) no(e.err);
    });
  }
  if (e.err) { if (onError) onError(e.err); return; }
  e.waiting.push([onLoad, onError]);
  if (e.tex) schedulePhoto(e);
}

/* ── seeded PRNG — never Math.random() for placement or noise (house rule) ── */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── canvas texture plumbing ── */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;   // color maps only — house rule
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ── ballroom carpet: deep plum with a subtle champagne damask dot grid ── */
function carpetTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#33222e'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7101);
    for (let i = 0; i < 900; i++) {   // pile mottle
      g.fillStyle = `rgba(${28 + rnd() * 26 | 0},${14 + rnd() * 16 | 0},${26 + rnd() * 22 | 0},.2)`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5);
    }
    const s = 64;
    g.strokeStyle = 'rgba(216,180,106,.13)';   // diamond lattice
    g.lineWidth = 1.4;
    for (let y = -1; y <= h / s; y++) for (let x = -1; x <= w / s; x++) {
      const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s;
      g.beginPath();
      g.moveTo(cx, cy - s / 2); g.lineTo(cx + s / 2, cy);
      g.lineTo(cx, cy + s / 2); g.lineTo(cx - s / 2, cy);
      g.closePath(); g.stroke();
    }
    g.fillStyle = 'rgba(216,180,106,.45)';     // champagne dots on the lattice points
    for (let y = -1; y <= h / s; y++) for (let x = -1; x <= w / s; x++) {
      const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s;
      g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
    }
  }, [8, 13]);
}

/* ── marble: warm off-white tiles with faint grey veining ── */
function marbleTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3301);
    for (let i = 0; i < 20; i++) {
      g.strokeStyle = `rgba(138,130,118,${.08 + rnd() * .14})`;
      g.lineWidth = .7 + rnd() * 1.6;
      g.beginPath();
      let x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        const nx = x + (rnd() - .5) * 190, ny = y + (rnd() - .5) * 190;
        g.quadraticCurveTo(x + (rnd() - .5) * 70, y + (rnd() - .5) * 70, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,110,96,.28)';    // tile joints (2×2 per texture repeat)
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.moveTo(1, 1); g.rect(1, 1, w - 2, h - 2);
    g.stroke();
  }, [10, 10]);
}

/* ── wall panels: warm cream with paneling lines and a wainscot band ── */
function wallTex() {
  return tex(512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e9dfca'); grad.addColorStop(1, '#ddd0b6');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) {         // panel seams
      g.strokeStyle = 'rgba(120,100,70,.18)'; g.lineWidth = 2;
      g.strokeRect(x + 14, 24, 100, h * .56);
      g.strokeStyle = 'rgba(255,248,230,.5)'; g.lineWidth = 1;
      g.strokeRect(x + 17, 27, 94, h * .56 - 6);
    }
    g.fillStyle = 'rgba(150,122,80,.2)';       // wainscot band
    g.fillRect(0, h * .8, w, h * .2);
    g.strokeStyle = 'rgba(180,148,96,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h * .8); g.lineTo(w, h * .8); g.stroke();
  }, [4, 1]);
}

/* ── wood parquet: alternating grain blocks ── */
function woodTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#7b5a3b'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(5507), s = 64;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      const horiz = (x + y) % 2 === 0, ox = x * s, oy = y * s;
      g.fillStyle = `rgba(${90 + rnd() * 40 | 0},${62 + rnd() * 28 | 0},${36 + rnd() * 18 | 0},.55)`;
      g.fillRect(ox, oy, s, s);
      g.strokeStyle = 'rgba(48,32,18,.5)'; g.lineWidth = 1.2;
      g.strokeRect(ox + .5, oy + .5, s - 1, s - 1);
      g.strokeStyle = 'rgba(255,224,180,.12)';
      for (let k = 6; k < s; k += 9) {
        g.beginPath();
        if (horiz) { g.moveTo(ox + 2, oy + k); g.lineTo(ox + s - 2, oy + k + (rnd() - .5) * 4); }
        else { g.moveTo(ox + k, oy + 2); g.lineTo(ox + k + (rnd() - .5) * 4, oy + s - 2); }
        g.stroke();
      }
    }
  }, [6, 6]);
}

/* ── white linen: faint weave and warm shadowing ── */
function linenTex() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3eee3'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(9109);
    g.strokeStyle = 'rgba(150,138,116,.07)'; g.lineWidth = 1;
    for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(255,255,250,${.04 + rnd() * .06})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }, [3, 3]);
}

/* ── night sky dome: gradient, seeded stars, one soft moon ── */
function skyTex() {
  return tex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05060f'); grad.addColorStop(.55, '#0b0e1e'); grad.addColorStop(1, '#191527');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(1103);
    for (let i = 0; i < 420; i++) {
      const y = rnd() * rnd() * h * .75;       // stars thin toward the horizon
      g.fillStyle = `rgba(${235 + rnd() * 20 | 0},${232 + rnd() * 18 | 0},${215 + rnd() * 30 | 0},${.25 + rnd() * .7})`;
      g.beginPath(); g.arc(rnd() * w, y, .4 + rnd() * 1.1, 0, 7); g.fill();
    }
    const mx = w * .72, my = h * .26;
    const glow = g.createRadialGradient(mx, my, 4, mx, my, 46);
    glow.addColorStop(0, 'rgba(250,244,224,.9)'); glow.addColorStop(.25, 'rgba(240,230,200,.28)');
    glow.addColorStop(1, 'rgba(240,230,200,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 46, 0, 7); g.fill();
  });
}

/* ══════════════════════════════════════════════════════════════
   the shared material set
   ══════════════════════════════════════════════════════════════ */
export const M = {
  carpet: new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: .96 }),
  marble: new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: .22, metalness: .04 }),
  wall:   new THREE.MeshStandardMaterial({ map: wallTex(), roughness: .85 }),
  gold:   new THREE.MeshStandardMaterial({ color: 0xc9a35c, metalness: .8, roughness: .32,
    emissive: 0x2e2008, emissiveIntensity: .35 }),   // emissive-ish warm accent
  wood:   new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .62 }),
  linen:  new THREE.MeshStandardMaterial({ map: linenTex(), roughness: .9 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x1d1a22, roughness: .7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: .16 }),
  blush:  new THREE.MeshStandardMaterial({ color: 0xc98a94, roughness: .8 }),
  sage:   new THREE.MeshStandardMaterial({ color: 0x9aa88a, roughness: .85 }),
  sky:    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }),
};
