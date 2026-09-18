"""sun_lounger — the resort sun lounger, on the hotel roof and at the pools.

TWO call sites, and they disagree about size and about which end the head is:

  js/campus.js:4056-4059 (the rooftop row, `loungerRow`) — UNIT_BOX scales, so
    base     mat4(x, DY+.17, z, .82, .34, 2.05, th)      → .82 W × 2.05 L, z 0….34
    cushion  mat4(x, DY+.40, z, .74, .13, 1.9,  th)      → .74 × 1.90, z .335….465
    back     mat4(..., r+.92, DY+.58, ..., .82, .62, .13, th, .5)
             → a .62 tall panel at radial +.92, raked rx .5 (28.7° from
               vertical): its face runs z .308→.852, radial .771→1.069.
    Local +Z there is the OUTWARD radius (inland), so the HEAD is at +Z and the
    feet point at the drop — collider r .85 (campus.js:4910).

  js/water.js:1541-1556 (`makeLounger`, the clubhouse pool + the enclave deck)
    seat pan .66 × 1.35, z .33….43; raked back at −Z; legs .06² z 0….34;
    a teal folded towel. .66 W × ~1.92 L, head at −Z.

ENVELOPE FOLLOWED: the ROOFTOP one (.82 × 2.05, head at +Z → modelled at
Blender −Y, so the default FRONT "-Z" means the occupant looks at the sea). The
poolside row is 0.16 m narrower and carries no collider at all (water.js:1582
says so explicitly), so the larger envelope is safe there; those placements need
ry + π because water.js points its head at −Z. Recorded in ASSET_SPEC.

DETAIL FOLLOWED: the photographs, not the code's flat white boxes.
reference/photos/rooftop-pool-bar-daylight.webp and
hotel-rooftop-pool-day-night.png both show TIMBER-framed loungers with white
cushions on this roof (the daybeds beside them are the same timber), and
clubhouse-main-pool.jpg shows the same silhouette in white resin. Slatted
timber frame, ivory linen squab, a raked slatted back, low feet.
"""
import math
import wv_lib as L
import _resort as R

NAME = "sun_lounger"
ATLAS = 512
BEVEL = 0                 # per part: the cushions are soft, the slats are crisp
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 2500
FRONT = "-Z"              # the feet end faces −Z; modelled facing Blender +Y
ORIGIN = "floor"

OAK_TEX = "oak_light.webp"
OAK_GAIN = (0.53, 0.45, 0.38)

W, LEN = 0.82, 2.05
HW = W / 2
DECK_Z = 0.335            # top of the frame / underside of the squab
CUSH_T = 0.13
FRAME_Z0 = 0.135          # the side rails' underside; legs below that
HINGE_Y = -0.56           # where the raked back springs from
BACK_TOP = (-1.020, 0.845)     # (y, z) of the back's top edge
RAKE = math.degrees(math.atan2(-(BACK_TOP[0] - HINGE_Y), BACK_TOP[1] - DECK_Z))


