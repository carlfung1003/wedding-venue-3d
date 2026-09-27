// layers.js — the soundscape's instruments, one LAYER per kind of sound (KAN-234).
//
// A layer is a small generator with a fixed shape:
//   start(t)            build its persistent nodes (noise beds, cricket carriers,
//                       talkers) — only while it is audible
//   stop(t)             stop them; nothing of it runs afterwards
//   schedule(t0, t1)    place every EVENT in [t0, t1) on the audio clock: waves,
//                       laps, chirps, syllables, notes. Called by the engine's
//                       look-ahead pump (~0.8 s ahead, every 100 ms) — the same
//                       code drives the OfflineAudioContext previews.
// Each layer writes into `L.in`; the engine owns what comes after it (the
// crossfade gain, the spatial gain / low-pass / pan, the reverb send, the bus).
//
// Nothing is a loop. The noise buffers are 6.5 s of seeded noise played through
// filters whose every parameter wanders, the events are randomised (seeded
// PRNG, house rule), and the music is GENERATIVE: original progressions (plain
// diatonic changes — no melody or arrangement from any existing piece), voiced
// and rhythmed afresh every bar. See beds.js for which layers play where.
import * as S from './synth.js';

const lerp = (a, b, u) => a + (b - a) * u;

/* ── helpers ── */
function loopNoise(E, buf, rate = 1) {
  const s = E.ctx.createBufferSource();
  s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
  return s;
}
function node(E, type, f, q) {
  const b = E.ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q;
  return b;
}
function amp(E, v) { const g = E.ctx.createGain(); g.gain.value = v; return g; }
/* persistent sources are started at a random point in the buffer so two
   layers on the same noise never line up */
function startAll(E, list, t) { for (const s of list) s.start(t, s.buffer ? E.rnd() * (s.buffer.duration - .1) : undefined); }
function stopAll(list, t) { for (const s of list) { try { s.stop(t); } catch { /* already stopped */ } } }
/* a clock for event layers: next time, never in the past */
const due = (st, t0) => { if (st.next < t0) st.next = t0 + .02; };

/* ═══════════════════════════════ NATURE ═══════════════════════════════════ */

/** The sea. A constant low roar (brown noise), and WAVES: a swell that
 *  brightens, breaks, and drains away as hiss. 6.5–11 s apart, never equal.
 *  Distance is the engine's job (shore spatial: gain + low-pass + pan). */
function sea(E, L) {
  let src = [], waveG, waveLP, foamG;
  const st = { next: 0 };
  return {
    start(t) {
      const roar = loopNoise(E, E.brown, .92), rLP = node(E, 'lowpass', 360, .5), rG = amp(E, .55);
      roar.connect(rLP).connect(rG).connect(L.in);
      const wave = loopNoise(E, E.white, .97); waveLP = node(E, 'lowpass', 500, .4); waveG = amp(E, .1);
      wave.connect(waveLP).connect(waveG).connect(L.in);
      const foam = loopNoise(E, E.white, 1.03), fHP = node(E, 'highpass', 2600, .5); foamG = amp(E, .02);
      foam.connect(fHP).connect(foamG).connect(L.in);
      src = [roar, wave, foam];
      startAll(E, src, t);
      st.next = t + .5;
    },
    stop(t) { stopAll(src, t); src = []; },
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const t = st.next, A = .45 + E.rnd() * .55, build = 2.2 + E.rnd() * 1.6;
        waveG.gain.setTargetAtTime(.22 * A, t, 1.0);
        waveLP.frequency.setTargetAtTime(520, t, 1.0);
        const br = t + build;
        waveG.gain.setTargetAtTime(.95 * A, br, .28);
        waveLP.frequency.setTargetAtTime(1300 + 900 * A, br, .22);
        foamG.gain.setTargetAtTime(.3 * A, br + .2, .35);
        const out = br + .7 + E.rnd() * .6;
        waveG.gain.setTargetAtTime(.12, out, 1.7);
        waveLP.frequency.setTargetAtTime(430, out, 1.5);
        foamG.gain.setTargetAtTime(.03, out + .4, 1.9);
        st.next = t + 6.5 + E.rnd() * 4.5;
      }
    },
  };
}

