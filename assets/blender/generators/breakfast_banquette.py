"""breakfast_banquette — one 3.4 m run of the 酒廊's banquette along its buried
east wall (KAN-211 wave D).

campus.js buildArrival §D: two ivory boxes per bay — a seat 1.1 deep × .48
at x B.x1 − 1.0, a .2 × .62 back at B.x1 − .55 (y .47 … 1.09), 3.4 m along z.
Now: a dark oak plinth recessed under an upholstered seat with a front welt, a
channel-tufted back (seven vertical channels, the stitching as real grooves)
on a timber cap, and bolster ends. Same envelope, so the banquette's collider
line (x B.x1 − 1.6) and the tables' rectColliders are untouched.
Local frame: x across the seat (+x = the wall), z along the run; origin floor
at the SEAT's centre (the primitive's registration point) — the bbox is
symmetric about it (x −.55 … +.55), so join()'s re-origin lands exactly there.
"""
import wv_lib as L
import _arch  # noqa: F401

NAME = "breakfast_banquette"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.15
AO_STRENGTH = 0.55
TRIS = 1600
FRONT = "-Z"
ORIGIN = "floor"
LEN = 3.4


def B(x, y, z):
    """glTF-ish local (x, y up, z) → Blender (x, −z, y)"""
    return (x, -z, y)


def bx(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0):
    o = L.box(name, (x1 - x0, z1 - z0, y1 - y0), B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat)
    if bev:
        L.bevel([o], width=bev, segments=2)
    return o


def build():
    parts = []
    h = LEN / 2
    # plinth, recessed 60 mm
    parts.append(bx("plinth", -.49, .35, 0, .16, -h + .04, h - .04, "bk_oak"))
    # the seat cushion, eased, with a front welt
    parts.append(bx("seat", -.53, .35, .16, .46, -h, h, "bk_linen", bev=.03))
    parts.append(bx("welt", -.55, -.53, .24, .44, -h + .02, h - .02, "bk_linen", bev=.008))
    # the back: a timber cap over seven channel-tufted pads
    parts.append(bx("backcore", .35, .55, .46, 1.02, -h, h, "bk_linen"))
    n = 7
    for i in range(n):
        za = -h + .03 + (LEN - .06) * i / n + .012
        zb = -h + .03 + (LEN - .06) * (i + 1) / n - .012
        parts.append(bx(f"pad{i}", .23, .36, .50, 1.00, za, zb, "bk_linen", bev=.035))
    parts.append(bx("cap", .30, .55, 1.02, 1.09, -h, h, "bk_oak", bev=.01))
    # bolster ends
    for s in (-1, 1):
        za, zb = sorted((s * h, s * (h - .08)))
        parts.append(bx(f"end{s}", -.55, .55, .16, .70, za, zb, "bk_oak", bev=.01))
    return L.join(parts, NAME)
