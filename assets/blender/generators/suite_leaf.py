"""suite_leaf — ONE bi-fold leaf of the suite's folding glass wall (KAN-211 wave C).

A MODULE (frame "local"), instanced by js/suite.js at every leaf's own matrix:
the closed run, the one leaf swung open and the eight in the folded stack
(buildFoldingGlassWall) — 13 today. Replaces makeLeaf()'s five sapele slabs
(two stiles, two rails and the mid-rail); the leaf's GLASS stays the game's
transparent MT.glass slab.

Frame: origin at the leaf's bottom centre, +X along the leaf (w = leafW 0.95),
+Y up (h = leafH 2.8), Z through the thickness (t 0.09) — exactly makeLeaf's
frame, so the group matrix suite.js already computes is the instance matrix.

IMG_8096 (the great room's wall, Carl's photo) settles the detail: slim deep
red-brown frames with NO mid-rail (makeLeaf had one at 0.52 h), a slightly
deeper bottom rail, a glazing bead round the pane, a long slim pull on one
stile (both faces) and three hinge knuckles on the other. The frame is
symmetric about its own centre plane apart from the pull and the knuckles, so
suite.js's mirror (§1a: the group is placed at mx(x) with rotation negated,
never scaled −1) only moves the pull to the other stile — which is harmless.
"""
import wv_lib as L
import _arch as A

NAME = "suite_leaf"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.15
AO_STRENGTH = 0.4
TRIS = 700
FRONT = "-Z"
ORIGIN = "site"


def build():
    S = A.suite()
    w, h, t = S["leafW"], S["leafH"], 0.09
    st, tr, br = .058, .058, .095            # stile, top rail, bottom rail
    parts = []
    with A.frame("local"):
        for s in (-1, 1):
            xa, xb = sorted((s * w / 2, s * (w / 2 - st)))
            o = A.box(f"stile{s}", xa, xb, 0, h, -t / 2, t / 2, "su_sapele")
            L.bevel([o], width=.004, segments=1)
            parts.append(o)
        top = A.box("rail_t", -w / 2 + st, w / 2 - st, h - tr, h, -t / 2, t / 2, "su_sapele")
        bot = A.box("rail_b", -w / 2 + st, w / 2 - st, 0, br, -t / 2, t / 2, "su_sapele")
        L.bevel([top, bot], width=.004, segments=1)
        parts += [top, bot]
        # glazing bead, both faces, a shade darker
        for f in (-1, 1):
            za, zb = sorted((f * .018, f * .030))
            x0, x1, y0, y1 = -w / 2 + st, w / 2 - st, br, h - tr
            parts.append(A.box(f"bd_l{f}", x0, x0 + .018, y0, y1, za, zb, "su_sapele_d"))
            parts.append(A.box(f"bd_r{f}", x1 - .018, x1, y0, y1, za, zb, "su_sapele_d"))
            parts.append(A.box(f"bd_t{f}", x0, x1, y1 - .018, y1, za, zb, "su_sapele_d"))
            parts.append(A.box(f"bd_b{f}", x0, x1, y0, y0 + .018, za, zb, "su_sapele_d"))
            # the pull: a slim vertical bar on stand-offs, on the +x stile
            px = w / 2 - st / 2
            za, zb = sorted((f * (t / 2 + .032), f * (t / 2 + .046)))
            parts.append(A.box(f"pull{f}", px - .011, px + .011, .92, 1.52, za, zb, "su_brass"))
            for y in (.97, 1.47):
                sa, sb = sorted((f * t / 2, f * (t / 2 + .032)))
                parts.append(A.box(f"po{f}_{y}", px - .007, px + .007, y - .007, y + .007, sa, sb, "su_brass"))
        # three hinge knuckles on the −x stile
        for y in (.30, h / 2, h - .30):
            parts.append(A.cyl_y(f"hinge{y}", .012, -w / 2, y - .05, y + .05, 0, "su_brass", n=8))
        return L.join(parts, NAME, origin=None)
