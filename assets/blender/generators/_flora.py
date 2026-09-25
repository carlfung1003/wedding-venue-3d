"""_flora — helpers for the KAN-208 wave 2 planting: the coconut palms, the
clipped hedges and the topiary.

Files starting with `_` are skipped by make_masters.py.

⚠ EVERY ASSET BUILT FROM HERE IS GEOMETRY ONLY (`BAKE = False`, the pool
lanterns' rule — ASSET_SPEC.md § "THE GEOMETRY-ONLY RULE"). The game keeps its
OWN materials — nature.js's MAT.bark / MAT.frond / MAT.hedge and campus.js's
MAT.hedge — because those already carry the photographic maps (bark.webp,
frond.webp, hedge.webp), their night tints and, for the fronds, the alphaTest
cut-out, all compiled into the program at boot. A baked atlas would have
meant a new material per species and a new shader program each, and the
program count is asserted constant (116) at every view. So the generator
owns UV0 and lays it out for THOSE textures:

  frond.webp  (ClampToEdge, no repeat) u = butt → tip, rachis at v .575, the
              leaflet band v .15 … 1, the brown coconut patch v 0 … .12
  bark.webp   (repeat 1.2 × 16) u = once round the trunk, v = 0 at the foot
              → 1 at the crown — exactly THREE.CylinderGeometry's layout
  hedge.webp  nature: repeat 2 × 1, one 0…1 tile per face like BoxGeometry;
              campus: repeat 1 × 1 and the tile density authored in the UVs

Everything is authored in the GAME's frame (x, y-up, z) and converted once,
here, to Blender's Z-up — so every number reads straight across from
js/nature.js and js/campus.js. glTF export maps Blender (x, y, z) → (x, z, −y),
so a game point (x, y, z) is Blender (x, −z, y).
"""
import math
import bpy
import bmesh
from mathutils import Vector
import wv_lib as L


def g2b(p):
    """game (x, y-up, z) → Blender (x, −z, y)"""
    return (p[0], -p[2], p[1])


class Buf:
    """A mesh accumulated in GAME coordinates: vertices, faces, a UV per face
    corner, and optionally a custom normal per vertex (game frame)."""

    def __init__(self):
        self.v, self.n, self.f, self.uv = [], [], [], []

    def vert(self, p, n=None):
        self.v.append(tuple(p))
        self.n.append(None if n is None else tuple(n))
        return len(self.v) - 1

    def face(self, idx, uvs):
        assert len(idx) == len(uvs)
        self.f.append(tuple(idx))
        self.uv.append(tuple(tuple(u) for u in uvs))

    def orient_to_normals(self):
        """Wind every face so its FRONT is the side its custom normals point to.
        three's DoubleSide flips the shading normal on back faces
        (normal *= faceDirection), so a frond whose winding disagrees with its
        normal is lit as if seen from underneath from every angle."""
        for k, idx in enumerate(self.f):
            ns = [self.n[i] for i in idx]
            if any(n is None for n in ns):
                continue
            a, b, c = (Vector(self.v[i]) for i in idx[:3])
            fn = (b - a).cross(c - a)
            want = sum((Vector(n) for n in ns), Vector((0, 0, 0)))
            if fn.dot(want) < 0:
                self.f[k] = tuple(reversed(idx))
                self.uv[k] = tuple(reversed(self.uv[k]))

    def to_object(self, name, key, merge=False, custom_normals=None):
        """→ a linked Blender object with UV0 ('UVMap') written per loop.
        merge=True welds coincident vertices (hedges: the cube-grid faces share
        their edges) so Blender's smooth normals run continuously across them."""
        me = bpy.data.meshes.new(name)
        me.from_pydata([g2b(p) for p in self.v], [], self.f)
        me.update()
        uvl = me.uv_layers.new(name="UVMap")
        # ⚠ V IS WRITTEN FLIPPED. Everything in this file speaks three's UV
        # convention (v = 0 at the image's BOTTOM — TextureLoader's flipY), but
        # the glTF exporter writes v_gltf = 1 − v_blender and three uses v_gltf
        # as-is. The game's maps are TextureLoader maps with flipY = true, so
        # an unflipped layout samples the frond atlas upside down — the first
        # in-engine shot had every leaflet edge reading the brown coconut patch.
        # (memory: gltf-uv-v-runs-down.)
        for poly, uvs in zip(me.polygons, self.uv):
            for li, uv in zip(poly.loop_indices, uvs):
                uvl.data[li].uv = (uv[0], 1.0 - uv[1])
        if merge:
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
            bm.to_mesh(me)
            bm.free()
        for p in me.polygons:
            p.use_smooth = True
        use_custom = custom_normals if custom_normals is not None else all(n is not None for n in self.n)
        if use_custom and not merge:
            me.normals_split_custom_set_from_vertices(
                [Vector(g2b(n)).normalized() for n in self.n])
        o = bpy.data.objects.new(name, me)
        bpy.context.collection.objects.link(o)
        o.data.materials.append(L.M(key))
        return o


