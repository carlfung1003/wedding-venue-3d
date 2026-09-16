"""masters/<name>.blend -> ../models/<name>.glb (Draco, WebP) + <name>.meta.json,
then REBUILD ../models/models.json from every sidecar present.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python assets/blender/export_all.py -- [names...]

Why a sidecar per asset: four agents export concurrently. Each writes only its own
<name>.meta.json, and the manifest is regenerated from ALL sidecars on every run, so
the last writer still produces a complete models.json and nobody clobbers anybody.

Sidecar = {bytes, tris, size:[x,y,z], min:[x,y,z], front:"-Z"|"+Z",
           origin:"floor"|"hook"|"base"}  — size/min in glTF Y-up metres.

Fails loudly (exit 1) when a GLB exceeds the generator's TRIS budget, or is not
exactly one mesh / one primitive / one material.
"""
import sys, os, json, time, struct

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from mathutils import Vector

MASTERS = os.path.join(HERE, "masters")
MODELS = os.path.normpath(os.path.join(HERE, "..", "models"))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opts = dict(a.split("=", 1) for a in args if "=" in a)
names = [a for a in args if "=" not in a] or sorted(
    f[:-6] for f in os.listdir(MASTERS) if f.endswith(".blend"))
os.makedirs(MODELS, exist_ok=True)


def find_root(name):
    o = bpy.data.objects.get(name)
    if o is None:
        o = next((x for x in bpy.data.objects if x.get("wv_asset") == name), None)
    assert o is not None, f"{name}.blend: no object named {name!r} (or tagged wv_asset)"
    return o


def bounds(root):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c)
           for o in [root, *root.children_recursive] if o.type == 'MESH' for c in o.bound_box]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    return lo, hi


def glb_json(path):
    b = open(path, "rb").read()
    magic, ver, length = struct.unpack_from("<4sII", b, 0)
    assert magic == b"glTF" and length == len(b), f"{path}: not a GLB"
    clen, ctype = struct.unpack_from("<II", b, 12)
    return json.loads(b[20:20 + clen])


failures = []
total = 0
t0 = time.time()
for name in names:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(MASTERS, name + ".blend"))
    root = find_root(name)
    meshes = [o for o in [root, *root.children_recursive] if o.type == 'MESH']
    mats = {s.material.name for o in meshes for s in o.material_slots if s.material}
    if len(meshes) != 1 or len(mats) != 1:
        failures.append(f"{name}: master has {len(meshes)} meshes / {len(mats)} materials — one of each")
        print("FAIL", failures[-1])
        continue
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for c in root.children_recursive:
        c.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = os.path.join(MODELS, name + ".glb")
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
              export_yup=True, export_texcoords=True, export_normals=True,
              export_animations=False, export_skins=False, export_morph=False,
              export_draco_mesh_compression_enable=True,
              export_draco_mesh_compression_level=6,
              export_draco_position_quantization=13,
              export_draco_normal_quantization=9,
              export_draco_texcoord_quantization=11)
    try:
        bpy.ops.export_scene.gltf(**kw, export_image_format='WEBP', export_image_quality=80)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_image_format='JPEG', export_jpeg_quality=82)

    j = glb_json(path)
    n_mesh = len(j.get("meshes", []))
    n_prim = sum(len(m["primitives"]) for m in j.get("meshes", []))
    n_mat = len(j.get("materials", []))
    if (n_mesh, n_prim, n_mat) != (1, 1, 1):
        failures.append(f"{name}.glb: {n_mesh} meshes / {n_prim} primitives / {n_mat} materials — "
                        f"must be 1/1/1 (split with build_<suffix>())")
        print("FAIL", failures[-1])

    lo, hi = bounds(root)
    tris = sum(len(p.vertices) - 2 for o in meshes for p in o.data.polygons)
    size = os.path.getsize(path)
    total += size
    budget = root.get("wv_tris")
    if budget and tris > budget:
        failures.append(f"{name}: {tris} tris exceeds the generator's TRIS budget of {budget}")
        print("FAIL", failures[-1])
    # Blender is Z-up, the GLB is Y-up: report dims the way Three.js will see them.
    meta = {
        "bytes": size, "tris": tris,
        "size": [round(hi[0] - lo[0], 3), round(hi[2] - lo[2], 3), round(hi[1] - lo[1], 3)],
        "min": [round(lo[0], 3), round(lo[2], 3), round(-hi[1], 3)],
        "front": root.get("wv_front", "-Z"),
        "origin": root.get("wv_origin", "floor"),
        "material": j["materials"][0]["name"] if n_mat else None,
    }
    json.dump(meta, open(os.path.join(MODELS, name + ".meta.json"), "w"), indent=2, sort_keys=True)
    print(f"GLB  {name:24s} {size//1024:5d} KB  tris {tris:6d}"
          f"{'/' + str(budget) if budget else ''}  size {meta['size']}  "
          f"front {meta['front']} origin {meta['origin']} mat '{meta['material']}'")

# --- rebuild the manifest from EVERY sidecar, not just this run's --------------
manifest = {}
for f in sorted(os.listdir(MODELS)):
    if f.endswith(".meta.json"):
        n = f[:-len(".meta.json")]
        if os.path.exists(os.path.join(MODELS, n + ".glb")):
            manifest[n] = json.load(open(os.path.join(MODELS, f)))
        else:
            print(f"WARN {f} has no {n}.glb beside it — skipped")
manifest_path = os.path.join(MODELS, "models.json")
json.dump(manifest, open(manifest_path, "w"), indent=2, sort_keys=True)
print(f"\nEXPORTED {len(names)} models, {total/1048576:.2f} MB total, {time.time()-t0:.0f}s")
print("MANIFEST", manifest_path, len(manifest), "entries")
if failures:
    print(f"\n{len(failures)} FAILURE(S):")
    for f in failures:
        print("  ", f)
    sys.exit(1)
