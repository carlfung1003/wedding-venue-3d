"""Clean-resort material finishes + albedo×AO atlas bake, one atlas per asset.

Ported from seventh-floor's sf_bake.py (2026-09-15, KAN-207) with the grime
stripped out. That game wanted damp blooms, rust and dirt in every crevice; this
one is a beach wedding — the finishes here are the small surface variation that
stops a flat colour reading as plastic (a linen weave, oak grain, a brushed
metal streak) and nothing dirtier. The universal "dirt in the cavities" term is
GONE; a light edge-lightening on wood / paint / metal is kept because it is what
a bevelled edge does in low sun.

What the bake produces: ONE texture and ONE material per asset, so sixty chairs
can be one InstancedMesh(geometry, material) draw call in the game. Cycles bakes
DIFFUSE colour (the procedural finish resolved into the atlas) and a real AO
pass, multiplied together. `Geometry > Pointiness` drives the edge term — free,
no UVs needed.

Per-generator knobs (module constants): ATLAS (256/512/1024), BEVEL (m, 0 on
cloth/florals/beads), AO_DIST (0.5 outdoor props; 0.15 for anything with an
enclosed interior — room-scale AO bakes interiors black), AO_STRENGTH (0.5),
MAT_NAME (force the exported material's name: "crystal", "mirror", …).
"""
import bpy, math, os, time
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TEXTURES = os.path.join(HERE, "textures")

# Which finish family each palette key belongs to. Unlisted keys are "plain".
FAMILY = {
    "ivory": "linen", "linen": "linen", "chiffon": "cloth", "sky": "cloth", "sky_d": "cloth",
    "teal": "cloth", "canopy_tint": "cloth", "label": "paper", "straw_band": "cloth",
    "oak": "wood", "oak_d": "wood", "oak_easel": "wood", "bar_top": "wood",
    "pine_1": "wood", "pine_2": "wood", "pine_3": "wood", "pine_4": "wood",
    "paint_w": "paint", "flute": "paint", "flute_d": "paint", "stone": "stone",
    "dark": "paint", "dj_dark": "paint", "coconut_cut": "plastic", "candle": "plastic",
    "steel": "metal", "steel_l": "metal", "bronze_d": "metal", "gold": "metal",
    "straw": "straw", "straw_d": "straw",
    "glass_pale": "glass", "crystal": "glass", "mirror": "glass", "pearl": "glass",
    "bottle_green": "glass", "bottle_amber": "glass", "bottle_clear": "glass",
    "bottle_red": "glass", "bottle_blue": "glass", "bottle_gold": "glass",
    "cream": "bloom", "white": "bloom", "hydrangea": "bloom", "delph": "bloom", "mist": "bloom",
    "lilac_1": "bloom", "lilac_2": "bloom", "lilac_3": "bloom",
    "leaf": "leaf", "leaf_d": "leaf", "coconut": "leaf",
    "bulb": "emit", "bulb_emit": "emit", "flame_emit": "emit", "facia_emit": "emit",
}
UNTOUCHED = {"glass", "bloom", "emit", "plain"}


def family_of(mat):
    if mat.get("wv_family"):
        return mat["wv_family"]
    return FAMILY.get(mat.get("wv_key", mat.name), "plain")


