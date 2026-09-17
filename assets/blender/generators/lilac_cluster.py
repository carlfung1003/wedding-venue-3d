"""lilac_cluster — the round bar's lavender/lilac + white base cluster
(`decor-cocktail-bar.jpg`, at the menu easel's foot).

ASSET_SPEC Group B: ~1.5 W × .60 H × 1.10 D with six white stock spikes to
y ~1.0. `lilac_1..3`, `white`, `cream`, `leaf`. Origin base centre. Front −Z.
The lilac roses are the rose photograph hue-shifted (three depths) plus a lilac
hydrangea; the stock spikes are stems of white florets; three lilac spikes too.
"""
import wv_lib as L
import _florals as F

NAME = "lilac_cluster"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

LOBES = [((-0.40, 0.0, 0.22), (0.34, 0.34, 0.26)),
         ((0.28, 0.04, 0.20), (0.40, 0.36, 0.24)),
         ((-0.05, -0.06, 0.32), (0.28, 0.26, 0.22))]


def build():
    return F.build_cluster(NAME, LOBES, heads=175, sprigs=6, spikes=9, mix=F.MIX_LILAC, scale=0.85,
                           zmax=0.60, spike_zmax=1.0, leaves=16, spike_keys=("white", "white", "lilac_2"),
                           spike_len=(0.42, 0.62))
