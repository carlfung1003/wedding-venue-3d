# CLAUDE.md — wedding-venue-3d (The Big Day)

First-person 3D walkthrough of Carl & Rachel's wedding venue — **The Westin
Sanya Haitang Bay, 隐逸居 (Yinyiju) clubhouse enclave** — told as five
"moments" of the wedding day. Three.js r180 via CDN importmap — pure static
HTML/CSS/JS, **no build step**, no dependencies.

Run it: `python3 serve.py` → http://localhost:8799 (`file://` won't load ES modules)

The whole campus is modelled from Carl's own reference material: the suite
walkthrough video, the enclave aerials, the atrium photo and the hotel's
隐逸居 deck. **Nothing is a stock ballroom any more** — if a proportion looks
wrong, check the briefs in `reference/` before changing it.

## Architecture

**`js/site.js` is the master site plan** — the single source of coordinate
truth. Every builder reads its footprint from `SITE.*`; no module invents its
own coordinates. Change the layout there, never in a builder.

| File | Owns |
|------|------|
| `js/site.js` | **The master site plan.** `SITE.*` footprints for the suite, deck, pool, cabanas, atrium, lounge, the grass ground (`GRAND_LAWN` / `BEACH_LAWN` / `DINNER_LAWNS` / `DINNER_WALK` / `FIRE_PIT`), lagoon, palm grove, beach, ocean, hotel crescent. The ten guest keys are DERIVED here from `ROOM_SPEC` → `ROOMS` / `SITE.VILLAS` / `ROOM_DOORS` / `VILLA_ZONES`, with `snapDoor()` putting every gallery door on the atrium's facade grid. Plus `siteFloorY(x,z)`, `MOMENT_PLACES` (spawns) and `INTRO_PATH` (the opening dive). |
| `js/config.js` | ALL tuning — walk + fly feel, camera, the intro orbit/dive, day-vs-night lighting levels, the `MOMENTS` table. No magic numbers elsewhere, and **no coordinates** (those are site.js). |
| `js/main.js` | Renderer bootstrap (PMREM RoomEnvironment, sRGB, ACES), the `G` context object, `G.setMode`/`G.toggleMode` (walk ↔ fly), the begin→dive flow, N-key night toggle, resize, clock loop, `window.__game` debug hook |
| `js/world.js` | **The integrator.** Builds nothing itself: calls each builder in order, owns `floorY(x,z)` (delegates to `siteFloorY`), owns the day↔night fan-out (`setNight`/`toggleNight`), and runs `G.tickers` each frame. |
| `js/sky.js` | Sky dome (day + night gradients), sun/moon, stars, fog, and the whole global lighting rig |
| `js/nature.js` | Ground, beach, animated ocean, the palm population, hedges, topiary, bougainvillea |
| `js/water.js` | The hero pool (raised plinth, infinity edge, caustics), **the floating lanterns**, the deck + turf + "THE WESTIN" letters, cabana pavilions, loungers, lounge pool, lagoon, villa plunge pools |
| `js/campus.js` | The 隐逸居 lounge, the ten guest keys (3 real types — **walk-in rooms attached to the atrium**, hollow, private side facing out), **the grass ground** (`buildGrassGround` — the mown lawn panels, the spine + cross paths, the planted terrace edge, the fire pit), event plaza, pergola, signage pillar, arrival road, and the main Westin crescent backdrop |
| `js/atrium.js` | The clubhouse's central courtyard AND its corridor — timber-soffit galleries on black stone columns, black mirror ponds in gravel, cloud topiary, the copper-handrail stair, and the **ten real guest-room doors** (`buildRoomDoor`) with their lit number plaques |
| `js/suite.js` | The presidential suite, inside and out — folding glass wall, great room, dining, pantry, the L-stair with its chandelier, the spa, the 2F lounge and balcony |
| `js/introcam.js` | The opening: a drone orbit of the enclave behind the title card, then a bezier dive over the pool and in through the glass wall, handing the look state to `player.js` on landing |
| `js/materials.js` | Shared CanvasTexture recipes + `M.*`; also exports `mulberry32` (seeded PRNG). Builders define their own local materials — only `mulberry32` is universally imported. |
| `js/moments.js` | The six moment prop groups + per-moment colliders, the one-interactable-per-moment registry, `G.setMoment` (dress + collider swap + night flip + teleport) |
| `js/player.js` | Ported from lassen-camp: pointer-lock FPS look (module-level yaw/pitch), Tab cursor mode, nearest-interactable prompt, and BOTH movement modes — walk (WASD + stick, walk/run, `{x,z,r}` cylinder collision, `floorY` eye-height clamp) and fly (spectator flight along the look direction, Space/C altitude, no collisions, altitude clamp) |
| `js/touch.js` | Ported from lassen-camp: floating joystick → `touchInput`, drag-to-look, quick-tap interact, `.tbtn` buttons (✦ interact, FLY toggle, held ▲▼ in fly mode). Pointer lock bypassed entirely in touch mode. |
| `js/ui.js` | Overlay show/hide, moment chips + active state, toast queue, prompt — plain id-addressed divs toggled with `.hidden` |

## Reference assets

`reference/` media is **gitignored — personal photos/videos/PDFs never get
committed**. Derived text briefs (`reference/**/*.md`) ARE committed — they
are the modeling source of truth. Library as of 2026-08-01 (masters live in
`~/Desktop/Wedding App/`, more there if needed — drone trims, dawn/bar
video, pool videos):

- `reference/video/suite-walkthrough.mp4` — Carl's 94 s phone walkthrough,
  2F → stairs → 1F living/kitchen → out to the pool deck. Frames extracted
  every 1.5 s in `reference/video/frames/` (63 × jpg).
- `reference/video/presidential-suite-1f.mp4` + `presidential-suite-2f-rooms.mp4`
  — the hotel's own per-floor suite tours.
- `reference/video/villa-{1br,1br-2beds,2br-pool,3br}.mp4` — the surrounding
  guest villas (guests + possibly moment locations).
- `reference/video/westin-day-drone.mp4` — daytime drone of the resort.
- `reference/photos/` — `clubhouse-aerial.jpeg`, `westin-site-map.jpeg`
  (full top-down site plan), `cocktail pic.jpeg` + `cocktails samples.jpeg`
  (cocktail-hour dressing reference). Couple photos still to come.
- `reference/docs/clubhouse-intro.pdf` — the hotel's 隐逸居 clubhouse intro
  deck. No floor plans; spec tables + photos.
- `reference/clubhouse-pdf-brief.md` (committed) — distilled from the deck:
  隐逸居 = 3,500 ㎡, 11 keys in 4 building types; presidential suite 588 ㎡
  two-storey; 酒廊 lounge 280 ㎡ / seats 60 with folding glass walls to the
  pool terrace (wedding-dinner candidate); signature white portal-frame
  cabanas + slatted lanterns along the presidential pool; palette = dark
  mahogany, cream marble, copper fascias.
- `reference/suite-interior-brief.md` (committed) — modeling brief distilled
  from the walkthrough frames.
- **`reference/photos/hotel-*.webp` + `reference/video/hotel-frames/`** —
  imported 2026-08-02 from `~/Desktop/Wedding App/`: the main crescent's two
  elevations (`hotel-westin-hotel-back` = the garden/concave face, the one the
  campus sees; `hotel-westin-hotel-front` = the arrival face + porte-cochère),
  plus 59 frames from the dawn/bar clip, the 87 MB screen recording and the
  five drone trims. The dusk and night elevations (`trim1_002`, `dawn_001`,
  `dawn_017`) are at roughly the distance the venue renders the hotel at.
- **`reference/hotel-facade-brief.md` (committed)** — what those elevations
  actually show, storey by storey, and how `buildHotel()` spends its budget.
  The crescent had been modelled from an aerial and was wrong; this is the
  record so it is not re-guessed.

**Rebuild `world.js` + `CFG` venue dimensions from these** — room
proportions, finishes, where the doors actually are. The moment system,
controls and UI stay.

## Venue brief (Carl's reference photos, 2026-08-01)

Supersedes the generic indoor-ballroom assumption the placeholder was built
on. Facts from Carl's photos (all arrived — clubhouse aerial + full resort
site map are in `reference/photos/`). Future sessions model from THIS, not
from the placeholder:

- **Venue**: **The Westin Sanya Haitang Bay** — the 隐逸居 (Yinyiju)
  clubhouse enclave: the presidential suite plus ALL surrounding villas are
  reserved for the wedding. Beachfront resort: palm grove, long beach, open
  ocean beyond the grounds. Confirmed against `~/projects/wedding-app`,
  which is the canonical source for names, dates and schedule copy.
- **Dates (from wedding-app)**: wedding day **2027-03-20** (ceremony
  ~16:30 CST); prewedding welcome party **2027-03-19 21:30** — the
  night-pool event at the suite; after party **2027-03-20 21:00**. The
  title-card kicker and `CFG.SEED` (20270320) carry the date. ⚠️ Do NOT use
  01.11.2026 anywhere — that is Sarah & Michael's wedding
  (sarah-michael-site), a different project.
- **Presidential suite (prewedding venue)**: modern two-storey villa. Wide
  cantilevered flat roof with a copper/bronze fascia; both floors fully
  glazed with folding glass door walls; upper balcony with a glass
  balustrade and a white outdoor dining set. The ground-floor living room
  opens DIRECTLY onto a huge infinity pool that runs edge-to-edge up to the
  building; white minimalist stucco volumes flank the pool; palms behind.
  **Prewedding happens at night**, with indoor/outdoor flow between living
  room and pool deck; the pool is lit with big glowing floating
  lights/lanterns on the water — **this is the signature shot**.
- **Bird's-eye of the reserved area**: a cluster of flat-metal-roof
  pavilions/villas (white walls, timber decks, private plunge pools, blue
  umbrellas, pink bougainvillea); a large **circular event lawn** ringed by
  hedges and palms NW of the buildings; rectangular pools with white cabana
  blocks by the clubhouse; a big **free-form lagoon pool** with sand-colored
  deck and blue umbrellas on the east side; a palm grove between the grounds
  and the beach; driveway/parking inland.
- **Full resort site map** (`westin-site-map.jpeg`, top-down, beach = west):
  the main Westin hotel is a huge crescent-shaped building with terraced
  roofs on the inland (east) edge, entry road along the south. A
  **serpentine lagoon pool** snakes east–west through the middle of the
  campus from the hotel toward the beach, ending near a **large circular
  pool** by the beach lawn. The north half is a grid of dozens of detached
  villas with plunge pools threaded by curving paths. The beach-side lawn at
  the NW shows the resort's **beach-lawn wedding setup** (white chair grid
  with a center aisle). The clubhouse enclave — named **隐逸居** per the
  hotel's intro deck — containing the presidential suite sits in the SW
  quadrant near the beach.
