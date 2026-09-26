"""breakfast_buffet — the 酒廊's buffet / service counter (KAN-211 wave D).

campus.js buildArrival §D: a dark teak box 3.8 × 1.0 × .8 (arrCounterI), a
marble top 4.0 × .07 × .95 at y 1.03 (arrCounterTopI) and four white bowls
(arrWareI Ø .34 × .16 at y 1.14, x −1.4 … +1.45). Now: a fluted dark oak
front (vertical reeds), a toe recess, a honed pale stone top with an eased
edge, and on it the breakfast: two chafing dishes (steel, domed lids) on
their stands, a tiered cake stand, a fruit bowl, a juice jug pair and a stack
of plates. The emissive strip behind it (loungeGlowI) stays the game's.
Same envelope; rectCollider(4.2 × 1.1) untouched. Origin floor centre;
front −Z (the room side — bufZ is the room's south edge).
"""
import math
import wv_lib as L
import _arch  # noqa: F401

NAME = "breakfast_buffet"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.15
AO_STRENGTH = 0.55
TRIS = 3500
FRONT = "-Z"
ORIGIN = "floor"


def B(x, y, z):
    return (x, -z, y)


def bx(name, x0, x1, y0, y1, z0, z1, mat, bev=0.0):
    o = L.box(name, (x1 - x0, z1 - z0, y1 - y0), B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat)
    if bev:
        L.bevel([o], width=bev, segments=2)
    return o


def build():
    parts = []
    # carcass + toe recess
    parts.append(bx("toe", -1.85, 1.85, 0, .10, -.33, .38, "at_black"))
    parts.append(bx("body", -1.9, 1.9, .10, 1.0, -.40, .40, "bk_oak"))
    # the fluted front: reeds across the room face (−z)
    n = 38
    for i in range(n):
        x = -1.9 + 3.8 * (i + .5) / n
        parts.append(L.cyl(f"reed{i}", .045, .86, B(x, .56, -.40), "bk_oak", n=8))
    # the stone top
    parts.append(bx("top", -2.0, 2.0, 1.0, 1.07, -.475, .475, "stone", bev=.01))
    y = 1.07
    # two chafing dishes: stand, pan, domed lid
    for i, x in enumerate((-1.35, -.45)):
        parts.append(bx(f"stand{i}", x - .30, x + .30, y, y + .10, -.18, .18, "steel"))
        parts.append(bx(f"pan{i}", x - .28, x + .28, y + .10, y + .17, -.17, .17, "steel_l", bev=.01))
        lid = L.uv_sphere(f"lid{i}", .30, B(x, y + .17, 0), "steel_l", seg=16, rings=6)
        lid.scale = (1.0, .58, .38)
        parts.append(lid)
        parts.append(L.cyl(f"knob{i}", .025, .03, B(x, y + .30, 0), "steel", n=10))
    # tiered cake stand
    x = .45
    parts.append(L.cyl("cs_stem", .012, .42, B(x, y + .21, 0), "steel_l", n=8))
    for k, (r, hy) in enumerate(((.17, .03), (.13, .20), (.09, .36))):
        parts.append(L.cyl(f"cs_t{k}", r, .012, B(x, y + hy, 0), "bk_china", n=20))
        parts.append(L.cyl(f"cs_c{k}", r * .7, .05, B(x, y + hy + .03, 0), "cream", n=12))
    # fruit bowl
    parts.append(L.cyl("fbowl", .16, .09, B(1.05, y + .045, -.05), "bk_china", n=18, r2=.10))
    for k in range(6):
        a = k * math.tau / 6
        parts.append(L.sphere(f"fruit{k}", .045, B(1.05 + .07 * math.cos(a), y + .11, -.05 + .07 * math.sin(a)),
                              ("rind", "grapefruit", "coconut")[k % 3], sub=1))
    # juice jugs
    for k, (x, c) in enumerate(((1.55, "rind"), (1.72, "grapefruit"))):
        parts.append(L.cyl(f"jug{k}", .055, .24, B(x, y + .12, .12), c, n=14, r2=.045))
        parts.append(L.cyl(f"jugrim{k}", .047, .03, B(x, y + .255, .12), "glass_pale", n=14))
    # a stack of plates
    parts.append(L.cyl("plates", .12, .08, B(1.62, y + .04, -.18), "bk_china", n=20))
    return L.join(parts, NAME)
