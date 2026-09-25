"""atrium_soffit_panel — one 0.8 m module of the atrium's timber soffit: EIGHT
real boards (KAN-211 wave B; clubhouse-atrium.jpeg — the dominant surface).

The photo's ceiling is narrow reddish mahogany boards running ACROSS the
gallery (toward the court), a fine dark shadow joint between each, a satin
finish that catches the light, round black downlights let into it. The old
build painted planks onto a slab's underside; this hangs real boards.

Module frame (glTF): boards run along local Z over [−1, +1] (2.0 m, the game
scales z to the gallery depth — grain runs along the board, so the stretch is
along the grain), eight boards across local X over [−0.4, +0.4] (92 mm face,
8 mm joint), top face at y = 0, hanging to y = −BOARD. atrium.js places the
modules edge to edge at the soffit plane (SOF1 / SOF2), x-scaled by ≤ ±5 % to
fit each run exactly, and turns every other one 180° so the eight tones read
as sixteen. Each board is its own palette key (six mahogany tones, baked with
the wood family's grain) — the photo's board-to-board variation.
The slab's own underside above the joints becomes a dark backing (atrium.js).
"""
import wv_lib as L
import _arch as A

NAME = "atrium_soffit_panel"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.03
AO_STRENGTH = 0.6
TRIS = 100
FRONT = "-Z"
ORIGIN = "top"

BOARD = 0.022
N = 8
W = 0.8
FACE = 0.092
TONES = ["at_wood2", "at_wood5", "at_wood0", "at_wood3", "at_wood1", "at_wood4", "at_wood0", "at_wood3"]


def _board(bm, xc, key_idx):
    """a board as ONE chamfered profile extruded along z (no end caps, no top:
    both hidden) — 10 tris, where a bevelled box was 44"""
    f, c = FACE / 2, 0.003
    prof = [(xc - f, 0.0), (xc - f, -BOARD + c), (xc - f + c, -BOARD),
            (xc + f - c, -BOARD), (xc + f, -BOARD + c), (xc + f, 0.0)]
    # glTF (x, y, z) -> Blender (x, -z, y)
    a = [bm.verts.new((x, 1.0, y)) for (x, y) in prof]      # z = -1
    b = [bm.verts.new((x, -1.0, y)) for (x, y) in prof]     # z = +1
    faces = []
    for i in range(len(prof) - 1):
        faces.append(bm.faces.new((a[i], a[i + 1], b[i + 1], b[i])))
    for fc in faces:
        fc.material_index = key_idx
    return faces


def build():
    import bmesh
    keys = sorted(set(TONES))
    bm = bmesh.new()
    pitch = W / N
    for i in range(N):
        _board(bm, -W / 2 + (i + 0.5) * pitch, keys.index(TONES[i]))
    o = L.from_bmesh("boards", bm, (0, 0, 0), keys[0])
    # faces must point away from the board's inside (down / sideways)
    me = o.data
    for p in me.polygons:
        cx = sum(me.vertices[v].co.x for v in p.vertices) / len(p.vertices)
        cz = sum(me.vertices[v].co.z for v in p.vertices) / len(p.vertices)
        bx = -W / 2 + (int((cx + W / 2) / pitch) + 0.5) * pitch
        want = (cx - bx, 0.0, cz + BOARD / 2)
        if p.normal.x * want[0] + p.normal.z * want[2] < 0:
            p.flip()
    o.data.materials.clear()
    for k in keys:
        o.data.materials.append(L.M(k))
    return L.join([o], NAME, origin=None)
