"""pool_lantern_lotus — the lotus-form floating lantern on the hero pool, the
other half of the signature night shot. Every third lantern is one of these
(`isLotus = i % 3 === 2`, js/water.js:1792).

⚠ GEOMETRY ONLY — BAKE = False. The reasoning is `pool_lantern`'s, in full, in
that generator's banner: water.js owns a THREE-material stack (emissive petal
skin at `petalMat`, an opaque hot core inside it, an additive rim) that one baked
albedo×AO atlas cannot reproduce, and `prepare_for_export`'s smart unwrap would
destroy the UV layout the game's own paper texture needs. So:

  · BAKE = False — make_masters skips prepare_for_export; this file owns the UVs.
  · UV0 ('UVMap') is a clean CYLINDRICAL wrap, u = 0..1 once around (seam at the
    back, −Y), v = 0..1 foot to the topmost petal.
  · ONE mesh, ONE material, so the whole flower is built in the single palette
    key `label` (plain paper). The game replaces the material.

── THE ENVELOPE (js/water.js:1756, 1758, 1793-1806) ───────────────────────────
The primitive is `petalGeo = ConeGeometry(R×.37, R×1.24, 5)` — eight of them on
a R×1.24 pad with a R×.46 core — plus `baseGeo = TorusGeometry(R×.81, R×.17)`,
with R = TUNE.LANTERN_R = .70 (js/water.js:101). Reading the placements back:

  pad       CircleGeometry(R×1.24 = .868) at y R×.14      → the widest element
  petals    8 cones, base centres at radius R×.57, y R×.62, tipped .78 rad out;
            their tips land at radius .704, y .7425 (solved from the Euler)
  core      SphereGeometry(R×.46 = .322) at y R×.71 = .497
  float ring TorusGeometry(R×.81 = .567 major, R×.17 = .119 minor)

so the envelope is Ø 1.736 × 0.82 high, and this model keeps it: 1.736 × 1.736
× 0.820. The halo, pool-glow and streak quads are sized off R, unchanged.

ORIGIN "floor" = THE WATERLINE, and that is a declared 35 mm deviation. The
primitive's float ring sits at y R×.12 with a R×.17 tube, i.e. 35 mm submerged.
Here the ring's lowest point IS the model's foot, so

    a drop-in sits at  y = P.waterY  exactly

— the number the integrator is least likely to get wrong — and the flower rides
35 mm higher than the primitive did, which on a lantern bobbing ±35 mm every
second (tickLanterns, js/water.js:1880) is not observable.

The game's hot core (r .322 at y .497 above the waterline) sits at the flower's
heart: the petals are laid so they open AROUND that sphere and the three layers
break its silhouette, which is what makes the glow read as a flower rather than
as a ball with spikes.

── WHAT CHANGED FROM THE PRIMITIVE, AND WHY ───────────────────────────────────
Eight five-sided cones are a crown of spikes. A lotus is LAYERED: an outer
whorl that lies back almost flat, a middle whorl, and a tight inner cup — so
22 petals in three whorls, each a keeled, cupped blade (a real lotus petal has a
central ridge), offset whorl to whorl so no petal hides behind another. The pad
gains a dished section and a lifted rim, because a flat CircleGeometry
disappears entirely when seen edge-on from a guest's eye height across the pool.
"""
import math
import wv_lib as L
import _pool as P

NAME = "pool_lantern_lotus"
BAKE = False              # ⚠ see the banner — the generator owns its own UVs
ATLAS = 256               # unused (no bake)
BEVEL = 0
TRIS = 2200
FRONT = "-Z"              # radially symmetric; the seam is at the back
ORIGIN = "floor"          # = THE WATERLINE (see the banner)
KEY = "label"

R = 0.70                  # TUNE.LANTERN_R            js/water.js:101
PAD_R = R * 1.24          # .868  — CircleGeometry(R*1.24, 20)   js/water.js:1795
RING_MAJ = R * 0.81       # .567  — baseGeo major               js/water.js:1758
RING_MIN = R * 0.17       # .119  — baseGeo minor
TOP = 0.820               # the tallest petal tip (the primitive's core top .819)

# (count, phase, base radius, base z, tip radius, tip z, half-width, thickness)
WHORLS = [
    (8, 0.000, 0.155, 0.290, 0.700, 0.560, 0.215, 0.034),   # outer — laid back
    (8, 0.393, 0.135, 0.330, 0.510, 0.720, 0.180, 0.029),   # middle
    (6, 0.196, 0.110, 0.365, 0.265, TOP,   0.148, 0.024),   # inner cup
]


def build():
    parts = []
    mat = L.M(KEY)

    # ── the float ring, its lowest vertex exactly on the waterline. ⚠ a 6-sided
    #    minor ring's lowest VERTEX is at r·cos(30°), not at r.
    parts.append(L.torus("float", RING_MAJ, RING_MIN,
                         (0, 0, RING_MIN * math.cos(math.pi / 6)),
                         mat, maj=20, mnr=6))

    # ── the pad: a shallow domed leaf with a lifted rim, so it still reads
    #    edge-on from a guest's eye height across the water — a flat
    #    CircleGeometry disappears there. ⚠ its crown CLEARS the float ring's top
    #    (.2221): a pad that sits under the ring turned the first turntable into
    #    a bundt tin — two concentric rings and no leaf.
    parts.append(L.lathe("pad", [
        (0.000, 0.250), (0.450, 0.245), (0.700, 0.205), (PAD_R, 0.155),
        (PAD_R - 0.024, 0.185), (0.650, 0.240), (0.400, 0.278), (0.000, 0.285),
    ], (0, 0, 0), mat, n=24))

    # ── the receptacle the petals spring from, on the pad's crown and just under
    #    the game's hot core
    parts.append(L.cyl("recept", 0.185, 0.11, (0, 0, 0.310), mat, n=16, r2=0.130))

    # ── three whorls of keeled, cupped blades
    for w, (n, ph, br, bz, tr, tz, hw, th) in enumerate(WHORLS):
        for a in P.ring_of(n, ph):
            ca, sa = math.cos(a), math.sin(a)
            parts.append(P.petal(
                f"petal{w}_{a:.2f}", mat,
                (ca * br, sa * br, bz), (ca * tr, sa * tr, tz),
                hw, th, keel=0.36, stations=6, cup=0.10))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=34)
    # ⚠ UV0, not the `art` layer — nothing unwraps this model after us.
    L.cylindrical_uv(root, layer="UVMap", axis=2, repeat=1.0, v_from_height=True)
    return root
