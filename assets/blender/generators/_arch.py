"""_arch — shared helpers for KAN-211's ARCHITECTURE generators (wave A: the
arrival pavilion + the check-in lobby). Files starting with `_` never build.

── THE FRAME: every wave-A GLB is authored IN SITE COORDINATES ─────────────────
Architecture is not a prop you drop somewhere: its walls sit on published
collider lines, its stair treads on published floorY heights. So these GLBs are
NOT re-origined to a bbox. Every one of them shares ONE frame — enclave-local
metres with the origin at the ANCHOR

        ANCHOR = (SITE.ARRIVAL.backX, 0, SITE.ARRIVAL.axisZ) = (33, 0, −8)

and campus.js places each with a single identity-rotation, unit-scale instance
at exactly that point (`arrGlb()` in buildArrival). (33, −8) answers true to
isEnclaveLocal(), so world.js's per-instance relocation carries every one of
them into the enclave in one piece (a one-instance GLB is decided by its
centre and cannot tear — KAN-208 wave 3, lesson 2).

⚠ THE NUMBERS ARE READ FROM THE LIVE js/site.js, not re-typed. `site()` runs
node on site.js and returns SITE.ARRIVAL + the two derived heights. A spec note
can be wrong; the published number cannot drift from itself.

Axes: enclave-local (x, y, z) with y up → Blender (x − ax, −(z − az), y).
The exporter maps Blender (x, y, z) → glTF (x, z, −y), which gives back
(x − ax, y, z − az): the identity the instance matrix expects.
"""
import glob
import json
import math
import os
import shutil
import subprocess

import bmesh
import bpy
import wv_lib as L
import wv_bake as B

ROOT = L.ROOT
_SITE = None


def _node():
    n = shutil.which("node")
    if n:
        return n
    c = sorted(glob.glob(os.path.expanduser("~/.nvm/versions/node/*/bin/node")))
    if c:
        return c[-1]
    for p in ("/opt/homebrew/bin/node", "/usr/local/bin/node"):
        if os.path.exists(p):
            return p
    raise RuntimeError("_arch.site(): node not found — it reads js/site.js")


def site():
    """SITE.ARRIVAL (+ lobbyY LY, lounge ceiling CY, EXT_STAIR XS), from js/site.js."""
    global _SITE
    if _SITE is None:
        js = os.path.join(ROOT, "js", "site.js")
        code = (f"const m = await import({json.dumps(js)});"
                "console.log(JSON.stringify({AR: m.SITE.ARRIVAL, LY: m.ARRIVAL_LOBBY_Y,"
                " CY: m.ARRIVAL_LOUNGE_CEIL, XS: m.SITE.EXT_STAIR}));")
        out = subprocess.run([_node(), "--input-type=module", "-e", code],
                             capture_output=True, text=True, check=True)
        _SITE = json.loads(out.stdout.strip().splitlines()[-1])
    return _SITE


def anchor():
    AR = site()["AR"]
    return (AR["backX"], 0.0, AR["axisZ"])


def B_(x, y, z):
    """enclave-local (x, y up, z) → Blender coordinates in the shared frame."""
    ax, ay, az = anchor()
    return (x - ax, -(z - az), y - ay)


