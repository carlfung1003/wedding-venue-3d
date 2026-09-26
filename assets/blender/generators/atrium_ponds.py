"""atrium_ponds — the two raised mirror-pond edgings, as laid stone (KAN-211
wave B; clubhouse-atrium.jpeg + atrium-water-feature.jpg + IMG_8102).

The photos: a knee-high box of grey granite cladding TILES (~0.6 m long,
full-height, fine joints), capped with large polished COPING slabs (~0.7 m,
mitred at the corners, overhanging the cladding by ~20 mm with an eased
edge), a slim shadow reveal where the box meets the gravel. The water lies a
few centimetres under the coping. The old build was four flat-textured boxes
and a pale coping that read WHITE against the photo's mid grey
(coping (103,105,102), sides (108,108,110) in sun, far darker in shade).

SITE FRAME (atrium centre). Footprints = SITE.ATRIUM.PONDS exactly (the pond
colliders are laid on those rectangles and do not move); RIM 0.40, wall T
0.42, water at RIM − 0.055 — the same numbers atrium.js's buildPond uses.
The water plane and the dark basin floor stay atrium.js's (the water is the
game's mirror material; a bake cannot reflect).

KAN-211 POLISH: the photo's edging is POLISHED BLACK granite — cladding sides
in shade median 30…57, coping tops readable only as sky reflection (130…194).
Wave B's grey keys baked pale (the render read tops (138,142,145) / sides
(90,86,84)). Now its own near-black keys (`at_bgran` / `_b` / `at_bcoping`,
_arch.py — at_granite / at_coping stay for atrium_portal) and the look is the
REFLECTION: atrium.js bakeMat rough .10 + ENV_OVERRIDE atrium_ponds [1.3, .42]
(a real envKnob) → sides (47,47,47), tops (103,103,106) at archB-photo.
Geometry and the tile layout are unchanged (11,088 tris).
"""
import wv_lib as L
import _arch as A

NAME = "atrium_ponds"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.5
TRIS = 12000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"at_joint": 0.08}

RIM, T = 0.40, 0.42
WY = RIM - 0.055
CT = 0.05            # coping thickness (the top sits at RIM + .035 as before)
OVER = 0.02          # coping overhang, both faces
TILE, SLAB = 0.60, 0.72


def _cuts(a, b, pitch):
    n = max(1, round((b - a) / pitch))
    return [(a + (b - a) * i / n, a + (b - a) * (i + 1) / n) for i in range(n)]


def build():
    T_ = A.atrium()
    parts = []
    tones = ["at_bgran", "at_bgran_b"]
    top = RIM + 0.035
    with A.frame("atrium"):
        for p, (cx, cz, w, d) in enumerate(T_["PONDS"]):
            x0, x1, z0, z1 = cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2
            # the joint core — the box the tiles are laid on (inset 6 mm)
            e = 0.006
            for (za, zb) in ((z0, z0 + T), (z1 - T, z1)):
                parts.append(A.box(f"core{p}{za:.2f}", x0 + e, x1 - e, 0.03, top - CT, za + e, zb - e, "at_joint"))
            for (xa, xb) in ((x0, x0 + T), (x1 - T, x1)):
                parts.append(A.box(f"corex{p}{xa:.2f}", xa + e, xb - e, 0.03, top - CT, z0 + T, z1 - T, "at_joint"))
            # the shadow reveal at the foot (the box sits on a recessed plinth)
            parts.append(A.box(f"foot{p}", x0 + 0.03, x1 - 0.03, 0.0, 0.035, z0 + 0.03, z1 - 0.03, "at_joint"))
            # OUTER cladding tiles, 12 mm thick, 5 mm joints, alternating tone
            k = 0
            for (za, zb, face) in ((z0, None, "n"), (z1, None, "s")):
                for i, (a, b) in enumerate(_cuts(x0, x1, TILE)):
                    zf = za
                    zz = (zf - 0.012, zf) if face == "n" else (zf, zf + 0.012)
                    parts.append(A.box(f"t{p}{face}{i}", a + 0.0025, b - 0.0025, 0.035, top - CT - 0.004,
                                       zz[0], zz[1], tones[(i + p) % 2]))
            for (xa, face) in ((x0, "w"), (x1, "e")):
                for i, (a, b) in enumerate(_cuts(z0, z1, TILE)):
                    xx = (xa - 0.012, xa) if face == "w" else (xa, xa + 0.012)
                    parts.append(A.box(f"t{p}{face}{i}", xx[0], xx[1], 0.035, top - CT - 0.004,
                                       a + 0.0025, b - 0.0025, tones[(i + p + 1) % 2]))
            # INNER face above the water (the strip you see over the coping's lip)
            for (za, zb) in ((z0 + T, z0 + T + 0.01), (z1 - T - 0.01, z1 - T)):
                parts.append(A.box(f"in{p}{za:.2f}", x0 + T, x1 - T, WY - 0.08, top - CT, za, zb, "at_bgran_b"))
            for (xa, xb) in ((x0 + T, x0 + T + 0.01), (x1 - T - 0.01, x1 - T)):
                parts.append(A.box(f"inx{p}{xa:.2f}", xa, xb, WY - 0.08, top - CT, z0 + T, z1 - T, "at_bgran_b"))
            # the COPING: long runs full length (picture-frame, mitres implied by
            # the corner slabs), slabs of ~0.72 m with 4 mm joints, bevelled
            cw = T + 2 * OVER
            cop = []
            for (zc, face) in ((z0 + T / 2, "n"), (z1 - T / 2, "s")):
                for i, (a, b) in enumerate(_cuts(x0 - OVER, x1 + OVER, SLAB)):
                    cop.append(A.box(f"c{p}{face}{i}", a + 0.002, b - 0.002, top - CT, top,
                                     zc - cw / 2, zc + cw / 2, "at_bcoping"))
            for (xc, face) in ((x0 + T / 2, "w"), (x1 - T / 2, "e")):
                for i, (a, b) in enumerate(_cuts(z0 + T + OVER, z1 - T - OVER, SLAB)):
                    cop.append(A.box(f"c{p}{face}{i}", xc - cw / 2, xc + cw / 2, top - CT, top,
                                     a + 0.002, b - 0.002, "at_bcoping"))
            L.bevel(cop, width=0.008, segments=2)
            parts += cop
        return L.join(parts, NAME, origin=None)
