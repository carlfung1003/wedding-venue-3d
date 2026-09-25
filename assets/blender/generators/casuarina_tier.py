"""casuarina_tier — one needle tier of the sea band's casuarinas (campus.js
`casuLeafI`, three per tree), replacing THREE.ConeGeometry(.5, 1, 10) inside the
same envelope (radius .5 at y −.5, apex +.5, centred): 13 + 4 drooping needle
curtains on casuarina.webp, no base cap. KAN-208 wave 4.
GEOMETRY ONLY (BAKE = False) — campus.js's casuNeedle material stays."""
import _flora as F
import wv_lib as L

NAME = "casuarina_tier"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 110
FRONT = "-Z"
ORIGIN = "centre"


def build():
    o = F.casuarina_tier(L.rng(NAME)).to_object(NAME, "leaf")
    return L.join([o], NAME, origin=None)
