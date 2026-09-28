/* THE SOUND — Playwright checks + the listening mix (KAN-234 v2: Carl's Suno files).

     python3 serve.py 8803 &          # serve.py answers Range requests (WebKit needs them)
     node tools/sound-test.mjs                        # everything → reference/photos/shots-audio2/
     PARTS=zero,enable node tools/sound-test.mjs      # zero | enable | switch | seam | loop | hidden
                                                      # | persist | tour | duck | shots | webkit | mix

   Chromium (Playwright's, Metal ANGLE) runs with --autoplay-policy=user-gesture-
   required (TEST ONLY — the strict policy). An init script counts every
   AudioContext and every <audio> element the page constructs.

     zero     sound OFF (the default): no AudioContext, no <audio>, no request under
              assets/audio/ — through the title card, all six moments and a night
              flip; every toggle says "off"
     enable   the title card's toggle: frame times 2 s before / the tap / 3 s after;
              ONE context, running; exactly the title track + the ocean loop fetched;
              the master is sounding; Step inside → the prewedding track + night loop
     switch   the six moments through the timeline (ui.go), sound OFF vs ON, desktop +
              phone: the right track + loop + level per moment, the crossfade 1.25 s in,
              the old deck released after it, switch-frame max / p95 both ways; N at
              the ceremony swaps ocean → night (1.5 s) and leaves the music alone
     seam     both loops, decoded in THIS engine: length vs the file's true frames
              (priming / padding), the seam's click energy vs every other point of the
              loop, and a 3-loop offline render of the looped AudioBufferSourceNode
     loop     a track near its end: a second deck starts LOOP_OVERLAP s early, the
              output level through the overlap (no dip, no gap), the tail released
     hidden   visibilitychange / pagehide → decks paused + context suspended; back →
              running + playing
     persist  on survives a reload as ARMED (no context until a gesture); off
              persists; ?sound=1 arms without persisting; ?sound=0 beats a stored
              on; M toggles
     tour     ?tour=1&sound=1: no context until the first tap; the film's switches
              change the track; the NEXT track is prefetched in idle time and the
              switch plays that deck (no second request); M is not a takeover
     duck     a narration card ducks the music bus ×.5; its end restores it; a
              system card does not
     shots    the toggle in every placement — desktop + phone, EN + ZH (+ landscape)
     webkit   (WEBKIT_PATH, default ~/ai-journey's Playwright) the seam part again in
              WebKit, and an enable → switch → N in WebKit with the context running
     tourframes the whole film in real time, sound OFF vs ON, desktop + phone: frame
              max / p95 overall and on the switch frames; the requests it made
     mix      ~2½ minutes of the REAL engine following the tour, recorded off the
              master bus (MediaRecorder) → tour-mix.m4a + its loudness
   Writes report.json next to them. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const OUT = process.argv[2] || 'reference/photos/shots-audio2';
fs.mkdirSync(OUT, { recursive: true });
const PARTS = new Set((process.env.PARTS || 'zero,enable,switch,seam,loop,hidden,persist,tour,duck,shots,webkit,tourframes,mix').split(','));
const VPS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const IDS = ['brunch', 'setup', 'ceremony', 'cocktail', 'dinner', 'afterparty'];
const TRACK = { title: 'venue-00-title', brunch: 'venue-01-brunch', setup: 'venue-02-prewedding', ceremony: 'venue-03-ceremony',
  cocktail: 'venue-04-cocktail', dinner: 'venue-05-dinner', afterparty: 'venue-06-afterparty' };
const NIGHT = { brunch: false, setup: true, ceremony: false, cocktail: false, dinner: true, afterparty: true };
const results = [], report = {};
const check = (part, name, ok, detail) => { results.push({ part, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${part}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AUDIO = /\/assets\/audio\/|\.(mp3|m4a|aac|ogg|oga|opus|wav|flac)(\?|$)/i;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization', '--autoplay-policy=user-gesture-required'] });

const COUNT = () => {
  window.__ac = []; window.__au = 0;
  for (const k of ['AudioContext', 'webkitAudioContext']) {
    const A = window[k];
    if (!A) continue;
    window[k] = class extends A { constructor(...a) { super(...a); window.__ac.push(this); } };
  }
  const A0 = window.Audio;
  window.Audio = class extends A0 { constructor(...a) { super(...a); window.__au++; } };
};
async function open(vp = 'desktop', query = '?lang=en', { ctx: reuse, storage, bt = browser } = {}) {
  const ctx = reuse || await bt.newContext({ ...VPS[vp] });
  if (!reuse) {
    await ctx.addInitScript(COUNT);
    if (storage) await ctx.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  }
  const page = await ctx.newPage();
  const errs = [], audioReqs = [], bytes = {};
  page.on('pageerror', e => errs.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { const u = r.url(); if (AUDIO.test(u)) audioReqs.push(u.split('/').pop()); });
  page.on('response', async r => {
    const u = r.url(); if (!/\/assets\/audio\//.test(u)) return;
    const n = +(r.headers()['content-length'] || 0); const f = u.split('/').pop();
    bytes[f] = (bytes[f] || 0) + n;
  });
  await page.goto(BASE + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  return { ctx, page, errs, audioReqs, bytes };
}
const S = page => page.evaluate(() => ({ ...window.__game.G.sound.stats(), n: window.__ac.length, au: window.__au }));
const toggles = page => page.evaluate(() => [...document.querySelectorAll('[data-sound-toggle]')].map(b => ({ id: b.id, pressed: b.getAttribute('aria-pressed'), armed: b.classList.contains('armed'), text: b.textContent.trim() })));
async function startLog(page) {
  await page.evaluate(() => {
    const G = window.__game.G, L = window.__fl = [];
    let last = performance.now();
    const tick = now => { L.push({ t: now, dt: now - last, sw: G.ui.isSwitching() }); last = now; if (!window.__flStop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}
const qn = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const win = (log, t0, t1) => log.filter(f => f.t >= t0 && f.t < t1).map(f => f.dt);
const frames = a => ({ n: a.length, max: qn(a, 1), p95: qn(a, .95), mean: a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null });
const live = s => s.decks.filter(d => d.role === 'music' && d.target > 0);
const liveAmb = s => s.amb.filter(v => v.target > 0);
async function soundOn(page, sel = '#soundInv') {
  await page.click(sel);
  await page.waitForFunction(() => { const s = window.__game.G.sound.stats(); return s.ctx === 'running' && s.sounding && s.amb.some(v => v.playing); }, null, { timeout: 20000 });
}
async function skip(page) { await page.evaluate(() => window.__game.skipIntro()); await sleep(600); }
/* peak + RMS (dBFS) of the master bus over `ms` */
async function level(page, ms = 700) {
  return page.evaluate(async ms => {
    const S = window.__game.G.sound, a = S.ctx.createAnalyser();
    a.fftSize = 2048; S._debug.master.connect(a);
    const d = new Float32Array(a.fftSize); let m = 0, sum = 0, n = 0;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      a.getFloatTimeDomainData(d);
      for (const v of d) { m = Math.max(m, Math.abs(v)); sum += v * v; n++; }
      await new Promise(r => setTimeout(r, 45));
    }
    S._debug.master.disconnect(a);
    return { peak: +m.toFixed(4), rmsDb: +(10 * Math.log10(sum / n + 1e-12)).toFixed(1) };
  }, ms);
}

