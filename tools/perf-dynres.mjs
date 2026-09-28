/* PERF DYNRES (KAN-235) — the phone tier, checked end to end on an emulated phone.

     python3 serve.py 8803 &
     node tools/perf-dynres.mjs            # VENUE_URL=… to point elsewhere

   1. TIER: a 390 × 844 touch viewport boots the phone tier (the ten lo/
      GLBs, a live controller); a 1600 × 900 desktop boots the full tier
      (no lo/ request at all, pixel ratio pinned at min(DPR, 2)); ?tier=full on
      the phone forces the full tier.
   2. CONTROLLER, driven by a SYNTHETIC GPU: the headless GPU is an M-series and
      never slow, so the top-level renderer.render() is wrapped with a busy-wait
      whose length is a function of the CURRENT pixel ratio — a stand-in for a
      fill-bound phone. Three phases:
        A  cost {2: 34, 1.75: 28, 1.5: 6, 1.25: 4} ms — must step 2 → 1.75 → 1.5
           within seconds, then HOLD 1.5 although it is fast: 1.75 was left for
           being slow, so it is burnt for 30 s; after that exactly ONE retry,
           which fails, and 1.5 again — no oscillation;
        B  a moment switch clears the burns (a new scene is re-probed);
        C  cost 0 — must climb back to 2 one level at a time.
      Programs are counted before and after (a ratio change must compile
      nothing) and the console must stay clean. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');
const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true };
const DESK = { viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true };

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-certificate-errors'] });
async function open(opts, q = '') {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errs = [], lo = [];
  page.on('pageerror', e => errs.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  page.on('request', r => { if (/\/assets\/models\/lo\//.test(r.url())) lo.push(r.url().split('/').pop()); });
  await page.goto(BASE + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
  return { ctx, page, errs, lo };
}
const state = page => page.evaluate(async () => {
  const G = window.__game.G, m = await import('./js/models.js');
  return { tier: G.tier, dr: G.dynres.stats(), lo: m.loNames().length, programs: G.renderer.info.programs.length };
});

/* 1 · the tier */
{
  const { ctx, page, errs, lo } = await open(DESK);
  const s = await state(page);
  check('desktop → full tier, no lo/ request, ratio pinned', s.tier === 'full' && lo.length === 0 && s.lo === 0 && !s.dr.enabled && s.dr.ratio === 1, { tier: s.tier, lo: lo.length, dr: s.dr.enabled, ratio: s.dr.ratio });
  check('desktop console clean', errs.length === 0, errs);
  await ctx.close();
}
{
  const { ctx, page, errs, lo } = await open(PHONE, '?tier=full');
  const s = await state(page);
  check('phone ?tier=full → full tier, no lo/, ratio 2 fixed', s.tier === 'full' && lo.length === 0 && !s.dr.enabled && s.dr.ratio === 2, { tier: s.tier, lo: lo.length, ratio: s.dr.ratio });
  check('phone ?tier=full console clean', errs.length === 0, errs);
  await ctx.close();
}

/* 2 · the phone tier + the controller */
{
  const { ctx, page, errs, lo } = await open(PHONE);
  let s = await state(page);
  check('phone → phone tier, the 10 lo/ GLBs (+ lo.json), controller live at 2', s.tier === 'phone' && s.lo === 10 && lo.filter(n => n.endsWith('.glb')).length === 10 && s.dr.enabled && s.dr.ratio === 2, { tier: s.tier, lo: s.lo, requested: lo.length, levels: s.dr.levels, ratio: s.dr.ratio });
  const prog0 = s.programs;
  await page.evaluate(() => {
    const g = window.__game, G = g.G, R = G.renderer;
    g.skipIntro(); G.player.locked = true;
    const orig = R.render.bind(R);
    let depth = 0;
    window.__cost = null;
    R.render = (sc, cam) => {
      depth++;
      try { orig(sc, cam); } finally { depth--; }
      if (depth === 0 && R.getRenderTarget() === null && window.__cost) {
        const ms = window.__cost[R.getPixelRatio()] || 0, until = performance.now() + ms;
        while (performance.now() < until) { /* the synthetic fill cost */ }
      }
    };
  });
  await sleep(2500);   // settle after skipIntro's switch
  await page.evaluate(() => { window.__cost = { 2: 34, 1.75: 28, 1.5: 6, 1.25: 4 }; window.__t0 = performance.now(); });
  await sleep(46000);
  s = await state(page);
  const t0 = await page.evaluate(() => window.__t0);
  const logA = s.dr.log.filter(e => e[0] >= t0).map(e => [+(e[0] - t0).toFixed(0), e[1], e[2], e[3]]);
  const pathA = logA.map(e => `${e[1]}→${e[2]}`).join(' ');
  check(`A: slow GPU steps 2 → 1.75 → 1.5, retries 1.75 ONCE, holds 1.5 (${pathA})`,
    pathA === '2→1.75 1.75→1.5 1.5→1.75 1.75→1.5' && s.dr.ratio === 1.5 && s.dr.burnt.includes(1), logA);
  const firstDown = logA[0] ? logA[0][0] : null;
  check('A: the first step comes within 4 s of the slowdown, 1.5 within 9 s', firstDown !== null && firstDown < 4000 && logA[1] && logA[1][0] < 9000, logA.slice(0, 2).map(e => e[0]));
  check('A: the retry waits out the 30 s burn', logA[2] && logA[2][0] - logA[1][0] >= 30000, logA[2] && logA[2][0] - logA[1][0]);
  await sleep(8000);
  s = await state(page);
  check('A: still 1.5 eight seconds later (no oscillation)', s.dr.ratio === 1.5 && s.dr.log.filter(e => e[0] >= t0).length === logA.length, s.dr.ratio);

  /* B · a moment switch clears the burns */
  await page.evaluate(() => window.__game.setMoment(2));
  await sleep(300);
  s = await state(page);
  check('B: a moment switch clears the burns', s.dr.burnt.length === 0, s.dr.burnt);

  /* C · a fast GPU climbs back */
  await page.evaluate(() => { window.__cost = null; window.__t1 = performance.now(); });
  await sleep(17000);
  s = await state(page);
  const t1 = await page.evaluate(() => window.__t1);
  const logC = s.dr.log.filter(e => e[0] >= t1).map(e => `${e[1]}→${e[2]}`).join(' ');
  check(`C: a fast GPU climbs back to 2, one level at a time (${logC})`, s.dr.ratio === 2 && logC === '1.5→1.75 1.75→2', logC);
  check('programs unchanged by every ratio change', s.programs === prog0, { before: prog0, after: s.programs });
  const size = await page.evaluate(() => ({ w: window.__game.G.canvas.width, h: window.__game.G.canvas.height, cw: window.__game.G.canvas.clientWidth }));
  check('the drawing buffer follows the ratio (780 × 1688 at 2), CSS size unchanged', size.w === 780 && size.h === 1688 && size.cw === 390, size);
  check('phone console clean', errs.length === 0, errs);
  await ctx.close();
}
await browser.close();
const fails = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fails} / ${results.length} passed`);
process.exit(fails ? 1 : 0);