/** Wind: brown noise in a wandering band, gusting. Stronger on the roof. */
function wind(E, L) {
  let src = [], bp, g, hiG;
  const st = { next: 0 };
  return {
    start(t) {
      const n = loopNoise(E, E.brown, 1.0); bp = node(E, 'bandpass', 450, .6); g = amp(E, .5);
      n.connect(bp).connect(g).connect(L.in);
      const h = loopNoise(E, E.white, .95), hb = node(E, 'bandpass', 1500, 1.6); hiG = amp(E, .03);
      h.connect(hb).connect(hiG).connect(L.in);
      src = [n, h];
      startAll(E, src, t);
      st.next = t;
    },
    stop(t) { stopAll(src, t); src = []; },
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const t = st.next, gust = .3 + E.rnd() * .7;
        bp.frequency.setTargetAtTime(260 + gust * 520, t, 1.4);
        g.gain.setTargetAtTime(.35 + gust * .75, t, 1.1);
        hiG.gain.setTargetAtTime(.01 + gust * gust * .06, t, 1.0);
        st.next = t + 2 + E.rnd() * 3.5;
      }
    },
  };
}

/** Palms in the breeze: high noise whose amplitude is modulated at AUDIO rate
 *  by very-low-passed noise (the fronds' rustle), under slow gusts. */
function palms(E, L) {
  let src = [], gust;
  const st = { next: 0 };
  return {
    start(t) {
      const n = loopNoise(E, E.white, 1.0), hp = node(E, 'highpass', 1600, .5), lp = node(E, 'lowpass', 7500, .5);
      const rustle = amp(E, .5);
      const m = loopNoise(E, E.white, .5), mlp = node(E, 'lowpass', 13, .5), depth = amp(E, 22);
      m.connect(mlp).connect(depth).connect(rustle.gain);
      gust = amp(E, .4);
      n.connect(hp).connect(lp).connect(rustle).connect(gust).connect(L.in);
      src = [n, m];
      startAll(E, src, t);
      st.next = t;
    },
    stop(t) { stopAll(src, t); src = []; },
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const t = st.next;
        gust.gain.setTargetAtTime(.15 + E.rnd() * .85, t, .9);
        st.next = t + 1.4 + E.rnd() * 2.8;
      }
    },
  };
}

/** Pool water lapping at the coping: a low slosh, short laps, the odd bubble. */
function lapping(E, L) {
  let src = [], slosh;
  const st = { next: 0, sl: 0 };
  return {
    start(t) {
      const n = loopNoise(E, E.brown, .8), lp = node(E, 'lowpass', 240, .6); slosh = amp(E, .25);
      n.connect(lp).connect(slosh).connect(L.in);
      src = [n];
      startAll(E, src, t);
      st.next = t + .2; st.sl = t;
    },
    stop(t) { stopAll(src, t); src = []; },
    schedule(t0, t1) {
      due(st, t0);
      if (st.sl < t0) st.sl = t0;
      while (st.sl < t1) {
        slosh.gain.setTargetAtTime(.12 + E.rnd() * .38, st.sl, .6);
        st.sl += 1 + E.rnd() * 1.6;
      }
      while (st.next < t1) {
        const t = st.next, R = E.rnd;
        S.splash(E, L.in, t, 330 + R() * 600, .18 + R() * .3, .1 + R() * .25);
        if (R() < .15) S.splash(E, L.in, t + .12 + R() * .1, 400 + R() * 500, .1 + R() * .15, .08 + R() * .12);
        if (R() < .22) S.bubble(E, L.in, t + R() * .2, 480 + R() * 900, .03 + R() * .05);
        st.next = t + .28 + R() * .9;
      }
    },
  };
}

/** Crickets: four singers (a sine carrier each, pulsed into chirps of 2–4
 *  pulses, each with its own rate, pitch, place and rests) over a shimmering
 *  far chorus (a narrow band of noise, amplitude-modulated). */
