"""installation_small — the second, shorter floral tower (right of the fabric
flower in `decor-ceremony-main.jpg`).

ASSET_SPEC Group B: h 2.95, width ×.82 of the hero (foot r .64), crown drifting
−X by .58, the wing toward −X; otherwise as installation_hero. Front −Z. Origin
= the tower's axis at the foot (see installation_hero's docstring).
"""
import wv_lib as L
import _florals as F

NAME = "installation_small"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 40000
FRONT = "-Z"
ORIGIN = "floor"


def build():
    return F.build_installation(NAME, h=2.95, W=0.64, lean=-0.58, side=-1, heads=1550)
