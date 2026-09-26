"""walkway_deck — the clubhouse's UPPER WALKWAY as architecture (KAN-211 wave D):
LINK (the bridge from the check-in balcony across the courtyard), SLOT (the
2.2 m corridor between the suite's east wall and Garden Room D1) and HEAD (the
landing at the atrium's 2F door) — the route every guest walks from the lobby
to the atrium gallery and the suite's 2F.

Replaces, in campus.js buildArrival §I (each kept as the `else` of
`haveWalk`): the three `walkDeck()` MAT.blackPolish slabs, the LINK's eight
charcoal columns (`arrColI` at those call sites only — the lounge deck's two
stay), its warm soffit box (`arrSoffitI` there) and every `bal()`'s copper
rail box (`arrRailI` there — the internal stair's balusters keep theirs). The
game keeps every glass pane (`arrGlassRailI`, MAT.clear) and EVERY collider.

What it is (entrance video f_021 / f_030 through the lobby glass; the balcony
language of lounge_facade, which the LINK leaves from):
  · a honed charcoal PAVER deck (1.2 × 0.6 m, three tones, 6 mm open joints
    over a black bed) whose top face is EXACTLY lobbyY − .02 — the old slab's
    top, so the walker's feet sit where they always did (floorY is site.js's);
  · the LINK's edges: a pale stone FASCIA BEAM (ar_cap, the balcony's) with a
    dark drip; under it a CEDAR SOFFIT between the beams (the balcony's too);
  · the columns: Ø .30 dark steel shafts on base plates with a cap plate and a
    steel CROSS-BEAM under the deck between each pair;
  · every balustrade line: a dark steel SHOE channel under the game's glass and
    a flat COPPER CAP on it (atrium_rail's language) — one line list, derived
    with campus.js's own arithmetic (incl. the exterior stair landing's east
    edge, _xsEast = 9.65).
ARRIVAL frame (origin (backX, 0, axisZ) = (33, 0, −8)), numbers from the live
js/site.js. One identity instance at ANCHOR().
"""
import wv_lib as L
import _arch as A

NAME = "walkway_deck"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.5
TRIS = 9000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"wk_pave": 1.0, "wk_pave1": 1.0, "wk_pave2": 1.0, "wk_bed": 0.08,
             "cedar": 0.8, "ar_cap": 0.8, "wk_steel": 0.5, "at_copper": 0.6, "ar_corten_d": 0.3}


def rails(AR, XS):
    """campus.js §I's bal() lines, same order, same arithmetic."""
    LK, SL, HD = AR["LINK"], AR["SLOT"], AR["HEAD"]
    xs_east = XS["x"] - (1 if XS["x"] > 0 else -1) * XS["landingBack"] + XS["landingW"] / 2
    return [
        (SL["x1"], SL["z1"], LK["x1"], SL["z1"]),
        (xs_east, SL["z1"], SL["x1"], SL["z1"]),
        (SL["x1"], LK["z0"], LK["x1"], LK["z0"]),
        (SL["x1"], -17.8, SL["x1"], LK["z0"]),
        (SL["x1"], HD["z0"], SL["x1"], HD["z1"]),
        (SL["x0"], -13.5, SL["x0"], -8.1),
        (HD["x0"], HD["z0"] + .4, HD["x0"], HD["z1"]),
        (HD["x0"], HD["z1"], SL["x0"], HD["z1"]),
    ]


def columns(LK):
    """campus.js: for (x = LK.x0 + 2.4; x < LK.x1 − 1.0; x += 4.6) × z0 + .35 / z1 − .35"""
    xs = []
    x = LK["x0"] + 2.4
    while x < LK["x1"] - 1.0:
        xs.append(x)
        x += 4.6
    return xs, (LK["z0"] + .35, LK["z1"] - .35)


