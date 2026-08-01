# CLAUDE.md — wedding-venue-3d (The Big Day)

First-person 3D walkthrough of Carl & Rachel's wedding venue (a hotel), told
as five "moments" of the wedding day. Three.js r180 via CDN importmap — pure
static HTML/CSS/JS, **no build step**, no dependencies.

Run it: `python3 serve.py` → http://localhost:8799 (`file://` won't load ES modules)

**The venue is a placeholder.** Everything in `world.js` is boxes and
cylinders sized from `CFG` — it exists so the moment system, controls and UI
are real. It gets rebuilt from the actual hotel walkthrough video when Carl
records it (see Reference assets).

## Architecture

| File | Owns |
|------|------|
| `js/config.js` | ALL tuning — player feel, venue dimensions, lighting levels, the `MOMENTS` table (id/name/area/spawn/blurb). No magic numbers elsewhere. |
| `js/main.js` | Renderer bootstrap (PMREM RoomEnvironment, sRGB, ACES — modeled on alice-lunch-party, no post yet), the `G` context object, begin-button flow, resize, clock loop, `window.__game` debug hook |
| `js/materials.js` | Every CanvasTexture recipe (carpet, marble, wall panels, parquet, linen, night sky) + the shared material set `M.*`; also exports `mulberry32` (seeded PRNG) |
| `js/world.js` | The placeholder hotel shell: ballroom, foyer, terrace, corridor + bridal suite, stage, columns, string lights, all lighting. `floorY(x,z)` + `colliderLine`/`wall` collider authoring. |
| `js/moments.js` | The five moment prop groups + per-moment colliders, the one-interactable-per-moment registry, `G.setMoment` (dress + collider swap + teleport), mirror-ball/DJ FX |
| `js/player.js` | Ported from lassen-camp: pointer-lock FPS look (module-level yaw/pitch), WASD + touch-stick movement, walk/run, `{x,z,r}` cylinder collision, `floorY` eye-height clamp, nearest-interactable prompt, Tab cursor mode |
| `js/touch.js` | Ported from lassen-camp: floating joystick → `touchInput`, drag-to-look, quick-tap interact, `.tbtn` buttons. Pointer lock bypassed entirely in touch mode. |
| `js/ui.js` | Overlay show/hide, moment chips + active state, toast queue, prompt — plain id-addressed divs toggled with `.hidden` |

## Reference assets

`reference/` is **gitignored — personal media never gets committed**:

- `reference/photos/` — couple photos Carl will drop in (for framed prints,
  a welcome-sign portrait, etc.)
- `reference/video/` — the hotel walkthrough video. **When it arrives, the
  venue geometry in `world.js` (and `CFG`'s venue dimensions) should be
  rebuilt from it** — room proportions, finishes, where the doors actually
  are. The moment system, controls and UI stay.

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

## Deploy

```bash
vercel --prod
```

Domain `venue.carlfung.dev` is attached in the Vercel dashboard. No
`vercel.json` — it's a static site, the defaults are correct.
