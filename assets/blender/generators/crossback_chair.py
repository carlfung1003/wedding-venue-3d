"""crossback_chair — the wooden cross-back (X-back) event chair. THE hero: 60 at
the ceremony, 70 at dinner, always seen at 1–3 m.

Spec row (ASSET_SPEC.md, Group A): 0.46 W × 0.44 D; seat top y .48 (.05 thick);
front legs at glTF z +.185, x ±.205, Ø .038; back stiles at z −.195 to y 1.00;
top rail y .975 (.45 × .075 × .05); lower rail y .60 (.40 × .05 × .04); the X:
two members .54 × .045 × .032 crossing at y .788 / z −.205 at ±0.733 rad; side
stretchers y .17. FRONT = "+Z" (the chair family's exception) → modelled facing
Blender −Y: front legs at y −.185, back stiles at y +.195.

What the sheet (refsheets/crossback_chair.png) adds beyond the box model:
- legs are swept tubes that taper toward the foot and splay 1 cm outward;
- the back stiles are ONE bent member, floor → top rail, raking 8 mm back
  above the seat (kept inside the 0.44 D contract);
- the top rail is a bullnosed rounded-rectangle bar with an 8 mm plan bow;
- the X is two bars HALVED at the crossing (boolean), flush in one plane;
- the seat is a lofted slab: rounded front corners, a 12 mm soft top edge;
- an H of stretchers: two sides at .17, front + rear at .21.
Grain: `textures/gen/oak_light.webp` via a metric planar projection per part
(grain along each member); a missing file falls back to flat `oak`.
"""
import math, bmesh
import bpy
from mathutils import Vector
import wv_lib as L
import _seating as S

NAME = "crossback_chair"
ATLAS = 256
BEVEL = 0             # the module bevel would round every 45° edge of the 8-gon legs (×4 faces);
                      # the rails and the X get their own bevel below
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1800
FRONT = "+Z"
ORIGIN = "floor"

OAK_TEX = "oak_light.webp"
TILE = 0.40           # metres per repeat of the grain picture

# ---- the numbers (Blender frame: x across, y depth with the FRONT at -Y, z up)
LEG_X = 0.205
FRONT_Y = -0.185
BACK_Y = 0.195
SEAT_TOP, SEAT_T = 0.48, 0.05
SEAT_FRONT, SEAT_BACK = -0.21, 0.215
LEG_R = 0.019
RAKE = 0.008          # how far the top of the back leans behind the seat-level stile
TOP_Z, TOP_H, TOP_D = 0.975, 0.075, 0.044
LOW_Z, LOW_H, LOW_D = 0.60, 0.05, 0.044
X_LEN, X_W, X_T, X_Z, X_ANG = 0.54, 0.045, 0.032, 0.788, 0.733
X_Y = 0.200


def _rake(z):
    """The back's lean above the seat: 0 at seat level, RAKE at the top."""
    if z <= SEAT_TOP - SEAT_T:
        return 0.0
    t = (z - (SEAT_TOP - SEAT_T)) / (1.0 - (SEAT_TOP - SEAT_T))
    return RAKE * t ** 1.5


# ---------------------------------------------------------------- helpers
_sweep, _circle, _rrect = S.sweep, S.circle, S.rrect


def _metric_uv(o, ua, va, local=False):
    return S.metric_uv(o, ua, va, tile=TILE, local=local)


def _shear_back(o):
    """Push a back part's vertices behind by the rake at their height."""
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    inv = mw.inverted()
    for v in o.data.vertices:
        w = mw @ v.co
        w.y += _rake(w.z)
        v.co = inv @ w


# ---------------------------------------------------------------- parts
def _front_leg(sx, mat):
    zs = [0.0, 0.12, 0.25, 0.36, 0.445]
    rs = [0.0145, 0.016, 0.0175, 0.0185, LEG_R]
    cs, secs = [], []
    for z, r in zip(zs, rs):
        t = 1.0 - z / 0.445
        cs.append(Vector((sx * (LEG_X + 0.010 * t * t), FRONT_Y - 0.008 * t * t, z)))
        secs.append(_circle(r))
    return _sweep("front_leg", cs, secs, mat)


def _back_stile(sx, mat):
    zs = [0.0, 0.15, 0.30, 0.43, 0.56, 0.70, 0.84, 0.94, 0.995]
    rs = [0.016, 0.0175, 0.0185, LEG_R, LEG_R, 0.018, 0.017, 0.016, 0.0155]
    cs, secs = [], []
    for z, r in zip(zs, rs):
        t = max(0.0, 1.0 - z / 0.43)
        cs.append(Vector((sx * (LEG_X + 0.008 * t * t), BACK_Y + _rake(z), z)))
        secs.append(_circle(r))
    return _sweep("back_stile", cs, secs, mat)


def _top_rail(mat):
    half = 0.225
    xs = [-half, -0.219, -0.210, -0.19, -0.13, -0.065, 0.0, 0.065, 0.13, 0.19, 0.210, 0.219, half]
    cs, secs = [], []
    for x in xs:
        s = 0.30 if abs(x) >= half - 1e-6 else (0.68 if abs(x) > 0.215 else (0.94 if abs(x) > 0.205 else 1.0))
        bow = 0.008 * (1.0 - (x / half) ** 2)           # the plan curve: centre 8 mm behind the ends
        cs.append(Vector((x, BACK_Y + bow, TOP_Z)))
        secs.append(_rrect(TOP_D, TOP_H, 0.016, s))
    return _sweep("top_rail", cs, secs, mat, plane="yz")