- **Phase 2 plan**: the current indoor-ballroom placeholder world gets
  **REPLACED** by this outdoor campus — presidential suite + lit pool, villa
  cluster, circular lawn, lagoon pool, palm grove, beach, ocean, with the
  crescent hotel as a backdrop for fly mode. Likely moment remap:
  Prewedding → presidential-suite pool at night; Ceremony candidates are the
  circular lawn or the map's beach-lawn chair setup; Cocktail Hour near the
  clubhouse pools (see `cocktail pic.jpeg`); Dinner / After-party **TBC with
  Carl**.

## Moments

Keys 1–6 or the chip bar switch moments: instant dress + collider swap +
teleport to the moment's spawn.

| # | Moment | Space | Date | Dressing |
|---|--------|-------|------|----------|
| 1 | Welcome Brunch | The Westin Rooftop | 03-18 | the eight existing four-tops dressed (linen, settings, blooms, chair slips + sashes), a buffet run and a champagne service on the teak, a menu easel at the bridge |
| 2 | Prewedding Setup | Presidential Suite | 03-19 | high-tops on the deck, festoon runs, welcome easel, champagne tower |
| 3 | Ceremony | The Beachfront Lawn | 03-20 | 60 white chairs facing the sea, aisle runner + petals, a 4.8 m dressed arch on stone bases, two urns |
| 4 | Cocktail Hour | The Beachfront Lawn | 03-20 | same lawn 26 m east: a 6 m bar, eight high-tops, three teal parasols, festoon on poles |
| 5 | Wedding Dinner | The Pool Lawns | 03-20 | eight rounds of EIGHT (64 covers) across the two lawns, head table + dance floor on the walk between them, festoon on poles |
| 6 | After Party | Suite Pool Deck | 03-20 | DJ booth, speakers, mirror ball, lounges, string lights |

**The order is CHRONOLOGICAL and the chip bar is read as a timeline** — the
Welcome Brunch is two days before the wedding, so it is index 0 and everything
else shifted by one on 2026-08-02. Nothing may hold a raw moment index:
`config.js` exports `momentIndex(id)`, `main.js` resolves the title-card
backdrop and the post-dive landing through it, and `moments.js` gates its
interactables on ids. Insert a moment where it belongs in time; do not append
one to protect an index.

**The shared-ballroom redress is the core design.** Ceremony and Wedding
Dinner are the *same room* wearing different prop groups — exactly what a
hotel does between 4 pm and 6 pm on a real wedding day. Every moment's props
are built once in `initMoments` and toggled with `.visible`; nothing is
rebuilt on switch.

## Rachel's photos (2026-08-01) — the best references we have

`reference/photos/IMG_80*.jpg` + `reference/video/IMG_81*.MOV`, converted from
HEIC (they import sideways — `sips` keeps the EXIF rotation, so rotate 90° in
your head when reading them). The clubhouse's actual name is **The Serene
Retreat**. Two of these settle open questions, and one contradicts a spec we
were building to:

- **IMG_8099 — the pool and its cabanas, ground level.** The cabanas are
  **solid white stepped blocks with small punched rectangular window slots**,
  each carrying a `THE WESTIN` mark — they are NOT the open post-and-beam
  portal frames the hotel's p14 close-up suggested, and which `water.js`
  currently builds. The near long side is lawn with a **black pebble trough**
  at the water's edge; loungers sit at the far end near the building. Fixing
  `buildPavilions` to solid stepped blocks is the next real job.
- **IMG_8096 — the pool seen from inside the 1F great room.** ⚠️ **Unresolved:**
  in this frame the pool appears to run roughly PARALLEL to the glass wall
  (lawn strip → water → the WESTIN cabana blocks → palms), which is the wide
  view. Carl's explicit instruction was the opposite — narrow view, pool
  running away from the suite — and `SITE.POOL` is now built that way
  (`w:10, d:25`). Carl has been there and the photo is rotated and oblique, so
  his instruction wins until he says otherwise, but **ask before spending
  effort here**: if the pool really is parallel, `SITE.POOL` reverts to
  `w:25, d:10` and the CABANAS/LOUNGERS runs go back to `{x0,x1,z}`.
  (Ignore the sofa arrangement in that photo — Carl says it is not current.)
- **IMG_8093** — pool from the stair. **IMG_8095** — pool from the stair view.
  **IMG_8102** — another atrium angle.

## What this project is FOR (Carl, 2026-08-02) — the priority order

> *"my take is the goal should highlight the club house, the hotel build
> itself and the water features. I care less about any other random building
> blocks right now."*

**Three heroes: the 隐逸居 clubhouse enclave, the Westin crescent, the water
system.** Everything else — the ~50 `SITE.RESORT_VILLAS`, the road, the
parking — is context. When they conflict, the heroes win: move, thin or delete
backdrop villas rather than let them constrain the composition or the scale of
the crescent. Spend triangles and draw calls on the three, not on the field.

This is a *judgement* rule, not a layout rule — it tells you what to trade
when two corrections disagree.

## SESSION HANDOFF — read this if you are picking the project up cold

Everything below the architecture table is here because it was learned the hard
way. Orientation, in the order it will save you time:

1. **The five traps**, in Gotchas: the `+Z`/left sign; walk-don't-render; y-agnostic
   colliders; the light-count shader recompile; NaN failing silently.
2. **"Layout corrections from Carl"** — he has been to the venue. When his account
   and a reference photo disagree, HE WINS. Every entry there was a real error.
3. **The work queue** and the **polish backlog** — what's done, what's next, and
   the small known things nobody has got to.
4. `reference/*.md` are committed briefs distilled from gitignored media. ⚠️
   `suite-interior-brief.md` §4 is MIRRORED — banner-flagged, cost four bugs.

**Working method that held up:** one agent per job with **strict file ownership**
(two agents in one file corrupted a build; a third left the page unable to
parse). Hand it the reference photo, the constraints, and demand evidence —
walk tests, before/after numbers, side-by-side screenshots. Agents were killed
mid-edit repeatedly, so **syntax-check every file and boot headless before you
commit**, and never trust a "done" report without its evidence attached.

**Deploy:** `vercel --prod --yes` from the repo. It sometimes aliases to the
project URL rather than the domain — **always curl `venue.carlfung.dev` and
confirm it serves the new build.**

## THE WATER POSITION PASS — DONE 2026-08-02

> *"referencing to the bird's-eye view map, the water feature is a lot closer to
> the actual one, but you can see that it still needs some fine tuning in terms
> of the position."* — Carl, with `reference/photos/resort-true-proportions-2.png`
> beside `build-after-proportion-night.png`

**`js/site.js` only** — `SITE.RIVER.{WEST,BAR,SPINE,MID,SPUR,EAST,EAST2,BRIDGES,PATHS}`,
`SITE.LAGOON`, `SITE.HOTEL_POOLS`, and the villa `skip()` z-band. Nothing else was
touched: no builder, no geometry, no villa moved or deleted, the crescent
untouched (`arc` 2.35 / `r` 95), `SITE.BEACH` untouched.

The deliverable is **`reference/photos/compare-water-position-2026-08-02.png`** —
reality, before and after stacked at an IDENTICAL world rectangle, pixel for pixel.
Also `build-water-position-topdown-2026-08-02.png` (+ `-night`) and
`build-river-unbroken-water-position-2026-08-02.png`.

### The ruler, and why it is trustworthy this time

`resort-true-proportions-2.png` **is `westin-site-map.jpeg` at 2× zoom** — SIFT +
RANSAC over the pair returns a pure similarity `A = 0.5·B + (298.878, 226.879)`,
**2795 of 2848 matches inlying, rotation 1.5 × 10⁻⁵ °**. Same photograph, twice
the resolution, so the old 0.45 m/px calibration carries straight over.

Anchored on **two** things instead of one:
- the sand's inland edge (aerial u 89 ↔ `SITE.BEACH.x1` = −136), and
- the crescent's concave face at its centre bearing (aerial u 1801 ↔ 156 + `rIn` 84).

That gives **0.21957 m/px**, 2.4 % off the 0.225 a pure 2× would give — the model's
campus is 2.4 % narrower than the photograph across a 376 m baseline. Two
independent checks came out inside a metre of the model: the sand edge lands at
world **−138.6** against `BEACH.x1` −136, and the presidential pool measures
**22.8 × 9.7 m** against the built 25.3 × 11.0.

⚠ **The previous pass's crescent circle fit does NOT reproduce.** Re-fitting on
the 2× frame — RANSAC over 61k white perimeter pixels, 6194 inliers — puts the
arc centre at aerial (1481.4, 289.6) with the building's OUTER white edge at
**474.7 px = 106.8 m**, against the model's outer radius of `r + DEP/2` = 106.
**The radius and the depth are right; the CENTRE is ~19 m east of where the model
puts it**, and a radial profile about that centre finds the guest-room mass at
72…94.5 m rather than the model's 84…106. This is why the ruler is anchored on
the FACE and not on the centre — and it is a real, unresolved discrepancy in the
crescent, left alone here because `r` is load-bearing (see the proportion pass).

### What was wrong, measured

| | reality (world) | build before | build after |
|---|---|---|---|
| beach pool centre | **(−45.2, +11.5)**, water r 17.0 | (−83.2, −28.2) — **55.4 m off** | (−46, −14) — **25.6 m off**, all of it z |
| water-edge → sand | 73 m | 37 m (it was ON the beach) | 74.8 m |
| crook basin mass centroid | **(153.8, +13.6)**, 1635 m² over x 118…190, z −36…+50 | (135.1, +28.6) — **24.3 m off** | (157.7, +11.9) — **4.4 m off** |
| the band's slope W→E | z +2 at x 0 → **−7.6** at x 110 (**−24 m, NORTH**) | z −24 → **+33** (**+57 m, SOUTH**) | z +1.9 → −7.6 (on the measurement) |
| water hugging the face | **all of it at +9°…+60° bearing** (south of centre); the north crook is 3 m² | three lobes at −20°/0°/+20° — one stood in the empty half | +9.2° / +28.6° / +48.1° |

**The headline finding: the system was rotated the wrong way about its own
middle.** The real river leaves the beach pool at z ≈ +2, holds z +4…+9 for 80 m
and then climbs NORTH to −7.6 before opening into the crook. Ours sloped SOUTH
by 57 m over the same ground. That, and not any single feature's offset, is what
Carl was looking at.

### What moved

- **`RIVER.WEST` (−84, −28) → (−46, −14)**, `BAR` with it (same rim offset).
- **`RIVER.SPINE` re-laid on the photograph**, 40 pts / ~288 m → 31 pts / 198 m.
  Sixteen of the new z values are tracked points off the aerial and are quoted
  in the source beside the line they set. The channel WIDTHS are unchanged —
  Carl verified those against `lazy-river-closeup.png` and only the line moved.
- **`RIVER.MID` (115, 26) → (106, −6)** — the river's northern extreme, which is
  where the aerial's channel is genuinely widest (6…7 m half-width).
