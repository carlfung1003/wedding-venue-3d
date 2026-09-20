"""table_lamp (+ table_lamp_shade) — the suite's slim brass lamp.

Source: js/suite.js:992-997, `tableLamp(parent, x, y, z, h = .42)`; `y` is the
SURFACE it stands on, and every radius below is a Three.js CylinderGeometry
radius, not a diameter:

  foot   MT.brass      r .07 top / .10 bottom, h .04, centre y + .02
  stem   MT.brass      r .018, h = h x .55 = .231, centre y + h x .30
  shade  MT.lampShade  r .1428 top / .1848 bottom, h = h x .50 = .21,
                       centre y + h x .75, **open-ended**
  mouth  MT.downlight  r = h x .30 = .126, h .02, centre y + h x .52

so the whole lamp is exactly `h` tall from the surface, and the widest thing on
it is the shade's 0.3696 m bottom rim.

  0.370 x 0.370 x 0.420
  origin  **base** — the foot's underside, x/z on the axis: the lamp stands on a
          surface at y = 0, exactly as `tableLamp()` is called.
  front   -Z, nominal (radially symmetric).

FOUR CALL SITES, THREE HEIGHTS (this is the one thing an integrator must know):

  js/suite.js:906   tableLamp(g, -.2, .78, nz + .3, .3)      west credenza
  js/suite.js:961   tableLamp(g, wx + .34, .86, dz - .8, .42)  sideboard, W
  js/suite.js:962   tableLamp(g, wx + .34, .86, dz + .8, .42)  sideboard, E
  js/suite.js:1400  tableLamp(g, ST.x0 - .5, YF2 + .76, -17.2, .4)  2F console

⚠ **The model is the h = 0.42 lamp** — the sideboard pair, the two in the great
room a guest actually walks up to. The others need a UNIFORM scale of
`h / 0.42` (0.714 at the credenza, 0.952 on the 2F console). That is a
deviation, and a declared one: the code scales the stem, the shade and the mouth
by `h` but leaves the foot's .07/.10/.04 and the stem's .018 CONSTANT, so no
single mesh can serve all three heights exactly. At 0.714 the foot comes out
71 mm instead of 100 — on a 0.30 m lamp, on a credenza, across a 13 m room.

⚠ suite.js is MIRRORED (its 1a): `tableLamp()` reflects x through `mx()` for
you. The lamp is radially symmetric, so the reflection is a no-op and there is
no rotation to negate.

THE SPLIT. `MT.lampShade` is `glow(…, .05, 1.5)` — a #2a2320 drum that lights up
at night — and `MT.downlight` is the hot disc in its mouth. An emissive key may
not be mixed with lit ones in one GLB (`wv_bake.apply_baked` raises), so the
glowing mouth is `build_shade()` -> **`table_lamp_shade`, material name
`shade_emit`**, which is what the loader's `/_emit$/` rule keys on
(js/models.js:60) to keep it emissive. It shares this module's origin, so both
halves drop in at the same point. The dark drum stays in `table_lamp`: it is the
lamp's silhouette, and baking it emissive would make the whole shade a lantern.

⚠ `shade_emit` is not a `wv_lib.PALETTE` key and `M()` refuses unknown keys, so
the mouth is built on `bulb_emit` (#fff0cf, emission 2.2 — the warm white the
whole project's glow kit uses) with its `wv_key` renamed. `MAT_NAME` could not
do this: it is module-wide and would have renamed the lamp's material too, and
a lamp whose material ends in `_emit` glows from end to end.

FINISH. PALETTE has no brass, and `gold` #d8bd80 rendered as pale cream once the
shade won the atlas and took the metalness to 0 — visible in the second
in-engine shot, where the base read as ivory plastic. `_interior.brass()` gains
`oak_light.webp` to ~#9d7c4e, halfway from `gold` to `MT.brass`'s own #8a6b3f,
which reads as satin antique brass as a pure dielectric. Shade in `dj_dark`
#2b2a26, which is `MT.lampShade`'s #2a2320 to within a point.

⚠ **THE DRUM MUST CARRY MORE FACES THAN THE BRASS, and that is load-bearing.**
`wv_bake.apply_baked` takes the baked material's roughness AND metalness from
whichever key covers the MOST faces. At the first cut the 20-sided foot plus its
stem came to 148 faces against the shade's 80, so the metal key won and the whole
lamp shipped at metalness .55 — which strips a dark dielectric of its diffuse and
baked the shade PURE BLACK instead of `MT.lampShade`'s charcoal (visible in the
first in-engine shot). The drum is 32-sided and the foot 18 now (128 faces
against 100), so `dj_dark` wins and the shade renders matte at roughness .70,
with the brass carrying its own gained albedo instead of a metalness. Change
either segment count and check that `MATERIAL table_lamp:` still prints a bigger
count for `dj_dark` than for `brass_turned`.
"""
import math

