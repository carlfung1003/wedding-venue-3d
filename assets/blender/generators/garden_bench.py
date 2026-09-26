"""garden_bench — a backless slatted teak garden bench (KAN-211 wave E).

Replaces two box benches that were a brown slab on two blocks:

  campus.js buildGrassGround — "two teak benches at the seaward edge, facing
      the water" on the cocktail/ceremony lawn (BEACH_LAWN): a 1.9 × .09 × .5
      seat at y .43 (top .475) on two .12 × .43 × .44 legs at x ±.78, one
      collider r .95 at the centre. THIS asset is authored at exactly that
      envelope: 1.90 long (x) × .50 deep (z) × .475 to the seat top.
  campus.js buildSecondPoolPavilion — "two low timber benches, in the end
      bays": a .62 × .11 × 2.6 slat seat at plY + .40 on two .5 × .38 × .12
      dark blocks, three colliders. The SAME GLB, turned π/2 and scaled
      (2.6 / 1.9, .455 / .475, .62 / .5) — a bench is a bench; the 37 %
      stretch of the grain along its length does not read.

Colliders are untouched at both sites; the GLB stays inside the old boxes'
footprints (± .95 × ± .25 here).

Build: seven seat slats with open 12 mm joints and eased edges, two aprons
under them, two TRESTLE ends (a pair of square legs, a top cross rail under
the slats, a low foot rail) and a long stretcher between the trestles. Teak:
`oak_light.webp` graded to the palette's weathered-honey `teak` (the venue's
light is warm and bright — the chair's lesson: grade darker than the target).
Origin floor centre; front −Z (a backless bench is symmetric).
"""
import wv_lib as L
import _resort as R

NAME = "garden_bench"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.4
AO_STRENGTH = 0.55
TRIS = 900
FRONT = "-Z"
ORIGIN = "floor"

L.PALETTE.setdefault("teak", L._hex("a07650"))
TEAK_GAIN = (0.62, 0.50, 0.40)

LEN, DEP, TOP = 1.90, 0.50, 0.475
SLAT_T = 0.034
N_SLAT, GAP = 7, 0.012


def build():
    teak = R.tex("teak_grain", "oak_light.webp", roughness=0.78, fallback="teak",
                 tint_to="teak", gain=TEAK_GAIN)
    parts = []
    sw = (DEP - GAP * (N_SLAT - 1)) / N_SLAT
    for i in range(N_SLAT):
        y = -DEP / 2 + sw / 2 + i * (sw + GAP)
        s = L.box(f"slat{i}", (LEN, sw, SLAT_T), (0, y, TOP - SLAT_T / 2), teak)
        L.bevel([s], width=0.004, segments=1, angle=40, min_size=0.01)
        R.metric_uv(s, 0, 1, tile=0.9)
        parts.append(s)
    zc = TOP - SLAT_T
    # two aprons along the length, set in from the edges
    for sy in (-1, 1):
        a = L.box(f"apron{sy}", (LEN - 0.30, 0.028, 0.075), (0, sy * (DEP / 2 - 0.07), zc - 0.0375), teak)
        R.metric_uv(a, 0, 2, tile=0.9)
        parts.append(a)
    # the trestles
    for sx in (-1, 1):
        x = sx * 0.74
        for sy in (-1, 1):
            leg = L.box(f"leg{sx}{sy}", (0.055, 0.055, zc), (x, sy * (DEP / 2 - 0.06), zc / 2), teak)
            L.bevel([leg], width=0.003, segments=1, angle=40, min_size=0.01)
            R.metric_uv(leg, 1, 2, tile=0.9)
            parts.append(leg)
        cr = L.box(f"cross{sx}", (0.055, DEP - 0.04, 0.07), (x, 0, zc - 0.035), teak)
        R.metric_uv(cr, 1, 2, tile=0.9)
        parts.append(cr)
        ft = L.box(f"foot{sx}", (0.045, DEP - 0.10, 0.045), (x, 0, 0.11), teak)
        R.metric_uv(ft, 1, 2, tile=0.9)
        parts.append(ft)
    st = L.box("stretcher", (1.48 - 0.055, 0.04, 0.05), (0, 0, 0.11), teak)
    R.metric_uv(st, 0, 2, tile=0.9)
    parts.append(st)
    root = L.join(parts, NAME, origin="floor")
    return root
