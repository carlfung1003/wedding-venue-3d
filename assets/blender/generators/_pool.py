"""_pool — helpers shared by Group F (the pool wave: lanterns, the swim-up bar,
the cabana daybed, the island bar, the underwater light fitting).

Files starting with `_` are skipped by make_masters.py. Nothing in wv_lib is
patched; `tex` / `metric_uv` / `slab` / `sweep` / `circle` / `rrect` /
`pleat_sheet` / `gathered` / `slats` are re-exported from _resort so Group F
tints generated textures exactly the way Groups A and E do.

  ribbed_shell(...)  the paper-lantern globe: an ellipsoid whose radius is pinched
                     on each rib meridian and bulges between them, open at both
                     poles so a collar and a hoop can cap it. The one shape the
                     GEOMETRY-ONLY rule exists for.
  petal(...)         a lofted lotus petal — a keeled, cupped blade that sweeps up
                     and outward from a base point to a tip.
  ring_of(...)       evenly spaced bearings, with an optional phase.
  thatch(...)        a conical thatched roof: a many-sided cone whose radius steps
                     in courses, so the silhouette reads as laid bundles.
"""
import math
import bmesh
import wv_lib as L
from _resort import (tex, metric_uv, slab, sweep, circle, rrect, dielectric,  # noqa: F401
                     soft_cloth, loft, pleat_sheet, gathered, slats)


def ring_of(n, phase=0.0):
    """n bearings round a circle, starting at `phase` radians."""
    return [phase + 2 * math.pi * i / n for i in range(n)]


