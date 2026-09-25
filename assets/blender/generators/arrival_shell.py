"""arrival_shell — the corten WALLS of the arrival pavilion (KAN-211 wave A).

Replaces campus.js buildArrival §C's `arrCortenI` wall boxes (the two wings of
the arrival face, the two end walls, the lounge's buried east wall) and closes
the two gaps those boxes left under the mono-pitch roof. Authored in the SHARED
SITE FRAME (generators/_arch.py): every number is read from js/site.js.

Source (campus.js §C, all enclave-local):
    wings      x faceX−.36 … faceX (44.24 … 44.60), y 0 … wingH 7.40, z = AR.wings
    end walls  x backX … faceX (33.0 … 44.6), z bldg.z0 … +.36 and bldg.z1 −.36 … z1
    east wall  x 44.24 … 44.60, y 0 … CY 3.28, z bldg.z0 … z1 (the lounge's back)
    colliders  colliderLine at x faceX − .18 (r .4) and at each end wall — UNTOUCHED

What the photographs add (entrance-arrival-brief.md; f_001–f_005;
clubhouse-lounge-checkin-balcony.jpg):
  · the corten is a STANDING-SEAM skin: wide vertical panels (~0.6 m) with raised
    seams, a grey-brown patina with rust bloom — real seams here, the patina is
    corten_weathered.webp on a world-scale UV (the seams stay put, the texture
    tiles at 1.6 m);
  · the skin runs UP INTO THE ROOF. The old boxes stopped at wingH 7.40 while the
    roof's underside climbs 6.98 → 9.03 along z, so the arrival face and the
    south end wall showed a slot of lobby ceiling under the roof, and the
    courtyard face had none at all above the lobby's glass (7.0). Every wall
    here stops at the roof's own underside, computed from the same three
    numbers campus.js builds the roof from (eaveH, ridgeH, wings);
  · the plaque wing (wings[0]) is a corten FRAME around a recessed banded
    stone wall (f_001, f_002) — this asset leaves the hole; `arrival_entry`
    fills it (the bands want that atlas's texel density).
  · inside, the walls are dark timber panelling (the lobby frames of the same
    video, f_014–f_020), not rusted steel: a thin lining on every interior face.

Deliberately NOT here: the roof (arrival_roof), the entry bay's piers / canopy /
doors / plaque wall (arrival_entry), the stair (arrival_stair).
"""
import math
import wv_lib as L
import _arch as A

NAME = "arrival_shell"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.6
AO_STRENGTH = 0.55
TRIS = 6000
FRONT = "-Z"
ORIGIN = "site"          # the shared KAN-211 frame — see generators/_arch.py
PACK_SHAPE = "CONCAVE"   # hundreds of thin seam/slat islands — see wv_bake.prepare_for_export
# atlas texels by what a guest sees: skins 1, seams' sides less, the linings less,
# the slab cores (hidden inside the skins) almost nothing
UV_WEIGHT = {"corten": 1.0, "corten_seam": 0.35, "panelling": 0.32, "corten_in": 0.03}

SEAM_PITCH = 0.60        # standing-seam panel width (f_001/f_005: ~0.55–0.65 m)
SKIN = 0.012             # the patina skin, proud of the slab core


def roof_under(z):
    """The roof slab's UNDERSIDE at z — campus.js §C's roof: a .34 slab centred on
    the line eaveH at wings[0].z0 → ridgeH at wings[1].z1."""
    AR = A.site()["AR"]
    z0, z1 = AR["wings"][0]["z0"], AR["wings"][1]["z1"]
    yc = AR["eaveH"] + (z - z0) * (AR["ridgeH"] - AR["eaveH"]) / (z1 - z0)
    return yc - 0.17


