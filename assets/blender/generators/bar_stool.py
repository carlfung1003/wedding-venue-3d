"""bar_stool — the counter stool on the rooftop bar's pool side.

Source: js/campus.js:4361-4365, one stool per counter bay at r 97.80 (UNIT_CYL is
CylinderGeometry(.5,.5,1,12), so a scale is a DIAMETER):

  foot disc  mat4(stx, DY+.025, stz, .44, .05, .44)  → Ø .44, z 0 … .05
  pedestal   mat4(stx, DY+.36,  stz, .11, .62, .11)  → Ø .11, z .05 … .67
  footrest   mat4(stx, DY+.26,  stz, .34, .045,.34)  → Ø .34 ring at z .26
  seat band  mat4(stx, DY+.70,  stz, .46, .06, .46)  → Ø .46, z .67 … .73
  cushion    mat4(stx, DY+.775, stz, .42, .09, .42)  → Ø .42, z .73 … .82

⚠ THE Ø .46 MAXIMUM IS LOAD-BEARING. roofColliders() (campus.js:4952) says the
stool line reaches r 97.59 — 97.80 − .21 — and the counter arc is authored
stricter than that. Nothing here may exceed r .23 from the axis.

⚠ Code vs photo: reference/photos/rooftop-pool-bar-daylight.webp puts
timber-framed ARMCHAIRS with white cushions at the counter, not pedestal stools.
A ~0.6 m armchair does not fit the 0.46 m envelope the collider was measured
against, so this follows the CODE for the envelope and the photo only for the
finish — pale timber seat band, white cushion, dark metal column and foot.
"""
import math
import wv_lib as L
import _resort as R

NAME = "bar_stool"
ATLAS = 256
BEVEL = 0                 # the lathes carry their own chamfers
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"

FOOT_R, FOOT_H = 0.22, 0.05
COL_R = 0.055
RAIL_R, RAIL_T, RAIL_Z = 0.17, 0.022, 0.26     # Ø .34 footrail
BAND_R, BAND_Z0, BAND_Z1 = 0.23, 0.67, 0.73
CUSH_R, CUSH_Z0, CUSH_Z1 = 0.21, 0.73, 0.82


def build():
    parts = []

    # the weighted foot — a low chamfered disc with a glide bead at the rim
    parts.append(L.lathe("foot", [
        (0.0, 0.0), (FOOT_R - 0.014, 0.0), (FOOT_R, 0.014),
        (FOOT_R, FOOT_H - 0.012), (FOOT_R - 0.030, FOOT_H),
        (0.075, FOOT_H), (0.075, FOOT_H + 0.022), (0.0, FOOT_H + 0.022),
    ], (0, 0, 0), "bronze_d", n=20))

    # the column, slightly waisted, with a collar where the seat meets it
    parts.append(L.lathe("column", [
        (0.0, FOOT_H), (COL_R + 0.008, FOOT_H), (COL_R, FOOT_H + 0.045),
        (COL_R - 0.006, 0.34), (COL_R, BAND_Z0 - 0.09),
        (COL_R + 0.022, BAND_Z0 - 0.035), (COL_R + 0.022, BAND_Z0), (0.0, BAND_Z0),
    ], (0, 0, 0), "bronze_d", n=14))

    # the footrail: a real ring on four short spokes (the ring alone floats)
    parts.append(L.torus("footrail", RAIL_R, RAIL_T, (0, 0, RAIL_Z), "oak",
                         maj=16, mnr=5))
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        parts.append(L.strut(f"spoke{i}", (0, 0, RAIL_Z),
                             (math.cos(a) * RAIL_R, math.sin(a) * RAIL_R, RAIL_Z),
                             0.011, "bronze_d", n=6))

    # the timber seat band the cushion sits in
    parts.append(L.lathe("band", [
        (0.0, BAND_Z0 + 0.012), (BAND_R - 0.022, BAND_Z0), (BAND_R - 0.002, BAND_Z0 + 0.014),
        (BAND_R, BAND_Z1 - 0.012), (BAND_R - 0.014, BAND_Z1),
        (0.0, BAND_Z1),
    ], (0, 0, 0), "oak", n=22))

    # the white cushion: a soft pad with a piped edge, crowned in the middle
    cush = L.lathe("cushion", [
        (0.0, CUSH_Z0), (CUSH_R - 0.016, CUSH_Z0), (CUSH_R, CUSH_Z0 + 0.020),
        (CUSH_R - 0.003, CUSH_Z1 - 0.026), (CUSH_R - 0.032, CUSH_Z1 - 0.004),
        (CUSH_R - 0.075, CUSH_Z1 + 0.002), (0.0, CUSH_Z1 + 0.004),
    ], (0, 0, 0), R.tex("stool_linen", "linen_ivory.webp", roughness=0.90,
                        fallback="ivory", tint_to="ivory"), n=22)
    R.metric_uv(cush, 0, 1, tile=0.42)
    parts.append(cush)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=34)
    return root
