/* Re-render assets/og.jpg (1200×630) from the LIVE scene — the prewedding deck
   at night, up the pool's centreline at the suite (shoot-moments'
   archC-across-pool-night camera; the signature-night corner blows out on
   the near lanterns at 1200×630). A render, not generated art: the unfurl must show the venue as it
   is. Re-run whenever the venue changes materially (KAN-218).
     python3 serve.py 8803 & node tools/render-og.mjs [out.png]
   then: cwebp/sips to JPEG ~q82 → assets/og.jpg */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');
const OUT = process.argv[2] || 'og-render.png';
const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto(process.env.VENUE_URL || 'http://127.0.0.1:8803/');
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(async () => {
  const g = window.__game, G = g.G;
  g.skipIntro(); G.player.locked = true;
  document.body.classList.add('clean');
  for (const id of ['hud', 'moments', 'toast', 'prompt', 'touch', 'reveal', 'veil', 'lockHint']) {
    const e = document.getElementById(id); if (e) e.style.display = 'none';
  }
  const S = await import('./js/site.js'), P = await import('./js/player.js');
  const { CFG } = await import('./js/config.js');
  g.setMoment(1);
  const c = S.enclaveToWorld(0, 19.0), t = S.enclaveToWorld(0, -18);
  G.setMode('fly', { quiet: true });
  G.player.pos.set(c.x, -0.05 + CFG.EYE_HEIGHT, c.z);
  P.setFacing(Math.atan2(-(t.x - c.x), -(t.z - c.z)));
  P.applyLook(0, -0.07, 1);
});
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT });
await browser.close();
