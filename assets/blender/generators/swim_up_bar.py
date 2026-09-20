"""swim_up_bar — the lagoon's swim-up bar: the counter with its boarded front,
the back-bar case of bottle shelving, and the flat slatted canopy over both.

Source: `buildSwimUpBar`, js/campus.js:5644-5760. That function authors in its
own (u, v) frame — **u along the bank, v OUTWARD from the water (landward)** —
and `ry = atan2(nX, nZ)` points the bar's local +Z at v. Its constants:

    FLOOR  .16     the bar's own service floor (its plinth's top, subDeckI)
    TOP   1.14     the counter's working surface
    counter    CT_U 6.6 × CT_D .9 at CT_V −.1,  y .16 … 1.06      (campus.js:5709)
      cap      6.82 × 1.12 × .08 at y 1.06 … 1.14                 (campus.js:5711)
    back-bar   SH_U 6.2 at SH_V 1.7, SH_TOP 2.35                  (campus.js:5721)
      back panel  6.2 × .1 at v 1.81 … 1.91, y .16 … 2.35
      end stiles  .18 × .42 at u ±3.01
      5 shelves   5.9 × .05 × .4 at y .44 / .86 / 1.28 / 1.70 / 2.12
    canopy     CN_U 8.4, v −1.9 … 2.9, CANO 3.0                   (campus.js:5744)
      4 posts   .19² at u ±3.55, v −.15 / 2.55, y .16 … 3.0  (these carry
                colliders of r .28 — campus.js:5751 — so they may NOT move)
      2 edge beams  8.4 × .18 × .22 at y 3.0 … 3.18, v −1.74 / 2.74
      1 centre beam 8.4 × .12 × .22 at y 3.0 … 3.12
      30 slats      8.28 × .07 × .14 at y 3.175 … 3.245, v −1.6 … 2.6

    the model is 8.400 × 4.800 × 3.085, origin floor centre, and a drop-in sits
    at y = FLOOR = 0.16 on wx(0, (CN_V0 + CN_V1)/2), wz(…) with ry = the
    function's own `ry`.

Blender +Y is the asset's FRONT (→ glTF −Z) and the front of this bar is the
WATER, i.e. the code's −v. So **Blender y = −v** throughout; the back-bar at
v +1.7 is modelled at Blender y −1.7, and the swimmers' side is +Y.

── WHAT IS NOT IN THIS GLB, AND WHY EACH ONE STAYS ────────────────────────────
· **The plinth and the stepped white apron** (campus.js:5702-5707) are the ground
  the bar stands on and carry the bar's `rectCollider`; they are site, not
  furniture, and the model's foot is their top face.
· **The "POOL BAR" lettering** is a game-built `PlaneGeometry(2.9, .46)` hung
  12 mm proud of the counter's front face at u −.4, y .82 (campus.js:5713-5718).
  The house rule is that an atlas-baked face cannot take a new texture, so the
  front is modelled FLAT AND PLAIN behind it. ⚠ That is also why the boards on
  this counter are expressed as **reveals, not as proud staves**: the rooftop
  counter's fluting stands 60 mm proud (campus.js:5481), and 60 mm through a
  plane that clears the face by 12 mm is the GLB-easel bug of 2026-09-16 all over
  again. Here the boards' outer faces ARE the counter's front plane and the
  grooves are cut behind it, so nothing can poke through the sign.
· **The bottles** (campus.js:5758-5773) stay the game's: 5 shelves × 16 bays of
  `UNIT_CYL` on `MAT.bottle`, per-instance tinted from a WEIGHTED glass table and
  seeded with gaps. Baked into an atlas they would lose the tint stream and cost
  ~2,000 triangles; instanced they cost one draw call and already look right.
  This GLB is the CASE they stand in.
· **The lit reveals** behind each shelf (`MAT.inLight`, campus.js:5732) are
  emissive and a bake cannot be. They sit at v 1.795 … 1.845, so the back panel's
  front face is held at v 1.81 exactly as the code has it and the strips stand
  15 mm proud of plain timber.
· The bowl planter of bougainvillea, the stone apron and the submerged stools
  (`swim_stool`, its own asset).

── CODE VS PHOTO ──────────────────────────────────────────────────────────────
`reference/photos/resort-swim-up-bar.webp` is the spec for the FINISH and it says
three things the primitive's flat boxes do not: the canopy is **pale sun-bleached
timber** with its beams reading dark underneath; the back-bar is a **deep
red-brown case divided into bays by vertical stiles**, much darker than any wood
key in the palette (hence a gained `oak_d`); and the counter is **pale stepped
render**, not timber. Envelopes are the code's to the millimetre.
"""
import wv_lib as L
import _pool as P

