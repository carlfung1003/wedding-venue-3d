"""cluster_a — one of the three low blue-and-cream ground clusters (aisle lining,
under the towers, beside every extra; `decor-ceremony-main.jpg` foreground).

ASSET_SPEC Group B: *unit* footprint 1.2 W × .56 H × .96 D, the game scales it
.8–1.6 uniformly. This is the LOW AND WIDE silhouette: two shallow lobes side by
side. Blue hydrangea + cream/white roses + sage sprigs, ~42 % blue by count.
Origin base centre (bbox footprint centre on the ground). Front −Z.
Built by _florals.build_cluster() — the same head kit as the towers at ×.85.
"""
import wv_lib as L
import _florals as F

NAME = "cluster_a"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

LOBES = [((-0.18, 0.05, 0.18), (0.40, 0.36, 0.22)),
         ((0.22, -0.04, 0.19), (0.36, 0.34, 0.23))]


def build():
    return F.build_cluster(NAME, LOBES, heads=175, sprigs=8, leaves=20, spikes=4, zmax=0.58, spike_zmax=0.68)
