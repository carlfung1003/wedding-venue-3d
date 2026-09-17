"""_florals — the shared bloom-mass builder for Group B (KAN-207).

Underscore-prefixed, so make_masters.py never runs it as a generator. Imported by
installation_hero / installation_small / fabric_flower / cluster_a|b|c /
centrepiece_low / lilac_cluster.

HOW A MASS IS BUILT (and why it reads as a florist's work, not a ball pit)

1. A CORE — a closed surface (a leaning teardrop lathe, an ellipsoid) carrying one
   of the packed-bloom tiles (`bloom_blue_cream.webp` …) through a triplanar art
   UV. It is what a guest sees BETWEEN the heads, so gaps in the packing read as
   "more blooms behind" instead of as holes.
2. HEADS — low-poly DOMES (a sphere cut below its equator) sat on the core with
   their pole along the surface normal, ~30 % of the radius proud of it. Each dome
   carries a top-down photograph of a real head (`hydrangea_head.webp`,
   `rose_head.webp`) planar-projected along its pole, so the guest sees the head
   face-on. Tinted copies of the two photographs give delphinium / mist / ivory /
   white / lilac without new files. Hydrangea domes are dimpled by a radial
   jitter; roses are slightly oblate.
3. Packing is Poisson-disc on the shell with a grid: heads of two size classes
   overlap 20–28 %, so the silhouette is lumpy and the AO bake has crevices.
4. FOLIAGE — flat sage leaves (a diamond quad; the export is doubleSided) and
   eucalyptus SPRIGS (a stalk + leaves) pushed out through the shell; DELPHINIUM
   spikes (a tapered stalk + small florets) for the plume.

Everything goes into ONE bmesh per material and is flushed as one object per
material, so a 40 k-triangle tower joins from ~12 parts, not ~900.

Nothing here touches wv_lib / wv_bake: the art UV layer is written directly on
the bmesh (same layer name wv_lib.ART_UV, so the bake resolves it exactly as it
would for image_mat + planar_uv).
"""
import math
import bpy, bmesh
from mathutils import Vector, Quaternion, Matrix
import wv_lib as L

TEXTURED = {}        # material name -> True if the image loaded (False = flat fallback)

# ---------------------------------------------------------------- materials
# name -> (file, fallback palette key, (hue_shift, sat_mul, val_mul) or None)
HEAD_MATS = {
    "hydrangea":  ("hydrangea_head.webp", "hydrangea", None),
    "delph":      ("hydrangea_head.webp", "delph",     (0.0, 1.35, 0.80)),
    "mist":       ("hydrangea_head.webp", "mist",      (0.0, 0.62, 1.10)),
    "rose_cream": ("rose_head.webp",      "cream",     None),
    "rose_ivory": ("rose_head.webp",      "ivory",     (0.0, 0.55, 1.03)),
    "rose_white": ("rose_head.webp",      "white",     (0.0, 0.22, 1.06)),
    "rose_lilac1": ("rose_head.webp",     "lilac_1",   (0.64, 1.30, 0.78)),
    "rose_lilac2": ("rose_head.webp",     "lilac_2",   (0.64, 1.00, 0.92)),
    "rose_lilac3": ("rose_head.webp",     "lilac_3",   (0.64, 0.60, 1.02)),
    "hyd_lilac":  ("hydrangea_head.webp", "lilac_2",   (0.64, 0.80, 0.95)),
}
CORE_MATS = {
    "core_blue_cream": ("bloom_blue_cream.webp", "hydrangea"),
    "core_blue":       ("bloom_blue.webp",       "hydrangea"),
    "core_cream":      ("bloom_cream.webp",      "cream"),
    "core_lilac":      ("bloom_lilac.webp",      "lilac_2"),
    "core_sage":       ("foliage_sage.webp",     "leaf"),
}
# how far across the picture the dome's rim reaches (the photographs have a grey
# margin outside the head — never sample it)
PIC_SPAN = {"hydrangea_head.webp": 0.84, "rose_head.webp": 0.80}


