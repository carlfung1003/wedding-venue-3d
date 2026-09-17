"""hat_rack — straw hats pegged on three lines between two posts
(decor-plinths-and-hats.jpg, right half; refsheets/hat_rack.png).

Spec row: two `oak_d` posts .085² × 2.28 at x ±1.75; three lines (Ø .006, slight
sag) at y 1.98 / 1.43 / .88; 5 hats per line, each hanging with its centre .21
below the line at x = −1.75 + (i + .5)·.70, brim facing −Z (brim r .20 × .016,
crown r .115 × .10, dark band); a fluted basket r .42 × .38 at (x 1.15, z .62)
holding 4 stacked hats. Origin floor centre; front −Z. Budget 9,000 / 512 / 0.

Each hat is a brim disc + a lathe crown with a rounded top + a band, joined,
then hung flat against its line with a per-hat random tilt (rng) and a timber
peg on the line above it. `straw_weave.webp` goes on the crown by cylindrical_uv
and on the brim by planar_uv when it exists; otherwise the hats alternate the
flat `straw` / `straw_d` keys (the straw family bakes a weave anyway).
"""
import math, os, bmesh
import bpy
import wv_lib as L

NAME = "hat_rack"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 9000
FRONT = "-Z"
ORIGIN = "floor"

POST_X, POST_S, POST_H = 1.75, 0.085, 2.28
LINES = (1.98, 1.43, 0.88)
SAG = 0.06
HAT_DROP = 0.21
BRIM_R, BRIM_T = 0.20, 0.016
CROWN_R, CROWN_H = 0.115, 0.10
BASKET = (1.15, -0.62)             # spec (x 1.15, z .62) in glTF → Blender y −.62
BASKET_R, BASKET_H = 0.42, 0.38
TEX = "straw_weave.webp"



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

def _has_tex():
    return os.path.exists(os.path.join(L.TEX_GEN, TEX))


def _straw(k):
    if _has_tex():
        return L.image_mat("straw_weave", TEX, roughness=0.85, fallback="straw")
    return "straw" if k % 2 == 0 else "straw_d"


def _hat(i, mat, rnd):
    """A hat lying flat: brim in XY at z 0, crown up +Z. Returns the joined object."""
    brim = L.cyl(f"brim{i}", BRIM_R, BRIM_T, (0, 0, BRIM_T / 2), mat, n=20)
    prof = [(CROWN_R, 0), (CROWN_R, CROWN_H * 0.62), (CROWN_R * 0.95, CROWN_H * 0.80),
            (CROWN_R * 0.78, CROWN_H * 0.94), (CROWN_R * 0.45, CROWN_H), (0, CROWN_H)]
    crown = L.lathe(f"crown{i}", prof, (0, 0, BRIM_T - 0.002), mat, n=16)
    band = L.cyl(f"band{i}", CROWN_R + 0.004, 0.026, (0, 0, BRIM_T + 0.018), "straw_band", n=16)
    if _has_tex():
        L.cylindrical_uv(crown, axis=2, repeat=3.0)
        L.planar_uv(brim, u_axis=0, v_axis=1)
        for o in (crown, brim):
            uvl = o.data.uv_layers.get(L.ART_UV)
            du, dv = rnd.random(), rnd.random()
            for d in uvl.data:
                u, v = d.uv
                d.uv = (u * (1.0 if o is crown else 1.6) + du, v * 0.6 + dv)
    hat = L.join([brim, crown, band], f"hat{i}", origin=None)
    L.shade_smooth(hat, angle=40)
    return hat


def _line(k, z0):
    """A sagging line post to post as a chain of struts."""
    parts = []
    x0, x1 = -POST_X + POST_S / 2, POST_X - POST_S / 2
    n = 14
    pts = []
    for j in range(n + 1):
        t = j / n
        x = x0 + (x1 - x0) * t
        pts.append((x, 0.0, z0 - SAG * 4 * t * (1 - t)))
    for j in range(n):
        parts.append(L.strut(f"line{k}_{j}", pts[j], pts[j + 1], 0.003, "oak", n=5))
    return parts


def _line_z(z0, x):
    t = (x + POST_X) / (2 * POST_X)
    return z0 - SAG * 4 * t * (1 - t)


def _basket():
    """A fluted (ribbed) basket drum, closed bottom, with a rolled rim."""
    flutes, seg, depth = 22, 3, 0.014
    n = flutes * seg
    bm = bmesh.new()
    rings = []
    for z, r in ((0.0, BASKET_R * 0.86), (0.05, BASKET_R * 0.92), (BASKET_H - 0.05, BASKET_R), (BASKET_H, BASKET_R * 0.99)):
        ring = []
        for i in range(n):
            t = (i % seg) / seg
            rr = r - depth * math.sin(math.pi * t)
            a = 2 * math.pi * i / n
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            bm.faces.new([a[i], a[i2], b[i2], b[i]])
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    drum = L.from_bmesh("basket", bm, (BASKET[0], BASKET[1], 0), "straw_d")
    rim = L.torus("basket_rim", BASKET_R - 0.004, 0.014, (BASKET[0], BASKET[1], BASKET_H), "straw_d", maj=24, mnr=6)
    return [drum, rim]


def build():
    ST = _flat("steel_flat", "9aa1a6")
    rnd = L.rng(NAME)
    parts = []
    for sx in (-1, 1):
        parts.append(L.box(f"post{sx}", (POST_S, POST_S, POST_H), (sx * POST_X, 0, POST_H / 2), "oak_d"))
        # the line hooks on the posts' inner faces
        for k, z0 in enumerate(LINES):
            parts.append(L.cyl(f"hook{sx}{k}", 0.008, 0.03, (sx * (POST_X - POST_S / 2 - 0.01), 0, z0), ST, n=6, rot=(0, 90, 0)))
    for k, z0 in enumerate(LINES):
        parts += _line(k, z0)
    hi = 0
    for k, z0 in enumerate(LINES):
        for i in range(5):
            x = -POST_X + (i + 0.5) * 0.70
            zl = _line_z(z0, x)
            hat = _hat(hi, _straw(hi), rnd)
            # hang it: brim toward +Y (the front), crown proud; a slight random tilt
            hat.rotation_euler = (math.radians(-90 + rnd.uniform(-4, 4)), math.radians(rnd.uniform(-7, 7)), 0)
            hat.location = (x + rnd.uniform(-0.01, 0.01), 0.006, zl - HAT_DROP)
            parts.append(hat)
            # the peg on the line, over the brim's top edge
            parts.append(L.box(f"peg{hi}", (0.012, 0.028, 0.045), (x, 0.004, zl + 0.004), "oak"))
            hi += 1
    parts += _basket()
    # four spare hats stacked in the basket, each tipped a little more
    for j in range(4):
        hat = _hat(hi, _straw(hi), rnd)
        hat.rotation_euler = (math.radians(14 + 5 * j), math.radians(-6 + 4 * j), math.radians(rnd.uniform(0, 360)))
        hat.location = (BASKET[0] + 0.02 * j - 0.03, BASKET[1] + 0.015 * j, BASKET_H - 0.08 + 0.038 * j)
        parts.append(hat)
        hi += 1
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
