// sound.js — the venue's music + ambience (KAN-234, v2). OFF BY DEFAULT.
//
// Everything audible is a FILE Carl made in his Suno Pro account (commercial
// rights; he picked every take) — assets/audio/, AAC-LC 96 kbps 44.1 kHz,
// loudness-normalised to ~-20 LUFS with fades already in them. Nothing is
// synthesised. (Attempt 1, 069fc68, synthesised everything live and was taken
// out on Carl's listen; its switch / unlock / visibility plumbing lives on here.)
//
// ONE small module, imported statically by main.js — there is NO lazy import:
// attempt 1's lazy engine import and its first `new AudioContext()` both landed
// in the tap's frame (a 117–133 ms frame on enable). See "THE TAP" below.
//
// ── WHAT PLAYS ─────────────────────────────────────────────────────────────
//   music    one track per moment (+ the title card's), STREAMED through an
//            <audio> element → MediaElementAudioSourceNode (never decoded whole
//            into memory — they are three minutes long). A track loops by
//            starting a second element on the same file LOOP_OVERLAP seconds
//            before the end: the files' own 4 s fade-out and 1.5 s fade-in are
//            the crossfade, so there is no dip and no gap.
//   ambience two 12 s SEAMLESS loops (the files' ends are already crossfaded
//            into their starts), fetched + decoded to AudioBuffers and looped
//            sample-exactly: loopBuffer() measures the decoded length against
//            the file's true frame count and cuts away any AAC encoder
//            priming / padding a decoder left in, so the loop point is the
//            file's own seam (+ a ~21 ms micro-crossfade over it — the night
//            file's seam carries a small step). Ocean by day (quieter on the brunch roof, far
//            above the sea), the night loop by night — N swaps them.
//
// ── THE MIX (gains, linear) ────────────────────────────────────────────────
//   music .50 (−6 dB → ≈ −26 LUFS) · ambience .27 (−11.4 dB → ≈ −30 LUFS,
//   a touch under the music) · brunch ambience .14 (−17 dB) · narration duck
//   ×.5 on the music bus (−6 dB). Crossfades are equal-power: 2.5 s on a
//   moment switch (the timeline, the tour, the veil — it spans the reveal),
//   1.5 s on a day↔night flip, 1.2 s in on enable, 0.6 s out on disable.
//
// ── THE PREFERENCE ────────────────────────────────────────────────────────
//   ?sound=1 / ?sound=0  forces it for this visit (not persisted — like ?lang)
//   localStorage 'venue.sound' = '1' | '0'  the guest's own toggle (try/catch)
//   default: off. A guest who wants sound but has not touched the page yet is
//   ARMED: the toggles show "on", and the FIRST real gesture anywhere starts it.
//   Audio NEVER starts without a gesture.
//
// ── OFF COSTS NOTHING ─────────────────────────────────────────────────────
//   Until a guest turns it on: no AudioContext, no <audio> element, no request
//   under assets/audio/. The per-frame ticker returns at once.
//
// ── THE TAP (iOS Safari, WeChat's WKWebView, Chrome) ───────────────────────
//   Inside the gesture, synchronously: every deck <audio> element plays a tiny
//   silent WAV (data: URI, no request) — that is what unlocks each element for
//   later programmatic play() on WebKit — and on WebKit (Safari, every iOS
//   browser, WeChat iOS) the AudioContext is created + resume()d + fed one
//   silent sample right there, the only place iOS lets it start, and the first
//   track's play() is issued inside the same gesture.
//   On Chromium the context is created a beat LATER, once the silent element
//   has opened the audio device (250 ms after its 'playing' event, ≤ 700 ms): Chrome's
//   FIRST `new AudioContext()` in a page opens the output device synchronously
//   on the main thread — 90–125 ms measured on this Mac, headless and headed —
//   while a media element opens it off the main thread; created ~250 ms after
//   its 'playing' event, the constructor costs ~1–5 ms. Chrome's sticky user activation allows a
//   context created after the gesture to run.
//   navigator.audioSession.type = 'playback' (Safari 17+) so a phone on the
//   silent switch still plays what the guest explicitly turned on.
//   Hidden (tab switch, WeChat to the background, the phone locking) and
//   pagehide: the decks pause and the context is suspended. Visible / pageshow:
//   resume; if the browser wants a new gesture (iOS after a call or Siri), it
//   is ARMED again and the next tap resumes it.
//
// ── WEIGHT ────────────────────────────────────────────────────────────────
//   Enabling fetches the CURRENT moment's track (streamed, ~2.0–2.5 MB) and its
//   ambience loop (~150 KB). A moment switch fetches that moment's track; N
//   fetches the other loop once. During the guided tour only, the NEXT
//   moment's track is buffered in idle time on a spare deck. PHONE tier: one
//   ambience decode at a time and only the loop in use is kept decoded
//   (a 12 s stereo loop is ~4.7 MB of float PCM at 48 kHz).
//
// ── TO SWAP A TRACK ───────────────────────────────────────────────────────
//   Drop the new file in assets/audio/ under the same name (AAC-LC .m4a,
//   44.1 kHz, ~-20 LUFS, faded in/out) — or change MUSIC below. An AMBIENCE
//   loop must be seamless and its `frames` below must be its true sample count
//   at 44.1 kHz (`ffprobe -show_entries stream=duration_ts`), or the loop point
//   is wrong. Then `node tools/sound-test.mjs`.
import { CFG } from './config.js';
import { t, onLang } from './i18n.js';
import { PHONE } from './perftier.js';

