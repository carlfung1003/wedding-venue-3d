# Dinner lawns + beachfront lawn — spacing brief (2026-08-03)

Distilled from three new phone clips. **Masters are gitignored** —
`reference/video/dinner-lawns-spacing.mp4`, `reference/video/beachfront-lawn-1.mp4`,
`reference/video/beachfront-lawn-2.mp4` — only this brief and the extracted
frame folders (`reference/video/dinner-lawns-spacing-frames/`,
`beachfront-lawn-1-frames/`, `beachfront-lawn-2-frames/`) exist for future
sessions to check. All 23 + 11 + 19 = 53 frames were read in full, in time
order; nothing below is inferred past what a frame actually shows.

**Scale anchors used throughout:** a standard sunbed/lounger ≈ 2.0 × 0.7 m; the
pool terrace's basalt pavers read as ≈ 0.6–0.8 m modules; coconut palm trunks
≈ 0.35–0.45 m diameter at chest height. No person stands still in-frame for a
height reference, so lawn depths below are walking-pace estimates, flagged as
such.

---

## 1 · The dinner lawns, in camera order (`dinner-lawns-spacing-frames/`, 23 frames)

**What the clip actually is:** a single continuous walk, starting on one big
mown lawn panel, crossing a paved cross-path, continuing toward (and then
standing inside) the paved terrace immediately beside the presidential suite,
where a compact pool with white cabana-style structures, sunbeds and umbrella
canopies sits right against the building. The camera operator points at both
the lawn (f_012–014, f_017–018, f_020–021) and the building (f_017–018),
reading as a deliberate "this is the dinner lawn / this is the pool" tour —
consistent with Carl's framing that this clip is about the spacing between
lawn, pool and clubhouse.

### The lawn panel (f_001–003, f_007–011, f_022–023)

- Flat, uniformly mown, open — no furniture, no ornament on the lawn itself.
  Faint alternating light/dark mow-stripe banding is visible in several frames
  (e.g. f_002, f_009), running across the panel's short axis.
- Scattered flush circular utility covers (irrigation valves or drainage,
  ≈ 0.3–0.4 m diameter, dark rims) dot the lawn in a loose grid, roughly
  4–5 visible per frame, spaced on the order of 5–6 m apart both ways.
- The lawn's edge nearest the paved cross-path is a **clean, direct cut** —
  grass meets flagstone with no curb, no coping, no hedge. This matches the
  existing "no ornament on the lawn body" read already in `CLAUDE.md` for
  `GRAND_LAWN`/`BEACH_LAWN`; the new footage extends the same read to the
  dinner lawn.
- Proportions are plausible against the built 12 × 20 m per panel — the
  drain-cover grid density and the time spent walking across it don't
  contradict that footprint — but there is no scale object standing ON the
  lawn, so this is a "not contradicted," not a precise re-measurement.

### The paved cross-path (f_001–003, f_013–014, f_017–018)

- A wide flagstone path (visually ≈ 4–6 paver-widths, so roughly 4–5 m) runs
  the length of the lawn, seen at an angle (reads diagonal in frame — likely
  just oblique camera angle on a path that actually runs straight).
- Black cylindrical bollard-style path lights line it, spaced roughly every
  3–4 m (f_001, f_002, f_017) — slim dark stems with a slightly domed/flared
  cap, clearly visible even in daylight.
