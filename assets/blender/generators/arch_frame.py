"""arch_frame — one slim white arch frame (decor-ceremony-main.jpg: the two white
frames outboard of the aisle, each hanging a bead chandelier).

Spec row: two posts Ø .096 (r .048) at x ±1.12, h 2.30; a semicircular arch
r 1.12 of the same tube on top → apex y 3.42. Spans X. Origin floor centre
between the posts; front −Z (the arch is symmetric, so front is moot).
Material `paint_w`, satin. Budget 2,000 / 256 / bevel 0.

The arch is a true half-torus swept as a bmesh (36 segments over π, 14-gon
section) whose end rings land exactly on the post tops, so the joint is a
continuous tube with no cap showing. Two small foot flanges (r .075 × .012)
ground the posts the way the refsheet's do — the render buries them in grass.
"""
import math, bmesh
import wv_lib as L

NAME = "arch_frame"
ATLAS = 256
BEVEL = 0                      # tubes: nothing to bevel; smooth-by-angle does the work
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2000
FRONT = "-Z"
ORIGIN = "floor"

R_TUBE = 0.048
X_POST = 1.12                  # also the arch's major radius
H_POST = 2.30
SEG_ARC, SEG_TUBE = 36, 14


def _half_torus():
    """Tube of radius R_TUBE swept along a semicircle of radius X_POST in the XZ
    plane, centred on (0, 0, H_POST), from the +X post top over to the −X post
    top. Open ends: the posts' caps close them."""
    bm = bmesh.new()
    rings = []
    for i in range(SEG_ARC + 1):
        a = math.pi * i / SEG_ARC                       # 0 at +X, π at −X
        cx, cz = X_POST * math.cos(a), H_POST + X_POST * math.sin(a)
        # local frame of the section: radial (in XZ) and the Y axis
        rx, rz = math.cos(a), math.sin(a)
        ring = []
        for k in range(SEG_TUBE):
            b = 2 * math.pi * k / SEG_TUBE
            u, v = R_TUBE * math.cos(b), R_TUBE * math.sin(b)
            ring.append(bm.verts.new((cx + rx * u, v, cz + rz * u)))
        rings.append(ring)
    for j in range(SEG_ARC):
        a, b = rings[j], rings[j + 1]
        for k in range(SEG_TUBE):
            k2 = (k + 1) % SEG_TUBE
            bm.faces.new([a[k], a[k2], b[k2], b[k]])
    return bm


def build():
    parts = []
    for s in (-1, 1):
        parts.append(L.cyl(f"post{s}", R_TUBE, H_POST, (s * X_POST, 0, H_POST / 2), "paint_w", n=SEG_TUBE))
        parts.append(L.cyl(f"foot{s}", 0.075, 0.012, (s * X_POST, 0, 0.006), "paint_w", n=20))
    parts.append(L.from_bmesh("arch", _half_torus(), (0, 0, 0), "paint_w"))
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)
    return root
