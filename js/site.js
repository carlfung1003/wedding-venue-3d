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

/* ═══════════════════════════════════════════════════════════════════════════
   THE CRESCENT'S FOUR NUMBERS — hoisted out of SITE so nothing re-derives them
   ═══════════════════════════════════════════════════════════════════════════
   SITE.HOTEL_POOLS used to open with `const acx = 285 - 95` — the arc centre,
   spelled out again as literals, inside the same object literal that defines
   SITE.HOTEL twenty lines further down. That worked for exactly as long as
   nobody moved the building. These four constants are the single copy; HOTEL
   and HOTEL_POOLS both read them, and HOTEL_ROOF derives the arc centre from
   SITE.HOTEL as it always has.

   ── THE PROPORTION PASS, 2026-08-02 (Carl) ──────────────────────────────────
   *"the hotel and the water features are very close by and it extends all the
   way to the beach nicely. Right now there's a big disconnection between hotel
   and water feature, and water feature to the beach … the hotel shape is
   slightly smaller than actual — if you look at the real picture it's almost a
   half circle, but the one we have now is very small in comparison."*

   Measured off reference/photos/westin-site-map.jpeg, which is the only
   reference that holds the beach, the clubhouse, the whole river and the
   crescent in ONE frame. A circle fitted to three points on the crescent's
   concave face lands at centre (998, 373) px with an inner radius of 206 px.
   The scale is 0.45 m/px, calibrated three independent ways and agreeing to
   better than 10 %: the beach pool's radius (36 px ↔ our 15.2 m), a villa roof
   (33 × 26 px ↔ a ~15 × 12 m key) and the presidential pool (52 px ↔ our 25 m).

   What that says, and it is not what was expected:
     · R IS ALREADY RIGHT. 206 px × 0.45 = 93 m, against a rooftop inner edge of
       90 and a guest-room facade at 84. **`r` is therefore NOT changed** — and
       it must not be, because campus.js derives `rIn = r − DEP/2` and leans the
       facade 6 m back onto ROOFTOP.rIn = 90. Grow `r` and the walkable rooftop,
       its polar hole in the height field, its y-ranged colliders, the stair
       tower and the brunch dressing in TWO files all shear off the building.
       The radius was never the problem.
     · THE ARC WAS. The real crescent spans ≈ −3°…+116° of its own circle before
       the photograph runs out of building — at least 119°, against our 1.5 rad
       = 86°. That is Carl's "almost a half circle", and it is the whole of what
       reads small. `arc` 1.5 → 2.35 rad (134.6°): the building goes from 142 m
       to 223 m along its face, +57 % of everything you actually see.
     · IT WAS TOO FAR AWAY. In the aerial the sand's inland edge is 650 px from
       the arc centre = 292 m. Ours was 326. `cx` 285 → 251 pulls the arc centre
       from x 190 to x 156 and closes 34 m of the empty lawn Carl is pointing at
       — the rest of that gap is closed by the water, which now runs into it.
   ⚠ Grow the arc and the guest-room bays stretch with it: texHotelFacade tiles
   4 bays HOTEL_TILES times across the whole face, so the bay width is
   r·arc/(4·TILES). campus.js computes TILES from these numbers now instead of
   holding the 9 that suited a 142 m building. See the note there.            */
