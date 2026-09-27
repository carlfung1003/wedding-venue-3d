// tour.js — "Take the tour" (KAN-233): a hands-free, ~2¼-minute film of the
// wedding. A scripted camera glides through all six moments in chronological
// order (brunch → prewedding → ceremony → cocktail → dinner → after party),
// each composed on that moment's hero shot, with the KAN-218 veil + title
// reveal between them, the blurb at its beat, and a closing card at the end.
//
// House precedent: js/introcam.js (the opening dive). Like it, this module OWNS
// THE CAMERA while it runs and hands it to player.js when it stops — main.js
// calls updateTour() instead of updatePlayer() while G.tourActive is true.
//
// ── THE TAKEOVER CONTRACT ──────────────────────────────────────────────────
// Any real input — a key that is not a tour key, a mouse press or a touch on
// the canvas — ends the tour on the spot and gives the guest the walk:
//   · feet on floorY at a standing spot for the CURRENT moment (standSpot):
//     the camera's own ground point if it is valid, else the nearest of the
//     segment's authored stand points, else the moment's spawn (known good);
//     "valid" = floorY within ±0.35 m of the moment's own floor (so never the
//     pool basin, a plinth, a roof edge drop) and clear of every live collider
//     by collider.r + PLAYER_R + 5 cm at that feet height;
//   · facing the camera's heading (yaw kept, pitch levelled) — no snap;
//   · walk mode, the touch UI back, the pointer lock taken if the input was a
//     gesture (a key or a press — never Esc, which cannot lock);
//   · one "You're walking now" system card.
// Tour keys (never a takeover): Space pause/resume · ← → previous/next moment ·
// Esc exit to the walk · H / ? the help sheet (the tour pauses while it is open).
// Buttons (the tour bar, the timeline, the HUD) are never a takeover either.
//
// ── PATH AUTHORING ─────────────────────────────────────────────────────────
// SEGMENTS below, one per moment id. Positions and look targets are authored in
// the frame their moment lives in and mapped ONCE, here:
//   E(x, y, z)       enclave-LOCAL x/z (site.js MOMENT_PLACES_LOCAL's frame) →
//                    world through enclaveToWorld; y is absolute metres (every
//                    enclave moment is at grade 0);
//   R(th, r, h)      the hotel roof — polar on HOTEL_ROOF (world, NOT enclave:
//                    the brunch is the one world-space moment), h metres above
//                    the terrace deck (SITE.HOTEL.ROOFTOP.deckY).
// Each segment: `dur` seconds, `pos` + `look` keys (a centripetal Catmull-Rom
// through each, evaluated by arc length on ONE smootherstep of the segment
// clock, so it starts and ends at rest — every cut happens under the veil),
// `beat` = when the blurb shows (s), `stand` = authored standing points for a
// takeover. Pitch is clamped to ±PITCH_MAX and there is never roll. Keep the
// average speed ≲ 1 m/s (the tests print each segment's).
//
// ── REDUCED MOTION ─────────────────────────────────────────────────────────
// prefers-reduced-motion: no flying. Each segment is two STATIC framed shots
// (its first and last key) held for half its length each, and every cut — the
// shot change and the moment switch — is a cross-fade: the current frame is
// drawn into #tourFade (a 2D canvas over the scene), the view cuts underneath,
// and the snapshot fades out. The moment switch itself is ui.go's reduced path
// (no veil, the title still named).
//
// ── PERFORMANCE ────────────────────────────────────────────────────────────
// No light, no material, no program: the tour only moves G.camera and calls
// G.setMoment through ui.go — the same switch the timeline makes, which the
// loading warm-up already compiled for all six moments and both lighting
// states. The light budget, the detail cull and the mirror frustum all read
// G.camera every frame, so they keep working while it moves.
import * as THREE from 'three';
import { CFG, momentIndex } from './config.js';
import { SITE, HOTEL_ROOF, enclaveToWorld } from './site.js';
import { floorY } from './world.js';
import { setFacing, syncCamera, lock } from './player.js';
import { t, mt, onLang } from './i18n.js';

const PITCH_MAX = 0.28;          // rad — the camera never looks further up/down than this
const DECK_Y = SITE.HOTEL.ROOFTOP.deckY;

