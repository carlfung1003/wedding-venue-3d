// world.js — the integrator. Owns nothing visual itself: it calls each builder
// module in order, holds the ground-truth height function, and owns the
// day↔night switch that every module answers to.
//
// The venue is The Westin Sanya Haitang Bay, 隐逸居 clubhouse enclave.
// WHERE everything sits is site.js; WHAT it looks like is the builders below.
import { CFG } from './config.js';
import { SITE, siteFloorY } from './site.js';

import { buildSky, setSkyNight } from './sky.js';
import { buildNature, setNatureNight } from './nature.js';
import { buildWater, setWaterNight, setLanterns } from './water.js';
import { buildCampus, setCampusNight } from './campus.js';
import { buildAtrium, setAtriumNight } from './atrium.js';
import { buildSuite, setSuiteNight } from './suite.js';

/* The single source of ground truth (lassen `getHeight` pattern). Player,
   prop placement and the fly-mode altitude clamp all read this — never nudge
   camera height directly. The campus is flat at datum; only the beach slopes
   into the sea. */
export function floorY(x, z) {
  return siteFloorY(x, z);
}

export function buildWorld(G) {
  G.tickers = G.tickers || [];
  G.night = !!CFG.START_AT_NIGHT;
  G.groups = {};

  G.groups.sky = buildSky(G);
  G.groups.nature = buildNature(G);
  G.groups.water = buildWater(G);
  G.groups.campus = buildCampus(G);
  G.groups.atrium = buildAtrium(G);
  G.groups.suite = buildSuite(G);

  applyNight(G, G.night, true);
}

/* The N key, and each moment's `night` flag, flip the whole campus between
   golden hour and the lantern-lit night. Every module owns its own response;
   world.js just fans the call out. */
function applyNight(G, on, quiet) {
  G.night = on;
  setSkyNight(on);
  setNatureNight(on);
  setWaterNight(on);
  setCampusNight(on);
  setAtriumNight(on);
  setSuiteNight(on);
  setLanterns(on);

  const L = CFG.LIGHT;
  G.scene.environmentIntensity = on ? L.ENV_NIGHT : L.ENV_DAY;
  G.renderer.toneMappingExposure = on ? L.EXPOSURE_NIGHT : L.EXPOSURE_DAY;

  if (!quiet && G.ui) {
    G.ui.toast(on ? '🌙 Night over Haitang Bay.' : '☀️ Golden hour.', 2.2);
  }
}

export function setNight(G, on, opts = {}) {
  if (G.night === on) return;
  applyNight(G, on, opts.quiet);
}

export function toggleNight(G) { setNight(G, !G.night); }

/* Advance every registered animation — water ripples, frond sway, drifting
   lanterns, window flicker. Builders register via (G.tickers ||= []).push(fn). */
export function updateWorld(G, dt, t) {
  for (const fn of G.tickers) fn(dt, t);
}

export { SITE };
