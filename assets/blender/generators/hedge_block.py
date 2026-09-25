"""hedge_block — a free-standing clipped hedge block, the unit box campus.js
draws its hedges with (buckets hedgeI — the terrace edge and the arrival lane's
flank blocks —, arrHedgeI — the arrival court's batter and beds —, and
spHedgeI — the second pool's pavilion). KAN-208 wave 2.

Unit envelope, centred (±0.5), exactly UNIT_BOX's, because every call site
scales it non-uniformly through mat4(). Every vertical and top edge rounded,
base square, faint leafy lumps. See _flora.hedge_block.

⚠ GEOMETRY ONLY (BAKE = False): campus.js's MAT.hedge stays the game's (it now
carries hedge.webp — see CLAUDE.md KAN-208 WAVE 2). UV density is authored here
(2 tiles per unit face) because the material's repeat is 1 × 1.
"""
import _flora as F
import wv_lib as L

NAME = "hedge_block"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 280
FRONT = "-Z"
ORIGIN = "centre"


def build():
    o = F.hedge_block(L.rng(NAME)).to_object(NAME, "leaf", merge=True)
    L._orient_normals(o)
    return L.join([o], NAME, origin=None)
