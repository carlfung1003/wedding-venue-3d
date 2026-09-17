"""speaker — PA speaker on a steel tripod (after party).

Spec row: cabinet .55 W × .45 D × .70 H on a steel tripod, cabinet top at ~y 1.6.
Origin floor centre; front −Z. Budget 1,500 / 256 / bevel .003.

The front face carries a real recess (boolean) with a darker grille panel inside
it and two driver rings; a pole socket under the cabinet takes the tripod's
column, whose three legs splay to r .45 with a set of braces.
"""
import math
import bpy
import wv_lib as L

NAME = "speaker"
ATLAS = 256
# BEVEL = 0 on purpose: the joined-mesh bevel rounded every torus ring, strut cap
# and boolean edge (824 → 4,032 tris). Only the cabinet is bevelled, per part.
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

W, D, H = 0.55, 0.45, 0.70
TOP = 1.60
Z0 = TOP - H                  # cabinet bottom



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

def build():
    ST = _flat("steel_flat", "9aa1a6")
    parts = []
    cab = L.box("cabinet", (W, D, H), (0, 0, Z0 + H / 2), "dark")
    cutter = L.box("cut", (W - 0.07, 0.03, H - 0.08), (0, D / 2, Z0 + H / 2), "dark")
    L.boolean(cab, cutter)
    bpy.ops.object.select_all(action='DESELECT')
    cab.select_set(True)
    bpy.context.view_layer.objects.active = cab
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    L.bevel([cab], width=0.004, segments=3, angle=40, min_size=0.01)
    parts.append(cab)
    # ⚠ `dark` must stay the key with the most faces (apply_baked takes the whole
    # asset's metalness from it) — the steel tripod is kept lean for that reason.
    parts.append(L.box("grille", (W - 0.08, 0.008, H - 0.09), (0, D / 2 - 0.012, Z0 + H / 2), "bronze_d"))
    parts.append(L.torus("hf_ring", 0.045, 0.007, (0, D / 2 - 0.006, Z0 + H - 0.16), "dark", maj=10, mnr=4, rot=(90, 0, 0)))
    parts.append(L.torus("lf_ring", 0.13, 0.010, (0, D / 2 - 0.006, Z0 + 0.24), "dark", maj=14, mnr=4, rot=(90, 0, 0)))
    parts.append(L.cyl("lf_cone", 0.12, 0.004, (0, D / 2 - 0.010, Z0 + 0.24), "bronze_d", n=14, rot=(90, 0, 0)))
    # a carry handle on top
    parts.append(L.box("handle", (0.16, 0.03, 0.02), (0, 0, TOP + 0.02), "dark"))
    for sx in (-1, 1):
        parts.append(L.box(f"hpost{sx}", (0.02, 0.03, 0.03), (sx * 0.07, 0, TOP + 0.01), "dark"))

    # tripod: socket, column, collar, three splayed legs + braces
    parts.append(L.cyl("socket", 0.03, 0.05, (0, 0, Z0 - 0.025), "dark", n=10))
    parts.append(L.cyl("column", 0.018, 0.30, (0, 0, Z0 - 0.15), ST, n=8))
    parts.append(L.cyl("collar", 0.032, 0.05, (0, 0, Z0 - 0.30), "dark", n=10))
    hub_z = Z0 - 0.32
    for k in range(3):
        a = math.radians(90 + 120 * k)
        foot = (0.45 * math.cos(a), 0.45 * math.sin(a), 0.0)
        parts.append(L.strut(f"leg{k}", (0.02 * math.cos(a), 0.02 * math.sin(a), hub_z), foot, 0.012, ST, n=6))
        parts.append(L.cyl(f"foot{k}", 0.02, 0.012, (foot[0], foot[1], 0.006), "dark", n=10))
        mid = ((foot[0] + 0.02 * math.cos(a)) / 2, (foot[1] + 0.02 * math.sin(a)) / 2, hub_z / 2)
        parts.append(L.strut(f"brace{k}", (0, 0, hub_z - 0.22), mid, 0.007, ST, n=5))
    parts.append(L.cyl("slider", 0.024, 0.04, (0, 0, hub_z - 0.22), "dark", n=10))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
