"""head_table — the ivory-draped head table on the dinner walk.

Spec row: 6.0 L (X) × 1.0 W, top surface y .81, draped to the ground. Origin
floor centre; front −Z. `ivory` / `linen`. Budget 2,000 / 512 / BEVEL 0.

A cloth top (rounded-corner slab, `ivory`) over `_seating.rect_skirt` — a
rounded-rectangle loop lathed to the grass with ~28 soft folds that deepen
toward the hem. The linen picture wraps by perimeter distance (0.7 m tiles).
"""
import math
import wv_lib as L
import _seating as S

NAME = "head_table"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2000
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
LEN, WID, Z_TOP, T_TOP = 6.0, 1.0, 0.81, 0.05


def build():
    rnd = L.rng(NAME)
    top_m = S.tex("linen_top", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    skirt_m = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    parts = []

    top = S.slab("top", LEN + 0.02, WID + 0.02, Z_TOP - T_TOP, Z_TOP, 0.05, top_m)
    S.metric_uv(top, 0, 1, tile=0.7)
    parts.append(top)

    skirt = S.rect_skirt("skirt", LEN, WID, Z_TOP - T_TOP + 0.004, skirt_m, per_m=8, rows=6,
                         pleat_len=0.5, depth=0.02, corner_r=0.06, rnd=rnd, uv_tile=0.7, ramp=0.9)
    S.soft_cloth(skirt, strength=0.004, scale=2.5, seed=5)
    parts.append(skirt)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=60)
    return root