- **`SITE.LAGOON` (134, 33) → (152, 12)**, size untouched. (152, 12) is also, by
  construction, the crescent's own arc-centre z — the building curves around it.
- **`RIVER.EAST` (147, 13) → (184, 13)** — the aerial's round drum pool measures
  13.2 × 13.6 m centred on (183.6, 13.7). At 147 it would now be inside the lagoon.
- **`RIVER.EAST2` (160.5, 26.5) → (208, 20)**. The aerial says (213.8, 16.6); 208
  is 6 m short so its sand deck only just touches `HOTEL_POOLS[0]`'s instead of
  driving into it — two `DECK_Y`/`BASIN_Y` surfaces at one y z-fight.
- **`SITE.HOTEL_POOLS` swung SOUTH along the face**, bearings −0.345/0/+0.345 →
  **−0.16/−0.50/−0.84 rad**. Radii unchanged (69/71/69), so they still hug the
  podium. ⚠ **SIGN:** `cz = acz + cos(π/2 + d)·r` is `acz − sin(d)·r`, so a
  NEGATIVE `d` is SOUTH. Getting this backwards puts all three in the empty half.
- **`RIVER.SPUR` re-laid** (14 → 11 pts, 77 m) — it threads the same four basins.
- **`BRIDGES` re-solved** against the new arc lengths and each `t` checked to land
  on OPEN CHANNEL, not inside a basin: spine .12/.28/.44/.58/.70/.86, spur
  .15/.32/.66. **A bridge is the only GAP in the collider chain** — a reach
  without one is a wall across the campus.
- **`PATHS` both re-laid.** [0] follows the bank 8…11 m south of the water and
  then swings SOUTH around the lagoon (which now sits where the old path ran);
  [1] is genuinely the northern loop again, threaded between the water's northern
  extreme and the NORTH villa field's z −28 row. At `PATH_Y` .060 against
  `BASIN_Y` .045 a stray control point DRAWS OVER the water, so every one was
  checked against the new basin ellipses plus their decks.
- **`RESORT_VILLAS.skip()`** z band −8…46 → −14…40 (and x < 175 → 200) to track
  the water. **It removes no villas** — NORTH stops at z −28, SOUTH-EAST starts at
  z 66 — it is there so a future move of either field can't drop one in the lagoon.

**No villa was moved or deleted, and none needed to be.** Both fields already
frame the new water; the crescent-polar `skip` test is untouched.

### The 25.6 m that is left in the beach pool, and whose fault it is

The pool's x is dead on the measurement. Its z is **25.6 m north** of it, and that
is a clearance, not a compromise on the reading: `SITE.LOUNGE_POOL` sits at world
x −54.5…−30.4, z 9…24.4, and a 20.8 m deck centred on the measured z +11.6 is
built straight through it. At cz −14 there are 2.2 m to spare.

**The residual is exactly the clubhouse's own error.** Measured on the same
frame, the presidential pool is at **(−39.2, +96.2)** against our (−34, 74) — the
whole enclave sits **~22 m north** of where the photograph puts it. `ENCLAVE.oz`
74 → ~96 would release this pool and close the last visible gap in the top-down.
It was not done here: the enclave move is not what Carl asked for, he approved
the current position, and it re-opens every spawn and walk test.

### Verified — headless Playwright, zero page errors, zero console errors or warnings

- **Rooftop, exact.** Brunch spawn feet **26.600**; walk west, feet **25.320**;
  strafe both ways, still 25.320; walk back, "Pour a glass" fires. `floorY` at
  DERIVED polar points (never literals) at five bearings θ = −0.9 / −0.45 / 0 /
  +0.34 / +0.9: deck **26.600**, pool basin **25.320**, infinity lip **25.320**,
  inland deck **26.600**, stair-tower ground **0.000**.
- **All six moments** switch, dress, night-flip and spawn flat with **zero
  first-frame drift**: brunch 26.600, the other five 0.000.
- **Suite spawn → out through the folding glass** onto the turf, feet 0.000 the
  whole way (x −16 → −29.1).
- **Ceremony** spawn → up the aisle → "Stand at the arch". **Cocktail** → "Order
  from the bar". **After party** → "Request a song" already in reach. **Dinner**
  → up the lawn, feet 0.000.
- **The river is unbroken**, checked structurally rather than by eye: `SPINE[0]`
  resolves inside the `west` basin, `SPINE.at(-1)` inside `lagoon`, `SPUR[0]`
  inside `lagoon`, `SPUR.at(-1)` inside `hotel0`; max step between control points
  9.7 m against water.js's 1.6 m resample.
- **The hero pool is still the only pool visible from the great room**, and the
  margin got BETTER, not worse. Against a 44.6° half-FOV: hero pool 0.0° off
  axis; lounge pool 59.8°; **beach pool 50.6° → 64.0°** (it was the tightest
  margin on the campus); MID 145.9°, lagoon 154.1°, EAST 161.3°, EAST2 165.4°.
- **Cost** (same probe both sides, three accumulated frames so the Reflector's
  second pass is counted): draw calls **5958 → 5898 (−60)**, triangles
  **4,264,872 → 4,108,356 (−156,516, −3.7 %)**, colliders **8485 → 8429 (−56)**,
  **lights unchanged (34)**, meshes / geometries / textures all unchanged. The
  river simply has 90 m less of itself to build.

### Still not matching the aerial, deliberately

1. **The beach pool is 25.6 m north** — see above; it is the clubhouse's 22 m.
2. **The crescent's arc centre is ~19 m west of the photograph's** and its
   guest-room mass sits 12 m further out from that centre. Its consequence here
   is that the model's crook is wider and shallower than the real one, so the
   basins sit further off the face than the aerial's do. `r` is load-bearing.
3. **The lagoon is smaller than reality's** (39 × 31 m against a 1635 m² crook
   mass spanning 72 × 86 m). That is the proportion pass's deliberate call —
   *"the failure Carl actually SAW was the pools dominate"* — and nothing this
   round contradicted it. If he wants more water, this is still where it goes.
4. **The resort's south-crook podium pool** (real: 1078 m², world x 107…200,
   z 60…88) is only half-represented — `HOTEL_POOLS[2]` at (201.9, 61.4) is its
   east end. The rest of it would sit on open ground and is a cheap win.
5. **The beach pool no longer sits inside the palm grove.** `PALM_GROVE` ends at
   x −66 and the pool now spans −66.8…−25.2, so it reads as sitting on lawn where
   the aerial has it ringed by trees. `SCATTER_PALMS` half-covers it. Extending
   the grove east is dressing, not position, and was out of scope.

## THE PROPORTION PASS — DONE 2026-08-02

Carl put the real aerial beside the build (`reference/photos/resort-true-proportions.jpeg`
vs `build-disconnected-2026-08-02.png`) and asked for four things. All four are in.
The before/after, at an identical camera window, is
**`reference/photos/compare-proportion-pass-2026-08-02.png`**; the after alone is
`build-proportion-pass-2026-08-02.png` (+ `-night`), the water is
`build-river-unbroken-2026-08-02.png` and `build-water-meets-hotel-2026-08-02.png`.

> *"the hotel and the water features are very close by and it extends all the way
> to the beach nicely … the hotel shape is slightly smaller than actual — if you
> look at the real picture it's almost a half circle"* · *"you can move the
> entire clubhouse complex down to the free space?"* · *"the water feature now is
> broken — doesn't connect to the hotel, doesn't connect to the last beach pool
> at all"* · *"you can probably remove this non-existent grass area just in the
> way of things?"* · *"the goal should highlight the club house, the hotel build
> itself and the water features. I care less about any other random building
> blocks right now."*

### The ruler — read this before changing any of these numbers again

Everything below is measured off **`westin-site-map.jpeg`**, the only reference
that holds the beach, the clubhouse, the whole river AND the crescent in one
frame, at **0.45 m/px**. That scale is calibrated three independent ways and
they agree to better than 10 %: the beach pool's radius (36 px ↔ our 15.2 m), a
villa roof (33 × 26 px ↔ a ~15 × 12 m key) and the presidential pool (52 px ↔ our
25 m). A circle fitted to three points on the crescent's concave face lands at
centre **(998, 373) px, inner radius 206 px**, and — this is the useful part —
**that centre sits in the middle of the resort's main pool complex.** The
crescent curves around the water. That is the plan.

**The finding that changed the job: `r` was already right.** 206 px × 0.45 = 93 m
against a rooftop inner edge of 90 and a guest-room facade at 84. The queued spec
asked to grow the arc AND the radius; the radius must NOT grow, because campus.js
derives `rIn = r − DEP/2` and leans the facade 6 m back onto `ROOFTOP.rIn = 90`.
Touch `r` and the walkable rooftop, its polar hole in the height field, its
y-ranged colliders, the stair tower and the brunch dressing in TWO files all
shear off the building. What was actually wrong was the ARC (86° against the
aerial's ≥119°) and the DISTANCE (326 m sand→arc-centre against the aerial's 292).

### What changed

| | was | now | why |
|---|---|---|---|
| `SITE.HOTEL.arc` | 1.5 rad (86°) | **2.35 rad (134.6°)** | the aerial's crescent spans ≈ −3°…+116° before the photo runs out of building. 142 m → 223 m of face, +57 % |
| `SITE.HOTEL.cx` | 285 | **251** | arc centre 190 → 156; sand→centre 326 m → 292 m, the aerial's ratio |
| `SITE.HOTEL.r` | 95 | **95 — unchanged** | already correct, and load-bearing for the whole rooftop |
| `HOTEL_TILES` | hard 9 | **derived** `round(r·arc/(4·3.96))` = 14 | at 9 the guest-room bays would have stretched to 6.2 m |
| ring collider count | hard 27 | **derived** `round(r·arc/5.5)` = 40 | 27 over a 223 m arc spaces them 8.6 m |
| `ENCLAVE.ox/oz` | −58, 34 | **−34, 74** | +24 m east, +40 m south |
| `SITE.RIVER.SPINE` | head (54, 19) | **head (−71, −24)**, +16 points | the west reach: 140 m out of the beach pool's east rim |
| `SITE.RIVER.SPUR` | 5 points, ends at EAST | **14 points**, ends inside `HOTEL_POOLS[1]` | the run to the crescent |
| `SITE.RIVER.WEST` | (−82, −34) | **(−84, −28)** | 2 m west, 6 m south onto the river's line |
| `SITE.LAGOON` | 16.5 × 12.5 | **19.5 × 15.5** | the ratio moved the WRONG way when the hotel grew — see below |
| `SITE.RESORT_VILLAS` | 38, an 8 × 5 grid across the middle | **29, two fields that frame the water** | Carl's steer |
| `SITE.LAWN` | a 48 m hedge-ringed disc | **deleted** | Carl: "this non-existent grass area" |
| `SITE.BOUNDS` | x1 250, z1 120 | **x1 265, z1 140** | the walker was clamped inside the building |

