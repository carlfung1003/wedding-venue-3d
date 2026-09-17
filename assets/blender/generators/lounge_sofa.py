"""lounge_sofa — the outdoor lounge sofa on the after-party turf.

Spec row: 2.2 W × .9 D; seat top y .45; back to y .80; low timber base. Origin
floor centre; front −Z (→ modelled facing Blender +Y). `ivory` cushions with a
linen weave, `oak_d` base. Budget 2,500 / 512 / .004.

From the sheet (refsheets/lounge_sofa.png, read for proportion only — its
measure.json says DO NOT MEASURE): a low timber platform on short legs, a
slatted back and open arms all to one rail height (~.60), two deep seat
cushions, two back cushions leaning to .80 and two throw pillows. Cushions get
a wide 3-segment bevel (soft radii); the frame's rails a 4 mm one; legs, base
rails and slats stay plain (they are inside the shadow of the seat).
"""
import wv_lib as L
import _seating as S

NAME = "lounge_sofa"
ATLAS = 512
BEVEL = 0                 # per part below
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2500
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
W, D = 2.2, 0.9
SEAT_TOP, CUSH_T = 0.45, 0.16
ARM_Z = 0.60
BACK_TOP = 0.80
POST = 0.05


def build():
    rnd = L.rng(NAME)
    linen = S.tex("linen_cushion", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    oak = "oak_d"
    parts = []
    hw, hd = W / 2, D / 2
    deck_z = SEAT_TOP - CUSH_T            # 0.29: the slatted deck's top

    # ---- frame
    for sx in (-1, 1):
        for sy in (-1, 1):
            # corner posts: floor to the arm/back rail
            p = L.box("post", (POST, POST, ARM_Z), (sx * (hw - POST / 2), sy * (hd - POST / 2), ARM_Z / 2), oak)
            L.bevel([p], width=0.004, segments=2, angle=40, min_size=0.02)
            parts.append(p)
    # base rails (a plinth band) + the seat frame band
    for z, h in ((0.10, 0.05), (deck_z - 0.03, 0.06)):
        parts.append(L.box("rail_f", (W - POST, 0.04, h), (0, hd - 0.02, z), oak))
        parts.append(L.box("rail_b", (W - POST, 0.04, h), (0, -hd + 0.02, z), oak))
        for sx in (-1, 1):
            parts.append(L.box("rail_s", (0.04, D - POST, h), (sx * (hw - 0.02), 0, z), oak))
    # the slatted deck under the cushions
    n_deck = 7
    for i in range(n_deck):
        y = -hd + 0.06 + (D - 0.12) * i / (n_deck - 1)
        parts.append(L.box("deck", (W - 0.10, 0.06, 0.02), (0, y, deck_z - 0.01), oak))
    # arm rails + the back rail at ARM_Z
    for sx in (-1, 1):
        ar = L.box("arm", (0.06, D, 0.04), (sx * (hw - 0.03), 0, ARM_Z - 0.02), oak)
        L.bevel([ar], width=0.004, segments=2, angle=40, min_size=0.02); parts.append(ar)
    br = L.box("back_rail", (W, 0.05, 0.04), (0, -hd + 0.025, ARM_Z - 0.02), oak)
    L.bevel([br], width=0.004, segments=2, angle=40, min_size=0.02); parts.append(br)
    # back slats between the seat frame and the back rail, arm slats at the sides
    n_slat = 13
    for i in range(n_slat):
        x = -hw + 0.12 + (W - 0.24) * i / (n_slat - 1)
        parts.append(L.box("slat", (0.032, 0.02, ARM_Z - 0.04 - deck_z), (x, -hd + 0.03, (ARM_Z - 0.04 + deck_z) / 2), oak))
    for sx in (-1, 1):
        for i in range(4):
            y = -hd + 0.15 + (D - 0.30) * i / 3
            parts.append(L.box("arm_slat", (0.02, 0.032, ARM_Z - 0.04 - deck_z), (sx * (hw - 0.03), y, (ARM_Z - 0.04 + deck_z) / 2), oak))
    for o in parts:
        S.metric_uv(o, 0, 2, tile=0.6)

    # ---- cushions (ivory linen)
    cw = (W - 0.10) / 2
    for sx in (-1, 1):
        c = L.box("seat_cushion", (cw - 0.01, D - 0.12, CUSH_T), (sx * cw / 2, 0.01, deck_z + CUSH_T / 2), linen)
        L.bevel([c], width=0.04, segments=3, angle=40, min_size=0.02)
        L.jitter(c, 0.003, rnd)
        S.metric_uv(c, 0, 1, tile=0.7); parts.append(c)
        # back cushion leaning on the rail, rising to BACK_TOP
        bh = BACK_TOP - SEAT_TOP + 0.02
        b = L.box("back_cushion", (cw - 0.06, 0.15, bh), (sx * cw / 2, -hd + 0.13, SEAT_TOP + bh / 2 - 0.02), linen, rot=(-9, 0, 0))
        L.bevel([b], width=0.035, segments=3, angle=40, min_size=0.02)
        L.jitter(b, 0.003, rnd)
        S.metric_uv(b, 0, 2, tile=0.7); parts.append(b)
        # a throw pillow in front of it
        p = L.box("pillow", (0.40, 0.12, 0.38), (sx * (cw / 2 + 0.12 * sx), -hd + 0.27, SEAT_TOP + 0.155), linen, rot=(-12, 0, sx * 6))
        L.bevel([p], width=0.03, segments=3, angle=40, min_size=0.02)
        L.jitter(p, 0.003, rnd)
        S.metric_uv(p, 0, 2, tile=0.7); parts.append(p)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
