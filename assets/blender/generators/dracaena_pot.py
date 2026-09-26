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
TRIS = 4600
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
        p = base + d * (length * t) + Vector((0, 0, -0.30 * length * t * t))
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

    # the canes: four slim, slightly leaning stems of different heights
    canes = []
    for i, (h, a, lean) in enumerate(((1.98, 0.3, 0.10), (1.72, 2.1, 0.14), (1.52, 3.9, 0.12),
                                     (1.84, 5.2, 0.08))):
        foot = Vector((math.cos(a) * 0.06, math.sin(a) * 0.06, SOIL_Z))
        top = foot + Vector((math.cos(a) * lean, math.sin(a) * lean, h - SOIL_Z))
        parts.append(L.strut(f"cane{i}", tuple(foot), tuple(top), 0.018, "cane", n=6))
        canes.append((foot, top))

    # each cane forks near its top into two short side shoots, so the plant has
    # ~12 growing tips, each carrying a dense whorl — the photos' bushy head
    tips = []
    for ci, (foot, top) in enumerate(canes):
        tips.append((top, (top - foot).normalized()))
        for k in range(2):
            a = ci * 1.7 + k * math.pi + rnd.uniform(-.4, .4)
            fork = foot + (top - foot) * rnd.uniform(.62, .78)
            d = Vector((math.cos(a) * .95, math.sin(a) * .95, 1.0)).normalized()
            end = fork + d * rnd.uniform(.34, .46)
            parts.append(L.strut(f"shoot{ci}_{k}", tuple(fork), tuple(end), 0.012, "cane", n=5))
            tips.append((end, d))
    mats = ["drac_g", "drac_y", "drac_l"]
    bms = {m: bmesh.new() for m in mats}
    GA = math.radians(137.5)
    for ti, (top, axis) in enumerate(tips):
        n = 38
        for j in range(n):
            t = j / (n - 1)                                   # 0 at the tip → 1 lower
            base = top - axis * (0.50 * t)
            az = j * GA + ti * 1.1 + rnd.uniform(-.2, .2)
            el = math.radians(72 - 100 * t + rnd.uniform(-10, 10))
            d = Vector((math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)))
            side = Vector((-math.sin(az), math.cos(az), 0))
            length = 0.27 + 0.13 * t + rnd.uniform(-.03, .05)
            w = 0.038 + rnd.uniform(0, .010)
            key = mats[(j + ti) % 3] if rnd.random() > .15 else "drac_y"
            _leaf(bms[key], base, d, side, length, w)
    for key, bm in bms.items():
        o = _raw(f"leaves_{key}", bm, key)
        parts.append(o)
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=50)
    return root
