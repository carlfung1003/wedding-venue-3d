"""Shared helpers for The Big Day's Blender asset scripts (headless Blender 5.2).

Ported from seventh-floor's sf_lib.py on 2026-09-15 (KAN-207). Same pipeline
shape, a different world: a beach wedding at the Westin Sanya — clean linen,
pale oak, powder-blue hydrangea — instead of a 1960s resettlement estate. The
grime families are gone; everything else is the contract seventh-floor proved.

THE CONTRACT IS assets/blender/ASSET_SPEC.md — read it before writing a generator.

Conventions
- Blender is Z-up while modelling; the GLB export is Y-up, so Three.js sees
  Blender (x, y, z) as (x, z, -y). Model an asset's FRONT facing Blender +Y and
  it arrives facing glTF -Z, which is how every extras prop in moments.js is
  authored ("at the origin facing -Z"). The chair family faces Blender -Y
  (glTF +Z) — the one exception, declared with FRONT = "+Z".
- Origin. Floor-standing / table-top: footprint centre, z = 0 at the foot
  (join(..., origin="floor") — the default). Hanging: the hook, the object
  hangs down -Z (join(..., origin="hook")). Anything else: origin_to().
- 1 Blender unit = 1 metre = 1 Three.js unit. Real size; the game scales only
  the rows the spec marks *unit*.
- ONE GLB = ONE MESH = ONE MATERIAL. wv_bake collapses every part to a single
  baked albedo×AO atlas. A part that needs a different material CLASS (an
  emissive facia, a tintable canopy, mirror tiles) is its own asset via
  build_<suffix>() -> <NAME>_<suffix>.
- Colours are authored as display sRGB in PALETTE and converted to linear in
  M(). Writing sRGB straight into a socket ships pastel, washed-out GLBs.
- Deterministic: rng(NAME) gives a seeded random.Random; never random.random().
"""
import bpy, bmesh, math, os, random, zlib
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT_DIR = os.path.join(ROOT, "assets", "models")
PREVIEW_DIR = os.path.join(ROOT, "assets", "previews")
MASTERS = os.path.join(HERE, "masters")
TEX_GEN = os.path.join(HERE, "textures", "gen")     # generated WebP textures (other agent)


