"""lounge_facade — the pavilion's COURTYARD face, both storeys (KAN-211 wave A):
the 酒廊's folding-glass frames, the dark louvre band over them, the tiled
charcoal pier that carries the lounge plaque, the cantilevered balcony's slab
edge / stone fascia beam / cedar soffit / stone capping, and the check-in
lobby's glass-wall frames and louvred transom above it.

reference/photos/clubhouse-lounge-checkin-balcony.jpg is the elevation (it
imports rotated 90°): ground floor — slim dark-grey folding-door frames with
deep top and bottom rails, a dark louvre band, a pier of LARGE square charcoal
tiles (~0.75 m, fine joints) with the plaque; the balcony — a thick pale-grey
stone fascia beam over a warm reddish cedar soffit, frameless glass with a
stone capping; upper floor — the same dark frames.

Replaces campus.js buildArrival §D/§F/§G's `darkI` mullions + heads + folded-
leaf heads, `arrLouvreI` (both storeys), `arrPierI`, the balcony slab box, the
two `arrCapI` runs (fascia beam + capping), `arrSoffitI` (balcony soffit + the
upper facade's timber panel). The GAME keeps every glass pane (MAT.glass /
MAT.clear instances), the sheer curtains, the lounge plaque plane, the deck,
the two round columns and every collider. Numbers from js/site.js:

    lounge glass   x backX (33.0), y .05 … 2.95, spans [bldg.z0 + .4, loungeGap.z0]
                   and [loungeGap.z1, bldg.z1 − .4] — the gap stays OPEN
    pier           x backX − .20 … + .10, y 0 … 3.24, z (bldg.z1 − 3.6) ± 2.3
    balcony        BALC x 30.6 … 33.0, slab y lobbyY − .32 … − .02, z LOBBY ± .3
    rail runs      campus.js RAIL: (BALC.x0, LOBBY.z0 → LINK.z0), (LINK.z1 →
                   LOBBY.z1), and the two ends (BALC.x0 → x1 at LOBBY.z0 / z1)
    lobby glass    x LOBBY.x0, y lobbyY … + 2.9, the spans between lobbyGaps
"""
import wv_lib as L
import _arch as A

NAME = "lounge_facade"
ATLAS = 2048
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.55
TRIS = 9000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"ar_alu": 0.7, "ar_dark": 0.4, "ar_charcoal": 1.0, "ar_joint": 0.5,
             "ar_cap": 1.0, "ar_stone": 0.35, "cedar": 1.0}

L.PALETTE["ar_alu"] = L._hex("34373a")     # the photo's slim dark-grey frames
L.ROUGH["ar_alu"] = 0.5
import wv_bake as B
B.FAMILY["ar_alu"] = "paint"


