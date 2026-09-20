"""_interior — helpers shared by Group G, the hotel-room interiors.

Files starting with `_` are skipped by make_masters.py. Nothing in wv_lib,
_seating or _resort is patched: `tex`, `metric_uv`, `slab`, `sweep`, `circle`
and `rrect` are re-exported from _seating so every group tints its generated
textures the same way.

The eight Group G assets replace axis-aligned `slab()` boxes in **js/suite.js**
and **js/campus.js**, so — as in Groups E and F — every dimension is quoted with
the `file:line` it was read off, **the envelope follows the code and the finish
follows the photo**, and each deviation is named in the generator's docstring.

⚠ **js/suite.js is MIRRORED** (its §1a, lines 26-62). It authors in the old
left-for-right-reversed brief frame and reflects every X on the way out through
`mx(x) => -x`, which also negates every `rotation.y`. Nothing in this module
compensates for that: the pieces are modelled normally and each ASSET_SPEC row
records that the call site applies `mx()`. Every Group G asset is symmetric
about its own X centre plane, so the reflection is a no-op on the SHAPE; only
the placement x flips, which `mx()` already does, and the two rotations these
assets need (0 and π) are their own negatives.

⚠ These are INTERIORS. Ambient occlusion asks how much sky a point sees, so the
outdoor `AO_DIST 0.5` bakes an enclosed piece black: 0.30 for upholstery, 0.15
for anything with a real enclosed underside (the massage bed over its legs).

Contents
  ESPRESSO_GAIN / NAVY_GAIN / BLOND_GAIN / IVORY_GAIN
        the per-channel gains that put a generated texture's MEAN on one of
        suite.js's own MT.* colours. `_seating._tint_to_palette` solves
        target = linear(PALETTE[key]) x gain, so each constant below is
        linear(the MT hex) / linear(PALETTE[key]) with a deliberate lift where
        an albedo that dark would crush to black once the AO pass multiplies in.
  espresso() / navy() / blond() / cream_linen()
        the four shared materials, each already gained. Every part carrying one
        MUST get a metric_uv — `wv_bake._check_art_uvs` fails the build when an
        image-mapped mesh has a degenerate `art` UV, and join() hands parts that
        never had the layer a (0, 0) one.
  pad(...)     an off-centre rounded slab (S.slab only builds at x = y = 0).
  ribs(...)    a stack of proud bands separated by recessed reveals — the ribbed
               espresso timber of the coffee table and the dining table's plinth
               legs. suite.js's `texEspresso` (js/suite.js:395) draws fine
               HORIZONTAL ribs and there is no ribbed file in textures/gen, so
               the ribs are geometry here. Plain boxes: 12 triangles each.
  wedge(...)   an annulus-sector loft: one CURVED module of the 2F lounge's
               modular sofa. Its side faces are radial planes, so consecutive
               modules abut exactly at the code's own angular pitch.
"""
import math

import wv_lib as L
import _resort as R
from _seating import tex, metric_uv, slab, sweep, circle, rrect, dielectric, soft_cloth  # noqa: F401


# ---------------------------------------------------------------- materials
# MT.espresso / MT.espressoPlain = #2b1d16 (js/suite.js:541-560). Solved against
# `dark` (#33302b) and then lifted ~1.45x: at the true albedo the albedo x AO
# atlas came back as a black slab, and a black slab is not ribbed timber.
ESPRESSO_GAIN = (1.05, 0.62, 0.50)          # -> ~#342520
# MT.navy = #23364a (js/suite.js:585). Solved against `bottle_blue` (#33506e).
NAVY_GAIN = (0.51, 0.46, 0.44)
# The spa photo's massage tables are BLOND timber, not the code's MT.ivoryWhite
# — a lighter gain than the crossback chair's (0.53, 0.45, 0.38).
BLOND_GAIN = (0.80, 0.70, 0.58)
# MT.ivory #e8e2d2 / MT.ivoryWhite #e9e5da (suite) and MAT.ivory #e8e2d4 /
# MAT.ivoryWarm #dfd6c3 (campus) all sit just under PALETTE `ivory` #f6ecd8.
IVORY_GAIN = (0.94, 0.94, 0.93)
WARM_GAIN = (0.86, 0.85, 0.82)           # MAT.ivoryWarm #dfd6c3, the lobby scatters
WHITE_GAIN = (0.88, 0.93, 1.00)          # MT.ivoryWhite #e9e5da — cooler than `ivory`
# MT.brass #8a6b3f at metalness .85, solved against `oak` and stopped halfway:
# a full solve is a dielectric mud, `gold` straight is pale cream. -> ~#9d7c4e.
BRASS_GAIN = (0.62, 0.55, 0.38)

