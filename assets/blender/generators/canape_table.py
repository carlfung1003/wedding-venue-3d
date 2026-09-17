"""canape_table — the cocktail hour's round draped canapé / raw-bar table.

Spec row: r .62, top surface y .80, draped to the ground; a couple of platters
and a low posy on top. Origin floor centre. `linen`, platters `paint_w`, posy
blooms. Budget 3,000 / 512 / BEVEL 0.

The table is the round_table recipe at r .62 (rounded cloth top + pleated
skirt). On it: two white platters (lathed dishes) each carrying a ring of
canapés (small pale rounds), and a low posy — a squat ivory bowl with five
bloom heads (three powder-blue hydrangea, two cream roses) on a sage pad. The
bloom heads wear the generated head pictures through a top-down planar
projection (the photos are top-down); a missing file falls back to the flat
palette bloom keys.
"""
import math
import wv_lib as L
import _seating as S

NAME = "canape_table"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 3000
FRONT = "-Z"
ORIGIN = "floor"

LINEN_TEX = "linen_ivory.webp"
R, Z_TOP, T_TOP = 0.62, 0.80, 0.05


def _head_uv(o):
    """Top-down planar projection of a head picture onto a bloom sphere, kept to
    the picture's central 84 % so the sphere's rim never reaches the backdrop."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    was = me.uv_layers.active
    uvl = me.uv_layers.get(L.ART_UV) or me.uv_layers.new(name=L.ART_UV)
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    r = max(max(xs) - cx, max(ys) - cy) or 1.0
    for poly in me.polygons:
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            uvl.data[li].uv = (0.5 + (c.x - cx) / r * 0.42, 0.5 + (c.y - cy) / r * 0.42)
    me.uv_layers.active = was


def build():
    rnd = L.rng(NAME)
    top_m = S.tex("linen_top", LINEN_TEX, roughness=0.9, fallback="ivory", tint_to="ivory")
    skirt_m = S.tex("linen_skirt", LINEN_TEX, roughness=0.9, fallback="linen", tint_to="linen")
    hyd = L.image_mat("hydrangea", "hydrangea_head.webp", roughness=0.85)
    rose = L.image_mat("cream", "rose_head.webp", roughness=0.85)
    parts = []

    # ---- the draped table
    z0 = Z_TOP - T_TOP
    prof = [(R - 0.022, z0), (R - 0.005, z0 + 0.012), (R, z0 + 0.03),
            (R - 0.004, Z_TOP - 0.01), (R - 0.02, Z_TOP), (0.0, Z_TOP)]
    top = L.lathe("top", prof, (0, 0, 0), top_m, n=32)
    S.metric_uv(top, 0, 1, tile=0.7); parts.append(top)
    skirt = S.skirt("skirt", R - 0.02, z0 + 0.004, skirt_m, r_hem=R + 0.01, n=48, rows=7,
                    pleats=12, depth=0.022, hem_wave=0.007, rnd=rnd, ramp=0.85)
    L.cylindrical_uv(skirt, repeat=5.0)
    S.soft_cloth(skirt, strength=0.004, scale=2.5, seed=6)
    parts.append(skirt)

    # ---- two platters with canapés
    for (px, py, pr, k) in ((-0.22, 0.16, 0.17, 7), (0.26, -0.10, 0.15, 6)):
        dish = L.lathe("platter", [(0.0, Z_TOP), (pr - 0.03, Z_TOP), (pr - 0.02, Z_TOP + 0.006),
                                   (pr, Z_TOP + 0.022), (pr - 0.02, Z_TOP + 0.024), (0.0, Z_TOP + 0.01)],
                       (px, py, 0), "paint_w", n=16)
        parts.append(dish)
        for i in range(k):
            a = 2 * math.pi * i / k + rnd.uniform(-0.2, 0.2)
            rr = pr * 0.55
            cx, cy = px + math.cos(a) * rr, py + math.sin(a) * rr
            base = L.cyl("canape", 0.024, 0.014, (cx, cy, Z_TOP + 0.017), "label", n=6)
            parts.append(base)
            topper = L.sphere("topper", 0.012, (cx, cy, Z_TOP + 0.032), rnd.choice(["cream", "coconut_cut", "white"]), sub=1)
            parts.append(topper)
        centre = L.sphere("garnish", 0.02, (px, py, Z_TOP + 0.028), "leaf", sub=1)
        parts.append(centre)

    # ---- the low posy
    bx, by = 0.02, 0.02
    bowl = L.lathe("bowl", [(0.0, Z_TOP), (0.07, Z_TOP), (0.10, Z_TOP + 0.03), (0.105, Z_TOP + 0.075),
                            (0.095, Z_TOP + 0.08), (0.08, Z_TOP + 0.07), (0.0, Z_TOP + 0.07)],
                   (bx, by, 0), "ivory", n=14)
    parts.append(bowl)
    pad = L.sphere("pad", 0.10, (bx, by, Z_TOP + 0.10), "leaf", sub=1)
    pad.scale = (1.0, 1.0, 0.55)
    parts.append(pad)
    heads = [(-0.055, 0.02, 0.135, 0.055, hyd), (0.05, 0.045, 0.14, 0.05, hyd), (0.01, -0.06, 0.13, 0.05, hyd),
             (0.055, -0.02, 0.16, 0.038, rose), (-0.02, 0.06, 0.165, 0.036, rose), (-0.01, -0.005, 0.175, 0.04, rose)]
    for (hx, hy, hz, hr, m) in heads:
        h = L.uv_sphere("bloom", hr, (bx + hx, by + hy, Z_TOP + hz), m, seg=8, rings=6)
        L.jitter(h, hr * 0.06, rnd)
        _head_uv(h)
        parts.append(h)
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        leaf = L.sphere("leaf", 0.03, (bx + math.cos(a) * 0.10, by + math.sin(a) * 0.10, Z_TOP + 0.10), "leaf_d", sub=1)
        leaf.scale = (1.4, 0.8, 0.35)
        leaf.rotation_euler = (0, 0, a)
        parts.append(leaf)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=60)
    return root
