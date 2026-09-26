"""suite_walls — the presidential suite's SIDE + BACK walls and the spa annex's
envelope as architecture (KAN-211 wave D).

Replaces, in js/suite.js (each kept as the `else` of `HC.walls`):
  buildShell   the four MT.plaster wallRun()s — north (ZN), the SITE-east run
               (authoring X0, which carries the 2F link door) and its short
               upper piece over the 1F corner glazing, the SITE-west run
               (authoring X1: spa corridor openings + the frosted stair slot)
               and its south piece
  buildAnnex   the annex's five MT.plaster runs (north, outer, spa south,
               corridor south, the corridor's outer partition)

What it is (Yinyiju.webp — every villa in the enclave is crisp warm-white
RENDER, never a plain painted box; the suite's own piers are taupe stone):
  · a CORE per run = the wall volume with suite.js's holes cut, in plain
    `su_plaster` — that is the room side and every reveal, as before;
  · on the OUTSIDE face only, RENDER PANELS 25 mm proud of the core on a
    ~1.6 m module with 22 mm shadow-gap joints and a deeper 30 mm floor-line
    reveal at the 2F slab (YF2), each panel its own random UV shift of
    render_white.webp so no tile repeats in a grid;
  · a taupe STONE PLINTH (the south piers' su_stone keys) 0 … .45 m, 35 mm
    proud, wherever the wall meets the ground outside;
  · panels stop short of every opening by the width of the surround that
    frames it (suite_facade: the north entry, the pantry door, the 2F link
    door), so the render never runs behind a casing.

⚠ SITE (mirror-CORRECTED) coordinates, frame "suite": suite.js authors in the
reversed brief frame, so every authoring x is negated ONCE here (sx()) and the
GLB is placed WITHOUT mx() (CLAUDE.md wave C).

⚠ One fix, visual only: suite.js's link-door hole ran from y 0 (wallRun cuts a
hole from the run's foot), leaving a 3.8 m-tall slot under the 2F door into
the great room's lining. The core fills it below the sill (YF2 − .06); its
collider already blocked feet below YF2 − .4 there, so nothing walkable moves.
"""
import wv_lib as L
import _arch as A

NAME = "suite_walls"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.5
TRIS = 9000
FRONT = "-Z"
ORIGIN = "site"
UV_WEIGHT = {"render": 1.0, "su_plaster": 0.12, "su_gap": 0.05,
             "su_stone0": 0.5, "su_stone1": 0.5, "su_stone2": 0.5}

PROUD = 0.025           # render panel depth off the core face
GAP = 0.022             # vertical / horizontal shadow-gap joint (18 mm read as nothing past 10 m)
FLOOR_GAP = 0.03        # the floor-line reveal at YF2
PITCH = 1.6             # panel module along the run
PLINTH = 0.45           # stone plinth height
PL_PROUD = 0.035
LINK_SUR = 0.24         # suite_facade's link-door stone surround width (read below)


def sx(x):
    """authoring (mirrored brief frame) x → SITE x"""
    return -x


