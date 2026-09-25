"""lobby_desk — the CHECK-IN DESK and the white cabinet wall behind it
(KAN-211 wave A; reference/photos/compare-checkin-lobby-2026-08-04.jpg, the
lobby frames of clubhouse-entrance-parking.mp4).

The photograph: a counter with a solid dark timber top slab over a front of
close VERTICAL pale bamboo slats, a recessed dark plinth; behind it a wall of
four tall white flush cabinet panels with fine reveals and a dark plinth,
beside the dark timber panelling; a slim black monitor on the counter.

Replaces campus.js buildArrival §H's `arrCabI` panels, `arrCabPlinthI`, the
`arrDeskI` top / front / back / ends, the 35 `arrSlatI` slats and the two
`arrDeskDarkI` monitor boxes. The GAME keeps the lamp + its emissive shade, the
flower bowl and its seeded flowers (their rnd() draws must not move), the
plants, the staff, the colliders and the "Check in" interactable.

    DX = LOBBY.x0 + 5.4 = 38.4, DZ = LOBBY.z0 + 1.7 = −20.3, DLEN 3.8
    counter    x DX ± 1.9, top y lobbyY + 1.06, depth DZ ± .39; slats on the
               GUEST side (+z, DZ + .40) — rectCollider 4.1 × .95 UNTOUCHED
    cabinet    CABZ = LOBBY.z0 + .42, 4 panels over DLEN + .8, lobbyY … + 3.05
    monitor    DX + 1.2, facing the staff (−z)
Same SITE frame as every KAN-211 GLB (generators/_arch.py).
"""
import math
import wv_lib as L
import _arch as A

NAME = "lobby_desk"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.35
AO_STRENGTH = 0.55
TRIS = 4000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"ar_white": 1.0, "ar_teak": 1.0, "ar_bamboo": 0.6, "ar_screen": 0.5, "ar_dark": 0.5}


def build():
    S = A.site()
    AR, LY = S["AR"], S["LY"]
    LB = AR["LOBBY"]
    DX, DZ, DLEN = LB["x0"] + 5.4, LB["z0"] + 1.7, 3.8
    parts = []
    x0, x1 = DX - DLEN / 2, DX + DLEN / 2
    # the counter: a dark carcass, a recessed kick, a 60 mm top slab that
    # overhangs the slat face, and a raised transaction ledge on the guest side
    parts.append(A.box("carcass", x0, x1, LY + 0.10, LY + 1.03, DZ - 0.38, DZ + 0.36, "ar_teak"))
    parts.append(A.box("kick", x0 + 0.05, x1 - 0.05, LY, LY + 0.10, DZ - 0.33, DZ + 0.30, "ar_dark"))
    top = A.box("top", x0 - 0.03, x1 + 0.03, LY + 1.03, LY + 1.09, DZ - 0.41, DZ + 0.46, "ar_teak")
    L.bevel([top], width=0.006, segments=2)
    parts.append(top)
    # vertical half-round bamboo slats across the guest face
    n = round(DLEN / 0.105)
    for k in range(n):
        x = x0 + 0.06 + k * (DLEN - 0.12) / (n - 1)
        c = A.B_(x, LY + 0.575, DZ + 0.385)
        parts.append(L.cyl(f"slat{k}", 0.022, 0.93, c, "ar_bamboo", n=8))
    for s, x in (("l", x0), ("r", x1)):     # end returns of the slat face
        parts.append(A.box(f"end_{s}", x - 0.02, x + 0.02, LY + 0.10, LY + 1.03, DZ - 0.38, DZ + 0.41, "ar_teak"))
    # the monitor (facing the staff side, −z): a slim screen on a foot
    mx, mz = DX + 1.2, DZ - 0.10
    parts.append(A.box("screen", mx - 0.30, mx + 0.30, LY + 1.18, LY + 1.55, mz - 0.015, mz + 0.015, "ar_screen"))
    parts.append(A.box("neck", mx - 0.025, mx + 0.025, LY + 1.09, LY + 1.22, mz + 0.01, mz + 0.05, "ar_dark"))
    parts.append(A.box("foot", mx - 0.11, mx + 0.11, LY + 1.09, LY + 1.105, mz - 0.03, mz + 0.12, "ar_dark"))

    # the white cabinet wall: four tall flush panels with 8 mm reveals, a
    # recessed pull line, a dark plinth and a shadow gap at the top
    cabz = LB["z0"] + 0.42
    w = (DLEN + 0.8) / 4
    for k in range(4):
        pc = DX - DLEN / 2 + 0.05 + (k + 0.5) * w
        parts.append(A.box(f"cab{k}", pc - w / 2 + 0.004, pc + w / 2 - 0.004, LY + 0.10, LY + 3.02,
                           cabz - 0.06, cabz + 0.06, "ar_white"))
        # a slim vertical pull groove near the meeting edge
        gx = pc + (w / 2 - 0.09) * (1 if k % 2 == 0 else -1)
        parts.append(A.box(f"pull{k}", gx - 0.008, gx + 0.008, LY + 0.95, LY + 1.55, cabz + 0.06, cabz + 0.064, "ar_dark"))
    xa, xb = DX - DLEN / 2 + 0.05, DX - DLEN / 2 + 0.05 + 4 * w
    parts.append(A.box("cab_plinth", xa, xb, LY, LY + 0.10, cabz - 0.06, cabz + 0.03, "ar_dark"))
    return L.join(parts, NAME, origin=None)
