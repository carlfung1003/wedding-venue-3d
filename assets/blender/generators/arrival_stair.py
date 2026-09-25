"""arrival_stair — the filmed 6-riser polished-stone stair, its landing and the
two side cheeks (KAN-211 wave A). Its own GLB because it is the one GLOSSY
surface of the entry (f_011/f_013: a honed grey-charcoal stone that mirrors
the doors) and a GLB carries one roughness.

Replaces campus.js buildArrival §B's `arrBlackI` boxes, number for number:

    riser i (0 = the lowest, outermost)  x stair.x1 − (i+1)·tread … stair.x1 − i·tread
                                         y terraceY … terraceY + (i+1)·rise/risers
                                         z bay.z0 … bay.z1  (9 m)
    landing   x doorX … stair.x0,  y lobbyY − .18 … lobbyY
    cheeks    x doorX … 46.7,      y terraceY … terraceY + rise + .06,
              z bay.z0 − .9 … bay.z0 and bay.z1 … bay.z1 + .9

⚠ THE TREAD TOPS ARE THE PUBLISHED HEIGHTS. The walker never touches this mesh
(site.js registers the flight as ONE ramp, `arrival-stair`, terraceY → lobbyY
over stair.x1 → stair.x0), but a tread drawn a centimetre off its height reads
as the feet sinking into stone. Every top is terraceY + (i+1)·rh exactly.

What the video adds: a 20 mm bullnosed nosing overhang on every tread; a
lighter honed anti-slip strip 40 mm behind each nosing (f_013's pale lines);
the risers a touch darker than the treads (shadow side); the landing laid in
~0.6 m slabs with fine joints (f_013's reflections break on them); the cheeks
capped with a 30 mm overhanging coping.
"""
import wv_lib as L
import _arch as A

NAME = "arrival_stair"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.55
TRIS = 2500
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"   # hundreds of thin seam/slat islands — see wv_bake.prepare_for_export
UV_WEIGHT = {"ar_stone": 1.0, "ar_stone_l": 0.6, "ar_joint": 0.3}


def build():
    S = A.site()
    AR, LY = S["AR"], S["LY"]
    TY, rise, n = AR["terraceY"], AR["rise"], AR["risers"]
    rh, tr = rise / n, AR["tread"]
    x1s, x0s = AR["stair"]["x1"], AR["stair"]["x0"]
    z0, z1 = AR["bay"]["z0"], AR["bay"]["z1"]
    parts = []
    NOSE = 0.02
    for i in range(n):
        xa = x1s - (i + 1) * tr
        xb = x1s - i * tr
        top = TY + (i + 1) * rh
        # the block (riser face at xb), the nosing overhangs it by NOSE
        for k, (za, zb) in enumerate(A.spans(z0, z1, 4.6)):
            parts.append(A.box(f"step{i}_{k}", xa, xb, TY, top - 0.03, za, zb, "ar_stone"))
            tread = A.box(f"tread{i}_{k}", xa, xb + NOSE, top - 0.03, top, za, zb, "ar_stone")
            L.bevel([tread], width=0.012, segments=2)
            parts.append(tread)
        # the pale anti-slip strip, 40 mm behind the nosing, 1 mm proud
        parts.append(A.box(f"strip{i}", xb - 0.09, xb - 0.05, top, top + 0.001, z0 + 0.15, z1 - 0.15, "ar_stone_l"))
    # the landing, slabs with fine joints
    lx0, lx1 = AR["doorX"], x0s
    for k, (za, zb) in enumerate(A.spans(z0, z1, 4.6)):
        parts.append(A.box(f"landing{k}", lx0, lx1, LY - 0.18, LY, za, zb, "ar_stone"))
    nj = max(1, round((z1 - z0) / 0.6))
    for j in range(1, nj):
        z = z0 + (z1 - z0) * j / nj
        parts.append(A.box(f"lj{j}", lx0, lx1, LY, LY + 0.0008, z - 0.004, z + 0.004, "ar_joint"))
    parts.append(A.box("lj_x", (lx0 + lx1) / 2 - 0.004, (lx0 + lx1) / 2 + 0.004, LY, LY + 0.0008, z0, z1, "ar_joint"))
    # the side cheeks, at landing height, with a coping
    for s, (za, zb) in (("n", (z0 - 0.9, z0)), ("s", (z1, z1 + 0.9))):
        yt = TY + rise + 0.06
        parts.append(A.box(f"cheek_{s}", lx0, 46.7, TY, yt - 0.05, za, zb, "ar_stone"))
        cop = A.box(f"coping_{s}", lx0, 46.7 + 0.03, yt - 0.05, yt, za - 0.03 if s == "n" else za,
                    zb if s == "n" else zb + 0.03, "ar_stone_l")
        L.bevel([cop], width=0.01, segments=2)
        parts.append(cop)
    return L.join(parts, NAME, origin=None)
