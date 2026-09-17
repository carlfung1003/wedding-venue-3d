"""fabric_flower — the pale-blue sculpted chiffon bloom hung between the two
towers (`decor-ceremony-main.jpg`, centre).

ASSET_SPEC Group B: ~1.8 m across; inner ring 6 petals (.66–.88 long), outer
ring 8 (1.02–1.24); a bloom-mass centre r .22; two chiffon streamers falling
from the centre out to x ±1.5 and down 1.85 m. `sky` / `sky_d` chiffon, opaque,
soft folds. Front −Z: the flower's disc faces Blender +Y and the petals radiate
in the X–Z plane, tips curling toward the viewer (inner ring .52 rad, outer .22).
ORIGIN = the flower's CENTRE (the game hangs it at y 2.35): parts are authored
about (0,0,0) and joined with origin=None. The sidecar's `origin` says "centre".

Petals are single sheets, not solidified: the export is doubleSided (checked on
plinth_fluted.glb), so a 12 × 6 grid petal is 144 tris instead of ~300 and the
6,000 budget goes into the folds.
"""
import math, bmesh
from mathutils import Vector
import wv_lib as L
import _florals as F

NAME = "fabric_flower"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 6000
FRONT = "-Z"
ORIGIN = "centre"


def _petal(rnd, length, width, angle, tilt, mat, phase, nu=12, nv=6):
    """A chiffon petal radiating from the origin at `angle` in the X–Z plane;
    the flower faces +Y so the cup and the tip curl toward +Y."""
    bm = bmesh.new()
    d = Vector((math.cos(angle), 0, math.sin(angle)))
    across = Vector((-math.sin(angle), 0, math.cos(angle)))
    grid = []
    for i in range(nu + 1):
        u = i / nu
        w = width * (math.sin(math.pi * u ** 0.62)) ** 0.5 * (1 - 0.08 * u)
        row = []
        for j in range(nv + 1):
            v = -1 + 2 * j / nv
            along = u * length
            side = v * w / 2
            y = (math.sin(tilt) * (u ** 1.5) * length * 0.55
                 + (v * v) * w * 0.20
                 + 0.05 * math.sin(4.5 * v + 2.2 * u + phase) * u
                 + 0.03 * math.sin(11.0 * u + 3.0 * v + phase) * u * (0.4 + abs(v))
                 + 0.012 * math.sin(9.0 * u + phase) * (1 - abs(v)))
            p = d * along + across * side + Vector((0, y, 0))
            row.append(bm.verts.new(p + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.004))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    return L.from_bmesh(f"petal_{mat}_{phase:.2f}", bm, (0, 0, 0), mat)


def _streamer(rnd, s, mat, n=28, width=0.30):
    """A chiffon streamer from the centre out to x ±1.5 and 1.85 down, twisting."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = s * (0.16 + 1.34 * t ** 0.85)
        z = -(0.08 + 1.77 * t ** 1.25)
        y = 0.10 * math.sin(2.6 * t + s) + 0.05 * math.sin(6.1 * t + 1.0)
        pts.append(Vector((x, y, z)))
    bm = bmesh.new()
    rows = []
    for i in range(n + 1):
        t = i / n
        tang = (pts[min(i + 1, n)] - pts[max(i - 1, 0)]).normalized()
        base = Vector((0, 1, 0)) - tang * tang.y
        base.normalize()
        ang = 0.9 * math.sin(3.2 * t + s * 0.7) + 0.4 * t
        c, si = math.cos(ang), math.sin(ang)
        perp = tang.cross(base).normalized()
        acr = base * c + perp * si
        w = width * (1 - 0.3 * t) * (0.55 + 0.45 * min(1, t * 6))
        row = []
        for j in range(3):
            v = -1 + j
            fold = perp * (0.02 * math.sin(7 * t + v))
            row.append(bm.verts.new(pts[i] + acr * (v * w / 2) + fold))
        rows.append(row)
    for i in range(n):
        for j in range(2):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]))
    return L.from_bmesh(f"streamer_{s}", bm, (0, 0, 0), mat)


def build():
    rnd = L.rng(NAME)
    parts = []
    for ring in range(2):
        n = 8 if ring else 6
        for i in range(n):
            a = (i / n) * 2 * math.pi + (0.4 if ring else 0.0) + rnd.uniform(-0.1, 0.1)
            ln = (1.02 if ring else 0.66) + rnd.uniform(0, 0.22)
            wd = ln * (0.82 if ring else 0.90)
            tilt = (0.10 if ring else 0.30) + rnd.uniform(0, 0.2)
            parts.append(_petal(rnd, ln, wd, a, tilt, "sky" if ring else "sky_d", rnd.uniform(0, 6.28)))
    parts.append(_streamer(rnd, +1, "sky"))
    parts.append(_streamer(rnd, -1, "sky_d"))
    # the bloom-mass centre r .22, heads facing the viewer (+Y)
    m = F.Mass(rnd, NAME)
    c, r = (0.0, 0.02, 0.0), (0.22, 0.18, 0.22)
    m.core_ellipsoid("base_sage", c, r, seg=16, rings=8, period=0.5, warp=0.05)
    base_s = F.ellipsoid_sampler(c, r, zmin_n=-1.0)

    def front(rnd):
        s = base_s(rnd)
        if s is None or s[1].y < -0.15:
            return None
        return s
    F.place_heads(m, front, 34, scale=0.9, detail=1.2, overlap=0.74)
    for i in range(4):
        s = front(rnd)
        if s:
            m.sprig(s[0], s[1], rnd.uniform(0.14, 0.22), leaves=4, leaf_len=0.05, lift=0.2)
    F.report(m, NAME)
    parts += m.flush()
    root = L.join(parts, NAME, origin=None)         # authored about the flower's centre
    L.shade_smooth(root, angle=60)
    return F.tag(root, ATLAS)
