# Asset pipeline — The Big Day (KAN-207)

Blender-authored props for the wedding venue, baked out to `assets/models/*.glb`
and loaded by `js/models.js`. Nothing is hand-placed in the Blender GUI first: a
**generator script** builds each asset, so the whole set rebuilds from source with
one command. Ported from `~/seventh-floor/assets/blender/` (the mature pipeline)
with the 1960s grime stripped out — this is a beach wedding.

**The contract is [`ASSET_SPEC.md`](ASSET_SPEC.md).** Every dimension, origin,
front, palette key and triangle budget lives there; a GLB that honours its row is a
drop-in for the procedural prop in `js/moments.js`.

## Layout

```
wv_lib.py            primitives, PALETTE (display sRGB → linear in M()), image_mat,
                     planar/cylindrical/spherical uv, join/origin helpers, rng(NAME)
wv_bake.py           clean material families + albedo×AO atlas bake (Cycles, Metal GPU)
generators/*.py      one module per asset: NAME, ATLAS, build()  (+ build_<suffix>())
generators/_template.py   commented starter — copy it
make_masters.py      generators → bevel → unwrap → bake → masters/<name>.blend
export_all.py        masters → ../models/<name>.glb + <name>.meta.json; REBUILDS models.json
derive_lo.py         (KAN-235, SYSTEM python3) ../models/lo/<name>.glb — the phone tier's 1024² twin of every GLB with a 2048² atlas
preview_all.py       masters → ../previews/<name>.webp   (Workbench 3/4 view — shape check)
../../tools/viewer.html      in-engine viewer (the venue's PMREM + ACES + sun rig)
../../tools/shoot-models.mjs Playwright → ../previews/<name>-ingame.png  (LOOK check)
textures/gen/        generated WebP textures (another agent) — read by image_mat()
textures/<name>.png  bake intermediates (gitignored; the atlas is packed into the master)
masters/*.blend      the SOURCE OF TRUTH — Git LFS
```

## Commands

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
cd ~/wedding-venue-3d

# generate + bake every generator → masters/            (first GPU bake compiles Metal
$B --background --factory-startup --python assets/blender/make_masters.py    #  kernels once, ~2 min)
# one or more assets
$B --background --factory-startup --python assets/blender/make_masters.py -- plinth_fluted plinth_rect
# shape-only, no bake (fast geometry iteration)
$B --background --factory-startup --python assets/blender/make_masters.py -- fast=1

# masters → GLB (Draco 6, WebP q80) + sidecars, then models.json from ALL sidecars
$B --background --factory-startup --python assets/blender/export_all.py    # [-- names...]
# …then the PHONE tier's 1024² twins (KAN-235). Re-run after ANY export that touches a
# 2048² atlas; until then models.js serves that GLB's hi file to phones (lo.json records
# which hi bytes + tris each twin came from). --check lists stale / missing, writes nothing.
python3 assets/blender/derive_lo.py            # [--check]

