"""breakfast_table — the 酒廊's breakfast table, SET (KAN-211 wave D).

campus.js buildArrival §D `table()`: a dark teak top (1.5 × .95 four-top, or
.95 square two-top via build_two), top at y .705 … .775 (mat4 .74 ± .035), a
.12 square leg and a .7 × .06 foot plate, a white bud vase with a cream bloom
at the centre, and one place setting per cover — plate at .42 × the chair's
offset, cup .18 / −.10 off it (`setting()`). All of that becomes ONE baked
mesh: a real top with an eased edge and an apron, a tapered square pedestal on
a cross foot, plates with a rim, cup + saucer pairs, the vase and a bloom.
Keeps the primitive's footprint exactly, so `rectCollider(w + .4, d + .4)`
still covers it. Origin floor centre; front −Z (symmetric).
"""
import math
import wv_lib as L
import _arch  # noqa: F401 — registers the bk_* / at_* palette keys

NAME = "breakfast_table"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.12
AO_STRENGTH = 0.55
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

TOP_Y0, TOP_Y1 = 0.705, 0.775


def _build(w, d, offs):
    parts = []
    top = L.box("top", (w, d, TOP_Y1 - TOP_Y0), (0, 0, (TOP_Y0 + TOP_Y1) / 2), "bk_oak")
    L.bevel([top], width=.008, segments=2)
    parts.append(top)
    # apron under the top, set back 60 mm
    parts.append(L.box("apron", (w - .12, d - .12, .07), (0, 0, TOP_Y0 - .035), "bk_oak"))
    # the pedestal: a tapered square column on a cross foot (the .7 plate's reach)
    parts.append(L.prism("ped", [(-.07, -.07), (.07, -.07), (.07, .07), (-.07, .07)], TOP_Y0 - .12,
                         (0, 0, .05), "at_black"))
    for rot in (0, math.pi / 2):
        f = L.box(f"foot{rot:.1f}", (.70, .09, .05), (0, 0, .025), "at_black", rot=(0, 0, rot))
        L.bevel([f], width=.006, segments=1)
        parts.append(f)
    # the settings (setting(): plate at off * .42, cup at +.18 / −.10 in WORLD x/z)
    for (ox, oz) in offs:
        px, pz = ox * .42, oz * .42
        # Blender (x, y) = (glTF x, −glTF z)
        parts.append(L.cyl(f"plate{ox}{oz}", .12, .012, (px, -pz, TOP_Y1 + .006), "bk_china", n=20))
        parts.append(L.cyl(f"well{ox}{oz}", .075, .004, (px, -pz, TOP_Y1 + .014), "bk_china", n=16))
        cx, cz = px + (.18 if px <= 0 else -.18), pz - .10   # toward the centre past x 0 (the two-top's edge)
        parts.append(L.cyl(f"sauc{ox}{oz}", .065, .008, (cx, -cz, TOP_Y1 + .004), "bk_china", n=14))
        parts.append(L.cyl(f"cup{ox}{oz}", .04, .065, (cx, -cz, TOP_Y1 + .04), "bk_china", n=12, r2=.034))
    # the bud vase + a cream bloom
    parts.append(L.cyl("vase", .045, .12, (0, 0, TOP_Y1 + .06), "bk_china", n=14, r2=.03))
    parts.append(L.sphere("bloom", .05, (0, 0, TOP_Y1 + .15), "cream", sub=1))
    return parts


def build():
    return L.join(_build(1.5, .95, [(-.55, 0), (.55, 0), (0, -.62), (0, .62)]), NAME)


def build_two():
    return L.join(_build(.95, .95, [(-.62, 0), (.62, 0)]), NAME + "_two")
