/* PERF LOAD (KAN-235) — a cold (and optionally warm) load of the venue on an
   emulated phone, per network × CPU profile: bytes by type and origin, bytes
   needed before the title card, time to the loading card / title card /
   interactive, and the longest main-thread block.

     node tools/perf-serve.mjs . 8831 &                    # Vercel-like (h2 + br)
     VENUE_URL=https://127.0.0.1:8831/ OUT=/tmp/load.json \
       PROFILES=none-1x,mob10-4x node tools/perf-load.mjs  # default: every profile
     WARM=1 …                                              # + a reload in the same cache
     REPS=3 …                                              # cold loads per profile (medians)

   Profiles are Chrome DevTools' own presets (SDK NetworkManager): "Slow 4G" is
   the old "Fast 3G" (1.6 Mbps × .9, 150 ms × 3.75 RTT), "Fast 4G" (9 Mbps × .9,
   60 ms × 2.75); mob10 is a plain 10 Mbps / 100 ms phone. CPU is CDP's
   setCPUThrottlingRate — the GPU is NOT throttled (an M-series GPU stays an
   M-series GPU), so these are load numbers, not frame-rate numbers.

   Timing marks, all page-relative ms (performance.now()):
     fcp      first contentful paint — the loading card
     title    #overlay gains .ready  — finishLoading(): the invitation shows
     tti      window.__game is assigned — main.js's last line; Step inside works
   Bytes are CDP encodedDataLength (what crossed the wire, headers included);
   "pre-title" = finished before the title mark. */
import { createRequire } from 'node:module';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const URL_ = process.env.VENUE_URL || 'https://127.0.0.1:8831/';
const ALL = {
  'none-1x':   { net: null, cpu: 1 },
  'slow4g-4x': { net: { latency: 562.5, down: 180000, up: 84375 }, cpu: 4 },
  'slow4g-6x': { net: { latency: 562.5, down: 180000, up: 84375 }, cpu: 6 },
  'fast4g-4x': { net: { latency: 165, down: 1012500, up: 168750 }, cpu: 4 },
  'fast4g-6x': { net: { latency: 165, down: 1012500, up: 168750 }, cpu: 6 },
  'mob10-4x':  { net: { latency: 100, down: 1250000, up: 250000 }, cpu: 4 },
  'mob10-6x':  { net: { latency: 100, down: 1250000, up: 250000 }, cpu: 6 },
};
const PROFILES = (process.env.PROFILES || Object.keys(ALL).join(',')).split(',');

const INIT = () => {
  const P = window.__perf = { lt: [], pct: [], title: null, tti: null, fcp: null };
  try { performance.setResourceTimingBufferSize(5000); } catch (e) {}
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) P.lt.push([Math.round(e.startTime), Math.round(e.duration)]); })
      .observe({ type: 'longtask', buffered: true });
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') P.fcp = Math.round(e.startTime); })
      .observe({ type: 'paint', buffered: true });
  } catch (e) {}
  new MutationObserver(() => {
    const ov = document.getElementById('overlay');
    if (P.title === null && ov && ov.classList.contains('ready')) P.title = Math.round(performance.now());
    const pc = document.getElementById('loadPct');
    if (pc) { const v = pc.textContent; if (!P.pct.length || P.pct[P.pct.length - 1][1] !== v) P.pct.push([Math.round(performance.now()), v]); }
  }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true, characterData: true });
  Object.defineProperty(window, '__game', {
    configurable: true,
    set(v) { P.tti = Math.round(performance.now()); Object.defineProperty(window, '__game', { value: v, writable: true, configurable: true }); },
    get() { return undefined; },
  });
};

