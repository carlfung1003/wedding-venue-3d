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
                " CY: m.ARRIVAL_LOUNGE_CEIL, XS: m.SITE.EXT_STAIR,"
                " AT: m.SITE.ATRIUM, RD: m.ROOM_DOORS, AD: m.ARRIVAL_ATRIUM_DOOR,"
                " VD: m.SITE.VILLA.doorClear, SU: m.SITE.SUITE, AD2: m.ARRIVAL_ATRIUM_DOOR,"
                " DK: m.SITE.DECK}));")
        out = subprocess.run([_node(), "--input-type=module", "-e", code],
                             capture_output=True, text=True, check=True)
        _SITE = json.loads(out.stdout.strip().splitlines()[-1])
    return _SITE


_FRAME = "arrival"


def anchor():
    """The shared origin of the current FRAME. Wave A's is the arrival anchor
    (33, 0, −8); wave B's atrium GLBs use `with frame("atrium"):` → the atrium
    centre (SITE.ATRIUM.cx, 0, SITE.ATRIUM.cz) = (8, 0, −41). The context
    manager restores the frame, so a batch run that builds an atrium GLB and
    then an arrival one cannot hand the second the first's origin."""
    if _FRAME == "local":          # an instanced MODULE GLB: glTF-local = the frame
        return (0.0, 0.0, 0.0)
    if _FRAME == "atrium":
        AT = site()["AT"]
        return (AT["cx"], 0.0, AT["cz"])
    if _FRAME == "suite":          # wave C: the presidential suite's centre
        SU = site()["SU"]
        return (SU["cx"], 0.0, SU["cz"])
    AR = site()["AR"]
    return (AR["backX"], 0.0, AR["axisZ"])


class frame:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        global _FRAME
        self.was, _FRAME = _FRAME, self.name
        return self

    def __exit__(self, *a):
        global _FRAME
        _FRAME = self.was
        return False


def atrium():
    """SITE.ATRIUM plus the derived numbers atrium.js computes from it, in ONE
    place, with the same arithmetic (see the matching consts at the top of
    js/atrium.js — a change there must be mirrored here)."""
    T = dict(site()["AT"])
    T["X0"], T["X1"] = T["cx"] - T["w"] / 2, T["cx"] + T["w"] / 2
    T["Z0"], T["Z1"] = T["cz"] - T["d"] / 2, T["cz"] + T["d"] / 2
    T["CX0"], T["CX1"] = T["cx"] - T["courtW"] / 2, T["cx"] + T["courtW"] / 2
    T["CZ0"], T["CZ1"] = T["cz"] - T["courtD"] / 2, T["cz"] + T["courtD"] / 2
    T["H1"] = T["floorH"]
    T["H2"] = T["floorH"] * T["floors"]
    T["SLAB"] = 0.35
    T["SOF1"], T["SOF2"] = T["H1"] - 0.35, T["H2"] - 0.35
    st = T["stair"]
    S = {"x": st["x"], "w": 1.6, "risers": 16, "rise": T["H1"] / 16, "going": 0.45,
         "zFoot": st["z"] + 3.1}
    S["zTop"] = S["zFoot"] - S["risers"] * S["going"]
    S["angle"] = math.atan2(T["H1"], S["risers"] * S["going"])
    T["STAIR"] = S
    T["WELL"] = {"x0": S["x"] - 1.0, "x1": T["CX0"], "z0": S["zTop"], "z1": -42.5}
    return T