const E = (x, y, z) => { const w = enclaveToWorld(x, z); return new THREE.Vector3(w.x, y, w.z); };
const R = (th, r, h) => { const p = HOTEL_ROOF.pt(th, r); return new THREE.Vector3(p.x, DECK_Y + h, p.z); };
/* a far point along a world heading, for "look out to sea" targets */
const FAR = (from, yaw, dist, y) => new THREE.Vector3(from.x - Math.sin(yaw) * dist, y, from.z - Math.cos(yaw) * dist);

/* ── THE FILM ───────────────────────────────────────────────────────────────
   Enclave-local reminders (site.js): +Z is seaward (world west), the hero pool
   is x ±5, z −3.5…21.5 (water .40), the suite's glass wall is z −13.5, the deck
   z −13.5…−6.5, the turf z −6.5…−4; the beachfront lawn z 58…75 (aisle x −22,
   arch z 71, rows z 62…66; the round bar at (4, 68)); the dinner lawns x −23…−11
   and −39…−27 at z −5…15. The roof: arc centre (156, 10), tables at r 99, the
   pool r 90.1…96.4 over poolTc ± poolTh. */
function buildSegments() {
  const RT = SITE.HOTEL.ROOFTOP;
  const T = RT.poolTc, TH = RT.poolTh;
  const W = Math.PI / 2;       // world yaw: due west, out to sea
  const brunchP0 = R(T + TH * .78, 93.4, 1.55);
  return [
    { id: 'brunch', dur: 22, beat: 6.5,   // after the one-line hint
      /* over the rooftop pool near its north end, gliding south along the
         water with the dressed four-tops on the left, then easing round to
         face due west over the infinity edge — "nothing past the pool but the
         sea". The camera is over the water (1.5 m above the deck); a takeover
         lands on the teak between two tables. */
      pos: [brunchP0, R(T + TH * .25, 94.2, 1.75), R(T - TH * .22, 95.2, 1.9)],
      look: [R(T - TH * .55, 99.5, .9), FAR(R(T + TH * .25, 94.2, 1.75), W + .62, 220, DECK_Y - 2),
        FAR(R(T - TH * .22, 95.2, 1.9), W + .22, 260, DECK_Y - 4)],
      stand: [R(T, 97.9, 0), R(T + TH * .35, 97.9, 0), R(T - TH * .35, 97.9, 0)] },
    { id: 'setup', dur: 24, beat: 5,
      /* THE SIGNATURE: low over the west half of the hero pool at night, the
         lanterns drifting past below, trucking in up the water toward the lit
         suite with its glass wall folded open. */
      pos: [E(-4.6, 3.3, 22.5), E(-3.9, 2.2, 15.5), E(-3.5, 1.9, 10.8)],
      look: [E(0, 1.7, -14), E(.6, 2.3, -16), E(1.0, 2.4, -16)],
      stand: [E(-6.3, 0, 10), E(-6.2, 0, 6.4), E(0, 0, -5.6)] },
    { id: 'ceremony', dur: 24, beat: 5,
      /* up the petal-strewn aisle from the palm-belt gap, descending from 3 m
         to eye height, the arch frames and the sea ahead. */
      pos: [E(-22, 3.2, 53.2), E(-22, 2.4, 58.4), E(-22, 1.75, 63.2)],
      look: [E(-22, 2.2, 82), E(-22, 2.0, 86), E(-22, 2.1, 90)],
      stand: [E(-22, 0, 60), E(-22, 0, 66.5), E(-22, 0, 56)] },
    { id: 'cocktail', dur: 20, beat: 4,
      /* same lawn, the round timber bar: a gentle arc in toward it with the
         parasols and high-tops around it and the sea behind the bar. */
      pos: [E(6.4, 2.3, 55.6), E(5.0, 2.0, 58.2), E(4.6, 1.8, 60.4)],
      look: [E(4.6, 1.0, 68), E(4.3, 1.05, 68.6), E(4.4, 1.1, 69.4)],
      stand: [E(4, 0, 58.5), E(3.2, 0, 62.5), E(1.6, 0, 60)] },
    { id: 'dinner', dur: 22, beat: 4.5,
      /* up the inner dinner lawn between the rounds, the festoon lattice
         strung overhead, the lit hero pool on the left. */
      pos: [E(-17, 2.7, -7.5), E(-17.1, 2.2, -3), E(-17.2, 1.9, 1.4)],
      look: [E(-19, 2.6, 12), E(-19.5, 3.0, 16), E(-20, 3.2, 20)],
      stand: [E(-17, 0, -3), E(-17, 0, 2), E(-17, 0, 5)] },
    { id: 'afterparty', dur: 24, beat: 5,
      /* the DJ deck from the turf, sliding across it and rising a little at
         the east end to take in the booth, the mirror ball and the lit suite —
         the last shot, held under the closing card. It stays on the DECK side
         of the turf band: from the pool side the WESTIN letters read mirrored. */
      pos: [E(-3.8, 1.8, -5.4), E(1.2, 2.0, -5.6), E(4.2, 2.4, -4.9)],
      look: [E(0, 1.35, -12.1), E(.2, 1.7, -12.4), E(-1.0, 2.1, -12.8)],
      stand: [E(0, 0, -10), E(2, 0, -5.4), E(-3, 0, -6)] },
  ];
}

