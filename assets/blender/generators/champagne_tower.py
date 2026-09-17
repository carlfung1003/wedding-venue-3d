"""champagne_tower — the prewedding champagne tower (refsheets/champagne_tower.png).

Spec row: draped round table r .60, top y .78; a coupe pyramid 9 / 4 / 1 (coupe
r .05 × .14), frosted and OPAQUE — this replaces a `transmission` material that
made the whole campus render a third time. Origin floor centre.
Budget 5,000 / 512 / bevel 0.

The skirt is a bmesh drum whose radius is modulated by 32 pleats (4 segments
each) that deepen toward the floor and flare a little at the hem, carrying
`linen_ivory.webp` by cylindrical_uv; the top is a linen disc. Coupes are
lathes: foot, stem, a wide shallow bowl with a modelled inner surface so the
tower reads from above too; each upper coupe's foot sits on the rims of the four
below it.

NOTE — the coupes use a local `coupe_frost` material (colour `glass_pale`,
roughness .5, metallic 0) rather than the `glass_pale` key: apply_baked gives the
WHOLE asset the roughness of the key with the most faces, and 14 coupes out-count
the skirt, so `glass_pale`'s .15 was turning the tablecloth into satin. Frosted
glass is matte anyway.
"""
import math, os, bmesh
import bpy
import wv_lib as L

NAME = "champagne_tower"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 5000
FRONT = "-Z"
ORIGIN = "floor"

TABLE_R, TABLE_Z = 0.60, 0.78
PLEATS, PER = 32, 4
SEG = PLEATS * PER
COUPE_R, COUPE_H = 0.05, 0.14
PITCH = 0.105
TEX = "linen_ivory.webp"
TEX_METRES = 0.5            # the weave picture reads as about half a metre of cloth


def _flat(key, hexstr, rough, family):
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


def _uv_scale(o, su, sv):
    uvl = o.data.uv_layers.get(L.ART_UV)
    for d in uvl.data:
        u, v = d.uv
        d.uv = (u * su, v * sv)


def _skirt(mat):
    bm = bmesh.new()
    #        z,           pleat, flare
    levels = [(TABLE_Z, 0.0, 0.0), (TABLE_Z - 0.04, 0.35, 0.0), (0.52, 0.75, 0.004),
              (0.26, 0.95, 0.012), (0.0, 1.0, 0.024)]
    rings = []
    for z, pleat, flare in levels:
        ring = []
        for i in range(SEG):
            a = 2 * math.pi * i / SEG
            r = TABLE_R + flare + 0.030 * pleat * math.sin(PLEATS * a)
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        a, b = rings[j], rings[j + 1]
        for i in range(SEG):
            i2 = (i + 1) % SEG
            bm.faces.new([a[i], a[i2], b[i2], b[i]])
    return L.from_bmesh("skirt", bm, (0, 0, 0), mat)


def _coupe_profile():
    r, h = COUPE_R, COUPE_H
    return [(0, 0), (0.026, 0), (0.030, 0.004), (0.012, 0.010), (0.006, 0.030), (0.006, 0.080),
            (0.016, 0.098), (0.038, 0.110), (r, 0.126), (r, h), (0.030, 0.114), (0, 0.104)]


def build():
    linen = L.image_mat("linen_ivory", TEX, roughness=0.85, fallback="linen")
    skirt = _skirt(linen)
    top = L.cyl("top", TABLE_R - 0.003, 0.012, (0, 0, TABLE_Z - 0.006), linen, n=64)
    if _has_tex():
        L.cylindrical_uv(skirt, axis=2, repeat=(2 * math.pi * TABLE_R) / TEX_METRES)
        _uv_scale(skirt, 1.0, TABLE_Z / TEX_METRES)
        L.planar_uv(top, u_axis=0, v_axis=1)
        _uv_scale(top, (2 * TABLE_R) / TEX_METRES, (2 * TABLE_R) / TEX_METRES)
    parts = [skirt, top]
    frost = _flat("coupe_frost", "dfeef0", 0.5, "glass")
    prof = _coupe_profile()
    k = 0
    for level, n in enumerate((3, 2, 1)):
        z = TABLE_Z + level * COUPE_H
        for i in range(n):
            for j in range(n):
                x = (i - (n - 1) / 2) * PITCH
                y = (j - (n - 1) / 2) * PITCH
                parts.append(L.lathe(f"coupe{k}", prof, (x, y, z), frost, n=10))
                k += 1
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
