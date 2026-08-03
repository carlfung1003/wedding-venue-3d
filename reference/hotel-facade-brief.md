# The Westin Sanya Haitang Bay — the main crescent, as photographed

Distilled 2026-08-02 from Carl's own media, after he looked at the render and
said the facade did not match. **This file is the modelling source of truth for
`SITE.HOTEL` and `campus.js`'s `buildHotel()`. Read it before changing the
elevation; do not re-derive the building from an aerial.**

What was there before this brief: a white *diagonal lattice exoskeleton* over a
dark emissive window grid, with deep terraced balcony bands, applied identically
to both faces of the building. None of that is on this hotel. It had been
inferred from one low-resolution overhead photo and never checked against an
elevation.

---

## 1 · Where the elevations came from

All gitignored. The masters live in `~/Desktop/Wedding App/`.

| File | What it settles |
|---|---|
| `reference/photos/hotel-westin-hotel-back.webp` | **The primary elevation.** A three-quarter aerial of the CONCAVE (garden/sea) face from inside the resort — the face the campus sees. Reads the storey rhythm, the balcony form, the glazing colour and the bronze cores. |
| `reference/photos/hotel-westin-hotel-front.webp` | **The arrival face.** The white perforated screen and the wave-form porte-cochère, from the inland side. |
| `reference/video/hotel-frames/trim1_002.jpg`, `dawn_001.jpg` | Wide dusk elevations at roughly the distance the venue renders it (285 m). The roofline and the massing at the north tip. |
| `reference/video/hotel-frames/dawn_017.jpg` | **The night elevation.** What the lit building actually looks like after dark. |
| `reference/video/hotel-frames/screenrec_010.jpg`, `trim3_003.jpg` | The crescent seen along its own length from the rooftop bar, at night; also the rooftop bar and pool in context. |
| `reference/video/hotel-frames/screenrec_014.jpg` | Inside the rooftop bar. Not used for the facade; kept for the Welcome Brunch dressing. |

Frames were pulled with `ffmpeg -vf fps=1 -q:v 3` into
`reference/video/hotel-frames/` (59 frames from six clips). The three drone
trims and `Westin Pool Cool.mov` are all under 4 s and add nothing the two
stills above do not say better.

---

## 2 · The building has TWO different faces

This is the single most important fact and the old model missed it: it gave both
faces the same map.

### 2a · CONCAVE — west, over the gardens. **The one the campus sees.**

A shallow 1.5 rad arc, seven guest storeys over a podium, reading as a strong
horizontal band. Per storey, top to bottom:

1. **A bright white slab edge.** The dominant horizontal. It projects, catches
   the sun, and is what draws seven lines across 142 m of arc.
2. **Recessed glazing, teal-green.** Floor-to-ceiling, divided by slim white
   mullions at the bay edges and on the bay's centre line. Deep blue-green at
   the top of the reveal where it is in shadow, paler at the bottom where the
   sky lands in it.
3. **The signature: a solid white balcony balustrade shaped as a TRIANGLE,
   apex up, one per bay.** They very nearly touch, so the elevation reads as a
   continuous white sawtooth with the glass showing only as narrow inverted
   wedges between the apexes. Seen square-on they read as vertical fins; seen
   obliquely — which is how the venue always sees this building — they are a
   dense field of white triangles. This is the whole character of the facade.

Punctuating the arc: **three full-height bronze/brown circulation cores**, matt,
slightly warm, standing proud of the balcony line. Without them the arc reads as
one endless band.

The section **rakes back as it rises** — the balconies step outward with height.

### 2b · CONVEX — east, the arrival side.

Completely different: a **white sculptural screen** punched with tall,
irregular, tapering, leaf-shaped slits arranged in loose vertical columns. The
rooms behind show as shadow through the openings. Nothing rectilinear, nothing
diagonal, nothing repeating. Beside it, one wing is faced instead in deep
horizontal bronze louvres carrying the `WESTIN` sign.