/* ── zero: off costs nothing ── */
async function zero() {
  for (const vp of ['desktop', 'phone']) {
    const { ctx, page, errs, audioReqs } = await open(vp);
    await sleep(1200);
    let s = await S(page);
    check('zero', `[${vp}] title card: no AudioContext, no <audio>, not sounding`, s.n === 0 && s.au === 0 && s.ctx === null && !s.want && !s.sounding, { n: s.n, au: s.au });
    const tg = await toggles(page);
    check('zero', `[${vp}] every toggle reads off`, tg.length === 4 && tg.every(b => b.pressed === 'false' && !b.armed), tg.map(b => `${b.id}:${b.pressed}`));
    await skip(page);
    for (let i = 0; i < 6; i++) { await page.evaluate(i => window.__game.G.setMoment(i), i); await sleep(250); }
    await page.evaluate(() => window.__game.toggleNight());
    await page.evaluate(() => window.__game.G.tour.start(0));
    await sleep(1500);
    await page.evaluate(() => window.__game.G.tour.takeover({ reason: 'test' }));
    await sleep(300);
    s = await S(page);
    check('zero', `[${vp}] six moments + N + the tour: still no AudioContext, no <audio>`, s.n === 0 && s.au === 0 && s.ctx === null, { n: s.n, au: s.au });
    check('zero', `[${vp}] nothing under assets/audio/ fetched`, audioReqs.length === 0, audioReqs);
    check('zero', `[${vp}] console clean`, errs.length === 0, errs);
    await ctx.close();
  }
}

/* ── enable: the tap, the context, the frame times, the weight ── */
async function enable() {
  for (const vp of ['desktop', 'phone']) {
    const { ctx, page, errs, audioReqs, bytes } = await open(vp);
    await startLog(page);
    await sleep(2000);
    const tClick = await page.evaluate(() => performance.now());
    if (vp === 'phone') await page.tap('#soundInv'); else await page.click('#soundInv');
    await page.waitForFunction(() => { const s = window.__game.G.sound.stats(); return s.ctx === 'running' && s.amb.some(v => v.playing); }, null, { timeout: 20000 });
    const tReady = await page.evaluate(() => performance.now());
    await sleep(3000);
    const log = await page.evaluate(() => window.__fl);
    const before = frames(win(log, tClick - 2000, tClick)), tap = frames(win(log, tClick, tClick + 200));
    const after = frames(win(log, tClick + 200, tClick + 3200)), all = frames(win(log, tClick, tClick + 3200));
    let s = await S(page);
    report['enable-' + vp] = { before, tap, after, all, readyMs: +(tReady - tClick).toFixed(0), tapHandlerMs: s.log.tapMs, ctxCtorMs: s.log.ctxMs, ctxAfterMs: s.log.ctxAfterMs };
    check('enable', `[${vp}] frames: 2 s before max ${before.max} / p95 ${before.p95} · the 3.2 s from the tap max ${all.max} / p95 ${all.p95} ms (tap handler ${s.log.tapMs} ms, AudioContext ${s.log.ctxMs} ms at +${s.log.ctxAfterMs} ms)`,
      all.max < Math.max(34, before.max * 1.6) && all.p95 <= before.p95 + 2, report['enable-' + vp]);
    check('enable', `[${vp}] ONE context, running; not armed`, s.n === 1 && s.ctx === 'running' && !s.armed, { n: s.n, ctx: s.ctx });
    check('enable', `[${vp}] the title track on a deck at .5 + the ocean loop at .27`,
      live(s).length === 1 && live(s)[0].file === TRACK.title && !live(s)[0].paused && liveAmb(s).length === 1 && liveAmb(s)[0].key === 'ocean' && liveAmb(s)[0].level === .27, { decks: live(s), amb: s.amb });
    const lv = await level(page);
    check('enable', `[${vp}] the master is sounding (peak ${lv.peak}, RMS ${lv.rmsDb} dBFS)`, lv.peak > .005, lv);
    await sleep(500);
    const files = [...new Set(audioReqs)].sort();
    const kb = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)]));
    report['weight-enable-' + vp] = { files, kb, totalKB: Object.values(kb).reduce((a, b) => a + b, 0) };
    check('enable', `[${vp}] fetched exactly the title track + the ocean loop (${report['weight-enable-' + vp].totalKB} KB)`, files.join() === 'venue-00-title.m4a,venue-amb-ocean.m4a', report['weight-enable-' + vp]);
    const tg = await toggles(page);
    check('enable', `[${vp}] every toggle reads on`, tg.every(b => b.pressed === 'true'), tg.map(b => `${b.id}:${b.pressed}`));
    const n0 = audioReqs.length;
    if (vp === 'phone') await page.tap('#begin'); else await page.click('#begin');
    await page.waitForFunction(() => window.__game.G.started && !window.__game.G.introActive && window.__game.G.momentIndex === 1, null, { timeout: 25000 });
    await sleep(3500);
    s = await S(page);
    check('enable', `[${vp}] Step inside → the dive lands → the prewedding track + the night loop; the title's deck released`,
      live(s).length === 1 && live(s)[0].file === TRACK.setup && liveAmb(s).length === 1 && liveAmb(s)[0].key === 'night' && !s.decks.some(d => d.file === TRACK.title),
      { decks: s.decks.filter(d => d.role), amb: s.amb });
    const more = [...new Set(audioReqs.slice(n0))].sort();
    check('enable', `[${vp}] the landing fetched exactly its track + its loop`, more.join() === 'venue-02-prewedding.m4a,venue-amb-night.m4a', more);
    check('enable', `[${vp}] still one context; console clean`, s.n === 1 && errs.length === 0, { n: s.n, errs });
    await ctx.close();
  }
}