const HOTEL_CX = 251, HOTEL_CZ = 10, HOTEL_R = 95, HOTEL_ARC = 2.35;

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
    // Target width of one perimeter-facade module. atrium.js divides each wall
    // into round(len / module) equal bays and a door gap drops a WHOLE bay, so
    // this number decides where every opening in the building actually lands.
    // It lives here because site.js has to snap the guest-key doors to the same
    // grid — see snapDoor() below.
    module: 2.95,
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
  /* THE SECOND POOL — the one the 3-BR keys and the 酒廊 terrace share.
     ⚠ RESHAPED AND PUSHED OUT 2026-08-02 (Carl): *"you probably need to first
     refactor the second pool for the 3 bedroom suites, the shape is different
     and there should be more space for the two rectangle shape grass area"*.
     Reference: reference/photos/lawn-dinner-strips-and-2nd-pool.png.

     Two things changed and both are load-bearing:
      · ORIENTATION. It was 9 wide × 18 deep, i.e. running away from the lounge
        along Z — which put it squarely in the corridor between the presidential
        pool and the lounge, exactly where DINNER_LAWNS now live. In the aerial
        its long axis runs along local X (≈24 m) and it is only ≈13 m along Z.
      · POSITION. cx −44 → −56, which is 12 m further from the hero pool. Its
        stone apron (water.js lays it at cx ± w/2 ± 4.5) now stops at x −41.5,
        clearing DINNER_LAWNS[1]'s west edge (−39) by 2.5 m. cz 6 → 7 keeps the
        apron's north lip (cz − d/2 − 5 = −9.5) at the lounge's glass line.
     Still on the suite's RIGHT (local −X) — Carl's 2026-08-01 call, and moving
     it further −X only strengthens "the presidential pool is the ONLY pool
     visible from the suite": from the great room its nearest corner sits ~70°
     off the view axis with the lounge's mass in the way.

     ⚠ THE SHAPE IS NOT A RECTANGLE, and water.js — which is not ours to edit —
     still builds it as one from w/d. OUTLINE below is the free-form plan traced
     off the aerial, as a CLOSED polygon in normalised pool space (u = x/w,
     v = z/d, both in −0.5…+0.5, counter-clockwise, first point NOT repeated).
     Its AABB is exactly w × d, so the rectangle water.js draws today is the
     outline's bounding box and nothing is misplaced in the meantime. When
     water.js is next open, buildLoungePool() should extrude this through a
     THREE.Shape instead of calling makeRectPool — see the report/CLAUDE.md.
     The straight run is the v = −0.5 edge: that is the side facing the lounge's
     folding glass, which is a coped terrace edge in the photo, not a curve. */
  LOUNGE_POOL: { cx: -56, cz: 7, w: 20, d: 13, umbrellas: 6,      // teal umbrellas
    OUTLINE: [
      [-0.44, -0.50], [0.16, -0.50], [0.40, -0.47], [0.50, -0.36],
      [0.50, -0.14], [0.44, 0.10], [0.34, 0.30], [0.20, 0.44],
      [0.02, 0.50], [-0.14, 0.44], [-0.24, 0.30], [-0.32, 0.40],
      [-0.42, 0.46], [-0.50, 0.34], [-0.50, 0.10], [-0.47, -0.14],
      [-0.46, -0.34],
    ] },

  /* ── SITE.LAWN — DELETED 2026-08-02 (the proportion pass) ──────────────────
     Carl, on the striped dark-green oval in his top-down: *"you can probably
     remove this non-existent grass area just in the way of things?"* He is
     right, and it was already known to be wrong: a 48 m hedge-ringed disc with
     a coping, a gravel border, a ring path and twenty path lights, standing in
     the middle of the campus, serving no moment. It was the ORIGINAL ceremony
     ground and lost that job on 2026-08-02 when the ceremony moved to
     BEACH_LAWN; it survived only because world.js's enclaveKeepOut() read
     S.LAWN.hedgeR unconditionally and that file was not in the last pass's
     ownership. This pass owns world.js, so the reader went with the lawn.
     Removed with it: campus.js's buildLawn() and its 'lawn' entry in world.js's
     CAMPUS_ENCLAVE_GROUPS, nature.js's framing palm ring and its exclusion
     disc, and world.js's keepOutDisc call.
     The real lawns are GRAND_LAWN / BEACH_LAWN / DINNER_LAWNS below, and
     reference/photos/clubhouse-lawn-to-beach.png is why none of them has a
     hedge ring: the ground out here is flat, unbroken and empty.             */

  /* ═════════════════════════════════════════════════════════════════════════
     THE GRASS GROUND — Carl, 2026-08-02
     ═════════════════════════════════════════════════════════════════════════
     *"correction for the ceremony, it's actually in a grass lawn area behind
     the pool and very close to the beach … then closer to the beach you see
     this private grass lawn area — our ceremony is actually there, with the
     cocktail hours as well! Our dinner is actually in this two grass area right
     outside of the pool."*

     ── ORIENTATION, DERIVED (not assumed) ────────────────────────────────────
     ENCLAVE.rotY = −π/2, so cos = 0 and sin = −1 and enclaveToWorld collapses
     to the exact pair
         world.x = −z + ENCLAVE.ox        world.z =  x + ENCLAVE.oz
     Read off it directly:
       · local +Z  →  world −X  =  WEST.  SITE.BEACH is world x −136…−160 and
         SITE.OCEAN is everything west of that, so local +Z is the way to the
         sea. The sand's inland edge lands at local z = 78.
       · local +X  →  world +Z  =  SOUTH. It is ALSO the suite's LEFT hand when
         it faces the pool (player.js: fwd = (−sin y, 0, −cos y), so facing +Z
         puts +X on the left) — which is the frame every Carl-verified left/right
         call on this project is stated in, and the one that decides the sides
         below. SITE.CABANAS at +12 is on that left; SITE.LOUNGERS at −7.6 and
         SITE.LOUNGE_POOL are on the right.
     So "behind the pool, close to the beach" = local +Z past the pool's far
     coping (z 21.5), and "right outside the pool" = the flank at local ±X.

     ── WHERE EACH ONE LANDED ─────────────────────────────────────────────────
     GRAND_LAWN     the big grass area: open mown grass from the pool terrace
                    west to the palm belt. No ceremony furniture ever — it is
                    the empty foreground the beachfront lawn is seen across.
     BEACH_LAWN     the private lawn nearest the sand, past the palm belt.
                    CEREMONY on its −X half, COCKTAIL HOUR on its +X half.
     DINNER_LAWNS   the two rectangular panels flanking the presidential pool
                    on its −X side, between it and the second pool, split by a
                    paved walk. Four rounds of eight on each = 64 covers.

     ⚠ The two dinner panels are BOTH on local −X, not one per side. That is
     what reference/photos/lawn-dinner-strips-and-2nd-pool.png shows (they are
     stacked between the two sheets of water, divided by paving) and it is the
     only reading under which Carl's own follow-up — *"the second pool … there
     should be more space for the two rectangle shape grass area"* — means
     anything: a pool on the far side of the campus cannot be in their way. The
     +X flank is already the cabana run, its hedge wall and SITE.PLAZA.

     ⚠ Every one of these is a nature.js keep-out (exclusionZones) as well.
     Move a rectangle here and the palms follow; add one and forget the zone and
     a palm grows through the aisle.                                          */
  // 49 × 25 m of open mown grass. x1 stops at 9 so the pergola (x 9.5…14.5,
  // z 23…27) stands just off its corner rather than in it.
  GRAND_LAWN: { x0: -40, x1: 9, z0: 25, z1: 50 },
  // 52 × 17 m, the far side of the palm belt (z 50…58) and 3 m short of the
  // sand at z 78. CEREMONY + COCKTAIL HOUR.
  BEACH_LAWN: { x0: -40, x1: 12, z0: 58, z1: 75 },
  // WEDDING DINNER. 12 × 20 m each (240 ㎡), split by a 4 m paved walk at
  // x −27…−23. Four 1.8 m rounds of eight per panel on a 6 m grid: the 8-seat
  // ring sits at r 1.35 with chair backs out to ~1.6, so 6 m of pitch leaves
  // 2.8 m between chair backs — a served aisle, not a squeeze — and the 20 m
  // length still buys a head table at one end and a dance floor at the other.
  DINNER_LAWNS: [
    { x0: -23, x1: -11, z0: -5, z1: 15 },     // inner: nearest the hero pool
    { x0: -39, x1: -27, z0: -5, z1: 15 },     // outer: nearest the second pool
  ],
  DINNER_WALK: { x0: -27, x1: -23, z0: -5, z1: 15 },
  // the square fire pit set into the terrace paving beside the pool —
  // reference/photos/clubhouse-lawn-to-beach.png, centre of that photo's
  // terrace. On the pool's −X flank at its seaward end, clear of DINNER_LAWNS.
  FIRE_PIT: { cx: -11, cz: 20, w: 3.4, rim: 1.1 },

  // -------------------------------------------------------------- villa cluster
  // The REAL room mix from the hotel's deck (reference/clubhouse-pdf-brief.md):
  // 11 keys total = 1 presidential suite + 5 Garden Rooms + 3 Garden Pool 2-BR
  // + 2 Garden 3-BR. Ten of those eleven are guest keys ATTACHED TO THE ATRIUM;
  // the eleventh is the presidential suite, which already is.
  //   type 0 — 花园客房 Garden Room, 98 ㎡, SINGLE storey, internal soaking-tub
  //            light well (the small courtyards visible in the aerials)
  //   type 1 — 花园泳池双卧套房 Garden Pool 2-BR, 208 ㎡, single storey, walled
  //            private courtyard with an L-shaped plunge pool and a black stone
  //            water wall with THREE waterfall spouts
  //   type 2 — 花园三卧套房 Garden 3-BR, 168 ㎡, TWO storeys with an upper balcony
  //
  // ⚠ SITE.VILLAS IS NO LONGER A HAND-TYPED TABLE. It is derived, below the SITE
  // literal, from ROOM_SPEC — see "THE TEN GUEST KEYS ATTACH TO THE ATRIUM".
  // Assigning positions by hand is what let the rooms drift off the building.
  VILLAS: [],          // ← filled in below from ROOM_SPEC. Do not edit here.
  VILLA: {
    /* ⚠ `d` IS THE PLUNGE-POOL OFFSET DATUM, not a footprint. water.js's
       buildVillaPools() — which is not ours to edit — places every type-0 and
       type-1 pool at `V.d / 2 + k` from the key's CENTRE, so the terrace
       between a room's folding glass and its own water is
           (V.d − d_type)/2  +  k  −  poolDepth/2  −  (colliderR + PLAYER_R)
       and at V.d = 11 against a 13 m deep 2-BR that came out NEGATIVE: the
       pool's coping collider stood 0.6 m INSIDE the glass, so you could walk
       from the corridor across the room and then not get out of it. Raised to
       14 on 2026-08-02, which buys ~0.95 m of terrace on the 2-BR and 2.8 m on
       a Garden Room. It is not a footprint — the backdrop villas have their own
       (wR/dR) and the ten keys have theirs (w0…d2). */
    w: 13, d: 14, h: 3.6,
    wR: 13, dR: 11,                // ≈50 backdrop RESORT_VILLAS boxes
    /* per-type footprints for the ten attached keys. [w] runs ALONG the atrium
       wall, [d] runs outward from it — the room's private side. Sized to the
       hotel's own areas for the first time: the Garden Room was modelled at
       13 × 11 = 143 ㎡ against a published 98 ㎡, and five rooms 30% too wide is
       exactly why they could not be got onto the gallery. */
    w0: 9.9, d0: 9.9,              // type 0 — 98 ㎡
    w1: 14.6, d1: 13,              // type 1 — 190 ㎡ + a 14.6 × 9 courtyard
    w2: 17, d2: 14, h2: 7.2,       // type 2 — two storeys, entered on BOTH
    poolW: 7, poolD: 3.2,          // type 1 courtyard plunge pool
    courtW: 14.6, courtD: 9,       // type 1 walled courtyard (= w1, so the
                                   // courtyards of neighbouring keys share a wall
                                   // instead of interpenetrating)
    wallT: 0.30,                   // room wall thickness (= atrium.js WALL_T)
    floorY: 0.22,                  // finished floor over the atrium's datum —
                                   // one threshold step, inside CFG.STEP_UP
    floorH2: 3.6,                  // type 2 floor-to-floor. MUST equal
                                   // ATRIUM.floorH: the 2F is entered off the
                                   // atrium's upper gallery and a mismatch is a
                                   // step you cannot take.
    doorClear: 2.0,                // clear width of a gallery door between piers
    /* Where the folding glass wall STANDS OPEN, as an offset along the room's
       width. Centred for the single-storey types; pushed off-centre for the
       two suite types, whose plunge pools are 6.4 m and 7 m wide and sit dead
       in front of the room: walking out of the middle of either one lands you
       in the water, which the through-route walk test found by wedging the
       player between its own glass and its own coping. Only the Garden Room
       has enough terrace to be entered and left down the centre-line. */
    openAt: { 0: 0, 1: 5.6, 2: 5.4 },
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

    /* ── THE BEACH POOL ────────────────────────────────────────────────────
       reference/photos/beach-pool-circular.png (ground level) and
       beach-pool-near-beach-aerial.png (top-down). It is the resort's big
       circular beach pool: concentric-ring medallions on its floor, a
       sand-coloured deck, white umbrellas, a round bar structure jutting into
       its south-west rim and one enormous shade tree on the north-west.

       ⚠ MOVED WEST 2026-08-02 (second pass). Carl, on seeing it at cx 48:
       *"the beach pool must sit VERY CLOSE to the beach"*. In the top-down
       aerial there is NOTHING between the pool and the sand but a belt of
       palms, and the clubhouse sits well inland of it and to the south. At
       cx 48 the sand was 163 m away — the pool was a mid-campus feature, not
       a beach one.

       Now (−82, −34), which is 130 m west of where it was:
         · its deck's outer edge reaches x −102.7, so the palm belt between the
           pool and the sand's inland edge (SITE.BEACH.x1 = −136) is 33 m and
           there is nothing else in it. It was 163 m and half the campus.
         · it sits NORTH of the enclave's grass ground, which occupies world
           z −6…46 all the way out to the beachfront lawn at x −116…−133. The
           ceremony and cocktail ground is the one thing out here that may not
           be built over, and the pool's deck stops 17 m short of it — which is
           also the aerial's relationship, where the clubhouse's private lawn
           lies SOUTH of the public pool.
         · ~100 m from the clubhouse core (world −17, 42), against 119 m from
           the clubhouse to the sand.

       ⚠ THE cx −82 CAP IS GONE (2026-08-02, the proportion pass). It was never
       a site-plan number: world.js's adoptWater() classified water.js's root
       children by the x of their bounding-box CENTRE and swept anything under
       84 into the rotated enclave, and the whole river is ONE group, so pushing
       this pool west dragged that centre over the line and silently rotated the
       ENTIRE system 90° along the beach. water.js now flags the river group
       `userData.worldSpace = true` and world.js tests the flag first, so the
       position is free and the whole system can run west to meet the sand.

       Where it actually belongs, measured rather than guessed. On
       westin-site-map.jpeg at 0.45 m/px the pool's paved ring starts 103 px
       (46 m) inland of the sand's edge and the pool's own radius is 36 px
       (16 m) — so the model's 15.2 m radius was already right and the palm belt
       wanted to be ~45 m, not the 33 m it had. cx −84, cz −28: 2 m further west
       (31 m of belt, close enough that Carl's *"very close to the beach"* still
       reads, and closer than the aerial rather than further) and 6 m SOUTH,
       which is the real change — it drops the pool onto the same east–west line
       as the river so the two can be joined by a channel instead of a detour.

       ⚠ THE RIVER FLOWS OUT OF THIS POOL AGAIN. It did until 2026-08-02, when
       the pool moved to the beach and the connection was cut on the strength of
       beach-pool-near-beach-aerial.png, which shows the two as separate systems.
       Carl looked at the result: *"the water feature now is broken — doesn't
       connect to the hotel, doesn't connect to the last beach pool at all."*
       He wins, and the wide site map backs him: there, the pool's ring path
       ends at x 601 px and the river's west tip starts at 637 px — 36 px, 16 m,
       one path's width. From the air they read as one system. SPINE now begins
       as an outfall cut into this pool's east rim. */
    WEST: { cx: -84, cz: -28, r: 15.2, deck: 5.6, umbrellas: 12,
      RINGS: [                      // [dx, dz, r] as a fraction of the pool's r
        [-.30, -.26, .30], [.16, -.34, .22], [.34, .10, .27],
        [-.06, .30, .34], [-.42, .16, .18], [.02, -.02, .46],
      ],
      TREE: { dx: -.72, dz: -1.02, r: 8.4, h: 9.0 },  // the big shade tree
    },
    /* the round bar keeps its offset from the pool's centre (−11.5, +13.5) —
       the south-west rim, as in the reference */
    BAR:  { cx: -95.5, cz: -14.5, r: 5.6, h: 3.4 },

    /* ── THE LAZY RIVER. ~148 m of centreline over 70 m of ground: five full
       reversals, three of them proper hairpins, exactly the scribble the
       aerial shows.

       ⚠ NARROWED 2026-08-02, Carl's third ask. The reference is
       reference/photos/lazy-river-closeup.png — a drone frame straight down on
       a woman on a paddleboard. The board is roughly as long as the channel is
       WIDE, palm crowns close over it from both banks, and the timber and grass
       edges are within arm's reach. The previous half-widths (1.5…2.6, i.e.
       3–5.2 m of water) read as a canal from the air; these run 1.15…1.55 in
       the body of the river, so the channel is 2.3–3.1 m across — one
       paddleboard, no passing. It only opens up where it has a reason to: the
       outfall from the beach pool and the mouth into the lagoon.

       ⚠ THE RIVER RUNS OUT OF THE BEACH POOL AGAIN (2026-08-02, the proportion
       pass) — Carl: *"the water feature now is broken … doesn't connect to the
       last beach pool at all."* The 16 points below the marker are the WEST
       REACH, ~140 m of centreline over 133 m of ground from an outfall cut into
       the pool's east rim at (−71, −24) to what used to be the river's head at
       (54, 19). Nothing east of that point has changed.

       Three things it is routed around, none of which may move:
         · the clubhouse in its NEW position — the lounge pool (world x
           −47.5…−34.5, z 8…28) and the 酒廊 lounge (x −25…−11, z 20…40). The
           channel holds z ≈ −22 across the first and z ≈ −16 across the second,
           29 m and 36 m clear.
         · the grass ground — GRAND_LAWN reaches world z 34 at its northern
           edge and the channel is 54 m north of it at the same x.
         · PATHS[0], which used to run down exactly this corridor and now runs
           8…11 m SOUTH of the water, on the clubhouse side. That is the aerial's
           arrangement too: the resort's spine walk follows the river's bank.

       The meander is five lazy reversals rather than the three hairpins of the
       eastern half. That is what the site map shows out here — the tight
       scribble is the mid-river; the western arm is long, open curves through
       the palm grove.

       ⚠ THE WEST REACH IS WIDER THAN THE EAST, ON PURPOSE, AND IT IS STILL
       "one paddleboard". Half-widths 1.25…2.15 = a 2.5…4.3 m channel, against
       1.15…1.55 (2.3…3.1 m) east of x 54. The east half was narrowed on
       2026-08-02 against reference/photos/lazy-river-closeup.png — a drone frame
       looking straight down on a woman on a paddleboard, the board about as long
       as the channel is wide. A touring board IS 3.2 m, so 2.5…4.3 m is the same
       reading, and the site map's own channel measures ~10 px = 4.5 m. The
       reason it matters here and not there: this reach is the one that has to
       carry the eye from the beach pool to the rest of the resort in a top-down,
       and at 2.3 m under a palm canopy that job simply does not get done — the
       first cut of it read as a hedge. The east half is Carl-verified against
       that photo and is NOT touched.                                          */
    SPINE: [
      [-71.0, -24.0, 2.15],  // ── THE OUTFALL, cut into the beach pool's east rim
      [-62.5, -21.0, 1.80],
      [-54.0, -20.0, 1.62],
      [-46.0, -22.5, 1.50],  // reversal 1 — north
      [-38.0, -21.5, 1.56],
      [-30.5, -17.0, 1.68],
      [-22.0, -15.0, 1.56],
      [-14.0, -16.5, 1.44],  // reversal 2 — south
      [ -6.0, -13.5, 1.50],
      [  2.5,  -9.0, 1.62],
      [ 11.0,  -9.5, 1.50],  // reversal 3
      [ 19.5,  -6.0, 1.56],
      [ 28.0,  -1.5, 1.62],
      [ 36.0,   1.5, 1.50],
      [ 43.5,   6.5, 1.40],
      [ 49.5,  12.5, 1.25],
      [ 54.0, 19.0, 1.15],  // ── the old head; the eastern half is untouched
      [ 61.0, 23.5, 1.45],
      [ 68.5, 28.5, 1.50],
      [ 75.5, 32.0, 1.35],
      [ 82.0, 33.2, 1.30],
      [ 88.0, 30.5, 1.25],
      [ 90.5, 24.0, 1.30],
      [ 87.5, 18.5, 1.20],  // hairpin 1 — the river turns back on itself
      [ 90.5, 13.5, 1.15],
      [ 96.0, 11.5, 1.20],  // the northern extreme
      [100.5, 14.0, 1.30],
      [102.0, 20.0, 1.40],
      [100.0, 26.0, 1.25],  // hairpin 2
      [101.5, 31.5, 1.30],
      [107.0, 34.5, 1.45],  // the southern extreme
      [111.5, 33.0, 1.40],
      [115.0, 26.5, 1.55],  // …through the MID basin
      [113.0, 20.5, 1.30],  // hairpin 3
      [115.5, 15.0, 1.25],
      [120.0, 14.5, 1.45],
      [124.5, 19.0, 1.75],
      [126.5, 24.0, 2.30],
      [128.0, 30.0, 3.10],
      [131.0, 33.5, 4.10],  // …and it is inside LAGOON by here
    ],
    MID: { cx: 115.0, cz: 26.0, r: 4.4, deck: 2.0 },

    /* ── the hairpin out of the lagoon's north rim, and then THE RUN TO THE
       HOTEL (2026-08-02, the proportion pass).
       Carl: *"the water feature … doesn't connect to the hotel."* It didn't:
       the system stopped at EAST2's deck (x 168.5) and the crescent's own pools
       began at x 245 — 77 m of blank lawn, which is item 3 of the proportion
       spec ("close the gap between the hotel and the water"). Half of that gap
       closed when the crescent came 34 m west; the other half is these seven
       new points, which carry the channel on THROUGH both circular pools and
       into the westernmost of SITE.HOTEL_POOLS, hard against the podium.

       One centreline now threads four basins — EAST, EAST2 and the hotel's
       middle pool, plus the lagoon it leaves. water.js trims the channel
       wherever it is already inside a basin, so this reads as one continuous
       body of water rather than as pools joined by pipes, and it needs no new
       code in that file: the same two centrelines it always built.
       In the aerial this is exactly the arrangement — the lazy river opens into
       the lagoon, doubles back through the round pools and runs up to the
       hotel's terraces without a break. */
    SPUR: [
      [136.0, 24.0, 2.40],
      [135.0, 18.0, 1.55],
      [137.0, 12.0, 1.35],
      [141.0,  9.0, 1.45],
      [145.5, 11.5, 2.00],  // …into EAST
      [152.5, 17.5, 1.70],
      [157.5, 23.0, 1.90],  // …into EAST2
      [166.0, 27.0, 1.55],  // ── THE RUN TO THE CRESCENT
      [174.5, 23.5, 1.40],
      [183.0, 22.5, 1.35],
      [191.5, 18.5, 1.45],
      [200.0, 15.5, 1.55],
      [208.5, 12.5, 1.90],
      [216.5, 10.5, 3.20],  // …into HOTEL_POOLS[1], 10.5 m off its centre
    ],

    EAST: { cx: 147, cz: 13, r: 7.8, deck: 3.2, islandR: 3.1, umbrellas: 7 },

    /* ── the second, smaller circular pool by the hotel (the general pass,
       2026-08-02). In resort-water-features.jpeg there are TWO round pools at
       the east end, not one: the big drum-centred circle EAST already builds,
       and a smaller one north-east of it with a dark round island in the
       middle. This is that one. */
    EAST2: { cx: 160.5, cz: 26.5, r: 5.4, deck: 2.6, islandR: 1.9, umbrellas: 4 },

    // the lagoon's planted island, as a fraction of LAGOON.rx / .rz
    ISLAND: { dx: .24, dz: .18, r: 3.4 },

    /* footbridges, as [which centreline, t along it 0…1]. t is arc-length
       fraction (water.js resamples both centrelines at a fixed 1.6 m step
       before indexing), so these had to be retuned when the spine roughly
       doubled and the spur nearly quadrupled: the four old spine crossings sat
       at 19/55/90/126 m along a 148 m line and are now at .55/.68/.80/.92 of a
       ~288 m one. Two new crossings serve the west reach and two the run to the
       hotel — a bridge is also the only GAP in the collider chain, so a reach
       without one is a wall across the campus. */
    BRIDGES: [
      ['spine', .12], ['spine', .31], ['spine', .55], ['spine', .68],
      ['spine', .80], ['spine', .92],
      ['spur', .13], ['spur', .45], ['spur', .72],
    ],

    /* pale walking paths — control points only, water.js smooths them.
       PATHS[0] is the resort's spine walk and it now runs all the way out to
       the beach pool's east deck (−70, −31), which is where the pool went. It
       keeps NORTH of world z −6 for its whole western leg: that is the north
       edge of the enclave's grass ground (GRAND_LAWN / BEACH_LAWN start there),
       and a resort path across the ceremony lawn would be exactly the kind of
       thing nobody notices until the aisle is dressed. It also clears the
       enclave's own world footprint, whose east-most point is x 16 at z 20…64.
       The path lanterns (LAMPS, laid along this line) are what draws the walk
       from the clubhouse to the water at night.
       PATHS[1] was pushed 3–5 m south of the lagoon's rim — at PATH_Y .060 it
       would otherwise have drawn OVER the basin water at .045. */
    PATHS: [
      /* THE RESORT'S SPINE WALK. It used to run down the corridor the west
         reach now occupies, so it has moved 8…11 m SOUTH of the water — the
         clubhouse side — and follows the bank the whole way, which is how the
         aerial has it. It then carries on past the lagoon and into the
         crescent's crook, ending 11 m short of the hotel pools' deck. The
         LAMPS are laid along this line and are what draws the walk from the
         clubhouse to the water at night. */
      [[-66, -12], [-52, -11], [-38, -10], [-24, -8], [-10, -7], [2, -6],
       [14, -5], [26, -4], [38, -3], [50, 0], [62, 5.5], [78, 4], [92, 5.5],
       [104, 3.5], [118, 5.5], [130, 3.0], [142, 2.0], [156, 3.0], [170, 4.5],
       [184, 5.5], [196, 4.0]],
      /* the northern loop. Pushed 3–5 m south of the lagoon's rim (at PATH_Y
         .060 it would otherwise draw OVER the basin water at .045), and now
         carried east around the north hotel pool, stopping 5 m off its deck. */
      [[46, 44], [58, 45], [68, 47], [82, 44], [96, 46], [110, 43], [122, 47],
       [134, 49], [145, 45], [156, 42], [168, 44], [180, 46], [192, 44], [202, 40]],
    ],
    PATH_W: 1.3,          // half-width of a path
    LAMPS: 30,            // path lanterns — the night silhouette. 22 over the
                          // old 190 m walk; the walk is ~280 m now.
  },

  // LAGOON is the river's big eastern basin. It KEEPS ITS NAME because
  // nature.js reads SITE.LAGOON.{cx,cz,rx,rz} as a palm keep-out disc — the
  // one footprint in the system big enough that the bank colliders alone
  // wouldn't stop a palm landing mid-water. Everything else in the river is
  // kept palm-free by the collider chains water.js lays down its centrelines.
  // Grown 12 × 9.5 → 16.5 × 12.5 on 2026-08-02: in resort-water-features.jpeg
  // the eastern lagoon is the LARGEST sheet of water in the resort — bigger
  // than the beach pool — with a planted island in it and lobes running off in
  // three directions. At 12 × 9.5 it read as another bulge in the river.
  /* ⚠ 2026-08-02, the proportion pass — grown again, 16.5 × 12.5 → 19.5 × 15.5.
     This is the ONE water feature that got bigger, and it is a measurement, not
     a nudge. Carl's complaint was a RATIO: *"the pool isn't that big in
     perspective compared to the actual hotel"*, i.e. our water was reading too
     large against a crescent that was too small. Growing the crescent's arc by
     57 % fixed the numerator and overshot: on the site map the eastern lagoon
     measures ~66 × 70 m against a 219 m hotel face (0.30 of it), and at
     33 × 25 m against our new 223 m face we were at 0.148 — half the aerial's
     relationship, the wrong side of it. 39 × 31 m takes it to 0.175.
     Deliberately conservative: the aerial's number would nearly double this
     basin, and the failure Carl actually saw is "the pools dominate", so this
     moves toward the measurement rather than to it. The river's width, the
     beach pool and the hotel's own pools are NOT changed. */
  LAGOON: { cx: 134, cz: 33, rx: 19.5, rz: 15.5, deck: 3.2, umbrellas: 11 },

  /* ── the hotel's own pools, in the crook of the crescent ───────────────────
     The gap the general pass was asked to close. resort-water-features.jpeg
     shows a long free-form pool complex hard against the crescent's CONCAVE
     (campus-facing) face — three lobes with planted islands between them,
     ringed by the hotel's own terraces. Nothing was built there at all.

     Authored in the crescent's polar frame, because that is the only frame in
     which "hugs the building" is one number: the arc centre is
     (HOTEL.cx − HOTEL.r, HOTEL.cz) = (190, 10) and the building's podium face
     is at r = HOTEL.r − 22/2 − 4 = 80 (campus.js's `rIn - 4`). These sit at
     r ≈ 69, i.e. ~11 m off the podium, and inside the coarse collider ring
     (r 81…109) is the BUILDING, not these — a walker reaches them from the
     campus side without meeting the ring at all. */
  HOTEL_POOLS: (() => {
    const acx = HOTEL_CX - HOTEL_R, acz = HOTEL_CZ, C = Math.PI / 2;
    return [[-0.345, 69, 10.5, 3.4], [0, 71, 12.5, 3.8], [0.345, 69, 10.5, 3.4]]
      .map(([d, r, rad, deck]) => ({
        cx: acx + Math.sin(C + d) * r, cz: acz + Math.cos(C + d) * r,
        r: rad, deck, umbrellas: 6,
      }));
  })(),

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
  /* ── REBUILT 2026-08-02, the proportion pass ────────────────────────────────
     Carl: *"my take is the goal should highlight the club house, the hotel
     build itself and the water features. I care less about any other random
     building blocks right now."* So this field stopped being a constraint and
     became what it always claimed to be — context.

     What it was: an 8 × 5 grid on a rigid 20 × 27 m pitch running z −124…65,
     i.e. straight ACROSS the middle of the frame, plus a six-box band further
     north. Thirty-eight identical grey rectangles in ruled rows were the first
     thing the top-down read, and the band z −26…62 they occupied is exactly the
     ground the river now has to cross to reach the crescent.

     What it is: two loose fields that FRAME the water instead of sitting on it,
     with the whole central band left clear.
       · NORTH  x 90…166, z −112…−28 — the aerial's main villa grid, which lies
         north of the resort's east–west water band. Staggered rows.
       · SOUTH-EAST x 92…147, z 66…102 — the smaller cluster between the
         clubhouse and the crescent's southern arm.
       · a thinned far-north band toward the beach, as on the site map.
     26 boxes, down from 38.

     ⚠ TWO HARD RULES, both silent when broken:
       1. Every backdrop villa must satisfy `x ≥ 84 || z ≤ −80`. That is exactly
          isEnclaveLocal()'s test, and world.js runs it over every instance in
          the SHARED buckets these villas write into: a villa that answers
          "local" gets the enclave's 90° matrix baked onto it and lands
          somewhere else entirely. It is why the south-east field starts at
          x 92 and not at the x 60 the composition would otherwise like.
       2. Nothing may stand in the crescent. `skip` tests the hotel in POLAR
          terms — radius AND bearing about the arc centre — because a radius
          test alone rejects villas that are nowhere near the building (the arc
          only sweeps 134.6°, so r 87 at θ −6° is open ground). */
  RESORT_VILLAS: (() => {
    const out = [];
    const acx = HOTEL_CX - HOTEL_R, acz = HOTEL_CZ;
    const skip = (x, z) => {
      // the river's east basins, the lagoon and their decks
      if (x > 84 && x < 175 && z > -8 && z < 46) return true;
      // Carl's own enclave envelope, in WORLD coords, padded
      if (x < 46 && z > -78 && z < 126) return true;
      // the crescent itself, its podium and its pools — polar, not radial
      const rr = Math.hypot(x - acx, z - acz);
      const th = Math.atan2(x - acx, z - acz);
      let d = th - Math.PI / 2;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return rr > 52 && Math.abs(d) < HOTEL_ARC / 2 + 0.22;
    };
    const push = (x, z, seed) => {
      if (skip(x, z)) return;
      out.push([x, z, (seed % 7) * 0.05 - 0.15]);
    };
    // NORTH — the main grid, north of the water band
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) push(90 + c * 22 + (r % 2) * 10, -112 + r * 28, r * 5 + c * 3);
    }
    // SOUTH-EAST — the smaller cluster between the clubhouse and the crescent
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) push(92 + c * 18 + (r % 2) * 9, 66 + r * 36, r * 3 + c * 4 + 1);
    }
    // the far-north band running back toward the beach, as on the site map
    for (let c = 0; c < 5; c++) {
      out.push([-36 + c * 28, -126 - (c % 2) * 15, ((c * 4) % 5) * 0.06 - 0.12]);
    }
    return out;
  })(),

  // ---------------------------------------------------------- nature & context
  PALM_GROVE: { x0: -134, x1: -66, z0: -110, z1: 110, count: 150 },
  SCATTER_PALMS: 90,        // palms threaded through the whole campus
  /* SAND. x1 went −118 → −136 on 2026-08-02 when the ceremony moved to the
     beachfront lawn. In enclave-local terms the sand's inland edge is at
     z = −(x1) − ENCLAVE.ox = 78, and everything between the pool's far coping
     (z 21.5) and that line has to hold the grand lawn, a palm belt and a
     private lawn deep enough for a 12 m aisle plus an arch. At −118 there were
     38 m to do it in; there are now 56. The slope in siteGroundY is unchanged
     in shape — it just runs over 24 m of sand instead of 42, which is closer to
     the strip in reference/photos/clubhouse-lawn-to-beach.png anyway. */
  BEACH: { x0: -160, x1: -136 },       // sand
  OCEAN: { x1: -160, size: 900, y: -0.55 },
  /* The main Westin crescent. NOT just a fly-mode backdrop any more — it is one
     of the three things the whole top-down composes around (the clubhouse, the
     crescent, the water), and the Welcome Brunch is on its roof.
     cx / cz / r / arc are the hoisted constants at the top of this file; the
     rationale for the 2026-08-02 numbers is written out there. Short version:
     the RADIUS was already right (93 m measured), the ARC was half what it
     should be, and the building sat 34 m too far east with an empty lawn in
     front of it. */
  HOTEL: { cx: HOTEL_CX, cz: HOTEL_CZ, r: HOTEL_R, arc: HOTEL_ARC, floors: 7, floorH: 3.6,
    // ── the rooftop infinity pool + brunch terrace (Carl & Rachel, 2027-03-18)
    // Radii are measured from the crescent's ARC CENTRE (cx − r, cz) = (190, 10),
    // the frame buildHotel()/buildHotelRoof() work in; angles are half-widths in
    // radians about the crescent's centre bearing (θ = π/2, i.e. due east of the
    // arc centre). Smaller radius = WEST = the concave, sea-facing side, so the
    // infinity edge is the pool's INNER radius and spills toward the horizon.
    /* ⚠ 2026-08-02 — THE WATER NOW RUNS TO THE EDGE OF THE BUILDING.
       Carl: "the hotel top pool should be an infinity pool to the edge of the
       building, we have some tables toward the edge of the building now."
       Reference: reference/photos/hotel-rooftop-pool-day-night.png. In that
       photograph there is NOTHING between the water and the sea — no deck, no
       balustrade, just a hairline white lip and then the horizon — and the whole
       inland long side is timber decking with white four-poster cabana daybeds
       backed by a perforated lattice screen wall.

       So `poolIn` moved 90.90 → 90.10, which is `rIn` + a coping's thickness:
       the infinity edge is now ON the facade line. `poolOut` did NOT move, and
       that is deliberate — moments.js (not ours to edit) dresses the Welcome
       Brunch at hard-coded radii 96.9 / 97.9 / 98.4, so anything inland of the
       water has to stay exactly where it was or the linen floats in mid-air.
       The pool therefore grew seaward, from 5.5 m to 6.3 m across.

       The inner glass balustrade and its collider are now BROKEN over the pool's
       angular span (campus.js) — a rail there would stand in the water. The
       pool's own edge collider blocks at every height and is what stops both a
       walker and a swimmer going over a 26 m drop. */
    ROOFTOP: {
      roofY: 25.2,       // floors × floorH — top of the crescent / green roof cap
      deckY: 26.6,       // WALKABLE terrace surface (a 1.4 m plinth over the cap)
      waterY: 26.52,     // pool surface, 80 mm below the coping
      basinY: 25.32,     // pool floor → 1.20 m of water
      parapetH: 1.15,    // frameless glass balustrade, above deckY
      arcHalf: 0.62,     // terrace half-angle (crescent itself is arc/2 = 0.75)
      rIn: 90.0,         // terrace inner edge = top of the leaning inner facade
      rOut: 103.2,       // terrace outer edge; the green roof cap runs on to 106
      /* The water runs the FULL length of the building edge (Carl, 2026-08-02:
         "extend the pool to the edge of the building all the way"). At 0.36 it
         covered ~58% of the terrace and the rest of the edge was bare paving.
         0.575 leaves ~0.045 rad — about 4 m — of paving at each end so the
         terrace still closes rather than the water running off the corner.
         ⚠ The brunch tables no longer sit past the water's angular ends (there
         is no "past" any more) — they spread ALONG the arc at r 99.2, inland
         of the pool's 96.4 back wall. Both loops that place them (campus.js
         buildHotelRoof and moments.js) must agree. */
      poolArcHalf: 0.575, // ~108 m of water along the curve
      poolIn: 90.10,     // THE INFINITY EDGE — on the facade line, spilling west
      lipW: 0.20,        // the white coping hairline seaward of the water
      troughR: 89.42,    // catch basin, cantilevered off the facade under the lip
      troughDrop: 0.78,  // …this far below the water surface
      poolOut: 96.4,     // pool back wall → 6.3 m across
      loungeR: 98.2,     // the lounger row, facing the drop
      gardenR: 100.9,    // the four-poster daybed row, on the timber deck
      teakOut: 102.3,    // the timber deck runs from the coping to here
      screenR: 102.9,    // THE PERFORATED LATTICE SCREEN WALL
      screenH: 5.1,      // …and how far it stands over the deck
      screenW: 3.00,     // one blade, along the arc
      barArcHalf: 0.075, // rooftop bar, on the crescent's centreline
      barH: 3.2,         // bar pavilion clear height above deckY
      coreArcHalf: 0.50, // the two stair/lift head-houses
    },
  },
  ROAD: { z: -95 },          // arrival road + parking, north edge

  GROUND: { size: 700 },     // lawn/ground plane extent

  // ------------------------------------------------------------------ limits
  /* Soft world bounds for the walker (fly mode is clamped by CFG.FLY_MAX_ALT),
     and the box nature.js scatters its loose palms inside.
     Grown 2026-08-02: x1 250 → 265 because the crescent's podium face is now at
     x 236 and its outer wall at 262 — at 250 the walker was clamped INSIDE the
     building. z1 120 → 140 because the enclave moved 40 m south and its
     southern villa arm reaches z ≈ 114. */
  BOUNDS: { x0: -150, x1: 265, z0: -130, z1: 140 },
};

