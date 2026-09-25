"""arrival_soffit — the entry canopy's slatted ceiling (KAN-211 wave A2).

Split out of `arrival_entry` because a GLB carries ONE roughness: the piers'
glossy black courses want ~.4 and a timber ceiling wants ~.85. At .42 the dark
slats caught the grey sky in the environment map and read as harsh grey-white
horizontal stripes in `archA-stair-canopy` / `archA-canopy-night`.

The canopy underside of f_005–f_013: a DARK timber slat ceiling, slats parallel
to the facade, soft in tone, a channel left for the downlights. Here: 56 mm
slats at 0.13 m on a walnut backing (both on panel_walnut.webp, the backing
darkened further by its own AO), from canopy.soffitY (5.55 — site.js's `ceil`
for the stair, it does not move) up 35 mm; the channel at canopy centre + .55
± .20 is where the game's six `arrDownI` emissive boxes hang (y soffitY − .005).
Same SITE frame as every KAN-211 GLB (generators/_arch.py).
"""
import wv_lib as L
import _arch as A

NAME = "arrival_soffit"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.25
AO_STRENGTH = 0.45
TRIS = 1500
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"


def build():
    AR = A.site()["AR"]
    C = AR["canopy"]
    bay0, bay1 = AR["bay"]["z0"], AR["bay"]["z1"]
    # wave A2 look pass: a SOLID warm bronze-brown timber key with the wood
    # family's faint grain, not panel_walnut.webp — the photo's board joints on
    # 56 mm slats read as a brick pattern at the stair
    L.PALETTE["ar_soffit"] = L._hex("3a2b21")
    L.ROUGH["ar_soffit"] = 0.85
    import wv_bake as B
    B.FAMILY["ar_soffit"] = "wood"
    L.PALETTE["ar_soffit_b"] = L._hex("1c1612")
    B.FAMILY["ar_soffit_b"] = "paint"
    wal = "ar_soffit"
    parts = []
    for k, (za, zb) in enumerate(A.spans(bay0, bay1, 4.6)):
        parts.append(A.box(f"back{k}", C["x0"], C["x1"], C["soffitY"] + 0.035,
                           C["soffitY"] + 0.06, za, zb, "ar_soffit_b"))
    canC = (C["x0"] + C["x1"]) / 2
    chan0, chan1 = canC + 0.55 - 0.20, canC + 0.55 + 0.20
    x = C["x0"] + 0.08
    i = 0
    while x < C["x1"] - 0.05:
        if not (chan0 < x < chan1):
            for k, (za, zb) in enumerate(A.spans(bay0 + 0.04, bay1 - 0.04, 4.6)):
                parts.append(A.box(f"slat{i}_{k}", x - 0.028, x + 0.028, C["soffitY"],
                                   C["soffitY"] + 0.035, za, zb, wal))
        x += 0.13
        i += 1
    return L.join(parts, NAME, origin=None)
