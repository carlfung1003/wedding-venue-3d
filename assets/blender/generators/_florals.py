"""_florals — the shared bloom-mass kit for Group B (KAN-207).

Underscore-prefixed, so make_masters.py never runs it as a generator. Imported by
installation_hero / installation_small / fabric_flower / cluster_a|b|c /
centrepiece_low / lilac_cluster.

HOW A MASS IS BUILT

1. A BASE — a closed surface (a leaning teardrop lathe, ellipsoid lobes) that
   carries the sage foliage tile (`foliage_sage.webp`) on a triplanar art UV. It
   is packed over with heads and should never show; where it peeks between two
   heads it reads as the greenery a florist packs between them.
2. HEADS, three classes (the planner's mix, ~40–45 % blue by count):
     hydrangea 0.14–0.20 m — a 3-band dome (8 seg, 40 tris) dimpled by a radial
       jitter, carrying the top-down photograph `hydrangea_head.webp` (and two
       tinted copies: delphinium-deep, mist-pale) planar-projected along its pole;
     garden rose 0.08–0.12 m — a 2-band dome (7 seg, 21 tris), `rose_head.webp`
       and ivory / white tinted copies;
     spray buds 0.05–0.07 m — a 1-band cone (6 seg, 6 tris) in the flat `cream`,
       `ivory`, `white` palette keys.
   Domes are cut just below the equator and stand 0.30 r proud of the base, so
   the rim sits flush and the visible bump is ~1.3 r.
3. Packing is Poisson-disc on the shell with a grid: centre spacing ≥ 0.72·(r1+r2),
   i.e. heads overlap 25–30 %, filled to saturation so the base never shows.
4. FOLIAGE as geometry: eucalyptus sprigs (a 3-sided stem + 5–6 folded six-point
   leaves in `leaf`/`leaf_d`), loose leaves between heads, and delphinium /
   stock SPIKES (a stem + 8 florets: 1-band cones in the flat `delph` / `white` /
   `lilac_2` keys).

Everything goes into ONE bmesh per material and is flushed as one object per
material, so a 40 k-triangle tower joins from ~15 parts, not ~1,500.

ATLAS NOTE (measured through wv_bake's own unwrap): smart_project (66° limit)
splits a 3-band dome into 4 islands, a 2-band into 2, a 1-band cone into 1; the
packer's margins are fixed pixels, so ~4,000 islands on a 1024 atlas leaves ~8 px
per island and the photographs reduce to their average colour, with black at the
inter-island gaps that the bake margin cannot fill at that density (a 60-head
rig bakes 3.6 % black; the towers ~45 %). That is the cost of the packed look
and is paid deliberately: head COLOUR (powder blue / cream / white), dome
geometry and the AO between heads carry the read at guest distance.

Nothing here edits wv_lib / wv_bake: the art UV layer is written directly on the
bmesh under the same name (wv_lib.ART_UV) that image_mat + planar_uv use, so the
bake resolves it identically. One workaround (bake margin_type) is set on the
scene from Mass.__init__ — see there.
"""
import math
import bpy, bmesh
from mathutils import Vector, Quaternion
import wv_lib as L
import wv_bake as B

TEXTURED = {}        # material name -> True if the image loaded (False = flat fallback)

# ---------------------------------------------------------------- atlas repack
# WORKAROUND (wv_bake.unwrap), scoped to Group B's assets and reported.
# Measured on installation_hero (1,461 heads, ~4,000 islands): the library's
# smart_project(island_margin=.015) + pack_islands(margin=.0075) leaves 47.6 % of
# the 1024 atlas BLACK — the packer's fixed margins dominate sub-20-px islands and
# it abandons the top/right eighths (87 % empty), so every head gets ~8 px and
# the bake margin cannot bridge the gaps (margin 8 → 24, EXTEND vs
# ADJACENT_FACES: 0.476 either way). The same islands packed with an ADDITIVE
# 2 px margin bake 5.3 % black. bpy.ops.object.bake() called synchronously never
# fires object_bake_pre (tested), so there is no hook; the only in-file lever is
# to shadow wv_bake.unwrap for objects that carry the `wv_florals` tag — every
# other agent's asset goes straight through to the library's own function.
_LIB_UNWRAP = B.unwrap