/* ═══════════════════════════════════════════════════════════════════════════
   THE TEN GUEST KEYS ATTACH TO THE ATRIUM  (Carl, 2026-08-02)
   ═══════════════════════════════════════════════════════════════════════════
   Carl, verbatim: "they should be flipped, the pool is outside, and the room
   should be connected to the entrance from the atrium. atrium is kinda like a
   hotel hallway where it connects all of the rooms, atrium has door to go into
   each of the room, so the 'villa' is attached, not detached like currently."

   So the enclave is ONE BUILDING. The atrium is its corridor; the ten keys hang
   off its four outer faces, each entered through a real door in the gallery
   wall, each with its pool/courtyard on the FAR side, away from the corridor.
   The presidential suite already worked this way (its north double doors open
   onto the south gallery through ATRIUM's portal) — the other ten now match.

   ── the frame ───────────────────────────────────────────────────────────────
   A room is authored as (face, along, type), where `along` is the coordinate of
   its centre-line ON that face — x for the north/south faces, z for east/west.
   Everything else is derived, because every number that was typed by hand here
   before is a number that drifted:

     · the room's back face sits on the atrium's OUTER wall face. atrium.js's
       perimeter facade is WALL_T thick and grows OUTWARD from the envelope, so
       the shared plane is envelope ± WALL_T — not the envelope itself. Landing
       on the envelope buries the room 0.3 m inside the corridor wall.
     · the villa yaw follows from the face. campus.js authors every key with
       local +Z as the FRONT (glazing, deck, plunge pool) and local −Z as the
       ENTRY, and water.js offsets each pool to local +Z off the same yaw. So
       pointing local −Z at the atrium is the whole of Carl's "flip": the front
       door lands on the gallery and the pool swings to the outside, in one
       number, in both files at once.

   ── which type sits where (Carl, 2026-08-01 — DO NOT REGRESS) ───────────────
   Facing the pool from the suite is local +Z, so LEFT is +X and RIGHT is −X.
     · the two 3-BR (type 2) are to the RIGHT of the suite  → the WEST face
     · the three 2-BR pool suites (type 1) are BEHIND the atrium → the NORTH face
     · the five Garden Rooms (type 0) take what is left — the EAST face and the
       stretch of the SOUTH face east of the suite, which is the only run of
       south wall the suite does not already occupy.
   Nothing sits on the ocean side, and nothing is placed at +Z beyond the pool
   deck: that ground is the hero view.

   ── the door positions ──────────────────────────────────────────────────────
   `doorAlong` is where the door is cut in the gallery wall. It is normally the
   room's centre-line, but it may be anywhere the room actually TOUCHES the
   wall — which is what lets the arms turn the corners: A2 runs 8 m south past
   the atrium's south-west corner and is entered near its north end, exactly as
   a real corridor serves a wing.                                              */

