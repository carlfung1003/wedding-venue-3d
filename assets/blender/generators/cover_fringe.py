"""cover_fringe — 10 near-HORIZONTAL leaf-clump cards over cover_core. Every
cover instance is squashed ~5× in y (scale (cs, .22–.38, cs)), so a steep card
would be flattened into a smear; cards lying within ~30° of level survive the
squash and overhang the core's rim, which is what breaks the bed's edge.
KAN-208 wave 4. GEOMETRY ONLY (BAKE = False)."""
import _flora as F

NAME = "cover_fringe"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 20
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "fringe", "cover", cards=10, detail=0,
                        ymin=.2, tilt=(0, .5), size=(.7, 1.0), out=(.75, 1.0), nrm_mix=.4)
