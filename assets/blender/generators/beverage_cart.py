"""beverage_cart — the small white canopy cart of fruit
(decor-beverage-coconut.jpg, right; refsheets/beverage_cart.png).

Spec row: table 1.56 × .78, top surface y .915 (.07 thick, centre .88); four legs
Ø .028; four canopy posts Ø .028 at x ±.74, z ±.34 rising to y 2.0; canopy
1.80 × 1.02 × .045 at y 2.02, tilted .05 rad about Z, with a scalloped ivory
fabric; on top: 13 assorted fruit (watermelon, oranges, bananas, blueberries, a
pineapple), a steel bucket, two small flower vases. The FRONT EDGE IS PLAIN —
the game hangs its "Beverage" cloth there. Origin floor centre; front −Z.
Budget 6,000 / 512 / bevel 0.

Fruit colours are not in the palette (there is no orange, banana yellow or
melon green in a blue-and-cream wedding), so this generator makes its own
Principled materials through the same M() passthrough — `wv_key` set, family
`leaf`/`plain`, so the bake treats them like any other key. The watermelon is
striped by assigning two greens per face by longitude.
"""
import math
import bpy
import wv_lib as L

NAME = "beverage_cart"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

TW, TD, TT = 1.56, 0.78, 0.07
TOP = 0.915
LEG_R = 0.014
PX, PY, PH = 0.74, 0.34, 2.0
CAN = (1.80, 1.02, 0.045)
CAN_Z = 2.02
TILT = 0.05
VAL = 0.10

_custom = {}



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

def _mat(key, hexstr, rough=0.6, family="plain"):
    """A palette-style material for a colour the palette lacks (fruit)."""
    if key in _custom and _custom[key].name in bpy.data.materials:
        return _custom[key]
    r, g, b = (L.srgb_to_linear(int(hexstr[i:i + 2], 16) / 255.0) for i in (0, 2, 4))
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (r, g, b, 1.0)
    m["wv_key"] = key
    m["wv_family"] = family
    _custom[key] = m
    return m


def _valance(name, length, count, pos, rot):
    """A hanging scalloped strip: a prism in XY (x along, y up from the hem) rotated
    upright. Two points per scallop plus the cusps."""
    pts = [(-length / 2, 0.0), (length / 2, 0.0)]
    w = length / count
    for j in range(count):
        x1 = length / 2 - j * w
        for t in (0.25, 0.5, 0.75, 1.0):
            depth = 0.06 + 0.04 * math.sin(math.pi * t) if t < 1.0 else 0.06
            pts.append((x1 - t * w, -depth))
    pts.pop()                                   # the last cusp duplicates the first corner
    return L.prism(name, pts, 0.008, pos, "ivory", rot=rot)


def _canopy():
    slab = L.box("canopy", CAN, (0, 0, 0), "ivory")
    fr = _valance("val_f", CAN[0], 12, (0, CAN[1] / 2, -CAN[2] / 2 + 0.005), (90, 0, 0))
    bk = _valance("val_b", CAN[0], 12, (0, -CAN[1] / 2 + 0.008, -CAN[2] / 2 + 0.005), (90, 0, 0))
    lf = _valance("val_l", CAN[1], 7, (-CAN[0] / 2, 0, -CAN[2] / 2 + 0.005), (90, 0, 90))
    rt = _valance("val_r", CAN[1], 7, (CAN[0] / 2 - 0.008, 0, -CAN[2] / 2 + 0.005), (90, 0, 90))
    can = L.join([slab, fr, bk, lf, rt], "canopy_asm", origin=None)
    can.rotation_euler = (0, TILT, 0)
    can.location = (0, 0, CAN_Z)
    return can


def _stripe(o, mat_b, bands=14):
    """Alternate a second material around the sphere by longitude."""
    o.data.materials.append(L.M(mat_b))
    for p in o.data.polygons:
        c = p.center
        a = math.atan2(c.y, c.x)
        if int((a + math.pi) / (2 * math.pi) * bands) % 2 == 1:
            p.material_index = 1


