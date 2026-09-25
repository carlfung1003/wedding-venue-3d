"""cocktail_glassware — the fifteen glass SHELLS on the round bar, as one mesh.
KAN-208 wave 3. See generators/_drinks.py for why the drinks are two assets.

⚠ GEOMETRY ONLY (BAKE = False). The game pairs this geometry with moments.js's
own `glassPale` (MeshStandardMaterial, transparent, opacity .45, roughness
.16) in a bucket of its own — the instanced, un-tinted glassPale program
already exists (K.glass), so no program is added, and NOTHING here may become
a transmission material (the champagne tower's coupes made three render the
campus a third time: CLAUDE.md, "the transmission win").

Every shell is a REAL wall (outer face up, a rolled rim, inner face back down
to the bowl floor) so the glass reads as a rim and two faces through which the
opaque drink shows. No UVs: glassPale carries no map. Origin = the bar TOP at
its centre (join origin=None), placed at (0, 1.13, 0) in the bar's frame.
"""
import wv_lib as L
import _drinks as D

NAME = "cocktail_glassware"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 7000
FRONT = "-Z"
ORIGIN = "base"


def build():
    parts = []
    for i, (kind, x, z) in enumerate(D.POS):
        n = D.N_FACET if kind == "highball" else D.N_ROUND
        parts.append(D.lathe(f"g{i}", D.shell_profile(kind), (x, -z, 0), "glass_pale", n=n))
    root = L.join(parts, NAME, origin=None)
    # the faceted highball keeps its 36° facets hard; the round glass is smooth
    L.shade_smooth(root, angle=30)
    return root