# ═══════════════════════════════════════════════════════════════════════════
#   THE COCONUT PALM
# ═══════════════════════════════════════════════════════════════════════════
# js/nature.js palmVariants() — the three silhouettes the scatter picks from.
# h / rTop / rBot / bendX / bendZ are LOAD-BEARING: the crown must sit on the
# bent trunk top at (bendX, h, bendZ) exactly as crownGeo() translated it, and
# requestPalms() aims a palm's lean with atan2(bendZ, bendX) and sizes it by
# h (variantForHeight). The frond COUNT, LENGTH and WIDTH are this asset's own.
PALM_SPECS = {
    "tall":  dict(h=11.5, rTop=.17, rBot=.34, bendX=1.9, bendZ=.5, fronds=9, frondL=4.6, frondW=.95, nuts=5),
    "mid":   dict(h=8.6, rTop=.18, rBot=.33, bendX=-1.3, bendZ=1.1, fronds=8, frondL=4.1, frondW=.88, nuts=4),
    "young": dict(h=5.8, rTop=.2, rBot=.32, bendX=.7, bendZ=-.9, fronds=7, frondL=3.5, frondW=.8, nuts=0),
}

# frond.webp's measured alpha envelope (fraction of the .425 half-band that is
# leaf, per u column, above | below the rachis) — read off the texture with
# PIL, see the KAN-208 wave 2 notes. The geometry is cut to this outline plus a
# margin, so the alpha test draws the true leaflet edge and no quad is wasted
# on transparent texels.
_ENV_U = [0.0, .156, .188, .219, .25, .281, .312, .344, .4, .5, .6, .7, .75, .8, .85, .9, .95, 1.0]
_ENV_UP = [.05, .05, .24, .46, .63, .80, .89, .92, .95, .94, .96, .94, .88, .82, .75, .68, .56, .45]
_ENV_DN = [.10, .05, .12, .32, .50, .68, .76, .86, .82, .75, .79, .77, .71, .64, .55, .43, .26, .18]


def _interp(xs, ys, x):
    if x <= xs[0]:
        return ys[0]
    for i in range(1, len(xs)):
        if x <= xs[i]:
            t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
            return ys[i - 1] + (ys[i] - ys[i - 1]) * t
    return ys[-1]


def env_max(s0, s1, table):
    """the envelope's MAX over [s0, s1] — a straight edge between two stations
    must enclose every leaflet between them, not just the two ends"""
    xs = [s0 + (s1 - s0) * k / 8 for k in range(9)]
    return max(_interp(_ENV_U, table, x) for x in xs)


def trunk_centre(sp, t):
    """the trunk's centre-line at height fraction t — nature.js trunkGeo()'s
    bend, k(t) = .8t² + .2t, k(1) = 1"""
    k = t * t * .8 + t * .2
    return sp["bendX"] * k, t * sp["h"], sp["bendZ"] * k


def palm_trunk(sp, rnd, sides=8, ts=None):
    """The ring-scarred trunk, in trunkGeo()'s exact envelope: radius lerps rBot
    → rTop, a bulbous root collar below t .11 (×(1 + 3(.11 − t))), the swell
    under the crown above t .90 (×(1 + 2.4(t − .9))), the same bend. What it
    adds: a gentle kink in the centre-line (zero at both ends, so the crown
    still lands on (bendX, h, bendZ)), rings spent where the silhouette
    curves, a slightly elliptic section, and a closed crown cap — the
    procedural cylinder was open-ended, so a camera above looked into it."""
    H = sp["h"]
    if ts is None:
        ts = [0, .035, .075, .11, .2, .3, .4, .5, .6, .7, .8, .87, .92, .96, 1.0]
    wob_a = rnd.uniform(.05, .09)
    wob_ph = rnd.uniform(0, 2 * math.pi)
    ell = rnd.uniform(.94, 1.0)
    b = Buf()
    rings = []
    for t in ts:
        cx, y, cz = trunk_centre(sp, t)
        w = wob_a * math.sin(math.pi * t) * math.sin(3 * math.pi * t + wob_ph)
        cx += w * .8
        cz += w * .6
        r = sp["rBot"] + (sp["rTop"] - sp["rBot"]) * t
        flare = (.11 - t) * 3.0 if t < .11 else 0
        neck = (t - .90) * 2.4 if t > .90 else 0
        r *= (1 + flare + neck)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            ring.append(b.vert((cx + math.cos(a) * r, y, cz + math.sin(a) * r * ell)))
        rings.append((ring, t))
    # the crown cap: a short fibrous dome of leaf bases (still bark-mapped)
    cx, y, cz = trunk_centre(sp, 1.0)
    r = sp["rTop"] * 1.24
    for (dy, k) in ((.16, .82), (.30, .45)):
        ring = [b.vert((cx + math.cos(2 * math.pi * j / sides) * r * k, y + dy,
                        cz + math.sin(2 * math.pi * j / sides) * r * k)) for j in range(sides)]
        rings.append((ring, 1 + dy / H))
    apex = b.vert((cx, y + .38, cz))
    for (r0, t0), (r1, t1) in zip(rings, rings[1:]):
        for j in range(sides):
            j2 = (j + 1) % sides
            u0, u1 = j / sides, (j + 1) / sides
            # CCW seen from outside: j → j+1 goes +angle (x→z), which seen from
            # outside is clockwise in (x, z) — so up the ring first.
            b.face((r0[j], r1[j], r1[j2], r0[j2]), ((u0, t0), (u0, t1), (u1, t1), (u1, t0)))
    rl, tl = rings[-1]
    for j in range(sides):
        j2 = (j + 1) % sides
        b.face((rl[j], apex, rl[j2]), ((j / sides, tl), ((j + .5) / sides, tl + .02), ((j + 1) / sides, tl)))
    return b


