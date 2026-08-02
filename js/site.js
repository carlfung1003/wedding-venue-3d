// site.js — THE MASTER SITE PLAN. Single source of truth for where everything is.
//
// Every builder module reads its footprint from here; nothing invents its own
// coordinates. Derived from reference/suite-interior-brief.md,
// reference/clubhouse-pdf-brief.md and Carl's aerials (reference/photos/).
//
// Axes:  +X = east   -X = west (beach, then ocean)
//        +Z = south  -Z = north (arrival road, parking)
//         y = 0      = ground/deck datum. Pool water sits at POOL.waterY.
// Origin (0,0) = the CENTRE OF THE PRESIDENTIAL SUITE POOL — the hero shot.
//
// Real numbers we know: 隐逸居 enclave 3,500 ㎡ · presidential suite 588 ㎡ over
// two storeys · lounge 280 ㎡ / seats 60 · great room ~16 × 13 m envelope with a
// ~14 m folding glass wall · pool ~25 × 10 m raised 0.45 m.

export const SITE = {
  // ---------------------------------------------------------------- the suite
  // Two-storey glass villa. Glass wall faces SOUTH (+Z) onto the deck and pool.
  SUITE: {
    cx: 0, cz: -20,          // centre of footprint
    w: 16, d: 13,            // envelope (X, Z)
    floorH: 3.4,             // 1F floor-to-ceiling
    floor2H: 3.0,            // 2F floor-to-ceiling
    floorToFloor: 3.8,       // stair rise
    roofOverhang: 2.2,       // cantilevered flat roof w/ copper fascia
    glassWallZ: -13.5,       // south face — the folding glass wall plane
    glassWallW: 14,          // glazed frontage width
    leafW: 0.95, leafH: 2.8, // folding leaf module
    /* ── interior plan, ENCLAVE-LOCAL. MIRRORED 2026-08-01 — see below ──────
       These five were authored from reference/suite-interior-brief.md §4, and
       that plan is REVERSED left-for-right. The brief was distilled from a
       handheld walkthrough video, and handedness read off a moving phone
       camera is trivially easy to flip; §4 flipped, and everything built from
       it flipped with it. Carl has been to the suite and named four elements
       on the wrong side — exterior stair, pantry shelf, interior staircase,
       spa/massage room — which is every element §4 places off the centre line.

       The frames settle it independently of Carl:
         · f048 / f050 — from inside, looking out through the folding wall at
           the pool, the exterior stair and the "THE WESTIN"/H pillar are at
           the FAR LEFT of the view, on the same side as the white cabana
           blocks. Facing the pool is local +Z, and player.js builds fwd as
           (−sin yaw, 0, −cos yaw), so LEFT is local +X. SITE.CABANAS is
           already at x +12 (Carl-verified on site), so the exterior stair
           belongs at +X too — the brief put it west.
         · The brief's own §1/§6 put the cabanas W and the loungers E; Carl
           corrected both to the opposite. The E/W labelling is reversed
           wholesale, not in one paragraph.

       So the whole interior is reflected about the building's centre line
       (x = SUITE.cx = 0): dining + pantry EAST, stair + spa WEST, exterior
       stair EAST. suite.js still authors its 400-odd interior X coordinates
       in the old brief frame and reflects them on the way out through its
       mx() helper — read the banner at the top of that file before editing
       either side. Do NOT "tidy" one of these back without the other.        */
    diningX: 5.5,            // dining area centre X (east third)
    livingX: -1.0,           // living area centre X
    stairX: -6.0,            // black stair mass (west end of great room)
    pantry: { cx: 6.5, cz: -24.5, w: 4, d: 3.5 },    // NE corner
    spa:    { cx: -10.5, cz: -22.0, w: 7, d: 5 },    // west, off the corridor
    corridorW: 1.6,
    balconyD: 2.0,           // 2F balcony depth, south side
  },

  // ------------------------------------------------------------- deck & pool
  DECK: { z0: -13.5, z1: -6.5, w: 16, cx: 0 },   // basalt pavers, 7 m deep
  TURF: { z0: -6.5, z1: -4.0 },                  // turf band, WESTIN letters
  // THE POOL RUNS AWAY FROM THE SUITE, NOT ACROSS IT.
  // Carl's correction (2026-08-01, third pass): standing in the great room you
  // see the pool END-ON — its narrow 10 m width — with the water receding 25 m
  // toward the sea. The balcony photo (deck p5) shows exactly this. It was
  // built 25 wide × 10 deep, i.e. rotated 90°, which read as a wide lap pool
  // pressed against the facade. Long axis = Z. Do not swap these back.
  POOL: {
    cx: 0, cz: 9.0,          // centre — starts just past the turf band
    w: 10, d: 25,
    plinth: 0.45,            // raised on black stone
    waterY: 0.40,            // water surface (just under coping)
    depth: 1.5,
    lanterns: 9,             // big glowing floating lanterns — SIGNATURE SHOT
  },
  // Far (south) side of the pool. ORIENTATION IS LOAD-BEARING — corrected from
  // the hotel deck's balcony photo (p5) after Carl caught it flipped:
  // standing in the suite looking south, the cabana pavilions and the loungers
  // are BOTH on your LEFT, i.e. the EAST (+X) half. Right/west is open lawn.
  // (player.js builds fwd as (-sin yaw, 0, -cos yaw), so facing +Z puts +X on
  // your left — flipping these ranges flips the whole view.)
  // Now that the pool runs north–south, its LONG SIDES are the east and west
  // edges. Both runs go along Z at a fixed X — note the shape change from
  // {x0,x1,z} to {x,z0,z1}. Loungers line the water; the pavilions stand set
  // back behind them, both on the EAST (+X) side = your LEFT looking south
  // from the suite. The west side stays open lawn + hedge, as in the photo.
  // Carl confirmed on site: the white frame structures are on the LEFT (east,
  // +X) — correct as built — and the CHAIRS are on the RIGHT, i.e. the WEST
  // (−X) long side, opposite them across the water.
  CABANAS: { x: 12.0, z0: -1, z1: 20, count: 7, wMin: 2.6, wMax: 3.4, hMin: 2.5, hMax: 3.5 },
  LOUNGERS: { x: -7.6, z0: 0, z1: 19, count: 8, umbrellas: 3 },
  PERGOLA: { cx: 12, cz: 25, w: 5, d: 4, h: 3.0 },   // far end, closing the view
  // Both of these read off the SUITE's interior plan and moved with it when the
  // mirror was corrected (see SUITE above): in f048/f050 the stair and the
  // pillar stand together at the far LEFT of the view out to the pool, i.e.
  // local +X, the same side as CABANAS. They were at −9.0 / −9.5.
  SIGN_PILLAR: { x: 9.5, z: -12.0 },             // dark "THE WESTIN" / "H" pillar
  EXT_STAIR: { x: 9.0, z: -16.0 },               // exterior stair to 2F balcony

  // event plaza — moved WEST of the deck: the east side is now the pavilion
  // and lounger run down the pool's long edge.
  // x0 trimmed −32 → −30 (2026-08-01, pool/room-type pass) to leave a real gap
  // for the relocated 酒廊: SITE.LOUNGE's roof overhang now reaches x −32.
  // ...and then moved EAST again in the same pass: the −X side is now the
  // 3-BR suites and their pool, and the plaza was overlapping the villa at
  // (−24, −14). East of the cabana run is the only clear ground left.
  PLAZA: { x0: 18, x1: 38, z0: -14, z1: -2 },

  // ------------------------------------------------------------- the atrium
  // The clubhouse's central open-air courtyard — the arrival heart of 隐逸居.
  // EVERY villa entry opens off it, including the presidential suite's north
  // double doors (this answers uncertainty #4 in suite-interior-brief.md).
  // Two storeys of galleries under dark timber soffits on black stone columns,
  // wrapped around still black reflecting pools set in grey gravel beds with
  // cloud-pruned topiary. Ref: reference/photos/clubhouse-atrium.jpeg.
  ATRIUM: {
    cx: 8, cz: -41,          // sits directly north of the suite
    w: 44, d: 26,            // outer envelope
    courtW: 30, courtD: 15,  // the open-to-sky void in the middle
    galleryW: 6,             // covered walkway depth on each side
    floorH: 3.6, floors: 2,
    colR: 0.28,              // black square stone columns
    // still reflecting pools in the courtyard floor: [cx, cz, w, d]
    PONDS: [
      [-2, -41, 13, 5.5],
      [14, -38.5, 11, 4.5],
    ],
    topiary: 14,
    stair: { x: -8, z: -47 },   // open-riser stair w/ copper handrail to the gallery
  },

  // ------------------------------------------------------- clubhouse & lounge
  // 隐逸居酒廊 — 280 ㎡, seats 60, folding glass to a terrace pool. WEDDING DINNER.
  //
  // ⚠ MOVED TO THE SUITE'S RIGHT, −X (Carl, 2026-08-01 — "pool + room-type
  // placement"). It used to sit at cx +46 with its pool at (+46, −8), i.e. on
  // your LEFT when you stand in the great room facing the pool, and that second
  // sheet of water plus the villa cluster around it was the first thing Carl
  // called out against the enclave aerial: **the presidential pool must be the
  // only pool visible from the suite.** In the aerial the teal-umbrella pool is
  // clearly on the RIGHT of the presidential pool and it is the water the two
  // Garden 3-BR keys look onto, so the lounge, its pool and both `type: 2`
  // villas moved together to −X.
  //
  // LEFT/RIGHT here is the SUITE'S, facing the pool = local +Z. player.js
  // builds fwd as (−sin yaw, 0, −cos yaw) and right as (cos yaw, 0, −sin yaw);
  // facing +Z is yaw = π, so right = (cos π, 0, −sin π) = (−1, 0, 0). LEFT is
  // +X, RIGHT is −X. Mirroring this sign just mirrors the complaint — it has
  // already been got backwards twice on this project.
  //
  // cx is pinned by two neighbours that may NOT move: SITE.PLAZA's west edge
  // (x −30; the lounge roof stops at −32) and the ceremony lawn's outer ring
  // path (LAWN.hedgeR + 3.8 = 27.8 m around (−75, −46); the lounge's NW roof
  // corner clears it by ~0.5 m). cz is pinned the same way — pushing the lounge
  // any further north walks its roof straight into that ring path.
  LOUNGE: { cx: -44, cz: -16, w: 20, d: 14, h: 4.2, glassZ: -9 },
  // same principle as the hero pool — it runs AWAY from the lounge's glass
  // wall, so from inside you look down its length, not across it. cz keeps the
  // 6 m terrace between the folding glass and the coping that the cocktail-hour
  // dressing (bar + high-tops) needs.
  LOUNGE_POOL: { cx: -44, cz: 6, w: 9, d: 18, umbrellas: 6 },     // teal umbrellas

  // ---------------------------------------------------------- circular lawn
  // Large hedge-ringed event lawn NW of the buildings. CEREMONY.
  // between the complex and the beach — the seaside lawn in the aerial
  LAWN: { cx: -75, cz: -46, r: 22, hedgeR: 24, palms: 18 },

  // -------------------------------------------------------------- villa cluster
  // The REAL room mix from the hotel's deck (reference/clubhouse-pdf-brief.md):
  // 11 keys total = 1 presidential suite + 5 Garden Rooms + 3 Garden Pool 2-BR
  // + 2 Garden 3-BR. The ten below are those ten guest keys.
  //   type 0 — 花园客房 Garden Room, 98 ㎡, SINGLE storey, internal soaking-tub
  //            light well (the small courtyards visible in the aerials)
  //   type 1 — 花园泳池双卧套房 Garden Pool 2-BR, 208 ㎡, single storey, walled
  //            private courtyard with an L-shaped plunge pool and a black stone
  //            water wall with THREE waterfall spouts
  //   type 2 — 花园三卧套房 Garden 3-BR, 168 ㎡, TWO storeys with an upper balcony
  // [x, z, rotationY, type] — THE ROOMS RING THE ATRIUM.
  //
  // Carl's correction (2026-08-01, second pass): these are not detached villas
  // on a lawn, they are the clubhouse's other room types, and **every one of
  // them is entered from the atrium courtyard**. So they wrap it on three arms
  // — west, north and east — making one dense interlocking complex exactly as
  // the enclave aerial shows. The ocean side (west/south-west) stays CLEAR of
  // buildings: standing at the clubhouse facing the sea there is nothing on
  // your left but lawn, pool and palms.
  //
  // Nothing may be placed at +Z beyond the pool deck again — that ground is
  // the view.
  // Carl's placement correction (2026-08-01, second half). Facing the pool is
  // local +Z, so RIGHT = −X and LEFT = +X (derived from player.js: at yaw = π,
  // right = (cos π, 0, −sin π) = (−1, 0, 0)).
  //   · the two 3-BEDROOM suites (type 2) sit to the RIGHT of the presidential
  //     suite, sharing LOUNGE_POOL which moved to −X with them
  //   · the three 2-BEDROOM POOL suites (type 1) sit BEHIND THE ATRIUM — in
  //     the aerial they read as walled courtyards with plunge pools on the far
  //     side of the courtyard from the suite
  //   · the five Garden Rooms (type 0) take what's left
  // Nothing may sit to the LEFT of the main pool: that view is the hero shot.
  VILLAS: [
    // 3-BR suites — right of the presidential suite, by their pool
    [-24, -14, 0.06, 2], [-26, -36, -0.05, 2],
    // 2-BR pool suites — the walled courtyards behind the atrium
    [-16, -70, 0.10, 1], [4, -70, -0.07, 1], [24, -70, 0.05, 1],
    // Garden Rooms
    [-26, -56, 0.08, 0], [44, -70, -0.10, 0], [52, -52, 0.09, 0],
    [66, -14, -0.06, 0], [66, -32, 0.11, 0],
  ],
  VILLA: {
    w: 13, d: 11, h: 3.6,          // type 0 footprint
    w2: 17, d2: 14, h2: 7.2,       // type 2, two storeys + balcony
    poolW: 7, poolD: 3.2,          // type 1 courtyard plunge pool
    courtW: 15, courtD: 9,         // type 1 walled courtyard
  },

  // ------------------------------------------------------------- lagoon pool
  // Big free-form resort pool, sand-coloured deck, blue umbrellas. On the site
  // map this is the serpentine that snakes between the villa fields toward the
  // hotel — so it sits east of the enclave, threaded through RESORT_VILLAS.
  LAGOON: { cx: 122, cz: 18, rx: 30, rz: 17, umbrellas: 10 },

  // --------------------------------------------------- the REST of the resort
  // Villas that are NOT part of Carl's package. On the site map they fill the
  // whole ground between the 隐逸居 enclave and the main hotel, and the enclave
  // reads as small precisely because these surround it. Backdrop only: no
  // interiors, no interactables, cheap geometry.
  // NOTE: these positions are WORLD coordinates — RESORT_VILLAS is backdrop and
  // is NOT part of the rotated enclave (see ENCLAVE below), so the keep-out
  // envelope here is the enclave's WORLD footprint after the transform, not the
  // enclave-local one. Post-rotation the enclave lives at roughly
  // x −90…30, z −70…118, which the grid (x ≥ 88) and the northern band
  // (z ≤ −128) already clear — the test is kept so a future move of ox/oz or a
  // wider field can't quietly drop villas on top of the clubhouse.
  RESORT_VILLAS: (() => {
    const out = [];
    const skip = (x, z) =>
      // keep clear of the lagoon basin and its deck
      (x > 84 && x < 160 && z > -6 && z < 42) ||
      // ...and of Carl's own enclave envelope, in WORLD coords (padded)
      (x < 40 && z > -80 && z < 128);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 5; c++) {     // capped so the field stops short of HOTEL
        const x = 88 + c * 20 + (r % 2) * 9;
        const z = -124 + r * 27;
        if (skip(x, z)) continue;
        out.push([x, z, ((r * 5 + c * 3) % 7) * 0.05 - 0.15]);
      }
    }
    // a northern band running back toward the beach, as on the map
    for (let c = 0; c < 6; c++) {
      out.push([-40 + c * 24, -128 - (c % 2) * 16, ((c * 4) % 5) * 0.06 - 0.12]);
    }
    return out;
  })(),

  // ---------------------------------------------------------- nature & context
  PALM_GROVE: { x0: -120, x1: -66, z0: -110, z1: 110, count: 150 },
  SCATTER_PALMS: 90,        // palms threaded through the whole campus
  BEACH: { x0: -160, x1: -118 },       // sand
  OCEAN: { x1: -160, size: 900, y: -0.55 },
  // main Westin crescent, far east — backdrop for fly mode
  // pushed east so its 95 m arc clears the RESORT_VILLAS field (which stops at
  // x ≈ 177) — the crescent is the skyline you fly toward, not a neighbour
  HOTEL: { cx: 285, cz: 10, r: 95, arc: 1.5, floors: 7, floorH: 3.6 },
  ROAD: { z: -95 },          // arrival road + parking, north edge

  GROUND: { size: 700 },     // lawn/ground plane extent

  // ------------------------------------------------------------------ limits
  // Soft world bounds for the walker (fly mode is clamped by CFG.FLY_MAX_ALT).
  BOUNDS: { x0: -150, x1: 250, z0: -130, z1: 120 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   ENCLAVE PLACEMENT — the 隐逸居 clubhouse as a rigid body
   ═══════════════════════════════════════════════════════════════════════════
   EVERYTHING above in SITE.* that belongs to the enclave (suite, deck, pool,
   cabanas, loungers, pergola, plaza, atrium, lounge, lounge pool, ceremony
   lawn, the ten guest villas) is authored in ENCLAVE-LOCAL coordinates, in the
   frame the six builder modules were written against: "the suite's glass wall
   faces south (+Z)", "the pool's long axis is Z", "the pavilion run marches
   along Z". None of that is rewritten. Instead world.js parents the enclave
   builders under ONE group carrying the transform below, so the whole clubhouse
   turns and moves as a unit.

   Everything else in SITE.* — LAGOON, RESORT_VILLAS, HOTEL, ROAD, BEACH,
   OCEAN, PALM_GROVE, GROUND, BOUNDS — is already WORLD space and does not move.

   Carl (2026-08-01, fourth pass): "rotate the enclave 90° clockwise and push it
   toward the bottom-left of the map." Clockwise, viewed top-down with +X drawn
   east/right and +Z drawn south/down, is a three.js Y-rotation of −π/2:

     x' = x·cosθ + z·sinθ  →  −z
     z' = −x·sinθ + z·cosθ →   x        (θ = −π/2 ⇒ cos 0, sin −1)

   Sanity check, don't take it on trust: EAST (1,0) ↦ (0,1) = SOUTH, and NORTH
   (0,−1) ↦ (1,0) = EAST. On the map that reads right→down and up→right, i.e.
   CLOCKWISE. ✔

   What it buys us: the suite's glass wall used to face SOUTH (+Z) at nothing.
   Facing +Z maps to (−1,0) = WEST — so after the turn the great room, its
   folding glass wall and the 25 m pool all look out over the palm grove to the
   beach and the open sea, exactly as the resort site map has it.

   ox/oz then slide the turned enclave into the map's SOUTH-WEST: −X toward the
   beach, +Z toward the bottom of the map. Chosen against three hard neighbours,
   none of which may move:
     · SITE.LAGOON     x 92…152, z 1…35   → enclave stops at x ≈ 30, 62 m clear
     · SITE.RESORT_VILLAS grid x ≥ 88, northern band z ≤ −128 → clear on both
     · SITE.ROAD       z ≈ −109…−88       → enclave starts at z ≈ −67, 21 m clear
   and two soft ones: SITE.BEACH.x1 = −118 (sand) — the enclave's west edge
   lands at x ≈ −85, so ~33 m of PALM_GROVE screens the pool from the sand, and
   SITE.BOUNDS.z1 = 120 — the southern villa arm stops at z ≈ 112.

   The resulting hero geometry: suite centre (−38, 34), pool centre (−67, 34)
   due west of it, atrium east at (−17, 42), 酒廊 lounge south at (−28, 80),
   ceremony lawn north at (−12, −41).
   ═══════════════════════════════════════════════════════════════════════════ */
export const ENCLAVE = {
  rotY: -Math.PI / 2,       // 90° CLOCKWISE seen from above
  ox: -58,                  // …then west toward the beach
  oz: 34,                   // …and south toward the bottom of the map
};

const _EC = Math.cos(ENCLAVE.rotY), _ES = Math.sin(ENCLAVE.rotY);

/** Enclave-local (x,z) → world (x,z). Same transform world.js gives the group,
 *  so anything that needs world coordinates (spawns, the intro path, colliders)
 *  agrees with the geometry to the last decimal. */
export function enclaveToWorld(x, z) {
  return {
    x: x * _EC + z * _ES + ENCLAVE.ox,
    z: -x * _ES + z * _EC + ENCLAVE.oz,
  };
}

/** The inverse — world (x,z) → enclave-local. */
export function worldToEnclave(x, z) {
  const dx = x - ENCLAVE.ox, dz = z - ENCLAVE.oz;
  return { x: dx * _EC - dz * _ES, z: dx * _ES + dz * _EC };
}

/** A heading authored in enclave space → the same heading in world space.
 *  player.js builds fwd as (−sin yaw, 0, −cos yaw); rotating that by θ gives
 *  (−sin(yaw+θ), 0, −cos(yaw+θ)), so the rotation is simply ADDED. */
export function enclaveYaw(yaw) { return yaw + ENCLAVE.rotY; }

/** Is this WORLD point inside the enclave's (pre-transform) envelope? Used by
 *  world.js to split colliders and campus.js's shared instance buckets, which
 *  mix enclave and backdrop content. Tested in ENCLAVE-LOCAL coordinates.
 *   · x ≥ 84  → the RESORT_VILLAS field (grid starts at x = 88) and the hotel
 *   · z ≤ −80 → the arrival road, its lamp posts, the northern villa band
 *   · the last clause carves out the parking apron's cars (z ≈ −78, x 40…80);
 *     no enclave part reaches below z = −77 at that x. */
export function isEnclaveLocal(x, z) {
  if (x >= 84 || z <= -80) return false;
  if (x > 36 && z < -77.4) return false;
  return true;
}

// Height of the ground at any point. Flat campus, sand slopes into the sea.
export function siteFloorY(x, z) {
  if (x < SITE.BEACH.x1) {
    const t = Math.min(1, (SITE.BEACH.x1 - x) / (SITE.BEACH.x1 - SITE.OCEAN.x1));
    return -t * t * 1.1;     // gentle beach slope down to the waterline
  }
  return 0;
}

// Spawn convention: yaw = 0 faces NORTH (-Z), yaw = π faces SOUTH (+Z).
// (player.js builds fwd as (-sin yaw, 0, -cos yaw) — verified, don't guess.)
//
// AUTHORED IN ENCLAVE-LOCAL SPACE, exactly like every SITE.* footprint above,
// then pushed through the enclave transform below. Keep editing the _LOCAL
// table — the exported MOMENT_PLACES is derived and must never be hand-tuned,
// or the spawns will silently disagree with the geometry.
const MOMENT_PLACES_LOCAL = {
  // inside the great room, looking out through the folded-open glass wall at
  // the lantern-lit pool — the shot the whole project exists for.
  // Fixed point of the 2026-08-01 interior mirror: the glass wall's open span
  // and the stone pier were moved to keep this walkable (suite.js GW.closedX1),
  // never the spawn — it is INTRO_PATH.land too, so the dive would miss.
  PREWEDDING: { x: 1, z: -18, yaw: Math.PI },
  // Standing at the BACK of the aisle looking north up it to the arch.
  // x tracks LAWN.cx (−75). z must sit behind the last row: moments.js lays
  // the chairs at LAWN.cz + 12 … + 8 (z −34…−38) and the arch at LAWN.cz − 8
  // (z −54), so anything in −34…−38 spawns you inside the seating.
  CEREMONY:   { x: -75, z: -30, yaw: 0 },
  COCKTAIL:   { x: -44, z: -4, yaw: Math.PI },  // lounge terrace, facing its pool
  // inside the lounge just in from the glass, looking NORTH up the room across
  // the six rounds to the head table (the tables sit at z −36…−30)
  DINNER:     { x: -44, z: -12, yaw: 0 },      // inside the lounge, looking up the room
  AFTERPARTY: { x: 0, z: -10, yaw: Math.PI },  // suite pool deck, DJ behind you
};

export const MOMENT_PLACES = Object.fromEntries(
  Object.entries(MOMENT_PLACES_LOCAL).map(([k, p]) => {
    const w = enclaveToWorld(p.x, p.z);
    return [k, { x: w.x, z: w.z, yaw: enclaveYaw(p.yaw) }];
  }),
);

// Where the opening drone orbit looks, and where the "STEP INSIDE" dive ends.
// Also enclave-local, also mapped. (CFG.INTRO's orbit CENTRE is a separate
// thing — introcam.js reads SITE.POOL.cx/cz straight, and that pair has to stay
// enclave-local because water.js builds the pool from it. See world.js.)
const INTRO_PATH_LOCAL = {
  lookAt: { x: 0, y: 3, z: -12 },              // the suite across its pool
  waypoint: { x: 0, y: 7.5, z: 4 },            // low over the water, aimed at the glass
  land: { x: 1, z: -18, yaw: Math.PI },        // the great room (= PREWEDDING)
};

export const INTRO_PATH = (() => {
  const look = enclaveToWorld(INTRO_PATH_LOCAL.lookAt.x, INTRO_PATH_LOCAL.lookAt.z);
  const way = enclaveToWorld(INTRO_PATH_LOCAL.waypoint.x, INTRO_PATH_LOCAL.waypoint.z);
  const land = enclaveToWorld(INTRO_PATH_LOCAL.land.x, INTRO_PATH_LOCAL.land.z);
  return {
    lookAt: { x: look.x, y: INTRO_PATH_LOCAL.lookAt.y, z: look.z },
    waypoint: { x: way.x, y: INTRO_PATH_LOCAL.waypoint.y, z: way.z },
    land: { x: land.x, z: land.z, yaw: enclaveYaw(INTRO_PATH_LOCAL.land.yaw) },
  };
})();
