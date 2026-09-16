/* Screenshot every Blender-authored model in the venue's own renderer.

     node tools/shoot-models.mjs [name ...]      → assets/previews/<name>-ingame.png
     NIGHT=1 node tools/shoot-models.mjs         → the night rig
     CAST=0  node tools/shoot-models.mjs         → no ground shadow (the loader's castShadow=false, as in game)

   Serves the repo on :8803 with serve.py if nothing is listening there, opens
   tools/viewer.html (same importmap + rig as index.html) in headless Chromium
   on the Metal ANGLE backend — SwiftShader renders this at ~1 fps and lies
   about shadows — and prints every console error. Exit code 1 if any.

   Playwright is not a dependency of this project (it has none). Like
   tools/guest-journey.mjs it borrows the copy in ~/projects/wedding-app;
   PLAYWRIGHT_PATH overrides. */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8803);
const BASE = `http://127.0.0.1:${PORT}`;
const OUT = path.join(ROOT, 'assets', 'previews');
const NIGHT = process.env.NIGHT === '1';
const CAST = process.env.CAST !== '0';       // CAST=0: the game's castShadow=false, no ground shadow

async function up() {
  try { const r = await fetch(`${BASE}/tools/viewer.html`, { method: 'HEAD' }); return r.ok; } catch { return false; }
}
if (!(await up())) {
  console.log(`serve: nothing on :${PORT} — starting python3 serve.py ${PORT}`);
  spawn('python3', ['serve.py', String(PORT)], { cwd: ROOT, detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40 && !(await up()); i++) await new Promise((r) => setTimeout(r, 250));
  if (!(await up())) { console.error(`serve: :${PORT} never came up`); process.exit(2); }
}

const manifestPath = path.join(ROOT, 'assets', 'models', 'models.json');
if (!existsSync(manifestPath)) { console.error('no assets/models/models.json — run export_all.py first'); process.exit(2); }
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const bad = [];
page.on('pageerror', (e) => bad.push('PAGE: ' + e));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.type() + ': ' + m.text()); });
const logs = [];
page.on('console', (m) => { if (m.type() === 'log' && /viewer: geometry/.test(m.text())) logs.push(m.text()); });

await page.goto(`${BASE}/tools/viewer.html?m=${encodeURIComponent(names[0])}&spin=0${NIGHT ? '&night=1' : ''}${CAST ? '' : '&cast=0'}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__viewer && window.__viewer.isReady, null, { timeout: 120000 });

const rows = [];
for (const name of names) {
  const info = await page.evaluate((n) => window.__viewer.frame(n), name);
  await page.waitForTimeout(120);
  const file = path.join(OUT, `${name}-ingame${NIGHT ? '-night' : ''}.png`);
  await page.screenshot({ path: file });
  rows.push({ name, ...info, file: path.relative(ROOT, file) });
  console.log(`SHOT ${name.padEnd(24)} loaded=${info.loaded} tris=${info.tris ?? '-'} ` +
    `size=${info.size ? info.size.map((v) => v.toFixed(2)).join('×') : '-'} geometry=${info.geometry ?? 'null'} ` +
    `material=${info.material ?? '-'} → ${path.relative(ROOT, file)}`);
}
const pageErrors = await page.evaluate(() => window.__viewer.errors);
await browser.close();

for (const l of logs) console.log('  ' + l);
const all = [...bad, ...pageErrors];
if (all.length) { console.log(`\n${all.length} console error(s)/warning(s):`); for (const b of all) console.log('  ' + b); }
else console.log('\nzero console errors or warnings');
const missing = rows.filter((r) => !r.loaded).map((r) => r.name);
if (missing.length) console.log('NOT LOADED:', missing.join(', '));
process.exit(all.length || missing.length ? 1 : 0);