def build():
    S = A.site()
    AR, LY = S["AR"], S["LY"]
    LK, SL, HD = AR["LINK"], AR["SLOT"], AR["HEAD"]
    rnd = L.rng(NAME)
    ced = A.cedar("cedar")
    parts = []
    TOP = LY - .02
    BED = TOP - .03

    def pave(tag, x0, x1, z0, z1, along_x):
        """the bed slab + a paver field over [x0, x1] × [z0, z1]"""
        for i, (xa, xb) in enumerate(A.spans(x0, x1, 5.0)):
            for j, (za, zb) in enumerate(A.spans(z0, z1, 5.0)):
                parts.append(A.box(f"{tag}_bed{i}_{j}", xa, xb, LY - .32, BED, za, zb, "wk_bed"))
        la, lb = (x0, x1) if along_x else (z0, z1)          # the run
        wa, wb = (z0, z1) if along_x else (x0, x1)          # across
        nl = max(1, round((lb - la) / 1.2))
        nw = max(1, round((wb - wa) / 0.6))
        J = .003
        for i in range(nl):
            a0 = la + (lb - la) * i / nl
            a1 = la + (lb - la) * (i + 1) / nl
            # stretcher bond: every other course shifts half a paver across
            off = 0.5 if i % 2 else 0.0
            cuts = sorted({wa, wb, *[wa + (wb - wa) * (k + off) / nw for k in range(nw + 1)
                                     if wa < wa + (wb - wa) * (k + off) / nw < wb]})
            for k in range(len(cuts) - 1):
                w0, w1 = cuts[k], cuts[k + 1]
                if w1 - w0 < .05:
                    continue
                key = ("wk_pave", "wk_pave1", "wk_pave2")[rnd.randrange(3)]
                if along_x:
                    parts.append(A.box(f"{tag}_p{i}_{k}", a0 + J, a1 - J, BED, TOP, w0 + J, w1 - J, key))
                else:
                    parts.append(A.box(f"{tag}_p{i}_{k}", w0 + J, w1 - J, BED, TOP, a0 + J, a1 - J, key))

    with A.frame("arrival"):
        # ── the decks: SLOT whole; LINK east of the slot; HEAD north of it
        pave("sl", SL["x0"], SL["x1"], SL["z0"], SL["z1"], along_x=False)
        pave("lk", SL["x1"], LK["x1"], LK["z0"], LK["z1"], along_x=True)
        pave("hd", HD["x0"], HD["x1"], HD["z0"], SL["z0"], along_x=True)

        # ── the LINK's edges: pale stone fascia beam + dark drip, both sides + the
        #    balcony end is lounge_facade's; the slot end meets the slot deck
        lz0, lz1 = LK["z0"], LK["z1"]
        for s, z in ((-1, lz0), (1, lz1)):
            for i, (xa, xb) in enumerate(A.spans(SL["x1"], LK["x1"], 5.0)):
                fa, fb = sorted((z, z + s * .08))
                parts.append(A.box(f"fas{s}_{i}", xa, xb, LY - .52, TOP, fa, fb, "ar_cap"))
                da, db = sorted((z + s * .02, z + s * .09))
                parts.append(A.box(f"drip{s}_{i}", xa, xb, LY - .56, LY - .52, da, db, "ar_corten_d"))
        # the cedar soffit between the beams, hung under the bed (boards across)
        for i, (xa, xb) in enumerate(A.spans(SL["x1"], LK["x1"], 5.0)):
            o = A.box(f"sof{i}", xa, xb, LY - .40, LY - .34, lz0 + .02, lz1 - .02, ced)
            A.world_uv(o, tile=1.2, rot=False)
            parts.append(o)

        # ── the LINK's columns: Ø .30 shaft, base + cap plates, a cross-beam per pair
        xs, (cz0, cz1) = columns(LK)
        top = LY - .40
        for x in xs:
            for cz in (cz0, cz1):
                parts.append(A.cyl_y(f"col{x:.1f}_{cz:.1f}", .15, x, .06, top - .10, cz, "wk_steel", n=16))
                parts.append(A.box(f"cb{x:.1f}_{cz:.1f}", x - .24, x + .24, 0, .06, cz - .24, cz + .24, "wk_steel"))
                parts.append(A.box(f"cc{x:.1f}_{cz:.1f}", x - .20, x + .20, top - .10, top - .07, cz - .20, cz + .20, "wk_steel"))
            parts.append(A.box(f"xb{x:.1f}", x - .10, x + .10, top - .07, top, cz0 - .22, cz1 + .22, "wk_steel"))

        # ── the balustrade lines: shoe channel + flat copper cap (glass is the game's)
        for i, (x1, z1, x2, z2) in enumerate(rails(AR, S["XS"])):
            if abs(x2 - x1) > abs(z2 - z1):
                a0, a1 = sorted((x1, x2))
                for j, (xa, xb) in enumerate(A.spans(a0, a1, 5.0)):
                    parts.append(A.box(f"shoe{i}_{j}", xa, xb, TOP, LY + .07, z1 - .045, z1 + .045, "wk_steel"))
                    parts.append(A.box(f"cap{i}_{j}", xa - (.03 if j == 0 else 0), xb + .03,
                                       LY + 1.035, LY + 1.10, z1 - .04, z1 + .04, "at_copper"))
            else:
                a0, a1 = sorted((z1, z2))
                for j, (za, zb) in enumerate(A.spans(a0, a1, 5.0)):
                    parts.append(A.box(f"shoe{i}_{j}", x1 - .045, x1 + .045, TOP, LY + .07, za, zb, "wk_steel"))
                    parts.append(A.box(f"cap{i}_{j}", x1 - .04, x1 + .04, LY + 1.035, LY + 1.10,
                                       za - (.03 if j == 0 else 0), zb + .03, "at_copper"))
        return L.join(parts, NAME, origin=None)
