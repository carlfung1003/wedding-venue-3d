"""round_table — the dressed 1.8 m round (decor-dinner-rounds.jpg), no chairs, no
centrepiece.

Spec row: top r .92, top surface y .81 (.06 thick); ivory linen skirt r .90
falling to the grass with soft pleats. Origin floor centre. `ivory` top, `linen`
skirt with a weave (`linen_ivory.webp`). Budget 2,500 / 512 / BEVEL 0.

The top is a lathe with a rounded cloth edge; the skirt is `_seating.skirt` — a
pleated lathe whose 16 soft folds deepen toward a slightly wavy hem that sits
on the grass. The linen picture wraps the skirt eight times (≈0.7 m tiles) and
lies flat on the top at the same scale, tinted to the palette's `ivory` /
`linen`; a missing file falls back to the flat keys (the bake's linen family).
"""
import math
import wv_lib as L
import _seating as S

NAME = "round_table"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2500
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
R_TOP, Z_TOP, T_TOP = 0.92, 0.81, 0.06
R_SKIRT = 0.90


def build():
    rnd = L.rng(NAME)
    top_m = S.tex("linen_top", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    skirt_m = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    parts = []

    # the cloth-covered top: a soft rounded edge, not a machined disc
    z0 = Z_TOP - T_TOP
    prof = [(R_SKIRT - 0.004, z0), (R_TOP - 0.006, z0 + 0.012), (R_TOP, z0 + 0.03),
            (R_TOP - 0.004, Z_TOP - 0.012), (R_TOP - 0.02, Z_TOP), (0.0, Z_TOP)]
    top = L.lathe("top", prof, (0, 0, 0), top_m, n=48)
    S.metric_uv(top, 0, 1, tile=0.7)
    parts.append(top)

    skirt = S.skirt("skirt", R_SKIRT, z0 + 0.004, skirt_m, r_hem=R_SKIRT + 0.03, n=72, rows=8,
                    pleats=16, depth=0.027, hem_wave=0.008, rnd=rnd, ramp=0.85)
    L.cylindrical_uv(skirt, repeat=8.0)
    S.soft_cloth(skirt, strength=0.004, scale=2.5, seed=3)
    parts.append(skirt)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=60)
    return root