/* ── switch: crossfades, files, levels + frame times, sound on vs off ── */
const ORDER = [0, 1, 2, 3, 4, 5, 2];
async function switchRun(on, vp) {
  const { ctx, page, errs, audioReqs } = await open(vp);
  if (on) await soundOn(page);
  await skip(page);
  await sleep(3000);
  await startLog(page);
  const per = [];
  for (const i of ORDER) {
    const n0 = audioReqs.length;
    const t0 = await page.evaluate(i => { const n = performance.now(); window.__game.G.ui.go(i); return n; }, i);
    let mid = null, post = null;
    if (on) { await sleep(280 + 1250); mid = await S(page); await sleep(2900); post = await S(page); } else await sleep(4430);
    const log = await page.evaluate(() => window.__fl);
    per.push({ i, mid, post, reqs: [...new Set(audioReqs.slice(n0))], sw: frames(win(log, t0, t0 + 1200)), cruise: frames(win(log, t0 + 1500, t0 + 4000)) });
  }
  return { ctx, page, errs, per };
}
async function switching() {
  for (const vp of ['desktop', 'phone']) {
    const off = await switchRun(false, vp);
    await off.ctx.close();
    const on = await switchRun(true, vp);
    report['switch-' + vp] = { off: off.per.map(p => ({ id: IDS[p.i], sw: p.sw, cruise: p.cruise })), on: on.per.map(p => ({ id: IDS[p.i], sw: p.sw, cruise: p.cruise, reqs: p.reqs })) };
    on.per.forEach((p, k) => {
      const id = IDS[p.i], s = p.post, m = p.mid;
      const lvlAmb = id === 'brunch' ? .14 : .27, ak = NIGHT[id] ? 'night' : 'ocean';
      check('switch', `[${vp}] → ${id}: ${TRACK[id]} at .5 + the ${ak} loop at ${lvlAmb}; one live deck, the rest released`,
        live(s).length === 1 && live(s)[0].file === TRACK[id] && !live(s)[0].paused && liveAmb(s).length === 1 && liveAmb(s)[0].key === ak && liveAmb(s)[0].level === lvlAmb
        && s.decks.filter(d => d.role && d.role !== 'prefetch').length === 1 && s.scene.key === id && s.scene.night === NIGHT[id],
        { decks: s.decks.filter(d => d.role).map(d => `${d.i}:${d.role}:${d.key}:${d.level}`), amb: s.amb.map(v => `${v.key}:${v.level}`) });
      if (k === 0) return;
      const inc = m.decks.find(d => d.role === 'music' && d.key === id), out = m.decks.find(d => d.role === 'out');
      check('switch', `[${vp}] → ${id}: 1.25 s in, crossfading (in ${inc?.level}, out ${out?.level})`,
        inc && inc.level > .05 && inc.level < .49 && out && out.level > .01 && out.level < .49, { inc, out });
      /* its own track, and its loop only if the loop changed (desktop keeps both
         decoded, so a loop is fetched once; PHONE keeps only the one in use) */
      const prevAk = NIGHT[IDS[on.per[k - 1].i]] ? 'night' : 'ocean';
      const seenAk = on.per.slice(0, k).some(q => (NIGHT[IDS[q.i]] ? 'night' : 'ocean') === ak);
      const wantReq = [TRACK[id] + '.m4a'];
      if (ak !== prevAk && (vp === 'phone' || !seenAk)) wantReq.push(`venue-amb-${ak}.m4a`);
      check('switch', `[${vp}] → ${id}: fetched only its own track${wantReq.length > 1 ? ' + its loop' : ''} (${p.reqs.join(', ') || 'from cache'})`,
        p.reqs.every(f => wantReq.includes(f)), { reqs: p.reqs, allowed: wantReq });
    });
    const mx = a => Math.max(...a.map(p => p.sw.max)), p95 = a => Math.max(...a.map(p => p.sw.p95));
    const SS = report['switchSummary-' + vp] = { offMax: mx(off.per), onMax: mx(on.per), offP95: p95(off.per), onP95: p95(on.per),
      offCruiseP95: Math.max(...off.per.map(p => p.cruise.p95)), onCruiseP95: Math.max(...on.per.map(p => p.cruise.p95)) };
    check('switch', `[${vp}] switch frames: sound off max ${SS.offMax} / p95 ${SS.offP95} ms · sound on max ${SS.onMax} / p95 ${SS.onP95} ms (cruise p95 ${SS.offCruiseP95} → ${SS.onCruiseP95})`,
      SS.onMax < Math.max(40, SS.offMax * 1.5) && SS.onP95 <= SS.offP95 + 3, SS);
    /* N at the ceremony (the run ends there): ocean → night, the music untouched */
    const page = on.page;
    const n0 = await S(page);
    const deck0 = live(n0)[0];
    await page.evaluate(() => window.__game.toggleNight());
    await sleep(700);
    const nm = await S(page);
    await sleep(1400);
    const n1 = await S(page);
    const oc = nm.amb.find(v => v.key === 'ocean'), ni = nm.amb.find(v => v.key === 'night');
    check('switch', `[${vp}] N at the ceremony: ocean → night over 1.5 s (0.7 s in: ocean ${oc?.level}, night ${ni?.level})`,
      !n0.scene.night && n1.scene.night && oc && ni && oc.level < .27 && oc.level > 0 && ni.level > 0 && ni.level < .27 && liveAmb(n1).length === 1 && liveAmb(n1)[0].key === 'night', { mid: nm.amb, after: n1.amb });
    const deck1 = live(n1)[0];
    check('switch', `[${vp}] N leaves the music alone (same deck, same file, still playing: ${deck0.t} → ${deck1.t} s)`,
      deck1 && deck1.i === deck0.i && deck1.file === TRACK.ceremony && deck1.t > deck0.t && deck1.level === .5, { deck0, deck1 });
    await page.evaluate(() => window.__game.toggleNight());
    await sleep(1800);
    const n2 = await S(page);
    check('switch', `[${vp}] N back: night → ocean (the decoded ocean reused${vp === 'phone' ? ' — PHONE drops the unused loop, so it is re-fetched' : ''})`, liveAmb(n2).length === 1 && liveAmb(n2)[0].key === 'ocean', n2.amb);
    check('switch', `[${vp}] console clean (both runs)`, off.errs.length === 0 && on.errs.length === 0, [...off.errs, ...on.errs]);
    await on.ctx.close();
  }
}

