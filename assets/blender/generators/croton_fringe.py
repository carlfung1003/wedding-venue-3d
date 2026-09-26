"""croton_fringe — the sea band croton's leaf-card fringe (campus.js `crotonI`,
KAN-211 wave E). The croton's matrix is a TALL squashed blob (w 1.1–1.7 ×
hh·1.4 up to 1.4 m, centred at hh·.55 — its lower third stands clear of the
ground), so shrub_fringe's upper-cap cards (ymin −.25) left the whole lower
flank showing the flat-shaded core. Same lobe layout as shrub_core (seed
"shrub", so the cards sit on the bush they belong to), 40 cards reaching down
to y −.8, a little larger. On leafMat('croton') (croton_leaf.webp).
GEOMETRY ONLY (BAKE = False) — see shrub_fringe."""
import _flora as F

NAME = "croton_fringe"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 80
FRONT = "-Z"
ORIGIN = "centre"


def build():
    return F.shrub_part(NAME, "fringe", "shrub", cards=40, variant=7, ymin=-0.8, tilt=(0.10, 0.70),
                        size=(0.70, 1.00), out=(0.70, 1.00))
