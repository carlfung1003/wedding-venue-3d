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
| `js/site.js` | **The master site plan.** `SITE.*` footprints for the suite, deck, pool, cabanas, atrium, lounge, villas (with the real 11-key room mix), lawn, lagoon, palm grove, beach, ocean, hotel crescent. Plus `siteFloorY(x,z)`, `MOMENT_PLACES` (spawns) and `INTRO_PATH` (the opening dive). |
| `js/config.js` | ALL tuning — walk + fly feel, camera, the intro orbit/dive, day-vs-night lighting levels, the `MOMENTS` table. No magic numbers elsewhere, and **no coordinates** (those are site.js). |
| `js/main.js` | Renderer bootstrap (PMREM RoomEnvironment, sRGB, ACES), the `G` context object, `G.setMode`/`G.toggleMode` (walk ↔ fly), the begin→dive flow, N-key night toggle, resize, clock loop, `window.__game` debug hook |
| `js/world.js` | **The integrator.** Builds nothing itself: calls each builder in order, owns `floorY(x,z)` (delegates to `siteFloorY`), owns the day↔night fan-out (`setNight`/`toggleNight`), and runs `G.tickers` each frame. |
| `js/sky.js` | Sky dome (day + night gradients), sun/moon, stars, fog, and the whole global lighting rig |
| `js/nature.js` | Ground, beach, animated ocean, the palm population, hedges, topiary, bougainvillea |
| `js/water.js` | The hero pool (raised plinth, infinity edge, caustics), **the floating lanterns**, the deck + turf + "THE WESTIN" letters, cabana pavilions, loungers, lounge pool, lagoon, villa plunge pools |
| `js/campus.js` | The 隐逸居 lounge, the ten guest villas (3 real types), circular lawn edging, event plaza, pergola, signage pillar, arrival road, and the main Westin crescent backdrop |
| `js/atrium.js` | The clubhouse's central courtyard — timber-soffit galleries on black stone columns, black mirror ponds in gravel, cloud topiary, the copper-handrail stair, villa entry doors |
| `js/suite.js` | The presidential suite, inside and out — folding glass wall, great room, dining, pantry, the L-stair with its chandelier, the spa, the 2F lounge and balcony |
| `js/introcam.js` | The opening: a drone orbit of the enclave behind the title card, then a bezier dive over the pool and in through the glass wall, handing the look state to `player.js` on landing |
| `js/materials.js` | Shared CanvasTexture recipes + `M.*`; also exports `mulberry32` (seeded PRNG). Builders define their own local materials — only `mulberry32` is universally imported. |
| `js/moments.js` | The five moment prop groups + per-moment colliders, the one-interactable-per-moment registry, `G.setMoment` (dress + collider swap + night flip + teleport) |
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

Keys 1–5 or the chip bar switch moments: instant dress + collider swap +
teleport to the moment's spawn.

| # | Moment | Space | Dressing |
|---|--------|-------|----------|
| 1 | Prewedding Setup | Bridal Suite | vanity, garment rack + The Dress, sofa, mirrors |
| 2 | Ceremony | Grand Ballroom | 60 white chairs, aisle runner, golden arch at the stage |
| 3 | Cocktail Hour | Foyer | bar + six high-top tables |
| 4 | Wedding Dinner | Grand Ballroom | eight rounds of ten, head table on the stage, dance floor |
| 5 | After Party | Terrace | DJ booth, speakers, mirror ball, lounges, string lights |

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

## Work queue (Carl's order, 2026-08-01)

1. Pool + room-type placement — spec below. **IN PROGRESS.**
2. **Walkable stairs** — see the section below.
3. **The river** — see the section below.
4. Cabanas as solid stepped blocks (Rachel's `IMG_8099.jpg`): they are white
   stepped volumes with punched rectangular window slots and a `THE WESTIN`
   mark, NOT the open post-and-beam portal frames `water.js` builds today.
5. **Rooftop infinity pool on the main Westin tower** — see below.

## QUEUED — the hotel's rooftop infinity pool (Carl, 2026-08-01)

Reference: `reference/photos/hotel-rooftop-pool.png` (top-down of the crescent
hotel and its grounds). Add the **top-floor infinity pool** to `SITE.HOTEL`,
the big curved tower — it currently has terraced balconies and a green roof
cap but no rooftop pool.

**Why it matters:** Carl and Rachel are hosting **brunch with the wedding
party two days before the wedding** — i.e. **2027-03-18** — up there. So this
is a real event venue in the story, not set dressing, and it is the one part
of the main hotel guests will actually stand in.

The crescent is currently modelled cheaply and deliberately (it is the fly-mode
skyline, ~285 m east). A rooftop pool people care about probably wants more
than the backdrop treatment: a deck, loungers, an infinity edge facing the sea
to the west, and enough parapet/plant detail to read at close range.

**Likely follow-on, ask Carl before building it:** this is a natural **sixth
moment** ("Welcome Brunch", 2027-03-18) alongside the existing five in
`CFG.MOMENTS`. It would need a spawn on the roof, its own dressing (brunch
tables, a buffet), and the moment chips/UI already scale to six. Carl asked
only for the pool — do not add a moment unprompted.

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
   隐逸居 is only 3,500 ㎡. Carl's ten guest villas are two tight rows just
   south of the pool — not a subdivision spread over the map. The compactness
   is the point.
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
- **`G.setMoment` early-returns on the current index**, so the begin-button
  flow must reset `G.momentIndex = -1` before jumping to moment 0 — the
  title screen already has moment 1 dressed as its backdrop. Forgetting this
  leaves the overlay's dressing on screen with no teleport.
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