def build():
    rnd = L.rng(NAME)
    oak = R.tex("oak_grain", OAK_TEX, roughness=0.72, fallback="oak",
                tint_to="oak", gain=OAK_GAIN)
    linen = R.tex("lounger_linen", "linen_ivory.webp", roughness=0.90,
                  fallback="ivory", tint_to="ivory")
    timber, soft = [], []

    # ---- the frame: two slim side rails carried on four short legs, open
    #      underneath. A full-depth skirt reads as a bench, not a lounger.
    RAIL_H = 0.105
    for sx in (-1, 1):
        r = L.box(f"rail{sx}", (0.055, LEN - 0.02, RAIL_H),
                  (sx * (HW - 0.028), 0.0, DECK_Z - RAIL_H / 2), oak)
        L.bevel([r], width=0.005, segments=2, angle=40, min_size=0.04)
        timber.append(r)
    for y in (-LEN / 2 + 0.035, LEN / 2 - 0.035):
        timber.append(L.box("rail_end", (W - 0.11, 0.05, RAIL_H - 0.018),
                            (0, y, DECK_Z - RAIL_H / 2 - 0.006), oak))

    # ---- four legs, set 0.22 m in from each end (the photo's proportion)
    for sx in (-1, 1):
        for y in (-0.80, 0.78):
            timber.append(L.box("leg", (0.055, 0.075, DECK_Z - RAIL_H + 0.01),
                                (sx * (HW - 0.030), y, (DECK_Z - RAIL_H + 0.01) / 2), oak))
        timber.append(L.box(f"skid{sx}", (0.048, 1.72, 0.040),
                            (sx * (HW - 0.030), -0.01, 0.020), oak))
    timber.append(L.box("stretcher", (W - 0.10, 0.042, 0.042), (0, 0.78, 0.085), oak))
    timber.append(L.box("stretcher2", (W - 0.10, 0.042, 0.042), (0, -0.80, 0.085), oak))

    # ---- the slatted seat deck, hinge to feet
    timber += R.slats("deck", 13, 1, (HINGE_Y + 0.05, LEN / 2 - 0.06), 0.0,
                      (W - 0.12, 0.072, 0.026), DECK_Z - 0.013, oak)

    # ---- the raked back: two side rails, a top rail, seven slats.
    #      RAKE is derived from (HINGE_Y, DECK_Z) → BACK_TOP, ~43° off vertical
    ty, tz = BACK_TOP
    bz0 = DECK_Z - 0.02
    for sx in (-1, 1):
        timber.append(L.strut(f"back_rail{sx}", (sx * (HW - 0.038), HINGE_Y, bz0),
                              (sx * (HW - 0.038), ty, tz), 0.028, oak, n=8))
    timber.append(L.strut("back_top", (-(HW - 0.038), ty, tz), (HW - 0.038, ty, tz),
                          0.028, oak, n=8))
    for i in range(7):
        t = 0.10 + 0.84 * i / 6
        by = HINGE_Y + (ty - HINGE_Y) * t
        bz = bz0 + (tz - bz0) * t
        timber.append(L.box(f"back_slat{i}", (W - 0.135, 0.024, 0.066), (0, by, bz), oak,
                            rot=(RAKE, 0, 0)))

    for o in timber:
        R.metric_uv(o, 0, 2, tile=0.40)

    # ---- the squab: one long ivory cushion over the deck, and the back pad
    y0, y1 = HINGE_Y + 0.02, LEN / 2 - 0.07
    seat = L.box("squab", (W - 0.10, y1 - y0, CUSH_T),
                 (0, (y0 + y1) / 2, DECK_Z + CUSH_T / 2), linen)
    L.bevel([seat], width=0.038, segments=3, angle=40, min_size=0.03)
    L.jitter(seat, 0.0028, rnd)
    R.metric_uv(seat, 0, 1, tile=0.62)
    soft.append(seat)

    plen = math.hypot(ty - HINGE_Y, tz - bz0)
    nrm = (math.cos(math.radians(RAKE)), math.sin(math.radians(RAKE)))   # (y, z) of the pad's face normal
    pad = L.box("back_pad", (W - 0.12, 0.105, plen - 0.04),
                (0, (HINGE_Y + ty) / 2 + nrm[0] * 0.062,
                 (bz0 + tz) / 2 + nrm[1] * 0.062), linen, rot=(RAKE, 0, 0))
    L.bevel([pad], width=0.034, segments=3, angle=40, min_size=0.03)
    L.jitter(pad, 0.0028, rnd)
    R.metric_uv(pad, 0, 2, tile=0.62)
    soft.append(pad)

    # a rolled towel at the head — the one thing that stops it reading as a bench
    towel = L.cyl("towel", 0.072, 0.44, (0, HINGE_Y + 0.21, DECK_Z + CUSH_T + 0.055), linen,
                  n=10, rot=(0, 90, 0))
    L.jitter(towel, 0.004, rnd)
    R.metric_uv(towel, 0, 2, tile=0.35)
    soft.append(towel)

    root = L.join(timber + soft, NAME, origin="floor")
    L.shade_smooth(root, angle=38)
    return root