def suite():
    """SITE.SUITE plus the derived numbers js/suite.js computes from it, in ONE
    place, with the same arithmetic (the consts at the top of suite.js — a
    change there must be mirrored here). ⚠ Everything returned is in SITE
    (mirror-CORRECTED) coordinates: suite.js authors in the reversed brief
    frame and reflects X through mx(); these GLBs are authored straight in
    SITE and placed WITHOUT the mirror, so an asymmetric element (the closed
    leaf run, the leaf stack, the 2F link door, the annex) is negated here
    exactly once, where it is read."""
    S = dict(site()["SU"])
    mx = lambda x: -x
    S["X0"], S["X1"] = S["cx"] - S["w"] / 2, S["cx"] + S["w"] / 2     # -8, 8 (symmetric)
    S["ZS"] = S["glassWallZ"]                                          # -13.5
    S["ZN"] = S["ZS"] - S["d"]                                         # -26.5
    S["H1"], S["YF2"], S["H2"] = S["floorH"], S["floorToFloor"], S["floor2H"]
    S["Y2C"] = S["YF2"] + S["H2"]                                      # 6.8
    S["OVER_N"] = S["roofOverhang"]
    S["OVER_E"] = S["roofOverhang"] * 1.30
    S["OVER_S"] = S["roofOverhang"] * 1.55
    S["ROOF_T"], S["FASCIA_H"] = 0.72, 0.58
    S["EWT"] = 0.36
    S["RX0"], S["RX1"] = S["X0"] - S["OVER_E"], S["X1"] + S["OVER_E"]
    S["RZ0"], S["RZ1"] = S["ZN"] - S["OVER_N"], S["ZS"] + S["OVER_S"]
    S["balZ"] = S["ZS"] + S["balconyD"]                                # -11.5
    # the folding wall (suite.js GW) — authored-frame numbers, then reflected
    gx0, gx1 = -S["glassWallW"] / 2, S["glassWallW"] / 2
    S["GW"] = {"x0": gx0, "x1": gx1, "leafW": S["leafW"], "leafH": S["leafH"],
               # closed run: authoring x0 … closedX1 (−7 … −3.2) → SITE 3.2 … 7
               "closed": sorted((mx(gx0), mx(-3.2))),
               # stack post: authoring stackX0 + 8·dx … + .1 → SITE
               "stackX0": mx(6.2)}
    # the east annex of the brief = SITE WEST (spa + corridor), reflected
    spa = S["spa"]
    anx0 = S["X1"]                                   # authoring 8
    anx1 = -spa["cx"] + spa["w"] / 2                 # authoring 14 (SITE spa.cx is −10.5)
    cor1 = anx0 + S["corridorW"] + .3                # authoring 9.9
    spa_zs = spa["cz"] + spa["d"] / 2                # −19.5
    cor_zs = spa_zs + 2.5                            # −17.0
    S["ANX"] = {"roofA": (sorted((mx(anx0), mx(anx1 + 1.2))), (S["ZN"] - 1.2, spa_zs + 1.0)),
                "roofB": (sorted((mx(anx0), mx(cor1 + 1.0))), (spa_zs + 1.0, cor_zs + 1.0)),
                "H2": S["H2"]}
    # the 2F door onto the clubhouse walkway: authoring X0 (−8) → SITE +8
    S["LINK"] = dict(site()["AR"]["SUITE_DOOR"], x=mx(S["X0"]))
    return S


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
    "ar_stone":    ("3a3532", "stone",   0.30),   # warm polished charcoal stair (wave A2)
    "ar_stone_l":  ("77706a", "stone",   0.30),   # the honed nosing edge / anti-slip strip
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
    # ── KAN-211 wave B: the atrium (clubhouse-atrium.jpeg, measured) ──
    "at_col":      ("262528", "stone",   0.35),   # honed near-black column cladding
    "at_col_b":    ("1c1b1d", "stone",   0.35),   # plinth / capital, a shade darker
    "at_wood0":    ("5a2a17", "wood",    0.45),   # soffit boards — six tones (v2 ×0.8 + redder: the v1
    "at_wood1":    ("652f1a", "wood",    0.45),   #   bake rendered (95,64,54) against the photo's shade
    "at_wood2":    ("522614", "wood",    0.45),   #   (55..70, 31..42, 21..35) / lit
    "at_wood3":    ("60301c", "wood",    0.45),   #   (101, 71, 64)
    "at_wood4":    ("562816", "wood",    0.45),
    "at_wood5":    ("6a341d", "wood",    0.45),
    "at_beam":     ("1f1f21", "paint",   0.55),   # the dark edge beams / fascias
    "at_granite":  ("4b4d50", "stone",   0.25),   # pond edging cladding tiles
    "at_granite_b": ("434548", "stone",  0.25),
    "at_coping":   ("575a5d", "stone",   0.25),   # the polished coping slabs
    "at_joint":    ("151617", "paint",   0.80),   # tile / slab joints
    "at_steel":    ("2b2e31", "metal_p", 0.40),   # stringers, shoes, channels
    "at_inox":     ("9ea3a8", "metal_p", 0.30),   # stainless posts + glass clamps
    "at_copper":   ("b0643a", "metal_p", 0.30),   # the copper cap rail
    "at_door":     ("4e2c1e", "wood",    0.50),   # guest-room door leaves
    "at_batten":   ("8a4b2c", "wood",    0.60),   # the timber screens' battens
    "at_black":    ("121214", "paint",   0.50),   # downlight bezels, reveals
    # ── KAN-211 wave C: the presidential suite (pimg-002 = the hotel deck's p3
    #    elevation across the pool, measured; IMG_8096 for the leaf frames) ──
    "su_stone0":   ("423834", "stone",   0.55),   # the corner piers' warm taupe stone panels —
    "su_stone1":   ("3c3332", "stone",   0.55),   #   photo pier face (107,92,82); ×~.53 linear after the first render read (145,124,105)
    "su_stone2":   ("483e3a", "stone",   0.55),
    "su_band":     ("8c7f76", "paint",   0.45),   # balcony slab-edge panels — photo (158..184,140..164,129..153); render now (181,160,140)
    "su_band_d":   ("3b3632", "paint",   0.50),   # the band's drip reveal / shadow line
    "su_alu":      ("8f887f", "metal_p", 0.40),   # 2F frames + louvres, warm light grey
    "su_roof":     ("55585c", "metal_p", 0.50),   # standing-seam roof skin (pimg-001, grey)
    "su_seam":     ("46494d", "metal_p", 0.50),
    "su_joint":    ("1b1918", "paint",   0.80),   # cassette / panel joints, backing
    "su_sapele":   ("5e2c1f", "wood",    0.45),   # the folding leaves' red-brown frames (IMG_8096)
    "su_sapele_d": ("3f1d15", "wood",    0.45),
    "su_brass":    ("8a6b3f", "metal_p", 0.35),   # leaf pulls, hinge knuckles
    "su_cap":      ("7e4a30", "wood",    0.45),   # the balustrade's flat copper-timber cap (190,145,125 lit)
    "su_shoe":     ("2a2826", "metal_p", 0.45),   # glass shoe channel
    "su_wicker":   ("e6e1d6", "straw",   0.70),   # white wicker dining set (p5)
    "su_cushion":  ("f1eee6", "linen",   0.80),
    "su_top":      ("efece5", "paint",   0.35),   # the table top
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


