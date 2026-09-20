"""dining_chair_white — the suite's white high-back dining chair (eight of them).

Source: js/suite.js:978-989, `chair(parent, x, z, ry)` — "White high-back
leather dining chair on dark legs", built in its own group and then placed with
`c.position.set(mx(x), 0, z); c.rotation.y = -ry`:

  seat  MT.ivoryWhite    x +-.24, y .44 .. .50, z +-.24          (:980)
  back  MT.ivoryWhite    x +-.24, y .50 .. 1.10, z -.26 .. -.18  (:981)
  legs  MT.espressoPlain .05 sq, y 0 .. .44, at x +-.20, z +-.20 (:982-984)

  0.480 W x 0.500 D x 1.100 H
  front  **+Z — the chair-family exception** (ASSET_SPEC's one), because the
         back is at z -.26 .. -.18 and `chair(g, cx, dz - 1.05, 0)` faces the
         table at +z. Modelled facing Blender -Y. **ry = 0 is the drop-in**, and
         `chair(g, cx, dz + 1.05, Math.PI)` keeps its own pi.
  origin floor, x/z at the **SEAT CENTRE**, not the bbox centre — `join()`
         re-origins to the bounding box and the back's 20 mm of overhang would
         have pushed the origin 10 mm behind the group origin the game places.
         `origin_to()` puts it exactly where `chair()` puts (0, 0), so
         `place(parent, 'dining_chair_white', mx(x), 0, z, -ry)` is exact.

Eight of them ring `suite_dining_table` at `cx = dx - 1.12 + i * .75`,
z = dz -+ 1.05 (js/suite.js:954-958). They carry no collider of their own — the
`colRect(DINING_X +-1.5, -20.1, -18.9, r .36)` at js/suite.js:1599 is the table
only, so the chairs are walked through today and still will be.

⚠ suite.js is MIRRORED (its 1a): `chair()` reflects x through `mx()` and negates
`rotation.y` for you. The chair is symmetric about its own X centre plane, so the
reflection is a no-op on the shape, and the two yaws in use (0 and pi) are their
own negatives.

DELIBERATE DEVIATIONS, all inside the code's envelope:
 1 · **the back WRAPS.** A flat .48 x .08 slab is a plank; the back's section
     centre draws forward by 38 mm at the ends (a squared falloff), so the ends
     come round the sitter while the centre stays on the code's z -.26 .. -.18
     plane. The bbox is unchanged: the rearmost point is still the centre.
 2 · **the legs taper and splay** 12 mm outward at the floor, from .040 sq at
     the foot to .050 sq under the seat. The code's .05 sq prisms sit inside
     that at every height, and the feet stay inside the seat's own .48 footprint.
 3 · the seat is .435 .. .505 rather than .44 .. .50 — a 70 mm cushion with a
     22 mm radius instead of a 60 mm board. Same top face to within 5 mm.

FINISH. `MT.ivoryWhite` #e9e5da at roughness .58 is white LEATHER, not linen, so
this is the one sofa-adjacent asset in Group G with no cloth weave on it:
`paint_w` (family `paint` — clean, faint edge lightening) carries a leather's
satin far better than the `linen` family's woven grain, and at 0.48 m a weave is
sub-pixel anyway. Legs in the group's shared espresso.
"""
import wv_lib as L
import _interior as I

NAME = "dining_chair_white"
ATLAS = 512
BEVEL = 0                 # per part
AO_DIST = 0.30            # indoors, but the chair is open under the seat
AO_STRENGTH = 0.5
TRIS = 1600
FRONT = "+Z"              # the chair family — modelled facing Blender -Y
ORIGIN = "floor"

SEAT_W, SEAT_D = 0.48, 0.48       # suite.js:980
SEAT_Z0, SEAT_Z1 = 0.435, 0.505
BACK_W, BACK_T = 0.48, 0.08       # suite.js:981
BACK_Y = 0.22                     # game z -.22 -> Blender +y .22 (back at +Y)
BACK_Z0, BACK_Z1 = 0.490, 1.100
LEG_X, LEG_Y = 0.20, 0.20         # suite.js:982
LEG_TOP = 0.470
BOW = 0.038                       # how far the back's ends come round the sitter


def _back_y(x):
    """The wrap: the section centre draws FORWARD at the ends, so the rearmost
    point of the chair stays on the code's own plane."""
    return BACK_Y - BOW * (abs(x) / (BACK_W / 2)) ** 2


def build():
    leather = "paint_w"
    esp = I.espresso("espresso_leg", roughness=0.45)
    parts, timber = [], []

    # ---- four tapered, slightly splayed legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx, ty = sx * LEG_X, sy * LEG_Y
            centres = [(tx + sx * 0.012, ty + sy * 0.012, 0.0),
                       (tx + sx * 0.005, ty + sy * 0.005, LEG_TOP * 0.55),
                       (tx, ty, LEG_TOP)]
            secs = [I.rrect(0.040, 0.040, 0.010),
                    I.rrect(0.046, 0.046, 0.011),
                    I.rrect(0.050, 0.050, 0.012)]
            timber.append(I.sweep(f"leg{sx}{sy}", centres, secs, esp, plane="xy"))

    # ---- the seat cushion
    seat = I.pad("seat", SEAT_W, SEAT_D, 0, 0, SEAT_Z0, SEAT_Z1, 0.045, leather, k=5)
    L.bevel([seat], width=0.022, segments=3, angle=40, min_size=0.03)
    L.jitter(seat, 0.0016, L.rng(NAME))
    parts.append(seat)

    # ---- the high back, swept along X so it can wrap
    n = 11
    centres, secs = [], []
    for i in range(n):
        x = (-1 + 2 * i / (n - 1)) * (BACK_W / 2)
        centres.append((x, _back_y(x), (BACK_Z0 + BACK_Z1) / 2))
        secs.append(I.rrect(BACK_T, BACK_Z1 - BACK_Z0, 0.034))
    back = I.sweep("back", centres, secs, leather, plane="yz")
    L.bevel([back], width=0.010, segments=2, angle=40, min_size=0.03)
    parts.append(back)

    for o in timber:
        I.metric_uv(o, 0, 2, tile=0.30)
    parts += timber

    root = L.join(parts, NAME, origin=None)
    lo, _ = L.bounds(root)
    L.origin_to(root, (0.0, 0.0, lo[2]))      # seat centre, foot on the floor
    L.shade_smooth(root, angle=36)
    return root