def _tint(m, hsv):
    """Insert an HSV node between the image and the BSDF of an image_mat material."""
    nt = m.node_tree
    tex = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.name != "_bake"), None)
    bsdf = nt.nodes.get("Principled BSDF")
    if tex is None or bsdf is None:
        return
    hsvn = nt.nodes.new("ShaderNodeHueSaturation")
    hsvn.location = (-250, 200)
    h, s, v = hsv
    hsvn.inputs["Hue"].default_value = 0.5 + h
    hsvn.inputs["Saturation"].default_value = s
    hsvn.inputs["Value"].default_value = v
    for lk in list(nt.links):
        if lk.from_node == tex and lk.to_socket == bsdf.inputs["Base Color"]:
            nt.links.remove(lk)
    nt.links.new(tex.outputs["Color"], hsvn.inputs["Color"])
    nt.links.new(hsvn.outputs["Color"], bsdf.inputs["Base Color"])


def head_mat(kind):
    f, fb, hsv = HEAD_MATS[kind]
    m = L.image_mat(kind, f, roughness=0.86, fallback=fb)
    ok = m.name == kind and m.get("wv_family") == "bloom" and m.name not in TEXTURED
    if ok:
        TEXTURED[kind] = True
        if hsv:
            _tint(m, hsv)
    elif m.name != kind:
        TEXTURED[kind] = False
    return m


def core_mat(kind):
    f, fb = CORE_MATS[kind]
    m = L.image_mat(kind, f, roughness=0.88, fallback=fb)
    TEXTURED[kind] = (m.name == kind)
    return m


