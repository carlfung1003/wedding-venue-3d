"""dj_booth (+ dj_booth_facia) — the after-party DJ booth.

Spec row: 2.4 W × .8 D × 1.1 H dark booth; a laptop, a controller and a small
lamp on top. build_facia() → the 2.2 × .5 facia panel on the front (−Z) face
centred y .70, material `facia_emit` (ivory-white glow). Origin floor centre;
front −Z. Budget 2,500 / 512 / bevel .004, AO_DIST .15.

The module BEVEL is 0 on purpose: the joined-mesh bevel would round every knob
and button (×4 faces each); the carcass, top slab, laptop and controller get a
per-part bevel instead. Everything on top stays inside the carcass footprint so
the bounding-box re-origin lands on the booth's own centre.
"""
import math
import bpy
import wv_lib as L

NAME = "dj_booth"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.15
AO_STRENGTH = 0.5
TRIS = 2500
FRONT = "-Z"
ORIGIN = "floor"

W, D, H = 2.4, 0.8, 1.1
TOP = H                       # top surface



def _flat(key, hexstr, rough=0.35, family="metal"):
    """A dielectric stand-in for a METALLIC palette key, same colour, metallic 0.
    wv_bake bakes Cycles' DIFFUSE colour pass, which is scaled by (1 - metallic):
    `steel` (.8) bakes to ~20 % grey and `mirror` (1.0) to black. The exported
    material's metalness comes from the dominant non-metal key anyway, and the
    loader keys `mirror` by NAME, so nothing is lost by baking these as dielectrics."""
    m = bpy.data.materials.get(key)
    if m is not None:
        return m
    r, g, b = (L.srgb_to_linear(int(hexstr[i:i + 2], 16) / 255.0) for i in (0, 2, 4))
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (r, g, b, 1.0)
    m["wv_key"] = key
    m["wv_family"] = family
    return m

def _bev(o, w=0.004, min_size=0.01):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    L.bevel([o], width=w, segments=2, angle=40, min_size=min_size)
    return o


def build():
    ST, STL = _flat("steel_flat", "9aa1a6"), _flat("steel_l_flat", "aab1b6")
    parts = []
    parts.append(_bev(L.box("carcass", (W, D, H - 0.03), (0, 0, (H - 0.03) / 2), "dj_dark")))
    parts.append(_bev(L.box("slab", (W + 0.04, D + 0.04, 0.03), (0, 0, H - 0.015), "dj_dark")))

    # laptop, left of centre, screen leaning back
    lx, ly = -0.70, -0.06
    parts.append(_bev(L.box("lap_base", (0.33, 0.23, 0.015), (lx, ly, TOP + 0.0075), "dark"), 0.003, 0.005))
    parts.append(L.box("lap_keys", (0.27, 0.10, 0.003), (lx, ly + 0.02, TOP + 0.016), "bronze_d"))
    a = math.radians(-72)
    sy, sz = ly - 0.115 + 0.11 * math.cos(math.radians(72)), TOP + 0.015 + 0.11 * math.sin(math.radians(72))
    parts.append(_bev(L.box("lap_screen", (0.33, 0.008, 0.22), (lx, sy, sz), "dark", rot=(-18, 0, 0)), 0.003, 0.005))

    # controller, right of centre
    cx, cy = 0.20, 0.0
    parts.append(_bev(L.box("ctrl", (0.62, 0.36, 0.045), (cx, cy, TOP + 0.0225), "dj_dark")))
    for sx in (-1, 1):
        parts.append(L.cyl(f"jog{sx}", 0.068, 0.006, (cx + sx * 0.19, cy - 0.03, TOP + 0.048), ST, n=18))
        parts.append(L.cyl(f"jogc{sx}", 0.03, 0.004, (cx + sx * 0.19, cy - 0.03, TOP + 0.053), "dark", n=12))
        # a pitch fader beside each wheel
        parts.append(L.box(f"fader{sx}", (0.012, 0.09, 0.006), (cx + sx * 0.285, cy - 0.03, TOP + 0.048), STL))
    # the mixer strip: 3 rows × 4 knobs, 4 line faders, a row of pads
    for r in range(3):
        for c in range(4):
            parts.append(L.cyl(f"knob{r}{c}", 0.007, 0.012, (cx - 0.045 + c * 0.03, cy + 0.12 - r * 0.035, TOP + 0.051),
                               STL, n=6))
    for c in range(4):
        parts.append(L.box(f"lf{c}", (0.006, 0.07, 0.005), (cx - 0.045 + c * 0.03, cy - 0.02, TOP + 0.047), STL))
        parts.append(L.box(f"lfk{c}", (0.014, 0.008, 0.008), (cx - 0.045 + c * 0.03, cy - 0.035 + c * 0.01, TOP + 0.049), ST))
    for c in range(4):
        for sx in (-1, 1):
            parts.append(L.box(f"pad{sx}{c}", (0.018, 0.018, 0.005), (cx + sx * 0.19 - 0.03 + c * 0.02, cy + 0.13, TOP + 0.047), "dark"))

    # the small lamp, back right, gooseneck bent over the controller
    bx, by = 1.02, -0.28
    parts.append(L.cyl("lamp_base", 0.045, 0.012, (bx, by, TOP + 0.006), "bronze_d", n=12))
    parts.append(L.strut("lamp_stem", (bx, by, TOP + 0.01), (bx, by, TOP + 0.36), 0.007, "bronze_d", n=8))
    parts.append(L.strut("lamp_neck", (bx, by, TOP + 0.36), (bx - 0.14, by + 0.16, TOP + 0.44), 0.007, "bronze_d", n=8))
    parts.append(L.cone("lamp_shade", 0.045, 0.07, (bx - 0.16, by + 0.18, TOP + 0.42), "bronze_d", n=12, rot=(35, 20, 0)))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root


def build_facia():
    panel = L.box("facia", (2.2, 0.02, 0.5), (0, D / 2 + 0.008, 0.70), "facia_emit")
    return L.join([panel], NAME + "_facia", origin=None)     # keep the booth's frame
