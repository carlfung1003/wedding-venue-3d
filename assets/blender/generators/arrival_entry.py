"""arrival_entry — the recessed ENTRY BAY of the arrival pavilion (KAN-211 wave A):
the deep flat canopy with its slatted soffit, the two banded curtain-wall piers,
the door frame + the parked leaves' frames, the sconces' backplates, and the
banded stone wall inside the plaque wing's corten frame.

Replaces campus.js buildArrival §C's `arrCortenI` canopy slab + `arr-soffit`
plane, the two `arrBandI` piers, the door's `darkI` frame / head / jambs / leaf
rails, the sconce backplates (`darkI`) and the plaque wall's `arrBandI` panel.
Every number from js/site.js (the shared KAN-211 frame, generators/_arch.py):

    canopy    x canopy.x0 … x1 (42.8 … 47.1), y topY − .32 … topY (5.58 … 5.90),
              z bay (−12.5 … −3.5); its SOFFIT plane is canopy.soffitY 5.55 —
              site.js registers that as the stair's `ceil`, so it does not move
    piers     x doorX − .1 … 44.2, y lobbyY … topY, z bay.z0 … doorGap.z0 and
              doorGap.z1 … bay.z1 — rectCollider (1.3 × w, r .35) UNTOUCHED
    door      the plane x = doorX, the gap doorGap (3.1 m) stays OPEN
    downlights  the game's six `arrDownI` emissive boxes at x canopy centre + .55,
              y soffitY − .005 — the slats leave a channel for them

From the video (f_005–f_018): the canopy's underside is a DARK slatted ceiling
(slats parallel to the facade) with a light channel; the piers are stacked
horizontal bands — deep glossy BLACK courses with thin TAUPE stone ledges that
step out ~30 mm (f_013 shows the ledges catching the light), one pair of fluted
brass sconces high on them; the door frames are warm BRONZE; the plaque wall
(f_001/f_002) is the same banding, recessed inside the corten.

⚠ THE CANOPY SOFFIT IS ONLY 1.95 m OVER THE LOBBY FLOOR (5.55 − 3.60) where it
runs 0.3 m inside the door plane — a site.js fact, not this asset's. So the door
head sits UNDER it (lobbyY + 1.90): the old 2.3 m frame and 2.2 m leaves ran
straight through the soffit.
"""
import wv_lib as L
import _arch as A

NAME = "arrival_entry"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.6
TRIS = 9000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"   # hundreds of thin seam/slat islands — see wv_bake.prepare_for_export
UV_WEIGHT = {"corten_top": 0.08, "corten_in": 0.05, "ar_black": 1.0, "ar_taupe": 1.0,
             "ar_dark": 0.22, "ar_bronze": 0.8}

BAND_DARK, BAND_PALE = 0.44, 0.12      # f_013: wide glossy black course, thin taupe ledge


def banded(parts, name, x0, x1, y0, y1, z0, z1, face_out=(True, True, True, True)):
    """a banded pier/wall: black courses with taupe ledges stepping out 30 mm on
    every exposed side. face_out = (−x, +x, −z, +z) sides that get the step."""
    y = y0
    k = 0
    # a black plinth course first, then (pale, dark) repeats
    while y < y1 - 1e-3:
        h = min(BAND_DARK if k % 2 == 0 else BAND_PALE, y1 - y)
        if k % 2 == 0:
            parts.append(A.box(f"{name}_d{k}", x0, x1, y, y + h, z0, z1, "ar_black"))
        else:
            o = 0.03
            parts.append(A.box(f"{name}_p{k}",
                               x0 - (o if face_out[0] else 0), x1 + (o if face_out[1] else 0),
                               y, y + h,
                               z0 - (o if face_out[2] else 0), z1 + (o if face_out[3] else 0), "ar_taupe"))
        y += h
        k += 1