# ---------------------------------------------------------------- the builder
class Mass:
    """Accumulates geometry into one bmesh per material; flush() -> objects."""

    def __init__(self, rnd, tag):
        self.rnd = rnd
        self.tag = tag
        # WORKAROUND (wv_bake): the bake margin is left on Blender's default
        # ADJACENT_FACES, which fills an island's margin from the face across each
        # UV seam — a head cap's rim has no face across it, so 45 % of a floral
        # atlas baked BLACK between islands and mips blended it into every head.
        # The bake runs in the scene build() leaves behind, so set EXTEND here.
        try:
            bpy.context.scene.render.bake.margin_type = 'EXTEND'
        except Exception as e:      # older Blender without margin_type: nothing to do
            print("WARN florals: cannot set bake margin_type EXTEND:", e)
        self.bms = {}            # mat name -> (bm, uv_base, uv_art, material)
        self.heads = []          # (Vector centre, r) for the Poisson test
        self.grid = {}           # cell -> [indices into heads]
        self.cell = 0.22
        self.tris = 0

    # ----- bmesh per material
    def _bm(self, mat):
        key = mat.name
        if key not in self.bms:
            bm = bmesh.new()
            uv0 = bm.loops.layers.uv.new("UVMap")
            uva = bm.loops.layers.uv.new(L.ART_UV)
            self.bms[key] = (bm, uv0, uva, mat)
        return self.bms[key]

    def flush(self):
        parts = []
        for key, (bm, uv0, uva, mat) in self.bms.items():
            bm.normal_update()
            me = bpy.data.meshes.new(f"{self.tag}_{key}")
            bm.to_mesh(me)
            bm.free()
            me.uv_layers.active = me.uv_layers["UVMap"]
            o = bpy.data.objects.new(me.name, me)
            bpy.context.collection.objects.link(o)
            o.data.materials.append(mat)
            parts.append(o)
        self.bms = {}
        return parts

    # ----- Poisson grid
    def _cells(self, p):
        c = self.cell
        return (int(math.floor(p.x / c)), int(math.floor(p.y / c)), int(math.floor(p.z / c)))

    def free(self, p, r, overlap=0.78):
        cx, cy, cz = self._cells(p)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for i in self.grid.get((cx + dx, cy + dy, cz + dz), ()):
                        q, rq = self.heads[i]
                        if (q - p).length < (r + rq) * overlap:
                            return False
        return True

    def _register(self, p, r):
        self.heads.append((p.copy(), r))
        self.grid.setdefault(self._cells(p), []).append(len(self.heads) - 1)

    # ----- a photographed head CAP
    def head(self, kind, p, n, r, seg=8, bands=1, elev0=0.48, dimple=0.0, squash=1.0,
             embed=None, register=True):
        """A spherical CAP of radius r whose pole lies along n, its centre `embed`·r
        below the surface point p (default sin(elev0): the rim sits flush with the
        core; the visible mound is r·(1 − sin elev0) ≈ 0.54 r).

        ONE BAND ON PURPOSE. wv_bake's smart_project splits an island wherever two
        face normals differ by > 66°; measured through the real unwrap: a 3-band
        cap → 4 islands, 2-band → 2, a 1-band cone from 0.48 rad → 1. Multi-island
        heads put the island seam (and its black margin) at the head's CENTRE.
        A single-band cone smooth-shaded reads as a low mound at any guest
        distance, and costs `seg` triangles."""
        bm, uv0, uva, mat = self._bm(head_mat(kind))
        span = PIC_SPAN.get(HEAD_MATS[kind][0], 0.8)
        rnd = self.rnd
        n = n.normalized()
        q = Vector((0, 0, 1)).rotation_difference(n)
        roll = Quaternion((0, 0, 1), rnd.uniform(0, 2 * math.pi))
        rot = (q @ roll).to_matrix()
        if embed is None:
            embed = math.sin(elev0)
        centre = p - n * (embed * r)
        rings = []
        for b in range(bands):
            el = elev0 + (math.pi / 2 - elev0) * b / bands
            ring = []
            for s_ in range(seg):
                a = 2 * math.pi * s_ / seg
                rr = r * (1 + rnd.uniform(-dimple, dimple)) if dimple else r
                lx, ly = math.cos(a) * math.cos(el) * rr, math.sin(a) * math.cos(el) * rr
                lz = math.sin(el) * rr * squash
                v = bm.verts.new(centre + rot @ Vector((lx, ly, lz)))
                ring.append((v, (0.5 + lx / (2 * r) * span, 0.5 + ly / (2 * r) * span)))
            rings.append(ring)
        pz = r * squash * ((1 + rnd.uniform(-dimple, dimple)) if dimple else 1)
        pole = bm.verts.new(centre + rot @ Vector((0, 0, pz)))
        pole_uv = (0.5, 0.5)
        faces = 0
        for b in range(bands - 1):
            A, B = rings[b], rings[b + 1]
            for s_ in range(seg):
                s2 = (s_ + 1) % seg
                f = bm.faces.new((A[s_][0], A[s2][0], B[s2][0], B[s_][0]))
                for lp, uv in zip(f.loops, (A[s_][1], A[s2][1], B[s2][1], B[s_][1])):
                    lp[uva].uv = uv
                    lp[uv0].uv = uv
                faces += 2
        top = rings[-1]
        for s_ in range(seg):
            s2 = (s_ + 1) % seg
            f = bm.faces.new((top[s_][0], top[s2][0], pole))
            for lp, uv in zip(f.loops, (top[s_][1], top[s2][1], pole_uv)):
                lp[uva].uv = uv
                lp[uv0].uv = uv
            faces += 1
        self.tris += faces
        if register:
            self._register(p, r)
        return centre

    # ----- a textured KITE: one quad carrying a random patch of a tile. Used for
    # eucalyptus sprays (foliage_sage) and delphinium/stock spires (bloom tiles):
    # at guest distance a 12 cm photographed patch reads as a spray; a 4 cm flat
    # leaf is a sub-pixel atlas island and bakes black.
    def kite(self, mat_kind, p, d, up, length, width, patch=0.28, bend=0.2, taper=0.45):
        bm, uv0, uva, _ = self._bm(core_mat(mat_kind))
        rnd = self.rnd
        d = d.normalized()
        side = d.cross(up)
        if side.length < 1e-6:
            side = d.cross(Vector((1, 0, 0)))
        side.normalize()
        upn = side.cross(d).normalized()
        a = p
        b = p + d * (length * taper) + side * (width / 2) + upn * (bend * width * 0.3)
        c = p + d * length + upn * (bend * length * 0.35)
        e = p + d * (length * taper) - side * (width / 2) + upn * (bend * width * 0.3)
        u0, v0 = rnd.uniform(0, 1 - patch), rnd.uniform(0, 1 - patch)
        uvs = ((u0 + patch * 0.5, v0), (u0 + patch, v0 + patch * taper),
               (u0 + patch * 0.5, v0 + patch), (u0, v0 + patch * taper))
        vs = [bm.verts.new(x) for x in (a, b, c, e)]
        f = bm.faces.new(vs)
        for lp, uv in zip(f.loops, uvs):
            lp[uva].uv = uv
            lp[uv0].uv = uv
        self.tris += 2

    # ----- flat palette parts (leaves, stalks): art uv = 0
    def _quad(self, mat, pts, uv=None):
        bm, uv0, uva, _ = self._bm(L.M(mat))
        vs = [bm.verts.new(p) for p in pts]
        f = bm.faces.new(vs)
        for i, lp in enumerate(f.loops):
            lp[uva].uv = uv[i] if uv else (0.5, 0.5)
            lp[uv0].uv = uv[i] if uv else (0.5, 0.5)
        self.tris += len(pts) - 2

    def leaf(self, p, d, up, length, width, mat="leaf", bend=0.25):
        """A diamond leaf from p along unit d, `up` gives the blade's facing."""
        d = d.normalized()
        side = d.cross(up).normalized()
        if side.length < 1e-6:
            side = d.cross(Vector((1, 0, 0))).normalized()
        upn = side.cross(d).normalized()
        a = p
        b = p + d * (length * 0.45) + side * (width / 2) + upn * (bend * width * 0.3)
        c = p + d * length + upn * (bend * length * 0.35)
        e = p + d * (length * 0.45) - side * (width / 2) + upn * (bend * width * 0.3)
        self._quad(mat, (a, b, c, e))

    def stalk(self, a, b, r0, r1, mat="leaf_d", n=4):
        """A stem from a to b: ONE thin blade (the export is doubleSided), so it is
        one atlas island of `r0` width rather than n sub-pixel ones that bake black."""
        bm, uv0, uva, _ = self._bm(L.M(mat))
        A, Bv = Vector(a), Vector(b)
        d = Bv - A
        if d.length < 1e-6:
            return
        side = d.normalized().cross(Vector((0, 0, 1)))
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        vs = [bm.verts.new(A + side * r0), bm.verts.new(Bv + side * r1),
              bm.verts.new(Bv - side * r1), bm.verts.new(A - side * r0)]
        f = bm.faces.new(vs)
        for lp in f.loops:
            lp[uva].uv = (0.5, 0.5); lp[uv0].uv = (0.5, 0.5)
        self.tris += 2

    def sprig(self, p, n, length, sprays=3, spray=0.13, lift=0.55):
        """A eucalyptus sprig: a thin stalk out of the shell along n (+ up) with
        2–3 photographed foliage kites hung off it, the last at the tip."""
        rnd = self.rnd
        n = n.normalized()
        tang = n.cross(Vector((0, 0, 1)))
        if tang.length < 1e-4:
            tang = Vector((1, 0, 0))
        tang.normalize()
        d = (n + Vector((0, 0, lift)) + tang * rnd.uniform(-0.5, 0.5)).normalized()
        base = p - n * 0.05
        tip = base + d * length
        self.stalk(base, tip, 0.006, 0.003, "leaf_d", n=3)
        for i in range(sprays):
            t = 0.35 + 0.65 * i / max(sprays - 1, 1)
            at = base + d * (length * t)
            s_ = 1 if i % 2 else -1
            ld = (tang * s_ * 0.8 + d * 0.7 + Vector((0, 0, 0.15))).normalized()
            up = (ld.cross(tang) if abs(ld.dot(tang)) < 0.98 else Vector((0, 0, 1))).normalized()
            sz = spray * rnd.uniform(0.8, 1.25)
            self.kite("core_sage", at, ld, up, sz, sz * 0.7, bend=0.25)

    def spike(self, p, n, length, mat_kind="core_blue", width=None, stalk=True):
        """A delphinium / stock spire: two crossed elongated kites carrying a bloom
        tile, on a thin stalk, standing up out of the mass along n (+ up)."""
        rnd = self.rnd
        n = n.normalized()
        d = (n + Vector((0, 0, 0.9))).normalized()
        base = p - n * 0.04
        tip = base + d * length
        if stalk:
            self.stalk(base, tip, 0.006, 0.0025, "leaf_d", n=3)
        w = width or length * 0.26
        t0 = d.cross(Vector((math.cos(rnd.uniform(0, 6.28)), math.sin(rnd.uniform(0, 6.28)), 0.1))).normalized()
        t1 = d.cross(t0).normalized()
        start = base + d * (length * 0.18)
        for up in (t0, t1):
            self.kite(mat_kind, start, d, up, length * 0.86, w, patch=0.22, bend=0.05, taper=0.4)

    # ----- cores
    def core_uv(self, bm, uv0, uva, period, offset):
        """Triplanar-lite: per face, project along the dominant normal axis so a
        bloom tile wraps any closed shape without an unwrap."""
        for f in bm.faces:
            nx, ny, nz = (abs(c) for c in f.normal)
            for lp in f.loops:
                c = lp.vert.co
                if nz >= nx and nz >= ny:
                    uv = (c.x / period + offset, c.y / period + offset)
                elif nx >= ny:
                    uv = (c.y / period + offset, c.z / period + offset)
                else:
                    uv = (c.x / period + offset, c.z / period + offset)
                lp[uva].uv = uv
                lp[uv0].uv = uv

    def core_ellipsoid(self, mat_kind, centre, radii, seg=16, rings=8, period=0.6, offset=0.0,
                       warp=0.0):
        """A closed ellipsoid core. `warp` adds a low-frequency radial wobble."""
        bm, uv0, uva, mat = self._bm(core_mat(mat_kind))
        c = Vector(centre)
        a, b, cc = radii
        rnd = self.rnd
        rows = []
        for j in range(1, rings):
            el = -math.pi / 2 + math.pi * j / rings
            row = []
            for i in range(seg):
                az = 2 * math.pi * i / seg
                w = 1 + (warp * math.sin(3 * az + 2 * el + rnd.uniform(-0.3, 0.3)) if warp else 0)
                row.append(bm.verts.new(c + Vector((a * math.cos(el) * math.cos(az) * w,
                                                    b * math.cos(el) * math.sin(az) * w,
                                                    cc * math.sin(el) * w))))
            rows.append(row)
        bot = bm.verts.new(c + Vector((0, 0, -cc)))
        top = bm.verts.new(c + Vector((0, 0, cc)))
        faces = []
        for j in range(len(rows) - 1):
            A, B = rows[j], rows[j + 1]
            for i in range(seg):
                i2 = (i + 1) % seg
                faces.append(bm.faces.new((A[i], A[i2], B[i2], B[i])))
        for i in range(seg):
            i2 = (i + 1) % seg
            faces.append(bm.faces.new((rows[0][i2], rows[0][i], bot)))
            faces.append(bm.faces.new((rows[-1][i], rows[-1][i2], top)))
        bm.normal_update()
        self.core_uv(bm, uv0, uva, period, offset)
        self.tris += sum(len(f.verts) - 2 for f in faces)

    def core_lathe(self, mat_kind, zs, radius_fn, centre_fn=None, seg=24, depth=0.78,
                   period=0.6, offset=0.0, cap_top=True, bump=0.0):
        """A lathe core: for each z in zs, a ring of radius radius_fn(z) (x) ×
        depth·radius (y) centred at centre_fn(z) (an (x, y) drift). Open at the
        bottom (it stands in a skirt), capped at the top."""
        bm, uv0, uva, mat = self._bm(core_mat(mat_kind))
        rows = []
        for z in zs:
            r = radius_fn(z)
            cx, cy = centre_fn(z) if centre_fn else (0.0, 0.0)
            row = []
            for i in range(seg):
                az = 2 * math.pi * i / seg
                rr = r * (1 + bump * (math.sin(5.0 * az + 7.0 * z) * 0.6 + math.sin(11.0 * az - 4.0 * z) * 0.4)) if bump else r
                row.append(bm.verts.new(Vector((cx + rr * math.cos(az), cy + depth * rr * math.sin(az), z))))
            rows.append(row)
        faces = []
        for j in range(len(rows) - 1):
            A, B = rows[j], rows[j + 1]
            for i in range(seg):
                i2 = (i + 1) % seg
                faces.append(bm.faces.new((A[i], A[i2], B[i2], B[i])))
        if cap_top:
            cx, cy = centre_fn(zs[-1]) if centre_fn else (0.0, 0.0)
            top = bm.verts.new(Vector((cx, cy, zs[-1] + radius_fn(zs[-1]) * 0.5)))
            for i in range(seg):
                i2 = (i + 1) % seg
                faces.append(bm.faces.new((rows[-1][i], rows[-1][i2], top)))
        bm.normal_update()
        self.core_uv(bm, uv0, uva, period, offset)
        self.tris += sum(len(f.verts) - 2 for f in faces)


