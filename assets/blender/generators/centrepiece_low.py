"""centrepiece_low — the round-table centrepiece (`decor-dinner-rounds.jpg`).

ASSET_SPEC Group B: r .32, h .32, blooms in a low ivory bowl. Origin base centre
(the bowl's foot; it sits on the table top). The two tapers + flames stay as
game instances. Bowl = a lathe in `flute` (the palette's warm ivory paint key —
`ivory` is a linen family); blooms = the shared head kit at ×.8 with the rounder
`detail` rims, since a guest sits 0.6 m from it.
"""
import wv_lib as L
import _florals as F

NAME = "centrepiece_low"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.4
TRIS = 3000
FRONT = "-Z"
ORIGIN = "base"

BOWL = [(0.0, 0.0), (0.10, 0.0), (0.145, 0.015), (0.170, 0.055), (0.172, 0.085), (0.165, 0.092),
        (0.150, 0.088), (0.140, 0.060), (0.120, 0.035), (0.0, 0.035)]


def build():
    rnd = L.rng(NAME)
    bowl = L.lathe("bowl", BOWL, (0, 0, 0), "flute", n=20)
    m = F.Mass(rnd, NAME)
    c, r = (0.0, 0.0, 0.16), (0.28, 0.28, 0.14)
    samplers, tests = F.lobes(m, [(c, r)])
    F.place_heads(m, samplers[0], 110, scale=0.78, detail=1.2, overlap=0.60,
                  accept=F.outside_all(tests, tests[0], zmin=0.06), zmax=0.335)
    for i in range(3):
        s = samplers[0](rnd)
        if s and s[1].z > -0.1:
            m.sprig(s[0], s[1], rnd.uniform(0.10, 0.16), leaves=4, leaf_len=0.045, zmax=0.34)
    F.scatter_leaves(m, samplers[0], 12, size=0.045, zmax=0.34)
    F.report(m, NAME)
    parts = [bowl] + m.flush()
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=60)
    return F.tag(root, ATLAS)