### The two blockers, both fixed properly

1. **`adoptWater()` classified by bounding-box centroid.** The whole river is ONE
   group; pushing its west end toward the beach dragged the centroid over the
   hard-coded `x = 84` and silently swung the ENTIRE system 90° along the sand.
   That is why the beach pool was parked at cx −82 and why the river could never
   be extended west. `water.js` now sets `g.userData.worldSpace = true` on the
   river group and `world.js` tests the flag FIRST — the same flag it already
   honours for the Welcome Brunch, so there is one rule, not two. The centroid
   test survives underneath as a backstop for anything unlabelled.
2. **`HOTEL_TILES` is derived** from `r`, `arc` and a new `HOTEL_BAY_M = 3.96`.
   The bay width is the constant; the tile count follows it.

### How the water reconnects, west → east

`WEST` beach pool → an outfall cut into its east rim at (−71, −24) → 140 m of
new lazy river through the palm grove, five lazy reversals, holding z ≈ −22
across the clubhouse's northern flank → the old head at (54, 19) → the eastern
half **untouched** → `LAGOON` → `SPUR` → `EAST` → `EAST2` → 95 m of new channel →
into `HOTEL_POOLS[1]`, hard against the podium. **One centreline threads four
basins.** water.js trims a channel wherever it is already inside a basin, so this
needed no new code in that file — the same two centrelines it always built.

- **`BRIDGES` retuned** (5 → 9). `t` is arc-length fraction; the spine roughly
  doubled and the spur nearly quadrupled. A bridge is also the only GAP in the
  collider chain, so a reach without one is a wall across the campus.
- **`PATHS[0]` moved 8…11 m SOUTH of the water** — it used to run down exactly
  the corridor the west reach now occupies. It follows the bank the whole way,
  which is how the aerial has it, and carries on into the crescent's crook.
  `LAMPS` 22 → 30 for the longer walk.
- **The west reach is WIDER than the east and that is deliberate**: half-widths
  1.25…2.15 (a 2.5…4.3 m channel) against 1.15…1.55 east of x 54. A touring
  paddleboard is 3.2 m so `lazy-river-closeup.png` still reads, and the site
  map's own channel measures ~4.5 m. The reason it matters: at 2.3 m under a
  closed palm canopy the connection Carl asked for read as a HEDGE from above.
  The east half is Carl-verified and is not touched.
- **The bank canopy's sampling step is now a function of channel width**
  (`water.js`, `buildRiverDressing`): every 3rd centreline point where the water
  is narrow, every 5th where it is wide. Two rows of palms cannot close a 4 m
  channel anyway.

### The ratio, honestly

Carl's *"the pool isn't that big in perspective compared to the actual hotel"* is
a RATIO complaint, and growing the crescent 57 % overshot it. Measured: the
aerial's eastern lagoon is ~66 × 70 m against a 219 m hotel face = **0.30**; ours
was 33 × 25 m against 223 m = **0.148**, i.e. half the aerial's relationship and
on the wrong side of it. `LAGOON` grew to 39 × 31 m = **0.175** — deliberately
short of the measurement, because the failure Carl actually SAW was "the pools
dominate". **Nothing else in the water grew**: the river's width, the beach pool
and the hotel's own pools are unchanged. If he wants more water, the lagoon is
where the next 60 % goes.

### The villa field is now context (Carl's steer)

> *"I care less about any other random building blocks right now."*

It was an 8 × 5 grid on a rigid pitch running z −124…65 — straight across the
middle of the frame, and the band z −26…62 it occupied is exactly the ground the
river now crosses. It is two loose fields that FRAME the water: NORTH
(x 90…166, z −112…−28), SOUTH-EAST (x 92…147, z 66…102) and a thinned far-north
band. 38 → 29 boxes.

⚠ **TWO HARD RULES on that field, both silent when broken.**
1. Every backdrop villa must satisfy **`x ≥ 84 || z ≤ −80`**. That is exactly
   `isEnclaveLocal()`, and world.js runs it over every instance in the SHARED
   buckets these villas write into — a villa that answers "local" gets the
   enclave's 90° matrix baked onto it and lands somewhere else entirely. It is
   why the south-east field starts at x 92 and not the x 60 the composition
   would like.
2. `skip()` tests the crescent in **polar** terms, radius AND bearing. A radius
   test alone rejects villas that are nowhere near it — the arc only sweeps
   134.6°, so r 87 at θ −6° is open ground.

Two things moved out of the crescent's way and both are noted where they live:
the **wave-roofed conference block** (it stood inside the new arc; it is now on
the south-west apron at r 118) and the **arrival drive spur**, which had been
ending on bare grass since the enclave first moved (polish backlog) and now ends
at a forecourt beside the parking apron. A drive to the front door would need a
vehicular bridge over the new river; guests are dropped inland and walk in,
which is what the site map shows.

### Verified — headless Playwright, 1440 × 810, zero page errors, zero console errors, zero warnings

- **Rooftop, exact:** brunch spawn feet **26.600**; walk west into the water,
  feet **25.320**; `floorY` at derived polar points (never at literals) —
  deck 26.600, pool basin 25.320, the infinity lip 25.320, stair-tower ground
  0.000, tower top 23.644. Strafing the deck fires "Pour a glass".
- **All six moments** switch, dress, night-flip and spawn on flat ground at the
  right height: brunch 26.60, the other five 0.000, zero first-frame drift.
- **Suite spawn → out through the folding glass onto the turf** — walks clear.
- **Ceremony** spawn → up the aisle → "Stand at the arch" fires.
  **Cocktail** spawn → "Order from the bar" fires. **Dinner** spawn → up the
  lawn. **After party** spawn → "Request a song" already in reach.
- **Interiors:** atrium corridor → door → room B2, feet 0 → 0.22 (the threshold
  step). Suite L-stair, BOTH flights: lower 0.178 → **1.382** (the landing),
  upper 1.382 → **3.800** (the 2F slab).
- **Height-field audit:** all 59 `WALK_REGIONS` probed at their own centre; two
  "mismatches", both correct behaviour (`pool-plinth`'s centre is inside its own
  basin hole; `lounge-step` is overlapped by the higher lounge plinth).
- **The hero pool is still the only pool visible from the great room.** Against a
  44.6° half-FOV: hero pool −2.1° off axis (in frame); second/lounge pool nearest
  edge 57.2°, resort beach pool 49.5°, lagoon 157.2°, east pool 156.6° — all out.
  The beach pool at 49.5° is the tightest margin on the campus; anything that
  moves the enclave west or the beach pool south eats it.
- **Cost:** draw calls **4772 → 4750 (−22)**, triangles **904,628 → 936,728
  (+32,100, +3.5 %)**, meshes −11, **lights unchanged (34)**, colliders
  **8464 → 7885 (−579)**, geometries −6, textures unchanged. The crescent's +57 %
  of face costs ~+69k triangles; deleting `SITE.LAWN` (a 44 m turf disc, a stone
  rim and coping, a 132-segment hedge ring, a ring path, an aisle threshold and
  20 path lights) gave back 37k, and thinning the villas gave back the rest.

### One thing that is NOT this pass's doing, and is worth someone's time

**The suite's L-stair can only be climbed from a 0.3 m-wide entry at the foot of
the lower flight** (enclave-local x ≈ −4.7…−5.0, inside the z band −24.25…−23.05).
Approach it head-on down the ramp axis from local x −3 and you are stopped at
x −3.79; approach it sideways across the z band and you arrive where the ramp is
already 0.68 m up, which is past `CFG.STEP_UP`, so you can never step on. Same
shape of problem on the atrium's gallery stair, which pushed a scripted walker
off the flight entirely.
**Both were A/B'd against the pre-move `ENCLAVE.ox/oz` and the trajectories are
identical to the centimetre in enclave-local coordinates** — the move is exactly
rigid and did not cause this. It is the stairs' collider geometry, and the fix is
probably to widen the approach rather than to touch the ramps.

## The hotel facade + the beach pool — DONE 2026-08-02

Both of Carl's corrections are in. `js/campus.js` + `js/site.js` only.

### 1 · The Westin's facade was wrong, and now it is photographed

**`reference/hotel-facade-brief.md` (committed) is the written record — read it
before touching `buildHotel()`.** The short version:

The old facade was a white **diagonal lattice exoskeleton** over a dark emissive
window grid with deep terraced balcony bands, applied identically to BOTH faces
of the building. It had been inferred from one low-resolution overhead photo.
None of it is on this hotel, which is why Carl said so.

**Where the elevations finally came from.** Not the drone clip — the three trims
and `Westin Pool Cool.mov` are all under 4 s and say nothing. The two that
settled it were STILLS nobody had imported: `~/Desktop/Wedding App/new pictures/`
holds `westin hotel front.webp` and `westin hotel back.webp`, which are clean
three-quarter aerials of the two faces. `Westin Dawn + bar video.mp4` and the
87 MB screen recording gave the dusk and night elevations at roughly the
distance the venue renders the building at. All now in `reference/photos/hotel-*.webp`
and `reference/video/hotel-frames/` (59 frames, `ffmpeg -vf fps=1 -q:v 3`).

**The building has TWO faces and the old model gave both the same map:**
- **CONCAVE (west, over the gardens — the one the campus sees):** seven storeys,
  each a bright white slab edge over recessed **teal-green** glazing, and
  standing in front of that the signature — a solid white balustrade shaped as a
  **TRIANGLE, apex up, one per bay**, the triangles nearly touching so the glass
  shows only as narrow inverted wedges. Three full-height **bronze circulation
  cores** break the arc into segments.
- **CONVEX (east, the arrival side):** a white sculptural **screen punched with
  irregular tapering leaf-shaped slits**, and the wave-form porte-cochère, which
  was on the wrong side of the building — it used to float in front of the guest
  rooms on the garden face with nothing behind it.
- **Roofline:** stepped-back attic band + a run of white plant boxes; the arc
  lifts at its north tip into the sky-bar block.
- **Night:** discrete warm slots, ~3 rooms in 5 lit, slabs and triangles dark.

**Cost, hotel group alone: 82 → 98 draw calls, 10,088 → 11,788 triangles, no new
lights, no new colliders, +1 texture.** The rhythm is a canvas texture; only what
changes the silhouette is geometry.

⚠ Two traps, both now also in the brief:
- **`texHotelFacade` / `texHotelWindows` are drawn upside down on purpose**
  (`flipRows`). `CanvasTexture.flipY` is true, so a storey section drawn reading
  downwards comes out apex-DOWN — a completely different building. Cost one pass.
- **The 6 m batter (`rIn` 84 → 90) is load-bearing**, because 90 is
  `SITE.HOTEL.ROOFTOP.rIn`. Flatten the lean and the walkable rooftop, its polar
  hole in the height field and its y-ranged colliders all shear off.
