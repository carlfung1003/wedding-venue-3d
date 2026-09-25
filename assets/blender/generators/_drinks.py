"""_drinks — the four wedding cocktails on the round bar, shared by
`cocktail_glassware` (the glass shells, GEOMETRY ONLY) and `cocktail_drinks`
(everything opaque inside and on them, BAKED). KAN-208 wave 3.

WHY TWO ASSETS. CLAUDE.md's standing note was "tinted opaque liquid inside
transparent glass — a bake cannot ship it". That is true of ONE asset: one GLB
is one material, and the glass has to stay the game's `glassPale`
(transparent .45, NO transmission — the champagne tower's transmission coupes
cost a whole extra scene render, "the transmission win"). Split the job and it
ships: the shells are a geometry-only GLB the game pairs with `glassPale` in
its existing instanced program; the liquids, foam, ice and garnishes are
opaque, so they bake like any other prop. Opaque renders first, so the colour
reads THROUGH the glass, never in front of it.

THE LAYOUT is moments.js roundBar()'s own (js/moments.js, "the four wedding
cocktails"), in the bar's frame with the origin on the bar TOP at its centre
(the game places both GLBs at (0, 1.13, 0) through the bar's frame F). The
glass rows face the arriving guests at local −Z. Blender y = −glTF z.

  与我常在      Aperol spritz — stemmed wine glass, grapefruit wedge + rosemary   ×4
  心动的旋律    pink cranberry-coconut (non-alc) — tall stemmed tulip, foam, a leaf ×3
  翠露晨光      yellow rum highball — faceted straight glass, mint + passion fruit  ×4
  荔枝尼格罗尼  amber lychee negroni — heavy rocks tumbler, ice, orange twist      ×4
(decor-cocktail-menu.jpg / "cocktails samples.jpeg": the glass TYPES are the
menu's; the old primitives were a glass rod with a tinted rod inside.)
"""
import math

WALL = 0.0028                     # glass wall
N_ROUND = 16                      # lathe segments, round glass
N_FACET = 10                      # the faceted highball: 10 flat faces


def _pos():
    """[(kind, x_gltf, z_gltf)] — roundBar()'s own arithmetic, verbatim"""
    out = []
    for i in range(4):
        out.append(("rocks", -.92 + (i % 2) * .17, -.30 - (i // 2) * .19 + (i % 2) * .06))
    for i in range(4):
        out.append(("highball", -.42 + (i % 2) * .16, -.42 - (i // 2) * .2 + (i % 2) * .05))
    for i in range(4):
        out.append(("spritz", .12 + (i % 2) * .17, -.34 - (i // 2) * .21 + (i % 2) * .07))
    for i in range(3):
        out.append(("tall", .66 + (i % 2) * .17, -.18 - i * .14))
    return out


POS = _pos()

# outer profiles (r, z) bottom → rim, per glass. The shell is this profile
# plus its inward offset back down (a real wall); the liquid fills the inner
# profile up to FILL.
OUTER = {
    # heavy-based double old-fashioned, Ø 9 cm × 9.5 cm, a 1.6 cm solid base
    "rocks": [(0.0, 0.0), (0.043, 0.0), (0.045, 0.004), (0.045, 0.016), (0.046, 0.095)],
    # a straight highball, Ø 6.8 × 15.5, faceted
    "highball": [(0.0, 0.0), (0.033, 0.0), (0.034, 0.004), (0.034, 0.012), (0.035, 0.155)],
    # a wine glass: foot Ø 7.6, stem 9 cm, a bowl Ø 9 bulging to the rim at 21
    "spritz": [(0.0, 0.0), (0.038, 0.0), (0.038, 0.003), (0.012, 0.007), (0.0045, 0.014),
               (0.0045, 0.092), (0.012, 0.100), (0.030, 0.112), (0.043, 0.132),
               (0.046, 0.160), (0.043, 0.192), (0.040, 0.210)],
    # a tall tulip on a stem: foot Ø 7, stem 10 cm, bowl Ø 7.6 → rim at 27
    "tall": [(0.0, 0.0), (0.035, 0.0), (0.035, 0.003), (0.011, 0.007), (0.0042, 0.014),
             (0.0042, 0.102), (0.010, 0.110), (0.026, 0.122), (0.037, 0.150),
             (0.038, 0.200), (0.035, 0.250), (0.034, 0.270)],
}
# where the bowl's inside bottom is (the liquid's foot) and the fill line
BOWL_FLOOR = {"rocks": 0.016, "highball": 0.012, "spritz": 0.104, "tall": 0.112}
FILL = {"rocks": 0.070, "highball": 0.135, "spritz": 0.172, "tall": 0.228}
LIQUID = {"rocks": "negroni", "highball": "rum_yellow", "spritz": "aperol", "tall": "cran_pink"}


def radius_at(kind, z, inner=True):
    """the glass's radius at height z (inner face when `inner`)"""
    prof = OUTER[kind]
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z0 <= z <= z1 and z1 > z0:
            r = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
            return max(r - (WALL if inner else 0.0), 0.002)
    return max(prof[-1][0] - (WALL if inner else 0.0), 0.002)


def shell_profile(kind):
    """outer bottom → rim → inner back down to the bowl floor → axis: a closed
    solid-of-revolution outline for L.lathe (a real wall with a rolled rim)"""
    prof = OUTER[kind]
    top = prof[-1]
    inner = []
    floor = BOWL_FLOOR[kind]
    for (r, z) in reversed(prof):
        if z < floor:
            break
        inner.append((max(r - WALL, 0.001), z))
    inner.append((max(radius_at(kind, floor), 0.001) * 0.6, floor))
    inner.append((0.0, floor))
    return prof + [(top[0] - WALL * 0.5, top[1] + 0.0015)] + inner


def liquid_profile(kind, top_z=None):
    top_z = top_z if top_z is not None else FILL[kind]
    floor = BOWL_FLOOR[kind] + 0.001
    zs = [floor]
    for (_r, z) in OUTER[kind]:
        if floor < z < top_z:
            zs.append(z)
    zs.append(top_z)
    prof = [(0.0, floor)]
    for z in zs:
        prof.append((radius_at(kind, z) - 0.0012, z))
    prof.append((0.0, top_z))
    return prof


def lathe(name, profile, pos, key, n=N_ROUND, phase=0.0):
    """solid of revolution about Blender Z; a point with r == 0 is ONE pole
    vertex (wv_lib.lathe makes a ring of coincident vertices and a cap of them)"""
    import bmesh
    import wv_lib as L
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append([bm.verts.new((math.cos(phase + 2 * math.pi * i / n) * r,
                                        math.sin(phase + 2 * math.pi * i / n) * r, z)) for i in range(n)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(n):
            i2 = (i + 1) % n
            if len(a) == 1:
                bm.faces.new([a[0], b[i], b[i2]])
            elif len(b) == 1:
                bm.faces.new([a[i], a[i2], b[0]])
            else:
                bm.faces.new([a[i], a[i2], b[i2], b[i]])
    if len(rings[0]) > 1:
        bm.faces.new(rings[0][::-1])
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    o = L.from_bmesh(name, bm, pos, key)
    L._orient_normals(o)
    return o
