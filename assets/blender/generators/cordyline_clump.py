"""cordyline_clump + ixora_cluster — the arrival beds' foundation planting
(KAN-211 wave A2; f_001–f_008: dark-maroon cordyline / ti-plant fans and small
red ixora heads at the hedge foot).

PROTOTYPE SWAPS in the wave-2/4 sense: each GLB lives in the UNIT_BLOB
envelope (centred, radius .5 → x, y, z ∈ [−.5, .5]) so campus.js hands it the
very matrix — and the very instance colour — the blob got, from the very same
rnd() draws. GEOMETRY ONLY on the game's MAT.plantFlat (white base, flat
shading, per-instance colour: the arrPlantI program), so the maroon and the red
are still the game's CORDY / 0xc63e1c instance tints.

cordyline_clump: 15 strap leaves (the ti-plant's long lanceolate blades) fanning
up and out from a short cane at the bottom centre, arching over at their tips —
a vase-shaped clump that fills the blob's envelope (≈ 1 × 1 × 1 unit).
ixora_cluster: six domed flower heads (each a squashed low-poly half-sphere,
the ixora's flat-topped umbel) packed in a loose mound.
"""
import math
import _flora as F
import wv_lib as L

NAME = "cordyline_clump"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 700
FRONT = "-Z"
ORIGIN = "centre"

L.PALETTE.setdefault("plant_w", (1.0, 1.0, 1.0))


def build():
    rnd = L.rng(NAME)
    b = F.Buf()
    N = 22
    for i in range(N):
        a = i / N * 2 * math.pi + rnd.random() * .4
        elev = math.radians(35 + rnd.random() * 45)          # from horizontal
        L_ = 0.62 + rnd.random() * .22
        w = 0.10 + rnd.random() * .04
        segs = 5
        base = (math.cos(a) * .04, -0.5 + 0.12, math.sin(a) * .04)
        dx, dz = math.cos(a), math.sin(a)
        side = (-dz, 0.0, dx)
        rows = []
        for k in range(segs + 1):
            t = k / segs
            e = elev - t * t * 0.9                           # arch over at the tip
            px = base[0] + dx * math.cos(elev) * L_ * t * 0.9 + dx * .05 * t
            py = base[1] + math.sin(elev) * L_ * t - 0.35 * t * t * (1 - math.sin(elev))
            pz = base[2] + dz * math.cos(elev) * L_ * t * 0.9 + dz * .05 * t
            hw = w * (math.sin(math.pi * min(1, t * 1.15)) * .85 + .15) * (1 - t * .6)
            n = (dx * -math.sin(e), math.cos(e), dz * -math.sin(e))
            rows.append((b.vert((px - side[0] * hw, py, pz - side[2] * hw), n),
                         b.vert((px + side[0] * hw, py, pz + side[2] * hw), n)))
        for k in range(segs):
            (a0, a1), (b0, b1) = rows[k], rows[k + 1]
            b.face((a0, a1, b1, b0), ((0, k / segs), (1, k / segs), (1, (k + 1) / segs), (0, (k + 1) / segs)))
    b.orient_to_normals()
    o = b.to_object(NAME, "plant_w")
    root = L.join([o], NAME, origin=None)
    _fit(root)
    return root


def build_ixora():
    rnd = L.rng("ixora_cluster")
    parts = []
    heads = [(0, 0), (.28, .1), (-.24, .16), (.08, -.3), (-.18, -.22), (.22, -.12)]
    for i, (x, z) in enumerate(heads):
        r = 0.2 + rnd.random() * .05
        y = -0.5 + r * 0.9 + rnd.random() * .12
        h = L.sphere(f"head{i}", r, (x, -z, y), "plant_w", sub=1)
        h.scale = (1.0, 1.0, 0.62)
        parts.append(h)
    root = L.join(parts, NAME + "_ixora", origin=None)
    _fit(root)
    return root


def _fit(o):
    """scale uniformly into the unit blob envelope, centred like UNIT_BLOB"""
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    cx, cy, cz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    s = 1.0 / max(max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))
    for v in o.data.vertices:
        v.co.x = (v.co.x - cx) * s
        v.co.y = (v.co.y - cy) * s
        v.co.z = (v.co.z - cz) * s
