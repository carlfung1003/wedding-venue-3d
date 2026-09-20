"""lobby_sofa — the check-in lobby's cream low-back sofa.

Source: js/campus.js:3044-3073, the `sofa(cx, cz, cry, len)` helper inside
section F ("THE CHECK-IN LOBBY at lobbyY"). `mat4(x, y, z, sx, sy, sz, ry)`
scales a `UNIT_BOX`, so every number below is a true metre, and `LY` is the
lobby floor — the GLB's y = 0:

  seat     MAT.ivory      len x .30 x .95, centre y LY + .30   -> .15 .. .45   (:3049)
  back     MAT.ivory      len x .66 x .18 at local z -.42      -> .29 .. .95,
                                                        z -.51 .. -.33        (:3051)
  cushions MAT.ivoryWarm  .52 x .52 x .20, centre y LY + .68 at local z -.28,
           round(len/.9) of them at px = -len/2 + .55 + k x .9,
           each yawed by +-0.1 rad                                            (:3052-3058)
  feet     MAT.white      .07 x .15 x .07 at lx +-(len/2 - .18), lz +-.38     (:3059-3065)

  3.400 W x 0.985 D x 0.950 H   (modelled at len = 3.4)
  origin  floor, x/z at the sofa's own registration point (0, 0) — `join()`
          re-origins to the bounding box, and the back's 35 mm of overhang would
          have put the origin 17.5 mm behind where `sofa()` places it, so
          `origin_to()` pins it instead.
  front   -Z. `P(lx, lz)` maps local +z to the OPEN side (the back sits at
          lz -.42), so **a drop-in needs `ry = cry + Math.PI`**. `ry = cry`
          seats every sofa backwards, facing the wall, and nothing throws.

FOUR CALL SITES, TWO LENGTHS (js/campus.js:3077-3083):

  sofa(LB.x0 + 4.4, -15.6, 0,       3.4)   the north pair, over the big rug
  sofa(LB.x0 + 4.4, -10.8, Math.PI, 3.4)
  sofa(LB.x0 + 4.4,  -6.2, 0,       2.8)   the south pair
  sofa(LB.x0 + 4.4,  -3.0, Math.PI, 2.8)

⚠ **The model is the len = 3.4 sofa** — the pair the guest-journey route walks
past. The short pair needs `scale.x = 2.8 / 3.4 = 0.8235`, which compresses the
four cushions to 0.43 m (the code draws three there, at the same 0.9 m pitch).
Declared, and the alternative is a second GLB.

⚠ **`rectCollider(C, cx, cz, len + .3, 1.1, cry, .28, ABOVE)`** (js/campus.js:3068)
is the thing that must not move: 3.70 x 1.10 about the same centre, and
**height-gated ABOVE** because the 酒廊 breakfast room is 3.6 m underneath. The
GLB's 3.40 x 0.985 sits inside it with 0.15 m to spare on every side.

DELIBERATE DEVIATIONS, both inside the collider and the bbox:
 1 · **the scatter cushions lean.** The code stands them bolt upright with their
     backs 50 mm INSIDE the back panel; here each leans 10 deg and rests on the
     back's front face at z -.33, which walks the cushion forward to local
     z -.22. The bbox is set by the back panel and the seat, not by them.
 2 · **the scatter cushions are centred on the sofa's own length.** The code's
     `px = -len/2 + .55 + k * .9` with `round(len/.9) = 4` cushions puts the
     fourth at x +1.55 on a sofa that ends at +1.70 — so 110 mm of its 520 mm
     hangs off the end, and the assembly is 3.62 m wide about a centre 55 mm to
     the right of the one the collider is measured on. A .85 m pitch keeps all
     four on the sofa and the bbox at 3.40.
 3 · **the seat is a frame plus four loose cushions**, not one .30 m slab —
     a fixed band .15 .. .28 and four .82 x .90 x .18 cushions on it at a .85 m
     pitch. Same top face at .45, same footprint. "Square cushions" is what the
     builder's own comment asks for, and a 3.4 m unbroken slab reads as a bench.

FINISH from `reference/photos/clubhouse-lounge-checkin-balcony.jpg` and
`lounge-checkin-view.jpg` — which are both the same EXTERIOR three-quarter of
the pavilion and show no furniture at all, so there is nothing in them to
follow. The builder's own comment is the spec instead ("cream, low-back, square
cushions, facing each other over dark timber tables"), and the code's colours
are taken at face value: MAT.ivory #e8e2d4 for the body, MAT.ivoryWarm #dfd6c3
for the scatters (a half-stop warmer, which is why they are a second material),
MAT.white #f2efe6 for the feet.
"""
import wv_lib as L
import _interior as I

