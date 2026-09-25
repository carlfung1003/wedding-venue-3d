"""shrub_fringe — 16 alpha-cut leaf-clump CARDS around shrub_core's lobes (same
frame, same lobe layout): the silhouette of every shrub mass. The game pairs it
with js/foliage.js's leaf material (shrub_leaf.webp / boug_leaf.webp, alphaTest,
DoubleSide, no instance colour — the palm fronds' program). KAN-208 wave 4.

Variant A; `shrub_fringe_b` is the same lobes with its own card draw — nature.js
gives even-indexed shrubs A and odd B. GEOMETRY ONLY (BAKE = False).
"""
import _flora as F

NAME = "shrub_fringe"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 32
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "fringe", "shrub", cards=16, variant=0)