def finish(mat):
    """Wire the family's clean procedural colour graph into a flat material.
    Idempotent: a material already processed (or an image_mat) is left alone."""
    if mat.get("wv_finished"):
        return mat
    fam = family_of(mat)
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf is None or fam in UNTOUCHED:
        mat["wv_finished"] = 1
        return mat
    base = tuple(bsdf.inputs["Base Color"].default_value)

    def node(t, **kw):
        n = nt.nodes.new(t)
        for k, v in kw.items():
            setattr(n, k, v)
        return n

    def rgb(c):
        n = node("ShaderNodeRGB")
        n.outputs[0].default_value = (c[0], c[1], c[2], 1.0)
        return n

    def mixrgb(fac_out, col_a, col_b, blend='MIX', fac=None):
        n = node("ShaderNodeMixRGB")
        n.blend_type = blend
        if fac_out is not None:
            nt.links.new(fac_out, n.inputs[0])
        elif fac is not None:
            n.inputs[0].default_value = fac
        for i, c in ((1, col_a), (2, col_b)):
            if hasattr(c, "outputs"):
                nt.links.new(c.outputs[0], n.inputs[i])
            else:
                n.inputs[i].default_value = (c[0], c[1], c[2], 1.0)
        return n

    def noise(scale, detail=4.0, rough=0.5, dist=0.0):
        n = node("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        if "Distortion" in n.inputs:
            n.inputs["Distortion"].default_value = dist
        return n

    def wave(scale, distortion=0.0, detail=2.0, direction='Z'):
        n = node("ShaderNodeTexWave")
        n.wave_type = 'BANDS'
        n.bands_direction = direction
        n.inputs["Scale"].default_value = scale
        n.inputs["Distortion"].default_value = distortion
        n.inputs["Detail"].default_value = detail
        return n

    def ramp(src, stops):
        n = node("ShaderNodeValToRGB")
        nt.links.new(src, n.inputs["Fac"])
        el = n.color_ramp.elements
        while len(el) > 1:
            el.remove(el[-1])
        el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
        for pos, col in stops[1:]:
            e = el.new(pos)
            e.color = (*col, 1)
        return n

    def pointiness():
        return node("ShaderNodeNewGeometry").outputs["Pointiness"]

    def scale_col(c, k):
        return tuple(min(1.0, max(0.0, v * k)) for v in c[:3])

    def tone(col, scale, amount, detail=3.0):
        """±amount tone variation from a noise field — the 'not one flat colour' term."""
        n = noise(scale, detail=detail)
        r = ramp(n.outputs["Fac"], [(0.35, (1 - amount,) * 3), (0.65, (1 + amount,) * 3)])
        return mixrgb(None, col, r, 'MULTIPLY', fac=1.0)

    col = rgb(base[:3])
    edge_gain = None

    if fam == "linen":
        # fine even weave, a whisper of larger tone drift; no dirt, no foxing
        weave = noise(110.0, detail=2, rough=0.5)
        col = mixrgb(weave.outputs["Fac"], col, scale_col(base, 0.93), 'MIX')
        col.inputs[0].default_value = 0.45
        col = tone(col, 2.5, 0.025)
    elif fam == "cloth":
        # chiffon / voile: softer, finer than linen
        weave = noise(140.0, detail=2, rough=0.45)
        col = mixrgb(weave.outputs["Fac"], col, scale_col(base, 0.95), 'MIX')
        col.inputs[0].default_value = 0.35
        col = tone(col, 3.0, 0.02)
    elif fam == "wood":
        # grain bands along Z + a faint plank-to-plank tone drift; NO blotch, NO dirt
        grain = wave(3.4, distortion=8.0, detail=4.0, direction='Z')
        gr = ramp(grain.outputs["Fac"], [(0.25, (0.90, 0.88, 0.86)), (0.75, (1.08, 1.06, 1.04))])
        col = mixrgb(None, col, gr, 'MULTIPLY', fac=0.85)
        col = tone(col, 1.8, 0.04)
        edge_gain = 1.12
    elif fam == "paint":
        # clean satin paint: a barely-there roller texture and lightened edges
        rl = noise(24.0, detail=3)
        col = mixrgb(rl.outputs["Fac"], col, scale_col(base, 0.97), 'MIX')
        col.inputs[0].default_value = 0.30
        edge_gain = 1.06
    elif fam == "stone":
        spec = noise(60.0, detail=5, rough=0.6)
        col = mixrgb(spec.outputs["Fac"], col, scale_col(base, 0.94), 'MIX')
        col.inputs[0].default_value = 0.35
        col = tone(col, 2.0, 0.03)
    elif fam == "metal":
        # brushed: long fine streaks along Z, and bright edges where the brushing catches
        streak = wave(48.0, distortion=0.4, detail=1.0, direction='Z')
        st = ramp(streak.outputs["Fac"], [(0.3, (0.94,) * 3), (0.7, (1.06,) * 3)])
        col = mixrgb(None, col, st, 'MULTIPLY', fac=0.9)
        col = tone(col, 6.0, 0.04)
        edge_gain = 1.18
    elif fam == "straw":
        # two crossed band fields read as a plaited weave
        w1 = wave(70.0, distortion=1.5, detail=1.0, direction='X')
        w2 = wave(70.0, distortion=1.5, detail=1.0, direction='Y')
        r1 = ramp(w1.outputs["Fac"], [(0.3, (0.90, 0.88, 0.84)), (0.7, (1.08, 1.06, 1.02))])
        r2 = ramp(w2.outputs["Fac"], [(0.3, (0.92, 0.90, 0.86)), (0.7, (1.06, 1.04, 1.00))])
        col = mixrgb(None, col, r1, 'MULTIPLY', fac=0.9)
        col = mixrgb(None, col, r2, 'MULTIPLY', fac=0.9)
        col = tone(col, 4.0, 0.05)
    elif fam == "paper":
        fib = noise(90.0, detail=2)
        col = mixrgb(fib.outputs["Fac"], col, scale_col(base, 0.95), 'MIX')
        col.inputs[0].default_value = 0.3
    elif fam == "leaf":
        col = tone(col, 14.0, 0.07, detail=4.0)
    elif fam == "plastic":
        sc = noise(30.0, detail=3)
        col = mixrgb(sc.outputs["Fac"], col, scale_col(base, 1.04), 'MIX')
        col.inputs[0].default_value = 0.2

    # ---- edge lightening only (the old universal cavity-dirt term is deliberately gone)
    if edge_gain:
        edge = ramp(pointiness(), [(0.53, (0, 0, 0)), (0.63, (1, 1, 1))])
        col = mixrgb(edge.outputs["Color"], col, scale_col(base, edge_gain), 'MIX')

    nt.links.new(col.outputs[0], bsdf.inputs["Base Color"])
    mat["wv_finished"] = 1
    return mat


# ------------------------------------------------------------------ unwrap
def select_only(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]


def _activate_atlas_layer(me):
    """The atlas unwrap must land on a layer that is NOT the `art` layer, and that
    layer must be the render-active one so the bake target samples it."""
    import wv_lib as L
    base = [l for l in me.uv_layers if l.name != L.ART_UV]
    if not base:
        me.uv_layers.new(name="UVMap")
        base = [l for l in me.uv_layers if l.name != L.ART_UV]
    lay = base[0]
    me.uv_layers.active = lay
    lay.active_render = True
    return lay


def unwrap(objs, margin=0.015):
    for o in objs:
        _activate_atlas_layer(o.data)
    select_only(objs)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin,
                             scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    try:
        bpy.ops.uv.pack_islands(margin=margin / 2, rotate=True)
    except TypeError:
        bpy.ops.uv.pack_islands(margin=margin / 2)
    bpy.ops.object.mode_set(mode='OBJECT')


def _image(name, size, alpha=False):
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, size, size, alpha=alpha, float_buffer=False)
    img.colorspace_settings.name = 'sRGB'
    return img


