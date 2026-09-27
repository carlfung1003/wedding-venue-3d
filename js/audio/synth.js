// synth.js — the one-shot voices the soundscape is played with (KAN-234).
//
// EVERYTHING HERE IS SYNTHESISED. No sample, no recording, no file: every
// function builds a handful of Web Audio nodes for ONE event (a note, a clink,
// a bird phrase, a lap of water), schedules its envelope on the audio clock and
// lets the nodes stop and be collected. Zero download, zero licensing.
//
// Conventions:
//   · `E` is the engine (engine.js): E.ctx, E.rnd() (seeded), E.white / E.brown
//     (looping noise AudioBuffers), E.pan(dest, p) → a StereoPanner in front of
//     dest (or dest itself where StereoPanner does not exist).
//   · `t` is an AudioContext time (seconds). Nothing reads the clock here — the
//     layers decide WHEN, these only decide WHAT.
//   · Envelopes use setTargetAtTime for decays (exponential, click-free) and a
//     short linear attack; every source is stopped explicitly so it is freed.
//   · Levels are small on purpose — the mix is balanced in engine.js / beds.js,
//     and the master is a quiet, compressed bus.

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function osc(E, type, f, t) {
  const o = E.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  return o;
}
function gain(E, v = 0) { const g = E.ctx.createGain(); g.gain.value = v; return g; }
function filt(E, type, f, q = .7) {
  const b = E.ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; b.Q.value = q;
  return b;
}
/* a burst of the shared noise buffer, from a random point in it */
function noise(E, buf, t, len) {
  const s = E.ctx.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start(t, E.rnd() * (buf.duration - .5));
  s.stop(t + len);
  return s;
}
/* attack → exponential decay → (optional) release; returns the stop time */
function envAD(g, t, peak, a, tc) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.setTargetAtTime(0, t + a, tc);
  return t + a + tc * 7;
}

/* ── INSTRUMENTS ──────────────────────────────────────────────────────────── */

/** Electric piano: two-operator FM (ratio 1), the index decaying — the bell of
 *  the attack settling into a round tone. */
export function ep(E, dest, t, midi, vel = .4, dur = 1) {
  const f = mtof(midi);
  const car = osc(E, 'sine', f, t), mod = osc(E, 'sine', f, t);
  const idx = gain(E), amp = gain(E);
  idx.gain.setValueAtTime(f * (1.1 + vel * 1.4), t);
  idx.gain.setTargetAtTime(f * .18, t, .22);
  mod.connect(idx).connect(car.frequency);
  car.connect(amp).connect(dest);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel * .32, t + .006);
  amp.gain.setTargetAtTime(vel * .12, t + .006, .5);
  amp.gain.setTargetAtTime(0, t + dur, .28);
  const end = t + dur + 1.8;
  car.start(t); mod.start(t); car.stop(end); mod.stop(end);
}

/** A soft (felt) piano: four slightly inharmonic sine partials, the upper ones
 *  dying first. */
const P_AMP = [1, .34, .13, .05], P_TC = [1.5, .8, .45, .28];
export function piano(E, dest, t, midi, vel = .3, dur = 2) {
  const f = mtof(midi), low = midi < 60 ? 1.4 : 1;
  const amp = gain(E);
  amp.connect(dest);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel * .3, t + .005);
  amp.gain.setTargetAtTime(0, t + dur, .45);
  const end = t + dur + 3;
  for (let n = 1; n <= 4; n++) {
    const o = osc(E, 'sine', f * n * Math.sqrt(1 + .00035 * n * n), t);
    const g = gain(E);
    envAD(g, t, P_AMP[n - 1], .004, P_TC[n - 1] * low);
    o.connect(g).connect(amp);
    o.start(t); o.stop(end);
  }
}

/** A string pad: two detuned saws per note through one warm low-pass, a slow
 *  bow-like attack and a long release. One filter + one amp per CHORD. */
