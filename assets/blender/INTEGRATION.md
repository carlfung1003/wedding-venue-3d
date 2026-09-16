# INTEGRATION — how the game consumes the GLB props (KAN-207)

Companion to `ASSET_SPEC.md` (what the assets are) and `README.md` (how they are
built). This is the contract for `js/moments.js` + `js/main.js`; the builders
(`campus.js`, `water.js`, `nature.js`…) are untouched by this pass.

## 1 · Boot order (`js/main.js`)

```js
import * as models from './models.js';
…
const modelsP = models.preload((f, name, ok) => setProgress(.06 + f * .02, `Unloading the florist's van… ${name}`));   // start EARLY: network overlaps the CPU-bound buildWorld
await buildWorld(G, …);
await modelsP;                       // MUST resolve before initMoments — props are built synchronously from models.geometry()/material()
initMoments(G);
… the two compileAsync warm-ups follow as before, so every GLB material is compiled behind the loading card
```

- Nothing above changes the light count: a GLB never carries a light.
- The loading bar must stay monotonic; models are ~10 % of the wall-clock, mostly
  overlapped, so give them a small window.
- `models.preload` never rejects. A failed GLB → `models.has(name) === false` and the
  call site MUST fall back to its old primitive path. Keep the old code as the
  fallback branch; do not delete it.

## 2 · Buckets (`js/moments.js`)

The kit/bucket design stays. Add ONE thing to `kit()`:

```js
function kit() {
  const K = { …existing buckets… };
  const mb = new Map();
  /* a bucket per GLB: one InstancedMesh per model per moment, however many are placed */
  K.mdl = (name, tinted = false) => {
    if (!mb.has(name)) {
      const geo = models.geometry(name), mat = models.material(name);
      mb.set(name, geo && mat ? bucket(geo, mat, tinted) : null);
    }
    return mb.get(name);
  };
  K._mdl = mb;
  return K;
}
function bakeKit(K, g) { …existing…; for (const b of K._mdl.values()) if (b) bake(b, g); }
```

`put(K.mdl('crossback_chair'), x, 0, z, 1, [0, yaw, 0], 0xffffff, parent)` — same
signature as every other bucket, so `frame()` / the curried `iput` keep working and
the "instances go through the prop's own frame" rule is preserved.

⚠ `bucket(geo, mat, tinted)` with a baked-albedo material: instanceColor MULTIPLIES
the map, so leave `col` at `0xffffff` unless the asset is documented as tintable
(`parasol_round_canopy` — tint it `teal`).

⚠ InstancedMesh + a GLB material that has `map`: three needs nothing extra. Do not
clone the material per moment — sharing it across the six moment groups is what
keeps the program count constant.

## 3 · Placement conventions

| asset origin | how to place |
|---|---|
| `floor` (default) | `put(K.mdl(n), x, 0, z, 1, [0, yaw, 0])` — y is the ground (0 on the lawns, `DY` on the roof). The model's front faces −Z at yaw 0, exactly like the extras authored "facing −Z". |
| `+Z` front (the chair family) | the chair's front faces +Z at yaw 0, matching `xbackChair()`'s existing yaw arithmetic — pass the same yaw the old code passed. `chair_drape` takes the chair's matrix verbatim. |
| `hook` | place the hook point: `bead_chandelier` at the arch apex `(ax, ARC_POST + ARC_R, ARC_Z)`; `candelabra` at `(px + dir*POLE_R, POLE_H + POLE_R, pz)` (the old code subtracted .68 for the rod — the GLB includes the rod); `fabric_flower` at `(AX + 1.35, 2.35, AZ + .28)`; `mirror_ball` is origin-at-centre, so `(0, 4.2, D.z0 + 4.5)` as before. |
| `base` (table-top) | `bottle_set` at `(0, 1.13, +.40)` in the bar's frame; `centrepiece_low` at `(x, .81, z)`; `drink_dispenser` / `cupcake_stand` at the counter top `y 1.11`. |
| *unit* | `plinth_fluted` scale `[r/0.5, h, r/0.5]` (e.g. the dessert bar's `[.30,.96,.30]` → `[.60, .96, .60]`); `plinth_rect` scale `[1, h, 1]`; `cluster_*` uniform `big`. |

Rotation is `[0, yaw, 0]` only. Never compose a Z-rotation with a Y-rotation through
one Euler for a pre-rotated geometry (the chandelier-pole lesson).

## 4 · What each moment swaps (asset → the code it replaces)

- **Ceremony / Cocktail (`dressCeremonyDecor`)**: `crossback_chair` + `chair_drape`
  (`xbackChair`), `installation_hero`/`installation_small` (`installation()`),
  `fabric_flower`, `cluster_a/b/c` (the `bloomMass` ground clusters — pick a variant
  by `rnd()` so the seeded stream stays stable: draw ONE rnd per cluster exactly
  where the old code drew its first), `arch_frame` + `bead_chandelier` (posts, torus,
  `beadShade`), extras: `dessert_counter` + `parasol_tiered` + `drink_dispenser` ×2 +
  `cupcake_stand` ×2 + `plinth_fluted` ×2, `wheelbarrow`, `hat_rack`, `plinth_rect` ×3
  (the pearl catenaries stay instanced beads), `coconut_rack`, `beverage_cart`.
  KEEP: the petals, the row-end posies (or `cluster_c` at .3), the welcome board (see
  §6), the game's own panels (dessert sign, menu, "Beverage" cloth).
- **Cocktail redress**: `round_bar` + `bottle_set` + `menu_easel` (+ the menu panel) +
  `lilac_cluster`; `hightop` ×8, `parasol_round` + `parasol_round_canopy` (tinted
  teal) ×3, `canape_table`. KEEP: the cocktail glassware rows on the bar, the festoon
  poles + `stringLights`.
- **Dinner**: `round_table` + `centrepiece_low` + `crossback_chair` ×8 per round (the
  tapers/flames/glasses stay instances), `long_table` (rotate for axis 'z'),
  `candelabra` + `candelabra_flames` on the existing poles, `head_table` + 6 chairs.
  KEEP: festoon, the dance floor, the two point lights.
- **Prewedding setup**: `hightop` ×7, `menu_easel` as the welcome easel,
  `champagne_tower` (delete the `glassy`/transmission coupes — that material forces a
  third campus render inside the mirror pass; measure the mirror calls before/after
  at the setup spawn and report them).
- **After party**: `dj_booth` + `dj_booth_facia`, `speaker` ×2, `mirror_ball` (keep
  the rotation ticker), `lounge_sofa` ×3.
- **Welcome brunch**: `buffet_run`, `champagne_service`, `menu_easel`; the four-tops
  and their chairs are campus.js's and stay. Everything here is `__world` — the GLB
  instances ride the brunch group, which is already `worldSpace`.

Colliders do not move: every asset was sized to the old prop's footprint. If a GLB's
`models.json` extents disagree with a collider by more than 0.15 m, fix the
generator, not the collider.

## 5 · Draw-call accounting

Before (spawn views, `reference/photos/shots-before/stats.json`): ceremony 58 calls,
cocktail 213, dinner 195, afterparty 398, setup 448, brunch 567. Each GLB kind adds at
most ONE call per moment it appears in (one InstancedMesh), so the ceremony gains
roughly +20 and loses the buckets it no longer fills. Report the same 16 views after
(`TAG=after node tools/shoot-moments.mjs`) beside the before numbers. Triangles will
rise; that is the trade, as it was in the decor pass — say by how much.

Program count: it may settle at a NEW constant (the GLB materials are
MeshStandardMaterial+map, mostly one shared program), but it must be the SAME number
at all six moments and both lighting states after the warm-up. A number that moves
between moments means a material compiled outside the warm-up.

## 6 · The art plates (`assets/art/`)

- `welcome-board-art.webp` is the board's face art (florals, no text). `texWelcomeSign()`
  draws it as the base layer, then the existing lettering ("Welcome to our wedding",
  "Carl & Rachel", "2027.03.20") on top. The image loads async: draw the text-only
  version first, and on `img.onload` redraw with the art underneath and set
  `tex.needsUpdate = true`.
- `menu-drinks.webp` is RGBA: four watercolour drinks in a 2×2 grid. `texCocktailMenu()`
  composites each quadrant beside its name in the existing layout, same async pattern.
  The drink names and 鸡尾酒 / Wedding Cocktails header are the game's copy — unchanged.
- Nothing else in the game reads `assets/art/`.

## 7 · Verification before "done"

1. `node --experimental-default-type=module --check js/moments.js js/main.js`.
2. Headless boot (Playwright, `--use-angle=metal`): zero page errors, zero console
   errors/warnings — a `models:` warning means a GLB failed to load; fix it.
3. `TAG=after node tools/shoot-moments.mjs` — every view, then LOOK at each PNG next to
   `shots-before/` and describe what changed. A prop that is the wrong size, floating,
   sunk, facing away, or in the enclave origin is a failure a stats table will not show.
4. `python3 serve.py 8803 & node tools/guest-journey.mjs` — 0 stalls, every beat, feet
   exact, zero errors.
5. Program count constant across the six moments and both N-toggles.
6. Mirror calls at the setup spawn before/after (the champagne-tower transmission fix).