function crickets(E, L) {
  let src = [], voices = [], bp;
  const st = { next: 0 };
  return {
    start(t) {
      const R = E.rnd;
      /* the far chorus: a soft band (low Q — a narrow one reads as a whine),
         its centre wandering, shimmering at ~23 Hz */
      const ch = loopNoise(E, E.white, 1); bp = node(E, 'bandpass', 4600, 3.5); const chG = amp(E, .16);
      const am = E.ctx.createOscillator(); am.frequency.value = 23; const amG = amp(E, .12);
      am.connect(amG).connect(chG.gain);
      ch.connect(bp).connect(chG).connect(L.in);
      src = [ch, am];
      st.next = t;
      voices = [];
      for (let i = 0; i < 4; i++) {
        const o = E.ctx.createOscillator(); o.type = 'sine';
        o.frequency.value = 3900 + R() * 1300;
        const g = amp(E, 0);
        o.connect(g).connect(E.pan(L.in, (i / 3 - .5) * 1.4 + (R() - .5) * .3));
        voices.push({ o, g, next: t + R(), iv: .5 + R() * .55, n: 2 + (R() * 3 | 0), pl: .012 + R() * .008,
          gap: .026 + R() * .014, v: .1 + R() * .12 });
        src.push(o);
      }
      startAll(E, src, t);
    },
    stop(t) { stopAll(src, t); src = []; voices = []; },
    schedule(t0, t1) {
      const R = E.rnd;
      due(st, t0);
      while (st.next < t1) { bp.frequency.setTargetAtTime(4200 + R() * 900, st.next, 2); st.next += 3 + R() * 4; }
      for (const c of voices) {
        if (c.next < t0) c.next = t0 + R() * .3;
        while (c.next < t1) {
          const t = c.next, a = c.v * (.7 + R() * .3);
          for (let p = 0; p < c.n; p++) {
            const s = t + p * (c.pl + c.gap);
            c.g.gain.setValueAtTime(0, s);
            c.g.gain.linearRampToValueAtTime(a, s + .003);
            c.g.gain.linearRampToValueAtTime(0, s + c.pl);
          }
          /* a cricket stops now and then — the chorus never beats in step */
          c.next = t + c.iv * (.9 + R() * .2) + (R() < .07 ? 2 + R() * 5 : 0);
        }
      }
    },
  };
}

/** Birds: a phrase every 1.2–5 s, from a random direction and distance. */
function birds(E, L) {
  const st = { next: 0 };
  return {
    start(t) { st.next = t + .5 + E.rnd() * 1.5; },
    stop() {},
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const R = E.rnd;
        S.bird(E, L.in, st.next, R() * 3 | 0, .05 + R() * .09, (R() - .5) * 1.6);
        st.next += 1.2 + R() * 3.8;
      }
    },
  };
}

/* ═══════════════════════════════ PEOPLE ═══════════════════════════════════ */

/* vowel formants (F1, F2) — a murmur that is speech-shaped but never words */
const VOWELS = [[730, 1090], [530, 1840], [300, 2200], [570, 840], [440, 1020], [500, 1500], [660, 1700]];

/** Conversation: N talkers (a buzzing glottal source through two moving
 *  formant filters, gated into syllables and phrases, taking turns), over a
 *  soft band of room noise, all low-passed so no word is ever legible.
 *  opts: voices, bed, lp, laugh (the after party). */
