"""atrium_stair — the open-riser gallery stair as a built object (KAN-211 wave B;
clubhouse-atrium.jpeg, left: thick near-black stone treads floating between two
dark steel stringer plates, point-fixed glass with a flat copper cap rail).

SITE FRAME (atrium centre). The flight's numbers are atrium.js's STAIR, derived
in _arch.atrium() with the same arithmetic: x −8, width 1.6, 16 risers of
H1/16, going 0.45, foot at SITE.ATRIUM.stair.z + 3.1 (−43.9), top −51.1.

⚠ THE TREAD TOPS ARE THE PUBLISHED HEIGHTS: tread i's top is (i+1)·rise
exactly — site.js registers the flight as a ramp and the walker never touches
this mesh, but a tread off its height reads as feet sinking into stone.

Parts:
  · 16 treads, 70 mm honed stone, 0.40 deep (going 0.45: a 50 mm open joint
    between treads seen from the side, as the photo's), 20 mm bevelled nosing
  · a steel cleat under each tread, tying it to both stringers
  · WEST stringer: a 12 mm × 0.42 plate at x −8.87 (the stringer line the
    colliders already guard), its top edge 30 mm under the nosings, cut level
    at the court floor and plumb at the landing
  · EAST stringer: a slimmer 0.26 plate at x −7.15 under the glass side
  · the landing nosing strip where the flight meets the 2F deck (zTop)
The glass stays atrium.js's (transparent — a bake cannot be glass); the copper
cap rail and the stainless posts are the shared `atrium_rail` /
`atrium_baluster` modules, placed on this flight's slope by atrium.js.
"""
import math
import bmesh
import wv_lib as L
import _arch as A

NAME = "atrium_stair"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.5
TRIS = 2400
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"


def _plate(name, xa, xb, poly, key):
    """A plate: polygon `poly` of (z, y) site points, extruded over x ∈ [xa, xb]."""
    bm = bmesh.new()
    lo = [bm.verts.new(A.B_(xa, y, z)) for (z, y) in poly]
    hi = [bm.verts.new(A.B_(xb, y, z)) for (z, y) in poly]
    bm.faces.new(lo)
    bm.faces.new(list(reversed(hi)))
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return L.from_bmesh(name, bm, (0, 0, 0), key)


def build():
    T = A.atrium()
    S = T["STAIR"]
    H1 = T["H1"]
    x, w, n, rise, going, zF, zT = S["x"], S["w"], S["risers"], S["rise"], S["going"], S["zFoot"], S["zTop"]
    slope = rise / going
    # the nosing line: through every tread's front-top corner
    nose = lambda z: (zF - z) * slope            # 0 at the foot, H1 at zT
    parts = []
    with A.frame("atrium"):
        for i in range(n):
            top = (i + 1) * rise
            zc = zF - (i + 0.5) * going
            za, zb = zc - 0.20, zc + 0.20
            t = A.box(f"tread{i}", x - w / 2, x + w / 2, top - 0.07, top, za, zb, "at_col")
            L.bevel([t], width=0.012, segments=2)
            parts.append(t)
            parts.append(A.box(f"cleat{i}", x - w / 2 - 0.06, x + w / 2 + 0.03, top - 0.11, top - 0.07,
                               zc - 0.03, zc + 0.03, "at_steel"))
        # WEST stringer: top edge 30 mm under the nosing line, 0.42 deep
        zf0, zt0 = zF + 0.05, zT
        def poly(depth, drop):
            yt = lambda z: nose(z) + rise / 2 - drop
            zb = zF - (depth - rise / 2 + drop) / slope   # where the bottom edge meets y 0
            pts = [(zf0, 0.0), (zf0, max(0.0, yt(zf0)))] if yt(zf0) > 0 else [(zf0, 0.0)]
            pts += [(zt0, yt(zt0)), (zt0, yt(zt0) - depth)]
            if zb < zf0:
                pts.append((zb, 0.0))
            return pts
        parts.append(_plate("stringerW", x - w / 2 - 0.076, x - w / 2 - 0.064, poly(0.42, 0.10), "at_steel"))
        parts.append(_plate("stringerE", x + w / 2 + 0.044, x + w / 2 + 0.056, poly(0.26, 0.12), "at_steel"))
        # the landing nosing where the flight meets the upper deck
        ln = A.box("landing_nose", x - w / 2, x + w / 2, H1 - 0.07, H1 + 0.001, zT - 0.08, zT, "at_col")
        L.bevel([ln], width=0.01, segments=2)
        parts.append(ln)
        return L.join(parts, NAME, origin=None)