# ---------------------------------------------------------------- mixes
def pick(rnd, table):
    """table = [(weight, value), ...]"""
    tot = sum(w for w, _ in table)
    x = rnd.uniform(0, tot)
    for w, v in table:
        x -= w
        if x <= 0:
            return v
    return table[-1][1]


# The planner's mix, by HEAD COUNT. Hydrangea heads are ~3× the area of a rose,
# so ~24 % blue heads gives the ~45 % blue AREA the renders read.
MIX_BLUE_CREAM = [
    (16, "hydrangea"), (4, "delph"), (5, "mist"),
    (34, "rose_cream"), (22, "rose_ivory"), (19, "rose_white"),
]
MIX_LILAC = [
    (20, "rose_lilac1"), (18, "rose_lilac2"), (14, "rose_lilac3"), (10, "hyd_lilac"),
    (22, "rose_white"), (16, "rose_cream"),
]
BLUE_KINDS = {"hydrangea", "delph", "mist", "hyd_lilac"}


def head_size(rnd, kind, scale=1.0):
    """Cap radii. Real heads: hydrangea 18–25 cm, garden rose 10–14 cm, spray
    rose / ranunculus 7–10 cm."""
    if kind in ("hydrangea",):
        r = rnd.uniform(0.100, 0.150)
    elif kind in ("delph", "mist", "hyd_lilac"):
        r = rnd.uniform(0.085, 0.120)
    elif kind == "rose_white":
        r = rnd.uniform(0.050, 0.066)
    elif kind.startswith("rose_lilac"):
        r = rnd.uniform(0.060, 0.080)
    else:
        r = rnd.uniform(0.064, 0.086)
    return r * scale