/* ── seam: the loops, in whatever engine `page` is ── */
async function seamIn(page, tag) {
  const r = await page.evaluate(async () => {
    const { loopBuffer, AMB, SEAM_XF } = await import('./js/sound.js');
    const out = {};
    const hf = (d, i) => { let e = 0; for (let k = -8; k < 8; k++) { const a = d[i + k], b = d[i + k - 1], c = d[i + k + 1]; const x = c - 2 * a + b; e += x * x; } return e; };
    for (const rate of [48000, 44100]) for (const [key, a] of Object.entries(AMB)) {
      const ab = await (await fetch('assets/audio/' + a.file + '.m4a')).arrayBuffer();
      const oc = new OfflineAudioContext(2, 1, rate);
      const dec = await new Promise((res, rej) => oc.decodeAudioData(ab, res, rej));
      const L = loopBuffer(oc, dec, a.frames);
      const n = L.buf.length;
      /* the control: the FILE's own seam (the trimmed decode, wrapped raw), same measure */
      const raw = {};
      for (let c = 0; c < 2; c++) {
        const d = dec.getChannelData(c).subarray(L.skip, L.skip + L.len), W = new Float32Array(64);
        for (let k = 0; k < 32; k++) { W[k] = d[L.len - 32 + k]; W[32 + k] = d[k]; }
        const pool = []; for (let j = 0; j < 2000; j++) pool.push(hf(d, 40 + Math.floor(j * (L.len - 80) / 2000)));
        const sv = hf(W, 32); raw['ch' + c] = +(pool.filter(v => v < sv).length / pool.length).toFixed(3);
      }
      /* click energy (2nd difference, 16-sample window) at the seam, read across the
         wrap, against the same measure at 2,000 points through the loop */
      const res = {};
      for (let c = 0; c < 2; c++) {
        const d = L.buf.getChannelData(c), W = new Float32Array(64);
        for (let k = 0; k < 32; k++) { W[k] = d[n - 32 + k]; W[32 + k] = d[k]; }
        const seam = hf(W, 32);
        const pool = [];
        for (let j = 0; j < 2000; j++) pool.push(hf(d, 40 + Math.floor(j * (n - 80) / 2000)));
        pool.sort((x, y) => x - y);
        const rank = pool.filter(v => v < seam).length / pool.length;
        /* the control: the SAME measure at a wrong seam (1,024 samples off — what an
           un-skipped priming would give) */
        for (let k = 0; k < 32; k++) { W[k] = d[n - 32 + k]; W[32 + k] = d[1024 + k]; }
        res['ch' + c] = { seam: +seam.toExponential(2), rank: +rank.toFixed(3), p50: +pool[1000].toExponential(2), p99: +pool[1980].toExponential(2), wrongSeamRank: +(pool.filter(v => v < hf(W, 32)).length / pool.length).toFixed(3) };
      }
      /* the real thing: 3 loops of the looped source node, rendered, the output read at each seam */
      const secs = n * 3 / rate + .05;
      const R = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
      const src = R.createBufferSource(); src.buffer = L.buf; src.loop = true; src.connect(R.destination); src.start(0);
      const rb = await R.startRendering();
      const o = rb.getChannelData(0), orig = L.buf.getChannelData(0);
      let maxErr = 0;
      for (let i = 0; i < n * 3; i++) maxErr = Math.max(maxErr, Math.abs(o[i] - orig[i % n]));
      const seams = [n, 2 * n].map(i => hf(o, i));
      out[`${key}@${rate}`] = { decoded: dec.length, trueFrames: Math.round(a.frames * rate / 44100), extra: L.extra, skip: L.skip, len: L.len, loopLen: n, xf: L.xf, fileSeamRank: raw, ...res,
        rendered: { seamHF: seams.map(v => +v.toExponential(2)), maxSampleErrVsBuffer: +maxErr.toExponential(2) } };
    }
    return out;
  });
  report['seam-' + tag] = r;
  for (const [k, v] of Object.entries(r)) {
    const exact = v.len === v.trueFrames && (v.extra === 0 ? v.skip === 0 : v.skip > 0);
    check('seam', `[${tag}] ${k}: decoded ${v.decoded} for ${v.trueFrames} true frames (extra ${v.extra}, skip ${v.skip}) → exactly ${v.len}, looped as ${v.loopLen} (${v.xf}-sample seam crossfade)`, exact && v.loopLen === v.len - v.xf, { decoded: v.decoded, trueFrames: v.trueFrames, extra: v.extra, skip: v.skip });
    check('seam', `[${tag}] ${k}: the seam's click energy ranks ${v.ch0.rank} / ${v.ch1.rank} of the loop's own (the file's raw seam: ${v.fileSeamRank.ch0} / ${v.fileSeamRank.ch1}; a 1,024-off seam: ${v.ch0.wrongSeamRank} / ${v.ch1.wrongSeamRank})`, v.ch0.rank < .99 && v.ch1.rank < .99, { ch0: v.ch0, ch1: v.ch1 });
    const pr = Math.max(v.ch0.p99, v.ch1.p99);
    check('seam', `[${tag}] ${k}: rendered 3× through a looping source: bit-exact to the buffer (max err ${v.rendered.maxSampleErrVsBuffer}), seam HF ${v.rendered.seamHF.join(' / ')} ≤ the loop's p99 ${pr.toExponential(2)}`,
      v.rendered.maxSampleErrVsBuffer < 1e-6 && v.rendered.seamHF.every(x => x <= pr), v.rendered);
  }
}
async function seam() {
  const { ctx, page, errs } = await open('desktop');
  await seamIn(page, 'chromium');
  check('seam', '[chromium] console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── loop: a track's tail over its own start ── */
async function loop() {
  const { ctx, page, errs } = await open('desktop');
  await soundOn(page);
  await skip(page);
  await page.evaluate(() => window.__game.G.ui.go(3));        // the cocktail: the shortest track (2:43)
  await sleep(4500);
  let s = await S(page);
  const d0 = live(s)[0];
  await page.evaluate(i => { const el = window.__game.G.sound._debug.decks[i].el; el.currentTime = el.duration - 7; }, d0.i);
  /* the output level every 100 ms from 7 s before the end to 3 s after */
  const trace = await page.evaluate(async () => {
    const S = window.__game.G.sound, a = S.ctx.createAnalyser();
    a.fftSize = 4096; S._debug.master.connect(a);
    const d = new Float32Array(a.fftSize), out = [];
    const t0 = performance.now();
    while (performance.now() - t0 < 10000) {
      await new Promise(r => setTimeout(r, 100));
      a.getFloatTimeDomainData(d); let e = 0; for (const v of d) e += v * v;
      const st = S.stats();
      out.push({ t: +((performance.now() - t0) / 1000).toFixed(1), db: +(10 * Math.log10(e / d.length + 1e-12)).toFixed(1),
        decks: st.decks.filter(x => x.role).map(x => `${x.i}:${x.role}:${x.t}`) });
    }
    S._debug.master.disconnect(a);
    return out;
  });
  s = await S(page);
  const nd = live(s)[0];
  report.loop = { trace };
  check('loop', `the loop started a second deck on the same file (deck ${d0.i} → ${nd.i}, now at ${nd.t} s) and released the tail`,
    s.log.loops === 1 && nd.i !== d0.i && nd.file === TRACK.cocktail && nd.t > 4 && nd.t < 8 && s.decks.filter(d => d.role && d.role !== 'prefetch').length === 1, { loops: s.log.loops, decks: s.decks.filter(d => d.role) });
  /* the music-only level (the ocean loop sits under it): through the overlap it may
     not fall below the level the track itself reaches in its last quiet bars */
  const pre = trace.filter(x => x.t < 2).map(x => x.db), mid = trace.filter(x => x.t >= 2 && x.t <= 8).map(x => x.db);
  const med = qn(pre, .5), minMid = Math.min(...mid);
  report.loop.summary = { medianBefore: med, minThroughOverlap: minMid };
  check('loop', `no dip, no gap: master ${med} dBFS before → min ${minMid} dBFS through the overlap (the ocean loop alone is ≈ −40)`, minMid > med - 9, report.loop.summary);
  check('loop', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── hidden: WeChat to the background ── */
async function hidden() {
  const { ctx, page, errs } = await open('phone', '?lang=zh');
  await soundOn(page, '#soundInv');
  await skip(page);
  await sleep(2500);
  const vis = h => page.evaluate(h => {
    Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
    Object.defineProperty(document, 'visibilityState', { get: () => (h ? 'hidden' : 'visible'), configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  await vis(true); await sleep(600);
  let s = await S(page);
  check('hidden', 'hidden → context suspended, every deck paused', s.ctx === 'suspended' && s.decks.every(d => d.paused), { ctx: s.ctx, decks: s.decks.map(d => d.paused) });
  const t0 = live(s)[0].t;
  await sleep(1000);
  s = await S(page);
  check('hidden', 'while hidden the track does not advance', Math.abs(live(s)[0].t - t0) < .05, [t0, live(s)[0].t]);
  await vis(false); await sleep(1000);
  s = await S(page);
  check('hidden', 'visible → running, the track playing again', s.ctx === 'running' && !live(s)[0].paused && live(s)[0].t > t0, { ctx: s.ctx, deck: live(s)[0] });
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))); await sleep(500);
  s = await S(page);
  check('hidden', 'pagehide → suspended + paused', s.ctx === 'suspended' && live(s)[0].paused, s.ctx);
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))); await sleep(1000);
  s = await S(page);
  check('hidden', 'pageshow (bfcache restore) → running + playing', s.ctx === 'running' && !live(s)[0].paused, s.ctx);
  check('hidden', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── persist ── */
async function persist() {
  let o = await open('desktop');
  await soundOn(o.page);
  check('persist', 'on is stored', (await o.page.evaluate(() => localStorage.getItem('venue.sound'))) === '1');
  const ctxA = o.ctx, errsA = [...o.errs];
  await o.page.close();
  o = await open('desktop', '?lang=en', { ctx: ctxA });
  let s = await S(o.page);
  check('persist', 'reload: ARMED — wants sound, no context, no <audio>, nothing fetched', s.want && s.armed && s.n === 0 && s.au === 0 && o.audioReqs.length === 0, { n: s.n, au: s.au, reqs: o.audioReqs });
  let tg = await toggles(o.page);
  check('persist', 'armed toggles read on + .armed', tg.every(b => b.pressed === 'true' && b.armed), tg.map(b => b.id + ':' + b.pressed + (b.armed ? '*' : '')));
  await o.page.screenshot({ path: path.join(OUT, 'ui-desktop-en-title-armed.png') });
  await o.page.click('#begin');                        // the first gesture
  await o.page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 15000 });
  s = await S(o.page);
  check('persist', 'the first gesture (Step inside) starts it', s.ctx === 'running' && !s.armed && s.n === 1, { ctx: s.ctx, n: s.n });
  await o.page.waitForFunction(() => window.__game.G.started && !window.__game.G.introActive, null, { timeout: 25000 });
  await sleep(800);
  await o.page.evaluate(() => document.exitPointerLock?.());
  await o.page.evaluate(() => document.getElementById('soundBtn').click());
  await sleep(1200);
  s = await S(o.page);
  const st0 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', 'the HUD toggle turns it off: stored 0, decks paused, context suspended after the fade', !s.want && st0 === '0' && s.ctx === 'suspended' && s.decks.every(d => d.paused), { ctx: s.ctx, st0 });
  errsA.push(...o.errs);
  await o.page.close();
  o = await open('desktop', '?lang=en', { ctx: ctxA });
  s = await S(o.page);
  check('persist', 'reload after off: off, not armed, no context', !s.want && !s.armed && s.n === 0, s.n);
  await o.page.keyboard.press('KeyM');
  await o.page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 15000 });
  s = await S(o.page);
  check('persist', 'M on the title card turns it on (a keydown is a gesture)', s.want && s.ctx === 'running', s.ctx);
  await sleep(600);
  await o.page.keyboard.press('KeyM'); await sleep(1000);
  s = await S(o.page);
  check('persist', 'M again turns it off', !s.want && s.ctx === 'suspended', s.ctx);
  await o.page.keyboard.press('KeyM'); await sleep(1500);
  s = await S(o.page);
  check('persist', 'M a third time: back on, the SAME context resumed, the title track playing', s.want && s.ctx === 'running' && s.n === 1 && live(s)[0] && !live(s)[0].paused, { ctx: s.ctx, n: s.n });
  errsA.push(...o.errs);
  await ctxA.close();
  o = await open('desktop', '?lang=en&sound=1');
  s = await S(o.page);
  const st1 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', '?sound=1: armed, not persisted, no context yet', s.want && s.armed && s.n === 0 && st1 === null, { n: s.n, stored: st1 });
  await o.page.click('#howto');
  await o.page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 15000 });
  check('persist', '?sound=1 + a gesture (How to move) → running', (await S(o.page)).ctx === 'running');
  errsA.push(...o.errs);
  await o.ctx.close();
  o = await open('desktop', '?lang=en&sound=0', { storage: { 'venue.sound': '1' } });
  s = await S(o.page);
  const st2 = await o.page.evaluate(() => localStorage.getItem('venue.sound'));
  check('persist', '?sound=0 beats a stored on (and leaves it stored)', !s.want && !s.armed && st2 === '1', { stored: st2 });
  errsA.push(...o.errs);
  await o.ctx.close();
  check('persist', 'console clean', errsA.length === 0, errsA);
}

