"""agave_leaf — the sea band's agave rosettes (campus.js `agaveI`), KAN-211 wave E.

A PROTOTYPE SWAP in the wave-2/4 sense. campus.js's `agave()` builds each
rosette from EIGHT instances of UNIT_CONE = THREE.ConeGeometry(.5, 1, 10) —
seven splayed round one upright — and every one of those matrices, and the
rnd() draws that make them, stay exactly as they are. Only the prototype
changes, at flush time, by key (campus.js `WAVE4_PROTO.agaveI`): this GLB lives
in the cone's exact envelope (centred, y −.5 … +.5, |x|, |z| ≤ .5), so each
instance's matrix still stands its base on the ground and tilts it out.

The cone read as a pale skirt: eight wide round-based cones overlapping at the
foot. An agave is the opposite — a few THICK, KEELED, CHANNELLED blades,
broadest a third of the way up, tapering to a hard point. So each instance now
draws a FAN of three blades from one base (the main blade on the instance's own
axis + two shorter ones swung ±32° round it and leaning a little further out),
which turns the rosette's 8 instances into 24 leaves without one extra rnd().

The blade's frame, read off campus.js mat4(…, ry, rx) (Euler 'YXZ'): rx tilts
the instance's +y toward its +z, so after the tilt the leaf's −z face looks UP
and in — that is the channelled upper face (edges curled up toward −z, the
midline sunk to z 0) and +z is the keel. The leaf plane is XY (width along x).

⚠ GEOMETRY ONLY (BAKE = False): the game keeps agaveMat (flat-shaded, no map,
no instance colour — its program is unchanged). The material is FrontSide, so
the blade is a CLOSED solid (upper face + keel face meeting at the edges).
"""
import math
import _flora as F
import wv_lib as L

NAME = "agave_leaf"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 120
FRONT = "-Z"
ORIGIN = "centre"

# ── THE FRAME PROBLEM, and why the blade is authored in METRES first ──────────
# Each instance's matrix is T(rosette centre, y = .38 h) · R(yaw, tilt θ) ·
# S(.16, h, .16) — every one of the seven is CENTRED on the rosette's axis and
# tilted about its own middle, so a blade drawn from the envelope's base
# (0, −.5, 0) would start BEHIND the centre and cross it (that crossing is the
# old cone skirt). So the blade is modelled in the instance's local PHYSICAL
# frame for the mean instance (h .77, θ .72 rad — the rndB() ranges' middles):
# its base B is the point that lands on the GROUND AT THE ROSETTE'S CENTRE,
#     B = (0, −.38 h cos θ, .38 h sin θ),
# the main blade runs along local +y (so the tilt leans it out ~41° from
# vertical), the two side blades splay ±30° round the WORLD vertical through B,
# and a narrow stub runs from B down to the envelope's floor so the upright
# (untilted) instance still meets the ground. Then every point is divided by
# the mean scale (.16, h, .16) into the unit frame. Over the whole rndB() range
# the base lands within ~3 cm of the centre, and it is sunk 3 cm.
H, TH, SXZ = 0.77, 0.72, 0.16
BX, BY, BZ = 0.0, -0.38 * H * math.cos(TH) - 0.03, 0.38 * H * math.sin(TH)
UP = (0.0, math.cos(TH), -math.sin(TH))            # world up, in the local frame

# stations along a blade (t = 0 base … 1 tip): half-width, channel curl (the
# edges rise toward the upper −z face), keel depth (+z), all in METRES
ST = [(0.00, .036, .004, .015), (0.30, .058, .012, .017), (0.64, .042, .010, .010),
      (1.00, .000, .000, .000)]


def _rot(v, axis, a):
    """Rodrigues: rotate v about unit axis by a"""
    ax, ay, az = axis
    c, s = math.cos(a), math.sin(a)
    x, y, z = v
    d = ax * x + ay * y + az * z
    cx, cy, cz = ay * z - az * y, az * x - ax * z, ax * y - ay * x
    return (x * c + cx * s + ax * d * (1 - c), y * c + cy * s + ay * d * (1 - c),
            z * c + cz * s + az * d * (1 - c))


def _unit(p):
    return (p[0] / SXZ, p[1] / H, p[2] / SXZ)


def _blade(b, length, swing=0.0, droop=0.0, wscale=1.0):
    """one closed blade from B: along local +y, swung `swing` round the world
    vertical through B, drooped `droop` outward (radians)"""
    fwd, wid, nrm = (0.0, 1.0, 0.0), (1.0, 0.0, 0.0), (0.0, 0.0, 1.0)
    if droop:
        fwd, nrm = _rot(fwd, wid, droop), _rot(nrm, wid, droop)
    if swing:
        fwd, wid, nrm = _rot(fwd, UP, swing), _rot(wid, UP, swing), _rot(nrm, UP, swing)
    rows = []
    for (t, hw, curl, keel) in ST:
        d = t * length
        bend = -0.06 * max(0.0, t - 0.5) ** 2 * length         # the tip recurves up/in
        hw *= wscale
        def at(u, v):
            return _unit(tuple(B + fwd[k] * d + wid[k] * u + nrm[k] * (v + bend)
                               for k, B in enumerate((BX, BY, BZ))))
        rows.append((b.vert(at(-hw, -curl)), b.vert(at(0.0, 0.0)),
                     b.vert(at(hw, -curl)), b.vert(at(0.0, keel))))
    uv = ((0, 0), (1, 0), (1, 1), (0, 1))
    for k in range(len(rows) - 1):
        (l0, c0, r0, k0), (l1, c1, r1, k1) = rows[k], rows[k + 1]
        if k == len(rows) - 2:                     # the tip: one shared point
            b.face((l0, c0, c1), uv[:3]); b.face((c0, r0, c1), uv[:3])
            b.face((r0, k0, c1), uv[:3]); b.face((k0, l0, c1), uv[:3])
            continue
        b.face((l0, c0, c1, l1), uv); b.face((c0, r0, r1, c1), uv)   # upper (channel)
        b.face((r0, k0, k1, r1), uv); b.face((k0, l0, l1, k1), uv)   # keel
    l0, c0, r0, k0 = rows[0]
    b.face((l0, k0, r0, c0), uv)


def _stub(b):
    """a narrow buried stem from B straight down the local −y to the envelope
    floor (y −.5): below ground for every tilted instance; for the upright one
    it is the 13 cm of stalk between the ground and its blades"""
    y1 = -0.5 * H
    ring = []
    for (u, v) in ((-.02, -.006), (.02, -.006), (0, .016)):
        ring.append((b.vert(_unit((BX + u, BY, BZ + v))), b.vert(_unit((BX + u, y1, BZ + v)))))
    uv = ((0, 0), (1, 0), (1, 1), (0, 1))
    for i in range(3):
        (a0, a1), (b0, b1) = ring[i], ring[(i + 1) % 3]
        b.face((a0, b0, b1, a1), uv)


def build():
    b = F.Buf()
    _blade(b, 0.74, 0.0, 0.0, 1.0)
    _blade(b, 0.60, math.radians(30), math.radians(9), 0.9)
    _blade(b, 0.56, math.radians(-31), math.radians(12), 0.85)
    _stub(b)
    o = b.to_object(NAME, "leaf", custom_normals=False)
    root = L.join([o], NAME, origin=None)
    _fix_winding(root)
    return root


def _fix_winding(o):
    """wind every face outward (flat-shaded, FrontSide): each blade is a closed
    component, so bmesh's consistency pass orients it outward"""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()
