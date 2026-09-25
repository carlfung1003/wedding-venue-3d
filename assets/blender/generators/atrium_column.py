"""atrium_column — the atrium's black stone column, one prototype for all 18
(KAN-211 wave B; clubhouse-atrium.jpeg, atrium-water-feature.jpg).

Replaces atrium.js's `mkBox(COL, H2, COL)` shaft + its two bronze bands. The
photo's columns are near-black honed stone, plain-faced, standing on a SQUARE
STEPPED PLINTH (the gallery column at the right of clubhouse-atrium.jpeg); the
cladding is laid in courses whose joints catch the light as fine lines.

Here, in the column's own frame (origin at the foot centre, y up, the square
section centred on the axis — atrium.js stands one instance on every colPts
point, identity rotation):
  · plinth   0.84 sq × 0.10 over 0.72 sq × 0.08 (y 0 … 0.18), bevelled
  · shaft    COL (0.56) square, clad in 0.9 m courses — each course its own
             box 8 mm short of the next, over a 0.545 joint core, so every
             joint is a real recessed line; a 6 mm bevel lets each course's
             arrises catch a highlight
  · capital  a 0.66 sq × 0.10 honed block + a 0.60 sq × 0.03 shadow fillet
             under each soffit (y SOF1 and SOF2 minus the soffit boards'
             22 mm, so the capital meets the timber, not the slab behind it)
  · 2F base  a 0.66 sq × 0.07 collar where the column comes up through the
             upper gallery's deck at H1
Collider untouched (atrium.js: r = colR + .18 = 0.46 at every colPts point).
"""
import wv_lib as L
import _arch as A

NAME = "atrium_column"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.5
TRIS = 2200
FRONT = "-Z"
ORIGIN = "floor"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"at_joint": 0.05}

BOARD = 0.022          # the soffit boards' depth (atrium_soffit_panel)


def _sq(parts, name, half, y0, y1, key, bev=0.0):
    b = A.box(name, -half, half, y0, y1, -half, half, key)
    if bev:
        L.bevel([b], width=bev, segments=1)
    parts.append(b)
    return b


def build():
    T = A.atrium()
    H1, H2, SOF1, SOF2 = T["H1"], T["H2"], T["SOF1"], T["SOF2"]
    C = T["colR"] * 2                           # 0.56
    with A.frame("local"):
        parts = []
        # the plinth
        _sq(parts, "plinth0", 0.42, 0.0, 0.10, "at_col_b", 0.008)
        _sq(parts, "plinth1", 0.36, 0.10, 0.18, "at_col_b", 0.008)
        # the joint core, full height (hidden but for the joints)
        _sq(parts, "core", C / 2 - 0.008, 0.18, H2 - 0.35, "at_joint")
        # the cladding courses: ground storey 0.18 → SOF1, upper H1 → SOF2
        for s, (ya, yb) in enumerate(((0.18, SOF1 - BOARD - 0.13), (H1 + 0.07, SOF2 - BOARD - 0.13))):
            n = max(1, round((yb - ya) / 0.9))
            for i in range(n):
                y0 = ya + (yb - ya) * i / n
                y1 = ya + (yb - ya) * (i + 1) / n - 0.008
                _sq(parts, f"course{s}_{i}", C / 2, y0, y1, "at_col", 0.006)
        # capitals under each soffit
        for s, top in enumerate((SOF1 - BOARD, SOF2 - BOARD)):
            _sq(parts, f"fillet{s}", 0.30, top - 0.13, top - 0.10, "at_black")
            _sq(parts, f"cap{s}", 0.33, top - 0.10, top, "at_col_b", 0.008)
        # the collar where the column rises through the 2F deck
        _sq(parts, "collar", 0.33, H1, H1 + 0.07, "at_col_b", 0.008)
        # the shaft through the slabs (hidden, keeps the silhouette closed)
        _sq(parts, "slab1", C / 2, SOF1 - BOARD, H1, "at_joint")
        _sq(parts, "slab2", C / 2, SOF2 - BOARD, H2, "at_joint")
        return L.join(parts, NAME, origin=None)
