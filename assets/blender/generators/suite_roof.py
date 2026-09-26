"""suite_roof — the presidential suite's CANTILEVERED FLAT ROOF (KAN-211 wave C).

Replaces js/suite.js buildShell's roof slab (MT.ceilingWarm), its plaster top
skin and the four fascia() slabs, plus the two single-storey annex roofs over
the spa + corridor and their fascias. The soffit under all of them is its own
GLB (`suite_soffit`, matte) — one GLB carries one roughness (wave A2 lesson 2).

Massing — read from the live js/site.js through _arch.suite(), identical to
suite.js's consts:
    main roof  x RX0 … RX1 = −10.86 … 10.86 (OVER_E 2.86), z RZ0 … RZ1 =
               −28.70 … −10.09 (OVER_N 2.20 / OVER_S 3.41), slab Y2C 6.80 →
               Y2C + ROOF_T 7.52
    annex A    SITE x −15.2 … −8, z −27.7 … −18.5, H2 3.0 → 3.3
    annex B    SITE x −10.9 … −8, z −18.5 … −16.0
    no colliders (the roof is 6.8 m up; the annex roofs 3.0 m over a room)

What the photographs add (reference/docs/clubhouse-intro.pdf p3, pimg-002 —
the suite's own elevation across its pool; pimg-001 — the roof from above):
  · the fascia is a row of COPPER CASSETTE panels (~0.62 m square-ish, each
    its own tone, dark joints), measured sunlit (203, 147, 102) — not a flat
    orange band. It hangs 6 cm below the soffit as a drip and carries a slim
    dark coping;
  · a grey STANDING-SEAM metal skin on top (pimg-001), seams every 0.6 m
    running N–S;
  · THE VOID: pimg-002's rectangular opening through the south-west overhang,
    its four faces lined with the same cassettes (the one "light well" in the
    cantilever, over the west corner of the deck).
"""
import wv_lib as L
import _arch as A

NAME = "suite_roof"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 6000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"copper": 1.0, "su_roof": 0.02, "su_seam": 0.05, "su_joint": 0.06}

# the void through the south-west overhang (pimg-002, left end) — SITE coords
VOID = {"x0": -10.10, "x1": -8.55, "z0": -12.55, "z1": -10.95}


def build():
    S = A.suite()
    rnd = L.rng(NAME).random
    cop = A.copper("copper")
    parts = []
    with A.frame("suite"):
        RX0, RX1, RZ0, RZ1 = S["RX0"], S["RX1"], S["RZ0"], S["RZ1"]
        Y2C, RT = S["Y2C"], S["ROOF_T"]
        top = Y2C + RT                       # 7.52
        V = VOID
        # ── the slab core, cut round the void (its faces are the roof skin) ──
        core = [(RX0, RX1, RZ0, V["z0"]), (RX0, RX1, V["z1"], RZ1),
                (RX0, V["x0"], V["z0"], V["z1"]), (V["x1"], RX1, V["z0"], V["z1"])]
        for k, (xa, xb, za, zb) in enumerate(core):
            parts.append(A.box(f"core{k}", xa, xb, Y2C, top, za, zb, "su_roof"))
        # ── standing seams on top, N–S, 0.6 m (skipped across the void) ──
        n = round((RX1 - RX0) / 0.6)
        for i in range(1, n):
            x = RX0 + (RX1 - RX0) * i / n
            runs = [(RZ0 + .05, RZ1 - .05)]
            if V["x0"] - .03 < x < V["x1"] + .03:
                runs = [(RZ0 + .05, V["z0"] - .02), (V["z1"] + .02, RZ1 - .05)]
            for j, (za, zb) in enumerate(runs):
                parts.append(A.box(f"seam{i}_{j}", x - .022, x + .022, top, top + .045, za, zb, "su_seam"))

        # ── the COPPER CASSETTE FASCIA, all four edges ──
        FY0, FY1 = Y2C - .06, top + .02     # a 6 cm drip below the soffit
        A.cassettes(parts, rnd, 'x', RX0 - .052, RX1 + .052, RZ1, FY0, FY1, +1, cop, "su_joint", prefix="fs")
        A.cassettes(parts, rnd, 'x', RX0 - .052, RX1 + .052, RZ0, FY0, FY1, -1, cop, "su_joint", prefix="fn")
        A.cassettes(parts, rnd, 'z', RZ0, RZ1, RX1, FY0, FY1, +1, cop, "su_joint", prefix="fe")
        A.cassettes(parts, rnd, 'z', RZ0, RZ1, RX0, FY0, FY1, -1, cop, "su_joint", prefix="fw")
        # slim dark coping over the band
        parts.append(A.box("cap_s", RX0 - .06, RX1 + .06, FY1, FY1 + .025, RZ1 - .04, RZ1 + .06, "su_seam"))
        parts.append(A.box("cap_n", RX0 - .06, RX1 + .06, FY1, FY1 + .025, RZ0 - .06, RZ0 + .04, "su_seam"))
        parts.append(A.box("cap_e", RX1 - .04, RX1 + .06, FY1, FY1 + .025, RZ0, RZ1, "su_seam"))
        parts.append(A.box("cap_w", RX0 - .06, RX0 + .04, FY1, FY1 + .025, RZ0, RZ1, "su_seam"))

        # ── the void, lined with cassettes facing INTO it ──
        A.cassettes(parts, rnd, 'x', V["x0"], V["x1"], V["z0"], Y2C, top, +1, cop, "su_joint",
                    pitch=0.52, prefix="vn")
        A.cassettes(parts, rnd, 'x', V["x0"], V["x1"], V["z1"], Y2C, top, -1, cop, "su_joint",
                    pitch=0.52, prefix="vs")
        A.cassettes(parts, rnd, 'z', V["z0"], V["z1"], V["x0"], Y2C, top, +1, cop, "su_joint",
                    pitch=0.52, prefix="vw")
        A.cassettes(parts, rnd, 'z', V["z0"], V["z1"], V["x1"], Y2C, top, -1, cop, "su_joint",
                    pitch=0.52, prefix="ve")

        # ── the annex roofs (single storey, spa + corridor tail) ──
        AN = S["ANX"]
        H2 = AN["H2"]
        (ax0, ax1), (az0, az1) = AN["roofA"]
        (bx0, bx1), (bz0, bz1) = AN["roofB"]
        parts.append(A.box("annexA", ax0, ax1, H2, H2 + .3, az0, az1, "su_roof"))
        parts.append(A.box("annexB", bx0, bx1, H2, H2 + .3, bz0, bz1, "su_roof"))
        ay0, ay1 = H2 - .05, H2 + .32
        # annex A: its free edges — north, west, and the south stub west of B
        A.cassettes(parts, rnd, 'x', ax0 - .052, ax1, az0, ay0, ay1, -1, cop, "su_joint", prefix="an")
        A.cassettes(parts, rnd, 'z', az0, az1, ax0, ay0, ay1, -1, cop, "su_joint", prefix="aw")
        A.cassettes(parts, rnd, 'x', ax0 - .052, bx0, az1, ay0, ay1, +1, cop, "su_joint", prefix="as")
        # annex B: west and south
        A.cassettes(parts, rnd, 'z', bz0, bz1, bx0, ay0, ay1, -1, cop, "su_joint", prefix="bw")
        A.cassettes(parts, rnd, 'x', bx0 - .052, bx1, bz1, ay0, ay1, +1, cop, "su_joint", prefix="bs")
        return L.join(parts, NAME, origin=None)
