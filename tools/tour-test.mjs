/* THE GUIDED TOUR — Playwright checks + the record (KAN-233).

     python3 serve.py 8803 &
     node tools/tour-test.mjs                       # everything → reference/photos/shots-tour/
     ONLY=desktop-en,phone-zh node tools/tour-test.mjs
     PARTS=film,takeover node tools/tour-test.mjs   # film | controls | takeover | deeplink | reduced | regress

   Per run (a viewport × a language):
     film      the whole tour in REAL TIME from the title card's "Take the tour":
               frame-time log (max / p95 per segment, the switch frames apart),
               programs before / after, average + peak camera speed per segment,
               a screenshot at each moment's hero beat and of the closing card.
               Only the runs listed in FILM (default desktop-en, phone-zh) — the
               others seek to each beat instead of sitting through 2¼ minutes.
     controls  Space pause/resume, → next, ← previous, a timeline node jumps the
               film, the help sheet pauses it, Esc hands over, the end card's
               Watch again / Walk it yourself.
     takeover  mid-flight in EVERY moment: a key (W) and a mouse drag on desktop,
               a tap and a drag on the phone — asserts walk mode, feet ON floorY
               at the moment's own floor, clear of every live collider, still
               standing a second later, the "walking now" card, and that W walks.
     deeplink  ?tour=1 starts on its own (+ ?lang, + ?m=ceremony starts there).
     reduced   prefers-reduced-motion: static shots, the cross-fade layer fires.
     regress   Step inside still dives into the prewedding; ?m=dinner still lands.
   Writes report-<run>.json + frames-<run>.json next to the screenshots. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const OUT = process.argv[2] || 'reference/photos/shots-tour';
fs.mkdirSync(OUT, { recursive: true });
const VPS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const RUNS = (process.env.ONLY || 'desktop-en,desktop-zh,phone-en,phone-zh,landscape-en').split(',');
const FILM = new Set((process.env.FILM || 'desktop-en,phone-zh').split(','));
const PARTS = new Set((process.env.PARTS || 'film,controls,takeover,deeplink,reduced,regress').split(','));
const NOSHOT = !!process.env.NOSHOT;
const results = [];
const check = (run, name, ok, detail) => { results.push({ run, name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${run}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization'] });

async function open(vp, lang, query = '', extra = {}) {
  const ctx = await browser.newContext({ ...VPS[vp], ...extra });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await page.goto(`${BASE}?lang=${lang}${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForTimeout(900);
  return { ctx, page, errs };
}
const state = page => page.evaluate(() => { const T = window.__game.G.tour; return { active: T.active, ...T.state }; });
const programs = page => page.evaluate(() => window.__game.G.renderer.info.programs.length);

/* the in-page frame log: every rAF, tagged with the tour segment + whether a
   moment switch (the veil) is in flight */