def _hex(h):
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# The planner's palette (Rosa Wed 蔷薇婚礼), display sRGB, from ASSET_SPEC.md,
# which read it off moments.js PAL + its material table. Keys are what
# generators pass as `mat`; the bake's FAMILY table (wv_bake.py) decides the
# surface finish per key.
# ---------------------------------------------------------------------------
PALETTE = {
    # timber
    "oak":        _hex("c3a37c"),   # cross-back chairs, long tables — light, grey-warm, NOT orange
    "oak_d":      _hex("a88a66"),   # chair/table shadows, hat-rack posts
    "oak_easel":  _hex("d6c09a"),   # the menu easel's legs
    "pine_1":     _hex("e0cba4"),   # the round bar's boards
    "pine_2":     _hex("d6bd92"),
    "pine_3":     _hex("dcc59c"),
    "pine_4":     _hex("d0b788"),
    "bar_top":    _hex("b59a6c"),   # the round bar's plank top
    # cloth
    "ivory":      _hex("f6ecd8"),   # linen tops, ivory cloth
    "linen":      _hex("f7f3e9"),   # linen skirts
    "chiffon":    _hex("faf7f0"),   # chair drapes, fabric streamers
    "sky":        _hex("a2c2e4"),   # the fabric flower
    "sky_d":      _hex("88add6"),
    "teal":       _hex("1f8fa5"),   # the clubhouse teal (moments.js `teal`) — reference only:
                                    # parasol canopies are modelled WHITE as `canopy_tint`
    "canopy_tint": (1.0, 1.0, 1.0), # pure white: the game multiplies an instance colour in
    "label":      _hex("f2ead8"),   # plain paper bottle labels (no text, ever)
    # blooms + foliage (the procedural fallback when textures/gen is missing)
    "cream":      _hex("ecd7ae"),   # the champagne garden rose
    "white":      _hex("fdfbf6"),   # white blooms
    "hydrangea":  _hex("92b8de"),   # powder-blue hydrangea — the signature
    "delph":      _hex("7099c9"),   # delphinium, the deeper blue
    "mist":       _hex("bcd3ea"),   # palest blue
    "lilac_1":    _hex("8f6fb5"),   # the bar's lavender cluster
    "lilac_2":    _hex("b391cc"),
    "lilac_3":    _hex("cbb4de"),
    "leaf":       _hex("94ae87"),   # pale sage foliage
    "leaf_d":     _hex("74906b"),
    # painted + stone
    "paint_w":    _hex("fcfbf7"),   # white painted counters, frames, plinths, carts
    "flute":      _hex("efe2d4"),   # fluted plinths
    "flute_d":    _hex("ece0d2"),
    "stone":      _hex("dfe4e8"),   # the welcome board
    "dark":       _hex("33302b"),   # poles
    "dj_dark":    _hex("2b2a26"),   # the DJ booth
    "straw_band": _hex("352f28"),   # hat bands
    # beads + glass
    "pearl":      _hex("f5efe2"),
    "crystal":    _hex("e8f0f6"),   # crystal beads (glossy; faint blue emissive added in game)
    "glass_pale": _hex("dfeef0"),   # frosted coupes, dispensers — OPAQUE
    "mirror":     _hex("e6e9ec"),   # mirror-ball tiles (metallic 1, rough .12)
    "bottle_green": _hex("3d5c3f"), "bottle_amber": _hex("8a5a28"), "bottle_clear": _hex("cdd6da"),
    "bottle_red":   _hex("7c3a2d"), "bottle_blue":  _hex("33506e"), "bottle_gold":  _hex("9c8144"),
    # metal
    "steel":      _hex("9aa1a6"),   # galvanised wheelbarrow, tripods
    "steel_l":    _hex("aab1b6"),
    "bronze_d":   _hex("2e2a26"),   # chandelier poles, dark steel
    "gold":       _hex("d8bd80"),   # favour boxes
    # straw
    "straw":      _hex("dcbd90"),
    "straw_d":    _hex("d2b083"),
    # fruit + wax
    "coconut":    _hex("7e9a52"),   # young green coconuts
    "coconut_cut": _hex("c4bf95"),  # their cut flat tops
    "candle":     _hex("f7f1e4"),   # taper wax
    # emissive — the loader keeps `*_emit` materials glowing (see js/models.js)
    "bulb":       _hex("fff0cf"),   # warm white festoon/candle glow (moments.js `bulb`)
    "bulb_emit":  _hex("fff0cf"),
    "flame_emit": _hex("ffcf87"),   # candle flames (candelabra_flames)
    "facia_emit": _hex("f6efe0"),   # the DJ booth's ivory-white facia glow
}
EMISSIVE = {"bulb": 2.2, "bulb_emit": 2.2, "flame_emit": 3.0, "facia_emit": 1.6}
# (metallic, roughness) for real metal; everything else is a dielectric.
METALLIC = {
    "steel": (0.8, 0.35), "steel_l": (0.8, 0.35), "bronze_d": (0.7, 0.40),
    "gold": (0.55, 0.35), "mirror": (1.0, 0.12), "crystal": (0.1, 0.08),
}
# Roughness per key; anything not listed is matte 0.88.
ROUGH = {
    "crystal": 0.08, "mirror": 0.12, "glass_pale": 0.15, "pearl": 0.30,
    "bottle_green": 0.12, "bottle_amber": 0.12, "bottle_clear": 0.12,
    "bottle_red": 0.12, "bottle_blue": 0.12, "bottle_gold": 0.12,
    "paint_w": 0.50, "candle": 0.50, "stone": 0.60, "dark": 0.60, "dj_dark": 0.70,
    "coconut": 0.60, "oak": 0.72, "oak_d": 0.72, "oak_easel": 0.72, "bar_top": 0.70,
    "pine_1": 0.75, "pine_2": 0.75, "pine_3": 0.75, "pine_4": 0.75,
    "canopy_tint": 0.70, "teal": 0.85, "leaf": 0.80, "leaf_d": 0.80, "label": 0.80,
    "flute": 0.82, "flute_d": 0.82, "straw": 0.85, "straw_d": 0.85, "white": 0.85,
    "cream": 0.85, "chiffon": 0.96,
}
GLOSSY = {k for k, v in ROUGH.items() if v <= 0.30}