def build():
    S = A.site()
    AR, LY, CY = S["AR"], S["LY"], S["CY"]
    FX, BX = AR["faceX"], AR["backX"]
    Z0, Z1 = AR["bldg"]["z0"], AR["bldg"]["z1"]
    T = 0.36
    TY = AR["terraceY"]
    bay0, bay1 = AR["bay"]["z0"], AR["bay"]["z1"]
    canTop = AR["canopy"]["topY"]
    ceilLobby = LY + AR["lobbyH"]
    cort, seam = A.corten("corten"), A.corten_dark("corten_seam")
    core = A.corten("corten_in")
    lin = A.panelling("panelling")
    parts = []

    # the plaque wing's recess (arrival_entry builds the banded wall inside it)
    RZ0, RZ1 = -19.9, bay0 - 0.40          # z; leaves a 0.40 m corten mullion at the bay
    RY0, RY1 = TY + 0.25, TY + 3.55

    rnd = L.rng(NAME)

    def shift():
        return rnd.random(), rnd.random() * 0.5

    def wall_x(name, z0, z1, y0, y1, top=None, seams=()):
        """a slab on the arrival face (x FX−T … FX), sloped top optional; its
        skin is cut into standing-seam PANELS, each with its own patina shift"""
        if top:
            c = [(FX - T, y0, z0), (FX, y0, z0), (FX, y0, z1), (FX - T, y0, z1),
                 (FX - T, top(z0), z0), (FX, top(z0), z0), (FX, top(z1), z1), (FX - T, top(z1), z1)]
            parts.append(A.hexa(name, c, core))
        else:
            parts.append(A.box(name, FX - T, FX, y0, y1, z0, z1, core))
        for k, (za, zb) in enumerate(A.panels(z0, z1, seams)):
            du, dv = shift()
            if top:
                sk = [(FX, y0, za), (FX + SKIN, y0, za), (FX + SKIN, y0, zb), (FX, y0, zb),
                      (FX, top(za), za), (FX + SKIN, top(za), za), (FX + SKIN, top(zb), zb), (FX, top(zb), zb)]
                parts.append(A.world_uv(A.hexa(f"{name}_skin{k}", sk, cort), du=du, dv=dv))
            else:
                parts.append(A.world_uv(A.box(f"{name}_skin{k}", FX, FX + SKIN, y0, y1, za, zb, cort),
                                        du=du, dv=dv))

    # ── wing[1] (screen-left from the court): full height, grade → the roof
    w1 = AR["wings"][1]
    s1 = A.seam_positions(w1["z0"], w1["z1"], SEAM_PITCH)
    wall_x("wing1", w1["z0"], w1["z1"], 0.0, None, top=roof_under, seams=s1)
    # ── wing[0], around the recess: below, above, and the two jambs
    w0 = AR["wings"][0]
    s0 = A.seam_positions(w0["z0"], w0["z1"], SEAM_PITCH)
    wall_x("wing0_n", w0["z0"], RZ0, 0.0, None, top=roof_under, seams=s0)
    wall_x("wing0_s", RZ1, w0["z1"], 0.0, None, top=roof_under, seams=s0)
    wall_x("wing0_lo", RZ0, RZ1, 0.0, RY0, seams=s0)
    wall_x("wing0_hi", RZ0, RZ1, RY1, None, top=roof_under, seams=s0)
    # the recess reveals: corten returns, so the frame reads as folded plate
    for nm, (a, b, c0, c1, d0, d1) in {
        "rev_n": (RZ0, RZ0 + SKIN, RY0, RY1, FX - T, FX + SKIN),
        "rev_s": (RZ1 - SKIN, RZ1, RY0, RY1, FX - T, FX + SKIN),
        "rev_b": (RZ0, RZ1, RY0, RY0 + SKIN, FX - T, FX + SKIN),
        "rev_t": (RZ0, RZ1, RY1 - SKIN, RY1, FX - T, FX + SKIN),
    }.items():
        parts.append(A.world_uv(A.box(nm, d0, d1, c0, c1, a, b, cort)))
    # ── over the entry bay: from the canopy's top to the roof — f_005's big band
    wall_x("bay_band", bay0, bay1, canTop - 0.02, None, top=roof_under,
           seams=A.seam_positions(bay0, bay1, SEAM_PITCH))
    # ── under the bay: the lounge's back wall, grade → its ceiling
    parts.append(A.box("east_lounge", FX - T, FX, 0.0, CY, bay0, bay1, core))

    # standing seams on the arrival face
    def seams_face(z0, z1, y0, top, skip=None, prefix="s"):
        n = max(1, round((z1 - z0) / SEAM_PITCH))
        for i in range(1, n):
            z = z0 + (z1 - z0) * i / n
            spans = [(y0, top(z))]
            if skip and skip[0] < z < skip[1]:
                spans = [(y0, skip[2]), (skip[3], top(z))]
            for k, (ya, yb) in enumerate(spans):
                if yb - ya < 0.05:
                    continue
                parts.append(A.world_uv(A.box(f"{prefix}{i}_{k}", FX + SKIN, FX + SKIN + 0.045,
                                              ya, yb, z - 0.024, z + 0.024, seam)))
    seams_face(w1["z0"], w1["z1"], 0.0, roof_under, prefix="sw1_")
    seams_face(w0["z0"], w0["z1"], 0.0, roof_under, skip=(RZ0 - .03, RZ1 + .03, RY0, RY1), prefix="sw0_")
    seams_face(bay0, bay1, canTop - 0.02, roof_under, prefix="sbay_")

    # ── the two END walls, grade → the roof's underside at their own z
    for nm, (za, zb, out) in {"end_n": (Z0, Z0 + T, -1), "end_s": (Z1 - T, Z1, 1)}.items():
        zc = za if out < 0 else zb
        top = roof_under(zc)
        parts.append(A.box(nm, BX, FX, 0.0, top, za, zb, core))
        sk0, sk1 = (za - SKIN, za) if out < 0 else (zb, zb + SKIN)
        for k, (xa, xb) in enumerate(A.panels(BX, FX + SKIN, A.seam_positions(BX, FX, SEAM_PITCH))):
            du, dv = shift()
            parts.append(A.world_uv(A.box(f"{nm}_skin{k}", xa, xb, 0.0, top, sk0, sk1, cort), du=du, dv=dv))
        n = max(1, round((FX - BX) / SEAM_PITCH))
        face = sk0 if out < 0 else sk1
        for i in range(1, n):
            x = BX + (FX - BX) * i / n
            f0, f1 = (face - 0.045, face) if out < 0 else (face, face + 0.045)
            parts.append(A.world_uv(A.box(f"{nm}_s{i}", x - 0.024, x + 0.024, 0.0, top, f0, f1, seam)))
        # the courtyard-side edge of the end wall: a corten return (the wall's end grain)
        parts.append(A.world_uv(A.box(nm + "_ret", BX - SKIN, BX, 0.0, top, za, zb, cort)))
        # interior lining (lounge + lobby), 12 mm inside the slab
        li0, li1 = (zb, zb + 0.012) if out < 0 else (za - 0.012, za)
        for k, (xa, xb) in enumerate(A.spans(BX, FX - T)):
            parts.append(A.box(f"{nm}_lin_lo{k}", xa, xb, 0.0, CY, li0, li1, lin))
            parts.append(A.box(f"{nm}_lin_hi{k}", xa, xb, LY, ceilLobby, li0, li1, lin))

    # ── the COURTYARD band: above the lobby's glass wall (its ceiling, 7.0) up to
    # the roof's soffit (underside − .09, the cedar lining arrival_roof hangs there)
    def band_top(z):
        return roof_under(z) - 0.09
    c = [(BX, ceilLobby - 0.08, Z0), (BX + 0.25, ceilLobby - 0.08, Z0),
         (BX + 0.25, ceilLobby - 0.08, Z1), (BX, ceilLobby - 0.08, Z1),
         (BX, band_top(Z0), Z0), (BX + 0.25, band_top(Z0), Z0),
         (BX + 0.25, band_top(Z1), Z1), (BX, band_top(Z1), Z1)]
    parts.append(A.hexa("court_band", c, core))
    for k, (za, zb) in enumerate(A.panels(Z0, Z1, A.seam_positions(Z0, Z1, SEAM_PITCH))):
        du, dv = shift()
        sk = [(BX - SKIN, ceilLobby - 0.08, za), (BX, ceilLobby - 0.08, za),
              (BX, ceilLobby - 0.08, zb), (BX - SKIN, ceilLobby - 0.08, zb),
              (BX - SKIN, band_top(za), za), (BX, band_top(za), za),
              (BX, band_top(zb), zb), (BX - SKIN, band_top(zb), zb)]
        parts.append(A.world_uv(A.hexa(f"court_band_skin{k}", sk, cort), du=du, dv=dv))
    n = max(1, round((Z1 - Z0) / SEAM_PITCH))
    for i in range(1, n):
        z = Z0 + (Z1 - Z0) * i / n
        parts.append(A.world_uv(A.box(f"cb_s{i}", BX - SKIN - 0.045, BX - SKIN,
                                      ceilLobby - 0.08, band_top(z), z - 0.024, z + 0.024, seam)))

    # ── interior lining of the arrival wall (the lobby over the wings, the lounge
    # everywhere) — dark timber, not the weathering skin
    for nm, (za, zb) in {"lin_w0": (Z0 + T, bay0), "lin_w1": (bay1, Z1 - T)}.items():
        parts.append(A.box(nm + "_hi", FX - T - 0.012, FX - T, LY, ceilLobby, za, zb, lin))
    for k, (za, zb) in enumerate(A.spans(Z0 + T, Z1 - T)):
        parts.append(A.box(f"lin_lounge{k}", FX - T - 0.012, FX - T, 0.0, CY, za, zb, lin))

    root = L.join(parts, NAME, origin=None)
    return root
