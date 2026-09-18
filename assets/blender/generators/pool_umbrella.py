"""pool_umbrella (+ pool_umbrella_canopy) — the resort parasol on every deck.

Source: js/water.js, two authorings of the same object.

  makeUmbrella() (water.js:1558-1574, the clubhouse deck + the lounge pool):
    mast   CylinderGeometry(.045, .055, 2.5, 8)  at y 1.25   → z 0 … 2.50
    canopy ConeGeometry(1.55, .42, 8)            at y 2.40   → rim 2.19, apex 2.61
    rim    CylinderGeometry(r*.99, r*.99, .05, 8, open)      at y 2.20
    base   CylinderGeometry(.34, .38, .1, 12)    at y .05    → Ø .76, z 0 … .10

  buildRiverDressing() (water.js:3302-3313, the lagoon/river population):
    pole   CylinderGeometry(.05, .06, 2.5, 6)    at y 1.25
    blue   ConeGeometry(1.55, .44, 8)            at y 2.42   → rim 2.20, apex 2.64
    white  ConeGeometry(1.70, .48, 8)            at y 2.44   → rim 2.20, apex 2.68

ENVELOPE: pole Ø .10 × 2.50 on a Ø .76 base; canopy r 1.55, **rim z 2.20** —
the dominant of the three (the r 1.70 white ones are the same parasol scaled
×1.10, which is how the game should place them). Origin floor at the pole foot
for BOTH halves, as `parasol_round` does.

⚠ ONE DELIBERATE DEVIATION: the apex is 2.76, not the cone's 2.64/2.66. At the
code's .44 m rise over a 1.55 m radius the canopy read as a flat plate in the
in-engine shot — no crown at all, the "lampshade" the cone always was. .56 of
rise (19.9°, the pitch a real market parasol carries) fixes it, and it is the
ONE dimension nothing else depends on: the RIM is what a guest's head clears
and that is unchanged at 2.20.

The canopy is its own GLB (`build_canopy` → pool_umbrella_canopy) with the sole
palette key `canopy_tint` — PURE WHITE albedo — because the game multiplies its
own colour in per instance: blue 0x2b7fc4 on the lagoon, teal 0x2e9fae in the
clubhouse enclave, whiteFrame at the beach pool.

Detail from reference/photos/clubhouse-main-pool.jpg: an octagonal market
parasol with a short straight valance off the rim, a visible rib under each
panel, a ferrule and a small finial, on a plain pole and a low weighted base.
The panels dip between the ribs — a cone does not, which is why the flat
ConeGeometry reads as a lampshade at guest distance.
"""
import math, bmesh
import wv_lib as L
import _resort as R

NAME = "pool_umbrella"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

POLE_H = 2.50
POLE_R0, POLE_R1 = 0.055, 0.046     # foot, head
BASE_R0, BASE_R1, BASE_H = 0.38, 0.34, 0.10
RIBS, STEPS = 8, 6
CAN_R, CAN_Z0, CAN_Z1 = 1.55, 2.20, 2.76
VALANCE = 0.105


def build():
    parts = []
    # the real palette key, not a dielectric copy: wv_bake._mute_metallic zeroes
    # Metallic for the diffuse pass and restores it, so `steel_l` bakes correctly
    # now (the KAN-207 pass had to fake these and said so).
    alu = "steel_l"

    # the weighted base — a low chamfered disc, the photo's cast plinth
    parts.append(L.lathe("base", [
        (0.0, 0.0), (BASE_R0 - 0.016, 0.0), (BASE_R0, 0.016),
        (BASE_R0 - 0.004, BASE_H - 0.022), (BASE_R1, BASE_H),
        (0.10, BASE_H + 0.018), (0.0, BASE_H + 0.018),
    ], (0, 0, 0), "stone", n=22))

    # the pole: a tapered tube from the base to the hub, with a ferrule
    parts.append(L.cyl("pole", POLE_R0, POLE_H - BASE_H + 0.02,
                       (0, 0, BASE_H - 0.01 + (POLE_H - BASE_H + 0.02) / 2),
                       alu, n=12, r2=POLE_R1))
    parts.append(L.cyl("pole_top", 0.020, CAN_Z1 - POLE_H + 0.06,
                       (0, 0, (POLE_H - 0.06 + CAN_Z1) / 2), alu, n=8))
    parts.append(L.cyl("ferrule", POLE_R1 + 0.010, 0.055, (0, 0, POLE_H - 0.03), alu, n=12))
    parts.append(L.cyl("hub", 0.055, 0.075, (0, 0, CAN_Z1 - 0.13), alu, n=10))

    # the ribs: hub → rim, one under every panel seam
    for i in range(RIBS):
        a = 2 * math.pi * i / RIBS
        parts.append(L.strut(f"rib{i}", (0.045 * math.cos(a), 0.045 * math.sin(a), CAN_Z1 - 0.12),
                             ((CAN_R + 0.02) * math.cos(a), (CAN_R + 0.02) * math.sin(a),
                              CAN_Z0 - 0.010), 0.011, alu, n=6))
    # the finial
    parts.append(L.lathe("finial", [
        (0, 0), (0.048, 0), (0.048, 0.022), (0.024, 0.032),
        (0.032, 0.070), (0.017, 0.098), (0, 0.108),
    ], (0, 0, CAN_Z1 - 0.008), "paint_w", n=10))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=34)
    return root


def _canopy_bmesh():
    bm = bmesh.new()
    n = RIBS * STEPS
    apex = bm.verts.new((0, 0, CAN_Z1))

    def ring(frac_r, z, dip_r, dip_z):
        vs = []
        for i in range(n):
            t = (i % STEPS) / STEPS                 # 0 at a rib, .5 between ribs
            s = math.sin(math.pi * t)
            r = CAN_R * frac_r * (1 - dip_r * s)
            a = 2 * math.pi * i / n
            vs.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z - dip_z * s)))
        return vs

    mid = ring(0.52, CAN_Z0 + (CAN_Z1 - CAN_Z0) * 0.44, 0.020, 0.040)
    rim = ring(1.00, CAN_Z0, 0.034, 0.070)
    val = []
    for i in range(n):
        x, y, z = rim[i].co
        tt = (i % (STEPS // 2)) / (STEPS // 2)
        scallop = 0.030 * math.sin(math.pi * tt)
        val.append(bm.verts.new((x * 1.002, y * 1.002, z - VALANCE + scallop)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((apex, mid[i], mid[j]))
        bm.faces.new((mid[i], rim[i], rim[j], mid[j]))
        bm.faces.new((rim[i], val[i], val[j], rim[j]))
    return bm


def build_canopy():
    can = L.from_bmesh("canopy", _canopy_bmesh(), (0, 0, 0), "canopy_tint")
    L.solidify(can, 0.008, offset=-1.0)
    root = L.join([can], NAME + "_canopy", origin=None)   # keep the pole's frame
    L.shade_smooth(root, angle=30)
    return root
