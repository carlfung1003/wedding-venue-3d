"""suite_sofa — ONE MODULE of the presidential suite's great-room sofa island.

Source: js/suite.js:909-931 (`buildGreatRoom`, "the sofa island"), with
`sx = LIVING_X` and `sz = -21.2`. The island is two back-to-back chaises on a
shared central backrest, standing on a 6.0 x 4.0 espresso plinth:

  plinth        sx +-3.00, y 0 .. .32, sz +-2.00            (:918, NOT in this GLB)
  plinth cap    sx +-3.02, y .30 .. .34, sz +-2.02          (:919, NOT in this GLB)
  backrest      sx +-1.50, y .32 .. 1.06, sz -.95 .. sz -.50   (:921)
  seat, TV side sx +-1.50, y .32 ..  .70, sz -1.95 .. sz -.95  (:924)
  seat, pool    sx +-1.50, y .32 ..  .70, sz  -.50 .. sz +.55  (:923)
  arm blocks    x ax +-.18 at ax = sx +-1.50, y .32 .. .82,
                sz -1.95 .. sz +.55                         (:926-928, NOT in this GLB)
  ~12 teal pillows at y .88                                 (:930-937, NOT in this GLB)

THE MODULE. The upholstery runs 3.00 m in X and 2.50 m in Z (which is exactly
the arm blocks' own z span), so this GLB is **1.000 m of it** and the game
repeats it THREE times at x = sx - 1, sx, sx + 1. Height 0.74 above the plinth
top, i.e. **the GLB's foot is the plinth's top face**: a drop-in sits at
`y = 0.32`, `z = sz - 0.70` (the centre of -1.95 .. +.55), `ry = 0`.

  module  1.000 W x 2.500 D x 0.740 H
  origin  floor centre = the plinth's top face, exact (the bbox is symmetric)
  front   -Z = the TV-FACING chaise, the 1.00 m-deep seat, which is the game's
          own -z side — so ry = 0 and no rotation is needed anywhere.

⚠ suite.js is MIRRORED (its 1a): the call site reflects x through `mx()` and
negates rotation.y. The module is symmetric about its own X centre plane, so
the reflection is a no-op on the shape, and ry = 0 is its own negative.

⚠ NOT in this GLB, each for a reason: the espresso **plinth** and its cap (they
are the ground the island stands on and the `colRect(LIVING_X +-2.85, -23.05,
+-1.85 in z, r .22)` collider at js/suite.js:1598 is measured on them); the two
**arm blocks** (they are the island's ENDS — a module that repeats cannot carry
one); and the **teal pillows**, which alternate `MT.teal` / `MT.tealDeep` per
index and carry their own per-pillow rotation, i.e. a tint stream a single
baked atlas cannot reproduce (the swim-up bar's bottles, again).

DELIBERATE DEVIATIONS, both invisible in the assembled island:
 1 · the back cushion above the seat line is 0.47 deep against the code's 0.45,
     so it overhangs its own base by 10 mm a side and reads as a cushion rather
     than a wall. The seat cushions stop 20 mm clear of it, so the island's
     2.50 m depth is unchanged.
 2 · the seat is a fixed deck (0 .. .16) with a loose cushion on it (.15 .. .385)
     instead of one .38 slab. Same top face, same footprint; the seam is the
     whole reason a 1 m module reads as a module.

FINISH. `reference/photos/IMG_8096.jpg` is the great room from the pool, and its
own note in CLAUDE.md says the sofa arrangement in it is NOT current — so it is
read for finish only, and it disagrees with the code anyway (the photographed
sofa is a taupe corduroy serpentine). **The code wins on colour**: MT.ivory
#e8e2d2, here `ivory` under `linen_ivory.webp`. What the photo does settle is
that this room is glossy white marble under a white coffered ceiling, so the
upholstery is the one soft mass in it: deep radii, a slack top, no hard arris.
"""
import wv_lib as L
import _interior as I

