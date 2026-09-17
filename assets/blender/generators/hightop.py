"""hightop — the linen cocktail high-top (prewedding deck, cocktail hour).

Spec row: top r .42, top surface y 1.105 (.05 thick, centre 1.08); skirt
tapering r .42 → .38 to the ground, a tied sash at ~y .75. Origin floor centre.
`linen`. Budget 1,200 / 256 / BEVEL 0.

A rounded cloth top; a skirt cinched by the sash — r .42 at the top edge, .38
at the sash, easing back out to .43 at the hem with soft folds below the tie;
the sash is a band with a small bow (two loops + two tails) on the front.
"""
import math
import wv_lib as L
import _seating as S

NAME = "hightop"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
R_TOP, Z_TOP, T_TOP = 0.42, 1.105, 0.05
Z_SASH, R_SASH = 0.75, 0.38


def build():
    rnd = L.rng(NAME)
    linen = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    parts = []

    z0 = Z_TOP - T_TOP
    prof = [(R_TOP - 0.02, z0), (R_TOP - 0.004, z0 + 0.012), (R_TOP, z0 + 0.03),
            (R_TOP - 0.006, Z_TOP - 0.01), (R_TOP - 0.025, Z_TOP), (0.0, Z_TOP)]
    top = L.lathe("top", prof, (0, 0, 0), linen, n=32)
    S.metric_uv(top, 0, 1, tile=0.7)
    parts.append(top)

    t_sash = (z0 - Z_SASH) / (z0 - 0.006)

    def taper(t):
        t = max(0.0, min(1.0, t))
        if t <= t_sash:
            u = t / t_sash
            return R_TOP + (R_SASH - R_TOP) * (u ** 0.8)
        u = (t - t_sash) / (1 - t_sash)
        return R_SASH + (0.43 - R_SASH) * (u ** 1.3)

    skirt = S.skirt("skirt", R_TOP, z0 + 0.004, linen, n=36, rows=6, pleats=10, depth=0.016,
                    hem_wave=0.006, rnd=rnd, taper=taper, ramp=1.0)
    # folds only below the tie: pull the upper rows back onto the taper
    me = skirt.data
    for v in me.vertices:
        t = max(0.0, min(1.0, (z0 - v.co.z) / (z0 - 0.006)))
        if t < t_sash:
            r = math.hypot(v.co.x, v.co.y) or 1.0
            want = taper(t) + 0.004 * (t / t_sash) * math.sin(10 * math.atan2(v.co.y, v.co.x))
            v.co.x *= want / r; v.co.y *= want / r
    L.cylindrical_uv(skirt, repeat=4.0)
    S.soft_cloth(skirt, strength=0.003, scale=2.5, seed=4)
    parts.append(skirt)

    # the sash: a band around the cinch, a bow on the front (-Y … the game's front is +Y;
    # a high-top is round, so the bow simply faces the modelled FRONT, Blender +Y)
    sash = L.torus("sash", R_SASH + 0.006, 0.018, (0, 0, Z_SASH), linen, maj=20, mnr=4)
    sash.scale = (1.0, 1.0, 1.6)
    S.metric_uv(sash, 0, 2, tile=0.7)
    parts.append(sash)
    for sx in (-1, 1):
        loop = L.torus("bow_loop", 0.045, 0.014, (sx * 0.05, R_SASH + 0.03, Z_SASH + 0.01), linen,
                       maj=10, mnr=4, rot=(90, 0, 0))
        loop.scale = (1.3, 1.0, 0.8)
        S.metric_uv(loop, 0, 2, tile=0.7)
        parts.append(loop)
        tail = L.plane("bow_tail", (0.06, 0.28), (sx * 0.035, R_SASH + 0.035, Z_SASH - 0.15), linen, rot=(90, 0, sx * 8))
        S.metric_uv(tail, 0, 2, tile=0.7)
        parts.append(tail)
    knot = L.uv_sphere("bow_knot", 0.028, (0, R_SASH + 0.03, Z_SASH), linen, seg=8, rings=6)
    S.metric_uv(knot, 0, 2, tile=0.7)
    parts.append(knot)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=60)
    return root