- **`CFG.WORLD_BOUND` is 300 and the convex face is at x ≈ 296**, so the arrival
  elevation can never be reached in fly mode. It is cheap correctness, not
  spectacle; don't spend budget there.

### 2 · The beach pool moved 130 m west, to the beach

⚠ **Superseded in part by the proportion pass** (top of this file): the pool is
at (−84, −28) now, the cx −82 cap is gone with the `adoptWater()` fix, and the
river flows out of it again. What is still true below is WHY it is near the sand.

`SITE.RIVER.WEST` **(48, 20) → (−82, −34)**, `BAR` with it (same rim offset).
Its deck's outer edge is now at x −102.8, so the palm belt between it and the
sand's inland edge (−136) is **33 m** where it was 163. It sits NORTH of the
enclave's grass ground, clearing the ceremony/cocktail lawn by 23 m — which is
also the aerial's relationship, where the clubhouse's private lawn lies south of
the public pool. 100 m from the clubhouse core, against 119 m from the clubhouse
to the sand.

Two consequences, both handled **in site.js**, so `water.js` needed no edit:
- **The river no longer flows out of the beach pool.** It used to, at x 62 on the
  old east rim. With the pool at the beach that would have been a 155 m straight
  channel back across the palm grove and past the enclave's north flank — and it
  is not what the resort has: in `beach-pool-near-beach-aerial.png` the circular
  beach pool is self-contained and the lazy river is a separate system inland.
  `SPINE`'s head was moved to a spring basin at (54, 19) — and moved BACK on
  2026-08-02: Carl looked at the result and said the water was broken, so the
  spine now starts as an outfall in the beach pool's east rim. See the
  proportion pass.
- **`PATHS[0]`** was rerouted again on 2026-08-02 — it now runs 8…11 m SOUTH of
  the west reach, on the clubhouse side, because the river took its old corridor.

⚠ ~~It wants ~10 m more and is blocked by `world.js`~~ — the block is gone
(`adoptWater()`, 2026-08-02) and the measurement said the pool was already close
enough to the sand: the aerial wants ~45 m of palm belt and 31 m is what it has.
It moved 2 m west and 6 m SOUTH instead, onto the river's line, so the two can
be joined.

~~One thing the proportion pass must carry with it~~ — DONE. `HOTEL_TILES` is
derived from `SITE.HOTEL.r`, `.arc` and `HOTEL_BAY_M = 3.96`, so the bay width is
the constant and the tile count follows the building. 9 → 14.

## The resort's water features — DONE 2026-08-02

Built. Reference:
`reference/photos/resort-water-features.jpeg` — a close aerial of the whole
resort water system. Carl: *"let's also fix all the water feature of the
hotel."*

**Carl's photo references (2026-08-02) — these are the spec, use them:**
- **`reference/photos/hotel-rooftop-pool-day-night.png`** — the rooftop, day
  AND night, and it is spectacular. The pool runs **hard to the building edge**
  with a clean infinity edge straight onto the sea horizon; there is NO deck
  between water and edge. Along the inland long side: a row of **white
  four-poster cabana daybeds with curtains** on timber decking, backed by a
  dramatic **white perforated lattice screen wall with pointed/faceted tops**.
  At night that screen is **washed with blue light projections** and the pool
  floor is **speckled with star-like points**. Model the screen wall — it is
  what makes the roof read at distance, day and night.
- **`reference/photos/beach-pool-circular.png`** — the beach pool: a large
  **circular/oval pool with concentric-ring patterns on its floor**, a
  sand-coloured deck, white umbrellas and loungers, a **round bar/structure**
  on its inland edge, a big shade tree, and the palm grove and beach directly
  beyond. This sits close to the clubhouse.
- **`reference/photos/lazy-river-closeup.png`** — the river's true character:
  **narrow**, bright turquoise, tight against timber and grass edges, with palm
  crowns overhanging it from both sides. Wide enough for one paddleboard. If
  the built river reads wider or more open than this, narrow it.
- **`reference/photos/clubhouse-lawn-to-beach.png`** — ⚠️ **also the ceremony
  reference.** The presidential pool with its white blocks, a **square fire-pit
  feature** on the paved terrace beside it, clipped hedges and topiary, and
  then the **huge open lawn** running to the palm grove and the sea. That lawn
  is where the ceremony and cocktails go.

Three specific asks, plus a general pass:

1. **A beach pool structure very close to the clubhouse.** In the aerial this
   is the large circular free-form pool at the west end, with a **round
   deck/bar structure** set into its south edge and a sand-coloured surround,
   ringed by a paved path and palms. `buildRiver` already puts a west basin
   roughly there — it needs to become that pool properly, and to sit close to
   the enclave, since it is the water guests see from the clubhouse.
2. **The rooftop pool must run to the EDGE of the building.** Carl: *"the hotel
   top pool should be an infinity pool to the edge of the building, we have
   some tables toward the edge of the building now."* Today the section is
   balustrade → catch trough → infinity edge (r 90.9) → water → deck →
   brunch tables, so the tables occupy the edge. Invert it: the pool goes hard
   to the parapet with its infinity edge ON the facade line looking west at
   the sea, and the tables/deck move BACK, inland of the water. This is the
   Welcome Brunch venue, so the view over the edge is the whole point.
3. **Everything else in the aerial** — the lagoon basins, the circular pools by
   the hotel, the hotel's own terraced pools along its inner face, and the
   pools threaded between the villa rows. Compare what is built against the
   photo and close the gaps.

Files: `js/water.js` owns the river and basins; `js/campus.js` owns the hotel
and its rooftop (`SITE.HOTEL.ROOFTOP`, `HOTEL_ROOF`); `js/site.js` holds the
constants. The rooftop is now WALKABLE and registered in the height field
(`annulus`/`annRamp`), so moving the water means re-registering the walkable
annulus and its polar hole, and moving the y-ranged colliders with it.

⚠️ The hotel is OUTSIDE the enclave transform — plain world coordinates, never
routed through `enclaveToWorld`.

## The real ceremony / cocktail / dinner grounds — DONE 2026-08-02

Three of the six moments moved, and the enclave grew the grass ground it never
had. Carl's words are below; what follows them is what is now built.

**Orientation, derived (this had cost three passes — do not re-derive it by
eye).** `ENCLAVE.rotY = −π/2`, so `cos = 0`, `sin = −1` and `enclaveToWorld`
collapses to `world.x = −z + ox`, `world.z = x + oz`. ⚠ **`ox`/`oz` moved on
2026-08-02 (−58, 34 → −34, 74), so every WORLD coordinate quoted in this section
is stale by (+24, +40); every LOCAL one below is exactly as authored and the
directions are unchanged.** Therefore:

| enclave-local | world | also |
|---|---|---|
| **+Z** | **−X = WEST** | toward the sand and the sea |
| **+X** | **+Z = SOUTH** | the suite's **LEFT** hand facing the pool |

`SITE.BEACH` is world x −136…−160, so the sand's inland edge is **local z 78**
and the waterline is **local z ≈ 94**. Everything seaward of the pool's far
coping (local z 21.5) is the grass ground.

| what | local footprint | holds |
|---|---|---|
| `SITE.GRAND_LAWN` | x −40…9, z 25…50 | the big grass area — open, empty |
| palm belt | z 50…58 | with gaps at x −22 (aisle) and x −2 (spine path) |
| `SITE.BEACH_LAWN` | x −40…12, z 58…75 | **CEREMONY** (x −22) + **COCKTAIL** (x +4) |
| `SITE.DINNER_LAWNS` | x −23…−11 and −39…−27, z −5…15 | **DINNER**, 4 rounds of 8 each |
| `SITE.DINNER_WALK` | x −27…−23 | the paved walk, dance floor + head table |
| `SITE.FIRE_PIT` | (−11, 20) | the square pit in the terrace paving |

Spawns (`MOMENT_PLACES_LOCAL`): CEREMONY `(−22, 59, yaw π)` — the back of the
aisle, arch at z 71, rows at z 62…66; COCKTAIL `(4, 58.5, yaw π)`; DINNER
`(−17, −3, yaw π)`. **yaw π faces local +Z = world WEST = the sea** (`fwd =
(−sin y, 0, −cos y)`); yaw 0 would face the clubhouse, which is what the old
ceremony spawn did and why the blurb had been lying since the rotation.

**Four things worth knowing before touching any of it:**

- **`SITE.BEACH.x1` moved −118 → −136.** 38 m between the pool and the sand
  could not hold a lawn, a palm belt, a 12 m aisle and an arch. There are now
  56. `siteGroundY`'s slope is unchanged in shape, just steeper (24 m of sand
  rather than 42), which is closer to the reference photo anyway.
- **Both dinner lawns are on local −X, not one per side.** That is what
  `reference/photos/lawn-dinner-strips-and-2nd-pool.png` shows — two rectangles
  stacked between the two sheets of water, split by paving — and it is the only
  reading under which Carl's follow-up ("*the second pool … there should be more
  space for the two rectangle shape grass area*") means anything. The +X flank
  is the cabana run, its hedge wall and `SITE.PLAZA`; it could not hold eight
  rounds. ⚠ **Note the one thing the aerial and the model disagree on:** read
  north-up, that aerial puts the cabana blocks on the same side as the lawns,
  i.e. NORTH of the pool — but the model has them at local +X, which is the
  suite's LEFT and is Carl-verified on site (see "Layout corrections" below).
  The left/right relationship Carl checked in person wins; the world-compass
  side does not. Do not "fix" the cabanas to match an aerial's compass.
- **`SITE.LOUNGE_POOL` was reshaped and pushed out**: 9 × 18 running along Z at
  cx −44 → 20 × 13 running along X at cx −56, cz 7. Its stone apron now stops at
  x −41.5, clearing the outer dinner lawn by 2.5 m. It carries a new `OUTLINE`
  key — the free-form plan traced off the aerial as a closed normalised polygon
  whose AABB is exactly w × d. **water.js still builds it as a rectangle and
  that rectangle is the outline's bounding box**, so nothing is misplaced; the
  outstanding job is in the polish backlog below.
- ~~`SITE.LAWN` still exists and is still built~~ — **DELETED 2026-08-02** by the
  proportion pass, which owned world.js. Carl: *"you can probably remove this
  non-existent grass area just in the way of things?"*

**`campus.js`'s `buildGrassGround()` builds every square metre of it through
`inst()`, and that is a correctness requirement, not a performance one.**
world.js re-parents campus content into the rotated enclave two ways: named
groups listed in its `CAMPUS_ENCLAVE_GROUPS` **literal** (`lounge`, `pergola`, `sign`, `extstair`),
and InstancedMeshes,
whose instances it relocates individually through `isEnclaveLocal()`. A new
named group is not in that Set and would stand 90° around the map, silently.
Same reason there are no `THREE.PointLight`s out there — a light needs a parent
group — so the path lights and the fire bed are emissive instances.

