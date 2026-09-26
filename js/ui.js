// The overlay UI (KAN-218). Still the house pattern — plain id-addressed DOM,
// no framework, toggled with classes — but every surface is now designed:
// the invitation, the moment caption, the dated timeline, the narration card,
// the interact prompt, the view status, the controls sheet, and the
// veil + title reveal that hides the teleport when a moment changes.
//
// CONTRACTS kept from before (other modules call these):
//   buildChips(moments) · setMoment(m, idx) · setMode(mode) · prompt(label)
//   toast(msg, secs, now[, opts]) · update(dt) · showHUD() · hideOverlay()
// New: go(i) — the UI's own moment switch (veil → G.setMoment → reveal);
//   revealMoment(m) · openHelp() · closeHelp().
// ⚠ G.setMoment itself is untouched and stays SYNCHRONOUS. Tests, the guest
// journey and tools/shoot-moments.mjs call it directly and get no veil and no
// reveal; only chips, the 1–6 keys and the landing of the dive go through go().
import { CFG } from './config.js';

const EMOJI = /\p{Extended_Pictographic}️?/gu;   // narration copy is typographic here
const clean = s => String(s).replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* dates are calendar dates, not instants — format them at noon UTC so no
   timezone can move one across midnight */
const at = d => new Date(d + 'T12:00:00Z');
const fmtLong = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtWk = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' });
const fmtDM = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fmtShort = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const whenLong = m => fmtLong.format(at(m.date)) + (m.time ? ` · ${m.time}` : '');
/* the caption's date: long on most screens, short where the phone is narrow
   (CSS picks one — both are real text, no truncation) */
const whenHTML = m => `<span class="l">${fmtLong.format(at(m.date))}</span><span class="s">${fmtShort.format(at(m.date))}</span>${m.time ? ` · ${m.time}` : ''}`;