_mats = {}


def srgb_to_linear(c):
    """PALETTE values are display (sRGB); Blender sockets and glTF baseColorFactor are
    scene-linear. Skipping this ships everything washed out."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rng(name):
    """The generator's PRNG, seeded from the asset name — same asset, same model."""
    return random.Random(zlib.crc32(name.encode("utf-8")))


def M(key):
    """Get/create the shared material for a palette key (or pass a Material through)."""
    if hasattr(key, "node_tree"):      # already a Material — e.g. from image_mat()
        return key
    if key in _mats and _mats[key].name in bpy.data.materials:
        return _mats[key]
    existing = bpy.data.materials.get(key)   # detail scripts run inside an opened master
    if existing is not None:
        _mats[key] = existing
        return existing
    if key not in PALETTE:
        raise KeyError(f"wv_lib.M: {key!r} is not a PALETTE key (see ASSET_SPEC.md)")
    r, g, b = (srgb_to_linear(c) for c in PALETTE[key])
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = ROUGH.get(key, 0.88)
    if key in METALLIC:
        bsdf.inputs["Metallic"].default_value = METALLIC[key][0]
        bsdf.inputs["Roughness"].default_value = METALLIC[key][1]
    if key in EMISSIVE:
        bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
        bsdf.inputs["Emission Strength"].default_value = EMISSIVE[key]
        m["wv_family"] = "emit"
    m.diffuse_color = (r, g, b, 1.0)         # Workbench preview colour (else it renders grey)
    m["wv_key"] = key
    _mats[key] = m
    return m


# ---------------------------------------------------------------- scene mgmt
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()


def _finish(obj, name, mat, rot=(0, 0, 0)):
    obj.name = name
    obj.rotation_euler = tuple(math.radians(a) for a in rot)
    if mat:
        obj.data.materials.append(M(mat))
    return obj


# ---------------------------------------------------------------- primitives
def box(name, size, pos, mat, rot=(0, 0, 0)):
    """Axis-aligned box. size=(sx,sy,sz), pos = centre."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=pos)
    o = bpy.context.object
    o.scale = size
    return _finish(o, name, mat, rot)


def cyl(name, r, h, pos, mat, n=16, rot=(0, 0, 0), r2=None):
    """Cylinder (or truncated cone when r2 is given). pos = centre."""
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=h, location=pos)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=r2, depth=h, location=pos)
    return _finish(bpy.context.object, name, mat, rot)


def tube(name, r_out, r_in, h, pos, mat, n=16, rot=(0, 0, 0)):
    """Hollow pipe -- dispenser bodies, bucket rims, lamp housings, parasol ferrules."""
    bm = bmesh.new()
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        ring, nxt = [], []
        for (rr, zz) in ((r_out, -h / 2), (r_out, h / 2), (r_in, h / 2), (r_in, -h / 2)):
            ring.append((math.cos(a0) * rr, math.sin(a0) * rr, zz))
            nxt.append((math.cos(a1) * rr, math.sin(a1) * rr, zz))
        v0 = [bm.verts.new(p) for p in ring]
        v1 = [bm.verts.new(p) for p in nxt]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new([v0[k], v1[k], v1[k2], v0[k2]])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = pos
    return _finish(o, name, mat, rot)


def cone(name, r, h, pos, mat, n=16, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=n, radius1=r, radius2=0.0, depth=h, location=pos)
    return _finish(bpy.context.object, name, mat, rot)


def sphere(name, r, pos, mat, sub=2, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=pos)
    return _finish(bpy.context.object, name, mat, rot)


def uv_sphere(name, r, pos, mat, seg=12, rings=8, rot=(0, 0, 0)):
    """UV sphere — for bloom heads that take spherical_uv(); the pole/seam layout is
    what a head texture expects, where an icosphere's is not."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r, location=pos)
    return _finish(bpy.context.object, name, mat, rot)


