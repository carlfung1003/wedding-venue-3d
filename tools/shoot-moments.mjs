/* SHOOT THE MOMENTS — one screenshot + render stats per moment, plus a few
   close-up "guest distance" views of the dressed props. Used to keep a
   before/after record of an asset pass (KAN-207): run once on the old build
   with TAG=before, once on the new with TAG=after, then compare.

     python3 serve.py 8799 &
     TAG=before node tools/shoot-moments.mjs        # -> reference/photos/shots-before/
     VENUE_URL=https://venue.carlfung.dev TAG=live node tools/shoot-moments.mjs

   Playwright is borrowed from ~/projects/wedding-app (this project has no deps),
   and Chromium MUST run on Metal — SwiftShader renders at ~1 fps and the
   numbers mean nothing. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const TAG = process.env.TAG || 'shots';
const SITE_URL = process.env.VENUE_URL || 'http://127.0.0.1:8799/';
const OUT = new URL(`../reference/photos/shots-${TAG}/`, import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/* views: [name, momentIndex, local x, local z, yaw]  (null pos = the spawn) */
const VIEWS = [
  ['brunch-spawn', 0, null],
  ['setup-spawn', 1, null],
  ['setup-champagne', 1, [7.5, -7.2, 0]],
  ['ceremony-spawn', 2, null],
  ['ceremony-head', 2, [-22, 66.2, Math.PI]],
  ['ceremony-chairs', 2, [-25.5, 60.4, Math.PI * 0.62]],
  ['ceremony-dessert-bar', 2, [-30.2, 67.2, Math.PI / 2]],
  ['ceremony-hats-plinths', 2, [-27.0, 62.0, Math.PI / 2]],
  ['ceremony-coconut-cart', 2, [-29.0, 73.2, Math.PI / 2]],
  ['cocktail-spawn', 3, null],
  ['cocktail-bar', 3, [4, 65.3, Math.PI]],
  ['dinner-spawn', 4, null],
  ['dinner-table', 4, [-17, 5.2, Math.PI / 4]],
  ['dinner-long', 4, [-20, -1.2, Math.PI]],
  ['afterparty-spawn', 5, null],
  ['afterparty-dj', 5, [0, -15.4, Math.PI]],
];

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const bad = [];
  page.on('pageerror', e => bad.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.type() + ': ' + m.text()); });

  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    try { await page.goto(SITE_URL, { waitUntil: 'load' }); ok = true; }
    catch (e) { await new Promise(r => setTimeout(r, 500)); }
  }
  if (!ok) throw new Error('server not up at ' + SITE_URL);
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.evaluate(() => { window.__game.skipIntro(); window.__game.G.player.locked = true; });
  await page.waitForTimeout(800);

  const stats = [];
  for (const [name, mi, pos] of VIEWS) {
    const s = await page.evaluate(async ([mi, pos]) => {
      const g = window.__game, G = g.G;
      const P = await import('./js/player.js');
      const S = await import('./js/site.js');
      const { CFG } = await import('./js/config.js');
      g.setMoment(mi);
      for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      if (pos) {
        const w = S.enclaveToWorld(pos[0], pos[1]);
        G.player.pos.set(w.x, CFG.EYE_HEIGHT, w.z);
        P.setFacing(pos[2] + S.ENCLAVE.rotY);   // local yaw -> world yaw
        for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      }
      /* let the light budget / detail cull settle, then measure one second */
      await new Promise(r => setTimeout(r, 700));
      let frames = 0;
      const t0 = performance.now();
      await new Promise(r => {
        const tick = () => { frames++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else r(); };
        requestAnimationFrame(tick);
      });
      const inf = G.renderer.info;
      return {
        fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1),
        calls: inf.render.calls, tris: inf.render.triangles,
        geometries: inf.memory.geometries, textures: inf.memory.textures,
        programs: inf.programs ? inf.programs.length : null,
        night: !!G.night, colliders: G.colliders.length,
        feet: +(G.player.pos.y - CFG.EYE_HEIGHT).toFixed(3),
      };
    }, [mi, pos]);
    await page.screenshot({ path: `${OUT}${name}.png` });
    stats.push({ view: name, ...s });
    console.log(name.padEnd(24), JSON.stringify(s));
  }
  writeFileSync(`${OUT}stats.json`, JSON.stringify({ url: SITE_URL, when: new Date().toISOString(), stats, errors: bad }, null, 2));
  console.log('\nerrors:', bad.length ? bad : 'none');
  console.log('wrote', OUT);
  await browser.close();
})();