def build():
    S = A.site()
    AR, LY, CY = S["AR"], S["LY"], S["CY"]
    BX = AR["backX"]
    Bz0, Bz1 = AR["bldg"]["z0"], AR["bldg"]["z1"]
    LG, LB, BC, LK = AR["loungeGap"], AR["LOBBY"], AR["BALC"], AR["LINK"]
    ced = A.cedar("cedar")
    parts = []

    def frames(prefix, x, y0, y1, z0, z1, pitch=1.15, head=0.16, sill=0.10):
        """a run of folding-door leaves: stiles every leaf, deep top/bottom rails"""
        n = max(2, round((z1 - z0) / pitch))
        for k in range(n + 1):
            z = z0 + (z1 - z0) * k / n
            parts.append(A.box(f"{prefix}_st{k}", x - 0.06, x + 0.06, y0, y1, z - 0.035, z + 0.035, "ar_alu"))
        for j, (za, zb) in enumerate(A.spans(z0, z1, 4.5)):
            parts.append(A.box(f"{prefix}_hd{j}", x - 0.10, x + 0.10, y1, y1 + head, za, zb, "ar_alu"))
            parts.append(A.box(f"{prefix}_bt{j}", x - 0.05, x + 0.05, y0, y0 + sill, za, zb, "ar_alu"))
            parts.append(A.box(f"{prefix}_tp{j}", x - 0.05, x + 0.05, y1 - 0.09, y1, za, zb, "ar_alu"))

    # ── THE 酒廊: folding glass frames on the courtyard face
    for i, (z0, z1) in enumerate(((Bz0 + 0.4, LG["z0"]), (LG["z1"], Bz1 - 0.4))):
        if z1 - z0 > 0.2:
            frames(f"lg{i}", BX, 0.03, 2.95, z0, z1)
    # the folded-back leaves parked at the opening's jambs (a frame round each pane)
    for i, lz in enumerate((LG["z0"] + 0.5, LG["z1"] - 0.5)):
        x = BX + 0.35
        parts.append(A.box(f"fl{i}_t", x - 0.04, x + 0.04, 2.86, 2.95, lz - 0.49, lz + 0.49, "ar_alu"))
        parts.append(A.box(f"fl{i}_b", x - 0.04, x + 0.04, 0.03, 0.12, lz - 0.49, lz + 0.49, "ar_alu"))
        for s in (-1, 1):
            parts.append(A.box(f"fl{i}_s{s}", x - 0.04, x + 0.04, 0.03, 2.95,
                               lz + s * 0.49 - 0.035, lz + s * 0.49 + 0.035, "ar_alu"))
    # the dark louvre band between the glass head and the balcony (3.11 … CY)
    y = 3.13
    k = 0
    while y < CY - 0.02:
        for j, (za, zb) in enumerate(A.spans(Bz0 + 0.1, Bz1 - 0.1, 6.0)):
            parts.append(A.box(f"lv{k}_{j}", BX - 0.16, BX - 0.06, y, y + 0.045, za, zb, "ar_dark"))
        y += 0.075
        k += 1

    # ── THE CHARCOAL PIER, large square tiles with fine joints
    pz = Bz1 - 3.6
    pd = 4.6
    px0, px1 = BX - 0.20, BX + 0.10
    parts.append(A.box("pier", px0 + 0.01, px1, 0.0, 3.24, pz - pd / 2, pz + pd / 2, "ar_charcoal"))
    nz, ny = 6, 4                          # ~0.77 × 0.81 m tiles (the photo: ~0.75)
    for j in range(1, nz):
        z = pz - pd / 2 + pd * j / nz
        parts.append(A.box(f"pj_z{j}", px0, px0 + 0.012, 0.0, 3.24, z - 0.005, z + 0.005, "ar_joint"))
    for j in range(1, ny):
        yy = 3.24 * j / ny
        parts.append(A.box(f"pj_y{j}", px0, px0 + 0.012, yy - 0.005, yy + 0.005, pz - pd / 2, pz + pd / 2, "ar_joint"))

    # ── THE BALCONY: slab, stone fascia beam, cedar soffit, capping
    lz0, lz1 = LB["z0"] - 0.3, LB["z1"] + 0.3
    for j, (za, zb) in enumerate(A.spans(lz0, lz1, 5.0)):
        parts.append(A.box(f"bslab{j}", BC["x0"], BC["x1"], LY - 0.32, LY - 0.02, za, zb, "ar_stone"))
        parts.append(A.box(f"bbeam{j}", BC["x0"] - 0.20, BC["x0"] + 0.08, LY - 0.58, LY - 0.02,
                           za - (0.05 if j == 0 else 0), zb, "ar_cap"))
        parts.append(A.world_uv(A.box(f"bsof{j}", BC["x0"] + 0.08, BC["x1"] - 0.05, LY - 0.39, LY - 0.32,
                                      za, zb, ced), tile=1.2, rot=True))
    parts.append(A.box("bbeam_endn", BC["x0"] - 0.20, BC["x1"], LY - 0.58, LY - 0.02, lz0 - 0.05, lz0, "ar_cap"))
    parts.append(A.box("bbeam_ends", BC["x0"] - 0.20, BC["x1"], LY - 0.58, LY - 0.02, lz1, lz1 + 0.05, "ar_cap"))
    # the capping over the frameless glass (the game's pane is arrGlassRailI)
    RAIL = [(BC["x0"], LB["z0"], BC["x0"], LK["z0"]), (BC["x0"], LK["z1"], BC["x0"], LB["z1"]),
            (BC["x0"], LB["z0"], BC["x1"], LB["z0"]), (BC["x0"], LB["z1"], BC["x1"], LB["z1"])]
    for i, (x1, z1, x2, z2) in enumerate(RAIL):
        if abs(x2 - x1) < 1e-6:
            for j, (za, zb) in enumerate(A.spans(min(z1, z2) - 0.05, max(z1, z2) + 0.05, 5.0)):
                parts.append(A.box(f"cap{i}_{j}", x1 - 0.075, x1 + 0.075, LY + 1.03, LY + 1.10, za, zb, "ar_cap"))
                parts.append(A.box(f"shoe{i}_{j}", x1 - 0.05, x1 + 0.05, LY - 0.02, LY + 0.06, za, zb, "ar_alu"))
        else:
            parts.append(A.box(f"cap{i}", min(x1, x2) - 0.05, max(x1, x2) + 0.05, LY + 1.03, LY + 1.10,
                               z1 - 0.075, z1 + 0.075, "ar_cap"))
            parts.append(A.box(f"shoe{i}", min(x1, x2), max(x1, x2), LY - 0.02, LY + 0.06,
                               z1 - 0.05, z1 + 0.05, "ar_alu"))

    # ── THE CHECK-IN LOBBY's glass wall: frames + a louvred transom
    gaps = AR["lobbyGaps"]
    runs = [(LB["z0"], gaps[0]["z0"]), (gaps[0]["z1"], gaps[1]["z0"]), (gaps[1]["z1"], LB["z1"])]
    for i, (z0, z1) in enumerate(runs):
        if z1 - z0 < 0.2:
            continue
        frames(f"lb{i}", LB["x0"], LY + 0.02, LY + 2.90, z0, z1)
        yy = LY + 3.08
        k = 0
        while yy < LY + AR["lobbyH"] - 0.10:
            for j, (za, zb) in enumerate(A.spans(z0, z1, 6.0)):
                parts.append(A.box(f"lt{i}_{k}_{j}", LB["x0"] - 0.14, LB["x0"] - 0.06, yy, yy + 0.05, za, zb, "ar_dark"))
            yy += 0.09
            k += 1
    # the one warm cedar panel bay beside the glass (the photo's upper right)
    parts.append(A.world_uv(A.box("cedar_panel", LB["x0"] - 0.22, LB["x0"] - 0.10, LY + 0.05, LY + 3.15,
                                  LB["z1"] - 5.8, LB["z1"] - 1.4, ced), tile=1.2))
    return L.join(parts, NAME, origin=None)
