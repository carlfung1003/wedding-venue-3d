/* PERF LO A/B (KAN-235) — what the PHONE tier's 1024² atlases look like, exactly.

     python3 serve.py 8803 &
     node tools/perf-lo-ab.mjs [outDir]        # default reference/photos/shots-perf/lo-ab
     ONLY=archC-signature-night,…              # a subset of tools/shoot-moments.mjs views

   On a phone viewport (390 × 844, pixel ratio 2 — the ratio a phone that keeps
   up renders at) the page boots with ?tier=full (the 2048² atlases), then per
   view renders the SAME frame twice, synchronously: A with the hi atlases, B
   with every material that samples one of the lo/ twins' 2048² atlases switched
   to its lo/ twin's map (same upload parameters → same program), and reads
   both back. No clock, no animation between A and B — a difference is the
   atlas and nothing else (the wave-F in-page method). Writes
   <view>.png = A | B | |A−B| × 8, and ab.json (mean |Δ|/255, share of pixels
   off by more than 8/255, per view). */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');
const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const OUT = process.argv[2] || 'reference/photos/shots-perf/lo-ab';
mkdirSync(OUT, { recursive: true });
const src = readFileSync(new URL('./shoot-moments.mjs', import.meta.url), 'utf8');
const a = src.indexOf('const VIEWS = ['), b = src.indexOf('\n];', a);
const VIEWS = new Function('return ' + src.slice(a + 'const VIEWS = '.length, b + 3))();
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-certificate-errors'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('PAGE: ' + e));
await page.goto(BASE + '?tier=full&dr=off', { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
const setup = await page.evaluate(async () => {
  const g = window.__game, G = g.G; g.skipIntro(); G.player.locked = true;
  const models = await import('./js/models.js');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
  const lo = await (await fetch('assets/models/lo/lo.json')).json();
  const d = new DRACOLoader(); d.setDecoderPath('vendor/three@0.180.0/examples/jsm/libs/draco/gltf/');
  const L = new GLTFLoader(); L.setDRACOLoader(d);
  const pairs = [];            // [hiSource, loTexture]
  for (const n of Object.keys(lo)) {
    const hi = models.material(n);
    if (!hi || !hi.map) continue;
    const gl = await L.loadAsync(`assets/models/lo/${n}.glb`);
    let lm = null; gl.scene.traverse(o => { if (o.isMesh && o.material.map) lm = o.material.map; });
    for (const k of ['wrapS', 'wrapT', 'flipY', 'colorSpace', 'anisotropy', 'magFilter', 'minFilter', 'generateMipmaps', 'channel']) lm[k] = hi.map[k];
    lm.needsUpdate = true;
    pairs.push([hi.map.source, lm, n]);
  }
  const uses = [];             // [material, hiMap, loMap]
  const seen = new Set();
  G.scene.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) {
      if (seen.has(m) || !m.map) continue;
      const p = pairs.find(([s]) => s === m.map.source);
      if (p) { seen.add(m); const t = p[1].clone(); t.repeat.copy(m.map.repeat); t.offset.copy(m.map.offset); uses.push([m, m.map, t]); }
    }
  });
  window.__ab = uses;
  for (const [, , t] of uses) G.renderer.initTexture(t);
  return { pairs: pairs.map(p => p[2]), materials: uses.length, programs: G.renderer.info.programs.length };
});
console.log('lo atlases', setup.pairs.length, 'materials swapped', setup.materials, 'programs', setup.programs);
await page.waitForTimeout(1500);

const report = [];
for (const [name, mi, pos, opt] of VIEWS) {
  if (ONLY && !ONLY.has(name)) continue;
  const r = await page.evaluate(async ([mi, pos, opt]) => {
    const g = window.__game, G = g.G, R = G.renderer;
    const P = await import('./js/player.js'), S = await import('./js/site.js');
    const { CFG } = await import('./js/config.js'); const W = await import('./js/world.js');
    g.setMoment(mi);
    W.setNight(G, opt && opt.night !== undefined ? opt.night : !!CFG.MOMENTS[mi].night);
    for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
    if (Array.isArray(pos)) {
      const w = S.enclaveToWorld(pos[0], pos[1]); G.player.pos.set(w.x, CFG.EYE_HEIGHT, w.z);
      P.setFacing(pos[2] + S.ENCLAVE.rotY); for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
    } else if (pos && pos.world) {
      const _m4 = new (Object.getPrototypeOf(G.scene.matrixWorld).constructor)(), _v3 = new (Object.getPrototypeOf(G.scene.position).constructor)();
      const pick = (nm, i) => { const im = G.scene.getObjectByName(nm); if (!im || !im.isInstancedMesh || i >= im.count) return null; im.getMatrixAt(i, _m4); _v3.setFromMatrixPosition(_m4); im.updateWorldMatrix(true, false); _v3.applyMatrix4(im.matrixWorld); return { x: _v3.x, y: _v3.y, z: _v3.z }; };
      const p = new Function('S', 'CFG', 'G', 'pick', 'return ' + pos.world)(S, CFG, G, pick);
      G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z); G.setMode(opt && opt.fly ? 'fly' : 'walk', { quiet: true });
      G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z);
      P.setFacing(p.yaw !== undefined ? p.yaw : Math.atan2(-(p.lookX - p.x), -(p.lookZ - p.z)));
      for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      if (opt && opt.pitch) P.applyLook(0, -opt.pitch, 1);
    }
    await new Promise(r => setTimeout(r, 700));
    const gl = R.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const grab = () => { R.render(G.scene, G.camera); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
    /* the mirror renders on its own gate; draw each state twice so both reads carry their own reflection */
    grab(); const A = grab();
    for (const [m, , lo] of window.__ab) m.map = lo;
    grab(); const B = grab();
    for (const [m, hi] of window.__ab) m.map = hi;
    let sum = 0, big = 0; const n = w * h;
    const cv = document.createElement('canvas'); cv.width = w * 3; cv.height = h;
    const c2 = cv.getContext('2d'), img = c2.createImageData(w * 3, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((h - 1 - y) * w + x) * 4;
      let dmax = 0;
      for (let k = 0; k < 3; k++) { const dd = Math.abs(A[s + k] - B[s + k]); sum += dd; if (dd > dmax) dmax = dd; }
      if (dmax > 8) big++;
      for (let k = 0; k < 3; k++) {
        img.data[(y * w * 3 + x) * 4 + k] = A[s + k];
        img.data[(y * w * 3 + w + x) * 4 + k] = B[s + k];
        img.data[(y * w * 3 + 2 * w + x) * 4 + k] = Math.min(255, Math.abs(A[s + k] - B[s + k]) * 8);
      }
      for (const o of [0, w, 2 * w]) img.data[(y * w * 3 + o + x) * 4 + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
    return { mean: +(sum / (n * 3)).toFixed(4), over8: +(big / n * 100).toFixed(3), png: cv.toDataURL('image/png') };
  }, [mi, pos, opt]);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  report.push({ view: name, mean: r.mean, over8pct: r.over8 });
  console.log(name.padEnd(34), 'mean |Δ|', r.mean, ' px >8/255:', r.over8 + '%');
}
writeFileSync(`${OUT}/ab.json`, JSON.stringify({ when: new Date().toISOString(), setup, report, errors: errs }, null, 2));
console.log('errors:', errs.length ? errs : 'none');
await browser.close();
