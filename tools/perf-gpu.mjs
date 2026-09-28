/* PERF GPU (KAN-235) — what each shoot-moments view COSTS at phone resolution.

     python3 serve.py 8803 &   (or tools/perf-serve.mjs)
     VENUE_URL=http://127.0.0.1:8803/ OUT=/tmp/gpu.json node tools/perf-gpu.mjs
     ONLY=setup-spawn,brunch-spawn … · DPRS=3,2,1.5 · PHONE=0 (desktop 1600×900)
     EXTRA=0 skips the shadow / mirror decomposition

   Every view of tools/shoot-moments.mjs (the list is READ from that file, so
   the two never drift), set up exactly as it sets them up, on a 390 × 844
   touch viewport (touch mode: no MSAA, as on a phone). Per view and per pixel
   ratio: ms per frame = N synchronous renderer.render() calls closed by a 1 px
   readPixels (which waits for the GPU), median of 3 batches — CPU submission +
   GPU, render only (the tickers are excluded; they run in the page's own rAF
   between views). Plus, per view at the running ratio: total draw calls and
   triangles for one frame (info.autoReset off: main + shadow + mirror
   passes), and — EXTRA — the same frame with the shadow map frozen and with
   the mirror pass skipped, so each pass's share is measured, not guessed.

   ⚠ An M-series GPU is 5–10× a phone's: the absolute ms do not transfer; the
   RATIOS between pixel ratios and between views do (fill-bound work scales
   with pixels on both). Memory is exact: every texture and render target on
   the scene (all six moments — the warm-up uploads them all), w × h × bytes
   × 4/3 when mipmapped; every BufferAttribute + index + instance buffer. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const SITE_URL = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const src = readFileSync(new URL('./shoot-moments.mjs', import.meta.url), 'utf8');
const a = src.indexOf('const VIEWS = ['), b = src.indexOf('\n];', a);
const VIEWS = new Function('return ' + src.slice(a + 'const VIEWS = '.length, b + 3))();
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const DPRS = (process.env.DPRS || '3,2,1.5').split(',').map(Number);
const PHONE = process.env.PHONE !== '0';
const EXTRA = process.env.EXTRA !== '0';
const N = +(process.env.N || 10);

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=metal', '--ignore-certificate-errors'] });
  const ctx = await browser.newContext(PHONE
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true }
    : { viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const bad = [];
  page.on('pageerror', e => bad.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error') bad.push('error: ' + m.text()); });
  await page.goto(SITE_URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
  await page.evaluate((inst) => { window.__game.skipIntro(); window.__game.G.player.locked = true; window.__INST = inst; }, !!process.env.INST);
  await page.waitForTimeout(1000);

  /* ── memory: textures + render targets + geometry, whole scene ── */
  const mem = await page.evaluate(() => {
    const G = window.__game.G, R = G.renderer;
    const texs = new Map(), geos = new Set(), rts = new Set();
    const bpp = t => (t.type === 1016 || t.type === 1015) ? 16 : (t.type === 1011 || t.type === 1017) ? 8 : 4;   // float / half-float / else RGBA8
    G.scene.traverse(o => {
      if (o.geometry) geos.add(o);
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k in m) { const v = m[k]; if (v && v.isTexture && !v.isRenderTargetTexture) texs.set(v.uuid, v); }
        if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k] && m.uniforms[k].value; if (v && v.isTexture && !v.isRenderTargetTexture) texs.set(v.uuid, v); }
      }
      if (o.isReflector) rts.add(o.getRenderTarget());
      if (o.isLight && o.shadow && o.shadow.map) rts.add(o.shadow.map);
    });
    if (G.scene.environment) texs.set('env', G.scene.environment);
    /* three r180 shares ONE GPU texture between Texture objects with the same
       Source (clones, per-use repeat copies), so count each Source once */
    const bySrc = new Map();
    for (const t of texs.values()) { const k = t.source ? t.source.uuid : t.uuid; if (!bySrc.has(k)) bySrc.set(k, t); }
    let texBytes = 0; const list = [];
    for (const t of bySrc.values()) {
      const img = t.image || {};
      const w = img.width || (img.data && img.width) || 0, h = img.height || 0;
      const mip = t.generateMipmaps && t.minFilter !== 1006 && t.minFilter !== 1003 ? 4 / 3 : 1;
      const bytes = Math.round(w * h * bpp(t) * mip);
      texBytes += bytes;
      const name = t.name || (img.currentSrc || img.src || '').split('/').pop() || (img instanceof HTMLCanvasElement ? 'canvas' : img.constructor && img.constructor.name) || '?';
      const canvas = typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement;
      const kind = canvas ? 'canvas' : (img.currentSrc || img.src) ? 'photo' : (img instanceof ImageBitmap || t.userData.mimeType || /^[a-z_0-9]+$/.test(t.name || '')) ? 'glb' : 'other';
      list.push({ name, w, h, bytes, mip: mip > 1, kind });
    }
    let rtBytes = 0;
    for (const rt of rts) { if (!rt) continue; const s = rt.samples || 0; rtBytes += rt.width * rt.height * (4 + (rt.depthBuffer ? 4 : 0)) * (s ? s + 1 : 1); }
    let geoBytes = 0; const seen = new Set();
    for (const o of geos) {
      const g = o.geometry;
      if (!seen.has(g.uuid)) { seen.add(g.uuid);
        for (const k in g.attributes) geoBytes += g.attributes[k].array.byteLength;
        if (g.index) geoBytes += g.index.array.byteLength; }
      if (o.isInstancedMesh) { geoBytes += o.instanceMatrix.array.byteLength; if (o.instanceColor) geoBytes += o.instanceColor.array.byteLength; }
    }
    list.sort((a, b) => b.bytes - a.bytes);
    const byKind = {};
    for (const t of list) { byKind[t.kind] = byKind[t.kind] || { n: 0, bytes: 0 }; byKind[t.kind].n++; byKind[t.kind].bytes += t.bytes; }
    return { textures: bySrc.size, textureObjects: texs.size, byKind, texBytes, rtBytes, geoBytes, geometries: seen.size,
             info: { ...R.info.memory, programs: R.info.programs.length }, pixelRatio: R.getPixelRatio(), top: list.slice(0, 400) };
  });
  console.log('texture memory by kind', JSON.stringify(Object.fromEntries(Object.entries(mem.byKind).map(([k, v]) => [k, `${v.n} = ${(v.bytes / 1048576).toFixed(1)} MiB`]))));
  console.log(`memory: textures ${mem.textures} = ${(mem.texBytes / 1048576).toFixed(1)} MiB · RTs ${(mem.rtBytes / 1048576).toFixed(1)} MiB · geometry ${(mem.geoBytes / 1048576).toFixed(1)} MiB · programs ${mem.info.programs} · pixelRatio ${mem.pixelRatio}`);

  const stats = [];
  for (const [name, mi, pos, opt] of VIEWS) {
    if (ONLY && !ONLY.has(name)) continue;
    const s = await page.evaluate(async ([mi, pos, opt, DPRS, N, EXTRA]) => {
      const g = window.__game, G = g.G, R = G.renderer;
      const P = await import('./js/player.js');
      const S = await import('./js/site.js');
      const { CFG } = await import('./js/config.js');
      const W = await import('./js/world.js');
      g.setMoment(mi);
      W.setNight(G, opt && opt.night !== undefined ? opt.night : !!CFG.MOMENTS[mi].night);
      for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      if (Array.isArray(pos)) {
        const w = S.enclaveToWorld(pos[0], pos[1]);
        G.player.pos.set(w.x, CFG.EYE_HEIGHT, w.z);
        P.setFacing(pos[2] + S.ENCLAVE.rotY);
        for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      } else if (pos && pos.world) {
        const _m4 = new (Object.getPrototypeOf(G.scene.matrixWorld).constructor)();
        const _v3 = new (Object.getPrototypeOf(G.scene.position).constructor)();
        const pick = (nm, i) => {
          const im = G.scene.getObjectByName(nm);
          if (!im || !im.isInstancedMesh || i >= im.count) return null;
          im.getMatrixAt(i, _m4); _v3.setFromMatrixPosition(_m4);
          im.updateWorldMatrix(true, false); _v3.applyMatrix4(im.matrixWorld);
          return { x: _v3.x, y: _v3.y, z: _v3.z };
        };
        const p = new Function('S', 'CFG', 'G', 'pick', 'return ' + pos.world)(S, CFG, G, pick);
        G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z);
        G.setMode(opt && opt.fly ? 'fly' : 'walk', { quiet: true });
        G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z);
        P.setFacing(p.yaw !== undefined ? p.yaw : Math.atan2(-(p.lookX - p.x), -(p.lookZ - p.z)));
        for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
        if (opt && opt.pitch) P.applyLook(0, -opt.pitch, 1);
      }
      await new Promise(r => setTimeout(r, 700));   // light budget + detail cull settle

      const gl = R.getContext(), px = new Uint8Array(4);
      const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const time = () => {
        const out = [];
        for (let b = 0; b < 3; b++) {
          sync();
          const t0 = performance.now();
          for (let k = 0; k < N; k++) R.render(G.scene, G.camera);
          sync();
          out.push((performance.now() - t0) / N);
        }
        out.sort((x, y) => x - y);
        return +out[1].toFixed(2);
      };
      const count = () => {
        const was = R.info.autoReset; R.info.autoReset = false; R.info.reset();
        R.render(G.scene, G.camera);
        const c = { calls: R.info.render.calls, tris: R.info.render.triangles };
        R.info.reset(); R.info.autoReset = was;
        return c;
      };
      const base = R.getPixelRatio();
      const res = { ms: {} };
      for (const d of DPRS) { R.setPixelRatio(d); R.setSize(innerWidth, innerHeight); res.ms[d] = time(); }
      R.setPixelRatio(base); R.setSize(innerWidth, innerHeight);
      Object.assign(res, count());
      if (EXTRA) {
        res.msBase = time();
        const sm = R.shadowMap.autoUpdate;
        R.shadowMap.autoUpdate = false;
        res.msNoShadow = time(); res.noShadow = count();
        R.shadowMap.autoUpdate = sm;
        const refl = []; G.scene.traverse(o => { if (o.isReflector) refl.push(o); });
        const saved = refl.map(m => m.onBeforeRender);
        for (const m of refl) m.onBeforeRender = () => {};
        res.msNoMirror = time(); res.noMirror = count();
        refl.forEach((m, i) => { m.onBeforeRender = saved[i]; });
      }
      /* INST=1: how much of the main pass is InstancedMesh instances that are
         OFF-screen (three culls an InstancedMesh by ONE sphere round all of its
         instances, so a campus-wide bucket draws every instance whenever any is
         in view) — the case for chunking / per-instance LOD */
      if (window.__INST) {
        const T = await import('three');
        const cam = G.camera; cam.updateMatrixWorld();
        const fr = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        const m4 = new T.Matrix4(), sph = new T.Sphere();
        let drawn = 0, needed = 0; const per = [];
        G.scene.traverseVisible(o => {
          if (!o.isInstancedMesh || !o.count) return;
          if (!o.boundingSphere) o.computeBoundingSphere();
          sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);
          if (!fr.intersectsSphere(sph)) return;
          const g = o.geometry, tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
          if (!g.boundingSphere) g.computeBoundingSphere();
          let inN = 0;
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld);
            sph.copy(g.boundingSphere).applyMatrix4(m4);
            if (sph.radius > 0 && fr.intersectsSphere(sph)) inN++;
          }
          drawn += o.count * tri; needed += inN * tri;
          per.push([o.name || o.parent?.name || '?', o.count, inN, Math.round(o.count * tri)]);
        });
        per.sort((a, b) => (b[3] - b[2] / b[1] * b[3]) - (a[3] - a[2] / a[1] * a[3]));
        res.inst = { drawn: Math.round(drawn), needed: Math.round(needed), top: per.slice(0, 8) };
      }
      res.night = !!G.night;
      res.feet = +(G.player.pos.y - CFG.EYE_HEIGHT).toFixed(3);
      return res;
    }, [mi, pos, opt, DPRS, N, EXTRA]);
    stats.push({ view: name, ...s });
    console.log(name.padEnd(34), DPRS.map(d => `${d}x ${s.ms[d]}`).join('  '), `| ${s.calls} calls ${(s.tris / 1e3).toFixed(0)}k tris`,
      EXTRA ? `| base ${s.msBase} noShadow ${s.msNoShadow} (${s.noShadow.calls}) noMirror ${s.msNoMirror} (${s.noMirror.calls})` : '',
      s.inst ? `| instanced tris drawn ${(s.inst.drawn / 1e3).toFixed(0)}k, on-screen ${(s.inst.needed / 1e3).toFixed(0)}k` : '');
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ url: SITE_URL, phone: PHONE, dprs: DPRS, when: new Date().toISOString(), mem, stats, errors: bad }, null, 2));
  console.log('errors:', bad.length ? bad : 'none');
  await browser.close();
})();
