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

Finish: (KAN-208 wave 1) the thatch is `thatch_palm.webp`, a generated photograph
of real alang-alang thatch (art_manifest `palm_thatch`), slant-mapped so its
strands run down the slope, on five shaggy courses with ragged fringe tips and a
bound topknot — see THATCH_* below; it used to be `straw_weave.webp`, a hat braid,
planar-projected onto smooth frusta, and read as timber shingles. The thatch
atlas is 2048 with the sand terrace's islands weighted to 0.30 (UV_WEIGHT) so the
photograph resolves at guest distance. `oak_light.webp` gained
down to a dark timber for the counter's staves and the posts (`MAT.darkWood`),
and `cream` for the sand terrace — `flute` rendered as a white
dinner plate under the venue's 2.1 sun, the wedding pass's "measure, then look".
The old straw_weave thatch took a HARD gain down (×0.21 red); the photograph is
already a weathered brown, and THATCH_GAIN (×0.31 red) was tuned in-engine to a
sun-bleached grey-gold — lighter than the primitive's 0x7a5637 on purpose, since
a palapa reads as dry grass, not as timber. The counter is STAVED, not a smooth drum: a
cylinder reads as a bucket, thirty vertical boards read as a bar — the round_bar
lesson, at a quarter of its triangles.
"""
import math
import bmesh
import wv_lib as L
import _pool as P

NAME = "island_bar"
ATLAS = 2048              # KAN-208: the thatch PHOTOGRAPH wants the resolution — see below
# the sand terrace is one flat colour + AO and ~half the model's surface; give its
# islands a third of their fair share of the atlas so the thatch gets the texels
UV_WEIGHT = {"cream": 0.30}
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

# ── KAN-208 wave 1: THE THATCH. It used to be straw_weave.webp (a HAT BRAID) planar-
#    projected from above onto five smooth frusta, which in-engine read as brown
#    timber shingles. Now: a generated photograph of real alang-alang thatch
#    (art_manifest `palm_thatch`, strands running DOWN the image, ragged fringe
#    courses), mapped with a SLANT UV so the strands run down the slope and
#    converge at the crown, on SIX courses whose lips hang in a ragged fringe of
#    uneven tips instead of a machined step. Plus a bound topknot at the apex.
THATCH_TEX = "thatch_palm.webp"
THATCH_GAIN = (0.31, 0.255, 0.225)   # linear, on straw_d; tuned in-engine (see docstring)
THATCH_K = 22                      # texture repeats round the eaves (~1.5 m each)
THATCH_TV = 1.55                   # metres of slope per texture repeat (~4 fringes)


def _thatch_uv(o, apex_z):
    """u = K x bearing / 2pi (the strands converge on the crown, as real thatch
    does), v = -(slant distance from the apex) / TV (down the slope = down the
    image). Written per LOOP with the bearing unwrapped across each face, so the
    one seam bearing does not smear a whole face across the texture."""
    me = o.data
    uvl, was = L._art_layer(me, L.ART_UV)
    for poly in me.polygons:
        vs = [me.vertices[me.loops[li].vertex_index].co for li in poly.loop_indices]
        angs = []
        for c in vs:
            r = math.hypot(c.x, c.y)
            angs.append(math.atan2(c.y, c.x) if r > 1e-4 else None)
        known = [a for a in angs if a is not None]
        ref = known[0] if known else 0.0
        fixed = []
        for a in angs:
            if a is None:
                a = ref
            while a - ref > math.pi:
                a -= 2 * math.pi
            while a - ref < -math.pi:
                a += 2 * math.pi
            fixed.append(a)
        # the apex vertex (no bearing) takes the face's mean bearing
        mean = sum(fixed) / len(fixed)
        for k, li in enumerate(poly.loop_indices):
            c = vs[k]
            a = fixed[k] if angs[k] is not None else mean
            s = math.hypot(math.hypot(c.x, c.y), apex_z - c.z)
            uvl.data[li].uv = (THATCH_K * a / (2 * math.pi), -s / THATCH_TV)
    L._restore_active(me, was)


def _shaggy_thatch(name, r, h, z0, mat, n=44, courses=6, eaves_inner=None):
    """A palapa cone laid in `courses` of bundles. Each course is three rings:
      tip  — the fringe: flared out past the cone and hanging BELOW the course
             line by a per-vertex RAGGED drop (teeth of uneven length, not a
             machined step — the one thing that separates thatch from shingles
             in silhouette),
      body — back on the cone just above the fringe, bulged per bundle,
      top  — the cone line where the next course's fringe overlaps it.
    The top of each course and the next course's tip make a face that points
    DOWN and OUT: the shadowed underside of the fringe above it.
    Closed at the eaves with an annulus to `eaves_inner` (the game's soffit)."""
    rnd = L.rng(NAME + ":thatch")
    bm = bmesh.new()
    ang = P.ring_of(n, phase=0.11)

    def cone_r(t):
        return max(r * 0.05, r * (1 - t))

    rings = []
    for c in range(courses):
        t0, t1 = c / courses, (c + 1) / courses
        zc0, zc1 = z0 + h * t0, z0 + h * t1
        k = 1 - c / courses                          # lower courses are shaggier
        flare = 0.10 + 0.10 * k
        drop = 0.10 + 0.24 * k
        tip, body = [], []
        for i, a in enumerate(ang):
            jag = rnd.uniform(0.2, 1.0) * (0.45 if i % 2 else 1.0)
            rt = cone_r(t0) + flare * rnd.uniform(0.75, 1.15)
            zt = zc0 - drop * jag
            tip.append(bm.verts.new((math.cos(a) * rt, math.sin(a) * rt, zt)))
            bulge = 0.035 * k * (0.6 + 0.4 * math.sin(a * 7 + c * 1.3)) + rnd.uniform(0, 0.02)
            tb = t0 + (t1 - t0) * 0.18
            rb = cone_r(tb) + flare * 0.55 + bulge
            body.append(bm.verts.new((math.cos(a) * rb, math.sin(a) * rb, z0 + h * tb)))
        top = [bm.verts.new((math.cos(a) * cone_r(t1), math.sin(a) * cone_r(t1), zc1))
               for a in ang]
        rings += [tip, body, top]
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            try:
                bm.faces.new([A[i], A[i2], B[i2], B[i]])
            except ValueError:
                pass
    apex = bm.verts.new((0, 0, z0 + h))
    last = rings[-1]
    for i in range(n):
        bm.faces.new([last[i], last[(i + 1) % n], apex])
    if eaves_inner is not None:
        first = rings[0]
        inner = [bm.verts.new((math.cos(a) * eaves_inner, math.sin(a) * eaves_inner, z0))
                 for a in ang]
        for i in range(n):
            i2 = (i + 1) % n
            bm.faces.new([first[i], inner[i], inner[i2], first[i2]])
    o = L.from_bmesh(name, bm, (0, 0, 0), mat)
    _thatch_uv(o, z0 + h)
    return o


def _crown(name, apex, mat):
    """The bound topknot every palapa carries: the last bundles gathered, tied,
    and flared a little above the tie. Thatch material, cylindrical UV."""
    o = L.lathe(name, [
        (0.85, apex - 0.50), (0.52, apex - 0.14), (0.33, apex + 0.04),
        (0.29, apex + 0.13), (0.34, apex + 0.18), (0.38, apex + 0.30),
        (0.20, apex + 0.38), (0.0, apex + 0.40),
    ], (0, 0, 0), mat, n=16)
    L.cylindrical_uv(o, repeat=3.0)
    return o


def build():
    thatch_m = P.tex("bar_thatch", THATCH_TEX, roughness=0.95,
                     fallback="straw_d", tint_to="straw_d", gain=THATCH_GAIN)
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
    roof = _shaggy_thatch("thatch", ROOF_R, APEX - EAVES, EAVES, thatch_m,
                          n=56, courses=5, eaves_inner=4.90)
    parts.append(roof)
    parts.append(_crown("crown", APEX, thatch_m))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
