"""suite_facade — the presidential suite's POOL-FACING ENVELOPE (KAN-211 wave C).

Replaces, in js/suite.js (every one kept as the `else` of a have-GLB flag):
  buildShell            the two south corner piers (MT.stonePier), the 2F
                        spandrel over the folding wall (MT.plaster), the 2F
                        link door's marble sill / sapele jambs / brass head
  buildFoldingGlassWall the head beam, floor track, both jambs, the stack post
  buildSecondFloor      the 2F glazing's bronze mullion grid (glazedBay), the
                        espresso head band + its sapele slats, the balcony slab
                        (MT.spaFloor) and the three round sapele handrails
The GLASS stays the game's (MT.glass / MT.glassRail, transparent — never a
transmission material); the leaves are `suite_leaf`, instanced.

SITE (mirror-CORRECTED) coordinates, frame "suite" (origin (0, 0, −20)).

What the photographs say (pimg-002, the hotel's p3 elevation across the pool,
measured; IMG_8096 for the 1F system):
  · PIERS: warm taupe stone panels, not charcoal — the sunlit pier face reads
    (107, 92, 82); laid here in six courses with real 8 mm joints, three tones;
  · THE BALCONY reads as a deep light warm-grey slab edge (158…184, 140…164,
    129…153) with a dark drip line, a glass balustrade in a dark shoe channel
    and a slim flat copper-toned cap (186, 145, 126) — not round timber rails;
    the deck is red timber (the deck's p5: "white wicker 8-seat dining set on
    red timber deck");
  · THE 2F WALL: slim warm-grey frames, a clerestory over a band of five
    horizontal louvre blades standing proud of the glass, doors below;
  · THE 1F WALL: IMG_8096's red-brown leaf system (Carl's own photo wins over
    the hotel's grey-framed one): head beam, jambs, track in sapele.
"""
import wv_lib as L
import _arch as A
from suite_soffit import BAL_Y

NAME = "suite_facade"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.4
AO_STRENGTH = 0.5
TRIS = 7000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"deck": 1.0, "su_joint": 0.05, "su_band_d": 0.3}


