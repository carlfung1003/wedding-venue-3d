# ASSET SPEC — the Blender-authored props for The Big Day (KAN-207)

This file is the contract between three things: the Blender **generators**
(`generators/*.py`), the **loader** (`js/models.js`) and the **integration** in
`js/moments.js`. Every number here was read off the current procedural props in
`moments.js` (the dimensions the colliders, spawns and framing were tuned to), so
a GLB that honours its row is a drop-in replacement. If you must deviate, change
this file first and say why in the generator's docstring.

The decor truth is the planner's renders (`reference/photos/decor-*.jpg`, Rosa Wed
蔷薇婚礼) — see the palette below. ⚠ THE COUPLE ARE **FUNG AND CHENG** / **Carl &
Rachel**; the renders letter them "Feng/Zheng" and that is wrong. No generated or
modelled asset may carry any lettering at all — the game draws every word itself.

## Conventions (apply to every asset)

| | |
|---|---|
| **Units** | metres, real size. No runtime scaling except rows marked *unit*. |
| **Blender frame** | Z-up. The glTF export is Y-up: Blender (x, y, z) → glTF (x, z, −y). |
| **Front** | Default: the asset's front (the side a guest looks at in the render) faces **glTF −Z**, i.e. model it facing **Blender +Y**. This matches how every extras prop in `moments.js` is authored ("at the origin facing −Z"). The chair family is the ONE exception — see its row. |
| **Origin** | Floor-standing: footprint centre, y = 0 at the foot. Hanging (`bead_chandelier`, `candelabra`, `fabric_flower`, `mirror_ball`): origin at the **hook / attachment point**, the object hangs down −Y. Table-top props (`bottle_set`, `drink_dispenser`, `cupcake_stand`, `centrepiece_low`): origin at the base centre; they sit on a surface at y = 0. |
| **One GLB = one mesh + one material** | The loader instances a GLB as `InstancedMesh(geometry, material)`, so every asset joins to a single mesh with a single baked atlas. A part that needs a *different* material class (emissive facia, tintable canopy, mirror tiles) is exported as its own GLB via `build_<suffix>()` → `<NAME>_<suffix>`, same origin. |
| **Material names that mean something** | `*_emit` → the loader keeps it emissive (DJ facia, candle flames). `mirror` → metallic 1 / roughness .12. `canopy_tint` → white albedo so the game can multiply an instance colour into it (teal parasols). |
| **What the game draws itself (LEAVE BLANK)** | The dessert counter's front sign, the menu easel's board face, the beverage cart's front cloth, the welcome board. The game hangs its own `PlaneGeometry` with clean 0..1 UVs a few mm proud of your surface (an atlas-baked face cannot take a new texture — it samples one patch of the atlas). Model the surface flat and plain there. |
| **Palette** | `wv_lib.PALETTE` keys below. Authored as display sRGB, converted to linear by `M()`. |
| **Blooms** | Bloom masses use the generated textures in `textures/gen/` through `image_mat()` + a second UV layer (`spherical_uv` / `planar_uv`) that the atlas unwrap cannot destroy. If a texture is missing, fall back to the procedural bloom material — never fail the build. |
| **AO** | Outdoor/open props `AO_DIST 0.5, AO_STRENGTH 0.5`. Anything with an enclosed interior (`dj_booth`, `coconut_rack` shelves): `AO_DIST 0.15`. |
| **Bevel** | `BEVEL` in metres per generator; 0 on cloth, florals and beads. Bevels ~4× face count — use them on furniture edges a guest stands next to, not on backdrop. |
| **Determinism** | `random.Random(seed)` per generator, seed from the asset name. The game's own rule is seeded PRNG everywhere; the assets follow it. |
| **Budget** | The `TRIS ≤` column is the exported triangle count, measured by `export_all.py`. Over budget = not done. |
| **Verification** | `preview_all.py` (Workbench turntable) is for shape; the in-engine check is `tools/shoot-models.mjs` (the venue's own Three.js renderer, PMREM + ACES + sun) — judge look there, at guest distance. |

### Palette (display sRGB, from `moments.js` `PAL` + its material table)

| key | hex | used for |
|---|---|---|
| `oak` | `c3a37c` | cross-back chairs, long tables — light, grey-warm, NOT orange |
| `oak_d` | `a88a66` | chair/table shadows, hat-rack posts |
| `pine_1..4` | `e0cba4` `d6bd92` `dcc59c` `d0b788` | the round bar's boards |
| `bar_top` | `b59a6c` | the round bar's plank top |
| `ivory` | `f6ecd8` | linen tops, ivory cloth |
| `linen` | `f7f3e9` | linen skirts |
| `cream` | `ecd7ae` | the champagne garden rose |
| `white` | `fdfbf6` | white blooms |
| `paint_w` | `fcfbf7` | white painted counters, frames, plinths, carts |
| `chiffon` | `faf7f0` | the chair drapes, fabric streamers |
| `hydrangea` | `92b8de` | powder-blue hydrangea — the signature |
| `delph` | `7099c9` | delphinium, the deeper blue |
| `mist` | `bcd3ea` | palest blue |
| `sky` / `sky_d` | `a2c2e4` / `88add6` | the fabric flower |
| `leaf` / `leaf_d` | `94ae87` / `74906b` | pale sage foliage |
| `lilac_1..3` | `8f6fb5` `b391cc` `cbb4de` | the bar's lavender cluster |
| `pearl` | `f5efe2` | pearl strands |
| `crystal` | `e8f0f6` | crystal beads (gloss, faint blue emissive in game) |
| `stone` | `dfe4e8` | the welcome board |
| `flute` | `efe2d4` / `ece0d2` | fluted plinths |
| `straw` / `straw_d` | `dcbd90` / `d2b083`, band `352f28` | straw hats |
| `steel` | `9aa1a6` / `aab1b6` | galvanised wheelbarrow, tripods |
| `bronze_d` | `2e2a26` | chandelier poles, dark steel |
| `dark` | `33302b` | poles; `2b2a26` DJ booth |
| `gold` | `d8bd80` | favour boxes |
| `glass_pale` | `dfeef0` | frosted coupes, dispensers |
| `bulb` | warm white emissive | candle flames (`*_emit`) |
| `teal` | the clubhouse teal — read `moments.js` `teal` material | cocktail parasol canopies (tinted in game; model WHITE) |

## The assets

Columns: **name** · what it is · **dimensions / origin / front** · material notes · **TRIS ≤ / ATLAS / BEVEL** · owner.

### Group A — seating & tables (owner: agent A)

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `crossback_chair` | wooden cross-back (X-back) event chair, `decor-ceremony-main.jpg` / both dinner renders | 0.46 W × 0.44 D; seat slab top at **y 0.48** (0.05 thick, centre .455); front legs at z +.185, x ±.205, Ø .038; back stiles at z −.195 rising to **y 1.00**; top rail y .975 (.45 × .075 × .05); lower rail y .60 (.40 × .05 × .04); the X: two members .54 long × .045 × .032 crossing at y .788, z −.205, ±0.733 rad; side stretchers y .17. **Front faces glTF +Z (the seat's front edge), back at −Z** — the ONE exception, because `xbackChair()` already places it that way. Origin floor centre. | Real chair detail: slight leg taper, rounded top rail, the X halved at the crossing, a soft seat edge. `oak` with visible grain (`textures/gen/oak_light.webp` if present). | 1,800 / 256 / .003 |
| `chair_drape` | the white chiffon tie behind a ceremony chair | Same frame as the chair (front +Z). A knot at the top rail (y ~1.00, z −.27); a **fan** flaring up and out above the backrest to ~y 1.30, ~.50 wide; a **skirt** falling behind the seat from the same knot to ~y 0.30, ~.35 wide, with soft folds. Origin floor centre. | `chiffon`, cloth folds by displacement, opaque. Placed by the same matrix as its chair. | 1,200 / 256 / 0 |
| `round_table` | the dressed 1.8 m round, no chairs, no centrepiece | Top r .92, top surface at **y .81** (.06 thick); ivory linen skirt r .90 falling to the grass with soft pleats. Origin floor centre. | `ivory` top, `linen` skirt with a weave (`linen_ivory.webp`). | 2,500 / 512 / 0 |
| `long_table` | bare-timber long table, eight covers | **4.80 L (along X) × 1.02 W**, top surface **y .79** (.07 thick, centre .755); four legs .08² at x ±2.16, z ±.38. Origin floor centre. | `oak` planks with seams along X. The game rotates it for the 'z' axis. | 1,500 / 512 / .004 |
| `head_table` | the ivory-draped head table | 6.0 L (X) × 1.0 W, top surface y .81, draped to the ground (.96 deep skirt). Origin floor centre; front −Z. | `ivory` / `linen`. | 2,000 / 512 / 0 |
| `hightop` | linen cocktail high-top | Top r .42, top surface **y 1.105** (.05 thick, centre 1.08); skirt tapering r .42 → .38 to the ground, a tied sash at ~y .75. Origin floor centre. | `linen`. | 1,200 / 256 / 0 |
| `canape_table` | the cocktail's round draped canapé / raw-bar table | r .62, top surface y .80, draped to the ground; a couple of platters and a low posy on top. Origin floor centre. | `linen`, platters `paint_w`, posy blooms. | 3,000 / 512 / 0 |
| `lounge_sofa` | outdoor lounge sofa (after party, on the turf) | 2.2 W × .9 D; seat top y .45; back to y .80; low timber base. Origin floor centre; **front −Z**. | `ivory` cushions with a linen weave, `oak_d` base. | 2,500 / 512 / .004 |
| `buffet_run` | the rooftop brunch buffet | 7.0 L (X) × .9 W, top surface y .90, ivory linen to the floor; on top: 5 chafing dishes (steel, domed lids), 3 platters, a juice dispenser, a stack of plates. Origin floor centre; front −Z. | `linen`, `steel`, `paint_w`. | 6,000 / 1024 / 0 |
| `champagne_service` | the brunch champagne service | 1.6 L (X) × .8 W draped table, top y .90; two ice buckets with a bottle each, a tray of 12 flutes (frosted, opaque). Origin floor centre; front −Z. | `linen`, `steel`, `glass_pale`. | 4,000 / 512 / 0 |

### Group B — florals (owner: agent B) — uses `textures/gen/bloom_*.webp`, `foliage_sage.webp`, `hydrangea_head.webp`, `rose_head.webp`

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `installation_hero` | the taller of the two asymmetric floral towers at the head of the aisle | **h 3.30**; a TEARDROP profile — foot r ~.78 at y .26 drawn to a plume at the top (width ×.20 at the top); the crown drifts **+X by .62** over the height (x = .62·t²); a **skirt on the grass** r .92 × .78 (y ~.24); a **wing** of bloom spilling sideways toward **+X** at chest height — from x .55 → 1.50, y 1.55 → .80; 22 delphinium/eucalyptus sprigs breaking the silhouette. Origin base centre; front −Z. | Cream/ivory garden roses + powder-blue hydrangea over pale sage; ~45 % blue. Build bloom heads as low-poly displaced spheres (hydrangea: voronoi-dimpled; rose: spiral ridges) carrying the head textures; masses as packed clusters so the AO bake gives depth. Not a topiary, not a candle. | 45,000 / 1024 / 0 |
| `installation_small` | the second tower | **h 2.95**, width ×.82 of the hero, crown drifts **−X by .58**, wing toward **−X**. Otherwise as above. | | 40,000 / 1024 / 0 |
| `fabric_flower` | the pale-blue sculpted chiffon bloom hung between the towers | ~1.8 m across; inner ring 6 petals (.66–.88 long), outer ring 8 (1.02–1.24); a bloom-mass centre r .22; **two chiffon streamers** falling from the centre out to x ±1.5 and down 1.85 m. **Origin at the flower's centre** (the game hangs it at y 2.35). Front −Z. | `sky` / `sky_d` chiffon, opaque, soft folds. | 6,000 / 512 / 0 |
| `cluster_a` `cluster_b` `cluster_c` | the low blue-and-cream ground clusters (aisle lining, under the towers, beside every extra) | *unit* footprint **1.2 W × .56 H × .96 D** (the game scales .8–1.6 uniformly); three different silhouettes (one low and wide, one taller, one leaning). Origin base centre. | Blue hydrangea + cream/white roses + sage sprigs. | 6,000 each / 512 / 0 |
| `centrepiece_low` | the round-table centrepiece | r .32, h .32, blooms in a low ivory bowl. Origin base centre (sits on the table top). The two tapers + flames stay as game instances. | | 3,000 / 512 / 0 |
| `lilac_cluster` | the round bar's lavender/lilac + white base cluster | ~1.5 W × .60 H × 1.10 D with six white stock spikes to y ~1.0. Origin base centre. | `lilac_1..3`, `white`, `cream`, `leaf`. | 6,000 / 512 / 0 |

### Group C — ceremony structures & the dessert bar (owner: agent C)

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `arch_frame` | one slim white arch frame | Two posts Ø .096 (r .048) at **x ±1.12**, h **2.30**; a semicircular arch r 1.12 of the same tube on top → apex **y 3.42**. Spans X. Origin floor centre between the posts. | `paint_w`, satin. | 2,000 / 256 / 0 |
| `bead_chandelier` | the five-tier crystal/pearl bead shade inside each arch | **Origin = hook** (y 0). A drop rod Ø .028 × .60 down; a canopy disc r .25 × .035; then **5 tiers** on a cone: tier r .60 shrinking to ~.23, tiers .19 apart starting .16 below the canopy, 12–27 beads per tier; a finial strand of 9 beads down the axis. Total drop ~1.95 m. | beads = low-poly octahedra/icospheres, `crystal` (glossy) mixed with `pearl`. Material name `crystal` on the beads. | 12,000 / 512 / 0 |
| `candelabra` | the dinner's two-tier crystal candle chandelier (the pole stays procedural) | **Origin = hook**. Rod Ø .032 × .68 down; canopy disc r .13; a column Ø .05 × .72; tier 1 r .56 with 8 arms, tier 2 r .37 with 6 arms (.30 lower); each arm ends in a bobèche + a candle Ø .028 × .13 + a flame; a swag of 16 crystals at r .45 around the bottom. Total drop ~1.35 m. | arms/column `crystal`; flames material **`flame_emit`** → export as `candelabra_flames` via `build_flames()` (same origin) so they stay emissive. | 9,000 / 512 / 0 |
| `dessert_counter` | the 6 m white dessert bar counter | **6.0 W × .92 D × 1.04 H** + a top slab **6.24 × 1.06 × .07** (y 1.04 → 1.11). The front face (at z −.46) plain and flat — the game hangs "Fung & Cheng" there. Origin floor centre; front −Z. | `paint_w`, gentle panel lines on the sides only. | 1,500 / 512 / .006 |
| `parasol_tiered` | the white double-tiered parasol behind the counter | Pole Ø .045 h 2.60 at origin; lower canopy **r 1.95**, base y 2.19 → apex 2.49 (scalloped valance, 16 ribs); upper tier **r 1.16**, base 2.57 → apex 2.83; finial. **16 pearl strands** hang from the lower rim, 6–13 pearls each at .105 pitch, about half ending in a small bloom. Origin floor at the pole foot. | `paint_w`/ivory canvas, `pearl`, `oak` pole. | 9,000 / 512 / 0 |
| `drink_dispenser` | glass beverage dispenser with lemon water | Body r .155 × .34 tall on a small timber stand with a tap; lemon slices inside. Origin base centre. (The game places two, the second at scale .93.) | `glass_pale` opaque-frosted, `oak_d`. | 1,500 / 256 / 0 |
| `cupcake_stand` | white tiered cupcake stand | r .26, h .22, two tiers, 5 cupcakes (ivory/cream frosting, blue sprinkles). Origin base centre. | `paint_w`, `cream`. | 2,000 / 256 / 0 |
| `plinth_fluted` | fluted cylinder plinth | *unit*: r 0.5 × h 1.0, 24 flutes (the game scales, e.g. [.30, .96, .30]). Origin base centre. | `flute`. | 1,200 / 256 / .004 |
| `plinth_rect` | white rectangular plinth | *unit*: .30 × .30 × 1.0 (the game scales Y to 1.40–1.98). Origin base centre. | `paint_w`. | 200 / 256 / .006 |
| `wheelbarrow` | the galvanised favour barrow with its 15 gold boxes | Pan ~1.20 L × .74 W × .34 deep, rim at y ~.77; front wheel Ø .38 at **z −.78** (front = −Z); two handles 1.75 long rising toward +Z at x ±.30; two rear legs. **15 gold favour boxes** (.105 × .12 × .105, ivory ribbon) heaped in the pan. Origin floor centre under the pan. | `steel` galvanised (`galvanised.webp`), `gold` (`gold_foil.webp`), rubber tyre `dark`. | 6,000 / 512 / .003 |

### Group D — bar, cocktail, party & the −X extras (owner: agent D)

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `round_bar` | the round timber-plank cocktail bar drum + top (`decor-cocktail-bar.jpg`) | **30 vertical pine boards** .215 W × 1.04 H × .045 T on a **r 1.05** ring; a plank disc top r 1.16 × .025 at y 1.045 and the overhanging top **r 1.24 × .06 at y 1.10 → top surface y 1.13**, plank seams along X. Nothing on top (the game adds bottles, glasses, drinks). Origin floor centre. | `pine_1..4` per board with knots (`pine_planks.webp`), `bar_top`. | 4,000 / 1024 / .003 |
| `bottle_set` | the back-bar cluster that sits on the bar | 11 spirit bottles in a loose arc ~1.5 W × .45 D, heights .30–.41 + necks, coloured glass `3d5c3f` `8a5a28` `cdd6da` `7c3a2d` `33506e` `9c8144`, plain paper labels (no text); a steel shaker Ø .082 × .24 and two hawthorne strainers. Origin base centre (the game sets it on the top at y 1.13, z +.40). | opaque tinted glass, `steel`. | 5,000 / 512 / 0 |
| `menu_easel` | the white leaning menu easel | Board **.90 W × 1.26 H × .045**, centre at y .88, leaning back .16 rad; three oak legs Ø .04 × 1.24 (tripod, one behind). Board face **blank** (the game hangs its .78 × 1.10 menu plane 3 cm proud). Origin floor centre under the board; front −Z. Also used as the prewedding welcome easel. | `paint_w`, `oak` (`d6c09a`). | 1,200 / 256 / .003 |
| `parasol_round` + `parasol_round_canopy` | the cocktail's teal parasols (three) | Pole Ø .09 h 2.5; canopy **r 1.70**, base y 2.40 → apex 2.95, 12 ribs, scalloped valance, finial. Export the pole+ribs as `parasol_round` and the canopy as `parasol_round_canopy` (`build_canopy()`), **canopy albedo WHITE** with material name `canopy_tint` — the game tints it teal. Origin floor at the pole foot. | timber pole `oak_d`. | 2,500 total / 256 / 0 |
| `champagne_tower` | the prewedding champagne tower | Draped round table r .60, top y .78; a coupe pyramid 9 / 4 / 1 (coupe r .05 × .14, frosted, OPAQUE — this replaces a `transmission` material that made the whole campus render a third time). Origin floor centre. | `linen`, `glass_pale`. | 5,000 / 512 / 0 |
| `dj_booth` + `dj_booth_facia` | the after-party DJ booth | 2.4 W × .8 D × 1.1 H dark booth; a laptop, a controller and a small lamp on top. `build_facia()` → the **2.2 × .5 facia panel** on the front (−Z) face centred y .70, material **`facia_emit`** (ivory-white glow). Origin floor centre; front −Z. | `2b2a26` matte, `steel`. | 2,500 / 512 / .004 |
| `speaker` | PA speaker on a tripod | Cabinet .55 W × .45 D × .70 H on a steel tripod, cabinet top at ~y 1.6. Origin floor centre; front −Z. | `dark`, `steel`. | 1,500 / 256 / .003 |
| `mirror_ball` | the faceted mirror ball | Ø .90, faceted tiles; **origin at the ball's centre**; a short chain rising .35 above. Material name **`mirror`**. | | 2,500 / 256 / 0 |
| `hat_rack` | straw hats pegged on three lines between two posts (`decor-plinths-and-hats.jpg`, right) | Two `oak_d` posts .085² × 2.28 at **x ±1.75**; three lines (Ø .006, slight sag) at y 1.98 / 1.43 / .88; **5 hats per line**, each hanging with its centre .21 below the line at x = −1.75 + (i+.5)·.70, brim facing −Z (brim r .20 × .016, crown r .115 × .10, dark band); a fluted basket r .42 × .38 at (x 1.15, z .62) holding 4 stacked hats. Origin floor centre; front −Z. | `straw`/`straw_d` (`straw_weave.webp`), band `352f28`. | 9,000 / 512 / 0 |
| `coconut_rack` | the white arched shelving rack of young coconuts (`decor-beverage-coconut.jpg`, left) | 4 uprights Ø .026 at x ±.34, z ±.24, h 2.04; 4 shelves .74 × .54 × .035 at y .42 / .90 / 1.38 / 1.86; a semicircular arch r .36 on top; 2–3 green young coconuts (Ø .25, cut flat tops) per shelf. Origin floor centre; front −Z. | `paint_w`, coconuts `7e9a52` / `c4bf95`. | 4,000 / 512 / 0 |
| `beverage_cart` | the small white canopy cart of fruit (same render, right) | Table 1.56 × .78, top surface y .915 (.07 thick centre .88); four legs Ø .028; four canopy posts Ø .028 at x ±.74, z ±.34 rising to y 2.0; canopy **1.80 × 1.02 × .045 at y 2.02**, tilted .05 rad about Z, with a scalloped ivory fabric; on top: 13 assorted fruit (watermelon, oranges, bananas, blueberries, a pineapple), a steel bucket, two small flower vases. The front cloth is the game's — leave the front edge plain. Origin floor centre; front −Z. | `paint_w`, `steel`. | 6,000 / 512 / 0 |

### Group E — resort furniture (owner: agent E) — the RESORT, not the wedding

The follow-on wave to KAN-207. These eight replace unit primitives in
**`js/campus.js` and `js/water.js`**, not in `moments.js` — they are the things a
guest stands beside on the hotel roof and at the pools, and the Welcome Brunch
(moment index 0, the first chip on the bar) is the room they fix. **They
supersede three of the exclusions in "What is deliberately NOT in this wave"
below**: the `water.js` loungers, the rooftop four-tops and the bar-room dining
chairs are modelled here; the floating lanterns, the cabana pavilions and
everything else in that paragraph still stand.

Every dimension below is quoted with the **file:line it was read off**, because
these props were never specced — the numbers live only in `inst()` / `mat4()`
calls. ⚠ `campus.js`'s `UNIT_CYL` is `CylinderGeometry(.5,.5,1,12)` and
`UNIT_CONE` is `ConeGeometry(.5,1,10)`, so a `mat4` scale on either is a
**DIAMETER**, not a radius (`1.35` is a 0.675 m top). Dims are quoted in the
GAME's frame (glTF Y-up, y = height).

**Where the code's envelope and a reference photo disagreed, the ENVELOPE
follows the code** — so no collider, spawn or placement moves — **and the DETAIL
follows the photo.** Each such case is named in its row and in the generator's
docstring.

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `sun_lounger` | resort sun lounger: slatted timber frame on four legs, raked slatted back, ivory linen squab, a rolled towel at the head | **0.82 W × 2.05 D** (long axis on Z); frame rails top / squab underside **y .335**, squab .13 thick → **.465**; the raked back springs at **z +.56** and reaches **y .845 at z +1.02** (~40° off vertical); legs 0…**.23**, set .22 m in from each end. Origin floor centre; **front −Z = the FEET**, so the head/backrest is at **+Z**. From `campus.js:4056-4059` (`loungerRow`): base `.82×.34×2.05` at y .17, cushion `.74×.13×1.9` at y .40, back `.82×.62×.13` at radial +.92 / y .58 / rx .5 → its face runs y .308→.852, radial .771→1.069; collider r .85 (`campus.js:4910`). ⚠ `water.js:1541` `makeLounger` is the SAME object at **.66 × 1.92 with its head at −Z** — those placements need **ry + π**, and they carry no collider at all (`water.js:1582` says so), so the 0.16 m wider envelope is free there. | Photo, not code, for the finish: `rooftop-pool-bar-daylight.webp` + `hotel-rooftop-pool-day-night.png` put **timber** frames with white cushions on this roof; the primitive is `MAT.white` throughout. `oak` grain (`oak_light.webp`, the crossback gain), `ivory` linen (`linen_ivory.webp`). | 2,500 / 512 / per-part |
| `daybed` | four-poster cabana daybed: timber deck platform, slatted base, deep mattress, back bolster + two throw cushions, four posts, a white canopy on a timber trim frame, **tied-back curtains** | **3.30 W × 2.80 D × 2.78 H.** deck platform `3.30×2.80×.22` (y 0…**.22**); base y .21…**.55**; mattress `2.72×2.16×.26` → **y .49….75**; bolster `2.60×.30×.44` at **z +.92**, y .62…1.06; two cushions `.46×.18×.30` at **z +.62, x ±.62**, y .86; four posts `.11²` at **x ±1.44, z ±1.18**, y .22…**2.62**; canopy `3.22×2.70×.20` at **y 2.58…2.78**, timber trim at y 2.515…2.585; curtains y **.27…2.55**. Origin floor centre; **front −Z** (the open side, at the pool); the bolster/back is at **+Z** (inland). All from `campus.js:4118-4149`; `roofColliders()` (`campus.js:4891`) rings it as two r 1.05 circles at tangential ±.9, inside the 3.30 m platform. | ⚠ **Photo beats code on the curtains.** `hotel-rooftop-pool-day-night.png` — the spec's "what makes the roof read at distance" — has them **tied back against the posts** as gathered white columns with the back corners half drawn, not four flat slabs. Modelled that way **in the code's own planes** (x ±1.40 for the ends, z +1.14 × x ±.84 for the back drapes), so the silhouette is unchanged. The tray table, the planted pot, the hedge blob and the warm lamp strip the same loop draws are NOT in this GLB. `oak` / `ivory` / `chiffon` (`chiffon_white.webp`). `AO_DIST .30` — a canopy over a mattress is half-enclosed. | 4,000 / 512 / per-part |
| `pool_umbrella` + `pool_umbrella_canopy` | resort parasol: weighted base, tapered pole, ferrule, hub, 8 ribs, finial — and the canopy as its own GLB | Pole **Ø .10 × 2.50** on a **Ø .76 × .10** base; canopy **r 1.55, rim y 2.20**, 8 ribs, a .105 valance with two scallops per panel. Origin **floor at the pole foot for BOTH halves** (as `parasol_round`). From `water.js:1558-1574` (`makeUmbrella`: mast `.045/.055 × 2.5`, cone `1.55 × .42` at y 2.40, rim ring at 2.20, base `.34/.38 × .1`) and `water.js:3302-3313` (pole `.05/.06 × 2.5`; **blue cone `1.55 × .44` rim 2.20**; white cone `1.70 × .48` rim 2.20 — the white ones are this parasol **scaled ×1.10**). | Export the canopy via `build_canopy()` → `pool_umbrella_canopy`, sole key **`canopy_tint`, PURE WHITE** — the game multiplies its own colour in (lagoon blue `2b7fc4`, clubhouse teal `2e9fae`, beach `whiteFrame`). ⚠ **One deliberate deviation: the apex is 2.76, not the cone's 2.64.** At the code's .44 m rise over r 1.55 the canopy read as a flat plate in the in-engine shot; .56 (19.9°, a real market parasol's pitch) fixes it, and the **rim — the dimension a guest's head clears — is unchanged at 2.20**. Pole `steel_l` baked dielectric, base `stone`. | 1,500 + 800 / 256 / 0 |
| `roof_parasol` + `roof_parasol_canopy` | **KAN-208 wave 1.** the hotel roof's teal market parasol: flat weighted plate, two-stage pole with a sleeve, a runner with 8 stretchers, hub, 8 ribs (tip caps tucked inside the valance), finial — and the canopy as its own GLB | **Canopy r 1.75, rim y 2.32, apex 3.12, valance .12** (lowest point 2.125 between ribs); pole **Ø .11** foot → Ø .08 above the sleeve at y 1.62, runner at 2.02; base **Ø .46 × .045**. Origin **floor at the pole foot for BOTH halves**; front −Z (radially symmetric). From `campus.js:4247` (the lounger row, was `UNIT_CYL .11 × 2.5` at y 1.25 + `UNIT_CONE 3.5 × .8` at y 2.72 — diameters) at scale 1, `ry = pth`. **The brunch four-tops (`campus.js:4454`, was pole `.09 × 2.7` + cone `3.0 × .7` at y 2.86 → r 1.50, rim 2.51) place the SAME parasol at scale `(1.5/1.75, 2.51/2.32, 1.5/1.75)`** — rim exact, apex 3.38 not 3.21, pole Ø .094; three's instancing normalises the non-uniform scale for normals. The scaled base (Ø .39 × .049) hides inside `four_top`'s Ø .62 × .055 disc foot; the pole rises through the pedestal and the top. No collider (the cones had none). | Why not `pool_umbrella`: r 1.55 / rim 2.20 / a Ø .76 base that would clash with the four-top's foot. Detail from `hotel-beach-bar-dawn.webp` (the resort's own market parasols); pole `bronze_d` (the cone's `MAT.dark`, not the photo's timber). **Canopy sole key `canopy_tint`, PURE WHITE**; campus.js clones its material ONCE (`roofCanopyMat()`, `campus.js:1470`), colours it `MAT.umbrella`'s day teal and puts the clone on the night-tint registry with the cone's own multiplier `0x76839a` — same program as the bake, so the count stays 116. Buckets `rtParasolGlbI` / `rtParasolCanopyGlbI`. | 1,500 (1,030 + 768) / 256 / 0 |
| `four_top` | the rooftop brunch round table, **BARE** — no linen, no settings | Top **Ø 1.35 × .07, top face y .785**; pedestal **Ø .14**, y 0….72; a **Ø .62 × .055** disc foot (added — the primitive has none). Origin floor centre; front −Z (radially symmetric). From `campus.js:4215-4218`, iterating `HOTEL_ROOF.brunchTables`; `roofColliders()` rings it at `TABLE_R` **0.95** (`campus.js:4937`). ⚠ `moments.js:1566+` dresses it for the Welcome Brunch with a linen skirt **r .68→.72 hemmed at y .01** and a cloth top disc r .72 at y .755…**.805** — so the timber top must stay at .785 (the cloth sits 2 cm proud) and **nothing may exceed r .68 below y .75** or the skirt clips it. Bare in the other five moments. | Warm timber top (`bar_top`) with a lathe-profile chamfer, `dark` column and foot — `rooftop-bar-dusk.png`. 900 tris is why the chamfers are profile steps, not bevels. | 900 / 256 / 0 |
| `dining_chair_rattan` | the bar room's dining chair: timber frame, curved top rail, woven rattan back panel, white box cushion | **0.46 lateral × 0.48 deep**; legs 0…**.44**; seat frame `.48 deep × .46` at **y .435….49**; cushion `.44×.42` at **y .49….58**; back uprights to **y 1.025**; top rail y 1.015…**1.075**; woven panel .035 thick × .30 wide at **y .565….965**, .075 m proud of the frame. Origin floor centre; **front +Z** (the chair-family exception) — modelled facing Blender −Y, which is how the arrival's `chair()` authors it (`campus.js:2828-2836`). ⚠ **`campus.js:4449-4463` `diningChair()` authors its BACK at local +X**, so a GLB drop-in at the rooftop four-tops / long tables needs **ry = ca − π/2**. | Photo for detail (`rooftop-bar-dusk.png`, foreground): the rear legs and the uprights are **one unbroken stile**, the top rail **curves** to wrap the sitter (28 mm of bow at the ends) and the back is a real woven field — `straw_weave.webp` on the panel plus five raised weave rods, not a painted slab. `oak` grain, `straw` rattan (gain .60/.50/.40), `ivory` linen cushion.  ⚠ **KAN-208 wave 1: ALSO the brunch four-tops' chairs** (`campus.js:4438`, bucket `rtBrunchChairGlbI`, 32 chairs, was two white boxes each) — same seat point 1.05 m out, same `ry = ca − π/2`. A deliberate look decision: one chair across the whole roof. Its back is **1.07 m against the boxes' 0.87**, so `moments.js:1606` recuts the brunch slipcover to it: `.50 × .50 × .10` at radial 1.27, y .60…1.10 (clear of the cushion top .58), yaw `ca − π/2`; the sash `.52 × .08 × .12` at y .72. The old slip AND the box back both had yaw `ca`, which lays a box's long x-side along the RADIUS — they were radial fins. Footprint .46 × .50 still stops at r 1.30 = TABLE_R + PLAYER_R: colliders unchanged. | 1,800 / 512 / per-part |
| `bar_stool` | counter stool: weighted foot, dark column, **timber footrail on four spokes**, timber seat band, white cushion | **Ø .46 max, y 0….82.** foot disc **Ø .44 × .05**; column **Ø .11**, y .05….67; footrail ring **Ø .34** at y .26; seat band **Ø .46** y .67….73; cushion **Ø .42** y .73…**.82**. Origin floor centre; front −Z (radially symmetric). From `campus.js:4361-4365`, one per counter bay at r 97.80. ⚠ **THE Ø .46 IS LOAD-BEARING**: `roofColliders()` (`campus.js:4952`) says the stool line reaches **r 97.59** and the counter arc is authored stricter than that — nothing may exceed r .23 from the axis. | ⚠ **Code vs photo, and the code wins here.** `rooftop-pool-bar-daylight.webp` puts timber-framed **armchairs** at this counter, not pedestal stools; a ~0.6 m armchair does not fit the 0.46 m envelope the collider was measured against. So: the code's pedestal, the photo's finish. Footrail + seat band are **timber** because the primitive uses `MAT.slat` for both; `bronze_d` foot and column, `ivory` cushion. | 1,200 / 256 / 0 |
| `kayak` | sit-on-top kayak: white lofted hull, blue moulded deck, a dished seat well with a proud coaming, a forward hatch, carry toggles, the paddle across the deck | **3.00 L (Z) × 0.78 beam × .63 H**, paddle span 2.05 on X. **Origin "floor" = the KEEL**, so the deck crown is **.52** above it and **the WATER LINE is y +0.24** — a drop-in sits at **`WATER_Y − 0.24`**. Seat well `.53 × 1.02` centred **.18 aft** of midships. **Front +Z = the BOW** — `buildKayak` (`water.js:3080-3130`) yaws the hull so its local +Z runs down the channel. From that function + `site.js:1138` `KAYAK: {len: 3.0, beam: .78}`: hull sphere scaled `(.39, .30, 1.50)` at y +.06 (keel .24 below the water line), blue top cap, cockpit `(.265, 1, .51)` at y .21, paddle `2.05 × .045` at y .42 with blades at ±.92. No collider, so the paddle's span costs nothing. | Floor origin rather than a waterline origin because `preview_all.py` and `tools/viewer.html` stand a model on the ground disc. ⚠ **Two things the in-engine shot caught:** the seat well sunk to the hull's own deck line was **buried under the blue deck** (the kayak read as a surfboard) — the coaming now stands .03 proud; and a square full-depth bow station read as a **flat plank**, so the stem is raked over two extra stations. Blue is `bottle_blue`, not `delph` — `delph` rendered near-white under the venue rig. The **paddler stays a game object**. | 2,000 / 256 / 0 |

### Group F — the pool (owner: agent F)

The third wave. Seven props at the water: the two floating lanterns on the hero
pool, the underwater light fitting in its walls, and the four things Carl called
"very low fi" on the resort side — the lagoon's swim-up bar and its submerged
stool, the cabana pod's daybed, and the beach pool's island bar. They replace
primitives in **`js/water.js` and `js/campus.js`**, so, as in Group E, every
dimension is quoted with the **file:line it was read off** and **the envelope
follows the code while the finish follows the photo**; each deviation is named in
its row and argued in its generator's docstring.

⚠ Group E's two preamble rules still bite: `campus.js`'s `UNIT_CYL` /
`UNIT_CONE` scales are **DIAMETERS**, and dims are quoted in the GAME's frame
(glTF Y-up, y = height).

#### ⚠ THE GEOMETRY-ONLY RULE — `pool_lantern` and `pool_lantern_lotus`

Those two set **`BAKE = False`** and ship **no atlas at all**. They are the only
assets in the project that do.

The floating lanterns are the signature night shot — Carl's prewedding, lanterns
burning on the water — and their "lit from within" read is a **three-material
stack `water.js` owns** (js/water.js:1719-1743): an emissive paper shell at
opacity .88 that still **depth-writes** (the water sheet is transparent at
renderOrder 3 and would paint straight over a lantern that did not), an **opaque
hot core** inside it drawn in the opaque pass, and a slightly larger **BackSide
additive rim** whose far hemisphere depth-fails so only a glowing edge survives.
One baked albedo×AO atlas cannot reproduce that — it would flatten the lantern
into a painted ball with its own shadows burnt in. So the game takes
`models.geometry(name)` and pairs it with that stack, and:

- `make_masters.py` skips `prepare_for_export` entirely when a generator sets
  `BAKE = False`, so **the generator owns its own UVs**;
- the shell carries a clean **cylindrical UV0** written to the `UVMap` layer
  (`L.cylindrical_uv(root, layer="UVMap", axis=2, repeat=1.0)`): u = 0..1 once
  around with the seam at the BACK (−Y), v = 0..1 foot to crown, because the game
  maps its own seamless `paperTex()` onto it. That is exactly what the atlas
  smart-unwrap would have destroyed;
- `export_all.py` still asserts ONE mesh and ONE material, so the whole lantern
  is built in a single palette key (`label`, plain paper). The key only has to
  keep the export happy — the game replaces the material;
- the envelope is held to the millimetre, because `water.js` positions the shell
  at `hy = R × 1.10` above the waterline and sizes the halo, the pool-glow disc
  and the reflection streak off `R` (`haloGeo` R×5.6, `poolGeo` R×6.6,
  `streakGeo` R×1.5 × R×4.4). Grow the shell and the glow ends up inside it.

Verification for these two is the in-engine NIGHT shot
(`NIGHT=1 node tools/shoot-models.mjs`), never a Workbench turntable.

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `pool_lantern` | the big floating paper globe — Carl's "pool balloon": 12 vertical ribs with the paper bulging between them, a top collar, a bottom hoop | **1.400 × 1.400 × 1.204.** The shell is horizontal radius **R = .70** (`TUNE.LANTERN_R`, `water.js:101`) and vertical half-extent **.602** (= R × .86, the primitive's `shell.scale.set(1, .86, 1)`), and the model's whole extent IS the shell's — so **the shell centre is at size.y / 2 = .602 above the foot**, exactly. Origin **floor**; front −Z (radially symmetric; the UV seam is at the back). From `buildLanterns` (`water.js:1710-1863`): `globeGeo = SphereGeometry(R, 24, 16)` at `hy = R × 1.10` (`water.js:1769-1776`). **A drop-in sits at `y = P.waterY + hy − .602 = P.waterY + R × .24 = P.waterY + .168`**, and the game keeps `hy` for the core, the rim and the halo. | ⚠ **GEOMETRY ONLY — `BAKE = False`, atlas: none.** See the rule above. Single key `label`; cylindrical UV0. **Deviations, both argued in the docstring:** the three HORIZONTAL torus ribs (`ribGeo`, `water.js:1755`) are gone — they are hoops, and hoops do not bulge paper; the radius is pinched on each rib meridian with a narrow proud spine on the rib line, a ~45° crease `shade_smooth(35°)` keeps sharp. **The dark float ring (`baseGeo`, `water.js:1758`) is NOT in this GLB** and must stay a game object — it is `baseMat`, and a single-material GLB renders it as glowing paper. | 1,800 / — / 0 |
| `pool_lantern_lotus` | the lotus-form floating lantern: three whorls of keeled, cupped petals opening from a receptacle, on a domed lily pad over a floating ring | **1.736 × 1.736 × 0.820.** Pad radius **R × 1.24 = .868** (the widest element, `CircleGeometry(R*1.24, 20)`, `water.js:1795`); float ring **major R × .81 = .567, minor R × .17 = .119** (`baseGeo`, `water.js:1758`); petal tips reach radius .700 and the tallest .820 — the primitive's 8 `ConeGeometry(R*.37, R*1.24, 5)` tips solve to radius .704 / y .7425 and its core top to .819. Origin **floor = THE WATERLINE**; front −Z. **A drop-in sits at `y = P.waterY` exactly.** The game's hot core (`SphereGeometry(R*.46 = .322)` at `y = R*.71 = .497`, `water.js:1757`) sits at the flower's heart and the whorls open around it. | ⚠ **GEOMETRY ONLY — `BAKE = False`, atlas: none.** Single key `label`; cylindrical UV0. **Declared deviations:** the float ring's lowest point IS the model's foot, so the flower rides **35 mm higher** than the primitive (which sank the ring 35 mm) — invisible on a lantern bobbing ±35 mm/s (`tickLanterns`, `water.js:1880`) and it makes the drop-in `waterY` rather than `waterY − .035`. Eight five-sided cones are a crown of spikes, so 22 petals in three offset whorls; the flat `CircleGeometry` pad gains a dished section and a lifted rim (it vanishes edge-on from a guest's eye height) and its crown clears the float ring's top — a pad under the ring read as a bundt tin in the first turntable. | 2,200 / — / 0 |
| `pool_light` | the underwater light FITTING in the hero pool's long walls: a stainless flange, a stepped bezel and the dished white throat behind them | **0.486 × 0.482 × 0.117** (Ø flange × depth). The lens it frames is `CircleGeometry(.17, 18)` (`water.js:1036`) at `(x, P.waterY − .62, side × (hd − .02))` for x ∈ −8.4 / −2.8 / 2.8 / 8.4 on both long walls (`water.js:1055-1058`), `hd` = 12.5 from `SITE.POOL` w 10 × d 25 (`site.js:253-263`); the walls stand at ∓(hd − .01) (`water.js:900-903`), so the lens is 10 mm proud. Origin **floor in height, but THE LENS PLANE in depth** — x centred, glTF z 0 at the lens plane (the bezel stands `−min[2]` = 27 mm proud of it), foot at the lowest vertex. The flange is circular, so the lens AXIS is exactly `size.y / 2` above the foot: **`position = (x, P.waterY − .62 − size.y/2, side × (hd − .02))`**. | ⚠ **THE GLOWING DISC STAYS THE GAME'S** — `discMat` is night-driven (`water.js:1039`) with a `haloMat` corona and a 6.4 × 4.6 additive quad in the water volume. This is the housing only. ⚠ **ROTATION IS THE INVERSE OF THE DISC'S**: a `CircleGeometry` faces its own +Z so the disc uses `side < 0 ? 0 : π`; this asset's front faces −Z, so it needs **`ry = side < 0 ? Math.PI : 0`**. Backwards buries the bezel in the wall and nothing throws. `steel_l` flange + `paint_w` reflector throat; metal is a real metal key now (`bake_atlas` mutes Metallic for the diffuse pass). `AO_DIST .30` — 0.15 over a 90 mm throat crushed the whole flange to black in the night shot. | 800 / 256 / 0 |
| `swim_up_bar` | the lagoon swim-up bar: the boarded counter with its stone cap, the back-bar case of bottle shelving in bays, and the flat slatted canopy on four posts | **8.400 × 4.800 × 3.085**, origin **floor centre = `FLOOR` .16, the bar's own service floor**; **front −Z = THE WATER**. All from `buildSwimUpBar` (`campus.js:5644-5760`), whose (u, v) frame is u along the bank and **v OUTWARD (landward)**, so **Blender y = −v**. counter `CT_U` 6.6 × `CT_D` .9 at `CT_V` −.1, y .16…1.06 (`campus.js:5709`) + cap 6.82 × 1.12 × .08 to `TOP` 1.14 (`:5711`); back-bar `SH_U` 6.2 at `SH_V` 1.7 to `SH_TOP` 2.35, back panel at v 1.81…1.91, end stiles .18 × .42 at u ±3.01, 5 shelves 5.9 × .05 × .4 at y .44/.86/1.28/1.70/2.12 (`:5721-5731`); canopy `CN_U` 8.4 over v −1.9…2.9, `CANO` 3.0, 4 posts .19² at u ±3.55 / v −.15 and 2.55, edge beams to 3.18, 30 slats to 3.245 (`:5744-5762`). **A drop-in sits at `y = FLOOR` on `wx(0, (CN_V0+CN_V1)/2), wz(…)` with the function's own `ry`.** ⚠ **the four posts carry r .28 colliders (`campus.js:5751`) and may NOT move.** | **Not in the GLB, each for a reason:** the plinth and the stepped apron (they are ground and carry the `rectCollider`); the **"POOL BAR" lettering**, a game plane hung 12 mm proud at u −.4, y .82 (`:5713-5718`) — the front is modelled FLAT AND PLAIN behind it; the **bottles** (`:5758-5773`, per-instance tints on `MAT.bottle` from a weighted glass table, one draw call — a bake would lose the tint stream for ~2,000 tris); the **lit shelf reveals** (`MAT.inLight`, `:5732`, emissive) — the back panel's front face is held at v 1.81 so they stand 15 mm proud of plain timber; the bowl planter and the stone apron. ⚠ **The counter's boards are REVEALS, not proud staves** — the rooftop counter's fluting stands 60 mm proud (`campus.js:5481`) and 60 mm through a sign plane that clears the face by 12 mm is the GLB-easel bug again. ⚠ **Slats are 85 mm deep, not the code's 140**: at the code's own 145 mm pitch a 140 mm slat leaves a 5 mm gap, i.e. a solid black plate — the photograph is a canopy you see sky through. Count, pitch, span and top plane unchanged. Finish from `resort-swim-up-bar.webp`: `pine_planks` gained UP for the bleached canopy, `oak_light` gained hard DOWN for the mahogany case, `paint_w` + `stone` for the counter. | 6,000 / 1024 / 0 |
| `swim_stool` | the submerged stool at that bar: a flared foot, a waisted column and a dished seat, one turned pedestal | **0.500 × 0.500 × 0.745**, origin **floor = THE BASIN FLOOR**; front −Z (radially symmetric). From `campus.js:5763-5771`, five at u = (i/4 − .5) × 5.0 and v = `PL_V0` − .55 = −1.45: **Ø .50 × .09 seat with its top at y −.305** on a **Ø .17** column, with `R.DEPTH` 1.05 and `BASIN_Y` .045 (`site.js:797, 806`) — so the seat is .35 m under water and the floor is at y −1.05. **A drop-in sits at `y = −R.DEPTH`.** | ⚠ **One thing the code has wrong, fixed here**: the primitive's column runs −1.25…−0.55 and its seat −.395…−.305, so **155 mm of open water floats the seat**, and 200 mm of column is buried below the basin floor. This is one continuous pedestal from floor to seat. The Ø .50 seat, its .09 thickness and its −.305 top are unchanged, and the stools carry no collider of their own (`campus.js:5627-5637`). Single key `paint_w` — the plastered white `MAT.white` reads as under water. | 700 / 256 / 0 |
| `cabana_daybed` | the white cushioned daybed inside the lagoon islet's woven-rattan pods: a dark woven plinth, a deep bowed mattress, two flank bolsters and a low back bolster | **1.877 × 1.509 × 0.668**, origin **floor = the pod deck's top face, y `deckY` = .42**; **front −Z = the open side, at the water**. From the `'pod'` branch (`water.js:2996-3002`) with `I.cab` 2.6 and `deckY = topY` .42 (`site.js:1294-1303`): bed `I.cab×.72` 1.872 W × `I.cab×.58` 1.508 D × .34 at `deckY + .26` (its underside .09 CLEAR of the deck — the primitive's bed floats), pillows .52 × .34 × .18 at x ±.468, z −.468, top .61 off the deck. **A drop-in sits at `y = deckY`.** ⚠ **AND NEEDS `ry = yaw + Math.PI`** — the pod is authored with **local +Z OUTWARD, at the water** (`yaw = π/2 − th`, `water.js:2963-2966`) and the dome's missing wedge is centred on that same +Z (`:3043-3046`), while this asset's front faces −Z. `ry = yaw` seats the bed backwards inside a dome that opens the other way, silently. | ⚠ **THE DOME IS ARCHITECTURE AND STAYS THE GAME'S** (one instanced `SphereGeometry` on a night-tinted rattan material, `water.js:3043-3060`); so does the deck slab under it. ⚠ **Photo beats code on FORM.** `resort-pool-cabana-view.webp` is shot from INSIDE one of these pods: the mattress is one deep slab with a strongly **bowed front edge** following the dome's circular plan (194 mm at the centre-line, corners still at the primitive's ±.936) and the cushions are two big soft **flank** bolsters against the woven walls, not flat pillows lying on the bed. The primitive's 90 mm of air under the bed becomes a real low frame. `linen_ivory` on `ivory`; `straw_weave` tinted DARK for the plinth, so the base belongs to the dome. `AO_DIST .30`. | 3,000 / 512 / 0 |
| `island_bar` | the beach pool's round island bar: a thatched cone roof on four posts and a ring beam, over a staved timber counter, on its sand terrace | **11.700 × 11.700 × 5.450** (KAN-208: + the 0.40 topknot above the 5.05 apex), origin floor centre; front −Z (radially symmetric). From `water.js:2829-2857` with `BA = SITE.RIVER.BAR {cx −57.5, cz −0.5, r 5.6, h 3.4}` (`site.js:907`): terrace Ø 11.20 top / 11.70 ground × .42; counter `BA.r×.58` = Ø 6.496, y .42…**1.52** (the working surface); roof `ConeGeometry(BA.r×.95 = 5.32, 1.5, 14)` → **eaves y 3.05**, apex 4.55; soffit `CircleGeometry(BA.r×.9 = 5.04)` at 3.08; 4 posts .14² at radius `BA.r×.78` = 4.368, θ = i/4·TAU + .4; **collider one circle at r 5.90**. **A drop-in sits at y = 0 on (BA.cx, BA.cz).** | ⚠ **THE SOFFIT STAYS THE GAME'S — it is the river's ONE warm light at night** (`soffitM.emissiveIntensity = on ? 1.6 : 0`, `water.js:2851`), and a baked atlas cannot be emissive. So the thatch closes at the eaves with an **annulus down to r 4.90**, never a disc: the game's 5.04 m disc covers the hole from below with 140 mm to spare. **Three declared deviations:** (0) **apex 5.05, not 4.55** — 1.5 m of rise over a 5.32 m eaves radius is a 15.7° cone and read as a mushroom cap; 2.0 m is 20.6°, a real palapa. **The EAVES is unchanged at 3.05**, so head clearance, the soffit and the r 5.90 collider are all where they were. (1) **the posts stop at the eaves**, not at 3.50 — at radius 4.368 the cone's own surface is y 3.318, so all four primitive posts spear 180 mm through the thatch; they carry no collider. (2) **post bearings mirrored** (Blender +Y → glTF −Z, so world θ is Blender −θ). The counter is STAVED, not a smooth drum. `straw_weave` gained hard down for weathered thatch, `oak_light` gained down for dark timber, `cream` for the sand (`flute` rendered as a white dinner plate under the 2.1 sun). ⚠ **KAN-208 wave 1 — THE THATCH, re-done** (it read as timber shingles): `thatch_palm.webp` (art_manifest `palm_thatch`, Vertex Gemini 3 Pro Image, a real alang-alang palapa surface, strands down the image) replaces `straw_weave` (a hat braid); a **slant UV** (u = 22 repeats round the bearing so strands converge on the crown, v = −slant distance / 1.55 m) replaces the planar top-down projection; **5 shaggy courses × 56 bearings** whose lips flare .10–.20 m and hang in **ragged, uneven fringe tips** (.10–.34 m, alternating short/long) replace 5 machined frusta; a bound **topknot** (thatch, to 5.45) sits on the apex. Eaves line, annulus to r 4.90, soffit, posts, collider: unchanged. `ATLAS 2048` + `UV_WEIGHT {"cream": 0.30}` (a new generator knob, `wv_bake._weight_islands`) so the photograph gets the texels the flat sand terrace used to take. 3,702 tris, 288 KB (was 2,604 / 60 KB). | 4,000 / 2048 / 0 |

**Result, measured by `export_all.py`:** 10,268 triangles and 189 KB over the
seven; 57 assets in `models.json`. Nothing over budget; every GLB one mesh / one
primitive / one material; zero console errors in the in-engine shots.

### Group G — the interiors (owner: agent G)

The fourth wave. Eight props inside the **rooms**, not on the lawn: seven in
`js/suite.js` and one in `js/campus.js`. Seven of the eight are in the
presidential suite, which is the building the opening drone dive LANDS in and
where the Prewedding moment happens — the two most-seen interiors in the venue,
and every stick of furniture in them is an axis-aligned box out of `slab()`.
As in Groups E and F, every dimension is quoted with the **file:line it was read
off**, **the envelope follows the code and the finish follows the photo**, and
each deviation is named in its row and argued in its generator's docstring.

⚠ **`js/suite.js` IS MIRRORED — read its §1a (lines 26-62) before reading any X
in this section.** The file authors in the reversed frame of
`reference/suite-interior-brief.md` §4 and reflects every X on the way out
through `mx(x) => -x`, which also negates every `rotation.y`. **Nothing in Group
G compensates for that**: each piece is modelled normally and the call site keeps
applying `mx()`. It is harmless on the SHAPE of all eight — each is symmetric
about its own X centre plane, so reflecting the centre is a true reflection —
and harmless on the YAW of seven of them, whose only yaws (0 and π) are their
own negatives. **The eighth is not.** `modular_sofa_2f`'s arc yaw arrives as
`-a`, and the rule this file gave for it was measured wrong: see the ⚠
INTEGRATION CORRECTION in its row. Verified in the integration pass
(2026-09-20) — every other Group G placement came out at ry 0 or ±π and
nothing reads backwards in the engine.

This wave **supersedes one more of the exclusions in "What is deliberately NOT
in this wave" below** — the check-in lobby's furniture; the rooftop four-tops and
the bar-room dining chairs went in Group E, and everything else in that paragraph
still stands.

⚠ **AO IS A SKY TERM AND THESE ARE INTERIORS.** The outdoor `AO_DIST 0.5` bakes
an enclosed piece black. Group G uses **0.30 for upholstery** and **0.15 for a
real enclosed underside** (the two espresso tables, the massage bed).

⚠ **`metric_uv` is a PLANAR projection, so pick the axis pair the VISIBLE face
varies in.** A horizontal face given (x, z) samples one texture row and bakes as
streaks. Twice in this wave that decided a material: the sofa island's deck band
(its top is under a cushion, so it takes (x, z) not (x, y)), and
`modular_sofa_2f`, which is the one Group G asset on a FLAT palette key —
a lofted annulus sector has a dead-flat seat top that no single planar
projection can carry, and `wv_bake`'s `linen` family finish is procedural
(noise/wave on generated coordinates), so it needs no UV and cannot streak.

⚠ **Three of suite.js's `MT.*` colours have no palette key**, and each is solved
in `generators/_interior.py` as a per-channel gain on a generated texture:
`MT.espresso`/`espressoPlain` #2b1d16 → `dark` × ESPRESSO_GAIN (lifted ~45 %,
because the true albedo came back as a black slab once AO multiplied in),
`MT.navy` #23364a → `bottle_blue` × NAVY_GAIN, `MT.brass` #8a6b3f → `oak` ×
BRASS_GAIN. Every part carrying one of those MUST get a `metric_uv` /
`cylindrical_uv` — `wv_bake._check_art_uvs` is per-MESH, so it passes as long as
*some* part has a real art UV and will not catch a single part you forgot.

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `suite_sofa` | ONE MODULE of the great room's back-to-back chaise island: a deep ivory seat each side of a shared low back | **1.000 W × 2.500 D × 0.740 H**; the game repeats it **three times** at x = sx − 1, sx, sx + 1. Origin floor centre = **the espresso plinth's TOP FACE** (the bbox is symmetric, so it is exact); **front −Z = the TV-facing chaise**, the 1.00 m-deep seat, which is the game's own −z side. **A drop-in sits at `(sx, 0.32, sz − 0.70)` with `ry = 0`.** From `buildGreatRoom` (`suite.js:909-931`), `sx = LIVING_X`, `sz = −21.2`: plinth sx ±3.00 y 0….32 sz ±2.00 (`:918`), backrest sx ±1.50 y .32…1.06 sz −.95…−.50 (`:921`), TV seat y .32….70 sz −1.95…−.95 (`:924`), pool seat y .32….70 sz −.50…+.55 (`:923`), arms x ax ±.18 at ax = sx ±1.50 y .32….82 over the full 2.50 (`:926-928`). ⚠ the call site applies `mx()`; the module is X-symmetric so that is a no-op, and `ry = 0` is its own negative. | ⚠ **NOT in the GLB:** the **plinth** and its cap (they are the ground, and `colRect(LIVING_X ±2.85, −23.05…−19.35, r .22)` at `suite.js:1598` is measured on them); the two **arm blocks** (they are the island's ENDS — a repeating module cannot carry one); and the **~12 teal pillows** (`:930-937`), which alternate `MT.teal`/`MT.tealDeep` by index and carry their own rotation, i.e. a per-instance tint stream one baked atlas cannot reproduce. **Deviations:** the back cushion above the seat line is .47 deep against .45 so it overhangs its own base by 10 mm a side and reads as a cushion (the seat cushions stop 20 mm clear, so 2.50 m of depth is unchanged); the seat is a fixed deck 0….16 with a loose cushion .15….385 rather than one .38 slab — same top face, and the seam is why a 1 m module reads as a module. Finish: `ivory` under `linen_ivory.webp`. ⚠ `IMG_8096.jpg` is read for FINISH ONLY — CLAUDE.md's own note says the sofa in it is not current, and it is a taupe corduroy serpentine; **the code wins on colour** (`MT.ivory` #e8e2d2). | 3,000 / 512 / per-part |
| `coffee_table` | the big ribbed espresso coffee table on the pool side of the sofa island | **2.680 W × 1.080 D × 0.310 H**. Origin floor centre = **the plinth's top face** (the table stands on the plinth, not on the marble); front −Z, nominal (symmetric on both axes). **A drop-in sits at `(sx, 0.32, sz + 1.40)` with `ry = 0`.** From `suite.js:938-940`: base `MT.espresso` sx ±1.30, y .32….60, sz +.90…+1.90; top `MT.espressoPlain` sx ±1.34, y .58….63, sz +.86…+1.94. No collider of its own — the island's ring covers it. | **THE RIBS ARE GEOMETRY and have to be:** `MT.espresso` is `texEspresso` (`suite.js:395`), a canvas of fine horizontal grooves, and a baked atlas resolves whatever picture a part carries into albedo, so a rib that lives only in a map cannot be added afterwards. Seven proud bands with six 7 mm reveals fill the .28 m base exactly; the reveals are INSET, never proud, so 2.60 × 1.00 is untouched. ⚠ **the pitch is a deliberate 33 mm, not the code's ~11** — `texEspresso` draws a groove every 10 px of a 128 × 256 canvas mapped [2, 1] onto a BoxGeometry, i.e. an 11 mm micro-texture, and 25 modelled ribs on a .28 m base is the whole budget spent on something sub-pixel from across a 13 m room. ⚠ **the reveal was 14 mm deep in the first in-engine shot and its up-facing ledge caught the sun as a bright white line per rib**; at 10 mm × 7 mm the groove reads as a shadow. | 1,200 / 512 / per-part |
| `dining_chair_white` | the suite's white high-back leather dining chair on dark legs, eight of them | **0.480 W × 0.500 D × 1.100 H**. Origin floor, x/z at the **SEAT CENTRE** (`origin_to`, not the bbox — the back's 20 mm overhang would have put it 10 mm behind the group origin the game places). **Front +Z — the chair-family exception**, modelled facing Blender −Y, because the back is at z −.26…−.18 and `chair(g, cx, dz − 1.05, 0)` faces the table at +z: **`ry = 0` is the drop-in** and the far side keeps its own π. From `chair()` (`suite.js:978-989`): seat x ±.24 y .44….50 z ±.24; back x ±.24 y .50…1.10 z −.26…−.18; four `.05` sq legs y 0….44 at x ±.20, z ±.20. Eight sit at `cx = dx − 1.12 + i·.75`, z = dz ∓1.05 (`:954-958`). | No collider of its own — `colRect(DINING_X ±1.5, −20.1, −18.9, r .36)` (`:1599`) is the TABLE only, so the chairs are walked through today and still will be. **Deviations, all inside the envelope:** the back **wraps** (its section centre draws 38 mm forward at the ends on a squared falloff, so the rearmost point is still the centre and the bbox is unchanged); the legs **taper and splay** 12 mm outward at the floor, .040 sq at the foot to .050 sq under the seat, with the code's .05 prisms inside the taper at every height; the seat is .435….505 with a 22 mm radius rather than a 60 mm board. Finish: `MT.ivoryWhite` #e9e5da at roughness .58 is white LEATHER, so this is the one sofa-adjacent Group G asset with **no cloth weave** — `paint_w` (family `paint`: clean, faint edge lightening) carries a satin far better than the `linen` family's grain, and at 0.48 m a weave is sub-pixel. Legs in the group's shared espresso. | 1,600 / 512 / per-part |
| `suite_dining_table` | the 3.0 × 1.2 espresso dining table on its two plinth legs | **3.000 W × 1.200 D × 0.770 H**, legs 0.50 × 0.84 centred at x ±0.80. Origin floor centre, exact (top and both legs are symmetric about (dx, dz)); front −Z, nominal. **A drop-in sits at `(dx, 0, dz)` with `ry = 0`.** From `suite.js:950-953`: top `MT.espresso` dx ±1.50, y .70….77, dz ±.60; legs `MT.espressoPlain` dx −1.05…−.55 and +.55…+1.05, y 0….70, dz ±.42. | ⚠ **`colRect(DINING_X ±1.50, −20.1, −18.9, r .36)`** (`:1599`) is measured on the TOP's 3.00 × 1.20 footprint, not on the legs; nothing here exceeds it. **Deviation:** the plinth legs are **RIBBED** where the code's are plain — `MT.espresso`'s ribbed canvas is on the top, whose 70 mm edge holds two ribs at most, while `MT.espressoPlain` is on the two masses a seated guest's knee is 100 mm from. 39 mm pitch, within a rib of `coffee_table`'s, so the two read as one set; the reveals are inset, so both 0.50 × 0.84 footprints are untouched. A 16 mm recessed apron under the top is added for the same reason — at 3 m a flush 70 mm slab reads as cardboard. | 1,200 / 512 / per-part |
| `table_lamp` + `table_lamp_shade` | slim brass base, dark tapered drum shade — and the glowing mouth as its own GLB | **0.370 × 0.370 × 0.420.** Origin **base** for BOTH halves — the foot's underside on the axis, exactly as `tableLamp()` is called; front −Z, nominal. From `tableLamp(parent, x, y, z, h = .42)` (`suite.js:992-997`), where `y` is the SURFACE and every figure is a CylinderGeometry RADIUS: foot r .07 top / .10 bottom × .04 at y + .02; stem r .018 × h·.55; shade r .1428 / .1848 × h·.50 at y + h·.75, **open-ended**; mouth r = h·.30 × .02 at y + h·.52. The lamp is exactly `h` tall. ⚠ **FOUR CALL SITES, THREE HEIGHTS:** `.30` at the west credenza (`:906`), **`.42` at the dining sideboard pair (`:961-962`) — which is what is modelled** — and `.40` on the 2F console (`:1400`). The other two need a **uniform `scale = h / 0.42`** (0.714 and 0.952); no single mesh can serve all three exactly, because the code scales the stem, shade and mouth by `h` and leaves the foot's .07/.10/.04 and the stem's .018 CONSTANT. | ⚠ **`build_shade()` → `table_lamp_shade`, material name `shade_emit`**, which is what the loader's `/_emit$/` rule (`js/models.js:60`) keys on to keep the lit mouth emissive; an emissive key may not be mixed with lit ones in one GLB. `shade_emit` is **not** a PALETTE key and `M()` refuses unknown ones, so the disc is built on `bulb_emit` with its `wv_key` renamed — `MAT_NAME` could not do it, being module-wide, and a lamp whose material ends in `_emit` glows end to end. ⚠ **THE DRUM MUST CARRY MORE FACES THAN THE BRASS.** `apply_baked` takes roughness AND metalness from the key covering the most faces; at the first cut a 20-sided foot beat the 20-sided shade 148 : 80, `gold` won, and metalness .55 stripped the dark dielectric of its diffuse and baked the shade **pure black**. Drum 32-sided, foot 18 (128 : 104) fixes it. ⚠ **and `gold` #d8bd80 as a pure dielectric is PALE CREAM, not brass** — `_interior.brass()` gains `oak_light.webp` to ~#9d7c4e, halfway to `MT.brass`'s own #8a6b3f. Shade `dj_dark` #2b2a26 = `MT.lampShade`'s #2a2320 to within a point. Verify at NIGHT. ⚠ **VERIFIED AT NIGHT, 2026-09-20, AND IT IS A REGRESSION THE INTEGRATION CANNOT FIX.** The albedo match is exact, but `MT.lampShade` is **emissive** — `glow(…, .05, 1.5)`, DoubleSide, open-ended — so the primitive's whole drum GLOWS after dark, and that is what the suite's night scenes read as "the lamp is on". The GLB's drum is a plain dielectric on the one `table_lamp` material it shares with the foot and stem, and `table_lamp_shade`'s lit disc sits at y .208….228 with r .124 inside a rim of r .185 at y .21 — **recessed, so it is invisible to any eye above the shade line**, which is every eye in the game (EYE_HEIGHT 1.65 over a .86 sideboard). Confirmed in-engine: the material is right (`shade_emit`, emissive #fff0cf at intensity 2.2, visible) and the lamp still reads dark. Fixing it belongs to the GENERATOR, not the call site: either split the drum onto its own `*_emit` material so it glows like the cylinder it replaces, or bring the disc down flush with the rim so it is seen from the side. | 900 + 300 / 256 / 0 |
| `lobby_sofa` | the check-in lobby's cream low-back sofa with square cushions | **3.400 W × 0.985 D × 0.950 H**, modelled at `len = 3.4`. Origin floor at the sofa's own registration point (`origin_to`, not the bbox — the back's 35 mm overhang would have shifted it 17.5 mm). **Front −Z, and `P(lx, lz)` maps local +z to the OPEN side, so a drop-in needs `ry = cry + Math.PI`** — `ry = cry` seats every sofa facing the wall and nothing throws. From `sofa(cx, cz, cry, len)` (`campus.js:3044-3073`), `LY` = the lobby floor = y 0: seat `len × .30 × .95` y .15….45 (`:3049`); back `len × .66 × .18` at local z −.42 → y .29….95, z −.51…−.33 (`:3051`); `round(len/.9)` cushions `.52 × .52 × .20`, centre y LY + .68 → **y .42….94**, local z −.28, each yawed ±0.1 rad (`:3052-3058`); four `.07 × .15 × .07` feet at lx ±(len/2 − .18), lz ±.38 (`:3059-3065`). ⚠ **FOUR CALL SITES, TWO LENGTHS** (`:3077-3083`): 3.4 ×2 on the big rug, 2.8 ×2 south. The short pair needs **`scale.x = 2.8 / 3.4 = 0.8235`**. | ⚠ **`rectCollider(C, cx, cz, len + .3, 1.1, cry, .28, ABOVE)`** (`:3068`) is what must not move: 3.70 × 1.10 about the same centre, height-gated **ABOVE** because the 酒廊 breakfast room is 3.6 m underneath. The GLB sits inside it with 0.15 m to spare all round. **Deviations:** the scatter cushions **lean 10°** and rest on the back's front face (the code stands them upright with their backs 50 mm inside the panel); they are **centred on the sofa's own length** rather than `-len/2 + .55 + k·.9`, which puts the fourth cushion's outer 110 mm off the end of a 3.4 m sofa and swings the assembly's centre 55 mm off the collider's; and the seat is a fixed band .15….28 plus four loose cushions rather than one .30 slab ("square cushions" is the builder's own comment, and a 3.4 m slab reads as a bench). ⚠ **the two lobby photographs are both the same EXTERIOR three-quarter and show no furniture at all**, so the builder's comment and the code's own colours are the spec: `MAT.ivory` #e8e2d4 body, `MAT.ivoryWarm` #dfd6c3 scatters, `MAT.white` #f2efe6 feet. | 2,500 / 512 / per-part |
| `modular_sofa_2f` | ONE CURVED MODULE of the 2F lounge's white modular sofa, on its teal rug | **1.465 W × 1.120 D × 0.800 H**; the assembled ring is inner r 1.79, outer r 2.85. Origin floor on the module's own **radial centre line at r 2.35** — the point `box()` places the straight module at — so a drop-in sits at **`(cx, YF2, cz)`** with no offset. **Front −Z = the OPEN side, radially outward.** ⚠ **ROTATION:** `box()` negates its last argument, so the call site's `-a` gives `rotation.y = a`. ⚠ **INTEGRATION CORRECTION (2026-09-20) — the rule this row used to state was WRONG, and `js/suite.js` now disagrees with it deliberately.** `rotation.y = a` does NOT point the primitive's +Z outward: `mx()` puts the module on the ring at bearing **−a** while `box()` leaves its rotation at **+a**, so every primitive is **2a** out of radial (120° at i = 0) — the half-mirrored state §1a exists to prevent. Measured off the live build, the four backrests, which `back.translateZ(−.42)` should all put on r 1.93, sit on **2.588 / 2.176 / 1.930 / 2.161**. An annulus sector's side faces are radial planes, so it abuts its neighbours only when its own axis IS the radius: the front (−Z) must point at bearing −a, i.e. **`rotation.y = −a − π` (≡ π − a)**, which the call site gets by passing **`a + Math.PI`** through the negating helper. Shot both ways at one camera before choosing: π − a is one continuous crescent on the code's own r 1.79/2.85 at .52 rad pitch; `a + π` is four separate blocks with gaps between them and the end modules turned across the curve. The PRIMITIVE fallback was left exactly as it is — that is the pre-existing bug, not this wave's. From `suite.js:1376-1387`: `arcC = [-2.0, -19.3]`, `R = 2.35`, `a = -1.05 + i·.52`, seat 1.25 × .42 × 1.00 at y YF2…YF2+.42, back 1.25 × .50 × .28 translated .42 along local −Z → y YF2+.30…+.80. | The 2F lounge furniture carries **no colliders at all** (`suite.js:1580-1640` registers the great room, the dining end, the credenzas, the sideboard and the annex; nothing upstairs but walls and stair), so only the silhouette is load-bearing. **The curve is free:** an annulus sector of half-angle 0.26 rad means the two side faces are RADIAL PLANES and consecutive modules abut EXACTLY at the code's own .52 rad pitch — the assembled ring's radii are the code's to the millimetre and all that changed is that the gaps BETWEEN four straight boxes on a curve are now filled. **Deviations:** the back starts at the seat top (.42) not at .30 (the code's panel begins 120 mm INSIDE the seat block — interpenetration, not form; its visible height and its r 1.79 rear plane are unchanged); a 20 mm recessed plinth and an 18 mm cushion seam, both reveals, never proud. ⚠ **the teal accent pillow is NOT in this GLB** (alternating `MT.teal`/`MT.tealDeep` with its own yaw), nor the ottoman (`:1388`) or the 2F coffee table (`:1390`). ⚠ **the one Group G asset on a flat palette key** — see the preamble on planar UVs. | 3,000 / 512 / 0 |
| `massage_bed` | the spa's navy massage bed on blond folding legs, two of them | **0.700 W × 1.900 D × 0.820 H**. Origin floor centre, exact (the pad IS the bbox in plan); **front −Z = the HEAD**, the bolster end, which is the game's own −z end. **A drop-in sits at `(bx, 0, −20.95)` with `ry = 0`.** From `buildAnnex` (`suite.js:1322-1331`), `bx = 11.85` and `13.05`: pad `MT.navy` bx ±.35, y .62….74, z −21.90…−20.00; bolster `MT.espressoPlain` bx ±.30, y .74….82, z −21.85…−21.55; four `MT.ivoryWhite` legs .05 wide at x bx ∓.275, y 0….62, .06 deep at z −21.70 and −20.20. | ⚠ **`colRect(11.5, −21.9, 13.4, −20.0, r .3)`** (`:1621`) is ONE ring round BOTH beds, 1.90 × 1.90 about (12.45, −20.95), deliberately WITHOUT a height window (the annex has no storey over it). Both GLBs sit inside it exactly as the primitives did. **Finish from `Yinyiju spa.webp`, which is this room**: the beds in it are portable **folding massage tables** — blond timber frame, hinged splayed legs, a stretcher per pair, dark knuckle plates at the apron, a padded top with a soft rolled bolster. So: legs are **blond `oak`, not the code's near-white `MT.ivoryWhite`** (a white stick under a navy pad is a plastic trestle); a timber **apron and two stretchers** are added, entirely inside the .70 × 1.90 footprint; the legs **taper and splay** 30 mm (x ±.305, still inside the pad's own ±.35, which is the collider's measure); and the bolster is **NAVY, matching the pad**, where the code makes it dark brown — an 80 mm dark block at the end of a navy bed reads as a gap in the bed. ⚠ the knuckle plates were `steel_l` and baked as **near-white stickers**: the bake mutes Metallic for the diffuse pass and the pad's dielectric key wins the final material, so a light grey metal has nothing to be metal with. `bronze_d` is the photo's knuckle anyway. | 1,500 / 512 / per-part |

**Result, measured by `export_all.py`:** **7,814 triangles and 128 KB over the
nine GLBs** (eight assets plus `table_lamp_shade`); **66 assets in
`models.json`**. Nothing over budget — the closest is `suite_dining_table` at
944/1,200; every GLB one mesh / one primitive / one material; zero console errors
in the in-engine shots, day and night.

### Group H — the planting (KAN-208 wave 2): palms, hedges, topiary — GEOMETRY ONLY

Ten GLBs that replace the **instanced prototypes** of the campus's planting —
~325 coconut palms and ~180 clipped hedge / topiary cells — and nothing else.
Every one is **`BAKE = False`** (the Group F lantern rule above): the game keeps
its OWN materials — `nature.js` `MAT.bark` / `MAT.frond` / `MAT.hedge` and
`campus.js` `MAT.hedge` — because those carry the photographic maps
(`assets/textures/bark.webp`, `frond.webp`, `hedge.webp`), the frond alphaTest,
the night tints and the per-instance hedge colours, all compiled into programs
that already exist. The generators own UV0 and lay it out for those textures
(`generators/_flora.py`'s banner has the three layouts). Shape logic is all in
`generators/_flora.py`; each generator is a few lines.

**THE CONTRACT IS THE UNIT CELL, NOT A SIZE.** Every call site scales these
through its existing instance matrix, and the proof that nothing else moved is
`tools/scatter-probe.mjs` (all 283 InstancedMeshes' matrices + colours and
`G.colliders` hash identical before/after). So each prototype keeps the frame
and envelope of the primitive it replaces:

| name | replaces (file:fn) | frame / envelope / origin | UV0 (for the game's map) | tris (was) |
|---|---|---|---|---|
| `palm_tall` + `palm_tall_crown` | `nature.js` `palmVariants()` spec 0 — `trunkGeo()` + `crownGeo()` | **h 11.5, rTop .17, rBot .34, bend (1.9, .5)** — trunkGeo's exact radius law, root collar and crown swell; the crown's base at **(bendX, h, bendZ)** where crownGeo() translated it. Both halves in ONE frame, **origin = the trunk foot** (`join(origin=None)`), so one instance matrix drives both and `requestPalms()`'s lean-aiming (`atan2(bendZ, bendX)`) and `variantForHeight()` (spec.h) are unchanged. 14 fronds, 6 coconuts. | trunk: u once round, v 0 foot → 1 crown (CylinderGeometry's; `MAT.bark` repeat 1.2 × 16). crown: frond.webp — u butt → tip, rachis v .575, leaflets v .15…1 cut to the texture's MEASURED alpha envelope (+.06), coconuts in the brown patch v .02….10 | 264 + 512 = **776** (126 + 220 = 346) |
| `palm_mid` + `palm_mid_crown` | spec 1 | **h 8.6, rTop .18, rBot .33, bend (−1.3, 1.1)**; 13 fronds, 5 coconuts | as above | 264 + 464 = **728** (126 + 192 = 318) |
| `palm_young` + `palm_young_crown` | spec 2 | **h 5.8, rTop .20, rBot .32, bend (.7, −.9)**; 10 fronds, no coconuts; 9 trunk rings | as above | 168 + 280 = **448** (126 + 140 = 266) |
| `hedge_run` | `nature.js` `buildUnderstory()` hedge segment, `BoxGeometry(1,1,1,2,2,2)` | unit cell **±0.5, centred**; **local Z ALONG the run** (hedgeRun: `rotation.y = atan2(dx, dz)`, scale (t, h, w)); ±Z ends FLAT and FULL and the leafy lumps PERIODIC in z (period 1), so neighbours (6 cm overlap) join without a notch; rounded top shoulders (r .17 of the section), 3.5 % batter; open underside | u = z + .5 along; v = arc length round the section (one 0…1 tile per face like the box; `MAT.hedge` repeat 2 × 1); caps planar | **236** (48) |
| `hedge_block` | `campus.js` `UNIT_BOX` in buckets **`hedgeI`, `arrHedgeI`, `spHedgeI`** | unit cell ±0.5, centred; every vertical and top edge rounded (r .13), square base, faint lumps. Rounds its ENDS too — these blocks stand apart (1.9 m gaps; the arrival cells leave .1 m) | per cube face box projection × **2 tiles per unit** (campus `MAT.hedge` repeat 1 × 1) | **250** (12) |
| `hedge_mass` | `campus.js` `UNIT_BLOB` = `IcosahedronGeometry(.5, 1)` in bucket **`hedgeBlobI`** (sea-edge band, villa masses, rooftop planters + screen + bar canopy greenery) | unit sphere envelope ±0.5, centred; cube-sphere on a **p = 3.5 superellipsoid** — flat clipped top, full shoulders (the icosahedron was a faceted lens tapering to points) | per cube face × 2 | **300** (80) |
| `topiary_ball` | `UNIT_BLOB` in **`topiaryI`**, **`spTopiaryI`** | unit sphere envelope ±0.5, centred; **p = 2.3** — a trimmed ball | per cube face × 2.2 | **300** (80) |

⚠ **UV0 IS WRITTEN WITH V FLIPPED** (`Buf.to_object`): everything above is in
three's convention (v = 0 at the image bottom, TextureLoader `flipY`), and the
glTF exporter writes `v = 1 − v_blender`, which three uses as-is. Unflipped, the
first in-engine crown sampled the frond atlas upside down — every leaflet edge
read the brown coconut patch.

⚠ **THE FROND NORMALS ARE CUSTOM, AND THEIR DIRECTION WAS MEASURED** — see
`_flora.palm_crown`'s `nrm()`. Out-and-DOWN (toward where a guest stands) is the
one that survives the venue's low golden-hour sun plus three's DoubleSide
normal flip; radial-up and up-dominant both lit a third of every backlit crown
flat khaki.

Budget: **≲ 800 tris per palm** (Carl's steer for ~325 instanced palms). All
ten GLBs are **30 KB** together.

### Group I — the wedding + arrival leftovers (KAN-208 wave 3)

Seven GLBs for the four still-primitive items a guest walks past: the welcome
board's frame, the cocktail glassware, the parked cars. (The festoon and the
pearl swags were judged and stayed PROCEDURAL — better prototypes on existing
buckets beat a GLB at guest distance; see the bottom of this group.) Dims in the
GAME's frame (glTF Y-up, y = height); every row carries the call site.

| name | what | dims / origin / front | notes | budget |
|---|---|---|---|---|
| `welcome_board_frame` | the ceremony welcome board's OAK moulding (following the board's own arched outline) + a white plinth foot with a stone cap. The board, its canvas (`welcome-board-art.webp`) and its lettering ("Welcome / to our wedding / **Carl & Rachel** / 2027.03.20") stay the game's ExtrudeGeometry. | **1.34 × 2.07 × .44.** Moulding: the Shape's two cubic Béziers + two sides (`js/moments.js:1498-1513`, SW 1.14 × SH 2.02, depth .055), profile 5 cm out from the edge with a 1.2 cm inner lip, **9.1 cm deep centred on the board's mid-plane z .0275**, open at the foot. Foot 1.30 × .40 × .16 + cap 1.34 × .44 × .03 (top y .19). **Origin = the BOARD's own (0,0,0)** (`join(origin=None)`, not the bbox): x centred, y 0 at the grass, z through the board. Placed with the board's own transform: `put(K.mdl('welcome_board_frame'), sx, 0, sz, 1, [0, −2.44, 0])` at **(AX + 5.45, 66.8)** (`moments.js:1519`) — the framing constraint (CLAUDE.md decor trap 3) is untouched. | Baked, `oak` (moulding) + `paint_w` / `stone` (foot); material name = asset name. ⚠ First shot in `paint_w` vanished: white frame on a pale board. The foot hides the board's bottom 16 cm, below the date's baseline (~.43 m). | 740 / 512 / 0 |
| `cocktail_glassware` | the fifteen glass SHELLS on the round bar, one mesh: 4 wine glasses (spritz), 3 stemmed tulips (pink), 4 ten-facet highballs, 4 heavy-based rocks tumblers — real walls (outer face, rolled rim, inner face down to the bowl floor) | **1.83 × .27 × .51.** Positions = `roundBar()`'s own arithmetic (`moments.js:1026` + the fallback loops under it), shared in `generators/_drinks.py` `POS`. Rocks Ø 9.2 × 9.5 (1.6 cm solid base); highball Ø 7.0 × 15.5; wine glass foot Ø 7.6, stem to 9.2, bowl Ø 9.2, rim 21; tulip foot Ø 7, rim 27. **Origin = the bar TOP at its centre**; placed `iput(K.mdlAs('cocktail_glassware', glassPale), 0, 1.13, 0)` in the bar's frame F. | ⚠ **GEOMETRY ONLY (`BAKE = False`)**, paired with moments.js's **`glassPale`** (transparent .45, NO transmission — "the transmission win") in the new `K.mdlAs(name, mat)` bucket; the instanced untinted glassPale program already existed (K.glass). No UVs (no map). Shading: smooth ≤ 30°, so the highball's 36° facets stay hard. | 5,696 / — / 0 |
| `cocktail_drinks` | everything OPAQUE in and on those fifteen: the four liquids (aperol, cranberry-coconut pink, rum yellow, lychee-negroni amber), a 1.2 cm coconut-foam cap, 8 ice cubes, grapefruit half-wheels + rosemary sprigs, mint sprigs + passion-fruit halves, mint leaves + pink fruit slivers, orange twists over the rims | **1.84 × .29 × .50.** Each liquid is the solid the glass's INNER face bounds from the bowl floor to the fill line (rocks 7.0, highball 13.5, spritz 17.2, tall 22.8 cm), 1.2 mm inside the wall (the highball's inscribed in its facets ×.94). Same origin and placement as `cocktail_glassware`: `iput(K.mdl('cocktail_drinks'), 0, 1.13, 0)`. | Baked (512, AO_DIST .08). ⚠ **The liquid palette is DELIBERATELY deeper than the menu art** (`aperol e06800`, `cran_pink d84a78`, `rum_yellow d49400`, `negroni 8f2f08`): every liquid is seen through glassPale, which lifts it ~40 % toward a cool white — at the menu's own hues the first shot read peach / lime / pastel. Opaque renders first, so the colour reads THROUGH the glass. | 4,032 / 512 / 0 |
| `parked_car` + `_glass` + `_trim` + `_rims` | a low-poly saloon in four GEOMETRY-ONLY parts, one frame: the painted shell (side-profile extrusion with real wheel arches, bevelled; roof panel, A/B/C pillars, a flank crease), the tapered greenhouse, the dark trim (bevelled tyres, underbody / arch liners, sills, valances, grille, lamp bezels, plates, mirrors), and the silver wheel faces + HEAD-LAMP lenses | **1.82 × 1.61 × 4.44** (shell; trim 2.13 wide at the mirrors, 4.50 long at the plates). Envelope = `parkedCar()`'s boxes (`js/campus.js:5310`): body 1.80 × 4.38, roof top 1.59, wheels r .33 × .23 at x ±.80, z ±1.34, bumpers z ±2.25. **Origin floor, footprint centre = parkedCar's (cx, cz)**; **front +Z** (the chair-family exception — parkedCar authors the head lamps at local +Z). Placed `mat4(cx, baseY, cz, 1, 1, 1, yaw)` (`campus.js:5331`) — NO extra rotation, both call sites (`campus.js:2708` court, yaw π/2 ± .025; `:5420` north apron, yaw ± .03). | ⚠ GEOMETRY ONLY: `MAT.car` **tinted per instance** (the CAR_PALETTE colour, bucket `carBodyGlbI`), `MAT.carGlass` (`carGlassGlbI`), `MAT.dark` (`carTrimGlbI`), `MAT.car` tinted `b4b9bf` (`carRimGlbI`). The red tail lamps stay the game's `carI` boxes. ⚠ **The head lamps are IN `_rims`**, not carI boxes: world.js relocates campus instances one by one by `isEnclaveLocal(x, z)`, and on the north apron (z ≈ −78; the line is z −77.4) anything 2.2 m ahead of a car's centre is rotated onto the enclave lawn. That was a LIVE bug: the old cars' bonnets, A-pillars, head lamps and front wheels stood as a row of floating debris on the lawn behind the cabanas. | 616 + 12 + 640 + 344 = **1,612** (was 15 boxes/cyl ≈ 200) |

**The two kept procedural, on purpose** (`js/moments.js`):

- **Pearl swags** (`plinthPair`, `moments.js:871`): same nine curves (y0, sag, z),
  now walked by ARC LENGTH at a 2.6 cm pitch with a 2.2 cm icosahedron pearl
  (`G_PEARL`, 20 tris) in a new `pearlS` bucket on `pearlM` — ~1,000 pearls, one
  draw call. The old 18 octahedra per strand were 5 × 7 cm diamonds on one shared
  x grid, so the nine strands lined up into vertical columns (a bead curtain). A
  GLB would have been the same instances baked into one mesh, with no gain.
- **Festoon** (`festoon()`, `moments.js:209`, prototype `G_BULB` at `:127`): every
  bulb is now a 4 cm drop + a dark socket (K.dark) + a real 9 cm globe bulb
  (`G_BULB`, a 48-tri lathe) on the SAME emissive `bulb` material — the night look
  is unchanged (toneMapped off, glowing at every hour, as before). The three
  `stringLights()` call sites (prewedding, cocktail, after party — bulbs as plain
  Meshes with NO cable, 174 of them) became `festoon()` runs with the cable drawn;
  `stringLights` is deleted. The cable stays the 1-px `LineSegments`: a tube of
  a real cable's 6 mm is sub-pixel at 5 m and aliases away.

### Group J — the understory (KAN-208 wave 4): shrub / cover cores + leaf-card fringes, casuarina tiers — GEOMETRY ONLY

Six GLBs, all **`BAKE = False`** (Group H's rule): the game keeps its own
materials. Shape logic is `generators/_flora.py` § "KAN-208 WAVE 4"; each
generator is a few lines. **THE CONTRACT IS STILL THE UNIT CELL**: the CORE
replaces an existing blob bucket's prototype under unchanged matrices (proof:
`tools/scatter-probe.mjs`, all 293 pre-existing InstancedMeshes byte-identical),
and the FRINGE is a new InstancedMesh built by `js/foliage.js` `fringeFor()`
from the core's own matrices.

| name | replaces / pairs with (file:fn) | frame / envelope / origin | UV0 | tris (was) |
|---|---|---|---|---|
| `shrub_core` | the prototype of `nature.js` shrub masses (`blobGeo(…, 1, .5)`, 825) + bougainvillea (`blobGeo(…, 1, .42)`, 19), `water.js` river shrubs (`IcosahedronGeometry(1, 1)`, 263), `campus.js` `bougain` / `bougI` / `subBougI` (`UNIT_BLOB`, r .5 — `protoGeo('shrub_core', .5)`, a scaled clone), `atrium.js` pond-edge clusters (× r) | **radius-1 unit, centred** (the icosahedron's frame): an 80-tri icosahedron pushed onto a union of five lobes (`_SHRUB_LOBES`), max radius .86 — so the fringe overhangs it. Size 1.52 × 1.27 × 1.59. Normals radial (smooth, like PolyhedronGeometry's). | per-face box projection, .5 tile per unit (× the game's repeat 2 = one shrub.webp tile per unit). Materials: MAT.shrub / MAT.boug (photos, per-instance colour), water `plantM` (now shrub.webp, colour × 7), campus boug photo mat, atrium broad mats | **80** (80) |
| `shrub_fringe` + `shrub_fringe_b` | NEW buckets over every `shrub_core` bucket (index even → a, odd → b; the atrium uses a only) on `leafMat('shrub')` / `leafMat('boug')` | same frame and the SAME lobe layout (one seed stream, `shrub`); each variant its own card draw. 16 cards × 2 tris, each on a Fibonacci-spiral direction over the upper cap (y ≥ −.25), centred .62–.9 of the lobe radius, .62–.86 wide, tilted .35–1.2 rad off facing-out (so the silhouette's cards stick OUT), image spun at random. Custom normals .7 radial + .3 card normal, wound to agree. | one card = the whole image (0…1, ClampToEdge): `shrub_leaf.webp` / `boug_leaf.webp`, alphaTest .5 | **32** (—) |
| `cover_core` | nature.js ground cover (`blobGeo(…, 0, .55)`, 350, instance-squashed to .22–.38 tall) | radius-1 unit, centred; the icosahedron at detail 0 on the `cover` lobes | as shrub_core | **20** (20) |
| `cover_fringe` | NEW bucket over the cover on `leafMat('shrub')` | 10 cards on the top cap only (y ≥ .2), tilted 0–.5 rad (near LEVEL: a steep card would be flattened by the ~5× y-squash), .7–1.0 wide, centred .75–1.0 of the lobe radius so they overhang the rim | whole image | **20** (—) |
| `casuarina_tier` | `campus.js` `casuLeafI` — `ConeGeometry(.5, 1, 10)`, three per tree (flush-time swap, `WAVE4_PROTO`) | the cone's envelope: radius .5 at y −.5, apex +.5, centred. 13 outer + 4 inner needle curtains leaving the axis near the apex, arcing out (r ∝ t^.6) and drooping (y ∝ t^1.3) to the rim, widening as they fall; 3 segments each; NO base cap. Normals out-and-down (the palm crown's measured rule). | `casuarina.webp` (repeat 1): v = 1 at the attachment (the map's dense top) → 0 at the hanging tip (its wispy strand ends); a random .22–.3 u-window per curtain | **102** (20) |

**Textures** (`assets/textures/`, runtime — never `assets/blender/textures/`):
`shrub_leaf.webp` (manifest `shrub_leaf_card`, magenta, key-magenta, bleed 16)
and `boug_leaf.webp` (`boug_leaf_card`, a flat COBALT backdrop keyed `--mode flat`
tol 100 / soft 30 + `drop_backdrop_hue: "blue"` — never magenta: the bracts are
magenta). `casuarina.webp` re-graded in place by `regrade_foliage.py` to opaque
mean `#44583a` (it was a grey-sage `#6d6f61` with magenta spill).

⚠ **The fringe material has NO instance colour and must never get one** — see
`js/foliage.js`: instanced + map + alphaTest + DoubleSide without
instancingColor is the palm fronds' program; with it, two new programs.

⚠ **Not GLBs, same wave:** the atrium's cloud topiary uses Group H's
`topiary_ball` × each cloud's diameter; water.js's two hedge boxes are Group H's
`hedge_run` cells merged into one Mesh (`hedgeRunX`).

### Group K — ARCHITECTURE (KAN-211 wave A): the arrival pavilion + the check-in lobby

Seven GLBs, and the first on this campus that are **buildings, not props**. Walls
carry gameplay, so the contract is different from every group above:

- **THE SITE FRAME.** Every Group K GLB is authored in enclave-local metres with
  its origin at the ANCHOR `(SITE.ARRIVAL.backX, 0, SITE.ARRIVAL.axisZ)` =
  `(33, 0, −8)` — NOT re-origined to its bbox (`ORIGIN = "site"`, `join(…,
  origin=None)`). `generators/_arch.py` maps local `(x, y, z)` → Blender
  `(x − 33, −(z + 8), y)`; the export's `(x, z, −y)` gives the identity back.
  campus.js places each with ONE identity instance at the anchor (`ANCHOR()` in
  `buildArrival`). `(33, −8)` answers true to `isEnclaveLocal()`, so world.js
  carries every one into the enclave whole.
- **THE NUMBERS ARE READ FROM THE LIVE `js/site.js`** (`_arch.site()` runs node on
  it) — never re-typed. A GLB that disagrees with SITE.ARRIVAL is a bug here.
- **VISUAL ONLY.** Colliders, WALK_REGIONS, spawns, interactables and every
  `rnd()` draw stay the game's; each replaced primitive keeps its old path as the
  `else` for a missing GLB. Proof per build: `tools/scatter-probe.mjs`
  `colliderHash 026674019d51` (10,797) before and after, and floorY probes.
- Baked atlases ride the ONE instanced baked-map program; roughness / env and the
  night tint are set per GLB in campus.js (`archMat()`), both uniforms.
- **`PACK_SHAPE = "CONCAVE"`** (new knob, `wv_bake.prepare_for_export`) and
  **`_arch.spans()`** — long faces built in ≤ 5 m pieces — see ⚠ below.

| name | replaces (campus.js buildArrival) | what is modelled (reference) | material keys | atlas | tris |
|---|---|---|---|---|---|
| `arrival_shell` | §C `arrCortenI` wings + end walls + the lounge's east wall | standing-seam corten skin (0.6 m panels, 45 × 48 mm seams, each panel its own patina shift), walls that now reach the roof's UNDERSIDE (the old 7.4 m boxes left a slot under the sloped roof), the courtyard band above the lobby glass (7.0 → roof), the plaque wing's corten FRAME with its recess cut (z −19.9 … bay.z0 − .4, y TY + .25 … + 3.55), walnut panelling on every interior face (f_001–f_005, clubhouse-lounge-checkin-balcony.jpg) | `corten` / `corten_seam` / `corten_in` (corten_weathered.webp, 2.4 m world tile), `panelling` (panel_walnut.webp) | 2048 | 3,528 |
| `arrival_roof` | §C roof slab + `arrSoffitI` + front fascia + the fold plate | the SAME mono-pitch slab (.34 on eaveH 7.15 @ z −22 → ridgeH 9.20 @ z 2.2, x 28.7 … 44.9), standing seams down the slope, a 0.46 m fascia round all four edges, THE FOLD over the bay (a 0.55 m folded drop), the cedar soffit under the courtyard overhang at y_c − .26 (flush with the game's `arrDownI`) | `corten*`, `cedar` (cedar_soffit.webp, 1.2 m tile, boards along x) | 2048 | 664 |
| `arrival_stair` | §B `arrBlackI` risers, landing, cheeks | 6 treads at EXACTLY terraceY + (i+1)·rise/6, 20 mm bevelled nosings, a pale anti-slip strip 40 mm back, the landing in 0.6 m slabs, the cheeks with a coping (f_011/f_013) | `ar_stone`, `ar_stone_l`, `ar_joint` — roughness .24, env 1.25 (glossy) | 1024 | 1,956 |
| `arrival_entry` | §C canopy `arrCortenI` + `arr-soffit`, `arrBandI` piers + plaque panel, the door `darkI` frame/leaf rails, sconce `darkI` plates | canopy: corten top, bronze fascia, DARK slatted soffit (slats ∥ facade, a channel left for the six `arrDownI`); piers: glossy black courses with 30 mm projecting taupe ledges (f_013); bronze door frame whose head sits UNDER the soffit (lobbyY + 1.90); the parked leaves' bronze frames; sconce plates + arms; the banded plaque wall inside the recess | `ar_black`, `ar_taupe`, `ar_bronze`, `ar_dark`, `corten_top` / `corten_in` | 2048 | 936 |
| `arrival_sconce` | §C `arrSconceI` (UNIT_CYL) | Ø .20 × .80 fluted cylinder (16 flutes) with two collars; **GEOMETRY ONLY** on the game's glowing `MAT.brassFlute`; origin CENTRE, stood at (44.44, 4.85, gap ± 1.9) | UV0 cylindrical, v up | — | 636 |
| `lounge_facade` | §D lounge mullions/heads/folded-leaf heads, `arrLouvreI` ×2 storeys, `arrPierI`, the balcony slab box, `arrCapI` (beam + capping), `arrSoffitI` (balcony + the upper timber panel), §F lobby mullions/head | slim dark-grey folding-door frames (stiles + deep rails), the louvre band, the charcoal pier in ~0.77 × 0.81 m tiles with joints, the balcony's stone slab edge + 0.56 m pale fascia beam + cedar soffit + capping + glass shoes over RAIL, the lobby's frames + louvred transom, the cedar panel (clubhouse-lounge-checkin-balcony.jpg) | `ar_alu`, `ar_dark`, `ar_charcoal`, `ar_joint`, `ar_cap`, `ar_stone`, `cedar` | 2048 | 1,680 |
| `lobby_desk` | §H `arrCabI`, `arrCabPlinthI`, `arrDeskI`, `arrSlatI` ×35, `arrDeskDarkI` | counter: dark carcass, recessed kick, a 60 mm bevelled top over 36 half-round bamboo slats, end returns; a slim monitor FACING THE STAFF (the old boxes faced sideways); four white flush cabinet panels with reveals and pull grooves on a dark plinth (compare-checkin-lobby-2026-08-04.jpg) | `ar_teak`, `ar_bamboo`, `ar_white`, `ar_screen`, `ar_dark` | 1024 | 1,308 |

**Wave A2 (look pass) additions** — same contracts:

| name | replaces | what | material | tris |
|---|---|---|---|---|
| `arrival_soffit` | split out of `arrival_entry` (which lost its slats + backing: 936 → 564 tris) | the canopy's slatted ceiling: 56 mm slats at 0.13 m in a solid warm bronze-brown `ar_soffit` (#3a2b21, wood family) on a near-black backing, the downlight channel kept; its own GLB so it can be MATTE (rough .88, env .35) while the piers stay glossy | baked, 1024 | 744 |
| `frangipani` + `frangipani_leaves` | the four blob trees of `frangipani()` (3 UNIT_CYL trunks + 5 canopy blobs + 7 pink flecks each) | 4 thick pale-grey trunks from one root flare, each forking twice into blunt candelabra branches (~3.5 m, crown ~5 m); a 5-card rosette cluster at every tip on `leafMat('frangi')` (`frangipani_leaf.webp`: paddle-leaf rosette with pink + white flowers, keyed off COBALT). Origin at the trunk foot; one `mat4(fx, fy + .18, fz, 1,1,1, yaw-from-position)` per tree; the blob path's **77 rnd() are still drawn and dropped** | GEOMETRY ONLY: trunks on MAT.arrTrunk + instance colour 0x6c665f (arrTrunkI program), cards on the leaf program | 2,016 + 200 |
| `cordyline_clump` + `cordyline_clump_ixora` | the beds' maroon cordyline + red ixora `arrPlantI` blobs | 22 arching strap blades / six squashed flower-head domes, both fitted to the UNIT_BLOB envelope (±.5) so the blob's own matrix + colour are reused | GEOMETRY ONLY on MAT.plantFlat (arrPlantI program), keys `arrCordyGlbI` / `arrIxoraGlbI` | 220 / 120 |

**Textures** (`textures/gen/`, bake inputs): `corten_weathered.webp` (manifest
`corten_cladding`, **v2** 2K: fine vertical streaks on an even warm ground, tile-blend x only, balanced `#4a3a30`; `corten_dark.webp` = it × 0.30 linear, derived, for the seams), `cedar_soffit.webp`
(`cedar_soffit`, 2K, **`blend_axis: "y"`** — a both-axis blend doubled every board
joint across the tile's middle), and `panel_walnut.webp` — **DERIVED, not
generated**: cedar_soffit.webp × (0.24, 0.19, 0.19) in linear space (numpy, one
line — see `_arch.panelling()`).

⚠ **Two atlas lessons (both cost a bake):**
1. **The longest island caps the atlas's texel density.** `pack_islands(scale=True)`
   scales every island by one factor, so a 24 m wall skin fits a 2048 atlas at
   ~85 px/m however little else there is — the first shell bake left HALF the atlas
   black. Long faces are built in ≤ 5 m pieces (`_arch.spans()`); the world-scale
   art UV keeps the photograph continuous across them.
2. **AABB packing starves hundreds of thin seam/slat islands** — `PACK_SHAPE =
   "CONCAVE"` filled arrival_entry's atlas (the default stays AABB for every
   earlier asset).

⚠ **A Mix (multiply) node after the image did NOT reach the atlas** — observed
once, cause not isolated: the node was wired in the saved master and the baked
atlas was the raw cedar orange. Darken in the picture (`panel_walnut.webp`), not
in the node tree, until someone finds out why.

## What is deliberately NOT in this wave

(Palms, hedges and topiary are Group H since KAN-208 wave 2 — their PROTOTYPES;
the `nature.js` scatter itself is still procedural; the shrub / bougainvillea /
ground-cover blobs, the river dressing's shrubs, the casuarina tiers and — via
Group H's prototypes — the atrium's cloud topiary are Group J since wave 4. The
shade-tree crowns, the croton and agave accents are still primitives.) The buildings; the
floating lanterns and loungers in `water.js`; the campus furniture (rooftop
four-tops, bar-room dining, check-in lobby); the welcome board (kept procedural —
the art pass supplies a better board face — its frame + foot are Group I since
wave 3); (the festoon, the cocktail glassware and the pearl catenaries are
Group I since wave 3).
