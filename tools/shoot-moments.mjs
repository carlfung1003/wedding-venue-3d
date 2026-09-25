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

/* views: [name, momentIndex, pos]
     pos = null                 the moment's own spawn
     pos = [lx, lz, yaw]        ENCLAVE-LOCAL x/z and local yaw — the campus
     pos = { world: '<expr>' }  an expression EVALUATED ON THE LIVE PAGE,
                                returning { x, z, y?, yaw?, lookX?, lookZ? }
                                in WORLD coordinates.

   ⚠ THE THIRD FORM EXISTS BECAUSE THE HOTEL ROOF IS NOT IN THE ENCLAVE.
   world.js re-parents the named campus groups into a rotated enclave and
   relocates instanced campus parts individually; the crescent (x ≥ 84) is
   outside that test and stays in WORLD space. Feed a rooftop view through
   enclaveToWorld and it lands 90° around the map — exactly the failure the
   GLB placements themselves have to avoid. `y` is the FEET height, and the
   roof needs it: 26.6, not 0 (CLAUDE.md, "m.spawn.y is the FEET height").
   The expression is handed `S` (site.js), `CFG`, `G` and `pick(name, i)`,
   which reads instance i of a live InstancedMesh by name — so a view can aim
   at the furniture that is actually there instead of at a typed coordinate
   that drifts the next time a row is re-derived. */
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

  /* ── the GROUP E resort furniture (2026-09-18). Everything above shows the
        wedding dressing; the roof had only the brunch spawn, which faces the
        sea and shows the four-tops from behind. These five are the rooms the
        resort furniture actually lives in. ── */
  /* the daybed / lounger run: stand on the teak between the two rows, at the
     south end, and look back up the arc past the beds. Both rows are derived
     in campus.js from R.gardenR / R.loungeR, so the camera is too. */
  ['roof-daybeds', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, C = Math.PI / 2;
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const th0 = C - R.arcHalf + .030;              // daybedRow()'s first bed
    /* ⚠ SEAWARD OF BOTH ROWS. At R.gardenR the camera stands INSIDE a bed:
       the platform is 2.8 m deep (99.5…102.3) and the loungers, 2.05 m long
       on the radius, fill 97.2…99.2 behind it. r 95.6 is the open deck south
       of the water, which is where a guest actually walks. */
    /* ⚠ AND INSIDE THE SWEEP: a0 is C − R.arcHalf, so th0 − .038 is past the
       terrace's own south end and floorY drops the camera off the building
       (feet 3.9 instead of 26.6 — the harness prints it, which is the point). */
    const cth = th0 + .012, tth = th0 + .18;       // …looking ~3 beds up the arc
    return { x: acx + Math.sin(cth) * 95.6, z: acz + Math.cos(cth) * 95.6,
             y: R.deckY,
             lookX: acx + Math.sin(tth) * 100.4, lookZ: acz + Math.cos(tth) * 100.4 };
  })()` }],
  /* the bar counter with its stools: a guest walking up to order, from the
     pool side. The counter's bearing is campus.js barLayout()'s own
     arithmetic — BAR_COUNTER_R / _LEN / _SET off R.barTc ± R.barTh — so the
     camera follows the counter if the bar zone is ever re-derived. Anchored
     on geometry rather than on an instance so the BEFORE and AFTER runs stand
     in exactly the same place. */
  ['roof-bar-stools', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP;
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const CR = 98.70, CLEN = 10.0, SET = 2.6;            // campus.js BAR_COUNTER_*
    const tc = (R.barTc - R.barTh) + (SET + CLEN / 2) / CR;
    const half = CLEN / 2 / CR, ctD = 2 * half / 8;      // 8 fluted bays
    const st = tc - half + 1.5 * ctD;                    // the 2nd stool along
    const cth = st - 3.4 / 97.8;
    return { x: acx + Math.sin(cth) * 95.7, z: acz + Math.cos(cth) * 95.7,
             y: R.deckY,
             lookX: acx + Math.sin(st) * 97.8, lookZ: acz + Math.cos(st) * 97.8 };
  })()` }],
  /* the bar room's dining — the long communal tables and their woven chairs,
     which is what rooftop-bar-live-band.webp is a picture of. Anchored on
     'campus:rtStemI', the glassware at a real cover: it is the ONE bucket
     unique to the long tables and this pass does not touch it, so both runs
     stand at the same cover. */
  ['roof-bar-dining', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP;
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const p = pick('campus:rtStemI', 6);
    const th = Math.atan2(p.x - acx, p.z - acz);
    const r = Math.hypot(p.x - acx, p.z - acz);
    const cth = th - 4.2 / r;
    return { x: acx + Math.sin(cth) * (r - 2.0), z: acz + Math.cos(cth) * (r - 2.0),
             y: R.deckY, lookX: p.x, lookZ: p.z };
  })()` }],
  /* the brunch four-tops, DRESSED — moment 0's own room, which brunch-spawn
     shows only from behind because the spawn faces the sea. This is the view
     that proves the bare GLB table stays inside moments.js's linen skirt
     (r .68→.72, cloth disc at .755….805 over a .785 timber top). */
  ['roof-brunch-tables', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, t = S.HOTEL_ROOF.brunchTables[2];
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    /* ⚠ r − 3.0 is IN THE WATER (the pool's back wall is 96.75 and the tables
       are at 99.2) — the harness's feet column says so, 25.32 not 26.6.
       Back off tangentially instead of radially. */
    const cth = t.th - 3.0 / t.r;
    return { x: acx + Math.sin(cth) * (t.r - 1.9), z: acz + Math.cos(cth) * (t.r - 1.9),
             y: R.deckY,
             lookX: acx + Math.sin(t.th) * t.r, lookZ: acz + Math.cos(t.th) * t.r };
  })()` }],
  /* …and the SAME four-top BARE. The brunch view above is deliberately
     identical before and after, because the linen hides the table entirely;
     this is the one that actually shows the timber top, the pedestal and the
     disc foot. Moment 2 is daylight and does not dress the roof. */
  ['roof-four-top-bare', 2, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, t = S.HOTEL_ROOF.brunchTables[2];
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const cth = t.th - 2.6 / t.r;
    return { x: acx + Math.sin(cth) * (t.r - 1.6), z: acz + Math.cos(cth) * (t.r - 1.6),
             y: R.deckY,
             lookX: acx + Math.sin(t.th) * t.r, lookZ: acz + Math.cos(t.th) * t.r };
  })()` }],
  /* the clubhouse pool deck: down the lounger row, umbrellas behind it.
     ENCLAVE-LOCAL — this one IS in the enclave, unlike the five above. */
  ['pool-loungers', 2, [-8.6, -4.6, Math.PI]],
  /* the lagoon's parasol run — the OTHER half of the pool_umbrella swap, and
     the one that carries the blue canopy tint (C.blue 2b7fc4) rather than the
     clubhouse teal. Anchored on SITE.LAGOON's own ellipse; WORLD space, since
     the river group is userData.worldSpace. */
  ['lagoon-parasols', 2, { world: `(() => {
    const L = S.SITE.LAGOON;
    return { x: L.cx - L.rx - 8.0, z: L.cz - 3.0, y: 0,
             lookX: L.cx - L.rx + 3.0, lookZ: L.cz - 0.5 };
  })()` }],
  /* the lagoon's kayak: found by name, so it follows SITE.RIVER.KAYAK */
  ['lagoon-kayak', 2, { world: `(() => {
    const k = G.scene.getObjectByName('river:kayak');
    const v = new (Object.getPrototypeOf(G.scene.position).constructor)();
    k.getWorldPosition(v);
    return { x: v.x - 4.6, z: v.z - 3.4, y: 0, lookX: v.x, lookZ: v.z };
  })()` }],

  /* ── the GROUP F pool wave (KAN-208). Nothing above stands at the hero pool
        AT NIGHT, which is the one shot this wave exists for: moment 1 is the
        prewedding, `night: true`, and the nine lanterns are burning on it. ── */
  /* THE SIGNATURE SHOT. On the turf band at the pool's north (suite) end,
     looking straight down its 25 m length: the two files of lanterns recede
     either side of the centreline and the far wall's fittings close the view.
     Enclave-local — the hero pool IS in the enclave. */
  ['prewedding-lanterns', 1, [0, -5.6, Math.PI]],
  /* one lotus at guest distance, from the open west lawn. seats[2] is the
     first lotus (i % 3 === 2) and sits at pool-local (−2.4, 0) → enclave
     (−2.4, 9); the camera is 4.6 m off it on the grass. */
  ['pool-lantern-lotus', 1, [-6.2, 6.4, Math.atan2(-3.8, -2.6)]],
  /* the underwater fittings. They face INTO the basin, so the only sight line
     is from inside it: stand in the pool on the x = 2.8 fitting's own line,
     5 m off the north wall. setFacing pins pitch to 0, so the distance is what
     puts a thing 1.87 m below the eye inside the 29° half-FOV — closer and the
     fitting falls out of the bottom of the frame. */
  ['pool-light-fittings', 1, [2.8, 1.6, 0]],
  /* the lagoon's swim-up bar, raked from the west end of the bank so the
     counter front, the canopy and the back-bar all read at once. The (u, v)
     frame is buildSwimUpBar's own, re-derived here from SITE.LAGOON so the
     camera follows the bar if the umbrella count ever moves it. */
  ['lagoon-swim-up-bar', 2, { world: `(() => {
    const L = S.SITE.LAGOON, TAU = Math.PI * 2;
    const T = (7.5 + .35) / L.umbrellas * TAU;          // campus.js SUB_UMB_PHASE
    const rimX = L.cx + L.rx * Math.cos(T), rimZ = L.cz + L.rz * Math.sin(T);
    let nX = (rimX - L.cx) / (L.rx * L.rx), nZ = (rimZ - L.cz) / (L.rz * L.rz);
    const nL = Math.hypot(nX, nZ); nX /= nL; nZ /= nL;
    const tX = nZ, tZ = -nX, U0 = .8;
    const wx = (u, v) => rimX + (u + U0) * tX + v * nX;
    const wz = (u, v) => rimZ + (u + U0) * tZ + v * nZ;
    return { x: wx(-9.4, .4), z: wz(-9.4, .4), y: 0,
             lookX: wx(0, -.1), lookZ: wz(0, -.1) };
  })()` }],
  /* …and the counter FRONT, from the water — the one view that shows the
     "POOL BAR" plane the GLB deliberately does not carry. water.js's
     swimMouth() opens the interior grid over |u| ≤ 7, −11 ≤ v ≤ 0.6, so this
     camera stands in swimmable water instead of being walked out of it. */
  ['lagoon-swim-up-bar-front', 2, { world: `(() => {
    const L = S.SITE.LAGOON, TAU = Math.PI * 2;
    const T = (7.5 + .35) / L.umbrellas * TAU;
    const rimX = L.cx + L.rx * Math.cos(T), rimZ = L.cz + L.rz * Math.sin(T);
    let nX = (rimX - L.cx) / (L.rx * L.rx), nZ = (rimZ - L.cz) / (L.rz * L.rz);
    const nL = Math.hypot(nX, nZ); nX /= nL; nZ /= nL;
    const tX = nZ, tZ = -nX, U0 = .8;
    const wx = (u, v) => rimX + (u + U0) * tX + v * nX;
    const wz = (u, v) => rimZ + (u + U0) * tZ + v * nZ;
    return { x: wx(-3.0, -4.2), z: wz(-3.0, -4.2), y: 0,
             lookX: wx(-.4, -.56), lookZ: wz(-.4, -.56) };
  })()` }],
  /* a cabana pod, head-on. SITE.LAGOON.ISLE.styles[3] is a 'pod' and its
     bearing is θ = π, i.e. it opens due −X at the lagoon's west rim — so the
     camera stands on the sand deck outside the basin and looks straight into
     the dome's missing wedge, which is where the daybed has to be facing. */
  ['lagoon-cabana-pod', 2, { world: `(() => {
    const L = S.SITE.LAGOON, I = L.ISLE;
    const cx = L.cx + I.dx * L.rx, cz = L.cz + I.dz * L.rz;
    const i = 3;                                    // styles[3] === 'pod'
    const th = (i + .5) / I.styles.length * Math.PI * 2;
    const ax = cx + Math.cos(th) * I.ringR, az = cz + Math.sin(th) * I.ringR;
    const d = 10.0;                                 // clear of the rim colliders
    return { x: ax + Math.cos(th) * d, z: az + Math.sin(th) * d, y: 0,
             lookX: ax, lookZ: az };
  })()` }],
  /* ── the GROUP G interiors (KAN-208). Nothing above stands INSIDE a room:
        every view so far is a lawn, a deck, a roof or a pool. These seven are
        the four rooms this wave furnishes, and the first of them is the one
        that matters most — the opening dive LANDS in the great room, so the
        sofa island is the first thing the game ever shows at eye level. ── */
  /* THE LANDING. INTRO_PATH.land === MOMENT_PLACES.PREWEDDING, enclave-local
     (1, −18) — the dive's own touch-down, facing the pool at yaw π. Turn
     round (yaw .42, NNW) and this is the room: the three-module sofa island
     at (−1, −21.2), the ribbed coffee table 1.4 m in front of it, the TV wall
     behind. Moment 1 is the Prewedding, which is the moment the dive lands
     in, and it is NIGHT — the state the lamps and the lit shade are for. */
  ['suite-great-room', 1, [1, -18, 0.42]],
  /* …the same frame in DAYLIGHT (moment 2 dresses a lawn 100 m away and
     leaves the suite alone), because a baked albedo is judged by day. */
  ['suite-great-room-day', 2, [1, -18, 0.42]],
  /* the dining end: the 3.0 × 1.2 espresso table on its two plinth legs, all
     EIGHT white high-back chairs (four near at z −18.45, four far at −20.55)
     and the west sideboard beyond. Stood off the table's own collider rect. */
  ['suite-dining', 2, [3.0, -17.0, -Math.PI / 4]],
  /* the two dining-sideboard lamps AT NIGHT — the h = .42 pair the lamp is
     modelled at, and the one view that proves `table_lamp_shade`'s mouth is
     still lit (ASSET_SPEC: "Verify at NIGHT"). Camera is clear of both the
     dining and the sofa-island collider rings. */
  ['suite-dining-night', 1, [2.6, -18.6, -1.387]],
  /* the 2F lounge's curved modular sofa, from the glass wall looking north
     across the teal rug. WORLD form because `y` is load-bearing: the array
     form spawns the camera at feet 0 and CFG.STEP_UP (0.40) will not climb
     3.8 m, so it would shoot the great room from underneath. */
  ['suite-2f-lounge', 2, { world: `(() => {
    /* ⚠ FROM THE SOUTH-WEST, not head-on. The ring's own radius is 2.35 and
       the lounge only runs to the glass at z −13.5, so a camera on the arc's
       axis stands 2.3 m off the nearest module and shoots it from inside its
       own cushion. The diagonal is the only 5 m sight line in the room. */
    const c = S.enclaveToWorld(-2.2, -14.4), t = S.enclaveToWorld(2.2, -17.5);
    return { x: c.x, z: c.z, y: S.SITE.SUITE.floorToFloor,
             lookX: t.x, lookZ: t.z };
  })()` }],
  /* the check-in lobby's two big cream sofas facing each other over the dark
     low table — campus.js's, not suite.js's, and the one Group G asset
     outside the presidential suite. WORLD form for the same reason: the lobby
     floor is ARRIVAL_LOBBY_Y (3.60), not 0. */
  ['arrival-lobby-sofas', 2, { world: `(() => {
    const LB = S.SITE.ARRIVAL.LOBBY;
    const c = S.enclaveToWorld(LB.x0 + 9.4, -13.2);
    const t = S.enclaveToWorld(LB.x0 + 4.4, -13.2);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z };
  })()` }],
  /* the spa's two navy massage beds, looking south down them from the gap
     between the jacuzzi and their heads. The annex is ground level, so the
     array form is right — but the room is only 3.8 × 6.6 m clear, and the
     partition chain, the south wall, the spa sofa's rect and the beds' own
     colRect between them leave one stand-point with 4.8 m of sight line: the
     north-east corner beside the jacuzzi, shooting down the diagonal. The
     jacuzzi surround is 0.90 m and the beds are 0.82 m at 4.4 m, so it sits
     BELOW the sight line and occludes nothing. */
  ['suite-spa-beds', 2, [-10.6, -25.2, 2.7155]],

  /* the beach pool's round island bar, from the landward side so the sand,
     the staved counter and the thatch all stand against the water. */
  ['river-island-bar', 2, { world: `(() => {
    const B = S.SITE.RIVER.BAR, W = S.SITE.RIVER.WEST;
    /* away from the pool, or the camera stands in the basin and the interior
       collider grid walks it somewhere else */
    const dx = B.cx - W.cx, dz = B.cz - W.cz, L = Math.hypot(dx, dz);
    const d = 10.5;
    return { x: B.cx + dx / L * d, z: B.cz + dz / L * d, y: 0,
             lookX: B.cx, lookZ: B.cz };
  })()` }],

  /* ── KAN-208 wave 1 (2026-09-25): the brunch chairs, the rooftop parasols,
        the island bar's thatch. ── */
  /* the brunch four-top's chairs DRESSED (slipcovers + sash), closer than
     roof-brunch-tables and from the other side, so the backs face the camera */
  ['roof-brunch-chairs', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, t = S.HOTEL_ROOF.brunchTables[3];
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const cth = t.th + 2.4 / t.r;
    return { x: acx + Math.sin(cth) * (t.r - 1.5), z: acz + Math.cos(cth) * (t.r - 1.5),
             y: R.deckY,
             lookX: acx + Math.sin(t.th) * t.r, lookZ: acz + Math.cos(t.th) * t.r };
  })()` }],
  /* a lounger-row parasol from the open deck seaward of the row. The th list
     is loungerRow()'s (campus.js), re-derived: the third parasol, i = 4/5. */
  ['roof-lounger-parasols', 2, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, C = Math.PI / 2;
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const pitch = 4.39 / R.loungeR;
    const maxOff = Math.max(...S.HOTEL_ROOF.brunchTables.map(t => Math.abs(t.th - C)));
    const pth = C - (maxOff + 5.3 / R.loungeR) - 4.5 * pitch;
    const pr = R.loungeR + 1.35, cth = pth + 5.0 / 95.6;
    return { x: acx + Math.sin(cth) * 95.6, z: acz + Math.cos(cth) * 95.6, y: R.deckY,
             lookX: acx + Math.sin(pth) * pr, lookZ: acz + Math.cos(pth) * pr };
  })()` }],
  /* …and after dark: the canopy clone is on campus.js's night-tint registry */
  ['roof-lounger-parasols-night', 5, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, C = Math.PI / 2;
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    const pitch = 4.39 / R.loungeR;
    const maxOff = Math.max(...S.HOTEL_ROOF.brunchTables.map(t => Math.abs(t.th - C)));
    const pth = C - (maxOff + 5.3 / R.loungeR) - 4.5 * pitch;
    const pr = R.loungeR + 1.35, cth = pth + 5.0 / 95.6;
    return { x: acx + Math.sin(cth) * 95.6, z: acz + Math.cos(cth) * 95.6, y: R.deckY,
             lookX: acx + Math.sin(pth) * pr, lookZ: acz + Math.cos(pth) * pr };
  })()` }],
  /* the island bar from the open sand on the far side, closer than
     river-island-bar (whose camera stands in the shrubs) */
  ['river-island-bar-thatch', 2, { world: `(() => {
    const B = S.SITE.RIVER.BAR, W = S.SITE.RIVER.WEST;
    const dx = B.cx - W.cx, dz = B.cz - W.cz, L = Math.hypot(dx, dz);
    const a = Math.atan2(dz, dx) + 2.0, d = 11.5;
    return { x: B.cx + Math.cos(a) * d, z: B.cz + Math.sin(a) * d, y: 0,
             lookX: B.cx, lookZ: B.cz };
  })()` }],
];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

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
    if (ONLY && !ONLY.has(name)) continue;
    const s = await page.evaluate(async ([mi, pos]) => {
      const g = window.__game, G = g.G;
      const P = await import('./js/player.js');
      const S = await import('./js/site.js');
      const { CFG } = await import('./js/config.js');
      g.setMoment(mi);
      for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      if (Array.isArray(pos)) {
        const w = S.enclaveToWorld(pos[0], pos[1]);
        G.player.pos.set(w.x, CFG.EYE_HEIGHT, w.z);
        P.setFacing(pos[2] + S.ENCLAVE.rotY);   // local yaw -> world yaw
        for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
      } else if (pos && pos.world) {
        /* WORLD space — no enclaveToWorld, no ENCLAVE.rotY. See the note on
           VIEWS: the hotel roof is not in the enclave and a view pushed
           through it lands 90° away. */
        const _m4 = new (Object.getPrototypeOf(G.scene.matrixWorld).constructor)();
        const _v3 = new (Object.getPrototypeOf(G.scene.position).constructor)();
        const pick = (name, i) => {
          const im = G.scene.getObjectByName(name);
          if (!im || !im.isInstancedMesh || i >= im.count) return null;
          im.getMatrixAt(i, _m4);
          _v3.setFromMatrixPosition(_m4);
          im.updateWorldMatrix(true, false);
          _v3.applyMatrix4(im.matrixWorld);
          return { x: _v3.x, y: _v3.y, z: _v3.z };
        };
        const p = new Function('S', 'CFG', 'G', 'pick', 'return ' + pos.world)(S, CFG, G, pick);
        G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z);
        P.setFacing(p.yaw !== undefined ? p.yaw
          : Math.atan2(-(p.lookX - p.x), -(p.lookZ - p.z)));
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
  /* an ONLY= run writes stats-only.json, so it never clobbers a full run's record */
  writeFileSync(`${OUT}${ONLY ? 'stats-only' : 'stats'}.json`, JSON.stringify({ url: SITE_URL, when: new Date().toISOString(), stats, errors: bad }, null, 2));
  console.log('\nerrors:', bad.length ? bad : 'none');
  console.log('wrote', OUT);
  await browser.close();
})();
