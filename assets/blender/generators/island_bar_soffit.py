"""island_bar_soffit + island_bar_soffit_rafters — the underside of the beach
pool's island-bar palapa (KAN-211 wave E).

water.js kept a flat brown CircleGeometry(5.04) at y 3.08 under the thatch —
"the river's ONE warm light at night" (emissive 1.6 at night) and, by day, a
flat brown lid the whole bar reads by from eye level: you stand on the .42
terrace with the eaves 0.9 m over your head and look straight up into it.

A palapa from below is its STRUCTURE: bamboo rafters radiating from a crown
ring to the ring beam, purlin rings tied across them, and the underside of
the thatch bundles between. So, in the island_bar frame (origin floor centre,
BA = SITE.RIVER.BAR, eaves 3.05, apex 5.05, the thatch annulus closing to
r 4.90 at 3.05):

  island_bar_soffit          the LINING: a raked surface under the thatch —
                             flat from the annulus edge (r 4.93, y 3.062) to
                             r 4.2 (3.10), then rising with the roof's own
                             pitch (.376) to a closed crown at 4.47 — kept
                             ≥ .12 m under every ragged fringe tip of the
                             thatch courses above it (island_bar.py
                             _shaggy_thatch: course tips hang up to .34 m
                             below their course line). thatch_palm.webp,
                             darker, slant-mapped so the strands run to the
                             crown. Normals DOWN. The game gives THIS
                             material its night glow (emissive, uniform only).
  island_bar_soffit_rafters  16 bamboo rafters just under the lining from the
                             ring beam to the crown ring, three purlin rings,
                             and the crown hub — its own GLB so it stays dark
                             against the glowing lining at night.

Both are baked (one material each). Nothing here carries a collider; the
eaves line, the annulus, the terrace and the r 5.90 collider are untouched.
"""
import math
import bmesh
import wv_lib as L
import _resort as R

NAME = "island_bar_soffit"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.6
AO_STRENGTH = 0.6
TRIS = 1800
FRONT = "-Z"
ORIGIN = "floor"

L.PALETTE.setdefault("bamboo", L._hex("9a7a50"))
L.PALETTE.setdefault("straw_d", L._hex("d2b083"))

PROFILE = [(4.93, 3.062), (4.55, 3.078), (4.20, 3.100), (3.0, 3.551), (1.8, 4.002),
           (0.9, 4.340), (0.35, 4.47)]
N = 48
THATCH_K, THATCH_TV = 22, 1.55
HUB_R, HUB_Z = 0.35, 4.47


def line_z(r):
    """the lining's height at radius r (interpolating PROFILE)"""
    pts = PROFILE
    if r >= pts[0][0]:
        return pts[0][1]
    for (r0, z0), (r1, z1) in zip(pts, pts[1:]):
        if r1 <= r <= r0:
            t = (r0 - r) / (r0 - r1)
            return z0 + (z1 - z0) * t
    return pts[-1][1]


def _lining(mat):
    bm = bmesh.new()
    rings = []
    for (r, z) in PROFILE:
        rings.append([bm.verts.new((math.cos(2 * math.pi * i / N) * r,
                                    math.sin(2 * math.pi * i / N) * r, z)) for i in range(N)])
    for k in range(len(rings) - 1):
        A, B = rings[k], rings[k + 1]
        for i in range(N):
            i2 = (i + 1) % N
            # winding: normal points DOWN (seen from underneath)
            bm.faces.new([A[i], B[i], B[i2], A[i2]])
    c = bm.verts.new((0, 0, PROFILE[-1][1] + 0.02))
    last = rings[-1]
    for i in range(N):
        bm.faces.new([last[i], c, last[(i + 1) % N]])
    bm.normal_update()
    o = L.from_bmesh("lining", bm, (0, 0, 0), mat)
    # make sure the faces look down
    me = o.data
    down = sum(p.normal.z for p in me.polygons)
    if down > 0:
        for p in me.polygons:
            p.flip()
        me.update()
    # slant UV: strands run to the crown (island_bar._thatch_uv's convention)
    uvl, was = L._art_layer(me, L.ART_UV)
    for poly in me.polygons:
        vs = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
        angs = [math.atan2(v.y, v.x) if math.hypot(v.x, v.y) > 1e-4 else None for v in vs]
        ref = next(a for a in angs if a is not None)
        fixed = []
        for a in angs:
            a = ref if a is None else a
            while a - ref > math.pi:
                a -= 2 * math.pi
            while a - ref < -math.pi:
                a += 2 * math.pi
            fixed.append(a)
        for k, li in enumerate(poly.loop_indices):
            v = vs[k]
            s = math.hypot(math.hypot(v.x, v.y), 5.05 - v.z)
            uvl.data[li].uv = (THATCH_K * fixed[k] / (2 * math.pi), -s / THATCH_TV)
    L._restore_active(me, was)
    return o


def build():
    thatch = R.tex("soffit_thatch", "thatch_palm.webp", roughness=0.95, fallback="straw_d",
                   tint_to="straw_d", gain=(0.34, 0.27, 0.21))
    root = L.join([_lining(thatch)], NAME, origin=None)
    L.shade_smooth(root, angle=40)
    return root


def build_rafters():
    bam = R.tex("rafter_bamboo", "oak_light.webp", roughness=0.8, fallback="bamboo",
                tint_to="bamboo", gain=(0.60, 0.50, 0.38))
    parts = []
    n_r = 16
    for i in range(n_r):
        a = 2 * math.pi * (i + 0.5) / n_r
        ca, sa = math.cos(a), math.sin(a)
        pts = []
        for r in (4.92, 4.2, HUB_R + 0.05):
            pts.append((ca * r, sa * r, line_z(r) - 0.055))
        for k in range(len(pts) - 1):
            s = L.strut(f"raft{i}_{k}", pts[k], pts[k + 1], 0.042, bam, n=6)
            parts.append(s)
    # purlin rings tied under the rafters
    for (r, rr) in ((3.55, 0.034), (2.45, 0.032), (1.35, 0.030)):
        z = line_z(r) - 0.055 - 0.042 - rr
        t = L.torus(f"purlin{r}", r, rr, (0, 0, z), bam, maj=32, mnr=4)
        parts.append(t)
    # the crown hub the rafters meet at
    hub = L.cyl("hub", HUB_R + 0.06, 0.20, (0, 0, HUB_Z - 0.16), bam, n=16)
    parts.append(hub)
    for o in parts:
        R.metric_uv(o, 0, 2, tile=0.6)
    root = L.join(parts, NAME + "_rafters", origin=None)
    L.shade_smooth(root, angle=45)
    return root
