"""walkway_pergola — the corten PERGOLA over the LINK (KAN-211 wave D).

Replaces campus.js §I's `arrPergolaI` boxes: eight cross beams and two edge
beams in MAT.corten that FLOATED — the old pergola had no posts at all.

What it is now (the entrance video's f_030: through the lobby glass the link
reads as a flat canopy on posts with a weathered corten edge; the pavilion's
own corten, wave A2's texture):
  · slim corten-clad POSTS (.14 square) standing just inside the glass
    balustrade on both edges, at every column line of the bridge below and at
    both ends — inside the rail's collider band (z0 + .10 / z1 − .10 against a
    .26 + .35 m keep-off), so they never meet a walker;
  · two deep corten EDGE CHANNELS (.14 × .30) along the LINK, each a C-section
    (web + two flanges) with a darker inner face;
  · CROSS BEAMS (.10 × .20) seated between the channels at ~1.15 m;
  · dark timber LOUVRE BATTENS (panel_walnut, the lobby's panelling timber) on
    top, running along the bridge at ~.20 m, so the pergola throws a shade
    pattern instead of reading as a ladder against the sky.
Its own GLB so it can stay matte (rough .85, wave A2 lesson 2).
ARRIVAL frame, numbers from js/site.js.
"""
import wv_lib as L
import _arch as A
from walkway_deck import columns

NAME = "walkway_pergola"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.55
TRIS = 6000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"corten": 1.0, "corten_seam": 0.5, "panelling": 0.8}


def build():
    S = A.site()
    AR, LY = S["AR"], S["LY"]
    LK, SL = AR["LINK"], AR["SLOT"]
    cor = A.corten("corten")
    cor_d = A.corten_dark("corten_seam")
    wal = A.panelling("panelling")
    rnd = L.rng(NAME)
    parts = []
    x0, x1 = SL["x1"] + .35, LK["x1"] - .25        # the covered run (the balcony has its own roof)
    z0, z1 = LK["z0"] + .10, LK["z1"] - .10        # post / channel centre lines
    YP = LY + 2.70                                 # channel foot = post top
    YT = YP + .30                                  # channel top

    def cbox(name, xa, xb, ya, yb, za, zb, mat, tile=1.6):
        o = A.box(name, xa, xb, ya, yb, za, zb, mat)
        A.world_uv(o, tile=tile, du=rnd.random(), dv=rnd.random())
        return o

    with A.frame("arrival"):
        # ── posts: at the ends and at every column line of the bridge
        xs, _ = columns(LK)
        px = [x0 + .07] + [x for x in xs if x0 + .6 < x < x1 - .6] + [x1 - .07]
        for x in px:
            for z in (z0, z1):
                parts.append(cbox(f"post{x:.1f}_{z:.1f}", x - .07, x + .07, LY - .02, YP, z - .07, z + .07, cor))
                parts.append(A.box(f"pfoot{x:.1f}_{z:.1f}", x - .10, x + .10, LY - .02, LY + .02,
                                   z - .10, z + .10, "wk_steel"))
        # ── the two edge channels: web on the outside, flanges top + bottom
        for s, z in ((-1, z0), (1, z1)):
            wa, wb = sorted((z + s * .07, z + s * .05))
            ia, ib = sorted((z - s * .07, z + s * .05))
            for i, (xa, xb) in enumerate(A.spans(x0 - .10, x1 + .10, 5.0)):
                parts.append(cbox(f"web{s}_{i}", xa, xb, YP, YT, wa, wb, cor))
                parts.append(cbox(f"fl_b{s}_{i}", xa, xb, YP, YP + .025, ia, ib, cor))
                parts.append(cbox(f"fl_t{s}_{i}", xa, xb, YT - .025, YT, ia, ib, cor))
                ca, cb = sorted((z + s * .05, z + s * .045))
                parts.append(A.box(f"inner{s}_{i}", xa, xb, YP + .025, YT - .025, ca, cb, cor_d))
            # the channel's end caps
            for x in (x0 - .10, x1 + .10):
                parts.append(cbox(f"end{s}_{x:.1f}", x - .01, x + .01, YP, YT, min(wa, ia), max(wb, ib), cor))
        # ── cross beams between the channels
        n = max(2, round((x1 - x0) / 1.15))
        for k in range(n + 1):
            x = x0 + (x1 - x0) * k / n
            parts.append(cbox(f"xb{k}", x - .05, x + .05, YT - .22, YT - .02, z0 + .05, z1 - .05, cor))
        # ── timber louvre battens on top, along the bridge
        nb = max(4, round((z1 - z0) / .20))
        for k in range(nb + 1):
            z = z0 + .02 + (z1 - z0 - .04) * k / nb
            for i, (xa, xb) in enumerate(A.spans(x0 - .05, x1 + .05, 5.0)):
                o = A.box(f"bat{k}_{i}", xa, xb, YT - .02, YT + .05, z - .025, z + .025, wal)
                A.world_uv(o, tile=1.2, rot=True)
                parts.append(o)
        return L.join(parts, NAME, origin=None)