const _V = SITE.VILLA;
const _AWT = _V.wallT;
/* the atrium's OUTER wall faces — the plane each arm is built off */
const _AF = {
  west: SITE.ATRIUM.cx - SITE.ATRIUM.w / 2 - _AWT,    // -14.3
  east: SITE.ATRIUM.cx + SITE.ATRIUM.w / 2 + _AWT,    //  30.3
  north: SITE.ATRIUM.cz - SITE.ATRIUM.d / 2 - _AWT,   // -54.3
  south: SITE.ATRIUM.cz + SITE.ATRIUM.d / 2 + _AWT,   // -27.7
};

/* [face, along, doorAlong, type, id, no] */
const ROOM_SPEC = [
  // ── WEST face: the two 花园三卧套房 3-BR, RIGHT of the presidential suite.
  //    17 m wide each = 34 m against 26 m of wall, so the arm turns the
  //    south-west corner and A2 is entered near its north end.
  ['west', -48, -48, 2, 'A1', 1],
  ['west', -31, -33, 2, 'A2', 2],
  // ── NORTH face: the three 花园泳池双卧套房 2-BR pool suites, BEHIND the
  //    atrium. Their walled courtyards face north, away from everything.
  ['north', -6.6, -6.6, 1, 'B1', 3],
  ['north', 8.0, 8.0, 1, 'B2', 4],
  ['north', 22.6, 22.6, 1, 'B3', 5],
  // ── EAST face: three 花园客房 Garden Rooms; the arm turns the south-east
  //    corner so C3 is entered near its north end.
  ['east', -49.25, -49.25, 0, 'C1', 6],
  ['east', -39.35, -39.35, 0, 'C2', 7],
  ['east', -29.45, -29.45, 0, 'C3', 8],
  // ── SOUTH face, east of the presidential suite: the last two Garden Rooms.
  //    x ≥ 10.2 clears SITE.EXT_STAIR (x 8.2…9.8); x ≤ 30 meets the east arm.
  ['south', 15.15, 15.15, 0, 'D1', 9],
  ['south', 25.05, 25.05, 0, 'D2', 10],
];

