"""dessert_counter — the 6 m white dessert bar counter (decor-dessert-bar.jpg).

Spec row: 6.0 W × .92 D × 1.04 H body + a top slab 6.24 × 1.06 × .07 (y 1.04 →
1.11). The FRONT face (glTF z −.46 = Blender y +.46) is plain and flat — the
game hangs its own "Fung & Cheng" plane a few mm proud of it, so nothing may
stand proud there. Origin floor centre; front −Z. `paint_w`, panel lines on the
SIDES only. Budget 1,500 / 512 / bevel .006.

What is modelled: the carcass, a 6 cm recessed toe-kick (inset .05 all round —
the refsheet shows feet, the render a shadow line; the front face above it is
untouched), the overhanging slab, and on each END a raised moulding frame
(4 bars, 8 mm proud) that reads as a panel. The long BACK face is plain too —
the parasol and the plinths stand against it and nobody sees it.
"""
import wv_lib as L

NAME = "dessert_counter"
ATLAS = 512
BEVEL = 0.006
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

W, D, H = 6.0, 0.92, 1.04
SW, SD, ST = 6.24, 1.06, 0.07
KICK = 0.06                    # toe-kick height
KICK_IN = 0.05                 # its inset from the body's faces
BAR = 0.03                     # moulding bar width
PROUD = 0.008                  # how far the moulding stands off the end face


def build():
    parts = []
    parts.append(L.box("kick", (W - 2 * KICK_IN, D - 2 * KICK_IN, KICK), (0, 0, KICK / 2), "paint_w"))
    parts.append(L.box("body", (W, D, H - KICK), (0, 0, KICK + (H - KICK) / 2), "paint_w"))
    parts.append(L.box("slab", (SW, SD, ST), (0, 0, H + ST / 2), "paint_w"))
    # end panels: a moulding frame inset .10 from the end face's edges (above the kick)
    for s in (-1, 1):
        x = s * (W / 2 + PROUD / 2)
        y0, y1 = -D / 2 + 0.10, D / 2 - 0.10
        z0, z1 = KICK + 0.10, H - 0.10
        parts.append(L.box(f"m_top{s}", (PROUD, y1 - y0, BAR), (x, 0, z1 - BAR / 2), "paint_w"))
        parts.append(L.box(f"m_bot{s}", (PROUD, y1 - y0, BAR), (x, 0, z0 + BAR / 2), "paint_w"))
        parts.append(L.box(f"m_f{s}", (PROUD, BAR, z1 - z0 - 2 * BAR), (x, y1 - BAR / 2, (z0 + z1) / 2), "paint_w"))
        parts.append(L.box(f"m_b{s}", (PROUD, BAR, z1 - z0 - 2 * BAR), (x, y0 + BAR / 2, (z0 + z1) / 2), "paint_w"))
    root = L.join(parts, NAME, origin="floor")
    return root
