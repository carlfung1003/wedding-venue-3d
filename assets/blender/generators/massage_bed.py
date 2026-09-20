"""massage_bed — the spa's navy massage bed on blond folding legs.

Source: js/suite.js:1322-1331 (`buildAnnex`, "two navy massage beds"), at
`bx = 11.85` and `bx = 13.05`:

  pad      MT.navy           bx +-.35, y .62 .. .74, z -21.90 .. -20.00
  bolster  MT.espressoPlain  bx +-.30, y .74 .. .82, z -21.85 .. -21.55
  legs     MT.ivoryWhite     .05 wide at x bx -+.275, y 0 .. .62,
                             .06 deep at z -21.70 and z -20.20

  0.700 W x 1.900 D x 0.820 H
  origin  floor centre, exact — the pad IS the bbox in plan, so a drop-in sits
          at `x = bx`, `y = 0`, `z = -20.95` (the centre of -21.90 .. -20.00),
          `ry = 0`.
  front   -Z = **the HEAD**, the bolster end, which is the game's own -z end —
          so ry = 0 and no rotation is needed.

⚠ suite.js is MIRRORED (its 1a): `slab()` reflects x through `mx()`. The bed is
symmetric about its own X centre plane, so the reflection is a no-op on the
shape and ry = 0 is its own negative.

⚠ THE COLLIDER IS `colRect(11.5, -21.9, 13.4, -20.0, r .3)` (js/suite.js:1621) —
ONE ring round BOTH beds, 1.90 x 1.90 about (12.45, -20.95), and deliberately
WITHOUT a height window (the annex has no storey over it, so a y-range there
would guard nothing). The two GLBs sit inside it exactly as the primitives did.

FINISH. `reference/photos/Yinyiju spa.webp` is the room, shot from the courtyard
side, and the beds in it are **portable folding massage tables**: a warm blond
timber frame with hinged, slightly splayed legs, a stretcher between each pair,
steel knuckle plates where the legs meet the apron, and a padded top with a soft
rolled bolster at the head. So the finish follows the photo and the envelope
follows the code, as everywhere in Groups E-G:

 1 · **the legs are BLOND TIMBER, not `MT.ivoryWhite`.** The code paints them
     near-white #e9e5da; the photograph's frames are unmistakably timber, and
     a white stick under a navy pad reads as a plastic trestle. `oak` under
     `oak_light.webp` at a lighter gain than the crossback chair's.
 2 · **a timber apron and two stretchers are added**, both entirely inside the
     .70 x 1.90 footprint. The code's four unbraced posts are a stool, not a
     table, and the apron is what the photo's hinges hang off.
 3 · **the legs taper and splay** 30 mm outward at the foot (x +-.305 against
     the code's +-.275). They stay inside the pad's own .35 half-width, which is
     the collider's measure, and the code's .05 sq posts sit inside the taper.
 4 · **the bolster is NAVY, matching the pad**, where the code makes it
     `MT.espressoPlain` dark brown. The photograph has a soft rolled bolster at
     the head; an 80 mm dark block at the end of a navy bed reads as a gap in
     the bed, not as a headrest. Its .60 x .30 x .08 envelope is unchanged.
"""
import wv_lib as L
import _interior as I

NAME = "massage_bed"
ATLAS = 512
BEVEL = 0                 # per part
AO_DIST = 0.15            # a 1.9 m pad over an open leg frame — an enclosed underside
AO_STRENGTH = 0.5
TRIS = 1500
FRONT = "-Z"              # the head, the bolster end
ORIGIN = "floor"

PAD_W, PAD_D = 0.70, 1.90         # suite.js:1324
PAD_Z0, PAD_Z1 = 0.62, 0.74
BOL_W, BOL_D = 0.60, 0.30         # suite.js:1325
BOL_Z1 = 0.82
BOL_Y = 0.75                      # (-21.85 .. -21.55) about z -20.95 -> y .60 .. .90
LEG_X, LEG_Y = 0.275, 0.75        # suite.js:1327-1330
LEG_Z = 0.62
SPLAY = 0.030


def build():
    pad_m = I.navy("navy_pad", roughness=0.55)
    wood = I.blond("blond_frame", roughness=0.70)
    parts, timber = [], []

    # ---- four tapered, splayed folding legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx, ty = sx * LEG_X, sy * LEG_Y
            centres = [(tx + sx * SPLAY, ty + sy * 0.035, 0.0),
                       (tx + sx * SPLAY * 0.45, ty + sy * 0.016, LEG_Z * 0.55),
                       (tx, ty, LEG_Z)]
            secs = [I.rrect(0.044, 0.052, 0.010),
                    I.rrect(0.048, 0.056, 0.011),
                    I.rrect(0.052, 0.062, 0.012)]
            timber.append(I.sweep(f"leg{sx}{sy}", centres, secs, wood, plane="xy"))
        # a stretcher across each leg pair
    for sy in (-1, 1):
        timber.append(L.box(f"stretch{sy}", (0.50, 0.034, 0.046),
                            (0, sy * LEG_Y, 0.180), wood))
    # ---- the side aprons the hinges hang off
    for sx in (-1, 1):
        timber.append(L.box(f"apron{sx}", (0.038, 1.64, 0.056),
                            (sx * 0.300, 0.0, 0.588), wood))
    # ---- dark-steel knuckle plates, outboard of the apron
    # (`steel_l` baked as a near-white sticker in the first in-engine shot:
    #  the bake mutes Metallic for the diffuse pass and the pad's dielectric
    #  key wins the final material, so a light grey metal has nothing to be
    #  metal WITH. `bronze_d` is the photo's dark knuckle anyway.)
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(L.box(f"hinge{sx}{sy}", (0.008, 0.098, 0.070),
                               (sx * 0.3215, sy * LEG_Y, 0.556), "bronze_d"))

    # ---- the pad and its rolled bolster
    pad = I.pad("pad", PAD_W, PAD_D, 0, 0, PAD_Z0, PAD_Z1, 0.055, pad_m, k=5)
    L.bevel([pad], width=0.034, segments=3, angle=40, min_size=0.03)
    L.jitter(pad, 0.0016, L.rng(NAME))
    parts.append(pad)
    bol = I.pad("bolster", BOL_W, BOL_D, 0, BOL_Y, PAD_Z1 - 0.006, BOL_Z1,
                0.068, pad_m, k=5)
    L.bevel([bol], width=0.036, segments=3, angle=40, min_size=0.03)
    parts.append(bol)

    for o in timber:
        I.metric_uv(o, 0, 2, tile=0.34)
    I.metric_uv(pad, 0, 1, tile=0.60)
    I.metric_uv(bol, 0, 1, tile=0.60)
    parts += timber

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