const DIR = 'assets/audio/';
/* the title card (+ the loading card and the opening dive) and the six moments, by id */
export const MUSIC = {
  title: 'venue-00-title', brunch: 'venue-01-brunch', setup: 'venue-02-prewedding',
  ceremony: 'venue-03-ceremony', cocktail: 'venue-04-cocktail', dinner: 'venue-05-dinner',
  afterparty: 'venue-06-afterparty',
};
/* frames = the file's true length at 44.1 kHz (the edit list's duration, not
   the AAC frame count: 534 × 1024 = 546,816 carries 1,024 priming + 716 padding) */
export const AMB = {
  ocean: { file: 'venue-amb-ocean', frames: 545076 },
  night: { file: 'venue-amb-night', frames: 525672 },
};
const SRC_RATE = 44100, PRIMING = 1024;
export const LEVEL = { music: .5, amb: .27, ambBrunch: .14, duck: .5 };
export const FADE = { moment: 2.5, light: 1.5, on: 1.2, off: .6, duckDown: .4, duckUp: .9 };
const LOOP_OVERLAP = 4;          // s — a track's tail over its own start (its fade-out is 4 s)
const POOL = 4;                  // <audio> decks: now, fading out, a loop's tail / the tour's next
const PUMP_MS = 250;             // the loop / housekeeping interval while sounding
const KEY = 'venue.sound';
/* 1 s of silence, 8 kHz mono 16-bit, as a blob: URL (no request): the per-element
   unlock AND the device warm-up. A few ms of silence is not enough — Chrome only
   opens the output device (and fires 'playing') for something it really plays. */
let _silent = null;
function silentURL() {
  if (_silent) return _silent;
  const n = 8000, ab = new ArrayBuffer(44 + n * 2), d = new DataView(ab);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) d.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 8000, true); d.setUint32(28, 16000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true);
  w(36, 'data'); d.setUint32(40, n * 2, true);
  return (_silent = URL.createObjectURL(new Blob([ab], { type: 'audio/wav' })));
}

const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const store = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/* Chromium (Chrome, Edge, Android Chrome + WebViews — userAgentData is
   Chromium-only) may create the context after the gesture: sticky activation.
   Everything else (Safari, every iOS browser incl. WeChat iOS, Firefox) creates
   it IN the gesture. */
const DEFER_CTX = !!(navigator.userAgentData || window.chrome) && !IOS;

/* ── an AudioBuffer that loops on the file's own seam ────────────────────────
   Measured 2026-09-27: Chromium AND WebKit both honour the m4a's edit list and
   return exactly frames × rate / 44100 samples (593,280 / 572,160 at 48 kHz;
   545,076 / 525,672 at 44.1 kHz). A decoder that ignores it would return the
   1,024 priming samples up front (and 716 of padding at the end): detect that
   from the length and skip them.
   ⚠ The NIGHT file's own seam is not quite clean: its last sample → its first
   is a 0.019 step (−0.058 → −0.039; ffmpeg's decode, so it is the file, not a
   decoder) and its click energy there ranks above every other point of the
   loop. So the loop point is also given a SEAM_XF-sample (≈21 ms) equal-power
   micro-crossfade: the loop is x[N … n) with its last N samples blended into
   x[0 … N) — the sample before the wrap is then ≈ x[N−1] and the one after it is
   x[N]. It shortens the loop by ~21 ms; the ocean (already clean) is unchanged
   to the ear. The loop is the WHOLE of that fresh buffer — `loop = true`, no
   loopStart / loopEnd, so there is no fractional loop point to round. */