def _set_bake_target(mats, img):
    for m in mats:
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        node = nt.nodes.get("_bake") or nt.nodes.new("ShaderNodeTexImage")
        node.name = "_bake"
        node.image = img
        node.location = (-1200, -500)
        nt.nodes.active = node


def _blur(a, n=2):
    for _ in range(n):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5.0
    return a


def pick_device():
    """Cycles on the Apple GPU (Metal) when it is there, CPU otherwise. Returns the
    value for scene.cycles.device."""
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.refresh_devices()
        prefs.compute_device_type = 'METAL'
        gpus = [d for d in prefs.devices if d.type == 'METAL']
        if gpus:
            for d in prefs.devices:
                d.use = d.type == 'METAL'
            return 'GPU'
    except Exception as e:               # no Metal build, no GPU, sandboxed — all fine
        print(f"WARN bake: Metal unavailable ({e}); using CPU")
    return 'CPU'


def _bake(kind, **kw):
    """Run one bake; if the GPU path throws, fall back to CPU and retry once."""
    sc = bpy.context.scene
    try:
        bpy.ops.object.bake(type=kind, **kw)
    except RuntimeError as e:
        if sc.cycles.device == 'GPU':
            print(f"WARN bake {kind} on GPU failed ({e}); retrying on CPU")
            sc.cycles.device = 'CPU'
            bpy.ops.object.bake(type=kind, **kw)
        else:
            raise


