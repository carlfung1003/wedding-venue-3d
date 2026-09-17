"""round_bar — the round timber-plank cocktail bar drum + top (decor-cocktail-bar.jpg).

Spec row: 30 vertical pine boards .215 W × 1.04 H × .045 T on a r 1.05 ring; a
plank disc top r 1.16 at y ~1.045; the overhanging top r 1.24 × .06 → top surface
EXACTLY y 1.13. Nothing on top (the game adds bottles, glasses, drinks). Origin
floor centre. Budget 4,000 tris / 1024 atlas / bevel .003.

Deviation (declared): the spec's lower disc is ".025 at y 1.045", which leaves a
12 mm slot of air between it and the overhang (1.0575 → 1.07). The disc here spans
1.04 → 1.07 so the two layers touch; the top surface is still 1.13 and the
overhang unchanged, so no collider or placement moves.

Boards: 30 individual boxes, 5 mm gaps, each carrying `pine_planks.webp` on the
`art` uv layer — a random one-plank slice of the picture, tinted per board toward
one of the four `pine_*` palette keys so the drum reads as many boards, not one
wallpaper. The two top layers carry the same picture with its seams turned to run
along X (`bar_top`-tinted). If the picture is missing, everything falls back to
the flat palette keys (the wood family's grain still bakes in).
"""
import math, os
import bpy
import wv_lib as L

NAME = "round_bar"
ATLAS = 1024
# BEVEL = 0 on purpose: the joined-mesh bevel (2 segments on every edge ≥ 40°) came
# to 4,384 tris. Boards get a 2-segment .003 bevel each, the two top rims a
# 1-segment one, applied per part below — 3.5k.
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 4000
FRONT = "-Z"
ORIGIN = "floor"

N_BOARDS = 30
RING_R = 1.05
BOARD_W, BOARD_H, BOARD_T = 0.215, 1.04, 0.045
DISC_R, DISC_Z0, DISC_Z1 = 1.16, 1.04, 1.07
TOP_R, TOP_Z0, TOP_Z1 = 1.24, 1.07, 1.13
TEX = "pine_planks.webp"
PINE = ["pine_1", "pine_2", "pine_3", "pine_4"]
TEX_PLANKS = 5           # the picture is five planks across, seams vertical
TEX_METRES = 1.0         # …and reads as about a metre square


def _has_tex():
    return os.path.exists(os.path.join(L.TEX_GEN, TEX))


def _tinted_planks(name, key, tint):
    """The plank picture multiplied by `tint` (linear rgb). Flat `key` if it is missing."""
    if not _has_tex():
        return L.M(key)
    m = L.image_mat(name, TEX, roughness=0.75, fallback=key)
    nt = m.node_tree
    if nt.nodes.get("_tint") is None:
        bsdf = nt.nodes["Principled BSDF"]
        tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.name = "_tint"
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1.0
        mix.inputs[2].default_value = (*tint, 1.0)
        mix.location = (-250, 200)
        nt.links.new(tex.outputs["Color"], mix.inputs[1])
        nt.links.new(mix.outputs[0], bsdf.inputs["Base Color"])
        r, g, b = (L.srgb_to_linear(c) for c in L.PALETTE[key])
        m.diffuse_color = (r, g, b, 1.0)
    return m


def _bev(o, w, segments):
    """Per-part bevel; scale is applied first so the width is in metres."""
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    L.bevel([o], width=w, segments=segments, angle=40, min_size=0.01)
    return o


def _uv_xform(o, su, sv, du, dv, layer=L.ART_UV):
    """Scale + offset the art layer: planar_uv gives 0..1 over the bbox; this picks a
    slice of the picture (REPEAT extension, so >1 wraps)."""
    uvl = o.data.uv_layers.get(layer)
    for d in uvl.data:
        u, v = d.uv
        d.uv = (du + u * su, dv + v * sv)


def build():
    rnd = L.rng(NAME)
    parts = []
    lin = lambda k: tuple(L.srgb_to_linear(c) for c in L.PALETTE[k])
    base = lin("pine_1")
    # per-key tint relative to pine_1 (the picture is already that colour)
    mats = {}
    for k in PINE:
        t = lin(k)
        mats[k] = _tinted_planks("planks_" + k, k, tuple(min(1.0, t[i] / base[i]) for i in range(3)))
    top_t = tuple(min(1.0, lin("bar_top")[i] / base[i]) for i in range(3))
    top_mat = _tinted_planks("planks_top", "bar_top", top_t)

    # ---- the drum: 30 boards, tangent to the ring, 5 mm gaps
    for i in range(N_BOARDS):
        a = 2 * math.pi * i / N_BOARDS
        key = PINE[i % 4] if rnd.random() < 0.6 else rnd.choice(PINE)
        b = L.box(f"board{i}", (BOARD_W, BOARD_T, BOARD_H),
                  (RING_R * math.cos(a), RING_R * math.sin(a), BOARD_H / 2),
                  mats[key], rot=(0, 0, math.degrees(a) + 90))
        if _has_tex():
            L.planar_uv(b, u_axis=0, v_axis=2)          # local x across, z up (front elevation)
            k = rnd.randrange(TEX_PLANKS)
            inset = 0.025                                # stay inside the picture's own seams
            u0 = k / TEX_PLANKS + inset
            uw = (1.0 / TEX_PLANKS) - 2 * inset
            _uv_xform(b, uw, BOARD_H / TEX_METRES, u0, rnd.random())
        parts.append(_bev(b, 0.003, 2))

    # ---- the two top layers (seams along X: planar u = y, v = x)
    for nm, r, z0, z1 in (("disc", DISC_R, DISC_Z0, DISC_Z1), ("top", TOP_R, TOP_Z0, TOP_Z1)):
        c = L.cyl(nm, r, z1 - z0, (0, 0, (z0 + z1) / 2), top_mat, n=44)   # 48 landed on exactly 4,000
        if _has_tex():
            L.planar_uv(c, u_axis=1, v_axis=0)
            _uv_xform(c, (2 * r) / TEX_METRES, (2 * r) / TEX_METRES, rnd.random(), rnd.random())
        parts.append(_bev(c, 0.004, 1))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
