// engine.js — the soundscape's mixer (KAN-234). LAZY: js/sound.js imports this
// only after a guest has turned the sound on, inside that tap — before then no
// AudioContext exists and none of js/audio/ has been fetched.
//
//   createEngine(ctx, {seed, offline})  → E   (async: builds the noise + reverb
//                                              buffers in ≤ 1 s slices, yielding
//                                              between them in real time)
//   E.setScene(key, night, {fade})      crossfade to a moment's bed (beds.js)
//   E.setListener({x,y,z,fx,fz,floor})  spatial: where the camera is + faces
//   E.pump(until)                        schedule every event up to `until`
//   E.run() / E.pause()                  the real-time look-ahead pump (100 ms)
//   E.fade(on, secs) · E.duck(on)        master on/off · dip under narration
//   E.stats()                            for the tests
//
// THE GRAPH
//   layer.in → mix (the crossfade) → [spatial gain → low-pass → pan] → bus
//                                                        └→ send → reverb ─┐
//   bus 'amb' + bus 'mus' + reverb → master (quiet) → compressor → out → 🔈
// A layer's nodes exist only while it is audible: setScene starts what it
// needs, and a layer faded to 0 is stopped ~0.3 s after its fade ends.
//
// OFFLINE: the same engine runs in an OfflineAudioContext — the previews in
// reference/photos/shots-audio/ are rendered by tools/sound-test.mjs through
// exactly this code, pumping it from ctx.suspend() checkpoints.
import { LAYERS } from './layers.js';
import { bedLevels } from './beds.js';
import { mulberry32 } from '../materials.js';
import { CFG } from '../config.js';
import { SITE, enclaveToWorld, worldToEnclave } from '../site.js';

const MASTER = .55;            // the whole mix — quiet enough to leave on
const LOOK = .8;               // seconds scheduled ahead of the audio clock
const TICK = 100;              // ms between pumps (real time)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const breath = () => new Promise(r => setTimeout(r, 0));

/* ── buffers: seeded noise with a seamless loop, and a reverb impulse ──────── */
function xorshift(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
}
async function makeNoise(ctx, kind, secs, rnd, chunked) {
  const sr = ctx.sampleRate, n = Math.floor(secs * sr), X = 4096;
  const buf = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), tail = new Float32Array(X), w = xorshift(rnd() * 4294967296);
    let y = 0;
    for (let i = 0; i < n + X; i += sr) {
      const end = Math.min(n + X, i + sr);
      for (let j = i; j < end; j++) {
        let v = w();
        if (kind === 'brown') { y = (y + .02 * v) / 1.02; v = y * 3.5; } else v *= .5;
        if (j < n) d[j] = v; else tail[j - n] = v;
      }
      if (chunked) await breath();
    }
    /* the loop seam: the first X samples fade into the samples that FOLLOW
       the end, so sample n-1 → sample 0 is continuous */
    for (let k = 0; k < X; k++) { const u = k / X; d[k] = d[k] * u + tail[k] * (1 - u); }
  }
  return buf;
}
async function makeIR(ctx, secs, rnd, chunked) {
  const sr = ctx.sampleRate, n = Math.floor(secs * sr), pre = Math.floor(.014 * sr);
  const buf = ctx.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c), w = xorshift(rnd() * 4294967296);
    let y = 0;
    for (let i = pre; i < n; i++) {
      const u = i / n, a = .85 - .78 * u;          // bright at first, darker as it dies
      y += a * (w() - y);
      d[i] = y * Math.exp(-u * 5.2) * Math.min(1, (i - pre) / (.006 * sr));
    }
    if (chunked) await breath();
  }
  return buf;
}

/* ── where the spatial layers are (world metres) ───────────────────────────── */
const POOL = SITE.POOL;                                   // enclave-local rect
const PX0 = POOL.cx - POOL.w / 2, PX1 = POOL.cx + POOL.w / 2, PZ0 = POOL.cz - POOL.d / 2, PZ1 = POOL.cz + POOL.d / 2;
const SUITE_SRC = enclaveToWorld(0, -16);                 // the great room, glass wall open
const DJ_SRC = enclaveToWorld(0, SITE.DECK.z0 + 1.4);     // the DJ booth (moments.js)
const SHORE_X = SITE.OCEAN.x1 + 2;                        // the waterline — the sea is −X

