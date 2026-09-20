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
whole SHADE — drum and mouth together — is `build_shade()` -> **`table_lamp_shade`,
material name `shade_emit`**, which is what the loader's `/_emit$/` rule keys on
(js/models.js:60). `table_lamp` is then the BRASS half only, foot and stem. Both
share this module's origin, so they drop in at the same point.

⚠ The drum belongs on the emissive half and that is not a detail. The first cut
left it in `table_lamp` as a plain dielectric with only the mouth disc glowing,
and the lamps read DARK at night — a real regression in the suite's night scenes.
The mouth disc is recessed (r .126 at z .218 inside a rim of r .185 at z .210),
so no eye in the game ever sees it, and the primitive's whole drum is what lights
up. `suite.js` re-registers the shared material through its own `glow(mat, .05,
1.5)` so it stays charcoal by day, because the loader forces any `*_emit`
material to `emissiveIntensity >= 1`.

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

⚠ **`apply_baked` takes the baked material's roughness AND metalness from whichever
palette key covers the MOST faces.** With the drum still in `build()` this was
load-bearing and fragile: a 20-sided foot plus stem came to 148 faces against the
shade's 80, the metal key won, and the whole lamp shipped at metalness .55 — which
strips a dark dielectric of its diffuse and baked the shade PURE BLACK. Now that
`build()` is brass only there is one key in it and nothing to lose, but the rule
still applies to every other multi-key asset: check that `MATERIAL <name>:` prints
the key you expect.
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
TRIS = 900                # module-wide; the shade GLB now carries the drum too
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

    # ---- the brass half only. The drum moved to build_shade(): see there.
    root = L.join(parts, NAME, origin="floor")     # radially symmetric: = "base"
    L.shade_smooth(root, angle=34)
    return root


def build_shade():
    """The DRUM and its mouth, together, on the one emissive material.

    ⚠ CORRECTED after the first integration: the drum used to live in build()
    as a plain dielectric and only the mouth disc came here, and the result was
    a lamp that reads DARK at night — the regression the suite's night scenes
    showed. Two reasons it could never work. The mouth disc sits at r .126,
    z .218, INSIDE a bottom rim of r .185 at z .210, so it is recessed and
    invisible to any eye above the shade line, which is every eye in the game.
    And the primitive it replaces lights the WHOLE DRUM: `MT.lampShade` is
    `glow(mat, .05, 1.5)` — a charcoal shell that becomes a lantern after dark.
    That is the effect, not a side effect, so the drum belongs on the emissive
    material and the earlier note here arguing the opposite was simply wrong.

    The loader forces `emissiveIntensity >= 1` on any `*_emit` material, which
    would light the drum in daylight too, so `suite.js` re-registers this
    material through its own `glow(mat, .05, 1.5)` — the primitive's exact day
    and night values. One shared material, registered once.

    Same frame as build(): origin=None leaves it at the lamp's own foot plane.
    """
    mat = L.M("bulb_emit")
    mat["wv_key"] = "shade_emit"                   # -> the GLB material's name
    # ⚠ A LAMPSHADE IS DARK UNTIL IT IS LIT. `bulb_emit`'s BASE colour is the same
    # warm white as its emission, which is right for a bulb and wrong for a drum:
    # at the .05 daytime intensity suite.js registers, the emission contributes
    # almost nothing and all that is left is the base, so the shades rendered as
    # pale cream cylinders where the primitive's `MT.lampShade` is #2a2320
    # charcoal. Keep the warm EMISSION and darken the BASE to that charcoal, so
    # the drum reads unlit by day and lights up after dark.
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        dark_lin = tuple(L.srgb_to_linear(c) for c in L.PALETTE["dj_dark"])
        bsdf.inputs["Base Color"].default_value = (*dark_lin, 1.0)
        mat.diffuse_color = (*dark_lin, 1.0)       # Workbench preview
    shell = R.loft("shade", [_ring(SHADE_R0, SHADE_Z0, SHADE_SEG),
                             _ring(SHADE_R1, SHADE_Z1, SHADE_SEG)],
                   mat, close_start=False, close_end=False)
    L.solidify(shell, 0.004)
    disc = L.cyl("mouth", MOUTH_R, MOUTH_H, (0, 0, MOUTH_Z), mat, n=18)
    root = L.join([shell, disc], NAME + "_shade", origin=None)
    L.shade_smooth(root, angle=34)
    return root