function talkers(opts) {
  return (E, L) => {
    let src = [], people = [], bedG;
    const st = { bed: 0 };
    return {
      start(t) {
        const R = E.rnd;
        const out = node(E, 'lowpass', opts.lp || 1700, .5);
        out.connect(L.in);
        const b = loopNoise(E, E.brown, 1.1), bb = node(E, 'bandpass', 520, .8); bedG = amp(E, opts.bed);
        b.connect(bb).connect(bedG).connect(out);
        src = [b];
        people = [];
        for (let i = 0; i < opts.voices; i++) {
          const fem = R() < .5, f0 = fem ? 185 + R() * 45 : 105 + R() * 30;
          const o = E.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0;
          const f1 = node(E, 'bandpass', 600, 5), f2 = node(E, 'bandpass', 1400, 7);
          const g = amp(E, 0), g2 = amp(E, .55);
          o.connect(f1).connect(g); o.connect(f2).connect(g2).connect(g);
          g.connect(E.pan(out, (R() - .5) * 1.5));
          people.push({ o, f1, f2, g, f0, k: fem ? 1.15 : 1, v: .11 + R() * .08, next: t + R() * 3, left: 0 });
          src.push(o);
        }
        startAll(E, src, t);
        st.bed = t;
      },
      stop(t) { stopAll(src, t); src = []; people = []; },
      schedule(t0, t1) {
        const R = E.rnd;
        if (st.bed < t0) st.bed = t0;
        while (st.bed < t1) { bedG.gain.setTargetAtTime(opts.bed * (.7 + R() * .6), st.bed, 1.2); st.bed += 1.5 + R() * 2; }
        for (const p of people) {
          if (p.next < t0) p.next = t0 + R() * .5;
          while (p.next < t1) {
            const t = p.next;
            if (p.left <= 0) {                   // a new phrase — or a laugh
              p.laugh = opts.laugh && R() < .08;
              p.left = p.laugh ? 4 + (R() * 3 | 0) : 3 + (R() * 9 | 0);
              p.pitch = p.f0 * (p.laugh ? 1.5 : .95 + R() * .15);
            }
            const len = p.laugh ? .09 : .1 + R() * .15;
            const [F1, F2] = p.laugh ? VOWELS[0] : VOWELS[R() * VOWELS.length | 0];
            p.f1.frequency.setTargetAtTime(F1 * p.k, t, .025);
            p.f2.frequency.setTargetAtTime(F2 * p.k, t, .03);
            p.pitch *= p.laugh ? .96 : .985 + R() * .03;   // intonation drifts down a phrase
            p.o.frequency.setTargetAtTime(p.pitch, t, .06);
            const v = p.v * (p.laugh ? 1.3 : .7 + R() * .4);
            p.g.gain.setTargetAtTime(v, t, .018);
            p.g.gain.setTargetAtTime(0, t + len * .8, .028);
            p.left--;
            p.next = t + len + (p.laugh ? .07 : .02 + R() * .07) + (p.left <= 0 ? .8 + R() * 3.4 : 0);
          }
        }
      },
    };
  };
}

/** Glasses and cups: a clink every few seconds, sometimes two together. */
function clinks(E, L) {
  const st = { next: 0 };
  return {
    start(t) { st.next = t + E.rnd() * 2; },
    stop() {},
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const R = E.rnd, t = st.next, glass = R() < .65;
        const f = glass ? 2300 + R() * 1300 : 1300 + R() * 700, p = (R() - .5) * 1.6, v = .05 + R() * .07;
        S.clink(E, L.in, t, f, v, p, glass ? 1 : .45);
        if (R() < .3) S.clink(E, L.in, t + .05 + R() * .05, f * (1.05 + R() * .15), v * .9, p + .1, glass ? 1 : .45);
        st.next = t + 1.1 + R() * 4;
      }
    },
  };
}

/** Cutlery at dinner: small ticks, frequent and scattered; the odd plate. */
function cutlery(E, L) {
  const st = { next: 0 };
  return {
    start(t) { st.next = t + E.rnd(); },
    stop() {},
    schedule(t0, t1) {
      due(st, t0);
      while (st.next < t1) {
        const R = E.rnd, t = st.next;
        S.tick(E, L.in, t, .05 + R() * .08, (R() - .5) * 1.7);
        if (R() < .08) S.clink(E, L.in, t + .02, 900 + R() * 500, .05, (R() - .5), .35);
        st.next = t + .16 + R() * .8;
      }
    },
  };
}

/* ═══════════════════════════════ MUSIC ════════════════════════════════════
   Every style is a bar clock over its own chord table. A chord is
   { b: bass midi, v: voicing midis }. Progressions are plain diatonic changes,
   chosen afresh every eight bars; rhythms and melodies are drawn per bar. */

