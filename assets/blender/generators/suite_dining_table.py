"""suite_dining_table — the suite's 3.0 x 1.2 espresso dining table.

Source: js/suite.js:950-953 (`buildGreatRoom`, the dining end), with
`dx = DINING_X` and `dz = -19.5`:

  top    MT.espresso       dx +-1.50, y .70 .. .77, dz +-.60
  leg W  MT.espressoPlain  dx -1.05 .. dx -.55, y 0 .. .70, dz +-.42
  leg E  MT.espressoPlain  dx  +.55 .. dx +1.05, y 0 .. .70, dz +-.42

  3.000 W x 1.200 D x 0.770 H     (legs 0.50 x 0.84, centred at x +-0.80)
  origin  floor centre, exact — the top and both legs are symmetric about
          (dx, dz) — so a drop-in sits at `x = dx`, `y = 0`, `z = dz`, `ry = 0`.
  front   -Z; symmetric on both axes, so the front is nominal.

⚠ suite.js is MIRRORED (its 1a): the call site reflects x through `mx()`. The
table is symmetric about its own X centre plane, so the reflection is a no-op on
the shape and ry = 0 is its own negative.

⚠ THE COLLIDER IS `colRect(DINING_X +-1.50, -20.1, -18.9, r .36)`
(js/suite.js:1599) — i.e. measured on the TOP's 3.00 x 1.20 footprint, not on
the legs. Nothing here may exceed that footprint, and nothing does.

Eight `dining_chair_white` sit at `cx = dx - 1.12 + i * .75` on z = dz +- 1.05
(js/suite.js:954-958), so the legs' 0.84 m depth and the 2.10 m chair gauge are
what keep the plinths clear of eight pairs of knees. Unchanged.

DELIBERATE DEVIATION, argued: **the plinth legs are RIBBED and the code's are
plain.** `MT.espresso` (the ribbed `texEspresso` canvas, js/suite.js:395) is on
the TOP, whose 70 mm edge can hold two ribs at most, while `MT.espressoPlain` is
on the two big masses a seated guest's knee is 100 mm from. Ribbing the legs and
leaving the top's edge as one clean band is the same finish family, read at the
distance it is actually read from; the reveals are INSET, never proud, so both
0.50 x 0.84 footprints are untouched. A 16 mm recessed apron under the top is
added for the same reason — at 3 m long, a flush 70 mm slab reads as cardboard.
The rib pitch is 39 mm, within a rib of `coffee_table`'s 33 mm, so the two read
as one set — and both are deliberately coarser than `texEspresso`'s drawn
~11 mm, which is a micro-texture rather than geometry (argued in full in
`coffee_table.py`).
"""
import wv_lib as L
import _interior as I

NAME = "suite_dining_table"
ATLAS = 512
BEVEL = 0                 # per part: only the top slab is bevelled
AO_DIST = 0.15            # a 3 m top over two plinths — an enclosed underside
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"
MAT_NAME = "suite_dining_table"

TOP_W, TOP_D = 3.00, 1.20         # suite.js:951
TOP_Z0, TOP_Z1 = 0.70, 0.77
LEG_W, LEG_D = 0.50, 0.84         # suite.js:952-953
LEG_X = 0.80                      # (1.05 + .55) / 2


def build():
    esp = I.espresso("espresso_rib", roughness=0.42)
    parts = []

    for sx in (-1, 1):
        parts += I.ribs(f"leg{sx}", LEG_W, LEG_D, sx * LEG_X, 0, 0.0, TOP_Z0, esp,
                        bands=15, reveal=0.007, inset=0.011)

    # a recessed apron so the 70 mm top edge floats instead of sitting flush
    parts.append(L.box("apron", (TOP_W - 0.09, TOP_D - 0.09, 0.016),
                       (0, 0, TOP_Z0 - 0.008), esp))
    top = I.pad("top", TOP_W, TOP_D, 0, 0, TOP_Z0, TOP_Z1, 0.026, esp, k=5)
    L.bevel([top], width=0.006, segments=2, angle=40, min_size=0.03)
    parts.append(top)

    for o in parts:
        I.metric_uv(o, 0, 1 if o is top else 2, tile=0.45)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=38)
    return root