- This width and the bollard spacing are a good match for `SITE.DINNER_WALK`
  (4 m wide, lamps every ~3.1 m per `campus.js`'s `buildGrassGround`) — this
  clip is very likely walking DINNER_WALK itself or its apron toward the pool
  terrace, not a separate unmodeled path.

### The ornamental threshold (f_001–003, f_013–014, f_017–018)

- Raised planters holding **clipped ball-shaped topiary** (dark green,
  roughly 1–1.3 m diameter spheres) sit at the path's edge, paired with a
  **low, dark-stone-capped hedge wall** (≈ 1 m tall) and a small light-coloured
  ornamental gate/fence set into a gap in that wall.
- Beyond the gate: more grass, then dense mixed palm/broadleaf canopy in the
  deep background.
- This reads as a strong match for `campus.js`'s existing **planted terrace
  edge** between the pool terrace and `GRAND_LAWN` (hedge blocks + rounded
  topiary + deliberate gaps, at `GL.z0 + 0.9`, `buildGrassGround` lines
  ~1585–1603) — the model's vocabulary (clipped hedge blocks, rounded topiary,
  real gaps rather than a sealed wall) is confirmed correct by this footage.
  **What isn't currently built is the gate itself** — the code leaves an open
  gap (correctly, for walkability) but no actual gate/fence prop stands in it.

### The pool + cabana cluster beside the suite (f_005–011, f_015, f_017–023)

- The presidential suite's two-storey building (dark cladding, glazed 2F
  balcony, ground-floor glass wall, black stone portico columns) stands
  directly beside a paved terrace; the pool begins just a few metres past the
  building face — confirms the existing "ground floor opens directly onto the
  pool" read, no correction needed there.
