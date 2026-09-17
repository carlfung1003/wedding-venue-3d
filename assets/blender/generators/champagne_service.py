"""champagne_service — the Welcome Brunch champagne service ("Pour a glass").

Spec row: 1.6 L (X) × .8 W draped table, top y .90; two ice buckets with a
bottle each, a tray of 12 flutes (frosted, OPAQUE — a bake cannot ship
transparency). Origin floor centre; front −Z (→ modelled facing Blender +Y).
`linen`, `steel`, `glass_pale`. Budget 4,000 / 512 / BEVEL 0.
"""
import math
import wv_lib as L
import _seating as S

NAME = "champagne_service"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 4000
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
LEN, WID, Z_TOP, T_TOP = 1.6, 0.8, 0.90, 0.05


def _bucket(x, y, rnd, lean_deg):
    parts = []
    prof = [(0.0, Z_TOP), (0.10, Z_TOP), (0.115, Z_TOP + 0.02), (0.13, Z_TOP + 0.21), (0.135, Z_TOP + 0.225),
            (0.12, Z_TOP + 0.225), (0.108, Z_TOP + 0.13), (0.0, Z_TOP + 0.13)]
    parts.append(L.lathe("bucket", prof, (x, y, 0), "steel", n=20))
    for sx in (-1, 1):                      # handles
        h = L.torus("handle", 0.03, 0.006, (x + sx * 0.13, y, Z_TOP + 0.17), "steel", maj=10, mnr=4, rot=(0, 90, 0))
        parts.append(h)
    for i in range(9):                      # ice
        a = 2 * math.pi * i / 9 + rnd.uniform(-0.3, 0.3)
        rr = rnd.uniform(0.03, 0.085)
        ice = L.uv_sphere("ice", rnd.uniform(0.02, 0.03), (x + math.cos(a) * rr, y + math.sin(a) * rr, Z_TOP + 0.13 + rnd.uniform(0.0, 0.02)), "crystal", seg=6, rings=4)
        parts.append(ice)
    # the bottle, leaning out of the ice
    bprof = [(0.0, 0.0), (0.038, 0.0), (0.042, 0.02), (0.042, 0.17), (0.036, 0.20), (0.02, 0.25),
             (0.015, 0.29), (0.017, 0.31), (0.0, 0.315)]
    bottle = L.lathe("bottle", bprof, (0, 0, 0), "bottle_green", n=14)
    foil = L.lathe("foil", [(0.0, 0.245), (0.021, 0.245), (0.0165, 0.29), (0.0185, 0.312), (0.0, 0.32)], (0, 0, 0), "gold", n=14)
    label = L.cyl("label", 0.0428, 0.07, (0, 0, 0.10), "label", n=14)
    for o in (bottle, foil, label):
        o.rotation_euler = (math.radians(lean_deg), 0, math.radians(35))
        o.location = (x + 0.02, y - 0.03, Z_TOP + 0.06)
        parts.append(o)
    return parts


def _flute(x, y):
    prof = [(0.0, 0.0), (0.03, 0.0), (0.03, 0.004), (0.006, 0.012), (0.005, 0.08), (0.012, 0.10),
            (0.022, 0.14), (0.023, 0.19), (0.021, 0.20), (0.0, 0.20)]
    return L.lathe("flute", prof, (x, y, Z_TOP + 0.014), "glass_pale", n=8)


def build():
    rnd = L.rng(NAME)
    top_m = S.tex("linen_top", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    skirt_m = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    parts = []

    top = S.slab("top", LEN + 0.02, WID + 0.02, Z_TOP - T_TOP, Z_TOP, 0.05, top_m)
    S.metric_uv(top, 0, 1, tile=0.7); parts.append(top)
    skirt = S.rect_skirt("skirt", LEN, WID, Z_TOP - T_TOP + 0.004, skirt_m, per_m=10, rows=6,
                         pleat_len=0.45, depth=0.02, corner_r=0.06, rnd=rnd, uv_tile=0.7, ramp=0.9)
    S.soft_cloth(skirt, strength=0.004, scale=2.5, seed=9)
    parts.append(skirt)

    parts += _bucket(-0.52, -0.12, rnd, 14)
    parts += _bucket(-0.18, 0.16, rnd, 18)
    # the tray of twelve flutes on the right
    tx, ty = 0.38, 0.0
    tray = S.slab("tray", 0.56, 0.40, Z_TOP, Z_TOP + 0.014, 0.05, "steel", k=4)
    tray.location = (tx, ty, 0); parts.append(tray)
    for (sx, sy, ln) in ((0, 0.19, 0.56), (0, -0.19, 0.56), (0.27, 0, 0.40), (-0.27, 0, 0.40)):
        parts.append(L.box("tray_rim", (ln if sy else 0.016, 0.016 if sy else ln, 0.03), (tx + sx, ty + sy, Z_TOP + 0.022), "steel"))
    for i in range(4):
        for j in range(3):
            parts.append(_flute(tx - 0.18 + i * 0.12, ty - 0.12 + j * 0.12))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=50)
    return root