def _florals_unwrap(objs, margin=0.015, *args, **kw):
    objs = list(objs)
    if not objs or not all(o.get("wv_florals") for o in objs):
        return _LIB_UNWRAP(objs, margin, *args, **kw)
    for o in objs:
        B._activate_atlas_layer(o.data)
    B.select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    size = max(o.get("wv_atlas", 1024) for o in objs)
    bpy.ops.uv.pack_islands(margin=2.0 / size, margin_method='ADD', rotate=True, scale=True,
                            shape_method='AABB')
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f"FLORALS unwrap: tight repack for {objs[0].name} (2 px additive margin, AABB)")


if getattr(B.unwrap, "__name__", "") != "_florals_unwrap":
    B.unwrap = _florals_unwrap


def tag(root, atlas=1024):
    """Mark a joined floral root for the tight repack above."""
    root["wv_florals"] = 1
    root["wv_atlas"] = atlas
    return root

# ---------------------------------------------------------------- materials
# Image material names are NOT palette keys on purpose: image_mat() caches by name
# in wv_lib._mats, so image_mat("hydrangea", …) would hand every later M("hydrangea")
# the picture (found by the seating agent).
# name -> (file, fallback palette key, (hue_shift, sat_mul, val_mul) or None)
HEAD_MATS = {
    "hyd_head":    ("hydrangea_head.webp", "hydrangea", None),
    "delph_head":  ("hydrangea_head.webp", "delph",     (0.0, 1.30, 0.84)),
    "mist_head":   ("hydrangea_head.webp", "mist",      (0.0, 0.62, 1.08)),
    "rose_cream_tex": ("rose_head.webp",   "cream",     None),
    "rose_ivory_tex": ("rose_head.webp",   "ivory",     (0.0, 0.55, 1.03)),
    "rose_white_tex": ("rose_head.webp",   "white",     (0.0, 0.22, 1.06)),
    "rose_lilac1_tex": ("rose_head.webp",  "lilac_1",   (0.64, 1.30, 0.80)),
    "rose_lilac2_tex": ("rose_head.webp",  "lilac_2",   (0.64, 1.00, 0.92)),
    "rose_lilac3_tex": ("rose_head.webp",  "lilac_3",   (0.64, 0.60, 1.02)),
    "hyd_lilac_tex": ("hydrangea_head.webp", "lilac_2", (0.64, 0.80, 0.95)),
}
# name -> (file, fallback key, hsv tint or None). The base is tinted DOWN so the
# slivers between heads read as the shadowed greenery of a packed mass.
CORE_MATS = {
    "base_sage":   ("foliage_sage.webp",     "leaf_d",    (0.0, 0.85, 0.50)),
    "base_blooms": ("bloom_blue_cream.webp", "hydrangea", None),
    "base_lilac":  ("bloom_lilac.webp",      "lilac_2",   None),
}
# how far across the picture the dome's rim reaches (the photographs have a grey
# margin outside the head — never sample it)
PIC_SPAN = {"hydrangea_head.webp": 0.84, "rose_head.webp": 0.80}
BLUE_KINDS = {"hyd_head", "delph_head", "mist_head", "hyd_lilac_tex"}
ROSE_KINDS = {k for k in HEAD_MATS if k.startswith("rose_")}


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
    fresh = kind not in TEXTURED
    m = L.image_mat(kind, f, roughness=0.86, fallback=fb)
    if m.name == kind:
        if fresh and hsv:
            _tint(m, hsv)
        TEXTURED[kind] = True
    else:
        TEXTURED[kind] = False
    return m


def core_mat(kind):
    f, fb, hsv = CORE_MATS[kind]
    fresh = kind not in TEXTURED
    m = L.image_mat(kind, f, roughness=0.88, fallback=fb)
    if m.name == kind and fresh and hsv:
        _tint(m, hsv)
    TEXTURED[kind] = (m.name == kind)
    return m