def palm_crown(sp, rnd, fronds, nuts, L_scale=1.0, hw_frac=.19, segs=7):
    """The crown: `fronds` pinnate fronds in a 137.5° phyllotaxis spiral, each a
    three-row ribbon (left leaflets · rachis · right leaflets) mapped onto
    frond.webp, plus a coconut bunch.

    Age drives everything, the way a real crown reads: the youngest fronds
    (top of the spiral) spear UP at ~70° and barely droop; the mature ring
    stands out near level and arcs over; the oldest hang below the crown
    base. Leaflets hang off the rachis in a V (the keel), steeper with age.

    ⚠ WIDTH. The procedural crown drew a 4.6 m frond 0.95 m wide, so frond.webp
    (a frond whose leaflet band is ~0.85× its length) was squeezed ~4× across
    and every frond read as a thin green strap. Here the half-width is
    `hw_frac` × L (≈ 0.87 m on the tall palm): still ~2× compressed, which is
    what makes the leaflets sweep toward the tip, but a crown now reads as a
    crown. The ribbon is cut to the texture's measured alpha envelope.

    Normals are CUSTOM: out from the trunk axis and a little down (see nrm()
    for the three versions that were measured), so a frond is lit like part
    of a canopy rather than as a flat card, and every face is wound so its
    front agrees (see Buf.orient_to_normals)."""
    cx, cy, cz = trunk_centre(sp, 1.0)
    b = Buf()
    GA = math.radians(137.508)
    az0 = rnd.uniform(0, 2 * math.pi)
    for f in range(fronds):
        age = f / max(1, fronds - 1)                      # 0 youngest … 1 oldest
        az = az0 + f * GA + rnd.uniform(-.18, .18)
        d = Vector((math.cos(az), 0, math.sin(az)))
        side = Vector((-d.z, 0, d.x))
        up = Vector((0, 1, 0))
        Lf = sp["frondL"] * L_scale * (.78 + .34 * math.sin(math.pi * min(1, age * 1.25))) * rnd.uniform(.92, 1.08)
        hwm = Lf * hw_frac * rnd.uniform(.92, 1.08)
        th0 = math.radians(70 - 78 * age + rnd.uniform(-6, 6))     # initial elevation
        droop = .55 + 1.25 * age + rnd.uniform(-.12, .12)            # radians of arc over L
        phi0 = math.radians(22 + 30 * age)                           # leaflet keel angle
        base = Vector((cx, cy + .30 - .52 * age, cz)) + d * (.10 + .06 * age)
        p = base.copy()
        pts = []
        for i in range(segs + 1):
            s = i / segs
            th = th0 - droop * s ** 1.5
            T = d * math.cos(th) + up * math.sin(th)
            if i > 0:
                sm = (i - .5) / segs
                thm = th0 - droop * sm ** 1.5
                p = p + (d * math.cos(thm) + up * math.sin(thm)) * (Lf / segs)
            pts.append((s, p.copy(), T))
        rows = []
        for i, (s, pc, T) in enumerate(pts):
            s0 = pts[max(0, i - 1)][0]
            s1 = pts[min(segs, i + 1)][0]
            eu = min(1.0, env_max((s0 + s) / 2, (s + s1) / 2, _ENV_UP) + .06)
            ed = min(1.0, env_max((s0 + s) / 2, (s + s1) / 2, _ENV_DN) + .06)
            # "down" relative to the rachis: world down with its along-frond
            # component removed, so a hanging frond's leaflets still hang
            dn = Vector((0, -1, 0)) + T * T.y
            dn = dn.normalized() if dn.length > 1e-4 else Vector((0, -1, 0))
            sd = T.cross(dn).normalized()
            if sd.dot(side) < 0:
                sd = -sd
            phi = phi0 + .25 * s                             # the tip hangs a little more
            hl, hr = hwm * eu, hwm * ed
            pl = pc + sd * (hl * math.cos(phi)) + dn * (hl * math.sin(phi))
            pr = pc - sd * (hr * math.cos(phi)) + dn * (hr * math.sin(phi))
            # custom normal: OUT from the trunk axis and a little DOWN — i.e.
            # toward where a guest stands. Measured the hard way (KAN-208 wave 2):
            #  · radial + up (the first pass): three's DoubleSide flips the
            #    normal on back faces, and a flipped radial normal faces the
            #    venue's LOW golden-hour sun head-on — a third of every backlit
            #    crown lit flat khaki;
            #  · up-dominant: the up faces, seen from the ground at a grazing
            #    angle toward that low sun, took the Fresnel glare instead —
            #    still khaki, and identical with envMapIntensity 0 or roughness
            #    1, so it is the sun's specular, not the environment;
            #  · out-and-down: the face a guest sees has its normal pointing
            #    back at them (N·V high, no grazing Fresnel), the crown's far
            #    side still catches a sun behind it, and from the roof the back
            #    faces flip to up-and-in, lit from above. This is what shipped.
            def nrm(q):
                rad = Vector((q.x - cx, 0, q.z - cz))
                rad = rad.normalized() if rad.length > 1e-4 else d
                return tuple((rad * 1.0 - up * .35).normalized())
            rows.append((
                (b.vert(tuple(pl), nrm(pl)), (s, .575 + .425 * eu)),
                (b.vert(tuple(pc), nrm(pc)), (s, .575)),
                (b.vert(tuple(pr), nrm(pr)), (s, .575 - .425 * ed)),
            ))
        for i in range(segs):
            r0, r1 = rows[i], rows[i + 1]
            for k in range(2):
                (a0, ua0), (b0, ub0) = r0[k], r0[k + 1]
                (a1, ua1), (b1, ub1) = r1[k], r1[k + 1]
                b.face((a0, a1, b1, b0), (ua0, ua1, ub1, ub0))
    # ── the coconut bunch: hangs under the frond bases, uv'd into the brown patch
    if nuts:
        ico_v, ico_f = _icosahedron()
        a0 = rnd.uniform(0, 2 * math.pi)
        for k in range(nuts):
            a = a0 + k * 2.1 + rnd.uniform(-.3, .3)
            rr = .20 + rnd.uniform(0, .16)
            c = Vector((cx + math.cos(a) * rr, cy - .22 - rnd.uniform(0, .22), cz + math.sin(a) * rr))
            R = (.13, .12, .13)
            vid = []
            for q in ico_v:
                pos = c + Vector((q[0] * R[0], q[1] * R[1] * 1.12, q[2] * R[2]))
                vid.append(b.vert(tuple(pos), tuple(Vector(q).normalized())))
            for (i0, i1, i2) in ico_f:
                uvs = []
                for i in (i0, i1, i2):
                    q = ico_v[i]
                    uvs.append((.15 + .7 * (math.atan2(q[2], q[0]) / (2 * math.pi) + .5),
                                .02 + .08 * (q[1] + 1) / 2))
                b.face((vid[i0], vid[i1], vid[i2]), uvs)
    b.orient_to_normals()
    return b