def ribbed_shell(name, rx, rz, mat, ribs=12, theta_top=0.42, theta_bot=0.38,
                 rings=10, pinch=0.075, ridge=0.050, sigma=0.05, delta=0.055,
                 cap_bottom=True, cap_top=False):
    """The paper globe.

    An ellipsoid of horizontal radius `rx` and vertical half-extent `rz`, cut
    open at both poles (`theta_top` / `theta_bot` radians in from each pole) so a
    collar can sit on the top hole and a hoop under the bottom one.

    The azimuthal radius factor is the whole point — the paper is PULLED IN along
    each rib meridian and BULGES between them, with a narrow proud spine on the
    rib line itself:

        f(s) = 1 − pinch·cos⁴(πs) + ridge·exp(−(dist/sigma)²)      (s = the
        fraction through one rib period, dist = min(s, 1−s))

    normalised so the widest point of the bulge is exactly `rx`. Samples are laid
    where the shape needs them — on the rib, on both of its flanks (±`delta` of a
    period), and two in the bulge — so five per rib buy a crease sharp enough for
    shade_smooth to keep, at a fifth of the triangles a uniform sweep would cost.
    """
    S = [0.0, delta, 0.32, 0.68, 1.0 - delta]

    def f(s):
        c = math.cos(math.pi * s)
        d = min(s, 1.0 - s)
        return 1.0 - pinch * (c ** 4) + ridge * math.exp(-(d / sigma) ** 2)

    # normalised on the SAMPLED set, and phased so the widest sample lands on the
    # +X axis — otherwise the axis-aligned bbox reports a shell 2 % narrower than
    # R and the envelope check in ASSET_SPEC.md reads as a miss.
    peak = max(f(s) for s in S)
    wide = max(S, key=f)
    phase = -2 * math.pi * wide / ribs
    angles = []                       # (azimuth, radius factor)
    for i in range(ribs):
        for s in S:
            angles.append((phase + 2 * math.pi * (i + s) / ribs, f(s) / peak))

    # latitudes, with a ring forced onto the equator (the widest section) so the
    # model's horizontal extent is exactly rx
    half = max(1, rings // 2)
    ths = [theta_top + (math.pi / 2 - theta_top) * j / half for j in range(half)]
    ths += [math.pi / 2 + (math.pi / 2 - theta_bot) * j / (rings - half)
            for j in range(rings - half + 1)]

    bm = bmesh.new()
    lat = []
    for th in ths:
        z = rz * math.cos(th)
        rr = rx * math.sin(th)
        lat.append([bm.verts.new((math.cos(a) * rr * k, math.sin(a) * rr * k, z))
                    for (a, k) in angles])
    n = len(angles)
    for j in range(len(lat) - 1):
        A, B = lat[j], lat[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            bm.faces.new([A[i], A[i2], B[i2], B[i]])
    if cap_top:
        bm.faces.new(lat[0][::-1])
    if cap_bottom:
        bm.faces.new(lat[-1])
    o = L.from_bmesh(name, bm, (0, 0, 0), mat)
    return o


def petal(name, mat, base, tip, half_w, thick, keel=0.35, stations=5, cup=0.10,
          twist=0.0):
    """One lotus petal: a closed blade lofted along a quadratic arc from `base`
    to `tip`, widest at ~45 % of its length, with a diamond section so it carries
    a central keel (which is what a real lotus petal has) and a slight cup
    (`cup` = how far the edges curl toward the flower's axis).

    `base` / `tip` are (x, y, z); `half_w` and `thick` are the maxima.
    """
    bx, by, bz = base
    tx, ty, tz = tip
    # a control point pushed up and inward gives the petal its outward sweep
    cx = (bx + tx) * 0.5 * 0.55
    cy = (by + ty) * 0.5 * 0.55
    cz = (bz + tz) * 0.5 + (tz - bz) * 0.30

    def at(t):
        u = 1 - t
        return (u * u * bx + 2 * u * t * cx + t * t * tx,
                u * u * by + 2 * u * t * cy + t * t * ty,
                u * u * bz + 2 * u * t * cz + t * t * tz)

    # the blade's own frame: `along` down the arc, `side` horizontal across it
    sections = []
    for j in range(stations):
        t = j / (stations - 1)
        p = at(t)
        p1 = at(min(1.0, t + 0.02))
        p0 = at(max(0.0, t - 0.02))
        ax, ay, az = (p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
        sx, sy = -ay, ax
        sl = math.hypot(sx, sy) or 1e-6
        sx, sy = sx / sl, sy / sl
        # normal = along × side, so the keel stands off the blade's face
        nx = ay * 0.0 - az * sy
        ny = az * sx - ax * 0.0
        nz = ax * sy - ay * sx
        nl = math.sqrt(nx * nx + ny * ny + nz * nz) or 1e-6
        nx, ny, nz = nx / nl, ny / nl, nz / nl
        # An OGIVE, not a lens: broad from a tenth of the way out to two thirds,
        # then drawn to the tip. A lens profile (sin^0.85) made the whorls read as
        # an agave rosette in the first turntable — spikes, not petals.
        # ⚠ clamped away from 0: a section that collapses to a point makes four
        #   coincident verts, and remove_doubles then leaves degenerate faces.
        w = half_w * max(0.10, math.sin(math.pi * (t ** 0.62)) ** 0.55)
        th = thick * max(0.12, math.sin(math.pi * (t ** 0.62)) ** 0.6)
        k = th * keel
        ph = twist * t
        sec = []
        for (a, b) in ((0.0, th), (w, k * 0.2 - cup * w), (0.0, -th * 0.55),
                       (-w, k * 0.2 - cup * w)):
            sec.append((p[0] + sx * a + nx * (b + ph),
                        p[1] + sy * a + ny * (b + ph),
                        p[2] + nz * (b + ph)))
        sections.append(sec)
    return loft(name, sections, mat)


def thatch(name, r, h, z0, mat, n=16, courses=4, step=0.055, eaves_inner=None):
    """A conical thatched roof: `courses` stacked frusta whose lower edge flares
    `step` proud of the cone, so the silhouette reads as laid bundles rather than
    as a smooth party hat. z0 = the eaves height, h = the rise to the apex."""
    bm = bmesh.new()
    rings = []
    for c in range(courses + 1):
        t = c / courses
        # ⚠ clamped: a final ring of radius 0 makes n coincident verts, and the
        #   fan to the apex then collapses — which showed up in-engine as a black
        #   hole at the top of the island bar's thatch.
        rr = max(r * 0.045, r * (1 - t))
        zz = z0 + h * t
        rings.append((rr, zz))
    verts = []
    for c in range(courses):
        r0, z0c = rings[c]
        r1, z1c = rings[c + 1]
        lip = r0 + step * (1 - c / courses) ** 0.6
        for (rr, zz) in ((lip, z0c), (r0, z0c + (z1c - z0c) * 0.10), (r1, z1c)):
            verts.append([bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, zz))
                          for a in ring_of(n)])
    for j in range(len(verts) - 1):
        A, B = verts[j], verts[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            try:
                bm.faces.new([A[i], A[i2], B[i2], B[i]])
            except ValueError:
                pass
    apex = bm.verts.new((0, 0, z0 + h))
    top = verts[-1]
    for i in range(n):
        bm.faces.new([top[i], top[(i + 1) % n], apex])
    if eaves_inner is None:
        bm.faces.new(verts[0][::-1])          # a full soffit disc
    else:
        # an ANNULUS, so whatever the game hangs under the eaves (an emissive
        # soffit, a lit ceiling) closes the hole and this GLB does not occlude it
        inner = [bm.verts.new((math.cos(a) * eaves_inner, math.sin(a) * eaves_inner,
                               verts[0][0].co.z)) for a in ring_of(n)]
        for i in range(n):
            i2 = (i + 1) % n
            bm.faces.new([verts[0][i], inner[i], inner[i2], verts[0][i2]])
    return L.from_bmesh(name, bm, (0, 0, 0), mat)


def fluted_drum(name, r, z0, z1, mat, staves=30, depth=0.05, groove=0.06,
                cap_top=True, cap_bottom=False):
    """A round counter/plinth drum expressed as vertical BOARDS: `staves` faces
    round a circle of radius `r` separated by a real reveal `groove` (as a
    fraction of one stave's period) cut `depth` deep.

    ⚠ A single-vertex crease is not a groove. The first island_bar turntable had
    one sample at the stave boundary, and with shade_smooth the drum came back a
    plain dark cylinder. Four samples per stave — in, out, out, out — give the
    reveal two walls steep enough (≈50°) for shade_smooth to keep them sharp,
    which is the whole reason a guest reads boards."""
    bm = bmesh.new()
    ang = []
    gi = 1.0 - depth / r
    for i in range(staves):
        for (t, g) in ((0.0, gi), (groove, gi), (groove, 1.0), (0.5, 1.0),
                       (1.0 - groove, 1.0), (1.0 - groove, gi)):
            ang.append((2 * math.pi * (i + t) / staves, g))
    lo = [bm.verts.new((math.cos(a) * r * g, math.sin(a) * r * g, z0)) for (a, g) in ang]
    hi = [bm.verts.new((math.cos(a) * r * g, math.sin(a) * r * g, z1)) for (a, g) in ang]
    n = len(ang)
    for i in range(n):
        i2 = (i + 1) % n
        bm.faces.new([lo[i], lo[i2], hi[i2], hi[i]])
    if cap_top:
        bm.faces.new(hi)
    if cap_bottom:
        bm.faces.new(lo[::-1])
    return L.from_bmesh(name, bm, (0, 0, 0), mat)


def curved_plan(w, d, bulge, corner=0.09, arc=7, k=3):
    """A daybed's plan: `w` × `d` with a straight back at y = −d/2, rounded back
    corners of radius `corner`, and a FRONT edge bowed `bulge` proud at the
    centre — the cabana pod's mattress follows the dome's circular plan, which is
    what resort-pool-cabana-view.webp is looking straight down."""
    hw, hd = w / 2, d / 2
    # the front arc through (±hw, hd − bulge) and (0, hd)
    if bulge <= 1e-4:
        front = [(hw, hd), (-hw, hd)]
    else:
        rad = (hw * hw + bulge * bulge) / (2 * bulge)
        cy = hd - rad
        a0 = math.atan2(hd - bulge - cy, hw)
        front = []
        for i in range(arc + 1):
            a = a0 + (math.pi - 2 * a0) * i / arc
            front.append((math.cos(a) * rad, cy + math.sin(a) * rad))
    # …then down the left side, round the back-left corner (180°→270°), along
    # the back and round the back-right corner (270°→360°), closing on the arc.
    pts = list(front)
    for (sx, a0deg) in ((-1, 180.0), (1, 270.0)):
        cxp = sx * (hw - corner)
        for i in range(k):
            a = math.radians(a0deg + 90.0 * i / (k - 1))
            pts.append((cxp + math.cos(a) * corner, -(hd - corner) + math.sin(a) * corner))
    return pts
