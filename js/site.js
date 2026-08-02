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
    // interior partitions, all in world coords (see suite-interior-brief §4)
    diningX: -5.5,           // dining area centre X (west third)
    livingX: 1.0,            // living area centre X
    stairX: 6.0,             // black stair mass (east end of great room)
    pantry: { cx: -6.5, cz: -24.5, w: 4, d: 3.5 },   // NW corner
    spa:    { cx: 10.5, cz: -22.0, w: 7, d: 5 },     // east, off the corridor
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
  SIGN_PILLAR: { x: -9.5, z: -12.0 },            // dark "THE WESTIN" / "H" pillar
  EXT_STAIR: { x: -9.0, z: -16.0 },              // exterior stair to 2F balcony

  // event plaza — moved WEST of the deck: the east side is now the pavilion
  // and lounger run down the pool's long edge
  PLAZA: { x0: -32, x1: -12, z0: -14, z1: -2 },

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
  // cx sits east of the atrium (which reaches x = 30) — these two used to
  // interpenetrate by 4 × 9 m, so keep a real gap if either one is resized.
  LOUNGE: { cx: 46, cz: -30, w: 20, d: 14, h: 4.2, glassZ: -23 },
  // same principle as the hero pool — it runs AWAY from the lounge's glass
  // wall, so from inside you look down its length, not across it
  LOUNGE_POOL: { cx: 46, cz: -8, w: 9, d: 18, umbrellas: 6 },     // teal umbrellas

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
  VILLAS: [
    // west arm — along the arrival drive, looking out over the lawn to the sea
    [-30, -14, 0.06, 0], [-30, -32, -0.05, 1], [-30, -50, 0.08, 0],
    // north arm — the back of the complex, off the atrium's north gallery
    [-16, -70, 0.10, 0], [4, -70, -0.07, 2], [24, -70, 0.05, 0], [44, -70, -0.10, 1],
    // east arm — beyond the 酒廊 lounge
    [52, -52, 0.09, 2], [66, -14, -0.06, 0], [66, -32, 0.11, 1],
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
  RESORT_VILLAS: (() => {
    const out = [];
    const skip = (x, z) =>
      // keep clear of the lagoon basin and its deck
      (x > 84 && x < 160 && z > -6 && z < 42) ||
      // ...and of Carl's own enclave envelope
      (x < 78 && z > -105 && z < 66);
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
export const MOMENT_PLACES = {
  // inside the great room, looking out through the folded-open glass wall at
  // the lantern-lit pool — the shot the whole project exists for
  PREWEDDING: { x: 1, z: -18, yaw: Math.PI },
  CEREMONY:   { x: -48, z: -36, yaw: 0 },      // back of the aisle, facing the arch
  COCKTAIL:   { x: 46, z: -18, yaw: Math.PI }, // lounge terrace, facing the pool
  // inside the lounge just in from the glass, looking NORTH up the room across
  // the six rounds to the head table (the tables sit at z −36…−30)
  DINNER:     { x: 46, z: -26, yaw: 0 },
  AFTERPARTY: { x: 0, z: -10, yaw: Math.PI },  // suite pool deck, DJ behind you
};

// Where the opening drone orbit looks, and where the "STEP INSIDE" dive ends.
export const INTRO_PATH = {
  lookAt: { x: 0, y: 3, z: -12 },              // the suite across its pool
  waypoint: { x: 0, y: 7.5, z: 4 },            // low over the water, aimed at the glass
  land: { x: 1, z: -18, yaw: Math.PI },        // the great room (= PREWEDDING)
};