export function initUI(G) {
  const el = id => document.getElementById(id);
  const overlay = el('overlay'), promptEl = el('prompt'), toastEl = el('toast');
  const toastEye = toastEl.querySelector('.eyebrow'), toastMsg = toastEl.querySelector('.msg');
  const nameEl = el('momentName'), bar = el('moments'), hud = el('hud');
  const modeBtn = el('modeBtn'), lightBtn = el('lightBtn'), helpBtn = el('helpBtn');
  const veil = el('veil'), reveal = el('reveal'), lockHint = el('lockHint');
  const help = el('help'), helpClose = el('helpClose'), helpDone = el('helpDone');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const chips = [], days = [];
  const queue = [];
  let cur = null, toastT = 0, gapT = 0;      // narration timing (seconds)
  let revealT = 0;                           // narration waits for the reveal
  let promptShown;                           // undefined ≠ null: first call always paints
  let lastNight, lastLock = '';
  let switching = false, pending = -1;
  let helpPrev = null, helpFocus = null;
  let lastActive = performance.now(), startedAt = 0;

  const wake = () => { lastActive = performance.now(); document.body.classList.remove('idle'); };
  const setText = (root, m) => {
    root.querySelector('.when').innerHTML = whenHTML(m);
    root.querySelector('.title').textContent = m.name;
    root.querySelector('.area').textContent = m.area;
  };
  const icon = (btn, id) => btn.querySelector('use').setAttribute('href', '#' + id);

  /* ── the narration card ── */
  function showToast(t) {
    cur = t; toastT = t.secs;
    toastEl.classList.toggle('system', t.kind === 'system');
    toastEye.textContent = t.eyebrow || '';
    toastMsg.textContent = t.msg;
    toastEl.classList.remove('hidden');
    void toastEl.offsetWidth;                // restart the entrance
    toastEl.classList.add('in');
  }
  function endToast() {
    cur = null; gapT = .32;                  // the exit transition's length
    toastEl.classList.remove('in');
  }

  /* ── the moment switch ── */
  function revealMoment(m) {
    if (!m) return;
    setText(reveal, m);
    reveal.classList.remove('play');
    void reveal.offsetWidth;
    reveal.classList.add('play');
    revealT = 1.75;                          // the blurb follows as the title fades
  }

  function go(i) {
    if (!G.started || G.overlayOpen || !CFG.MOMENTS[i]) return;
    wake();
    if (switching) { pending = i; return; }  // a second tap mid-fade retargets it
    if (i === G.momentIndex) { revealMoment(CFG.MOMENTS[i]); return; }
    revealT = 99;                            // hold the new blurb until the title has shown
    if (reduced.matches) {                   // no fade to black: switch + name it
      G.setMoment(i);
      revealMoment(CFG.MOMENTS[i]);
      return;
    }
    switching = true; pending = i;
    veil.classList.remove('out');
    veil.classList.add('on');
    setTimeout(() => {
      const j = pending;
      G.setMoment(j);                        // dress + colliders + night + teleport, under the veil
      /* two frames so the new view has been DRAWN before the veil lifts */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        veil.classList.add('out');
        veil.classList.remove('on');
        switching = false;
        revealMoment(CFG.MOMENTS[j]);
        if (pending !== j) go(pending);
      }));
    }, 280);
  }

  /* ── the controls sheet ── */
  function focusables() {
    return [...help.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')]
      .filter(e => e.offsetParent !== null);
  }
  function openHelp() {
    if (G.helpOpen) return;
    G.helpOpen = true;
    helpPrev = G.overlayOpen;
    G.overlayOpen = true;                    // pauses the walk + every game key
    helpFocus = document.activeElement;
    if (document.pointerLockElement) document.exitPointerLock?.();
    help.classList.remove('hidden');
    if (!G.touchMode) helpClose.focus({ preventScroll: true });
    wake();
  }
  function closeHelp() {
    if (!G.helpOpen) return;
    G.helpOpen = false;
    help.classList.add('hidden');
    G.overlayOpen = helpPrev;
    if (helpFocus && helpFocus.focus && helpFocus !== document.body && helpFocus.offsetParent !== null
        && helpFocus.id !== 'begin') helpFocus.focus({ preventScroll: true });
    else document.activeElement?.blur?.();
    /* back into the walk: a click is a user gesture, so the lock can be
       re-taken right here; after Esc it cannot, and the lock hint says so */
    if (G.started && !G.overlayOpen && !G.touchMode && !G.cursorMode && G.lock) G.lock();
    wake();
  }
  el('howto').addEventListener('click', openHelp);
  helpBtn.addEventListener('click', openHelp);
  helpClose.addEventListener('click', closeHelp);
  helpDone.addEventListener('click', closeHelp);
  help.addEventListener('click', e => { if (e.target === help) closeHelp(); });
  document.addEventListener('keydown', e => {
    if (G.helpOpen) {
      if (e.code === 'Escape' || e.code === 'KeyH') { e.preventDefault(); closeHelp(); }
      else if (e.code === 'Tab') {           // keep focus inside the dialog
        const f = focusables(); if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
      return;
    }
    if (e.repeat) return;
    const titleUp = !G.started && !overlay.hasAttribute('inert') && !overlay.classList.contains('hidden');
    if ((e.code === 'KeyH' || e.key === '?') && ((G.started && !G.overlayOpen) || titleUp)) {
      e.preventDefault(); openHelp();
    }
    if (G.started && /^(Digit[1-9]|KeyF|KeyN|Tab)$/.test(e.code)) wake();
  }, true);

  /* ── view status (walk / fly, golden hour / night) — tappable on touch,
        clickable in cursor mode; the keys are F and N ── */
  modeBtn.addEventListener('click', () => { if (G.started && !G.overlayOpen) G.toggleMode(); wake(); });
  lightBtn.addEventListener('click', () => { if (G.started && !G.overlayOpen && G.toggleNight) G.toggleNight(); wake(); });
  promptEl.addEventListener('click', e => {
    e.currentTarget.blur();                  // Space is fly-ascend (the #begin gotcha)
    if (G.started && !G.overlayOpen && G.player.nearest) G.player.nearest.use();
  });
  for (const b of [modeBtn, lightBtn, helpBtn]) b.addEventListener('mouseup', () => b.blur());
  for (const e of ['pointerdown', 'pointermove']) {
    for (const n of [hud, bar, el('touch')]) n.addEventListener(e, wake, { passive: true });
  }
  addEventListener('pointermove', () => { if (!document.pointerLockElement && !G.touchMode) wake(); }, { passive: true });

  G.ui = {
    buildChips(moments) {
      let day = null;
      moments.forEach((m, i) => {
        if (!day || day.date !== m.date) {
          const d = at(m.date);
          const g = document.createElement('div');
          g.className = 'day';
          g.innerHTML = `<p class="day-h" aria-hidden="true">${fmtWk.format(d)} <b>${fmtDM.format(d).replace('/', '.')}</b></p><div class="nodes"></div>`;
          bar.appendChild(g);
          day = { date: m.date, el: g, nodes: g.querySelector('.nodes'), idx: [] };
          days.push(day);
        }
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip' + (m.time ? '' : ' notime');
        b.setAttribute('aria-label', `${m.name} — ${whenLong(m)}`);
        b.innerHTML = `<span class="dot" aria-hidden="true"></span><span class="name">${esc(m.short || m.name)}</span><span class="time" aria-hidden="true">${m.time || ''}</span>`;
        b.addEventListener('click', e => { e.currentTarget.blur(); go(i); });
        day.nodes.appendChild(b);
        day.idx.push(i);
        chips.push(b);
      });
    },

    setMoment(m, idx) {
      setText(nameEl, m);
      chips.forEach((c, i) => {
        c.classList.toggle('active', i === idx);
        c.classList.toggle('past', i < idx);
        if (i === idx) c.setAttribute('aria-current', 'step'); else c.removeAttribute('aria-current');
      });
      days.forEach(d => d.el.classList.toggle('current', d.idx.includes(idx)));
      wake();
    },

    setMode(mode) {
      const fly = mode === 'fly';
      icon(modeBtn, fly ? 'i-fly' : 'i-walk');
      modeBtn.querySelector('.lbl').textContent = fly ? 'Flying' : 'Walking';
      modeBtn.setAttribute('aria-label', fly ? 'Flying — land (F)' : 'Walking — fly (F)');
      modeBtn.classList.toggle('on', fly);
      const bf = el('btnFly');
      if (bf) {
        bf.querySelector('span').textContent = fly ? 'Land' : 'Fly';
        bf.setAttribute('aria-label', fly ? 'Land' : 'Fly');
      }
      wake();
    },

    /* the interact prompt: a label in, the glyph chosen by input device */
    prompt(label) {
      if (label === promptShown) return;
      promptShown = label;
      if (!label) { promptEl.classList.add('hidden'); return; }
      const glyph = G.touchMode
        ? '<span class="tapglyph" aria-hidden="true"><svg><use href="#i-spark"/></svg></span>'
        : '<kbd aria-hidden="true">E</kbd>';
      promptEl.innerHTML = `${glyph}<span>${esc(clean(label))}</span>`;
      promptEl.setAttribute('aria-label', clean(label));
      promptEl.classList.remove('hidden');
    },

    /* narration queues rather than clobbers — blurbs are worth reading out.
       `now` jumps the queue: a moment's blurb must never trail a moment behind
       when someone taps through the timeline quickly.
       opts: { kind: 'system' } renders the compact instruction style;
             { eyebrow } a mono line above the message;
             { channel } latest wins — a new toast on a channel drops the
               queued ones and cuts the showing one short (N pressed three
               times is one card, not three in a row). */
    toast(msg, secs = 2.6, now = false, opts = {}) {
      if (now) { queue.length = 0; if (cur) toastT = 0; }
      if (opts.channel) {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].channel === opts.channel) queue.splice(i, 1);
        if (cur && cur.channel === opts.channel) toastT = 0;
      }
      queue.push({ msg: clean(msg), secs, kind: opts.kind, eyebrow: opts.eyebrow, channel: opts.channel });
    },

    update(dt) {
      if (revealT > 0) revealT -= dt;
      if (cur) {
        toastT -= dt;
        if (toastT <= 0) endToast();
      } else if (gapT > 0) {
        gapT -= dt;
        if (gapT <= 0 && !queue.length) toastEl.classList.add('hidden');
      }
      if (!cur && gapT <= 0 && queue.length && revealT <= 0) showToast(queue.shift());

      /* day / night can change from N, the status pill, or setMoment */
      if (G.night !== lastNight) {
        lastNight = G.night;
        icon(lightBtn, G.night ? 'i-moon' : 'i-sun');
        lightBtn.querySelector('.lbl').textContent = G.night ? 'Night' : 'Golden hour';
        lightBtn.setAttribute('aria-label', G.night ? 'Night — switch to golden hour (N)' : 'Golden hour — switch to night (N)');
        lightBtn.classList.toggle('on', !!G.night);
      }

      /* desktop: the view is frozen until the canvas is clicked — say so */
      let lk = '';
      if (!G.touchMode && G.started && !G.overlayOpen && !G.introActive && !G.player.locked) {
        lk = G.cursorMode ? 'cursor' : 'click';
      }
      if (lk !== lastLock) {
        lastLock = lk;
        lockHint.classList.toggle('hidden', !lk);
        lockHint.classList.toggle('cursor', lk === 'cursor');
        lockHint.innerHTML = lk === 'cursor'
          ? 'Cursor free <kbd>Tab</kbd> to look around'
          : 'Click the view to look around';
      }

      /* idle: after a quiet spell the chrome steps back for the photograph —
         never in the first half-minute, when a guest is still finding it */
      if (G.started && !G.overlayOpen) {
        const now = performance.now();
        if (!startedAt) startedAt = now;
        const idle = now - startedAt > 25000 && now - lastActive > 8000;
        if (idle !== document.body.classList.contains('idle')) document.body.classList.toggle('idle', idle);
      }
    },

    go,
    chipGo: go,
    revealMoment,
    openHelp,
    closeHelp,

    showHUD() {
      hud.classList.remove('hidden');
      bar.classList.remove('hidden');
      startedAt = performance.now();
      wake();
    },

    hideOverlay() {
      overlay.classList.add('leaving');
      setTimeout(() => overlay.classList.add('hidden'), 600);
    },
  };
}