import wv_lib as L
import _resort as R
import _interior as I  # noqa: F401  (kept so the group's helpers are one import)

NAME = "table_lamp"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.30
AO_STRENGTH = 0.5
TRIS = 900                # module-wide; the shade GLB's own budget is 300
FRONT = "-Z"
ORIGIN = "base"

H = 0.42                  # the modelled height — the sideboard pair
FOOT_R0, FOOT_R1, FOOT_H = 0.10, 0.07, 0.04
STEM_R, STEM_H = 0.018, H * 0.55
SHADE_R0, SHADE_R1 = 0.1848, 0.1428      # bottom, top
SHADE_Z0, SHADE_Z1 = H * 0.50, H         # .210 .. .420
MOUTH_R, MOUTH_H = H * 0.30, 0.02        # .126
MOUTH_Z = H * 0.52                       # .2184, the disc's centre
SEG = 18                  # the brass foot
SHADE_SEG = 32            # ⚠ the drum MUST carry more faces than the brass: see below


def _ring(r, z, n=SEG):
    return [(math.cos(2 * math.pi * i / n) * r,
             math.sin(2 * math.pi * i / n) * r, z) for i in range(n)]


def build():
    brass = I.brass("brass_turned", roughness=0.40)
    dark = "dj_dark"
    parts = []

    # ---- the turned brass foot: a stepped disc, not a plain cone
    parts.append(L.lathe("foot", [
        (0.0, 0.000), (FOOT_R0, 0.000), (FOOT_R0 - 0.006, 0.014),
        (FOOT_R1 + 0.004, 0.034), (FOOT_R1, FOOT_H), (0.0, FOOT_H),
    ], (0, 0, 0), brass, n=SEG))

    # ---- the slim stem
    parts.append(L.cyl("stem", STEM_R, STEM_H, (0, 0, FOOT_H - 0.006 + STEM_H / 2),
                       brass, n=10))
    # the brass carries a picture, so it needs a real `art` UV or the bake takes
    # one texel of it (wv_bake._check_art_uvs). Cylindrical: u round, v up.
    for o in parts:
        L.cylindrical_uv(o, axis=2, repeat=2.0)

    # ---- the dark drum shade: an OPEN tapered shell, 4 mm of wall
    shell = R.loft("shade", [_ring(SHADE_R0, SHADE_Z0, SHADE_SEG),
                             _ring(SHADE_R1, SHADE_Z1, SHADE_SEG)],
                   dark, close_start=False, close_end=False)
    L.solidify(shell, 0.004)
    parts.append(shell)

    root = L.join(parts, NAME, origin="floor")     # radially symmetric: = "base"
    L.shade_smooth(root, angle=34)
    return root


def build_shade():
    """The glowing mouth — `MT.downlight`'s disc, kept emissive by the loader.
    Same frame as build(): origin=None leaves it at the lamp's own foot plane."""
    mat = L.M("bulb_emit")
    mat["wv_key"] = "shade_emit"                   # -> the GLB material's name
    disc = L.cyl("mouth", MOUTH_R, MOUTH_H, (0, 0, MOUTH_Z), mat, n=18)
    return L.join([disc], NAME + "_shade", origin=None)
