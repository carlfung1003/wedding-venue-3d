"""parked_car (+ _glass, _trim, _rims) — the low-poly saloon parked in the
arrival court and on the north apron. KAN-208 wave 3.

Replaces campus.js `parkedCar()` (js/campus.js ~5307), which assembled each car
from fifteen UNIT_BOX / UNIT_CYL instances on three existing buckets — a slab
body, a glass slab and a dark underbody, which reads as a crate. The ENVELOPE is
that function's, so nothing it stands beside moves:

  lower body   1.80 W × 4.38 L, y .42 … .98        (carI  .70 ± .28, 4.38)
  sill shadow  1.86 × 4.16, y .38 … .56             (darkI)
  bumpers      1.82 W, z ±2.14 ± .11 → L 4.50        (darkI .62 ± .14)
  greenhouse   1.60 × 2.28, y 1.01 … 1.51, z −1.22 … 1.06   (carGlassI)
  roof         1.52 × 2.02 at y 1.54 ± .05 → top 1.59
  wheels       r .33, width .24, at x ±.80, z ±1.34
  lamps        head z +2.16, y .92; tail z −2.16, y .99   (carI, kept by the game)

The court's colliders are two r 1.05 circles at ±1.15 m along the car's axis
(campus.js buildArrival), which this outline fills exactly as the boxes did.

⚠ GEOMETRY ONLY (BAKE = False), four GLBs in ONE frame, because a parked car
is four material classes the campus already owns and tints:
  parked_car        the painted shell — MAT.car, TINTED PER INSTANCE (the
                    CAR_PALETTE colour), so it must stay one mesh in one key;
  parked_car_glass  the greenhouse — MAT.carGlass;
  parked_car_trim   tyres, underbody, bumper valances, grille, sills, mirrors
                    — MAT.dark;
  parked_car_rims   the wheel faces — MAT.car tinted silver.
The head-lamp lenses ride `_rims` (silver); the red tail lamps stay the
game's own carI boxes (a second colour on one asset would need vertex colour
= a new program). Tail lamps are 2.2 m BEHIND the centre, which on the north
apron is the world side of world.js's z −77.4 relocation line — see build_rims.

FRAME: the chair-family exception — the car's FRONT is glTF **+Z** (modelled
facing Blender −Y), because parkedCar() authors the head lamps at local +Z.
Origin: floor, footprint centre = parkedCar's (cx, cz). No UVs: none of the
three materials carries a map.
"""
import math
import bmesh
import bpy
import wv_lib as L

NAME = "parked_car"
BAKE = False
ATLAS = 256
BEVEL = 0
TRIS = 1100               # per part; the four together stay ≤ 2.5k (spec)
FRONT = "+Z"
ORIGIN = "floor"

WZ = 1.34                 # axle z
WX = 0.80                 # wheel centre x
WR = 0.33                 # tyre radius
TW = 0.23                 # tyre width
AR = 0.40                 # wheel-arch radius


def _yb(z):
    """glTF z (front +Z) → Blender y (the car faces Blender −Y)."""
    return -z


def _side_prism(name, pts, x0, x1, key):
    """Extrude a side profile [(z_gltf, y_height)…] across x0 … x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, _yb(z), y)) for (z, y) in pts]
    b = [bm.verts.new((x1, _yb(z), y)) for (z, y) in pts]
    n = len(pts)
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    o = L.from_bmesh(name, bm, (0, 0, 0), key)
    return o


def _arch(cz, r, n=7):
    """points over a wheel arch, rear edge → front edge (z increasing), at y .36"""
    pts = []
    for k in range(n + 1):
        t = math.pi - math.pi * k / n            # π … 0
        pts.append((cz + r * math.cos(t), 0.36 + (r - 0.03) * math.sin(t)))
    return pts


def _lower_profile():
    """The shell's side silhouette, going round the outline: rear bumper foot →
    rear arch → front arch → nose → bonnet → (greenhouse base) → boot → tail."""
    p = [(-2.19, 0.40)]
    p += _arch(-WZ, AR)
    p += _arch(WZ, AR)
    p += [(2.19, 0.40), (2.22, 0.60), (2.22, 0.80), (2.13, 0.90), (1.80, 0.96),
          (1.10, 1.00), (-1.30, 1.01), (-1.95, 0.99), (-2.14, 0.93), (-2.21, 0.80),
          (-2.22, 0.60)]
    return p


def build():
    parts = []
    shell = _side_prism("shell", _lower_profile(), -0.90, 0.90, "paint_w")
    L.bevel([shell], width=0.07, segments=2, angle=35)
    parts.append(shell)
    # roof panel + pillars, in the body colour
    roof = L.box("roof", (1.30, 1.18, 0.05), (0, _yb(-0.22), 1.555), "paint_w")
    L.bevel([roof], width=0.02, segments=1)
    parts.append(roof)
    for s in (-1, 1):
        # A pillar (windscreen edge), B pillar, a broad C pillar
        parts.append(L.bar(f"apil{s}", (s * 0.745, _yb(1.08), 1.00), (s * 0.645, _yb(0.36), 1.535), 0.07, 0.05, "paint_w"))
        parts.append(L.bar(f"bpil{s}", (s * 0.765, _yb(-0.22), 1.00), (s * 0.655, _yb(-0.24), 1.535), 0.035, 0.09, "paint_w"))
        parts.append(L.bar(f"cpil{s}", (s * 0.745, _yb(-1.18), 1.00), (s * 0.645, _yb(-0.78), 1.535), 0.07, 0.24, "paint_w"))
        # the door-handle line / a crease along the flank
        parts.append(L.box(f"crease{s}", (0.012, 2.9, 0.02), (s * 0.905, _yb(0.0), 0.83), "paint_w"))
    root = L.join(parts, NAME, origin=None)
    L.shade_smooth(root, angle=40)
    return root


def build_glass():
    """the greenhouse: a tapered volume — windscreen raked back, backlight raked
    forward, the side glass tumbling in — sitting on the shell's belt."""
    bm = bmesh.new()
    lo = [(1.12, 0.99), (-1.26, 1.00)]          # z at the belt (front, rear), y
    hi = [(0.34, 1.535), (-0.80, 1.535)]         # z at the roof
    hw_lo, hw_hi = 0.765, 0.655
    v = {}
    for s in (-1, 1):
        v[("lf", s)] = bm.verts.new((s * hw_lo, _yb(lo[0][0]), lo[0][1]))
        v[("lr", s)] = bm.verts.new((s * hw_lo, _yb(lo[1][0]), lo[1][1]))
        v[("hf", s)] = bm.verts.new((s * hw_hi, _yb(hi[0][0]), hi[0][1]))
        v[("hr", s)] = bm.verts.new((s * hw_hi, _yb(hi[1][0]), hi[1][1]))
    F = lambda *k: bm.faces.new([v[x] for x in k])
    F(("lf", -1), ("lf", 1), ("hf", 1), ("hf", -1))       # windscreen
    F(("lr", 1), ("lr", -1), ("hr", -1), ("hr", 1))       # backlight
    F(("hf", -1), ("hf", 1), ("hr", 1), ("hr", -1))       # under the roof
    for s in (-1, 1):
        F(("lf", s), ("lr", s), ("hr", s), ("hf", s))     # side glass
    F(("lf", 1), ("lf", -1), ("lr", -1), ("lr", 1))       # floor
    o = L.from_bmesh("glass", bm, (0, 0, 0), "glass_pale")
    L._orient_normals(o)
    return L.join([o], NAME + "_glass", origin=None)


