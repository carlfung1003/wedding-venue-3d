"""drink_dispenser — the glass beverage dispenser of lemon water on the dessert
counter (decor-dessert-bar.jpg, left of centre).

Spec row: body r .155 × .34 tall on a small timber stand with a tap; origin base
centre (it sits on the counter top); front −Z (the tap faces the guest). The game
places two, the second at scale .93. `glass_pale` OPAQUE-frosted, `oak_d`.
Budget 1,500 / 256 / bevel 0.

The jar is a lathe (a slight foot, straight sides, a shoulder into the neck), a
timber lid with a knob, a steel tap through the front at cup height, and a low
open timber trestle underneath so a glass fits under the tap. The lemon slices
the spec calls optional are omitted: the jar is opaque by rule (a bake cannot
ship transmission), so anything inside it is invisible.

The tap is built on a dielectric copy of `steel` (metallic keys bake dark, see
wheelbarrow.py); at 2 cm nobody can tell.
"""
import bpy
import wv_lib as L

NAME = "drink_dispenser"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

R, H = 0.155, 0.34
STAND_H = 0.11


def _dielectric(key, name, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    r, g, bl = (L.srgb_to_linear(c) for c in L.PALETTE[key])
    b.inputs["Base Color"].default_value = (r, g, bl, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (r, g, bl, 1.0)
    m["wv_key"] = name
    m["wv_family"] = "plain"
    return m


def build():
    steel = _dielectric("steel", "steel_d", 0.3)
    parts = []
    # the trestle: a top plate on two side cheeks, open at the front for a glass
    plate = L.box("plate", (0.34, 0.34, 0.02), (0, 0, STAND_H - 0.01), "oak_d")
    L.bevel([plate], width=0.003, segments=2, angle=40, min_size=0.01)
    parts.append(plate)
    for s in (-1, 1):
        parts.append(L.box(f"cheek{s}", (0.03, 0.30, STAND_H - 0.02), (s * 0.15, 0, (STAND_H - 0.02) / 2), "oak_d"))
    parts.append(L.box("rail", (0.30, 0.03, 0.05), (0, -0.13, 0.025 + 0.02), "oak_d"))
    # the jar
    prof = [(0.0, 0), (0.135, 0), (0.15, 0.012), (R, 0.05), (R, 0.27), (0.150, 0.31),
            (0.125, 0.335), (0.112, H)]
    parts.append(L.lathe("jar", prof, (0, 0, STAND_H), "glass_pale", n=28))
    # the timber lid + knob
    lid = [(0.0, 0), (0.118, 0), (0.128, 0.012), (0.128, 0.03), (0.10, 0.042), (0.04, 0.048), (0.0, 0.05)]
    parts.append(L.lathe("lid", lid, (0, 0, STAND_H + H - 0.004), "oak_d", n=24))
    parts.append(L.lathe("knob", [(0.0, 0), (0.014, 0), (0.02, 0.012), (0.016, 0.028), (0.0, 0.034)],
                         (0, 0, STAND_H + H + 0.044), "oak_d", n=12))
    # the tap through the front wall at cup height, spout turned down, a lever on top
    zt = STAND_H + 0.05
    parts.append(L.cyl("collar", 0.02, 0.012, (0, R + 0.002, zt), steel, n=12, rot=(90, 0, 0)))
    parts.append(L.strut("spigot", (0, R - 0.01, zt), (0, R + 0.065, zt), 0.010, steel, n=10))
    parts.append(L.strut("spout", (0, R + 0.062, zt + 0.004), (0, R + 0.062, zt - 0.04), 0.008, steel, n=10))
    parts.append(L.strut("lever", (0, R + 0.04, zt + 0.006), (0, R + 0.04, zt + 0.045), 0.005, steel, n=8))
    parts.append(L.sphere("leverknob", 0.011, (0, R + 0.04, zt + 0.05), steel, sub=1))
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
