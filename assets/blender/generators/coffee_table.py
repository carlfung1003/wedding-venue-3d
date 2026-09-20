"""coffee_table — the great room's big ribbed espresso coffee table.

Source: js/suite.js:938-940, on the pool side of the sofa island
(`sx = LIVING_X`, `sz = -21.2`):

  base  MT.espresso       sx +-1.30, y .32 .. .60, sz +.90 .. sz +1.90
  top   MT.espressoPlain  sx +-1.34, y .58 .. .63, sz +.86 .. sz +1.94

  2.680 W x 1.080 D x 0.310 H
  origin  floor centre = **the sofa island's plinth top face** (the table stands
          on the plinth, not the marble), so a drop-in sits at
          `x = sx`, `y = 0.32`, `z = sz + 1.40`, `ry = 0`.
  front   -Z; the piece is symmetric on both axes, so the front is nominal.

⚠ suite.js is MIRRORED (its 1a): the call site reflects x through `mx()`. The
table is symmetric about its own X centre plane, so the reflection is a no-op on
the shape and ry = 0 is its own negative.

⚠ It carries NO collider of its own — `colRect(LIVING_X +-2.85, -23.05 .. -19.35,
r .22)` (js/suite.js:1598) rings the whole island at the plinth, and the table
sits inside it. Nothing to preserve but the silhouette.

THE RIBS ARE GEOMETRY, and they have to be. `MT.espresso` is `texEspresso`
(js/suite.js:395), a canvas of fine HORIZONTAL ribs — a 3 px black groove every
10 px over a #2b1d16 ground. There is no ribbed file in `textures/gen`, and the
atlas bake resolves whatever picture a part carries into albedo, so a rib that
is only in a map cannot be added later. Seven proud bands with six 8 mm recessed
reveals between them fill the base's 0.28 m exactly; the reveals are INSET,
never proud, so the 2.60 x 1.00 envelope is untouched.

⚠ **THE RIB PITCH IS A DELIBERATE 33 mm, not the code's ~11.** `texEspresso` is
a 128 x 256 canvas with a groove every 10 px, mapped [2, 1] onto a BoxGeometry
whose v spans the face — so on a 0.28 m base the drawn ribs are 11 mm apart.
That is a micro-texture, not geometry: 25 modelled ribs on a 0.28 m base is the
whole triangle budget spent on something that is sub-pixel from the far side of
a 13 m room. 33 mm is real furniture reeding and reads at guest distance, which
is the scale this asset is judged at. `suite_dining_table` uses the same pitch,
so the two read as one set.

Colour: `dark` gained to about #342520 (see `_interior.ESPRESSO_GAIN`). The
true #2b1d16 came back as a black slab once the AO pass multiplied in, and a
black slab is not ribbed timber; 45 % up is the lowest lift where the ribs still
read at guest distance.

`reference/photos/IMG_8096.jpg` has a round white-marble table on a dark metal
base here instead — but CLAUDE.md's own note on that frame says the sofa
arrangement in it is NOT current, so it is read for FINISH only and the code
wins on form.
"""
import wv_lib as L
import _interior as I

NAME = "coffee_table"
ATLAS = 512
BEVEL = 0                 # per part: only the top slab is bevelled
AO_DIST = 0.15            # an overhanging top over rib reveals — an enclosed interior
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"
MAT_NAME = "coffee_table"

BASE_W, BASE_D = 2.60, 1.00       # suite.js:939
TOP_W, TOP_D = 2.68, 1.08         # suite.js:940
BASE_Z = 0.28                     # .60 - .32
TOP_Z0, TOP_Z1 = 0.26, 0.31       # .58 - .32 , .63 - .32


def build():
    esp = I.espresso("espresso_rib", roughness=0.42)
    parts = []

    # the ribbed drum of the base: 7 proud bands, 6 recessed reveals
    parts += I.ribs("base", BASE_W, BASE_D, 0, 0, 0.0, BASE_Z, esp,
                    bands=7, reveal=0.007, inset=0.010)

    # the plain overhanging top — MT.espressoPlain, no ribs
    top = I.pad("top", TOP_W, TOP_D, 0, 0, TOP_Z0, TOP_Z1, 0.022, esp, k=4)
    L.bevel([top], width=0.006, segments=2, angle=40, min_size=0.03)
    parts.append(top)

    for o in parts:
        I.metric_uv(o, 0, 1 if o is top else 2, tile=0.45)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=38)
    return root