function kind(url, mime) {
  const u = url.split('?')[0];
  if (/\.glb$/.test(u)) return 'glb';
  if (/\.wasm$/.test(u)) return 'wasm';
  if (/\.(webp|png|jpe?g|svg|ktx2)$/.test(u) || /^image\//.test(mime)) return 'image';
  if (/\.(woff2?|ttf)$/.test(u) || /font/.test(mime)) return 'font';
  if (/\.css$/.test(u) || /css/.test(mime)) return 'css';
  if (/\.m?js$/.test(u) || /javascript/.test(mime)) return 'js';
  if (/\.json$/.test(u)) return 'json';
  if (/html/.test(mime)) return 'html';
  return 'other';
}

/* TRUST perf-serve's self-signed cert by its SPKI hash rather than with
   --ignore-certificate-errors: Chrome does NOT store responses from a
   certificate-error origin in its HTTP cache, so a warm reload re-fetched
   everything with 200s (checked: fetch() twice → 11,398 B both times; with the
   SPKI list the second is a 300 B 304). */
const CERT = join(process.env.PERF_CERT_DIR || join(tmpdir(), 'venue-perf-cert'), 'cert.pem');
const SPKI = execSync(`openssl x509 -in "${CERT}" -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64`).toString().trim();

/* A PERSISTENT context in a fresh profile dir per run: an incognito context's
   HTTP cache is an in-memory backend too small for this page (a first WARM
   test re-fetched every GLB and texture with 200s while the JS got 304s) —
   a real phone has a disk cache. */
async function run(name) {
  const pr = ALL[name];
  const dir = mkdtempSync(join(tmpdir(), 'venue-perf-'));
  const ctx = await chromium.launchPersistentContext(dir, {
    args: ['--use-angle=metal', `--ignore-certificate-errors-spki-list=${SPKI}`],
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  await ctx.addInitScript(INIT);
  const page = ctx.pages()[0] || await ctx.newPage();
  const bad = [];
  page.on('pageerror', e => bad.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error') bad.push('error: ' + m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (pr.net) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: pr.net.latency, downloadThroughput: pr.net.down, uploadThroughput: pr.net.up });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: pr.cpu });

  const reqs = new Map();
  let t0 = null;
  cdp.on('Network.requestWillBeSent', e => {
    if (t0 === null && e.type === 'Document') t0 = e.timestamp;
    reqs.set(e.requestId, { url: e.request.url, t: e.timestamp });
  });
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.mime = e.response.mimeType; r.status = e.response.status; r.proto = e.response.protocol; r.enc = (e.response.headers['content-encoding'] || e.response.headers['Content-Encoding'] || ''); r.cache = e.response.fromDiskCache || e.response.fromMemoryCache; } });
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = e.timestamp; } });
  cdp.on('Network.loadingFailed', e => { const r = reqs.get(e.requestId); if (r) { r.failed = e.errorText; r.end = e.timestamp; } });

  const measure = async (label) => {
    const wall0 = Date.now();
    await page.waitForFunction(() => window.__perf && window.__perf.tti !== null, null, { timeout: 900000, polling: 250 });
    /* then until the network is QUIET: on a slow link the photo textures are
       still streaming when the title card shows (they are requested inside
       buildWorld and nothing waits for them) — their bytes, and the long tasks
       their late upload causes, belong to the load too. Quiet = nothing in
       flight for 2 s, then 3 s more for the frames after; capped at 240 s. */
    const quietStart = Date.now();
    let quietSince = null;
    while (Date.now() - quietStart < 240000) {
      /* http(s) only — the Draco workers' blob: URLs never report a finish */
      const inflight = [...reqs.values()].filter(r => !r.end && /^https?:/.test(r.url)).length;
      if (inflight === 0) { if (quietSince === null) quietSince = Date.now(); if (Date.now() - quietSince >= 2000) break; }
      else quietSince = null;
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(3000);
    const P = await page.evaluate(() => window.__perf);
    const rows = [...reqs.values()].filter(r => r.end).map(r => ({
      url: r.url, kind: kind(r.url, r.mime || ''), bytes: r.bytes || 0, status: r.status, enc: r.enc,
      origin: new URL(r.url).host, end: Math.round((r.end - t0) * 1000), failed: r.failed || null,
    }));
    const sum = f => rows.filter(f).reduce((a, r) => a + r.bytes, 0);
    const byKind = {}, byKindPre = {}, byOrigin = {};
    for (const r of rows) {
      byKind[r.kind] = (byKind[r.kind] || 0) + r.bytes;
      if (r.end <= P.title) byKindPre[r.kind] = (byKindPre[r.kind] || 0) + r.bytes;
      byOrigin[r.origin] = (byOrigin[r.origin] || 0) + r.bytes;
    }
    const lt = P.lt;
    const maxIn = (a, b) => lt.filter(([s]) => s >= a && s < b).reduce((m, [, d]) => Math.max(m, d), 0);
    const out = {
      profile: name, label, fcp: P.fcp, title: P.title, tti: P.tti,
      requests: rows.length, bytes: sum(() => true), bytesPreTitle: sum(r => r.end <= P.title),
      byKind, byKindPre, byOrigin,
      longest: lt.reduce((m, [, d]) => Math.max(m, d), 0),
      longestPreTitle: maxIn(0, P.title), longestPostTitle: maxIn(P.title, 1e9),
      allLoaded: rows.reduce((m, r) => Math.max(m, r.end), 0),
      bytesPostTitle: sum(r => r.end > P.title),
      longtasks: lt.length, longtaskMs: lt.reduce((a, [, d]) => a + d, 0),
      pct: P.pct, lt: P.lt, wallS: (Date.now() - wall0) / 1000, errors: bad.slice(), rows,
    };
    console.log(`${name.padEnd(10)} ${label.padEnd(5)} fcp ${out.fcp} title ${out.title} tti ${out.tti} all ${out.allLoaded} | ${(out.bytes / 1e6).toFixed(2)} MB (${(out.bytesPreTitle / 1e6).toFixed(2)} pre-title), ${out.requests} req | longest ${out.longest} (pre ${out.longestPreTitle} / post ${out.longestPostTitle}) | ${JSON.stringify(Object.fromEntries(Object.entries(out.byKind).map(([k, v]) => [k, +(v / 1e3).toFixed(0)])))} ${bad.length ? 'ERR ' + bad.length : ''}`);
    return out;
  };

  const results = [];
  await page.goto(URL_, { waitUntil: 'commit', timeout: 900000 });
  results.push(await measure('cold'));
  if (process.env.WARM) {
    reqs.clear(); t0 = null;
    await page.reload({ waitUntil: 'commit', timeout: 900000 });
    results.push(await measure('warm'));
  }
  await ctx.close();
  rmSync(dir, { recursive: true, force: true });
  return results;
}

(async () => {
  /* REPS=n: n cold loads per profile (fresh profile dir each; the WARM reload,
     if asked for, follows the first) — load times on this harness vary ±15 %
     run to run, so the tables quote medians */
  const all = [];
  const REPS = +(process.env.REPS || 1);
  for (const p of PROFILES) for (let k = 0; k < REPS; k++) {
    const warm = process.env.WARM;
    if (k > 0) delete process.env.WARM;
    all.push(...(await run(p)).map(r => ({ ...r, rep: k })));
    if (warm) process.env.WARM = warm;
  }
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ url: URL_, when: new Date().toISOString(), runs: all }, null, 2));
})();
