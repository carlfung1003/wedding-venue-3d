# The resort's main pool complex — modeling brief (2026-08-04)

Distilled from four new photos of the Westin's big lagoon/pool system between
the 隐逸居 clubhouse enclave and the hotel crescent — the water body Carl has
actually stayed beside, not the enclave's own hero pool and not the beach pool
already built at `SITE.RIVER.WEST`. **This is the modeling source of truth for
`SITE.LAGOON` / `SITE.HOTEL_POOLS` / `water.js buildRiver()`'s lagoon-and-east
basins. A future agent should build from this brief, not re-derive the
complex from the photos.**

---

## 1 · Sources

All in `reference/photos/`, all gitignored (masters live wherever Carl sourced
them from; only this brief is committed):

| File | What it is |
|---|---|
| `resort-pool-complex-aerial.webp` | **The key image.** A high, close aerial of the whole complex — the free-form lagoon, the mosaic swirl floor, the tree island, the grass island + cabana ring, the spoked pavilion, the elevated walkway, an amphitheatre-stepped building, a separate kids'-pool section, loungers/umbrella rows, and dense fringing palms. |
| `resort-pool-cabana-view.webp` | Ground level, from inside a rattan-dome cabana daybed, looking across the water at the far bank's TWO cabana types. |
| `resort-swim-up-bar.webp` | The swim-up bar: timber structure, louvred canopy, back-bar shelving, submerged stools, "POOL BAR"-type signage, a bougainvillea planter. |
| `resort-kayak-channel.webp` | The lazy-river channel with a kayak on it — Carl's evidence for how wide the channel should read. |
| `build-lagoon-pools-2026-08-04.png` | Our current build, night, top-down, for the delta list. |
| `resort-water-features.jpeg` (already committed reference) | Wider-context aerial that first identified "a long free-form pool complex hard against the crescent's concave face — three lobes with planted islands between them" — this is the same complex, from further out. |
| `lazy-river-closeup.png`, `beach-pool-circular.png`, `westin-site-map.jpeg` (already committed reference) | Context only; not re-read for this brief. |

**Identification, stated plainly because it matters for everything below:**
`resort-pool-complex-aerial.webp` is judged to show the same water body as
`SITE.LAGOON` + `SITE.HOTEL_POOLS` (the pool complex in the crescent's
concave "crook," east of the enclave) — consistent with `resort-water-features.jpeg`'s
already-committed read and with the complex's position in `westin-site-map.jpeg`
(east end of the river system, against the crescent). **This identification was
not re-verified by SIFT/overlay against the site map the way earlier passes
verified the beach pool and the crescent's arc** — it is a visual match, not a
calibrated one. Confirm it before spending a full build pass (see Open
Questions).

**Scale anchors used throughout section 2**, per the task brief: a sunbed/lounger
≈ 2.0 m, a resort umbrella ≈ 3.0 m across, a cabana ≈ 3–4 m, a standing adult
≈ 1.7 m. No pixel ruler was used — these are ratio estimates against those
objects where they appear in frame, stated as ranges, and cross-checked once
against the one number this project already has calibrated: the water-position
pass's SIFT-measured "crook mass" (`CLAUDE.md`, THE WATER POSITION PASS) —
1635 m² spanning world x 118…190 (72 m) × z −36…+50 (86 m). If the
identification above is right, that 72 × 86 m real footprint is the outer
bound the aerial's contents sit inside.

---

## 2 · What the complex actually contains

### 2a · The lagoon's plan shape

One continuous free-form body of water filling most of the frame,
wider than it is tall in this crop — a broad kidney/blob with at least two
lobes (a bulge upper-left where a separate, walled-off pale-blue section sits,
and the main mass running lower-centre to right). Against the loungers and
umbrellas at its edges (each a known size), the visible span in this single
frame reads as roughly **70–100 m along its longest visible axis** — consistent
with, and not larger than, the 72 × 86 m calibrated crook-mass figure above.
The shoreline is entirely irregular curves; no straight edges except one
short run of reddish-brown decking at the right margin, which likely marks
where the lagoon meets a built hotel terrace rather than open bank.