def build():
    rnd = L.rng(NAME)
    parts = []
    # ---- the table
    parts.append(L.box("top", (TW, TD, TT), (0, 0, TOP - TT / 2), "paint_w"))
    parts.append(L.box("rail_b", (TW, 0.03, 0.045), (0, -TD / 2 + 0.015, TOP + 0.02), "paint_w"))
    for sx in (-1, 1):
        parts.append(L.box(f"rail{sx}", (0.03, TD - 0.03, 0.045), (sx * (TW / 2 - 0.015), 0.015, TOP + 0.02), "paint_w"))
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(L.cyl(f"leg{sx}{sy}", LEG_R, TOP - TT, (sx * 0.70, sy * 0.32, (TOP - TT) / 2), "paint_w", n=8))
            parts.append(L.cyl(f"post{sx}{sy}", LEG_R, PH - TOP, (sx * PX, sy * PY, (PH + TOP) / 2), "paint_w", n=8))
    # leg stretchers, low
    for sy in (-1, 1):
        parts.append(L.cyl(f"str{sy}", 0.01, 1.40, (0, sy * 0.32, 0.18), "paint_w", n=6, rot=(0, 90, 0)))
    parts.append(_canopy())

    # ---- fruit, plates, bucket, vases on the top (all inside the table's footprint)
    orange = _mat("fruit_orange", "e8842a", 0.55, "leaf")
    banana = _mat("fruit_banana", "e9c94a", 0.6, "leaf")
    melon = _mat("fruit_melon", "3f7a3e", 0.5, "leaf")
    melon_l = _mat("fruit_melon_l", "8fbf6a", 0.5, "leaf")
    berry = _mat("fruit_berry", "3b4a7a", 0.45, "leaf")
    pine = _mat("fruit_pineapple", "c9a04a", 0.7, "leaf")

    # watermelon, left, on a plate
    parts.append(L.cyl("plate1", 0.17, 0.01, (-0.48, 0.02, TOP + 0.005), "paint_w", n=18))
    wm = L.uv_sphere("melon", 0.13, (-0.48, 0.02, TOP + 0.135), melon, seg=16, rings=10)
    wm.scale = (1.18, 1.0, 0.98)
    _stripe(wm, melon_l)
    parts.append(wm)
    # oranges ×4 in a low bowl beside it
    parts.append(L.cyl("plate2", 0.13, 0.01, (-0.16, -0.12, TOP + 0.005), "paint_w", n=16))
    for k, (dx, dy, dz) in enumerate(((-0.05, -0.03, 0), (0.05, -0.02, 0), (0.0, 0.05, 0), (0.0, 0.0, 0.07))):
        parts.append(L.uv_sphere(f"orange{k}", 0.043, (-0.16 + dx, -0.12 + dy, TOP + 0.053 + dz), orange, seg=10, rings=7))
    # bananas: a hand of five, each two struts in a shallow V
    for k in range(5):
        ang = math.radians(-20 + k * 10)
        cx, cy = -0.02 + 0.04 * k, 0.16 - 0.02 * k
        z = TOP + 0.02 + 0.006 * k
        a = (cx - 0.09 * math.cos(ang), cy - 0.09 * math.sin(ang), z + 0.02)
        m = (cx, cy, z)
        b = (cx + 0.09 * math.cos(ang), cy + 0.09 * math.sin(ang), z + 0.02)
        parts.append(L.strut(f"ban{k}a", a, m, 0.017, banana, n=7))
        parts.append(L.strut(f"ban{k}b", m, b, 0.017, banana, n=7))
    # blueberries: a heaped mound on a small plate
    parts.append(L.cyl("plate3", 0.10, 0.01, (0.28, -0.14, TOP + 0.005), "paint_w", n=16))
    bb = L.uv_sphere("berries", 0.085, (0.28, -0.14, TOP + 0.02), berry, seg=14, rings=8)
    bb.scale = (1.0, 1.0, 0.5)
    L.jitter(bb, 0.006, rnd)
    parts.append(bb)
    # pineapple: a lathe body + a crown of leaves
    px, py = 0.34, 0.14
    body = [(0, 0), (0.05, 0), (0.062, 0.05), (0.064, 0.13), (0.055, 0.19), (0.035, 0.21), (0, 0.21)]
    parts.append(L.lathe("pineapple", body, (px, py, TOP), pine, n=12))
    for k in range(9):
        a = 2 * math.pi * k / 9
        tip = (px + 0.06 * math.cos(a), py + 0.06 * math.sin(a), TOP + 0.33 + 0.02 * (k % 2))
        parts.append(L.bar(f"leaf{k}", (px, py, TOP + 0.20), tip, 0.02, 0.004, "leaf_d"))
    parts.append(L.bar("leaf_c", (px, py, TOP + 0.20), (px + 0.01, py, TOP + 0.36), 0.02, 0.004, "leaf_d"))
    # the steel bucket, right, toward the back
    bucket = [(0, 0), (0.085, 0), (0.088, 0.006), (0.105, 0.22), (0.112, 0.222), (0.112, 0.236),
              (0.102, 0.236), (0.098, 0.222), (0.082, 0.03), (0, 0.03)]
    ST = _flat("steel_flat", "9aa1a6")
    parts.append(L.lathe("bucket", bucket, (0.60, -0.12, TOP), ST, n=16))
    parts.append(L.torus("bucket_handle", 0.10, 0.005, (0.60, -0.12, TOP + 0.24), ST, maj=16, mnr=5, rot=(90, 0, 0)))
    # two small vases with white blooms, toward the back
    vase = [(0, 0), (0.030, 0), (0.036, 0.02), (0.030, 0.10), (0.024, 0.14), (0.028, 0.16), (0.022, 0.16), (0.02, 0.12), (0, 0.12)]
    for k, (vx, vy) in enumerate(((0.12, -0.28), (0.68, -0.30))):
        parts.append(L.lathe(f"vase{k}", vase, (vx, vy, TOP), "glass_pale", n=12))
        parts.append(L.strut(f"stem{k}", (vx, vy, TOP + 0.12), (vx + 0.01, vy, TOP + 0.26), 0.003, "leaf_d", n=5))
        for j in range(5):
            a = 2 * math.pi * j / 5
            r = 0.035 if j else 0.0
            parts.append(L.uv_sphere(f"bloom{k}{j}", 0.030 if j else 0.034,
                                     (vx + r * math.cos(a), vy + r * math.sin(a), TOP + 0.27 + (0.03 if not j else 0.0)),
                                     "white", seg=8, rings=5))
        for j in range(2):
            a = math.pi * j + 0.6
            parts.append(L.uv_sphere(f"vleaf{k}{j}", 0.022, (vx + 0.05 * math.cos(a), vy + 0.05 * math.sin(a), TOP + 0.23),
                                     "leaf", seg=7, rings=4))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