# ---------------------------------------------------------------- palette
# Architecture keys, display sRGB. Registered into wv_lib's PALETTE / ROUGH and
# wv_bake's FAMILY at import, so M(key) and the bake's finish families work.
ARCH = {
    # key            hex        family   roughness
    "ar_corten":   ("5f5247", "metal_p", 0.70),   # fallback if the photo is missing
    "ar_corten_d": ("2f2822", "paint",   0.70),   # the dark reveal behind a seam
    "ar_stone":    ("45494c", "stone",   0.30),   # honed grey-charcoal stair (f_011/f_013)
    "ar_stone_l":  ("5c6164", "stone",   0.30),   # the landing / nosing strip
    "ar_black":    ("141517", "paint",   0.20),   # the piers' glossy black bands
    "ar_taupe":    ("7a7367", "stone",   0.60),   # the piers' projecting taupe ledges
    "ar_bronze":   ("4a3528", "paint",   0.45),   # door frames, mullions (warm bronze)
    "ar_dark":     ("22211f", "paint",   0.55),   # soffit slats, louvres, backplates
    "ar_charcoal": ("45464a", "stone",   0.80),   # the lounge's charcoal tile pier
    "ar_joint":    ("222325", "paint",   0.80),   # tile joints
    "ar_cap":      ("9d968c", "stone",   0.75),   # the balcony's stone capping + fascia
    "ar_white":    ("ebe7de", "paint",   0.60),   # cabinet wall
    "ar_teak":     ("3a2a20", "wood",    0.55),   # the desk's dark timber
    "ar_bamboo":   ("c29c62", "wood",    0.65),   # the desk's slat front
    "ar_screen":   ("121315", "paint",   0.35),   # the monitor
    "ar_cedar":    ("a15a2f", "wood",    0.65),   # cedar_soffit.webp's own mean, the fallback
}
for k, (hx, fam, rough) in ARCH.items():
    L.PALETTE[k] = L._hex(hx)
    L.ROUGH[k] = rough
    B.FAMILY[k] = "metal" if fam == "metal_p" else fam
# metal_p: brushed finish family, but a DIELECTRIC key (Metallic stays 0) — the
# atlas is albedo × AO and the game sets roughness per GLB.


def corten(name="corten"):
    """The weathered corten skin: a photograph (corten_weathered.webp) when it
    exists, else the flat palette key. Separate NAMES for faces that should get
    fewer atlas texels (UV_WEIGHT keys on the material name)."""
    return L.image_mat(name, "corten_weathered.webp", roughness=0.70, fallback="ar_corten")


def cedar(name="cedar"):
    return L.image_mat(name, "cedar_soffit.webp", roughness=0.65, fallback="ar_cedar")


def panelling(name="panelling"):
    """The lobby/lounge's DARK timber wall panelling (the lobby frames of the
    entrance video; compare-checkin-lobby's wall beside the cabinets).

    ⚠ `panel_walnut.webp` is DERIVED, not generated: cedar_soffit.webp multiplied
    in LINEAR space by (0.24, 0.19, 0.19) — one numpy line, recorded in
    ASSET_SPEC's KAN-211 notes. The first try did the multiply as a Mix node in
    the source material and the baked atlas came back UNTINTED (the MIX was
    wired in the saved master, the atlas was the raw cedar orange; cause not
    isolated) — so the darkening lives in the picture, where it cannot be lost."""
    return L.image_mat(name, "panel_walnut.webp", roughness=0.6, fallback="ar_teak")