def torus(name, R, r, pos, mat, maj=20, mnr=8, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(location=pos, major_radius=R, minor_radius=r,
                                     major_segments=maj, minor_segments=mnr)
    return _finish(bpy.context.object, name, mat, rot)


def plane(name, size, pos, mat, rot=(0, 0, 0)):
    """Flat quad in the XY plane (size=(sx,sy)). For cloth panels, petals, platters."""
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=pos)
    o = bpy.context.object
    o.scale = (size[0], size[1], 1.0)
    return _finish(o, name, mat, rot)


def lathe(name, profile, pos, mat, n=24, rot=(0, 0, 0)):
    """Solid of revolution around Z from [(radius, z), ...] -- vases, bowls, coupes,
    bottles, dispensers, finials. Profile is bottom-to-top."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            ring.append(bm.verts.new((math.cos(a) * max(r, 1e-5), math.sin(a) * max(r, 1e-5), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            try:
                bm.faces.new([a[i], a[i2], b[i2], b[i]])
            except ValueError:
                pass
    for ring, flip in ((rings[0], True), (rings[-1], False)):
        try:
            bm.faces.new(ring[::-1] if flip else ring)
        except ValueError:
            pass
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = pos
    _orient_normals(o)
    return _finish(o, name, mat, rot)


def strut(name, a, b, r, mat, n=8):
    """Cylinder between two points -- legs, rails, rods, bead strands, arch tubes."""
    A, B = Vector(a), Vector(b)
    d = B - A
    L = d.length or 1e-4
    bpy.ops.mesh.primitive_cylinder_add(vertices=n, radius=r, depth=L, location=(A + B) / 2)
    o = bpy.context.object
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.name = name
    o.data.materials.append(M(mat))
    return o


def bar(name, a, b, w, t, mat):
    """Flat stock spanning two points -- the chair's X members, braces, straps."""
    A, B = Vector(a), Vector(b)
    d = B - A
    ln = d.length or 1e-4
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(A + B) / 2)
    o = bpy.context.object
    o.scale = (w, t, ln)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.name = name
    o.data.materials.append(M(mat))
    return o


def prism(name, pts, thick, pos, mat, rot=(0, 0, 0)):
    """Extrude a 2D polygon [(x,y), ...] along +Z by `thick`. Scalloped valances,
    brackets, easel boards, petal outlines."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for (x, y) in pts]
    f = bm.faces.new(vs)
    bm.faces.ensure_lookup_table()
    ret = bmesh.ops.extrude_face_region(bm, geom=[f])
    moved = [e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=moved, vec=(0, 0, thick))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = pos
    _orient_normals(o)
    return _finish(o, name, mat, rot)


def from_bmesh(name, bm, pos, mat, rot=(0, 0, 0)):
    """Wrap a hand-built bmesh as an object (fluted drums, scalloped canopies)."""
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    o.location = pos
    _orient_normals(o)
    return _finish(o, name, mat, rot)


def _orient_normals(o):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def empty(name, pos=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(o)
    o.location = pos
    return o


def parent(children, root):
    """Parent while keeping world transforms. Forces a depsgraph update first: right
    after a primitive op the object's matrix_world is stale and scale would be lost."""
    bpy.context.view_layer.update()
    for c in children:
        mw = c.matrix_world.copy()
        c.parent = root
        c.matrix_world = mw
    bpy.context.view_layer.update()


# ---------------------------------------------------------------- modifiers
def bevel(objs, width=0.004, segments=2, angle=40, min_size=0.02):
    """Edge bevels are the strongest 'this was modelled' cue on furniture a guest
    stands next to — they catch the low sun along every edge. They also ~4x the
    face count, so: per asset (BEVEL in the generator), never on cloth, florals or
    beads, and tiny parts are skipped (they are a few pixels on screen)."""
    for o in objs if isinstance(objs, (list, tuple)) else [objs]:
        if o.type != 'MESH':
            continue
        dd = [d for d in o.dimensions if d > 1e-4]
        if not dd or min(dd) < min_size:
            continue
        w = min(width, 0.22 * min(dd))
        if w < 0.0015:
            continue
        m = o.modifiers.new("Bevel", 'BEVEL')
        m.width = w; m.segments = segments
        m.limit_method = 'ANGLE'; m.angle_limit = math.radians(angle)
        m.use_clamp_overlap = True; m.miter_outer = 'MITER_ARC'
        m.harden_normals = False
        bpy.context.view_layer.objects.active = o
        try:
            bpy.ops.object.modifier_apply(modifier=m.name)
        except RuntimeError:
            o.modifiers.remove(m)