/* ── the facade module grid, and why the door position is SNAPPED to it ──────
   atrium.js divides each perimeter wall into equal bays and a door gap drops a
   WHOLE bay, so the hole that ends up in the wall is centred on that bay — not
   on the coordinate the door was requested at, which can be half a bay (≈1.45 m)
   away. campus.js frames the room's own opening from the same number, so if the
   two disagree you get a doorway that is open in the corridor wall and blind in
   the room wall behind it. It does not fail loudly either: the collider gap
   still opens, so a walk test walks straight through a wall you cannot see out
   of. Snap once, here, and let both builders read the result.

   The three helpers below mirror atrium.js's `walls` table exactly:
     south  x = A.cx + lx      north  x = A.cx − lx
     west   z = A.cz + lx      east   z = A.cz − lx                          */
const _AT_ = SITE.ATRIUM;
const faceLen = f => (f === 'west' || f === 'east') ? _AT_.d : _AT_.w;
const faceLocal = (f, v) =>
  f === 'south' ? v - _AT_.cx : f === 'north' ? _AT_.cx - v
    : f === 'west' ? v - _AT_.cz : _AT_.cz - v;
const faceWorld = (f, lx) =>
  f === 'south' ? _AT_.cx + lx : f === 'north' ? _AT_.cx - lx
    : f === 'west' ? _AT_.cz + lx : _AT_.cz - lx;

