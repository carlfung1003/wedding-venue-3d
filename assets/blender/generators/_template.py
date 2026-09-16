"""_template — a commented starter generator. Copy it to generators/<name>.py.

Files starting with `_` are skipped by make_masters.py, so this one never builds.

Read assets/blender/ASSET_SPEC.md first: your asset's row there gives the real
dimensions, the origin, which way is front, the palette keys and the triangle
budget. Honour the row and the GLB is a drop-in for the procedural prop.

Frame: Blender Z-up. The FRONT (what a guest looks at in the render) faces
Blender +Y — that becomes glTF -Z, which is how moments.js authors its props.
The chair family is the one exception (FRONT = "+Z" → model it facing -Y).
"""
import wv_lib as L

NAME = "_template"        # the asset name: masters/<NAME>.blend -> assets/models/<NAME>.glb
ATLAS = 256               # 256 for small props, 512 for furniture, 1024 for hero florals
BEVEL = 0.004             # edge bevel in metres; 0 on cloth, florals and beads (bevels ~4× faces)
AO_DIST = 0.5             # 0.15 for anything with an enclosed interior (shelves, a booth)
AO_STRENGTH = 0.5
TRIS = 1200               # the spec's budget — export_all.py FAILS the asset if exceeded
FRONT = "-Z"              # or "+Z" for the chair family
ORIGIN = "floor"          # "floor" | "hook" | "base" — recorded in the sidecar for the game
# MAT_NAME = "crystal"    # optional: force the exported material's name (loader keys on
                          # `*_emit`, `mirror`, `canopy_tint`, `crystal`); otherwise the
                          # sole palette key, or NAME when several keys are mixed


def build():
    rnd = L.rng(NAME)                     # deterministic: same name, same asset
    parts = []

    # Primitives take (name, size/radius, position=CENTRE, palette key). Position is
    # the part's centre, so a 1 m post standing on the floor is at z = 0.5.
    parts.append(L.box("body", (0.30, 0.30, 1.0), (0, 0, 0.5), "paint_w"))
    parts.append(L.cyl("post", 0.02, 0.6, (0, 0.2, 1.3), "oak_d", n=12))
    parts.append(L.strut("rail", (-0.15, 0.2, 1.0), (0.15, 0.2, 1.0), 0.01, "steel"))

    # Per-part bevel when the module BEVEL would over-bevel something else
    # (the whole joined mesh is bevelled at angle ≥ 40° when BEVEL > 0):
    #   L.bevel([parts[0]], width=0.006)
    # Image-mapped parts (blooms, straw, foil) — a SECOND uv layer that the atlas
    # unwrap leaves alone; a missing texture falls back to the flat palette key:
    #   head = L.uv_sphere("head", 0.06, (0, 0, 1.2), L.image_mat("hydrangea", "hydrangea_head.webp"))
    #   L.spherical_uv(head)
    # Cloth folds: L.displace_noise(skirt, strength=0.012, scale=4, seed=7, subdiv=2)
    # Jitter: L.jitter(petal, 0.004, rnd)

    # ONE mesh, re-origined: "floor" = footprint centre on the ground (default),
    # "hook" = the top for hanging things, None + L.origin_to(o, p) for anything else.
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)        # optional; keeps sharp edges above 35°
    return root


# A part that needs its OWN material class (emissive, tintable, mirror) is a second
# asset named <NAME>_<suffix>, same origin, built by a build_<suffix>() function:
#
# def build_facia():
#     panel = L.box("facia", (2.2, 0.02, 0.5), (0, -0.41, 0.70), "facia_emit")
#     return L.join([panel], NAME + "_facia", origin=None)   # keep the parent's frame