export function pad(E, dest, t, notes, dur, vel = .5, opts = {}) {
  const lp = filt(E, 'lowpass', opts.cutoff || 1100, .4);
  const amp = gain(E);
  const atk = opts.attack ?? 2.2, rel = opts.release ?? 2.4;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel * .07, t + atk);
  amp.gain.setValueAtTime(vel * .07, t + dur);
  amp.gain.linearRampToValueAtTime(0, t + dur + rel);
  /* a very slow swell in the filter — the section breathing */
  lp.frequency.setValueAtTime((opts.cutoff || 1100) * .8, t);
  lp.frequency.linearRampToValueAtTime((opts.cutoff || 1100) * 1.15, t + dur * .6);
  lp.connect(amp).connect(dest);
  const end = t + dur + rel + .1;
  const voices = opts.voices || 2;
  for (const m of notes) {
    for (let v = 0; v < voices; v++) {
      const o = osc(E, 'sawtooth', mtof(m), t);
      o.detune.value = voices === 1 ? 0 : (v ? 7 : -7) + (E.rnd() - .5) * 4;
      o.connect(lp);
      o.start(t); o.stop(end);
    }
  }
}

/** A nylon-string pluck: triangle + a little saw, the filter closing fast. */
export function pluck(E, dest, t, midi, vel = .4) {
  const f = mtof(midi);
  const a = osc(E, 'triangle', f, t), b = osc(E, 'sawtooth', f, t);
  const bg = gain(E, .22), lp = filt(E, 'lowpass', 3000, .9), amp = gain(E);
  lp.frequency.setValueAtTime(2600 + vel * 1600, t);
  lp.frequency.setTargetAtTime(650, t, .09);
  a.connect(lp); b.connect(bg).connect(lp);
  lp.connect(amp).connect(dest);
  const end = envAD(amp, t, vel * .3, .003, .42);
  a.start(t); b.start(t); a.stop(end); b.stop(end);
}

/** Bass: sine + a quiet triangle an octave up, low-passed, plucked. */
export function bass(E, dest, t, midi, vel = .5, dur = .5) {
  const f = mtof(midi);
  const a = osc(E, 'sine', f, t), b = osc(E, 'triangle', f * 2, t);
  const bg = gain(E, .12), amp = gain(E), lp = filt(E, 'lowpass', 520, .5);
  a.connect(amp); b.connect(bg).connect(amp);
  amp.connect(lp).connect(dest);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel * .36, t + .012);   /* held low notes dominate a quiet bed on headphones */
  amp.gain.setTargetAtTime(vel * .2, t + .012, .18);
  amp.gain.setTargetAtTime(0, t + dur, .07);
  const end = t + dur + .6;
  a.start(t); b.start(t); a.stop(end); b.stop(end);
}

/** Synth bass for the dance beat: a saw through a closing low-pass. */
export function sawBass(E, dest, t, midi, vel = .5, dur = .2) {
  const o = osc(E, 'sawtooth', mtof(midi), t);
  const lp = filt(E, 'lowpass', 900, 2), amp = gain(E);
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.setTargetAtTime(200, t, .06);
  o.connect(lp).connect(amp).connect(dest);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel * .3, t + .008);
  amp.gain.setTargetAtTime(0, t + dur, .04);
  o.start(t); o.stop(t + dur + .4);
}

/** Brush / shaker / hat: a band of noise, very short. */
export function brush(E, dest, t, vel = .1, len = .09, f = 6500, q = .7) {
  const bp = filt(E, 'bandpass', f, q), amp = gain(E);
  const s = noise(E, E.white, t, len * 8 + .05);
  s.connect(bp).connect(amp).connect(dest);
  envAD(amp, t, vel, .003, len);
}

/** A kick: a sine falling fast in pitch. */
export function kick(E, dest, t, vel = .8) {
  const o = osc(E, 'sine', 118, t), amp = gain(E);
  o.frequency.exponentialRampToValueAtTime(44, t + .11);
  o.connect(amp).connect(dest);
  const end = envAD(amp, t, vel * .8, .002, .11);
  o.start(t); o.stop(end);
}

/* ── NATURE ───────────────────────────────────────────────────────────────── */

/** A lap of water against stone: a short band of noise, sometimes a bubble. */
export function splash(E, dest, t, f, vel, len) {
  const bp = filt(E, 'bandpass', f, 1.3), amp = gain(E);
  const s = noise(E, E.brown, t, len * 7 + .1);
  s.connect(bp).connect(amp).connect(dest);
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(vel, t + len * .35);
  amp.gain.setTargetAtTime(0, t + len * .35, len * .5);
  bp.frequency.setValueAtTime(f * 1.25, t);
  bp.frequency.linearRampToValueAtTime(f * .8, t + len);
}
/** A bubble: a sine whose pitch rises as it closes (the classic "plip"). */
export function bubble(E, dest, t, f, vel) {
  const o = osc(E, 'sine', f, t), amp = gain(E);
  o.frequency.exponentialRampToValueAtTime(f * 2.1, t + .07);
  o.connect(amp).connect(dest);
  const end = envAD(amp, t, vel, .003, .025);
  o.start(t); o.stop(end);
}

