"""mirror_ball — the faceted mirror ball (after party).

Spec row: Ø .90, faceted tiles; ORIGIN AT THE BALL'S CENTRE; a short chain rising
.35 above. Material name `mirror` (the loader sets metalness 1 / roughness .12).
Budget 2,500 / 256 / bevel 0.

A UV sphere (20 × 10) whose every face is inset individually and pushed 4 mm
proud, so the tiles are square, flat-shaded and separated by sunk grout — the
way a real ball reads. The chain is five alternating torus links off a cap
fitting; it is `steel`, MAT_NAME pins the export name to `mirror`.
"""
import math, bmesh
import bpy
import wv_lib as L

NAME = "mirror_ball"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35
TRIS = 2500
FRONT = "-Z"
ORIGIN = "centre"
MAT_NAME = "mirror"

R = 0.45
CHAIN = 0.35



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
    tile = _flat("mirror_flat", "e6e9ec", 0.12, "glass")
    ST = _flat("steel_flat", "9aa1a6")
    ball = L.uv_sphere("ball", R, (0, 0, 0), tile, seg=20, rings=10)
    me = ball.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.inset_individual(bm, faces=bm.faces[:], thickness=0.009, depth=0.004,
                               use_even_offset=True)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = False
    parts = [ball]
    # cap fitting + chain
    parts.append(L.cyl("cap", 0.035, 0.03, (0, 0, R + 0.005), ST, n=10))
    parts.append(L.cyl("eye", 0.012, 0.03, (0, 0, R + 0.03), ST, n=8))
    z = R + 0.045
    pitch = (CHAIN - 0.045) / 5
    for k in range(5):
        rot = (90, 0, 0) if k % 2 == 0 else (90, 0, 90)
        parts.append(L.torus(f"link{k}", 0.020, 0.005, (0, 0, z + pitch * k + pitch / 2), ST,
                             maj=8, mnr=4, rot=rot))
    root = L.join(parts, NAME, origin=None)      # verts already relative to the ball's centre
    return root