def build():
    S = A.site()
    AR, LY = S["AR"], S["LY"]
    TY = AR["terraceY"]
    C = AR["canopy"]
    bay0, bay1 = AR["bay"]["z0"], AR["bay"]["z1"]
    g0, g1 = AR["doorGap"]["z0"], AR["doorGap"]["z1"]
    DX, FX = AR["doorX"], AR["faceX"]
    cort, core = A.corten("corten_top"), A.corten("corten_in")
    parts = []

    # ── THE CANOPY: corten top, a dark bronze fascia, a slatted dark soffit
    parts.append(A.box("can_core", C["x0"], C["x1"], C["topY"] - 0.30, C["topY"], bay0, bay1, core))
    parts.append(A.world_uv(A.box("can_top", C["x0"], C["x1"], C["topY"], C["topY"] + 0.012, bay0, bay1, cort)))
    for nm, (xa, xb, za, zb) in {
        "can_fx": (C["x1"], C["x1"] + 0.04, bay0 - 0.04, bay1 + 0.04),
        "can_fn": (FX, C["x1"] + 0.04, bay0 - 0.04, bay0),
        "can_fs": (FX, C["x1"] + 0.04, bay1, bay1 + 0.04),
    }.items():
        parts.append(A.box(nm, xa, xb, C["soffitY"] - 0.04, C["topY"] + 0.03, za, zb, "ar_bronze"))
    # the soffit backing (just above the plane) and the slats hanging to it
    parts.append(A.box("sof_back", C["x0"], C["x1"], C["soffitY"] + 0.035, C["topY"] - 0.30,
                       bay0, bay1, "ar_black"))
    canC = (C["x0"] + C["x1"]) / 2
    chan0, chan1 = canC + 0.55 - 0.20, canC + 0.55 + 0.20       # the downlight channel
    x = C["x0"] + 0.08
    i = 0
    while x < C["x1"] - 0.05:
        if not (chan0 < x < chan1):
            parts.append(A.box(f"slat{i}", x - 0.028, x + 0.028, C["soffitY"], C["soffitY"] + 0.035,
                               bay0 + 0.04, bay1 - 0.04, "ar_dark"))
        x += 0.13
        i += 1

    # ── THE BANDED PIERS
    px0, px1 = DX - 0.1, 44.2
    for nm, (za, zb) in {"pier_n": (bay0, g0), "pier_s": (g1, bay1)}.items():
        banded(parts, nm, px0, px1, LY, C["soffitY"], za, zb,
               face_out=(False, True, nm == "pier_s", nm == "pier_n"))

    # ── THE DOOR FRAME (bronze) under the soffit, the gap left OPEN
    gw = g1 - g0
    head = LY + 1.90
    parts.append(A.box("door_head", DX - 0.07, DX + 0.07, head, C["soffitY"], g0, g1, "ar_bronze"))
    for s, z in (("n", g0), ("s", g1)):
        parts.append(A.box(f"jamb_{s}", DX - 0.07, DX + 0.07, LY, head, z - (0.10 if s == "n" else 0),
                           z + (0.10 if s == "s" else 0), "ar_bronze"))
    parts.append(A.box("sill", DX - 0.09, DX + 0.09, LY, LY + 0.012, g0, g1, "ar_bronze"))
    # the two leaves slid open behind the piers: bronze stiles + rails round the
    # game's glass (campus.js keeps the pane: an instance on MAT.glass)
    for s in (-1, 1):
        lz = (g0 + g1) / 2 + s * (gw / 2 + 0.5)
        lx = DX - 0.25
        for nm, (y0, y1, za, zb) in {
            "t": (LY + 1.80, LY + 1.86, lz - 0.49, lz + 0.49),
            "b": (LY + 0.01, LY + 0.08, lz - 0.49, lz + 0.49),
            "l": (LY + 0.01, LY + 1.86, lz - 0.49, lz - 0.44),
            "r": (LY + 0.01, LY + 1.86, lz + 0.44, lz + 0.49),
        }.items():
            parts.append(A.box(f"leaf{s}{nm}", lx - 0.035, lx + 0.035, y0, y1, za, zb, "ar_bronze"))

    # ── the sconces' backplates, high on the pier fronts (the brass cylinder is
    # `arrival_sconce`, geometry only on the game's emissive MAT.brassFlute)
    for s in (-1, 1):
        sz = (g0 + g1) / 2 + s * (gw / 2 + 0.35)
        parts.append(A.box(f"sc_plate{s}", px1 + 0.03, px1 + 0.06, 4.38, 5.32, sz - 0.08, sz + 0.08, "ar_bronze"))
        parts.append(A.box(f"sc_arm{s}", px1 + 0.06, px1 + 0.13, 4.83, 4.88, sz - 0.025, sz + 0.025, "ar_bronze"))

    # ── THE PLAQUE WALL inside the corten frame of wings[0] (arrival_shell
    # leaves the hole: z −19.9 … bay.z0 − .40, y terraceY + .25 … + 3.55)
    RZ0, RZ1 = -19.9, bay0 - 0.40
    RY0, RY1 = TY + 0.25, TY + 3.55
    back = FX - 0.30
    banded(parts, "plq", back - 0.06, back, RY0, RY1, RZ0, RZ1, face_out=(False, True, False, False))
    return L.join(parts, NAME, origin=None)
