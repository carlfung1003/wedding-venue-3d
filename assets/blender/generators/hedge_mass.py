"""hedge_mass — a clipped foliage mass, replacing campus.js's UNIT_BLOB
(IcosahedronGeometry(.5, 1)) in the `hedgeBlobI` bucket: the sea-edge planting
band, the villas' courtyard masses, the rooftop planters, the lattice-screen
greenery, the bar canopy's trailing planting. KAN-208 wave 2.

Unit-sphere envelope, centred (±0.5), because every call site scales it through
mat4(). A cube-sphere pushed onto a superellipsoid (p = 3.5): a flat clipped top
and full shoulders instead of a faceted lens tapering to a point. See
_flora.superellipsoid.

⚠ GEOMETRY ONLY (BAKE = False): campus.js's MAT.hedge stays the game's.
"""
import _flora as F
import wv_lib as L

NAME = "hedge_mass"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 320
FRONT = "-Z"
ORIGIN = "centre"


def build():
    o = F.superellipsoid(L.rng(NAME), pw=3.5, py=3.5, amp=.03).to_object(NAME, "leaf", merge=True)
    L._orient_normals(o)
    return L.join([o], NAME, origin=None)
