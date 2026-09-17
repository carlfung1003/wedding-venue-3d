"""parasol_round (+ parasol_round_canopy) — the cocktail hour's teal parasols.

Spec row: pole Ø .09 h 2.5; canopy r 1.70, base y 2.40 → apex 2.95, 12 ribs,
scalloped valance, finial. The pole + ribs + finial export as `parasol_round`;
the canopy alone as `parasol_round_canopy` via build_canopy(), material
`canopy_tint` — modelled PURE WHITE, the game multiplies its teal in. Origin floor
at the pole foot for both. Budget 2,500 total / 256 / bevel 0.

The canopy is a bmesh: apex, a mid ring and a rim ring of 12 panels × 6 steps;
the fabric between ribs dips a little (r and z) so the rim reads as stretched
over ribs rather than a lampshade, and a .11 valance hangs off the rim with a
two-scallops-per-panel bottom edge. Solidified 8 mm so it is visible from
underneath (the loader ships FrontSide materials).
"""
import math, bmesh
import bpy
import wv_lib as L

NAME = "parasol_round"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35
TRIS = 2500
FRONT = "-Z"
ORIGIN = "floor"

POLE_R, POLE_H = 0.045, 2.5
RIBS, STEPS = 12, 6
CAN_R, CAN_Z0, CAN_Z1 = 1.70, 2.40, 2.95
VALANCE = 0.11



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
    STL = _flat("steel_l_flat", "aab1b6")
    parts = []
    parts.append(L.cyl("pole", POLE_R, POLE_H, (0, 0, POLE_H / 2), "oak_d", n=12))
    # the upper tube carries on from the timber pole to the hub (the spec's 2.5 m is
    # the timber; the canopy apex is at 2.95)
    parts.append(L.cyl("pole_top", 0.022, CAN_Z1 - POLE_H + 0.02, (0, 0, (POLE_H + CAN_Z1 + 0.02) / 2), STL, n=10))
    parts.append(L.cyl("ferrule", POLE_R + 0.006, 0.05, (0, 0, POLE_H - 0.02), STL, n=12))
    # the hub the ribs spring from, a little under the apex
    parts.append(L.cyl("hub", 0.06, 0.08, (0, 0, CAN_Z1 - 0.10), STL, n=10))
    for i in range(RIBS):
        a = 2 * math.pi * i / RIBS
        tip = ((CAN_R + 0.04) * math.cos(a), (CAN_R + 0.04) * math.sin(a), CAN_Z0 - 0.015)
        # timber ribs (a real timber parasol's are), and it keeps `oak_d` the dominant
        # key — with steel ribs the whole asset baked as metallic .8 and went black
        parts.append(L.strut(f"rib{i}", (0.04 * math.cos(a), 0.04 * math.sin(a), CAN_Z1 - 0.10),
                             tip, 0.010, "oak_d", n=6))
    # the finial above the apex
    fin = [(0, 0), (0.05, 0), (0.05, 0.02), (0.025, 0.03), (0.035, 0.07), (0.02, 0.10), (0, 0.11)]
    parts.append(L.lathe("finial", fin, (0, 0, CAN_Z1 - 0.005), "paint_w", n=12))
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root


def _canopy_bmesh():
    bm = bmesh.new()
    n = RIBS * STEPS
    apex = bm.verts.new((0, 0, CAN_Z1))

    def ring(frac_r, z, dip_r, dip_z):
        vs = []
        for i in range(n):
            t = (i % STEPS) / STEPS                    # 0 at a rib, 0.5 between ribs
            s = math.sin(math.pi * t)
            r = CAN_R * frac_r * (1 - dip_r * s)
            a = 2 * math.pi * i / n
            vs.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z - dip_z * s)))
        return vs

    mid = ring(0.55, CAN_Z0 + (CAN_Z1 - CAN_Z0) * 0.45, 0.012, 0.02)
    rim = ring(1.00, CAN_Z0, 0.018, 0.035)
    # the valance: straight down off the rim, two scallops per panel
    val = []
    for i in range(n):
        x, y, z = rim[i].co
        tt = (i % (STEPS // 2)) / (STEPS // 2)
        scallop = 0.04 * math.sin(math.pi * tt)
        val.append(bm.verts.new((x * 1.002, y * 1.002, z - VALANCE + scallop)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((apex, mid[i], mid[j]))
        bm.faces.new((mid[i], rim[i], rim[j], mid[j]))
        bm.faces.new((rim[i], val[i], val[j], rim[j]))
    return bm


def build_canopy():
    can = L.from_bmesh("canopy", _canopy_bmesh(), (0, 0, 0), "canopy_tint")
    L.solidify(can, 0.008, offset=-1.0)
    root = L.join([can], NAME + "_canopy", origin=None)     # keep the pole's frame: foot at z 0
    L.shade_smooth(root, angle=30)
    return root
