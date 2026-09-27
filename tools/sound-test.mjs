/* THE SOUNDSCAPE — Playwright checks + the listening previews (KAN-234).

     python3 serve.py 8803 &
     node tools/sound-test.mjs                        # everything → reference/photos/shots-audio/
     PARTS=zero,enable node tools/sound-test.mjs      # zero | enable | switch | hidden | persist
                                                      # | tour | duck | shots | preview

   Chromium runs with --autoplay-policy=user-gesture-required (TEST ONLY — the
   strict policy, so a context started outside a gesture would stay suspended
   and fail the checks) on Metal ANGLE. An init script counts every
   AudioContext the page constructs.

     zero     sound OFF (the default): no AudioContext, no js/audio/ module and no
              audio file fetched — through the title card, a walk of all six
              moments and a night flip; every toggle says "off"
     enable   the title card's toggle: ONE context, running, the engine loaded,
              the aerial bed audible (an AnalyserNode on the master), frame times
              2 s before vs 3 s after the tap; then Step inside → the prewedding bed
     switch   the six moments through the timeline (ui.go) with sound ON vs OFF:
              the bed follows, mid-crossfade levels, retired layers stopped,
              the switch frames' max / p95 both ways; N flips birds ↔ crickets
     hidden   visibilitychange hidden → suspended + pump stopped; visible → running;
              pagehide / pageshow(persisted) the same
     persist  the toggle survives a reload as ARMED (no context until a gesture),
              the first gesture starts it; off persists; ?sound=1 arms without
              persisting; ?sound=0 beats a stored "on" without persisting; M toggles
     tour     ?tour=1&sound=1: the film starts with NO context; the tour bar's
              pause (a gesture) starts it; the bed follows the film's switches;
              M in the film toggles sound and is not a takeover
     duck     a narration card ducks the mix; its end restores it
     shots    the toggle in every placement — desktop + phone, EN + ZH (+ landscape EN)
     preview  OfflineAudioContext renders through the SAME engine: 20 s of each
              moment's bed (listener at its spawn) + the title card's, and the whole
              tour (~2½ min, the film's camera as the listener, the duck at each
              blurb) → .m4a (AAC) for listening remotely
   Writes report.json next to them. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const OUT = process.argv[2] || 'reference/photos/shots-audio';
fs.mkdirSync(OUT, { recursive: true });
const PARTS = new Set((process.env.PARTS || 'zero,enable,switch,hidden,persist,tour,duck,shots,preview').split(','));
const VPS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const results = [], report = {};
const check = (part, name, ok, detail) => { results.push({ part, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${part}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AUDIO_FILE = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)(\?|$)/i;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--autoplay-policy=user-gesture-required'] });

async function open(vp = 'desktop', query = '?lang=en', { ctx: reuse, storage } = {}) {
  const ctx = reuse || await browser.newContext({ ...VPS[vp] });
  if (!reuse) {
    await ctx.addInitScript(() => {
      window.__ac = [];
      for (const k of ['AudioContext', 'webkitAudioContext']) {
        const A = window[k];
        if (!A) continue;
        window[k] = class extends A { constructor(...a) { super(...a); window.__ac.push(this); } };
      }
    });
    if (storage) await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  }
  const page = await ctx.newPage();
  const errs = [], audioReqs = [];
  page.on('pageerror', e => errs.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (/\/js\/audio\//.test(u) || AUDIO_FILE.test(u)) audioReqs.push(u.replace(BASE, '')); });
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  return { ctx, page, errs, audioReqs };
}
const st = page => page.evaluate(() => ({ ...window.__game.G.sound.state, n: window.__ac.length, stats: window.__game.G.sound._engine?.stats() || null }));
const toggles = page => page.evaluate(() => [...document.querySelectorAll('[data-sound-toggle]')].map(b => ({ id: b.id, pressed: b.getAttribute('aria-pressed'), armed: b.classList.contains('armed'), label: b.getAttribute('aria-label'), text: b.textContent.trim() })));
async function startLog(page) {
  await page.evaluate(() => {
    const G = window.__game.G, L = window.__fl = [];
    let last = performance.now();
    const tick = now => { L.push({ t: now, dt: now - last, sw: G.ui.isSwitching() }); last = now; if (!window.__flStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const win = (log, t0, t1) => log.filter(f => f.t >= t0 && f.t < t1).map(f => f.dt);
const frames = a => ({ n: a.length, max: q(a, 1), p95: q(a, .95), mean: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null });
async function soundOn(page, sel = '#soundInv') {
  await page.click(sel);
  await page.waitForFunction(() => window.__game.G.sound.state.engine && window.__game.G.sound._engine.stats().running, null, { timeout: 15000 });
}
async function skip(page) { await page.evaluate(() => window.__game.skipIntro()); await sleep(600); }
async function outputRms(page, ms = 700) {
  return page.evaluate(async ms => {
    const S = window.__game.G.sound, E = S._engine, a = S.ctx.createAnalyser();
    a.fftSize = 2048; E.output.connect(a);
    await new Promise(r => setTimeout(r, ms));
    const d = new Float32Array(a.fftSize); let m = 0;
    for (let k = 0; k < 6; k++) { a.getFloatTimeDomainData(d); for (const v of d) m = Math.max(m, Math.abs(v)); await new Promise(r => setTimeout(r, 60)); }
    E.output.disconnect(a);
    return +m.toFixed(4);
  }, ms);
}

/* ── zero: off costs nothing ── */
async function zero() {
  const { ctx, page, errs, audioReqs } = await open('desktop');
  await sleep(1500);
  let s = await st(page);
  check('zero', 'title card: no AudioContext, no engine', s.n === 0 && s.ctx === null && !s.engine && !s.want, s);
  const tg = await toggles(page);
  check('zero', 'every toggle reads off', tg.length === 4 && tg.every(b => b.pressed === 'false' && !b.armed), tg.map(b => `${b.id}:${b.pressed}`));
  await skip(page);
  for (let i = 0; i < 6; i++) { await page.evaluate(i => window.__game.G.setMoment(i), i); await sleep(250); }
  await page.evaluate(() => window.__game.toggleNight());
  await sleep(400);
  s = await st(page);
  check('zero', 'a walk of all six moments + N: still no AudioContext', s.n === 0 && s.ctx === null, { n: s.n });
  check('zero', 'nothing audio fetched (no js/audio/, no audio file)', audioReqs.length === 0, audioReqs);
  check('zero', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── enable: the tap, the context, the frame times ── */
async function enable() {
  const { ctx, page, errs, audioReqs } = await open('desktop');
  await startLog(page);
  await sleep(2000);
  const tClick = await page.evaluate(() => performance.now());
  await page.click('#soundInv');
  const s1 = await page.evaluate(() => ({ n: window.__ac.length, st: window.__ac[0] && window.__ac[0].state }));
  check('enable', 'the tap creates ONE context, inside the gesture', s1.n === 1, s1);
  await page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
  const tReady = await page.evaluate(() => performance.now());
  await sleep(3000);
  const log = await page.evaluate(() => window.__fl);
  /* the tap's own frame carries the browser's first `new AudioContext()` —
     Chrome starts its audio device there (~90–115 ms, once per page, headed or
     not; measured). iOS only lets a context start inside the gesture, so it
     cannot move: it is reported, and the ENGINE's work (the import, the noise
     and reverb buffers, the graph, the first pump) is asserted on the rest. */
  const tap = frames(win(log, tClick, tClick + 250));
  const before = frames(win(log, tClick - 2000, tClick)), after = frames(win(log, tClick + 250, tClick + 3000));
  report.enable = { before, tap, after, engineReadyMs: +(tReady - tClick).toFixed(0) };
  check('enable', `frames: 2 s before max ${before.max} / p95 ${before.p95} ms · the tap's frame ${tap.max} ms (AudioContext start) · the 2.75 s after (engine build + fade-in) max ${after.max} / p95 ${after.p95} ms · engine up in ${report.enable.engineReadyMs} ms`,
    after.max < Math.max(34, before.max * 1.6) && after.p95 <= before.p95 + 2, report.enable);
  const s = await st(page);
  check('enable', 'running, engine loaded, the aerial bed', s.ctx === 'running' && s.engine && s.stats.scene.key === 'aerial' && s.stats.audible.includes('sea') && s.stats.audible.includes('strings'), s.stats);
  const rms = await outputRms(page);
  check('enable', 'the master is actually sounding (analyser peak > 0.001)', rms > .001, rms);
  const mods = audioReqs.filter(u => /js\/audio\//.test(u)).map(u => u.split('/').pop()).sort();
  check('enable', 'fetched on enable: the four js/audio modules, no audio files', mods.join() === 'beds.js,engine.js,layers.js,synth.js' && !audioReqs.some(u => AUDIO_FILE.test(u)), audioReqs);
  const tg = await toggles(page);
  check('enable', 'every toggle reads on', tg.every(b => b.pressed === 'true'), tg.map(b => `${b.id}:${b.pressed}:${b.text || ''}`));
  await page.click('#begin');
  await page.waitForFunction(() => window.__game.G.started && !window.__game.G.introActive && window.__game.G.momentIndex === 1, null, { timeout: 20000 });
  await sleep(3200);
  const s2 = await st(page);
  check('enable', 'Step inside → the dive lands → the prewedding night bed', s2.stats.scene.key === 'setup' && s2.stats.scene.night && s2.stats.audible.includes('crickets') && s2.stats.audible.includes('acoustic'), s2.stats.scene);
  check('enable', 'still exactly one context', s2.n === 1, s2.n);
  check('enable', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── switch: crossfades + frame times, sound on vs off ── */
const ORDER = [0, 1, 2, 3, 4, 5, 2];
async function switchRun(on, vp) {
  const { ctx, page, errs } = await open(vp);
  if (on) await soundOn(page);
  await skip(page);
  await sleep(2600);
  await startLog(page);
  const per = [];
  for (const i of ORDER) {
    const prev = on ? (await st(page)).stats : null;
    const t0 = await page.evaluate(i => { const n = performance.now(); window.__game.G.ui.go(i); return n; }, i);
    let mid = null;
    if (on) { await sleep(1250); mid = (await st(page)).stats; await sleep(2750); } else await sleep(4000);
    const post = on ? (await st(page)).stats : null;
    const log = await page.evaluate(() => window.__fl);
    per.push({ i, prev, mid, post, sw: frames(win(log, t0, t0 + 1200)), cruise: frames(win(log, t0 + 1500, t0 + 4000)) });
  }
  errs.length && console.log(errs);
  return { ctx, page, errs, per };
}
async function switching() {
  for (const vp of (process.env.SWITCH_VP || 'desktop,phone').split(',')) await switchingOn(vp);
}
async function switchingOn(vp) {
  const off = await switchRun(false, vp);
  await off.ctx.close();
  const on = await switchRun(true, vp);
  const ids = ['brunch', 'setup', 'ceremony', 'cocktail', 'dinner', 'afterparty'];
  report['switch-' + vp] = { off: off.per.map(p => ({ i: p.i, sw: p.sw, cruise: p.cruise })), on: on.per.map(p => ({ i: p.i, sw: p.sw, cruise: p.cruise })) };
  on.per.forEach((p, k) => {
    const id = ids[p.i];
    check('switch', `[${vp}] → ${id}: the bed follows`, p.post.scene.key === id, p.post.scene);
    if (k === 0) return;
    const was = new Set(p.prev.audible), now = new Set(p.post.audible);
    const incoming = [...now].filter(n => !was.has(n)), outgoing = [...was].filter(n => !now.has(n));
    const fadingIn = incoming.filter(n => p.mid.levels[n] > 0 && p.mid.levels[n] < p.post.targets[n] * .98);
    const fadingOut = outgoing.filter(n => p.mid.levels[n] !== undefined && p.mid.levels[n] > 0 && p.mid.levels[n] < p.prev.targets[n]);
    check('switch', `[${vp}] → ${id}: crossfading 1.25 s in (in: ${fadingIn.join('/') || '—'} · out: ${fadingOut.join('/') || '—'})`,
      (incoming.length === 0 || fadingIn.length > 0) && (outgoing.length === 0 || fadingOut.length > 0), { incoming, outgoing });
    check('switch', `[${vp}] → ${id}: retired layers stopped after the fade`, outgoing.every(n => !p.post.active.includes(n)), p.post.active);
  });
  const mx = a => Math.max(...a.map(p => p.sw.max)), p95 = a => Math.max(...a.map(p => p.sw.p95));
  report['switchSummary-' + vp] = { offMax: mx(off.per), onMax: mx(on.per), offP95: p95(off.per), onP95: p95(on.per),
    offCruiseP95: Math.max(...off.per.map(p => p.cruise.p95)), onCruiseP95: Math.max(...on.per.map(p => p.cruise.p95)) };
  const S = report['switchSummary-' + vp];
  check('switch', `[${vp}] switch frames: sound off max ${S.offMax} / p95 ${S.offP95} ms · sound on max ${S.onMax} / p95 ${S.onP95} ms (cruise p95 ${S.offCruiseP95} → ${S.onCruiseP95})`,
    S.onMax < Math.max(40, S.offMax * 1.5), S);
  /* N: the other light's bed */
  const page = on.page;
  const n0 = (await st(page)).stats;
  await page.evaluate(() => window.__game.toggleNight());
  await sleep(2600);
  const n1 = (await st(page)).stats;
  check('switch', `[${vp}] N at the ceremony: day ${n0.scene.night ? 'night' : 'day'} → ${n1.scene.night ? 'night' : 'day'}, birds → crickets`,
    !n0.scene.night && n1.scene.night && n1.audible.includes('crickets') && !n1.audible.includes('birds'), n1.audible);
  check('switch', 'console clean (both runs)', off.errs.length === 0 && on.errs.length === 0, [...off.errs, ...on.errs]);
  await on.ctx.close();
}

/* ── hidden: WeChat to the background ── */
async function hidden() {
  const { ctx, page, errs } = await open('phone', '?lang=zh');
  await soundOn(page);
  await skip(page);
  await sleep(1500);
  const vis = h => page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  await vis(true); await sleep(600);
  let s = await st(page);
  check('hidden', 'hidden → context suspended, pump stopped', s.ctx === 'suspended' && !s.stats.running, { ctx: s.ctx, running: s.stats.running });
  await vis(false); await sleep(1000);
  s = await st(page);
  check('hidden', 'visible → running again, pump restarted', s.ctx === 'running' && s.stats.running, { ctx: s.ctx, running: s.stats.running });
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); await sleep(500);
  s = await st(page);
  check('hidden', 'pagehide → suspended', s.ctx === 'suspended', s.ctx);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await sleep(1000);
  s = await st(page);
  check('hidden', 'pageshow (bfcache restore) → running', s.ctx === 'running' && s.stats.running, s.ctx);
  check('hidden', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── persist: the toggle survives a reload, armed ── */
async function persist() {
  let o = await open('desktop');
  await soundOn(o.page);
  const stored = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', 'on is stored', stored === '1', stored);
  const ctxA = o.ctx;
  const errsA = [...o.errs];
  await o.page.close();
  o = await open('desktop', '?lang=en', { ctx: ctxA });
  let s = await st(o.page);
  check('persist', 'reload: ARMED — wants sound, no context, nothing fetched', s.want && s.armed && s.n === 0 && s.ctx === null && o.audioReqs.length === 0, { ...s, reqs: o.audioReqs });
  let tg = await toggles(o.page);
  check('persist', 'armed toggles read on + .armed', tg.every(b => b.pressed === 'true' && b.armed), tg.map(b => b.id + ':' + b.pressed + (b.armed ? '*' : '')));
  if (!PARTS.has('shots-only')) await o.page.screenshot({ path: path.join(OUT, 'ui-desktop-en-title-armed.png') });
  await o.page.click('#begin');                     // the first gesture
  await o.page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
  s = await st(o.page);
  check('persist', 'the first gesture (Step inside) starts it', s.ctx === 'running' && !s.armed && s.n === 1, { ctx: s.ctx, n: s.n });
  await o.page.waitForFunction(() => window.__game.G.started && !window.__game.G.introActive, null, { timeout: 20000 });
  await sleep(800);
  await o.page.evaluate(() => document.exitPointerLock?.());
  await o.page.evaluate(() => document.getElementById('soundBtn').click());
  await sleep(1200);
  s = await st(o.page);
  const stored0 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', 'the HUD toggle turns it off: stored 0, context suspended after the fade', !s.want && stored0 === '0' && s.ctx === 'suspended', { ctx: s.ctx, stored0 });
  errsA.push(...o.errs);
  await o.page.close();
  o = await open('desktop', '?lang=en', { ctx: ctxA });
  s = await st(o.page);
  check('persist', 'reload after off: off, not armed', !s.want && !s.armed && s.n === 0, s);
  /* M on the title card: a keydown is a gesture */
  await o.page.keyboard.press('KeyM');
  await o.page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
  s = await st(o.page);
  check('persist', 'M on the title card turns it on', s.want && s.ctx === 'running', s.ctx);
  await o.page.keyboard.press('KeyM'); await sleep(1000);
  s = await st(o.page);
  check('persist', 'M again turns it off', !s.want && s.ctx === 'suspended', s.ctx);
  errsA.push(...o.errs);
  await ctxA.close();
  /* ?sound=1 arms, does not persist */
  o = await open('desktop', '?lang=en&sound=1');
  s = await st(o.page);
  const st1 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', '?sound=1: armed, not persisted, no context yet', s.want && s.armed && s.n === 0 && st1 === null, { ...s, stored: st1 });
  await o.page.click('#howto');                       // any gesture
  await o.page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
  s = await st(o.page);
  check('persist', '?sound=1 + a gesture (How to move) → running', s.ctx === 'running', s.ctx);
  errsA.push(...o.errs);
  await o.ctx.close();
  /* ?sound=0 beats a stored on, without persisting */
  o = await open('desktop', '?lang=en&sound=0', { storage: { 'venue.sound': '1' } });
  s = await st(o.page);
  const st2 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', '?sound=0 beats a stored on (and leaves it stored)', !s.want && !s.armed && st2 === '1', { ...s, stored: st2 });
  errsA.push(...o.errs);
  await o.ctx.close();
  check('persist', 'console clean', errsA.length === 0, errsA);
}

/* ── tour: ?tour=1&sound=1 ── */
async function tour() {
  const { ctx, page, errs } = await open('phone', '?lang=en&tour=1&sound=1');
  await page.waitForFunction(() => window.__game.G.tour.active, null, { timeout: 8000 });
  await sleep(1500);
  let s = await st(page);
  check('tour', '?tour=1&sound=1: the film plays with NO context (no gesture yet), armed', s.n === 0 && s.armed, s);
  await page.screenshot({ path: path.join(OUT, 'ui-phone-en-tour-armed.png') });
  await page.tap('#tourPlay');                          // pause — a gesture
  await page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
  s = await st(page);
  check('tour', 'the tour bar (pause) is the gesture: running, the brunch bed', s.ctx === 'running' && s.stats.scene.key === 'brunch', s.stats.scene);
  await page.tap('#tourPlay');                          // resume
  await page.evaluate(() => window.__game.G.tour.next());
  await sleep(3400);
  s = await st(page);
  check('tour', 'the film\'s switch → the prewedding bed', s.stats.scene.key === 'setup', s.stats.scene);
  await page.evaluate(() => window.__game.G.tour.jump(4));
  await sleep(3400);
  s = await st(page);
  check('tour', 'a timeline jump in the film → the dinner bed', s.stats.scene.key === 'dinner', s.stats.scene);
  await page.keyboard.press('KeyM'); await sleep(1100);
  s = await st(page);
  const active = await page.evaluate(() => window.__game.G.tour.active);
  check('tour', 'M in the film: sound off, the film keeps playing (not a takeover)', !s.want && active && s.ctx === 'suspended', { want: s.want, active, ctx: s.ctx });
  await page.tap('#tourSound');
  await page.waitForFunction(() => window.__game.G.sound.state.ctx === 'running', null, { timeout: 8000 });
  s = await st(page);
  const active2 = await page.evaluate(() => window.__game.G.tour.active);
  check('tour', 'the tour bar\'s sound button: on again, still touring', s.want && active2, { want: s.want, active2 });
  check('tour', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── duck: narration ── */
async function duck() {
  const { ctx, page, errs } = await open('desktop');
  await soundOn(page);
  await skip(page);
  await sleep(5500);                                   // the landing's blurb has come and gone
  await page.evaluate(() => window.__game.G.ui.go(3));
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('hidden') && document.getElementById('toast').classList.contains('in'), null, { timeout: 8000 });
  await sleep(200);
  let s = await st(page);
  check('duck', 'a narration card ducks the music', s.stats.ducked === true, s.stats.ducked);
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('in'), null, { timeout: 12000 });
  await sleep(200);
  s = await st(page);
  check('duck', 'its end restores it', s.stats.ducked === false, s.stats.ducked);
  await page.evaluate(() => window.__game.G.setMode('fly'));   // a SYSTEM card must not duck
  await sleep(300);
  s = await st(page);
  check('duck', 'a system card (fly help) does not duck', s.stats.ducked === false, s.stats.ducked);
  check('duck', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── shots: every placement ── */
async function shots() {
  const runs = [['desktop', 'en'], ['desktop', 'zh'], ['phone', 'en'], ['phone', 'zh'], ['landscape', 'en']];
  for (const [vp, lang] of runs) {
    const tag = `${vp}-${lang}`;
    let { ctx, page, errs } = await open(vp, `?lang=${lang}`);
    const shot = n => page.screenshot({ path: path.join(OUT, `ui-${tag}-${n}.png`) });
    await sleep(900);
    await shot('title-off');
    await page.evaluate(() => { const b = document.getElementById('soundInv'); b.click(); });
    await page.waitForFunction(() => window.__game.G.sound._engine?.stats().running, null, { timeout: 15000 });
    await sleep(400);
    await shot('title-on');
    await skip(page);
    await sleep(5200);                                 // the blurb has gone
    await shot('hud-on');
    await page.evaluate(() => window.__game.G.ui.openHelp());
    await sleep(500);
    await shot('help-on');
    await page.evaluate(() => window.__game.G.ui.closeHelp());
    await page.evaluate(() => document.getElementById('soundBtn').click());
    await sleep(900);
    await shot('hud-off');
    await page.evaluate(() => window.__game.G.ui.openHelp());
    await sleep(500);
    await shot('help-off');
    await page.evaluate(() => window.__game.G.ui.closeHelp());
    await page.evaluate(() => document.getElementById('soundBtn').click());
    await sleep(300);
    await page.evaluate(() => window.__game.G.tour.start(2));
    await sleep(4200);
    await shot('tour-on');
    const fit = await page.evaluate(() => {
      const ids = ['soundBtn', 'soundInv', 'helpSound', 'tourSound'];
      const cap = document.querySelector('#momentName .title');
      return { caption: cap && { sw: cap.scrollWidth, cw: cap.clientWidth, text: cap.textContent },
        hscroll: document.documentElement.scrollWidth > innerWidth,
        sizes: Object.fromEntries(ids.map(i => { const e = document.getElementById(i); const r = e.getBoundingClientRect(); return [i, [Math.round(r.width), Math.round(r.height)]]; })) };
    });
    report['shots-' + tag] = fit;
    check('shots', `${tag}: shot 7 states; no horizontal scroll; the caption is not clipped (${fit.caption.text})`, !fit.hscroll && fit.caption.sw <= fit.caption.cw + 1, fit);
    check('shots', `${tag}: console clean`, errs.length === 0, errs);
    await ctx.close();
  }
}

/* ── preview: offline renders through the same engine ── */
async function preview() {
  const { ctx, page, errs } = await open('desktop');
  await skip(page);
  /* where the ears are at each spawn (setMoment is synchronous) */
  const spots = await page.evaluate(() => {
    const G = window.__game.G, out = {};
    for (let i = 0; i < 6; i++) {
      G.setMoment(i, { quiet: true });
      G.camera.updateMatrixWorld();
      const e = G.camera.matrixWorld.elements, m = window.__game.G.momentIndex;
      out[i] = { x: G.camera.position.x, y: G.camera.position.y, z: G.camera.position.z, fx: -e[8], fz: -e[10], floor: 0 };
    }
    return out;
  });
  const ids = ['brunch', 'setup', 'ceremony', 'cocktail', 'dinner', 'afterparty'];
  const jobs = ids.map((id, i) => ({ name: `${i + 1}-${id}`, dur: 20, script: [{ at: 0, key: id, night: [false, true, false, false, true, true][i], fade: .05, ls: { ...spots[i], floor: i === 0 ? 26.6 : 0 } }] }));
  jobs.unshift({ name: '0-title-aerial', dur: 20, script: [{ at: 0, key: 'aerial', night: false, fade: .05, ls: { x: 60, y: 58, z: 40, fx: -1, fz: 0, floor: 0 } }] });
  /* the tour: the film's own camera as the listener, a crossfade under every
     veil, the duck while each blurb is up (7.5 s at its beat) */
  const tourScript = await page.evaluate(() => {
    const G = window.__game.G, T = G.tour, segs = T.segments, S = [], nights = { brunch: false, setup: true, ceremony: false, cocktail: false, dinner: true, afterparty: true };
    const floors = { brunch: 26.6 };
    let t = 4;                                          // 4 s of the title card first
    S.push({ at: 0, key: 'aerial', night: false, fade: .05, ls: { x: 60, y: 58, z: 40, fx: -1, fz: 0, floor: 0 } });
    segs.forEach((s, k) => {
      t += .5;                                          // the veil
      S.push({ at: t - .3, key: s.id, night: nights[s.id], fade: 2.6 });
      for (let u = 0; u <= s.dur; u += .25) {
        const p = T.poseAt(k, u);
        S.push({ at: t + u, ls: { x: p.x, y: p.y, z: p.z, fx: -Math.sin(p.yaw), fz: -Math.cos(p.yaw), floor: floors[s.id] || 0 } });
      }
      S.push({ at: t + s.beat, duck: true }, { at: t + s.beat + 7.5, duck: false });
      t += s.dur;
    });
    return { script: S.sort((a, b) => a.at - b.at), dur: Math.ceil(t + 6) };
  });
  jobs.push({ name: '7-tour-mix', dur: tourScript.dur, script: tourScript.script });
  report.preview = {};
  for (const job of jobs) {
    const res = await page.evaluate(async job => {
      const { createEngine } = await import('./js/audio/engine.js');
      const sr = 44100, off = new OfflineAudioContext(2, sr * job.dur, sr);
      const t0 = performance.now();
      const E = await createEngine(off, { offline: true });
      E.fade(true, .05);
      let si = 0;
      const apply = t => {
        while (si < job.script.length && job.script[si].at <= t + 1e-6) {
          const a = job.script[si++];
          if (a.key) E.setScene(a.key, a.night, { fade: a.fade });
          if (a.ls) E.setListener(a.ls);
          if (a.duck !== undefined) E.duck(a.duck);
        }
        E.pump(t + 1.2);
      };
      apply(0);
      for (let t = .25; t < job.dur; t += .25) { const tt = t; off.suspend(tt).then(() => { apply(tt); off.resume(); }); }
      const buf = await off.startRendering();
      const ms = performance.now() - t0;
      /* 16-bit WAV, base64 in slices (CDP-friendly) */
      const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
      const ab = new ArrayBuffer(44 + n * 4), dv = new DataView(ab);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true);
      dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
      let sum = 0, peak = 0;
      for (let i = 0; i < n; i++) {
        const l = L[i], r = R[i];
        dv.setInt16(44 + i * 4, Math.max(-1, Math.min(1, l)) * 32767, true);
        dv.setInt16(46 + i * 4, Math.max(-1, Math.min(1, r)) * 32767, true);
        sum += l * l + r * r; peak = Math.max(peak, Math.abs(l), Math.abs(r));
      }
      const u8 = new Uint8Array(ab), parts = [];
      for (let i = 0; i < u8.length; i += 3 * 1 << 20) {
        let s = ''; const sub = u8.subarray(i, i + 3 * (1 << 20));
        for (let j = 0; j < sub.length; j += 0x8000) s += String.fromCharCode.apply(null, sub.subarray(j, j + 0x8000));
        parts.push(btoa(s));
      }
      return { parts, ms: Math.round(ms), rmsDb: +(10 * Math.log10(sum / (2 * n))).toFixed(1), peakDb: +(20 * Math.log10(peak)).toFixed(1) };
    }, job);
    const wav = path.join(OUT, job.name + '.wav'), m4a = path.join(OUT, job.name + '.m4a');
    fs.writeFileSync(wav, Buffer.concat(res.parts.map(p => Buffer.from(p, 'base64'))));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'aac', '-b:a', '160k', m4a]);
    fs.unlinkSync(wav);
    report.preview[job.name] = { secs: job.dur, renderMs: res.ms, rmsDb: res.rmsDb, peakDb: res.peakDb, kb: Math.round(fs.statSync(m4a).size / 1024) };
    check('preview', `${job.name}.m4a — ${job.dur} s, rendered in ${res.ms} ms, RMS ${res.rmsDb} dBFS, peak ${res.peakDb} dBFS`, res.peakDb < -1 && res.rmsDb > -45, report.preview[job.name]);
  }
  check('preview', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

const PLAN = [['zero', zero], ['enable', enable], ['switch', switching], ['hidden', hidden], ['persist', persist], ['tour', tour], ['duck', duck], ['shots', shots], ['preview', preview]];
for (const [k, fn] of PLAN) {
  if (!PARTS.has(k)) continue;
  try { await fn(); } catch (e) { check(k, 'threw', false, String(e && e.stack || e)); }
}
await browser.close();
const pass = results.filter(r => r.ok).length;
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ pass, total: results.length, results, report }, null, 2));
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
