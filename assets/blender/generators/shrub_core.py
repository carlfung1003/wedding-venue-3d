"""shrub_core — the opaque CORE of every broadleaf shrub mass: nature.js's shrub
masses (the 825-instance `blobGeo(…, 1, .5)` bucket, dune scrub included) and
bougainvillea mounds, water.js's river-dressing shrubs, campus.js's villa-wall
bougainvillea (a .5-scaled clone). KAN-208 wave 4.

Radius-1 unit frame, centred (the IcosahedronGeometry(1, …) it replaces): an
80-tri icosahedron pushed onto a union of five lobes. The silhouette's leafy
break-up is `shrub_fringe` (+ `_b`), a second bucket on the same matrices.

⚠ GEOMETRY ONLY (BAKE = False): the game keeps MAT.shrub / MAT.boug / plantM
and every per-instance colour. See ASSET_SPEC Group J and _flora.shrub_core.
"""
import _flora as F

NAME = "shrub_core"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 80
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "core", "shrub")
