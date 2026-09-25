"""hedge_run — one SEGMENT of a continuous clipped hedge (js/nature.js
hedgeRun(): the cabana wall), replacing its BoxGeometry(1, 1, 1, 2, 2, 2).
KAN-208 wave 2.

Unit envelope, centred (±0.5 on every axis) exactly like the box, because the
call site scales it (t, h, w) with local Z ALONG the run and y at h/2. The ±Z
ends are flat and full and the leafy lumps are periodic in z, so neighbouring
segments (which overlap 6 cm) meet without a notch. See _flora.hedge_run.

⚠ GEOMETRY ONLY (BAKE = False): nature.js's MAT.hedge (hedge.webp, repeat 2 × 1)
and its per-instance HSL colours stay the game's.
"""
import _flora as F
import wv_lib as L

NAME = "hedge_run"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 320
FRONT = "-Z"
ORIGIN = "centre"         # the unit cell's centre, as BoxGeometry


def build():
    o = F.hedge_run(L.rng(NAME)).to_object(NAME, "leaf", merge=True)
    L._orient_normals(o)
    return L.join([o], NAME, origin=None)
