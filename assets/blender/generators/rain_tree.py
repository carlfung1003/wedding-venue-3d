"""rain_tree + rain_tree_leaves — the two broad shade trees of the water system
(water.js `shadeTree()`: the beach pool's enormous tree on its NW rim,
beach-pool-circular.png, and the lagoon's tree island, resort-pool-complex-brief
§2c). KAN-211 wave E.

They were four flat-green IcosahedronGeometry(T.r × s, 1) blobs squashed to .62
on a plain cylinder — "the big green dome in the lagoon views". A tropical shade
tree of that size on Hainan is a RAIN TREE (Samanea saman) or a banyan-like fig:
a SHORT thick trunk that forks low into a handful of massive limbs running out
almost horizontally, and an umbrella crown about twice as wide as it is tall,
lumpy with clusters, its skirt drooping low at the rim — you stand UNDER it.

ONE FRAME, TWO GLBs, UNIT CROWN RADIUS: every length is a fraction of the
crown radius T.r, so the game places both trees with ONE uniform scale (T.r):
the beach tree is T {r 8.4, h 9.0}, the island tree T {r 4.1, h 4.4} — the same
h / r (1.07) — so no stretch. Origin at the trunk's foot on the ground (y up).

  rain_tree         trunk + limbs + branches, GEOMETRY ONLY on the game's
                    MAT.darkWood as a plain Mesh — exactly the program the old
                    cylinder trunk drew with (no map: UVs are nominal)
  rain_tree_leaves  ~560 alpha-cut leaf-spray CARDS over a lumpy dome of
                    clustered lobes + an OPAQUE inner hull whose UVs all sample
                    the card's dense centre (measured ≥ 99.5 % opaque), so the
                    crown has body and no sky shows through the middle. On
                    leafMat('rain') (rain_tree_leaf.webp, magenta-keyed) — the
                    palm fronds' instanced program, one InstancedMesh per tree.

The trunk stays inside the old collider (beach tree r 1.5 m = .18 unit; the
island's collider is the mound's). Normals on the cards are the RADIAL
direction from the crown centre mixed with the card's own (the wave-2/4 rule:
a clump of cards must shade like one leafy volume, out and a little down).
"""
import math
from mathutils import Vector
import _flora as F
import wv_lib as L

NAME = "rain_tree"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 2600
FRONT = "-Z"
ORIGIN = "floor"

L.PALETTE.setdefault("bark", L._hex("8a8580"))

C = Vector((0.0, 0.94, 0.0))            # the crown's centre (unit = T.r)
SQ_UP, SQ_DN = 0.80, 0.55               # dome: squash above / below the centre


def _lobes():
    rnd = L.rng(NAME + ":lobes")
    lobes = [((0.0, 0.10, 0.0), 0.62)]
    for k in range(7):
        a = k / 7 * 2 * math.pi + rnd.uniform(-.2, .2)
        rr = 0.60 + rnd.uniform(-.05, .06)
        lobes.append(((math.cos(a) * rr, -0.02 + rnd.uniform(-.05, .05), math.sin(a) * rr),
                      0.44 + rnd.uniform(-.04, .05)))
    for k in range(4):
        a = k / 4 * 2 * math.pi + .5 + rnd.uniform(-.3, .3)
        rr = 0.30 + rnd.uniform(-.05, .05)
        lobes.append(((math.cos(a) * rr, 0.22 + rnd.uniform(-.03, .05), math.sin(a) * rr),
                      0.36 + rnd.uniform(-.03, .04)))
    return lobes


def _squash(v):
    """relative-to-C vector → the dome's squashed frame"""
    return Vector((v.x, v.y * (SQ_UP if v.y > 0 else SQ_DN), v.z))


def _surface(d, lobes, k=1.0):
    """point on the (squashed) lobe union along unit direction d from C"""
    R = F._lobe_radius(d, lobes) * k
    return C + _squash(d * R)


