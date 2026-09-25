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
| `js/foliage.js` | (KAN-208 wave 4) the understory's shared leaf-card materials (`leafMat('shrub'|'boug')`), `protoGeo()` (a GLB prototype, optionally a scaled clone) and `fringeFor()` (a leaf-card bucket on a core bucket's matrices) — used by nature.js, water.js, campus.js and atrium.js |
| `js/water.js` | The hero pool (raised plinth, infinity edge, caustics), **the floating lanterns**, the deck + turf + "THE WESTIN" letters, cabana pavilions, loungers, lounge pool, lagoon, villa plunge pools |
| `js/campus.js` | The entrance pavilion (the 酒廊 at grade + the check-in lobby above), the ten guest keys (3 real types — **walk-in rooms attached to the atrium**, hollow, private side facing out), **the grass ground** (`buildGrassGround` — the mown lawn panels, the spine + cross paths, the planted terrace edge, the fire pit), event plaza, pergola, signage pillar, arrival road, and the main Westin crescent backdrop |
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
  pool terrace — **built 2026-08-04 as the arrival pavilion's ground floor**;
  it was briefly a wedding-dinner candidate, but dinner moved outdoors on
  2026-08-02; signature white portal-frame
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
| 1 | Welcome Brunch | The Westin Rooftop | 03-18 | the eight four-tops (from `HOTEL_ROOF.brunchTables`) dressed (linen, settings, blooms, chair slips + sashes), a buffet run and a champagne service on the pool half's teak, a menu easel at the pool room's threshold — all inside the POOL half; the north half is the rooftop bar |
| 2 | Prewedding Setup | Presidential Suite | 03-19 | high-tops on the deck, festoon runs, welcome easel, champagne tower |
| 3 | Ceremony | The Beachfront Lawn | 03-20 | **from the planner's renders** — 60 wooden cross-back chairs each tied with a white chiffon drape, a petal-strewn GRASS aisle lined with blue-and-cream clusters, two 3 m asymmetric floral installations at its head with a pale-blue fabric flower between them, two slim white arch frames each hanging a crystal chandelier, a pale arched welcome board, and six extras on the −X flank (dessert bar, favour wheelbarrow, hat rack, plinth pair, coconut rack, beverage cart) |
| 4 | Cocktail Hour | The Beachfront Lawn | 03-20 | **the ceremony decor still standing** (only the seating cleared) + a ROUND timber-plank bar with the four real menu drinks, menu easel, lilac florals; eight high-tops, three teal parasols, festoon on poles |
| 5 | Wedding Dinner | The Pool Lawns | 03-20 | **from the planner's renders** — 64 covers as SIX rounds of eight + TWO bare-timber longs of eight, all on wooden cross-back chairs; strung festoon (real cable, not floating bulbs) criss-crossing both lawns; four crystal candelabra on tall curved poles; head table + dance floor on the walk between them |
| 6 | After Party | Suite Pool Deck | 03-20 | DJ booth, speakers, mirror ball, lounges, string lights |

**The order is CHRONOLOGICAL and the chip bar is read as a timeline** — the
Welcome Brunch is two days before the wedding, so it is index 0 and everything
else shifted by one on 2026-08-02. Nothing may hold a raw moment index:
`config.js` exports `momentIndex(id)`, `main.js` resolves the title-card
backdrop and the post-dive landing through it, and `moments.js` gates its
interactables on ids. Insert a moment where it belongs in time; do not append
one to protect an index.

**Ceremony and Wedding Dinner are dressed from the couple's ACTUAL wedding
designer** (Rosa Wed 蔷薇婚礼) as of 2026-08-02 — see "THE DECOR PASS" near the
top of this file for the seven renders, the palette and the traps. Anything in
those two moments that disagrees with `reference/photos/decor-*.jpg` is wrong.

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

~~The rooftop strafe from the brunch spawn ends in the pool~~ — **NOT A BUG,
  checked 2026-08-06.** Walking from the brunch tables to the bar holds feet
  **26.600 across all twelve bursts**, and `floorY` probes 26.600 at every
  bearing from `poolTc` to `barTc` at r 99.0. The original observation was a
  STRAFE, which moves you SEAWARD from the tables at r 97.9 into the pool at
  r 90.10…96.40 — i.e. the pool is where the pool is, and Carl asked for
  exactly that (the water takes the edge, the tables sit behind it).
## THE ASSET PASS — BLENDER GLB PROPS + AI TEXTURES — DONE 2026-09-16 (KAN-207)

Carl: *"work on all 3D assets in blender and image gen for venue.carlfung.dev."*
Every dressing prop a guest stands next to is now a **Blender-authored,
AO-baked, Draco-compressed GLB** instead of an assembly of unit primitives:
**42 assets, 2.9 MB, 173k triangles in total** (`assets/models/models.json`).
The campus itself (buildings, water, palms, hedges) is still procedural — this
pass is the wedding, not the resort.

**Read `assets/blender/ASSET_SPEC.md` (the contract: every asset's dims, origin,
front, budget) and `assets/blender/INTEGRATION.md` (how moments.js consumes them)
before touching a prop.** `assets/blender/README.md` has the commands.

### The pipeline (`assets/blender/`, ported from seventh-floor)

```
wv_lib.py        primitives, the Rosa Wed PALETTE (sRGB → linear in M()), image_mat + planar/cylindrical/spherical_uv on a second UV layer
wv_bake.py       clean-resort material families, Metal-GPU albedo×AO atlas, ONE material per GLB with a meaningful name
generators/*.py  one module per asset: NAME, ATLAS, BEVEL, AO_DIST, TRIS, FRONT, ORIGIN, build() (+ build_<suffix>() for parts that need another material class)
make_masters.py  generators → bake → masters/<name>.blend (Git LFS; the source of truth)     -- names… fast=1
export_all.py    masters → ../models/<name>.glb + <name>.meta.json; models.json REBUILT from every sidecar; exit 1 over budget
preview_all.py   Workbench 3/4 turntable → assets/previews/<name>.webp   (shape only — Workbench ignores image maps)
art_manifest.json + gen_art.py   Vertex Gemini: 15 textures (textures/gen/*.webp), 2 art plates (assets/art/), 13 orthographic refsheets (local only; CONTACT.md carries the measurements)
```
`tools/viewer.html` + `tools/shoot-models.mjs` render any model in the venue's
own PMREM/ACES/sun rig → `assets/previews/<name>-ingame.png` (`NIGHT=1`). **Judge
assets there, at guest distance, never in a Blender turntable** — the chair that
looked fine in Workbench baked whitewashed in-engine.

`js/models.js` loads the manifest before `initMoments`; `geometry(name)` /
`material(name)` hand out the single shared mesh so `moments.js`'s kit buckets
instance a GLB like any unit primitive — sixty chairs are still ONE draw call.
Material names are a contract with the loader: `*_emit` (flames, the DJ facia),
`mirror`, `canopy_tint` (white; the game tints the cocktail parasols teal),
`crystal`. A missing GLB warns and the call site falls back to its old primitive.

### Numbers (16 views, `tools/shoot-moments.mjs`, before = `reference/photos/shots-before/`, after = `shots-after/`)

| | before | after |
|---|---|---|
| draw calls, all 16 views | 5,433 | **4,303 (−1,130)** |
| triangles, all 16 views | 6,573,310 | 6,880,246 (+4.7 %) |
| shader programs | 114 | **116, min = max at every view and both lighting states** |
| **setup-champagne** calls / fps | 2,138 / 73.9 | **1,120 / 117.6** |
| **cocktail-spawn** calls / tris | 213 / 739,496 | **80 / 263,618** |
| setup-spawn fps | 94.7 | **112.8** |
| transmissive meshes at the prewedding | 30 | **0** |
| ceremony-spawn calls / tris | 58 / 382,506 | 58 / 617,729 |
| geometries / textures | 1,525 / 192 | 1,840 / 233 |

Draw calls move only where the transmission material went away; every other
view is within ±3. Triangles rise where the florals became real florals and FALL
at cocktail, because the old shared bloom bucket spanned the whole lawn and could
never be frustum-culled — a GLB bucket is local to its prop. Colliders, feet and
night flags are byte-identical at all 16 views; the guest-journey harness passes
with 0 stalls, every beat, and zero console errors.

⚠ **The transmission win is the real one, and it is not the mirror's.** The
champagne tower's `transmission: .85` coupes made three render the campus a THIRD
time: 30 transmissive meshes → 0 buys **+27.5 fps at the setup spawn and −1,018
draw calls / +47 fps at the champagne view**. The mirror pass itself barely moved
(406 → 404 calls) — at the champagne viewpoint the Reflector is never invoked at
all, so the cost there was three's own transmission pass on the main frame. The
CLAUDE.md entry that called this "the biggest single remaining cost on this
campus" was right about the cost and wrong about which pass paid it.

⚠ **Two bugs the LOOK caught that the numbers did not.** The GLB easel's board
face is 19 cm in front of where the old box's was, so the cocktail menu and the
prewedding welcome sign rendered perfectly — behind the board. And a 1.3 m ground
cluster on top of a 0.30 m plinth reads as a parasol balanced on a post; the
plinth tops went back to `bloomMass`. Both found by reading the after screenshots
beside the before ones, which is the only check that finds this class of error.

⚠ **`renderer.compile()` traverses VISIBLE objects only.** After the swap the
program count read 113 everywhere but 114 from the Wedding Dinner on: the
festoon's `LineBasicMaterial` used to be compiled for free by the ceremony's
hat-rack wire lines, and the hat rack is now a GLB. `initMoments` publishes
`G.momentGroups` and `main.js` shows all six groups across both `compileAsync`
calls and the night warm-up, then restores — safe because the light budget has
already made every logical light invisible, the detail cull collects on its first
ticker run afterwards, and the loading card is opaque.

### ⚠ What this pass learned, in the order it cost time

1. **Cycles' DIFFUSE bake darkens METALLIC keys** (steel .30 vs .60, gold .63 vs
   .85) — chafing dishes, ice buckets and the barrow baked near-black. Metal parts
   bake as dielectric copies for now; the real fix is zeroing Metallic for the
   diffuse pass in `wv_bake.bake_atlas` and restoring it before `apply_baked`.
2. **The UV packer starves dense atlases**: ~4,000 floret islands left **48 % of a
   1024 atlas black** and every floret baked as a black speck. `generators/_florals.py`
   shadows `unwrap` with a tight pack (island_margin 0, margin 2/size ADD, AABB → 5 %)
   for objects tagged `wv_florals`. Worth adopting in the library.
3. **`image_mat(name=<palette key>)` hijacks that key** for every later part via the
   material cache. Image materials get their own names (`oak_grain`, `hyd_head`…).
4. **AI textures carry their own shading and drift from the palette.** The oak
   measured greyer/lighter than `c3a37c` and baked WHITE; heads measured darker.
   `gen_art.py` now gains eight files to the palette (mean for flat materials, p70 for
   heads) — and the chair still needed an albedo darker than the palette hex
   (`#92724e`) to render as the render's tan under the venue rig. Measure, then look.
5. **A mirror is its reflection, not its albedo** — the mirror ball rendered black
   until the loader dropped its dark baked map and gave `mirror` a light base.
6. **Module `BEVEL` bevels the JOINED mesh** at every edge ≥ 40° (rounds flute
   ridges, ×4 faces); `MAT_NAME` is module-wide (applies to every `build_*` part).
   Use `BEVEL = 0` + per-part `L.bevel()`, and single-key builds where a part must
   keep its own material name.
7. **The viewer frames hook-origin assets at the origin** — chandeliers hang under
   the ground disc and shoot empty. Lift `origin: "hook"` by `size.y` (open).
8. **`tools/shoot-moments.mjs` takes enclave-LOCAL yaws and `setFacing` wants
   WORLD** — every custom view was 90° off until `+ ENCLAVE.rotY`.
9. **`.vercelignore` REPLACES `.gitignore` for CLI deploys**, so it repeats
   `reference/` and hides `assets/blender/`, `assets/previews/`, `tools/`.
10. **Session limits kill every parallel agent at once** (three times). Carl: one
    agent at a time; resume a killed agent with `SendMessage` and the DISK STATE
    (its background streams do not survive); checkpoint-commit between resumes.

### Deviations from the spec that are deliberate (each in its generator's docstring)

Tower origins sit on the tower AXIS at the foot (the wing would drag a bbox centre
0.45 m sideways); `fabric_flower` is origin-centre; the candelabra's 6-arm tier
is ABOVE the 8-arm tier (render + refsheet); the bead chandelier has a bell crown;
metal props are non-metallic materials; heads are ~35 % blue by count (reads
half-and-half); foliage is folded sheets, not prisms (sub-pixel islands bake black).

### THE RESORT FURNITURE — DONE 2026-09-18 (a second wave, same pipeline)

Eight more GLBs (50 assets total, 183k triangles, 3.0 MB) for the furniture a
guest stands beside on the roof and at the pool, which the wedding pass left as
primitives: `sun_lounger`, `daybed`, `pool_umbrella` + `_canopy`, `four_top`,
`dining_chair_rattan`, `bar_stool`, `kayak`. Their rows are **Group E** in
`ASSET_SPEC.md`, each carrying the `file:line` in campus.js/water.js the
dimensions came from — the GLB has to drop into colliders measured against the
primitive. Draw calls FELL (five buckets replace ~50 placements); triangles rose
almost entirely on the 128 woven dining chairs; programs held at 116 across 24
views; lights and the walk test unchanged.

⚠ **`main.js` now awaits the models BEFORE `buildWorld`.** campus.js and water.js
build synchronously from `geometry()`/`material()` INSIDE `buildWorld`, so a GLB
still in flight would leave a roof of boxes for the whole session with nothing to
rebuild it. moments.js could load late; a builder cannot.

⚠ **Two rotations were the whole risk.** The rooftop lounger's local +Z is
radially outward — which is the head — so it takes no extra turn, while the three
poolside call sites need `+ π` and get it from one shared prototype. And the
rattan chair needs `ry = ca − π/2`, because campus.js's dining helper authors its
back at local +X while the GLB faces −Z; `ry = ca` seats all 128 sideways.

⚠ **`inst()` has a sixth call form now** (`modelI`), and the ONE-KEY-PER-PAIR rule
covers it. Census: 141 keys / 0 collisions before, 146 / 0 after.

`tools/shoot-moments.mjs` grew a `{ world: '<expr>' }` view form evaluated on the
live page, because the crescent is `x ≥ 84`, fails `isEnclaveLocal`, and a rooftop
camera pushed through `enclaveToWorld` lands 90° away. Its `feet` column caught
two new cameras standing in the pool and off the terrace edge.

**Deliberately still primitive here:** the river dressing's lounger slabs (an
explicit distance LOD — "at 60 m up that is exactly as much lounger as reads").
(The rooftop parasols and the brunch four-tops' box chairs that used to be listed
here were done in KAN-208 wave 1 — see below.)

### KAN-208 WAVE 1 — BRUNCH CHAIRS, ROOFTOP PARASOLS, ISLAND-BAR THATCH (2026-09-25)

Shots: before `reference/photos/shots-wave1-before/`, after `shots-wave1/` (41+1
views; new ones `roof-brunch-chairs`, `roof-lounger-parasols` (+`-night`),
`river-island-bar-thatch`). Programs 116 at every view, both lighting states;
colliders and feet identical at every view; guest journey 0 stalls, every beat,
`ERRORS []`.

- **Brunch chairs → `dining_chair_rattan`** (the dining terrace's own chair,
  `rtBrunchChairGlbI`, ry = ca − π/2). One chair across the roof is the look
  decision; the 1.07 m back is absorbed by recutting moments.js's slipcover to it.