NAME = "lobby_sofa"
ATLAS = 512
BEVEL = 0                 # per part
AO_DIST = 0.30            # upholstery indoors
AO_STRENGTH = 0.5
TRIS = 2500
FRONT = "-Z"
ORIGIN = "floor"

LEN = 3.40                # campus.js:3077 — the modelled length
SEAT_D = 0.95             # campus.js:3049
SEAT_Z0, SEAT_Z1 = 0.15, 0.45
FRAME_Z1 = 0.28           # the fixed band under the loose cushions
BACK_D, BACK_Y = 0.18, -0.42        # campus.js:3051
BACK_Z0, BACK_Z1 = 0.29, 0.95
CUSH = (0.52, 0.20, 0.52)           # campus.js:3055
CUSH_Y, CUSH_Z = -0.22, 0.670       # leaned; see the deviation note
FOOT = (0.07, 0.07, 0.15)           # campus.js:3062
N_SEAT = 4


def build():
    rnd = L.rng(NAME)
    body = I.cream_linen("lobby_linen", roughness=0.88, gain=I.IVORY_GAIN)
    warm = I.cream_linen("lobby_warm", roughness=0.90, gain=I.WARM_GAIN)
    parts, clad = [], []

    # ---- four small white feet
    for sx in (-1, 1):
        for sy in (-1, 1):
            f = L.box(f"foot{sx}{sy}", FOOT,
                      (sx * (LEN / 2 - 0.18), sy * 0.38, FOOT[2] / 2), "paint_w")
            L.bevel([f], width=0.008, segments=2, angle=40, min_size=0.03)
            parts.append(f)

    # ---- the seat frame band
    fr = L.box("frame", (LEN, SEAT_D, FRAME_Z1 - SEAT_Z0),
               (0, 0, (SEAT_Z0 + FRAME_Z1) / 2), body)
    L.bevel([fr], width=0.022, segments=2, angle=40, min_size=0.03)
    clad.append(fr)

    # ---- four loose seat cushions on it
    pitch = LEN / N_SEAT
    for k in range(N_SEAT):
        x = -LEN / 2 + pitch * (k + 0.5)
        c = L.box(f"seat{k}", (pitch - 0.03, SEAT_D - 0.05, SEAT_Z1 - FRAME_Z1 + 0.01),
                  (x, 0.01, (FRAME_Z1 - 0.01 + SEAT_Z1) / 2), body)
        L.bevel([c], width=0.042, segments=2, angle=40, min_size=0.03)
        L.jitter(c, 0.0026, rnd)
        clad.append(c)

    # ---- the low back
    bk = L.box("back", (LEN, BACK_D, BACK_Z1 - BACK_Z0),
               (0, BACK_Y, (BACK_Z0 + BACK_Z1) / 2), body)
    L.bevel([bk], width=0.034, segments=2, angle=40, min_size=0.03)
    clad.append(bk)

    # ---- the square scatter cushions, leaning on the back
    n_c = round(LEN / 0.9)
    for k in range(n_c):
        # centred on the sofa's own length, NOT the code's -len/2 + .55 + k*.9
        x = -LEN / 2 + (k + 0.5) * (LEN / n_c)
        yaw = (rnd.random() - 0.5) * 11.0
        c = L.box(f"cush{k}", CUSH, (x, CUSH_Y, CUSH_Z), warm, rot=(10.0, 0, yaw))
        L.bevel([c], width=0.040, segments=2, angle=40, min_size=0.03)
        L.jitter(c, 0.0030, rnd)
        parts.append(c)

    for o in clad:
        I.metric_uv(o, 0, 2 if o is bk else 1, tile=0.62)
    for o in parts:
        if o.name.startswith("cush"):
            I.metric_uv(o, 0, 2, tile=0.55)
    parts += clad

    root = L.join(parts, NAME, origin=None)
    lo, _ = L.bounds(root)
    L.origin_to(root, (0.0, 0.0, lo[2]))      # the sofa's own (0, 0), foot on the floor
    L.shade_smooth(root, angle=40)
    return root
