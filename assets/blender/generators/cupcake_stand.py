"""cupcake_stand — the white two-tier cupcake stand on the dessert counter
(decor-dessert-bar.jpg, the small tiered stands beside the dispensers).

Spec row: r .26, h .22, two tiers, 5 cupcakes (ivory / cream frosting, blue
sprinkles). Origin base centre (sits on the counter top). `paint_w`, `cream`.
Budget 2,000 / 256 / bevel 0.

A turned foot, a 26 cm lower plate and a 16 cm upper plate on a slim column with
a knob finial (top at .22); the plate rims are bevelled by hand (module BEVEL is
0 so the cupcakes stay cheap). Cupcakes: a white fluted paper case (truncated
cone), a squashed cream frosting swirl and one powder-blue hydrangea floret on
top — three on the lower plate, two on the upper.
"""
import math
import wv_lib as L

NAME = "cupcake_stand"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2000
FRONT = "-Z"
ORIGIN = "floor"

R1, R2, H = 0.26, 0.16, 0.22
PLATE_T = 0.012
Z1, Z2 = 0.045, 0.145           # plate undersides


def _cupcake(parts, i, x, y, z, rnd):
    parts.append(L.cyl(f"case{i}", 0.024, 0.038, (x, y, z + 0.019), "paint_w", n=14, r2=0.031))
    swirl = L.sphere(f"frost{i}", 0.031, (x, y, z + 0.052), "cream", sub=2)
    swirl.scale = (1.0, 1.0, 0.72)
    L.jitter(swirl, 0.002, rnd)
    parts.append(swirl)
    parts.append(L.sphere(f"floret{i}", 0.011, (x + 0.006, y - 0.004, z + 0.075), "hydrangea", sub=1))


def build():
    rnd = L.rng(NAME)
    parts = []
    parts.append(L.lathe("foot", [(0.0, 0), (0.09, 0), (0.09, 0.008), (0.06, 0.018), (0.028, 0.03), (0.02, 0.045)],
                         (0, 0, 0), "paint_w", n=20))
    for tag, r, z in (("lo", R1, Z1), ("hi", R2, Z2)):
        plate = L.cyl(f"plate_{tag}", r, PLATE_T, (0, 0, z + PLATE_T / 2), "paint_w", n=32)   # 36 blew the budget by 34 tris
        L.bevel([plate], width=0.004, segments=2, angle=40, min_size=0.01)
        parts.append(plate)
    parts.append(L.cyl("column", 0.012, Z2 - Z1, (0, 0, (Z1 + Z2) / 2 + PLATE_T), "paint_w", n=12))
    parts.append(L.cyl("column2", 0.012, 0.03, (0, 0, Z2 + PLATE_T + 0.015), "paint_w", n=12))
    parts.append(L.lathe("finial", [(0.0, 0), (0.016, 0), (0.02, 0.012), (0.012, 0.026), (0.0, 0.03)],
                         (0, 0, H - 0.03), "paint_w", n=12))
    # three cupcakes round the lower plate, two on the upper
    for i in range(3):
        a = math.radians(-90 + i * 120)
        _cupcake(parts, i, 0.165 * math.cos(a), 0.165 * math.sin(a), Z1 + PLATE_T, rnd)
    for i in range(2):
        a = math.radians(-30 + i * 180)
        _cupcake(parts, 3 + i, 0.085 * math.cos(a), 0.085 * math.sin(a), Z2 + PLATE_T, rnd)
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
