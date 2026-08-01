# CLAUDE.md — wedding-venue-3d (The Big Day)

First-person 3D walkthrough of Carl & Rachel's wedding venue (a hotel), told
as five "moments" of the wedding day. Three.js r180 via CDN importmap — pure
static HTML/CSS/JS, **no build step**, no dependencies.

Run it: `python3 serve.py` → http://localhost:8799 (`file://` won't load ES modules)

**The venue is a placeholder — and it's the WRONG venue.** Everything in
`world.js` is boxes and cylinders sized from `CFG`; it exists so the moment
system, both movement modes, controls and UI are real. Carl's reference
photos (2026-08-01) show the real venue is an outdoor beachfront resort
campus, not an indoor ballroom — see **Venue brief** below. `world.js` gets
replaced wholesale in Phase 2.

## Architecture

| File | Owns |
|------|------|
| `js/config.js` | ALL tuning — walk + fly feel (`FLY_SPEED`/`FLY_FAST`/`FLY_MAX_ALT`), venue dimensions, lighting levels, the `MOMENTS` table (id/name/area/spawn/blurb). No magic numbers elsewhere. |
| `js/main.js` | Renderer bootstrap (PMREM RoomEnvironment, sRGB, ACES — modeled on alice-lunch-party, no post yet), the `G` context object, `G.setMode`/`G.toggleMode` (walk ↔ fly), begin-button flow, resize, clock loop, `window.__game` debug hook |
| `js/materials.js` | Every CanvasTexture recipe (carpet, marble, wall panels, parquet, linen, night sky) + the shared material set `M.*`; also exports `mulberry32` (seeded PRNG) |
| `js/world.js` | The placeholder hotel shell: ballroom, foyer, terrace, corridor + bridal suite, stage, columns, string lights, all lighting. `floorY(x,z)` + `colliderLine`/`wall` collider authoring. |
| `js/moments.js` | The five moment prop groups + per-moment colliders, the one-interactable-per-moment registry, `G.setMoment` (dress + collider swap + teleport), mirror-ball/DJ FX |
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

## Gotchas

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
