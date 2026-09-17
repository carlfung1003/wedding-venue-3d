"""cluster_b — the second ground-cluster silhouette: TALLER, a mound with a
crown lobe. Same spec row as cluster_a (*unit* 1.2 W × .56 H × .96 D, the game
scales .8–1.6). Origin base centre. Front −Z.
"""
import wv_lib as L
import _florals as F

NAME = "cluster_b"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.4
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

LOBES = [((-0.12, 0.0, 0.17), (0.40, 0.36, 0.20)),
         ((0.35, 0.0, 0.15), (0.24, 0.30, 0.16)),
         ((0.08, 0.02, 0.28), (0.28, 0.26, 0.18))]


def build():
    return F.build_cluster(NAME, LOBES, heads=175, sprigs=8, leaves=20, spikes=5, zmax=0.60, spike_zmax=0.70)