# ---------------------------------------------------------------- geometry
def box(name, x0, x1, y0, y1, z0, z1, mat):
    """Axis-aligned box from LOCAL extents."""
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    z0, z1 = min(z0, z1), max(z0, z1)
    c = B_((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    return _auto_uv(L.box(name, (x1 - x0, z1 - z0, y1 - y0), c, mat))


def _auto_uv(o):
    """Every part on a PHOTOGRAPH gets the world-scale art UV by default (an
    explicit world_uv() call afterwards overrides the tile / rotation) — the
    bake's art-UV check refuses a hidden core that forgot one."""
    for s in o.material_slots:
        m = s.material
        if m and m.use_nodes and any(n.type == 'TEX_IMAGE' for n in m.node_tree.nodes):
            world_uv(o)
            break
    return o


def hexa(name, corners, mat):
    """A six-faced solid from 8 LOCAL corners: bottom four then top four, each
    ring in the same winding. For sloped roofs, raked walls, folded plates."""
    bm = bmesh.new()
    vs = [bm.verts.new(B_(*c)) for c in corners]
    b0, b1, b2, b3, t0, t1, t2, t3 = vs
    for f in ((b0, b3, b2, b1), (t0, t1, t2, t3), (b0, b1, t1, t0),
              (b1, b2, t2, t1), (b2, b3, t3, t2), (b3, b0, t0, t3)):
        try:
            bm.faces.new(f)
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _auto_uv(L.from_bmesh(name, bm, (0, 0, 0), mat))


def cyl_y(name, r, x, y0, y1, z, mat, n=16):
    """A vertical (local-y) cylinder."""
    return L.cyl(name, r, y1 - y0, B_(x, (y0 + y1) / 2, z), mat, n=n)


def world_uv(o, tile=2.4, rot=False, layer=None, du=0.0, dv=0.0):
    """Planar art UV in METRES (u, v = coordinate / tile), per face along its
    dominant normal, so a tiling photograph keeps one scale across every part
    and the vertical axis is always v (rain streaks run down, boards run down).
    `rot` swaps u/v on horizontal faces (boards along local x instead of z).
    `du, dv` shift the picture (in tiles) — one random shift per standing-seam
    PANEL, so each panel weathers differently and a 2.4 m tile never repeats
    its blotches in a grid across a 24 m wall (the first in-engine look did)."""
    layer = layer or L.ART_UV
    me = o.data
    uvl, was = L._art_layer(me, layer)
    bpy.context.view_layer.update()          # a fresh primitive's matrix_world is stale
    mw = o.matrix_world
    nm = mw.to_3x3().inverted_safe().transposed()
    for p in me.polygons:
        n = nm @ p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 2:        # horizontal face (soffit / roof)
                u, v = (w.y, w.x) if rot else (w.x, w.y)
            elif ax == 0:      # faces ±Blender x (= ±local x): along z, up y
                u, v = w.y, w.z
            else:              # faces ±Blender y (= ±local z): along x, up y
                u, v = w.x, w.z
            uvl.data[li].uv = (u / tile + du, v / tile + dv)
    L._restore_active(me, was)
    return o


def seams_along_z(parts, x_face, out, y0, y1, z0, z1, pitch, mat, w=0.045, d=0.05,
                  top=None, prefix="seam"):
    """Standing seams (battens) on a wall whose face is the plane x = x_face,
    `out` = +1 / −1 the outward direction. Evenly spaced over [z0, z1] at about
    `pitch`. `top(z)` optionally gives a sloped top."""
    n = max(1, round((z1 - z0) / pitch))
    for i in range(1, n):
        z = z0 + (z1 - z0) * i / n
        t = top(z) if top else y1
        xa, xb = (x_face, x_face + out * d) if out > 0 else (x_face + out * d, x_face)
        parts.append(box(f"{prefix}{i}", xa, xb, y0, t, z - w / 2, z + w / 2, mat))


def seams_along_x(parts, z_face, out, y0, y1, x0, x1, pitch, mat, w=0.045, d=0.05,
                  top=None, prefix="seam"):
    n = max(1, round((x1 - x0) / pitch))
    for i in range(1, n):
        x = x0 + (x1 - x0) * i / n
        t = top(x) if top else y1
        za, zb = (z_face, z_face + out * d) if out > 0 else (z_face + out * d, z_face)
        parts.append(box(f"{prefix}{i}", x - w / 2, x + w / 2, y0, t, za, zb, mat))


def spans(a, b, maxlen=5.0):
    """Split [a, b] into equal pieces no longer than `maxlen`.

    ⚠ WHY: the atlas pack scales every island by ONE factor, so the LONGEST
    island caps the texel density of the whole GLB — a 24 m skin fits the atlas
    at 85 px/m however little else there is (arrival_shell's first bake left
    half its 2048 atlas black for exactly this reason). Long faces are built in
    pieces; the world-scale art UV keeps the photograph continuous across them."""
    n = max(1, math.ceil((b - a) / maxlen - 1e-9))
    return [(a + (b - a) * i / n, a + (b - a) * (i + 1) / n) for i in range(n)]


def seam_positions(a, b, pitch):
    """The seam coordinates a face of [a, b] carries (the same formula the
    seams are laid with, so panel cuts land exactly under them)."""
    n = max(1, round((b - a) / pitch))
    return [a + (b - a) * i / n for i in range(1, n)]


def panels(a, b, seams):
    """[a, b] cut at every seam strictly inside it."""
    cs = [a] + [c for c in seams if a + 1e-6 < c < b - 1e-6] + [b]
    return list(zip(cs, cs[1:]))
