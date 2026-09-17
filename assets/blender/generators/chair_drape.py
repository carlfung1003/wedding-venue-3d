"""chair_drape — the white chiffon tie behind a ceremony chair (decor-ceremony-main.jpg).

Spec row: same frame as crossback_chair (FRONT "+Z" → modelled facing Blender −Y;
the chair's back is at +Y). A knot at the top rail (y ~1.00, glTF z −.27 →
Blender y +.27); a FAN flaring up and out above the backrest to ~y 1.30, ~.50
wide; a SKIRT falling behind the seat from the same knot to ~y 0.30, ~.35 wide,
with soft folds. `chiffon`, opaque, BEVEL 0. Budget 1,200 / 256.

⚠ Origin: the game drops this through the SAME matrix as its chair, so the
drape keeps the chair's frame (join(origin=None)): x/y about the chair's floor
centre, z = 0 at the chair's foot. Its own lowest vertex is at z ≈ 0.30 — the
sidecar's `min` records that; nothing is re-centred on the drape's own bbox.

Three cloth sheets, all bmesh grids at their final density (no subdivision):
the fan is a pleated sector tilted 30° back with a gentle puff; the tail is a
widening sheet with three deepening folds; a second, narrower tail hangs
slightly offset so the tie reads as two ends. A knot ball wraps the rail.
"""
import math, bmesh
import bpy
from mathutils import Vector
import wv_lib as L
import _seating as S

NAME = "chair_drape"
ATLAS = 256
BEVEL = 0
AO_DIST = 0.5
AO_STRENGTH = 0.5
TRIS = 1200
FRONT = "+Z"
ORIGIN = "floor"

CHIFFON_TEX = "chiffon_white.webp"
KNOT = Vector((0.0, 0.265, 0.99))     # centre of the tie, just behind the top rail


def _grid(name, verts, nu, nv, mat):
    """verts: nu*nv positions, row-major (v outer, u inner) → one quad sheet."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in verts]
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = vs[j * nu + i]; b = vs[j * nu + i + 1]
            c = vs[(j + 1) * nu + i + 1]; d = vs[(j + 1) * nu + i]
            bm.faces.new([a, b, c, d])
    return L.from_bmesh(name, bm, (0, 0, 0), mat)


def _fan(mat, rnd, rho_max=0.30, tilt_deg=30, nu=25, nv=8, name="fan", puff_k=0.25, y_off=0.0):
    tilt = math.radians(tilt_deg)
    up = Vector((0, math.sin(tilt), math.cos(tilt)))       # the fan plane's "up" (back + up)
    nrm = Vector((0, math.cos(tilt), -math.sin(tilt)))     # its normal (toward the back, down)
    ph = rnd.uniform(0, 6.28)
    verts = []
    for j in range(nv):
        t = j / (nv - 1)
        rho = 0.03 + (rho_max - 0.03) * t
        for i in range(nu):
            th = math.radians(-62 + 124 * i / (nu - 1))
            base = KNOT + Vector((math.sin(th) * rho, y_off, 0)) + up * (math.cos(th) * rho)
            # soft ripples, not paper creases: the wave twists with radius and fades in late
            pleat = 0.026 * (t ** 1.6) * math.sin(8.0 * th + ph + 2.2 * t) \
                  + 0.010 * t * math.sin(15.0 * th + 1.3 - 1.5 * t)
            puff = puff_k * rho * rho / rho_max              # a billow toward the back
            droop = -0.035 * t * t * abs(math.sin(th))       # the rim droops at the sides
            verts.append(base + nrm * (pleat + puff) + Vector((0, 0, droop)))
    return _grid(name, verts, nu, nv, mat)


def _tail(name, mat, rnd, w0, w1, y0, y1, z0, z1, x_off, folds, amp, phase):
    nu, nv = 11, 10
    verts = []
    for j in range(nv):
        t = j / (nv - 1)
        w = w0 + (w1 - w0) * t
        y = y0 + (y1 - y0) * t
        z = z0 + (z1 - z0) * t
        sway = 0.02 * math.sin(2.6 * t + phase)
        for i in range(nu):
            s = i / (nu - 1) - 0.5
            x = x_off + s * w + sway
            fold = amp * (t ** 1.3) * math.sin(folds * math.pi * s + phase) \
                 + 0.35 * amp * t * math.sin(2.3 * folds * math.pi * s + 0.7)
            # the hem lifts where the folds bunch
            zz = z + 0.01 * t * (0.5 + 0.5 * math.sin(folds * math.pi * s + phase))
            verts.append(Vector((x, y + fold, zz)))
    return _grid(name, verts, nu, nv, mat)


def build():
    rnd = L.rng(NAME)
    cloth = S.tex("chiffon_tex", CHIFFON_TEX, roughness=0.94, fallback="chiffon", tint_to="chiffon")
    parts = []

    fan = _fan(cloth, rnd); S.metric_uv(fan, 0, 2, tile=0.6); parts.append(fan)
    # a second, smaller layer in front of it gives the puff its volume
    fan2 = _fan(cloth, rnd, rho_max=0.20, tilt_deg=48, nu=17, nv=5, name="fan2", puff_k=0.16, y_off=-0.01)
    S.metric_uv(fan2, 0, 2, tile=0.6); parts.append(fan2)
    # the long tail behind the seat, and a second shorter end hanging beside it
    t1 = _tail("tail", cloth, rnd, 0.11, 0.36, KNOT.y + 0.02, 0.33, 0.965, 0.30, 0.0, 3.0, 0.03, rnd.uniform(0, 3))
    S.metric_uv(t1, 0, 2, tile=0.6); parts.append(t1)
    t2 = _tail("tail2", cloth, rnd, 0.08, 0.22, KNOT.y + 0.055, 0.37, 0.95, 0.46, 0.06, 2.0, 0.022, rnd.uniform(0, 3))
    S.metric_uv(t2, 0, 2, tile=0.6); parts.append(t2)
    for o in (fan, fan2, t1, t2):
        S.soft_cloth(o, strength=0.011, scale=3.0, seed=rnd.randint(1, 99))

    # the knot: a squashed ball wrapping the rail, plus a wrap band
    knot = L.uv_sphere("knot", 0.048, tuple(KNOT), cloth, seg=12, rings=8)
    knot.scale = (1.5, 0.85, 0.7)
    L.jitter(knot, 0.004, rnd)                     # a bunched cloth knot, not a ball
    S.metric_uv(knot, 0, 2, tile=0.6)
    parts.append(knot)
    band = L.torus("band", 0.045, 0.014, (0, KNOT.y - 0.05, KNOT.z - 0.005), cloth, maj=12, mnr=5, rot=(0, 90, 0))
    band.scale = (1.0, 0.7, 1.0)
    S.metric_uv(band, 0, 2, tile=0.6)
    parts.append(band)

    root = L.join(parts, NAME, origin=None)     # the CHAIR's frame — see the docstring
    L.shade_smooth(root, angle=60)
    return root
