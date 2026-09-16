"""Run the generators -> bake -> write masters/<name>.blend.

  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python assets/blender/make_masters.py -- [names...] [fast=1] [bevel=0.004]

The .blend masters are the source of truth (Git LFS): open one in the Blender GUI,
edit, save, re-run export_all.py — you do not have to re-run the generator.
Re-running make_masters.py regenerates from the script and overwrites.

A generator module exposes NAME, ATLAS and build(). Optional constants:
  BEVEL        edge bevel in metres (0 = none; cloth, florals, beads)
  AO_DIST      0.5 default; 0.15 for anything with an enclosed interior
  AO_STRENGTH  0.5 default
  TRIS         triangle budget (export_all.py FAILS if the GLB exceeds it)
  FRONT        "-Z" (default) or "+Z" (the chair family)
  ORIGIN       "floor" (default) | "hook" | "base"  — recorded in the sidecar
  MAT_NAME     force the exported material's name ("crystal", "mirror"…)
It may also expose extra `build_<suffix>()` functions, which become separate
assets named `<NAME>_<suffix>` sharing the module's constants (the canopy, the
flames, the facia — the parts that need their own material class).
"""
import sys, os, importlib, time, traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "generators"))
import bpy
import wv_lib as L
import wv_bake as B

GEN_DIR = os.path.join(HERE, "generators")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opts = dict(a.split("=", 1) for a in args if "=" in a)
names = [a for a in args if "=" not in a] or sorted(
    f[:-3] for f in os.listdir(GEN_DIR) if f.endswith(".py") and not f.startswith("_"))
FAST = opts.get("fast") == "1"          # skip baking, for quick shape iteration


def run_one(mod, fn, asset, atlas):
    L.reset_scene()
    root = fn()
    assert root is not None and root.type == 'MESH', \
        f"{asset}: build() must return the joined mesh (use wv_lib.join)"
    root.name = asset
    pre = L.tris(root)
    if not FAST:
        bw = getattr(mod, "BEVEL", None)
        if bw is None:
            bw = float(opts.get("bevel", 0.004))
        B.prepare_for_export(root, size=atlas,
                             bevel_width=bw,
                             ao_dist=getattr(mod, "AO_DIST", 0.5),
                             ao_strength=getattr(mod, "AO_STRENGTH", 0.5),
                             mat_name=getattr(mod, "MAT_NAME", None))
    L.save_master(root, asset,
                  front=getattr(mod, "FRONT", "-Z"),
                  origin=getattr(mod, "ORIGIN", "floor"),
                  tris=getattr(mod, "TRIS", None),
                  generator=mod.__name__)
    return pre, L.tris(root)


ok, fail = [], []
t0 = time.time()
for name in names:
    try:
        mod = importlib.import_module(name)
        importlib.reload(mod)
        atlas = getattr(mod, "ATLAS", 512)
        jobs = [(getattr(mod, "NAME", name), mod.build)]
        for attr in sorted(dir(mod)):
            if attr.startswith("build_"):
                jobs.append((f"{getattr(mod, 'NAME', name)}_{attr[6:]}", getattr(mod, attr)))
        for asset, fn in jobs:
            t = time.time()
            pre, post = run_one(mod, fn, asset, atlas)
            budget = getattr(mod, "TRIS", None)
            over = f"  OVER BUDGET {budget}" if (budget and post > budget) else ""
            print(f"OK   {asset:24s} tris {pre:6d} -> {post:6d}  atlas {atlas}  {time.time()-t:5.1f}s{over}")
            ok.append(asset)
    except Exception as e:
        fail.append((name, repr(e)))
        print(f"FAIL {name}: {e}")
        traceback.print_exc()
print(f"\nMASTERS built={len(ok)} failed={len(fail)} in {time.time()-t0:.0f}s")
for n, e in fail:
    print("  FAILED", n, e)
if fail:
    sys.exit(1)