NAME = "swim_up_bar"
ATLAS = 1024              # 512 bled tan timber islands into the white counter boards
BEVEL = 0                 # per part: the 30 canopy slats would 4× on a joined bevel
AO_DIST = 0.30            # the back-bar's bays are an enclosed interior
AO_STRENGTH = 0.5
TRIS = 6000
FRONT = "-Z"              # the water side
ORIGIN = "floor"          # = FLOOR .16, the bar's own service floor

FLOOR = 0.16              # campus.js:5698 — the model's z 0
TOP = 1.14 - FLOOR        # .98  — the counter's working surface, off the floor
CT_U, CT_V, CT_D = 6.6, -0.1, 0.9                       # campus.js:5709
SH_U, SH_V, SH_TOP = 6.2, 1.7, 2.35 - FLOOR             # campus.js:5721
CN_U, CN_V0, CN_V1, CANO = 8.4, -1.9, 2.9, 3.0 - FLOOR  # campus.js:5744
BOARDS = 16               # vertical boards across the counter's front


def build():
    rnd = L.rng(NAME)
    pale = P.tex("sub_canopy", "pine_planks.webp", roughness=0.80,
                 fallback="bar_top", tint_to="bar_top", gain=(1.22, 1.20, 1.12))
    dkwood = P.tex("sub_case", "oak_light.webp", roughness=0.74,
                   fallback="oak_d", tint_to="oak_d", gain=(0.30, 0.19, 0.12))
    white = L.M("paint_w")
    stone = L.M("stone")
    dark = L.M("dark")
    parts = []

    # ══ 1 · THE COUNTER ════════════════════════════════════════════════════
    # carcass, its front face RECESSED 30 mm so the boards below sit flush with
    # the code's own front plane at v −.55 (Blender y +.55)
    parts.append(L.box("ct_body", (CT_U, CT_D - 0.03, TOP - 0.08),
                       (0, -CT_V - 0.015, (TOP - 0.08) / 2), white))
    # the boards: outer face AT the front plane, 30 mm grooves between them.
    # ⚠ nothing here may stand proud — see the banner's sign note.
    pitch = CT_U / BOARDS
    for i in range(BOARDS):
        x = (i + 0.5) * pitch - CT_U / 2
        parts.append(L.box(f"ct_board{i}", (pitch - 0.030, 0.030, TOP - 0.10),
                           (x, 0.535, (TOP - 0.10) / 2 + 0.008), white))
    # the pale stone cap, overhanging on all four sides (6.82 × 1.12 × .08)
    cap = L.box("ct_cap", (CT_U + 0.22, CT_D + 0.22, 0.08),
                (0, -CT_V, TOP - 0.04), stone)
    L.bevel([cap], width=0.010, segments=2, angle=40, min_size=0.05)
    parts.append(cap)
    # a bartender's under-counter shelf, seen from the landward side
    # ⚠ at v CT_V + .30 this shelf is BEHIND the counter, in the service gap
    #   between it and the back-bar. −CT_V + .30 (which is what the first build
    #   had) puts it at v −.40, six centimetres THROUGH the counter's front face
    #   and out into the water — a dark line across the white render, which is
    #   exactly how the in-engine shot showed it.
    sh0 = L.box("ct_shelf", (CT_U - 0.5, 0.42, 0.045), (0, -(CT_V + 0.70), 0.46), dkwood)
    P.metric_uv(sh0, 0, 1, tile=0.42)
    parts.append(sh0)

    # ══ 2 · THE BACK-BAR CASE ══════════════════════════════════════════════
    # the dark back panel: its FRONT face stays at v 1.81 so the game's emissive
    # shelf strips (v 1.795 … 1.845) stand 15 mm proud of it
    parts.append(L.box("bb_back", (SH_U, 0.10, SH_TOP),
                       (0, -(SH_V + 0.16), SH_TOP / 2), dark))
    # a plinth under the case
    pl = L.box("bb_plinth", (SH_U - 0.06, 0.46, 0.14), (0, -SH_V, 0.07), dkwood)
    P.metric_uv(pl, 0, 2, tile=0.42)
    parts.append(pl)
    # the two end stiles (the code's .18 × .42) and three inner dividers, which
    # is what makes the photograph's case read as bays rather than as a wall
    for s in (-1, 1):
        st = L.box(f"bb_stile{s}", (0.18, 0.42, SH_TOP),
                   (s * (SH_U / 2 - 0.09), -SH_V, SH_TOP / 2), dkwood)
        L.bevel([st], width=0.008, segments=2, angle=40, min_size=0.05)
        P.metric_uv(st, 0, 2, tile=0.42)
        parts.append(st)
    for k in (-1, 0, 1):
        dv = L.box(f"bb_div{k}", (0.075, 0.40, SH_TOP - 0.30),
                   (k * (SH_U - 0.18) / 4, -SH_V, (SH_TOP - 0.30) / 2 + 0.14), dkwood)
        P.metric_uv(dv, 0, 2, tile=0.42)
        parts.append(dv)
    # the five shelves, at the code's own heights
    for i in range(5):
        z = 0.28 + i * 0.42                     # world .44 … 2.12, less FLOOR
        sh = L.box(f"bb_shelf{i}", (SH_U - 0.30, 0.40, 0.05),
                   (0, -SH_V, z), dkwood)
        P.metric_uv(sh, 0, 1, tile=0.42)
        parts.append(sh)
    # a cornice closing the case's top
    corn = L.box("bb_cornice", (SH_U + 0.10, 0.50, 0.11),
                 (0, -SH_V + 0.02, SH_TOP - 0.055), dkwood)
    L.bevel([corn], width=0.010, segments=2, angle=40, min_size=0.05)
    P.metric_uv(corn, 0, 1, tile=0.42)
    parts.append(corn)

    # ══ 3 · THE FLAT SLATTED CANOPY ════════════════════════════════════════
    # ⚠ the four posts carry r .28 colliders (campus.js:5751): they do not move
    for su in (-1, 1):
        for sv in (-1, 1):
            u = su * (CN_U / 2 - 0.65)
            v = -0.15 if sv < 0 else 2.55
            p = L.box(f"cn_post{su}{sv}", (0.19, 0.19, CANO),
                      (u, -v, CANO / 2), pale)
            L.bevel([p], width=0.009, segments=2, angle=40, min_size=0.05)
            P.metric_uv(p, 0, 2, tile=0.48)
            parts.append(p)
    for sv in (-1, 1):                          # the two edge beams
        v = CN_V0 + 0.16 if sv < 0 else CN_V1 - 0.16
        b = L.box(f"cn_beam{sv}", (CN_U, 0.22, 0.18), (0, -v, CANO + 0.09), pale)
        L.bevel([b], width=0.010, segments=2, angle=40, min_size=0.05)
        P.metric_uv(b, 0, 2, tile=0.48)
        parts.append(b)
    mid = L.box("cn_mid", (CN_U, 0.22, 0.12),
                (0, -(CN_V0 + CN_V1) / 2, CANO + 0.06), pale)
    P.metric_uv(mid, 0, 2, tile=0.48)
    parts.append(mid)
    # 30 slats, laid along the bank, spaced across the depth. No bevel: 30 × 4 is
    # 1,000 triangles of edge nobody can see from the far bank.
    # ⚠ the slats are 85 mm deep, not the code's 140. At the code's own 145 mm
    #    pitch a 140 mm slat leaves a FIVE-MILLIMETRE gap, i.e. a solid black
    #    plate — which is exactly what the first turntable showed. The photograph
    #    is a slatted canopy you can see sky through; the count, the pitch, the
    #    span and the top plane are all still the code's.
    n, span = 30, CN_V1 - CN_V0
    for i in range(n):
        v = CN_V0 + 0.3 + (i / (n - 1)) * (span - 0.6)
        sl = L.box(f"cn_slat{i}", (CN_U - 0.12, 0.085, 0.07),
                   (0, -v, CANO + 0.21), pale)
        P.metric_uv(sl, 0, 1, tile=0.48)
        parts.append(sl)
    # a thin fascia on the two long edges, which is what stops the canopy
    # reading as a comb when you are under it
    for sv in (-1, 1):
        v = CN_V0 + 0.025 if sv < 0 else CN_V1 - 0.025
        fa = L.box(f"cn_fascia{sv}", (CN_U, 0.05, 0.13), (0, -v, CANO + 0.18), pale)
        P.metric_uv(fa, 0, 2, tile=0.48)
        parts.append(fa)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=36)
    _ = rnd
    return root
