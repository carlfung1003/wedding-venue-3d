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
    /* THE L-STAIR, in SITE (mirror-corrected) coordinates. Lived as a bag of
       literals inside suite.js until walkable stairs landed; the height field
       needs the same numbers, and two files deriving a staircase from two
       copies of the same magic numbers is exactly how the campus drifts apart.
       suite.js now builds `ST` from this through mx() — see §1a there.
         · 22 risers over floorToFloor: 8 up the lower flight (7 treads + the
           landing as the 8th riser), 14 up the upper one (13 treads + the 2F
           slab as the 14th).
         · the lower flight runs E→W in SITE terms: its foot is at
           x = landing.x1 + 7 × goLo and it climbs toward −X onto the landing.
         · the upper flight then climbs SOUTH (+Z) from the landing to zS,
           where it meets the 2F stair hall at floorToFloor. */
    stair: {
      x0: -8.0, x1: -4.2,        // the stair zone: envelope wall → 1.8 m inboard of stairX
      zN: -24.4, zS: -19.28,     // north face of the mass / top of the upper flight
      w: 1.2,                    // clear flight width
      goLo: 0.30, goUp: 0.29,    // going of each flight
      nLo: 8, nUp: 14,           // risers per flight (8 + 14 = 22)
      risers: 22,
      lx0: -7.95, lx1: -6.75,    // the quarter landing
      lzN: -24.25, lzS: -23.05,
    },
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
    coping: 0.55,            // stone band around the basin — the plinth's outer
                             // half-extent is w/2 + coping. water.js passes this
                             // literal to makeRectPool; it lives here now because
                             // the walkable height field needs the same rectangle.
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
  // exterior stair up the suite's flank. steps/tread/w/landing mirror the
  // literals campus.js's buildExtStair() still carries — the walkable height
  // field reads them from here, and campus.js should read them too the next
  // time that file is open (it was owned by another agent when this landed).
  EXT_STAIR: {
    x: 9.0, z: -16.0,
    steps: 19, tread: 0.30, w: 1.6,   // 19 × 0.2 m risers = SUITE.floorToFloor
    landingW: 2.1, landingD: 2.0, landingBack: 0.4, landingY: 3.80,
  },

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
    slabT: 0.35,             // gallery slab thickness (deck top → soffit below)
    // open-riser stair w/ copper handrail up to the 2F gallery. It rises NORTH
    // (−Z) from the court floor; `footOff` places its foot clear of pond A's
    // north edge, and `wellPad`/`wellZ1` size the stairwell void punched
    // through the 2F deck. atrium.js derives its STAIR/WELL from these.
    stair: { x: -8, z: -47, w: 1.6, risers: 16, going: 0.45,
      footOff: 3.1, wellPad: 1.0, wellZ1: -42.5 },
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
  // `plinth` + the pad/step numbers mirror campus.js's buildLounge() locals
  // (PL = .34, the plinth box pushed +0.5 x / +0.3 z and 2.4 × 3.0 m proud of
  // the walls, then two terrace steps down to the paving). They live here now
  // because the walkable height field has to stand the player ON that plinth —
  // the DINNER spawn is inside it. campus.js should read them when next open.
  LOUNGE: { cx: -44, cz: -16, w: 20, d: 14, h: 4.2, glassZ: -9,
    plinth: 0.34, plinthPadX: 2.4, plinthPadZ: 3.0, plinthOffX: 0.5, plinthOffZ: 0.3,
    step2Y: 0.16, step2Z0: 1.0, step2Z1: 1.9 },   // step Zs are offsets from glassZ
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

  // ------------------------------------------------------- THE RESORT RIVER
  // The Westin's serpentine lazy-river system, read straight off
  // reference/photos/river-lazy-river-detail.png (Carl's crop) and the site
  // map. West → east, exactly the order the aerial gives it:
  //
  //   WEST   a big free-form CIRCULAR POOL, sand deck, a round island bar on
  //          its south-west rim, ringed by palms
  //   SPINE  a long narrow LAZY RIVER snaking east out of it — widening and
  //          narrowing, doubling back on itself twice, crossed by little
  //          timber footbridges. This is the dominant feature and it is LONG
  //          (~90 m of centreline across ~46 m of ground).
  //   MID    a small round basin where the river bulges, with its own deck
  //   LAGOON the broad organic basin it opens into, with a planted island
  //   SPUR   a hairpin channel back out of the basin, north then east
  //   EAST   a circular pool with a central round feature — the one nearest
  //          the hotel
  //
  // WORLD coordinates. The river is resort backdrop and is NOT part of the
  // rotated 隐逸居 enclave: it must never be routed through enclaveToWorld,
  // and water.js keeps the whole system in one group whose bounding-box
  // centre sits east of x = 84 so world.js's adoptWater() leaves it alone.
  //
  // Routing envelope, checked against the neighbours that may not move:
  //   · RESORT_VILLAS  villa rows at z = −16 and z = 65 (x 88…177), plus the
  //     two strays at (177, 11) and (168, 38) → the free corridor is
  //     x 54…160, z −4…52. Every basin and bank below sits inside it.
  //   · the enclave's world footprint stops at x ≈ 20 → the west pool's deck
  //     starts at x ≈ 54, leaving ~34 m of palm grove between them
  //   · HOTEL's podium reaches x ≈ 248 at the crescent tips → ~90 m clear
  //   · ROAD at z = −95 → ~95 m clear
  //
  // Geometry note: SPINE/SPUR are CENTRELINES, [x, z, halfWidth]. water.js
  // runs a centripetal Catmull-Rom through them and carries the half-width in
  // the curve's unused Y channel, so the width interpolates as smoothly as the
  // path does. Basins are star-shaped free-form outlines (a seeded sum of low
  // harmonics on an ellipse) built as radial fans, so they have interior
  // vertices to carry the shallow→deep colour ramp.
  RIVER: {
    DEPTH: 1.05,          // how far the edge skirt reaches below the water
    // ⚠ EVERY river surface sits ABOVE the datum, water included. nature.js's
    // lawn is one opaque 700 m sheet at y = 0 that runs under the whole
    // resort, so a pool surface at the natural −60 mm is simply BURIED — which
    // is what happened to the old SITE.LAGOON: its "water" never rendered and
    // what read as a pool from the air was only its sand deck. The 25 mm the
    // deck stands over the water does all the work the sign of that number
    // used to; the edge skirt supplies the depth.
    WATER_Y: .020,        // channel water
    BASIN_Y: .045,        // basin water — wins the overlap where a channel
                          // runs into a basin (both opaque, so no blending)
    DECK_Y: .075,         // sand deck
    COPE_Y: .105,         // dark coping lip
    PATH_Y: .060,
    COPING: .35,          // width of the coping lip at every water edge
    BANK: .55,            // pale sand apron beside a channel — narrow on
                          // purpose: in the reference the lazy river is cut
                          // straight through planting, not through a beach

    // ── the west end: a big free-form circular pool with a round island bar
    WEST: { cx: 65, cz: 22, r: 12.0, deck: 4.2, umbrellas: 9 },
    BAR:  { cx: 56.5, cz: 32.5, r: 5.0, h: 3.4 },

    // ── THE LAZY RIVER. ~128 m of centreline over 57 m of ground: five full
    // reversals, three of them proper hairpins, exactly the scribble the
    // aerial shows. The width breathes with it — 1.5 m half-width in the tight
    // turns (a real lazy river is 3–4 m across), 5.2 m as it spills into the
    // lagoon. Keep it NARROW: the first pass ran 2.2–2.6 and the loops read
    // as a chain of ponds rather than one long river.
    SPINE: [
      [ 74.0, 25.0, 3.2],   // outfall, inside the west pool's south-east rim
      [ 78.5, 30.0, 2.6],
      [ 84.0, 32.5, 2.1],
      [ 89.0, 30.0, 1.8],
      [ 90.5, 24.0, 1.9],
      [ 87.5, 18.5, 1.7],   // hairpin 1 — the river turns back on itself
      [ 90.5, 13.5, 1.5],
      [ 96.0, 11.5, 1.6],   // the northern extreme
      [100.5, 14.0, 1.8],
      [102.0, 20.0, 2.0],
      [100.0, 26.0, 1.8],   // hairpin 2
      [101.5, 31.5, 1.9],
      [107.0, 34.5, 2.1],   // the southern extreme
      [111.5, 33.0, 2.0],
      [115.0, 26.5, 2.2],   // …through the MID basin
      [113.0, 20.5, 1.9],   // hairpin 3
      [115.5, 15.0, 1.8],
      [120.0, 14.5, 2.1],
      [124.5, 19.0, 2.5],
      [126.5, 24.0, 3.2],
      [128.0, 30.0, 4.2],
      [131.0, 33.5, 5.2],   // …and it is inside LAGOON by here
    ],
    MID: { cx: 115.0, cz: 26.0, r: 4.4, deck: 2.0 },

    // ── the hairpin back out of the lagoon's north rim to the east pool
    SPUR: [
      [134.0, 25.0, 3.6],
      [133.5, 18.5, 2.4],
      [136.0, 12.0, 2.1],
      [141.0,  9.0, 2.2],
      [145.5, 11.5, 2.8],   // …into the east pool
    ],

    EAST: { cx: 147, cz: 13, r: 7.8, deck: 3.2, islandR: 3.1, umbrellas: 7 },

    // the lagoon's planted island, as a fraction of LAGOON.rx / .rz
    ISLAND: { dx: .24, dz: .18, r: 3.4 },

    // footbridges, as [which centreline, t along it 0…1]
    BRIDGES: [['spine', .13], ['spine', .37], ['spine', .61], ['spine', .85], ['spur', .50]],

    // pale walking paths — control points only, water.js smooths them
    PATHS: [
      [[62, 6], [76, 4], [90, 5.5], [104, 3.5], [118, 5.5], [130, 3.0],
       [142, 2.0], [152, 5.0], [157, 12], [154, 20]],
      [[55, 40], [68, 44], [82, 41], [96, 44], [110, 41], [122, 44],
       [134, 46], [145, 42], [151, 33], [150, 24]],
    ],
    PATH_W: 1.3,          // half-width of a path
    LAMPS: 22,            // path lanterns — the night silhouette
  },

  // LAGOON is the river's big eastern basin. It KEEPS ITS NAME because
  // nature.js reads SITE.LAGOON.{cx,cz,rx,rz} as a palm keep-out disc — the
  // one footprint in the system big enough that the bank colliders alone
  // wouldn't stop a palm landing mid-water. Everything else in the river is
  // kept palm-free by the collider chains water.js lays down its centrelines.
  LAGOON: { cx: 134, cz: 33, rx: 12, rz: 9.5, deck: 2.8, umbrellas: 8 },

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
  HOTEL: { cx: 285, cz: 10, r: 95, arc: 1.5, floors: 7, floorH: 3.6,
    // ── the rooftop infinity pool + brunch terrace (Carl & Rachel, 2027-03-18)
    // Radii are measured from the crescent's ARC CENTRE (cx − r, cz) = (190, 10),
    // the frame buildHotel()/buildHotelRoof() work in; angles are half-widths in
    // radians about the crescent's centre bearing (θ = π/2, i.e. due east of the
    // arc centre). Smaller radius = WEST = the concave, sea-facing side, so the
    // infinity edge is the pool's INNER radius and spills toward the horizon.
    ROOFTOP: {
      roofY: 25.2,       // floors × floorH — top of the crescent / green roof cap
      deckY: 26.6,       // WALKABLE terrace surface (a 1.4 m plinth over the cap)
      waterY: 26.52,     // pool surface, 80 mm below the coping
      basinY: 25.32,     // pool floor → 1.20 m of water
      parapetH: 1.15,    // frameless glass balustrade, above deckY
      arcHalf: 0.62,     // terrace half-angle (crescent itself is arc/2 = 0.75)
      rIn: 90.0,         // terrace inner edge = top of the leaning inner facade
      rOut: 103.2,       // terrace outer edge; the green roof cap runs on to 106
      poolArcHalf: 0.36, // ~68 m of water along the curve
      poolIn: 90.9,      // THE INFINITY EDGE — spills west, toward the sea
      poolOut: 96.4,     // pool back wall → 5.5 m across
      loungeR: 98.2,     // the lounger row, facing the drop
      gardenR: 101.5,    // cabanas · planters · the bar pavilion
      barArcHalf: 0.075, // rooftop bar, on the crescent's centreline
      barH: 3.2,         // bar pavilion clear height above deckY
      coreArcHalf: 0.50, // the two stair/lift head-houses
    },
  },
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

