"""island_bar — the round island bar on the beach pool's south-west rim: a
thatched cone roof on posts over a round timber counter, on its sand terrace.

Source: js/water.js:2829-2857, with `BA = SITE.RIVER.BAR = {cx −57.5, cz −0.5,
r 5.6, h 3.4}` (js/site.js:907). Read straight off the placements:

    terrace   CylinderGeometry(BA.r, BA.r + .25, .42) at y .21
              → Ø 11.20 at the top, Ø 11.70 at the ground, y 0 … .42
    counter   CylinderGeometry(BA.r×.58 = 3.248, …, 1.1, 20, OPEN) at y .97
              → Ø 6.496, y .42 … 1.52 (the working surface)
    roof      ConeGeometry(BA.r×.95 = 5.32, 1.5, 14) at y BA.h + .4 = 3.8
              → eaves Ø 10.64 at y 3.05, apex y 4.55
    soffit    CircleGeometry(BA.r×.9 = 5.04, 14) at y BA.h − .32 = 3.08
    posts     4 × .14² × 3.1 at radius BA.r×.78 = 4.368, θ = i/4·TAU + .4,
              y .40 … 3.50
    collider  one circle, r BA.r + .3 = 5.90                   (water.js:2857)

    the model is 11.70 × 11.70 × 5.050 (the roof's apex is raised — see the
    deviations), origin floor centre, and a drop-in sits at y = 0 on
    (BA.cx, BA.cz) — the terrace's own ground plane.

── ⚠ THE SOFFIT STAYS THE GAME'S, AND THE ROOF IS BUILT ROUND THAT ────────────
That `CircleGeometry(5.04)` is not decoration: it is **the river's one warm light
at night**, an emissive disc on the night registry (`soffitM.emissiveIntensity =
on ? 1.6 : 0`, js/water.js:2851). A baked atlas cannot be emissive, so the disc
must keep being the game's — and this GLB must not occlude it. The thatch is
therefore closed at the eaves with an **annulus down to r 4.90**, not with a
disc: the game's 5.04 m soffit covers the remaining hole from below with 140 mm
to spare, and from above the roof is still solid.

── THREE DELIBERATE DEVIATIONS ────────────────────────────────────────────────
0. **The apex is 5.05, not the cone's 4.55.** At 1.50 m of rise over a 5.32 m
   eaves radius the primitive's roof is a 15.7° cone, and in the first turntable
   it read as a mushroom cap, not as thatch — the same failure `pool_umbrella`
   found on its canopy and fixed the same way. 2.00 m of rise is 20.6°, a real
   palapa's pitch. **The EAVES — the dimension anything cares about — is
   unchanged at 3.05**, so head clearance, the emissive soffit at 3.08 and the
   r 5.90 collider are all exactly where they were; only the silhouette's top
   0.5 m moves, over open sand, under a 9 m shade tree.
1. **The posts stop at the eaves (y 3.05), not at 3.50.** The primitive's posts
   are 3.1 m tall at radius 4.368, where the cone's own surface is at y 3.318 —
   so all four spear through the thatch and stand 180 mm proud of it. They carry
   no collider (the assembly has one circle at r 5.90), so shortening them moves
   nothing. A ring beam at 2.87 … 3.05 takes the roof, which is what a post-and-
   thatch bar actually is.
2. **The post bearings are mirrored** — Blender +Y becomes glTF −Z, so the
   code's world bearing θ is Blender −θ. A four-post ring at phase .4 is
   symmetric enough that it would not have shown, but it costs nothing to be
   right and it is the sign that catches people on this campus.

Finish: `straw_weave.webp` gained down to a weathered brown for the thatch (the
primitive's roof is 0x7a5637, darker than any straw key), `oak_light.webp` gained
down to a dark timber for the counter's staves and the posts (`MAT.darkWood`),
and `cream` for the sand terrace — `flute` rendered as a white
dinner plate under the venue's 2.1 sun, the wedding pass's "measure, then look".
The thatch takes a HARD gain down (×0.21 red) for the same reason: at ×0.38 the
in-engine shot came back pale straw, nothing like the primitive's 0x7a5637. The counter is STAVED, not a smooth drum: a
cylinder reads as a bucket, thirty vertical boards read as a bar — the round_bar
lesson, at a quarter of its triangles.
"""
import math
import wv_lib as L
import _pool as P

