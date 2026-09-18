"""dining_chair_rattan — the rooftop bar room's woven dining chair.

Source: js/campus.js:4449-4463, `diningChair(cx1, cz1, ca)` — the ONE chair the
round four-tops, the square four-tops and the four 11 m communal tables all
seat, plus the arrival breakfast room's `chair()` at campus.js:2828-2836. Every
`at(lx, lz, y, sx, sy, sz)` is (front-back, lateral, height, front-back, height,
lateral) in the chair's own frame, so:

  legs        (±.19/.20, ±.18)  .05 × .05, z 0 … .44
  seat frame  (0, 0)            .48 front-back × .46 lateral, z .44 … .49
  cushion     (0, 0)            .44 × .42, z .49 … .58
  uprights    (.20, ±.18)       .05 × .05, z .475 … 1.025
  top rail    (.20, 0)          .05 × .41 lateral, z 1.015 … 1.075
  woven panel (.21, 0)          .035 thick × .30 lateral, z .57 … .97

→ footprint .46 lateral × .48 deep, seat face .58, back .075 m proud of the
frame, overall height 1.075.

FRONT: the chair family's "+Z" (ASSET_SPEC), i.e. modelled facing Blender −Y
with the back at +Y — which is how the arrival's `chair()` authors it.
⚠ campus.js's rooftop `diningChair()` authors the BACK at its own local +X, so
a GLB drop-in there needs ry = ca − π/2. Recorded in ASSET_SPEC.

Detail from reference/photos/rooftop-bar-dusk.png (foreground): pale tapered
round legs, rear stiles running unbroken to a CURVED top rail that wraps around
the sitter, a woven natural-rattan back panel between them, and a plain white
box cushion. The rear legs and the uprights are one member here (the primitive
split them only because it is scaling unit boxes).
"""
import math
import wv_lib as L
import _resort as R

NAME = "dining_chair_rattan"
ATLAS = 512
BEVEL = 0                 # per part: only the cushion and the seat frame are bevelled
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1800
FRONT = "+Z"              # the chair family — modelled facing Blender −Y
ORIGIN = "floor"

OAK_TEX, STRAW_TEX = "oak_light.webp", "straw_weave.webp"
# same measured per-channel lift as crossback_chair/long_table: the venue's
# 2.1 sun + sky fill + ACES renders a lit timber face far above its albedo.
OAK_GAIN = (0.53, 0.45, 0.38)
RAT_GAIN = (0.60, 0.50, 0.40)

LEG_X, LEG_YF, LEG_YB = 0.18, -0.19, 0.205
SEAT_Z0, SEAT_Z1 = 0.435, 0.49
CUSH_Z1 = 0.58
RAIL_Z = 1.045
PANEL_Z0, PANEL_Z1 = 0.565, 0.965
BOW = 0.028               # how far the back curve wraps at the ends


def _back_y(x):
    """The back's curve: the rail and the panel bow backwards at the ends."""
    return LEG_YB + BOW * (abs(x) / LEG_X) ** 2


def build():
    oak = R.tex("oak_grain", OAK_TEX, roughness=0.72, fallback="oak",
                tint_to="oak", gain=OAK_GAIN)
    rattan = R.tex("rattan_weave", STRAW_TEX, roughness=0.84, fallback="straw",
                   tint_to="straw", gain=RAT_GAIN)
    linen = R.tex("chair_linen", "linen_ivory.webp", roughness=0.90,
                  fallback="ivory", tint_to="ivory")
    parts, timber = [], []

    # ---- front legs: round, tapered, splayed a hair outward at the floor
    for sx in (-1, 1):
        timber.append(L.strut(f"leg_f{sx}",
                              (sx * (LEG_X + 0.008), LEG_YF - 0.004, 0.0),
                              (sx * LEG_X, LEG_YF, SEAT_Z1), 0.024, oak, n=8))
    # ---- rear stiles: one member from the floor to the top rail
    for sx in (-1, 1):
        timber.append(L.strut(f"stile{sx}",
                              (sx * (LEG_X + 0.008), LEG_YB - 0.004, 0.0),
                              (sx * LEG_X, _back_y(sx * LEG_X), RAIL_Z), 0.026, oak, n=8))

    # ---- the seat frame, a rounded slab, and the rails under it
    frame = R.slab("seat_frame", 0.46, 0.48, SEAT_Z0, SEAT_Z1, 0.048, oak, k=4)
    L.bevel([frame], width=0.004, segments=2, angle=40, min_size=0.03)
    timber.append(frame)
    for sx in (-1, 1):      # side stretchers low down — the photo has them
        timber.append(L.box(f"stretch{sx}", (0.026, 0.30, 0.026),
                            (sx * (LEG_X - 0.004), 0.005, 0.185), oak))

    # ---- the curved top rail, swept along X with a rounded-rect section
    n_c = 9
    centres = []
    for i in range(n_c):
        x = (-1 + 2 * i / (n_c - 1)) * (LEG_X + 0.026)
        centres.append((x, _back_y(max(-LEG_X, min(LEG_X, x))), RAIL_Z))
    sec = R.rrect(0.044, 0.052, 0.015)
    timber.append(R.sweep("top_rail", centres, [sec] * n_c, oak, plane="yz"))

    # ---- the woven back panel, the same curve, inset between the stiles
    n_p = 9
    pc, psec = [], []
    for i in range(n_p):
        x = (-1 + 2 * i / (n_p - 1)) * 0.168
        pc.append((x, _back_y(x) + 0.004, (PANEL_Z0 + PANEL_Z1) / 2))
        psec.append(R.rrect(0.030, PANEL_Z1 - PANEL_Z0, 0.013))
    panel = R.sweep("weave", pc, psec, rattan, plane="yz")
    R.metric_uv(panel, 0, 2, tile=0.16)          # a tight weave, ~6 cm per repeat
    parts.append(panel)
    # three raised weave rods across it, so the panel is not a painted slab
    for k, zz in enumerate([PANEL_Z0 + 0.055 + (PANEL_Z1 - PANEL_Z0 - 0.11) * i / 4
                            for i in range(5)]):
        rc = []
        for i in range(7):
            x = (-1 + 2 * i / 6) * 0.168
            rc.append((x, _back_y(x) - 0.012, zz))
        rod = R.sweep(f"rod{k}", rc, [R.circle(0.0072, 5)] * 7, rattan, plane="yz")
        R.metric_uv(rod, 0, 2, tile=0.16)
        parts.append(rod)

    for o in timber:
        R.metric_uv(o, 0, 2, tile=0.40)
    parts += timber

    # ---- the white box cushion
    cush = R.slab("cushion", 0.42, 0.44, SEAT_Z1 - 0.004, CUSH_Z1, 0.045, linen, k=4)
    L.bevel([cush], width=0.022, segments=3, angle=40, min_size=0.03)
    L.jitter(cush, 0.0022, L.rng(NAME))
    R.metric_uv(cush, 0, 1, tile=0.55)
    parts.append(cush)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