OAK_TEX, LINEN_TEX = "oak_light.webp", "linen_ivory.webp"


def espresso(name="espresso_rib", roughness=0.42):
    """The suite's dark ribbed timber — sofa plinth, coffee table, dining table.
    Falls back to flat `dark` if oak_light.webp is missing."""
    return tex(name, OAK_TEX, roughness=roughness, fallback="dark",
               tint_to="dark", gain=ESPRESSO_GAIN)


def navy(name="navy_pad", roughness=0.55):
    """The spa's navy massage-bed pad."""
    return tex(name, LINEN_TEX, roughness=roughness, fallback="bottle_blue",
               tint_to="bottle_blue", gain=NAVY_GAIN)


def brass(name="brass_turned", roughness=0.40):
    """`MT.brass` #8a6b3f at metalness .85 (js/suite.js:546) has no palette key —
    `gold` #d8bd80 is the nearest, and as a DIELECTRIC (which is what a lamp
    whose shade wins the atlas gets) it renders as pale cream, not brass. Gained
    to ~#9d7c4e, halfway to the real hex, it reads as satin antique brass under
    the venue's sun without any metalness at all."""
    return tex(name, OAK_TEX, roughness=roughness, fallback="gold",
               tint_to="oak", gain=BRASS_GAIN)


def blond(name="blond_frame", roughness=0.70):
    """The massage bed's blond folding frame (Yinyiju spa.webp)."""
    return tex(name, OAK_TEX, roughness=roughness, fallback="oak",
               tint_to="oak", gain=BLOND_GAIN)


def cream_linen(name="cream_linen", roughness=0.90, gain=IVORY_GAIN):
    """Ivory upholstery linen — every sofa in this group."""
    return tex(name, LINEN_TEX, roughness=roughness, fallback="ivory",
               tint_to="ivory", gain=gain)


# ---------------------------------------------------------------- geometry
def pad(name, w, d, x, y, z0, z1, rc, mat, k=4):
    """A rounded-rectangle slab at an arbitrary (x, y). `_seating.slab` always
    builds at x = y = 0; this moves it before any uv is written.
    ⚠ k = 4 on purpose: the corner arc steps 30 deg, under `L.bevel`'s 40 deg
    threshold, so a later bevel rounds the top and bottom rims and leaves the
    plan corners alone. k = 3 steps 45 deg and bevels the corners too."""
    o = slab(name, w, d, z0, z1, rc, mat, k=k)
    o.location.x += x
    o.location.y += y
    return o


def ribs(prefix, w, d, x, y, z0, z1, mat, bands=5, reveal=0.010, inset=0.014):
    """Ribbed espresso timber: `bands` proud bands with (bands - 1) recessed
    reveals between them, exactly filling z0..z1. Plain boxes — 12 tris each —
    because the rib is a 10 mm shadow line and a rounded one reads as nothing."""
    n_rev = bands - 1
    hb = (z1 - z0 - n_rev * reveal) / bands
    out, z = [], z0
    for i in range(bands):
        out.append(L.box(f"{prefix}_b{i}", (w, d, hb), (x, y, z + hb / 2), mat))
        z += hb
        if i < n_rev:
            out.append(L.box(f"{prefix}_r{i}", (w - 2 * inset, d - 2 * inset, reveal),
                             (x, y, z + reveal / 2), mat))
            z += reveal
    return out


def arc_profile(pts, r_centre, half_angle, stations):
    """[(radius, z), ...] -> the list of 3-D sections `R.loft` wants, revolved
    through +-half_angle about an axis at Blender (0, -r_centre, *).

    The origin stays at (0, 0), i.e. the module's own centre line at r_centre —
    which is where suite.js's `box()` places the straight module it replaces —
    and radii ABOVE r_centre come out at +Y, so the outward (front) face lands
    on Blender +Y = glTF -Z, the house front."""
    secs = []
    for i in range(stations):
        a = (-1 + 2 * i / (stations - 1)) * half_angle
        secs.append([(math.sin(a) * rr, math.cos(a) * rr - r_centre, zz)
                     for (rr, zz) in pts])
    return secs


def wedge(name, pts, r_centre, half_angle, mat, stations=13):
    """One curved module: `pts` is the radial cross-section as [(radius, z)…],
    closed, counter-clockwise in the (radius, z) plane."""
    return R.loft(name, arc_profile(pts, r_centre, half_angle, stations), mat)


def round_corner(cx, cz, r, a0, a1, k=3):
    """k points of a corner arc, for hand-built radial profiles."""
    return [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / (k - 1))) * r,
             cz + math.sin(math.radians(a0 + (a1 - a0) * i / (k - 1))) * r)
            for i in range(k)]
