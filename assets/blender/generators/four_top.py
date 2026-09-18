"""four_top — the rooftop brunch four-top, BARE.

Source: js/campus.js:4215-4218 (`HOTEL_ROOF.brunchTables.forEach`), which is the
list site.js publishes and moments.js dresses. Read off those three inst() calls
(UNIT_CYL is CylinderGeometry(.5,.5,1,12), so a scale of 1.35 is a 1.35 m
DIAMETER, not a radius):

  pedestal  mat4(x, DY+.36, z, .14, .72, .14)   → Ø .14, z 0 … .72
  top       mat4(x, DY+.75, z, 1.35, .07, 1.35) → Ø 1.35, .07 thick, top face .785

⚠ NOTHING ON TOP. moments.js dresses it for the Welcome Brunch with a linen
skirt r .68→.72 hemmed at y .01 and a cloth top disc r .72 at y .755….805, i.e.
2 cm proud of the bare top — so the timber top must stay at .785 and the foot
must stay inside r .68 or the cloth clips it. In the other five moments the
table is BARE and permanently standing (roofColliders() rings it at TABLE_R .95).

Detail from reference/photos/rooftop-bar-dusk.png: warm timber tops with a
chamfered edge on a slim DARK column and a low dark disc foot. Budget 900 tris,
which is why the chamfers are lathe profile steps rather than bevels.
"""
import wv_lib as L

NAME = "four_top"
ATLAS = 256
BEVEL = 0                 # 900 tris: chamfers are in the lathe profiles instead
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 900
FRONT = "-Z"
ORIGIN = "floor"

TOP_R, TOP_T, TOP_Y = 0.675, 0.07, 0.785       # top FACE at .785
COL_R, COL_Z = 0.07, 0.72                      # Ø .14, floor → under the top
FOOT_R, FOOT_H = 0.31, 0.055                   # inside moments.js's r .68 linen hem


def build():
    parts = []

    # the disc foot — a shallow cast base, chamfered so it does not read as a coin
    parts.append(L.lathe("foot", [
        (0.0, 0.0), (FOOT_R - 0.018, 0.0), (FOOT_R, 0.016),
        (FOOT_R, FOOT_H - 0.014), (FOOT_R - 0.020, FOOT_H),
        (0.085, FOOT_H), (0.085, FOOT_H + 0.030), (0.0, FOOT_H + 0.030),
    ], (0, 0, 0), "dark", n=22))

    # the column: a slim tube with a collar under the top
    parts.append(L.lathe("column", [
        (0.0, FOOT_H), (COL_R + 0.008, FOOT_H), (COL_R, FOOT_H + 0.05),
        (COL_R, COL_Z - 0.09), (COL_R + 0.030, COL_Z - 0.045),
        (COL_R + 0.030, COL_Z), (0.0, COL_Z),
    ], (0, 0, 0), "dark", n=16))

    # the top: a chamfered timber disc, underside relieved so the edge reads
    z0 = TOP_Y - TOP_T
    parts.append(L.lathe("top", [
        (0.0, z0 + 0.012), (TOP_R - 0.030, z0 + 0.012), (TOP_R - 0.006, z0 + 0.026),
        (TOP_R, z0 + TOP_T * 0.55), (TOP_R - 0.006, TOP_Y - 0.010),
        (TOP_R - 0.028, TOP_Y), (0.0, TOP_Y),
    ], (0, 0, 0), "bar_top", n=30))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=32)
    return root
