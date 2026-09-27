/* THE UI SHOTS — every screen a guest sees, at desktop + phone portrait +
   phone landscape (KAN-218). Playwright on Metal ANGLE, touch viewports with
   hasTouch/isMobile so the page boots in touch mode exactly as a phone does.

     node tools/shoot-ui.mjs <outDir>            (serve first: python3 serve.py 8803)
     VENUE_URL=http://127.0.0.1:8811/ node tools/shoot-ui.mjs reference/photos/shots-ui-before
     ONLY=desktop,phone STATES=title,help node tools/shoot-ui.mjs /tmp/x
     UI_LANG=zh node tools/shoot-ui.mjs reference/photos/shots-i18n   (KAN-232)

   UI_LANG=en|zh loads ?lang= and names files <viewport>-<lang>-<state>.png.
   (Not LANG — that is the shell's own locale variable.) The deep-link states
   (deeplink-title / deeplink-reveal / deeplink-landing) load ?m=ceremony.

   Writes <outDir>/<viewport>-<state>.png plus report.json (console errors,
   fonts, per-state notes). States that the build does not have (the help sheet
   on the pre-KAN-218 build) are skipped and noted, never faked. */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

const OUT = process.argv[2] || 'reference/photos/shots-ui';
const BASE = process.env.VENUE_URL || 'http://127.0.0.1:8803/';
const UI_LANG = process.env.UI_LANG || '';
const URL = BASE + (UI_LANG ? `?lang=${UI_LANG}` : '');
const DEEP_URL = BASE + '?m=ceremony' + (UI_LANG ? `&lang=${UI_LANG}` : '');
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
};
const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(VIEWPORTS);
const wantStates = process.env.STATES ? new Set(process.env.STATES.split(',')) : null;
const want = s => !wantStates || wantStates.has(s);

const report = {};
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu-rasterization'] });