- **Rooftop parasols → `roof_parasol` + `roof_parasol_canopy`** (new, 1,030 + 768
  tris), authored at the lounger cone's envelope; the brunch ones are the same GLB
  at a non-uniform scale. The canopy is a white `canopy_tint` bake tinted by ONE
  cloned material on the night-tint registry.
- **Island bar thatch** — generated `thatch_palm.webp`, slant UV, ragged fringe
  courses, topknot, 2048 atlas with `UV_WEIGHT`. 3,702 tris / 288 KB.
- Cost: +16 draw calls (12,741 → 12,757) and +4.8 % triangles (17.90 M → 18.76 M) summed over 41 views. The roof's GLB
  buckets are InstancedMeshes, which `detailcull.js` never hides, so the distant
  views that can see the roof (champagne, dinner-table, lagoon, the suite great
  room) each gain ~+59k tris / +2 calls. fps unchanged at every view (vsync-capped
  120 where it was before).

⚠ **What this wave learned:**
1. **A `mat4(…, sx, sy, sz, ry)` box with `ry = ca` lays its X side along the
   RADIUS `(cos ca, −sin ca)`.** The brunch box chairs' backs (`.5 × .5 × .08`)
   and moments.js's slipcovers (`.54 × .56 × .10`, `rotation.y = ca`) were both
   radial FINS, which is why they never read as chair backs. A tangential panel
   at bearing `ca` needs `ry = ca − π/2` (or swap the X/Z sizes).
2. **A rib tip at the rim pokes THROUGH the canopy's top edge** — eight little
   posts on the parasol's rim in the first in-engine shot. Tuck tip caps inside
   the valance.
3. **A photographed material on a large baked prop is atlas-starved**: islands
   split the atlas by 3-D area, and a flat one-colour terrace took ~half. Hence
   `UV_WEIGHT` (README) and the 2048 atlas.
