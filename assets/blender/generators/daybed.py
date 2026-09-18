"""daybed — the four-poster cabana daybed, the pool room's whole elevation.

Source: js/campus.js:4118-4149, the `daybedRow(R)` loop. Local +Z there is the
OUTWARD radius (inland), local +X the tangent, so Blender Y = −radial and
Blender X = tangential:

  deck platform  (3.30 tang × 2.80 rad × .22)  z 0 … .22        MAT.deck
  slatted base   (2.86 × 2.30 × .34)           z .21 … .55      MAT.slat
  mattress       (2.72 × 2.16 × .26)           z .49 … .75      MAT.white
  back bolster   radial +.92, (2.60 × .30 wide × .44 tall)  z .62 … 1.06
  2 throw cush.  radial +.62, tang ±.62, (.46 × .18 × .30) at z .86
  4 posts        radial ±1.18, tang ±1.44, (.11² × 2.40)  z .22 … 2.62
  canopy         (3.22 × 2.70 × .20)           z 2.58 … 2.78    MAT.white
  canopy trim    (3.26 × 2.74 × .07)           z 2.515 … 2.585  MAT.slat
  end curtains   tang ±1.40, (.09 × 2.34 deep × 2.30 tall)  z .27 … 2.57
  back drapes    radial +1.14, tang ±.84, (.74 × .09 × 2.30)  z .27 … 2.57

→ 3.30 × 2.80 footprint, 2.78 high, back (bolster) inland, open side at the
pool. roofColliders() (campus.js:4891) rings it as two r 1.05 circles at
tangential ±.9, which the 3.30 m platform contains.

FRONT "-Z" (the default): the open side faces the water, so it is modelled
facing Blender +Y.

⚠ Code vs photo on the CURTAINS, and the photo wins for detail.
reference/photos/hotel-rooftop-pool-day-night.png — the spec's "the thing that
makes the roof read at distance" — shows the curtains TIED BACK against the four
posts as white gathered columns, with the back corners half drawn, not four flat
slabs. They are modelled that way, in the code's own planes (tang ±1.40 for the
ends, radial +1.14 × tang ±.84 for the back), so the silhouette is unchanged.

The tray table, the planted pot, the hedge blob and the warm lamp strip that
`daybedRow`'s loop also draws are NOT part of this GLB — they are separate
objects standing beside the bed and the game still draws them.
"""
import wv_lib as L
import _resort as R

NAME = "daybed"
ATLAS = 512
BEVEL = 0                 # per part: soft on the mattress, crisp on the frame
AO_DIST = 0.30            # a canopy over a mattress is half-enclosed
AO_STRENGTH = 0.5
TRIS = 4000
FRONT = "-Z"
ORIGIN = "floor"

OAK_TEX = "oak_light.webp"
OAK_GAIN = (0.53, 0.45, 0.38)

DECK = (3.30, 2.80, 0.22)
BASE = (2.86, 2.30, 0.34)
MATT = (2.72, 2.16, 0.26)
POST_X, POST_Y, POST_S, POST_Z1 = 1.44, 1.18, 0.11, 2.62
CAN_Z0, CAN_Z1 = 2.58, 2.78
CURT_Z0, CURT_Z1 = 0.27, 2.55