def head_poly(kind, r, detail=1.0):
    """(seg, bands): one-band cones (see Mass.head). `detail` ≥ 1.2 buys rounder
    rims on the big blue heads (the centrepiece, where a guest sits)."""
    if kind in BLUE_KINDS:
        return (10, 1) if detail >= 1.2 else (8, 1)
    return (8, 1) if detail >= 1.2 else (7, 1)


def place_heads(mass, sampler, max_heads, mix=MIX_BLUE_CREAM, scale=1.0, detail=1.0,
                attempts=30000, overlap=0.66, accept=None, scale_at=None):
    """Poisson-fill a shell with up to `max_heads` heads. `sampler(rnd) -> (p, n)`
    or None; `accept(p, n, r)` can veto (e.g. inside another core); `scale_at(p)`
    scales the head size by position (smaller toward a plume).

    The budget is a COUNT, not triangles: heads are 7–10 tris each, and what runs
    out first is the ATLAS — every head is one island, and ~700 islands on a
    1024 atlas leaves ~24 px per head (the packer's margins are fixed pixels)."""
    rnd = mass.rnd
    placed = 0
    for _ in range(attempts):
        if placed >= max_heads:
            break
        s = sampler(rnd)
        if s is None:
            continue
        p, n = s
        kind = pick(rnd, mix)
        r = head_size(rnd, kind, scale * (scale_at(p) if scale_at else 1.0))
        if accept and not accept(p, n, r):
            continue
        if not mass.free(p, r, overlap):
            continue
        seg, bands = head_poly(kind, r, detail)
        dimple = 0.07 if kind in BLUE_KINDS else 0.03
        squash = 1.0 if kind in BLUE_KINDS else 0.80
        tilt = Vector((rnd.uniform(-0.22, 0.22), rnd.uniform(-0.22, 0.22), rnd.uniform(-0.22, 0.22)))
        mass.head(kind, p, (n.normalized() + tilt).normalized(), r, seg=seg, bands=bands,
                  dimple=dimple, squash=squash)
        placed += 1
    return placed


