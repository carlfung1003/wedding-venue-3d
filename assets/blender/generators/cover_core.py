"""cover_core — the ground-cover bed's core: nature.js's `blobGeo(…, 0, .55)`
(20 tris, radius 1) that every cover instance squashes to .22–.38 tall. Same
20-tri budget, pushed onto the shrub lobes so a bed has clefts. KAN-208 wave 4.
GEOMETRY ONLY (BAKE = False) — MAT.cover and its per-instance colours stay."""
import _flora as F

NAME = "cover_core"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 20
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "core", "cover", detail=0)
