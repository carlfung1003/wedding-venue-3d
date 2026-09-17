"""buffet_run — the rooftop Welcome Brunch buffet.

Spec row: 7.0 L (X) × .9 W, top surface y .90, ivory linen to the floor; on
top: 5 chafing dishes (steel, domed lids), 3 platters, a juice dispenser, a
stack of plates. Origin floor centre; front −Z (→ modelled facing Blender +Y:
guests stand at +Y, so the dishes sit a little toward −Y). `linen`, `steel`,
`paint_w`. Budget 6,000 / 1024 / BEVEL 0.

One material per GLB: the bake collapses linen, steel, white and the frosted
dispenser into one atlas, so the steel carries the bake's brushed-metal albedo
but not a metallic BRDF (the dominant key — the linen — sets the roughness).
"""
import math
import wv_lib as L
import _seating as S

NAME = "buffet_run"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 6000
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
LEN, WID, Z_TOP, T_TOP = 7.0, 0.9, 0.90, 0.05


def _chafer(x, y, rnd):
    """A roll-top chafing dish: stand, water pan, food pan and a domed lid with a knob."""
    parts = []
    pw, pd, ph = 0.56, 0.36, 0.11
    z_stand = Z_TOP + 0.075
    # the stand: four legs and two rails
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(L.box("leg", (0.016, 0.016, 0.075), (x + sx * (pw / 2 - 0.02), y + sy * (pd / 2 - 0.02), Z_TOP + 0.0375), "steel"))
        parts.append(L.box("rail", (0.016, pd, 0.016), (x + sx * (pw / 2 - 0.02), y, Z_TOP + 0.03), "steel"))
    # the fuel cup between the legs, the pan on the stand
    parts.append(L.cyl("fuel", 0.035, 0.03, (x, y, Z_TOP + 0.015), "steel", n=10))
    pan = L.box("pan", (pw, pd, ph), (x, y, z_stand + ph / 2), "steel")
    L.bevel([pan], width=0.008, segments=2, angle=40, min_size=0.02)
    parts.append(pan)
    parts.append(L.box("pan_rim", (pw + 0.03, pd + 0.03, 0.012), (x, y, z_stand + ph - 0.006), "steel"))
    # the domed lid: a lathed dome stretched along X
    z_rim = z_stand + ph
    dome = L.lathe("lid", [(0.0, z_rim), (0.175, z_rim), (0.18, z_rim + 0.012), (0.165, z_rim + 0.08),
                           (0.12, z_rim + 0.135), (0.05, z_rim + 0.16), (0.0, z_rim + 0.165)],
                   (x, y, 0), "steel", n=20)
    dome.scale = (1.55, 1.0, 1.0)
    parts.append(dome)
    parts.append(L.cyl("knob", 0.018, 0.03, (x, y, z_rim + 0.178), "dark", n=8))
    parts.append(L.cyl("knob_stem", 0.008, 0.02, (x, y, z_rim + 0.16), "steel", n=6))
    return parts


def _platter(x, y, r, rnd, food):
    parts = [L.lathe("platter", [(0.0, Z_TOP), (r - 0.03, Z_TOP), (r - 0.02, Z_TOP + 0.006),
                                 (r, Z_TOP + 0.024), (r - 0.02, Z_TOP + 0.026), (0.0, Z_TOP + 0.01)],
                     (x, y, 0), "paint_w", n=22)]
    mound = L.sphere("mound", r * 0.62, (x, y, Z_TOP + 0.012), food, sub=1)
    mound.scale = (1.0, 0.9, 0.42)
    parts.append(mound)
    for i in range(7):
        a = 2 * math.pi * i / 7 + rnd.uniform(-0.3, 0.3)
        rr = r * rnd.uniform(0.25, 0.5)
        b = L.uv_sphere("bite", r * 0.13, (x + math.cos(a) * rr, y + math.sin(a) * rr, Z_TOP + 0.03 + r * 0.1), rnd.choice(["cream", "coconut_cut", "label", "white"]), seg=6, rings=4)
        b.scale = (1.0, 1.0, 0.7)
        parts.append(b)
    parts.append(L.uv_sphere("garnish", r * 0.12, (x + r * 0.15, y - r * 0.1, Z_TOP + 0.05 + r * 0.15), "leaf_d", seg=6, rings=4))
    return parts


def build():
    rnd = L.rng(NAME)
    top_m = S.tex("linen_top", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    skirt_m = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    parts = []

    top = S.slab("top", LEN + 0.02, WID + 0.02, Z_TOP - T_TOP, Z_TOP, 0.05, top_m)
    S.metric_uv(top, 0, 1, tile=0.7); parts.append(top)
    skirt = S.rect_skirt("skirt", LEN, WID, Z_TOP - T_TOP + 0.004, skirt_m, per_m=6, rows=6,
                         pleat_len=0.6, depth=0.02, corner_r=0.06, rnd=rnd, uv_tile=0.7, ramp=0.9)
    S.soft_cloth(skirt, strength=0.004, scale=2.5, seed=8)
    parts.append(skirt)

    # five chafers on a 0.9 m pitch, a little toward the back
    for i in range(5):
        parts += _chafer(-2.55 + i * 0.9, -0.08, rnd)
    # three platters at the right end
    parts += _platter(2.0, 0.12, 0.17, rnd, "cream")
    parts += _platter(2.55, -0.16, 0.15, rnd, "coconut_cut")
    parts += _platter(3.05, 0.14, 0.16, rnd, "white")
    # a juice dispenser on a stand at the left end
    dx, dy = -3.15, -0.18
    stand = L.box("stand", (0.30, 0.30, 0.10), (dx, dy, Z_TOP + 0.05), "oak_d")
    L.bevel([stand], width=0.006, segments=2, angle=40, min_size=0.02); parts.append(stand)
    body = L.lathe("dispenser", [(0.0, Z_TOP + 0.10), (0.11, Z_TOP + 0.10), (0.12, Z_TOP + 0.14), (0.12, Z_TOP + 0.40),
                                 (0.115, Z_TOP + 0.44), (0.09, Z_TOP + 0.47), (0.0, Z_TOP + 0.475)],
                   (dx, dy, 0), "glass_pale", n=18)
    parts.append(body)
    parts.append(L.cyl("lid_knob", 0.02, 0.025, (dx, dy, Z_TOP + 0.487), "steel", n=8))
    parts.append(L.cyl("tap", 0.012, 0.06, (dx, dy + 0.14, Z_TOP + 0.135), "steel", n=8, rot=(90, 0, 0)))
    parts.append(L.cyl("tap_lever", 0.006, 0.05, (dx, dy + 0.16, Z_TOP + 0.165), "steel", n=6))
    # a stack of plates beside it
    px, py = -3.3, 0.17
    prof = [(0.0, Z_TOP), (0.13, Z_TOP)]
    for k in range(6):
        z = Z_TOP + k * 0.024
        prof += [(0.135, z + 0.006), (0.12, z + 0.014), (0.135, z + 0.022)]
    prof += [(0.0, Z_TOP + 6 * 0.024)]
    parts.append(L.lathe("plates", prof, (px, py, 0), "paint_w", n=16))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=50)
    return root