### 2b · The deep-blue mosaic swirl pattern — the signature, and absent from our build

Broad, soft-edged ribbons of a noticeably darker blue laid across the paler
turquoise floor, most visible in the upper-middle and right thirds of the
lagoon. Reading the ribbons against the lounger/umbrella scale: individual
ribbons are roughly **2–5 m wide**, they run in long sweeping curves (not
straight, not tightly coiled — more "brushstroke" than "spiral"), several
run roughly parallel to each other for 15–25 m before diverging, and they
appear to follow the basin's own long axis rather than cutting across it —
consistent with a mosaic-tile artwork designed to read from the air rather
than from the water's edge. Colour: a saturated ultramarine/navy against a
lighter cyan-turquoise field — noticeably darker than the water's own tint
where no swirl sits, not just a shading gradient (the existing `WEST` basin's
concentric rings, by contrast, are a similar darker-blue-on-turquoise
treatment but circular, not ribboned). **Nothing like this exists on any
basin currently built** — every basin's floor is either the plain shallow→deep
vertex-colour ramp (`RINGS` array in `buildRiver`) or, for `WEST` only, the
concentric-ring medallions. `LAGOON` and `HOTEL_POOLS` have neither.

### 2c · Tree islands standing IN the water

At least one large, unambiguous tree island: a substantial single-crown shade
tree (crown diameter roughly **12–18 m**, judged against the nearby cabanas at
3–4 m and the loungers at 2 m) sitting on a small mound that reads as fully
surrounded by water on every side, casting a long dramatic shadow across the
lagoon's surface (low sun angle). This is a genuine island, not a planted bed
at the bank — no visible causeway or path connects it to shore in this frame.
**Only one such tree island is unambiguous in this photo**; if the real
complex has more, they are outside this frame or not distinguishable from the
denser planting elsewhere — do not assume a count beyond one from this
source.

### 2d · The circular grass island + its ring path + cabanas

A separate feature from 2c, roughly centred in the lower-middle of the frame:
a round grass islet (estimated **10–15 m diameter**, judged against the
cabanas ringing it) edged by a visible ring path, with **six to eight
individual cabana-style pavilions** (white pitched/peaked canvas or fabric
roofs on timber decks) standing at evenly-spaced points around its perimeter,
each jutting slightly into the water on its own small deck. Overall
assembly diameter (grass island + ring of cabanas) reads as roughly
**20–28 m**. This reads as the resort's premium cabana cluster — the single
most legible "you would book this for a day" feature in the photo.

### 2e · The two cabana types (from `resort-pool-cabana-view.webp`)

Looking out from inside a cabana daybed across the water at the far bank:

- **Near/foreground type** — a low white cushioned daybed under a **dark
  woven-rattan dome/pod canopy** on an arched wicker frame; the whole pod
  reads as roughly **2.5–3 m** across at the base, canopy apex maybe 2–2.2 m
  above the bed (bed itself ≈ 2 m, the standard lounger anchor). Sits at the
  water's edge on decking.
- **Far-bank type A** — a **solid-sided** timber cabana: vertical batten/slat
  side walls on three sides, open front, flat/shallow-pitched roof on posts,
  raised on its own small deck jutting into the pool with a lounger visible
  inside. Estimated footprint ≈ **3–4 m** square (the cabana anchor).
- **Far-bank type B** — an **open pergola-style** cabana: no side walls at
  all, just a slatted flat roof on four corner posts over a low table and two
  chairs, same raised timber deck. Similar footprint, ≈ 3–4 m.
  
Both far-bank types stand on their own individual timber decks projecting a
metre or two into the water, backed by clipped hedges, with the multi-storey
hotel crescent visible in the background (glazed balconies, white with some
colour accent — consistent with the already-documented `hotel-facade-brief.md`
elevation, though too distant/soft-focus in this frame to re-verify details).

**Open question whether 2d and 2e are the same feature** (the grass-island
ring seen from two different vantage points) or two separate cabana
installations on the same lagoon — see Open Questions.

### 2f · The spoked/umbrella-roofed pavilion