/* ── tour: ?tour=1&sound=1, the film's switches, the prefetch ── */
async function tour() {
  const { ctx, page, errs, audioReqs } = await open('phone', '?lang=en&tour=1&sound=1');
  await page.waitForFunction(() => window.__game.G.tour.active, null, { timeout: 8000 });
  await sleep(1500);
  let s = await S(page);
  check('tour', '?tour=1&sound=1: the film plays with NO context (no gesture yet), armed', s.n === 0 && s.armed && audioReqs.length === 0, { n: s.n });
  await page.screenshot({ path: path.join(OUT, 'ui-phone-en-tour-armed.png') });
  await page.tap('#tourPlay');                          // pause — a gesture
  await page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 15000 });
  await sleep(600);
  s = await S(page);
  check('tour', 'the tour bar (pause) is the gesture: running, the brunch track + the ocean at .14', live(s)[0]?.file === TRACK.brunch && liveAmb(s)[0]?.target === .14, { decks: live(s), amb: s.amb });
  await page.tap('#tourPlay');                          // resume
  /* the prefetch: once the brunch has settled, the prewedding track is buffered on a spare deck */
  await page.waitForFunction(() => window.__game.G.sound.stats().decks.some(d => d.role === 'prefetch' && d.key === 'setup'), null, { timeout: 12000 }).catch(() => {});
  s = await S(page);
  const pre = s.decks.find(d => d.role === 'prefetch');
  check('tour', `the next moment's track is prefetched in idle time (deck ${pre?.i}: ${pre?.file}, readyState ${pre?.ready})`, pre && pre.key === 'setup' && s.log.requests.includes('venue-02-prewedding (prefetch)'), s.decks.filter(d => d.role));
  await page.evaluate(() => window.__game.G.tour.next());
  await sleep(3400);
  s = await S(page);
  const nPre = audioReqs.filter(f => f === 'venue-02-prewedding.m4a').length;
  check('tour', `the film's switch → the prewedding plays ON the prefetched deck (deck ${live(s)[0]?.i}), the night loop; the file requested by one element only`,
    live(s)[0]?.file === TRACK.setup && live(s)[0]?.i === pre?.i && liveAmb(s)[0]?.key === 'night' && s.log.requests.filter(f => f.startsWith('venue-02-prewedding')).length === 1, { deck: live(s)[0], reqs: s.log.requests, httpRequests: nPre });
  await page.evaluate(() => window.__game.G.tour.jump(4));
  await sleep(3400);
  s = await S(page);
  check('tour', 'a timeline jump in the film → the dinner track + night loop; at most ONE prefetch deck (the stale one released)', live(s)[0]?.file === TRACK.dinner && liveAmb(s)[0]?.key === 'night' && s.decks.filter(d => d.role === 'music').length === 1 && s.decks.filter(d => d.role === 'prefetch').length <= 1, s.decks.filter(d => d.role).map(d => `${d.i}:${d.role}:${d.key}`));
  await page.keyboard.press('KeyM'); await sleep(1100);
  s = await S(page);
  const active = await page.evaluate(() => window.__game.G.tour.active);
  check('tour', 'M in the film: sound off, the film keeps playing (not a takeover)', !s.want && active && s.ctx === 'suspended', { want: s.want, active, ctx: s.ctx });
  await page.tap('#tourSound');
  await page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 8000 });
  await sleep(800);
  s = await S(page);
  check('tour', 'the tour bar\'s sound button: on again, still touring, the dinner track playing', s.want && (await page.evaluate(() => window.__game.G.tour.active)) && live(s)[0]?.file === TRACK.dinner && !live(s)[0].paused, live(s)[0]);
  check('tour', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── duck ── */
async function duck() {
  const { ctx, page, errs } = await open('desktop');
  await soundOn(page);
  await skip(page);
  await sleep(6000);                                    // the landing's blurb has come and gone
  await page.evaluate(() => window.__game.G.ui.go(3));
  await page.waitForFunction(() => document.getElementById('toast').classList.contains('in') && !document.getElementById('toast').classList.contains('system'), null, { timeout: 8000 });
  await sleep(600);
  let s = await S(page);
  check('duck', `a narration card ducks the music bus to ${s.musicBus} (−6 dB); the ambience bus is left alone`, s.ducked && s.musicBus === .5, { ducked: s.ducked, bus: s.musicBus });
  await page.waitForFunction(() => !document.getElementById('toast').classList.contains('in'), null, { timeout: 15000 });
  await sleep(1100);
  s = await S(page);
  check('duck', `its end restores it (${s.musicBus})`, !s.ducked && s.musicBus === 1, s.musicBus);
  await page.evaluate(() => window.__game.G.setMode('fly'));
  await sleep(500);
  s = await S(page);
  check('duck', 'a system card (fly help) does not duck', !s.ducked && s.musicBus === 1, s.musicBus);
  check('duck', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

/* ── shots: every placement ── */
async function shots() {
  for (const [vp, lang] of [['desktop', 'en'], ['desktop', 'zh'], ['phone', 'en'], ['phone', 'zh'], ['landscape', 'en']]) {
    const tag = `${vp}-${lang}`;
    const { ctx, page, errs } = await open(vp, `?lang=${lang}`);
    const shot = n => page.screenshot({ path: path.join(OUT, `ui-${tag}-${n}.png`) });
    await shot('title-off');
    await page.evaluate(() => document.getElementById('soundInv').click());
    await page.waitForFunction(() => window.__game.G.sound.stats().ctx === 'running', null, { timeout: 15000 });
    await sleep(400);
    await shot('title-on');
    await skip(page);
    await sleep(5600);
    await shot('hud-on');
    await page.evaluate(() => window.__game.G.ui.openHelp());
    await sleep(500);
    await shot('help-on');
    await page.evaluate(() => window.__game.G.ui.closeHelp());
    await page.evaluate(() => document.getElementById('soundBtn').click());
    await sleep(900);
    await shot('hud-off');
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
    check('shots', `${tag}: 6 states shot; no horizontal scroll; the caption is not clipped (${fit.caption.text})`, !fit.hscroll && fit.caption.sw <= fit.caption.cw + 1, fit);
    check('shots', `${tag}: console clean`, errs.length === 0, errs);
    await ctx.close();
  }
}

/* ── webkit: the seam + the engine in Safari's engine ── */
async function webkit() {
  const pw = require(process.env.WEBKIT_PATH || '/Users/carlfung/ai-journey/node_modules/playwright');
  const wk = await pw.webkit.launch();
  try {
    const { ctx, page, errs, audioReqs } = await open('desktop', '?lang=en', { bt: wk });
    await seamIn(page, 'webkit');
    await page.click('#soundInv');
    await page.waitForFunction(() => { const s = window.__game.G.sound.stats(); return s.ctx === 'running' && s.amb.some(v => v.playing); }, null, { timeout: 20000 });
    await sleep(1500);
    let s = await S(page);
    check('webkit', `enable in WebKit: the context made IN the tap (${s.log.ctxMs} ms, tap handler ${s.log.tapMs} ms) and running; the title track playing + ocean`,
      s.ctx === 'running' && s.log.ctxAfterMs === 0 && live(s)[0]?.file === TRACK.title && !live(s)[0].paused && live(s)[0].t > .3 && liveAmb(s)[0]?.key === 'ocean', { ctx: s.ctx, log: s.log, decks: live(s) });
    const lv = await level(page);
    check('webkit', `WebKit master sounding (peak ${lv.peak})`, lv.peak > .005, lv);
    await skip(page);
    await sleep(3200);
    await page.evaluate(() => window.__game.G.ui.go(4));
    await sleep(3600);
    s = await S(page);
    check('webkit', 'WebKit: → dinner: its track streaming (Range) + the night loop', live(s)[0]?.file === TRACK.dinner && live(s)[0].t > .5 && liveAmb(s)[0]?.key === 'night', { decks: s.decks.filter(d => d.role), amb: s.amb });
    await page.evaluate(() => window.__game.toggleNight());
    await sleep(1900);
    s = await S(page);
    check('webkit', 'WebKit: N → day: ocean', liveAmb(s)[0]?.key === 'ocean', s.amb);
    check('webkit', 'WebKit: console clean', errs.length === 0, errs);
    report.webkitRequests = audioReqs;
    await ctx.close();
  } finally { await wk.close(); }
}

/* ── tourframes: the film in real time, sound OFF vs ON (no recorder, no polling) ── */
async function tourframes() {
  for (const vp of ['desktop', 'phone']) {
    const res = {};
    for (const on of [false, true]) {
      const { ctx, page, errs } = await open(vp);
      if (on) await soundOn(page);
      await startLog(page);
      await page.click('#tourStart');
      await page.waitForFunction(() => window.__game.G.tour.state.ended, null, { timeout: 200000 });
      const log = await page.evaluate(() => { window.__flStop = true; return window.__fl; });
      const s = on ? await S(page) : null;
      res[on ? 'on' : 'off'] = { all: frames(log.map(f => f.dt)), switch: frames(log.filter(f => f.sw).map(f => f.dt)), cruise: frames(log.filter(f => !f.sw).map(f => f.dt)),
        requests: s && s.log.requests, errs };
      await ctx.close();
    }
    report['tourframes-' + vp] = res;
    const a = res.off, b = res.on;
    check('tourframes', `[${vp}] the whole film: sound off max ${a.all.max} / p95 ${a.all.p95} (switch frames max ${a.switch.max}) · sound on max ${b.all.max} / p95 ${b.all.p95} (switch frames max ${b.switch.max}) ms`,
      b.all.p95 <= a.all.p95 + 2 && b.switch.max < Math.max(45, a.switch.max * 1.5), res);
    const want = ['venue-00-title', 'venue-amb-ocean', 'venue-01-brunch', 'venue-02-prewedding (prefetch)', 'venue-amb-night', 'venue-03-ceremony (prefetch)', 'venue-04-cocktail (prefetch)', 'venue-05-dinner (prefetch)', 'venue-06-afterparty (prefetch)'];
    check('tourframes', `[${vp}] requests over the film: every moment's track once (5 of 6 prefetched), each loop once${vp === 'phone' ? ' (PHONE re-fetches a loop it dropped)' : ''}`,
      want.every(f => b.requests.includes(f)) && b.requests.filter(f => /^venue-0/.test(f)).length === 7 && !b.requests.includes('venue-00-title (loop)'), b.requests);
    check('tourframes', `[${vp}] console clean`, a.errs.length === 0 && b.errs.length === 0, [...a.errs, ...b.errs]);
  }
}

/* ── mix: the real engine, recorded off the master while the tour plays ── */
async function mix() {
  const { ctx, page, errs } = await open('desktop', '?lang=en');
  await startLog(page);
  await page.click('#soundInv');
  await page.waitForFunction(() => { const s = window.__game.G.sound.stats(); return s.ctx === 'running' && s.amb.some(v => v.playing); }, null, { timeout: 20000 });
  await page.evaluate(() => {
    const S = window.__game.G.sound, dest = S.ctx.createMediaStreamDestination();
    S._debug.master.connect(dest);
    const rec = window.__rec = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
    window.__chunks = [];
    rec.ondataavailable = e => window.__chunks.push(e.data);
    rec.start(1000);
    window.__tourLog = [];
  });
  await sleep(4000);                                    // 4 s of the title card first
  await page.click('#tourStart');
  const t0 = Date.now();
  /* note the switches + the ducks as they happen */
  const seen = [];
  while (Date.now() - t0 < 150000) {
    const st = await page.evaluate(() => { const G = window.__game.G, s = G.sound.stats(); return { active: G.tour.active, ended: G.tour.state.ended, seg: G.tour.state.segId, scene: s.scene?.key, ducked: s.ducked, file: s.decks.find(d => d.role === 'music')?.file }; });
    const key = `${st.scene}|${st.ducked}`;
    if (!seen.length || seen[seen.length - 1].key !== key) seen.push({ t: +((Date.now() - t0) / 1000 + 4).toFixed(1), key, ...st });
    if (st.ended) { await sleep(6000); break; }
    await sleep(250);
  }
  const b64 = await page.evaluate(async () => {
    await new Promise(r => { window.__rec.onstop = r; window.__rec.stop(); });
    const blob = new Blob(window.__chunks, { type: 'audio/webm' });
    const u8 = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  });
  const log = await page.evaluate(() => window.__fl);
  const sw = frames(log.filter(f => f.sw).map(f => f.dt)), all = frames(log.map(f => f.dt));
  const webm = path.join(OUT, 'tour-mix.webm'), m4a = path.join(OUT, 'tour-mix.m4a');
  fs.writeFileSync(webm, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-nostdin', '-loglevel', 'error', '-i', webm, '-c:a', 'aac', '-b:a', '160k', m4a]);
  fs.unlinkSync(webm);
  let lufs = null, peak = null, dur = null;
  try {
    const err = execFileSync('sh', ['-c', `ffmpeg -nostdin -nostats -i "${m4a}" -af ebur128=peak=true -f null - 2>&1 | tail -20`]).toString();
    lufs = +(err.match(/I:\s+(-?[\d.]+) LUFS/) || [])[1]; peak = +(err.match(/Peak:\s+(-?[\d.]+) dBFS/) || [])[1];
    dur = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', m4a]).toString().trim();
  } catch { /* reported as null */ }
  report.mix = { file: m4a, secs: dur, lufs, truePeak: peak, kb: Math.round(fs.statSync(m4a).size / 1024), timeline: seen, frames: { all, switchFrames: sw } };
  check('mix', `${m4a}: ${dur?.toFixed(1)} s, integrated ${lufs} LUFS, peak ${peak} dBFS`, dur > 130 && lufs < -18 && lufs > -34 && peak < -1, report.mix);
  const order = seen.map(x => x.scene).filter((k, i, a) => k !== a[i - 1]);
  check('mix', `the mix followed the film: ${order.join(' → ')}`, order.join() === 'title,brunch,setup,ceremony,cocktail,dinner,afterparty', order);
  check('mix', `the music ducked at each blurb (${seen.filter(x => x.ducked).length} ducks)`, seen.filter(x => x.ducked).length >= 6, seen.filter(x => x.ducked).map(x => x.t));
  check('mix', `frames during the recorded film (sound on): max ${all.max} / p95 ${all.p95} ms; switch frames max ${sw.max}`, true, report.mix.frames);
  check('mix', 'console clean', errs.length === 0, errs);
  await ctx.close();
}

const PLAN = [['zero', zero], ['enable', enable], ['switch', switching], ['seam', seam], ['loop', loop], ['hidden', hidden], ['persist', persist], ['tour', tour], ['duck', duck], ['shots', shots], ['webkit', webkit], ['tourframes', tourframes], ['mix', mix]];
for (const [k, fn] of PLAN) {
  if (!PARTS.has(k)) continue;
  try { await fn(); } catch (e) { check(k, 'threw', false, String(e && e.stack || e)); }
}
await browser.close();
const pass = results.filter(r => r.ok).length;
const rp = path.join(OUT, process.env.PARTS ? `report-${[...PARTS].join('_')}.json` : 'report.json');
fs.writeFileSync(rp, JSON.stringify({ pass, total: results.length, results, report }, null, 2));
console.log(`\n${pass}/${results.length} passed → ${rp}`);
process.exit(pass === results.length ? 0 : 1);
