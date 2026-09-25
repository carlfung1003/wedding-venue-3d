"""palm_tall — the tall coconut palm of js/nature.js's three silhouettes
(palmVariants() spec 'tall'), as a TRUNK (this asset) and a CROWN
(`palm_tall_crown`, build_crown()). KAN-208 wave 2.

⚠ GEOMETRY ONLY — BAKE = False (the pool lanterns' rule, ASSET_SPEC.md). The
game keeps nature.js's MAT.bark (bark.webp, repeat 1.2 × 16) on the trunk and
MAT.frond (frond.webp, ClampToEdge, alphaTest .5, DoubleSide) on the crown, so
no new shader program and the night tints keep working. The generator owns UV0.

Both halves share ONE frame — origin at the trunk FOOT (nature.js's y = floor
− .18 is the scatter's business), game +Y up — and the crown's base is at
(bendX, h, bendZ) exactly where crownGeo() translated it, so the scatter's one
instance matrix drives both and requestPalms()'s lean-aiming (atan2(bendZ,
bendX)) and height-matching (spec.h) are unchanged. All the shape logic lives in
_flora.py (palm_trunk / palm_crown).
"""
import _flora as F

NAME = "palm_tall"
BAKE = False
ATLAS = 256               # unused (no bake)
BEVEL = 0
TRIS = 520               # module-wide: covers the crown (the larger half)
FRONT = "-Z"              # the lean is the game's (rotation.y), not a front
ORIGIN = "floor"          # the trunk foot — re-centring would move the crown


def build():
    return F.palm_part("tall", "trunk", NAME)


def build_crown():
    return F.palm_part("tall", "crown", NAME + "_crown")
