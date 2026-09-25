/* SCATTER PROBE — the "only the prototype changed" proof (KAN-208 wave 2).

     node tools/scatter-probe.mjs http://127.0.0.1:8811/ before.json   # git worktree of HEAD
     node tools/scatter-probe.mjs http://127.0.0.1:8799/ after.json

   Writes a fingerprint of a build: every InstancedMesh (name, parent chain,
   count, prototype triangles, material, and a hash of its instance matrices +
   instance colours), plus a hash of G.colliders. Two builds whose seeded
   scatter is identical print the same `allMatrixHash` and `colliderHash`;
   diff the two JSONs to see which prototypes (tris / mat) changed.

   ⚠ The palms' matrices are rewritten every frame by nature's sway ticker, so
   the probe finds that ticker in G.tickers ('frond sway') and calls it with
   t = 0, synchronously, before reading — a pinned clock, not a race. */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/carlfung/projects/wedding-app/node_modules/playwright');
const [URL, OUT] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const bad = [];
  page.on('pageerror', e => bad.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.type() + ': ' + m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const G = window.__game.G;
    const nt = G.tickers.find(f => String(f).includes('frond sway'));
    nt(0, 0);
    const out = [];
    const chain = o => { const a = []; for (let p = o; p; p = p.parent) a.push(p.name || p.type); return a.slice(0, 4).join('<'); };
    G.scene.traverse(o => {
      if (!o.isInstancedMesh) return;
      const g = o.geometry;
      const tris = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
      out.push({
        name: o.name, chain: chain(o), count: o.count, tris,
        mat: (o.material.name || '') + '|' + (o.material.map ? 'map' : '') ,
        m: Array.from(o.instanceMatrix.array.slice(0, o.count * 16)).map(v => +v.toFixed(5)),
        c: o.instanceColor ? Array.from(o.instanceColor.array.slice(0, o.count * 3)).map(v => +v.toFixed(5)) : null,
        usage: o.instanceMatrix.usage,
      });
    });
    return { ims: out, colliders: G.colliders.map(c => [c.x, c.z, c.r, c.y0, c.y1].map(v => v === undefined ? null : +(+v).toFixed(5))) };
  });
  const h = x => createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 12);
  const summary = r.ims.map(i => ({ name: i.name, chain: i.chain, count: i.count, tris: i.tris, mat: i.mat, dyn: i.usage !== 35044, mh: h(i.m), ch: i.c ? h(i.c) : null }));
  writeFileSync(OUT, JSON.stringify({ url: URL, colliders: r.colliders.length, colliderHash: h(r.colliders), allMatrixHash: h(r.ims.map(i => [i.m, i.c])), ims: summary, errors: bad }, null, 1));
  console.log('colliders', r.colliders.length, h(r.colliders), 'ims', r.ims.length, 'allMatrixHash', h(r.ims.map(i => [i.m, i.c])), 'errors', bad.length);
  await browser.close();
})();