def _icosahedron():
    t = (1 + 5 ** .5) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t),
         (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    n = (1 + t * t) ** .5
    v = [(x / n, y / n, z / n) for (x, y, z) in v]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4),
         (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8),
         (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    return v, f


# ═══════════════════════════════════════════════════════════════════════════
#   CLIPPED HEDGES + TOPIARY — unit prototypes, centred on the origin
# ═══════════════════════════════════════════════════════════════════════════
# Every hedge call site scales a UNIT prototype non-uniformly (mat4 / dummy.scale),
# so these keep the unit envelope of what they replace — BoxGeometry(1,1,1) and
# IcosahedronGeometry(.5) both span ±0.5 on every axis, centred. The scatter and
# the matrices are untouched; only the shape inside the unit cell changes.

def _lumps(x, y, z, ph, f=(5.3, 7.1, 6.2)):
    """low-frequency leafy lumps, deterministic in position"""
    return (math.sin(x * f[0] + ph[0]) * math.sin(z * f[1] + ph[1])
            + math.sin(y * f[2] + ph[2]) * math.sin((x + z) * 4.1 + ph[1]) * .6) / 1.6


def hedge_run(rnd, zsegs=8, rc=.17, batter=.035, amp=.028):
    """A clipped hedge SEGMENT that joins its neighbours seamlessly: local Z runs
    along the hedge (nature.js hedgeRun sets rotation.y = atan2(dx, dz) and
    scale (t, h, w)), so the ±Z ends are FLAT and FULL — adjacent segments
    overlap by 6 cm and must not open a notch at every joint. The long top
    edges are rounded (rc of the unit section), the faces batter in slightly
    toward the top, and the leafy lumps are PERIODIC in z with period 1, so
    the displacement at z = +.5 equals the next segment's at z = −.5.
    UVs: u = z + .5 along the run; v = arc length round the section, so each
    face still gets one 0…1 tile like the BoxGeometry it replaces (repeat 2 × 1
    in nature.js), continuous over the rounded shoulders; end caps planar.
    The underside is omitted (it stands on the ground)."""
    # the section, bottom-left → over the top → bottom-right, as (x, y, nx, ny)
    prof = []
    top_hw = .5 - batter
    ys = [-.5, -.2, .1, .5 - rc]
    for y in ys:
        k = (y + .5) / (1 - rc)
        prof.append((-(.5 - batter * k), y, -1.0, 0.0))
    for a in (.5, 1.0):                                   # the rounded shoulder
        ang = math.pi - a * math.pi / 2
        prof.append((-(top_hw - rc) + math.cos(ang) * rc, .5 - rc + math.sin(ang) * rc,
                     math.cos(ang), math.sin(ang)))
    for x in (-.2, .2):
        prof.append((x, .5, 0.0, 1.0))
    for a in (0.0, .5):
        ang = math.pi / 2 - a * math.pi / 2
        prof.append(((top_hw - rc) + math.cos(ang) * rc, .5 - rc + math.sin(ang) * rc,
                     math.cos(ang), math.sin(ang)))
    for y in reversed(ys):
        k = (y + .5) / (1 - rc)
        prof.append(((.5 - batter * k), y, 1.0, 0.0))
    # arc-length v
    vs = [0.0]
    for i in range(1, len(prof)):
        vs.append(vs[-1] + math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]))
    ph = [rnd.uniform(0, 6.28) for _ in range(4)]
    b = Buf()
    grid = []
    for iz in range(zsegs + 1):
        z = -.5 + iz / zsegs
        row = []
        for (x, y, nx, ny) in prof:
            ground = y <= -.49
            # periodic in z (period 1): 2πz, 4πz
            d = 0 if ground else amp * (
                math.sin(2 * math.pi * z + ph[0] + y * 3.1 + x * 2.3) * .55
                + math.sin(4 * math.pi * z + ph[1] + y * 5.3 - x * 4.1) * .35
                + math.sin(6 * math.pi * z + ph[2] + (x + y) * 6.7) * .25)
            row.append(b.vert((x + nx * d, y + ny * d, z)))
        grid.append(row)
    for iz in range(zsegs):
        u0, u1 = iz / zsegs, (iz + 1) / zsegs
        for i in range(len(prof) - 1):
            a0, a1 = grid[iz][i], grid[iz][i + 1]
            b0, b1 = grid[iz + 1][i], grid[iz + 1][i + 1]
            # outward = away from the section's inside; profile runs left→top→right,
            # so (i → i+1) × (+z) points out
            b.face((a0, b0, b1, a1), ((u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1])))
    # end caps: fan from the section centroid
    for iz, sgn in ((0, -1), (zsegs, 1)):
        row = grid[iz]
        cxy = b.vert((0, 0, -.5 if sgn < 0 else .5))
        for i in range(len(prof) - 1):
            p0, p1 = prof[i], prof[i + 1]
            uv0, uv1 = (p0[0] + .5, p0[1] + .5), (p1[0] + .5, p1[1] + .5)
            if sgn > 0:
                b.face((cxy, row[i], row[i + 1]), ((.5, .5), uv0, uv1))
            else:
                b.face((cxy, row[i + 1], row[i]), ((.5, .5), uv1, uv0))
        # close the bottom edge of the cap
        b.face((cxy, row[-1], row[0]) if sgn > 0 else (cxy, row[0], row[-1]),
               ((.5, .5), (prof[-1][0] + .5, 0), (prof[0][0] + .5, 0)) if sgn > 0 else
               ((.5, .5), (prof[0][0] + .5, 0), (prof[-1][0] + .5, 0)))
    return b