def solidify(o, thickness, offset=-1.0):
    m = o.modifiers.new("Solidify", 'SOLIDIFY')
    m.thickness = thickness; m.offset = offset
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def subdivide(o, levels=1, simple=False):
    if levels < 1:
        return          # Blender disables a 0-level subsurf, and apply then raises
    m = o.modifiers.new("Subsurf", 'SUBSURF')
    m.levels = m.render_levels = levels
    m.subdivision_type = 'SIMPLE' if simple else 'CATMULL_CLARK'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def displace_noise(o, strength=0.01, scale=6.0, seed=1, subdiv=2):
    """Break a dead-flat face with a little surface noise -- cloth folds, a linen
    skirt's pleats, a bloom head's dimples. Subdivides first so the displacement
    has vertices to move."""
    subdivide(o, levels=subdiv, simple=True)
    tex = bpy.data.textures.new(f"_disp{seed}", 'CLOUDS')
    tex.noise_scale = 1.0 / max(scale, 1e-3)
    tex.noise_depth = 2
    m = o.modifiers.new("Displace", 'DISPLACE')
    m.texture = tex; m.strength = strength; m.mid_level = 0.5
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def jitter(o, amount, rnd, axis=(1, 1, 1)):
    """Randomly nudge vertices -- petals, ribbon, sagging cloth. Takes the
    generator's own rng(NAME) so the result is deterministic."""
    for v in o.data.vertices:
        v.co += Vector((rnd.uniform(-amount, amount) * axis[0],
                        rnd.uniform(-amount, amount) * axis[1],
                        rnd.uniform(-amount, amount) * axis[2]))


def array_along(o, count, offset, use_relative=False):
    m = o.modifiers.new("Array", 'ARRAY')
    m.count = count
    m.use_relative_offset = use_relative
    m.use_constant_offset = not use_relative
    m.constant_offset_displace = offset
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)


def boolean(target, cutter, op='DIFFERENCE'):
    """Cut a real hole -- a chair's X halved at the crossing, a bowl's hollow, a
    dispenser's tap hole. A modelled hole beats a dark texture patch."""
    m = target.modifiers.new("Bool", 'BOOLEAN')
    m.object = cutter; m.operation = op; m.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    try:
        bpy.ops.object.modifier_apply(modifier=m.name)
    except RuntimeError:
        target.modifiers.remove(m)
    bpy.data.objects.remove(cutter, do_unlink=True)


def shade_smooth(objs, angle=35):
    """Smooth shading with sharp edges kept above `angle` (Blender 4.1+/5.x
    operator; the old SMOOTH_BY_ANGLE modifier enum is gone in 5.2)."""
    objs = [o for o in (objs if isinstance(objs, (list, tuple)) else [objs]) if o.type == 'MESH']
    if not objs:
        return
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle), keep_sharp_edges=True)


# ---------------------------------------------------------------------------
# Generated artwork as a model texture.
#
# Bloom heads, foliage, the straw weave, the gold foil, the galvanised pan: those
# read as flat slabs however well the carcass is modelled, so a generator can hang a
# generated picture (assets/blender/textures/gen/*.webp, produced by another agent)
# on a part. The picture samples a SECOND uv layer ("art"), not the default one:
# wv_bake.unwrap() smart-projects the whole asset into an atlas layout and would
# destroy any careful projection if the texture read the active layer. The art
# layer is written before the bake, survives it untouched, and the bake resolves
# the picture into the atlas. (A baked model cannot take a new texture afterwards.)
#
# A missing texture NEVER fails the build: image_mat() prints a WARN and returns the
# flat palette material instead — textures/gen may still be empty while this runs.
# ---------------------------------------------------------------------------
ART_UV = "art"


