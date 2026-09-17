"""long_table — the bare-timber long table, eight covers (decor-dinner-rounds.jpg,
foreground right).

Spec row: 4.80 L (along X) × 1.02 W, top surface y .79 (.07 thick, centre .755);
four legs .08² at x ±2.16, glTF z ±.38. Origin floor centre; the game rotates
it for the 'z' axis. `oak` planks with seams along X. Budget 1,500 / 512 / .004.

Six boards, each its own bevelled box with a 7 mm seam, a hair of length and
height jitter so the seams catch the sun; a solid frame under them — four
square legs, two long aprons, two end rails and a centre stretcher. Grain from
`oak_light.webp` runs along the boards (metric projection, tinted to `oak`).
BEVEL is 0 at module level and applied per part so the plain frame members stay
cheap; only the boards and legs, which a guest sits at, carry the edge.
"""
import wv_lib as L
import _seating as S

NAME = "long_table"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1500
FRONT = "-Z"
ORIGIN = "floor"

OAK_TEX = "oak_light.webp"
LEN, WID, Z_TOP, T_TOP = 4.80, 1.02, 0.79, 0.07
LEG, LEG_X, LEG_Y = 0.08, 2.16, 0.38
BOARDS, SEAM = 6, 0.007


def build():
    rnd = L.rng(NAME)
    oak = S.tex("oak_grain", OAK_TEX, roughness=0.72, fallback="oak", tint_to="oak")
    parts = []

    bw = (WID - SEAM * (BOARDS - 1)) / BOARDS
    for i in range(BOARDS):
        y = -WID / 2 + bw / 2 + i * (bw + SEAM)
        ln = LEN - rnd.uniform(0.0, 0.012)
        dz = rnd.uniform(-0.0008, 0.0008)
        b = L.box(f"board{i}", (ln, bw, T_TOP), (rnd.uniform(-0.004, 0.004), y, Z_TOP - T_TOP / 2 + dz), oak)
        L.bevel([b], width=0.004, segments=2, angle=40, min_size=0.02)
        S.metric_uv(b, 1, 0, tile=0.9)
        parts.append(b)

    z_leg = (Z_TOP - T_TOP) / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg = L.box("leg", (LEG, LEG, Z_TOP - T_TOP), (sx * LEG_X, sy * LEG_Y, z_leg), oak)
            L.bevel([leg], width=0.004, segments=2, angle=40, min_size=0.02)
            S.metric_uv(leg, 1, 2, tile=0.9)
            parts.append(leg)
    # the frame: long aprons under the boards, end rails, a low centre stretcher
    for sy in (-1, 1):
        ap = L.box("apron", (LEN - 0.30, 0.04, 0.10), (0, sy * (LEG_Y + 0.02), Z_TOP - T_TOP - 0.05), oak)
        S.metric_uv(ap, 2, 0, tile=0.9); parts.append(ap)
    for sx in (-1, 1):
        er = L.box("end_rail", (0.05, 2 * LEG_Y - LEG, 0.08), (sx * LEG_X, 0, 0.18), oak)
        S.metric_uv(er, 2, 1, tile=0.9); parts.append(er)
    st = L.box("stretcher", (2 * LEG_X - LEG, 0.05, 0.06), (0, 0, 0.18), oak)
    S.metric_uv(st, 2, 0, tile=0.9); parts.append(st)

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=50)
    return root