def scatter_foliage(mass, sampler, count, size=0.12):
    """Foliage kites tucked between the heads, leaning out of the shell."""
    rnd = mass.rnd
    for i in range(count):
        s = sampler(rnd)
        if s is None:
            continue
        p, n = s
        n = n.normalized()
        tang = n.cross(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))).normalized()
        d = (tang + n * 0.9 + Vector((0, 0, 0.25))).normalized()
        up = n.cross(tang).normalized()
        sz = size * rnd.uniform(0.75, 1.3)
        mass.kite("core_sage", p - n * 0.02, d, up, sz, sz * 0.75, bend=0.3)


# ---------------------------------------------------------------- samplers
def ellipsoid_sampler(centre, radii, zmin_n=-0.35):
    """Uniform-ish points on an ellipsoid shell with outward normals; skips the
    underside (normal z below zmin_n)."""
    c = Vector(centre)
    a, b, cc = radii

    def s(rnd):
        u = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
        if u.length < 1e-6:
            return None
        u.normalize()
        p = c + Vector((a * u.x, b * u.y, cc * u.z))
        n = Vector((u.x / a, u.y / b, u.z / cc)).normalized()
        if n.z < zmin_n:
            return None
        return p, n
    return s


def lathe_sampler(z0, z1, radius_fn, centre_fn=None, depth=0.78, rmax=None):
    """Points on a lathe shell, density ∝ perimeter."""
    rmax = rmax or max(radius_fn(z0 + (z1 - z0) * i / 40) for i in range(41))

    def s(rnd):
        z = rnd.uniform(z0, z1)
        r = radius_fn(z)
        if rnd.uniform(0, rmax) > r:
            return None
        az = rnd.uniform(0, 2 * math.pi)
        cx, cy = centre_fn(z) if centre_fn else (0.0, 0.0)
        p = Vector((cx + r * math.cos(az), cy + depth * r * math.sin(az), z))
        dz = 0.02
        r2 = radius_fn(min(z + dz, z1)); r1 = radius_fn(max(z - dz, z0))
        slope = (r2 - r1) / (2 * dz)
        cx2, cy2 = centre_fn(min(z + dz, z1)) if centre_fn else (0.0, 0.0)
        cx1, cy1 = centre_fn(max(z - dz, z0)) if centre_fn else (0.0, 0.0)
        drift = Vector(((cx2 - cx1) / (2 * dz), (cy2 - cy1) / (2 * dz), 0))
        radial = Vector((math.cos(az), math.sin(az) / depth, 0)).normalized()
        n = (radial - Vector((0, 0, slope + radial.dot(drift)))).normalized()
        return p, n
    return s