/* each returns [gain, low-pass Hz, pan] for a listener */
function toward(ls, x, z) {
  const dx = x - ls.x, dz = z - ls.z, d = Math.hypot(dx, dz) || 1;
  return (dx / d) * -ls.fz + (dz / d) * ls.fx;            // · right, right = (−fz, fx)
}
const SPATIAL = {
  ground: ls => [1 - .8 * ls.air, 0, 0],
  air: ls => [1 + 1.3 * ls.air, 0, 0],
  shore(ls) {
    const d = Math.hypot(Math.max(0, ls.x - SHORE_X), ls.alt * .7);
    const near = clamp(1 - (d - 15) / 170, 0, 1);
    return [.3 + .7 * near, 380 + 3800 * near * near, clamp(ls.fz * .55, -.55, .55)];
  },
  pool(ls) {
    const l = worldToEnclave(ls.x, ls.z);
    const nx = clamp(l.x, PX0, PX1), nz = clamp(l.z, PZ0, PZ1);
    const d = Math.hypot(l.x - nx, l.z - nz, ls.alt);
    const w = enclaveToWorld(nx, nz);
    return [clamp(1.15 - d / 24, .06, 1), 900 + 5200 * clamp(1 - d / 30, 0, 1), d < 1.5 ? 0 : toward(ls, w.x, w.z) * .6];
  },
  suite(ls) {
    const d = Math.hypot(ls.x - SUITE_SRC.x, ls.z - SUITE_SRC.z, ls.alt);
    const u = clamp(1 - d / 38, 0, 1);
    return [clamp(1.1 - d / 45, .22, 1), 650 + 3600 * u * u, d < 4 ? 0 : toward(ls, SUITE_SRC.x, SUITE_SRC.z) * .5];
  },
  dj(ls) {
    const d = Math.hypot(ls.x - DJ_SRC.x, ls.z - DJ_SRC.z, ls.alt);
    const u = clamp(1 - d / 28, 0, 1);
    return [clamp(1.25 - d / 30, .25, 1), 240 + 1500 * u * u, d < 2.5 ? 0 : toward(ls, DJ_SRC.x, DJ_SRC.z) * .6];
  },
};
const FILTERED = new Set(['shore', 'pool', 'suite', 'dj']);