def build():
    S = A.suite()
    rnd = L.rng(NAME)
    ren = A.render("render")
    parts = []
    X0, X1 = S["X0"], S["X1"]                # −8, 8 (symmetric)
    ZN, ZS, YF2, Y2C = S["ZN"], S["ZS"], S["YF2"], S["Y2C"]
    H2, EWT = S["H2"], S["EWT"]
    WT = 0.26
    spa = S["spa"]
    # the annex in AUTHORING numbers (suite.js), negated where used
    ANX_X0 = 8.0
    ANX_X1 = -spa["cx"] + spa["w"] / 2        # 14  (SITE spa.cx is −10.5)
    COR_X1 = ANX_X0 + S["corridorW"] + .3     # 9.9
    SPA_ZS = spa["cz"] + spa["d"] / 2         # −19.5
    COR_ZS = SPA_ZS + 2.5                     # −17
    STzN = -24.4                              # suite.js ST.zN (authoring = SITE, z is not mirrored)
    LK = S["LINK"]
    ROOF_ANX = H2 + .3                        # the annex roof slab's top

    def run(tag, axis, fixed, t, a0, a1, y0, y1, holes, out=None, ext=(), plinth=(),
            surround=None, core_key="su_plaster"):
        """one wall run in SITE numbers.
        axis 'x' = along x at z = fixed; 'z' = along z at x = fixed.
        holes: [(h0, h1, yb, yt)]; out: ±1 outward normal along the fixed axis
        (None = no exterior skin); ext: [(a0, a1, y0, y1)] where the outside is
        EXTERIOR; plinth: [(a0, a1)] runs meeting the ground outside;
        surround: {hole index: (side w, head w)} kept clear of render."""
        def put(name, aa, ab, ya, yb, fa, fb, mat):
            if axis == 'x':
                return A.box(name, aa, ab, ya, yb, fa, fb, mat)
            return A.box(name, fa, fb, ya, yb, aa, ab, mat)
        # ── the core, ≤ 5 m pieces (the longest island caps the atlas)
        k = 0
        for (pa, pb, pya, pyb) in A.rect_minus((a0, a1, y0, y1), holes):
            for (sa, sb) in A.spans(pa, pb, 5.0):
                for (ya, yb) in A.spans(pya, pyb, 5.0):
                    parts.append(put(f"{tag}_c{k}", sa, sb, ya, yb, fixed - t / 2, fixed + t / 2, core_key))
                    k += 1
        if out is None:
            return
        face = fixed + out * t / 2
        f0, f1 = sorted((face, face + out * PROUD))
        g0, g1 = sorted((face, face + out * .004))
        clear = []
        for i, (h0, h1, hb, ht) in enumerate(holes):
            sw, hw = (surround or {}).get(i, (0.0, 0.0))
            clear.append((h0 - sw, h1 + sw, hb, ht + hw))
        # ── the render panels on the exterior
        n = 0
        for (ea0, ea1, ey0, ey1) in ext:
            cols = max(1, round((ea1 - ea0) / PITCH))
            rows = []
            yb0 = max(ey0, PLINTH if plinth else ey0)
            cut = [yb0]
            if yb0 < YF2 < ey1:
                cut.append(YF2)
            cut.append(ey1)
            for r in range(len(cut) - 1):
                rows.append((cut[r], cut[r + 1]))
            for c in range(cols):
                ca = ea0 + (ea1 - ea0) * c / cols
                cb = ea0 + (ea1 - ea0) * (c + 1) / cols
                for (ra, rb) in rows:
                    ja = ca + (GAP / 2 if c > 0 else 0)
                    jb = cb - (GAP / 2 if c < cols - 1 else 0)
                    ya = ra + (FLOOR_GAP / 2 if abs(ra - YF2) < 1e-6 else (GAP / 2 if ra > ey0 + 1e-6 else 0))
                    yb = rb - (FLOOR_GAP / 2 if abs(rb - YF2) < 1e-6 else 0)
                    du, dv = rnd.random(), rnd.random()
                    for (pa, pb, pya, pyb) in A.rect_minus((ja, jb, ya, yb), clear):
                        o = put(f"{tag}_p{n}", pa, pb, pya, pyb, f0, f1, ren)
                        A.world_uv(o, tile=2.4, du=du, dv=dv)
                        parts.append(o)
                        n += 1
            # the shadow-gap floor under the joints: a dark skin just proud of the core
            for (pa, pb, pya, pyb) in A.rect_minus((ea0, ea1, yb0, ey1), clear):
                for (sa, sb) in A.spans(pa, pb, 5.0):
                    parts.append(put(f"{tag}_g{n}", sa, sb, pya, pyb, g0, g1, "su_gap"))
                    n += 1
        # ── the stone plinth
        p0, p1 = sorted((face, face + out * PL_PROUD))
        for (pa, pb) in plinth:
            for (qa, qb, qy0, qy1) in A.rect_minus((pa, pb, 0.0, PLINTH), clear):
                for (sa, sb) in A.spans(qa, qb, 1.2):
                    key = ("su_stone0", "su_stone1", "su_stone2")[rnd.randrange(3)]
                    o = put(f"{tag}_pl{n}", sa + .004, sb - .004, qy0, qy1, p0, p1, key)
                    parts.append(o)
                    n += 1
            # the plinth's top edge: a thin dark drip line
            for (qa, qb, qy0, qy1) in A.rect_minus((pa, pb, PLINTH, PLINTH + .012), clear):
                d0, d1 = sorted((face, face + out * .012))
                parts.append(put(f"{tag}_pd{n}", qa, qb, qy0, qy1, d0, d1, "su_gap"))
                n += 1

    with A.frame("suite"):
        # 1 · NORTH (z = ZN), exterior to −z; the entry + pantry doors
        #     (authoring [−3.4, −1.6, 2.4], [−7.4, −6.0, 2.2] → SITE 1.6…3.4, 6.0…7.4);
        #     suite_facade's surrounds: entry .30 + .42 head, pantry .14 + .14
        run("n", 'x', ZN, EWT, X0, X1, 0, Y2C,
            [(1.6, 3.4, 0, 2.4), (6.0, 7.4, 0, 2.2)], out=-1,
            ext=[(X0 - EWT / 2 - PROUD, X1 + EWT / 2 + PROUD, 0, Y2C)],
            plinth=[(X0 - EWT / 2 - PL_PROUD, X1 + EWT / 2 + PL_PROUD)],
            surround={0: (.30, .47), 1: (.14, .14)})
        # 2 · SITE-EAST (authoring X0 → x = +8), exterior to +x; the 2F link door
        #     (hole z LK.z0 … z1, y YF2 − .06 … YF2 + 2.35 — filled below the sill)
        ex = sx(X0)
        run("e", 'z', ex, EWT, ZN, -16.6, 0, Y2C,
            [(LK["z0"], LK["z1"], YF2 - .06, YF2 + 2.35)], out=+1,
            ext=[(ZN - EWT / 2, -16.6, 0, Y2C)], plinth=[(ZN - EWT / 2, -16.6)],
            surround={0: (LINK_SUR, LINK_SUR + .02)})
        run("e2", 'z', ex, EWT, -16.6, ZS, YF2 - .4, Y2C, [], out=+1,
            ext=[(-16.6, ZS, YF2 - .4, Y2C)])
        # 3 · SITE-WEST (authoring X1 → x = −8), exterior to −x ABOVE the annex
        #     roof north of COR_ZS, and full height south of it
        wx = sx(X1)
        run("w", 'z', wx, EWT, ZN, COR_ZS, 0, Y2C,
            [(-26.25, -24.5, 0, 2.4), (STzN + .3, -21.0, 0, Y2C), (-19.2, -17.4, 0, 2.4)], out=-1,
            ext=[(ZN - EWT / 2, COR_ZS, ROOF_ANX, Y2C)], surround={1: (.05, 0)})
        run("w2", 'z', wx, EWT, COR_ZS, ZS, 0, Y2C, [], out=-1,
            ext=[(COR_ZS, ZS, 0, Y2C)], plinth=[(COR_ZS, ZS)])
        # 4 · THE ANNEX (spa + corridor), single storey to H2
        #     north: authoring x 8 … 14 → SITE −14 … −8, exterior −z
        run("an", 'x', ZN, EWT, sx(ANX_X1), sx(ANX_X0), 0, H2, [], out=-1,
            ext=[(sx(ANX_X1) - EWT / 2 - PROUD, X0 - EWT / 2 - PROUD, 0, H2)],
            plinth=[(sx(ANX_X1) - EWT / 2 - PL_PROUD, X0 - EWT / 2 - PL_PROUD)])
        #     outer (authoring x 14 → SITE −14), z ZN … SPA_ZS, the spa glazing hole
        run("ao", 'z', sx(ANX_X1), EWT, ZN, SPA_ZS, 0, H2, [(-25.2, -20.2, 0, H2)], out=-1,
            ext=[(ZN - EWT / 2, SPA_ZS + EWT / 2, 0, H2)], plinth=[(ZN - EWT / 2, SPA_ZS + EWT / 2)],
            surround={0: (.02, 0)})
        #     spa south (z SPA_ZS), authoring x 9.9 … 14 → SITE −14 … −9.9, hole 10.2 … 13.2
        run("as", 'x', SPA_ZS, EWT, sx(ANX_X1), sx(COR_X1), 0, H2,
            [(sx(13.2), sx(10.2), 0, H2)], out=+1,
            ext=[(sx(ANX_X1) - EWT / 2, sx(COR_X1), 0, H2)], plinth=[(sx(ANX_X1) - EWT / 2, sx(COR_X1))],
            surround={0: (.02, 0)})
        #     corridor south (z COR_ZS), authoring x 8 … 9.9 → SITE −9.9 … −8, door 8.4 … 9.3
        run("ac", 'x', COR_ZS, EWT, sx(COR_X1), sx(ANX_X0), 0, H2,
            [(sx(9.3), sx(8.4), 0, 2.4)], out=+1,
            ext=[(sx(COR_X1) - WT / 2, sx(ANX_X0) - EWT / 2, 0, H2)],
            plinth=[(sx(COR_X1) - WT / 2, sx(ANX_X0) - EWT / 2)], surround={0: (.02, .02)})
        #     the corridor's outer partition (authoring x 9.9 → SITE −9.9), z SPA_ZS … COR_ZS
        run("ap", 'z', sx(COR_X1), WT, SPA_ZS, COR_ZS, 0, H2, [], out=-1,
            ext=[(SPA_ZS + EWT / 2, COR_ZS - EWT / 2, 0, H2)], plinth=[(SPA_ZS + EWT / 2, COR_ZS - EWT / 2)])
        return L.join(parts, NAME, origin=None)
