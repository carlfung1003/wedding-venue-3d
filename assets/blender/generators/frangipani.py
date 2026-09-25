"""frangipani — the arrival court's multi-trunk frangipani / plumeria tree
(KAN-211 wave A2; entrance-arrival-brief.md §1, frames f_001–f_008).

Replaces the flat-shaded blob tree campus.js buildArrival's `frangipani()` drew
(3 leaning UNIT_CYL trunks + 5 green UNIT_BLOB canopy masses + 7 pink flecks)
at the four bed positions (bedX0 + 1.6 / + 5.6 in both beds). The call site
still DRAWS every rnd() it drew before — the matrices are computed and dropped
— so every later placement on the campus is byte-identical (scatter-probe).

GEOMETRY ONLY (BAKE = False), two GLBs in ONE frame (origin at the foot of the
trunks, y up, i.e. the bed surface; front −Z, though a tree has none):
  frangipani          the trunks + branches, on the game's MAT.arrTrunk with a
                      grey bark instance colour (the arrTrunkI program — an
                      instanced, instance-coloured, un-mapped standard material)
  frangipani_leaves   alpha-cut leaf-ROSETTE cards at every branch tip on
                      leafMat('frangi') (frangipani_leaf.webp — a rosette of
                      paddle leaves with pink and white flowers, keyed off
                      cobalt): the palm fronds' program, no instance colour

Shape (f_001, f_008): three to four thick, smooth, pale-grey trunks leaving one
root flare, each forking twice into the plant's characteristic blunt
"candelabra" — branches that run outward and then turn up, every tip carrying a
rosette of big paddle leaves; ~3.6 m tall, the crown ~4.2 m across and broad,
flat-topped, sparse enough to see the branch structure through it. The trunks
stay inside r .45 at the ground — the game's trunk collider is r .5 there.
"""
import math
import _flora as F
import wv_lib as L

NAME = "frangipani"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 2600
FRONT = "-Z"
ORIGIN = "floor"

L.PALETTE.setdefault("bark", L._hex("8a8580"))


def _branches():
    """Deterministic branch skeleton: a list of (points, radii) polylines and the
    tips [(position, outward unit xz, radius)]."""
    rnd = L.rng("frangipani")
    lines, tips = [], []

    def grow(p, d, r, length, depth):
        # a branch runs along d (x, y, z), bending upward toward its end
        pts, rs = [p], [r]
        n = 4
        cur = list(p)
        dd = list(d)
        for k in range(1, n + 1):
            t = k / n
            up = 0.22 * t
            dd = [dd[0] * (1 - up), dd[1] + up, dd[2] * (1 - up)]
            m = math.sqrt(sum(c * c for c in dd))
            dd = [c / m for c in dd]
            cur = [cur[i] + dd[i] * length / n for i in range(3)]
            pts.append(tuple(cur))
            rs.append(r * (1 - 0.32 * t))
        lines.append((pts, rs))
        end, rend = pts[-1], rs[-1]
        if depth == 0:
            h = math.hypot(dd[0], dd[2]) or 1
            tips.append((end, (dd[0] / h, dd[2] / h), rend))
            return
        forks = 2 if depth == 2 or rnd.random() < .7 else 3
        base = math.atan2(dd[2], dd[0])
        for f in range(forks):
            a = base + (f - (forks - 1) / 2) * (0.95 + rnd.random() * .3)
            elev = 0.40 + rnd.random() * .30 if depth == 1 else 0.22 + rnd.random() * .25
            nd = (math.cos(a) * math.cos(elev), math.sin(elev), math.sin(a) * math.cos(elev))
            grow(end, nd, rend * 0.80, length * (0.85 + rnd.random() * .2), depth - 1)

    trunks = 4
    for t in range(trunks):
        a = t / trunks * 2 * math.pi + rnd.random() * .5
        lean = 0.42 + rnd.random() * .14                  # from vertical
        d = (math.cos(a) * math.sin(lean), math.cos(lean), math.sin(a) * math.sin(lean))
        p0 = (math.cos(a) * .10, 0.0, math.sin(a) * .10)
        grow(p0, d, 0.13 + rnd.random() * .025, 0.95 + rnd.random() * .2, 2)
    return lines, tips