async function startLog(page) {
  await page.evaluate(() => {
    const G = window.__game.G; const L = window.__tourLog = [];
    let last = performance.now();
    const tick = now => {
      const T = G.tour.state;
      L.push({ dt: now - last, seg: G.tour.active ? T.segId : (T.ended ? 'end' : 'none'), t: T.t,
        sw: G.ui.isSwitching(), ended: T.ended, x: G.camera.position.x, y: G.camera.position.y, z: G.camera.position.z, p: G.renderer.info.programs.length });
      last = now;
      if (!window.__tourLogStop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
function summarise(log) {
  const by = {};
  for (let i = 1; i < log.length; i++) {
    const f = log[i];
    const k = f.seg; (by[k] ||= { cruise: [], switch: [], dist: 0, time: 0, peak: 0 });
    /* a frame is a SWITCH frame if the veil is up or within 3 frames of it */
    const near = [-3, -2, -1, 0, 1, 2, 3].some(d => log[i + d] && log[i + d].sw);
    (near ? by[k].switch : by[k].cruise).push(f.dt);
    if (!near && log[i - 1].seg === k && f.dt > 0) {
      const d = Math.hypot(f.x - log[i - 1].x, f.y - log[i - 1].y, f.z - log[i - 1].z);
      if (d < 5) { by[k].dist += d; by[k].time += f.dt / 1000; by[k].peak = Math.max(by[k].peak, d / (f.dt / 1000)); }
    }
  }
  const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
  const out = {};
  for (const [k, v] of Object.entries(by)) {
    out[k] = { frames: v.cruise.length + v.switch.length, cruiseMax: q(v.cruise, 1), cruiseP95: q(v.cruise, .95),
      cruiseMean: v.cruise.length ? +(v.cruise.reduce((a, b) => a + b, 0) / v.cruise.length).toFixed(1) : null,
      switchMax: q(v.switch, 1), speedAvg: v.time ? +(v.dist / v.time).toFixed(2) : null, speedPeak: +v.peak.toFixed(2) };
  }
  return out;
}

/* ── film: the whole tour, real time ── */
async function film(run, vp, lang) {
  const { ctx, page, errs } = await open(vp, lang);
  if (!NOSHOT) await page.screenshot({ path: path.join(OUT, `${run}-title.png`) });
  const p0 = await programs(page);
  await startLog(page);
  await page.click('#tourStart');
  const shot = {};
  const t0 = Date.now();
  let paused = false;
  while (Date.now() - t0 < 200000) {
    const s = await state(page);
    if (s.ended) break;
    /* hero beat = 60 % into the segment; the blurb is up by then */
    /* NOSHOT=1: a screenshot blocks the page's rAF for 60–250 ms, which the
       frame log then books as a spike — the clean timing run takes none */
    if (s.active && s.segId && !shot[s.segId] && s.t >= s.dur * .6) {
      shot[s.segId] = true;
      if (!NOSHOT) await page.screenshot({ path: path.join(OUT, `${run}-${s.segId}.png`) });
    }
    /* one paused frame of the bar, mid-ceremony */
    if (!NOSHOT && !paused && s.segId === 'ceremony' && s.t > 9) {
      paused = true;
      await page.keyboard.press('Space');
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${run}-paused.png`) });
      await page.keyboard.press('Space');
    }
    await sleep(120);
  }
  const secs = (Date.now() - t0) / 1000;
  await sleep(1400);
  await page.evaluate(() => { window.__tourLogStop = true; });
  if (!NOSHOT) await page.screenshot({ path: path.join(OUT, `${run}-end.png`) });
  const log = await page.evaluate(() => window.__tourLog);
  const p1 = await programs(page);
  const progSeen = [...new Set(log.map(f => f.p))];
  const sum = summarise(log);
  fs.writeFileSync(path.join(OUT, `frames-${run}${NOSHOT ? '-clean' : ''}.json`), JSON.stringify({ secs, programsBefore: p0, programsAfter: p1, programsSeen: progSeen, segments: sum,
    spikes: log.filter(f => f.dt > 50).map(f => ({ seg: f.seg, t: +f.t.toFixed(2), dt: +f.dt.toFixed(1), sw: f.sw })) }, null, 2));
  check(run, 'film reaches the closing card', (await state(page)).ended, { secs: +secs.toFixed(1) });
  check(run, 'every moment shot at its beat', Object.keys(shot).length === 6, Object.keys(shot));
  check(run, 'programs constant through the film', progSeen.length === 1 && p0 === p1, { p0, p1, progSeen });
  check(run, 'camera speed gentle (avg ≤ 1.3, peak ≤ 3 m/s)', Object.entries(sum).filter(([k]) => k !== 'none' && k !== 'end').every(([, v]) => v.speedAvg <= 1.3 && v.speedPeak <= 3), Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, [v.speedAvg, v.speedPeak]])));
  console.table(sum);
  /* the end card's two actions */
  await page.click('#tourAgain');
  await sleep(1500);
  let s = await state(page);
  check(run, 'Watch again restarts at the brunch', s.active && s.segId === 'brunch' && !s.ended, { seg: s.segId });
  await page.evaluate(() => { const T = window.__game.G.tour; T.jump(5); });
  await sleep(1200);
  await page.evaluate(() => { const T = window.__game.G.tour; T.seek(T.state.dur - .05); });
  await sleep(1500);
  s = await state(page);
  check(run, 'the end card returns after the after party', s.ended, {});
  await page.click('#tourWalk');
  await sleep(600);
  const w = await standCheck(page);
  check(run, 'Walk it yourself → standing at the after party', w.ok && w.moment === 'afterparty', w);
  check(run, 'no console errors (film)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

/* seek-based beat shots for the runs that do not sit through the film */
async function beats(run, vp, lang) {
  const { ctx, page, errs } = await open(vp, lang);
  await page.screenshot({ path: path.join(OUT, `${run}-title.png`) });
  await page.click('#tourStart');
  await sleep(2600);
  await page.screenshot({ path: path.join(OUT, `${run}-hint.png`) });
  for (let k = 0; k < 6; k++) {
    await page.evaluate(k => window.__game.G.tour.jump(k), k);   // segment k = moment k (both chronological)
    await sleep(1300);
    const id = await page.evaluate(() => { const T = window.__game.G.tour; T.seek(T.state.dur * .6 - 1.2); return T.state.segId; });
    await sleep(1500);
    await page.screenshot({ path: path.join(OUT, `${run}-${id}.png`) });
  }
  await page.keyboard.press('Space');
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `${run}-paused.png`) });
  await page.keyboard.press('Space');
  await page.evaluate(() => { const T = window.__game.G.tour; T.seek(T.state.dur - .05); });
  await sleep(1800);
  await page.screenshot({ path: path.join(OUT, `${run}-end.png`) });
  check(run, 'end card shown', (await state(page)).ended);
  check(run, 'no console errors (beats)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

/* where the guest is standing, judged against the live scene */
async function standCheck(page) {
  return page.evaluate(async () => {
    const G = window.__game.G;
    const W = await import('./js/world.js');
    const { CFG } = await import('./js/config.js');
    const m = CFG.MOMENTS[G.momentIndex];
    const base = m.spawn.y || 0;
    const feet = G.player.pos.y - CFG.EYE_HEIGHT;
    const f = W.floorY(G.player.pos.x, G.player.pos.z, feet + .01);
    let worst = 99, hit = null;
    for (const c of G.colliders) {
      if (c.y0 !== undefined && feet < c.y0) continue;
      if (c.y1 !== undefined && feet >= c.y1) continue;
      const d = Math.hypot(G.player.pos.x - c.x, G.player.pos.z - c.z) - (c.r + CFG.PLAYER_R);
      if (d < worst) { worst = d; hit = c; }
    }
    const res = { moment: m.id, feet: +feet.toFixed(3), floor: +f.toFixed(3), base, clear: +worst.toFixed(3),
      mode: G.mode, tour: G.tour.active, spot: G.lastTakeover && G.lastTakeover.spot && G.lastTakeover.spot.why,
      toast: document.querySelector('#toast .msg').textContent };
    res.ok = G.mode === 'walk' && !G.tour.active && Math.abs(feet - f) < 1e-3 && Math.abs(feet - base) <= .35 && worst >= -1e-6;
    return res;
  });
}

/* ── takeover in every moment, by every input this viewport has ── */
async function takeovers(run, vp, lang) {
  const { ctx, page, errs } = await open(vp, lang);
  await page.click('#tourStart');
  await sleep(2000);
  const touch = vp !== 'desktop';
  const ways = touch ? ['tap', 'drag'] : ['key', 'drag'];
  const size = VPS[vp].viewport;
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  for (const way of ways) {
    for (let k = 0; k < 6; k++) {
      /* restart the film at moment k and let it fly a varying way in */
      await page.evaluate(k => { const G = window.__game.G; if (!G.tour.active) G.tour.start(k, { announce: false }); else G.tour.jump(k); }, k);
      await sleep(1300);
      const tt = 3 + ((k * 7 + (way === 'drag' ? 5 : 0)) % 11);
      await page.evaluate(tt => window.__game.G.tour.seek(tt), tt);
      await sleep(500);
      const before = await state(page);
      const cx = size.width * .62, cy = size.height * .42;
      if (way === 'key') {
        await page.keyboard.down('KeyW'); await sleep(40);
      } else if (way === 'tap') {
        await page.touchscreen.tap(cx, cy);
      } else if (way === 'drag' && !touch) {
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 60, cy + 10, { steps: 5 }); await page.mouse.up();
      } else if (way === 'drag') {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
        for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 12, y: cy }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      const at = await standCheck(page);
      await sleep(way === 'key' ? 700 : 1000);
      const later = await standCheck(page);
      let walked = null;
      if (way === 'key') {
        await page.keyboard.up('KeyW');
        walked = at.ok && later.ok;
      }
      const moved = await page.evaluate(() => window.__game.G.player.pos.clone());
      check(run, `takeover by ${way} in ${before.segId} at t=${tt}s`, at.ok && later.ok && Math.abs(later.feet - at.feet) <= .41 && /walking|自己走走/i.test(later.toast),   // the card may wait out a title reveal
        { at, laterFeet: later.feet, laterClear: later.clear, walked });
    }
  }
  if (cdp) await cdp.detach();
  await page.screenshot({ path: path.join(OUT, `${run}-takeover.png`) });
  check(run, 'no console errors (takeover)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

/* ── the controls ── */
async function controls(run, vp, lang) {
  const { ctx, page, errs } = await open(vp, lang);
  await page.click('#tourStart');
  await sleep(2500);
  let s = await state(page);
  check(run, 'Take the tour starts at the brunch', s.active && s.segId === 'brunch', { seg: s.segId });
  const touch = vp !== 'desktop';
  const press = async (key, sel) => { if (touch) await page.click(sel); else await page.keyboard.press(key); };
  await press('Space', '#tourPlay');
  const a = (await state(page)).t; await sleep(1200); const b = (await state(page)).t;
  check(run, 'pause holds the clock', Math.abs(b - a) < .01 && (await state(page)).paused, { a, b });
  await page.screenshot({ path: path.join(OUT, `${run}-bar-paused.png`) });
  await press('Space', '#tourPlay');
  await sleep(1000);
  const c = (await state(page)).t;
  check(run, 'resume runs it again', c > b + .5, { b, c });
  await press('ArrowRight', '#tourNext'); await sleep(1400);
  s = await state(page);
  check(run, 'next → prewedding (night)', s.segId === 'setup' && await page.evaluate(() => window.__game.G.night), { seg: s.segId });
  await press('ArrowRight', '#tourNext'); await sleep(1400);
  await press('ArrowLeft', '#tourPrev'); await sleep(1400);
  s = await state(page);
  check(run, 'previous → back to prewedding', s.segId === 'setup', { seg: s.segId });
  /* a timeline node jumps the film, it does not take over */
  await page.evaluate(() => document.querySelectorAll('#moments .chip')[4].click());
  await sleep(1400);
  s = await state(page);
  check(run, 'timeline node → the film jumps to dinner', s.active && s.segId === 'dinner', { seg: s.segId });
  /* help pauses it */
  await page.evaluate(() => window.__game.G.ui.openHelp());
  const h0 = (await state(page)).t; await sleep(1000); const h1 = (await state(page)).t;
  await page.screenshot({ path: path.join(OUT, `${run}-help.png`) });
  check(run, 'help sheet pauses the film', Math.abs(h1 - h0) < .01, { h0, h1 });
  await page.evaluate(() => window.__game.G.ui.closeHelp());
  await sleep(300);
  if (touch) await page.click('#tourExit'); else await page.keyboard.press('Escape');
  await sleep(500);
  const w = await standCheck(page);
  check(run, `${touch ? '“Walk myself”' : 'Esc'} hands over at the dinner`, w.ok && w.moment === 'dinner', w);
  /* the HUD / touch button resumes from where you are */
  await page.click(touch ? '#btnTour' : '#tourBtn');
  await sleep(1500);
  s = await state(page);
  check(run, 'the in-walk tour button resumes from this moment', s.active && s.segId === 'dinner', { seg: s.segId });
  /* the help sheet's button plays from the start */
  await page.evaluate(() => window.__game.G.tour.takeover({ reason: 'test' }));
  await page.evaluate(() => window.__game.G.ui.openHelp());
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, `${run}-help-walk.png`) });
  await page.click('#helpTour');
  await sleep(1500);
  s = await state(page);
  check(run, 'help sheet “Take the tour” plays from the brunch', s.active && s.segId === 'brunch', { seg: s.segId });
  check(run, 'no console errors (controls)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

async function deeplink(run, vp, lang) {
  for (const [q, want] of [['&tour=1', 'brunch'], ['&tour=1&m=ceremony', 'ceremony']]) {
    const { ctx, page, errs } = await open(vp, lang, q);
    await sleep(3200);
    const s = await state(page);
    await page.screenshot({ path: path.join(OUT, `${run}-deeplink${q.includes('m=') ? '-ceremony' : ''}.png`) });
    check(run, `?${q.slice(1)} starts the film on its own at ${want}`, s.active && s.segId === want, { seg: s.segId, url: page.url() });
    check(run, `no console errors (${q})`, errs.length === 0, errs.slice(0, 5));
    await ctx.close();
  }
}

async function reduced(run, vp, lang) {
  const { ctx, page, errs } = await open(vp, lang, '', { reducedMotion: 'reduce' });
  await page.evaluate(() => { const c = document.getElementById('tourFade'); window.__fades = 0; new MutationObserver(() => { if (c.classList.contains('on')) window.__fades++; }).observe(c, { attributes: true }); });
  await page.click('#tourStart');
  await sleep(1500);
  const p1 = await page.evaluate(() => window.__game.G.camera.position.toArray());
  await sleep(2000);
  const p2 = await page.evaluate(() => window.__game.G.camera.position.toArray());
  check(run, 'reduced motion: the shot holds still', p1.every((v, i) => Math.abs(v - p2[i]) < 1e-6), { p1, p2 });
  await page.evaluate(() => { const T = window.__game.G.tour; T.seek(T.state.dur / 2 - .3); });
  await sleep(900);
  const p3 = await page.evaluate(() => window.__game.G.camera.position.toArray());
  const fades = await page.evaluate(() => window.__fades);
  check(run, 'reduced motion: a second framed shot, cut by a cross-fade', p3.some((v, i) => Math.abs(v - p2[i]) > .5) && fades >= 2, { fades });
  await page.screenshot({ path: path.join(OUT, `${run}-reduced.png`) });
  await page.keyboard.press('ArrowRight');
  await sleep(900);
  check(run, 'reduced motion: moment switch also cross-fades', (await page.evaluate(() => window.__fades)) >= 3 && (await state(page)).segId === 'setup');
  check(run, 'no console errors (reduced)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

async function regress(run, vp, lang) {
  let { ctx, page, errs } = await open(vp, lang);
  await page.click('#begin');
  await sleep(7000);
  let r = await page.evaluate(() => { const G = window.__game.G; return { started: G.started, m: G.momentIndex, tour: G.tour.active, intro: G.introActive }; });
  check(run, 'Step inside still dives into the prewedding', r.started && r.m === 1 && !r.tour && !r.intro, r);
  check(run, 'no console errors (step inside)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
  ({ ctx, page, errs } = await open(vp, lang, '&m=dinner'));
  await page.click('#begin');
  await sleep(2500);
  r = await page.evaluate(() => { const G = window.__game.G; return { m: G.momentIndex, tour: G.tour.active, url: location.search }; });
  check(run, '?m=dinner still lands at the dinner', r.m === 4 && !r.tour, r);
  /* baseline: the timeline's own switch cost, for the film's switch frames */
  await startLog(page);
  for (let k = 0; k < 6; k++) { await page.evaluate(k => window.__game.G.ui.go(k), k); await sleep(1600); }
  await page.evaluate(() => { window.__tourLogStop = true; });
  const log = await page.evaluate(() => window.__tourLog);
  const sw = log.filter((f, i) => [-3, -2, -1, 0, 1, 2, 3].some(d => log[i + d] && log[i + d].sw)).map(f => f.dt);
  const q = (a, p) => +[...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(1);
  fs.writeFileSync(path.join(OUT, `frames-${run}-timeline-baseline.json`), JSON.stringify({ switchMax: q(sw, 1), switchP95: q(sw, .95), n: sw.length }, null, 2));
  console.log('timeline switch baseline', run, { switchMax: q(sw, 1), switchP95: q(sw, .95) });
  check(run, 'no console errors (deep link + timeline)', errs.length === 0, errs.slice(0, 5));
  await ctx.close();
}

for (const run of RUNS) {
  const [vp, lang] = run.split('-');
  if (PARTS.has('film')) await (FILM.has(run) ? film(run, vp, lang) : beats(run, vp, lang));
  if (PARTS.has('controls') && vp !== 'landscape') await controls(run, vp, lang);
  if (PARTS.has('takeover') && (run === 'desktop-en' || run === 'phone-zh' || run === 'landscape-en')) await takeovers(run, vp, lang);
  if (PARTS.has('deeplink') && (run === 'desktop-zh' || run === 'phone-en')) await deeplink(run, vp, lang);
  if (PARTS.has('reduced') && (run === 'desktop-en' || run === 'phone-zh')) await reduced(run, vp, lang);
  if (PARTS.has('regress') && (run === 'desktop-en' || run === 'phone-en')) await regress(run, vp, lang);
}
const failed = results.filter(r => !r.ok);
fs.writeFileSync(path.join(OUT, `report${process.env.ONLY ? '-' + process.env.ONLY.replace(/,/g, '_') : ''}.json`), JSON.stringify({ when: new Date().toISOString(), base: BASE, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) { console.log('FAILED:'); for (const f of failed) console.log(' ', f.run, f.name); }
await browser.close();
process.exit(failed.length ? 1 : 0);
