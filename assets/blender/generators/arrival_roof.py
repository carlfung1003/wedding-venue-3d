"""arrival_roof — the arrival pavilion's folded MONO-PITCH roof (KAN-211 wave A).

Replaces campus.js buildArrival §C's roof slab, its warm-timber soffit box, the
front fascia and the loose "fold" plate — keeping the massing exactly:

    slab     .34 thick, centred on the line eaveH 7.15 at wings[0].z0 (−22.0)
             → ridgeH 9.20 at wings[1].z1 (2.2), i.e. y_c(z); x roofCX ± roofW/2
             = 36.8 ± 8.1 → 28.7 … 44.9; z −22.1 … 2.3                (campus.js)
    soffit   its underside lined, bottom at y_c − .26 — the plane the game's seven
             `arrDownI` downlights (x 31.5, y_c − .27) are flush with, so they
             stay where they are and still read recessed
    no colliders (the roof is 7 m up)

What this adds from the photographs:
  · STANDING SEAMS down the slope (the roof is the same standing-seam corten as
    the walls — f_001's roof band), one every 0.6 m across the whole width;
  · a deep FASCIA (0.46 m) round all four edges with a slim drip, so the roof
    reads as a folded plate and not as a tilted box (f_001, f_002, f_005);
  · the courtyard overhang's soffit is the photograph's warm reddish cedar
    (clubhouse-lounge-checkin-balcony.jpg — its signature colour), board-lined
    across the overhang; the soffit over the lobby (hidden above its ceiling at
    7.0) is not built.
  · THE FOLD: f_001's origami line where the fascia over the entry bay kinks
    down — a folded plate on the arrival edge, over the bay only.
"""
import wv_lib as L
import _arch as A

NAME = "arrival_roof"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.6
AO_STRENGTH = 0.5
TRIS = 5000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"   # hundreds of thin seam/slat islands — see wv_bake.prepare_for_export
UV_WEIGHT = {"corten": 1.0, "corten_top": 0.12, "corten_seam": 0.25, "cedar": 1.0, "corten_in": 0.03}


def build():
    S = A.site()
    AR = S["AR"]
    z0w, z1w = AR["wings"][0]["z0"], AR["wings"][1]["z1"]
    slope = (AR["ridgeH"] - AR["eaveH"]) / (z1w - z0w)

    def yc(z):
        return AR["eaveH"] + (z - z0w) * slope
    bw = AR["bldg"]["x1"] - AR["bldg"]["x0"]
    bcx = (AR["bldg"]["x0"] + AR["bldg"]["x1"]) / 2
    X0, X1 = bcx - 2.0 - (bw + 4.6) / 2, bcx - 2.0 + (bw + 4.6) / 2      # 28.7 … 44.9
    Z0, Z1 = (z0w + z1w) / 2 - (z1w - z0w + 0.2) / 2, (z0w + z1w) / 2 + (z1w - z0w + 0.2) / 2
    top, core = A.corten("corten_top"), A.corten("corten_in")
    cort, seam, ced = A.corten("corten"), A.corten_dark("corten_seam"), A.cedar("cedar")
    parts = []

    def slab(name, xa, xb, za, zb, d0, d1, mat):
        """a sheet between offsets d0 < d1 from the centre line, over x/z"""
        c = [(xa, yc(za) + d0, za), (xb, yc(za) + d0, za), (xb, yc(zb) + d0, zb), (xa, yc(zb) + d0, zb),
             (xa, yc(za) + d1, za), (xb, yc(za) + d1, za), (xb, yc(zb) + d1, zb), (xa, yc(zb) + d1, zb)]
        return A.hexa(name, c, mat)

    # the slab core + its top skin
    parts.append(slab("slab", X0, X1, Z0, Z1, -0.17, 0.17, core))
    parts.append(A.world_uv(slab("slab_top", X0, X1, Z0, Z1, 0.17, 0.182, top)))
    # standing seams down the slope
    n = round((X1 - X0) / 0.6)
    for i in range(1, n):
        x = X0 + (X1 - X0) * i / n
        parts.append(A.world_uv(slab(f"rs{i}", x - 0.024, x + 0.024, Z0, Z1, 0.182, 0.232, seam)))

    # the fascia: all four edges, 0.46 deep, proud 0.03, with a drip lip
    FD = 0.46
    def fascia_x(name, x, out):
        xa, xb = (x, x + out * 0.035) if out > 0 else (x + out * 0.035, x)
        for k, (za, zb) in enumerate(A.spans(Z0, Z1)):
            c = [(xa, yc(za) - 0.27, za), (xb, yc(za) - 0.27, za), (xb, yc(zb) - 0.27, zb), (xa, yc(zb) - 0.27, zb),
                 (xa, yc(za) - 0.27 + FD, za), (xb, yc(za) - 0.27 + FD, za),
                 (xb, yc(zb) - 0.27 + FD, zb), (xa, yc(zb) - 0.27 + FD, zb)]
            parts.append(A.world_uv(A.hexa(f"{name}{k}", c, cort)))
    fascia_x("fascia_e", X1, +1)
    fascia_x("fascia_w", X0, -1)
    for name, z, out in (("fascia_n", Z0, -1), ("fascia_s", Z1, +1)):
        za, zb = (z, z + out * 0.035) if out > 0 else (z + out * 0.035, z)
        y = yc(z) - 0.27
        for k, (xa, xb) in enumerate(A.spans(X0 - 0.035, X1 + 0.035)):
            parts.append(A.world_uv(A.box(f"{name}{k}", xa, xb, y, y + FD, za, zb, cort)))

    # THE FOLD over the entry bay: the arrival fascia kinks down in a folded
    # plate — a triangular drop 0.55 m deep at the bay centre (f_001/f_005)
    bay0, bay1 = AR["bay"]["z0"], AR["bay"]["z1"]
    zm = (bay0 + bay1) / 2
    import bmesh
    bm = bmesh.new()
    xo, xi = X1 + 0.035, X1 + 0.07
    pts = []
    for (z, drop) in ((bay0 - 0.6, 0.0), (zm, 0.55), (bay1 + 0.6, 0.0)):
        pts.append((z, yc(z) - 0.27 - drop))
    vs = []
    for xx in (xo, xi):
        row = [bm.verts.new(A.B_(xx, y, z)) for (z, y) in pts]
        row.append(bm.verts.new(A.B_(xx, yc(pts[2][0]) - 0.27 + 0.02, pts[2][0])))
        row.append(bm.verts.new(A.B_(xx, yc(pts[0][0]) - 0.27 + 0.02, pts[0][0])))
        vs.append(row)
    for row in vs:
        bm.faces.new(row)
    a, b = vs
    k = len(a)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    parts.append(A.world_uv(L.from_bmesh("fold", bm, (0, 0, 0), cort)))

    # the cedar soffit under the courtyard overhang: bottom at y_c − .26
    xo0, xo1 = X0 + 0.04, AR["backX"] + 0.30
    for k, (za, zb) in enumerate(A.spans(Z0 + 0.04, Z1 - 0.04, 4.0)):
        parts.append(A.world_uv(slab(f"soffit{k}", xo0, xo1, za, zb, -0.26, -0.17, ced),
                                tile=1.2, rot=True))
    # under the thin arrival-side overhang too (44.6 … 44.9)
    parts.append(A.world_uv(slab("soffit_e", AR["faceX"], X1 - 0.02, Z0 + 0.04, Z1 - 0.04, -0.26, -0.17, ced),
                            tile=1.2, rot=True))

    return L.join(parts, NAME, origin=None)