_FACES = [  # cube faces: (normal axis, sign, u axis, v axis)
    (0, 1, 2, 1), (0, -1, 2, 1), (2, 1, 0, 1), (2, -1, 0, 1), (1, 1, 0, 2), (1, -1, 0, 2)]


def _cube_grid(b, grid, shape, uvk, bottom=True):
    """Build a closed surface by projecting each cube face's `grid` × `grid`
    lattice through `shape(p) -> (point, uv_offset_ok)`. UVs are the cube-face
    coordinates × uvk (a per-face box projection, the hedge texture's seams
    fall on the cube edges)."""
    for (ax, sg, ua, va) in _FACES:
        if ax == 1 and sg < 0 and not bottom:
            continue
        ids = []
        for gv in grid:
            row = []
            for gu in grid:
                p = [0.0, 0.0, 0.0]
                p[ax] = .5 * sg
                p[ua] = gu
                p[va] = gv
                q = shape(p)
                row.append((b.vert(q), ((gu + .5) * uvk, (gv + .5) * uvk)))
            ids.append(row)
        for j in range(len(grid) - 1):
            for i in range(len(grid) - 1):
                (a, ta), (c, tc) = ids[j][i], ids[j][i + 1]
                (d, td), (e, te) = ids[j + 1][i], ids[j + 1][i + 1]
                # orient outward: check with the face normal after the fact
                pa, pc, pd = Vector(b.v[a]), Vector(b.v[c]), Vector(b.v[d])
                fn = (pc - pa).cross(pd - pa)
                out = Vector((0, 0, 0)); out[ax] = sg
                if fn.dot(out) >= 0:
                    b.face((a, c, e, d), (ta, tc, te, td))
                else:
                    b.face((a, d, e, c), (ta, td, te, tc))