# ---------------------------------------------------------------- the builder
class Mass:
    """Accumulates geometry into one bmesh per material; flush() -> objects."""

    def __init__(self, rnd, tag):
        self.rnd = rnd
        self.tag = tag
        self.bms = {}            # mat name -> (bm, uv_base, uv_art, material)
        self.heads = []          # (Vector centre, r) for the Poisson test
        self.grid = {}           # cell -> [indices into heads]
        self.cell = 0.22
        self.tris = 0
        self.top = -1e9          # highest vertex so far (spike clamping)
        # WORKAROUND (wv_bake): the bake margin is left on Blender's default
        # ADJACENT_FACES, which fills an island's margin from the face across each
        # UV seam — a dome's rim has no face across it. EXTEND smears the island's
        # own edge outward instead. The bake runs in the scene build() leaves
        # behind, so it can be set here. (Measured: identical at low island counts,
        # marginal at the towers' ~4,000 islands — the count is the real limit.)
        try:
            bpy.context.scene.render.bake.margin_type = 'EXTEND'
        except Exception as e:
            print("WARN florals: cannot set bake margin_type EXTEND:", e)

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

    def free(self, p, r, overlap=0.72):
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

    def _vert(self, bm, co):
        v = bm.verts.new(co)
        if co.z > self.top:
            self.top = co.z
        return v

    # ----- a photographed head dome
    def head(self, kind, p, n, r, seg=8, bands=3, elev0=-0.28, proud=0.30, dimple=0.0,
             squash=1.0, register=True):
        """A dome of radius r: `bands` latitude rings from elev0 (radians, negative
        = below the equator) to the pole, the pole along n, the centre `proud`·r
        ABOVE the surface point p so the rim (at sin(elev0)·r) sits flush with the
        base. The head photograph is planar-projected along the pole on the art UV."""
        bm, uv0, uva, mat = self._bm(head_mat(kind))
        span = PIC_SPAN.get(HEAD_MATS[kind][0], 0.8)
        rnd = self.rnd
        n = n.normalized()
        q = Vector((0, 0, 1)).rotation_difference(n)
        roll = Quaternion((0, 0, 1), rnd.uniform(0, 2 * math.pi))
        rot = (q @ roll).to_matrix()
        centre = p + n * (proud * r)
        rings = []
        for b in range(bands):
            el = elev0 + (math.pi / 2 - elev0) * b / bands
            ring = []
            for s_ in range(seg):
                a = 2 * math.pi * s_ / seg
                rr = r * (1 + rnd.uniform(-dimple, dimple)) if dimple else r
                lx, ly = math.cos(a) * math.cos(el) * rr, math.sin(a) * math.cos(el) * rr
                lz = math.sin(el) * rr * squash
                v = self._vert(bm, centre + rot @ Vector((lx, ly, lz)))
                ring.append((v, (0.5 + lx / (2 * r) * span, 0.5 + ly / (2 * r) * span)))
            rings.append(ring)
        pz = r * squash * ((1 + rnd.uniform(-dimple, dimple)) if dimple else 1)
        pole = self._vert(bm, centre + rot @ Vector((0, 0, pz)))
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
            for lp, uv in zip(f.loops, (top[s_][1], top[s2][1], (0.5, 0.5))):
                lp[uva].uv = uv
                lp[uv0].uv = uv
            faces += 1
        self.tris += faces
        if register:
            self._register(p, r)
        return centre

    # ----- a flat-key bud / floret: a one-band cone (one atlas island)
    def bud(self, key, p, n, r, seg=6, elev0=0.42, proud=None, register=True):
        bm, uv0, uva, _ = self._bm(L.M(key))
        rnd = self.rnd
        n = n.normalized()
        q = Vector((0, 0, 1)).rotation_difference(n)
        roll = Quaternion((0, 0, 1), rnd.uniform(0, 2 * math.pi))
        rot = (q @ roll).to_matrix()
        if proud is None:
            proud = -math.sin(elev0) + 0.10
        centre = p + n * (proud * r)
        ring = []
        for s_ in range(seg):
            a = 2 * math.pi * s_ / seg
            rr = r * rnd.uniform(0.9, 1.1)
            ring.append(self._vert(bm, centre + rot @ Vector((math.cos(a) * math.cos(elev0) * rr,
                                                              math.sin(a) * math.cos(elev0) * rr,
                                                              math.sin(elev0) * rr))))
        pole = self._vert(bm, centre + rot @ Vector((0, 0, r)))
        for s_ in range(seg):
            f = bm.faces.new((ring[s_], ring[(s_ + 1) % seg], pole))
            for lp in f.loops:
                lp[uva].uv = (0.5, 0.5); lp[uv0].uv = (0.5, 0.5)
        self.tris += seg
        if register:
            self._register(p, r)

    # ----- flat-key geometry
    def _face(self, bm, uv0, uva, verts):
        f = bm.faces.new(verts)
        for lp in f.loops:
            lp[uva].uv = (0.5, 0.5); lp[uv0].uv = (0.5, 0.5)
        self.tris += len(verts) - 2
        return f

    def leaf(self, p, d, up, length, width, mat="leaf", fold=0.35):
        """A eucalyptus leaf: a six-point outline folded along its midrib (two
        quads meeting at the rib, so it has a real crease and a thin edge)."""
        bm, uv0, uva, _ = self._bm(L.M(mat))
        d = d.normalized()
        side = d.cross(up)
        if side.length < 1e-6:
            side = d.cross(Vector((1, 0, 0)))
        side.normalize()
        upn = side.cross(d).normalized()
        w = width / 2
        rib = [p, p + d * (length * 0.5) + upn * (length * 0.08), p + d * length + upn * (length * 0.2)]
        lift = upn * (w * fold)
        l1 = rib[1] + side * w - lift
        r1 = rib[1] - side * w - lift
        l0 = p + d * (length * 0.15) + side * (w * 0.55) - lift * 0.5
        r0 = p + d * (length * 0.15) - side * (w * 0.55) - lift * 0.5
        l2 = p + d * (length * 0.82) + side * (w * 0.6) - lift * 0.7
        r2 = p + d * (length * 0.82) - side * (w * 0.6) - lift * 0.7
        V = {k: self._vert(bm, co) for k, co in
             dict(a=rib[0], m=rib[1], t=rib[2], l0=l0, l1=l1, l2=l2, r0=r0, r1=r1, r2=r2).items()}
        self._face(bm, uv0, uva, (V["a"], V["l0"], V["l1"], V["m"]))
        self._face(bm, uv0, uva, (V["m"], V["l1"], V["l2"], V["t"]))
        self._face(bm, uv0, uva, (V["a"], V["m"], V["r1"], V["r0"]))
        self._face(bm, uv0, uva, (V["m"], V["t"], V["r2"], V["r1"]))

    def stem(self, a, b, r0, r1, mat="leaf_d", n=3):
        """A tapered n-gon tube (no caps) — eucalyptus / delphinium stems."""
        bm, uv0, uva, _ = self._bm(L.M(mat))
        A, Bv = Vector(a), Vector(b)
        d = Bv - A
        if d.length < 1e-6:
            return
        q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
        ra, rb = [], []
        for i in range(n):
            ang = 2 * math.pi * i / n
            off = Vector((math.cos(ang), math.sin(ang), 0))
            ra.append(self._vert(bm, A + q @ (off * r0)))
            rb.append(self._vert(bm, Bv + q @ (off * r1)))
        for i in range(n):
            i2 = (i + 1) % n
            self._face(bm, uv0, uva, (ra[i], ra[i2], rb[i2], rb[i]))

    def sprig(self, p, n, length, leaves=6, leaf_len=0.055, lift=0.6, zmax=None):
        """A eucalyptus sprig out of the shell along n (+ up): a stem with `leaves`
        folded leaves alternating along it and one at the tip."""
        rnd = self.rnd
        n = n.normalized()
        tang = n.cross(Vector((0, 0, 1)))
        if tang.length < 1e-4:
            tang = Vector((1, 0, 0))
        tang.normalize()
        d = (n + Vector((0, 0, lift)) + tang * rnd.uniform(-0.5, 0.5)).normalized()
        if zmax is not None and p.z + d.z * length > zmax:
            length = max(0.08, (zmax - p.z) / max(d.z, 1e-3))
        base = p - n * 0.05
        tip = base + d * length
        self.stem(base, tip, 0.006, 0.003, "leaf_d", n=3)
        for i in range(leaves):
            t = 0.25 + 0.7 * i / max(leaves - 1, 1)
            at = base + d * (length * t)
            s_ = 1 if i % 2 else -1
            ld = (tang * s_ * 0.9 + d * 0.55 + Vector((0, 0, 0.1))).normalized()
            up = (ld.cross(tang) if abs(ld.dot(tang)) < 0.98 else Vector((0, 0, 1))).normalized()
            if up.dot(n) < 0:
                up = -up
            sz = leaf_len * (1.05 - 0.3 * t) * rnd.uniform(0.85, 1.15)
            self.leaf(at, ld, up, sz, sz * 0.8, "leaf" if i % 2 else "leaf_d")
        self.leaf(tip, d, tang, leaf_len * 0.85, leaf_len * 0.65, "leaf")

    def spike(self, p, n, length, key="delph", seg=6, rings=9, r=0.032, zmax=None):
        """A delphinium / stock spire: ONE bumpy tapered lathe (rings of `seg`
        verts with a florets-in-a-spiral radius) on a short stem, standing up out
        of the mass along n (+ up). One connected mesh → a handful of long atlas
        islands, where nine separate florets were sub-pixel islands baking black."""
        rnd = self.rnd
        n = n.normalized()
        d = (n + Vector((0, 0, 1.0))).normalized()
        if zmax is not None and p.z + d.z * length > zmax:
            length = max(0.10, (zmax - p.z) / max(d.z, 1e-3))
        base = p - n * 0.04
        stem_top = base + d * (length * 0.28)
        self.stem(base, stem_top, 0.006, 0.004, "leaf_d", n=3)
        bm, uv0, uva, _ = self._bm(L.M(key))
        q = Vector((0, 0, 1)).rotation_difference(d).to_matrix()
        phase = rnd.uniform(0, 6.28)
        rows = []
        for j in range(rings):
            t = j / (rings - 1)
            rr = r * (1.0 - 0.8 * t) * (1 + 0.45 * math.sin(7.0 * math.pi * t + phase)) + 0.004
            at = stem_top + d * (length * 0.72 * t)
            row = []
            for i in range(seg):
                a = 2 * math.pi * i / seg + 0.5 * t
                row.append(self._vert(bm, at + q @ Vector((math.cos(a) * rr, math.sin(a) * rr, 0))))
            rows.append(row)
        tip = self._vert(bm, stem_top + d * (length * 0.76))
        for j in range(rings - 1):
            A, B = rows[j], rows[j + 1]
            for i in range(seg):
                i2 = (i + 1) % seg
                self._face(bm, uv0, uva, (A[i], A[i2], B[i2], B[i]))
        for i in range(seg):
            self._face(bm, uv0, uva, (rows[-1][i], rows[-1][(i + 1) % seg], tip))

    # ----- bases
    def core_uv(self, bm, uv0, uva, period, offset):
        """Triplanar-lite: per face, project along the dominant normal axis so a
        tile wraps any closed shape without an unwrap."""
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

    def core_ellipsoid(self, mat_kind, centre, radii, seg=16, rings=8, period=0.5, offset=0.0,
                       warp=0.0):
        """A closed ellipsoid base. `warp` adds a low-frequency radial wobble."""
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
                row.append(self._vert(bm, c + Vector((a * math.cos(el) * math.cos(az) * w,
                                                      b * math.cos(el) * math.sin(az) * w,
                                                      cc * math.sin(el) * w))))
            rows.append(row)
        bot = self._vert(bm, c + Vector((0, 0, -cc)))
        top = self._vert(bm, c + Vector((0, 0, cc)))
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
                   period=0.5, offset=0.0, cap_top=True, bump=0.0):
        """A lathe base: for each z in zs, a ring of radius radius_fn(z) (x) ×
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
                row.append(self._vert(bm, Vector((cx + rr * math.cos(az), cy + depth * rr * math.sin(az), z))))
            rows.append(row)
        faces = []
        for j in range(len(rows) - 1):
            A, B = rows[j], rows[j + 1]
            for i in range(seg):
                i2 = (i + 1) % seg
                faces.append(bm.faces.new((A[i], A[i2], B[i2], B[i])))
        if cap_top:
            cx, cy = centre_fn(zs[-1]) if centre_fn else (0.0, 0.0)
            top = self._vert(bm, Vector((cx, cy, zs[-1] + radius_fn(zs[-1]) * 0.5)))
            for i in range(seg):
                i2 = (i + 1) % seg
                faces.append(bm.faces.new((rows[-1][i], rows[-1][i2], top)))
        bm.normal_update()
        self.core_uv(bm, uv0, uva, period, offset)
        self.tris += sum(len(f.verts) - 2 for f in faces)


# ---------------------------------------------------------------- mixes
def pick(rnd, table):
    tot = sum(w for w, _ in table)
    x = rnd.uniform(0, tot)
    for w, v in table:
        x -= w
        if x <= 0:
            return v
    return table[-1][1]


# By head COUNT. Blue ≈ 42 %; the hydrangea heads are the big ones, so by area
# the blue lands near the renders' half-and-half.
MIX_BLUE_CREAM = [
    (23, "hyd_head"), (6, "delph_head"), (6, "mist_head"),
    (15, "rose_cream_tex"), (12, "rose_ivory_tex"), (9, "rose_white_tex"),
    (10, "bud:cream"), (10, "bud:ivory"), (9, "bud:white"),
]
MIX_LILAC = [
    (14, "rose_lilac1_tex"), (14, "rose_lilac2_tex"), (10, "rose_lilac3_tex"), (12, "hyd_lilac_tex"),
    (12, "rose_white_tex"), (8, "rose_cream_tex"),
    (10, "bud:white"), (10, "bud:lilac_3"), (10, "bud:lilac_2"),
]


def head_size(rnd, kind, scale=1.0):
    """Radii: hydrangea 0.14–0.20 m heads, garden rose 0.08–0.12, spray buds
    0.05–0.07 (the coordinator's classes)."""
    if kind in ("hyd_head",):
        r = rnd.uniform(0.090, 0.125)
    elif kind in BLUE_KINDS:
        r = rnd.uniform(0.075, 0.105)
    elif kind.startswith("bud:"):
        r = rnd.uniform(0.030, 0.042)
    elif kind.startswith("rose_lilac"):
        r = rnd.uniform(0.048, 0.068)
    else:
        r = rnd.uniform(0.050, 0.070)
    return r * scale


def place_heads(mass, sampler, max_heads, mix=MIX_BLUE_CREAM, scale=1.0, detail=1.0,
                attempts=60000, overlap=0.66, accept=None, scale_at=None, zmax=None):
    """Poisson-fill a shell with up to `max_heads` heads. `sampler(rnd) -> (p, n)`
    or None; `accept(p, n, r)` can veto (inside another lobe); `scale_at(p)`
    scales the head size by position (smaller toward a plume)."""
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
        if zmax is not None and p.z + r * 1.4 > zmax:
            continue
        if not mass.free(p, r, overlap):
            continue
        tilt = Vector((rnd.uniform(-0.22, 0.22), rnd.uniform(-0.22, 0.22), rnd.uniform(-0.22, 0.22)))
        nn = (n.normalized() + tilt).normalized()
        if kind.startswith("bud:"):
            mass.bud(kind[4:], p, nn, r, seg=6)
        elif kind in BLUE_KINDS:
            seg = 10 if detail >= 1.2 else 8
            mass.head(kind, p, nn, r, seg=seg, bands=3, dimple=0.07, squash=0.95)
        else:
            seg = 8 if detail >= 1.2 else 7
            mass.head(kind, p, nn, r, seg=seg, bands=2, dimple=0.03, squash=0.85)
        placed += 1
    return placed


def scatter_leaves(mass, sampler, count, size=0.06, zmax=None):
    """Loose eucalyptus leaves poking out between the heads."""
    rnd = mass.rnd
    for i in range(count):
        s = sampler(rnd)
        if s is None:
            continue
        p, n = s
        n = n.normalized()
        tang = n.cross(Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))).normalized()
        d = (tang + n * 1.1 + Vector((0, 0, 0.25))).normalized()
        sz = size * rnd.uniform(0.75, 1.3)
        if zmax is not None and p.z + d.z * sz > zmax:
            continue
        up = n.cross(tang).normalized()
        mass.leaf(p + n * 0.02, d, up, sz, sz * 0.75, "leaf" if i % 2 else "leaf_d")