**Verified** (headless Playwright, 1440 × 810, zero page errors, zero console
errors *or warnings*): all six moments switch, dress, night-flip and spawn on
flat ground with zero collider drift; walked the aisle from the ceremony spawn
to the arch (prompt fires) and strafed into the seating; walked the cocktail
spawn to the bar (prompt fires); walked the dinner spawn up the inner lawn and
across to the walk (dance-floor prompt fires); walked the whole route pool deck
→ round the pool → across the terrace → 41 m up the spine path → onto the
beachfront lawn, feet at y = 0 the entire way; suite spawn → out through the
folding glass onto the turf still works. From the great room the hero pool
subtends 5.8°…22.5° off the view axis and the second pool 56.2°…74.6°, against a
44.6° half-FOV — it is still the only pool visible from the suite, and further
off-axis than it was (50.8° before). Cost: **+12 draw calls, +20.6k triangles,
+136 colliders, +2 lights** (both inside the dinner group, so both free while it
is hidden), 35.2 fps against a 35.2 fps baseline.

**Two bugs this pass found and fixed, both invisible to a render:**
1. **The ceremony arch was built edge-on.** `TorusGeometry` lies in the XY plane
   so a π arc spans X — and the arch carried `rotation.y = Math.PI / 2`, which
   mapped that span onto Z, the same axis the aisle ran along. You walked toward
   a 0.18 m ribbon seen end-on. That is most of what "the arch reads thin" in
   the polish backlog actually was. There is no y-rotation now and it is a real
   structure: two 0.34 m posts on stone bases, a 4.8 m span, a 5.0 m crown.
2. **The planted terrace edge sealed the lawn off.** At `GRAND_LAWN.z0 − 1.3` it
   sat in the 3.4 m strip between the hero pool's far coping and the lawn — and
   the coping's collider already reaches z ≈ 22.95 once `CFG.PLAYER_R` is added,
   leaving a ~1 m slot, then a hedge. A scripted walk from the pool deck simply
   stopped. It stands at `GRAND_LAWN.z0 + 0.9` now, on the lawn's first metre,
   with 2 m of clear terrace in front of it across all 49 m.

Carl's words, for the record:

> *"correction for the ceremony, it's actually in a grass lawn area behind the
> pool and very close to the beach … focus on this area for the clubhouse and
> the big grass area … then closer to the beach you see this private grass lawn
> area — our ceremony is actually there, with the cocktail hours as well! Our
> dinner is actually in this two grass area right outside of the pool."*

> *"you probably need to first refactor the second pool for the 3 bedroom
> suites, the shape is different and there should be more space for the two
> rectangle shape grass area where it would fit ~4 tables of 8 each side of the
> grass."*

**The references this was modelled from** (all `reference/photos/`, all
gitignored). The last one is the best photograph on this project and is what the
lawn's design is actually derived from:

- `clubhouse-lawn-to-beach.png` — **from above the clubhouse, looking west out
  to sea.** The pool, the square fire pit in the paving, clipped hedge blocks
  and rounded topiary edging the terrace, then a huge FLAT, UNBROKEN, EMPTY
  lawn running the full width of the frame to a dense palm grove, then beach,
  then open sea. It is the whole composition in one frame, and its main lesson
  is negative: no hedge ring, no coping, no ring path, no ornament. Everything
  `buildLawn()` does to `SITE.LAWN` is the wrong idea out here.
- `lawn-dinner-strips-and-2nd-pool.png` — the close aerial that settles DINNER:
  the free-form second pool, the presidential pool, and the two rectangular
  grass panels stacked between them with a paved walk down the middle.
- `lawn-big-grass-area.png` — the top-down of the same ground; the scale
  reference for GRAND_LAWN and the beachfront clearing.
- `lawn-private-beachfront.png`, `lawn-two-strips-by-pool.png`,
  `westin-site-map.jpeg` — context.
- `beach-pool-circular.png`, `lazy-river-closeup.png` — for the river/lagoon
  backdrop, not used by this pass. Note for whoever does: **the river is
  NARROW**, one paddleboard wide, with palms overhanging both banks.

## Work queue (Carl's order, 2026-08-01)

1. ~~Pool + room-type placement~~ — DONE 2026-08-01.
2. ~~Walkable stairs~~ — DONE 2026-08-02, floorY is now a height field.
3. ~~The river~~ — DONE 2026-08-02, see `SITE.RIVER` / `buildRiver` in water.js.
4. ~~Cabanas as solid stepped blocks~~ — DONE 2026-08-02.
5. ~~Rooftop infinity pool~~ — DONE 2026-08-02 (geometry only; not yet stood-on-able, see notes).
6. ~~Loading screen~~ — DONE 2026-08-02.
7. ~~Rooftop stood-on-able + the 3/18 brunch as a SIXTH moment~~ — DONE
   2026-08-02, together with the suite-stair fix that turned out to be the same
   bug. See **The rooftop is walkable** below.
8. ~~The atrium is a HALLWAY and the rooms ATTACH to it~~ — DONE 2026-08-02,
   see below.
10. ~~THE WATER POSITION PASS~~ — DONE 2026-08-02: the whole water system
   re-laid on `resort-true-proportions-2.png` (the beach pool 38 m east, the
   river's band un-rotated, the lagoon into the crook, the hotel pools swung
   south along the face). See the top of this file.
9. ~~THE PROPORTION PASS~~ — DONE 2026-08-02: the crescent grown and pulled in,
   the water reconnected beach→hotel, the enclave moved south-east, `SITE.LAWN`
   deleted, the villa field demoted to context. See the top of this file.

## The rooms attach to the atrium — DONE 2026-08-02

Carl, verbatim: *"they should be flipped, the pool is outside, and the room
should be connected to the entrance from the atrium. atrium is kinda like a
hotel hallway where it connects all of the rooms, atrium has door to go into
each of the room, so the 'villa' is attached, not detached like currently."*

**This was an architectural correction, not a placement nudge**, and it is done.
The enclave is one building. The atrium is its corridor; the ten guest keys hang
off its four outer faces; each is entered through a real hole in the wall it
shares with that corridor; every private pool and courtyard is on the far side,
away from it — which is Carl's "flip". The presidential suite already worked
this way through the south portal; the other ten now match it.

**How they meet the gallery.** A key's back face sits on the atrium's OUTER wall
face (envelope ± `WALL_T`, **not** the envelope — land on the envelope and the
room is buried 0.3 m inside the corridor wall). It builds no back wall of its
own: `atrium.js`'s perimeter facade *is* the party wall, one wall seen from both
sides with one hole in it. Its yaw points villa-local −Z at the corridor, which
in one number puts the front door on the gallery and swings the glazing, the
deck and the plunge pool to the outside — because `campus.js` and `water.js`
both author the private side as local +Z.

**Where each type sits — unchanged, and still Carl's 2026-08-01 call.**

| face | keys | why |
|------|------|-----|
| WEST (x −14.3) | 2 × 3-BR (type 2) | RIGHT of the presidential suite (local −X). The arm turns the south-west corner: 2 × 17 m against 26 m of wall. |
| NORTH (z −54.3) | 3 × 2-BR pool suites (type 1) | BEHIND the atrium; their walled courtyards face away from everything. |
| EAST (x 30.3) | 3 × Garden Rooms | what's left; turns the south-east corner. |
| SOUTH (z −27.7), east of the suite | 2 × Garden Rooms | the only run of south wall the suite does not already occupy (x 10.2…30, clear of `EXT_STAIR` at x 8.2…9.8). |

**`SITE.VILLAS` is no longer hand-typed.** It is derived from `ROOM_SPEC` in
site.js — `(face, along, type)` in, `[x, z, rotationY, type]` out — alongside
`ROOMS` (full records), `ROOM_DOORS` (what atrium.js cuts) and `VILLA_ZONES`
(what nature.js keeps clear). Every number that used to be typed here is a
number that drifted. Edit `ROOM_SPEC`; nothing else.

**The keys are hollow.** They were solid stucco boxes ringed by a
`rectCollider` — geometry to look at from a distance. Each is now four walls, a
floor at `VILLA.floorY` (0.22, one threshold step, deliberately inside
`CFG.STEP_UP`), a timber soffit, a fit-out, and a folding glass wall standing
open at the front. The two 3-BR keys are entered TWICE: once off the ground
gallery and once off the atrium's upper one, which is why `VILLA.floorH2` must
equal `ATRIUM.floorH` — the same door position serves both, so one collider gap
serves both too. The size jitter is gone: a key whose width is multiplied by a
random 0.93…1.09 cannot share a wall with anything.

**Verified** (headless Playwright, zero page/console errors): all ten
corridor → door → room walks; both 3-BR upper-gallery walks; the full
corridor → door → room → folding glass → private terrace route for one key of
each type; the suite-spawn → glass → turf regression; all six moments switching,
spawning, dressing and night-flipping; zero planting inside any key; 39.7 fps
against a 40.2 fps baseline, +4 draw calls, no new lights.

⚠️ Not regressed, and still true: the enclave transform, the un-mirrored suite,
the presidential pool as the ONLY pool visible from the suite (checked from the
great room), and the type placement above.

## Polish backlog (small, known, none blocking)

None of these are guesses — each was found and left by a verified pass:

- ~~`world.js`'s `adoptWater()` is a landmine~~ — FIXED 2026-08-02 (the
  proportion pass). `water.js` sets `userData.worldSpace = true` on the river
  group and `world.js` tests that flag before the centroid. The beach pool's
  position is no longer capped by it and the river runs west to meet it.
- **`assets/og.jpg` does not exist.** `index.html` points every OG/Twitter tag
  at it, so the link currently unfurls with a broken image everywhere it's
  shared — and this link WILL be shared with guests. Render one from the
  drone orbit or the night pool and drop it in.
- ~~The cabana boardwalk region is a lodger in `world.js`~~ — FIXED 2026-08-02.
  It is `rect('cabana-boardwalk', …)` in `WALK_REGIONS`, derived from
  `SITE.CABANAS`, and `floorY` is a plain delegate again.
- ~~The ceremony arch reads thin~~ — FIXED 2026-08-02; it was built edge-on (see
  the grass-ground section) and is now a real 4.8 m structure seen from 12 m.
- ~~The ceremony blurb's "arch with the sea behind it" disagrees with the
  view~~ — FIXED 2026-08-02; the aisle now runs local +Z, which is world west.
- ~~`MOMENT_PLACES.COCKTAIL` lands inside a terrace collider~~ — gone with the
  move; it spawns on open grass with zero first-frame drift.