def _seat(mat):
    """Lofted slab: outline at the bottom, the same at the top-edge, an inset ring on top."""
    fx, bx = 0.23, 0.225
    rc = 0.055
    pts = []
    # front-right corner arc (y from front + rc up to the straight front) … go clockwise from the back-left
    pts.append((-bx, SEAT_BACK)); pts.append((bx, SEAT_BACK))
    # right side down to the front-right arc
    for k in range(6):                       # arc centre (fx - rc, SEAT_FRONT + rc), from 0° to -90°
        a = math.radians(-k * 18.0)
        pts.append((fx - rc + math.cos(a) * rc, SEAT_FRONT + rc + math.sin(a) * rc))
    for k in range(6):                       # front-left arc, -90° to -180°
        a = math.radians(-90.0 - k * 18.0)
        pts.append((-(fx - rc) + math.cos(a) * rc, SEAT_FRONT + rc + math.sin(a) * rc))
    bm = bmesh.new()
    z0, z1, z2 = SEAT_TOP - SEAT_T, SEAT_TOP - 0.011, SEAT_TOP
    inset = 0.012
    rings = []
    for (z, ins) in ((z0, 0.0), (z1, 0.0), (z2, inset)):
        ring = []
        for (x, y) in pts:
            kx = 1.0 - ins / fx
            ky = 1.0 - ins / SEAT_BACK
            ring.append(bm.verts.new((x * kx, y * ky, z)))
        rings.append(ring)
    n = len(pts)
    for j in range(2):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            bm.faces.new([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]])
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return L.from_bmesh("seat", bm, (0, 0, 0), mat)


def build():
    L.rng(NAME)
    # the picture is tinted so its mean lands on `oak` c3a37c — the palette is the contract
    oak = S.tex("oak_grain", OAK_TEX, roughness=0.72, fallback="oak", tint_to="oak")
    parts = []

    # legs + stiles (swept, tapered, splayed)
    for sx in (-1, 1):
        fl = _front_leg(sx, oak); _metric_uv(fl, 1, 2); parts.append(fl)
        bs = _back_stile(sx, oak); _metric_uv(bs, 1, 2); parts.append(bs)

    # seat
    seat = _seat(oak); _metric_uv(seat, 0, 1); parts.append(seat)

    # top rail (bullnosed, bowed, raked with the stiles)
    tr = _top_rail(oak); _shear_back(tr); _metric_uv(tr, 2, 0); parts.append(tr)

    # lower back rail
    lr = L.box("low_rail", (0.40, LOW_D, LOW_H), (0, BACK_Y, LOW_Z), oak)
    L.bevel([lr], width=0.005, segments=2, angle=40, min_size=0.02)
    _shear_back(lr); _metric_uv(lr, 2, 0); parts.append(lr)

    # the X: two halved members crossing in one plane
    dx, dz = math.sin(X_ANG) * X_LEN / 2, math.cos(X_ANG) * X_LEN / 2
    members = []
    for s in (-1, 1):
        a = (-s * dx, X_Y, X_Z - dz)
        b = (s * dx, X_Y, X_Z + dz)
        members.append(L.bar(f"x_member{s}", a, b, X_W, X_T, oak))
    for i, s in enumerate((-1, 1)):
        # cut the crossing: this member loses its FRONT (i=0) / BACK (i=1) half where the other passes
        o = -s
        ca = (-o * dx * 0.3, X_Y + (-1 if i == 0 else 1) * X_T / 4, X_Z - dz * 0.3)
        cb = (o * dx * 0.3, X_Y + (-1 if i == 0 else 1) * X_T / 4, X_Z + dz * 0.3)
        cutter = L.bar("cut", ca, cb, X_W + 0.002, X_T / 2 + 0.002, oak)
        L.boolean(members[i], cutter)
    for m in members:
        L.bevel([m], width=0.003, segments=2, angle=40, min_size=0.02)
        _shear_back(m); _metric_uv(m, 0, 2, local=True); parts.append(m)

    # stretchers: an H (two sides) plus a front and a rear rail
    for sx in (-1, 1):
        st = L.strut("side_stretcher", (sx * 0.208, FRONT_Y - 0.004, 0.17), (sx * 0.206, BACK_Y, 0.17), 0.011, oak, n=8)
        _metric_uv(st, 0, 1); parts.append(st)
    fs = L.strut("front_stretcher", (-0.209, FRONT_Y - 0.003, 0.21), (0.209, FRONT_Y - 0.003, 0.21), 0.011, oak, n=8)
    _metric_uv(fs, 2, 0); parts.append(fs)
    rs = L.strut("rear_stretcher", (-0.206, BACK_Y, 0.21), (0.206, BACK_Y, 0.21), 0.011, oak, n=8)
    _metric_uv(rs, 2, 0); parts.append(rs)

    # authored about the spec's own origin (floor centre between the legs): keep it
    root = L.join(parts, NAME, origin=None)
    L.shade_smooth(root, angle=50)      # 8-gon legs (45°) smooth, box edges (90°) sharp
    return root