export const SEAM_XF = 1024;
export function loopBuffer(ctx, decoded, frames) {
  const r = decoded.sampleRate / SRC_RATE;
  const want = Math.round(frames * r);
  const extra = decoded.length - want;
  const tol = Math.max(2, Math.ceil(2 * r));
  const skip = extra >= Math.round(PRIMING * r) - tol ? Math.round(PRIMING * r) : 0;
  if (extra < 0) console.warn('[sound] a loop decoded SHORT', decoded.length, 'of', want);
  const n = Math.min(want, decoded.length - skip), N = Math.min(SEAM_XF, n >> 3);
  const out = ctx.createBuffer(decoded.numberOfChannels, n - N, decoded.sampleRate);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const x = decoded.getChannelData(c).subarray(skip, skip + n), y = out.getChannelData(c);
    y.set(x.subarray(N));
    for (let k = 0; k < N; k++) {
      const th = (k + .5) / N * Math.PI / 2;
      y[n - 2 * N + k] = x[n - N + k] * Math.cos(th) + x[k] * Math.sin(th);
    }
  }
  return { buf: out, skip, extra, len: n, xf: N };
}

export function initSound(G) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const q = (() => { try { return new URLSearchParams(location.search).get('sound'); } catch { return null; } })();
  let want = q === '1' ? true : q === '0' ? false : stored() === '1';
  let ctx = null, master = null, musicBus = null, ambBus = null;
  let decks = null;                            // [{el, src, g, ...}] — made on the first "on"
  let ctxPending = false, armed = false, ducked = false, sounding = false;
  let scene = null;                            // {key, night} the mix is playing
  let pump = 0, offTimer = 0, prefetchFor = null;
  const amb = [];                              // live ambience voices
  const bufs = {};                             // ambience: key → {buf, skip, extra, len} | Promise
  const log = { requests: [], plays: [], rejects: 0, loops: 0, tapMs: 0, ctxMs: 0, ctxAfterMs: 0 };

  /* ── gains: equal-power ramps, the level tracked in JS (never read back) ── */
  const shape = (from, to, u) => from + (to - from) * (to > from ? Math.sin(u * Math.PI / 2) : 1 - Math.cos(u * Math.PI / 2));
  const levelAt = (v, now) => {
    const r = v.ramp;
    if (!r || now >= r.t1) return r ? r.to : v.lvl0;
    if (now <= r.t0) return r.from;
    return shape(r.from, r.to, (now - r.t0) / (r.t1 - r.t0));
  };
  function ramp(v, to, secs) {
    const now = ctx.currentTime, from = levelAt(v, now), p = v.g.gain;
    p.cancelScheduledValues(now);
    p.setValueAtTime(from, now);
    if (!(secs > 0) || from === to) { p.setValueAtTime(to, now); v.ramp = { from: to, to, t0: now, t1: now }; return; }
    for (let k = 1; k <= 8; k++) p.linearRampToValueAtTime(shape(from, to, k / 8), now + secs * k / 8);
    v.ramp = { from, to, t0: now, t1: now + secs };
  }
  const gainNode = (v, dest) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest); return g; };

  /* ── the context + the graph ──
     master (the on/off fade) → speakers; musicBus (the duck) and ambBus → master */
  function makeCtx() {
    const t0 = performance.now();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    try { ctx = new AC({ latencyHint: 'playback' }); } catch { ctx = new AC(); }
    log.ctxMs = +(performance.now() - t0).toFixed(1);
    ctx.onstatechange = () => { if (want && !document.hidden && ctx.state !== 'running' && ctx.state !== 'closed') arm(); };
    master = { g: gainNode(0, ctx.destination), lvl0: 0 };
    musicBus = { g: gainNode(1, master.g), lvl0: 1 };
    ambBus = { g: gainNode(1, master.g), lvl0: 1 };
    if (ducked) ramp(musicBus, LEVEL.duck, 0);
    kick();
  }
  function kick() {                             // resume + the classic iOS unlock: one silent sample, now
    ctx.resume?.().catch(() => {});
    try {
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    } catch { /* not needed everywhere */ }
  }

  /* ── decks: the <audio> pool the music streams through ── */
  function makeDecks() {
    decks = [];
    for (let i = 0; i < POOL; i++) {
      const el = new Audio();
      el.preload = 'none';
      el.setAttribute('playsinline', '');
      const d = { i, el, src: null, g: null, lvl0: 0, role: null, key: null, file: null, target: 0, looped: false, playing: false };
      el.addEventListener('ended', () => { if (d.role === 'tail' || d.role === 'music') release(d); });
      el.addEventListener('playing', () => { if (d.file) log.plays.push({ deck: i, file: d.file, at: +(performance.now() / 1000).toFixed(2) }); });
      decks.push(d);
    }
  }
  function unlockDecks() {                      // IN the gesture: each element plays once (silence)
    /* WebKit needs every element unlocked by a gesture; Chromium only needs ONE
       silent element to open the device (sticky activation covers the rest) —
       starting four media pipelines at once cost a dropped frame there */
    for (const d of (DEFER_CTX ? decks.slice(0, 1) : decks)) {
      if (d.file) continue;                     // a deck with a track re-plays in play() below
      d.el.src = silentURL();
      const p = d.el.play();                    // it ends by itself (1 s); pausing early let Chrome close the device
      if (p && p.catch) p.catch(() => {});
    }
  }
  function wire(d) {
    if (d.src) return;
    d.src = ctx.createMediaElementSource(d.el);
    d.g = gainNode(0, musicBus.g);
    d.src.connect(d.g);
  }
  function play(d) {
    d.playing = true;
    const p = d.el.play();
    if (p && p.catch) p.catch(e => {
      if (e && e.name === 'AbortError') return; // a src change / release interrupted it
      log.rejects++;
      d.playing = false;
      if (want) arm();                          // the next tap plays it (inside that gesture)
    });
  }
  function release(d) {
    d.el.pause();
    d.el.removeAttribute('src');
    try { d.el.load(); } catch { /* */ }
    if (d.g) ramp(d, 0, 0);
    Object.assign(d, { role: null, key: null, file: null, target: 0, looped: false, playing: false });
  }
  function takeDeck(key) {
    const pre = decks.find(d => d.role === 'prefetch' && d.key === key);
    if (pre) return pre;
    let d = decks.find(x => !x.role) || decks.find(x => x.role === 'prefetch');
    if (!d) {                                   // all busy (rapid switching): the quietest fading one
      const now = ctx.currentTime;
      d = decks.filter(x => x.target === 0).sort((a, b) => levelAt(a, now) - levelAt(b, now))[0] || decks[0];
    }
    if (d.role) release(d);
    return d;
  }
  function startTrack(key, fade) {
    const d = takeDeck(key);
    wire(d);
    const file = MUSIC[key];
    if (d.file !== file) {
      d.el.preload = 'auto';
      d.el.src = DIR + file + '.m4a';
      d.file = file;
      log.requests.push(file);
    } else if (d.el.currentTime > 0) d.el.currentTime = 0;
    Object.assign(d, { role: 'music', key, looped: false, target: LEVEL.music });
    ramp(d, 0, 0);
    ramp(d, LEVEL.music, fade);
    play(d);
    return d;
  }

  /* ── ambience: decoded loops ── */
  let decodeChain = Promise.resolve();         // PHONE: one decode at a time
  function loadAmb(key) {
    if (bufs[key]) return Promise.resolve(bufs[key]);
    const job = async () => {
      const a = AMB[key];
      log.requests.push(a.file);
      const ab = await (await fetch(DIR + a.file + '.m4a')).arrayBuffer();
      const dec = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
      return (bufs[key] = loopBuffer(ctx, dec, a.frames));
    };
    const p = PHONE ? (decodeChain = decodeChain.then(job, job)) : job();
    bufs[key] = p;
    p.catch(e => { console.warn('[sound] ambience failed', key, e); delete bufs[key]; });
    return p;
  }
  function startAmb(key, lvl, fade) {
    const v = { key, g: gainNode(0, ambBus.g), lvl0: 0, target: lvl, node: null };
    amb.push(v);
    const b = bufs[key];
    const go = info => {
      if (!amb.includes(v) || v.target === 0) return;
      const n = ctx.createBufferSource();
      n.buffer = info.buf;
      n.loop = true;
      n.connect(v.g);
      n.start();
      v.node = n;
      ramp(v, v.target, fade || FADE.on);   // the first loop of an enable fades in with the master
    };
    if (b && !b.then) go(b); else loadAmb(key).then(go, () => {});
  }
  function stopAmb(v, fade) {
    v.target = 0;
    if (!v.node) { amb.splice(amb.indexOf(v), 1); v.g.disconnect(); return; }
    ramp(v, 0, fade);
    setTimeout(() => {
      if (v.target !== 0) return;
      try { v.node.stop(); } catch { /* */ }
      v.node.disconnect(); v.g.disconnect();
      const i = amb.indexOf(v); if (i >= 0) amb.splice(i, 1);
      /* PHONE: keep only the loop in use decoded */
      if (PHONE && !amb.some(x => x.key === v.key)) delete bufs[v.key];
    }, (fade + .15) * 1000);
  }

  /* ── the scene: which track, which loop, how loud ── */
  function want_scene() {
    if (!G.started || G.introActive) return { key: 'title', night: false };
    const m = CFG.MOMENTS[G.momentIndex];
    /* no moment while started = a switch in flight: the tour sets momentIndex −1
       under the veil to force a full switch. Hold what is playing — the first
       version went back to the title track for those ~280 ms on every cut. */
    if (!m) return scene ? { ...scene } : { key: 'title', night: false };
    return { key: m.id, night: !!G.night };
  }
  function setScene(s, fade) {
    /* music */
    const cur = decks.find(d => d.role === 'music' && d.key === s.key && d.target > 0);
    if (!cur) {
      for (const d of decks) if ((d.role === 'music' || d.role === 'tail') && d.target > 0) { d.target = 0; d.role = 'out'; ramp(d, 0, fade); }
      startTrack(s.key, fade);
    }
    /* ambience */
    const ak = s.night ? 'night' : 'ocean', lvl = s.key === 'brunch' ? LEVEL.ambBrunch : LEVEL.amb;
    const live = amb.find(v => v.key === ak && v.target > 0);
    for (const v of [...amb]) if (v !== live && v.target > 0) stopAmb(v, fade);
    if (live) { if (live.target !== lvl) { live.target = lvl; if (live.node) ramp(live, lvl, fade); } }
    else startAmb(ak, lvl, fade);
    scene = s;
  }

  /* ── housekeeping while sounding: loops, finished fades, the tour's next track ── */
  function tick() {
    if (!ctx || !sounding) return;
    const now = ctx.currentTime;
    for (const d of decks) {
      if (d.role === 'out' && now >= (d.ramp?.t1 ?? 0) + .1) release(d);
      /* the loop: a second deck on the same file LOOP_OVERLAP s before the end */
      if (d.role === 'music' && d.target > 0 && !d.looped && Number.isFinite(d.el.duration) && d.el.duration > 20
          && d.el.duration - d.el.currentTime <= LOOP_OVERLAP) {
        d.looped = true;
        d.role = 'tail';                        // plays out its own fade, released on 'ended'
        const nd = takeDeck(d.key);
        wire(nd);
        if (nd.file !== d.file) { nd.el.preload = 'auto'; nd.el.src = d.el.currentSrc || d.el.src; nd.file = d.file; }
        else nd.el.currentTime = 0;
        Object.assign(nd, { role: 'music', key: d.key, looped: false, target: d.target });
        ramp(nd, levelAt(d, now), 0);           // at full level: the files' own fades are the crossfade
        play(nd);
        log.loops++;
        log.requests.push(nd.file + ' (loop)');
      }
    }
    prefetchNext();
  }
  /* the guided tour only: buffer the next moment's track on a spare deck, in idle time */
  function prefetchNext() {
    if (!G.tourActive || !G.tour || !scene) return;
    const st = G.tour.state, next = G.tour.segments[st.seg + 1];
    if (!next || st.segId !== scene.key || prefetchFor === next.id) return;
    if (decks.some(d => d.role === 'out')) return;   // after the switch's own fade
    prefetchFor = next.id;
    const idle = window.requestIdleCallback || (f => setTimeout(f, 600));
    idle(() => {
      if (!sounding || !G.tourActive || prefetchFor !== next.id) return;
      if (decks.some(d => (d.role === 'music' || d.role === 'prefetch') && d.key === next.id)) return;
      for (const x of decks) if (x.role === 'prefetch') release(x);   // a stale one (the film jumped)
      const d = decks.find(x => !x.role);
      if (!d) return;
      d.role = 'prefetch'; d.key = next.id; d.file = MUSIC[next.id];
      d.el.preload = 'auto';
      d.el.src = DIR + d.file + '.m4a';
      d.el.load();
      log.requests.push(d.file + ' (prefetch)');
    }, { timeout: 2000 });
  }

  /* ── on / off ── */
  function begin() {                            // the context is up: sound the current scene
    if (!want || document.hidden) return;
    for (const d of decks) if (d.file && d.target > 0 && d.el.paused) play(d);
    const s = want_scene();
    if (!scene || s.key !== scene.key || s.night !== scene.night) setScene(s, scene ? FADE.moment : 0);
    ramp(master, 1, FADE.on);
    sounding = true;
    clearTimeout(offTimer);
    if (!pump) pump = setInterval(tick, PUMP_MS);
  }
  function start() {                            // ⚠ called INSIDE a gesture handler
    if (!AC || !want) return;
    disarm();
    const t0 = performance.now();
    if (!decks) makeDecks();
    unlockDecks();
    if (ctx) {
      kick();
      for (const d of decks) if (d.file && d.target > 0) play(d);   // in the gesture: a re-play iOS accepts
      begin();
    } else if (!DEFER_CTX) {
      makeCtx();
      begin();                                  // the first track's play() — inside the gesture
    } else if (!ctxPending) {
      /* Chromium: let the silent element open the audio device first (off the
         main thread), then build the context — see THE TAP */
      ctxPending = true;
      const t1 = performance.now();
      let done = false;
      const go = () => {
        if (done) return; done = true;
        ctxPending = false;
        log.ctxAfterMs = +(performance.now() - t1).toFixed(0);
        if (!want || ctx) return;
        makeCtx();
        begin();
      };
      /* 'playing' comes ~100–140 ms after the tap; the device finishes opening a
         little after that (a context made AT 'playing' still cost 5–20 ms,
         made 250 ms later ~1 ms — measured) */
      decks[0].el.addEventListener('playing', () => setTimeout(go, 250), { once: true });
      setTimeout(go, 700);
    }
    log.tapMs = +(performance.now() - t0).toFixed(1);
    /* a gesture the browser did not count (iOS is picky) leaves it suspended */
    setTimeout(() => { if (want && ctx && ctx.state !== 'running' && !document.hidden) arm(); }, 600);
  }
  function stop() {
    sounding = false;
    if (!ctx) return;
    ramp(master, 0, FADE.off);
    clearTimeout(offTimer);
    offTimer = setTimeout(() => {
      if (want) return;                         // turned back on inside the fade
      for (const d of decks) if (!d.el.paused) d.el.pause();
      clearInterval(pump); pump = 0;
      ctx.suspend().catch(() => {});
    }, (FADE.off + .1) * 1000);
  }
  function set(on) {
    want = on;
    store(on ? '1' : '0');
    if (on) start(); else { disarm(); stop(); }
    paint();
  }
  const toggle = () => set(!want);

  /* ── armed: the first gesture anywhere starts (or resumes) it ── */
  const GESTURES = ['pointerup', 'touchend', 'click', 'keydown'];
  function onGesture(e) {
    if (!want) return disarm();
    if (e.target && e.target.closest && e.target.closest('[data-sound-toggle]')) return;   // the toggle decides for itself
    if (e.type === 'keydown' && (e.key === 'Escape' || e.metaKey || e.ctrlKey || e.altKey || e.code === 'KeyM')) return;   // not an activation / M toggles itself
    start();
  }
  function arm() {
    if (armed || !want) return;
    armed = true;
    for (const g of GESTURES) addEventListener(g, onGesture, true);
    paint();
  }
  function disarm() {
    if (!armed) return;
    armed = false;
    for (const g of GESTURES) removeEventListener(g, onGesture, true);
    paint();
  }

  /* ── the toggles: every [data-sound-toggle], one delegated listener ── */
  const toggles = () => document.querySelectorAll('[data-sound-toggle]');
  function paint() {
    const on = want && !!AC;
    for (const b of toggles()) {
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('on', on);
      b.classList.toggle('armed', on && armed);
      const u = b.querySelector('use');
      if (u) u.setAttribute('href', on ? '#i-sound' : '#i-mute');
      const l = b.querySelector('.lbl');
      if (l) l.textContent = t(on ? 'snd.on' : 'snd.off');
      b.setAttribute('aria-label', t(on ? 'snd.onAria' : 'snd.offAria'));
      if (!AC) b.hidden = true;
    }
  }
  onLang(paint);
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-sound-toggle]');
    if (!b) return;
    e.preventDefault();
    b.blur();                                   // Space is fly-ascend (the #begin gotcha)
    toggle();
  });
  /* M, anywhere but a text field (during the film tour.js routes it as a tour key) */
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    toggle();
  });

  /* ── visibility: WeChat to the background, the phone locked, a tab switch ── */
  function hide() {
    if (!ctx) return;
    for (const d of decks) if (!d.el.paused) { d.el.pause(); d.resume = true; }
    clearInterval(pump); pump = 0;
    if (ctx.state === 'running') ctx.suspend().catch(() => {});
  }
  function show() {
    if (!ctx || !want || document.hidden) return;
    const p = ctx.resume ? ctx.resume() : Promise.resolve();
    p.then(() => {
      if (ctx.state !== 'running') return arm();     // the browser wants a new gesture
      for (const d of decks) if (d.resume) { d.resume = false; if (d.file && d.role !== 'prefetch') play(d); }
      if (sounding && !pump) pump = setInterval(tick, PUMP_MS);
    }).catch(arm);
    /* iOS can leave resume() pending forever after an interruption */
    setTimeout(() => { if (want && ctx.state !== 'running') arm(); }, 600);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
  addEventListener('pagehide', hide);
  addEventListener('pageshow', e => { if (e.persisted) show(); });

  /* ── per frame (G.tickers): follow the moment and the light ── */
  (G.tickers ||= []).push(() => {
    if (!sounding || !ctx || document.hidden) return;
    const s = want_scene();
    if (s.key === scene.key && s.night === scene.night) return;
    setScene(s, s.key !== scene.key ? FADE.moment : FADE.light);
  });

  /* narration (ui.js): the music steps back while a blurb is up */
  function duck(on) {
    on = !!on;
    if (on === ducked) return;
    ducked = on;
    if (ctx) ramp(musicBus, on ? LEVEL.duck : 1, on ? FADE.duckDown : FADE.duckUp);
  }

  G.sound = {
    toggle, set, duck,
    get on() { return want; },
    get armed() { return armed; },
    get ctx() { return ctx; },
    get state() { return { want, armed, ctx: ctx ? ctx.state : null, sounding, decks: !!decks }; },
    /* tests + the mix recorder (tools/sound-test.mjs) */
    stats() {
      const now = ctx ? ctx.currentTime : 0;
      return {
        want, armed, sounding, ducked, ctx: ctx ? ctx.state : null, rate: ctx ? ctx.sampleRate : null,
        scene: scene && { ...scene },
        master: ctx ? +levelAt(master, now).toFixed(3) : 0, musicBus: ctx ? +levelAt(musicBus, now).toFixed(3) : 1,
        decks: (decks || []).map(d => ({ i: d.i, role: d.role, key: d.key, file: d.file, target: d.target,
          level: ctx && d.g ? +levelAt(d, now).toFixed(3) : 0, paused: d.el.paused, t: +d.el.currentTime.toFixed(2),
          dur: Number.isFinite(d.el.duration) ? +d.el.duration.toFixed(2) : null, ready: d.el.readyState })),
        amb: amb.map(v => ({ key: v.key, target: v.target, level: ctx ? +levelAt(v, now).toFixed(3) : 0, playing: !!v.node })),
        bufs: Object.fromEntries(Object.entries(bufs).map(([k, b]) => [k, b.then ? 'loading' : { len: b.len, skip: b.skip, extra: b.extra, rate: b.buf.sampleRate }])),
        log: { ...log, requests: [...log.requests], plays: [...log.plays] },
      };
    },
    _debug: { get master() { return master && master.g; }, bufs, get decks() { return decks; } },
  };

  if (want && AC) arm();
  paint();
  return G.sound;
}