def hedge_block(rnd, r=.13, amp=.018, uvk=2.0, grid=(-.5, -.4, -.16, .16, .4, .5)):
    """A free-standing clipped hedge BLOCK (campus.js hedgeI / arrHedgeI /
    spHedgeI): the unit box with every vertical and top edge rounded by r
    (the base stays square on the ground) and a faint leafy lump. Unlike
    hedge_run it rounds its ends, because these blocks stand apart (the
    terrace edge has 1.9 m gaps; the arrival runs leave .1 m between cells)."""
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    lo = [-.5 + r, -.5, -.5 + r]
    hi = [.5 - r, .5 - r, .5 - r]

    def shape(p):
        inner = [min(max(p[i], lo[i]), hi[i]) for i in range(3)]
        dv = Vector(p) - Vector(inner)
        n = dv.normalized() if dv.length > 1e-6 else Vector((0, 1, 0))
        q = Vector(inner) + n * r if dv.length > 1e-6 else Vector(p)
        if q.y > -.49:
            q += n * (amp * _lumps(q.x, q.y, q.z, ph))
        return tuple(q)
    b = Buf()
    _cube_grid(b, list(grid), shape, uvk, bottom=False)
    return b


def superellipsoid(rnd, pw=3.0, py=3.0, amp=.03, uvk=2.0, n=5):
    """A clipped foliage MASS in the unit sphere's envelope (±0.5): a cube-sphere
    pushed onto |x|^pw + |z|^pw + |y|^py = .5^p. p = 2 is a ball; ~3 is a
    clipped cushion with a flat top and full shoulders — which is what a
    trimmed hedge mass or a box-ball topiary actually is, where the old
    IcosahedronGeometry(.5, 1) was a faceted lens that tapered to a point at
    its base and its ends."""
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    grid = [-.5 + k / n for k in range(n + 1)]

    def shape(p):
        dvec = Vector(p).normalized()
        x, y, z = abs(dvec.x), abs(dvec.y), abs(dvec.z)
        # solve r: (r x)^pw + (r z)^pw + (r y)^py = .5^… — use a common p with a
        # per-axis weight: iterate a few times (monotone in r)
        lo, hi = 0.0, 1.0
        for _ in range(30):
            m = (lo + hi) / 2
            val = (m * x / .5) ** pw + (m * z / .5) ** pw + (m * y / .5) ** py
            if val > 1:
                hi = m
            else:
                lo = m
        q = dvec * lo
        if q.y > -.47:
            q += dvec * (amp * _lumps(q.x, q.y, q.z, ph))
        return tuple(q)
    b = Buf()
    _cube_grid(b, grid, shape, uvk, bottom=True)
    return b


# ═══════════════════════════════════════════════════════════════════════════
#   generator glue — one call per exported asset
# ═══════════════════════════════════════════════════════════════════════════
PALM_BUILD = {
    # fronds / nuts / trunk rings per variant. Budgets: ≤ 800 tris per palm
    # (trunk + crown) — ~325 palms stand on this campus, all instanced.
    "tall":  dict(fronds=14, nuts=6, ts=None),
    "mid":   dict(fronds=13, nuts=5, ts=None),
    "young": dict(fronds=10, nuts=0, ts=[0, .05, .11, .25, .45, .65, .82, .92, 1.0]),
}


def palm_part(variant, part, name):
    """part 'trunk' → the bark-mapped trunk; 'crown' → the frond-mapped crown.
    Both are authored in the SAME frame (origin = the trunk foot, game y-up),
    exactly like nature.js's trunkGeo()/crownGeo() pair, so the scatter's one
    instance matrix drives both halves. origin=None: no re-centring."""
    sp = PALM_SPECS[variant]
    cfg = PALM_BUILD[variant]
    rnd = L.rng("palm_" + variant)          # both halves draw from ONE stream…
    tb = palm_trunk(sp, rnd, ts=cfg["ts"])  # …so the trunk's kink is the same
    if part == "trunk":
        o = tb.to_object(name, "oak_d", custom_normals=False)
        L._orient_normals(o)
    else:
        cb = palm_crown(sp, rnd, cfg["fronds"], cfg["nuts"])
        o = cb.to_object(name, "leaf")
    return L.join([o], name, origin=None)


# ═══════════════════════════════════════════════════════════════════════════
#   KAN-208 WAVE 4 — THE UNDERSTORY: shrub masses, ground cover, bougainvillea,
#   the river dressing's shrubs, the casuarinas
# ═══════════════════════════════════════════════════════════════════════════
# Two-part shrubs. The SCATTER stays exactly what it was: nature.js / water.js /
# campus.js keep every matrix, every instance colour and every rnd() draw, and
# swap only the prototype geometry of the old blob bucket (the CORE). The
# silhouette comes from a second, NEW bucket fed the very same matrices: the
# FRINGE, alpha-cut leaf-clump cards on a foliage material (js/foliage.js) that
# rides the program the palm fronds and the casuarinas already compiled
# (instanced + map + alphaTest + DoubleSide, no instance colour) — so no
# shader program is added. See ASSET_SPEC Group J.
#
# UNIT FRAME: the core and the fringe replace THREE.IcosahedronGeometry(1, …),
# i.e. a radius-1 blob centred on the origin (nature.js blobGeo radius .69–1.31;
# water.js IcosahedronGeometry(1, 1)). campus.js's UNIT_BLOB is radius .5 and
# takes a .5-scaled clone in the game.
#
# CARD UV: one card = the whole leaf-clump image (shrub_leaf.webp /
# boug_leaf.webp): opaque centre, ragged leaf-tip rim cut by alphaTest.