/** Birds — three kinds of phrase, all short, high and sparse.
 *    whistle: two to four glides (a bulbul's "pick-a-pick")
 *    trill:   a fast frequency-modulated warble
 *    chirps:  quick falling chips */
export function bird(E, dest, t, kind, vel, pan) {
  const out = E.pan(dest, pan);
  const R = E.rnd;
  if (kind === 0) {
    const base = 1900 + R() * 1400, n = 2 + (R() * 3 | 0);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const up = R() < .6, len = .09 + R() * .1;
      const f0 = base * (up ? 1 : 1.35) * (1 + (R() - .5) * .15), f1 = base * (up ? 1.4 : .95);
      const o = osc(E, 'sine', f0, tt), amp = gain(E);
      o.frequency.linearRampToValueAtTime(f1, tt + len);
      o.connect(amp).connect(out);
      amp.gain.setValueAtTime(0, tt);
      amp.gain.linearRampToValueAtTime(vel, tt + .015);
      amp.gain.setValueAtTime(vel, tt + len - .02);
      amp.gain.linearRampToValueAtTime(0, tt + len);
      o.start(tt); o.stop(tt + len + .02);
      tt += len + .05 + R() * .07;
    }
  } else if (kind === 1) {
    const f = 3200 + R() * 1500, len = .35 + R() * .45;
    const o = osc(E, 'sine', f, t), m = osc(E, 'sine', 22 + R() * 14, t), mg = gain(E, 300 + R() * 350), amp = gain(E);
    m.connect(mg).connect(o.frequency);
    o.frequency.linearRampToValueAtTime(f * (.85 + R() * .3), t + len);
    o.connect(amp).connect(out);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vel * .7, t + .04);
    amp.gain.setValueAtTime(vel * .7, t + len * .7);
    amp.gain.linearRampToValueAtTime(0, t + len);
    o.start(t); m.start(t); o.stop(t + len + .02); m.stop(t + len + .02);
  } else {
    const n = 2 + (R() * 3 | 0), f = 4200 + R() * 1600;
    let tt = t;
    for (let i = 0; i < n; i++) {
      const o = osc(E, 'sine', f, tt), amp = gain(E);
      o.frequency.exponentialRampToValueAtTime(f * .62, tt + .045);
      o.connect(amp).connect(out);
      const end = envAD(amp, tt, vel * .8, .004, .012);
      o.start(tt); o.stop(end);
      tt += .08 + R() * .06;
    }
  }
}

/* ── PEOPLE ───────────────────────────────────────────────────────────────── */

/** A glass (or a cup) touched: three inharmonic partials, a fast ring-down. */
export function clink(E, dest, t, f, vel, pan, ring = 1) {
  const out = E.pan(dest, pan);
  const parts = [[1, 1, .3], [2.76, .45, .15], [5.4, .2, .07]];
  for (const [r, a, tc] of parts) {
    if (f * r > E.ctx.sampleRate * .45) continue;   // above Nyquist it only aliases (and warns)
    const o = osc(E, 'sine', f * r, t), amp = gain(E);
    o.connect(amp).connect(out);
    const end = envAD(amp, t, vel * a, .001, tc * ring);
    o.start(t); o.stop(end);
  }
}

/** Cutlery on china: a tick of noise and a short metallic ring. */
export function tick(E, dest, t, vel, pan) {
  const out = E.pan(dest, pan);
  brush(E, out, t, vel * .7, .006, 3800, 1.6);
  const f = 3900 + E.rnd() * 2600;
  for (const [r, a] of [[1, 1], [1.53, .5]]) {
    const o = osc(E, 'sine', f * r, t), amp = gain(E);
    o.connect(amp).connect(out);
    const end = envAD(amp, t, vel * a * .35, .001, .035);
    o.start(t); o.stop(end);
  }
}