export function initTour(G) {
  const el = id => document.getElementById(id);
  const bar = el('tourBar'), endCard = el('tourEnd'), fade = el('tourFade');
  const playBtn = el('tourPlay'), prevBtn = el('tourPrev'), nextBtn = el('tourNext'), exitBtn = el('tourExit');
  const ticks = [...bar.querySelectorAll('.tp i')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const SEG = buildSegments().map(s => ({
    ...s,
    idx: momentIndex(s.id),
    posC: new THREE.CatmullRomCurve3(s.pos, false, 'centripetal'),
    lookC: new THREE.CatmullRomCurve3(s.look, false, 'centripetal'),
  }));
  for (const s of SEG) if (s.idx < 0) console.warn('[tour] unknown moment', s.id);

  const st = {
    active: false, ended: false, paused: false,
    seg: 0, t: 0, hold: true, beatDone: false, shot: -1,
    queued: -1, last: 0,
  };
  const _p = new THREE.Vector3(), _l = new THREE.Vector3();

  const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);

  /* the pose at segment time tt: position, yaw, pitch (world) */
  function poseAt(s, tt) {
    if (reduced.matches) {
      const k = tt < s.dur / 2 ? 0 : s.pos.length - 1;
      _p.copy(s.pos[k]); _l.copy(s.look[k]);
    } else {
      /* clamped AFTER the smootherstep too: at tt ≈ dur (23.9999 of 24) it can
         overshoot 1 by an ulp, and getPointAt(u > 1) indexes past the last
         point — a TypeError that ended the film without its closing card
         (caught by tour-test's phone beats run, ~1 in 5; KAN-234) */
      const u = Math.min(1, Math.max(0, smoother(THREE.MathUtils.clamp(tt / s.dur, 0, 1))));
      s.posC.getPointAt(u, _p);
      s.lookC.getPointAt(u, _l);
    }
    const dx = _l.x - _p.x, dy = _l.y - _p.y, dz = _l.z - _p.z;
    const yaw = Math.atan2(-dx, -dz);                 // player.js: fwd = (−sin y, 0, −cos y)
    const pitch = THREE.MathUtils.clamp(Math.atan2(dy, Math.hypot(dx, dz)), -PITCH_MAX, PITCH_MAX);
    return { x: _p.x, y: _p.y, z: _p.z, yaw, pitch };
  }
  function apply(pose) {
    const c = G.camera;
    c.position.set(pose.x, pose.y, pose.z);
    c.rotation.set(0, 0, 0);          // same composition as syncCamera: yaw, then pitch, no roll
    c.rotateY(pose.yaw);
    c.rotateX(pose.pitch);
    st.pose = pose;
  }

  /* ── the cross-fade (reduced motion): the frame that is up, drawn into a 2D
     canvas over the scene, faded out while the new view shows underneath.
     render() + drawImage in the same task reads the fresh drawing buffer, so
     no preserveDrawingBuffer (which would cost every frame) is needed. */
  function snapshot() {
    try {
      const w = innerWidth, h = innerHeight;
      if (fade.width !== w || fade.height !== h) { fade.width = w; fade.height = h; }
      G.renderer.render(G.scene, G.camera);
      fade.getContext('2d').drawImage(G.canvas, 0, 0, w, h);
      fade.classList.remove('fading');
      fade.classList.add('on');
      void fade.offsetWidth;
      requestAnimationFrame(() => requestAnimationFrame(() => { fade.classList.add('fading'); fade.classList.remove('on'); }));
    } catch (e) { /* a cut without the fade is still a cut */ }
  }

  /* ── UI ── */
  function paintBar() {
    const p = st.paused;
    playBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
    playBtn.setAttribute('aria-label', t(p ? 'tour.play' : 'tour.pause'));
    playBtn.setAttribute('aria-pressed', p ? 'true' : 'false');
    prevBtn.setAttribute('aria-label', t('tour.prev'));
    nextBtn.setAttribute('aria-label', t('tour.next'));
    exitBtn.setAttribute('aria-label', t('tour.exitAria'));
    bar.classList.toggle('paused', p);
  }
  function paintProgress() {
    const f = st.ended ? 1 : THREE.MathUtils.clamp(st.t / SEG[st.seg].dur, 0, 1);
    ticks.forEach((tk, i) => tk.style.transform = `scaleX(${i < st.seg || st.ended ? 1 : i === st.seg ? f : 0})`);
    const chip = document.querySelector('#moments .chip.active');
    if (chip) chip.style.setProperty('--tp', f.toFixed(3));
  }
  function clearChipProgress() {
    for (const c of document.querySelectorAll('#moments .chip')) c.style.removeProperty('--tp');
  }

  /* ── segments ── */
  function startSegment(i) {
    i = THREE.MathUtils.clamp(i, 0, SEG.length - 1);
    if (G.ui.isSwitching && G.ui.isSwitching()) { st.queued = i; return; }
    st.queued = -1;
    const s = SEG[i];
    st.seg = i; st.t = 0; st.hold = true; st.beatDone = false; st.shot = 0; st.ended = false;
    endCard.classList.add('hidden');
    bar.classList.remove('hidden');
    clearChipProgress();
    if (reduced.matches) snapshot();
    G.momentIndex = -1;                          // a full switch even onto the moment already dressed
    G.ui.go(s.idx, {
      quiet: true,                               // the blurb comes at the segment's own beat
      before() {
        G.introActive = false;
        if (!st.active) return;
        apply(poseAt(s, 0));
      },
      after() {
        if (!st.active || st.seg !== i) return;
        apply(poseAt(s, 0));                     // setMoment's syncCamera put it at the spawn
        st.hold = false;
      },
    });
  }

  function finish() {
    st.ended = true;
    paintProgress();
    bar.classList.add('hidden');
    endCard.classList.remove('hidden');
    endCard.classList.remove('in'); void endCard.offsetWidth; endCard.classList.add('in');
    const first = endCard.querySelector('button');
    if (first && !G.touchMode) first.focus({ preventScroll: true });
  }

  function start(i = 0, opts = {}) {
    const fromTitle = !G.started;
    st.active = true; st.paused = false; st.ended = false;
    G.tourActive = true;
    G.started = true;
    G.overlayOpen = false;
    G.player.nearest = null;
    G.ui.prompt(null);
    if (G.mode !== 'walk') G.setMode('walk', { quiet: true });
    document.exitPointerLock?.();
    document.body.classList.add('touring');
    if (fromTitle) { G.ui.hideOverlay(); G.ui.showHUD(); }
    paintBar();
    startSegment(i);
    /* one line of instruction, after the first title has shown */
    G.ui.toast(() => t(G.touchMode ? 'tour.hintTouch' : 'tour.hintKeys'), 3.6, false, { kind: 'system', channel: 'tour' });
    if (opts.announce !== false) setURL(true);
  }

  /* ?tour=1 while the film runs, gone once the guest walks — a copied address
     restarts the film only if it was copied during the film */
  function setURL(on) {
    try {
      const u = new URL(location.href);
      if (on) u.searchParams.set('tour', '1'); else u.searchParams.delete('tour');
      if (u.href !== location.href) history.replaceState(history.state, '', u);
    } catch { /* sandboxed */ }
  }

  function valid(p, base) {
    const f = floorY(p.x, p.z, base + .3);
    if (!Number.isFinite(f) || Math.abs(f - base) > .35) return null;
    if (Math.abs(p.x) > CFG.WORLD_BOUND || Math.abs(p.z) > CFG.WORLD_BOUND) return null;
    for (const c of G.colliders) {
      if (c.y0 !== undefined && f < c.y0) continue;
      if (c.y1 !== undefined && f >= c.y1) continue;
      if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + CFG.PLAYER_R + .05) return null;
    }
    return f;
  }
  /* the takeover's standing spot for the CURRENT moment (see the contract up top) */
  function standSpot() {
    const m = CFG.MOMENTS[G.momentIndex];
    if (!m) return null;
    const base = m.spawn.y || 0;
    const cam = G.camera.position;
    const s = SEG.find(x => x.idx === G.momentIndex);
    const cands = [{ x: cam.x, z: cam.z, why: 'camera' }];
    if (s) {
      for (const p of [...s.stand].sort((a, b) => Math.hypot(a.x - cam.x, a.z - cam.z) - Math.hypot(b.x - cam.x, b.z - cam.z))) {
        cands.push({ x: p.x, z: p.z, why: 'stand' });
      }
    }
    for (const c of cands) {
      const f = valid(c, base);
      if (f !== null) return { x: c.x, z: c.z, feet: f, why: c.why };
    }
    return { x: m.spawn.x, z: m.spawn.z, feet: base, why: 'spawn' };
  }

  /* stop the film and give the guest the walk — the ONE exit path */
  function takeover(opts = {}) {
    if (!st.active) return;
    const switching = G.ui.isSwitching && G.ui.isSwitching();
    const yaw = st.pose ? st.pose.yaw : null;
    st.active = false; st.ended = false; st.queued = -1;
    G.tourActive = false;
    G.introActive = false;
    document.body.classList.remove('touring');
    bar.classList.add('hidden');
    endCard.classList.add('hidden');
    fade.classList.remove('on', 'fading');
    clearChipProgress();
    if (G.mode !== 'walk') G.setMode('walk', { quiet: true });
    let spot = null;
    /* mid-veil: ui.go is about to setMoment, which lands on that moment's
       spawn — a known-good standing spot — so leave the placement to it */
    if (!switching) {
      spot = standSpot();
      if (spot) {
        G.player.pos.set(spot.x, spot.feet + CFG.EYE_HEIGHT, spot.z);
        G.player.fallV = 0;
        setFacing(yaw ?? CFG.MOMENTS[G.momentIndex]?.spawn.yaw ?? 0);
        syncCamera(G);
      }
    }
    G.lastTakeover = { reason: opts.reason || 'input', spot, switching };
    if (G.touchMode && G.showTouchUI) G.showTouchUI();
    else if (opts.gesture) lock(G);
    G.ui.toast(() => t('tour.walking'), 2.8, true, { kind: 'system', channel: 'tour' });
    setURL(false);
  }

  function togglePause(force) {
    if (!st.active || st.ended) return;
    st.paused = force ?? !st.paused;
    paintBar();
  }
  const next = () => { if (!st.active) return; if (st.ended) return start(0, { announce: false }); if (st.seg < SEG.length - 1) startSegment(st.seg + 1); else { st.t = SEG[st.seg].dur; finish(); } };
  const prev = () => { if (!st.active) return; if (st.ended) return startSegment(SEG.length - 1); startSegment(st.t > 4 || st.seg === 0 ? st.seg : st.seg - 1); };

  /* ── input ── */
  playBtn.addEventListener('click', e => { e.currentTarget.blur(); togglePause(); });
  prevBtn.addEventListener('click', e => { e.currentTarget.blur(); prev(); });
  nextBtn.addEventListener('click', e => { e.currentTarget.blur(); next(); });
  exitBtn.addEventListener('click', e => { e.currentTarget.blur(); takeover({ reason: 'exit', gesture: true }); });
  el('tourAgain').addEventListener('click', e => { e.currentTarget.blur(); start(0, { announce: false }); });
  el('tourWalk').addEventListener('click', e => { e.currentTarget.blur(); takeover({ reason: 'end', gesture: true }); });
  for (const b of [el('tourStart'), el('tourBtn'), el('btnTour'), el('helpTour')]) {
    if (!b) continue;
    const from = b.id === 'tourBtn' || b.id === 'btnTour';
    const go = e => {
      e.currentTarget.blur();
      if (b.id === 'helpTour') G.ui.closeHelp();
      if (st.active) return;
      /* the HUD / touch button resumes the day from the moment you are in; the
         title card and the help sheet play it from the start */
      start(from && G.momentIndex >= 0 ? SEG.findIndex(s => s.idx === G.momentIndex) : 0);
    };
    b.addEventListener('click', go);
  }

  /* keys: WINDOW capture, so this runs before ui.js (document capture) and
     player.js (document bubble) — a tour key never reaches the walk */
  const PASS = /^(Key[WASD]|Shift(Left|Right)|Digit[1-9]|KeyN)$/;   // takeover AND let the walk see it
  addEventListener('keydown', e => {
    if (!st.active || G.helpOpen) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;              // browser shortcuts stay the browser's
    if (e.code === 'KeyH' || e.key === '?') return;               // the help sheet — the tour pauses under it
    const onButton = e.target && e.target.closest && e.target.closest('button');
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && onButton) return;   // activating a focused control
    if (e.code === 'Tab') { e.stopImmediatePropagation(); return; }           // focus moves; no cursor-mode toggle
    const tourKey = { Space: () => togglePause(), ArrowRight: next, ArrowLeft: prev,
      Escape: () => takeover({ reason: 'esc', gesture: false }) }[e.code];
    if (tourKey) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (!e.repeat) tourKey();
      return;
    }
    if (e.repeat) return;
    takeover({ reason: 'key:' + e.code, gesture: true });
    if (!PASS.test(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  /* a press on the view (mouse or touch) — pointerdown precedes touchstart and
     mousedown, so touch.js / player.js then see a normal walk gesture */
  G.canvas.addEventListener('pointerdown', () => {
    if (st.active) takeover({ reason: 'pointer', gesture: true });
  }, true);

  onLang(paintBar);

  /* ── per frame (main.js, instead of updatePlayer while G.tourActive) ── */
  function update() {
    const now = performance.now();
    const dt = Math.min(.1, Math.max(0, (now - (st.last || now)) / 1000));
    st.last = now;
    if (!st.active) return;
    if (st.queued >= 0 && !(G.ui.isSwitching && G.ui.isSwitching())) startSegment(st.queued);
    const s = SEG[st.seg];
    const running = !st.hold && !st.paused && !st.ended && !G.helpOpen && !document.hidden;
    if (running) st.t += dt;
    if (st.ended) { if (st.pose) apply(st.pose); return; }

    /* reduced motion: the shot changes at half time, under a cross-fade */
    if (reduced.matches && running) {
      const shot = st.t < s.dur / 2 ? 0 : 1;
      if (shot !== st.shot) { st.shot = shot; snapshot(); }
    }
    apply(poseAt(s, st.t));

    if (!st.beatDone && st.t >= s.beat) {
      st.beatDone = true;
      const m = CFG.MOMENTS[s.idx];
      G.ui.toast(() => mt(m, 'blurb'), 7.5, true);
    }
    paintProgress();
    if (st.t >= s.dur && !st.hold) {
      if (st.seg < SEG.length - 1) startSegment(st.seg + 1);
      else finish();
    }
  }

  G.tour = {
    get active() { return st.active; },
    get state() { return { ...st, pose: st.pose && { ...st.pose }, segId: SEG[st.seg]?.id, dur: SEG[st.seg]?.dur }; },
    segments: SEG.map(s => ({ id: s.id, dur: s.dur, beat: s.beat })),
    start, takeover, togglePause, next, prev,
    jump: i => { const k = SEG.findIndex(s => s.idx === i); if (st.active && k >= 0) startSegment(k); },
    /* tests: jump the clock of the current segment (paused or not) */
    seek(tt) { st.t = Math.max(0, tt); st.beatDone = st.t >= SEG[st.seg].beat; },
    poseAt: (k, tt) => ({ ...poseAt(SEG[k], tt) }),
    standSpot,
    update,
  };
  return G.tour;
}

export function updateTour(G) { if (G.tour) G.tour.update(); }
