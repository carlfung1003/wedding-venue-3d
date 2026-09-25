"""atrium_bay(_slate|_screen|_glazing) — the perimeter facade's four bay types (KAN-211 wave B). The
atrium's perimeter IS the party wall the ten guest keys attach to; buildFacade
lays it in equal bays (SITE.ATRIUM.module, 2.95 → 2.933 m on the N/S walls,
2.889 on W/E) and picks each bay's type with ONE rnd() draw, which is kept.

Bay frame (buildFacade's own): origin at the bay's centre on the wall's COURT
face, at the storey floor; +X along the wall (lx), +Z OUTWARD (lz, into the
wall); the court is −Z. Authored for 2.933 m × H1; x-scaled 0.985 on W/E.

  atrium_bay          (the even bays) a closed pair of dark TIMBER doors in a
                      bronze frame with a transom, a stone sill and long bronze
                      pulls — the old version was a solid bronze slab with glass
                      in front of it (its glow was buried inside the slab)
  atrium_bay_slate    the stacked-slate feature panel (slate_stack.webp, 1.3 m
                      tile) with a bronze cap and a shadow plinth
  atrium_bay_screen   the timber batten screen: 31 real 45 × 60 mm battens at
                      90 mm on a black ground, bronze head + foot rails
                      (clubhouse-atrium.jpeg: the warm vertical-batten walls)
  atrium_bay_glazing  the glazed bay's bronze frame: jambs, head, sill, centre
                      mullion, a transom — the glass and its warm glow stay the
                      game's (transparent / emissive: a bake can be neither)
"""
import wv_lib as L
import _arch as A

NAME = "atrium_bay"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.5
TRIS = 2400
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"

MW = 44 / 15


def _h():
    return A.atrium()["H1"]


def build():
    """the entry bay: dw = mw·.78, dh = h − .55 (buildFacade's numbers)"""
    h = _h()
    dw, dh = MW * 0.78, h - 0.55
    parts = []
    with A.frame("local"):
        # frame ring (70 mm), 0.12 deep standing 0.08 proud of the wall face
        fz = (-0.08, 0.02)
        for s in (-1, 1):
            xa, xb = sorted((s * dw / 2, s * (dw / 2 + 0.07)))
            parts.append(A.box(f"jamb{s}", xa, xb, 0.04, dh + 0.11, *fz, "ar_bronze"))
        parts.append(A.box("head", -dw / 2 - 0.07, dw / 2 + 0.07, dh + 0.04, dh + 0.11, *fz, "ar_bronze"))
        # transom bar splitting a fixed panel above the leaves
        tr = dh - 0.42
        parts.append(A.box("transom", -dw / 2, dw / 2, tr - 0.05, tr, -0.07, 0.0, "ar_bronze"))
        parts.append(A.box("tpanel", -dw / 2, dw / 2, tr, dh + 0.04, -0.03, 0.0, "at_black"))
        # two timber leaves, closed, 6 mm meeting gap, each with a sunk panel line
        for s in (-1, 1):
            xa, xb = sorted((s * 0.003, s * dw / 2))
            lf = A.box(f"leaf{s}", xa, xb, 0.05, tr - 0.05, -0.05, 0.0, "at_door")
            L.bevel([lf], width=0.004, segments=1)
            parts.append(lf)
            ga, gb = sorted((s * 0.12, s * (dw / 2 - 0.12)))
            for y in (0.35, tr - 0.40):
                parts.append(A.box(f"groove{s}{y:.2f}", ga, gb, y, y + 0.012, -0.052, -0.049, "at_black"))
            px = s * 0.09
            parts.append(A.box(f"pull{s}", px - 0.012, px + 0.012, 0.75, 1.75, -0.085, -0.05, "ar_bronze"))
        sill = A.box("sill", -dw / 2 - 0.10, dw / 2 + 0.10, 0.0, 0.05, -0.10, 0.02, "at_col_b")
        L.bevel([sill], width=0.006, segments=1)
        parts.append(sill)
        return L.join(parts, NAME, origin=None)


def build_slate():
    h = _h()
    w = MW * 0.96
    parts = []
    with A.frame("local"):
        sl = L.image_mat("slate", "slate_stack.webp", roughness=0.78, fallback="at_col")
        panel = A.box("panel", -w / 2, w / 2, 0.08, h - 0.12, -0.18, 0.0, sl)
        A.world_uv(panel, tile=1.3)
        L.bevel([panel], width=0.01, segments=1)
        parts.append(panel)
        parts.append(A.box("plinth", -w / 2 + 0.03, w / 2 - 0.03, 0.0, 0.08, -0.15, 0.0, "at_black"))
        cap = A.box("cap", -w / 2 - 0.01, w / 2 + 0.01, h - 0.12, h - 0.07, -0.21, 0.0, "ar_bronze")
        L.bevel([cap], width=0.004, segments=1)
        parts.append(cap)
        return L.join(parts, "atrium_bay_slate", origin=None)


def build_screen():
    h = _h()
    w = MW * 0.94
    parts = []
    with A.frame("local"):
        y0, y1 = 0.14, h - 0.30 + 0.14
        parts.append(A.box("ground", -w / 2, w / 2, y0, y1, -0.012, 0.0, "at_black"))
        n = round(w / 0.09)
        for i in range(n):
            xc = -w / 2 + (i + 0.5) * (w / n)
            # unbevelled (a bevel cost 36 tris a batten, ×31 × 11 bays); the
            # AO in the 45 mm gaps carries the relief
            parts.append(A.box(f"batten{i}", xc - 0.0225, xc + 0.0225, y0 + 0.09, y1 - 0.09, -0.072, -0.012,
                               "at_batten" if i % 5 else "at_wood1"))
        for y in (y0, y1 - 0.09):
            r = A.box(f"rail{y:.2f}", -MW * 0.48, MW * 0.48, y, y + 0.09, -0.12, 0.0, "ar_bronze")
            L.bevel([r], width=0.004, segments=1)
            parts.append(r)
        return L.join(parts, "atrium_bay_screen", origin=None)


def build_glazing():
    h = _h()
    gw, gh = MW * 0.92, h - 0.35
    parts = []
    with A.frame("local"):
        fz = (-0.10, 0.0)
        y0, y1 = h / 2 - gh / 2, h / 2 + gh / 2
        for s in (-1, 1):
            xa, xb = sorted((s * gw / 2, s * (gw / 2 + 0.06)))
            parts.append(A.box(f"jamb{s}", xa, xb, y0 - 0.06, y1 + 0.06, *fz, "ar_bronze"))
        parts.append(A.box("head", -gw / 2 - 0.06, gw / 2 + 0.06, y1, y1 + 0.08, *fz, "ar_bronze"))
        parts.append(A.box("sill", -gw / 2 - 0.06, gw / 2 + 0.06, y0 - 0.08, y0, -0.12, 0.0, "ar_bronze"))
        parts.append(A.box("mullion", -0.035, 0.035, y0, y1, *fz, "ar_bronze"))
        parts.append(A.box("transom", -gw / 2, gw / 2, y1 - 0.62, y1 - 0.56, *fz, "ar_bronze"))
        o = L.join(parts, "atrium_bay_glazing", origin=None)
        L.bevel([o], width=0.004, segments=1, angle=40)
        return o
