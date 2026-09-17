"""bead_chandelier — the five-tier crystal / pearl bead shade hung inside each
white arch frame (decor-ceremony-main.jpg; refsheets/arch_bead_chandelier.png).

Spec row: ORIGIN = HOOK (z 0), hangs down −Z. Drop rod Ø .028 × .60; canopy disc
r .25 × .035; five tiers on a cone, r .60 → .23, 12–27 beads per tier; a finial
strand of 9 beads down the axis; total drop ~1.95, max r .60. Beads `crystal` +
`pearl`; MAT_NAME = "crystal" so the loader gives the whole fixture its faint
blue glow. Budget 12,000 / 512 / bevel 0.

Layout (z below the hook):
  rod 0 → −.60 · canopy −.60 → −.635 · CROWN: 16 strands swooping out from the
  canopy rim to the top ring (r .60 at −1.035) · five rings at .17 pitch
  (−1.035 … −1.715, r .60/.50/.40/.31/.23), each fringed with 27/24/20/16/12
  hanging strands of 3 beads + a drop · finial strand −1.735 → −1.95.

Deviation (declared): the spec's tiers start ".16 below the canopy at .19 pitch";
the render and the refsheet both show the signature bell-shaped CROWN of strands
between the canopy and the widest ring (≈ .4 m tall), and the five rings below it
at a slightly tighter pitch. Envelope kept: r .60 max, drop 1.95, hook at 0.

Beads are two bmesh shells (one per palette key): pearls = hexagonal bipyramids
(12 tris), crystal drops = elongated octahedra (8 tris); the whole fixture is
smooth-shaded at 75° because faceted beads mirror the ground and read as DARK
specks in the engine (first in-engine shot) while the render's beads are
uniformly bright. Crystals are only the drops (one per fringe strand, every 4th
crown bead) for the same reason.
"""
import math, bmesh
import wv_lib as L

NAME = "bead_chandelier"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35            # a bead cloud self-shadows into grey at .5
TRIS = 12000
FRONT = "-Z"
ORIGIN = "hook"
MAT_NAME = "crystal"

ROD_R, ROD_L = 0.014, 0.60
CAN_R, CAN_T = 0.25, 0.035
CAN_Z = -ROD_L - CAN_T / 2
CAN_BOT = -ROD_L - CAN_T
CROWN_N, CROWN_DROP = 24, 0.40
TIER_R = [0.60, 0.50, 0.40, 0.31, 0.23]
TIER_N = [32, 28, 24, 20, 16]
TIER_PITCH = 0.17
TIER_Z = [CAN_BOT - CROWN_DROP - i * TIER_PITCH for i in range(5)]     # −1.035 … −1.715
RING_R = 0.007
PITCH = 0.040                 # bead pitch along a strand
PEARL_R, CRYS_R = 0.018, 0.014
FINIAL_N, FINIAL_END = 9, -1.95


def _bipyramid(bm, pos, n, r, rz):
    """n-gon bipyramid (2n tris): n=6 r≈rz is a pearl, n=4 rz>r a crystal drop."""
    x, y, z = pos
    v = [bm.verts.new((x + r * math.cos(2 * math.pi * i / n), y + r * math.sin(2 * math.pi * i / n), z))
         for i in range(n)]
    top, bot = bm.verts.new((x, y, z + rz)), bm.verts.new((x, y, z - rz))
    for i in range(n):
        a, b = v[i], v[(i + 1) % n]
        bm.faces.new((a, b, top))
        bm.faces.new((b, a, bot))


class _Beads:
    """Two shells, keyed by palette."""
    def __init__(self, rnd):
        self.pearl, self.crys, self.rnd = bmesh.new(), bmesh.new(), rnd
        self.n = 0

    def bead(self, pos, kind, scale=1.0):
        self.n += 1
        j = 1.0 + self.rnd.uniform(-0.08, 0.08)
        if kind == "pearl":
            r = PEARL_R * scale * j
            _bipyramid(self.pearl, pos, 6, r, r * 1.05)
        else:
            r = CRYS_R * scale * j
            _bipyramid(self.crys, pos, 4, r, r * 1.7)


def _crown_curve(a, t):
    """Bell-shaped swoop from the canopy rim to the top ring: steep off the canopy,
    flaring out to the ring."""
    r = CAN_R - 0.005 + (TIER_R[0] - CAN_R + 0.005) * t ** 1.8
    z = CAN_BOT - CROWN_DROP * t
    return (r * math.cos(a), r * math.sin(a), z)


def _sample(fn, n=60):
    """Points along fn(t) at PITCH spacing (arc-length resampled)."""
    pts = [fn(i / n) for i in range(n + 1)]
    out, acc, last = [pts[0]], 0.0, pts[0]
    for p in pts[1:]:
        d = math.dist(p, last)
        acc += d
        if acc >= PITCH:
            out.append(p)
            acc = 0.0
        last = p
    return out


def build():
    rnd = L.rng(NAME)
    parts = []
    parts.append(L.cyl("rod", ROD_R, ROD_L, (0, 0, -ROD_L / 2), "pearl", n=12))
    parts.append(L.cyl("canopy", CAN_R, CAN_T, (0, 0, CAN_Z), "pearl", n=32))
    for i, (r, z) in enumerate(zip(TIER_R, TIER_Z)):
        parts.append(L.torus(f"ring{i}", r, RING_R, (0, 0, z), "pearl", maj=32 - 4 * i, mnr=4))

    beads = _Beads(rnd)
    # the crown: pearls, with a crystal every 4th bead
    for i in range(CROWN_N):
        a = 2 * math.pi * i / CROWN_N
        pts = _sample(lambda t, a=a: _crown_curve(a, t))
        for b, p in enumerate(pts[1:-1]):             # ends sit inside the canopy / ring
            beads.bead(p, "crystal" if (b + i) % 4 == 3 else "pearl")
    # the tier fringes: 3 pearls + a crystal drop under every ring
    for i, (r, z, n) in enumerate(zip(TIER_R, TIER_Z, TIER_N)):
        for k in range(n):
            a = 2 * math.pi * k / n + i * 0.21
            x, y = (r - 0.004) * math.cos(a), (r - 0.004) * math.sin(a)
            for b in range(3):
                beads.bead((x, y, z - RING_R - PEARL_R - b * PITCH), "pearl")
            beads.bead((x, y, z - RING_R - PEARL_R - 3 * PITCH - 0.006), "crystal", 1.35)
    # the finial strand down the axis, growing to a drop
    z0 = TIER_Z[-1] - 0.02
    for b in range(FINIAL_N):
        t = b / (FINIAL_N - 1)
        z = z0 + (FINIAL_END + 0.03 - z0) * t
        beads.bead((0, 0, z), "pearl" if b < FINIAL_N - 1 else "crystal", 0.8 + 0.7 * t)

    parts.append(L.from_bmesh("pearls", beads.pearl, (0, 0, 0), "pearl"))
    parts.append(L.from_bmesh("crystals", beads.crys, (0, 0, 0), "crystal"))
    print(f"bead_chandelier: {beads.n} beads")
    root = L.join(parts, NAME, origin=None)          # authored on the hook: z 0 = the rod's top
    L.shade_smooth(root, angle=75)                   # beads round; canopy caps + ring corners stay sharp
    return root
