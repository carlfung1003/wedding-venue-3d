"""wheelbarrow — the galvanised favour barrow heaped with 15 gold favour boxes,
standing at the end of the dessert bar (decor-favor-wheelbarrow.jpg;
refsheets/wheelbarrow.png).

Spec row: pan ~1.20 L × .74 W × .34 deep, rim at y ~.77; front wheel Ø .38 at
z −.78 (front = −Z → Blender +Y); two handles 1.75 long rising toward the back
at x ±.30; two rear legs; 15 gold boxes .105 × .12 × .105 with an ivory ribbon.
Origin floor centre under the pan; front −Z. Budget 6,000 / 512 / bevel .003.
`steel` galvanised (galvanised.webp), `gold` (gold_foil.webp), tyre `dark`.

Two pipeline findings shape the materials here (both reported):
  · Cycles' DIFFUSE-colour bake of a METALLIC key comes out dark (measured:
    `steel` bakes at 0.30 against a 0.60 palette, `gold` 0.63 vs 0.85), so every
    metal part is built on a DIELECTRIC copy of its key (`_dielectric`) and the
    pictures carry the metal look. The GLB material is non-metallic.
  · image_mat(name=<palette key>) hijacks M(key) through the material cache, so
    the image materials are named `galv_tex` / `gold_tex`.

The pan is a lofted rounded-rectangle trough (four rings, solidified 12 mm so
the inside is real), with galvanised.webp planar-projected from above. Fifteen
boxes cannot fill a 1.2 m pan, so an ivory tissue mound sits under them and the
boxes heap on it in two layers, the top ones breaking the rim line as in the
render. Module BEVEL is 0 and only the pan and the boxes are bevelled by hand:
the module bevel runs on the JOINED mesh and would round every tube end.
"""
import math, bmesh
import bpy
import wv_lib as L

NAME = "wheelbarrow"
ATLAS = 512
BEVEL = 0                      # hand-bevelled parts only (see docstring)
AO_DIST = 0.3
AO_STRENGTH = 0.5
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

RIM_Z, BOT_Z = 0.77, 0.43
WHEEL_Y, WHEEL_R = 0.78, 0.19
TUBE_R = 0.014
BOX = (0.105, 0.105, 0.12)


def _dielectric(key, name, rough):
    """A non-metallic copy of a metal palette key, so the DIFFUSE bake keeps its
    brightness; the brushed `metal` finish family still applies."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    r, g, bl = (L.srgb_to_linear(c) for c in L.PALETTE[key])
    b.inputs["Base Color"].default_value = (r, g, bl, 1.0)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = 0.0
    m.diffuse_color = (r, g, bl, 1.0)
    m["wv_key"] = name
    m["wv_family"] = "plain"     # the `metal` family's edge-lightening whitens thin tubes (first shot)
    return m


def _outline(a, b, n=36, p=3.2):
    """Superellipse (rounded rectangle) half-widths a (x) × b (y)."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        pts.append((a * math.copysign(abs(c) ** (2 / p), c), b * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def _pan_bmesh():
    bm = bmesh.new()
    # (half width, half length, z, forward shift) — the rim flares out and forward
    rings_spec = [(0.23, 0.41, BOT_Z, 0.02), (0.30, 0.50, 0.55, 0.03),
                  (0.35, 0.57, 0.68, 0.04), (0.37, 0.60, RIM_Z, 0.045)]
    rings = []
    for a, b, z, fwd in rings_spec:
        rings.append([bm.verts.new((x, y + fwd, z)) for (x, y) in _outline(a, b)])
    n = len(rings[0])
    for j in range(len(rings) - 1):
        lo, hi = rings[j], rings[j + 1]
        for i in range(n):
            k = (i + 1) % n
            bm.faces.new((lo[i], lo[k], hi[k], hi[i]))
    bm.faces.new(rings[0][::-1])                  # the floor
    return bm