NAME = "suite_sofa"
ATLAS = 512
BEVEL = 0                 # per part: the decks stay crisp, the cushions are soft
AO_DIST = 0.30            # upholstery indoors — 0.5 is a sky term and bakes it black
AO_STRENGTH = 0.5
TRIS = 3000
FRONT = "-Z"
ORIGIN = "floor"
MAT_NAME = "suite_sofa"

W = 1.00                  # the module's share of the 3.00 m run
SEAT_N_D = 1.00           # TV side,   suite.js:924  (sz -1.95 .. sz -.95)
BACK_D = 0.45             # backrest,  suite.js:921  (sz  -.95 .. sz -.50)
SEAT_S_D = 1.05           # pool side, suite.js:923  (sz  -.50 .. sz +.55)
DECK_Z = 0.16             # the fixed deck under the loose cushion
SEAT_Z = 0.38             # y .70 - .32
BACK_Z = 0.74             # y 1.06 - .32
CUSH_INSET = 0.02         # per side, so two modules leave a 40 mm cushion seam

# Blender +Y is the front (glTF -Z) = the TV-facing chaise, so Blender y runs
# from +D/2 at the game's sz - 1.95 to -D/2 at sz + .55.
D = SEAT_N_D + BACK_D + SEAT_S_D                          # 2.500, the arm blocks' span
SEAT_N_Y = D / 2 - SEAT_N_D / 2                           # +0.7500
BACK_Y = D / 2 - SEAT_N_D - BACK_D / 2                    # +0.0250
SEAT_S_Y = -D / 2 + SEAT_S_D / 2                          # -0.7250


def build():
    rnd = L.rng(NAME)
    linen = I.cream_linen("sofa_linen", roughness=0.90)
    parts = []

    for tag, cy, dd in (("n", SEAT_N_Y, SEAT_N_D), ("s", SEAT_S_Y, SEAT_S_D)):
        # the fixed deck: FULL module width, so three modules butt without a gap
        deck = I.pad(f"deck_{tag}", W, dd, 0, cy, 0.0, DECK_Z, 0.030, linen, k=5)
        L.bevel([deck], width=0.006, segments=2, angle=40, min_size=0.03)
        parts.append(deck)
        # the loose seat cushion, deep and soft
        cu = I.pad(f"cush_{tag}", W - 2 * CUSH_INSET, dd - 2 * CUSH_INSET,
                   0, cy, DECK_Z - 0.01, SEAT_Z, 0.075, linen, k=5)
        L.bevel([cu], width=0.040, segments=3, angle=40, min_size=0.03)
        L.jitter(cu, 0.0030, rnd)
        parts.append(cu)

    # the shared central backrest: a plain core between the two decks, then the
    # cushion above the seat line, 10 mm proud of it on both faces
    core = I.pad("back_core", W, BACK_D, 0, BACK_Y, 0.0, SEAT_Z + 0.01, 0.030, linen, k=5)
    L.bevel([core], width=0.006, segments=2, angle=40, min_size=0.03)
    parts.append(core)
    back = I.pad("back_cush", W - 2 * CUSH_INSET, BACK_D + 0.02,
                 0, BACK_Y, SEAT_Z - 0.02, BACK_Z, 0.065, linen, k=5)
    L.bevel([back], width=0.045, segments=3, angle=40, min_size=0.03)
    L.jitter(back, 0.0030, rnd)
    parts.append(back)

    # Every part carries the linen picture, so every part needs a real art UV.
    # ⚠ metric_uv is a PLANAR projection: the axis pair has to be the one the
    # part's VISIBLE face varies in, or the weave bakes as streaks. A deck's top
    # is under its cushion and only the 160 mm side band shows, so the decks and
    # the backrest take (x, z); the cushion tops take (x, y).
    for o in parts:
        I.metric_uv(o, 0, 1 if o.name.startswith("cush") else 2, tile=0.62)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
