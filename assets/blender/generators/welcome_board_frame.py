"""welcome_board_frame — the moulded frame and plinth foot of the ceremony's
arched welcome board. KAN-208 wave 3.

The BOARD stays the game's: moments.js builds it as an ExtrudeGeometry of an
arched Shape authored in 0…1 (so ExtrudeGeometry's own UV generator lays the
canvas — welcome-board-art.webp under "Welcome / Carl & Rachel / 2027.03.20" —
straight onto the cap), scaled to SW 1.14 × SH 2.02, depth .055, translated
−SW/2 in x (js/moments.js, dressCeremonyDecor, "the welcome board"). No
modelled asset may carry lettering (ASSET_SPEC), and a baked face could not
take the async art plate anyway. So this GLB is everything AROUND the board:

  · a moulding that follows the board's own outline — the same two cubic
    Béziers and two straight sides, sampled here from the Shape's control
    points — 5 cm proud of the edge, 9.1 cm deep (the board is 5.5), so it
    stands 1.8 cm proud of both faces and the painted face reads as a panel
    set INTO a frame rather than a slab of foam board on the grass;
    The moulding is OAK (`oak`, the cross-back chairs' timber): the first
    in-engine shot in `paint_w` was white on the pale board and simply
    vanished — a frame has to be a different value from what it frames;
  · a plinth foot 1.30 × .40 × .16 the board rises out of (the frame's
    open bottom ends inside it). It hides the bottom 16 cm of the board,
    which the lettering never reaches (the date's baseline is ~.43 m up) and
    the two floral clusters at its foot already cover.

FRAME: the BOARD's own local frame, so one position + rotation.y places both:
x across (±.57), y up from the grass, z through the board (0 … .055 → the frame
is centred on z .0275). Blender y = −glTF z. Origin: the board's (0, 0, 0) —
`join(origin=None)`, NOT the bbox (the frame is wider than the board).
Front: symmetric front/back, so FRONT is moot; recorded as −Z.
"""
import math
import bmesh
import wv_lib as L

NAME = "welcome_board_frame"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.5
TRIS = 2400
FRONT = "-Z"
ORIGIN = "floor"

SW, SH, DEPTH = 1.14, 2.02, 0.055      # moments.js: SW, SH, ExtrudeGeometry depth
ZC = DEPTH / 2                         # the board's mid-plane (glTF z)


def _bez(p0, p1, p2, p3, n):
    out = []
    for k in range(1, n + 1):
        t = k / n
        u = 1 - t
        out.append(tuple(u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i]
                         for i in range(2)))
    return out


def _outline():
    """the board's Shape (moments.js) from its bottom-right corner, up, over the
    arch, down to the bottom-left — in metres, x centred."""
    pts = [(0.90, 0.0)]
    for k in range(1, 5):
        t = k / 4
        pts.append((0.90 + 0.025 * t, 0.47 * t))
    pts += _bez((0.925, 0.47), (0.955, 0.845), (0.745, 1.0), (0.49, 1.0), 14)
    pts += _bez((0.49, 1.0), (0.245, 1.0), (0.05, 0.85), (0.075, 0.47), 14)
    for k in range(1, 5):
        t = k / 4
        pts.append((0.075 + 0.025 * t, 0.47 * (1 - t)))
    return [((x - 0.5) * SW, y * SH) for (x, y) in pts]


def _moulding():
    path = _outline()
    n = len(path)
    # profile (outward offset a, half-depth d) — a flat face with a bead:
    #   inner lip overlaps the board edge 1.2 cm, outer face 5 cm out
    prof = [(-0.012, 0.030), (0.010, 0.0455), (0.038, 0.0455), (0.050, 0.030),
            (0.050, -0.030), (0.038, -0.0455), (0.010, -0.0455), (-0.012, -0.030)]
    bm = bmesh.new()
    rings = []
    for i, (x, y) in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, n - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1.0
        nx, ny = dy / ln, -dx / ln                    # outward for this traversal
        ring = []
        for (o, d) in prof:
            ring.append(bm.verts.new((x + nx * o, -(ZC + d), max(y + ny * o, 0.0))))
        rings.append(ring)
    m = len(prof)
    for i in range(n - 1):
        for k in range(m):
            k2 = (k + 1) % m
            bm.faces.new([rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]])
    for ring in (rings[0], rings[-1]):
        bm.faces.new(ring)
    o = L.from_bmesh("moulding", bm, (0, 0, 0), "oak")
    L._orient_normals(o)
    return o


def build():
    parts = [_moulding()]
    foot = L.box("foot", (1.30, 0.40, 0.16), (0, -ZC, 0.08), "paint_w")
    L.bevel([foot], width=0.018, segments=2)
    cap = L.box("foot_cap", (1.34, 0.44, 0.03), (0, -ZC, 0.175), "stone")
    L.bevel([cap], width=0.008, segments=1)
    parts += [foot, cap]
    root = L.join(parts, NAME, origin=None)
    L.shade_smooth(root, angle=40)
    return root
