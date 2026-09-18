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
| `four_top` | the rooftop brunch round table, **BARE** — no linen, no settings | Top **Ø 1.35 × .07, top face y .785**; pedestal **Ø .14**, y 0….72; a **Ø .62 × .055** disc foot (added — the primitive has none). Origin floor centre; front −Z (radially symmetric). From `campus.js:4215-4218`, iterating `HOTEL_ROOF.brunchTables`; `roofColliders()` rings it at `TABLE_R` **0.95** (`campus.js:4937`). ⚠ `moments.js:1566+` dresses it for the Welcome Brunch with a linen skirt **r .68→.72 hemmed at y .01** and a cloth top disc r .72 at y .755…**.805** — so the timber top must stay at .785 (the cloth sits 2 cm proud) and **nothing may exceed r .68 below y .75** or the skirt clips it. Bare in the other five moments. | Warm timber top (`bar_top`) with a lathe-profile chamfer, `dark` column and foot — `rooftop-bar-dusk.png`. 900 tris is why the chamfers are profile steps, not bevels. | 900 / 256 / 0 |
| `dining_chair_rattan` | the bar room's dining chair: timber frame, curved top rail, woven rattan back panel, white box cushion | **0.46 lateral × 0.48 deep**; legs 0…**.44**; seat frame `.48 deep × .46` at **y .435….49**; cushion `.44×.42` at **y .49….58**; back uprights to **y 1.025**; top rail y 1.015…**1.075**; woven panel .035 thick × .30 wide at **y .565….965**, .075 m proud of the frame. Origin floor centre; **front +Z** (the chair-family exception) — modelled facing Blender −Y, which is how the arrival's `chair()` authors it (`campus.js:2828-2836`). ⚠ **`campus.js:4449-4463` `diningChair()` authors its BACK at local +X**, so a GLB drop-in at the rooftop four-tops / long tables needs **ry = ca − π/2**. | Photo for detail (`rooftop-bar-dusk.png`, foreground): the rear legs and the uprights are **one unbroken stile**, the top rail **curves** to wrap the sitter (28 mm of bow at the ends) and the back is a real woven field — `straw_weave.webp` on the panel plus five raised weave rods, not a painted slab. `oak` grain, `straw` rattan (gain .60/.50/.40), `ivory` linen cushion. | 1,800 / 512 / per-part |
| `bar_stool` | counter stool: weighted foot, dark column, **timber footrail on four spokes**, timber seat band, white cushion | **Ø .46 max, y 0….82.** foot disc **Ø .44 × .05**; column **Ø .11**, y .05….67; footrail ring **Ø .34** at y .26; seat band **Ø .46** y .67….73; cushion **Ø .42** y .73…**.82**. Origin floor centre; front −Z (radially symmetric). From `campus.js:4361-4365`, one per counter bay at r 97.80. ⚠ **THE Ø .46 IS LOAD-BEARING**: `roofColliders()` (`campus.js:4952`) says the stool line reaches **r 97.59** and the counter arc is authored stricter than that — nothing may exceed r .23 from the axis. | ⚠ **Code vs photo, and the code wins here.** `rooftop-pool-bar-daylight.webp` puts timber-framed **armchairs** at this counter, not pedestal stools; a ~0.6 m armchair does not fit the 0.46 m envelope the collider was measured against. So: the code's pedestal, the photo's finish. Footrail + seat band are **timber** because the primitive uses `MAT.slat` for both; `bronze_d` foot and column, `ivory` cushion. | 1,200 / 256 / 0 |
| `kayak` | sit-on-top kayak: white lofted hull, blue moulded deck, a dished seat well with a proud coaming, a forward hatch, carry toggles, the paddle across the deck | **3.00 L (Z) × 0.78 beam × .63 H**, paddle span 2.05 on X. **Origin "floor" = the KEEL**, so the deck crown is **.52** above it and **the WATER LINE is y +0.24** — a drop-in sits at **`WATER_Y − 0.24`**. Seat well `.53 × 1.02` centred **.18 aft** of midships. **Front +Z = the BOW** — `buildKayak` (`water.js:3080-3130`) yaws the hull so its local +Z runs down the channel. From that function + `site.js:1138` `KAYAK: {len: 3.0, beam: .78}`: hull sphere scaled `(.39, .30, 1.50)` at y +.06 (keel .24 below the water line), blue top cap, cockpit `(.265, 1, .51)` at y .21, paddle `2.05 × .045` at y .42 with blades at ±.92. No collider, so the paddle's span costs nothing. | Floor origin rather than a waterline origin because `preview_all.py` and `tools/viewer.html` stand a model on the ground disc. ⚠ **Two things the in-engine shot caught:** the seat well sunk to the hull's own deck line was **buried under the blue deck** (the kayak read as a surfboard) — the coaming now stands .03 proud; and a square full-depth bow station read as a **flat plank**, so the stem is raked over two extra stations. Blue is `bottle_blue`, not `delph` — `delph` rendered near-white under the venue rig. The **paddler stays a game object**. | 2,000 / 256 / 0 |

## What is deliberately NOT in this wave

Palms, hedges, topiary and the whole `nature.js` scatter; the buildings; the
floating lanterns and loungers in `water.js`; the campus furniture (rooftop
four-tops, bar-room dining, check-in lobby); the welcome board (kept procedural —
the art pass supplies a better board face); the festoon cables and bulbs; the
cocktail glassware on the round bar (tinted opaque liquid inside transparent glass,
which a bake cannot reproduce); pearl catenaries between the plinths.