def build():
    S = A.suite()
    rnd = L.rng(NAME)
    deck = L.image_mat("deck", "deck_ipe.webp", roughness=0.6, fallback="ar_cedar")
    parts = []
    with A.frame("suite"):
        X0, X1, ZS, YF2, Y2C = S["X0"], S["X1"], S["ZS"], S["YF2"], S["Y2C"]
        GW = S["GW"]
        balZ = S["balZ"]

        # ── 1 · the two south corner piers, x ±(7 … 8), z ZS − .5 … ZS + .12 ──
        for s in (-1, 1):
            xa, xb = sorted((s * 7.0, s * 8.0))
            za, zb = ZS - .5, ZS + .12
            parts.append(A.box(f"pcore{s}", xa + .01, xb - .01, 0, Y2C, za + .01, zb - .01, "su_joint"))
            nC = 6
            for i in range(nC):
                ya, yb = Y2C * i / nC, Y2C * (i + 1) / nC - .008
                key = ("su_stone0", "su_stone1", "su_stone2")[rnd.randrange(3)]
                c = A.box(f"pier{s}_{i}", xa, xb, ya, yb, za, zb, key)
                L.bevel([c], width=.006, segments=1)
                parts.append(c)

        # ── 2 · the 1F folding wall's fixed frame (sapele) ──
        lh = GW["leafH"]
        parts.append(A.box("head", GW["x0"], GW["x1"], lh, lh + .18, ZS - .1, ZS + .1, "su_sapele"))
        parts.append(A.box("track", GW["x0"], GW["x1"], -.02, .02, ZS - .07, ZS + .07, "su_sapele_d"))
        parts.append(A.box("jambW", GW["x0"] - .09, GW["x0"], 0, lh + .18, ZS - .1, ZS + .1, "su_sapele"))
        parts.append(A.box("jambE", GW["x1"], GW["x1"] + .09, 0, lh + .18, ZS - .1, ZS + .1, "su_sapele"))
        # the stack post the folded leaves park against (authoring stackX0 + 8·dx)
        dx = (GW["leafW"] ** 2 - .94 ** 2) ** .5
        sx = GW["stackX0"] - 8 * dx                     # SITE: reflected, so it grows −x
        parts.append(A.box("stackpost", sx - .1, sx, 0, lh, ZS - .94, ZS + .05, "su_sapele"))
        # the spandrel from the head beam up to the 2F slab: a dark reveal
        parts.append(A.box("spandrel", GW["x0"], GW["x1"], lh + .18, YF2, ZS - .18, ZS - .02, "su_band_d"))

        # ── 3 · the BALCONY ──
        bx0, bx1 = -7.5, 7.5
        top = YF2 - .02                                  # the walk height, 3.78
        parts.append(A.box("balcore", bx0, bx1, BAL_Y + .03, top - .03, ZS, balZ - .02, "su_joint"))
        # red timber deck, boards along x
        for k, (xa, xb) in enumerate(A.spans(bx0, bx1, 5.0)):
            o = A.box(f"deck{k}", xa, xb, top - .03, top, ZS, balZ - .02, deck)
            A.world_uv(o, tile=1.2, rot=True)
            parts.append(o)
        # the slab-edge band: light warm-grey panels + a dark drip line, front + ends
        BY0, BY1 = BAL_Y, top + .06
        n = 10
        for i in range(n):
            xa = bx0 - .06 + (bx1 - bx0 + .12) * i / n
            xb = bx0 - .06 + (bx1 - bx0 + .12) * (i + 1) / n
            parts.append(A.box(f"band{i}", xa + .006, xb - .006, BY0 + .07, BY1, balZ - .02, balZ + .06, "su_band"))
        parts.append(A.box("bandjoint", bx0 - .06, bx1 + .06, BY0 + .07, BY1 - .01, balZ - .02, balZ + .05, "su_joint"))
        parts.append(A.box("drip", bx0 - .06, bx1 + .06, BY0, BY0 + .07, balZ - .03, balZ + .065, "su_band_d"))
        for s, x in ((-1, bx0), (1, bx1)):
            xa, xb = sorted((x, x + s * .06))
            parts.append(A.box(f"bend{s}", xa, xb, BY0 + .07, BY1, ZS, balZ + .06, "su_band"))
            parts.append(A.box(f"bdrip{s}", xa, xb, BY0, BY0 + .07, ZS, balZ + .065, "su_band_d"))
        # the glass shoe + the flat cap, on suite.js levelRail's own lines
        # (front: z balZ − .06; ends: x X0 + .56 / X1 − .56; glass .98 tall)
        gz = balZ - .06
        cy = top + .98
        parts.append(A.box("shoe_f", bx0 + .04, bx1 - .04, top, top + .09, gz - .045, gz + .045, "su_shoe"))
        parts.append(A.box("cap_f", bx0 + .02, bx1 - .02, cy - .03, cy + .035, gz - .035, gz + .035, "su_cap"))
        for s, x in ((-1, X0 + .56), (1, X1 - .56)):
            parts.append(A.box(f"shoe_{s}", x - .045, x + .045, top, top + .09, ZS + .02, gz + .045, "su_shoe"))
            parts.append(A.box(f"cap_{s}", x - .035, x + .035, cy - .03, cy + .035, ZS + .02, gz + .035, "su_cap"))

        # ── 4 · the 2F wall: frames, clerestory, louvre band (suite.js glazedBay
        #    x X0 + .6 … X1 − .6, 12 bays; the glass now runs to Y2C − .06) ──
        gx0, gx1 = X0 + .6, X1 - .6
        gy0, gy1 = YF2 + .05, Y2C - .06
        dh = YF2 + 2.30                                  # door head / louvre band foot
        cl = YF2 + 2.64                                  # clerestory sill
        t = .075
        for i in range(13):
            x = gx0 + (gx1 - gx0) * i / 12
            parts.append(A.box(f"mul{i}", x - .026, x + .026, gy0, gy1, ZS - .05, ZS + .05, "su_alu"))
        for name, ya, yb in (("sill", gy0, gy0 + .08), ("dhead", dh - .05, dh + .03),
                             ("csill", cl - .04, cl + .04), ("chead", gy1 - .08, gy1)):
            parts.append(A.box(name, gx0 - .04, gx1 + .04, ya, yb, ZS - t, ZS + t, "su_alu"))
        # five louvre blades, proud of the glass on outriggers at every 2nd mullion
        for k in range(5):
            y = dh + .07 + k * .055
            parts.append(A.box(f"lv{k}", -7.0, 7.0, y, y + .022, ZS + .10, ZS + .30, "su_alu"))
        for i in range(0, 13, 2):
            x = gx0 + (gx1 - gx0) * i / 12
            parts.append(A.box(f"lvb{i}", x - .02, x + .02, dh + .03, dh + .34, ZS + t, ZS + .30, "su_alu"))

        # ── 5 · the 2F door onto the clubhouse walkway (SITE x +8, the east wall;
        #    hole z LINK.z0 … z1, y YF2 … YF2 + 2.35) ──
        LK = S["LINK"]
        ex = LK["x"]
        hw = S["EWT"] / 2
        dy = YF2 + 2.35
        for z in (LK["z0"], LK["z1"]):
            za, zb = sorted((z, z + (-.11 if z == LK["z0"] else .11)))
            parts.append(A.box(f"ljamb{z}", ex - hw - .04, ex + hw + .04, YF2, dy + .11, za, zb, "ar_bronze"))
        parts.append(A.box("lhead", ex - hw - .04, ex + hw + .04, dy, dy + .11,
                           LK["z0"] - .11, LK["z1"] + .11, "ar_bronze"))
        sill = A.box("lsill", ex - hw - .1, ex + hw + .35, YF2 - .06, YF2 + .01,
                     LK["z0"] - .05, LK["z1"] + .05, "at_col_b")
        L.bevel([sill], width=.006, segments=1)
        parts.append(sill)
        # ── 6 · the NORTH ENTRY from the atrium portal (suite.js wallRun holes
        #    on the north wall: the entry [−3.4, −1.6, 2.4] and the pantry
        #    service door [−7.4, −6.0, 2.2], authoring → SITE 1.6 … 3.4 and
        #    6.0 … 7.4): a honed black stone surround in the atrium portal's
        #    language on the outer face, a bronze casing through the reveal,
        #    a stone threshold ──
        ZN, EWT = S["ZN"], S["EWT"]
        zo, zi = ZN - EWT / 2, ZN + EWT / 2          # outer / inner wall faces
        for tag, (h0, h1, hh, big) in (("e", (1.6, 3.4, 2.4, True)), ("p", (6.0, 7.4, 2.2, False))):
            jw = .30 if big else .14
            pr = .10 if big else .04
            for s_, x in ((-1, h0), (1, h1)):
                xa, xb = sorted((x, x + s_ * jw))
                j = A.box(f"n{tag}j{s_}", xa, xb, 0, hh + (.42 if big else .14), zo - pr, zo, "at_col" if big else "ar_bronze")
                L.bevel([j], width=.005, segments=1)
                parts.append(j)
                ca, cb = sorted((x, x - s_ * .035))
                parts.append(A.box(f"n{tag}c{s_}", ca, cb, 0, hh, zo, zi - .02, "ar_bronze"))
            hd = A.box(f"n{tag}h", h0 - jw, h1 + jw, hh, hh + (.42 if big else .14), zo - pr, zo, "at_col" if big else "ar_bronze")
            L.bevel([hd], width=.005, segments=1)
            parts.append(hd)
            parts.append(A.box(f"n{tag}ch", h0, h1, hh - .035, hh, zo, zi - .02, "ar_bronze"))
            if big:
                parts.append(A.box("ncopper", h0 - jw, h1 + jw, hh + .42, hh + .47, zo - .13, zo, "at_copper"))
                th = A.box("nthresh", h0 - .05, h1 + .05, 0, .02, zo - .12, zi - .02, "at_col_b")
                parts.append(th)
        return L.join(parts, NAME, origin=None)