def build():
    lines, _ = _branches()
    b = F.Buf()
    SIDES = 7
    for pts, rs in lines:
        rings = []
        for i, (p, r) in enumerate(zip(pts, rs)):
            q = pts[min(i + 1, len(pts) - 1)]
            o = pts[max(i - 1, 0)]
            ax = [q[k] - o[k] for k in range(3)]
            m = math.sqrt(sum(c * c for c in ax)) or 1
            ax = [c / m for c in ax]
            ref = (1, 0, 0) if abs(ax[0]) < .9 else (0, 0, 1)
            u = [ax[1] * ref[2] - ax[2] * ref[1], ax[2] * ref[0] - ax[0] * ref[2], ax[0] * ref[1] - ax[1] * ref[0]]
            mu = math.sqrt(sum(c * c for c in u)); u = [c / mu for c in u]
            v = [ax[1] * u[2] - ax[2] * u[1], ax[2] * u[0] - ax[0] * u[2], ax[0] * u[1] - ax[1] * u[0]]
            flare = 1.0 + (0.35 if (i == 0 and p[1] < .01) else 0)
            ring = []
            for s in range(SIDES):
                a = 2 * math.pi * s / SIDES
                n = [math.cos(a) * u[k] + math.sin(a) * v[k] for k in range(3)]
                ring.append(b.vert([p[k] + n[k] * r * flare for k in range(3)], n))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for s in range(SIDES):
                s2 = (s + 1) % SIDES
                b.face((rings[i][s], rings[i + 1][s], rings[i + 1][s2], rings[i][s2]),
                       ((s / SIDES, i / 4), (s / SIDES, (i + 1) / 4), ((s + 1) / SIDES, (i + 1) / 4), ((s + 1) / SIDES, i / 4)))
        # a blunt rounded cap on every branch end
        c = b.vert(pts[-1], None)
        b.n[c] = tuple((pts[-1][k] - pts[-2][k]) for k in range(3))
        last = rings[-1]
        for s in range(SIDES):
            b.face((last[s], last[(s + 1) % SIDES], c), ((0, 0), (1, 0), (.5, 1)))
    b.orient_to_normals()
    o = b.to_object(NAME, "bark")
    return L.join([o], NAME, origin=None)


def build_leaves():
    _, tips = _branches()
    rnd = L.rng("frangipani_leaves")
    b = F.Buf()
    for (p, (ox, oz), r) in tips:
        for c in range(5):
            size = (1.45 if c == 0 else 1.15) * (0.9 + rnd.random() * .25)
            # the card centre: at the tip, the extra cards pushed out / down
            off = 0.0 if c == 0 else 0.40 + rnd.random() * .25
            ang = math.atan2(oz, ox) + (0 if c == 0 else (c - 2.5) * 1.25 + (rnd.random() - .5) * .5)
            cx = p[0] + math.cos(ang) * off
            cz = p[2] + math.sin(ang) * off
            cy = p[1] + (0.08 if c == 0 else -0.10 - rnd.random() * .22)
            # tilt: the card faces UP, tipped outward by 20–40°
            tilt = math.radians((15 if c == 0 else 30) + rnd.random() * 25)
            dx, dz = math.cos(ang), math.sin(ang)
            nrm = (dx * math.sin(tilt), math.cos(tilt), dz * math.sin(tilt))
            # an in-plane basis: e1 ⟂ nrm, spun at random so the flowers do not align
            spin = rnd.random() * 2 * math.pi
            t1 = (-dz, 0.0, dx)                                      # tangent (horizontal)
            t2 = (nrm[1] * t1[2] - nrm[2] * t1[1], nrm[2] * t1[0] - nrm[0] * t1[2],
                  nrm[0] * t1[1] - nrm[1] * t1[0])                   # down-slope
            e1 = [math.cos(spin) * t1[k] + math.sin(spin) * t2[k] for k in range(3)]
            e2 = [-math.sin(spin) * t1[k] + math.cos(spin) * t2[k] for k in range(3)]
            h = size / 2
            # shading normal: out and a little DOWN toward the guest (the palm
            # crown's measured rule, KAN-208 wave 2 lesson 3) blended with the card's
            sn = [0.55 * dx + 0.35 * nrm[0], 0.25 * nrm[1] - 0.10, 0.55 * dz + 0.35 * nrm[2]]
            ids = []
            for (su, sv) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                q = [cx, cy, cz]
                q = [q[k] + su * h * e1[k] + sv * h * e2[k] for k in range(3)]
                ids.append(b.vert(q, sn))
            b.face((ids[0], ids[1], ids[2], ids[3]), ((0, 0), (1, 0), (1, 1), (0, 1)))
    b.orient_to_normals()
    o = b.to_object(NAME + "_leaves", "leaf")
    return L.join([o], NAME + "_leaves", origin=None)