NAME = "island_bar"
ATLAS = 1024              # the thatch and 26 counter staves want the resolution
BEVEL = 0                 # per part; a 4,000-tri roof cannot take a joined bevel
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 4000
FRONT = "-Z"              # radially symmetric
ORIGIN = "floor"

BR = 5.6                  # SITE.RIVER.BAR.r              js/site.js:907
BH = 3.4                  # SITE.RIVER.BAR.h
TERR_H = 0.42
CT_R = BR * 0.58          # 3.248 — counter radius        js/water.js:2833
CT_TOP = 1.52             # its working surface
ROOF_R = BR * 0.95        # 5.32                          js/water.js:2838
EAVES = BH - 0.35         # 3.05 — the cone's own base
APEX = 5.05               # ⚠ RAISED from the cone's 4.55 — see the banner
POST_R = BR * 0.78        # 4.368                         js/water.js:2855
SOFFIT_R = BR * 0.9       # 5.04 — the game's emissive disc; do not occlude it


def build():
    thatch_m = P.tex("bar_thatch", "straw_weave.webp", roughness=0.92,
                     fallback="straw_d", tint_to="straw_d", gain=(0.21, 0.165, 0.145))
    timber = P.tex("bar_timber", "oak_light.webp", roughness=0.80,
                   fallback="oak_d", tint_to="oak_d", gain=(0.40, 0.31, 0.24))
    sand = L.M("cream")
    parts = []

    # ── the sand terrace, with a low stepped rim
    terr = L.cyl("terrace", BR + 0.25, TERR_H - 0.07, (0, 0, (TERR_H - 0.07) / 2),
                 sand, n=34, r2=BR + 0.06)
    parts.append(terr)
    parts.append(L.cyl("terr_cap", BR + 0.08, 0.07, (0, 0, TERR_H - 0.035),
                       sand, n=34, r2=BR))

    # ── the counter: a staved timber drum with a plank top
    drum = P.fluted_drum("counter", CT_R, TERR_H - 0.02, CT_TOP - 0.10, timber,
                         staves=26, depth=0.055, groove=0.10, cap_top=False)
    parts.append(drum)
    P.metric_uv(drum, 0, 2, tile=0.50)
    top = L.cyl("counter_top", CT_R + 0.17, 0.10, (0, 0, CT_TOP - 0.05),
                timber, n=36, r2=CT_R + 0.14)
    L.bevel([top], width=0.012, segments=2, angle=40, min_size=0.05)
    P.metric_uv(top, 0, 1, tile=0.60)
    parts.append(top)
    # a service shelf inside, which is what stops the drum reading as a bin
    isv = L.cyl("shelf", CT_R - 0.22, 0.05, (0, 0, TERR_H + 0.62), timber, n=24)
    P.metric_uv(isv, 0, 1, tile=0.50)
    parts.append(isv)

    # ── four posts up to a ring beam, and the beam the roof sits on
    for i in range(4):
        a = -(i * math.pi / 2 + 0.4)          # ⚠ mirrored: Blender +Y → glTF −Z
        p = L.box(f"post{i}", (0.15, 0.15, EAVES - 0.30),
                  (math.cos(a) * POST_R, math.sin(a) * POST_R,
                   0.30 + (EAVES - 0.30) / 2), timber)
        L.bevel([p], width=0.010, segments=2, angle=40, min_size=0.05)
        P.metric_uv(p, 0, 2, tile=0.45)
        parts.append(p)
    beam = L.tube("ringbeam", POST_R + 0.115, POST_R - 0.115, 0.18,
                  (0, 0, EAVES - 0.09), timber, n=26)
    P.metric_uv(beam, 0, 2, tile=0.45)
    parts.append(beam)

    # ── the thatch. Closed at the eaves with an ANNULUS to r 4.90 so the game's
    #    emissive soffit (r 5.04) still shows — see the banner.
    roof = P.thatch("thatch", ROOF_R, APEX - EAVES, EAVES, thatch_m,
                    n=28, courses=5, step=0.075, eaves_inner=4.90)
    P.metric_uv(roof, 0, 2, tile=0.55)
    parts.append(roof)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