for (const vpName of only) {
  const ctx = await browser.newContext(VIEWPORTS[vpName]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  const notes = {};
  const shot = async name => {
    if (!want(name)) return;
    await page.screenshot({ path: path.join(OUT, `${vpName}${UI_LANG ? '-' + UI_LANG : ''}-${name}.png`) });
    notes[name] = 'ok';
  };

  /* 1 · loading — the card mid-build */
  await page.goto(URL, { waitUntil: 'commit' });
  await page.waitForSelector('#loading', { timeout: 20000 });
  await page.waitForTimeout(900);
  if (await page.$('#loading')) {
    notes.loadingPct = await page.$eval('#loadPct', e => e.textContent).catch(() => null);
    await shot('loading');
  }

  /* 2 · title card over the live drone orbit */
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
  await page.waitForTimeout(2200);
  notes.fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight} ${f.style}`);
  });
  await shot('title');

  /* 2b · the controls / help sheet, from the title card (new build only) */
  const hasHelp = await page.evaluate(() => !!(window.__game.G.ui && window.__game.G.ui.openHelp));
  if (hasHelp) {
    await page.evaluate(() => window.__game.G.ui.openHelp());
    await page.waitForTimeout(700);
    await shot('help');
    await page.evaluate(() => window.__game.G.ui.closeHelp());
    await page.waitForTimeout(500);
  } else notes.help = 'n/a (no help sheet in this build)';

  /* 3 · into the venue: every moment's HUD, 2.4 s after the switch (blurb up) */
  await page.evaluate(() => {
    const g = window.__game;
    g.skipIntro();
    g.G.player.locked = true;
    if (g.G.touchMode && g.G.showTouchUI) g.G.showTouchUI();
  });
  await page.waitForTimeout(1500);
  const ids = await page.evaluate(async () => (await import('./js/config.js')).CFG.MOMENTS.map(m => m.id));
  for (let i = 0; i < ids.length; i++) {
    await page.evaluate(i => { window.__game.G.momentIndex = -1; window.__game.setMoment(i); }, i);
    await page.waitForTimeout(2400);
    await shot(`moment-${i}-${ids[i]}`);
  }

  /* 4 · a moment transition mid-fade (setMoment from the ceremony to cocktail) */
  const ci = ids.indexOf('ceremony'), ki = ids.indexOf('cocktail');
  await page.evaluate(i => window.__game.setMoment(i), ci);
  await page.waitForTimeout(5200);
  await page.evaluate(i => { const G = window.__game.G; (G.ui.chipGo ? G.ui.chipGo(i) : window.__game.setMoment(i)); }, ki);
  await page.waitForTimeout(150);
  await shot('transition');              // the veil mid-fade (old build: already switched)
  await page.waitForTimeout(650);
  await shot('transition-reveal');       // the new moment, its title revealing
  await page.waitForTimeout(5200);

  /* 5 · the interact prompt: stand at the ceremony arch, facing it */
  await page.evaluate(async ci => {
    const g = window.__game, G = g.G;
    g.setMoment(ci);
    const P = await import('./js/player.js');
    /* by id (KAN-232 — the label is translated); the label is the pre-i18n fallback */
    const it = G.interactables.find(i => i.id === 'arch') || G.interactables.find(i => i.label && i.label() === 'Stand at the arch');
    G.player.pos.set(it.x + 2.2, G.player.pos.y, it.z + 0.4);   // fixed approach
    P.setFacing(Math.atan2(-(it.x - G.player.pos.x), -(it.z - G.player.pos.z)));
    P.syncCamera(G);
  }, ci);
  await page.waitForTimeout(5000);    // let the moment blurb finish
  notes.promptLabel = await page.evaluate(() => window.__game.G.player.nearest ? window.__game.G.player.nearest.label() : null);
  await shot('prompt');

  /* 6 · an interaction's toast (use the arch) */
  await page.evaluate(() => window.__game.G.player.nearest && window.__game.G.player.nearest.use());
  await page.waitForTimeout(700);
  await shot('toast');
  await page.waitForTimeout(3600);

  /* 7 · night (N) on the ceremony lawn */
  await page.evaluate(() => window.__game.toggleNight());
  await page.waitForTimeout(650);
  await shot('night-toast');             // the system card, while it is up (KAN-232)
  await page.waitForTimeout(1950);
  await shot('night');
  await page.evaluate(() => window.__game.toggleNight());
  await page.waitForTimeout(2600);

  /* 8 · fly mode, lifted 30 m */
  await page.evaluate(() => { const G = window.__game.G; G.setMode('fly'); G.player.pos.y += 30; });
  await page.waitForTimeout(650);
  await shot('fly-toast');
  await page.waitForTimeout(2350);
  await shot('fly');
  await page.evaluate(() => window.__game.G.setMode('walk', { quiet: true }));

  /* 9 · the help sheet in play (new build only) */
  if (hasHelp) {
    await page.evaluate(() => window.__game.G.ui.openHelp());
    await page.waitForTimeout(700);
    await shot('help-ingame');
    await page.evaluate(() => window.__game.G.ui.closeHelp());
  }

  /* 10 · a deep link (?m=ceremony): the title card's CTA names the moment, and
     "Go to the Ceremony" lands there under the veil (KAN-232) */
  if (want('deeplink-title') || want('deeplink-reveal') || want('deeplink-landing')) {
    await page.goto(DEEP_URL, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
    await page.waitForTimeout(2200);
    notes.deepCTA = await page.$eval('#begin', e => e.textContent.trim());
    await shot('deeplink-title');
    await page.click('#begin');
    await page.waitForTimeout(900);
    await shot('deeplink-reveal');
    await page.waitForTimeout(2600);
    await page.evaluate(() => { window.__game.G.player.locked = true; });
    await page.waitForTimeout(200);
    await shot('deeplink-landing');
    notes.deepURL = await page.evaluate(() => location.search);
  }

  report[vpName] = { notes, errors: errs };
  console.log(vpName, JSON.stringify(notes.fonts?.length), 'fonts;', errs.length, 'errors', notes.promptLabel ? `prompt "${notes.promptLabel}"` : '');
  if (errs.length) console.log('  ', errs.slice(0, 6).join('\n   '));
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, `report${UI_LANG ? '-' + UI_LANG : ''}.json`), JSON.stringify(report, null, 2));
await browser.close();