A standalone circular structure standing on a small deck at the water's edge,
roughly centred between the tree island and the cabana ring. White ribs
radiate from a central point like an umbrella or a sail, panels between the
ribs read as taut fabric or open lattice (ambiguous at this resolution — the
brief only commits to "spoked, radiating ribs, circular plan"). Estimated
diameter **8–12 m**, judged against the cabana ring beside it — a
substantial architectural object, larger than any single cabana, clearly
a shared/bar structure rather than a private one. No stairs, counter or
signage are legible at this resolution; do not assume this is the same
structure as the swim-up bar (2g) without more evidence.

### 2g · The swim-up bar (from `resort-swim-up-bar.webp`)

A timber-built bar standing partly IN the pool: a flat, **louvred/slatted
canopy roof** (visually distinct from the spoked pavilion's radiating-rib
roof and from the enclave's own conical thatch bar at `SITE.RIVER.BAR`) over
a back wall of bottle shelving roughly **2 m** tall, a service counter at
water level, and a row of **submerged bar stools** visible just under the
surface in front of the counter (guests swim up and sit half-submerged).
Signage on the counter front reads "POO[L] BAR" (partially obscured — the
"L" is not legible, read as "POOL BAR" by inference from context, not
confirmed). A large white bowl-shaped planter, roughly **1–1.2 m** diameter,
mounted above/beside the bar on what looks like a curved white wall or
balustrade, overflows with pink bougainvillea. The background shows dense
palm and broadleaf planting — this frame gives no clue as to the bar's
position relative to the rest of the complex (see Open Questions).

### 2h · The elevated walkway / bridge

Visible in the aerial as a pale curved structure crossing open water,
distinct from the flat plank footbridges already built (`buildRiverBridges`,
which cross the narrow SPINE/SPUR channel only, ~2 m wide, at grade). This
reads as a more substantial elevated boardwalk/bridge — wide enough to be a
real pedestrian route rather than a single-file crossing, with a visible curve
in its plan rather than running straight bank-to-bank. It appears to connect
the amphitheatre-terrace area (2i) toward the pool's midground. Exact width
and rail detail are not legible at this resolution.

### 2i · The hotel building's amphitheatre steps

At the top of the frame, a large near-semicircular white structure with wide
banded steps descending toward a small circular pool/fountain at its base
(a plain disc of water with a central jet, no swirl pattern visible on this
one), palms and ornamental planting around its perimeter, and what reads as a
gold spherical ornament near the top. This reads as a formal terrace/plaza
transition between a building and the pool complex — likely part of the
hotel's own architecture at the point where it meets this water, but **this
brief cannot confirm whether it is part of the crescent already documented in
`hotel-facade-brief.md`** (that brief describes the concave face as a
balustrade-triangle-over-glazing rhythm, which this stepped amphitheatre form
does not obviously match) **or a separate annex/plaza building**. Flagged as
an open question rather than guessed.

### 2j · The kids' pool with slides

A separate, visually walled-off pale-blue basin at the western/left edge of
the frame, physically distinct from the main lagoon (its own smaller
outline, own loungers around it). A lighter structure at its margin may be a
water slide, but at this resolution and camera angle **this cannot be
confirmed** — flagged as ambiguous, not asserted.

### 2k · Loungers and umbrella rows

Visible in rows along the straighter deck sections (right side of frame, and
around the kids'-pool section), white loungers in pairs/rows and clustered
white umbrellas near what may be a shaded dining terrace at upper-right,
adjacent to the amphitheatre structure. Consistent in character (if not
exact arrangement) with what `buildRiverDressing` already places around
`LAGOON` (11 umbrellas + paired loungers, radially arranged around the
basin's coping) — this is the one item in the list that is largely already
built; see delta below.

### 2l · Edge treatments

Where visible: dark coping directly at the water's edge (as already built —
`R.COPE_Y` coping lip), then either sand-toned deck, timber decking (the
cabana zone and the reddish-brown straight run at right), or lawn running
straight to the coping with no deck at all (around the tree island and
grass-island cluster). No single edge treatment dominates — it varies by
zone, unlike `WEST`'s uniform sand deck.

### 2m · Palm density

Very dense, near-continuous canopy fringing the whole complex, individual
crowns distinguishable, casting long shadows across the water consistent
with a low sun angle. Denser and more continuous than the current build's
bank-palm coverage reads from the air in `build-lagoon-pools-2026-08-04.png`.

### 2n · The kayak channel (`resort-kayak-channel.webp`)

Turquoise mosaic floor (with visible swirl/ribbon patterning here too — a
second data point for 2b, on a narrower channel), palms overhanging both
banks so densely the water is mostly hidden, timber edging on one bank,
submerged ladder/steps visible, a two-tone kayak with a paddler lying back
in it. Judged against the kayak (a touring kayak is commonly **2.5–3.2 m**
long, **0.6–0.9 m** wide, and a paddler needs swing room beyond the hull),
the channel reads as comfortably wide enough for one kayak with paddle
clearance but not for two abreast. **This is consistent with, not contradicted
by, the current `SPINE`/`SPUR` half-widths already in `site.js`** (2.3–4.3 m
channel width, tuned in the water-position pass against a paddleboard
reference) — see the Priority Read for why this is a confirmation, not a
delta.

---

## 3 · Deltas vs the current build

Current build reference: `build-lagoon-pools-2026-08-04.png` (night, top-down)
and the code read directly — `SITE.LAGOON` / `SITE.HOTEL_POOLS` in `site.js`
(~line 1001, ~line 1040), `buildRiver()` / `buildRiverIslands()` /
`buildRiverDressing()` / `buildRiverBridges()` in `water.js` (~line 2138,
~2401, ~2511, ~2738). Today `LAGOON` is a single free-form basin with the
standard shallow→deep colour ramp, one plain green cylinder as a "planted
island," 11 blue umbrellas + paired loungers ringing the coping, and no
cabanas, no pavilion, no bar, no second bridge type. `HOTEL_POOLS` is three
smaller basins swung along the crescent's face with the same ramp + 6
umbrellas each, nothing else.

| # | Delta | Kind | File / symbol |
|---|---|---|---|
| 1 | **No mosaic swirl pattern anywhere on `LAGOON` or `HOTEL_POOLS`.** Only `WEST` has a floor pattern (concentric rings), and it's the wrong pattern for this basin. | CHEAP DRESSING (new geometry, no coordinate/collider change) | `water.js buildRiver()` — add a swirl-ribbon block parallel to the existing "1b · THE BEACH POOL'S CONCENTRIC RINGS" block (~line 2270), keyed to `basins.find(b => b.key === 'lagoon')` and the `hotel0…2` basins. Same technique already proven: flat quads at `BASIN_Y + .006` with `polygonOffset`, drawn as an accumulator baked to one mesh. |
| 2 | **`LAGOON`'s planted island is a plain green cylinder, not a real tree.** `WEST` already has a proper tree (trunk + 4 icosahedron crown lobes); `LAGOON` does not. | CHEAP DRESSING (reuses existing tree code) | `water.js buildRiverIslands()` (~line 2405) — replace/augment the `isl`/`rim` cylinder block with the `WEST` shade-tree pattern (trunk cylinder + crown lobes), sized per §2c (12–18 m crown). |
| 3 | **No circular grass island + cabana ring anywhere on `LAGOON`.** Nothing built at all — only umbrellas/loungers ring the coping. | STRUCTURAL | New: a `SITE.LAGOON.ISLE` (or similar) anchor point in `site.js`, sized to fit inside the existing 39×31 m `LAGOON` footprint (see Priority Read — must respect the "lagoon kept smaller than reality" decision); a new builder in `water.js` for the grass islet, ring path, and 6–8 cabanas in the two styles from §2e. |
| 4 | **No cabana pairs of the two distinct styles (solid-slat / open-pergola) anywhere on the resort water system.** The enclave's own `buildPavilions()` cabanas are a third, unrelated style (solid stepped white blocks per `IMG_8099`) — do not reuse that geometry here. | STRUCTURAL | Same locus as #3 — the two-style cabana geometry is new, in `water.js`, likely a small shared function called twice with a style flag. |
| 5 | **No spoked/umbrella pavilion.** | STRUCTURAL | New: a site.js anchor point (probably inside `SITE.LAGOON`'s footprint per §2f's position between tree island and cabana ring) + a new builder in `water.js`. |
| 6 | **No swim-up bar with submerged stools anywhere.** `SITE.RIVER.BAR` exists but is a different design (conical thatch roof, on-land counter, at `WEST` only) and Open Question below covers where this one goes. | STRUCTURAL | New: a `site.js` anchor (pending Open Question) + a new builder in `water.js`, distinct from the existing `BAR` block in `buildRiverIslands()` (~line 2465). |
| 7 | **No elevated/curved walkway across open water**, only flat 2 m plank footbridges crossing the SPINE/SPUR centrelines. | STRUCTURAL | `water.js buildRiverBridges()` (~line 2738) builds only channel-crossing bridges from the `BRIDGES` list, which indexes into `SPINE`/`SPUR` polylines — it has no path across a basin interior. A new bridge across `LAGOON` needs its own two endpoints (not a `[which, t]` pair) and its own geometry (wider deck, visible curve, rails) — this is a new function, not an extra `BRIDGES` entry. |
| 8 | **No amphitheatre-stepped terrace/plaza feature anywhere near the water.** | STRUCTURAL, **file ownership unclear** — likely `campus.js buildHotel()`/`SITE.HOTEL` territory (it reads as a building feature, not a water feature) rather than `water.js`. Flagged, not assigned — see Open Questions. |
| 9 | **Loungers/umbrellas on `LAGOON` are already built** (11 umbrellas, paired loungers, radially placed around the coping via `buildRiverDressing`) but arranged as an even radial ring rather than the aerial's straighter rows along specific deck edges. | CHEAP DRESSING, OPTIONAL | `water.js buildRiverDressing()` (~line 2511) — cosmetic re-arrangement only if a future pass wants it; current placement is not wrong, just less clustered. |
| 10 | **Palm density around `LAGOON`/`HOTEL_POOLS` reads thinner than the reference** in the current night top-down. | CHEAP DRESSING, OPTIONAL | `water.js buildRiverDressing()`'s bank/deck shrub+palm sampling (~line 2571 onward) and/or `nature.js`'s general scatter — worth a side-by-side check before committing effort; may already be adequate once other deltas add midground objects for palms to read against. |
| 11 | **Kids' pool with slides (§2j) — not built, but also not confirmed by the photo.** | NOT ACTIONABLE without confirmation | No file assignment until Carl or a clearer photo confirms the slide reading — see Open Questions. |
| 12 | **Kayak channel width (§2n) — already satisfied, no action.** | NO DELTA | `site.js SITE.RIVER.SPINE`/`SPUR` half-widths (2.3–4.3 m) already match a comfortable single-kayak reading; do not widen on this evidence alone. |

---

## 4 · Priority read — top 5, cheapest-first where effect is equal

All five are checked against the two standing decisions in `CLAUDE.md`
("THE WATER POSITION PASS" / "THE PROPORTION PASS"): **(a)** the lagoon is
deliberately smaller than reality (*"the failure Carl actually SAW was the
pools dominate"*) and **(b)** the whole water system's position was
calibrated against the site map and should not move again. None of the five
below relocate any basin or grow `LAGOON`'s or `HOTEL_POOLS`' footprint —
they all add detail and objects INSIDE the existing footprints.

1. **The mosaic swirl floor pattern (delta #1).** This is the single detail
   Carl called out as "a signature and completely absent from our build." It
   is the cheapest of the five (proven technique, no new architecture, no new
   `site.js` anchors needed beyond the existing basin keys) and it changes
   what every basin looks like from directly above — the exact angle this
   backdrop is seen from in fly mode. **Safe against both standing
   decisions**: it is a floor texture, touches no position and no size.
2. **A real tree on `LAGOON`'s planted island (delta #2).** Second cheapest
   — it is a copy of code that already exists for `WEST`. Improves both the
   day silhouette (a real crown reads distinctly from the plain-cylinder
   blob) and the night one (real canopy shadow instead of a flat disc).
   **Safe against both standing decisions**: same footprint, no move.
3. **The elevated walkway/bridge across the lagoon (delta #7).** Moderate
   cost (new geometry, but reuses the existing bridge deck+rail instancing
   pattern) for a genuinely distinctive silhouette, especially at night if
   the rail carries the same warm-lamp emissive treatment already used
   elsewhere on the campus. **Safe against both standing decisions** as long
   as its span stays inside the existing basin outline rather than implying
   the basin should be wider to fit it properly — this is the one place a
   builder could accidentally re-open decision (a) by making the bridge want
   more water than `LAGOON` currently has. Size it to the basin, not to the
   photo's real-world span.
4. **The circular grass island + cabana ring (delta #3/#4).** The most
   structurally significant of the five and the dominant midground object in
   every reference shot of this pool — without it the basin still reads
   empty in the centre no matter how good the floor pattern is. Higher cost
   (new anchor, new builder, two cabana styles). **Needs explicit scaling
   care against decision (a)**: the real assembly reads ~20–28 m across
   (§2d), and `LAGOON` is only 39 × 31 m — built at full scale this could
   itself become the "pools dominate" problem the smaller lagoon was chosen
   to avoid. Scale it down proportionally to the built basin, not to the
   real one.
5. **The spoked pavilion (delta #5).** Distinctive silhouette, moderate cost
   (one new hero object, no repeated instancing needed since there's only
   one). **Safe against both standing decisions** — a single object well
   inside the existing footprint.

**Not in the top 5, and why:** the swim-up bar (delta #6) is mostly a
ground-level/walk-through detail — its back-bar shelving and submerged stools
read at eye level, not from a flyover, so its impact-per-cost is lower for
"what a guest sees flying over" specifically (it would rank higher for a
future walk-through pass). The amphitheatre steps (delta #8) may not even be
a `water.js` job — see Open Questions — and is left out of this water-focused
priority order until ownership is settled.

---

## 5 · Open questions for Carl

1. **Is `resort-pool-complex-aerial.webp` really `SITE.LAGOON` + `SITE.HOTEL_POOLS`?**
   This brief assumes so (§1's "Identification" note), matching the
   already-committed read in `site.js`'s `HOTEL_POOLS` comment
   ("resort-water-features.jpeg shows a long free-form pool complex hard
   against the crescent's concave face"). It was not re-verified by
   calibrated overlay the way the beach pool and the crescent's arc were in
   earlier passes. Worth a quick confirm (a SIFT/overlay pass against
   `westin-site-map.jpeg`, the way the water-position pass did) before a
   future agent spends a full build cycle assuming it.
2. **Where does the swim-up bar (§2g) sit relative to `SITE.HOTEL_POOLS`?**
   The bar photo is a tight ground-level crop with no landmark connecting it
   to the wider aerial — it could be at `LAGOON`'s edge (playing the same
   role `R.BAR` plays at `WEST`) or specifically at one of the three
   `HOTEL_POOLS` lobes, closer to the crescent. The photos as supplied don't
   settle this.
3. **Are the cabana ring (§2d) and the two-styles cabana photo (§2e) the same
   installation seen from two angles, or two separate cabana groups on the
   same lagoon?** If they're the same, only one new structure needs
   building (a ring mixing both styles); if they're separate, the brief
   underspecifies where the second bank of cabanas (§2e) sits relative to
   the grass island (§2d).
4. **Is the amphitheatre-stepped structure (§2i) part of the already-modelled
   hotel crescent, or a separate building?** `hotel-facade-brief.md`
   describes the crescent's concave face as balustrade-triangle-over-glazing,
   which doesn't obviously match a stepped amphitheatre form. If it's a
   separate structure, it needs its own `SITE.*` entry and probably belongs
   to `campus.js` rather than `water.js` — worth Carl confirming what this
   building actually is (event plaza? spa entrance? restaurant terrace?)
   before anyone models it.
5. **Is the kids' pool with slides (§2j) real, or is that a misread of a
   plain second basin?** This brief could not confirm a slide structure at
   the available resolution. If Carl has a clearer photo of that corner, it
   would settle the question; otherwise this item should probably stay
   unbuilt rather than guessed.