# ---------------------------------------------------------------- samplers
def ellipsoid_sampler(centre, radii, zmin_n=-0.35):
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


def outside_all(tests, own=None, zmin=0.02):
    """accept(p, n, r): the point is outside every lobe but its own."""
    def f(p, n, r):
        if p.z < zmin:
            return False
        for g in tests:
            if g is own:
                continue
            if g(p):
                return False
        return True
    return f


def report(mass, name):
    tex = ", ".join(f"{k}={'img' if v else 'FLAT'}" for k, v in sorted(TEXTURED.items()))
    print(f"FLORALS {name}: heads {len(mass.heads)} tris {mass.tris} top {mass.top:.3f}  textures [{tex}]")


def finish(mass, name, origin="floor", atlas=1024):
    """flush → join → origin. 'axis' = the authored (0,0) at the lowest vertex
    (the towers: the wing must not drag a bbox origin sideways); 'floor' = bbox
    footprint centre at the lowest vertex; None = leave as authored."""
    parts = mass.flush()
    root = L.join(parts, name, origin=None)
    if origin == "axis":
        zmin = min(v.co.z for v in root.data.vertices)
        L.origin_to(root, (0, 0, zmin))
    elif origin == "floor":
        L._origin_to_bbox(root, z="min")
    L.shade_smooth(root, angle=60)
    return tag(root, atlas)