def build():
    rnd = L.rng(NAME)
    steel = _dielectric("steel", "steel_d", 0.38)
    galv = L.image_mat("galv_tex", "galvanised.webp", roughness=0.42, fallback="steel")
    gold = L.image_mat("gold_tex", "gold_foil.webp", roughness=0.35, fallback="gold")
    if galv.get("wv_key") == "steel":             # texture missing → the dielectric copy
        galv = steel
    parts = []

    # the pan
    pan = L.from_bmesh("pan", _pan_bmesh(), (0, 0, 0), galv)
    L.solidify(pan, 0.012, offset=-1.0)
    uvl = L.planar_uv(pan, u_axis=0, v_axis=1)
    # planar_uv fits the picture ONCE over the 1.2 m pan → 10 cm spangles that read as
    # camouflage (first shot). Tile it 3.5× for 3 cm spangles (the image node repeats).
    for l in uvl.data:
        l.uv = (l.uv[0] * 3.5, l.uv[1] * 3.5)
    L.bevel([pan], width=0.004, segments=2, angle=40, min_size=0.01)
    parts.append(pan)

    # the frame: handle tubes from the fork to the grips, 1.75 long
    for s in (-1, 1):
        hx = s * 0.30
        parts.append(L.strut(f"handle{s}", (hx, 0.55, 0.21), (hx + s * 0.01, -1.15, 0.60), TUBE_R, steel, n=8))
        parts.append(L.strut(f"fork{s}", (hx, 0.55, 0.21), (s * 0.05, WHEEL_Y, WHEEL_R), TUBE_R, steel, n=8))
        parts.append(L.strut(f"grip{s}", (hx + s * 0.01, -1.15, 0.60), (hx + s * 0.012, -1.29, 0.63), 0.019, "dark", n=8))
        parts.append(L.strut(f"leg{s}", (hx, -0.42, 0.42), (s * 0.34, -0.60, TUBE_R), TUBE_R, steel, n=8))
        parts.append(L.strut(f"legbrace{s}", (hx, -0.12, 0.35), (s * 0.34, -0.60, 0.12), 0.010, steel, n=6))
    parts.append(L.strut("axle", (-0.06, WHEEL_Y, WHEEL_R), (0.06, WHEEL_Y, WHEEL_R), 0.012, steel, n=8))
    parts.append(L.strut("brace_f", (-0.30, 0.30, 0.27), (0.30, 0.30, 0.27), 0.012, steel, n=8))
    parts.append(L.strut("brace_r", (-0.30, -0.12, 0.40), (0.30, -0.12, 0.40), 0.012, steel, n=8))
    parts.append(L.strut("foot", (-0.34, -0.60, TUBE_R), (0.34, -0.60, TUBE_R), TUBE_R, steel, n=8))

    # the wheel: rubber tyre, a pressed-steel rim, hub and five spokes (axis X)
    parts.append(L.torus("tyre", 0.155, 0.036, (0, WHEEL_Y, WHEEL_R), "dark", maj=28, mnr=10, rot=(0, 90, 0)))
    parts.append(L.tube("rim", 0.126, 0.096, 0.05, (0, WHEEL_Y, WHEEL_R), steel, n=24, rot=(0, 90, 0)))
    parts.append(L.cyl("hub", 0.035, 0.075, (0, WHEEL_Y, WHEEL_R), steel, n=12, rot=(0, 90, 0)))
    for k in range(5):
        a = 2 * math.pi * k / 5 + 0.3
        parts.append(L.bar(f"spoke{k}", (0, WHEEL_Y + 0.03 * math.cos(a), WHEEL_R + 0.03 * math.sin(a)),
                           (0, WHEEL_Y + 0.105 * math.cos(a), WHEEL_R + 0.105 * math.sin(a)), 0.022, 0.016, steel))

    # tissue under the favours, then the 15 boxes heaped on it
    mound = L.sphere("tissue", 1.0, (0, 0.02, 0.56), "ivory", sub=3)
    mound.scale = (0.27, 0.45, 0.18)
    L.jitter(mound, 0.02, rnd)
    parts.append(mound)

    def mound_z(x, y):
        q = 1 - (x / 0.27) ** 2 - ((y - 0.02) / 0.45) ** 2
        return 0.56 + 0.18 * math.sqrt(max(q, 0.0))

    spots = [(s * 0.115, -0.36 + i * 0.18) for i in range(5) for s in (-1, 1)]      # lower layer, 10
    spots += [(0.0, -0.30 + i * 0.15) for i in range(5)]                             # upper layer, 5
    for i, (bx, by) in enumerate(spots):
        bx += rnd.uniform(-0.015, 0.015)
        by += rnd.uniform(-0.02, 0.02)
        bz = mound_z(bx, by) + BOX[2] / 2 - 0.01 + (0.115 if i >= 10 else 0.0)
        yaw = rnd.uniform(-35, 35)
        tilt = rnd.uniform(-7, 7)
        box = L.box(f"box{i}", BOX, (bx, by, bz), gold, rot=(tilt, 0, yaw))
        L.planar_uv(box, u_axis=0, v_axis=2)
        L.bevel([box], width=0.003, segments=2, angle=40, min_size=0.01)
        parts.append(box)
        # the ivory ribbon: two bands over the lid and a bow on top
        top = bz + BOX[2] / 2
        parts.append(L.box(f"rib_x{i}", (BOX[0] + 0.004, 0.014, 0.004), (bx, by, top + 0.001), "ivory", rot=(tilt, 0, yaw)))
        parts.append(L.box(f"rib_y{i}", (0.014, BOX[1] + 0.004, 0.004), (bx, by, top + 0.001), "ivory", rot=(tilt, 0, yaw)))
        bow = L.sphere(f"bow{i}", 0.026, (bx, by, top + 0.018), "ivory", sub=1)
        bow.scale = (1.15, 1.15, 0.75)
        parts.append(bow)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