At ground level, the **porte-cochère**: a fan of undulating blue-steel ribs
sweeping down off the screen wall to a row of slim posts. It is on THIS side of
the building, not the garden side.

---

## 3 · Roofline and massing

- Flat roof, white parapet, then a **stepped-back attic band** and a scattered
  run of **white plant / lift-motor boxes** standing proud of it. The broken
  skyline is most of what the building reads as in silhouette at dusk
  (`trim1_002`).
- Planted green roof over the deep part of the plan.
- The arc **rises at its north tip into a taller block** carrying the rooftop
  bar and pool. In every wide frame the composition is: long low arc, then one
  lift at the end. It is a lift, not a tower — keep it restrained or it fights
  the horizontal, which is the building's whole idea.

## 4 · Night (`dawn_017`)

Not a continuous ribbon of light. **Discrete warm-amber slots, roughly three
rooms in five lit**, scattered without pattern; the slabs, the concrete
triangles and the cores stay dark. The podium's restaurant glazing is a
continuous warm band under it all. The rooftop is the brightest thing on the
building.

## 5 · Palette

| Element | Colour |
|---|---|
| Concrete / balustrades / slabs | warm off-white, `#f2efe6`…`#f5f2e9` |
| Glazing | teal-green, `#1c414b` (shadowed) → `#4d878c` (sky) |
| Circulation cores | matt bronze-brown, `#6f5238` |
| Porte-cochère ribs | blue-steel, `#6d8398` — cool gunmetal, NOT cobalt |
| Podium | pale stone, with a dark glazed band |

---

## 6 · How it is built, and what it costs

`buildHotel()` in `campus.js`. The rhythm is a canvas texture; only the things
that change the silhouette are geometry.

- `texHotelFacade()` — slabs, glazing, mullions, triangles. One canvas tile =
  4 bays, repeated 9× → 36 bays over the arc ≈ 3.96 m each, a real guest-room
  module. **Both this map and `texHotelWindows()` are drawn upside down**
  (`flipRows`) because `CanvasTexture.flipY` is true; draw a storey section
  reading downwards and every triangle comes out apex-DOWN.
- `texHotelWindows()` — the emissive twin, registered bay-for-bay.
- `texHotelScreen()` — the arrival face's perforated screen.
- Geometry added: 7 white parapet rings at the balcony slabs (the sun-catching
  edge), 3 bronze cores, 1 attic band, 11 instanced roof boxes (1 draw call),
  3 boxes for the north-tip block, 3 canopy ribs, 1 podium glazing band.

**Cost, measured 2026-08-02** (the `hotel` group alone, so the concurrent
water/nature work is excluded): **82 → 98 draw calls (+16), 10,088 → 11,788
triangles (+1,700), no new lights, no new colliders, +1 texture.**

## 7 · Two things to know before you touch it

- **The 6 m batter is load-bearing.** The concave face runs `rIn` (84) →
  `rIn + 6` (90), and 90 is `SITE.HOTEL.ROOFTOP.rIn` — the walkable rooftop
  terrace's inner edge lands exactly on the top of that lean. Change the batter
  and the terrace, its polar hole in the height field and its y-ranged
  colliders all shear off the building.
- **The arrival face is outside the playable world.** `CFG.WORLD_BOUND` is 300
  and the crescent's convex face is at x ≈ 296, so no guest in fly mode can get
  east of it. The screen and the porte-cochère are cheap correctness, not
  spectacle — do not spend budget there.
- **The bay width is tied to the arc length, and the proportion pass will break
  it.** `HOTEL_TILES = 9` puts 4 bays per tile over `SITE.HOTEL.r * .arc` =
  142 m, i.e. ≈3.96 m per guest room. Grow the crescent toward the half circle
  Carl has asked for and the same 36 bays stretch across it — 8 m guest rooms.
  Recompute as `round(H.r * H.arc / (4 * 3.96))` when the arc changes.