function style(bpm, spec) {
  return (E, L) => {
    const st = { next: 0, bar: 0, prog: null, pi: 0, mel: 0 };
    const beat = 60 / bpm;
    return {
      start(t) { st.next = t + .3; st.bar = 0; st.prog = null; st.mel = spec.melStart || 0; },
      stop() {},
      schedule(t0, t1) {
        if (st.next < t0) st.next = t0 + .05;      // after a pause: pick up on a fresh bar
        while (st.next < t1) {
          if (!st.prog || st.bar % st.prog.length === 0) { st.prog = spec.progs[E.rnd() * spec.progs.length | 0]; st.bar = 0; }
          const ch = st.prog[st.bar % st.prog.length];
          const nx = st.prog[(st.bar + 1) % st.prog.length];
          spec.bar(E, L.in, st.next, beat, ch, nx, st);
          st.bar++;
          st.next += beat * (spec.beats || 4);
        }
      },
    };
  };
}
const R1 = (E, a, b) => a + E.rnd() * (b - a);
const pick = (E, arr) => arr[E.rnd() * arr.length | 0];
/* a melody that wanders by step over a scale, resting often */
function walk(E, st, scale) {
  const i = Math.max(0, Math.min(scale.length - 1, st.mel + pick(E, [-2, -1, -1, 1, 1, 2, 0])));
  st.mel = i;
  return scale[i];
}

/* the brunch — a light bossa lounge in D major, 84 bpm */
const D_PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81];
const lounge = style(84, {
  melStart: 4,
  progs: [
    [{ b: 43, v: [59, 62, 66, 69] }, { b: 42, v: [57, 61, 64, 66] }, { b: 40, v: [55, 59, 62, 66] }, { b: 45, v: [57, 62, 64, 67] },
     { b: 38, v: [57, 61, 62, 66] }, { b: 47, v: [57, 59, 62, 66] }, { b: 40, v: [55, 59, 62, 66] }, { b: 45, v: [57, 62, 64, 67] }],
    [{ b: 38, v: [57, 61, 62, 66] }, { b: 43, v: [59, 62, 66, 69] }, { b: 47, v: [57, 59, 62, 66] }, { b: 45, v: [57, 62, 64, 67] }],
  ],
  bar(E, out, t, b, ch, nx, st) {
    /* EP comp on the bossa off-beats */
    const hits = pick(E, [[0, 1.5, 3], [0, 1.5, 2.5], [.5, 2, 3.5]]);
    for (const h of hits) for (const m of ch.v) S.ep(E, out, t + h * b + E.rnd() * .012, m, R1(E, .22, .32), b * .8);
    S.bass(E, out, t, ch.b, .55, b * 1.2);
    S.bass(E, out, t + 1.5 * b, ch.b + 7, .4, b * .8);
    S.bass(E, out, t + 3 * b, ch.b + 12, .35, b * .6);
    for (let e = 0; e < 8; e++) S.brush(E, out, t + e * b / 2, e % 2 ? .02 : .035, .05, 7500, .8);
    if (E.rnd() < .45) {
      const n = 2 + (E.rnd() * 3 | 0);
      for (let k = 0; k < n; k++) S.ep(E, out, t + (1 + E.rnd() * 5 | 0) * b / 2 + k * .05, walk(E, st, D_PENT), .22, b);
    }
  },
});

/* the prewedding — nylon-string fingerpicking from inside the house, A major, 70 bpm */
const acoustic = style(70, {
  progs: [
    [{ b: 45, v: [57, 61, 64, 68] }, { b: 49, v: [56, 61, 64, 68] }, { b: 42, v: [57, 61, 64, 66] }, { b: 50, v: [57, 62, 66, 69] }],
    [{ b: 50, v: [57, 62, 66, 69] }, { b: 49, v: [56, 61, 64, 68] }, { b: 47, v: [57, 62, 66, 69] }, { b: 52, v: [56, 59, 62, 64] }],
  ],
  bar(E, out, t, b, ch) {
    const pat = pick(E, [[0, 1, 2, 3, 2, 1, 2, 3], [0, 2, 1, 3, 0, 2, 1, 3], [0, 1, 3, 2, 1, 3, 2, 1]]);
    for (let e = 0; e < 8; e++) {
      const tt = t + e * b / 2 + (E.rnd() - .5) * .014;
      if (e === 0) S.pluck(E, out, tt, ch.b, .5);
      else if (e === 4) S.pluck(E, out, tt, ch.b + 7, .38);
      S.pluck(E, out, tt, ch.v[pat[e]] + (e && e % 4 === 0 ? 12 : 0), R1(E, .22, .34));
    }
    if (E.rnd() < .3) S.pluck(E, out, t + 3 * b, ch.v[3] + 12, .3);
  },
});

