"""roof_parasol (+ roof_parasol_canopy) — the teal market parasol on the hotel roof.

KAN-208 wave 1. Replaces the last two `UNIT_CONE` parasols on the roof, both in
js/campus.js `buildHotelRoof()`:

  the lounger row (campus.js:4219-4221, one between every other lounger pair,
  at radius R.loungeR + 1.35):
    pole   UNIT_CYL  mat4(px, DY + 1.25, pz, .11, 2.5, .11)   → Ø .11, y 0 … 2.50
    canopy UNIT_CONE mat4(px, DY + 2.72, pz, 3.5, .8, 3.5)    → r 1.75, rim y 2.32, apex 3.12

  the brunch four-tops (campus.js:4399-4401, over every other table, the pole
  through the table's centre):
    pole   UNIT_CYL  mat4(x, DY + 1.35, z, .09, 2.7, .09)     → Ø .09, y 0 … 2.70
    canopy UNIT_CONE mat4(x, DY + 2.86, z, 3.0, .7, 3.0)      → r 1.50, rim y 2.51, apex 3.21

  (⚠ UNIT_CONE / UNIT_CYL scales are DIAMETERS — ASSET_SPEC Group E preamble.)

ENVELOPE = the lounger row's, the bigger and more common one: canopy **r 1.75,
rim y 2.32, apex 3.12**, pole Ø .11 at the foot. Origin floor at the pole foot
for BOTH halves. The brunch run is this parasol scaled **(0.857, 1.082, 0.857)**
— r 1.50, rim 2.51, pole Ø .094 — which is how campus.js places it (three's
instancing normalises a non-uniform instance scale correctly). Its apex lands at
3.38 instead of the cone's 3.21: the rim, the dimension anyone's head clears, is
exact.

Why not `pool_umbrella`: its envelope is r 1.55 with a rim at 2.20 and a Ø .76
weighted base — 0.2 m smaller and 0.12 m lower than the lounger cone, and its
base would collide with the four-top's own disc foot at the brunch.

DETAIL (the photo, not the cone): reference/photos/hotel-beach-bar-dawn.webp —
the resort's own market parasols: eight ribs, a pole that runs up to a hub at the
crown, a RUNNER on the pole with a stretcher out to every rib (the thing you
see from a lounger), panels that sag between the ribs, a short straight valance
and a finial. The pole is the code's dark (`bronze_d`), not the photo's timber,
because the roof's furniture is dark metal + teak and the cone's MAT.dark said so.

THE BASE is deliberately small and flat: Ø .46 × .045. At the brunch it is
scaled to Ø .39 × .049 and hides entirely inside `four_top`'s Ø .62 × .055 disc
foot; on the teak it reads as the weighted plate a lounger parasol stands on.

The canopy is its own GLB (`build_canopy` → roof_parasol_canopy), sole key
`canopy_tint` (PURE WHITE) — campus.js multiplies MAT.umbrella's teal 0x1f8fa5
in through a cloned material that joins the night tint registry, exactly like the
cone it replaces.
"""
import math, bmesh
import wv_lib as L

NAME = "roof_parasol"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35
TRIS = 1500
FRONT = "-Z"              # radially symmetric
ORIGIN = "floor"

CAN_R, CAN_Z0, CAN_Z1 = 1.75, 2.32, 3.12       # campus.js:4221 cone
RIBS, STEPS = 8, 6
VALANCE = 0.12
POLE_R0, POLE_R1 = 0.055, 0.040                 # Ø .11 at the foot (the code's)
JOINT_Z = 1.62                                  # the push-up joint / sleeve
RUNNER_Z = 2.02                                 # stretchers meet the pole here
BASE_R, BASE_H = 0.23, 0.045


def _rib_point(i, t):
    """A point t (0 hub … 1 rim tip) along rib i, following the canopy's
    underside (the ribs sit just under the fabric)."""
    a = 2 * math.pi * i / RIBS
    r = 0.05 + (CAN_R - 0.025 - 0.05) * t
    z = (CAN_Z1 - 0.10) + ((CAN_Z0 - 0.022) - (CAN_Z1 - 0.10)) * t
    return (r * math.cos(a), r * math.sin(a), z)