/** Snap a requested door position to the centre of the facade bay it lands in.
 *  Returns the snapped coordinate on that face and the bay's width — which is
 *  the real width of the hole, and therefore how wide the room's reveal has to
 *  be before its own piers narrow it back down. */
export function snapDoor(face, along) {
  const len = faceLen(face);
  const n = Math.max(4, Math.round(len / _AT_.module));
  const mw = len / n;
  const lx = faceLocal(face, along);
  const i = Math.max(0, Math.min(n - 1, Math.floor((lx + len / 2) / mw)));
  return { along: faceWorld(face, -len / 2 + (i + .5) * mw), width: mw };
}

/** outward unit normal of each face, in enclave-local space */
const FACE_OUT = { west: [-1, 0], east: [1, 0], north: [0, -1], south: [0, 1] };
/** villa yaw that points local −Z (the entry) AT the atrium.
 *  campus.js maps local (lx,lz) → (vx + lx·cos + lz·sin, vz − lx·sin + lz·cos);
 *  local (0,−1) therefore lands on (−sin ry, −cos ry), which must equal the
 *  INWARD normal. Solve per face — do not guess these, the sign has bitten
 *  this project twice. */
const FACE_YAW = { west: -Math.PI / 2, east: Math.PI / 2, north: Math.PI, south: 0 };