def build_trim():
    parts = []
    for s in (-1, 1):
        for cz in (-WZ, WZ):
            # tyre: a cylinder on the car's X axis, with a rounded shoulder
            t = L.cyl(f"tyre{s}{cz}", WR, TW, (s * WX, _yb(cz), WR), "dark", n=16, rot=(0, 90, 0))
            L.bevel([t], width=0.035, segments=1, angle=30)
            parts.append(t)
        # side sill under the doors, between the arches
        parts.append(L.box(f"sill{s}", (0.05, 1.70, 0.16), (s * 0.88, _yb(0.0), 0.44), "dark"))
        # mirrors on short stalks at the A-pillar foot
        parts.append(L.box(f"mir{s}", (0.17, 0.09, 0.11), (s * 0.98, _yb(0.80), 1.08), "dark"))
    # the underbody / arch liners (so no daylight through the arch tunnels)
    parts.append(L.box("under", (1.40, 4.10, 0.40), (0, 0, 0.52), "dark"))
    # bumper valances + the grille
    parts.append(L.box("fval", (1.78, 0.14, 0.18), (0, _yb(2.17), 0.44), "dark"))
    parts.append(L.box("rval", (1.78, 0.14, 0.16), (0, _yb(-2.17), 0.45), "dark"))
    parts.append(L.box("grille", (0.66, 0.05, 0.10), (0, _yb(2.19), 0.70), "dark"))
    # dark bezels behind the game's head-lamp boxes, so a lamp reads on a white car
    for s in (-1, 1):
        parts.append(L.box(f"bezel{s}", (0.44, 0.04, 0.15), (s * 0.58, _yb(2.18), 0.745), "dark"))
    parts.append(L.box("plate_f", (0.44, 0.03, 0.11), (0, _yb(2.25), 0.46), "dark"))
    parts.append(L.box("plate_r", (0.44, 0.03, 0.11), (0, _yb(-2.235), 0.66), "dark"))
    root = L.join(parts, NAME + "_trim", origin=None)
    L.shade_smooth(root, angle=40)
    return root


def build_rims():
    parts = []
    for s in (-1, 1):
        for cz in (-WZ, WZ):
            x = s * (WX + TW / 2 - 0.012)
            parts.append(L.cyl(f"rim{s}{cz}", 0.205, 0.03, (x, _yb(cz), WR), "steel_l", n=14, rot=(0, 90, 0)))
            parts.append(L.cyl(f"hub{s}{cz}", 0.06, 0.05, (x + s * 0.012, _yb(cz), WR), "steel_l", n=8, rot=(0, 90, 0)))
    # the HEAD-LAMP lenses ride this silver part, not the game's carI boxes:
    # world.js relocates campus instances ONE BY ONE by isEnclaveLocal(x, z), and
    # on the north apron (z ≈ −78, the line is z −77.4) a separate lamp instance
    # 2.2 m ahead of the car centre lands on the enclave side and is rotated onto
    # the lawn — which is exactly what the old boxes' front halves were doing.
    for s in (-1, 1):
        parts.append(L.box(f"lamp{s}", (0.36, 0.05, 0.09), (s * 0.58, _yb(2.20), 0.745), "steel_l"))
    root = L.join(parts, NAME + "_rims", origin=None)
    L.shade_smooth(root, angle=40)
    return root