- Along the visible pool edge: alternating **solid white stepped-block
  structures with small punched window slots** (this is `IMG_8099`'s
  "solid white stepped blocks," now confirmed from a second, closer angle —
  matches `SITE.CABANAS`/`buildPavilions`'s built design) interleaved with
  **free-standing white umbrella/pergola canopies** over rows of white
  sunbeds (≈ 5–6 visible, matching `SITE.LOUNGERS`'s 3-umbrella spec).
  Water is tinted pale teal/turquoise; a dark stone coping band edges it.
- **A narrow band of mown grass, dotted with the same style of drain covers
  as the big lawn, runs between the paved terrace and the pool's coping** on
  the side nearest the camera (the lounger side) — clearly a *different*,
  much narrower strip than the big dinner lawn panel (roughly 1.5–3 m deep,
  vs. the lawn's ~12–20 m), but visually continuous with it in material and
  fixtures (same turf, same style of drain cover).
- This is a new, camera-confirmed detail: `IMG_8099`'s "lawn with a black
  pebble trough at the water's edge" language is now backed by a second
  angle, and it specifically shows turf running the length of the pool's near
  (lounger) side, not just at one end.

⚠ **This clip does not show the second/lounge pool at all.** Everything
pool-side in this footage is the hero/presidential pool and its cabana +
lounger run — it verifies the lawn↔hero-pool relationship, not the
"two rectangles between two sheets of water" relationship from
`lawn-dinner-strips-and-2nd-pool.png`. Nothing here contradicts or confirms
`SITE.LOUNGE_POOL`'s position; it simply isn't in frame.

---

## 2 · The beachfront lawn (`beachfront-lawn-1-frames/` 11 frames, `beachfront-lawn-2-frames/` 19 frames)

Both clips show the same kind of view repeatedly: standing well back on a
broad, flat, open lawn, looking straight out to sea through a gap in the
palms. Consistent across all 30 frames:

### The lawn body

- Flat, uniformly mown, open on the near/landward side — no furniture, no
  ornament, matching the existing "flat, unbroken, empty" read for
  `BEACH_LAWN`.
- At least one individual **broad-canopy specimen tree** (dark, umbrella-
  shaped crown, clearly not a palm) stands prominently well OUT on the open
  lawn itself in several frames (`beachfront-lawn-2` f_001–006), not confined
  to the tree/hedge line at the sea edge — it's a shade tree standing alone on
  the turf, closer to camera than the boundary planting.
- Lawn depth (camera to the sea-edge hedge) reads as roughly 35–45 m across
  several frames, estimated from palm trunk diameter and canopy height — this
  is a rough walking-pace/wide-lens estimate, not a calibrated measurement,
  and should be treated as directional only.

### The sea edge — the key finding

- A **continuous low hedge band**, roughly waist-to-chest height (≈ 1.0–1.3 m),
  flat-topped, runs the full visible width of the lawn at the boundary with
  the beach (`beachfront-lawn-1` f_001–004, f_010–011; `beachfront-lawn-2`
  f_001–002, f_006–011, f_017–019). This is NOT currently in the build —
  `nature.js`'s "seaward fringe" is sparse individual **palms only** (13 of
  them, gapped at the ceremony/cocktail centrelines), with no hedge band at
  all.
- Individual **tall, wispy, needle-foliage trees** (consistent with
  casuarina/Australian pine — thin trunks, sparse drooping foliage, distinct
  silhouette from the coconut palms) stand at or just behind the hedge line,
  poking up through it (`beachfront-lawn-1` f_001, f_003–004, f_010;
  `beachfront-lawn-2` f_001, throughout).
- **Spiky rosette accent plants** (agave/yucca-type) and **clusters of
  yellow/red-leaved shrubs** (croton-type) are mixed into the hedge band at
  intervals, breaking up what would otherwise be a uniform green wall
  (`beachfront-lawn-1` f_009; `beachfront-lawn-2` f_001, f_007–011).
- Dense coconut palm groves flank both left and right of every "picture
  window" view — but they are NOT a uniform screen: they cluster more densely
  at the flanks and thin toward the centre, deliberately framing an open sea
  view down the middle of each shot. This reads as an intentional view
  corridor, not just scattered palms.
- Beyond the hedge: a further low band of beach-edge vegetation, then pale
  sand, then the sea (pale turquoise near-shore, deepening to blue offshore).

### Minor, lower-priority details

- A small dark stone/slate wall panel with twin fixtures (reads as an outdoor
  shower/rinse station) sits tucked into the landward hedge in
  `beachfront-lawn-2` f_012 and f_014/f_016 — a real amenity, not obviously
  tied to any moment, low priority.
- `beachfront-lawn-2` f_016 shows a tall glass high-rise visible far in the
  background beyond the palms — almost certainly a neighbouring building, not
  part of 隐逸居 itself. Noted for completeness, not actionable.
- A light grey paved path skirts the lawn on the landward side among the
  palms in a few frames (`beachfront-lawn-2` f_013–014) — consistent with
  general resort circulation, nothing that contradicts the current spine/cross
  path layout.
- No signage was visible in either clip (no couple names to check against the
  Fung/Cheng trap).

---

## 3 · Deltas vs. the current build

Numbered by confidence — 1–2 are the clearest, camera-confirmed corrections;
5 is closer to a nuance/caveat.

1. **Missing: a narrow turf strip along the hero pool's near long edge.**
   `water.js`'s `buildDeckAndTurf` paves the FULL width on both long flanks of
   the pool today (`pv(-APRON, pz0, px0, SOUTH)` and `pv(px1, pz0, APRON,
   SOUTH)`, i.e. solid basalt paving from the pool's coping all the way out to
   `APRON` = 15.6 m, on both the lounger (−X) and cabana (+X) sides). The video
   shows a real, narrow (~1.5–3 m) mown-grass band between the coping and the
   paved terrace on the lounger side, with the same drain-cover fixtures as
   the main lawn. **Cheap — dressing-level, only touches `water.js`'s paving
   call sites, no `SITE.*` coordinate changes, no moment/spawn risk.**
2. **Confirms, doesn't change: the planted terrace edge (hedge blocks + ball
   topiary + real gaps) between the pool terrace/dinner-lawn zone and
   `GRAND_LAWN` is validated by the footage** — the vocabulary already in
   `campus.js` is right. **Optional cheap addition:** a small decorative
   gate/fence prop in one of the existing gaps, since the real venue has one
   and the code currently just leaves an open gap. Purely cosmetic; the gap
   must stay walkable either way.
3. **Missing: a continuous low hedge band at `BEACH_LAWN`'s sea edge.**
   `nature.js`'s seaward fringe today is sparse individual palms only (13,
   gapped at the ceremony/cocktail centrelines). The footage shows a
   continuous ~1.0–1.3 m hedge with mixed spiky (agave/yucca) and
   colour-leaf (croton) accents, plus individual casuarina-type trees, running
   the full width of the lawn at the sea edge — not currently built at all.
   **Cheap in isolation (a hedge run + accent scatter in `nature.js`), but
   ⚠ FLAG for a moment check:** the hedge sits close to where the ceremony
   rows (z 62–66) and arch (z 71) look out toward the sand (z 78) — a
   continuous hedge there is fine for a standing sightline (sea stays visible
   above a hip/chest-height hedge) but should be walk-tested from the CEREMONY
   spawn and arch, the same way the planted terrace edge was walk-tested when
   it first went in (this project's house rule: "a correct render proves
   nothing about movement — walk it"). Does not require moving `BEACH_LAWN`,
   the aisle, or any spawn — it is a planting addition, not a footprint change.
4. **Missing: an individual broad-canopy specimen tree standing well out on
   the open lawn itself**, not just at the tree/hedge line — seen clearly in
   `beachfront-lawn-2`. If added, keep it off the x ≈ −22 (ceremony) and
   x ≈ +4 (cocktail) centrelines and clear of the seating rows — it would be
   a `nature.js` addition, cheap, but positionally sensitive near the two
   moments that share this lawn.
5. **Nuance, not a contradiction:** the dinner lawn's "big lawn is empty, no
   ornament" read and the beachfront lawn's "flat, unbroken, empty" read both
   still hold for the LAWN BODIES themselves — every ornamental feature found
   above (topiary/hedge threshold, sea-edge hedge, specimen tree) sits at an
   EDGE or just past the transition zone, never in the middle of open turf.
   Nothing here contradicts the existing "no hedge ring, no coping, no ring
   path in the middle of the lawn" design principle from
   `clubhouse-lawn-to-beach.png` — it only adds detail to the edges the
   reference photo doesn't show at ground level.

**Nothing above requires moving `SITE.DINNER_LAWNS`, `SITE.DINNER_WALK`,
`SITE.GRAND_LAWN`, `SITE.BEACH_LAWN`, `SITE.POOL`, `SITE.CABANAS`,
`SITE.LOUNGERS`, or any `MOMENT_PLACES` spawn.** Every delta found is a
dressing/planting addition or a paving-extent tweak, not a footprint or
coordinate correction — this footage confirms the site plan's shapes and
adds detail to what stands on top of them.

---

## 4 · Priority read

The three deltas that would most improve DINNER and CEREMONY fidelity, in
order:

1. **The sea-edge hedge for `BEACH_LAWN` (delta 3).** This is the single
   biggest visual gap between the build and reality for the CEREMONY moment —
   right now the arch looks out over sparse palms and open sand; the real
   venue has a groomed, planted edge with colour and texture immediately in
   front of the sea. **Structural-adjacent** only in the sense that it needs a
   walk-test against the ceremony sightline before being called done; the
   planting itself is cheap.
2. **The narrow turf strip along the hero pool's lounger-side edge
   (delta 1).** Directly affects how the DINNER moment's pool-adjacent lawn
   reads — right now that edge is solid paving from coping to terrace with
   nothing softening it; the real venue has a lawn buffer the whole way.
   **Cheap** — a `water.js` paving-extent change, no coordinates move.
3. **The decorative gate at the planted terrace edge (delta 2).** Smallest
   of the three, but it's a free, camera-confirmed detail that would sell the
   transition between the dinner-lawn zone and the pool terrace/`GRAND_LAWN`
   as a designed threshold rather than a gap in a hedge. **Cheapest** —
   one prop, no logic change, no walkability risk since the gap already exists.

Everything else (the specimen tree, the outdoor shower panel, the
mow-stripe/drain-cover fidelity already matching) is genuine polish, lower
priority than the three above.