def bake_atlas(objs, name, size=512, ao_dist=0.5, ao_samples=48, ao_strength=0.5):
    """Bake DIFFUSE colour and an AO pass, multiply them, save textures/<name>.png.
    Prints the wall time per pass and the device used."""
    t0 = time.time()
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = pick_device()
    device = sc.cycles.device
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 8
    sc.render.bake.use_selected_to_active = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (1, 1, 1, 1)
        bg.inputs["Strength"].default_value = 1.0
    sc.world.light_settings.distance = ao_dist

    mats = []
    for o in objs:
        for s in o.material_slots:
            if s.material and s.material not in mats:
                mats.append(s.material)
    for m in mats:
        finish(m)
    all_emit = mats and all(family_of(m) == "emit" for m in mats)

    select_only(objs)
    sc.cycles.samples = 8
    col = _image(name + "_col", size)
    _set_bake_target(mats, col)
    _bake('DIFFUSE', pass_filter={'COLOR'}, margin=8, use_clear=True)
    t1 = time.time()

    if all_emit or ao_strength <= 0:
        # a glowing thing has no occlusion darkening — skip the pass entirely
        c = np.array(col.pixels[:], dtype=np.float32).reshape(size, size, 4)
        t2 = t1
    else:
        sc.cycles.samples = ao_samples
        ao = _image(name + "_ao", size)
        _set_bake_target(mats, ao)
        _bake('AO', margin=8, use_clear=True)
        t2 = time.time()
        c = np.array(col.pixels[:], dtype=np.float32).reshape(size, size, 4)
        a = np.array(ao.pixels[:], dtype=np.float32).reshape(size, size, 4)
        occ = np.clip(a[..., :1], 0, 1) ** 0.8
        occ = _blur(occ, 2)                      # AO sampling noise is pure file size
        c[..., :3] = c[..., :3] * ((1.0 - ao_strength) + ao_strength * occ)
        bpy.data.images.remove(ao)
    c[..., 3] = 1.0

    final = _image(name + "_atlas", size)
    final.pixels = c.ravel().tolist()
    os.makedirs(TEXTURES, exist_ok=True)
    final.filepath_raw = os.path.join(TEXTURES, name + ".png")
    final.file_format = 'PNG'
    final.save()
    final.pack()
    bpy.data.images.remove(col)
    print(f"BAKE {name} {size}px {sc.cycles.device}/{device} colour {t1 - t0:.1f}s "
          f"ao {t2 - t1:.1f}s total {time.time() - t0:.1f}s -> {final.filepath_raw}")
    return final


