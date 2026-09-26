"""chair_slipcover — the Welcome Brunch's linen slip + blush sash over the back of
`dining_chair_rattan` (KAN-211 wave E).

moments.js dressed the 32 brunch chairs with two plain boxes each — a .50 ×
.50 × .10 linen slab and a .52 × .08 × .12 blush bar — "10 cm boxes". This is
the real thing: a FITTED LINEN SLEEVE pulled down over the chair's back, closed
over the curved top rail, its hem riding just clear of the cushion at the front
and falling longer behind, soft vertical folds growing toward the hem; a blush
SASH wrapped round it at the lumbar and tied at the back in a bow with two
tails.

⚠ THE CHAIR'S OWN FRAME (the chair_drape rule): the game drops this through the
SAME matrix as its chair — `mat4(cx, DY, cz, 1, 1, 1, ca − π/2)` in campus.js,
i.e. put(K.mdl(...), cx, DY, cz, 1, [0, ca − π/2, 0]) in moments.js — so it is
joined with origin=None: x/y about the chair's floor centre, z = 0 at the
chair's foot. FRONT "+Z" (the chair family): the back is at Blender +Y.

Fitted to generators/dining_chair_rattan.py's numbers (ASSET_SPEC Group E):
rear stiles at x ±.18 (Ø .052) from LEG_YB .205, bowing back BOW .028 at the
ends; the curved top rail .044 × .052 at z 1.015 … 1.075; the woven panel at
y ≈ .21, z .565 … .965; the cushion top at .58. The sleeve clears all of it:
±.232 lateral at the rail (± .245 at the hem), front face 45 mm in front of the
back plane, rear face 65 mm behind (looser at the hem), crown 1.105; hem .62
at the front (40 mm over the cushion) → .47 behind.
"""
import math
import bmesh
from mathutils import Vector
import wv_lib as L
import _resort as R

NAME = "chair_slipcover"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.45
TRIS = 700
FRONT = "+Z"
ORIGIN = "floor"

L.PALETTE.setdefault("blush", L._hex("d9a3a8"))

YB, BOW, LEG_X = 0.205, 0.028, 0.18
CROWN = 1.105


def _bow_y(x):
    return BOW * (min(abs(x), LEG_X) / LEG_X) ** 2


def _section(z, t):
    """(half-width, front offset, rear offset) of the sleeve at height z;
    t = 0 at the hem … 1 at the crown"""
    hw = 0.245 - 0.013 * t
    fr = 0.050 - 0.006 * t
    rr = 0.080 - 0.018 * t
    return hw, fr, rr


def _sleeve(mat, rnd):
    bm = bmesh.new()
    NU, NV = 16, 6
    P = 4.0                               # superellipse: boxy with soft corners
    ph = rnd.uniform(0, 6.28)
    rows = []
    for j in range(NV):
        t = j / (NV - 1)
        row = []
        for i in range(NU):
            th = 2 * math.pi * i / NU
            c, s = math.cos(th), math.sin(th)
            ex = math.copysign(abs(c) ** (2 / P), c)
            ey = math.copysign(abs(s) ** (2 / P), s)
            # hem height: .62 at the front (s < 0 → −Y, the sitter's side), .47 behind
            z_hem = 0.545 - 0.075 * s
            z_top = 1.045
            z = z_hem + (z_top - z_hem) * t
            hw, fr, rr = _section(z, t)
            x = ex * hw
            y = YB + _bow_y(x) + (ey * (rr if ey > 0 else fr)) + (0.01 if ey > 0 else -0.0)
            # soft vertical folds, growing toward the hem, mostly on the flat faces
            fold = 0.008 * (1 - t) ** 1.4 * math.sin(7 * th + ph)
            nx, ny = ex, ey
            n = Vector((nx, ny, 0)).normalized()
            row.append(bm.verts.new((x + n.x * fold, y + n.y * fold, z)))
        rows.append(row)
    for j in range(NV - 1):
        for i in range(NU):
            i2 = (i + 1) % NU
            bm.faces.new([rows[j][i], rows[j][i2], rows[j + 1][i2], rows[j + 1][i]])
    # the crown: two rounded rows pulling in over the rail, then a ridge fan
    prev = rows[-1]
    for k, (dz, kk) in enumerate(((0.035, 0.80), (0.058, 0.45))):
        ring = []
        for i, v in enumerate(prev):
            co = v.co
            cy = YB + _bow_y(co.x) + 0.012
            ring.append(bm.verts.new((co.x * (0.97 if k == 0 else 0.93), cy + (co.y - cy) * kk, 1.045 + dz)))
        for i in range(NU):
            i2 = (i + 1) % NU
            bm.faces.new([prev[i], prev[i2], ring[i2], ring[i]])
        prev = ring
    top = bm.verts.new((0, YB + 0.012, CROWN))
    for i in range(NU):
        bm.faces.new([prev[i], prev[(i + 1) % NU], top])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = L.from_bmesh("sleeve", bm, (0, 0, 0), mat)
    return o


