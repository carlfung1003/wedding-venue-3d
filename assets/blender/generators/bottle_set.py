"""bottle_set — the back-bar cluster that sits on the round bar (decor-cocktail-bar.jpg).

Spec row: 11 spirit bottles in a loose arc ~1.5 W × .45 D, heights .30–.41 + necks,
coloured glass, plain paper labels (no text, ever); a steel shaker Ø .082 × .24
and two hawthorne strainers. Origin base centre — the game sets it on the bar top
at y 1.13, z +.40. Budget 5,000 / 512 / bevel 0.

Every bottle is a lathe on one of four shoulder profiles (Bordeaux, Burgundy,
tall vermouth, short rum) plus one square gin (a box). Labels are a thin lighter
band around the body — a full wrap, because a flat card on a Ø .08 cylinder
either floats at its edges or sinks at its middle. Glass is opaque tinted
(`bottle_*` keys, roughness .12) — no transmission on this campus. The strainers
stand in a small steel cup beside the shaker, as the photo has them.
"""
import math
import bpy
import wv_lib as L

NAME = "bottle_set"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 5000
FRONT = "-Z"
ORIGIN = "base"

GLASS = ["bottle_green", "bottle_amber", "bottle_clear", "bottle_red", "bottle_blue", "bottle_gold"]
N = 14                                  # lathe segments per bottle (glass must out-count steel)



def _flat(key, hexstr, rough=0.35, family="metal"):
    """A dielectric stand-in for a METALLIC palette key, same colour, metallic 0.
    wv_bake bakes Cycles' DIFFUSE colour pass, which is scaled by (1 - metallic):
    `steel` (.8) bakes to ~20 % grey and `mirror` (1.0) to black. The exported
    material's metalness comes from the dominant non-metal key anyway, and the
    loader keys `mirror` by NAME, so nothing is lost by baking these as dielectrics."""
    m = bpy.data.materials.get(key)
    if m is not None:
        return m
    r, g, b = (L.srgb_to_linear(int(hexstr[i:i + 2], 16) / 255.0) for i in (0, 2, 4))
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    m.diffuse_color = (r, g, b, 1.0)
    m["wv_key"] = key
    m["wv_family"] = family
    return m

def _bordeaux(r=0.037, h=0.30):
    return [(0, 0), (r * 0.85, 0), (r, 0.012), (r, h * 0.74), (r * 0.92, h * 0.80),
            (r * 0.45, h * 0.86), (0.0125, h * 0.90), (0.0125, h), (0.0145, h), (0.0145, h + 0.012),
            (0.011, h + 0.012), (0, h + 0.012)]


def _burgundy(r=0.040, h=0.31):
    return [(0, 0), (r * 0.85, 0), (r, 0.012), (r, h * 0.55), (r * 0.86, h * 0.68),
            (r * 0.55, h * 0.79), (0.024, h * 0.86), (0.013, h * 0.92), (0.013, h), (0.0145, h),
            (0.0145, h + 0.012), (0.011, h + 0.012), (0, h + 0.012)]


def _vermouth(r=0.032, h=0.38):
    return [(0, 0), (r * 0.85, 0), (r, 0.010), (r, h * 0.76), (r * 0.7, h * 0.83),
            (0.012, h * 0.88), (0.012, h), (0.014, h), (0.014, h + 0.012), (0.010, h + 0.012), (0, h + 0.012)]


def _rum(r=0.044, h=0.26):
    return [(0, 0), (r * 0.85, 0), (r, 0.012), (r, h * 0.70), (r * 0.9, h * 0.78),
            (r * 0.4, h * 0.86), (0.014, h * 0.90), (0.014, h), (0.016, h), (0.016, h + 0.012),
            (0.012, h + 0.012), (0, h + 0.012)]


PROFILES = [_bordeaux, _burgundy, _vermouth, _rum]


