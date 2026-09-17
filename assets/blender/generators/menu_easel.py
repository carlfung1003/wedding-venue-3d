"""menu_easel — the white leaning menu easel (decor-cocktail-bar.jpg, left; also the
prewedding welcome easel).

Spec row: board .90 W × 1.26 H × .045, centre at y .88, leaning back .16 rad; three
oak legs Ø .04 × 1.24 (tripod, one behind). Board face BLANK — the game hangs its
.78 × 1.10 menu plane 3 cm proud. Origin floor centre under the board; front −Z.
Budget 1,200 / 256 / bevel .003.

The two front legs run parallel to the board just behind it, joined by a top rail
and a lower stretcher; the rear leg hinges off the top rail and splays back. A
shallow ledge on the board's bottom edge holds the menu — its top (y ≈ .29) sits
below the game's plane (bottom at y .33), so the two never meet.

Deviation (declared): the rear leg is 1.31 long, not 1.24 — at 1.24 its foot would
be only .22 behind the hinge, a tripod that reads as about to fall over.
"""
import math
import wv_lib as L

NAME = "menu_easel"
ATLAS = 256
BEVEL = 0.003
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"

LEAN = 0.16                    # rad, top toward −Y (the back)
BW, BH, BT = 0.90, 1.26, 0.045
BZ = 0.88
LEG_R = 0.02


def _lean(dy, dz, cz=BZ):
    """A point given in the board's leaning frame (dy proud of the board's centre
    plane, dz up along the board) → world."""
    c, s = math.cos(LEAN), math.sin(LEAN)
    return (dy * c - dz * s, dy * s + dz * c + cz)


def build():
    parts = []
    rot = (math.degrees(LEAN), 0, 0)
    # the board, plain and flat on its +Y face
    parts.append(L.box("board", (BW, BT, BH), (0, 0, BZ), "paint_w", rot=rot))
    # the ledge on the bottom front edge
    y, z = _lean(BT / 2 + 0.02, -BH / 2 + 0.02)
    parts.append(L.box("ledge", (BW - 0.04, 0.05, 0.03), (0, y, z), "paint_w", rot=rot))
    # the two front legs, parallel to the board just behind it
    for sx in (-1, 1):
        x = sx * (BW / 2 - 0.05)
        y0, z0 = _lean(-BT / 2 - LEG_R - 0.004, -BZ / math.cos(LEAN))       # foot on the floor
        y1, z1 = _lean(-BT / 2 - LEG_R - 0.004, (1.24 - BZ / math.cos(LEAN)))
        parts.append(L.strut(f"leg{sx}", (x, y0, 0), (x, y1, z1), LEG_R, "oak_easel", n=10))
    # top rail + lower stretcher between the front legs
    y1, z1 = _lean(-BT / 2 - LEG_R - 0.004, (1.24 - BZ / math.cos(LEAN)) - 0.03)
    parts.append(L.box("rail", (BW - 0.10, 0.045, 0.05), (0, y1, z1), "oak_easel", rot=rot))
    ys, zs = _lean(-BT / 2 - LEG_R - 0.004, -BZ / math.cos(LEAN) + 0.32)
    parts.append(L.box("stretcher", (BW - 0.10, 0.035, 0.04), (0, ys, zs), "oak_easel", rot=rot))
    # the rear leg, hinged under the top rail, splayed back
    hy, hz = _lean(-BT / 2 - LEG_R - 0.05, (1.24 - BZ / math.cos(LEAN)) - 0.06)
    parts.append(L.strut("leg_rear", (0, -0.52, 0), (0, hy, hz), LEG_R, "oak_easel", n=10))
    parts.append(L.box("hinge", (0.08, 0.06, 0.05), (0, hy + 0.01, hz), "oak_easel", rot=rot))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
