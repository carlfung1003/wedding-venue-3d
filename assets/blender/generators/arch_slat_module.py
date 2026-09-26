"""arch_slat_module — ONE 0.6 m module of the check-in lobby's and the 酒廊's
dark timber SLAT CEILING (KAN-211 wave D), instanced by campus.js.

The entrance video's lobby frames (clubhouse-entrance-parking-frames f_016 …
f_024, and compare-checkin-lobby's 61.png) show a dark mahogany ceiling over
the cream sofas; both rooms were a single canvas-mapped box (MAT.slatCeil,
texSlat retiled 26 × 3) — a flat printed plane. This hangs real slats with
real open joints (and closed ends) over a black backing (the game keeps the box as that
backing, in MAT.dark), so the ceiling has depth, shadow lines and a grain.

Module frame (glTF, "local"): slats run along local Z over [−1, +1] (2.0 m;
the game scales z to its row length — along the grain), FIVE slats across
local X over [−0.3, +0.3] (70 mm face, 50 mm open joint), top face at y = 0,
hanging to y = −DEPTH. Each slat its own tone (four dark mahogany keys); the
game turns every other row 180° so the five tones read as ten.
A slat is ONE chamfered profile extruded along z (no top — hidden): 10 tris + 8 for its two end caps, the atrium_soffit_panel recipe
(Group L lesson 2).
"""
import wv_lib as L
import _arch as A

NAME = "arch_slat_module"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.04
AO_STRENGTH = 0.6
TRIS = 90
FRONT = "-Z"
ORIGIN = "top"

DEPTH = 0.045
N = 5
W = 0.6
FACE = 0.07
TONES = ["wd_slat", "wd_slat2", "wd_slat1", "wd_slat3", "wd_slat2"]


def _slat(bm, xc, key_idx):
    f, c = FACE / 2, 0.004
    prof = [(xc - f, 0.0), (xc - f, -DEPTH + c), (xc - f + c, -DEPTH),
            (xc + f - c, -DEPTH), (xc + f, -DEPTH + c), (xc + f, 0.0)]
    a = [bm.verts.new((x, 1.0, y)) for (x, y) in prof]      # glTF z = −1
    b = [bm.verts.new((x, -1.0, y)) for (x, y) in prof]     # glTF z = +1
    for i in range(len(prof) - 1):
        bm.faces.new((a[i], a[i + 1], b[i + 1], b[i])).material_index = key_idx
    # END CAPS (wave D, after the first look): the game butts rows end to end,
    # and an open-ended profile showed the black backing through every joint
    # as a sawtooth down the ceiling. 8 tris a slat.
    bm.faces.new(a).material_index = key_idx
    bm.faces.new(list(reversed(b))).material_index = key_idx


def build():
    import bmesh
    keys = sorted(set(TONES))
    bm = bmesh.new()
    pitch = W / N
    for i in range(N):
        _slat(bm, -W / 2 + (i + 0.5) * pitch, keys.index(TONES[i]))
    o = L.from_bmesh("slats", bm, (0, 0, 0), keys[0])
    me = o.data
    for p in me.polygons:
        cx = sum(me.vertices[v].co.x for v in p.vertices) / len(p.vertices)
        cy = sum(me.vertices[v].co.y for v in p.vertices) / len(p.vertices)
        cz = sum(me.vertices[v].co.z for v in p.vertices) / len(p.vertices)
        bx = -W / 2 + (int((cx + W / 2) / pitch) + 0.5) * pitch
        want = (cx - bx, cy, cz + DEPTH / 2)
        if p.normal.x * want[0] + p.normal.y * want[1] + p.normal.z * want[2] < 0:
            p.flip()
    o.data.materials.clear()
    for k in keys:
        o.data.materials.append(L.M(k))
    return L.join([o], NAME, origin=None)