- **`SITE.LOUNGE_POOL` is still drawn as a rectangle.** Its real plan is the
  free-form outline now published as `SITE.LOUNGE_POOL.OUTLINE` — a closed,
  counter-clockwise polygon in normalised pool space (`u = x/w`, `v = z/d`, both
  −0.5…+0.5, first point not repeated), traced off
  `lawn-dinner-strips-and-2nd-pool.png`. `water.js`'s `buildLoungePool()` calls
  `makeRectPool()` and was not in the 2026-08-02 pass's ownership. The job:
  build a `THREE.Shape` from `OUTLINE` scaled by `w`/`d` about `(cx, cz)`, use
  it for the water surface, the coping band (the shape offset outward ~0.45 m)
  and the basin, and lay the collider chain along the offset outline instead of
  four straight runs — keeping the current plinth 0.3 / waterY 0.26 / depth 1.25
  and the single-Reflector rule (this pool must not add a mirror pass). The
  outline's AABB is exactly `w × d`, so today's rectangle is its bounding box
  and nothing is misplaced in the meantime. The straight `v = −0.5` edge is the
  side facing the lounge's folding glass and must stay straight.
- ~~The arrival drive spur is orphaned~~ — FIXED 2026-08-02. It ends at a
  forecourt beside the parking apron. It cannot reach the clubhouse any more
  without a vehicular bridge over the new river, and guests walking in from an
  inland arrival court is what the site map actually shows.
- **`world.js` still carries `enclaveKeepOut()` + `cullUnderstoryInsideEnclave()`**,
  added to compensate for a nature.js frame bug that has since been fixed
  properly. Harmless but stale, and their comments now lie. (Their `S.LAWN`
  reader went with the garden lawn on 2026-08-02; the rest is untouched.)
- **The suite's L-stair and the atrium's gallery stair each have a ~0.3 m entry
  and no other way on.** Proven pre-existing by an A/B against the pre-move
  enclave offsets — see the end of the proportion-pass section. Nobody walking
  the venue normally will find either.
- **`SITE.LOUNGE_POOL.OUTLINE` is still drawn as a rectangle** — see below; that
  item is unchanged by the proportion pass.

## QUEUED — loading screen (Carl, 2026-08-02)

Carl: *"implement a loading screen if it hasn't loaded completely for the 3D
model rendering, otherwise people would not know they need to wait or think
it's broken."*

**This is real, not polish.** `main.js` calls `buildWorld(G)` **synchronously**
before the first frame, and that builds ~3,000 meshes / ~265k triangles,
generates every CanvasTexture, and compiles the Reflector shader. On a cold
load the tab is blank — not the title card, nothing — for the whole of it. A
guest who doesn't know that reads it as broken and closes the tab. Worse on
mobile.

Requirements:
- Show a branded card **immediately** on DOM ready, before any Three.js work.
  Match the existing title-card styling (Cormorant Garamond, champagne gold on
  deep charcoal). Something in-voice, e.g. "Setting the tables…", not
  "Loading…".
- Real progress if cheap to get, otherwise a determinate-feeling animation —
  but it must not claim 100% before the scene is actually up.
- **Yield to the browser between build phases** so the card can actually
  paint. `buildWorld` currently blocks the main thread end to end; splitting
  it across `requestAnimationFrame`/`await` boundaries per builder (sky,
  nature, water, campus, atrium, suite) is the natural seam, and each of those
  is already a separate call in `world.js`.
- Hand off to the existing title card + drone orbit only once the world is
  built, so "Step inside" is never pressable against an unbuilt scene.
- `hogwarts-flight` has the house precedent: a `#loading` div killed with
  `.classList.add('hidden')` after the world build. Follow that pattern.

⚠️ Don't regress the opening: `initIntroCam` + the drone orbit must still be
running behind the title card when it appears.

## The rooftop is walkable — DONE 2026-08-02

Reference: `reference/photos/hotel-rooftop-pool.png`. The pool and terrace were
built 2026-08-02 (`SITE.HOTEL.ROOFTOP` + `buildHotelRoof`); this pass made them
reachable and added the **Welcome Brunch** (2027-03-18) as the sixth moment.
Carl approved both.

**Read `HOTEL_ROOF` in site.js before touching anything up there.** It derives
the arc centre (`SITE.HOTEL.cx − r`, `cz`) = (190, 10), publishes `pt(θ, r)` →
world, and owns the stair tower's numbers. Three files depend on it (site.js
registers the surfaces, campus.js builds the geometry and colliders, moments.js
dresses and spawns). Do not re-derive `cx − r` in a builder — same rule `SITE.*`
has always had, one level down.

Three things had to change, and all three are contracts other code now shares:

1. **Colliders carry an optional y-range** — see the Gotchas.
2. **The height field grew an annular sector shape** — `annulus()` / `annRamp()`
   in site.js, alongside `rect()` / `ramp()`. The terrace is the annulus r
   90…103.2 over ±0.62 rad with a polar hole (`aholes`) where the pool is; the
   pool answers as its **basin** (25.32), so walking in leaves you standing in
   1.2 m of water rather than on it. The submerged steps at each end are
   registered 0.38 apart, not the 0.40 they are modelled at — `fromY + stepUp`
   is a strict comparison and an exact `CFG.STEP_UP` rounds the wrong way,
   trapping the swimmer.
3. **There is a real stair.** Nine switchback flights, 108 treads, grade →
   26.60 m, in a detached tower on the crescent's INLAND face at θ = C + 0.575,
   r 110.2…118.2, linked to the terrace by an 8 m bridge at deck level
   (`buildRoofAccess`). Inland because a stair on the sea-facing side would have
   run its bridge across the infinity edge, which is the one view the venue
   exists for.

**What is still awkward, on purpose:** at grade the coarse ring still walls off
the crescent (r 81…109), so reaching the tower door on foot means walking around
the end of the arc — about 150 m from the campus. That is why the Welcome Brunch
**spawns on the roof** (`MOMENT_PLACES.BRUNCH`, the first world-space spawn, and
the first with a `y`). Both routes are real; only one is quick. If someone wants
the walk-up to be discoverable, the fix is a lobby and a lift on the concave
side, not a hole in the ring.

**The terrace is fully enclosed** — inner glass rail at 90.18, a NEW outer rail
at 103.3 (there was a 1.35 m drop onto the green roof cap and nothing but
2 m-apart planters guarding it), the two glazed ends, and the pool's infinity
edge. The only opening is the bridge.

## QUEUED — walkable stairs (Carl, 2026-08-01)

Carl: *"walk mode should allow me to walk upstairs as well instead of just
getting stuck at the stair."*

**Cause:** `siteFloorY(x, z)` returns 0 everywhere except the beach slope, and
`player.js` pins `pos.y = floorY(...) + EYE_HEIGHT` every frame. The ground is
one flat plane across the whole resort; every stair, deck and plinth is
*visual geometry only*. You are not blocked by the stairs, you are sliding
along a flat plane with a staircase drawn on it.

**Do NOT add a jump.** It doesn't solve stairs (you'd hop tread by tread), and
it is tonally wrong for a walkthrough of your own wedding venue.

**Do this instead — it is what the project already promised.** This file has
said since day one that `floorY` is the single source of ground truth and that
*stage steps, terrace decks and ramps must be expressed there*. Cash that in:
turn `floorY` into a real height field with registered walkable regions —
sloped for the suite stair, the atrium stair and the exterior stair; flat
platforms for the pool plinth, the deck, the 2F floor and the atrium gallery.
Then walking up happens naturally with no new controls. Pair it with a small
automatic step-up (~0.3–0.4 m) so thresholds and single steps stop catching.

⚠️ **This needs a ceiling concept too**, or you walk up the stair and straight
through the second floor. That is what makes it a real feature rather than a
patch — budget for it.

## QUEUED — the river (Carl, 2026-08-01)