def _skeleton():
    """(points, radii) polylines: trunk → 5 limbs → 2 branches each → 2 twigs each."""
    rnd = L.rng(NAME + ":wood")
    lines = []
    trunk_top = Vector((0.02, 0.30, -0.01))
    lines.append(([Vector((0, 0, 0)), Vector((0.005, 0.10, 0)), Vector((0.012, 0.20, -0.005)), trunk_top],
                  [0.085, 0.066, 0.060, 0.058]))

    def grow(p, d, r, length, depth, rise):
        pts, rs = [p], [r]
        cur, dd = Vector(p), Vector(d).normalized()
        n = 4
        for k in range(1, n + 1):
            t = k / n
            dd = (dd + Vector((0, rise * t, 0))).normalized()
            cur = cur + dd * (length / n)
            pts.append(cur.copy())
            rs.append(r * (1 - 0.30 * t))
        lines.append((pts, rs))
        if depth == 0:
            return
        base = math.atan2(dd.z, dd.x)
        for f in (-1, 1):
            a = base + f * (0.45 + rnd.uniform(0, .3))
            el = math.asin(max(-.9, min(.9, dd.y))) + rnd.uniform(.05, .25)
            nd = Vector((math.cos(a) * math.cos(el), math.sin(el), math.sin(a) * math.cos(el)))
            grow(pts[-1], nd, rs[-1] * 0.72, length * (0.62 + rnd.uniform(0, .15)), depth - 1, rise * .6)

    limbs = 5
    for i in range(limbs):
        a = i / limbs * 2 * math.pi + rnd.uniform(-.25, .25)
        el = math.radians(32 + rnd.uniform(-6, 10))      # massive, low, spreading
        d = Vector((math.cos(a) * math.cos(el), math.sin(el), math.sin(a) * math.cos(el)))
        grow(trunk_top, d, 0.050 + rnd.uniform(0, .008), 0.36 + rnd.uniform(0, .06), 2, 0.10)
    return lines


def build():
    lines = _skeleton()
    b = F.Buf()
    SIDES = 7
    for pts, rs in lines:
        rings = []
        for i, (p, r) in enumerate(zip(pts, rs)):
            q = pts[min(i + 1, len(pts) - 1)]
            o = pts[max(i - 1, 0)]
            ax = (q - o).normalized()
            ref = Vector((1, 0, 0)) if abs(ax.x) < .9 else Vector((0, 0, 1))
            u = ax.cross(ref).normalized()
            v = ax.cross(u).normalized()
            flare = 1.0 + (0.55 if (i == 0 and p.y < .01) else 0)   # the buttress foot
            ring = []
            for s in range(SIDES):
                a = 2 * math.pi * s / SIDES
                n = u * math.cos(a) + v * math.sin(a)
                ring.append(b.vert(tuple(p + n * r * flare), tuple(n)))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for s in range(SIDES):
                s2 = (s + 1) % SIDES
                b.face((rings[i][s], rings[i + 1][s], rings[i + 1][s2], rings[i][s2]),
                       ((s / SIDES, i / 4), (s / SIDES, (i + 1) / 4),
                        ((s + 1) / SIDES, (i + 1) / 4), ((s + 1) / SIDES, i / 4)))
        c = b.vert(tuple(pts[-1]), tuple(pts[-1] - pts[-2]))
        last = rings[-1]
        for s in range(SIDES):
            b.face((last[s], last[(s + 1) % SIDES], c), ((0, 0), (1, 0), (.5, 1)))
    b.orient_to_normals()
    o = b.to_object(NAME, "bark")
    return L.join([o], NAME, origin=None)


