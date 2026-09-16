"""plinth_fluted — the fluted cylinder plinth at the dessert bar's near end.

*unit*: r 0.5 × h 1.0, 24 flutes; the game scales it (e.g. [.30, .96, .30]).
Origin base centre. Material `flute`. Budget 1,200 tris / 256 atlas.

The drum is a bmesh: a ring of 24 concave grooves between two plain bands, so
the flutes are real geometry that catches the sun (the procedural version was a
14-gon with flatShading standing in for fluting). The ridges are left sharp by
smooth-by-angle; only the bands are bevelled.
"""
import math, bmesh
import wv_lib as L

NAME = "plinth_fluted"
ATLAS = 256
# BEVEL = 0 here on purpose: the module-level bevel runs on the JOINED mesh at any
# edge ≥ 40°, which would round every flute ridge (×4 faces on the drum). The two
# plain bands get their own bevel below instead.
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"

R, H = 0.5, 1.0
FLUTES, SEG = 24, 5          # 24 grooves, 5 segments each -> 120 verts per ring
DEPTH = 0.022                # groove depth
BAND = 0.045                 # plain band at the foot and the top


def _drum(z0, z1):
    bm = bmesh.new()
    rings = []
    n = FLUTES * SEG
    for z in (z0, z1):
        ring = []
        for i in range(n):
            t = (i % SEG) / SEG                       # 0..1 across one flute
            r = R - DEPTH * math.sin(math.pi * t)     # concave groove, ridge at t = 0
            a = 2 * math.pi * i / n
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    a, b = rings
    for i in range(n):
        i2 = (i + 1) % n
        bm.faces.new([a[i], a[i2], b[i2], b[i]])
    # no end caps: the bands' own caps cover both ends
    return L.from_bmesh("drum", bm, (0, 0, 0), "flute")


def build():
    parts = []
    drum = _drum(BAND, H - BAND)
    parts.append(drum)
    for z in (BAND / 2, H - BAND / 2):
        band = L.cyl("band", R, BAND, (0, 0, z), "flute", n=32)   # 32: 2 bands × bevel = 760 tris; 48 blew the budget
        L.bevel([band], width=0.004, segments=2, angle=40, min_size=0.01)
        parts.append(band)
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)        # grooves smooth, ridges + band edges sharp
    return root