def _sash(mat):
    """a band round the sleeve at the lumbar: a thin closed tube following the
    sleeve's own section, 60 mm tall, 6 mm proud"""
    bm = bmesh.new()
    NU = 16
    P = 4.0
    rows = []
    for z in (0.705, 0.765):
        t = (z - 0.52) / (1.045 - 0.52)
        hw, fr, rr = _section(z, t)
        ring_o, ring_i = [], []
        for i in range(NU):
            th = 2 * math.pi * i / NU
            c, s = math.cos(th), math.sin(th)
            ex = math.copysign(abs(c) ** (2 / P), c)
            ey = math.copysign(abs(s) ** (2 / P), s)
            for ring, pad in ((ring_o, 0.007), (ring_i, 0.001)):
                x = ex * (hw + pad)
                y = YB + _bow_y(x) + ey * ((rr + 0.01 + pad) if ey > 0 else (fr + pad))
                ring.append(bm.verts.new((x, y, z)))
        rows.append((ring_o, ring_i))
    (o0, i0), (o1, i1) = rows
    for i in range(NU):
        i2 = (i + 1) % NU
        bm.faces.new([o0[i], o0[i2], o1[i2], o1[i]])     # outer face
        bm.faces.new([o0[i], o0[i2], i0[i2], i0[i]])     # bottom edge
        bm.faces.new([o1[i], o1[i2], i1[i2], i1[i]])     # top edge
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return L.from_bmesh("sash", bm, (0, 0, 0), mat)


def _ribbon(name, mat, pts, w):
    """a flat ribbon through `pts`, width w, lying across x — BOTH FACES as
    separate vertices, built raw (from_bmesh would weld and re-orient them)"""
    import bpy
    bm = bmesh.new()
    rows = []
    for k, p in enumerate(pts):
        tw = 0.35 * math.sin(k * 1.3)
        s = (Vector((1, 0, 0)) * math.cos(tw) + Vector((0, 1, 0)) * math.sin(tw)) * (w / 2)
        rows.append((p - s, p + s))
    for flip in (False, True):
        vs = [(bm.verts.new(a), bm.verts.new(b)) for (a, b) in rows]
        for k in range(len(vs) - 1):
            (a0, a1), (b0, b1) = vs[k], vs[k + 1]
            bm.faces.new([a0, b0, b1, a1] if flip else [a0, a1, b1, b0])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(L.M(mat))
    return o


def build():
    rnd = L.rng(NAME)
    linen = R.tex("slip_linen", "linen_ivory.webp", roughness=0.92, fallback="ivory",
                  tint_to="ivory", gain=(0.93, 0.92, 0.90))
    blush = L.M("blush")
    parts = [_sleeve(linen, rnd), _sash(blush)]
    R.metric_uv(parts[0], 0, 2, tile=0.55)
    # the bow at the back centre: two flattened loops and a knot
    yb = YB + 0.080 + 0.018 + 0.012
    zk = 0.735
    knot = L.uv_sphere("knot", 0.022, (0, yb, zk), blush, seg=8, rings=5)
    knot.scale = (1.2, 0.8, 1.1)
    parts.append(knot)
    for sx in (-1, 1):
        lp = L.torus(f"loop{sx}", 0.045, 0.011, (sx * 0.050, yb, zk + 0.006), blush,
                     maj=9, mnr=4, rot=(90, sx * 18, 0))
        lp.scale = (1.0, 0.45, 1.0)
        parts.append(lp)
    # two tails, falling behind the hem with a little swing
    for sx, ln in ((-1, 0.36), (1, 0.30)):
        pts = []
        for k in range(6):
            t = k / 5
            pts.append(Vector((sx * (0.012 + 0.045 * t), yb + 0.004 + 0.018 * t * t, zk - 0.02 - ln * t)))
        parts.append(_ribbon(f"tail{sx}", blush, pts, 0.052 - 0.010 * sx * 0))
    root = L.join(parts, NAME, origin=None)     # the CHAIR's frame
    L.shade_smooth(root, angle=60)
    return root