export async function createEngine(ctx, opts = {}) {
  const chunked = !opts.offline;
  const E = { ctx, rnd: mulberry32(opts.seed ?? CFG.SEED) };
  const hasPan = typeof ctx.createStereoPanner === 'function';
  E.pan = (dest, p) => {
    if (!hasPan) return dest;
    const n = ctx.createStereoPanner();
    n.pan.value = clamp(p, -1, 1);
    n.connect(dest);
    return n;
  };
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };

  E.white = await makeNoise(ctx, 'white', 6.5, E.rnd, chunked);
  E.brown = await makeNoise(ctx, 'brown', 6.5, E.rnd, chunked);
  const ir = await makeIR(ctx, 2.2, E.rnd, chunked);

  /* master chain */
  const out = gain(0);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 3.5;
  comp.attack.value = .02; comp.release.value = .35;
  const master = gain(MASTER);
  /* nothing useful lives under ~45 Hz (the brown-noise roar and the kick's
     tail do) — it is headroom a phone speaker cannot play anyway */
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 45; hp.Q.value = .6;
  master.connect(hp); hp.connect(comp); comp.connect(out); out.connect(ctx.destination);
  const buses = { amb: gain(1), mus: gain(1) };
  buses.amb.connect(master); buses.mus.connect(master);
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = gain(.5);
  verb.connect(wet).connect(master);

  /* ── layers ── */
  const layers = {};
  function makeLayer(name) {
    const def = LAYERS[name];
    const L = { name, def, in: gain(1), mix: gain(0), target: 0, active: false, cursor: 0, offAt: 0,
      ramp: { from: 0, to: 0, t0: 0, t1: 0 } };
    L.in.connect(L.mix);
    let tail = L.mix;
    if (def.spatial) { L.sp = gain(1); tail.connect(L.sp); tail = L.sp; }
    if (FILTERED.has(def.spatial)) {
      L.lp = ctx.createBiquadFilter(); L.lp.type = 'lowpass'; L.lp.frequency.value = 20000; L.lp.Q.value = .5;
      tail.connect(L.lp); tail = L.lp;
      if (hasPan) { L.pan = ctx.createStereoPanner(); tail.connect(L.pan); tail = L.pan; }
    }
    tail.connect(buses[def.bus]);
    if (def.send) { L.send = gain(def.send); tail.connect(L.send); L.send.connect(verb); }
    L.gen = def.make(E, L);
    return L;
  }
  const levelAt = (L, t) => {
    const r = L.ramp;
    if (t >= r.t1) return r.to;
    if (t <= r.t0) return r.from;
    return r.from + (r.to - r.from) * (t - r.t0) / (r.t1 - r.t0);
  };

  let listener = null;
  function applySpatial(L, at, tc) {
    if (!listener || !L.def.spatial) return;
    const [g, f, p] = SPATIAL[L.def.spatial](listener);
    L.sp.gain.setTargetAtTime(g, at, tc);
    if (L.lp && f) L.lp.frequency.setTargetAtTime(f, at, tc);
    if (L.pan) L.pan.pan.setTargetAtTime(p, at, tc);
  }

  /* crossfade every layer to `levels` over `fade` seconds */
  function setBed(levels, fade = 2.5) {
    const at = ctx.currentTime;
    fade = Math.max(.02, fade);
    for (const name of Object.keys(LAYERS)) {
      const tgt = (levels[name] || 0) * LAYERS[name].gain;
      let L = layers[name];
      if (!L) { if (!tgt) continue; L = layers[name] = makeLayer(name); }
      if (tgt === L.target && (tgt === 0 || L.active)) continue;
      if (tgt > 0 && !L.active) {
        L.gen.start(at); L.active = true; L.cursor = at;
        applySpatial(L, at, .01);                  // placed before it is heard
      }
      const cur = levelAt(L, at), g = L.mix.gain;
      g.cancelScheduledValues(at);
      g.setValueAtTime(cur, at);
      g.linearRampToValueAtTime(tgt, at + fade);
      L.ramp = { from: cur, to: tgt, t0: at, t1: at + fade };
      L.target = tgt;
      if (!tgt) L.offAt = at + fade + .3;
    }
  }

  E.scene = null;
  E.setScene = (key, night, o = {}) => {
    E.scene = { key, night: !!night };
    setBed(bedLevels(key, night), o.fade ?? 2.5);
  };

  E.setListener = ls => {
    const alt = Math.max(0, ls.y - (ls.floor || 0) - CFG.EYE_HEIGHT);
    const n = Math.hypot(ls.fx, ls.fz) || 1;
    listener = { x: ls.x, z: ls.z, alt, air: clamp((alt - 6) / 50, 0, 1), fx: ls.fx / n, fz: ls.fz / n };
    const at = ctx.currentTime;
    for (const L of Object.values(layers)) if (L.active) applySpatial(L, at, .25);
  };

  /* schedule every active layer's events up to `until`; retire faded layers */
  E.pump = until => {
    const now = ctx.currentTime;
    for (const L of Object.values(layers)) {
      if (!L.active) continue;
      if (L.target === 0 && now >= L.offAt) { L.gen.stop(now); L.active = false; continue; }
      const from = Math.max(L.cursor, now);
      if (until > from) { L.gen.schedule(from, until); L.cursor = until; }
    }
  };

  let timer = null;
  E.run = () => {
    if (timer) return;
    const tick = () => E.pump(ctx.currentTime + LOOK);
    tick();
    timer = setInterval(tick, TICK);
  };
  E.pause = () => { clearInterval(timer); timer = null; };
  E.running = () => !!timer;

  /* the on/off fade (the AudioContext itself is suspended by sound.js after it) */
  E.fade = (on, secs = 1.5) => {
    const g = out.gain, at = ctx.currentTime;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.setTargetAtTime(on ? 1 : 0, at, secs / 3);
  };
  /* narration: the music steps back a little, the ambience barely */
  let ducked = false;
  E.duck = on => {
    ducked = !!on;
    const at = ctx.currentTime;
    buses.mus.gain.setTargetAtTime(on ? .55 : 1, at, on ? .25 : .9);
    buses.amb.gain.setTargetAtTime(on ? .85 : 1, at, on ? .25 : .9);
  };

  E.stats = () => ({
    active: Object.values(layers).filter(L => L.active).map(L => L.name).sort(),
    audible: Object.values(layers).filter(L => L.active && L.target > 0).map(L => L.name).sort(),
    targets: Object.fromEntries(Object.values(layers).filter(L => L.active).map(L => [L.name, +L.target.toFixed(3)])),
    levels: Object.fromEntries(Object.values(layers).filter(L => L.active).map(L => [L.name, +levelAt(L, ctx.currentTime).toFixed(3)])),
    scene: E.scene, running: !!timer, state: ctx.state, time: ctx.currentTime, ducked,
  });
  /* for the tests: the master's output node (an AnalyserNode can hang off it) */
  E.output = out;
  return E;
}
