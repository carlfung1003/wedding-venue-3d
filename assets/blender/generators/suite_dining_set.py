"""suite_dining_set — the WHITE OUTDOOR DINING SET on the suite's 2F balcony
(KAN-211 wave C).

Replaces js/suite.js buildSecondFloor's balcony table (one white slab on four
posts) and its four chair boxes. The hotel deck's p5 photograph ("white wicker
8-seat dining set on red timber deck") and pimg-002 (a row of white chairs
behind the balustrade) give the set: a slim white table and EIGHT white woven
armchairs with cushions, four a side, backs to the glass and to the rail.

SITE frame "suite". The balcony is only 2.0 m deep (SITE.SUITE.balconyD: z ZS
−13.5 … balZ −11.5, the glass at −11.56), so the chairs are tucked: table
2.6 × 0.76 centred on z −12.55 (suite.js had −12.5 — the extra 5 cm keeps the
rail-side backs 0.14 m off the balustrade glass). Feet on the deck at 3.78.
No colliders: buildColliders registers nothing on the 2F but walls and the
stair, so only the silhouette is load-bearing.
"""
import wv_lib as L
import _arch as A

NAME = "suite_dining_set"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.5
TRIS = 4200
FRONT = "-Z"
ORIGIN = "site"


def chair(parts, i, x, y, z, face):
    """A woven armchair, seat centre (x, z), its FRONT facing `face` (±1 along z)."""
    sw, sd, sh = .50, .48, .44
    zb = z - face * sd / 2                          # the back edge
    # woven body: a seat shell, a back, two arm panels
    seat = A.box(f"c{i}seat", x - sw / 2, x + sw / 2, y + sh - .10, y + sh, z - sd / 2, z + sd / 2, "su_wicker")
    za, zc = sorted((zb, zb - face * .07))
    back = A.box(f"c{i}back", x - sw / 2, x + sw / 2, y + sh - .10, y + .86, za, zc, "su_wicker")
    L.bevel([seat, back], width=.02, segments=1)
    parts += [seat, back]
    for s in (-1, 1):
        xa, xb = sorted((x + s * sw / 2, x + s * (sw / 2 - .06)))
        arm = A.box(f"c{i}arm{s}", xa, xb, y + sh - .10, y + .64, min(za, z + face * sd / 2 - face * .06),
                    max(zc, z + face * sd / 2 - face * .06), "su_wicker")
        L.bevel([arm], width=.015, segments=1)
        parts.append(arm)
    # four slim legs
    for sx in (-1, 1):
        for sz in (-1, 1):
            lx, lz = x + sx * (sw / 2 - .04), z + sz * (sd / 2 - .04)
            parts.append(A.box(f"c{i}leg{sx}{sz}", lx - .018, lx + .018, y, y + sh - .10, lz - .018, lz + .018, "su_wicker"))
    # the cushion
    cu = A.box(f"c{i}cush", x - sw / 2 + .07, x + sw / 2 - .07, y + sh, y + sh + .07,
               z - sd / 2 + .02 + (.07 if face > 0 else 0), z + sd / 2 - .02 - (.07 if face < 0 else 0), "su_cushion")
    L.bevel([cu], width=.025, segments=1)
    parts.append(cu)


def build():
    S = A.suite()
    parts = []
    with A.frame("suite"):
        y = S["YF2"] - .02                          # the deck, 3.78
        cz = -12.55
        tw, td, th = 2.6, .76, .74
        top = A.box("top", -tw / 2, tw / 2, y + th - .04, y + th, cz - td / 2, cz + td / 2, "su_top")
        L.bevel([top], width=.01, segments=1)
        parts.append(top)
        parts.append(A.box("apron", -tw / 2 + .06, tw / 2 - .06, y + th - .12, y + th - .04,
                           cz - td / 2 + .06, cz + td / 2 - .06, "su_top"))
        for sx in (-1, 1):
            for sz in (-1, 1):
                lx, lz = sx * (tw / 2 - .10), cz + sz * (td / 2 - .08)
                parts.append(A.box(f"leg{sx}{sz}", lx - .03, lx + .03, y, y + th - .04, lz - .03, lz + .03, "su_top"))
        xs = (-.96, -.32, .32, .96)
        k = 0
        for x in xs:
            chair(parts, k, x, y, cz - td / 2 - .20, +1); k += 1      # glass side, facing the rail
            chair(parts, k, x, y, cz + td / 2 + .20, -1); k += 1      # rail side, facing the house
        return L.join(parts, NAME, origin=None)
