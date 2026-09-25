"""atrium_frame — the dark edge beams round the atrium's open court, both
storeys (KAN-211 wave B; clubhouse-atrium.jpeg: the soffit ends at the court in
a deep near-black beam, the one hard line that frames the sky).

SITE FRAME (generators/_arch.py, `frame("atrium")`): origin at the atrium
centre (SITE.ATRIUM.cx, 0, cz) = (8, 0, −41), one identity instance in
atrium.js. Every number is read from the live js/site.js via A.atrium().

Each beam hangs under its slab on the court edge, 0.30 wide, dropping 0.28
below the soffit (so it closes the boards' ends), with a 20 mm shadow reveal
where it meets the boards. The ground storey's west beam runs only from the
stairwell's south end (WELL.z1) to CZ1: north of that the flight rises beside
the edge and its balustrade glass would run through a beam.
Headroom under the beam: SOF1 − 0.28 = 2.97 m. No collider involved.
"""
import wv_lib as L
import _arch as A

NAME = "atrium_frame"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.45
TRIS = 2200
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"

DROP, BW = 0.28, 0.30


def build():
    T = A.atrium()
    CX0, CX1, CZ0, CZ1 = T["CX0"], T["CX1"], T["CZ0"], T["CZ1"]
    W = T["WELL"]
    with A.frame("atrium"):
        parts = []
        for s, sof in (("g", T["SOF1"]), ("u", T["SOF2"])):
            y0 = sof - DROP
            runs = [
                ("n", CX0 - BW, CX1 + BW, CZ0 - BW, CZ0),     # under the north gallery
                ("s", CX0 - BW, CX1 + BW, CZ1, CZ1 + BW),     # south
                ("e", CX1, CX1 + BW, CZ0, CZ1),               # east
                ("w", CX0 - BW, CX0, W["z1"] if s == "g" else CZ0, CZ1),   # west
            ]
            for tag, xa, xb, za, zb in runs:
                along_x = (xb - xa) > (zb - za)
                segs = A.spans(xa, xb, 5.0) if along_x else A.spans(za, zb, 5.0)
                for k, (a, b) in enumerate(segs):
                    if along_x:
                        bx = A.box(f"beam{s}{tag}{k}", a, b, y0, sof - 0.02, za, zb, "at_beam")
                        parts.append(bx)
                    else:
                        parts.append(A.box(f"beam{s}{tag}{k}", xa, xb, y0, sof - 0.02, a, b, "at_beam"))
                # the shadow reveal between the beam and the boards (inset 15 mm)
                if along_x:
                    parts.append(A.box(f"rev{s}{tag}", xa + 0.015, xb - 0.015, sof - 0.02, sof,
                                       za + 0.015, zb - 0.015, "at_black"))
                else:
                    parts.append(A.box(f"rev{s}{tag}", xa + 0.015, xb - 0.015, sof - 0.02, sof,
                                       za + 0.015, zb - 0.015, "at_black"))
        o = L.join(parts, NAME, origin=None)
        L.bevel([o], width=0.006, segments=1, angle=40)
        return o