/* the ceremony — a string pad and a felt piano, F major, 58 bpm, two bars a chord */
const F_PENT = [65, 67, 69, 72, 74, 77, 79, 81];
const strings = style(58, {
  beats: 8, melStart: 3,
  progs: [
    [{ b: 41, v: [53, 57, 60, 64] }, { b: 40, v: [52, 55, 60, 64] }, { b: 38, v: [50, 57, 60, 65] }, { b: 46, v: [53, 57, 62, 65] }],
    [{ b: 38, v: [50, 57, 60, 65] }, { b: 46, v: [53, 57, 62, 65] }, { b: 41, v: [53, 57, 60, 64] }, { b: 48, v: [52, 55, 60, 64] }],
  ],
  bar(E, out, t, b, ch, nx, st) {
    pad(E, out, t, [ch.b, ...ch.v], b * 8 + .6);
    for (let k = 0; k < 3; k++) S.piano(E, out, t + k * b * .5, ch.v[k + 1], .22, b * 3);
    for (let q = 2; q < 8; q++) {
      if (E.rnd() < .5) S.piano(E, out, t + q * b + (E.rnd() < .3 ? b / 2 : 0), walk(E, st, F_PENT), R1(E, .18, .28), b * 1.5);
    }
  },
});
function pad(E, out, t, notes, dur) { S.pad(E, out, t, notes, dur, .55, { cutoff: 1250, attack: 2.6, release: 3 }); }

/* cocktails — soft swing, ii–V–I in B♭, 100 bpm, brushes + walking bass */
const jazz = style(100, {
  progs: [
    [{ b: 36, v: [58, 62, 63, 67] }, { b: 41, v: [57, 62, 63, 67] }, { b: 46, v: [57, 60, 62, 65] }, { b: 43, v: [58, 62, 65, 69] },
     { b: 36, v: [58, 62, 63, 67] }, { b: 41, v: [57, 62, 63, 67] }, { b: 38, v: [57, 60, 62, 65] }, { b: 43, v: [59, 62, 65, 69] }],
    [{ b: 46, v: [57, 60, 62, 65] }, { b: 43, v: [58, 62, 65, 69] }, { b: 36, v: [58, 62, 63, 67] }, { b: 41, v: [57, 60, 63, 65] }],
  ],
  bar(E, out, t, b, ch, nx) {
    const sw = b * 2 / 3;                      // the swung "and"
    /* walking bass: root, two chord / scale tones, a chromatic approach */
    const w = [ch.b, ch.b + pick(E, [3, 4, 7]), ch.b + pick(E, [7, 5, 9]), nx.b + pick(E, [-1, 1])];
    w.forEach((m, i) => S.bass(E, out, t + i * b, m, i ? .42 : .5, b * .85));
    /* brushes: a swish on every beat, a tap on 2 and 4, the swung skip */
    for (let i = 0; i < 4; i++) {
      S.brush(E, out, t + i * b, .025, .16, 5200, .5);
      if (i % 2) S.brush(E, out, t + i * b, .05, .05, 3800, 1.1);
      S.brush(E, out, t + i * b + sw, .018, .05, 6800, .9);
    }
    /* comping: two shell hits a bar, on the syncopations */
    const hits = pick(E, [[0, 1 + 2 / 3], [1 + 2 / 3, 3], [2 / 3, 2 + 2 / 3], [0, 2 + 2 / 3]]);
    for (const h of hits) for (const m of ch.v) S.ep(E, out, t + h * b + E.rnd() * .01, m, R1(E, .2, .28), b * .7);
  },
});

