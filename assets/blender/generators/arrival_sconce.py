"""arrival_sconce — the fluted brass cylinder sconce flanking the entry doors
(KAN-211 wave A; entrance-arrival-brief.md §1, frames f_011/f_013/f_017).

⚠ GEOMETRY ONLY (BAKE = False). The sconce GLOWS: it rides the game's own
`MAT.brassFlute` (campus.js — map + emissiveMap texFlute, repeat 4 × 1, on the
night glow registry, .5 by day → 2.2 at night), exactly as the `UNIT_CYL` it
replaces did, so the instanced brassFlute program the old bucket compiled is
the one this compiles. A baked atlas cannot glow; the game's material can.

Shape (f_013): a slim vertical cylinder of vertical brass flutes, closed top and
bottom by two plain brass collars with a thin dark shadow line inside each.
Ø 0.20 × 0.80 m (the old cylinder was Ø .22 × 1.2 and ran up through the
canopy soffit — see arrival_entry's docstring). Origin at the CENTRE; campus.js
stands it off its bronze backplate on the pier front.

UV0: u around the axis (cylindrical_uv, seam at the back, toward the pier), v up
— texFlute is stripes along v, so the material's repeat.x = 4 lays 32 highlights
round it, two per geometric flute.
"""
import math
import bmesh
import wv_lib as L

NAME = "arrival_sconce"
ATLAS = 256
BAKE = False
BEVEL = 0
TRIS = 700
FRONT = "-Z"
ORIGIN = "centre"

R, H, FLUTES = 0.10, 0.80, 16


def build():
    bm = bmesh.new()
    rings = []
    # the fluted body between the collars, plus the collars as plain rings
    prof = [(-H / 2, R + 0.006), (-H / 2 + 0.06, R + 0.006), (-H / 2 + 0.06, R - 0.012),
            (-H / 2 + 0.075, R - 0.012), (-H / 2 + 0.075, None), (H / 2 - 0.075, None),
            (H / 2 - 0.075, R - 0.012), (H / 2 - 0.06, R - 0.012), (H / 2 - 0.06, R + 0.006),
            (H / 2, R + 0.006)]
    N = FLUTES * 2
    for (z, r) in prof:
        ring = []
        for k in range(N):
            a = 2 * math.pi * k / N
            rr = r if r is not None else (R if k % 2 == 0 else R - 0.014)
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, z)))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(N):
            j = (k + 1) % N
            bm.faces.new((a[k], a[j], b[j], b[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = L.from_bmesh("sconce", bm, (0, 0, 0), "gold")
    root = L.join([o], NAME, origin=None)
    L.shade_smooth(root, angle=50)
    L.cylindrical_uv(root, layer="UVMap", axis=2, repeat=1.0, v_from_height=True)
    return root