def build():
    rnd = L.rng(NAME)
    oak = R.tex("oak_grain", OAK_TEX, roughness=0.72, fallback="oak",
                tint_to="oak", gain=OAK_GAIN)
    linen = R.tex("daybed_linen", "linen_ivory.webp", roughness=0.90,
                  fallback="ivory", tint_to="ivory")
    chiffon = R.tex("daybed_curtain", "chiffon_white.webp", roughness=0.94,
                    fallback="chiffon", tint_to="chiffon")
    timber, soft, cloth = [], [], []

    # ---- the timber deck platform, with real plank seams across it
    deck = L.box("deck", (DECK[0], DECK[1], DECK[2] - 0.026), (0, 0, (DECK[2] - 0.026) / 2), oak)
    L.bevel([deck], width=0.010, segments=2, angle=40, min_size=0.05)
    timber.append(deck)
    timber += R.slats("plank", 9, 1, (-DECK[1] / 2 + 0.16, DECK[1] / 2 - 0.16), 0.0,
                      (DECK[0] - 0.05, 0.255, 0.028), DECK[2] - 0.012, oak)

    # ---- the bed base: a slatted timber plinth with a shadow reveal
    base = L.box("base", (BASE[0], BASE[1], 0.20), (0, 0, 0.21 + 0.10), oak)
    L.bevel([base], width=0.008, segments=2, angle=40, min_size=0.05)
    timber.append(base)
    timber.append(L.box("base_cap", (BASE[0] + 0.05, BASE[1] + 0.05, 0.075),
                        (0, 0, 0.55 - 0.037), oak))
    for sx in (-1, 1):      # the base's side slats, seen under the mattress edge
        timber.append(L.box(f"base_slat{sx}", (0.045, BASE[1] - 0.10, 0.15),
                            (sx * (BASE[0] / 2 - 0.022), 0, 0.38), oak))

    # ---- four posts + the canopy they carry
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = L.box(f"post{sx}{sy}", (POST_S, POST_S, POST_Z1 - 0.22),
                      (sx * POST_X, sy * POST_Y, 0.22 + (POST_Z1 - 0.22) / 2), oak)
            L.bevel([p], width=0.007, segments=2, angle=40, min_size=0.05)
            timber.append(p)
            # a small bracket where the post meets the canopy frame
            timber.append(L.box(f"brk{sx}{sy}", (POST_S + 0.06, POST_S + 0.06, 0.05),
                                (sx * POST_X, sy * POST_Y, 2.515), oak))
    # the canopy's timber trim — the code's 3.26 × 2.74 plate, as a real frame
    for sy in (-1, 1):
        timber.append(L.box(f"trim_x{sy}", (3.26, 0.080, 0.075), (0, sy * 1.330, 2.552), oak))
    for sx in (-1, 1):
        timber.append(L.box(f"trim_y{sx}", (0.080, 2.58, 0.075), (sx * 1.590, 0, 2.552), oak))
        timber.append(L.box(f"trim_b{sx}", (0.055, 2.36, 0.055), (sx * POST_X, 0, 2.500), oak))

    for o in timber:
        R.metric_uv(o, 0, 2, tile=0.45)

    # the stretched white canopy, crowned slightly so it is not a lid
    can = L.box("canopy", (3.22, 2.70, CAN_Z1 - CAN_Z0), (0, 0, (CAN_Z0 + CAN_Z1) / 2), chiffon)
    L.bevel([can], width=0.030, segments=2, angle=40, min_size=0.05)
    R.metric_uv(can, 0, 1, tile=0.9)
    cloth.append(can)

    # ---- the mattress and its cushions
    matt = L.box("mattress", (MATT[0], MATT[1], MATT[2]), (0, 0, 0.49 + MATT[2] / 2), linen)
    L.bevel([matt], width=0.055, segments=3, angle=40, min_size=0.05)
    L.jitter(matt, 0.004, rnd)
    R.metric_uv(matt, 0, 1, tile=0.72)
    soft.append(matt)

    bol = L.box("bolster", (2.60, 0.30, 0.44), (0, -0.92, 0.84), linen)
    L.bevel([bol], width=0.115, segments=3, angle=40, min_size=0.05)
    L.jitter(bol, 0.004, rnd)
    R.metric_uv(bol, 0, 2, tile=0.72)
    soft.append(bol)

    for sx in (-1, 1):
        c = L.box(f"cushion{sx}", (0.46, 0.18, 0.30), (sx * 0.62, -0.62, 0.86), linen,
                  rot=(-7 * sx, 0, 3 * sx))
        L.bevel([c], width=0.048, segments=3, angle=40, min_size=0.05)
        L.jitter(c, 0.004, rnd)
        R.metric_uv(c, 0, 2, tile=0.60)
        soft.append(c)

    # ---- the curtains: four tied-back columns at the posts, two back drapes
    for sx in (-1, 1):
        for sy in (-1, 1):
            g = R.gathered(f"tie{sx}{sy}", (sx * 1.40, sy * 1.14, CURT_Z1),
                           CURT_Z1 - CURT_Z0, 0.135, 0.082, 0.205, chiffon,
                           n=12, flutes=6, rows=10)
            R.metric_uv(g, 0, 2, tile=0.7)
            cloth.append(g)
            # the fabric tie that holds it against the post
            band = L.cyl(f"band{sx}{sy}", 0.092, 0.060,
                         (sx * 1.40, sy * 1.14, CURT_Z0 + (CURT_Z1 - CURT_Z0) * 0.45),
                         chiffon, n=10)
            cloth.append(band)

    for sx in (-1, 1):
        sh = R.pleat_sheet(f"drape{sx}", 0.74, CURT_Z1 - CURT_Z0, chiffon,
                           pos=(sx * 0.84, -1.14, CURT_Z1), plane="xz",
                           cols=13, rows=6, pleats=4, depth=0.032, hem_wave=0.028,
                           taper=0.03, rnd=rnd)
        L.solidify(sh, 0.008, offset=0.0)
        R.metric_uv(sh, 0, 2, tile=0.7)
        cloth.append(sh)

    root = L.join(timber + cloth + soft, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
