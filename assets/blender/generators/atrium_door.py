"""atrium_door — the portal of a REAL guest-room door on the atrium gallery
(KAN-211 wave B). One prototype, twelve instances: the ten keys' ground-floor
doors and the two 3-BR keys' upper ones (buildRoomDoor in atrium.js).

Door frame (the one buildRoomDoor already works in): origin at the centre of
the hole the facade cut, at the storey's floor; +X ALONG the wall, +Z OUTWARD
into the room; the gallery wall's court face is z = 0, its room face z = 0.30.
Authored for the south/north walls' bay (44 / 15 = 2.933 m); the west/east
walls' 26 / 9 = 2.889 m bay takes an x-scale of 0.985 (invisible).

What is modelled (a hotel room entry in the atrium's own language — the
columns' honed black stone, the bronze of the facade, the soffit's timber):
  · two STONE PIERS narrowing the bay to the clear opening (2.0 m), laid in
    0.9 m courses like the columns, 0.15 m proud of the wall both sides
  · a stone LINTEL from the door head (H1 − 0.95) to the slab
  · a projecting ARCHITRAVE (100 mm, 30 mm proud) round the opening, gallery side
  · a bronze CASING lining the reveal (jambs + head)
  · a honed stone SILL
  · the two TIMBER LEAVES standing open into the room against the reveals
    (where the glass leaves stood — an open door reads as a way through),
    each with a bronze pull bar
  · the bronze PLAQUE PLATE on the right pier's gallery face at y 1.55 — the
    game's lit number plane now stands 3 mm proud of it (it used to sit
    0.10 m INSIDE the pier, where nobody could read it)
Visual only: the collider gap is atrium.js's, cut from the same hole.
"""
import wv_lib as L
import _arch as A

NAME = "atrium_door"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.3
AO_STRENGTH = 0.5
TRIS = 2400
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"at_joint": 0.05}

ALONG = 44 / 15          # the N/S bay the prototype is authored for
WALL_T = 0.30


def build():
    T = A.atrium()
    H1 = T["H1"]
    C = min(A.site()["VD"], ALONG - 0.7)        # clear opening, = DOOR_CLEAR
    P = (ALONG - C) / 2                          # pier width
    DH = H1 - 0.95                               # door head
    z0, z1 = -0.15, WALL_T + 0.15                # pier depth (as buildRoomDoor)
    parts = []
    with A.frame("local"):
        for s in (-1, 1):
            xa, xb = sorted((s * C / 2, s * ALONG / 2))
            parts.append(A.box(f"pcore{s}", xa + 0.006, xb - 0.006, 0.0, H1, z0 + 0.006, z1 - 0.006, "at_joint"))
            n = 4
            for i in range(n):
                ya = (DH + 0.1) * i / n
                yb = (DH + 0.1) * (i + 1) / n - 0.008
                c = A.box(f"pier{s}_{i}", xa, xb, ya, yb, z0, z1, "at_col")
                L.bevel([c], width=0.005, segments=1)
                parts.append(c)
            # the architrave jamb, gallery side
            ja, jb = sorted((s * C / 2, s * (C / 2 + 0.10)))
            j = A.box(f"arch{s}", ja, jb, 0.0, DH + 0.10, z0 - 0.03, z0, "at_col_b")
            L.bevel([j], width=0.006, segments=1)
            parts.append(j)
            # bronze casing on the reveal
            ca, cb = sorted((s * C / 2, s * (C / 2 - 0.04)))
            parts.append(A.box(f"case{s}", ca, cb, 0.0, DH, z0, z1, "ar_bronze"))
            # the open timber leaf, into the room against the reveal
            lw = C / 2 - 0.08
            la, lb = sorted((s * (C / 2 - 0.045), s * (C / 2 - 0.09)))
            lf = A.box(f"leaf{s}", la, lb, 0.02, DH - 0.06, WALL_T + 0.06, WALL_T + 0.06 + lw, "at_door")
            L.bevel([lf], width=0.004, segments=1)
            parts.append(lf)
            # pull bar on the leaf's corridor-facing side
            px = s * (C / 2 - 0.10)
            parts.append(A.box(f"pull{s}", px - 0.012, px + 0.012, 0.85, 1.55,
                               WALL_T + 0.06 + lw - 0.12, WALL_T + 0.06 + lw - 0.09, "ar_bronze"))
        # lintel over the opening, courses split at the head
        lt = A.box("lintel", -ALONG / 2, ALONG / 2, DH + 0.1, H1, z0, z1, "at_col")
        L.bevel([lt], width=0.005, segments=1)
        parts.append(lt)
        parts.append(A.box("lcore", -C / 2, C / 2, DH, DH + 0.1, z0 + 0.006, z1 - 0.006, "at_col_b"))
        hd = A.box("arch_head", -(C / 2 + 0.10), C / 2 + 0.10, DH, DH + 0.10, z0 - 0.03, z0, "at_col_b")
        L.bevel([hd], width=0.006, segments=1)
        parts.append(hd)
        parts.append(A.box("case_head", -C / 2, C / 2, DH - 0.04, DH, z0, z1, "ar_bronze"))
        sill = A.box("sill", -(C / 2 + 0.15), C / 2 + 0.15, 0.0, 0.05, z0 - 0.04, z1, "at_col_b")
        L.bevel([sill], width=0.008, segments=1)
        parts.append(sill)
        # the plaque plate: right pier (+x), gallery face
        pc = ALONG / 2 - P / 2
        plate = A.box("plate", pc - 0.17, pc + 0.17, 1.55 - 0.13, 1.55 + 0.13, z0 - 0.012, z0, "ar_bronze")
        L.bevel([plate], width=0.004, segments=1)
        parts.append(plate)
        parts.append(A.box("plate_in", pc - 0.14, pc + 0.14, 1.55 - 0.105, 1.55 + 0.105,
                           z0 - 0.013, z0 - 0.012, "at_black"))
        return L.join(parts, NAME, origin=None)
