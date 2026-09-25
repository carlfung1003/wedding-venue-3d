"""atrium_baluster — the stainless post of the atrium's glass balustrades
(KAN-211 wave B; clubhouse-atrium.jpeg: slim brushed posts between frameless
panels, round glass clamps, the copper cap resting on top).

Origin at the post's foot (the deck / the stair's pitch line), y up. Ø 42 mm
× 1.0 m under the cap rail (the cap brings the rail to 1.045), a Ø 100 mm
base flange, and two pairs of Ø 50 mm clamps facing ±Z (along the run) at
y 0.25 and 0.80 — they hold the panel either side. Instanced at every post
position buildBalustrade used (and on the stair, plumb, not tilted).
"""
import math
import wv_lib as L
import _arch as A

NAME = "atrium_baluster"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.05
AO_STRENGTH = 0.5
TRIS = 200
FRONT = "-Z"
ORIGIN = "floor"


def build():
    with A.frame("local"):
        parts = [
            A.cyl_y("post", 0.021, 0, 0.0, 1.0, 0, "at_inox", n=8),
            A.cyl_y("flange", 0.05, 0, 0.0, 0.012, 0, "at_inox", n=10),
        ]
        for y in (0.25, 0.80):
            for s in (-1, 1):
                parts.append(L.cyl(f"clamp{y}{s}", 0.025, 0.03, A.B_(0, y, s * 0.036), "at_inox", n=8,
                                   rot=(math.pi / 2, 0, 0)))
        return L.join(parts, NAME, origin=None)