def build():
    dk = "bronze_d"
    parts = []

    # the weighted base — a flat chamfered plate with a raised boss
    parts.append(L.lathe("base", [
        (0.0, 0.0), (BASE_R - 0.012, 0.0), (BASE_R, 0.012),
        (BASE_R - 0.010, BASE_H - 0.008), (BASE_R - 0.030, BASE_H),
        (0.075, BASE_H), (0.062, BASE_H + 0.035), (0.0, BASE_H + 0.035),
    ], (0, 0, 0), "dark", n=20))

    # the pole: a lower tube, a sleeve at the joint, a slimmer upper tube to the hub
    parts.append(L.cyl("pole_lo", POLE_R0, JOINT_Z, (0, 0, JOINT_Z / 2), dk, n=12,
                       r2=POLE_R0 - 0.004))
    parts.append(L.cyl("sleeve", POLE_R0 + 0.010, 0.10, (0, 0, JOINT_Z), dk, n=12))
    up = CAN_Z1 - 0.06 - JOINT_Z
    parts.append(L.cyl("pole_hi", POLE_R1, up, (0, 0, JOINT_Z + up / 2), dk, n=10))
    # the runner, the collar the stretchers pivot on
    parts.append(L.cyl("runner", POLE_R1 + 0.022, 0.12, (0, 0, RUNNER_Z), dk, n=12))
    # the hub under the crown
    parts.append(L.cyl("hub", 0.070, 0.09, (0, 0, CAN_Z1 - 0.13), dk, n=12))

    for i in range(RIBS):
        # the rib, hub → rim, just under the fabric
        parts.append(L.strut(f"rib{i}", _rib_point(i, 0.0), _rib_point(i, 1.0),
                             0.012, dk, n=6))
        # the stretcher, runner → 45 % along the rib
        a = 2 * math.pi * i / RIBS
        r0 = POLE_R1 + 0.022
        parts.append(L.strut(f"str{i}", (r0 * math.cos(a), r0 * math.sin(a), RUNNER_Z + 0.04),
                             _rib_point(i, 0.45), 0.009, dk, n=5))
        # a small tip cap at the rim end of every rib — tucked INSIDE the
        # valance: the first in-engine shot had the caps standing proud of the
        # rim like eight little posts on the canopy's edge
        tx, ty, tz = _rib_point(i, 1.0)
        parts.append(L.cyl(f"tip{i}", 0.015, 0.045, (tx, ty, tz - 0.030), dk, n=6))

    # the finial on the crown
    parts.append(L.lathe("finial", [
        (0, 0), (0.055, 0), (0.055, 0.020), (0.028, 0.034),
        (0.036, 0.075), (0.018, 0.105), (0, 0.118),
    ], (0, 0, CAN_Z1 - 0.010), dk, n=10))

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

    # the cone's own line at 20 % / 55 % of the radius, then the rim; the panels
    # sag between the ribs, more toward the rim, which is what stops a cone
    # reading as a lampshade
    k1 = ring(0.22, CAN_Z1 - (CAN_Z1 - CAN_Z0) * 0.22, 0.010, 0.012)
    k2 = ring(0.58, CAN_Z1 - (CAN_Z1 - CAN_Z0) * 0.58, 0.022, 0.045)
    rim = ring(1.00, CAN_Z0, 0.030, 0.075)
    val = []
    for i in range(n):
        x, y, z = rim[i].co
        val.append(bm.verts.new((x * 1.003, y * 1.003, z - VALANCE)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((apex, k1[i], k1[j]))
        bm.faces.new((k1[i], k2[i], k2[j], k1[j]))
        bm.faces.new((k2[i], rim[i], rim[j], k2[j]))
        bm.faces.new((rim[i], val[i], val[j], rim[j]))
    return bm


def build_canopy():
    can = L.from_bmesh("canopy", _canopy_bmesh(), (0, 0, 0), "canopy_tint")
    L.solidify(can, 0.010, offset=-1.0)
    root = L.join([can], NAME + "_canopy", origin=None)   # keep the pole's frame
    L.shade_smooth(root, angle=30)
    return root