Build the resort's serpentine river/pool system to match the aerial.
Reference: `reference/photos/river-lazy-river-detail.png` (Carl's crop) and
`reference/photos/westin-site-map.jpeg`.

What the reference actually shows, west → east:
- A **large circular free-form pool** with a sand-coloured deck and a round
  island/bar structure at the west end, ringed by palms.
- A **narrow winding lazy river** snaking east from it, widening and
  narrowing, crossed by little bridges and paths, threaded through dense
  planting — this is the dominant feature and it is LONG.
- It opens into **larger lagoon basins** further east with organic islands,
  then a **circular pool with a central round feature** near the hotel.
- Everything is embedded in heavy palm canopy with pale paths winding through.

`SITE.LAGOON` is currently a single free-form blob (`cx 122, cz 18, rx 30,
rz 17`) — nothing like this. It wants replacing with a proper polyline-driven
river: author a centreline through the resort, give it a varying width, and
build banks/deck/water from that. This is backdrop (guests see it from fly
mode), so favour a convincing silhouette from the air over close-up detail.

## QUEUED — pool + room-type placement (Carl, 2026-08-01, not yet done)

From his side-by-side of the enclave aerial against the build. Read his words
with the photo before implementing:

- **The presidential pool must be the ONLY pool visible from the suite.**
  There is currently a second pool and a cluster of buildings off to the LEFT
  (local +X) that do not belong there.
- **That second pool belongs on the RIGHT** (local −X) of the main pool, and
  it serves the **3-bedroom suites**, which sit to the RIGHT of the
  presidential suite. So `SITE.LOUNGE_POOL` (or whatever is rendering there)
  and the two `type: 2` villas move together to −X.
- **The three 2-bedroom pool suites (`type: 1`) sit BEHIND THE ATRIUM** — in
  the reference aerial they read as three walled courtyards with plunge pools
  on the far side of the courtyard from the suite.
- The big water far away on the right of his photo is the **public beach pool
  for all hotel guests** (that's the resort lagoon / circular pool, already
  modelled as backdrop — do not confuse it with an enclave pool).

Note "left/right" here is from the suite **facing the pool** = local +Z, so
LEFT = +X and RIGHT = −X (`player.js` builds `fwd` as
`(-sin yaw, 0, -cos yaw)`). Getting this sign wrong just mirrors the problem.

## Layout corrections from Carl (2026-08-01) — do not regress these

He checked the render against the site map and the hotel's own photos and
caught three things. All are now encoded in `site.js`; if a future change
makes the campus "look tidier" by undoing one, it is wrong:

1. **The enclave is SMALL and sits in the resort's south-west, by the beach.**
   隐逸居 is only 3,500 ㎡. Carl's ten guest keys are not a subdivision spread
   over the map — the compactness is the point. (2026-08-02: they are now
   tighter still, wrapped onto the atrium's four faces as one building rather
   than standing in rows. The Garden Rooms were also cut from a modelled
   13 × 11 = 143 ㎡ to 9.9 × 9.9 = 98 ㎡, which is the hotel's own published
   area — five rooms 30 % too wide is exactly why they could not be fitted onto
   the gallery in the first place.)
2. **`SITE.RESORT_VILLAS` are NOT part of the package.** ~50 other villas fill
   the ground between the enclave and the main hotel. They exist so the
   enclave reads as small and private, which is how the site map reads. They
   are backdrop: cheap instanced boxes, no interiors, built by
   `buildResortVillas()` in `campus.js`.
3. **Poolside orientation was flipped.** Standing in the suite looking south,
   the cabana pavilions AND the loungers are both on your **LEFT** (the east,
   +X half); the west half is open lawn. Verified against the hotel deck's
   balcony photo (p5). Because `player.js` builds `fwd` as
   `(-sin yaw, 0, -cos yaw)`, facing +Z puts +X on your left — so swapping
   these X ranges silently mirrors the whole view.

## Gotchas

- **`js/site.js` is the ONLY place coordinates live.** Six builder modules were
  written in parallel against it; the moment any of them hard-codes a position,
  the campus silently drifts apart. If you need a new landmark, add it to `SITE`
  first, then build against it.

- **A door position must be SNAPPED to the facade module grid, in site.js.**
  `atrium.js` divides each perimeter wall into `round(len / ATRIUM.module)` equal
  bays and a door gap drops a WHOLE bay, so the hole that ends up in the wall is
  centred on that bay — up to half a bay (≈1.45 m) from where the door was asked
  for. `campus.js` frames the room's own opening from the same number, so the two
  must be the same number: `snapDoor(face, along)` does it once and both builders
  read the result. **This failure is silent.** The collider gap still opens where
  it was asked for, so the walk test walks straight through — into a room whose
  own wall is blank behind the corridor's doorway. It was caught by raycasting
  out of a room, not by walking into one.

- **`SITE.VILLA.d` is the plunge-pool offset datum, not a footprint.**
  `water.js`'s `buildVillaPools()` — not ours to edit — puts every type-0/type-1
  pool at `V.d / 2 + k` from the key's CENTRE, so the terrace between a room's
  folding glass and its own water is
  `(V.d − d_type)/2 + k − poolDepth/2 − (colliderR + PLAYER_R)`. At `V.d = 11`
  against a 13 m deep 2-BR that is NEGATIVE: the pool's coping collider stood
  0.6 m *inside* the glass and you could walk from the corridor across the room
  and then not get out of it. `V.d` is 14 now; the backdrop villas have their own
  `wR/dR` and the ten keys their own `w0…d2`. If you deepen a key, re-check this
  arithmetic — or the walk test will, by wedging the player between its own glass
  and its own coping.

- **`VILLA.openAt` decides where the folding wall stands open**, per type, and
  it is not decoration. The 2-BR and 3-BR plunge pools (7 m and 6.4 m wide) sit
  dead in front of their rooms, so a centred opening walks you into the water;
  both are pushed to one end. Only the Garden Room has enough terrace to be
  entered and left down its centre-line. Same rule inside: a partition on the
  centre-line of a room whose door is also on the centre-line is a wall across
  the inside of the front door. The 2-BR ate this twice before becoming two side
  partitions with the living space running door-to-glass between them.

- **The atrium's perimeter collider is r = 0.55, and the number is arithmetic.**
  `player.js` adds `CFG.PLAYER_R` (0.35) at test time, so the old r = 0.95 chain
  blocked 1.3 m either side of the wall line and a one-bay door (≈2.89 m) would
  have left a 0.29 m slot — narrower than the player. At 0.55 the same door
  passes 1.79 m of clear walking, still narrower than the 2.0 m the piers show.
  Keep it that way round: the collider may be stricter than the geometry, never
  looser, or people clip through their own door frames.
- **Builders own their own materials.** Only `mulberry32` is imported from
  `materials.js`. This is deliberate — it let six agents write 6,000 lines
  concurrently without fighting over a shared material table. Don't "tidy" it
  into a global palette without a reason.
- **Every builder exports `buildX(G)` + `setXNight(on)`, and `world.js` fans the
  night switch out to all of them.** A module that forgets `setXNight` will
  stay stuck in daylight while the rest of the campus goes dark — very obvious,
  very confusing. `water.js` also exports `setLanterns`.
- **Per-frame work goes on `G.tickers`,** not on a module-local rAF. `world.js`
  `updateWorld()` runs them; `main.js` calls it once per frame.
- **Spawn yaw: 0 faces NORTH (−Z), π faces SOUTH (+Z).** `player.js` builds
  `fwd` as `(-sin yaw, 0, -cos yaw)`. Getting this backwards spawns you facing
  a wall — it happened once with the dinner spawn, which pointed away from its
  own tables. Check spawns against the props they're meant to show.
- **The folding glass wall's open span must stay collider-free**, and fly mode
  has no collisions at all — that's what makes "fly in from outside" work. If
  you ever add a wall collider across that opening, the whole entrance breaks.
- **`CFG.WORLD_BOUND` is a real constraint, not a formality.** The campus is
  ~500 m across; the placeholder's value of 60 would have pinned the player
  inside the pool deck.

- **`floorY(x,z)` is the single source of ground truth** (lassen `getHeight`
  pattern). It's flat 0 today, but stage steps, terrace decks and ramps must
  be expressed there — never by nudging `player.pos.y` or camera height.
  Player, prop placement and any future NPCs all read it.
- **Walls collide as chains of `{x,z,r}` circles, not boxes.** `updatePlayer`
  only understands cylinder colliders (house pattern), so `colliderLine()`
  lays circles along each wall at a step ≤ r — widen the step and corners
  become squeezable. Collider `r` is the *geometry* radius; `CFG.PLAYER_R`
  is added at test time (unlike lassen, which bakes the player into `r`).

- **Colliders may carry an optional half-open height range `[y0, y1)`** (feet
  height, metres; contract documented in `updatePlayer`). Omit both and the
  circle blocks at every height, which is what every collider on this campus did
  before 2026-08-02 and what almost all of them still do. Added because
  `G.colliders` is ONE flat list with no notion of height, so two different
  builders were making the same mistake:
    · the hotel crescent's coarse ring (27 circles of r 14, walling r 81…109)
      also walled off the rooftop terrace 26.6 m above it → `y1: roofY`;
    · the suite's L-stair mass was ringed at every height, so the walkable ramp
      under it could never be stepped onto → the lower flight's ring deleted,
      the landing/upper ring given `y1: 0.85`.
  **The rule when you reach for it:** a y-range is for a solid you must be able
  to stand ON TOP of (`y1`) or a guard that only exists UP THERE (`y0`). It is
  not a way to make a wall optional. And the arithmetic is load-bearing — the
  stair's 0.85 is picked so the ring stops blocking exactly where the ramp has
  already lifted the feet past it; raise it and the landing re-seals.

- **The suite's stair had a 0.5 m black "base rail" across its foot** (a solid
  kerb spanning the whole stair zone on the only face you can approach from).
  Removed 2026-08-02: it is taller than `CFG.STEP_UP`, it carried a collider,
  and the raking glass balustrade already guards that edge. It is the dark mass
  in Carl's "can't walk upstairs" screenshot. Don't reinstate it without
  stopping it short of `ST.loX0 + 1.4`.

- **A `floorY` probe is not proof that a stair works.** The height field can be
  perfect and the walker still stuck, because the colliders are a separate
  system consulted earlier in the same frame. The only test that counts is a
  scripted walk that starts where a person starts and logs feet height rising.
- **`G.setMoment` early-returns on the current index**, so the begin-button
  flow must reset `G.momentIndex = -1` before jumping to moment 0 — the
  title screen already has moment 1 dressed as its backdrop. Forgetting this
  leaves the overlay's dressing on screen with no teleport.
- **A moment outside the enclave must opt out of the adoption pass, in three
  places.** `world.js` adopts every group that appears after `buildWorld` into
  the rotated enclave group, and rewrites every late collider and interactable
  through `enclaveToWorld`. Five of the six moments want that. The Welcome
  Brunch is on the hotel crescent and does not: `group.userData.worldSpace =
  true`, plus `__world: true` on every collider and interactable it registers.
  Miss one and that part of the moment lands 90° around the map from the rest
  of it — silently, because nothing throws.

- **`m.spawn.y` is the FEET height and rooftop moments need it.** `setMoment`
  teleports before any `floorY` resolve, and `floorY` only ever answers a
  surface within `CFG.STEP_UP` of where the feet already are — so spawning on
  the roof with `y` omitted resolves to the ground 285 m below and drops the
  player through the hotel. Omitted (0) for every moment at grade.

- **Moment colliders are swapped, not accumulated.** `initMoments` snapshots
  `G.colliders` (the world statics) *after* `buildWorld` and before any
  dressing; `setMoment` rebuilds `G.colliders` as statics + the live
  moment's list. Register any new permanent collider in `world.js`, not
  after init, or the first moment switch silently deletes it.
- **Touch mode never uses pointer lock** — `G.player.locked` is pinned true
  and `lock()` no-ops (lassen pattern). Canvas touch handlers
  `preventDefault()`, so anything tappable must be a DOM element outside the
  canvas — the moment chips and `.tbtn`s are; don't add canvas-drawn UI.
- **The `player.js` ↔ `touch.js` import cycle is deliberate.** `touch.js`
  owns `touchInput` (per spec), `player.js` owns `applyLook`; each is only
  dereferenced at call time, so the ES-module cycle is safe. If it ever
  bothers you, move *both* onto `G` — moving one breaks the other silently.
- **Clamp `dt` low as well as high** (alice gotcha): the first rAF timestamp
  can precede the `performance.now()` captured just before it, and a
  negative dt runs animations backwards.
- **Seeded PRNG (`mulberry32`) for every random choice** — texture noise,
  star field, future placement — never `Math.random()`, so the venue renders
  identically on every load (and in future tests).
- **`FLY_MAX_ALT` must stay well inside `SKY_R`.** The sky dome is a sphere
  of radius `SKY_R` at the origin; fly past it and you're staring at raw
  clear color. `SKY_R` went 140 → 240 when fly mode landed
  (`FLY_MAX_ALT` 150 + the `WORLD_BOUND` diagonal).
- **The interactable scan is walk-only.** The `{x,z,r}` distance test
  ignores altitude (house convention), so a flyer 100 m above the DJ booth
  would still get the "Drop a request" prompt — the fly branch nulls
  `player.nearest` and hides the prompt instead. If interacting mid-air is
  ever wanted, add a y term to the distance, don't drop the guard.
- **`#begin` must `blur()` in its click handler.** Space is fly-ascend; a
  still-focused button re-fires its click on every Space press, which
  re-runs the start flow (re-teleport + re-toast) mid-game.
- **Moment switches force walk mode** (`setMoment` → `G.setMode('walk')`) —
  spawns are authored as ground positions and `spawn.yaw` assumes a level
  gaze. Landing (fly → walk) doesn't collider-check the landing spot; the
  next frame's walk collider pass nudges you out. Fine for the placeholder;
  revisit if Phase 2 adds tight interiors.

## Deploy

```bash
vercel --prod
```

Domain `venue.carlfung.dev` is attached in the Vercel dashboard. No
`vercel.json` — it's a static site, the defaults are correct.
