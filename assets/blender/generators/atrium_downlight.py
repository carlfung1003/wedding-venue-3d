"""atrium_downlight — the round black-trim recessed downlight of the atrium's
soffit (KAN-211 wave B; clubhouse-atrium.jpeg, upper left: a matt black bezel
ring with a dark reflector cone round the lamp).

Origin at the centre of the fitting's TOP, which atrium.js puts on the soffit
boards' face (SOF − 0.022): the bezel flange is 6 mm proud of the boards, a
conical reflector steps up inside it to the lamp plane at y −0.004, where the
game's own emissive `E.down` disc (Ø .11) sits — so the light keeps its
night registry and costs no program. Instanced at exactly buildDownlights()'s
points on both soffits.
"""
import math
import bmesh
import wv_lib as L
import _arch as A

NAME = "atrium_downlight"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.05
AO_STRENGTH = 0.6
TRIS = 120
FRONT = "-Z"
ORIGIN = "top"

N = 12   # 24 cost 44k tris over the 153 fittings; at Ø .20 twelve reads round


def build():
    # (radius, y) profile from the outer rim inward, glTF y (up); Blender z = y
    prof = [(0.100, 0.0), (0.100, -0.006), (0.090, -0.008), (0.062, -0.008),
            (0.052, -0.002)]
    bm = bmesh.new()
    rings = []
    for (r, y) in prof:
        rings.append([bm.verts.new((math.cos(2 * math.pi * k / N) * r,
                                    math.sin(2 * math.pi * k / N) * r, y)) for k in range(N)])
    for a, b in zip(rings, rings[1:]):
        for k in range(N):
            j = (k + 1) % N
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = L.from_bmesh("bezel", bm, (0, 0, 0), "at_black")
    # the faces must point DOWN (seen from below): flip if recalc chose up
    import bpy
    me = o.data
    if sum(p.normal.z for p in me.polygons) > 0:
        for p in me.polygons:
            p.flip()
    root = L.join([o], NAME, origin=None)
    L.shade_smooth(root, angle=40)
    return root