/* dinner — a warm ballad in E♭, 64 bpm: EP arpeggios over a soft pad */
const warm = style(64, {
  progs: [
    [{ b: 39, v: [55, 58, 62, 65] }, { b: 36, v: [55, 58, 63, 67] }, { b: 44, v: [55, 60, 63, 67] }, { b: 46, v: [56, 60, 63, 65] },
     { b: 43, v: [53, 58, 62, 65] }, { b: 36, v: [55, 58, 62, 63] }, { b: 41, v: [55, 56, 60, 63] }, { b: 46, v: [56, 60, 63, 65] }],
  ],
  bar(E, out, t, b, ch) {
    S.pad(E, out, t, ch.v, b * 4 + .4, .45, { cutoff: 800, attack: 1.4, release: 2, voices: 1 });
    S.bass(E, out, t, ch.b, .45, b * 1.9);
    S.bass(E, out, t + 2 * b, ch.b + 7, .32, b * 1.6);
    const up = [...ch.v, ch.v[1] + 12];
    for (let i = 0; i < 4; i++) S.ep(E, out, t + i * b + (E.rnd() - .5) * .02, up[i + (E.rnd() < .5 ? 1 : 0)], R1(E, .2, .28), b * 1.2);
  },
});

/* the after party — a muffled house beat from the DJ booth, 120 bpm, A minor */
const beat = style(120, {
  progs: [[{ b: 33, v: [57, 60, 64, 67] }, { b: 29, v: [57, 60, 64, 65] }, { b: 36, v: [55, 60, 64, 67] }, { b: 31, v: [55, 59, 62, 67] }]],
  bar(E, out, t, b, ch) {
    for (let i = 0; i < 4; i++) {
      S.kick(E, out, t + i * b, .95);
      S.sawBass(E, out, t + i * b + b / 2, ch.b + 12, .55, b * .35);
      S.brush(E, out, t + i * b + b / 2, .06, .03, 8500, .8);
      if (i % 2) S.brush(E, out, t + i * b, .12, .11, 1500, .8);   // the clap
    }
    if (E.rnd() < .7) for (const m of ch.v) S.ep(E, out, t + (E.rnd() < .5 ? 0 : 2.5) * b, m, .3, b * .5);
  },
});

/* ═══════════════════════════════ THE TABLE ════════════════════════════════
   gain: the layer's full-scale level (the mix calibration — beds.js levels
   multiply it); send: reverb; bus: 'amb' | 'mus' (ducking hits mus harder);
   spatial: how the engine places it (engine.js SPATIAL). */
export const LAYERS = {
  sea:      { make: sea,      gain: .33, send: .05, bus: 'amb', spatial: 'shore' },
  wind:     { make: wind,     gain: .28, send: 0,   bus: 'amb', spatial: 'air' },
  palms:    { make: palms,    gain: .1, send: .05, bus: 'amb', spatial: 'ground' },
  lapping:  { make: lapping,  gain: .45, send: .08, bus: 'amb', spatial: 'pool' },
  crickets: { make: crickets, gain: .3, send: .12, bus: 'amb', spatial: 'ground' },
  birds:    { make: birds,    gain: .55, send: .25, bus: 'amb', spatial: 'ground' },
  murmur:   { make: talkers({ voices: 6, bed: .12, lp: 1600 }), gain: .7, send: .22, bus: 'amb', spatial: 'ground' },
  crowd:    { make: talkers({ voices: 10, bed: .28, lp: 1300, laugh: true }), gain: .6, send: .2, bus: 'amb', spatial: 'ground' },
  clink:    { make: clinks,   gain: .55, send: .3,  bus: 'amb', spatial: 'ground' },
  cutlery:  { make: cutlery,  gain: .85, send: .25, bus: 'amb', spatial: 'ground' },
  lounge:   { make: lounge,   gain: .25, send: .18, bus: 'mus', spatial: null },
  acoustic: { make: acoustic, gain: .8, send: .3,  bus: 'mus', spatial: 'suite' },
  strings:  { make: strings,  gain: .45,  send: .35, bus: 'mus', spatial: null },
  jazz:     { make: jazz,     gain: .28, send: .2,  bus: 'mus', spatial: null },
  warm:     { make: warm,     gain: .33, send: .28, bus: 'mus', spatial: null },
  beat:     { make: beat,     gain: .25, send: .1,  bus: 'mus', spatial: 'dj' },
};
export { lerp };