def apply_baked(objs, name, atlas, mat_name=None):
    """Collapse every slot to ONE baked material.

    Naming (the loader keys on it — see js/models.js prepare()):
      mat_name if the generator set MAT_NAME; else the sole palette key when the
      whole asset used one key (`paint_w`, `flute`, `mirror`, `canopy_tint`,
      `flame_emit`…); else the asset name.
    Roughness / metallic come from the key that covers the most faces.
    Emissive keys may not be mixed with lit ones in one asset — split the glowing
    part into build_<suffix>() so the loader can keep it unlit. That is an error
    here, not a second material.
    """
    import wv_lib as L
    counts = {}
    src_by_key = {}
    for o in objs:
        slots = [s.material for s in o.material_slots]
        for p in o.data.polygons:
            m = slots[p.material_index] if slots else None
            if m is None:
                continue
            k = m.get("wv_key", m.name)
            counts[k] = counts.get(k, 0) + 1
            src_by_key[k] = m
    assert counts, f"{name}: no materials to bake"
    emit_keys = [k for k in counts if family_of(src_by_key[k]) == "emit"]
    if emit_keys and len(emit_keys) != len(counts):
        raise RuntimeError(
            f"{name}: mixes emissive {emit_keys} with lit {sorted(set(counts) - set(emit_keys))}. "
            f"One GLB = one material — export the glowing part via build_<suffix>().")
    dominant = max(counts, key=counts.get)
    src = src_by_key[dominant]
    sb = src.node_tree.nodes.get("Principled BSDF")
    final_name = mat_name or (dominant if len(counts) == 1 else name)

    # The source materials stay in the file (fake user, for a re-bake) and one of
    # them is usually called exactly `final_name` — so move them out of the way or
    # Blender names the baked material `flute.001` and the loader's name rules
    # (`mirror`, `canopy_tint`, `*_emit`) silently stop matching in the GLB.
    for m in set(src_by_key.values()):
        if not m.name.startswith("_src_"):
            m.name = "_src_" + m.name
    stale = bpy.data.materials.get(final_name)
    if stale is not None:
        stale.name = "_stale_" + final_name

    baked = bpy.data.materials.new(final_name)
    assert baked.name == final_name, f"{name}: material came out as {baked.name!r}, wanted {final_name!r}"
    baked.use_nodes = True
    nt = baked.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = sb.inputs["Roughness"].default_value if sb else 0.85
    b.inputs["Metallic"].default_value = sb.inputs["Metallic"].default_value if sb else 0.0
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    tex.location = (-400, 0)
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    if emit_keys:
        b.inputs["Emission Color"].default_value = sb.inputs["Emission Color"].default_value
        b.inputs["Emission Strength"].default_value = sb.inputs["Emission Strength"].default_value
        baked["wv_family"] = "emit"
    baked["wv_key"] = final_name
    baked.diffuse_color = tuple(src.diffuse_color)

    for o in objs:
        for m in (s.material for s in o.material_slots):
            if m:
                m.use_fake_user = True        # keep the procedural graph for a re-bake
        o.data.materials.clear()
        o.data.materials.append(baked)
        for p in o.data.polygons:
            p.material_index = 0
        # The picture is in the atlas now; a second TEXCOORD would only bloat the GLB.
        art = o.data.uv_layers.get(L.ART_UV)
        if art is not None:
            o.data.uv_layers.remove(art)
    print(f"MATERIAL {name}: '{final_name}' (keys {counts})")
    return baked


def meshes_of(root):
    return [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']


def prepare_for_export(root, size=512, bevel_width=0.004, ao_dist=0.5, ao_strength=0.5,
                       margin=0.015, mat_name=None):
    """bevel -> unwrap -> bake -> single material. Call once, at master-build time."""
    import wv_lib as L
    objs = meshes_of(root)
    if not objs:
        return None
    if bevel_width > 0:
        L.bevel(objs, width=bevel_width)
    unwrap(objs, margin=margin)
    atlas = bake_atlas(objs, root.name, size=size, ao_dist=ao_dist, ao_strength=ao_strength)
    apply_baked(objs, root.name, atlas, mat_name=mat_name)
    root["wv_baked"] = 1
    return atlas