# ---------------------------------------------------------------- lobes helper
def lobes(mass, spec, mat="base_sage", period=0.5):
    """spec = [((cx, cy, cz), (rx, ry, rz)), …] → ellipsoid bases + samplers + inside tests."""
    samplers, tests = [], []
    for i, (c, r) in enumerate(spec):
        mass.core_ellipsoid(mat, c, r, seg=16, rings=8, period=period, offset=0.11 * i, warp=0.05)
        samplers.append(ellipsoid_sampler(c, r, zmin_n=-0.3))
        tests.append(inside_ellipsoid(c, r, 0.94))
    return samplers, tests


# ---------------------------------------------------------------- the towers
def build_installation(name, h, W, lean, side, heads, sprigs=32, spikes=16, detail=1.0):
    """One of the two asymmetric towers (ASSET_SPEC Group B).

    h      total height (plume tip);  W  the teardrop's foot radius (.78 / .64)
    lean   crown drift over the height, x = lean·t²  (+.62 hero, −.58 small)
    side   which way the chest-height wing spills (+1 / −1)
    The profile is moments.js installation(): w(t) = (1 − .8·t^1.35)·W + .10 on
    z(t) = .26 + t·(h − .34), depth ×.78; the skirt r .92 × .78 at z .24; the wing
    a spill of heads over five tapering lobes from x .55 → 1.50 at z 1.55 → .80.
    Origin = the tower's AXIS at the foot (the wing would drag a bbox origin
    ~.45 m sideways).
    """
    rnd = L.rng(name)
    m = Mass(rnd, name)
    zs0, zs1 = 0.06, h - 0.20
    zt = lambda z: max(0.0, min(1.0, (z - 0.26) / (h - 0.34)))
    radius = lambda z: (1 - 0.8 * zt(z) ** 1.35) * W + 0.10 * (W / 0.78)
    drift = lambda z: (lean * zt(z) ** 2, 0.0)
    zs = [zs0 + (zs1 - zs0) * i / 36 for i in range(37)]
    m.core_lathe("base_sage", zs, radius, drift, seg=22, depth=0.78, period=0.5, offset=0.13, bump=0.04)
    skirt_c, skirt_r = (0.0, 0.0, 0.24), (0.92, 0.78, 0.22)
    m.core_ellipsoid("base_sage", skirt_c, skirt_r, seg=20, rings=6, period=0.5, offset=0.41, warp=0.06)
    wing = []
    for i in range(5):
        t = i / 4
        c = (side * (0.55 + t * 0.95), -0.08 + rnd.uniform(-0.10, 0.10),
             1.55 - t * 0.75 + rnd.uniform(-0.04, 0.06))
        r = (0.40 - 0.12 * t, 0.36 - 0.10 * t, 0.30 - 0.10 * t)
        wing.append((c, r))
        m.core_ellipsoid("base_sage", c, r, seg=12, rings=6, period=0.5, offset=0.2 + 0.17 * i, warp=0.05)

    in_lathe = inside_lathe(zs0, zs1, radius, drift, 0.78, shrink=0.94)
    in_skirt = inside_ellipsoid(skirt_c, skirt_r, 0.94)
    in_wing = [inside_ellipsoid(c, r, 0.94) for c, r in wing]
    tests = [in_lathe, in_skirt] + in_wing
    lathe_s = lathe_sampler(zs0, zs1, radius, drift, 0.78)
    skirt_s = ellipsoid_sampler(skirt_c, skirt_r, zmin_n=-0.15)
    wing_s = [ellipsoid_sampler(c, r, zmin_n=-0.5) for c, r in wing]

    shell_area = 2 * math.pi * 0.89 * sum(radius(z) for z in zs) / len(zs) * (zs1 - zs0)
    wing_area = sum(4 * math.pi * ((r[0] * r[1] * r[2]) ** (2 / 3)) * 0.55 for _, r in wing)
    total = shell_area + 3.2 + wing_area
    plume = lambda p: 1.0 - 0.35 * max(0.0, zt(p.z) - 0.55) / 0.45
    zcap = h - 0.02
    OV = 0.57      # centre spacing ≥ 0.57·(r1+r2): heads interpenetrate as a packed mass
    place_heads(m, lathe_s, int(heads * shell_area / total), accept=outside_all(tests, in_lathe),
                scale_at=plume, zmax=zcap, detail=detail, overlap=OV)
    place_heads(m, skirt_s, int(heads * 3.2 / total), accept=outside_all(tests, in_skirt), scale=1.0,
                detail=detail, overlap=OV)
    for (c, r), ws, iw in zip(wing, wing_s, in_wing):
        a = 4 * math.pi * ((r[0] * r[1] * r[2]) ** (2 / 3)) * 0.55
        place_heads(m, ws, int(heads * a / total), accept=outside_all(tests, iw), scale=0.95, detail=detail, overlap=OV)

    # eucalyptus sprigs breaking the silhouette (t .35 → 1.0 up the tower + the wing)
    def upper(rnd):
        s = lathe_s(rnd)
        if s is None or zt(s[0].z) < 0.35:
            return None
        return s
    for i in range(sprigs):
        s = None
        for _ in range(60):
            s = upper(rnd) if i < sprigs - 8 else wing_s[i % 5](rnd)
            if s:
                break
        if s:
            p, n = s
            m.sprig(p, n, rnd.uniform(0.22, 0.40), leaves=4, leaf_len=0.085, zmax=zcap)
    # delphinium at the plume, standing up out of the crown
    top_c = Vector((drift(zs1)[0], 0, zs1))
    for i in range(spikes):
        if i < 7:
            a = rnd.uniform(0, 2 * math.pi)
            p = top_c + Vector((math.cos(a) * radius(zs1) * 0.5, math.sin(a) * radius(zs1) * 0.4, 0.02))
            n = Vector((math.cos(a) * 0.3, math.sin(a) * 0.3, 1)).normalized()
            m.spike(p, n, rnd.uniform(0.26, 0.36), zmax=zcap)
        else:
            s = None
            for _ in range(60):
                s = upper(rnd)
                if s and zt(s[0].z) > 0.6:
                    break
            if s:
                p, n = s
                m.spike(p, n, rnd.uniform(0.22, 0.32), zmax=zcap)
    scatter_leaves(m, union_sampler([(lathe_s, 6), (skirt_s, 2), (wing_s[2], 1)]), 50, size=0.09, zmax=zcap)
    report(m, name)
    return finish(m, name, origin="axis")