const _EC = Math.cos(ENCLAVE.rotY), _XS = Math.sin(ENCLAVE.rotY);

/** Enclave-local (x,z) → world (x,z). Same transform world.js gives the group,
 *  so anything that needs world coordinates (spawns, the intro path, colliders)
 *  agrees with the geometry to the last decimal. */
export function enclaveToWorld(x, z) {
  return {
    x: x * _EC + z * _XS + ENCLAVE.ox,
    z: -x * _XS + z * _EC + ENCLAVE.oz,
  };
}

/** The inverse — world (x,z) → enclave-local. */
export function worldToEnclave(x, z) {
  const dx = x - ENCLAVE.ox, dz = z - ENCLAVE.oz;
  return { x: dx * _EC - dz * _XS, z: dx * _XS + dz * _EC };
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

/* ═══════════════════════════════════════════════════════════════════════════
   THE WALKABLE HEIGHT FIELD — floorY grows a second storey
   ═══════════════════════════════════════════════════════════════════════════
   CLAUDE.md has promised since day one that floorY(x,z) is the single source of
   ground truth and that "stage steps, terrace decks and ramps must be expressed
   there". Until 2026-08-02 it returned 0 everywhere but the beach, so every
   staircase, deck and plinth on this campus was geometry the player slid
   straight through — which is why walking up the suite's stair did nothing.

   ── the registry ────────────────────────────────────────────────────────────
   WALK_REGIONS is a flat list of walkable surfaces. Two shapes:

     rect(id, x0, z0, x1, z1, y, opts)                     a flat platform
     ramp(id, x0, z0, x1, z1, axis, a0, y0, a1, y1, opts)  a stair or slope

   A ramp's height is a linear interpolation along `axis` ('x' or 'z') between
   a0→y0 and a1→y1, CLAMPED outside that span, so the ends are flat lips rather
   than cliffs. opts:
     · ceil   absolute Y of whatever roofs this surface (default ∞). Only used
              by the headroom gate below.
     · t      slab thickness — the surface's own UNDERSIDE is y − t, which is
              the ceiling for anything standing under it (default SLAB_T).
     · holes  [{x0,z0,x1,z1}] cut out of the footprint (a stair void, a pool
              basin). A point inside a hole is not on the region at all.
     · world  true if the footprint is authored in WORLD coordinates.

   ── the frame ───────────────────────────────────────────────────────────────
   floorY is called with WORLD coordinates (the player's position), but every
   footprint on this campus is authored ENCLAVE-LOCAL, because SITE.* is and the
   whole clubhouse is re-parented under a rotated group. So the QUERY POINT is
   mapped through worldToEnclave() once per call and the regions stay in the
   frame they were authored in — get this backwards and the stairs end up 90 m
   away. Backdrop content outside the enclave (the hotel crescent's rooftop
   terrace, say) sets `world: true` and is tested against the raw point.

   ── the resolution rule ─────────────────────────────────────────────────────
   Regions overlap on purpose: the suite's 2F floor sits directly above its 1F.
   Returning max() would teleport the player onto the roof on the first frame,
   so the query is RELATIVE TO THE FEET:

     1. Collect every surface at (x,z): the terrain, plus each region's height.
     2. Keep the ones at or below `fromY + stepUp` — the surfaces the player can
        actually reach by stepping up. Everything higher is a ceiling, not a
        floor, and is ignored.
     3. Answer with the HIGHEST of those, i.e. the thing you are standing on.
     4. Headroom gate — a genuine step UP is refused unless the space above the
        new surface is at least `headClear` tall, where the ceiling is the lower
        of the region's own `ceil` and the underside of any surface above it.
        Rejected candidates fall through to the next one down. Standing still is
        never refused: you can be somewhere cramped, you just cannot climb into
        it. This is the "entered from below" rule CLAUDE.md asked for.
     5. If nothing is reachable (the player is under everything), answer with the
        LOWEST surface, so a fall always has a floor.

   Walking up the stair therefore happens for free: the ramp lifts the feet
   tread by tread, and only when they are within stepUp of 3.8 does the 2F floor
   become eligible. Standing in the great room at y = 0 it never is.          */

const SLAB_T = 0.32;          // default platform thickness (→ underside)
/* CFG owns the real tuning (house rule) but config.js imports THIS file, so
   site.js must not import CFG back. world.js — which imports both — injects
   CFG.STEP_UP / CFG.HEAD_CLEAR into every in-game call; these defaults exist
   only for direct callers (tests, the console). Keep them in step with CFG. */
const DEF_STEP_UP = 0.4;
const DEF_HEAD_CLEAR = 1.8;

function rect(id, x0, z0, x1, z1, y, o = {}) {
  return {
    id, y, axis: null,
    x0: Math.min(x0, x1), x1: Math.max(x0, x1),
    z0: Math.min(z0, z1), z1: Math.max(z0, z1),
    ceil: o.ceil === undefined ? Infinity : o.ceil,
    t: o.t === undefined ? SLAB_T : o.t,
    holes: o.holes || null,
    world: !!o.world,
  };
}

function ramp(id, x0, z0, x1, z1, axis, a0, y0, a1, y1, o = {}) {
  const r = rect(id, x0, z0, x1, z1, y0, o);
  r.axis = axis; r.a0 = a0; r.a1 = a1; r.ry0 = y0; r.ry1 = y1;
  return r;
}

/* ── a THIRD shape: the annular sector ───────────────────────────────────────
   Added 2026-08-02 for the Westin crescent's rooftop terrace, which is a curved
   annulus with a pool-shaped hole in it. Approximating that with one rect would
   have put walkable floor 12 m out over the edge of the building at both ends,
   which on a 26.6 m roof is not a rounding error.

   Everything polar is measured from an ARC CENTRE (cx, cz) in the same frame
   campus.js's buildHotel works in, and bearings follow the house convention
   three.js's CylinderGeometry sets: dir(θ) = (sin θ, cos θ), so

     x = cx + sin θ · r,  z = cz + cos θ · r,  θ = atan2(x − cx, z − cz)

   `tc` is the sector's CENTRE bearing and `th` its half-width in radians — a
   centre/half-width pair rather than start/end because the wrap test is then one
   subtraction, and the whole thing is queried every frame.

     annulus(id, cx, cz, r0, r1, tc, th, y, opts)
     annRamp (id, cx, cz, r0, r1, tc, th, ry0, ry1, opts)   ramps ALONG RADIUS

   annRamp is what makes the stair tower possible: a flight whose treads march
   radially is just a linear height in r, and its landings are flat annuli, so
   the whole nine-flight switchback is eleven of these and nothing else.

   `aholes: [{r0, r1, tc, th}]` punches polar holes — the pool out of the deck.
   All annuli are WORLD-space (the crescent is not part of the enclave). */
function annulus(id, cx, cz, r0, r1, tc, th, y, o = {}) {
  return {
    id, y, axis: null, ann: true,
    cx, cz, r0, r1, tc, th,
    x0: cx - r1, x1: cx + r1, z0: cz - r1, z1: cz + r1,   // cheap bbox reject
    ceil: o.ceil === undefined ? Infinity : o.ceil,
    t: o.t === undefined ? SLAB_T : o.t,
    holes: null, aholes: o.aholes || null,
    world: true,
  };
}

function annRamp(id, cx, cz, r0, r1, tc, th, ry0, ry1, o = {}) {
  const r = annulus(id, cx, cz, r0, r1, tc, th, ry0, o);
  r.axis = 'r'; r.a0 = r0; r.a1 = r1; r.ry0 = ry0; r.ry1 = ry1;
  return r;
}

/** Signed, wrapped angular offset of a bearing from a sector centre. */
function dTh(th, tc) {
  let d = th - tc;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/* ── the suite, in SITE (mirror-corrected) coordinates ── */
const _SU = SITE.SUITE, _ST = _SU.stair;
const _SX0 = _SU.cx - _SU.w / 2, _SX1 = _SU.cx + _SU.w / 2;   //  -8 …  8
const _SZS = _SU.glassWallZ, _SZN = _SZS - _SU.d;             // -13.5 … -26.5
const _YF2 = _SU.floorToFloor;                                //  3.8  2F finished floor
const _Y2C = _YF2 + _SU.floor2H;                              //  6.8  2F ceiling
const _RISE = _YF2 / _ST.risers;                              //  0.1727
const _LANDY = _ST.nLo * _RISE;                               //  1.3818  quarter landing
const _FOOTX = _ST.lx1 + (_ST.nLo - 1) * _ST.goLo;            // -4.65   bottom nosing

/* ── the atrium ── */
const _A = SITE.ATRIUM, _AS = _A.stair;
const _AX0 = _A.cx - _A.w / 2, _AX1 = _A.cx + _A.w / 2;
const _AZ0 = _A.cz - _A.d / 2, _AZ1 = _A.cz + _A.d / 2;
const _ACX0 = _A.cx - _A.courtW / 2, _ACX1 = _A.cx + _A.courtW / 2;
const _ACZ0 = _A.cz - _A.courtD / 2, _ACZ1 = _A.cz + _A.courtD / 2;
const _AH1 = _A.floorH, _AH2 = _A.floorH * _A.floors;
const _ASTZ0 = _AS.z + _AS.footOff;                        // -43.9 foot of the flight
const _ASTZ1 = _ASTZ0 - _AS.risers * _AS.going;            // -51.1 top, at 2F deck
const _AWELL = { x0: _AS.x - _AS.wellPad, x1: _ACX0, z0: _ASTZ1, z1: _AS.wellZ1 };

/* ── the lounge plinth ── */
const _LO = SITE.LOUNGE;
const _LOX = _LO.cx + _LO.plinthOffX, _LOZ = _LO.cz + _LO.plinthOffZ;
const _LOW = (_LO.w + _LO.plinthPadX) / 2, _LOD = (_LO.d + _LO.plinthPadZ) / 2;

/* ── the exterior stair ── */
const _ES = SITE.EXT_STAIR;
const _XSRUN = _ES.steps * _ES.tread;
const _XSZ0 = _ES.z + _XSRUN / 2;                          // -13.15 foot (south)
const _XSZ1 = _XSZ0 - _XSRUN + _ES.tread;                  // -18.55 top tread
const _XSLX = _ES.x - Math.sign(_ES.x) * _ES.landingBack;  //   8.6  landing centre

/* ── the pool ── */
const _P = SITE.POOL;
const _PPX = _P.w / 2 + _P.coping, _PPZ = _P.d / 2 + _P.coping;

/* ═══════════════════════════════════════════════════════════════════════════
   THE WESTIN ROOFTOP — the derived frame everything up there shares
   ═══════════════════════════════════════════════════════════════════════════
   SITE.HOTEL.ROOFTOP publishes the section (deckY, waterY, basinY, radii, arc
   half-widths). What it does NOT publish is the arc centre those radii are
   measured from, the bearing convention, or where the stair is — and three
   files now need all three (site.js registers the walkable surfaces, campus.js
   builds the geometry and the colliders, moments.js dresses the brunch and
   spawns on it). So it is derived ONCE, here, and exported.

   Read HOTEL_ROOF; do not re-derive `cx − r` in a builder. That is the same
   rule SITE.* has always had, one level down.

   The stair: a nine-flight switchback in a detached tower on the crescent's
   INLAND face, linked to the terrace by a bridge at deck level. Inland because
   the alternative — the concave, sea-facing side — would have run a bridge
   straight across the infinity edge, which is the one view the venue exists
   for. It costs the walker a lap around the end of the crescent to reach the
   door (the tower stands clear of the coarse collider ring, which spans r
   81…109); the Welcome Brunch therefore spawns on the roof rather than making
   anyone do that. Both routes are real — see CLAUDE.md. */
const _H = SITE.HOTEL, _R = _H.ROOFTOP;
const _RC = Math.PI / 2;                       // the crescent's centre bearing

const _TW_TH = _RC + 0.575;                    // stair tower bearing: clear of the
                                               // head-house at ±0.50 and of the
                                               // terrace end at ±arcHalf
const _TW_R0 = 110.2, _TW_R1 = 118.2;          // tower footprint, radially
const _TW_LR = _TW_R0 + 1.2;                   // inner (low-r) landing ends here
const _TW_HR = _TW_R1 - 1.2;                   // outer (high-r) landing starts here
const _TW_HALF = 2.2;                          // interior half-width, metres
const _TW_FL = 9;                              // flights, ground → deckY
const _TW_RISE = _R.deckY / _TW_FL;            // 2.9556 m per flight

/* metres of tangential offset → radians, at the tower's mid radius */
const _tw = v => v / ((_TW_R0 + _TW_R1) / 2);

export const HOTEL_ROOF = {
  cx: _H.cx - _H.r, cz: _H.cz,                 // ARC CENTRE — (190, 10)
  C: _RC,
  /** polar → world, the one conversion every rooftop coordinate goes through */
  pt(th, r) { return { x: this.cx + Math.sin(th) * r, z: this.cz + Math.cos(th) * r }; },
  /** the yaw that faces the arc centre — i.e. the infinity edge and the sea */
  inward(th) { return th; },
  tower: {
    th: _TW_TH, r0: _TW_R0, r1: _TW_R1, lr: _TW_LR, hr: _TW_HR,
    half: _TW_HALF, halfRad: _tw(_TW_HALF), flights: _TW_FL, rise: _TW_RISE,
    /* the two flights sit either side of a central spine; A descends in r
       (odd flights), B climbs in r (even) */
    aTc: _TW_TH - _tw(1.15), aTh: _tw(0.85),
    bTc: _TW_TH + _tw(1.15), bTh: _tw(0.85),
    bridgeTh: _tw(1.5),                        // link bridge half-width
    bridgeR0: _R.rOut - 0.6, bridgeR1: _TW_R0 + 0.4,
  },
};

/* the nine flights + ten landings, generated rather than typed out */
function _towerRegions() {
  const T = HOTEL_ROOF.tower, cx = HOTEL_ROOF.cx, cz = HOTEL_ROOF.cz, out = [];
  for (let k = 1; k <= T.flights; k++) {
    const yLo = (k - 1) * T.rise, yHi = k * T.rise;
    const A = k % 2 === 1;                     // odd flights descend in radius
    out.push(annRamp(`hotel-stair-${k}`, cx, cz, T.lr, T.hr,
      A ? T.aTc : T.bTc, A ? T.aTh : T.bTh,
      A ? yHi : yLo, A ? yLo : yHi));          // ry0 is at r0 (= lr), ry1 at r1
  }
  for (let k = 0; k < T.flights; k++) {
    const y = (k + 1) * T.rise;
    // odd flight k+1 ENDS on the inner landing; even flights end on the outer
    if (k % 2 === 0) out.push(annulus(`hotel-stair-landing-lo${k}`, cx, cz, T.r0, T.lr, T.th, T.halfRad, y));
    else out.push(annulus(`hotel-stair-landing-hi${k}`, cx, cz, T.hr, T.r1, T.th, T.halfRad, y));
  }
  // the ground floor, at the outer end: this is the door
  out.push(annulus('hotel-stair-ground', cx, cz, T.hr, T.r1, T.th, T.halfRad, 0));
  return out;
}

export const WALK_REGIONS = [
  /* ══ the presidential suite ═══════════════════════════════════════════════
     The 2F is THREE rects, not one, because suite.js cuts the slab open over
     the stair (buildShell) — authoring the hole here as geometry rather than as
     a `holes` entry keeps the two descriptions of the same slab side by side. */
  rect('suite-2f-lounge', _ST.x1, _SZN, _SX1, _SZS, _YF2, { ceil: _Y2C }),
  rect('suite-2f-north', _SX0, _SZN, _ST.x1, _ST.zN, _YF2, { ceil: _Y2C }),
  rect('suite-2f-hall', _SX0, _ST.zS, _ST.x1, _SZS, _YF2, { ceil: _Y2C }),
  // the balcony slab is 20 mm below the finished floor, under the deep roof
  rect('suite-balcony', _SX0 + .5, _SZS, _SX1 - .5, _SZS + _SU.balconyD, _YF2 - .02,
    { ceil: _Y2C }),
  // lower flight: climbs from the great-room floor toward −X onto the landing
  ramp('suite-stair-lower', _ST.lx1, _ST.lzN, _FOOTX, _ST.lzS, 'x',
    _FOOTX, 0, _ST.lx1, _LANDY),
  rect('suite-stair-landing', _ST.lx0, _ST.lzN, _ST.lx1, _ST.lzS, _LANDY),
  // upper flight: climbs SOUTH from the landing to the 2F stair hall
  ramp('suite-stair-upper', _ST.lx0, _ST.lzS, _ST.lx1, _ST.zS, 'z',
    _ST.lzS, _LANDY, _ST.zS, _YF2),

  /* ══ the exterior stair up the suite's flank ══════════════════════════════
     Built by campus.js; registered here by coordinate alone. Its landing is a
     dead end today — the suite's facade is solid at 2F on that side — see the
     note in CLAUDE.md. */
  ramp('ext-stair', _ES.x - _ES.w / 2, _XSZ1, _ES.x + _ES.w / 2, _XSZ0, 'z',
    _XSZ0, 0, _XSZ1, _YF2),
  rect('ext-stair-landing',
    _XSLX - _ES.landingW / 2, _XSZ1 - _ES.landingD - .35,
    _XSLX + _ES.landingW / 2, _XSZ1 + .2, _ES.landingY),

  /* ══ deck · turf · the hero pool ═════════════════════════════════════════
     The deck and the turf band ARE at datum (water.js lays the pavers 4 mm
     under it), so this rect changes nothing today — it is here so that raising
     the terrace is a one-number edit rather than a new subsystem. The plinth
     is the real step: 0.45 m of black stone with the basin cut out of it. */
  rect('pool-deck', -SITE.DECK.w, SITE.DECK.z0, SITE.DECK.w,
    _P.cz + _P.d / 2 + 3.4, 0),
  rect('pool-plinth', _P.cx - _PPX, _P.cz - _PPZ, _P.cx + _PPX, _P.cz + _PPZ, _P.plinth,
    { holes: [{ x0: _P.cx - _P.w / 2, x1: _P.cx + _P.w / 2,
      z0: _P.cz - _P.d / 2, z1: _P.cz + _P.d / 2 }] }),

  /* ══ the atrium's upper gallery ══════════════════════════════════════════
     The ring (envelope minus court) at 3.6 m, minus the stairwell void — which
     is exactly the seven slabs atrium.js builds, expressed as four runs and one
     hole. Ceiling is the 2F soffit. */
  rect('atrium-2f-n', _AX0, _AZ0, _AX1, _ACZ0, _AH1, { ceil: _AH2 - _A.slabT, t: _A.slabT, holes: [_AWELL] }),
  rect('atrium-2f-s', _AX0, _ACZ1, _AX1, _AZ1, _AH1, { ceil: _AH2 - _A.slabT, t: _A.slabT }),
  rect('atrium-2f-w', _AX0, _ACZ0, _ACX0, _ACZ1, _AH1, { ceil: _AH2 - _A.slabT, t: _A.slabT, holes: [_AWELL] }),
  rect('atrium-2f-e', _ACX1, _ACZ0, _AX1, _ACZ1, _AH1, { ceil: _AH2 - _A.slabT, t: _A.slabT }),
  // the open-riser flight, rising north out of the court onto that gallery
  ramp('atrium-stair', _AS.x - _AS.w / 2, _ASTZ1, _AS.x + _AS.w / 2, _ASTZ0, 'z',
    _ASTZ0, 0, _ASTZ1, _AH1),

  /* ══ the 隐逸居 lounge — WEDDING DINNER ═══════════════════════════════════
     The room sits on a 0.34 m plinth and the DINNER spawn is inside it, so
     without this the player stands shin-deep in the marble. Two steps down to
     the terrace paving on the south side. */
  rect('lounge-plinth', _LOX - _LOW, _LOZ - _LOD, _LOX + _LOW, _LOZ + _LOD, _LO.plinth,
    { ceil: _LO.plinth + _LO.h }),
  rect('lounge-step', _LO.cx - (_LO.w + 3.6) / 2, _LO.glassZ + _LO.step2Z0,
    _LO.cx + (_LO.w + 3.6) / 2, _LO.glassZ + _LO.step2Z1, _LO.step2Y),

  /* ══ THE WESTIN ROOFTOP TERRACE — WELCOME BRUNCH ═══════════════════════════
     WORLD space, and the first curved surfaces in the registry. The deck is the
     whole annulus with the pool punched out of it; the pool answers as its own
     BASIN, so walking in leaves you standing in 1.2 m of water with your head
     above it, not skating across the surface.

     Getting back out is the submerged steps campus.js already builds at each
     end of the water. Two deliberate 2 cm lies about them, both under water and
     both load-bearing:
       · the treads are modelled 0.40 apart, which is CFG.STEP_UP to the last
         bit — and `_h[i] > fromY + stepUp` is a strict comparison, so an exact
         0.40 rounds the wrong way and the swimmer is trapped. Registered at
         0.38 the climb is unambiguous.
       · the top tread's outer radius is stretched to poolOut so it meets the
         deck; without it you climb all three and fall straight back in. */
  annulus('hotel-roof-deck', HOTEL_ROOF.cx, HOTEL_ROOF.cz, _R.rIn, _R.rOut,
    _RC, _R.arcHalf, _R.deckY,
    { aholes: [{ r0: _R.poolIn, r1: _R.poolOut, tc: _RC, th: _R.poolArcHalf }] }),
  annulus('hotel-roof-pool', HOTEL_ROOF.cx, HOTEL_ROOF.cz, _R.poolIn, _R.poolOut,
    _RC, _R.poolArcHalf, _R.basinY),
  ...[-1, 1].flatMap(s => [0, 1, 2].map(k => annulus(
    `hotel-pool-step-${s > 0 ? 'e' : 'w'}${k}`, HOTEL_ROOF.cx, HOTEL_ROOF.cz,
    _R.poolOut - 1.925 + k * 0.55, k === 2 ? _R.poolOut : _R.poolOut - 1.375 + k * 0.55,
    _RC + s * (_R.poolArcHalf - 0.022), 1.3 / 95,
    _R.basinY + (k + 1) * 0.38))),

  /* the link bridge, then the stair tower: nine flights and ten landings from
     grade to deckY, generated by _towerRegions() */
  annulus('hotel-roof-bridge', HOTEL_ROOF.cx, HOTEL_ROOF.cz,
    HOTEL_ROOF.tower.bridgeR0, HOTEL_ROOF.tower.bridgeR1,
    HOTEL_ROOF.tower.th, HOTEL_ROOF.tower.bridgeTh, _R.deckY),
  ..._towerRegions(),
];

/* Terrain only — the flat campus with sand sloping into the sea. This is what
   floorY answers when nobody says where the feet are (prop placement, the fly
   clamp), and it is the bottom candidate of every height-field query. */
export function siteGroundY(x, z) {
  if (x < SITE.BEACH.x1) {
    const t = Math.min(1, (SITE.BEACH.x1 - x) / (SITE.BEACH.x1 - SITE.OCEAN.x1));
    return -t * t * 1.1;     // gentle beach slope down to the waterline
  }
  return 0;
}

/** Surface height of one region at a point, or null if the point misses it. */
function regionY(r, x, z) {
  if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) return null;   // bbox, both shapes
  let a;                                     // the ramp parameter, if it is one
  if (r.ann) {
    const dx = x - r.cx, dz = z - r.cz;
    const rr = Math.sqrt(dx * dx + dz * dz);
    if (rr < r.r0 || rr > r.r1) return null;
    const th = Math.atan2(dx, dz);
    if (Math.abs(dTh(th, r.tc)) > r.th) return null;
    if (r.aholes) {
      for (const h of r.aholes) {
        if (rr > h.r0 && rr < h.r1 && Math.abs(dTh(th, h.tc)) < h.th) return null;
      }
    }
    if (!r.axis) return r.y;
    a = rr;                                  // annular ramps run along RADIUS
  } else {
    if (r.holes) {
      for (const h of r.holes) {
        if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1) return null;
      }
    }
    if (!r.axis) return r.y;
    a = r.axis === 'x' ? x : z;
  }
  let t = (a - r.a0) / (r.a1 - r.a0);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return r.ry0 + (r.ry1 - r.ry0) * t;
}