def build_leaves():
    lobes = _lobes()
    rnd = L.rng(NAME + ":cards")
    b = F.Buf()
    GA = math.radians(137.508)

    # ── the opaque inner hull: an icosphere pushed onto the lobe union at 84 %,
    #    every triangle sampling the card's dense centre
    ico_v, ico_f = F._icosahedron()
    verts = [Vector(v).normalized() for v in ico_v]
    cache = {}
    faces = [tuple(f) for f in ico_f]
    for _ in range(2):                       # detail 2: 320 faces
        nf = []
        for (a, b_, c) in faces:
            def mid(i, j):
                k = (min(i, j), max(i, j))
                if k not in cache:
                    verts.append(((verts[i] + verts[j]) / 2).normalized())
                    cache[k] = len(verts) - 1
                return cache[k]
            ab, bc, ca = mid(a, b_), mid(b_, c), mid(c, a)
            nf += [(a, ab, ca), (b_, bc, ab), (c, ca, bc), (ab, bc, ca)]
        faces = nf
    pts = [_surface(d, lobes, 0.84) for d in verts]
    for (i0, i1, i2) in faces:
        ids = []
        for i in (i0, i1, i2):
            n = (pts[i] - C).normalized()
            ids.append(b.vert(tuple(pts[i]), tuple(n)))
        du, dv = rnd.uniform(-.05, .05), rnd.uniform(-.05, .05)
        b.face(ids, ((.42 + du, .50 + dv), (.58 + du, .50 + dv), (.50 + du, .64 + dv)))

    # ── the cards: a Fibonacci spiral over the whole dome (the underside too —
    #    the lagoon views and anyone standing under it see it), centred just
    #    inside the lobe surface, tilted off facing-out so the silhouette breaks
    def card(d, k_out, size, tilt):
        c = _surface(d, lobes, k_out)
        rad = (c - C).normalized()
        up = Vector((0, 1, 0))
        t1 = up.cross(rad)
        if t1.length < 1e-3:
            t1 = Vector((1, 0, 0))
        t1.normalize()
        spin_a = rnd.uniform(0, math.pi)
        t1 = t1 * math.cos(spin_a) + rad.cross(t1) * math.sin(spin_a)
        t1 = (t1 - rad * t1.dot(rad)).normalized()
        w = rad.cross(t1).normalized()
        nn = (rad * math.cos(tilt) + w * math.sin(tilt)).normalized()
        U = t1
        V = nn.cross(U).normalized()
        rot = rnd.uniform(0, 2 * math.pi)
        cu, cv = math.cos(rot), math.sin(rot)
        U, V = U * cu + V * cv, -U * cv + V * cu
        s = size / 2
        corners = [c - U * s - V * s, c + U * s - V * s, c + U * s + V * s, c - U * s + V * s]
        ids = []
        for p in corners:
            r2 = (p - C).normalized()
            # out and a little DOWN, toward the guest (KAN-208 wave 2 lesson 3)
            nv = (r2 * 0.70 + nn * 0.30 + Vector((0, -0.12, 0))).normalized()
            ids.append(b.vert(tuple(p), tuple(nv)))
        uv = ((0, 0), (1, 0), (1, 1), (0, 1))
        b.face((ids[0], ids[1], ids[2]), (uv[0], uv[1], uv[2]))
        b.face((ids[0], ids[2], ids[3]), (uv[0], uv[2], uv[3]))

    N = 460
    for i in range(N):
        t = (i + .5) / N
        y = 1 - t * 1.9                       # cap down to y −.9: the skirt and underside
        y = max(-.97, min(.98, y + rnd.uniform(-.04, .04)))
        az = i * GA + rnd.uniform(-.25, .25)
        rxz = math.sqrt(max(0, 1 - y * y))
        d = Vector((math.cos(az) * rxz, y, math.sin(az) * rxz)).normalized()
        card(d, rnd.uniform(.92, 1.04), rnd.uniform(.20, .27), rnd.uniform(.25, 1.1))
    # a second, drooping ring at the rim: the rain tree's skirt hangs low
    for i in range(100):
        az = i / 100 * 2 * math.pi + rnd.uniform(-.03, .03)
        y = rnd.uniform(-.45, -.15)
        rxz = math.sqrt(1 - y * y)
        d = Vector((math.cos(az) * rxz, y, math.sin(az) * rxz)).normalized()
        card(d, rnd.uniform(.97, 1.06), rnd.uniform(.18, .24), rnd.uniform(.9, 1.35))
    b.orient_to_normals()
    o = b.to_object(NAME + "_leaves", "leaf")
    return L.join([o], NAME + "_leaves", origin=None)