4. **`ONLY=a,b node tools/shoot-moments.mjs`** runs a subset — and writes
   `stats-only.json` (an early version overwrote a full run's `stats.json`).
5. **Before-shots of a NEW view need the old build**: `git worktree add --detach
   <dir> HEAD` + `python3 serve.py 8811` there, then `VENUE_URL=http://127.0.0.1:8811/`.

### KAN-208 WAVE 2 — PALMS, HEDGES, TOPIARY: THE PROTOTYPES (2026-09-25)

Shots: before `reference/photos/shots-wave2-before/` (the HEAD worktree on :8811),
after `shots-wave2/` — 51 views, the 42 of wave 1 plus nine planting views
(`palms-belt`, `palms-belt-crowns` (+`-night`), `palms-lawn-flank`,
`hedge-sea-band`, `hedge-cabana-wall`, `hedge-terrace-topiary`,
`hedge-pavilion-topiary`, `hedge-arrival-court`). **Read `assets/blender/ASSET_SPEC.md`
Group H** for every prototype's frame, UV layout and budget.

Ten **geometry-only** GLBs (`BAKE = False`, 30 KB together) replace the
instanced prototypes and nothing else: `palm_{tall,mid,young}` (+ `_crown`) for
nature.js's three palm silhouettes, `hedge_run` for nature's hedge segment,
`hedge_block` / `hedge_mass` / `topiary_ball` for campus.js's `UNIT_BOX` /
`UNIT_BLOB` in the six clipped-hedge buckets. The game keeps its own
materials, so the photographs, the frond alphaTest, the night tints and the
per-instance hedge colours are untouched, and no program is added.

| | before | after |
|---|---|---|
| tris per palm (tall / mid / young) | 346 / 318 / 266 | **776 / 728 / 448** (≲ 800 budget) |
| hedge cell tris (run / block / mass / topiary) | 48 / 12 / 80 / 80 | 236 / 250 / 300 / 300 |
| triangles, all 51 views | 22,754,579 | 29,263,597 (**+28.6 %**, +17k…+163k a view, mean +128k) |
| draw calls, all 51 views | 16,593 | 16,594 (+1, stable, at `hedge-arrival-court` only) |
| shader programs | 116 | **116 at every view, day and night** |
| colliders / feet / night flags | | identical at all 51 views |
| lights (guest journey) | 40 / 12 | 40 / 12 |

The triangle rise is almost flat across views because the palm and hedge
buckets are campus-wide InstancedMeshes (one bounding sphere, never frustum-
culled per instance, never touched by `detailcull.js`): ~+121k per pass for the
325 palms, ~+41k for the 183 hedge cells, wherever any of them is on screen.
**fps did not move**: repeated A/B at the six uncapped views (pool lights,
cabana wall, belt crowns, pavilion, arrival court, island bar) sits inside the
±5 % run-to-run noise; everything else is vsync-capped at 120 both ways.

**Scatter proof: `node tools/scatter-probe.mjs <url> <out.json>`** (new) —
before and after print the same `allMatrixHash a79ae12f4089` over all 283
InstancedMeshes (matrices + instance colours, palm sway pinned by calling
nature's ticker at t = 0) and the same `colliderHash 026674019d51` over 10,797
colliders; the only per-bucket differences are prototype tris and the campus
hedge material gaining its map.

**What changed in code** — `nature.js` swaps each palm variant's trunk/crown and
the hedge segment for the GLB when `models.has()` (the procedural geometry is
the fallback); `campus.js` swaps the six hedge buckets' geometry **at flush, by
key** (`HEDGE_PROTO`), so every call site still says `UNIT_BOX`/`UNIT_BLOB`, no
key is added and the ONE-KEY-PER-PAIR census is unchanged; campus `MAT.hedge`
became `hedge.webp` (canvas stand-in at boot, photo on load, white base,
flatShading off). NOT touched, deliberately: water.js's two hedge BOXES (the
pool's south hedge and the pavilion run — plain meshes with their own canvas
map), the river dressing's shrub blobs, nature's shrub / bougainvillea /
ground-cover blobs, the atrium's cloud topiary, the casuarinas.

⚠ **What this wave learned:**
1. **The procedural prototype builders DRAW FROM THE SEEDED STREAM.**
   `crownGeo()` takes five `rnd()` per frond and four per coconut from the SAME
   stream buildPalms then places every palm with; the hedge box's top-jitter loop
   takes one per top vertex from the stream the colours, shrubs, bougainvillea
   and ground cover share. So `palmVariants(rnd)` and the jitter loop STILL RUN
   and their geometry is disposed. Skip them and all ~325 palms move.
2. **glTF UV v is flipped against a TextureLoader map.** A GLB whose UVs are laid
   out for a game-owned map (`flipY = true`) must be authored with `v → 1 − v`
   in Blender, or it samples upside down (memory: gltf-uv-v-runs-down). The first
   crown read the frond atlas's brown coconut strip along every leaflet edge.
3. **DoubleSide + a low sun decide which way custom foliage normals may point.**
   three flips the normal on back faces; with radial-up normals the flipped
   ones faced the golden-hour sun behind the palms, and with up-dominant ones
   the up faces took grazing Fresnel glare from it — both lit a third of every
   backlit crown flat khaki (same with `envMapIntensity 0` and roughness 1, so
   it was the sun's specular). Normals OUT and a little DOWN — toward the guest
   — fixed it. Judge foliage looking TOWARD the sun: every wedding view faces
   the sea, which is where the sun is.
4. **The frond texture was squeezed 4× across.** crownGeo drew a 4.6 m frond
   0.95 m wide onto an atlas whose leaflet band is ~0.85× its length — that,
   not the triangle count, is why the old crowns read as green straps. The new
   ribbons are ~0.38 L wide and cut to the atlas's measured alpha envelope.
5. **A unit prototype that is non-uniformly scaled stretches its texture per
   instance.** The campus terrace blocks (up to 4.4 × 1.35 × 1.0 m) show
   horizontally stretched leaves on their long faces; no per-instance UV scale
   exists without a shader change (= a new program). Accepted.
6. The ONE extra draw call at `hedge-arrival-court` is stable across reruns; the
   six hedge buckets' main-camera frustum tests are identical before and after
   there, so it is most likely a palm/hedge bucket whose larger prototype bounds
   now cross the SHADOW camera — not isolated further.

### KAN-208 WAVE 3 — WELCOME BOARD, COCKTAIL GLASSWARE, PEARLS, FESTOON, CARS (2026-09-25)

Shots: before `reference/photos/shots-wave3-before/` (the HEAD worktree on :8811),
after `shots-wave3/` — 63 views, the 51 of wave 2 plus twelve new ones:
`welcome-board`, `cocktail-glassware` (+`-night`), `cocktail-festoon` (+`-night`),
`ceremony-pearls`, `dinner-festoon`, `setup-festoon`, `afterparty-festoon`,
`arrival-cars`, `car-close`, `apron-cars`. `shoot-moments.mjs` views take a 4th
element `{ night: true }`, and EVERY view now re-asserts its moment's own
lighting after `setMoment` (which early-returns on the current index, so a
night view would otherwise leak into the next one). **Read ASSET_SPEC Group I.**

| item | what changed | tris |
|---|---|---|
| welcome board | `welcome_board_frame` GLB (baked): an OAK moulding on the board's own Bézier outline + a white plinth foot, placed with the board's own transform — position (AX + 5.45, 66.8) and yaw −2.44 untouched (decor trap 3). Board, art plate and lettering stay ours; "Welcome" is now FITTED to 372 px (at a fixed 104 px it lost its W and e to the arch). "Carl & Rachel" unchanged. | +740 |
| cocktail glassware | `cocktail_glassware` (GEOMETRY ONLY, on our `glassPale` via the new `K.mdlAs(name, mat)` bucket) + `cocktail_drinks` (baked): wine glasses / tulips / 10-facet highballs / rocks tumblers with real walls; liquids, coconut foam, ice, grapefruit + rosemary, mint + passion fruit, orange twists. Same fifteen positions. No transmission anywhere. | 5,696 + 4,032 |
| pearl swags | PROCEDURAL, kept: arc-length strands at 2.6 cm pitch, 2.2 cm icosahedron pearls (`G_PEARL`, new `pearlS` bucket on `pearlM`), ~1,065 pearls, one call | 162 × 8 → 1,065 × 20 |
| festoon | PROCEDURAL, kept: drop + dark socket (K.dark) + a real globe bulb (`G_BULB`, 48 tris) on the same always-emissive `bulb`; the three `stringLights()` sites (prewedding, cocktail, after party: 174 plain Meshes, no cable) are `festoon()` runs with the cable; `stringLights` deleted | — |
| cars | `parked_car` + `_glass` + `_trim` + `_rims` (GEOMETRY ONLY on MAT.car tinted / MAT.carGlass / MAT.dark / MAT.car silver), one `mat4(cx, baseY, cz, 1,1,1, yaw)` per car, ALL 16 (the court's 4 + the north apron's 12 — one helper). Tail lamps stay carI boxes; head lamps are in `_rims`. Colliders untouched. | 1,612 / car (was ~200) |

| 63 views | before | after |
|---|---|---|
| triangles (sum) | 36,703,125 | 37,588,062 (**+2.4 %**) |
| draw calls (sum) | 20,330 | **19,855 (−475)** — `car-close` alone is −428 (its before camera stands elsewhere, ⚠ 7); cocktail views −21…−29, setup / after-party festoon −16…−21, most others +2 |
| shader programs | 116 | **115 at every view, day and night** (⚠ 1) |
| colliders / feet / night flags | | identical at all 63 views; `colliderHash 026674019d51` both |
| lights (guest journey) | 40 / 12 | 40 / 12 |
| guest journey | | 0 stalls, every beat, `ERRORS []` |

+19.6k tris and +2 calls at almost every view are the four campus-wide car
buckets (InstancedMeshes: one bounding sphere, never culled per instance, never
touched by `detailcull.js`) minus the retired carWheelI / carGlassI. fps:
vsync-capped 120 at every view that was; A/B reruns at the uncapped ones
(brunch-spawn, arrival-lobby-sofas) sit in the noise; `setup-festoon` read
95.9 / 95.9 after vs 98.1 / 100.2 before (~−3 %, marginal, not isolated).

**Scatter proof** (`tools/scatter-probe.mjs`): before prints wave 2's own
`allMatrixHash a79ae12f4089`; after is `bd5620632a1c`, as it must be (new
buckets). Matched per InstancedMesh (chain, count, matrix hash, colour hash):
**270 of the 283 are byte-identical**, and the 13 that differ are exactly the
intended buckets — the ceremony + cocktail pearls; the cocktail glass / rod /
flute / flor / white buckets that held the old glassware; dinner's lamp bucket
(now flames only) and its dark bucket; campus `darkI` (−80 = 5 parts × 16
cars), `carI` (192 → 32), `carWheelI`, `carGlassI`. Every other bucket is
unchanged — the seeded stream did not move (nothing new draws `rnd()`).

⚠ **What this wave learned:**
1. **Programs went 116 → 115, and that is a REMOVAL, not a leak.** The
   non-instanced `bulb` program existed only because `stringLights()` added 174
   plain bulb Meshes; with every run instanced it is never compiled. Nothing new
   compiles: the glass shells ride the existing instanced `glassPale` program,
   the car parts the existing campus materials, bulbs and pearls existing
   materials, the two baked GLBs the shared baked-map program — so main.js's
   warm-up needed no change. If a build ever shows 116 again, find what
   re-introduced a plain emissive mesh.
2. **world.js relocates campus instances ONE BY ONE by `isEnclaveLocal(x, z)`**,
   so a multi-part prop that straddles the line is torn in half. The north
   apron's cars sit at z ≈ −78 against the z −77.4 line: every part more than
   ~0.6 m ahead of a car's centre (bonnet, A-pillars, mirrors, head lamps, front
   wheels, bumper) was being rotated into the enclave and stood as a row of
   floating car fronts on the lawn behind the cabanas — live since 2026-08-04,
   found only because the new head lamps went missing. A one-instance GLB is
   decided by its centre and cannot tear; the head lamps therefore live IN
   `parked_car_rims`, never as separate carI boxes.
3. **A frame must be a different VALUE from what it frames**: the first moulding
   in `paint_w` vanished against the pale board; oak reads.
4. **Liquid behind glassPale lifts ~40 % toward a cool white**: at the menu's
   hues the drinks read peach / lime / pastel, and red-orange went SALMON (the
   veil is blue-white). The cocktail palette keys in wv_lib.py are deliberately
   deeper and yellower.
5. **`bakeKit` iterates `Object.keys(K)`** — a function added to the kit
   (`mdlAs`) must be skipped there, or `initMoments` throws (`bake` reads
   `.rows` of a function) and the page never boots.
6. The glass shells are ONE instance holding fifteen glasses, so three sorts them
   as one transparent object; with FrontSide and the opaque drinks drawn first,
   the far inner wall depth-fails behind the liquid and one glass layer veils it.
7. `car-close` picks `campus:carBodyGlbI` instance 13, which does not exist on
   the old build — its BEFORE shot fell back to a carI box and stands elsewhere.
   Compare the cars with `arrival-cars` / `apron-cars`.
8. Only the seven new GLBs were exported (each within its TRIS, 1 mesh / 1
   primitive / 1 material); a full `export_all.py` was NOT re-run, to keep the
   committed GLBs byte-stable. Manifest: 85 entries, 219,795 tris, 3.69 MB.
9. The campus key census (the ONE-KEY-PER-PAIR rule) gains four keys —
   `carBodyGlbI`, `carGlassGlbI`, `carTrimGlbI`, `carRimGlbI`, each bound once
   in `parkedCar()` — not re-run with a script this wave.

### KAN-208 WAVE 4 — THE UNDERSTORY: SHRUBS, COVER, BOUGAINVILLEA, CASUARINAS, ATRIUM, POOL HEDGES (2026-09-25)

Shots: before `reference/photos/shots-wave4-before/` (the HEAD worktree on :8811),
after `shots-wave4/` — 72 views, the 63 of wave 3 plus nine: `shrubs-apron`
(+`-night`), `shrubs-dune`, `cover-beds`, `boug-terrace`, `casuarina-band`
(+`-night`, the After Party), `atrium-topiary`, `pool-hedge-south`. They use
fixed coordinates (no `pick()`), so the same camera stands in the old build.
**Read ASSET_SPEC Group J** and `js/foliage.js`'s banner.

**The move: CORE + FRINGE.** Every blob bucket keeps its matrices, instance
colours, material and rnd() draws and only swaps its prototype (the CORE:
`shrub_core`, five lobes, the same 80 tris; `cover_core`, the same 20). The
silhouette is a NEW bucket fed the very same matrices (`fringeFor()`): 16
alpha-cut leaf-clump cards (`shrub_fringe` / `_b`, alternating by index; 10
near-level ones for the cover, which is squashed ~5× in y) on `leafMat()` —
a generated leaf clump (`shrub_leaf.webp`, magenta-keyed; `boug_leaf.webp`,
shot on COBALT and keyed `--mode flat` because the bracts ARE magenta). The
fringe casts no shadow and has NO instance colour, on purpose: instanced + map
+ alphaTest + DoubleSide without instancingColor is the palm fronds' / the
casuarinas' existing program. Colour it per instance and three compiles two
new programs.

| item | what changed | tris (was) |
|---|---|---|
| shrub masses (nature, 825 incl. dune scrub) | `shrub_core` + fringe a/b (413 + 412) on `leafMat('shrub')` | 80 + 32 (80) |
| ground cover (nature, 350) | `cover_core` + `cover_fringe` | 20 + 20 (20) |
| bougainvillea (nature 19; campus `bougain` 13, `bougI` 2, `subBougI` 9) | `shrub_core` (campus: a .5 clone — UNIT_BLOB is r .5) + fringe on `leafMat('boug')`; the CAMPUS core also trades flat-shaded `MAT.bougain` (a solid pink ball; shared with the band's guitarist, so not changed) for a boug.webp photo material | 80 + 32 (80) |
| river-dressing shrubs (water, 263) | `shrub_core` + fringe; `plantM` gains shrub.webp (lands on nature's MAT.shrub program) at an exposure of 7 so the authored PALETTE × photo keeps the palette's brightness | 80 + 32 (80) |
| casuarinas (campus `casuLeafI`, 18 tiers) | ⚠ the map WAS applied — casuarina.webp was a grey-sage (opaque mean 109,111,97) with magenta spill, installed without a balance. `regrade_foliage.py` despills and balances it to `#44583a`. Geometry: `casuarina_tier` — 17 drooping needle curtains in the cone's envelope, no base cap (the cap sampled the whole map as a flat disc: the grey "saucers" on every trunk) | 102 (20) |
| atrium cloud topiary (14 plants) | each cloud is `topiary_ball` × its diameter on hedge.webp (repeat 1 × 1, a canvas stand-in from the start), four clipped-green tints for the four flat greens, same rnd() pick | 300 / cloud (80) |
| atrium pond-edge broad-leaf clusters (7) | not asked for, but next to the new topiary they were the last flat pale spheres: now an INSTANCED `shrub_core` bucket per cluster (so its fringe can ride the instanced leaf program) + fringe, children of the swaying group; shrub.webp in two greens | 80 + 32 (56) |
| water.js hedges (pool south end, pavilion run) | `hedgeRunX()`: `hedge_run` cells (~2 m, 6 cm overlap) merged into ONE Mesh on MAT.hedge — same draw call — and MAT.hedge now wears hedge.webp (repeat 2 × 1) in nature's mean hedge tint | 236 / cell (12 / box) |

| 72 views | before | after |
|---|---|---|
| triangles (sum) | 42,584,717 | 45,516,957 (**+6.9 %**; +0…+65k a view, mean +41k) |
| draw calls (sum) | 21,628 | 22,185 (+557; 0…+18 a view) |
| shader programs | 115 | **113 at every view, day and night** (⚠ 1) |
| colliders / feet / night flags | | identical at all 72 views; `colliderHash 026674019d51` (10,797) both |
| lights (guest journey) | 40 / 12 | 40 / 12 |
| guest journey | | 0 stalls, every beat, `ERRORS []` |

The +41k is almost all the fringe on the campus-wide buckets (825 × 32 +
263 × 32 + 350 × 20 ≈ 42k), drawn wherever any shrub is on screen (one
bounding sphere per InstancedMesh, never culled per instance). fps: vsync 120
where it was; A/B reruns at the uncapped views (belt crowns, arrival court,
swim-up bar, island-bar thatch, after-party festoon, brunch spawn) are inside
the ±5 % noise except the arrival court / swim-up bar, which read ~−4 % on
some runs (alpha-tested overdraw), not isolated further.

**Scatter proof** (`tools/scatter-probe.mjs`): before `allMatrixHash
bd5620632a1c` (wave 3's own), after `85493acb365f` — as it must be, 27 new
buckets. Matched per InstancedMesh: **all 293 old buckets have byte-identical
matrices and instance colours**; the only differences are prototype tris
(`casuLeafI` 20 → 102; the blobs 80 → 80 / 20 → 20 with new geometry) and
five buckets gaining a map (`river` plants, `bougain`, `bougI`, `subBougI`,
and `casuLeafI` already had one). The new buckets are 13 fringes (nature
shrub a/b, cover, boug a/b; river a/b; campus bougain / bougI / subBougI a/b)
and the atrium's 7 cluster cores + 7 fringes. A runtime check (every fringe's
matrix k == its core's matrix `v + k·n`, AFTER world.js's enclave cull and
water.js's river cull) passes for all 20 fringes: both culls sweep
`root.children`, so a collapsed shrub collapses in both buckets.

⚠ **What this wave learned:**
1. **Programs went 115 → 113, and that is a REMOVAL.** The atrium's flat-shaded
   colour foliage (`foliageMats` / `leafMat`, `flatShading: true`, non-instanced)
   was the only user of that program pair (main + mirror colour space); nothing
   draws it now. Verified by decoding `renderer.info.programs` cache keys before
   and after: the ONLY difference is those two. If 115 reappears, something is
   flat-shading a plain mesh again.
2. **A leaf card that needs per-instance colour cannot share the frond
   program.** That is why the tint lives on the core and the card textures are
   graded (and `leafMat` carries a slight warm-green day colour).
3. **Decode `program.cacheKey` before designing a material**: the two trailing
   integers are three's two boolean masks (instancing = bit 1, instancingColor
   = bit 2, alphaTest = bit 10 of the first; flatShading = bit 2, doubleSided =
   bit 11 of the second). That is how the fringe was placed on an existing
   program instead of discovered afterwards.
4. **A bougainvillea cannot be shot on magenta**, and on green its leaves key
   out. A flat cobalt backdrop + `--mode flat` works, but the backdrop SHADOWED
   between the leaves is a darker blue the distance key cannot clear without
   eating dark leaves — `gen_art.py`'s new `drop_backdrop_hue: "blue"` drops
   blue-dominant texels after the key and re-bleeds.
5. `casuarina.webp` had no raw plate and no manifest entry, so gen_art cannot
   re-install it; `assets/blender/regrade_foliage.py` grades a keyed RGBA map
   in place (despill + opaque-mean balance, alpha untouched). Re-run it only on
   the ORIGINAL file (git show 9c9331a:assets/textures/casuarina.webp).
6. The before shot of a view that is REFRAMED after the full before-run is
   stale: `pool-hedge-south` was re-shot alone on :8811 and merged into
   `shots-wave4-before/stats.json` (noted in the file).
7. Only the six new GLBs were exported (each within TRIS, 1 mesh / 1 primitive /
   1 material); manifest 91 entries. The campus key census is unchanged — the
   fringes are born in `flushBuckets`, never through `inst()`.

### KAN-211 WAVE A — THE ARRIVAL PAVILION + CHECK-IN LOBBY AS BLENDER ARCHITECTURE (2026-09-25)

The first wave where the GLBs are the BUILDING, not props on it. Seven GLBs
(**ASSET_SPEC Group K** has every row): `arrival_shell` (the corten walls),
`arrival_roof` (mono-pitch roof, seams, fascia, the fold, cedar soffit),
`arrival_stair` (6 risers, landing, cheeks — the one glossy GLB), `arrival_entry`
(canopy + slatted soffit, banded piers, bronze door frame, sconce plates, the
plaque wing's banded wall), `arrival_sconce` (GEOMETRY ONLY on our glowing
`MAT.brassFlute`), `lounge_facade` (the courtyard face: folding-door frames,
louvres, the tiled charcoal pier, the balcony's slab edge / stone fascia beam /
cedar soffit / capping, the lobby's frames + transom), `lobby_desk` (counter,
bamboo slat front, monitor, white cabinet wall). **10,708 tris, 0.81 MB**;
manifest 98 entries. Generators: `assets/blender/generators/_arch.py` (shared) +
one per GLB. Shots: before `reference/photos/shots-archA-before/` (HEAD worktree
on :8811), after `shots-archA/` — 80 views, the 72 of wave 4 plus eight
`archA-*` (court approach, court three-quarter, stair + canopy, canopy at night,
lobby desk, balcony from the link, courtyard face, lounge deck), fixed
SITE-derived cameras so the same camera stands in both builds;
`shots-archA/compare-archA-*.jpg` are the side-by-sides.

**THE CONTRACT: authored IN SITE COORDINATES, visual only.** Every Group K GLB
shares one frame with its origin at the ANCHOR `(ARRIVAL.backX, 0,
ARRIVAL.axisZ)` = (33, 0, −8) and is ONE identity instance there (`ANCHOR()` in
`buildArrival`, `modelI` keys `arr{Shell,Roof,Stair,Entry,Facade,Desk}GlbI` +
`arrSconceGlbI`). The generators read the numbers from the LIVE `js/site.js`
(`_arch.site()` runs node on it), so a GLB cannot drift from a published
number. Every collider, WALK_REGION, spawn, interactable and `rnd()` draw is
untouched; every replaced primitive is gated `if (!haveArch / !haveFacade /
!haveDesk)` and stays as the fallback.

| 80 views | before | after |
|---|---|---|
| draw calls (sum) | 26,521 | **26,437 (−84)** — the eight arrival views −1…−5 each (≈15 small buckets became 7 GLBs) |
| triangles (sum) | 51,502,474 | 51,588,378 (**+0.17 %**) — arrival views +5.6k…+9.5k; −660 at most other views (55 `darkI` instances left a campus-wide bucket) |
| shader programs | 113 | **113 at every view, day and night** — nothing new compiles: the bakes ride the instanced baked-map program, the sconce the brassFlute one |
| colliders / feet / night flags | | identical at all 80 views |
| `colliderHash` (scatter-probe) | `026674019d51` (10,797) | **`026674019d51` (10,797)** |
| floorY, 21 probes (lane 0 → .489 → 1.222 → 1.890 → 2.414 → 2.650; court / forecourt 2.650; stair foot 2.697, mid 3.125; landing / door / lobby / desk / link / slot 3.600; balcony 3.580; lounge 0.000; deck .120; internal stair mid 1.800) | | **byte-identical** before/after |
| lights (guest journey) | 40 / 12 | 40 / 12 |
| guest journey | | 0 stalls, every beat, "Check in" PROMPT ✓, `ERRORS []` |

Scatter: `allMatrixHash 85493acb365f → e37fbff558e9`, as it must be. Keyed by
(name, chain), 174 of 189 buckets byte-identical; the rest are exactly the
intended ones — `glass` (the two parked door leaves shortened to fit under the
canopy), `darkI` 292 → 237, `arrCortenI` 14 → 5 (the gate piers + the internal
stair wall stay), `arrBlackI` 28 → 19 (the internal stair stays), `arrSoffitI`
4 → 1 (the link's), ten arrival buckets gone, seven GLB buckets new. No `rnd()`
draw moved (the desk's flowers, the planting and the sofas' cushion jitter all
still draw).

Image generation (tag `venue-arch`, cap $15): **2 images, $0.27** —
`corten_weathered.webp` and `cedar_soffit.webp`; `panel_walnut.webp` is derived
from the cedar locally.

⚠ **What this wave learned:**
1. **The longest UV island caps a baked atlas's texel density.** `pack_islands`
   scales every island by ONE factor, so a 24 m wall skin fits a 2048 atlas at
   ~85 px/m no matter how little else is in it — the first shell bake left HALF
   the atlas black. Architecture is built in ≤ 5 m pieces (`_arch.spans()`);
   the world-scale art UV keeps the photograph continuous across them.
2. **AABB packing starves hundreds of thin seam/slat islands** — new opt-in knob
   `PACK_SHAPE = "CONCAVE"` (make_masters → `wv_bake.prepare_for_export`); every
   earlier asset keeps AABB.
3. **A tiling photograph on a 24 m wall repeats its blotches in a grid.** The
   skin is cut into its standing-seam PANELS and each panel takes a random UV
   shift (`world_uv(du, dv)`) — each panel weathers on its own, as real ones do.
4. **The canopy soffit is only 1.95 m over the lobby floor** (5.55 − 3.60) where
   it runs 0.3 m inside the door plane — site.js registers it as the stair's
   `ceil`, so it cannot move. The old 2.3 m door frame, the 2.2 m parked leaves
   and the 1.2 m sconces all ran up THROUGH it; the door head now sits at
   lobbyY + 1.90, the leaves are 1.73 m panes, the sconces Ø .20 × .80 at 4.85.
5. **A baked GLB material is not on the night registry** — the corten would have
   stayed day-bright while every campus material darkened. `archMat()` sets each
   Group K material's roughness / envMapIntensity and `tint()`s it (uniforms,
   no program), once, guarded by `userData.kan211`.
6. **A Mix (multiply) node after the image did not reach the atlas** (observed
   once, cause not isolated) — darken in the picture, not the node tree.
7. **Board textures tile-blend on ONE axis** (`blend_axis: "y"`): the both-axis
   blend rolled the board joints half a board and cross-faded them, doubling
   every joint across the middle of the tile.
8. **Vertex image generation 429s when another agent is generating** (the
   open-empires UI run shared the quota). Failed calls log nothing and cost
   nothing; a backoff loop around `gen_art.py` got both through.
9. The plaque wall is RECESSED now (f_001), so the game's plaque plane moved
   from faceX + .15 to faceX − .24 (30 mm proud of the ledges) — same y, same z.
10. Only the seven new GLBs were exported (each ≤ its TRIS, 1 mesh / 1 material);
    no earlier GLB was touched. `wv_bake.py` / `make_masters.py` gained only the
    opt-in `PACK_SHAPE` knob.

#### WAVE A2 — the look pass (2026-09-25, on top of checkpoint dd85e79)

The coordinator's review against f_001: correct but not yet a visual win. Three
fixes. Shots: before `reference/photos/shots-archA2-before/` (dd85e79 in a
worktree on :8811), after `shots-archA2/`; side-by-sides
`shots-archA2/compare-archA-*.jpg` and the 3-way
`compare3-archA-court-threequarter.jpg` (f_001 | dd85e79 | A2).

1. **Corten tone, MEASURED.** f_001's warm rust face: mean (96, 80, 72), std 19.
   Wave A rendered the end wall at (126, 115, 103), blotchy. Now **(94, 82, 69),
   std ~20**. Three changes: a v2 texture (fine VERTICAL streaks on an even dark
   warm ground, balanced `#4a3a30`, tile-blend on x only — a y cross-fade smeared
   the streaks into a band); seams on a derived `corten_dark.webp` (× 0.30
   linear), so every seam is a crisp dark line; and the shell/roof at env .45 /
   rough .85 (at 1.0 / .72 the PMREM's grey sky sat on every panel as a sheen).
2. **Canopy soffit + stair.** The slats move to their own GLB, `arrival_soffit`,
   in a solid warm bronze-brown at rough .88 / env .35. At .42 they had shared
   the piers' gloss and mirrored the sky as grey-white stripes. `arrival_entry`
   drops to 564 tris. The stair goes to a warmer charcoal (#3a3532) with a pale
   honed NOSING band wrapping every tread edge, at env .3 / rough .38: it had
   mirrored the grey sky at the court's grazing angle. Measured stair
   (88, 92, 95) → (87, 84, 81).
3. **The court's planting.** `frangipani` + `frangipani_leaves` replace the
   four blob trees. They are thick grey multi-trunk candelabra branches with
   5-card leaf rosettes (one generated card, pink + white flowers, keyed off
   cobalt), each tree one instance at its old position. `cordyline_clump` and
   `cordyline_clump_ixora` are prototype swaps in the UNIT_BLOB envelope, on
   the blob's own matrix and colour. **Proof** (matrix-level, not just hashes):
   - `arrPlantI` after is an ORDERED SUBSEQUENCE of before, minus exactly 68
     instances. Of those, 8 + 12 reappear with identical matrix + colour in
     `arrCordyGlbI` / `arrIxoraGlbI`; the other 48 are the frangipani canopy
     blobs and flecks.
   - `arrTrunkI` 14 → 2.
   - Every other one of 184 buckets is byte-identical. The rnd() stream did not
     move: the GLB path still draws the blob tree's **77** rnd() and drops them.
   - `colliderHash 026674019d51` (10,797) both.

| 80 views, dd85e79 → A2 | before | after |
|---|---|---|
| draw calls (sum) | 26,437 | 26,493 (+56: +5 at the court/courtyard views, 0 at 62 views) |
| triangles (sum) | 51,588,378 | 51,646,526 (+0.11 %) |
| shader programs | 113 | **113 at every view** (bake program, arrTrunkI's, the leaf program, plantFlat's) |
| colliders / feet / night | | identical at all 80 views |
| floorY, 21 probes | | byte-identical |
| guest journey | | 0 stalls, every beat, Check-in PROMPT ✓, lights 40 / 12, `ERRORS []` |

fps: `hedge-arrival-court` read 94.2 → 81.2 in the full runs. Two A/B reruns
there read 89.0 / 67.4 before against 88.4 / 90.6 after, so that is run-to-run
noise, not a regression.

Image generation (`venue-arch`): **+2 images** (corten v2,
frangipani card); running total **4 images, $0.54**.

⚠ **What A2 learned:**
1. **Measure the RENDER against the photo, not the texture against the photo.**
   The v1 texture was balanced to f_001's colour and still rendered 30 points
   lighter and grey. The env reflection and the sun lift it. Grade the texture
   darker than the target and re-measure in the shot.
2. **One GLB = one roughness** is a real constraint on architecture. Split
   anything that must be matte away from anything glossy (soffit vs piers).
3. **A leaf card with pink flowers cannot be shot on magenta.** Cobalt +
   `--mode flat` + `drop_backdrop_hue: "blue"` (the boug recipe) keyed it
   cleanly first time.
4. A prototype swap on a SHARED bucket (arrPlantI also carries the dracaena,
   batters and lounge shrubs) needs a new key per call site, not a flush-time
   swap. The proof is then "ordered subsequence + moved instances match", not
   "bucket byte-identical".

**Deliberately not in this wave:** the lobby's slat ceiling and the lounge's
ceiling / floors (still `box()` + canvas maps), the lounge's breakfast
furniture, the internal stair, the upper walkway (LINK / SLOT / HEAD) and its
pergola, the terrace retaining wall and lane, the gate, the dracaena bowls and
batter planting (still blobs), the check-in staff.

### Not in this pass (next)

(Palms, hedges and topiary: done as PROTOTYPES in KAN-208 wave 2, above; the
shrub / bougainvillea / ground-cover blobs, the river dressing's shrubs, the
casuarinas, the atrium's topiary + pond-edge clusters and water.js's two hedge
boxes: KAN-208 wave 4, above.) Still primitive planting: the two SHADE TREES'
crowns (water.js `shadeTree`, four flat-green icosahedra — the big green dome
in the lagoon views), campus.js's sea-band `crotonI` (flat orange blobs) and
`agaveI` rosettes (pale cones);
every other `nature.js`/`water.js`/`campus.js` object; (the welcome board's frame, the
cocktail glassware, the pearl swags, the festoon and the parked cars: done in
KAN-208 wave 3, above); the check-in staff / human figures; the festoon cable as
real geometry (still 1-px lines — a 6 mm tube is sub-pixel at 5 m); the far
ends of the prewedding / after-party festoon runs, which still end in mid-air
over the turf edge (dark cable in night moments — not visible in any shot, but
not anchored either); adopting the tight pack and the metallic fix in the library; the
viewer's hook lift; `linen_ivory`'s pressed-fold crease tiles at ~0.7 m on every
skirt (reads as rental linen; drop the tile size if it bothers anyone).

**Adding an asset:** a row in `ASSET_SPEC.md` → `generators/<name>.py` from
`_template.py` → `make_masters.py -- <name>` → `export_all.py -- <name>` →
`node tools/shoot-models.mjs <name>` and LOOK → `K.mdl('<name>')` in moments.js
behind `models.has()`.

## THE MIRROR FRUSTUM — DONE 2026-08-06 (`js/mirrorfrustum.js` + `water.js`)

The lever the layer-mask pass named. three renders the mirror through the FULL
reflected view frustum, so at the brunch a 25-pixel sliver of pool cost ~900
draw calls. It now renders into the quad's own screen box.

**The maths is exact by algebra, not by tuning — this is why it cannot drift.**
Stock builds `textureMatrix = bias·P·V·M`. Narrowing to a target sub-rectangle
sets `P' = S·P`; the lookup must then land in that rectangle, `T = scale∘offset∘bias`.
**`T·S = bias` identically**, so `textureMatrix = T·P'·V·M = bias·P·V·M` —
unchanged. The file computes NO new texture matrix: it runs three's own line
from three's own `projectionMatrix` and the narrowing cancels out. A slide would
need a viewport/projection pair that disagree, and both come from one integer
rectangle three lines apart.

⚠️ It is a **VIEWPORT** narrowing, deliberately, not projection-only:
- sampling density is identical, so the reflection does not SHARPEN as you walk
  toward the pool (projection-only would have — which sounds like a bonus until
  you watch it happen);
- the ripple is in target UV, i.e. texels, and texel size is unchanged, so the
  swell does not shrink as you back away.

⚠️ **The single decision that made it work: Lengyel's `q` is solved from the
MAIN camera's projection, not the narrowed one.** Solved from the narrowed
matrix, row 2 differs from stock's, which MOVES THE FAR PLANE — measured as a
*narrower* frustum drawing MORE (+6 calls at the grazing view) and a visible
**0.989 mean |Δ|** inside the mirror. From the main camera's matrix, row 2 is
bit-identical to stock and both collapse to **0.0007 and 0 px**.

| view | mirror calls | fps |
|---|---|---|
| great room over the water (the dive lands here) | 934 → **399** | 51.3 → **62.1** |
| flyover | 695 → **194** | 39.2 → **67.6** |
| Welcome Brunch | 818 → **552** | 53.2 → **60.2** |
| quad behind the camera | 145 → **1** (skipped) | 70.9 → **94.3** |
| **pool deck at night — the signature** | 288 → 288 | 93.5 → 95.2 |

**It is ZERO at the signature shot and that is honest** — the quad fills the
screen there, so there is nothing outside it to cull.

**Motion is what decided it** (static pairs cannot catch a sliding reflection):
150-step walk + orbit, same frame ON and OFF at every step. The frame-to-frame
series track to **four significant figures at every quantile**; the pair
difference peaks at **0.19/255 against a motion signal of 29.4 — 150×**. The
viewport size changed 89 times along the path and the worst pair difference at
any size-change step is 0.054. A 240-step 360° sweep skipped the render on 68
steps, every one **exactly 0.0000**.

⚠️ **It broke the shader warm-up, and the fix is worth knowing.** `main.js`
spends a whole render behind the loading card buying programs; a NARROWED
warm-up reaches far fewer materials — 101 instead of 112, the missing 11
landing as a **139.8 ms first frame** plus two 40 ms stalls out on the path.
Gated: stay un-narrowed until the program cache has been quiet 30 frames, and
re-open whenever it moves. After: 114 programs, max frame 65.9 vs stock's 64.8.

`?mf=off` **is stock, not an approximation of it** — verified against an
untouched checkout served side by side: identical draw calls, triangles and
program count at six viewpoints, to the unit. Composes with `?ml=*`.

⚠️ Known and bounded: a narrower frustum can draw **1–2 MORE** objects, because
three culls by bounding SPHERE and the kept set is not monotone in the frustum.
Both observed cases are one 40-triangle suite mesh.

**Two pre-existing findings for a future pass, neither fixed here:**
1. ⚠️ **three's transmission pass runs INSIDE the mirror pass** at the
   prewedding deck — one `transmission: .85` material in moments.js (the
   champagne glassware) makes the campus render a THIRD time, which is why the
   mirrored-suite views cost 2,948 mirror calls against the deck's 288. That is
   the biggest single remaining cost on this campus.
2. The far-plane behaviour of Lengyel's oblique clip is frustum-shape
   dependent — documented at the call site.

## THE GUEST JOURNEY HARNESS — `tools/guest-journey.mjs` (2026-08-06)

`node tools/guest-journey.mjs` (serve first: `python3 serve.py`) walks the whole
venue the way a wedding guest actually experiences it, in order, with real key
input and feet logged at every leg:

> dropped at the car → across the court → up the six-riser stair → the check-in
> lobby → the desk (**"Check in" must fire**) → out through the lobby's west
> opening → the walkway → the slot → the atrium's upper gallery (your room) →
> the pool deck → **Ceremony → Cocktail → Dinner → After Party**, each spawning
> flat and reaching its own beat → the rooftop **Welcome Brunch** and its
> champagne.

Every individual pass on this project verified its own fragment; **nothing had
ever walked the chain end to end**. It passes: 0 stalls, every beat reached,
feet 2.65 → 3.60 → 0.000 → 26.600 exactly as the height field intends, zero
console errors. `VENUE_URL=https://venue.carlfung.dev node tools/guest-journey.mjs`
runs it against production; `PLAYWRIGHT_PATH` overrides the borrowed
Playwright (this project has no dependencies of its own — it is a static site).

⚠️ **The lesson the harness itself taught, and why its waypoints look fussy:**
the first version aimed straight at each target, stalled ten times on the
lobby→walkway leg, and looked exactly like a broken route. It was walking into
the lobby's **west wall** (local x 33), and then into the walkway's own north
rail. **You go through the doorway, like in a building.** A naive straight-line
walk test will manufacture false failures on any interior route here — give it
waypoints, and when it stalls, probe what the collider actually is before
believing the route is broken.

## THE MIRROR'S REACH + A SWIMMABLE BAR — 2026-08-06 (`water.js`, `mirrorlayers.js`)

**A measured near-miss worth recording.** The Reflector is the single most
expensive object on the campus (hiding it: **+36 fps at the pool deck, +139 at
brunch**), so the plan was to stop it drawing the far campus via a layer mask
keyed on distance from the pool. **The premise was right and the lever is
nearly empty**: the mirror camera's own frustum ALREADY culls the far campus at
every viewpoint where the reflection is legible. From `off` down to a 55 m
radius the great-room view's mirror draws the identical **920 calls**; at
Ceremony, Cocktail and most fly views it draws **zero** (the Reflector mesh is
outside the main frustum, so three never calls `onBeforeRender`).

Shipped at **R = 120 m** — chosen as the MIDDLE OF A PLATEAU, not a knee:
between 90 and 140 m the mirror's content does not change at all, so any value
inside is arbitrary and the middle buys margin both ways. Below 90 the next
thing to go is the beachfront sea-edge band, which IS in the reflection looking
west. Worth **+4.0 fps at the pool deck, +5.0 at brunch, ±0.0 everywhere
else**, for a one-shot assignment and one bitwise OR per frame. Nine
identical-camera pairs with the clock pinned: eight at or below their own A/A
control; the one real signal is **95 pixels inside a single 15 × 24 px box**.

⚠️ **THE MEASUREMENT ERROR THAT NEARLY SHIPPED A DISASTER, and the general
lesson**: the first sweep used `geometry.boundingSphere` for every renderable.
**For an `InstancedMesh` that is the unit prototype at the ORIGIN**, not the
sphere covering its instances — so all ~200 instanced buckets measured as tiny
objects at the enclave origin, and the sweep "found" +45 fps at R = 70 by
deleting every palm, every hedge and the whole rooftop from the reflection.
three's own `Frustum.intersectsObject` prefers `object.boundingSphere`; match
it. (`detailcull.js` sidesteps this by excluding InstancedMesh outright.)

**⚠️ THE REAL LEVER, NAMED AND NOT ATTEMPTED** (it is the last big optimization
left): three renders the mirror through the **full reflected view frustum**,
not the mirror quad's SCREEN-SPACE EXTENT. At the brunch view the pool is a
**25-pixel sliver** and still costs ~900 draw calls. Narrowing the virtual
camera's projection to the reflector's on-screen bounds — rebuilding
`textureMatrix` from the same matrix — would cut that to near zero AND RAISE
the reflection's effective resolution. It means forking
`Reflector.onBeforeRender` rather than wrapping it.

**You can now swim up to the swim-up bar.** `riverColliders()` filled every
basin interior, so the approach moved 0.00 m. The mouth is two pieces: the
interior-grid pocket, plus **exactly two rim circles** at the counter's west
end picked BY COUNT so the opening cannot change width if the seeded outline
reshuffles (2.09 m of clear walking). ⚠️ **Circles are CONVERTED, never
deleted** — re-emitted at feet-height 80 m, the arrival court's phantom-collider
pattern: `placePalms` ignores y-ranges so the keep-out survives, and
`updatePlayer` skips them so the swimmer passes. Deleting them would have let
the scatter stand a coconut palm in open water. Containment re-checked on 36
bearings against the SEEDED OUTLINE (not the ellipse): endpoints identical at
33 of 36, exactly one now ends in water — the doorway. You still cannot walk
out through the front; the bar's own plinth holds you.

A/B hatches in the house style: `?ml=off` / `?ml=<metres>` / `G.mirrorLayers.*`,
and `?swim=off`.

## FIFTEEN BUCKET-KEY COLLISIONS — FIXED 2026-08-06 (`campus.js` + `site.js`)

⚠️ **THE RULE, now written at `inst()` itself: ONE BUCKET KEY PER (GEOMETRY,
MATERIAL) PAIR.** `inst()` binds BOTH on a key's first use *in build order*,
and `BUCKETS` is one module-level Map flushed once at the end of
`buildCampus` — so keys are shared **across functions**, not just within one.
Every later call with that key silently renders in the first material.

I found five in `buildArrival` and briefed those; the census found **fifteen**,
one of them cross-function (a `put()` in `buildVillas` bound `hedgeI` two
hundred lines before `buildGrassGround` asked it for a box). What was actually
on screen:

- **Both check-in staff were a single black cylinder stack** — torso, arms,
  skin head and hair all drawing the uniform-cylinder binding.
- The buffet's **marble top drew dark teak**; the desk lamp's **cone shade drew
  a dark cylinder**; the monitor drew teak.
- The LINK's whole **corten pergola drew copper**.
- The stair tower's **risers drew marble**, so the flight was a monolith.
- Every clipped **hedge RUN drew as a blob**; the retaining wall's **black
  coping drew pale stone**; sofa feet drew ivory; chair legs drew rattan.

Census: **15 collisions / 93 keys → 0 / 138**, over a merged namespace that
also resolves the helper-forwarded call sites (`put`, `at`, `figure`). All
21,725 instance placements hash identically before and after — no `rnd()` draw
count changed. Triangles actually FELL slightly (the mis-bound hedges were
drawing blobs where boxes belong).

⚠️ **One case was reverted on look, deliberately, and the accident became the
intent.** The wedding-dinner paved walk had been asking for `MAT.paver` and
silently getting `MAT.stone` for years. Fixed, it finally drew the campus sett
— which is right against the arrival court but reads as a **multicoloured
patchwork** on a 4 m walk between two manicured lawns, under the dinner. It is
now `MAT.stone` explicitly, on the key that is bound to it, with a comment
saying why. **Same pixels as before the fix, but honest.**

Also fixed in the same pass:
- **The eight rooftop four-tops had no colliders outside the Welcome Brunch** —
  campus.js built them permanently but only moments.js ringed them, so in the
  other five moments you walked through them. Now registered in
  `roofColliders()` from the published `brunchTables` list at `TABLE_R = 0.95`.
  The duplicate ring during the brunch is harmless BY CONSTRUCTION: same
  centre, same radius, same height window, so the union is what that moment
  already had. Proven — ceremony/dinner approach 0.011 m → **1.300 m** held,
  brunch approach **1.300 m unchanged** and the room still navigable.
- **The invisible pinch on the north-bank path**, and the culprit is worth
  recording: **a scatter palm trunk**. `nature.js placePalms` avoids
  `G.colliders`, but a PATH draws no collider and registers no exclusion zone,
  so paths are invisible to the palm scatter. The path moved (`PATHS[1][13]`
  (102, −14) → (100, −16)) rather than the tree, since nature.js cannot see
  paths. Negative samples along the whole path **3 → 0**; worst walker margin
  **−0.427 m → +1.249 m**; the palm's own seeded position is unchanged.

## THE DETAIL CULL — DONE 2026-08-05 (`js/detailcull.js` + one call in main.js)

The second optimization pass, after the light budget. Same shape: a per-frame
pass over the scene, no builder changes, one wiring line, a `?dc=off` /
`G.detailCull.disable()` A/B hatch.

**Measured first, and the measurement CORRECTED the plan.** I profiled and
found "hide all transparent meshes = +24 fps", and briefed it as an overdraw
problem. Decomposed in-page it was mostly something else:

| at the brunch view | fps | delta |
|---|---|---|
| baseline | 51.4 | |
| hide 259 transparent PLAIN meshes | 61.5 | +10.1 |
| + 11 transparent InstancedMeshes | 65.2 | +3.7 |
| + **the Reflector (ONE mesh)** | 104.1 | **+38.9** |

So the mirror pass is the single most expensive object on the campus — and it
must never be culled, being the signature shot. Per mesh, transparent costs
**~6× opaque**, which is what justifies two thresholds.

**Shipped: transparent < 16 px, opaque < 8 px, near-guard 70 m, dead band
×1.25, 0.30 s hide-dwell (showing is instant).** All chosen off curves, not
taste. The near-guard was EARNED: at 35 m the signature shot lost the
prewedding festoon's bulb glows (9 px at 36 m, mean diff 0.0332); at 70 m the
difference is 0.0000 with identical fps and hidden count. Free.

| moment | off | on |
|---|---|---|
| **brunch** | 61.0 | **79.5** — draw calls **1720 → 913** |
| setup / ceremony / cocktail / dinner / afterparty | at or above the 120 Hz cap | unchanged |

**Only one moment gets faster, and that is the point** — at the other five,
everything hidden was already outside the frustum (their draw calls do not
move). The pass costs **0.062–0.073 ms/frame**, which shows up as a small
regression at moments already running 40–200 % above any display's refresh.
Priced in deliberately: brunch is index 0 in the timeline and the only view
with the whole campus on screen.

**Visual equivalence, clock frozen so the A/A control reads exactly 0.000**:
worst pair **0.0388/255** (the high fly-over — ~30 specks of glow quad),
brunch 0.0015 with **782 meshes hidden**, and the suite interior, the
signature lantern shot, BOTH pool-deck mirror views, the atrium and the
ceremony lawn all **exactly 0.0000**. I compared the brunch pair myself and
cannot tell them apart. Worst number is 4× under the light budget's shipped
worst.

⚠️ **The Reflector renders the scene a second time from a different camera**, so
a decision made for the direct view would otherwise cull things out of the
reflection. The size test takes the **larger of the two apparent sizes**; both
mirror views measure 0.0000 as a result.

⚠️ **Never cull a light** — `.visible = false` on a light changes the light
count and recompiles every material (see the light budget's 570 ms stall).
Lights are skipped; `programs` stays 114, min = max, across all six moments
and both lighting states.

**The `.visible` ownership lock is the safety net**: moment groups and the
night system toggle visibility themselves, so any mesh another writer touches
is retired from the candidate list permanently. Proof: after 24 moment/night
switches with the cull live, `disable()` restores a visibility signature over
all 2,746 objects **bit-identical** to a cold `?dc=off` build driven through
the same sequence, with `locked = 0`.

**No pop**: 0 flips idle at every moment; 6.4 flips/s walking, 0 meshes
oscillating. If a future pass needs the CPU back, the lever is a **stride**
(process half the candidates per frame — the 0.30 s dwell has room), NOT a
smaller candidate list.

## THE SECOND POOL'S PAVILION + THE SWIM-UP BAR — DONE 2026-08-04 (`campus.js`)

From `reference/photos/3br-pool-area-view.jpg` (the open flat-roofed pavilion
standing between the waters — the missing hero there) and
`reference/photos/resort-swim-up-bar.webp` (slatted canopy, bottle shelving,
counter at water level, submerged stools, "POOL BAR", bougainvillea bowl).

Both were built by an agent that could NOT edit `site.js` (a concurrent pass
owned it), so every coordinate is derived from published `SITE.*` values —
a good discipline that is worth keeping. The pavilion is enclave-local at
(−56, −11.2); the swim-up bar is WORLD-space in its own `resort-poolbar` group
on the campus root, deliberately not enclave-shaped so `adoptCampus` skips it.

⚠️ **The two water passes ran concurrently on the same lagoon**, so the bar was
required to report its footprint for a merge check: AABB x 142.14…151.27,
z −9.91…−0.32, entirely west of the basin centre line. Verified after merging —
**13.87 m to the cabana islet, 11.4 m to the spoked pavilion, and the bar's
7.6 m planting-cull disc reaches neither** (checked empirically, not by
arithmetic: zero instances of either structure are zero-scaled).

**Three bugs the WALK test caught that a render never would** — this is the
project's "walk it, don't render it" rule earning its place again:
1. **A column dead on the centre-line of all four faces** — an "open pavilion"
   you could not walk into head-on. Fixed with an even column count.
2. **The hedges sealed it on three sides**: a walker was held 0.9 m out and
   moved 0.00 m in six bursts. Both runs now break for the axis they straddle.
3. **`water.js`'s river dressing buried the bar** — `buildRiverDressing` rings
   EVERY basin with `round(rm × 2.4)` shrub clumps (42 around the lagoon) and
   two ~3 m masses filled the frame. A new `cullPlantingAt()` sweeps both
   nature.js's and water.js's groups, scale-to-zero, house pattern.

Found, pre-existing, NOT fixed:
- **You cannot swim up to the swim-up bar.** `riverColliders()` fills every
  basin interior (rim chain + a 2.6 m grid of r 2.0 circles), so the in-water
  approach moves 0.00 m. Opening a swimmable mouth is a `water.js` job.
- ⚠️ **A bucket-key collision in `buildArrival`**: `inst()` binds geometry AND
  material on first use, but `arrTableI`, `arrChairI`, `arrCabI`,
  `arrCounterI` and `arrDeskI` are each called with TWO different materials —
  so the arrival's table legs, chair frames, desk trim and buffet marble all
  silently render in whichever material registered first. Left alone because
  fixing it CHANGES THE ARRIVAL'S LOOK, which wants Carl's eye. **General
  rule: one bucket key per (geometry, material) pair.**
- The pavilion's plinth is 0.16 m rather than 0.30 m because a raised floor
  needs a `WALK_REGION` and that registry lives in site.js — give it a real
  podium only in the same pass that registers it.

## THE RESORT POOL COMPLEX — DONE 2026-08-04 (`site.js` + `water.js`)

Built from `reference/resort-pool-complex-brief.md` and Carl's photographs. The
lagoon was flat blue blobs; it is now the complex the aerial shows.

- **The mosaic swirl floor** — the signature, and the reason the real aerial
  reads as spectacular. ONE seeded 768² CanvasTexture, **alpha-only**: the pale
  field is deliberately NOT painted, because the river's own shallow→deep ramp
  already is it (measured — the reference field `#2cb6d4` sits between
  `RC.shallow` and `RC.deep`), so every basin keeps its depth ramp, animated
  normal map and night flip underneath. Colours and widths are **measured off
  the aerial**, not guessed: 0.083 m/px from a cabana roof, ribbons
  0.7…5.2 m with masses to 7 m. Widths are true metres on every basin because
  `SWIRL.span` is the lagoon's own width (asserted with a `console.warn`), and
  the canvas tiles on both axes so one texture gives four different floors.
- **A real tree island**, `shadeTree()` extracted from the beach pool and
  reused verbatim. **It also fixed a pre-existing bug**: the island's coping rim
  was a CLOSED cylinder whose dark top cap sat 10 mm above the mound, so the
  "planted island" rendered as a black disc. Open-ended on both islands now.
- **The circular grass islet + seven cabanas in BOTH photographed styles** —
  four timber-framed slatted pavilions and three dark woven-rattan pods with
  white daybeds. Scaled to the BUILT 39 × 31 m basin, not the real assembly
  (the brief is explicit). Clearances machine-checked against the basin's
  seeded OUTLINE, not its ellipse: 11.20 m to the edge, 13.32 m to the crown.
- **The spoked pavilion**, half over water. Two things to know: the ribs sit
  60 mm proud because a rib from apex to rim is the SAME straight line as the
  cone's surface — coplanar, it z-fought and read as a plain umbrella; and its
  bearing moved off the aerial's because there it landed 2.5 m from an existing
  umbrella pole, which cannot simply be skipped (each consumes an `rnd()`).
- **A kayak in the west reach** — ⚠️ **and the channel was deliberately NOT
  widened.** Scaling `resort-kayak-channel.webp` off the kayak's own hull gives
  a real channel of **2.0…3.2 m**; ours run 2.3–3.1 east and 2.5–4.3 west.
  **The real kayak channel is the width we already build.** The kayak is placed
  on the reach that matches the photo instead.

**Counts held**: Reflectors **1**, logical point lights **40**, visible **12**,
shader programs **114 across all six moments and both lighting states** (no
light-count recompile). Cost: **+21 draw calls** and +3,936 triangles for the
whole pass — everything repeated is instanced and the swirl floor is a single
256-triangle mesh. The seeded scatter is untouched (static instance buckets
hash identically before and after).

Found, pre-existing, NOT fixed: one **invisible pinch on `PATHS[1]`** at world
(98.7, −11.7) where the nearest collider is 0.332 m inside `PLAYER_R` —
reproduced identically on the pristine build; and the spoked pavilion's raised
deck is not in the height field (it is ringed like `SITE.RIVER.BAR`, so you walk
around it — standing on it would need a DISC shape in `siteFloorY`, which
`rect`/`ramp`/`annulus` does not have).

## ONE LOUNGE — THE OLD 酒廊 DEMOLISHED 2026-08-04

Carl: *"clubhouse only have one lounge, lets build from scratch and let go of
the old one when you are done, this should be cleaner build."* Built, walked,
shipped, and now the standalone room at enclave-local (−44, −16) is gone —
`SITE.LOUNGE`, its two `WALK_REGIONS`, `buildLounge()` (106 lines), the
`'lounge'` entry in `CAMPUS_ENCLAVE_GROUPS`, nature's 24 m "lounge terrace
screen" hedge run, and the atrium's east side door. Every deletion left a
tombstone comment saying what stood there and why it went.

**`SITE.LOUNGE` was DELETED, not repointed** — the recommendation had been to
repoint it at the new room, but those numbers are already published in
`SITE.ARRIVAL`, and a second copy of a footprint is precisely the drift bomb
this file warns about. `world.js`'s keep-out and `nature.js`'s exclusion zone
now derive their rect from `SITE.ARRIVAL.bldg` + `DECK.x0` instead.

**That fixed a latent bug**: the entrance pavilion had NEVER been in either
keep-out list. Before, 12 understory instances stood inside the 酒廊's footprint
and one on its deck (all rescued after the fact by
`cullUnderstoryInsideEnclave`); now **0 are proposed at all**. The load-bearing
cull pair is intact, just doing less work.

⚠️ **AND ANOTHER THROUGH-THE-WALL BUG, same family as the ten found the day
before.** The atrium's "side door east toward the 隐逸居 lounge" had pointed at
nothing since the lounge moved on 2026-08-01 — what it actually opened onto was
**Garden Room C3**, a second hole in the party wall 2.5 m from that room's own
numbered door. Measured: pushing east along the gallery walked **through the
visible wall onto C3's floor at feet 0.220**. Now held. **The general lesson: a
named opening outlives the thing it was named for — when a building moves or
dies, grep for the openings that pointed at it.**

**The DINNER spawn was fine.** It was flagged as the sharp edge (authored on the
old plinth) but had moved to the pool lawn on 2026-08-02, 15 m clear; moments.js
reads no lounge footprint. Unchanged, feet 0.000, zero drift.

**⚠️ THE SEEDED SCATTER MOVED, deliberately — the campus's planting renders
visibly differently.** 1,435 of 1,887 nature instances relocated. Three inputs
necessarily changed: the hedge run count (23 → 12 segments, 3 `rnd()` each), the
exclusion rect swap, and one bougainvillea anchor (draw COUNT preserved at 4).
`buildLounge` itself consumed zero draws, so campus.js's stream is untouched.
The outcome is better, not merely different: 0 plants inside the new 酒廊 (was
13), 9 on the old lounge site (correct — it is grass now), 0 in the suite and
atrium on both sides. The only way back is a keep-out over (−44, −16), which
would leave a bald 22 × 17 m patch.

**Cost fell on every axis**: meshes −23, instances −66, colliders −178,
materials −1, triangles −2.4k…−5.7k per moment, logical point lights 43 → 40
(the demolished room's three) — and **visible point lights hold at 12**, so the
light budget is untouched. Draw calls −23 at the brunch view.

Also noted, pre-existing: the atrium's gallery stair boards SIDEWAYS off the
west gallery lane, not head-on from the south (pond A's kerb chain covers the
mouth) — that is what `atrium.js`'s own comment says, and the 08-04 entry above
reads as if every approach works; and one material in `makeMaterials()` is now
orphaned (built at boot, no mesh).

**Polish backlog addition:** `SITE.LOUNGE_POOL` is now a historical name — that
water serves the 3-BR keys and the dinner lawns, not a lounge terrace. Renaming
needs `water.js`.

## THE ROOFTOP, CORRECTED — DONE 2026-08-04

Carl, with `reference/photos/rooftop-pool-bar-daylight.webp`: *"the bar is very
close by the pool and the pool is definitely a lot shorter than what we have
now"*, plus `rooftop-bar-live-band.webp` for the stage.

| | was | now |
|---|---|---|
| **pool length** | **88.96 m** | **28.00 m** (27.05 at the lip, 28.95 at the back wall) |
| bar counter | — (a whole 89 m "room") | **10.00 m** |
| counter → pool's near coping | — | **8.71 m** |

The measurement that drove it: scaling the photo off the bar stools (~12 at
0.7 m ⇒ a ~10 m counter) put the real pool at 25–30 m. We were **3× too long**.

**The two-room 50/50 partition is gone; the roof is now a three-room precinct**
and the dining terrace is the RESIDUAL (bar's north edge → the dressed band's
end), so the rooms cannot overlap however the arc changes, and a `console.warn`
fires if the precinct ever stops fitting. Reads: 69 m south deck (screen wall,
cabanas, loungers) · **28 m pool** · 6 m walk · **20 m bar** · 4 m planted
break · 69.7 m dining terrace. `brunchTables` is re-derived as one row at
r 99.0 on a pitch computed from the pool room's own span.

The **live-band stage** is rebuilt from the photo: a living wall, splayed
columns, and eight **gold-edged perforated shields** (emissive — no lights
added, the budget is 12 slots), with two performers. Plus **four 11 m communal
tables** (96 covers, woven chairs, candles) beside the round/square ones.

**Two bugs caught inside the pass, both instructive:**
- **The stage panels were scaled edge-on.** `UNIT_SHIELD` is a Shape in XY
  extruded along Z, so the width is `sx`, not `sz`. Swapped, the visible face
  was the extrusion's SIDE wall, whose UVs come from ExtrudeGeometry's own
  generator and repeat — every panel wore the gold frame three times.
- **The brunch room could not be walked**: at the old 1.35 m table collider,
  neighbours on the new 3.16 m pitch claimed overlapping circles, and the
  champagne service plus the easel formed one blob across the room's only
  threshold. Collider → 0.95, champagne → r 99.6.

⚠️ **The pool is still 6.30 m across against the photo's ~11 m, deliberately.**
`rOut` 103.2 is the crescent's own roof and the inland band is fully spent
(coping → teak with loungers and four-tops → screen wall at 102.9). Widening
even a metre pushes the screen off the back of the terrace. Carl's correction
was the LENGTH, and that is delivered exactly.

Also found, pre-existing, NOT fixed: the north head-house stands inside the
dining terrace (dodged, not moved); and **the eight four-tops have no colliders
outside the Welcome Brunch** — campus.js builds them permanently but only
moments.js rings them, so in the other five moments you walk through them.

## THE 2F FALL HAZARDS — CLOSED 2026-08-04 (`atrium.js` + `suite.js`)

The check-in walkway turned the atrium's upper gallery into the venue's main
arrival route, and the gallery had **no edge colliders at all** — its
balustrades were visual only. Measured before the fix: **8 of 10 walks straight
off the edge**, feet 3.600 → 0.000, a 3.6 m fall onto the courtyard gravel.

Three more of the same family were found and closed in the same pass:

1. ⚠️ **The worst one, and it was not in the brief: ten door gaps let a 2F
   walker step THROUGH A VISIBLE WALL and fall.** `wallSkips` is per-WALL while
   the perimeter chain is built once for BOTH storeys, so every GROUND-only
   opening (eight single-storey keys, the suite portal, the 酒廊 side door) was
   also a hole at gallery height, where the facade is solid stucco. 10/10 walks
   went through, feet 3.600 → 0.220. Fixed as the exact mirror of the existing
   `upperOnly` mechanism: `gapSpec` entries now carry `floors`, and one
   `wallBack()` helper emits a `[0, H1−.2)` ground wall and a `[H1−.2, ∞)`
   gallery wall. **This is the general lesson: a per-wall skip list is wrong
   the moment one chain serves two storeys.**
2. The exterior stair's 2F landing had no west rail (3 of 6 walks fell).
3. Four suite 1F furniture chains still lacked `y1` and shadow-blocked the 2F
   lounge above them — found empirically by enumerating every all-height
   collider standing inside a `suite-2f-*` walk region, not by eye.

**All guards are DERIVED from the geometry they guard** — the atrium's 715
circles loop over the same `rails` array `buildBalustrade` draws from (and that
array now carries a banner saying it is also the collider, so a new rail is
guarded for free); this also deleted 83 hand-typed circles that were a
re-typing of two of those runs.

**Verified**: 10/10, 10/10 and 6/6 held after; a 17-probe sweep of the landing
went from 6 escapes to 0. **The ground floor is provably untouched** — the set
of colliders active at feet 0.000 is *removed 0, added 0* — plus courtyard laps
and corridor→door walks at feet 0.000. All six moments clean, all six prompts
fire, point lights unchanged, and five identical-camera pairs differ only by
ticker phase. Colliders 10,332 → 11,071.

~~STILL OPEN in `campus.js`~~ — **FIXED 2026-08-04.** The
check-in walkway's south balustrade `bal(SL.x0, …)` ran at
z −7.0 **straight across the exterior stair's 2F landing** (x 7.55…9.65,
z −8.10…−5.55). Two consequences, both reproduced: the route *pool deck →
exterior stair → clubhouse 2F* is **severed at the last step** (a walker going
north from the landing moves 0.00 m in 2.6 s), and standing in the z −7.0 ±0.61
band **ejects you EAST off the landing into a 3.8 m fall**. The fix is the one the same function
already applied on the west side (that rail deliberately stops short at z −8.1):
the south run now starts at `SL.x1`, a short stub closes the 0.5 m between the
landing and the slot's east side, and the landing's own east edge takes a
COLLIDER-only guard (the flight's balustrade at x 10.0 already reads as the
guard, so a second glass panel 0.35 m inside it would double up). The landing's
extent is DERIVED with site.js's own arithmetic, not re-typed.
**Verified**: walking north off the landing now reaches the walkway at feet
3.600 (it moved 0.00 m before); all five placements across the old ejection
band hold at 3.800; pushing east off the landing is held; and walking the other
way carries you down the flight.

## THE CHECK-IN LOBBY + THE 酒廊 — DONE 2026-08-04

Carl: the entrance *"is currently an open tunnel; it should be a checkin area…
essentially club house entrance is on 2nd floor and its slightly elevated"*,
and the floor below the balcony *"is actually the club house lounge where
people will be having breakfast"*. Both are built; the pavilion is now TWO
STOREYS. `site.js` + `campus.js` + `atrium.js` + `suite.js`.

**How the elevation resolves** — the arrival side stands on higher ground, so
the building is single-storey from the car park and two from the courtyard,
exactly as photographed. `ARRIVAL.terraceY 2.65` + the filmed `rise 0.95` =
**`ARRIVAL_LOBBY_Y = 3.60`**, asserted equal to `ATRIUM.floorH` (it warns if
anyone breaks that). The lane climbs 0 → 2.65 over 38.4 m (6.9 %, an ordinary
drive) with the ramps and the asphalt reading the SAME height array, so the
road cannot float; the court sits on a retained terrace with a stone face and
a planted batter round a derived rim.

**What is there now:** the **酒廊 at grade** — 280.7 ㎡ per floor, the hotel's
own published area, **60 covers**, folding glass standing open onto a timber
deck, plaque **隐逸居酒廊 / SERENE RETREAT LOUNGE**; the **check-in lobby at
3.60** with the wave-motif rug, cream sofas, slat ceiling and a cantilevered
frameless-glass balcony over the courtyard; the **desk** with its slat front,
white four-panel cabinet wall, monitor, lamp and flowers, **with staff**; an
internal stair between the two floors; and an **upper walkway** that forks —
into the atrium's upper gallery (new 2F-only door) and into the suite's 2F
(new door, collider split so the gap exists only above 3.4).

**"Check in" is a permanent interactable**, registered from campus.js during
`buildWorld`, enclave-local with NO `__world` flag (world.js maps it through
`enclaveToWorld` once — flagging it would land it 90° away, the mirror image
of the Welcome Brunch's opt-out), pushed before `initMoments` snapshots so the
moment collider swap never eats it.

⚠️ **Carl's literal "left to the rooms, right to the suite" is NOT achievable
in this plan and was not faked.** The arrival is at the enclave's +X/+Z corner
and both the suite and the atrium lie north-west of it — everything is to the
guest's right. The walkway forks instead, and the toast says left/right. Making
it literal means mirroring the arrival to the enclave's west side, which
re-opens the lane, the water clearance and the whole arrival composition.

**Verified**: every floorY probe exact (lane 0.188→1.890→2.650; court 2.650;
lobby/desk/link/atrium-2F **3.600**; suite 2F **3.800**; lounge **0.000**);
eight logged walks including car→stair→lobby→desk (prompt fires), the fork
both ways, the internal stair both directions, and the balcony rail holding.
Six moments regression-clean, **lights unchanged**, zero console errors.
Side-by-side: `reference/photos/compare-checkin-lobby-2026-08-04.jpg`.

**Found, pre-existing, NOT fixed — one of them now matters more:** the
**atrium's 2F gallery court edge has no colliders**, so walking the upper
gallery you can step off and fall 3.6 m. It was obscure before; the new
walkway makes that gallery a through-route. Also: the exterior stair's 2F
landing has no west rail (it is a junction now, not a dead end), and four of
the suite's 1F furniture chains still lack `y1` (six were fixed here, two of
which stood invisibly in the 2F lounge where the new door opens).

## THE LIGHT BUDGET — DONE 2026-08-04 (the venue is 2–5× faster)

`js/lightbudget.js` (new, self-contained) + ONE call in `main.js`. No builder
changed; `world.js` untouched.

**The problem, measured before anything was written.** Three.js's forward
renderer evaluates EVERY visible point light on EVERY lit fragment. The campus
carried **31 point lights with ranges of 7–34 m spread over ~500 m** — the
hotel's lamps were being shaded into every pixel of the suite. Profiling put
this beyond doubt: halving the lights nearly doubled the frame rate, while
shadows cost 2.8 fps and per-frame CPU (tickers, matrix updates) cost nothing.

**The design.** The 31 lights stay exactly where they are but are set
`.visible = false` permanently — they become pure data carriers, so every
builder's day/night fan-out and every moment-group visibility rule keeps
working untouched. A pool of **12 real point lights lives at the scene root**,
always visible, and each frame the budget assigns the most relevant logical
lights into those slots: influence spheres frustum-culled first, then scored
`intensity / dist² × clip²`, with 0.15 margin + 0.35 s dwell hysteresis.

| moment | before | after |
|---|---|---|
| Welcome Brunch | 19–34 | **61.5** |
| Prewedding (night) | 16–31 | **84** |
| Ceremony / Cocktail / Dinner | 29–75 | **120 (vsync cap)** |
| After Party | 31–81 | **83** |

**Two findings worth keeping:**
- **It fixed a pre-existing stall nobody had diagnosed.** The Wedding Dinner's
  two point lights took the visible count 29 → 31, recompiling every material
  on the campus: a **570 ms blocked frame** on the first switch to that moment.
  With a constant count it is **8–31 ms**. Max frame during the opening dive
  went 175 ms → 33 ms.
- **Inverse-square beat screen-area scoring, because occlusion is the term
  none of them can see** and distance is the cheapest proxy for it. Screen-area
  scoring gave three slots to the atrium's gallery lamps at 55 m — lighting a
  gallery the viewer was standing in front of — and dropped a 20 m lamp whose
  entire lit patch was on screen.

**Verified**: 16 identical-camera pairs with animation frozen (the A/A control
is exactly 0.000, so every number is lighting and not the clock) — worst mean
absolute difference **0.163/255**, nothing above 0.6 % of pixels differing by
more than 8/255. Program count **114, min = max**, over a 2,786-sample sweep of
all six moments, both lighting states and a fly-through. Flicker: 0.25 material
evictions/sec, zero oscillations, and a 360° rotation probe shows the
frame-to-frame difference series is within 0.35 % of the un-budgeted one.

⚠️ **N = 12 is the measured knee, not a guess** — 8→12 costs 3 % at the worst
moment, 12→16 costs 22 %, 12→20 costs 36 %; and N = 8 visibly dims the suite,
which has 8 lights in one room. Empty slots are NOT free (the point-light loop
has no early-out), so do not raise N casually.

**A/B it**: `?lb=off` or `?lb=<n>` on the URL (cold boot, no recompile), or
`__game.G.lightBudget.disable()` / `.stats()` / `.setScore(...)` at runtime.

**Known approximations, documented in the file**: the Reflector's second pass
reuses the MAIN camera's slot assignment (measured unobservable at the two
viewpoints where the mirror fills frame, but it is real); the budget cannot see
occlusion; and the light-count recompile is now structurally prevented for
POINT lights only — a future builder toggling a Spot/Directional `.visible`
re-introduces that class of bug.

## CARL'S DECISIONS — 2026-08-04 (read before re-planning anything)

**1 · The clubhouse has exactly ONE lounge, and it is under the check-in
lobby.** Carl: *"clubhouse only have one lounge, lets build from scratch and
let go of the old one when you are done, this should be cleaner build"*. The
entrance pavilion is TWO STOREYS — the 酒廊 at courtyard grade, the check-in
lobby above it with a cantilevered frameless-glass balcony. Photographed
proof, and the room's own plaque reads **隐逸居酒廊 / SERENE RETREAT LOUNGE**:
`reference/photos/clubhouse-lounge-checkin-balcony.jpg` (full res;
`lounge-checkin-view.jpg` is the rotated reading copy). The old standalone
酒廊 at enclave-local (−44, −16) was **DEMOLISHED 2026-08-04** once the new one
was walked and verified — build first, demolish second, as Carl asked.

**2 · The second pool does NOT get the clubhouse across it — deliberately.**
`reference/photos/3br-pool-area-view.jpg` (from a 3-BR terrace) shows the real
venue's relationship: 3-BR rooms → hedge → second pool → the clubhouse lounge
on the far side, with the venue's own wayfinding sign listing 隐逸居 / 酒廊
LOUNGE / 大堂 LOBBY / 泳池 POOL as one precinct. **Our model cannot have that
without re-planning the whole enclave**, because the arrival and the entrance
pavilion sit at the opposite end from the second pool. Carl was given both
options and chose to keep the approved layout: *"lets do 1, i want to see how
it looks first before huge change"*. So:
- the second pool serves the 3-BR keys and the dinner lawns, and that is
  correct-by-decision, not an oversight;
- ⚠️ **do not "fix" this by moving the lounge, the arrival or the pool.** If a
  future session thinks the aerial disagrees, this is why. Re-opening it is a
  scoped re-plan Carl must ask for.

**3 · What that photo IS a spec for** — the second-pool AREA itself, which is
richer than modelled and is queued work: a shallow curved reflecting pool, a
timber deck, the rectangular swimming pool, an **open flat-roofed pavilion on
slender columns** standing between them, and clipped hedge blocks throughout.
The white curved tower on the horizon is the Regent — background, ignore it.

**New reference material imported 2026-08-04** from `~/Desktop/Wedding App/Club
House Walkthrough/` (masters gitignored, HEIC→JPG via `sips`; ⚠️ they import
sideways — these were rotated 90° on import, so anything else pulled from that
folder needs the same treatment): `clubhouse-lounge-checkin-balcony.jpg`,
`3br-pool-area.jpg`, `clubhouse-outside.jpg`, `clubhouse-main-pool.jpg`,
`atrium-water-feature.jpg`. **Still unmined in that folder** and worth a brief
when someone needs them: the presidential-suite interior and 2F-stair stills,
`club house atrium.jpeg`, `club house birdeye.jpeg`, the per-room villa tour
videos, and the hotel's own `隐逸居PPT介绍.pdf`.

## THE CORRECTIONS PASS — DONE 2026-08-03 (same day, after the bar deployed)

Carl walked the deployed build and sent five corrections plus four new phone
videos. All five are in; the videos are imported and distilled. Files touched:
`main.js` + `player.js` (fly-land), `moments.js` (parasols), `campus.js`
(sightline, furniture, sea-edge band, gate), `site.js` (north path),
`water.js` (turf strip).

1. **Fly → land dropped through the rooftop.** `setMode('walk')` and the fly
   altitude clamp called `floorY` with NO `fromY`, which by contract answers
   bare ground — landing over the terrace teleported feet to grade. Both now
   pass `pos.y − CFG.STEP_UP` ("anything at or below eye level is under you").
   ⚠ The exact argument matters, both wrong values were tried: FEET-based
   re-falls through a hovered surface (the clamp holds feet below it); EYE-based
   teleports you UP through a slab overhead (proved on the suite's 2F balcony).
2. **The infinity pool's sightline is clear from the water.** Three separate
   obstructions: the brunch apron parasols (deleted — see the rule in
   moments.js: nothing tall on the aprons seaward of the coping, ever), the
   CAP_ENDS attic/plant boxes (moved inland onto the cap's back band, r ≥ 98.9;
   the silhouette job survives at both tips), and — found by raycast, also in
   Carl's screenshot — the copper FIN POSTS still ran the full sweep after the
   glass rail was broken over the water: a picket standing IN the pool. The fin
   loop now skips (p0, p1) like the glass.
3. **The bar room's dining furniture is real furniture** — legged/pedestal
   tables, framed rattan-panel chair backs, cushions, plates, per-seat seeded
   jitter — same `barLayout` centres so colliders did not move. +1 draw call.
4. **Both river banks now carry a complete hotel↔clubhouse walk.**
   `SITE.RIVER.PATHS[1]` grew 13 → 24 points (152 → 259 m): beach pool's NE
   deck → north bank at 9–12 m offset → the verified villa-row pinch → ends in
   the crescent's crook. No crossing, so BRIDGES/LAMPS untouched. Every point
   + the smoothed resample clearance-checked against every basin/deck/channel
   (worst margin 0.89 m, on a pre-existing pair).
5. **The dinner-lawns + beachfront videos say the SPACING IS RIGHT** — the
   brief found zero coordinate deltas. Three dressing gaps were built instead:
   the continuous low sea-edge hedge band with agave/croton/casuarina accents
   at BEACH_LAWN (gaps kept at the aisle x −22 ± 9 and cocktail x +4 ± 8
   corridors — ⚠ the sea-fringe gaps are NOT the palm-belt's x −2 spine gap),
   the 1.5 m turf strip with drain covers between the hero pool's trough and
   the WEST lounger flank (`water.js buildDeckAndTurf` — the +X flank has no
   ground for it, the cabanas sit against the trough), and the white garden
   gate standing open in the terrace-edge gap (posts collide, the gap does not).

**New reference material (2026-08-03):** `reference/video/`
`clubhouse-entrance-parking.mp4` (+32 frames), `dinner-lawns-spacing.mp4`
(+23), `beachfront-lawn-{1,2}.mp4` (+30) — masters gitignored. Committed
briefs: **`reference/entrance-arrival-brief.md`** (the entrance is a DARK
corten-clad volume with a stone stair, canopy, frangipani/cordyline/ixora
beds — nothing like the built paver forecourt; 9 deltas) and
**`reference/dinner-lawns-spacing-brief.md`** (the no-coordinate-deltas
finding + the three dressing gaps above).

**Verified** (headless Playwright, Metal ANGLE, zero errors/warnings): the
full walk suite from the bar pass re-run green; fly-land suite (bar deck
26.600 / pool 25.320 / lawn 0 / stable hover / no 2F teleport); ceremony
aisle + arch with the new band, horizon clear; beach access through the aisle
gap onto the sand (feet follow the slope to −0.567); pool-deck walk over the
turf strip; gate pass-through; 34 lights in every moment, both sides.

### THE ENTRANCE — DONE 2026-08-03 (from entrance-arrival-brief.md)

Carl settled both flagged decisions ("go ahead and make the change"):
**dark corten as filmed** (a deliberate accent against the white clubhouse),
and **the arrival is DRY** — the clubhouse has its own arrival court on the
enclave's inland/south-east side with a lane off the SOUTH map edge (the site
map's real entry side); the river did not move; the north road/spur/parking
stay as resort context.

What stands there now (`buildArrival` in campus.js, every shared number in
`SITE.ARRIVAL`): the corten vertical-batten pavilion with the folded
mono-pitch roof and cantilevered slatted canopy (emissive downlights), banded
curtain-wall piers, fluted brass sconces, the flush 隐逸居 / THE SERENE
RETREAT plaque, a REAL 6-riser polished-stone stair (rise 0.95, registered as
`arrival-stair`/`-landing`/`-vestibule`/`-stair-in` WALK_REGIONS), a glazed
vestibule stepping back down to the plaza, kerbed frangipani/cordyline/ixora
beds, white bowl dracaenas, a jointed sett court with tan inlay + stall
stripes + 4 cars, and the lane with lamps and bollards.

⚠ Three things future passes must know:
- **The arrival ground IS enclave-captured.** `isEnclaveLocal()` answers true
  for world x −37…−16, z 110…141, so the whole arrival is authored
  enclave-LOCAL inside the adopted `sign` group. A world-space instance
  pushed through shared buckets there lands 90° around the map.
- **`Color.setHSL` fills in LINEAR space** (unlike `setHex`) — it rendered
  the corten maroons two stops light. Hex only for instance tints.
- ~46 phantom colliders (`y0:80, y1:80.01`) keep `placePalms` off the court —
  they repel placement but are invisible to the walker. The understory
  shrub scatter ignores colliders entirely; a one-shot ticker culls the two
  clumps that landed on the paving (world.js's scale-to-zero pattern).

**Verified**: the full walk BOTH directions with feet logged — car → court →
forecourt → stair up 0→.95 → doors → vestibule → interior stair down → plaza
→ through room D2's folding glass to within reach of its atrium gallery door;
min distance from the whole route to ANY water = 13.5 m (river ≥ 114.6 m);
all six moments regression-clean, 34 lights. Side-by-side vs the video:
`reference/photos/compare-entrance-2026-08-03.jpg`.

**The fix queue above was CLOSED 2026-08-03 (the same day, fifth pass):**
- **The suite's north portal WALKS now.** The real bug was richer than the
  queue said: `doubleDoor()`'s open branch drew the closed state's full
  frame+head slab, filling the doorway — an "open" door read shut (this also
  silently fixed the spa-corridor door). Entry doors stand open, marble sill,
  collider chain split with a 1.36 m passable band. A/B: the old build stalls
  at x −8.25; the fix walks suite → portal → gallery door no. 9 and back,
  feet 0.000 throughout.
- Bar counter stools rebuilt in the dining furniture's language.
- The lane ends at an estate gate on the boundary (corten piers + hedge
  returns, derived from `SITE.ARRIVAL.LANE`).
- The two stray shrubs are culled by `SHRUB_CULLS` in `buildUnderstory` — a
  post-filter that keeps the rnd() stream untouched (proof: exactly 7 of 847
  instances changed, all others byte-equal; note the queue's coordinates were
  ~6–14 m off — the real spots were local (−23.4, 82) and (−4.6, 53.8)).
- The coplanar paver overlap fixed on BOTH flanks (piece 5/6 east had the
  same bug as 4/6 west).
- **`assets/og.jpg` exists** — 1200×630, the prewedding night pool.
- fps measured across all six moments (Metal, M-series): ceremony 68.5,
  cocktail 62, dinner 59, afterparty 70–75, brunch 35–37, setup 31.5 (the
  Reflector's second pass — the signature shot, worth its cost). Verdict: no
  optimization warranted; these are the knobs if Carl's hardware ever lags.

Still open, tiny: `doubleDoor`'s CLOSED branch draws its leaves coplanar with
the sapeleDark backing slab (z-fight at close range, pre-existing).

## THE ROOFTOP BAR + THE COCKTAIL REDRESS — DONE 2026-08-03

The pass a dropped connection killed on 2026-08-02 is finished. All three of
Carl's asks are in: the stray white boxes (fixed in the WIP commit — attic band
+ plant boxes clamped to the bare end sectors, derived from `ROOFTOP.arcHalf`),
**the rooftop is two rooms**, and **cocktail hour keeps the ceremony decor**
with the real round bar. Two agents, strict file ownership: one owned
`js/campus.js`, one owned `js/moments.js`; site.js was already done and was not
touched.

### The roof is two rooms (`campus.js`)

The infinity pool keeps the SOUTH half `(poolTc ± poolTh)`, the **rooftop bar**
takes the NORTH half `(barTc ± barTh)`, a 9 m paved cross-walk between them —
all read from the site.js contract, nothing typed. What the bar room is, from
`rooftop-bar-night/dusk.png`: dark timber decking, the elevated volume on
flared tree-columns clad in perforated panels whose water-caustic blue is an
**emissive CanvasTexture** (`texBarCaustic`, seeded, wired through the same
night registry as `MAT.rtScreen` — **zero new lights, the campus holds at 34**),
a deck-level counter with stools and lit back-bar, two arcs of dark-timber
dining tables with rattan chairs and candle emissives, planted beds with warm
strips, the cantilevered planted canopy on one flared pedestal at the bridge
bearing, and the **live-band stage** past the north head-house. The old central
bar pavilion straddled the cross-walk and is deleted; its point light moved to
the counter. Screen wall, daybeds, loungers and lanterns are clamped to the
pool half; `loungerRow`'s inner limit is DERIVED from the outermost
`HOTEL_ROOF.brunchTables` entry, and the four-tops iterate that list directly —
build loops and collider loops read the same lists (`daybedRow`, `barLayout`),
never duplicated literals.

⚠ **The room seam is guarded by the SWIM radials** at `poolTc ± poolTh ± .006`.
In the half-finished state a swimmer crossing the seam fell 26 m through the
roof (the basin hole ended where the old visuals kept going); with the visuals
and colliders re-keyed together the swim is blocked 7 cm short of the seam,
verified by an 8 s scripted swim that never left feet 25.32.

### Brunch dressing moved with its room (`moments.js`)

Everything re-keyed into the pool half, all still `__world`: the four-top
dressing iterates `HOTEL_ROOF.brunchTables`; the buffet sits off the list's own
outer end; the champagne service is at the cross-walk seam and the **"Pour a
glass" interactable derives from its stored point** (one source of truth); the
coping bloom run follows the pool's real span; both parasol pairs are on the
south apron; the menu easel moved from the tower bearing (now the bar's dining
deck) to the pool room's threshold.

### Cocktail keeps the ceremony decor (`moments.js`)

Ceremony authoring is now module-scope `dressCeremonyDecor(K, g, CC, seated)`.
The ceremony emits with `seated = true`; a new block emits the SAME decor into
the cocktail group with `seated = false` — installations, fabric flower, arch
frames + chandeliers, welcome board, aisle petals, ground clusters and all six
flank extras stand through cocktail hour; only the 60 chairs are cleared.
Colliders are duplicated into `cols.cocktail`. **Ceremony is byte-identical
after the refactor** — 50 draw calls / 369,606 tris / 8,454 colliders, the
decor pass's exact numbers. Cocktail pays +292,616 tris (713,312 in frame)
and its draw calls FELL 209 → 196 (the old straight bar was unbatched).

The straight white bar is replaced by the **round timber-plank bar** from
`decor-cocktail-bar.jpg`: 30 vertical pine boards on a 1.05 m ring, overhanging
plank top, bottles/shaker/strainers, a leaning menu easel with a
`texCocktailMenu` CanvasTexture, lavender/lilac + white florals at the base,
and rows of the four menu drinks in their real colours and glassware (orange
Aperol spritz + grapefruit/rosemary in stems; pink coconut-foam talls; yellow
faceted highballs + mint; amber lychee-negroni rocks tumblers — opaque tinted
liquid inside transparent glass so the colour reads). The toast now orders the
荔枝尼格罗尼 (the old "Yuzu 75" was not on the menu). ⚠ Tinted glass/bottle props
must ride a WHITE-based bucket — the `dark` bucket's base crushes instance
tints to black.

### Verified — headless Playwright, Metal ANGLE, zero page errors, zero console errors or warnings

- All six moments switch, dress, night-flip (F/T/F/F/T/T) and spawn flat with
  zero drift; **34 lights in every moment**; colliders 8,093–8,130 by moment.
- floorY at derived polar points: pool basin **25.320**; pool teak, cross-walk,
  bar-mid, bar back band, north apron all **26.600**.
- Walks with real key input: brunch spawn (feet 26.600) → "Pour a glass" fires;
  deck → pool **25.320** → seam swim BLOCKED (min feet 25.320) → out via the
  south submerged steps → **26.600**; cross-walk → bar room, feet 26.600 the
  whole way, stopped only by dining furniture (its colliders working).
  Ceremony spawn → aisle → "Stand at the arch". Cocktail spawn → round bar
  (0.86 m) → "Order from the bar"; the arch prompt correctly does NOT fire
  during cocktail; the cleared seating block walks freely; the −X installation
  holds the walker at exactly 1.40 m. Dinner dance floor + after-party prompts
  fire.
- Cost vs the last deployed build: brunch-in-frame 1,629 calls / 347,934 tris;
  the whole-scene rooftop delta is +5 draw calls / +6.1k tris for the entire
  bar room (instanced), colliders 8,443 → 8,093 (−350).
- Side-by-sides in `reference/photos/`:
  `compare-rooftop-bar-2026-08-03.jpg`, `compare-cocktail-round-bar-2026-08-03.jpg`,
  plus `build-cocktail-keeps-ceremony-decor-2026-08-03.png` and the brunch
  pool-half shots.

**Testing note for every future rooftop/walk pass:** default Playwright
headless uses SwiftShader at ~0.5–3 fps and key-input walks silently do
nothing useful; launch Chromium with `--use-angle=metal` (120 fps, and the GL
driver console warnings disappear).

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

**The whose-word-wins order** (settled the hardest disagreements):
Carl > his photos > the planner's renders > the hotel's marketing deck >
inference. He has been to the venue — when his account and a photo disagree,
HE WINS (that settled the pool's orientation). The planner's renders are the
real 2027-03-20 design and outrank venue photos for DECOR — **but not for
names**: they romanise the surnames as *Feng/Zheng*; the couple are **Fung**
and **Cheng**. `reference/suite-interior-brief.md` is bottom of the pile —
distilled from a handheld video, and mirrored.

**Two failure shapes that cost the most, both silent:**
- **Typed proportional constants.** The rooftop pool's span, the facade tile
  count and the collider ring count were each a fraction of `HOTEL.arc`, each
  hand-typed. Growing the arc broke all three and nothing errored — the
  building simply grew around the pool. They are DERIVED now; keep them that
  way, and grep for magic numbers near any dimension you are about to change.
- **Eyeballing position.** The water looked "close but wrong" through several
  passes. Calibrating the aerial (0.22 m/px, anchored on two features) showed
  the whole band was **rotated the wrong way** — reality climbs 24 m north
  west-to-east, ours fell 57 m south. Measure against a calibrated reference;
  state the offsets.

**Working method that held up:** one agent per job with **strict file ownership**
(two agents in one file corrupted a build; a third left the page unable to
parse). Hand it the reference photo, the constraints, and demand evidence —
walk tests, before/after numbers, side-by-side screenshots. Agents were killed
mid-edit repeatedly, so **syntax-check every file and boot headless before you
commit**, and never trust a "done" report without its evidence attached.

**Deploy:** `vercel --prod --yes` from the repo. It sometimes aliases to the
project URL rather than the domain — **always curl `venue.carlfung.dev` and
confirm it serves the new build.**

## THE DECOR PASS — CEREMONY + WEDDING DINNER — DONE 2026-08-02

**`js/moments.js` only.** Nothing else was touched: no site plan, no builder, no
coordinate, no spawn. Ceremony and Wedding Dinner are now dressed from the
couple's actual wedding designer — **Rosa Wed 蔷薇婚礼** — instead of from
inference.

**The seven renders are the spec and they outrank anything previously inferred**
(`reference/photos/`, gitignored with the rest of the media):
`decor-ceremony-main.jpg` (the key image), `decor-dessert-bar.jpg`,
`decor-plinths-and-hats.jpg`, `decor-favor-wheelbarrow.jpg`,
`decor-beverage-coconut.jpg`, `decor-dinner-rounds.jpg`,
`decor-dinner-chandeliers.jpg`.

The deliverables are the side-by-sides, reference stacked over the build at an
identical width: **`compare-ceremony-decor-2026-08-02.jpg`**,
`compare-extras-bar-2026-08-02.jpg`,
`compare-extras-plinths-hats-2026-08-02.jpg`,
`compare-extras-wheelbarrow-2026-08-02.jpg`,
`compare-extras-coconut-2026-08-02.jpg`,
`compare-dinner-rounds-2026-08-02.jpg`,
`compare-dinner-chandeliers-2026-08-02.jpg`.

### The palette, which was not in the build at all

Dusty/powder **BLUE**, cream, ivory and white over **pale green** foliage —
hydrangea, garden roses, delphinium — soft and pale against the sea. The build's
ceremony was plain white folding chairs under a green-and-blush arch with a
3 × 12 m linen runner; there is no blue, no timber and no runner anywhere in the
design. Getting the colour right was the single biggest change and it is now one
table, `PAL`, at the top of moments.js:

| | | |
|---|---|---|
| `HYDRANGEA` | `0x92b8de` | the powder-blue heads — the signature |
| `DELPH` | `0x7099c9` | delphinium, the deeper blue in the ground clusters |
| `MIST` | `0xbcd3ea` | palest blue — the fabric flower, the far blooms |
| `CREAM` | `0xecd7ae` | the champagne garden rose |
| `IVORY` / `WHITE` | `0xf6ecd8` / `0xfdfbf6` | |
| `LEAF` / `LEAF_D` | `0x94ae87` / `0x74906b` | pale sage, **not** the old `0x3f6b3a` |
| `OAK` / `OAK_D` | `0xc3a37c` / `0xa88a66` | the cross-back chairs |
| `PEARL` / `STONE` | `0xf5efe2` / `0xdfe4e8` | pearl strands; the welcome board |

⚠ **Both the hues AND the mix weights were retuned once, on evidence.** The first
pass read WHITE from twelve metres: cream, ivory and white sit within a few
points of each other under the golden-hour sun and pale sage went silver. `PAL`
was deepened and `bloomHue()`'s blue band widened from 37 % to 45 %. If it ever
looks washed out again, that is the knob.

### What is built, per render

- **`decor-ceremony-main.jpg`** — 60 **wooden cross-back chairs** (eleven timber
  members each) in five rows of six a side, every one tied with a white chiffon
  drape: a fan flaring above the backrest and a skirt falling behind the seat.
  The aisle is **GRASS STREWN WITH PETALS** — the linen runner is deleted — lined
  both sides with low blue-and-cream clusters that thicken toward the head. Two
  **asymmetric floral installations** flank the head at ±3.1 m, 3.3 m and 2.95 m
  tall, built on a teardrop profile with a wing of bloom spilling sideways over
  the aisle. A **pale-blue fabric flower** hangs between them at 2.35 m with two
  chiffon streamers. Two **slim white arch frames** stand outboard of the aisle
  at z 69, each hanging a five-tier **crystal/pearl bead chandelier**. A tall
  pale **arched welcome board** (CanvasTexture on an ExtrudeGeometry cap) stands
  beside the front of the block.
- **`decor-dessert-bar.jpg`** — a 6 m white counter with **"Fung & Cheng"** in
  script on its front, a white **double-tiered parasol** hung with sixteen pearl
  strands and small blooms, two drink dispensers, two cupcake stands, dessert
  plates, flutes, two fluted plinths and florals grounding both ends.
- **`decor-favor-wheelbarrow.jpg`** — the galvanised barrow of fifteen gold
  favour boxes, beside the bar.
- **`decor-plinths-and-hats.jpg`** — three white rectangular plinths with floral
  tops and **nine catenaries of pearls** swagged between the two tall ones; and
  the **hat rack**: fifteen straw hats on three real lines between two timber
  posts, with a basket of spares.
- **`decor-beverage-coconut.jpg`** — the white arched shelving rack of coconuts
  and the small white **canopy cart** of fruit with a "Beverage" cloth.
- **`decor-dinner-rounds.jpg` + `decor-dinner-chandeliers.jpg`** — the same
  cross-back chair, which is what makes the day read as one wedding; **six rounds
  of eight plus two bare-timber longs of eight (still 64 covers)**, the longs on
  the paved-walk side of each lawn; **four crystal candelabra on tall curved
  poles**; and festoon that is actually **strung** — a real catenary cable with
  the bulbs hung off it, criss-crossing both lawns and the walk.

### The cost, and why it went the way it did

Everything repeated is instanced. A `bucket` collects placements while a moment
is authored and bakes ONE `InstancedMesh` into that moment's group at the end;
a `tinted` bucket carries per-instance colour, which is what lets every
hydrangea, rose, leaf, coconut and lemon on the campus share one sphere and one
material. The cross-back chair is eleven scalings of a single unit box, so all
sixty ceremony chairs are ONE draw call.

| measured at the moment's own spawn | before | after |
|---|---|---|
| **CEREMONY** draw calls in frame | 710 | **51** (−659, −93 %) |
| CEREMONY triangles in frame | 231,838 | 369,606 (+137,768) |
| CEREMONY whole-scene drawables | 2,327 | **1,599** (−728) |
| CEREMONY whole-scene triangles | 372,039 | 511,315 (+139,276) |
| **DINNER** draw calls in frame | 532 | **199** (−333, −63 %) |
| DINNER triangles in frame | 287,076 | 313,896 (+26,820) |
| DINNER whole-scene drawables | 2,344 | **1,692** (−652) |
| DINNER whole-scene triangles | 383,859 | 401,175 (+17,316) |
| scene meshes / geometries | 3,653 / 3,339 | **2,248 / 1,941** |
| InstancedMeshes (instances) | 91 (5,992) | 116 (13,334) |
| textures | 166 | 169 (+3 CanvasTextures) |
| **lights** | 34 | **34 — unchanged** |
| colliders (ceremony / dinner) | 8,425 / 8,452 | 8,454 / 8,464 |

**Triangles went UP and draw calls collapsed, and that is the trade on purpose.**
There are ~1,900 blooms and ~480 pearls/crystals in the ceremony where there were
~280 crude spheres — that is what a florist's installation costs — but they are
one draw call each instead of 720 meshes. The bloom sphere was cut to
`SphereGeometry(1, 6, 4)` (36 tris) to pay for the count. **The other four
moments are byte-for-byte unchanged.**

### Three traps this pass hit, all silent

1. **A prop's instanced parts must go through the prop's own frame.** Each extra
   is authored at the origin facing −Z and dropped through `frame(x, z, yaw)`.
   The unique meshes take it via `applyMatrix4(F)`; the INSTANCES take it as
   `put()`'s last argument, and the first version simply forgot to pass it — so
   the entire dessert bar, hat rack, plinths, coconut rack and cart were built at
   the enclave origin while their one or two plain Meshes stood correctly out on
   the lawn. Nothing threw. Every extras function now opens with a curried
   `iput`/`iflor` pair bound to `F`; use them, not bare `put`/`bloomMass`.
2. **`rotateZ` on a geometry, not a Euler, is what mirrors the chandelier poles.**
   The elbow is a quarter torus pre-rotated at build time so a plain `rot.y` of 0
   or π flips the overhang. Composing a Z-rotation with a Y-rotation through one
   XYZ Euler does not — it bends the pole sideways. Same family of bug as the
   arch that was once built edge-on.
3. **The welcome board's position is a FRAMING constraint, not a taste one.**
   Against a 44.6° half-FOV, anything within a couple of metres of the CEREMONY
   spawn and off to the side is never in shot. Two placements at the aisle mouth
   were invisible from the spawn before it was moved to z 66.8, past the last
   row, 5.45 m off the centre-line — which is also where the render has it.

### Verified — headless Playwright, 1600 × 900, zero page errors, zero console errors *or warnings*

- `node --experimental-default-type=module --check` clean on `js/moments.js`
  (the only file changed), and ESLint clean for `no-undef` / `no-unused-vars`.
- **All six moments** switch, dress, night-flip and spawn flat with **zero
  first-frame drift**: brunch feet 26.600, the other five 0.000; night flags
  false/true/false/false/true/true as `CFG.MOMENTS` specifies.
- **Ceremony walk**, from the real spawn (−22, 59) with real key input: six 0.9 s
  bursts up the aisle, **2.87–2.92 m each, no stall**, feet 0.000 throughout,
  past the head at z 71.4 and out to z 76.4; "Stand at the arch" fires from
  z 67.7 to z 73.6; strafing both ways across the head is clear.
- **Ceremony → extras walk**, spawn out along the −X flank to x −36.4: five
  bursts, 2.84–2.91 m each, no stall; the hat-rack post deflects the walker 0.1 m
  and does not block.
- **Dinner walk**: spawn (−17, −3) 14.5 m up the inner lawn between the rounds,
  then 17 m across the paved walk to the outer lawn — eleven bursts,
  2.86–2.93 m each, feet 0.000 throughout. Turning up the walk fires "Step onto
  the dance floor" over z −0.3…4.9.
- **The other four moments' interactables still fire**: cocktail "Order from the
  bar" at z 64.3, after-party "Request a song" in reach at the spawn, brunch
  spawn feet 26.600 → 25.320 walking into the rooftop pool.

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
groups listed in its `CAMPUS_ENCLAVE_GROUPS` **literal** (`pergola`, `sign`, `extstair`),
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
- ~~`SITE.LOUNGE_POOL` is still drawn as a rectangle~~ — **ALREADY BUILT
  (header says 2026-08-02) and this backlog entry sat stale until a 2026-08-04
  pass went to build it and found `buildLoungePool()` free-form all along**
  (`polyArea`/`flatShape`/`offsetPoly` + the rewritten builder in water.js).
  Verified 2026-08-04 headless: ONE Reflector before and after, the v = −0.5
  edge dead straight at world x −34.50 facing the lounge glass, plinth
  .30/waterY .26/depth 1.25 kept, apron stops at local x −41.5 (2.5 m dinner
  clearance), containment walks on 8 bearings all held out of the water by the
  lip chain at exactly lip + 0.55 + PLAYER_R. Lesson repeated twice today:
  **verify a backlog entry against the source before acting on it** — this one
  invited redundant work, the world.js one invited deleting load-bearing code.
- ~~The arrival drive spur is orphaned~~ — FIXED 2026-08-02. It ends at a
  forecourt beside the parking apron. It cannot reach the clubhouse any more
  without a vehicular bridge over the new river, and guests walking in from an
  inland arrival court is what the site map actually shows.
- ~~`world.js`'s `enclaveKeepOut()` + `cullUnderstoryInsideEnclave()` are
  stale~~ — **WRONG, measured 2026-08-04: they are LOAD-BEARING.** The
  understory scatter still ignores keep-outs (proven twice on 2026-08-03),
  and the pair currently zero-scales **61 instances** that would otherwise
  stand inside the suite, pool, atrium, plaza and villa footprints (41/348
  in one understory mesh + 20/847 shrubs; the shrub mesh's other 7 are
  nature.js's own `SHRUB_CULLS`). Do NOT remove them. If the scatter ever
  learns to respect keep-outs at placement time, retire all three culls
  together, with this measurement repeated as the proof.
- ~~The suite's L-stair and the atrium's gallery stair each have a ~0.3 m
  entry~~ — **FIXED 2026-08-04**, and the diagnosis was confirmed to the
  millimetre (the head-on stall reproduced at lx −3.789). What pinched:
  the suite's black spine-wall chain stood across the flight's mouth (now a
  y0 2.30 header over the mouth, full-height beside the void), the sofa ring
  and north-return chains sealed the corridor to a 5 mm slot (both slimmed,
  still stricter than geometry); the atrium's old "underside guard" laid r .95
  circles up the flight's own centreline (replaced by guards where the solids
  actually are — balustrade line, stringer line with per-circle y1 tracking
  the ramp, under-flight cross chain, explicit y0 3.45 well-rail guards) and
  pond A's kerb ring blocked the boardable end (slimmed on two sides only).
  46/46 checks: both stairs board from every natural approach and climb
  0.178→1.382→3.800 / 0→3.600; every trimmed chain's solid still blocks when
  pushed into. +313 colliders. `doubleDoor` closed leaves now 20 mm proud of
  the backing slab (the pantry mirror is clear).
  Four NEW pre-existing findings from that pass, none fixed: the folded-leaf
  stack's colRect bleeds into the 2F hall's SW corner (stall at lx −5.54);
  1F furniture colliders carry no y1 and shadow-block the 2F lounge floor
  above them; the rakeRails glass has no colliders (sideways boarding ghosts
  through it — left so the sideways approach keeps working); 2F court-edge
  balustrades outside the stairwell have no colliders.
- ~~`SITE.LOUNGE_POOL.OUTLINE` is still drawn as a rectangle~~ — stale
  duplicate of the entry above; the free-form build shipped 2026-08-02 and was
  verified 2026-08-04.

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

- ⚠️ **THE COUPLE ARE FUNG AND CHENG. The planner's renders letter them "Feng"
  and "Zheng".** Rosa Wed romanised the surnames with a different system than
  Carl and Rachel actually use, so `decor-dessert-bar.jpg` says "Feng&Zheng" and
  `decor-ceremony-main.jpg` says "Feng jiaheng & Zheng". Both are wrong for this
  wedding. **Never transcribe a name straight off a reference render** — check it
  against the project's own copy (`~/projects/wedding-app`, the title card,
  `CFG.SEED`). Everything moments.js letters uses that copy: the dessert bar
  reads **"Fung & Cheng"** and the welcome board reads **"Carl & Rachel"**. The
  DATE on the render, 2027.03.20, is correct and is `CFG.SEED`.

- **KAN-211: architecture GLBs are authored IN SITE COORDINATES** (origin =
  the anchor `(ARRIVAL.backX, 0, ARRIVAL.axisZ)`, one identity instance), and
  their generators READ `js/site.js` through node (`generators/_arch.py`). If a
  SITE.ARRIVAL number changes, re-run `make_masters.py` + `export_all.py` for
  Group K or the building and its colliders part company. Build long faces in
  ≤ 5 m pieces (the longest island caps the atlas density) and never bake a
  hidden core at full weight (`UV_WEIGHT` it to ~0.03).

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