def image_mat(name, filename, roughness=0.62, uv_layer=ART_UV, fallback=None):
    """Material whose base colour is an image from assets/blender/textures/gen/.
    `fallback` is the PALETTE key used when the file is missing (default: `name` if
    it is a palette key, else "white")."""
    if name in _mats and _mats[name].name in bpy.data.materials:
        return _mats[name]
    existing = bpy.data.materials.get(name)
    if existing is not None:
        _mats[name] = existing
        return existing
    path = filename if os.path.isabs(filename) else os.path.join(TEX_GEN, filename)
    if not os.path.exists(path):
        fb = fallback or (name if name in PALETTE else "white")
        print(f"WARN image_mat({name!r}): {path} missing — falling back to flat palette {fb!r}")
        return M(fb)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    img = bpy.data.images.load(path, check_existing=True)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.location = (-500, 200)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = uv_layer
    uv.location = (-750, 200)
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (0.8, 0.8, 0.8, 1.0)
    # wv_bake.finish() rewires Base Color from a procedural graph, which would cut the
    # image loose. The picture is the finish; opt out.
    m["wv_finished"] = 1
    m["wv_key"] = name
    m["wv_family"] = "bloom"
    _mats[name] = m
    return m


def _art_layer(me, layer):
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    was_active = me.uv_layers.active
    uvl = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    return uvl, was_active


def _restore_active(me, was_active):
    # smart_project writes to whichever layer is active; put the original back or the
    # atlas unwrap lands on top of the artwork projection.
    if was_active is not None:
        me.uv_layers.active = was_active


def planar_uv(o, u_axis=0, v_axis=2, layer=ART_UV, flip_u=False, flip_v=False):
    """Planar-project an object's local bounds into 0..1 on its own uv layer.

    Axes are indices into the local coordinate: 0=x, 1=y, 2=z. The default projects
    the front elevation (x across, z up) — a hanging cloth, a board face, a label.
    """
    me = o.data
    uvl, was_active = _art_layer(me, layer)
    co = [v.co for v in me.vertices]
    us = [c[u_axis] for c in co]
    vs = [c[v_axis] for c in co]
    u0, u1 = min(us), max(us)
    v0, v1 = min(vs), max(vs)
    du = (u1 - u0) or 1.0
    dv = (v1 - v0) or 1.0
    for poly in me.polygons:
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            u = (c[u_axis] - u0) / du
            v = (c[v_axis] - v0) / dv
            uvl.data[li].uv = (1.0 - u if flip_u else u, 1.0 - v if flip_v else v)
    _restore_active(me, was_active)
    return uvl


def cylindrical_uv(o, layer=ART_UV, axis=2, repeat=1.0, v_from_height=True):
    """Wrap a texture around an object's axis: u = angle, v = height — bar boards,
    bottles, the straw hat's crown, the dispenser. The seam (u wrapping 1 -> 0) is
    at the BACK (-Y), the side a guest does not see."""
    me = o.data
    uvl, was_active = _art_layer(me, layer)
    a0, a1 = (0, 1) if axis == 2 else ((1, 2) if axis == 0 else (0, 2))
    hs = [v.co[axis] for v in me.vertices]
    h0, h1 = min(hs), max(hs)
    dh = (h1 - h0) or 1.0
    for poly in me.polygons:
        # Per-face, so the wrap seam does not tear a face across the whole texture.
        angs = []
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            angs.append(math.atan2(c[a0], c[a1]))       # 0 at +Y (the front), ±π at the back
        ref = angs[0]
        for li, a in zip(poly.loop_indices, angs):
            while a - ref > math.pi:
                a -= 2 * math.pi
            while a - ref < -math.pi:
                a += 2 * math.pi
            c = me.vertices[me.loops[li].vertex_index].co
            u = (a / (2 * math.pi) + 0.5) * repeat
            v = (c[axis] - h0) / dh if v_from_height else 0.5
            uvl.data[li].uv = (u, v)
    _restore_active(me, was_active)
    return uvl


