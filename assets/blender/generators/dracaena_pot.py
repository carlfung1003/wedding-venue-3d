"""dracaena_pot — the arrival stair's pair of white bowl planters with their
variegated Dracaena reflexa ("Song of India"), KAN-211 wave E.

entrance-arrival-brief.md §1 (frames 3–13): "two large matte-white bowl
planters right at the base of the steps, each holding a slender variegated
grass-leaved small tree". In f_005–f_013: an egg-shaped matte white bowl, three
or four slim grey canes rising out of it, and a dense bushy head of short,
narrow, arching strap leaves — yellow-green with lighter margins — from about
knee height to head height.

campus.js drew each one as a white UNIT_CYL (r .5 × .6), a .08 × .9 cane and
two pale-green UNIT_BLOBs — the "blobs" the brief complains about. This GLB is
ONE instance at the same point (px, TY, pz), origin floor centre on the bowl's
foot, y up; the collider (r .55) is untouched and the bowl (r .40) sits inside
it. No rnd() is drawn at the call site (the old primitives drew none).

Baked (one atlas): a matte white glazed bowl (lathe) with a dark soil top, four
canes, and ~130 strap leaves (both faces — the material is single-sided) in
three greens, arching out and down from whorls near each cane's tip.

KAN-211 POLISH (f_009 3-way): wave E's head was twelve tufts on sticks
(4,514 tris) where f_009 shows one full rounded column of drooping straps
~1.2…2.4 m. Now: canes 1.84…2.28 m, three forks each (16 tips at staggered
heights), 40 longer / wider leaves per whorl running 0.62 m down the shoot,
arching up at the tip and hanging below, the whorl shortened on a low tip so
the bare canes still show above the bowl. 640 leaves, 6,050 tris (≲ 7k).
"""
import math
import bmesh
from mathutils import Vector
import wv_lib as L

NAME = "dracaena_pot"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.55
TRIS = 7000
FRONT = "-Z"
ORIGIN = "floor"

L.PALETTE.setdefault("planter_w", L._hex("f1eee7"))
L.PALETTE.setdefault("soil", L._hex("3a2e25"))
L.PALETTE.setdefault("cane", L._hex("8c8174"))
L.PALETTE.setdefault("drac_g", L._hex("4f7a2c"))
L.PALETTE.setdefault("drac_y", L._hex("9fb13e"))
L.PALETTE.setdefault("drac_l", L._hex("76a03a"))

BOWL = [(0.0, 0.0), (0.15, 0.0), (0.27, 0.05), (0.36, 0.17), (0.40, 0.31),
        (0.385, 0.45), (0.35, 0.53), (0.335, 0.555), (0.315, 0.54), (0.30, 0.50), (0.29, 0.42)]
SOIL_Z = 0.46


def _leaf(bm, base, d, side, length, w):
    """a strap leaf from `base` along unit direction `d` (x, y, z Blender),
    arching down toward its tip. BOTH FACES as separate vertices (the baked
    material is single-sided) — so this bmesh must never go through
    from_bmesh()'s remove_doubles / normals_make_consistent (see _raw)."""
    segs = 2
    pts = []
    for k in range(segs + 1):
        t = k / segs
        p = base + d * (length * t) + Vector((0, 0, -0.42 * length * t * t))
        hw = w * (0.55 + 0.45 * math.sin(math.pi * min(1.0, t * 1.2))) * (1 - 0.85 * t ** 2)
        pts.append((p - side * hw, p + side * hw))
    for flip in (False, True):
        rows = [(bm.verts.new(a), bm.verts.new(b)) for (a, b) in pts]
        for k in range(segs):
            (a0, a1), (b0, b1) = rows[k], rows[k + 1]
            bm.faces.new([a0, b0, b1, a1] if flip else [a0, a1, b1, b0])


def _raw(name, bm, key):
    """a bmesh → object WITHOUT from_bmesh's weld + normals_make_consistent,
    which would merge / re-orient the deliberately double-faced leaves"""
    import bpy
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(L.M(key))
    return o


def build():
    rnd = L.rng(NAME)
    parts = []
    bowl = L.lathe("bowl", BOWL, (0, 0, 0), "planter_w", n=28)
    parts.append(bowl)
    parts.append(L.cyl("soil", 0.305, 0.02, (0, 0, SOIL_Z), "soil", n=24))

    # the canes: four slim, slightly leaning stems of different heights.
    # KAN-211 POLISH: taller (f_009: the head tops out ~4.5 bowl-heights, ~2.3 m)
    canes = []
    for i, (h, a, lean) in enumerate(((2.28, 0.3, 0.10), (2.02, 2.1, 0.15), (1.84, 3.9, 0.13),
                                     (2.14, 5.2, 0.09))):
        foot = Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, SOIL_Z))
        top = foot + Vector((math.cos(a) * lean, math.sin(a) * lean, h - SOIL_Z))
        parts.append(L.strut(f"cane{i}", tuple(foot), tuple(top), 0.018, "cane", n=6))
        canes.append((foot, top))

    # KAN-211 POLISH — f_009's head is a FULL rounded column of drooping
    # straps from just above the bowl to the top (~0.8…2.3 m, ~1.1 m across),
    # not wave E's twelve tufts on sticks. Each cane now forks THREE times
    # (spread up its length, splaying outward), so there are 16 growing tips
    # at staggered heights, and each whorl runs 0.62 m down its shoot with
    # longer leaves that arch up at the tip and hang down below — the whorls
    # overlap into one mass. 16 × 40 leaves × 8 tris ≈ 5.1k + the bowl/canes.
    tips = []
    for ci, (foot, top) in enumerate(canes):
        tips.append((top, (top - foot).normalized()))
        for k in range(3):
            a = ci * 1.7 + k * (2 * math.pi / 3) + rnd.uniform(-.35, .35)
            fork = foot + (top - foot) * (0.44 + 0.15 * k + rnd.uniform(-.04, .04))
            d = Vector((math.cos(a) * 1.05, math.sin(a) * 1.05, 1.0)).normalized()
            end = fork + d * rnd.uniform(.36, .50)
            parts.append(L.strut(f"shoot{ci}_{k}", tuple(fork), tuple(end), 0.012, "cane", n=5))
            tips.append((end, d))
    mats = ["drac_g", "drac_y", "drac_l"]
    bms = {m: bmesh.new() for m in mats}
    GA = math.radians(137.5)
    for ti, (top, axis) in enumerate(tips):
        n = 40
        # the head starts ~1.2 m up (f_009: a bare trunk shows ~2 bowl-heights
        # above the bowl) — a low tip's whorl is shortened, never pushed lower
        depth = max(0.22, min(0.62, (top.z - 1.2) / max(axis.z, .3)))
        for j in range(n):
            t = j / (n - 1)                                   # 0 at the tip → 1 lower
            base = top - axis * (depth * t)
            az = j * GA + ti * 1.1 + rnd.uniform(-.2, .2)
            el = math.radians(64 - 120 * t + rnd.uniform(-10, 10))
            d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
            side = Vector((-math.sin(az), math.cos(az), 0))
            length = 0.30 + 0.18 * t + rnd.uniform(-.03, .05)
            w = 0.046 + rnd.uniform(0, .012)
            key = mats[(j + ti) % 3] if rnd.random() > .15 else "drac_y"
            _leaf(bms[key], base, d, side, length, w)
    for key, bm in bms.items():
        o = _raw(f"leaves_{key}", bm, key)
        parts.append(o)
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=50)
    return root
