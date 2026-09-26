"""suite_soffit — the DARK TIMBER underside of the presidential suite's roofs and
balcony (KAN-211 wave C).

Replaces the underside of js/suite.js's roof slab (MT.ceilingWarm, a pale
plaster wafer), the two annex roofs' undersides, and the balcony slab's
underside (MT.spaFloor). Its own GLB so it can be MATTE (rough .85) while the
copper fascia keeps a sheen — one GLB, one roughness (wave A2 lesson 2).

Only the ring OUTSIDE the envelope is built: inside, suite.js's 2F ceiling slab
(Y2C − .05 … Y2C) and the annex's own ceilings already cover the roof's
underside, so a soffit there would be 300 m² of hidden faces.

    main ring   bottom at Y2C 6.80 (where every wall stops), 30 mm deep, boards
                running N–S (pimg-002: the soffit boards run front to back),
                in ≤ 5 m pieces (the longest island caps the atlas — wave A);
                the void (suite_roof.VOID) is left open
    annex       bottom at H2 3.00, the strips outside the annex walls
    balcony     under the 2F balcony, bottom at 3.05 (the band's underside),
                x −7.5 … 7.5, z ZS … balZ + .06 — the timber the 1F glass wall
                looks out under (IMG_8096: the warm soffit beyond the leaves)
"""
import wv_lib as L
import _arch as A
from suite_roof import VOID

NAME = "suite_soffit"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.4
AO_STRENGTH = 0.45
TRIS = 1200
FRONT = "-Z"
ORIGIN = "site"
UV_WEIGHT = {"soffit": 1.0}

BAL_Y = 3.05          # the balcony band's underside (suite_facade reads the same)


def build():
    S = A.suite()
    ced = A.soffit_teak("soffit")
    parts = []

    def ring(name, x0, x1, z0, z1, y):
        for i, (xa, xb) in enumerate(A.spans(x0, x1, 5.0)):
            for j, (za, zb) in enumerate(A.spans(z0, z1, 5.0)):
                o = A.box(f"{name}{i}_{j}", xa, xb, y, y + .03, za, zb, ced)
                A.world_uv(o, tile=1.8)
                parts.append(o)

    with A.frame("suite"):
        X0, X1, ZN, ZS, Y2C = S["X0"], S["X1"], S["ZN"], S["ZS"], S["Y2C"]
        RX0, RX1, RZ0, RZ1 = S["RX0"], S["RX1"], S["RZ0"], S["RZ1"]
        V = VOID
        # south overhang, cut round the void
        # ⚠ the boards hang BELOW Y2C (6.77 … 6.80): at Y2C … +.03 their
        # underside was coplanar with the roof core's and z-fought grey
        Ys = Y2C - .03
        ring("s_a", V["x1"], RX1, ZS, RZ1, Ys)
        ring("s_b", RX0, V["x0"], ZS, RZ1, Ys)
        ring("s_c", V["x0"], V["x1"], ZS, V["z0"], Ys)
        ring("s_d", V["x0"], V["x1"], V["z1"], RZ1, Ys)
        ring("n", RX0, RX1, RZ0, ZN, Ys)                   # north
        ring("e", X1, RX1, ZN, ZS, Ys)                     # east
        ring("w", RX0, X0, ZN, ZS, Ys)                     # west
        # the annex roofs, outside the annex walls (spa x −14 … −8, z −26.5 …
        # −19.5; corridor x −9.9 … −8, z −19.5 … −17 — SITE)
        AN = S["ANX"]
        H2 = AN["H2"]
        (ax0, ax1), (az0, az1) = AN["roofA"]
        (bx0, bx1), (bz0, bz1) = AN["roofB"]
        spa = S["spa"]
        sx0 = spa["cx"] - spa["w"] / 2                    # −14
        cx0 = -(S["X1"] + S["corridorW"] + .3)            # −9.9
        ring("aw", ax0, sx0, az0, az1, H2 - .03)
        ring("an", sx0, ax1, az0, ZN, H2 - .03)
        ring("as", sx0, cx0, spa["cz"] + spa["d"] / 2, az1, H2 - .03)
        ring("bw", bx0, cx0, bz0, bz1, H2 - .03)
        ring("bs", cx0, bx1, bz1 - 1.0, bz1, H2 - .03)
        # the balcony's underside
        ring("bal", -7.5, 7.5, ZS, S["balZ"] + .06, BAL_Y)
        return L.join(parts, NAME, origin=None)