def spherical_uv(o, layer=ART_UV, centre=None, repeat=1.0):
    """Wrap a texture around a bloom head: u = azimuth about local Z, v = elevation
    from the bottom pole (0) to the top (1). `centre` defaults to the mesh's bbox
    centre. Per-face seam handling as cylindrical_uv; the seam is at the back."""
    me = o.data
    uvl, was_active = _art_layer(me, layer)
    if centre is None:
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
        centre = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2))
    else:
        centre = Vector(centre)
    for poly in me.polygons:
        angs, els = [], []
        for li in poly.loop_indices:
            d = me.vertices[me.loops[li].vertex_index].co - centre
            angs.append(math.atan2(d.x, d.y))
            r = d.length or 1e-6
            els.append(math.asin(max(-1.0, min(1.0, d.z / r))))
        ref = angs[0]
        for li, a, e in zip(poly.loop_indices, angs, els):
            while a - ref > math.pi:
                a -= 2 * math.pi
            while a - ref < -math.pi:
                a += 2 * math.pi
            u = (a / (2 * math.pi) + 0.5) * repeat
            v = e / math.pi + 0.5
            uvl.data[li].uv = (u, v)
    _restore_active(me, was_active)
    return uvl


# ---------------------------------------------------------------- assembly
def join(parts, name, origin="floor"):
    """Join parts into ONE mesh and re-origin it.

    origin: "floor" / "base" — footprint (bbox xy) centre, z = 0 at the lowest vertex
            "hook"           — bbox xy centre, z = 0 at the HIGHEST vertex (hangs down -Z)
            "centre"         — bbox centre
            None             — apply transforms only, leave the vertices where they are

    ⚠ The re-origin is to the BOUNDING BOX, so adding or removing any part shifts the
    whole model. The game reads real extents from assets/models/<name>.meta.json
    (`min` + `size`) rather than guessing offsets. Mirror-ball style "origin at the
    ball's centre" wants join(..., origin=None) + origin_to(o, ball_centre).
    """
    parts = [p for p in parts if p and p.type == 'MESH']
    assert parts, f"join({name!r}): no mesh parts"
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if origin in ("floor", "base"):
        _origin_to_bbox(o, z="min")
    elif origin == "hook":
        _origin_to_bbox(o, z="max")
    elif origin == "centre":
        _origin_to_bbox(o, z="mid")
    return o


def _origin_to_bbox(o, z="min"):
    xs = [v.co.x for v in o.data.vertices]
    ys = [v.co.y for v in o.data.vertices]
    zs = [v.co.z for v in o.data.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    z0 = min(zs) if z == "min" else (max(zs) if z == "max" else (min(zs) + max(zs)) / 2)
    for v in o.data.vertices:
        v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
    o.location = (0, 0, 0)


def origin_to(o, point):
    """Re-origin a mesh to an arbitrary local point (the mirror ball's centre, a
    hook that is not on the bbox axis)."""
    px, py, pz = point
    for v in o.data.vertices:
        v.co.x -= px; v.co.y -= py; v.co.z -= pz
    o.location = (0, 0, 0)


def bounds(obj):
    """World-space bbox (lo, hi) of an object hierarchy, as two 3-lists."""
    bpy.context.view_layer.update()
    pts = []
    for o in [obj] + list(obj.children_recursive):
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    if not pts:
        return [0, 0, 0], [0, 0, 0]
    return [min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)]


def dims(obj):
    """World-space bbox (dx, dy, dz) of an object hierarchy (Blender axes)."""
    lo, hi = bounds(obj)
    return tuple(hi[i] - lo[i] for i in range(3))


def tris(obj):
    n = 0
    for o in [obj] + list(obj.children_recursive):
        if o.type == 'MESH':
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n


def save_master(root, name, **props):
    """Write masters/<name>.blend -- the source of truth the export step reads.
    Extra keyword props (front, origin, tris budget, …) are stored on the root as
    wv_<key> custom properties so export_all.py can read them without importing
    the generator."""
    os.makedirs(MASTERS, exist_ok=True)
    root["wv_asset"] = name
    for k, v in props.items():
        if v is not None:
            root["wv_" + k] = v
    path = os.path.join(MASTERS, name + ".blend")
    bpy.ops.wm.save_as_mainfile(filepath=path)
    print(f"MASTER {name}.blend tris={tris(root)} dims={tuple(round(d, 3) for d in dims(root))}")
    return path