# Workbench previews (shape)                            in-engine screenshots (look)
$B --background --factory-startup --python assets/blender/preview_all.py   # [-- names] [turn=4]
node tools/shoot-models.mjs                            # [names...]  NIGHT=1 for the night rig
python3 ~/blender-assets/scripts/verify_glb.py assets/models/<name>.glb   # one mesh, one material?
# re-grade an already-keyed RGBA foliage map in place (despill + opaque-mean balance; KAN-208 wave 4)
python3 assets/blender/regrade_foliage.py assets/textures/<map>.webp "#44583a"
```

`export_all.py` exits 1 (after exporting everything it can) when a GLB exceeds its
generator's `TRIS`, or is not exactly one mesh / one primitive / one material.
`make_masters.py` prints `OVER BUDGET` early so you do not wait for the export to
find out.

## Conventions the game relies on

- **Frame.** Blender Z-up; the export is Y-up: Blender (x, y, z) → glTF (x, z, −y).
  Model the FRONT facing **Blender +Y** → it arrives facing **glTF −Z**, which is how
  every extras prop in `moments.js` is authored. The chair family is the one
  exception: `FRONT = "+Z"`, model it facing −Y.
- **Origin.** `join(parts, NAME, origin="floor")` (default) = footprint centre, foot at
  z 0. `origin="hook"` = bbox top, hangs down −Z (chandeliers, the fabric flower, the
  mirror ball's chain). `origin=None` + `origin_to(o, p)` for anything else.
  ⚠ `join()` re-origins to the **bounding box** — adding a part shifts the whole model.
  The game reads real extents from `<name>.meta.json` (`min` + `size`), never guesses.
- **One GLB = one mesh = one material.** The bake collapses everything to a single
  atlas so the game can `InstancedMesh(geometry(name), material(name), n)`. A part
  that needs a different material CLASS is its own asset via `build_<suffix>()` →
  `<NAME>_<suffix>` (`candelabra_flames`, `dj_booth_facia`, `parasol_round_canopy`),
  same origin. Mixing an emissive key with lit ones in one asset is an ERROR in
  `apply_baked`, not a second material.
- **Material names mean something** (the loader keys on them). The baked material is
  named `MAT_NAME` if the generator sets it, else the sole palette key when the asset
  used one key (`paint_w`, `flute`, `mirror`, `canopy_tint`, `flame_emit`…), else the
  asset name. `*_emit` stays emissive; `mirror` → metal 1 / rough .12; `canopy_tint`
  → white albedo the game tints; `crystal` → the faint blue glow `moments.js` uses.
  Roughness/metalness of the baked material come from the key covering the most faces.
- **Palette.** `wv_lib.PALETTE` is the ASSET_SPEC table (display sRGB); `M(key)`
  converts to linear. Writing sRGB straight into a socket ships pastel GLBs. `M()`
  also sets `diffuse_color`, or Workbench previews render grey.
- **Textures on models.** `image_mat(name, "file.webp", roughness, fallback=key)` +
  `planar_uv` / `cylindrical_uv` / `spherical_uv(obj)` write a SECOND uv layer
  (`art`) that the atlas unwrap leaves alone; the bake resolves the picture into the
  atlas and the `art` layer is dropped before export. Paths resolve to
  `textures/gen/`. **A missing file never fails the build** — `image_mat` prints
  `WARN … falling back to flat palette 'key'` and returns `M(key)`. A baked model
  cannot take a new texture afterwards: what the game letters (the dessert sign,
  the menu board) is a game-built plane a few mm proud of a plain surface.
- **Finish families** (`wv_bake.FAMILY`) are clean: `linen`/`cloth` fine weave, `wood`
  grain + faint tone drift (no blotch), `paint` clean + faint edge lightening, `metal`
  brushed, `straw` weave, `stone` speckle, `leaf` tone drift; `glass`, `bloom`, `emit`
  untouched. The universal cavity-dirt term seventh-floor has is deliberately gone.
- **Per-generator knobs.** `ATLAS` 256/512/1024 · `BEVEL` metres (0 on cloth, florals,
  beads — bevels ~4× faces; note the module bevel runs on the JOINED mesh at every
  edge ≥ 40°, so bevel individual parts with `L.bevel([part], …)` when that is wrong,
  as `plinth_fluted` does) · `AO_DIST` 0.5 (0.15 for enclosed interiors — room-scale
  AO bakes them black) · `AO_STRENGTH` 0.5 · `TRIS` · `FRONT` · `ORIGIN` · `MAT_NAME`.
  · `UV_WEIGHT` `{material name: factor}` — scales those faces' atlas islands before
  the pack, so a flat part (the island bar's sand terrace, `0.30`) cedes texels to a
  photographed one (its thatch). Islands otherwise split the atlas by 3-D area.
- **Determinism.** `rnd = L.rng(NAME)`; `jitter(o, amount, rnd)`. Never `random.random()`.
- **Bake device.** Cycles picks the Apple GPU (Metal) and falls back to CPU if the
  device is missing or a bake throws. The FIRST GPU bake of a session compiles Metal
  kernels (~130 s, cached afterwards); every bake after that is ~1 s at 256 px.

## Sidecars + manifest

`export_all.py` writes `assets/models/<name>.meta.json`:

```json
{"bytes": 25781, "tris": 1000, "size": [1.0, 1.0, 1.0], "min": [-0.5, 0.0, -0.5],
 "front": "-Z", "origin": "floor", "material": "flute"}
```

(`size`/`min` in glTF Y-up metres.) Then it rebuilds `models.json` from **every**
sidecar present, so four agents exporting concurrently cannot clobber each other —
the last writer still produces a complete manifest.

## The loader — `js/models.js`

```js
import * as models from './models.js';
await models.preload((p, name, ok) => …);      // 0..1; fetches models.json cache:'no-cache'
models.has('crossback_chair')                   // true only if the GLB loaded
models.info('crossback_chair')                  // the sidecar {bytes,tris,size,min,front,origin}
models.get('round_table')                       // Object3D clone (shared geometry/material)
models.place(parent, 'hightop', x, y, z, ry, s) // clone, positioned, added
models.geometry('crossback_chair')              // the ONE shared BufferGeometry …
models.material('crossback_chair')              // … and Material, for
new THREE.InstancedMesh(models.geometry(n), models.material(n), 60)
```

`prepare()` sets `castShadow = false`, `receiveShadow = true` (the current props'
settings), anisotropy 8, `fog = true`, and applies the material-name rules above. A
GLB with more than one mesh makes `geometry()`/`material()` warn and return `null`.
A missing model, a 404 manifest, a failed decode — all warn and return `null`, so
call sites fall back to their old primitives. Paths resolve against the module URL,
so `tools/viewer.html` reads the same files as `index.html`. Draco decoder:
`https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/` (`type:'js'`).

## Verification

`preview_all.py` is for **shape** (Workbench, no PBR). The look check is
`node tools/shoot-models.mjs` — `tools/viewer.html` under the venue's own renderer
(same importmap, PMREM RoomEnvironment, ACES, sRGB, the 0xffd7a2 key at 2.1 with
shadows, hemisphere fill, a 12 m sage ground disc with 1 m rings), framed 3/4 from
the front at guest distance, slow turntable, `?night=1` for the night rig, `?cast=0`
to drop the viewer-only ground shadow (the loader ships `castShadow = false`). It
reuses `serve.py 8803` if it is up, launches it otherwise, runs Chromium on Metal
ANGLE (SwiftShader is useless for this), and prints every console error.
`window.__viewer = { ready, isReady, frame(name), errors }` is the readiness signal.

## Repo hygiene

`masters/*.blend` and `assets/art_raw/**` are Git LFS (`.gitattributes`; `git lfs
install --local` has been run in this clone). Gitignored: `refsheets/`, `art_raw/`,
`__pycache__/`, `assets/previews/`, `textures/*.png`, `masters/*.blend1`.
`.vercelignore` keeps `assets/blender/`, `assets/previews/`, `tools/` and the
reference media off the CDN — and because a `.vercelignore` REPLACES `.gitignore`
for CLI deploys, it repeats every `.gitignore` entry.
