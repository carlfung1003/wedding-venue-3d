"""Render one Workbench 3/4-view preview per master into ../previews/<name>.webp.

  Blender --background --factory-startup --python assets/blender/preview_all.py -- [names] [turn=4]

This is the SHAPE check. The look check is tools/shoot-models.mjs (the venue's own
Three.js renderer, PMREM + ACES + sun) — judge materials there, at guest distance.
`turn=N` renders N views around the turntable into one strip instead of the
single 3/4 view.
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import numpy as np
from mathutils import Vector

MASTERS = os.path.join(HERE, "masters")
PREVIEWS = os.path.normpath(os.path.join(HERE, "..", "previews"))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
opts = dict(a.split("=", 1) for a in args if "=" in a)
names = [a for a in args if "=" not in a] or sorted(
    f[:-6] for f in os.listdir(MASTERS) if f.endswith(".blend"))
TURN = int(opts.get("turn", "1"))
RES = int(opts.get("res", "512"))
os.makedirs(PREVIEWS, exist_ok=True)


def render_view(sc, cam, centre, d, pitch, yaw, front_sign, path):
    cp = math.cos(pitch)
    cam.location = (centre.x + d * cp * math.sin(yaw),
                    centre.y + front_sign * d * cp * math.cos(yaw),
                    centre.z + d * math.sin(pitch))
    direction = centre - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


for name in names:
    bpy.ops.wm.open_mainfile(filepath=os.path.join(MASTERS, name + ".blend"))
    root = bpy.data.objects.get(name) or next(
        (x for x in bpy.data.objects if x.get("wv_asset") == name), None)
    if root is None:
        print("SKIP", name)
        continue
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c)
           for o in [root, *root.children_recursive] if o.type == 'MESH' for c in o.bound_box]
    lo = [min(p[i] for p in pts) for i in range(3)]
    hi = [max(p[i] for p in pts) for i in range(3)]
    centre = Vector([(lo[i] + hi[i]) / 2 for i in range(3)])
    span = max(hi[i] - lo[i] for i in range(3))
    d = span * 1.8 + 0.7
    # the asset's front faces Blender +Y (glTF -Z); the chair family faces -Y
    front_sign = -1.0 if root.get("wv_front") == "+Z" else 1.0

    cam_d = bpy.data.cameras.new("_c"); cam = bpy.data.objects.new("_c", cam_d)
    bpy.context.collection.objects.link(cam); cam.data.lens = 45
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    # ⚠ Workbench ignores the Principled base colour: wv_lib.M sets diffuse_color for
    # the unbaked case; a baked master shows its atlas.
    sc.display.shading.color_type = 'TEXTURE' if root.get('wv_baked') else 'MATERIAL'
    sc.display.shading.show_shadows = True
    sc.display.shading.show_cavity = True
    sc.display.shading.cavity_type = 'BOTH'
    sc.display.shading.background_type = 'VIEWPORT'
    sc.display.shading.background_color = (0.42, 0.47, 0.52)   # a mid blue-grey; white props read
    sc.view_settings.view_transform = 'Standard'                # no AgX desaturation
    sc.render.resolution_x = sc.render.resolution_y = RES
    sc.render.film_transparent = False
    sc.world = sc.world or bpy.data.worlds.new("W")
    sc.render.image_settings.file_format = 'PNG'
    pitch = math.radians(22)
    tmp = os.path.join(PREVIEWS, "_tmp_%s_%d.png")
    frames = []
    for i in range(TURN):
        yaw = math.radians(35) + 2 * math.pi * i / TURN
        p = tmp % (name, i)
        render_view(sc, cam, centre, d, pitch, yaw, front_sign, p)
        frames.append(p)
    # stitch (or just convert) into one WebP
    imgs = []
    for p in frames:
        im = bpy.data.images.load(p)
        imgs.append(np.array(im.pixels[:], dtype=np.float32).reshape(im.size[1], im.size[0], 4))
        bpy.data.images.remove(im)
        os.remove(p)
    strip = np.concatenate(imgs, axis=1)
    out = bpy.data.images.new("_strip", strip.shape[1], strip.shape[0], alpha=False)
    out.pixels = strip.ravel().tolist()
    out.filepath_raw = os.path.join(PREVIEWS, name + ".webp")
    out.file_format = 'WEBP'
    out.save()
    bpy.data.images.remove(out)
    print("PREVIEW", name, "->", os.path.join(PREVIEWS, name + ".webp"))
