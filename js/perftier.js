/* perftier.js — the PHONE tier and its dynamic resolution (KAN-235).

   ── THE TIER ─────────────────────────────────────────────────────────────────
   `PHONE` = a coarse pointer on a screen whose short side is under 600 CSS px
   (phones, not tablets or laptops). Decided ONCE, at import, before anything is
   fetched, because it picks which GLBs are downloaded (js/models.js). Override
   with `?tier=phone` / `?tier=full` (tests, and an A/B on a real device).
   The FULL tier — desktop, laptops, tablets — renders exactly what it rendered
   before KAN-235: same GLBs, same fixed pixel ratio min(DPR, 2), no controller.
   The phone tier changes two things and nothing else:
     1. ten of the twelve 2048² architecture atlases arrive as 1024² twins
        (assets/models/lo/, assets/blender/derive_lo.py) — 1.2 MB less to download
        on mobile data and 160 MiB less GPU memory on a device that shares it with
        everything else (the page held ~670 MiB of textures);
     2. the pixel ratio is a CONTROLLER instead of a constant (below).
   Programs, lights, colliders, floorY, geometry: identical on both tiers.

   ── DYNAMIC RESOLUTION (phone tier only) ─────────────────────────────────────
   It starts where the phone always started — min(DPR, 2) — so a phone that
   keeps up renders exactly as before, and steps the drawing buffer down in
   0.25 steps to a floor of 1.25 only while frames are measurably slow:
     · a sample = one rAF interval; not counted while the tab is hidden, under
       the moment-switch veil, or for 1.5 s after a level change / resize / moment
       switch (the frames right after a switch are its own cost, not the view's);
     · every ~1 s window of ≥ 12 samples (or 3 s of ≥ 4, for a crawling phone)
       yields its MEDIAN interval (one GC or upload hitch cannot move a median);
     · DOWN one level after 2 consecutive windows slower than 22 ms (< 45 fps);
     · UP one level after 5 consecutive windows faster than 17.5 ms (a 60 Hz
       phone at vsync qualifies — it cannot show headroom, so it has to be
       tried) … unless that higher level was LEFT for being slow in the last
       30 s: a level that failed is "burnt" and not retried until the scene
       changes (a moment switch clears the burns) or 30 s pass. That is the
       hysteresis: a phone on the edge settles one step below it instead of
       oscillating, and never re-tries more often than twice a minute.
   The detail cull sizes objects in CSS px (renderer.getSize), not drawing-buffer
   px, so a ratio change never changes what is culled; the tour's cross-fade
   draws the canvas at CSS size. `?dr=off` pins min(DPR, 2); `?dr=1.5` pins a
   ratio; `G.dynres.stats()` / `.disable()` / `.force(r)` at runtime. */

const q = new URLSearchParams(location.search);
const qt = q.get('tier');
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const shortSide = Math.min(screen.width || 0, screen.height || 0) || Math.min(innerWidth, innerHeight);
export const PHONE = qt === 'phone' ? true : qt === 'full' ? false : (coarse && shortSide < 600);
export const TIER = PHONE ? 'phone' : 'full';

/* the pixel ratio every tier boots at — unchanged from before KAN-235 */
export const BASE_RATIO = Math.min(devicePixelRatio || 1, 2);

const DR = {
  STEP: .25, FLOOR: 1.25,
  WINDOW_MS: 1000, MIN_SAMPLES: 12,
  SLOW_MS: 22, SLOW_WINDOWS: 2,
  FAST_MS: 17.5, FAST_WINDOWS: 5,
  SETTLE_MS: 1500, BURN_MS: 30000,
};

export function initDynRes(G) {
  const R = G.renderer;
  const dq = q.get('dr');
  const levels = [];
  for (let r = BASE_RATIO; r >= DR.FLOOR - 1e-6; r -= DR.STEP) levels.push(+r.toFixed(2));
  const pinned = dq && dq !== 'off' && +dq > 0 ? +dq : null;
  let enabled = PHONE && dq !== 'off' && !pinned && levels.length > 1;
  if (pinned) { R.setPixelRatio(pinned); R.setSize(innerWidth, innerHeight); }

  let lvl = 0, last = 0, settleUntil = 0, winStart = 0, samples = [];
  let slowRun = 0, fastRun = 0, lastMoment = G.momentIndex;
  const burnt = new Map();          // level index -> time it was left for being slow
  const log = [];                   // [t, from, to, medianMs] — for the tests

  const apply = (to, now, med) => {
    log.push([Math.round(now), levels[lvl], levels[to], med]);
    if (to > lvl) burnt.set(lvl, now);
    lvl = to;
    R.setPixelRatio(levels[lvl]);
    R.setSize(innerWidth, innerHeight);
    settleUntil = now + DR.SETTLE_MS;
    samples = []; slowRun = fastRun = 0; winStart = now;
  };
  addEventListener('resize', () => { settleUntil = performance.now() + DR.SETTLE_MS; samples = []; });

  function sample(now) {
    const dt = last ? now - last : 0;
    last = now;
    if (!enabled) return;
    if (G.momentIndex !== lastMoment) {             // a new scene: re-probe from here
      lastMoment = G.momentIndex; burnt.clear();
      settleUntil = now + DR.SETTLE_MS; samples = []; slowRun = fastRun = 0;
    }
    if (document.hidden || (G.ui && G.ui.isSwitching && G.ui.isSwitching()) || now < settleUntil || dt <= 0 || dt > 1000) {
      winStart = now; samples = [];
      return;
    }
    samples.push(dt);
    /* a window closes after 1 s with ≥ 12 samples — or after 3 s with ≥ 4, so a
       phone crawling at 5 fps is still measured (and stepped down) */
    const age = now - winStart;
    if (!((age >= DR.WINDOW_MS && samples.length >= DR.MIN_SAMPLES) || (age >= 3 * DR.WINDOW_MS && samples.length >= 4))) return;
    {
      const s = samples.slice().sort((a, b) => a - b), med = +s[s.length >> 1].toFixed(2);
      if (med > DR.SLOW_MS) { slowRun++; fastRun = 0; } else if (med < DR.FAST_MS) { fastRun++; slowRun = 0; } else { slowRun = fastRun = 0; }
      if (slowRun >= DR.SLOW_WINDOWS && lvl < levels.length - 1) { apply(lvl + 1, now, med); return; }
      if (fastRun >= DR.FAST_WINDOWS && lvl > 0) {
        const b = burnt.get(lvl - 1);
        if (b === undefined || now - b > DR.BURN_MS) { burnt.delete(lvl - 1); apply(lvl - 1, now, med); return; }
      }
    }
    winStart = now; samples = [];
  }

  G.dynres = {
    sample,
    ratio: () => R.getPixelRatio(),
    stats: () => ({ tier: TIER, enabled, pinned, levels: levels.slice(), level: lvl, ratio: R.getPixelRatio(), burnt: [...burnt.keys()], log: log.slice() }),
    disable() { enabled = false; lvl = 0; R.setPixelRatio(BASE_RATIO); R.setSize(innerWidth, innerHeight); },
    enable() { enabled = PHONE && levels.length > 1; },
    force(r) { const i = levels.indexOf(r); if (i >= 0) apply(i, performance.now(), null); },
    config: DR,
  };
  return G.dynres;
}