def corten_dark(name="corten_seam"):
    """The standing seams: the same patina darkened to the shadowed reveal
    (corten_dark.webp = corten_weathered.webp × 0.30 in linear light, derived
    locally) so every seam reads as a CRISP dark vertical line, as f_001's do."""
    return L.image_mat(name, "corten_dark.webp", roughness=0.75, fallback="ar_corten_d")


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


# ---------------------------------------------------------------- wave C helpers
def copper(name="copper"):
    """The suite fascia's copper cassettes (copper_cassette.webp, generated for
    wave C). Separate NAMES for faces that should get fewer atlas texels."""
    return L.image_mat(name, "copper_cassette.webp", roughness=0.5, fallback="at_copper")


def soffit_teak(name="soffit"):
    """The suite's DARK timber soffit. ⚠ DERIVED, not generated:
    cedar_soffit.webp re-balanced per channel in LINEAR light to a mean of
    (86, 58, 46) — pimg-002's shaded soffit reads (39, 28, 26) and the render
    lifts a texture, so the picture sits between the two (numpy, see
    ASSET_SPEC Group M). Boards run down v = along local z (N–S)."""
    return L.image_mat(name, "soffit_teak.webp", roughness=0.8, fallback="at_wood2")


def cassettes(parts, rnd, side, a0, a1, fixed, y0, y1, out, mat, back, pitch=0.62,
              joint=0.016, proud=0.022, back_t=0.03, prefix="cas", tile=1.2):
    """A band of flat metal CASSETTE panels on a dark backing — the copper
    fascia of pimg-002. `side` 'x' → the band runs along x on the plane
    z = fixed; 'z' → along z on the plane x = fixed. `out` = ±1 is the
    outward normal along the fixed axis. The backing sits on [fixed, fixed +
    out·back_t], the panels proud of it by `proud`. Each panel takes its own
    random UV shift, so each reads as its own sheet (wave A lesson 3)."""
    n = max(1, round((a1 - a0) / pitch))
    step = (a1 - a0) / n
    f0, f1 = fixed, fixed + out * back_t
    p0, p1 = f1, f1 + out * proud
    for k, (ba, bb) in enumerate(spans(a0, a1, 5.0)):
        if side == 'x':
            parts.append(box(f"{prefix}_bk{k}", ba, bb, y0, y1, f0, f1, back))
        else:
            parts.append(box(f"{prefix}_bk{k}", f0, f1, y0, y1, ba, bb, back))
    for i in range(n):
        ca, cb = a0 + i * step + joint / 2, a0 + (i + 1) * step - joint / 2
        ya, yb = y0 + joint / 2, y1 - joint / 2
        if side == 'x':
            o = box(f"{prefix}{i}", ca, cb, ya, yb, p0, p1, mat)
        else:
            o = box(f"{prefix}{i}", p0, p1, ya, yb, ca, cb, mat)
        world_uv(o, tile=tile, du=rnd(), dv=rnd())
        parts.append(o)