# the mass: a union of five spheres (centre, radius) — lobes, not a ball
_SHRUB_LOBES = [((0.0, 0.05, 0.0), .62), ((.40, -.02, .22), .50), ((-.36, .02, .30), .50),
                ((.06, .04, -.44), .50), ((.10, .34, -.04), .46)]


def _lobe_radius(d, lobes):
    """distance along unit direction d from the origin to the far side of the union
    of spheres (the largest ray-sphere exit among the lobes the ray meets)"""
    best = .2
    for (c, r) in lobes:
        c = Vector(c)
        b = d.dot(c)
        disc = b * b - (c.length_squared - r * r)
        if disc >= 0:
            best = max(best, b + math.sqrt(disc))
    return best


def shrub_core(rnd, scale=.86, flat=None, uvk=.5, detail=1):
    """The opaque CORE of a shrub: an icosahedron (detail 1, 80 tris — the very
    triangle count of the blob it replaces) pushed out onto a union of five
    lobes, so the mass has real clefts between rounded lobes instead of one
    faceted lump. Normals are the RADIAL direction (smooth, like the blob's own
    PolyhedronGeometry normals — the reason the old blob stopped reading as
    crumpled foil, see nature.js blobGeo). UVs: a per-face box projection at
    `uvk` tiles per unit (× the game's repeat 2 = one shrub.webp tile per
    metre of unit), so the photograph is no longer stretched pole-to-pole the
    way the icosahedron's own UVs stretched it. `flat` squashes y (the cover)."""
    ico_v, ico_f = _icosahedron()
    # subdivide once (detail 1): 20 → 80 faces
    verts = [Vector(v) for v in ico_v]
    cache = {}

    def mid(i, j):
        k = (min(i, j), max(i, j))
        if k not in cache:
            verts.append(((verts[i] + verts[j]) / 2).normalized())
            cache[k] = len(verts) - 1
        return cache[k]
    faces = []
    for (a, b_, c) in ico_f:
        if detail == 0:
            faces.append((a, b_, c))
            continue
        ab, bc, ca = mid(a, b_), mid(b_, c), mid(c, a)
        faces += [(a, ab, ca), (b_, bc, ab), (c, ca, bc), (ab, bc, ca)]
    rot = rnd.uniform(0, 2 * math.pi)
    lobes = []
    for (c, r) in _SHRUB_LOBES:
        x, y, z = c
        lobes.append(((x * math.cos(rot) - z * math.sin(rot), y, x * math.sin(rot) + z * math.cos(rot)),
                      r * rnd.uniform(.94, 1.06)))
    pts = []
    for d in verts:
        rr = _lobe_radius(d, lobes)
        p = d * rr
        pts.append(p)
    m = max(p.length for p in pts)
    k = scale / m
    b = Buf()
    for (i0, i1, i2) in faces:
        P = [pts[i] * k for i in (i0, i1, i2)]
        if flat:
            P = [Vector((p.x, p.y * flat, p.z)) for p in P]
        fn = (P[1] - P[0]).cross(P[2] - P[0])
        ax = max(range(3), key=lambda i: abs(fn[i]))
        ua, va = [(2, 1), (0, 2), (0, 1)][ax]
        ids, uvs = [], []
        for p, i in zip(P, (i0, i1, i2)):
            n = Vector(verts[i]).normalized()
            ids.append(b.vert(tuple(p), tuple(n)))
            uvs.append((p[ua] * uvk + .5, p[va] * uvk + .5))
        b.face(ids, uvs)
    b.orient_to_normals()
    return b, lobes, k