export const ROOMS = ROOM_SPEC.map(([face, along, doorReq, type, id, no]) => {
  const w = type === 2 ? _V.w2 : type === 1 ? _V.w1 : _V.w0;   // along the wall
  const d = type === 2 ? _V.d2 : type === 1 ? _V.d1 : _V.d0;   // outward
  const h = type === 2 ? _V.h2 : _V.h;
  const door = snapDoor(face, doorReq);
  const doorAlong = door.along;
  const [ox, oz] = FACE_OUT[face];
  const back = _AF[face];
  const horiz = face === 'west' || face === 'east';
  /* centre = back face pushed d/2 outward */
  const x = horiz ? back + ox * d / 2 : along;
  const z = horiz ? along : back + oz * d / 2;
  /* axis-aligned footprint. The walkable rect reaches WALL_T back past the
     shared plane to the atrium's inner face, so the height field has no seam
     under the threshold — a 0.3 m hole at 3.6 m is a fall, not a doorstep. */
  const hw = w / 2, hd = d / 2;
  const box = horiz
    ? { x0: Math.min(back, back + ox * d), x1: Math.max(back, back + ox * d),
      z0: along - hw, z1: along + hw }
    : { x0: along - hw, x1: along + hw,
      z0: Math.min(back, back + oz * d), z1: Math.max(back, back + oz * d) };
  const walk = horiz
    ? { ...box, x0: Math.min(box.x0, back - ox * _AWT), x1: Math.max(box.x1, back - ox * _AWT) }
    : { ...box, z0: Math.min(box.z0, back - oz * _AWT), z1: Math.max(box.z1, back - oz * _AWT) };
  return {
    id, no, type, face, along, doorAlong, doorWidth: door.width,
    x, z, ry: FACE_YAW[face], w, d, h,
    out: [ox, oz], back, box, walk,
    floors: type === 2 ? 2 : 1,
  };
});

/* The snap must not push a door off its own room. It cannot with the current
   table, but the table is meant to be edited, and a door that lands on the
   neighbour's wall is silent — so say so out loud in the console rather than
   shipping a room nobody can get into. */
for (const r of ROOMS) {
  const lo = r.doorAlong - r.doorWidth / 2, hi = r.doorAlong + r.doorWidth / 2;
  const span = (r.face === 'west' || r.face === 'east')
    ? [r.box.z0, r.box.z1] : [r.box.x0, r.box.x1];
  if (lo < span[0] - 1e-6 || hi > span[1] + 1e-6) {
    console.warn(`[site] room ${r.id}: its gallery door (${lo.toFixed(2)}…${hi.toFixed(2)}) `
      + `runs off its own frontage (${span[0].toFixed(2)}…${span[1].toFixed(2)})`);
  }
}

/* the contract campus.js and water.js still consume: [x, z, rotationY, type] */
SITE.VILLAS = ROOMS.map(r => [r.x, r.z, r.ry, r.type]);

/** What atrium.js needs: one door per key, on a named face, at a coordinate
 *  along that face (x for north/south, z for east/west), on `floors` levels. */
export const ROOM_DOORS = ROOMS.map(r => ({
  id: r.id, no: r.no, face: r.face, along: r.doorAlong, floors: r.floors,
}));

/** Planting keep-outs. nature.js's exclusionZones() used to derive these from a
 *  villa centre ± (VILLA.w + 7), which was already loose and is now simply
 *  wrong: a 2-BR's courtyard reaches 18 m out on ONE side only. These are the
 *  real asymmetric envelopes — room, deck, courtyard and plunge pool — in
 *  enclave-local space, which is the frame nature tests candidates in. */
