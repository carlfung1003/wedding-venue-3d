"""candelabra (+ candelabra_flames) — the dinner's two-tier crystal candle
chandelier that hangs off the tall curved poles (decor-dinner-chandeliers.jpg;
refsheets/candelabra.png). The pole stays procedural in moments.js.

Spec row: ORIGIN = HOOK (z 0), hangs down −Z. Rod Ø .032 × .68; canopy r .13; a
column Ø .05 × .72; tier of 8 arms at r .56 and tier of 6 arms at r .37; each
arm ends in a bobèche + a candle Ø .028 × .13 + a flame; a swag of 16 crystals at
r .45 around the bottom; total drop ~1.35. Budget 9,000 / 512 / bevel 0.

Flames are `build_flames()` → `candelabra_flames`, material `flame_emit` ONLY
(one material per GLB; the loader keeps it emissive). Same hook frame.

Every lit part uses the single key `crystal` (the render's fixture is clear
glass throughout, candles included — `candle` f7f1e4 and `crystal` e8f0f6 are
indistinguishable at guest distance), so the baked material is named `crystal`
by the sole-key rule and the loader gives it the glow. ⚠ MAT_NAME is deliberately
NOT set: make_masters applies it to every build_*() of the module, and it would
rename the flames away from `flame_emit`.

Deviation (declared): the spec/procedural puts the 6-arm tier ".30 lower" than
the 8-arm tier; the render and the refsheet both show the SMALL tier on top and
the wide 8-arm tier below, which is how a two-tier chandelier is built. Modelled
that way. Envelope kept: r .56 max, hook at 0, drop 1.39.
"""
import math
import wv_lib as L

NAME = "candelabra"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.3
TRIS = 9000
FRONT = "-Z"
ORIGIN = "hook"

K = "crystal"
ROD_R, ROD_L = 0.016, 0.68
CAN_Z = -ROD_L                    # canopy top
COL_TOP, COL_BOT = -0.73, -1.35
# (arm count, reach, hub z, bobèche z)
TIERS = [(6, 0.37, -0.95, -0.88), (8, 0.56, -1.25, -1.16)]
CANDLE_R, CANDLE_H = 0.014, 0.13
ARM_R, ARM_SEG = 0.012, 5
SWAG_N, SWAG_R = 16, 0.45


def _arm_pts(a, reach, z_hub, z_bob):
    """The classic S-arm: out from the column, dipping, then sweeping up to the
    bobèche. Points in the arm's vertical plane at angle a."""
    r0 = 0.035
    dip = 0.13 * reach / 0.56
    pts = []
    for i in range(ARM_SEG + 1):
        t = i / ARM_SEG
        r = r0 + (reach - r0) * t
        z = z_hub + (z_bob - 0.03 - z_hub) * t - dip * math.sin(math.pi * t)
        pts.append((r * math.cos(a), r * math.sin(a), z))
    return pts


def _candle_tops():
    tops = []
    for j, (n, reach, z_hub, z_bob) in enumerate(TIERS):
        for i in range(n):
            a = 2 * math.pi * i / n + j * 0.4
            tops.append((reach * math.cos(a), reach * math.sin(a), z_bob + 0.03 + CANDLE_H))
    return tops


def build():
    parts = []
    parts.append(L.cyl("rod", ROD_R, ROD_L, (0, 0, -ROD_L / 2), K, n=12))
    # the canopy: a small flared cup under the rod
    parts.append(L.lathe("canopy", [(0.03, 0), (0.12, 0.012), (0.13, 0.035), (0.09, 0.048), (0.03, 0.05)],
                         (0, 0, CAN_Z - 0.05), K, n=16))
    # the turned column: bulbs at each arm hub and at the foot
    prof_top_down = [(0.03, 0), (0.045, -0.05), (0.03, -0.10), (0.055, -0.19), (0.05, -0.24),
                     (0.03, -0.30), (0.028, -0.40), (0.06, -0.50), (0.052, -0.55), (0.03, -0.58),
                     (0.045, -0.60), (0.02, -0.615), (0.0, -0.62)]
    col = [(r, COL_TOP + z) for (r, z) in reversed(prof_top_down)]
    parts.append(L.lathe("column", [(r, z - COL_TOP) for (r, z) in col], (0, 0, COL_TOP), K, n=16))
    # the tiers
    for j, (n, reach, z_hub, z_bob) in enumerate(TIERS):
        parts.append(L.torus(f"hub{j}", 0.045, 0.012, (0, 0, z_hub), K, maj=12, mnr=6))
        for i in range(n):
            a = 2 * math.pi * i / n + j * 0.4
            pts = _arm_pts(a, reach, z_hub, z_bob)
            for s in range(ARM_SEG):
                parts.append(L.strut(f"arm{j}_{i}_{s}", pts[s], pts[s + 1], ARM_R, K, n=8))
            x, y = reach * math.cos(a), reach * math.sin(a)
            parts.append(L.lathe(f"bob{j}_{i}", [(0.0, 0), (0.045, 0.008), (0.055, 0.02), (0.035, 0.027), (0.024, 0.03)],
                                 (x, y, z_bob - 0.03), K, n=12))
            parts.append(L.cyl(f"cup{j}_{i}", 0.021, 0.03, (x, y, z_bob + 0.015), K, n=10))
            parts.append(L.cyl(f"candle{j}_{i}", CANDLE_R, CANDLE_H, (x, y, z_bob + 0.03 + CANDLE_H / 2), K, n=10))
            # a pendant drop under every bobèche
            parts.append(L.cyl(f"pend{j}_{i}", 0.012, 0.045, (x, y, z_bob - 0.065), K, n=4, r2=0.0))
    # the swag of 16 crystals under the wide tier
    for i in range(SWAG_N):
        a = 2 * math.pi * i / SWAG_N + 0.2
        z = -1.31 - (i % 3) * 0.03
        parts.append(L.cyl(f"swag{i}", 0.013, 0.05, (SWAG_R * math.cos(a), SWAG_R * math.sin(a), z), K, n=4, r2=0.0))
    root = L.join(parts, NAME, origin=None)          # authored on the hook: z 0 = the rod's top
    L.shade_smooth(root, angle=40)
    return root


def build_flames():
    parts = []
    for i, (x, y, z) in enumerate(_candle_tops()):
        f = L.sphere(f"flame{i}", 0.012, (x, y, z + 0.022), "flame_emit", sub=1)
        f.scale = (1.0, 1.0, 1.9)
        parts.append(f)
    root = L.join(parts, NAME + "_flames", origin=None)
    L.shade_smooth(root, angle=80)
    return root
