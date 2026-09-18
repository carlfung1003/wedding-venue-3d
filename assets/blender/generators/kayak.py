"""kayak — the sit-on-top kayak in the lagoon's west reach.

Source: js/water.js:3080-3130 (`buildKayak`) + js/site.js:1138
`KAYAK: { which:'spine', t:.365, len: 3.0, beam: .78 }`:

  hull      SphereGeometry scaled (beam/2 .39, .30, len/2 1.50), y +.06
            → keel .24 BELOW the water line, deck crown .36 above it
  deck      a blue top cap scaled (.363, .16, 1.425) at y .16
  cockpit   CylinderGeometry scaled (beam*.34 = .265, 1, len*.17 = .51),
            a dark well at y .21, len*.06 = .18 AFT of centre
  paddle    BoxGeometry(2.05, .045, .045) at y .42, rotation.y .22, blades
            .17 × .035 × .46 outboard at ±.92

ENVELOPE: 3.00 long × 0.78 beam; **origin "floor" = the KEEL**, so the deck
crown is .52 above it and the water line is **0.24 above the origin** — the
game places the hull at WATER_Y and sinks it to its own waterline, so a GLB
drop-in sits at `WATER_Y − 0.24`. (Floor origin rather than a waterline origin
because `preview_all.py` and `tools/viewer.html` stand a model on the ground
disc; a mesh hanging below its origin previews half-buried.) The kayak carries
no collider, so the paddle's 2.05 m span costs nothing.

FRONT "+Z": `buildKayak` yaws the hull so its local +Z runs down the channel,
i.e. the BOW is at +Z — modelled at Blender −Y.

Detail from reference/photos/resort-kayak-channel.webp, which is shot straight
down, so THE PLAN SILHOUETTE IS THE WHOLE READ: a white hull with a fine bow
and a fuller stern, a bright blue moulded deck inset inside a white gunwale
rim, a dark seat well and a small forward hatch, and the paddle lying across
the deck with its blades outboard. The paddler stays a game object.
"""
import math
import wv_lib as L
import _resort as R

NAME = "kayak"
ATLAS = 256
BEVEL = 0                 # a hull has no hard edges to catch
AO_DIST = 0.5
AO_STRENGTH = 0.4
TRIS = 2000
FRONT = "+Z"              # the bow is at +Z — modelled at Blender −Y
ORIGIN = "floor"          # z 0 = the KEEL; the water line is z .24

B = 0.39                  # half-beam
#    y      beam×   keel z  deck z
STATIONS = [
    (-1.500, 0.030, 0.300, 0.500),   # a raked stem, not a flat wall — the first
    (-1.445, 0.115, 0.196, 0.512),   # build's tall square bow read as a plank
    (-1.360, 0.210, 0.108, 0.518),
    (-1.200, 0.380, 0.078, 0.514),
    (-1.000, 0.580, 0.048, 0.509),
    (-0.750, 0.790, 0.022, 0.504),
    (-0.450, 0.930, 0.007, 0.500),
    (-0.150, 0.995, 0.001, 0.498),
    ( 0.150, 1.000, 0.000, 0.498),
    ( 0.450, 0.970, 0.003, 0.500),
    ( 0.750, 0.890, 0.012, 0.503),
    ( 1.000, 0.780, 0.028, 0.508),
    ( 1.180, 0.650, 0.048, 0.513),
    ( 1.320, 0.480, 0.078, 0.518),
    ( 1.430, 0.310, 0.112, 0.523),
    ( 1.485, 0.235, 0.190, 0.524),
    ( 1.500, 0.190, 0.250, 0.524),   # a small transom, as the reference kayak has
]
# (fraction of half-beam, fraction of the station's depth) around ONE section:
# keel → chine → max beam at the water line → tumblehome → gunwale → deck crown
HALF = [(0.00, 0.000), (0.42, 0.045), (0.80, 0.175), (1.00, 0.420),
        (0.98, 0.680), (0.88, 0.895), (0.58, 0.990)]
WELL_Y = 0.18             # the well sits .18 aft of midships (water.js's len*.06)


def _section(bm_x, z0, z1):
    """One closed hull section in XZ at a station, as (x, z) pairs, running
    keel → +x gunwale → deck crown → −x gunwale → back to the keel."""
    d = z1 - z0
    pts = [(u * bm_x, z0 + v * d) for (u, v) in HALF]
    crown = [(0.0, z1 + 0.012)]
    return pts + crown + [(-x, z) for (x, z) in reversed(pts[1:])]


def build():
    parts = []

    # ---- the hull, lofted through the stations
    secs = []
    for (y, bm, z0, z1) in STATIONS:
        secs.append([(x, y, z) for (x, z) in _section(bm * B, z0, z1)])
    hull = R.loft("hull", secs, "paint_w")
    parts.append(hull)

    # ---- the blue moulded deck, inset inside a white gunwale rim
    dsec = []
    for (y, bm, z0, z1) in STATIONS[1:-1]:
        hw = max(bm * B * 0.82 - 0.014, 0.006)
        top = z1 + 0.018
        dsec.append([
            (hw, y, top - 0.026), (hw * 0.93, y, top), (0.0, y, top + 0.006),
            (-hw * 0.93, y, top), (-hw, y, top - 0.026), (0.0, y, top - 0.034),
        ])
    deck = R.loft("deck", dsec, "bottle_blue")
    parts.append(deck)

    # ---- the seat well: a dished dark recess, and a small forward hatch
    #      ⚠ the coaming must stand PROUD of the blue deck — sunk to the hull's
    #      own deck line the first build buried the whole well and the kayak
    #      read as a surfboard in the in-engine shot.
    cmb, rim, mid, flr = [], [], [], []
    n = 16
    for i in range(n):
        a = 2 * math.pi * i / n
        cx, cy = math.cos(a), math.sin(a)
        cmb.append((cx * 0.300, WELL_Y + cy * 0.570, 0.520))
        rim.append((cx * 0.272, WELL_Y + cy * 0.532, 0.556))
        mid.append((cx * 0.232, WELL_Y + cy * 0.455, 0.478))
        flr.append((cx * 0.196, WELL_Y + cy * 0.400, 0.458))
    parts.append(R.loft("well", [cmb, rim, mid, flr], "bronze_d",
                        close_start=False, close_end=True))
    parts.append(L.lathe("hatch", [
        (0.0, 0.520), (0.118, 0.520), (0.130, 0.536), (0.122, 0.552), (0.0, 0.556),
    ], (0, -0.86, 0), "bronze_d", n=14))
    # carry toggles at the tips
    for y in (-1.36, 1.34):
        parts.append(L.box("toggle", (0.085, 0.036, 0.024), (0, y, 0.540), "bronze_d"))

    # ---- the paddle, lying across the deck, blades outboard (water.js's 2.05 m)
    yaw = 0.22
    hx, hy = math.cos(yaw) * 1.025, math.sin(yaw) * 1.025
    parts.append(L.strut("shaft", (-hx, -hy + 0.02, 0.612), (hx, hy + 0.02, 0.612),
                         0.021, "bronze_d", n=8))
    for s in (-1, 1):
        bx, by = s * math.cos(yaw) * 0.86, s * math.sin(yaw) * 0.86
        parts.append(L.box("blade", (0.46, 0.165, 0.016), (bx, by + 0.02, 0.592),
                           "bottle_blue", rot=(0, 0, math.degrees(yaw))))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=44)
    return root