def leaf_cards(rnd, n, lobes, k, size=(.62, .86), out=(.62, .9), ymin=-.25,
               tilt=(.35, 1.2), flat=None, nrm_mix=.7):
    """`n` alpha-cut leaf-clump CARDS (2 tris each) standing out of the lobes:
    each card is centred on a point just inside the lobe surface (`out` × its
    radius) along a direction biased upward (the bottom of every shrub is in
    the ground), and TILTED `tilt` radians off facing-out toward a radial fin —
    so from any side some cards are broad-on (the leafy face) and the ones on
    the silhouette stick OUT past the core, which is what breaks the outline.

    Normals: the radial direction from the shrub centre mixed with the card's
    own face normal (nrm_mix radial), wound to agree (orient_to_normals). The
    radial term makes a clump of cards shade like one leafy volume instead of
    a stack of lit and unlit planes (the palm crown's lesson, KAN-208 wave 2)."""
    b = Buf()
    GA = math.radians(137.508)
    for i in range(n):
        # a Fibonacci spiral over the upper cap, jittered — even coverage
        t = (i + .5) / n
        y = 1 - t * (1 - ymin)
        y = max(-.95, min(.97, y + rnd.uniform(-.06, .06)))
        az = i * GA + rnd.uniform(-.3, .3)
        rxz = math.sqrt(max(0, 1 - y * y))
        d = Vector((math.cos(az) * rxz, y, math.sin(az) * rxz)).normalized()
        R = _lobe_radius(d, lobes) * k
        c = d * R * rnd.uniform(*out)
        up = Vector((0, 1, 0))
        t1 = up.cross(d)
        if t1.length < 1e-3:
            t1 = Vector((1, 0, 0))
        t1.normalize()
        t1 = t1 * math.cos(rnd.uniform(0, math.pi)) + d.cross(t1) * math.sin(rnd.uniform(0, math.pi))
        t1 = (t1 - d * t1.dot(d)).normalized()
        w = d.cross(t1).normalized()
        a = rnd.uniform(*tilt)
        nn = (d * math.cos(a) + w * math.sin(a)).normalized()
        u_ax = t1
        v_ax = nn.cross(u_ax).normalized()
        s = rnd.uniform(*size) / 2
        rot = rnd.uniform(0, 2 * math.pi)          # spin the image on the card
        cu, cv = math.cos(rot), math.sin(rot)
        U = u_ax * cu + v_ax * cv
        V = -u_ax * cv + v_ax * cu
        corners = [c - U * s - V * s, c + U * s - V * s, c + U * s + V * s, c - U * s + V * s]
        if flat:
            corners = [Vector((p.x, p.y * flat, p.z)) for p in corners]
        ids = []
        for p in corners:
            rad = Vector(p).normalized() if Vector(p).length > 1e-4 else d
            nv = (rad * nrm_mix + nn * (1 - nrm_mix)).normalized()
            ids.append(b.vert(tuple(p), tuple(nv)))
        uv = ((0, 0), (1, 0), (1, 1), (0, 1))
        b.face((ids[0], ids[1], ids[2]), (uv[0], uv[1], uv[2]))
        b.face((ids[0], ids[2], ids[3]), (uv[0], uv[2], uv[3]))
    b.orient_to_normals()
    return b


def shrub_part(name, part, seed_name, cards=16, detail=1, variant=0, **kw):
    """ONE lobe layout per shrub family (seed_name), shared by the core and every
    fringe variant so the cards sit on the bush they belong to; each fringe
    variant draws its cards from its own stream. `part` picks the half."""
    rnd = L.rng(seed_name)
    core, lobes, k = shrub_core(rnd, detail=detail)
    if part == "core":
        o = core.to_object(name, "leaf")
    else:
        crnd = L.rng(f"{seed_name}_cards{variant}")
        o = leaf_cards(crnd, cards, lobes, k, **kw).to_object(name, "leaf")
    return L.join([o], name, origin=None)


def casuarina_tier(rnd, strands=13, inner=4, segs=3):
    """One needle TIER of a casuarina, in THREE.ConeGeometry(.5, 1, 10)'s exact
    envelope (radius .5 at y −.5, apex at y +.5, centred) because campus.js
    scales each tier (wf, hf, wf) through that cone's matrix.

    A casuarina tier is not a cone: it is a spray of fine needle curtains that
    hang from the branch and fan out, so the tier is `strands` curved RIBBONS
    that leave the axis near the apex, arc out and droop to the rim, plus
    `inner` shorter ones inside them — each a strip of casuarina.webp with the
    image's dense top at the attachment (v = 1) and its wispy strand ends at
    the hanging tip (v = 0), a random u-window so no two ribbons repeat. No
    base cap: the cone's cap sampled the whole map as a flat disc — the grey
    "saucers" stuck on every trunk in the before shots. Normals out-and-down
    (the palm crown's measured rule, KAN-208 wave 2)."""
    b = Buf()
    GA = math.radians(137.508)
    specs = [(1.0, 1.0)] * strands + [(.62, .8)] * inner
    for i, (reach, drop) in enumerate(specs):
        az = i * GA + rnd.uniform(-.2, .2)
        d = Vector((math.cos(az), 0, math.sin(az)))
        side = Vector((-d.z, 0, d.x))
        y0 = .5 - rnd.uniform(0, .18) - (0 if reach == 1 else .12)
        rr = .5 * reach * rnd.uniform(.86, 1.05)
        yb = -.5 * drop + rnd.uniform(-.04, .06)
        hw = rnd.uniform(.11, .16) * (1 if reach == 1 else .8)
        u0 = rnd.uniform(0, .7)
        uw = rnd.uniform(.22, .3)
        rows = []
        for j in range(segs + 1):
            t = j / segs
            # out quickly, then hang: radius ~ sqrt(t), height ~ linear w/ sag
            r = rr * (t ** .6)
            y = y0 + (yb - y0) * (t ** 1.3)
            pc = d * r + Vector((0, y, 0))
            w = hw * (.45 + .55 * t)                 # the curtain widens as it falls
            n = (d * 1.0 + Vector((0, -.35, 0))).normalized()
            v = 1 - t
            rows.append((b.vert(tuple(pc - side * w), tuple(n)), b.vert(tuple(pc + side * w), tuple(n)), v))
        for j in range(segs):
            (a0, a1, va), (b0, b1, vb) = rows[j], rows[j + 1]
            b.face((a0, b0, b1, a1), ((u0, va), (u0, vb), (u0 + uw, vb), (u0 + uw, va)))
    b.orient_to_normals()
    return b