const _REACH = { 0: 12.5, 1: 18.5, 2: 15.5 };     // metres outward from centre
export const VILLA_ZONES = ROOMS.map(r => {
  const reach = _REACH[r.type], lat = r.w / 2 + 1.5;
  const horiz = r.face === 'west' || r.face === 'east';
  const fx = horiz ? r.x + r.out[0] * reach : r.x;
  const fz = horiz ? r.z : r.z + r.out[1] * reach;
  return {
    x0: horiz ? Math.min(r.back, fx) : r.x - lat,
    x1: horiz ? Math.max(r.back, fx) : r.x + lat,
    z0: horiz ? r.z - lat : Math.min(r.back, fz),
    z1: horiz ? r.z + lat : Math.max(r.back, fz),
  };
}).map(b => ({
  cx: (b.x0 + b.x1) / 2, cz: (b.z0 + b.z1) / 2,
  w: b.x1 - b.x0, d: b.z1 - b.z0,
}));

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

   ── MOVED 2026-08-02, THE PROPORTION PASS (Carl) ────────────────────────────
   *"you can move the entire clubhouse complex down to the free space?"* — the
   enclave sat in the top-left of his top-down with a large empty area under it,
   and the campus read as a corner rather than as one resort.

   ox −58 → −34, oz 34 → 74. That is +24 m EAST and +40 m SOUTH, and both halves
   are measured off westin-site-map.jpeg rather than nudged (0.45 m/px, the
   crescent's arc centre and the sand's inland edge as the two anchors):

     · SOUTH +40. In the aerial the clubhouse sits 32…102 m south of the arc
       centre's latitude, tucked UNDER the resort's east–west water band, which
       runs level with that centre. Ours straddled the band at z −32…74. It now
       occupies z ≈ 8…114 against an arc centre at z 10 — the aerial's
       relationship, and the empty ground Carl was pointing at.
     · EAST +24. The aerial puts ~46 m of palm between the sand and the
       clubhouse's own lawn; BEACH_LAWN's seaward edge was 3 m off the sand, so
       the ceremony was effectively on the beach with no grove behind it. It is
       27 m now, which is what reference/photos/clubhouse-lawn-to-beach.png
       shows — "a huge flat lawn running to a DENSE PALM GROVE, then beach, then
       open sea". It also pulls the clubhouse toward the water system, so the
       campus composes as one place.

   ⚠ This is a rigid-body move and the architecture is built for it: geometry
   follows the group, colliders are rewritten through enclaveToWorld, the
   walkable height field maps its query point rather than its regions, and
   MOMENT_PLACES / INTRO_PATH are derived. Three things are NOT derived and were
   checked by hand: SITE.RESORT_VILLAS' `skip()` envelope (world coords),
   SITE.BOUNDS, and the fact that isEnclaveLocal() is stated in LOCAL
   coordinates and is therefore invariant under ox/oz — which is the only reason
   this is a two-number change and not a hunt.

   The resulting hero geometry: suite centre (−38, 74), pool centre (−43, 74)
   with its long axis running west, atrium east at (7, 82), 酒廊 lounge north at
   (−18, 30), beachfront ceremony lawn west at (−100, 52).
   ═══════════════════════════════════════════════════════════════════════════ */
export const ENCLAVE = {
  rotY: -Math.PI / 2,       // 90° CLOCKWISE seen from above
  ox: -34,                  // …then west toward the beach
  oz: 74,                   // …and south toward the bottom of the map
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

  /* ══ the cabana boardwalk ═════════════════════════════════════════════════
     CAME HOME 2026-08-02. This lived in world.js as `boardwalkY()`, a hand
     patch bolted on top of siteFloorY with its own worldToEnclave call and its
     own copy of the resolution rule — put there only because the pass that
     found the bug did not own site.js. It was flagged in CLAUDE.md's polish
     backlog as a lodger, with the exact rect to paste. This is that rect,
     derived rather than typed.
     What it fixes: water.js's buildPavilions lays a timber deck with its top at
     y 0.30 behind the cabana run — local x ±(HALF + 1.4), z −0.1…2.4 — inside a
     group rotated +π/2 and parked at (CABANAS.x, (z0 + z1)/2), so the group's
     local (x, z) maps to enclave (CB.x + z, cz − x). Nothing covered it, floorY
     answered 0, and a walker crossing the planks sank to the shins.
     The two stone steps off the suite end are below 0.30 and inside CFG.STEP_UP
     of the deck, so they need no entry of their own — the lip is climbable from
     anywhere, which is why this is one rect and not three. */
  rect('cabana-boardwalk',
    SITE.CABANAS.x - 0.1, (SITE.CABANAS.z0 + SITE.CABANAS.z1) / 2 - ((SITE.CABANAS.z1 - SITE.CABANAS.z0) / 2 + 1.4),
    SITE.CABANAS.x + 2.4, (SITE.CABANAS.z0 + SITE.CABANAS.z1) / 2 + ((SITE.CABANAS.z1 - SITE.CABANAS.z0) / 2 + 1.4),
    0.30),

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

  /* ══ the ten guest keys ═══════════════════════════════════════════════════
     Their finished floor is VILLA.floorY over the gallery datum — one threshold
     step, deliberately under CFG.STEP_UP so walking in from the corridor needs
     no ramp. Each rect reaches WALL_T back through the shared wall so there is
     no unfloored seam under the doorway; the wall's own collider is what stops
     you standing in it.
     The two 3-BR keys get a SECOND storey at ATRIUM.floorH, level with the
     upper gallery, because that is the floor their 2F door opens off. Its
     `ceil` gates the 1F: without it the head-room test would happily let you
     climb from the ground floor onto the slab above your head. */
  ...ROOMS.flatMap(r => {
    const oneFloor = r.floors === 1;
    const ceil1 = (oneFloor ? r.h : _V.floorH2) - 0.3;
    const out = [rect(`room-${r.id}`, r.walk.x0, r.walk.z0, r.walk.x1, r.walk.z1,
      _V.floorY, { ceil: ceil1 })];
    if (!oneFloor) {
      out.push(rect(`room-${r.id}-2f`, r.walk.x0, r.walk.z0, r.walk.x1, r.walk.z1,
        _V.floorH2, { ceil: r.h - 0.3, t: 0.3 }));
    }
    return out;
  }),

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
         deck; without it you climb all three and fall straight back in.

     ⚠ 2026-08-02, when the water moved to the parapet: the hole and the basin
     both start at `rIn − 0.3`, NOT at `poolIn`. `poolIn` is 0.10 m outside the
     terrace's own inner edge now, so keying either off it left a 0.10 m ring of
     annulus that was punched out of the deck and not covered by the basin —
     i.e. a slot around the whole infinity edge where floorY fell through to the
     ground 26 m below. Nothing walkable exists at r < rIn, so over-covering
     inward is free; under-covering is a hole in the roof. */
  annulus('hotel-roof-deck', HOTEL_ROOF.cx, HOTEL_ROOF.cz, _R.rIn, _R.rOut,
    _RC, _R.arcHalf, _R.deckY,
    { aholes: [{ r0: _R.rIn - .3, r1: _R.poolOut, tc: _RC, th: _R.poolArcHalf }] }),
  annulus('hotel-roof-pool', HOTEL_ROOF.cx, HOTEL_ROOF.cz, _R.rIn - .3, _R.poolOut,
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
  /* CEREMONY — the private beachfront lawn, at the BACK of the aisle looking
     UP it, i.e. local +Z, which is world WEST and therefore straight out to
     sea. yaw = π, because player.js builds fwd as (−sin y, 0, −cos y): π gives
     (0, 0, +1). (yaw 0 would face −Z, back at the clubhouse — which is what the
     old spawn did, on the old lawn, and is why the blurb's "an arch with the
     sea behind it" had been a lie since the enclave rotated.)
     z must sit BEHIND the last row: moments.js lays the five rows at z 62…66
     and the arch at z 71, so 59 is 3 m clear of the back row and 12 m from the
     arch — close enough for it to have real presence, far enough to read the
     whole aisle. Anything in 62…66 spawns you inside the seating. */
  CEREMONY:   { x: -22, z: 59, yaw: Math.PI },
  /* COCKTAIL — the SAME lawn, 26 m east along it, so the two moments are
     spatially distinct without either leaving the beachfront. Facing +Z at the
     bar (z 68) with the sea past it. */
  COCKTAIL:   { x: 4, z: 58.5, yaw: Math.PI },
  /* DINNER — on the INNER of the two pool lawns, at its landward end looking
     +Z up the length of it. Facing +Z puts the lit hero pool on your LEFT
     (local +X) and the outer lawn with its own four tables on your RIGHT.
     2 m inside the lawn's z0 (−5) and ~5.8 m off the nearest round. */
  DINNER:     { x: -17, z: -3, yaw: Math.PI },
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
