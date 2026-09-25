"""topiary_ball — the rounded clipped topiary, replacing campus.js's UNIT_BLOB in
the `topiaryI` (the planted terrace edge) and `spTopiaryI` (the second pool's
pavilion) buckets. KAN-208 wave 2.

Unit-sphere envelope, centred (±0.5). A cube-sphere on a p = 2.3 superellipsoid:
a trimmed ball, just full enough at the shoulder to read as clipped rather
than as a sphere, with a faint leafy lump. See _flora.superellipsoid.

⚠ GEOMETRY ONLY (BAKE = False): campus.js's MAT.hedge stays the game's.
"""
import _flora as F
import wv_lib as L

NAME = "topiary_ball"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 320
FRONT = "-Z"
ORIGIN = "centre"


def build():
    o = F.superellipsoid(L.rng(NAME), pw=2.3, py=2.3, amp=.02, uvk=2.2).to_object(NAME, "leaf", merge=True)
    L._orient_normals(o)
    return L.join([o], NAME, origin=None)