/* scratch, reused every frame — the walker calls this once per frame and the
   candidate list is never more than a handful long */
const _h = [], _c = [], _t = [], _rej = [];

/**
 * Height of the walkable surface under a point.
 * @param x,z       WORLD coordinates.
 * @param fromY     the walker's CURRENT feet height. Omit it (or pass a
 *                  non-number) to get bare terrain — that is the back-compatible
 *                  2-argument contract every non-walking caller still uses.
 * @param stepUp    how far the walker may climb in one step (CFG.STEP_UP).
 * @param headClear headroom a surface must have to be climbed onto (CFG.HEAD_CLEAR).
 */
export function siteFloorY(x, z, fromY, stepUp = DEF_STEP_UP, headClear = DEF_HEAD_CLEAR) {
  const g = siteGroundY(x, z);
  if (typeof fromY !== 'number') return g;

  const l = worldToEnclave(x, z);
  let n = 0;
  _h[n] = g; _c[n] = Infinity; _t[n] = 0; _rej[n] = 0; n++;
  for (let i = 0; i < WALK_REGIONS.length; i++) {
    const r = WALK_REGIONS[i];
    const y = r.world ? regionY(r, x, z) : regionY(r, l.x, l.z);
    if (y === null) continue;
    _h[n] = y; _c[n] = r.ceil; _t[n] = r.t; _rej[n] = 0; n++;
  }
  if (n === 1) return g;

  const lim = fromY + stepUp;
  for (;;) {
    /* the highest surface we could step onto and have not already refused */
    let bi = -1, bh = -Infinity;
    for (let i = 0; i < n; i++) {
      if (_rej[i] || _h[i] > lim || _h[i] <= bh) continue;
      bh = _h[i]; bi = i;
    }
    if (bi < 0) break;
    if (bh > fromY + 1e-3) {           // a genuine climb — is there room up there?
      let ceil = _c[bi];
      for (let j = 0; j < n; j++) {
        if (_h[j] > bh + 0.05) ceil = Math.min(ceil, _h[j] - _t[j]);
      }
      if (ceil - bh < headClear) { _rej[bi] = 1; continue; }
    }
    return bh;
  }
  /* under everything (mid-fall, or wedged below a slab): give the fall a floor */
  let lo = _h[0];
  for (let i = 1; i < n; i++) if (_h[i] < lo) lo = _h[i];
  return lo;
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

/* WORLD-space spawns, for moments that are NOT on the enclave. These skip the
   transform entirely — put an enclave place in here and it lands 90° out.
   A spawn may now carry `y`: the FEET height it starts at. Omit it and you
   spawn on the ground, which is what all five enclave moments do; the Welcome
   Brunch needs 26.6 because moments.js teleports before any floorY resolve and
   CFG.STEP_UP would never let a walker climb 26 m in one frame. */
const _BRUNCH_TH = _RC + 0.34;                // just past the last lounger, east
const _BRUNCH_PT = HOTEL_ROOF.pt(_BRUNCH_TH, 99.2);   // on the teak, behind the coping
const MOMENT_PLACES_WORLD = {
  // Standing at the east end of the lounger deck looking due WEST: the pool
  // runs away to the left, the brunch tables sit to the right, and dead ahead
  // is the infinity edge, the balustrade and 26 m of nothing before the sea.
  // Due west rather than dead-inward (which would be yaw = θ) so the water and
  // the tables both stay in frame instead of one filling it.
  BRUNCH: { x: _BRUNCH_PT.x, z: _BRUNCH_PT.z, y: SITE.HOTEL.ROOFTOP.deckY, yaw: Math.PI / 2 },
};

export const MOMENT_PLACES = {
  ...Object.fromEntries(
    Object.entries(MOMENT_PLACES_LOCAL).map(([k, p]) => {
      const w = enclaveToWorld(p.x, p.z);
      return [k, { x: w.x, z: w.z, yaw: enclaveYaw(p.yaw) }];
    }),
  ),
  ...MOMENT_PLACES_WORLD,
};

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
