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

  /* ── KAN-208 WAVE 2 — the planting: palms, hedges, topiary at guest distance.
        Enclave-local views where the planting is enclave-local; pick() on the
        live buckets for the topiary so the camera finds the instance that is
        actually there. ── */
  /* in the spine path's gap through the palm belt, looking west along it —
     the belt palms 3–10 m away, the hero palms a guest walks between */
  ['palms-belt', 2, [-2, 52.4, Math.PI / 2]],
  /* …and after dark (the After Party): MAT.frond / MAT.bark's night tint */
  ['palms-belt-crowns-night', 5, [-6, 69, 0]],
  /* the grand lawn's west flank palms from the lawn */
  ['palms-lawn-flank', 2, [-33, 37, Math.PI / 2 + .35]],
  /* the belt's crowns from the beachfront lawn, ~12–18 m back — the distance
     the ceremony guests see them at */
  ['palms-belt-crowns', 2, [-6, 69, 0]],
  /* the sea-edge band's clipped hedge (hedgeBlobI) from the beachfront lawn */
  ['hedge-sea-band', 3, [-31, 71.2, Math.PI]],
  /* nature's cabana hedge wall (hedge_run), down its length from the north */
  ['hedge-cabana-wall', 2, [17.4, 24.5, Math.atan2(2.4, 12)]],
  /* the planted terrace edge's blocks + a topiary (hedgeI / topiaryI) */
  ['hedge-terrace-topiary', 2, { world: `(() => {
    const p = pick('campus:topiaryI', 0), l = S.worldToEnclave(p.x, p.z);
    const c = S.enclaveToWorld(l.x + 3.5, l.z + 6.5);
    return { x: c.x, z: c.z, lookX: p.x, lookZ: p.z };
  })()` }],
  /* the second pool's pavilion hedges + topiary (spHedgeI / spTopiaryI) */
  ['hedge-pavilion-topiary', 2, { world: `(() => {
    const p = pick('campus:spTopiaryI', 0), q = pick('campus:spTopiaryI', 3);
    const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
    const dx = p.x - mx, dz = p.z - mz, L = Math.hypot(dx, dz) || 1;
    return { x: p.x + dx / L * 4.5, z: p.z + dz / L * 4.5, lookX: mx, lookZ: mz };
  })()` }],
  /* the arrival court from the car park: the court's clipped batter hedges */
  ['hedge-arrival-court', 2, { world: `(() => {
    const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(62.3, AR.stalls.z0 + 1.5 * AR.stalls.pitch);
    const f = S.enclaveToWorld((AR.fore.x0 + AR.fore.x1) / 2, (AR.fore.z0 + AR.fore.z1) / 2);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: f.x, lookZ: f.z };
  })()` }],

  /* ── KAN-208 WAVE 3 — the wedding/arrival props: the welcome board, the
        cocktail glassware, the pearl swags, the festoon, the parked cars.
        A 4th element { night: true } flips the lighting AFTER setMoment (the
        cocktail is a daylight moment; its glassware and festoon are also
        judged after dark). ── */
  /* the welcome board, ~3.6 m in front of its face (moments.js: sx = AX + 5.45
     = −16.55, sz 66.8, rotation.y −2.44 → its face looks (−.645, −.764)) */
  ['welcome-board', 2, [-16.55 - .645 * 2.5, 66.8 - .764 * 2.5, -2.44]],
  /* the round bar's glassware at a guest's elbow: bar frame(4, 68, 0), the
     four rows sit at local z −.2…−.55, i.e. the side facing this camera */
  ['cocktail-glassware', 3, [4.15, 66.05, Math.PI]],
  ['cocktail-glassware-night', 3, [4.15, 66.05, Math.PI], { night: true }],
  /* the festoon over the cocktail lawn — three pole-to-pole runs */
  ['cocktail-festoon', 3, [4, 56.6, Math.PI]],
  ['cocktail-festoon-night', 3, [4, 56.6, Math.PI], { night: true }],
  /* the pearl swags between the two tall plinths, 2.6 m off, from +X */
  ['ceremony-pearls', 2, [-28.2, 63.6, Math.PI / 2]],
  /* the dinner lawn's festoon lattice + the prewedding / after-party runs */
  ['dinner-festoon', 4, [-17, -3, Math.PI * .92]],
  ['setup-festoon', 1, [-1, -5.2, 0]],
  ['afterparty-festoon', 5, [2, -5.4, 0]],
  /* the arrival court's parked cars from the court, ~6 m off their noses */
  ['arrival-cars', 2, { world: `(() => {
    const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(57.2, -7.2);
    const f = S.enclaveToWorld(62.3, AR.stalls.z0 + 1.2 * AR.stalls.pitch);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: f.x, lookZ: f.z };
  })()` }],
  /* the north apron's row of twelve, from the road */
  /* one court car at 3.5 m, three-quarter front (the body bucket's instance
     13 is the arrival court's first car — pick() follows the live bucket) */
  ['car-close', 2, { world: `(() => {
    const p = pick('campus:carBodyGlbI', 13) || pick('campus:carI', 52);
    return { x: p.x + 2.6, z: p.z + 3.6, y: p.y, lookX: p.x, lookZ: p.z };
  })()` }],
  ['apron-cars', 2, { world: `({ x: 52, z: -71.5, y: 0, lookX: 60, lookZ: -78 })` }],

  /* ── KAN-208 WAVE 4 — the planting wave 2 left behind: the shrub masses, the
        ground cover, the bougainvillea, the casuarinas, the river dressing's
        shrubs, the atrium's cloud topiary and water.js's two hedge boxes, each
        at guest distance. Fixed coordinates (no pick()), so the SAME camera
        stands in the before build, which has none of the new buckets. ── */
  /* the north apron's big shrub clump beside the cars, ~5 m off */
  ['shrubs-apron', 2, { world: `({ x: 56.2, z: -69.6, y: 0, lookX: 61.4, lookZ: -73.6 })` }],
  ['shrubs-apron-night', 2, { world: `({ x: 56.2, z: -69.6, y: 0, lookX: 61.4, lookZ: -73.6 })` }, { night: true }],
  /* the dune scrub + a ground-cover bed seaward of the cocktail lawn's band */
  ['shrubs-dune', 3, { world: `(() => {
    const c = S.enclaveToWorld(6.5, 75.6), t = S.enclaveToWorld(10.5, 80.5);
    return { x: c.x, z: c.z, lookX: t.x, lookZ: t.z };
  })()` }],
  /* a ground-cover bed on the open lawn east of the grand lawn */
  ['cover-beds', 2, { world: `(() => {
    const c = S.enclaveToWorld(31.5, 66.5), t = S.enclaveToWorld(36.5, 71.3);
    return { x: c.x, z: c.z, lookX: t.x, lookZ: t.z };
  })()` }],
  /* the bougainvillea on the planted terrace edge, from the grand lawn */
  ['boug-terrace', 2, { world: `(() => {
    const c = S.enclaveToWorld(-20.5, 28.4), t = S.enclaveToWorld(-24.0, 22.5);
    return { x: c.x, z: c.z, lookX: t.x, lookZ: t.z };
  })()` }],
  /* the sea band's casuarinas from the beachfront lawn, ~7 m back */
  ['casuarina-band', 2, [-8.5, 71.2, Math.PI]],
  ['casuarina-band-night', 5, [-8.5, 71.2, Math.PI]],
  /* the atrium courtyard's cloud-pruned topiary between the ponds */
  ['atrium-topiary', 2, { world: `({ x: 6.9, z: 81.2, lookX: 11.2, lookZ: 76.6 })` }],
  /* water.js's hedge across the hero pool's SOUTH end, from the grand lawn */
  ['pool-hedge-south', 2, { world: `(() => {
    const c = S.enclaveToWorld(-6.5, 25.9), t = S.enclaveToWorld(3.5, 24.3);
    return { x: c.x, z: c.z, lookX: t.x, lookZ: t.z };
  })()` }],

  /* ── KAN-211 WAVE A — the arrival pavilion + check-in lobby as Blender
        architecture. Every camera is derived from SITE.ARRIVAL (enclave-local
        → enclaveToWorld), no pick(), so the SAME camera stands in the before
        build. `a(lx, lz, y, tx, tz)` = stand at local (lx, lz) with feet y,
        look at local (tx, tz). ── */
  ['archA-court-approach', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(61.5, AR.axisZ), t = S.enclaveToWorld(AR.doorX, AR.axisZ);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-court-threequarter', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(57.4, 1.0), t = S.enclaveToWorld(AR.faceX, -14.5);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-stair-canopy', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(49.4, AR.axisZ), t = S.enclaveToWorld(AR.doorX, AR.axisZ);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-canopy-night', 1, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(48.2, AR.axisZ), t = S.enclaveToWorld(AR.doorX, AR.axisZ);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }, { night: true }],
  ['archA-lobby-desk', 2, { world: `(() => { const AR = S.SITE.ARRIVAL, LB = AR.LOBBY;
    const c = S.enclaveToWorld(LB.x0 + 7.6, LB.z0 + 7.4), t = S.enclaveToWorld(LB.x0 + 5.4, LB.z0 + 1.7);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-balcony-link', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(21.5, (AR.LINK.z0 + AR.LINK.z1) / 2), t = S.enclaveToWorld(AR.BALC.x0, -14.5);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-courtyard-face', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(20.5, 1.5), t = S.enclaveToWorld(AR.backX, -10);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }],
  ['archA-lounge-deck', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(AR.DECK.x0 + .9, AR.bldg.z1 + .8), t = S.enclaveToWorld(AR.backX - .4, -16);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }],
  /* ── KAN-211 WAVE B — THE ATRIUM as Blender architecture. Enclave-local
        cameras (a(lx, lz, feetY, tx, tz)), no pick(), so the SAME camera
        stands in the before build. opt.pitch tilts the look (radians, + up);
        opt.fly holds the camera in the air (the high view). ── */
  ['archB-corridor', 2, { world: `(() => { const c = S.enclaveToWorld(27.6, -51.3), t = S.enclaveToWorld(-12, -51.3);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .06 }],
  ['archB-corridor-night', 1, { world: `(() => { const c = S.enclaveToWorld(27.6, -51.3), t = S.enclaveToWorld(-12, -51.3);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .06 }],
  ['archB-column', 2, { world: `(() => { const c = S.enclaveToWorld(13.3, -31.2), t = S.enclaveToWorld(11, -33.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.18 }],
  ['archB-pond', 2, { world: `(() => { const c = S.enclaveToWorld(3.4, -34.6), t = S.enclaveToWorld(-1.5, -40.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.38 }],
  ['archB-stair', 2, { world: `(() => { const c = S.enclaveToWorld(-4.0, -41.2), t = S.enclaveToWorld(-8, -48.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .16 }],
  ['archB-door', 2, { world: `(() => { const c = S.enclaveToWorld(10.3, -50.6), t = S.enclaveToWorld(8, -54);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.02 }],
  ['archB-door-night', 1, { world: `(() => { const c = S.enclaveToWorld(10.3, -50.6), t = S.enclaveToWorld(8, -54);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: -.02 }],
  ['archB-gallery-2f', 2, { world: `(() => { const c = S.enclaveToWorld(0.5, -30.9), t = S.enclaveToWorld(16, -35.5);
    return { x: c.x, z: c.z, y: S.SITE.ATRIUM.floorH, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.12 }],
  ['archB-high', 2, { world: `(() => { const c = S.enclaveToWorld(8, -30.5), t = S.enclaveToWorld(8, -41);
    return { x: c.x, z: c.z, y: 10.5, lookX: t.x, lookZ: t.z }; })()` }, { fly: true, pitch: -.72 }],
  ['archB-photo', 2, { world: `(() => { const c = S.enclaveToWorld(-10.4, -33.0), t = S.enclaveToWorld(-1.0, -44.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .10 }],
  /* ── KAN-211 WAVE C — THE PRESIDENTIAL SUITE EXTERIOR. Enclave-local
        cameras, no pick(), so the SAME camera stands in the before build.
        The across-pool pair is a FLY camera ~1.2 m over the water on the
        pool's centreline — where the hotel deck's p3 elevation (pimg-002)
        was taken from, and the og.jpg night framing. ── */
  ['archC-across-pool', 2, { world: `(() => { const c = S.enclaveToWorld(0, 19.0), t = S.enclaveToWorld(0, -18);
    return { x: c.x, z: c.z, y: -.05, lookX: t.x, lookZ: t.z }; })()` }, { fly: true, pitch: .07 }],
  ['archC-across-pool-night', 1, { world: `(() => { const c = S.enclaveToWorld(0, 19.0), t = S.enclaveToWorld(0, -18);
    return { x: c.x, z: c.z, y: -.05, lookX: t.x, lookZ: t.z }; })()` }, { fly: true, pitch: .07 }],
  /* the signature: the prewedding deck at night, lanterns in the foreground,
     from the west lawn's pool corner looking up the water at the suite */
  ['archC-signature-night', 1, { world: `(() => { const c = S.enclaveToWorld(-3.2, 9.5), t = S.enclaveToWorld(1.0, -16);
    return { x: c.x, z: c.z, y: -.1, lookX: t.x, lookZ: t.z }; })()` }, { fly: true, pitch: .10 }],
  /* the cantilever + copper fascia close: from the deck's west side, up at
     the south-west corner — the fascia, the soffit and the void */
  ['archC-roof-edge', 2, { world: `(() => { const c = S.enclaveToWorld(-4.6, -7.0), t = S.enclaveToWorld(-10.2, -11.2);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .50 }],
  ['archC-glass-wall', 2, { world: `(() => { const c = S.enclaveToWorld(-2.6, -8.2), t = S.enclaveToWorld(0.8, -13.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .12 }],
  ['archC-glass-wall-night', 1, { world: `(() => { const c = S.enclaveToWorld(-2.6, -8.2), t = S.enclaveToWorld(0.8, -13.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .12 }],
  /* the upper balcony + its dining set, on the balcony at 2F (feet 3.8) */
  ['archC-balcony', 2, { world: `(() => { const c = S.enclaveToWorld(-6.6, -11.95), t = S.enclaveToWorld(1.0, -12.9);
    return { x: c.x, z: c.z, y: S.SITE.SUITE.floorToFloor, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.16 }],
  /* the dive landing, looking OUT (the Prewedding spawn faces the pool) */
  ['archC-great-room-out', 2, [1, -18, Math.PI]],
  ['archC-great-room-out-night', 1, [1, -18, Math.PI]],
  /* the north entry portal, from the atrium's south gallery */
  ['archC-portal', 2, { world: `(() => { const c = S.enclaveToWorld(1.6, -35.2), t = S.enclaveToWorld(2.2, -24);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .10 }],
  /* the 2F link: on the walkway slot looking north — the suite's 2F door on
     the left, the atrium's 2F link door at the end */
  ['archC-link-door', 2, { world: `(() => { const c = S.enclaveToWorld(9.05, -13.8), t = S.enclaveToWorld(8.6, -28);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .04 }],
  /* ── KAN-211 FIX PASS — the gallery decking, the pond water at night, the
        balcony's front edge. Same enclave-local camera form. ── */
  ['archFix-pond-night', 1, { world: `(() => { const c = S.enclaveToWorld(3.4, -34.6), t = S.enclaveToWorld(-1.5, -40.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: -.38 }],
  ['archFix-gallery-2f-night', 1, { world: `(() => { const c = S.enclaveToWorld(0.5, -30.9), t = S.enclaveToWorld(16, -35.5);
    return { x: c.x, z: c.z, y: S.SITE.ATRIUM.floorH, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: -.12 }],
  ['archFix-balcony-front', 2, { world: `(() => { const c = S.enclaveToWorld(-3.0, -13.2), t = S.enclaveToWorld(-3.0, 0);
    return { x: c.x, z: c.z, y: S.SITE.SUITE.floorToFloor, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.30 }],
  /* ── KAN-211 WAVE D — the suite's plaster side/back walls + interior pier,
        the 2F link door at a grazing angle, the lobby slat ceiling, the 酒廊
        interior, the upper walkway (LINK / SLOT / HEAD) + its pergola. Same
        enclave-local camera form, no pick(). ── */
  ['archD-suite-side', 2, { world: `(() => { const c = S.enclaveToWorld(-23.5, -2.5), t = S.enclaveToWorld(-9, -20.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .16 }],
  ['archD-suite-side-night', 1, { world: `(() => { const c = S.enclaveToWorld(-23.5, -2.5), t = S.enclaveToWorld(-9, -20.5);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .16 }],
  ['archD-suite-back', 2, { world: `(() => { const c = S.enclaveToWorld(9.7, -27.25), t = S.enclaveToWorld(-8, -26.4);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .05 }],
  ['archD-suite-east', 2, { world: `(() => { const c = S.enclaveToWorld(13.6, -4.6), t = S.enclaveToWorld(8, -20);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .22 }],
  ['archD-pier', 2, { world: `(() => { const c = S.enclaveToWorld(-1.2, -20.2), t = S.enclaveToWorld(3.6, -14.1);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .02 }],
  ['archD-link-door-graze', 2, { world: `(() => { const c = S.enclaveToWorld(9.55, -14.6), t = S.enclaveToWorld(8.1, -20.6);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .02 }],
  ['archD-lobby-ceiling', 2, { world: `(() => { const LB = S.SITE.ARRIVAL.LOBBY;
    const c = S.enclaveToWorld(LB.x0 + 5.4, LB.z0 + 4.6), t = S.enclaveToWorld(LB.x0 + 4.0, LB.z0 + 14);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .62 }],
  ['archD-lounge', 2, { world: `(() => { const B = S.SITE.ARRIVAL.bldg;
    const c = S.enclaveToWorld(B.x1 - 1.4, -2.6), t = S.enclaveToWorld(B.x0 + 1.5, -17);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .06 }],
  ['archD-lounge-night', 1, { world: `(() => { const B = S.SITE.ARRIVAL.bldg;
    const c = S.enclaveToWorld(B.x1 - 1.4, -2.6), t = S.enclaveToWorld(B.x0 + 1.5, -17);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .06 }],
  ['archD-walk-from-lobby', 2, { world: `(() => { const LK = S.SITE.ARRIVAL.LINK, zc = (LK.z0 + LK.z1) / 2;
    const c = S.enclaveToWorld(S.SITE.ARRIVAL.LOBBY.x0 + 1.2, zc + .3), t = S.enclaveToWorld(LK.x0, zc);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .04 }],
  ['archD-walk-from-atrium', 2, { world: `(() => { const HD = S.SITE.ARRIVAL.HEAD, SL = S.SITE.ARRIVAL.SLOT;
    const c = S.enclaveToWorld((SL.x0 + SL.x1) / 2, HD.z0 + .9), t = S.enclaveToWorld((SL.x0 + SL.x1) / 2, SL.z1);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .02 }],
  ['archD-walk-slot-corner', 2, { world: `(() => { const LK = S.SITE.ARRIVAL.LINK, SL = S.SITE.ARRIVAL.SLOT;
    const c = S.enclaveToWorld((SL.x0 + SL.x1) / 2, -11.5), t = S.enclaveToWorld(LK.x1, (LK.z0 + LK.z1) / 2);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .04 }],
  ['archD-pergola-below', 2, { world: `(() => { const LK = S.SITE.ARRIVAL.LINK;
    const c = S.enclaveToWorld(24.5, -1.0), t = S.enclaveToWorld(17, (LK.z0 + LK.z1) / 2);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .30 }],
  /* ── KAN-211 WAVE E — the quick-win props: the sea band's agave + croton,
        the two rain trees, the brunch slipcovers, the benches, the island
        bar's underside (+ night), the festoon run ends on their posts (day +
        night), the arrival's dracaena bowls + batter + frangipani, the lobby
        floor. Fixed WORLD cameras (the sea band and the pavilion bench read
        once off the pre-wave build) so the same camera stands in both. ── */
  ['waveE-agave', 3, { world: `({ x: -106.8, z: 58.9, y: 0, lookX: -109.0, lookZ: 59.8 })` }, { pitch: -.42 }],
  ['waveE-agave-band', 3, { world: `({ x: -104.2, z: 54.5, y: 0, lookX: -109.6, lookZ: 66.5 })` }, { pitch: -.10 }],
  ['waveE-croton-sand', 3, { world: `({ x: -114.4, z: 60.3, y: S.siteFloorY(-114.4, 60.3), lookX: -111.4, lookZ: 61.0 })` }, { pitch: -.22 }],
  ['waveE-croton-lawn', 3, { world: `({ x: -105.6, z: 67.2, y: 0, lookX: -111.4, lookZ: 69.2 })` }, { pitch: -.06 }],
  ['waveE-tree-beach', 2, { world: `(() => { const W = S.SITE.RIVER.WEST, T = W.TREE;
    const tx = W.cx + T.dx * W.r, tz = W.cz + T.dz * W.r;
    return { x: -62.0, z: -9.0, y: 0, lookX: tx, lookZ: tz }; })()` }, { pitch: .14 }],
  ['waveE-tree-beach-under', 2, { world: `(() => { const W = S.SITE.RIVER.WEST, T = W.TREE;
    const tx = W.cx + T.dx * W.r, tz = W.cz + T.dz * W.r, L = Math.hypot(tx - W.cx, tz - W.cz);
    const ux = (tx - W.cx) / L, uz = (tz - W.cz) / L;
    return { x: W.cx + ux * 22, z: W.cz + uz * 22, y: 0, lookX: W.cx, lookZ: W.cz }; })()` }, { pitch: .34 }],
  ['waveE-tree-lagoon', 2, { world: `(() => { const L = S.SITE.LAGOON, I = S.SITE.RIVER.ISLAND;
    return { x: L.cx, z: L.cz - L.rz - 1.8, y: 0, lookX: L.cx + L.rx * I.dx, lookZ: L.cz + L.rz * I.dz }; })()` }, { pitch: .10 }],
  ['waveE-brunch-slips', 0, { world: `(() => {
    const R = S.SITE.HOTEL.ROOFTOP, t = S.HOTEL_ROOF.brunchTables[3], p = S.HOTEL_ROOF.pt(t.th, t.r);
    const acx = S.SITE.HOTEL.cx - S.SITE.HOTEL.r, acz = S.SITE.HOTEL.cz;
    let best = null;
    for (let c = 0; c < 4; c++) { const ca = c * Math.PI / 2 + .4;
      const x = p.x + Math.cos(ca) * 2.6, z = p.z - Math.sin(ca) * 2.6, d = Math.hypot(x - acx, z - acz);
      if (!best || d > best.d) best = { x, z, d }; }
    return { x: best.x, z: best.z, y: R.deckY, lookX: p.x, lookZ: p.z }; })()` }, { pitch: -.28 }],
  ['waveE-bench-lawn', 3, { world: `(() => { const BL = S.SITE.BEACH_LAWN;
    const c = S.enclaveToWorld(BL.x0 + 6.6, BL.z1 - 4.4), t = S.enclaveToWorld(BL.x0 + 5, BL.z1 - 1.6);
    return { x: c.x, z: c.z, y: 0, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.30 }],
  ['waveE-bench-pavilion', 4, { world: `({ x: -18.3, z: 15.9, y: 0, lookX: -20.9, lookZ: 13.55 })` }, { pitch: -.32 }],
  ['waveE-bar-under', 2, { world: `(() => {
    const B = S.SITE.RIVER.BAR, W = S.SITE.RIVER.WEST;
    const dx = B.cx - W.cx, dz = B.cz - W.cz, L = Math.hypot(dx, dz), d = 7.0;
    return { x: B.cx + dx / L * d, z: B.cz + dz / L * d, y: 0, lookX: B.cx, lookZ: B.cz }; })()` }, { pitch: .36 }],
  ['waveE-bar-under-night', 1, { world: `(() => {
    const B = S.SITE.RIVER.BAR, W = S.SITE.RIVER.WEST;
    const dx = B.cx - W.cx, dz = B.cz - W.cz, L = Math.hypot(dx, dz), d = 7.0;
    return { x: B.cx + dx / L * d, z: B.cz + dz / L * d, y: 0, lookX: B.cx, lookZ: B.cz }; })()` }, { night: true, pitch: .36 }],
  ['waveE-setup-festoon-end', 1, { world: `(() => { const c = S.enclaveToWorld(1.5, -10.8), t = S.enclaveToWorld(2.2, -3.6);
    return { x: c.x, z: c.z, y: .12, lookX: t.x, lookZ: t.z }; })()` }, { night: false, pitch: .08 }],
  ['waveE-setup-festoon-end-night', 1, { world: `(() => { const c = S.enclaveToWorld(1.5, -10.8), t = S.enclaveToWorld(2.2, -3.6);
    return { x: c.x, z: c.z, y: .12, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .08 }],
  ['waveE-afterparty-festoon-end', 5, { world: `(() => { const c = S.enclaveToWorld(-.6, -10.8), t = S.enclaveToWorld(1.2, -3.6);
    return { x: c.x, z: c.z, y: .12, lookX: t.x, lookZ: t.z }; })()` }, { night: false, pitch: .10 }],
  ['waveE-afterparty-festoon-end-night', 5, { world: `(() => { const c = S.enclaveToWorld(-.6, -10.8), t = S.enclaveToWorld(1.2, -3.6);
    return { x: c.x, z: c.z, y: .12, lookX: t.x, lookZ: t.z }; })()` }, { night: true, pitch: .10 }],
  ['waveE-dracaena', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(49.4, -7.6), t = S.enclaveToWorld(AR.stair.x1 + 1.0, -4.0);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .06 }],
  ['waveE-batter', 2, { world: `(() => { const c = S.enclaveToWorld(71.8, -3.0), t = S.enclaveToWorld(64.6, -9.0);
    return { x: c.x, z: c.z, y: S.siteFloorY(c.x, c.z, 5), lookX: t.x, lookZ: t.z }; })()` }, { pitch: .04 }],
  ['waveE-frangi', 2, { world: `(() => { const AR = S.SITE.ARRIVAL;
    const c = S.enclaveToWorld(57.2, -7.6), t = S.enclaveToWorld(AR.bedX0 + 5.6, -12.35);
    return { x: c.x, z: c.z, y: AR.terraceY, lookX: t.x, lookZ: t.z }; })()` }, { pitch: .26 }],
  ['waveE-lobby-floor', 2, { world: `(() => { const LB = S.SITE.ARRIVAL.LOBBY;
    const c = S.enclaveToWorld(LB.x0 + 9.4, LB.z0 + 17.5), t = S.enclaveToWorld(LB.x0 + 3.0, LB.z0 + 6.0);
    return { x: c.x, z: c.z, y: S.ARRIVAL_LOBBY_Y, lookX: t.x, lookZ: t.z }; })()` }, { pitch: -.30 }],
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
  for (const [name, mi, pos, opt] of VIEWS) {
    if (ONLY && !ONLY.has(name)) continue;
    const s = await page.evaluate(async ([mi, pos, opt]) => {
      const g = window.__game, G = g.G;
      const P = await import('./js/player.js');
      const S = await import('./js/site.js');
      const { CFG } = await import('./js/config.js');
      g.setMoment(mi);
      /* always re-assert the lighting: setMoment early-returns on the current
         index, so a { night } view would otherwise leak into the next view */
      (await import('./js/world.js')).setNight(G,
        opt && opt.night !== undefined ? opt.night : !!CFG.MOMENTS[mi].night);
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
        /* setMoment early-returns on the current index, so a fly view would
           leak its mode into the next view: re-assert it both ways */
        G.setMode(opt && opt.fly ? 'fly' : 'walk', { quiet: true });
        G.player.pos.set(p.x, (p.y || 0) + CFG.EYE_HEIGHT, p.z);
        P.setFacing(p.yaw !== undefined ? p.yaw
          : Math.atan2(-(p.lookX - p.x), -(p.lookZ - p.z)));
        for (let i = 0; i < 6; i++) P.updatePlayer(G, 1 / 60);
        /* wave B: a tilted look (setFacing zeroes pitch; applyLook adds −dy·sens) */
        if (opt && opt.pitch) P.applyLook(0, -opt.pitch, 1);
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
      const main = { calls: inf.render.calls, tris: inf.render.triangles };
      /* KAN-211 wave C: the MIRROR PASS's own cost at this view — every
         Reflector's onBeforeRender called with info.autoReset off, so the
         counters hold that pass and nothing else (mirrorfrustum.js's method).
         water.js gates the render every Nth frame, so retry until it draws. */
      const mirror = { calls: 0, tris: 0 };
      {
        const R = G.renderer, cam = G.camera;
        const T = await import('three');
        const fr = new T.Frustum().setFromProjectionMatrix(
          new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
        const refl = [];
        G.scene.traverse(o => { if (o.isReflector || o.type === 'Reflector') refl.push(o); });
        const was = R.info.autoReset;
        R.info.autoReset = false;
        for (const m of refl) {
          if (!m.visible || !fr.intersectsObject(m)) continue;   // three would not call it
          for (let k = 0; k < 6; k++) {
            R.info.reset();
            m.onBeforeRender(R, G.scene, cam);
            if (R.info.render.calls > 0) {
              mirror.calls += R.info.render.calls; mirror.tris += R.info.render.triangles; break;
            }
          }
        }
        R.info.reset();
        R.info.autoReset = was;
      }
      return {
        mirrorCalls: mirror.calls, mirrorTris: mirror.tris,
        fps: +(frames / ((performance.now() - t0) / 1000)).toFixed(1),
        calls: main.calls, tris: main.tris,
        geometries: inf.memory.geometries, textures: inf.memory.textures,
        programs: inf.programs ? inf.programs.length : null,
        night: !!G.night, colliders: G.colliders.length,
        feet: +(G.player.pos.y - CFG.EYE_HEIGHT).toFixed(3),
      };
    }, [mi, pos, opt]);
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
