"""shrub_fringe_b — shrub_fringe's second card layout (same lobes, own draw), so
two neighbouring shrubs never wear the same silhouette. KAN-208 wave 4.
GEOMETRY ONLY (BAKE = False) — see shrub_fringe."""
import _flora as F

NAME = "shrub_fringe_b"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 32
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "fringe", "shrub", cards=16, variant=1)
