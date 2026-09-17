"""cluster_c — the third ground-cluster silhouette: LEANING, the mass rising
toward +X. Same spec row as cluster_a (*unit* 1.2 W × .56 H × .96 D, the game
scales .8–1.6). Origin base centre. Front −Z.
"""
import wv_lib as L
import _florals as F

NAME = "cluster_c"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

LOBES = [((-0.24, 0.0, 0.16), (0.34, 0.38, 0.19)),
         ((0.06, 0.02, 0.22), (0.30, 0.30, 0.20)),
         ((0.32, 0.04, 0.32), (0.26, 0.24, 0.19))]


def build():
    return F.build_cluster(NAME, LOBES, heads=175, sprigs=8, leaves=20, spikes=4, zmax=0.58, spike_zmax=0.68)