def union_sampler(samplers_weights):
    tot = sum(w for _, w in samplers_weights)

    def s(rnd):
        x = rnd.uniform(0, tot)
        for smp, w in samplers_weights:
            x -= w
            if x <= 0:
                return smp(rnd)
        return samplers_weights[-1][0](rnd)
    return s


def inside_ellipsoid(centre, radii, shrink=0.92):
    c = Vector(centre)
    a, b, cc = radii

    def f(p):
        d = p - c
        return (d.x / a) ** 2 + (d.y / b) ** 2 + (d.z / cc) ** 2 < shrink ** 2
    return f


def inside_lathe(z0, z1, radius_fn, centre_fn=None, depth=0.78, shrink=0.92):
    def f(p):
        if p.z < z0 or p.z > z1:
            return False
        cx, cy = centre_fn(p.z) if centre_fn else (0.0, 0.0)
        r = radius_fn(p.z) * shrink
        if r <= 0:
            return False
        return ((p.x - cx) / r) ** 2 + ((p.y - cy) / (depth * r)) ** 2 < 1.0
    return f


def report(mass, name):
    tex = ", ".join(f"{k}={'img' if v else 'FLAT'}" for k, v in sorted(TEXTURED.items()))
    print(f"FLORALS {name}: heads {len(mass.heads)} tris {mass.tris}  textures [{tex}]")


