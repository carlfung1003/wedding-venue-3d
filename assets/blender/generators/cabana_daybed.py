"""cabana_daybed — the white cushioned daybed inside the lagoon islet's dark
woven-rattan cabana pods.

⚠ THE DOME IS ARCHITECTURE AND STAYS THE GAME'S. `buildLagoonIsle` draws it as
one instanced `SphereGeometry(1, 16, 9, π/2 + GAP/2, TAU − GAP, 0, π×.5)` with a
missing wedge facing the water (js/water.js:3043-3060), on a night-tinted rattan
material. This GLB is the BED that sits under it, nothing else.

Source: js/water.js:2996-3002, the `'pod'` branch, with `I.cab = 2.6` and
`deckY = topY = .42` from SITE.LAGOON.ISLE (js/site.js:1294-1303):

    put(whiteB, 0, deckY + .26, 0, I.cab*.72, .34, I.cab*.58);   // the bed
    put(whiteB, ±I.cab*.18, deckY + .52, −I.cab*.18, .52, .18, .34);  // pillows

so, measured off the deck's top surface (y .42 — the deck slab is
`I.cab × .12 × deckD` centred at deckY − .06):

    bed      1.872 wide × 1.508 deep × .34 tall, its underside .09 CLEAR of the
             deck (the primitive's bed floats)                → .09 … .43
    pillows  .52 × .34 × .18, at x ±.468, z −.468 (the back)   → .43 … .61

    the model is 1.872 × 1.508 × 0.610 and a drop-in sits at y = deckY = .42,
    which is the deck slab's own top face.

── ⚠ THE ROTATION, WHICH IS THE WHOLE RISK ────────────────────────────────────
The pod is authored with **local +Z pointing OUTWARD, at the water** — that is
what `yaw = π/2 − th` is for, and the dome's missing wedge is centred on that
same +Z (js/water.js:2963-2966, 3043-3046). This asset's FRONT is the house
default, glTF **−Z**, so a drop-in needs

    ry = yaw + Math.PI                    ( = 3π/2 − th )

`ry = yaw` seats the bed backwards: bolsters at the water, open side at the
grass, inside a dome whose opening is at the water. Nothing throws.

── CODE VS PHOTO ──────────────────────────────────────────────────────────────
`reference/photos/resort-pool-cabana-view.webp` is shot from INSIDE one of these
pods, so it is the best reference on this asset and it beats the code on FORM:
the mattress is one deep white slab with a strongly BOWED FRONT EDGE following
the dome's circular plan, and the cushions are two big soft flank bolsters
standing against the woven walls at the back corners — not two flat pillows lying
on the bed. Modelled that way inside the code's own box: the bow is 194 mm at the
centre-line and the corners still reach the primitive's ±.936, so the plan's
extremes and the collider ring (two r 1.05 circles, js/campus.js:4891 for the
roof twin; here the pod is inside the assembly's single r `ringR + cab/2` circle,
js/water.js:3063) are untouched.

The primitive's floating bed gets a real LOW FRAME: a dark woven plinth on the
deck, 90 mm high, which is exactly the gap the primitive left as air.

Finish: `linen_ivory.webp` on `ivory` for the mattress and bolsters — the
photograph's cushions are warm white, not paper white — over a plinth in
`straw_weave.webp` tinted DARK, so the base belongs to the rattan dome above it
rather than to the bed.
"""
import wv_lib as L
import _pool as P

NAME = "cabana_daybed"
ATLAS = 512
BEVEL = 0                 # per part: heavy on the soft goods, light on the frame
AO_DIST = 0.30            # a dome over a mattress is half-enclosed (daybed's value)
AO_STRENGTH = 0.5
TRIS = 3000
FRONT = "-Z"              # the open side, at the water — see the rotation note
ORIGIN = "floor"          # = the pod deck's top face, y = deckY = .42

CAB = 2.6                 # SITE.LAGOON.ISLE.cab          js/site.js:1300
W = CAB * 0.72            # 1.872 — the bed's width, tangential
D = CAB * 0.58            # 1.508 — the bed's depth, radial
FRAME_H = 0.09            # the air the primitive left under its bed
MATT_H = 0.34             # the primitive's bed thickness
TOP = 0.61                # the pillows' top, off the deck
BOW = 0.194               # how far the front edge bows past the corners


def build():
    rnd = L.rng(NAME)
    linen = P.tex("pod_linen", "linen_ivory.webp", roughness=0.90,
                  fallback="ivory", tint_to="ivory")
    weave = P.tex("pod_weave", "straw_weave.webp", roughness=0.86,
                  fallback="dark", tint_to="dark", gain=(1.35, 1.25, 1.15))
    soft, frame = [], []

    # ── the low frame: a dark woven plinth, inset so the mattress oversails it
    plan = P.curved_plan(W - 0.10, D - 0.10, BOW * 0.86, corner=0.10, arc=8)
    base = L.prism("frame", plan, FRAME_H, (0, 0, 0), weave)
    L.bevel([base], width=0.010, segments=2, angle=40, min_size=0.05)
    P.metric_uv(base, 0, 2, tile=0.32)
    frame.append(base)
    # a shadow reveal under it, so the bed does not look glued to the deck
    rev = L.prism("reveal", P.curved_plan(W - 0.20, D - 0.20, BOW * 0.78,
                                         corner=0.10, arc=6),
                  0.022, (0, 0, -0.001), weave)
    P.metric_uv(rev, 0, 2, tile=0.32)
    frame.append(rev)

    # ── the mattress: one deep slab, bowed at the front, softened all round
    matt = L.prism("mattress", P.curved_plan(W, D, BOW, corner=0.13, arc=8),
                   MATT_H - 0.02, (0, 0, FRAME_H + 0.01), linen)
    L.bevel([matt], width=0.058, segments=3, angle=40, min_size=0.05)
    L.jitter(matt, 0.004, rnd)
    P.metric_uv(matt, 0, 1, tile=0.70)
    soft.append(matt)

    # ── the two flank bolsters, standing against the dome's back quarters and
    #    leaning into it, which is how the photograph has them
    for sx in (-1, 1):
        b = L.box(f"bolster{sx}", (0.44, 0.40, 0.36),
                  (sx * 0.600, -0.430, TOP - 0.18), linen, rot=(8, 0, -9 * sx))
        L.bevel([b], width=0.072, segments=3, angle=40, min_size=0.05)
        L.jitter(b, 0.005, rnd)
        P.metric_uv(b, 0, 2, tile=0.62)
        soft.append(b)

    # ── a low back bolster running between them along the bed's back edge
    back = L.box("back", (W - 0.62, 0.30, 0.26), (0, -0.58, FRAME_H + MATT_H + 0.08),
                 linen, rot=(13, 0, 0))
    L.bevel([back], width=0.074, segments=3, angle=40, min_size=0.05)
    L.jitter(back, 0.004, rnd)
    P.metric_uv(back, 0, 2, tile=0.62)
    soft.append(back)

    root = L.join(frame + soft, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    return root
