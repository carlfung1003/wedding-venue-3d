"""parasol_tiered — the white double-tiered parasol behind the dessert counter,
hung with pearl strands and small blooms (decor-dessert-bar.jpg;
refsheets/dessert_counter_parasol.png).

Spec row: pole Ø .045 h 2.60 at the origin; lower canopy r 1.95, base y 2.19 →
apex 2.49 (scalloped valance, 16 ribs); upper tier r 1.16, base 2.57 → apex 2.83;
finial. 16 pearl strands off the lower rim, 6–13 pearls each at .105 pitch, about
half ending in a small bloom. Origin floor at the pole foot. Budget 9,000 / 512 /
bevel 0. `linen` canvas, `oak` pole + ribs, `pearl`, blooms `hydrangea` / rose.

Each canopy is a bmesh (apex, mid ring, rim ring; 16 panels × 8 steps) whose
fabric dips between the ribs, with a two-scallops-per-panel valance hanging off
the rim; solidified 8 mm because the loader ships FrontSide materials and a
guest stands UNDER this one. The timber pole carries on above the 2.60 spec
height as a thinner spindle through both canopies to the finial at 2.97.

Pearls are flattened octahedra (8 tris, smooth-shaded) — the render's strands are
white DISCS on a thread, and 8-tri beads keep `linen` the dominant key so the
baked material's roughness is canvas, not pearl. Blooms use the generated head
textures through image_mat + spherical_uv (flat palette fallback if missing).
"""
import math, bmesh
import wv_lib as L

NAME = "parasol_tiered"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.35
TRIS = 9000
FRONT = "-Z"
ORIGIN = "floor"

POLE_R, POLE_H, TOP_H = 0.0225, 2.60, 2.90
RIBS, STEPS = 16, 8
LOWER = dict(r=1.95, z0=2.19, z1=2.49, val=0.11)
UPPER = dict(r=1.16, z0=2.57, z1=2.83, val=0.085)
STRANDS, PITCH = 16, 0.105
PEARL_R = 0.028


def _canopy(r, z0, z1, val):
    bm = bmesh.new()
    n = RIBS * STEPS
    apex = bm.verts.new((0, 0, z1))

    def ring(frac_r, z, dip_r, dip_z):
        vs = []
        for i in range(n):
            t = (i % STEPS) / STEPS
            s = math.sin(math.pi * t)                  # 0 at a rib, 1 between ribs
            rr = r * frac_r * (1 - dip_r * s)
            a = 2 * math.pi * i / n
            vs.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), z - dip_z * s)))
        return vs

    mid = ring(0.52, z0 + (z1 - z0) * 0.48, 0.010, 0.018)
    rim = ring(1.00, z0, 0.014, 0.035)
    valv = []
    for i in range(n):
        x, y, z = rim[i].co
        tt = (i % (STEPS // 2)) / (STEPS // 2)        # two scallops per panel
        scallop = 0.045 * math.sin(math.pi * tt)
        valv.append(bm.verts.new((x * 1.003, y * 1.003, z - val + scallop)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((apex, mid[i], mid[j]))
        bm.faces.new((mid[i], rim[i], rim[j], mid[j]))
        bm.faces.new((rim[i], valv[i], valv[j], rim[j]))
    return bm


def _tier(parts, tag, r, z0, z1, val):
    can = L.from_bmesh(f"canopy_{tag}", _canopy(r, z0, z1, val), (0, 0, 0), "linen")
    L.solidify(can, 0.008, offset=-1.0)
    parts.append(can)
    parts.append(L.cyl(f"hub_{tag}", 0.045, 0.07, (0, 0, z1 - 0.06), "oak", n=10))
    for i in range(RIBS):
        a = 2 * math.pi * i / RIBS
        parts.append(L.strut(f"rib_{tag}{i}", (0.04 * math.cos(a), 0.04 * math.sin(a), z1 - 0.045),
                             ((r + 0.03) * math.cos(a), (r + 0.03) * math.sin(a), z0 - 0.012),
                             0.009, "oak", n=6))


def _bead(bm, pos, a, r, rt):
    """Flattened octahedron: a pearl DISC hanging like a sequin — its flat face is
    vertical and faces radially outward (angle a), so a guest at eye height sees a
    disc, not an edge. Horizontal discs read as dark dashes in the first shot."""
    x, y, z = pos
    tx, ty = -math.sin(a) * r, math.cos(a) * r            # tangent
    nx, ny = math.cos(a) * rt, math.sin(a) * rt           # radial (the thin axis)
    v = [bm.verts.new(p) for p in ((x + tx, y + ty, z), (x, y, z + r), (x - tx, y - ty, z), (x, y, z - r))]
    fr, bk = bm.verts.new((x + nx, y + ny, z)), bm.verts.new((x - nx, y - ny, z))
    for i in range(4):
        p, q = v[i], v[(i + 1) % 4]
        bm.faces.new((p, q, fr))
        bm.faces.new((q, p, bk))


def build():
    rnd = L.rng(NAME)
    parts = []
    parts.append(L.cyl("pole", POLE_R, POLE_H, (0, 0, POLE_H / 2), "oak", n=12))
    parts.append(L.cyl("spindle", 0.016, TOP_H - POLE_H + 0.02, (0, 0, (POLE_H + TOP_H + 0.02) / 2), "oak", n=8))
    parts.append(L.lathe("finial", [(0, 0), (0.032, 0), (0.036, 0.025), (0.02, 0.045), (0.03, 0.075), (0, 0.10)],
                         (0, 0, TOP_H - 0.01), "oak", n=10))
    _tier(parts, "lo", **LOWER)
    _tier(parts, "up", **UPPER)

    hyd = L.image_mat("hydrangea", "hydrangea_head.webp", roughness=0.7)
    rose = L.image_mat("cream", "rose_head.webp", roughness=0.7)
    pearls = bmesh.new()
    n_pearl = 0
    for i in range(STRANDS):
        a = 2 * math.pi * (i + 0.5) / STRANDS
        rr = LOWER["r"] - 0.03
        x, y = rr * math.cos(a), rr * math.sin(a)
        n = 6 + int(rnd.random() * 8)                 # 6..13 pearls
        z_top = LOWER["z0"] - 0.03
        z_end = z_top - 0.05 - (n - 1) * PITCH
        parts.append(L.strut(f"thread{i}", (x, y, z_top), (x, y, z_end - 0.02), 0.0015, "pearl", n=3))
        for k in range(n):
            _bead(pearls, (x, y, z_top - 0.05 - k * PITCH - rnd.uniform(0, 0.01)), a, PEARL_R, PEARL_R * 0.3)
            n_pearl += 1
        if rnd.random() > 0.45:
            head = L.uv_sphere(f"bloom{i}", 0.05, (x, y, z_end - 0.05), hyd if i % 2 == 0 else rose, seg=10, rings=7)
            L.jitter(head, 0.004, rnd)
            L.spherical_uv(head)
            parts.append(head)
    parts.append(L.from_bmesh("pearls", pearls, (0, 0, 0), "pearl"))
    print(f"parasol_tiered: {n_pearl} pearls")
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