# ---------------------------------------------------------------- the clusters
def build_cluster(name, spec, heads, sprigs=9, spikes=4, mix=MIX_BLUE_CREAM, scale=0.85,
                  zmax=None, base="base_sage", origin="floor", detail=1.0, leaves=30,
                  spike_keys=("delph",), spike_len=(0.24, 0.34), spike_zmax=None):
    """A ground cluster / centrepiece-style mass over ellipsoid `spec` lobes.
    `zmax` clamps the heads and sprigs (the spec's H), `spike_zmax` the spikes
    (a florist lets a few delphinium stand above the mass)."""
    rnd = L.rng(name)
    m = Mass(rnd, name)
    samplers, tests = lobes(m, spec, mat=base)
    areas = [4 * math.pi * ((r[0] * r[1] * r[2]) ** (2 / 3)) for _, r in spec]
    total = sum(areas)
    for smp, tst, a in zip(samplers, tests, areas):
        place_heads(m, smp, int(heads * a / total), mix=mix, scale=scale, detail=detail,
                    accept=outside_all(tests, tst, zmin=0.0), zmax=zmax)
    union = union_sampler([(smp, a) for smp, a in zip(samplers, areas)])
    for i in range(sprigs):
        s = None
        for _ in range(40):
            s = union(rnd)
            if s and s[1].z > -0.1:
                break
        if s:
            m.sprig(s[0], s[1], rnd.uniform(0.16, 0.28), leaves=rnd.randint(4, 6), leaf_len=0.05, zmax=zmax)
    for i in range(spikes):
        s = None
        for _ in range(40):
            s = union(rnd)
            if s and s[1].z > 0.35:
                break
        if s:
            m.spike(s[0], s[1], rnd.uniform(*spike_len), key=spike_keys[i % len(spike_keys)], r=0.026,
                    zmax=spike_zmax or zmax)
    scatter_leaves(m, union, leaves, size=0.055, zmax=zmax)
    report(m, name)
    return finish(m, name, origin=origin, atlas=512)