# ---------------------------------------------------------------- the towers
def build_installation(name, h, W, lean, side, heads, sprigs=22, spikes=14):
    """One of the two asymmetric towers (ASSET_SPEC Group B).

    h      total height (the plume tip);  W  the teardrop's foot radius (.78 / .64)
    lean   crown drift over the height, x = lean·t²  (+.62 hero, −.58 small)
    side   which way the chest-height wing spills (+1 / −1)
    The profile is moments.js installation(): w(t) = (1 − .8·t^1.35)·W + .10 on
    z(t) = .26 + t·(h − .34), depth ×.78; the skirt r .92 × .78 at z .24; the wing
    five masses from x .55 → 1.50 at z 1.55 → .80. Origin = the tower's AXIS at
    the foot (not the bbox centre — the wing would drag that sideways).
    """
    rnd = L.rng(name)
    m = Mass(rnd, name)
    zs0, zs1 = 0.06, h - 0.16
    zt = lambda z: max(0.0, min(1.0, (z - 0.26) / (h - 0.34)))
    radius = lambda z: (1 - 0.8 * zt(z) ** 1.35) * W + 0.10 * (W / 0.78)
    drift = lambda z: (lean * zt(z) ** 2, 0.0)
    zs = [zs0 + (zs1 - zs0) * i / 56 for i in range(57)]
    m.core_lathe("core_blue_cream", zs, radius, drift, seg=32, depth=0.78, period=0.62, offset=0.13, bump=0.05)
    skirt_c, skirt_r = (0.0, 0.0, 0.24), (0.92, 0.78, 0.22)
    m.core_ellipsoid("core_blue_cream", skirt_c, skirt_r, seg=28, rings=10, period=0.62, offset=0.41, warp=0.06)
    wing = []
    for i in range(5):
        t = i / 4
        c = (side * (0.55 + t * 0.95), -0.10 + rnd.uniform(-0.12, 0.12), 1.55 - t * 0.75 + rnd.uniform(-0.05, 0.08))
        r = (0.34, 0.30, 0.22)
        wing.append((c, r))
        m.core_ellipsoid("core_blue_cream", c, r, seg=16, rings=8, period=0.62, offset=0.2 + 0.17 * i, warp=0.05)

    in_lathe = inside_lathe(zs0, zs1, radius, drift, 0.78, shrink=0.94)
    in_skirt = inside_ellipsoid(skirt_c, skirt_r, 0.94)
    in_wing = [inside_ellipsoid(c, r, 0.94) for c, r in wing]

    def accept(p, n, r):
        if in_lathe(p) or in_skirt(p):
            return False
        for f in in_wing:
            if f(p):
                return False
        return p.z > 0.02
    # a sampler that is only "outside every core": each core's own test is skipped
    lathe_s = lathe_sampler(zs0, zs1, radius, drift, 0.78)
    skirt_s = ellipsoid_sampler(skirt_c, skirt_r, zmin_n=-0.15)
    wing_s = [ellipsoid_sampler(c, r, zmin_n=-0.45) for c, r in wing]

    def accept_from(own):
        def f(p, n, r):
            if p.z < 0.02:
                return False
            for g in ([in_lathe, in_skirt] + in_wing):
                if g is own:
                    continue
                if g(p):
                    return False
            return True
        return f
    shell_area = 2 * math.pi * 0.89 * sum(radius(z) for z in zs) / len(zs) * (zs1 - zs0)
    total = shell_area + 3.2 + 5 * 1.0
    plume = lambda p: 1.0 - 0.35 * max(0.0, zt(p.z) - 0.55) / 0.45
    place_heads(m, lathe_s, int(heads * shell_area / total), accept=accept_from(in_lathe), scale_at=plume)
    place_heads(m, skirt_s, int(heads * 3.2 / total), accept=accept_from(in_skirt), scale=1.05)
    for ws, iw in zip(wing_s, in_wing):
        place_heads(m, ws, int(heads * 1.0 / total), accept=accept_from(iw), scale=0.95)

    # the eucalyptus sprigs breaking the silhouette (t .40 → 1.0 up the tower)
    def upper(rnd):
        s = lathe_s(rnd)
        if s is None or zt(s[0].z) < 0.40:
            return None
        return s
    for i in range(sprigs):
        s = None
        for _ in range(50):
            s = upper(rnd) if i < sprigs - 4 else wing_s[i % 5](rnd)
            if s:
                break
        if s:
            p, n = s
            m.sprig(p, n, rnd.uniform(0.24, 0.42), sprays=rnd.randint(2, 3), spray=0.14)
    # delphinium at the plume, standing up out of the crown
    top_c = Vector((drift(zs1)[0], 0, zs1))
    for i in range(spikes):
        if i < 6:
            a = rnd.uniform(0, 2 * math.pi)
            p = top_c + Vector((math.cos(a) * radius(zs1) * 0.5, math.sin(a) * radius(zs1) * 0.4, 0.0))
            n = Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)).normalized()
            m.spike(p, n, min(rnd.uniform(0.28, 0.38), h - p.z - 0.02))
        else:
            s = None
            for _ in range(50):
                s = upper(rnd)
                if s and zt(s[0].z) > 0.62:
                    break
            if s:
                p, n = s
                ln = min(rnd.uniform(0.24, 0.36), h - p.z - 0.02)
                if ln > 0.12:
                    m.spike(p, n, ln)
    scatter_foliage(m, union_sampler([(lathe_s, 6), (skirt_s, 2), (wing_s[2], 1)]), 70, size=0.13)

    report(m, name)
    parts = m.flush()
    root = L.join(parts, name, origin=None)
    zmin = min(v.co.z for v in root.data.vertices)
    L.origin_to(root, (0, 0, zmin))
    L.shade_smooth(root, angle=60)
    return root
