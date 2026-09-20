"""swim_stool — the submerged stool a swimmer sits on at the lagoon's swim-up bar.

Source: js/campus.js:5763-5771, five of them at u = (i/4 − .5) × 5.0 along the
bank and v = PL_V0 − .55 = −1.45 (in the water, in front of the counter):

    put('subWhiteCylI', UNIT_CYL, MAT.white, u, -.35, …, .5,  .09,  .5);
    put('subWhiteCylI', UNIT_CYL, MAT.white, u, (-.35 - R.DEPTH)/2 - .2, …,
        .17, R.DEPTH - .35, .17);

⚠ `UNIT_CYL` is `CylinderGeometry(.5, .5, 1, 12)`, so those scales are
DIAMETERS: a Ø 0.50 × 0.09 seat whose top sits at y −0.305, on a Ø 0.17 column.
R.DEPTH = 1.05 (js/site.js:797) and the lagoon's water is at BASIN_Y .045
(js/site.js:806), so the seat is 0.35 m under water and the basin floor is at
y −1.05. Origin floor centre; radially symmetric, so FRONT is nominal.

    the model is 0.500 × 0.500 × 0.745 and a drop-in sits at y = −R.DEPTH

── ONE THING THE CODE HAS WRONG, FIXED HERE ───────────────────────────────────
The primitive's column runs y −1.25 … −0.55 and its seat −0.395 … −0.305, so
there is a **155 mm gap of open water between the column top and the seat** —
the seat floats. It also buries 200 mm of column below the basin floor. This
model is one continuous turned pedestal from the floor to the seat: a flared
foot on the basin floor, a waisted column, a coved neck and a dished seat. The
Ø 0.50 seat, its 0.09 thickness and its −0.305 top are all unchanged, so nothing
a swimmer bumps into moves (and the stools carry no collider of their own —
water.js's basin interior fill is what holds a walker; js/campus.js:5627-5637).

Finish: `paint_w`, the plastered/tiled white the primitive's `MAT.white` reads
as under water.
"""
import wv_lib as L

NAME = "swim_stool"
ATLAS = 256
BEVEL = 0                 # a lathe's radii ARE its bevels
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 700
FRONT = "-Z"              # radially symmetric
ORIGIN = "floor"          # = THE BASIN FLOOR, y = −R.DEPTH

SEAT_R = 0.25             # scale .5 on UNIT_CYL = Ø .50    js/campus.js:5766
H = 0.745                 # basin floor (−1.05) to the seat's top (−0.305)


def build():
    # one turned pedestal, bottom to top: foot → cove → waist → flare → seat
    pedestal = L.lathe("pedestal", [
        (0.000, 0.000), (0.172, 0.000),        # the foot, flat on the basin floor
        (0.174, 0.026), (0.150, 0.058),        # its rim and the cove above it
        (0.092, 0.098),
        (0.083, 0.330), (0.086, 0.545),        # the waist
        (0.108, 0.612),                        # flaring into the seat
        (SEAT_R, 0.655), (SEAT_R, 0.702),      # the seat's underside and edge
        (0.243, 0.730), (0.206, H),            # its rounded top rim
        (0.150, H - 0.008), (0.000, H - 0.013),  # dished, 13 mm at the centre
    ], (0, 0, 0), L.M("paint_w"), n=24)
    root = L.join([pedestal], NAME, origin="floor")
    L.shade_smooth(root, angle=38)
    return root
