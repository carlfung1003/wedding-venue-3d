"""atrium_rail — the atrium's copper cap rail, a 1 m module (KAN-211 wave B;
clubhouse-atrium.jpeg + atrium-water-feature.jpg: a FLAT, wide copper cap
sitting on the glass, not a round tube — the courtyard's one warm line).

Module frame: runs along local Z over [−0.5, +0.5]; the cap is 76 mm wide
(x ±0.038) from y 0 to y 0.045, eased top arrises, a 20 mm glazing channel
underneath (the glass stands in it). atrium.js stretches z to each run's
length and tilts it for the stair (a solid copper colour stretches cleanly).
The game sets the finish (metalness, roughness, env) in archMat.
"""
import wv_lib as L
import _arch as A

NAME = "atrium_rail"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.03
AO_STRENGTH = 0.5
TRIS = 240
FRONT = "-Z"
ORIGIN = "base"


def build():
    with A.frame("local"):
        cap = A.box("cap", -0.038, 0.038, 0.012, 0.045, -0.5, 0.5, "at_copper")
        L.bevel([cap], width=0.01, segments=3)
        lips = [A.box(f"lip{s}", s * 0.038 - (0.008 if s > 0 else 0), s * 0.038 + (0.008 if s < 0 else 0),
                      0.0, 0.012, -0.5, 0.5, "at_copper") for s in (-1, 1)]
        return L.join([cap] + lips, NAME, origin=None)
