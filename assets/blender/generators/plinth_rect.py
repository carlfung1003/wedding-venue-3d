"""plinth_rect — the white rectangular plinth (decor-plinths-and-hats.jpg, left).

*unit*: .30 × .30 × 1.0; the game scales Y to 1.40–1.98. Origin base centre.
Material `paint_w`. Budget 200 tris / 256 atlas / bevel .006.

Deliberately the simplest asset in the set: a bevelled box with a satin paint
finish and baked AO. It exists to prove the pipeline end to end.
"""
import wv_lib as L

NAME = "plinth_rect"
ATLAS = 256
BEVEL = 0.006
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 200
FRONT = "-Z"
ORIGIN = "floor"

W, H = 0.30, 1.0


def build():
    body = L.box("body", (W, W, H), (0, 0, H / 2), "paint_w")
    return L.join([body], NAME, origin="floor")
