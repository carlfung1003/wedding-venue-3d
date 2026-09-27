// sound.js — the ambient soundscape's switch (KAN-234). OFF BY DEFAULT.
//
// This module is the only audio code a guest downloads until they ask for
// sound. It owns the preference, the four toggles, the iOS / WeChat unlock, and
// visibility; the soundscape itself (js/audio/*) is imported LAZILY, from inside
// the tap that turns it on. Until then: no AudioContext, no audio module, no
// request, nothing on G.tickers but a no-op.
//
// ── THE PREFERENCE ────────────────────────────────────────────────────────
//   ?sound=1 / ?sound=0  forces it for this visit (not persisted — like ?lang)
//   localStorage 'venue.sound' = '1' | '0'  the guest's own toggle (try/catch)
//   default: off.
// A guest who wants sound but has not touched the page yet is ARMED: the
// toggles show "on", and the first real gesture anywhere (Step inside, Take the
// tour, a tap on the view…) starts it. Audio NEVER starts without a gesture.
//
// ── THE UNLOCK (iOS Safari, WeChat's WKWebView, Android WebViews) ──────────
// The AudioContext is created, resume()d and fed one silent sample SYNCHRONOUSLY
// inside the gesture's handler — the only place iOS lets a context start. The
// engine is imported after that (the context is already running, silently).
// navigator.audioSession.type = 'playback' (Safari 17+) so a phone on silent
// still plays what the guest explicitly turned on.
// Hidden page (tab switch, WeChat to the background, the phone locked): the
// pump stops and the context is suspended. Visible again / restored from the
// back-forward cache: resume() — and if the browser insists on a new gesture
// (iOS after an interruption), it is ARMED again and the next tap resumes it.
//
// ── THE TOGGLES ───────────────────────────────────────────────────────────
// Every element with [data-sound-toggle] (the HUD, the title card, the help
// sheet, the tour bar) — one delegated listener, like the language switch.
// M toggles it from the keyboard (tour.js routes M as a tour key).
import { CFG } from './config.js';
import { t, onLang } from './i18n.js';

const KEY = 'venue.sound';
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const store = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

export function initSound(G) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const q = (() => { try { return new URLSearchParams(location.search).get('sound'); } catch { return null; } })();
  let want = q === '1' ? true : q === '0' ? false : stored() === '1';
  let ctx = null, engine = null, loading = null;
  let armed = false, ducked = false;
  let lastKey = null, lastNight = null, lastL = 0;

  /* ── paint every toggle ── */
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

  /* ── the gesture path: create / resume the context INSIDE the handler ── */
  function unlock() {
    if (!ctx) {
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
      try { ctx = new AC({ latencyHint: 'playback' }); } catch { ctx = new AC(); }
      ctx.onstatechange = () => { if (want && !document.hidden && ctx.state !== 'running') arm(); };
    }
    ctx.resume?.().catch(() => {});
    try {                                          // the classic iOS unlock: one silent sample, now
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    } catch { /* not needed everywhere */ }
  }

  function start() {
    if (!AC || !want) return;
    disarm();
    unlock();
    /* a gesture the browser did not count (iOS is picky about which) leaves the
       context suspended — wait for the next one */
    setTimeout(() => { if (want && ctx && ctx.state !== 'running' && !document.hidden) arm(); }, 500);
    if (engine) { engine.run(); engine.fade(true, 1.2); lastKey = null; return; }
    if (loading) return;
    /* the engine is a separate module on purpose: nobody downloads it until now */
    loading = import('./audio/engine.js')
      .then(m => m.createEngine(ctx))
      .then(e => {
        engine = e;
        G.sound._engine = e;
        lastKey = null;
        scene(0);                                   // the bed for where they are, before the fade-in
        listen(true);
        if (want && !document.hidden) { engine.run(); engine.fade(true, 2.4); }
      })
      .catch(err => { console.warn('[sound] could not start', err); loading = null; });
  }

  function stop() {
    if (!engine) { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); return; }
    engine.fade(false, .6);
    setTimeout(() => {
      if (want) return;                              // turned back on inside the fade
      engine.pause();
      ctx.suspend().catch(() => {});
    }, 700);
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
    if (e.type === 'keydown' && (e.key === 'Escape' || e.metaKey || e.ctrlKey || e.altKey)) return;   // not a user activation
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

  /* ── one delegated listener for every toggle ── */
  document.addEventListener('click', e => {
    const b = e.target.closest?.('[data-sound-toggle]');
    if (!b) return;
    e.preventDefault();
    b.blur();                                      // Space is fly-ascend (the #begin gotcha)
    toggle();
  });
  /* M, anywhere but a text field (the tour routes it itself — tour.js) */
  addEventListener('keydown', e => {
    if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    toggle();
  });

  /* ── visibility: WeChat to the background, the phone locked, a tab switch ── */
  function hide() {
    if (!ctx) return;
    engine?.pause();
    if (ctx.state === 'running') ctx.suspend().catch(() => {});
  }
  function show() {
    if (!ctx || !want || document.hidden) return;
    const p = ctx.resume ? ctx.resume() : Promise.resolve();
    p.then(() => {
      if (ctx.state === 'running') { engine?.run(); if (engine) engine.fade(true, .8); }
      else arm();                                  // the browser wants a new gesture
    }).catch(arm);
    /* iOS can leave resume() pending forever after an interruption */
    setTimeout(() => { if (want && ctx.state !== 'running') arm(); }, 600);
  }
  document.addEventListener('visibilitychange', () => (document.hidden ? hide() : show()));
  addEventListener('pagehide', hide);
  addEventListener('pageshow', e => { if (e.persisted) show(); });

  /* ── per frame: which bed, where the ears are ── */
  function scene(fade = 2.6) {
    const m = CFG.MOMENTS[G.momentIndex];
    const key = (!G.started || G.introActive || !m) ? 'aerial' : m.id;
    const night = !!G.night;
    if (key === lastKey && night === lastNight) return;
    /* a new moment gets the full crossfade (it spans the veil); a light flip a quicker one */
    engine.setScene(key, night, { fade: lastKey === null ? .05 : key !== lastKey ? fade : 1.8 });
    lastKey = key; lastNight = night;
  }
  function listen(force) {
    const now = performance.now();
    if (!force && now - lastL < 100) return;        // 10 Hz is plenty for ears
    lastL = now;
    const c = G.camera, e = c.matrixWorld.elements;
    const m = CFG.MOMENTS[G.momentIndex];
    const floor = (!G.started || G.introActive || !m) ? 0 : (m.spawn.y || 0);
    engine.setListener({ x: c.position.x, y: c.position.y, z: c.position.z, fx: -e[8], fz: -e[10], floor });
  }
  (G.tickers ||= []).push(() => {
    if (!engine || !want || document.hidden || !engine.running()) return;
    scene();
    listen();
  });

  /* narration (ui.js): the music steps back while a blurb is up */
  function duck(on) {
    on = !!on;
    if (on === ducked) return;
    ducked = on;
    if (engine && want) engine.duck(on);
  }

  G.sound = {
    toggle, set, duck,
    get on() { return want; },
    get armed() { return armed; },
    get ctx() { return ctx; },
    get state() { return { want, armed, ctx: ctx ? ctx.state : null, engine: !!engine, loading: !!loading && !engine }; },
    _engine: null,
  };

  if (want && AC) arm();
  paint();
  return G.sound;
}