def _bottle(i, x, y, rot_deg, glass, kind, label_z, label_h, rnd):
    parts = []
    if kind == "gin":                                    # the square gin bottle
        w, h = 0.068, 0.24
        parts.append(L.box(f"gin{i}", (w, w, h), (x, y, h / 2), glass, rot=(0, 0, rot_deg)))
        parts.append(L.box(f"gin{i}s", (w * 0.7, w * 0.7, 0.03), (x, y, h + 0.015), glass, rot=(0, 0, rot_deg)))
        parts.append(L.cyl(f"gin{i}n", 0.013, 0.05, (x, y, h + 0.03 + 0.025), glass, n=N))
        parts.append(L.box(f"lab{i}", (w + 0.006, w + 0.006, 0.075), (x, y, 0.12), "label", rot=(0, 0, rot_deg)))
        top = h + 0.055
        r_top = 0.013
    else:
        prof = PROFILES[kind]()
        parts.append(L.lathe(f"bottle{i}", prof, (x, y, 0), glass, n=N))
        r_body = max(r for r, z in prof)
        parts.append(L.cyl(f"lab{i}", r_body + 0.002, label_h, (x, y, label_z), "label", n=N))
        top = prof[-1][1]
        r_top = prof[-3][0]
    # cap or pourer
    if rnd.random() < 0.5:
        parts.append(L.cyl(f"cap{i}", r_top + 0.003, 0.022, (x, y, top + 0.008), "dark", n=N))
    else:
        parts.append(L.cyl(f"pour{i}", r_top - 0.002, 0.03, (x, y, top + 0.015), STEEL_B, n=6))
        parts.append(L.strut(f"spout{i}", (x, y, top + 0.03), (x, y + 0.022, top + 0.055), 0.004, STEEL_B, n=5))
    return parts


def build():
    global STEEL_A, STEEL_B
    # two steel keys, not one: the key with the MOST faces sets the whole asset's
    # roughness/metalness, and one steel key (370 faces) out-counted every glass
    STEEL_A = _flat("steel_flat_a", "9aa1a6")
    STEEL_B = _flat("steel_flat_b", "9aa1a6")
    rnd = L.rng(NAME)
    parts = []
    # a loose arc: the back row (−Y, away from the guest) taller, the front row shorter
    layout = [
        # x,     y,     kind (0 bdx, 1 bgd, 2 verm, 3 rum, "gin")
        (-0.66, -0.12, 2), (-0.50, -0.16, 0), (-0.32, -0.19, 1), (-0.12, -0.20, 2),
        (0.08, -0.20, 0), (0.28, -0.18, 1), (0.48, -0.15, 2), (0.64, -0.10, 0),
        (-0.42, 0.06, 3), (-0.05, 0.08, "gin"), (0.34, 0.06, 3),
    ]
    for i, (x, y, kind) in enumerate(layout):
        glass = GLASS[i % len(GLASS)]
        rot = rnd.uniform(-25, 25)
        lz = rnd.uniform(0.10, 0.15)
        lh = rnd.uniform(0.06, 0.09)
        parts += _bottle(i, x + rnd.uniform(-0.01, 0.01), y + rnd.uniform(-0.01, 0.01),
                         rot, glass, kind, lz, lh, rnd)

    # shaker Ø .082 × .24 (steel), front right
    shaker = [(0, 0), (0.036, 0), (0.041, 0.012), (0.041, 0.15), (0.038, 0.17), (0.030, 0.20),
              (0.022, 0.225), (0.022, 0.24), (0, 0.24)]
    # ⚠ face counts matter here: apply_baked takes the whole asset's roughness /
    # metalness from the key covering the MOST faces. With the shaker at n=16 and
    # two 16×5 springs, `steel` won (500 faces) and every bottle shipped as
    # metallic .8. The steel parts are kept lean so a glass key stays dominant.
    parts.append(L.lathe("shaker", shaker, (0.62, 0.10, 0), STEEL_A, n=12))
    # a small steel cup with the two hawthorne strainers standing in it
    cup = [(0, 0), (0.030, 0), (0.034, 0.01), (0.037, 0.10), (0, 0.10)]
    parts.append(L.lathe("cup", cup, (-0.66, 0.10, 0), STEEL_A, n=10))
    for k, (tilt, yaw) in enumerate(((22, 15), (-18, -35))):
        cx, cy = -0.66, 0.10
        # handle up out of the cup, the disc + spring at the top
        top = (cx + 0.012 * k, cy + 0.02 * (1 - k), 0.30)
        rot = (tilt, 0, yaw)
        disc = L.cyl(f"strainer{k}", 0.040, 0.004, top, STEEL_B, n=12, rot=rot)
        ring = L.torus(f"spring{k}", 0.040, 0.004, top, STEEL_B, maj=12, mnr=4, rot=rot)
        # the handle: a bar from the disc edge down into the cup
        a = math.radians(yaw)
        h = L.strut(f"handle{k}", (cx + 0.015 * k, cy + 0.015 * (1 - k), 0.04),
                    (top[0] - 0.02 * math.sin(a), top[1] - 0.02 * math.cos(a), top[2] - 0.01), 0.004, STEEL_B, n=6)
        parts += [disc, ring, h]

    root = L.join(parts, NAME, origin="base")
    L.shade_smooth(root, angle=40)
    return root
