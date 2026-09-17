"""_seating — helpers shared by Group A's generators (seating & tables, KAN-207).

Files starting with `_` are skipped by make_masters.py. Everything here builds on
wv_lib; nothing in wv_lib is patched. Contents:

  tex(...)            image_mat with two guards wv_lib does not have: a 0-byte file
                      (another agent mid-write) falls back like a missing one, and an
                      optional `tint_to=<palette key>` multiplies the picture so its
                      MEAN lands on the palette colour (the generated oak is greyer and
                      lighter than `oak` c3a37c; the spec's palette is the contract).
  sweep / circle / rrect
                      swept tubes for legs, rails, bottle necks.
  metric_uv(...)      a METRIC planar projection into the `art` layer (u = x/tile …),
                      so a picture has the same scale on every part.
  skirt(...)          the linen skirt: a pleated lathe from the table edge to the grass.
  soft_cloth(o, …)    displace_noise without the subdivision (the mesh is already dense).
"""
import math, os, bmesh
import bpy
import numpy as np
from mathutils import Vector
import wv_lib as L


# ---------------------------------------------------------------- materials
def tex(name, filename, roughness=0.62, fallback="white", tint_to=None, gain=1.0):
    path = filename if os.path.isabs(filename) else os.path.join(L.TEX_GEN, filename)
    if os.path.exists(path) and os.path.getsize(path) == 0:
        print(f"WARN tex({name!r}): {path} is 0 bytes (being written?) — falling back to {fallback!r}")
        return L.M(fallback)
    m = L.image_mat(name, filename, roughness=roughness, fallback=fallback)
    if tint_to and m.get("wv_family") == "bloom" and not m.get("wv_tinted"):
        _tint_to_palette(m, tint_to, gain)
    elif gain != 1.0 and not m.get("wv_gained"):
        # flat fallback: scale the key's colour the same way
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            g = gain if isinstance(gain, (tuple, list)) else (gain, gain, gain)
            c = bsdf.inputs["Base Color"].default_value
            bsdf.inputs["Base Color"].default_value = (c[0] * g[0], c[1] * g[1], c[2] * g[2], 1.0)
            m["wv_gained"] = 1
    return m


def dielectric(key):
    """The bake stores DIFFUSE colour, and a metallic key (steel .8, gold .55) has
    almost none — it comes out near-black in the atlas. For a prop whose GLB
    material is dielectric anyway (the linen dominates), zero the metallic on the
    shared key so its brushed grey/gold albedo survives the bake."""
    m = L.M(key)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Roughness"].default_value = max(bsdf.inputs["Roughness"].default_value, 0.45)
    return m


def _tint_to_palette(m, key, gain=1.0):
    """Multiply the picture so its mean equals PALETTE[key] × gain (per channel, linear).
    `gain` (scalar or per-channel linear) < 1 darkens deliberately: the venue's
    2.1 sun + hemisphere sky + ACES renders a lit timber face far above its
    albedo, and adds more blue than red, so the oak takes a per-channel gain to
    RENDER at the palette's hue and the reference render's lightness."""
    nt = m.node_tree
    tex_node = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image), None)
    bsdf = nt.nodes.get("Principled BSDF")
    if tex_node is None or bsdf is None:
        return
    img = tex_node.image
    px = np.empty(len(img.pixels), dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)[:, :3]
    # byte images hand back their stored (sRGB-encoded) values; float ones are linear
    mean = px.mean(axis=0)
    if not img.is_float:
        mean = np.array([L.srgb_to_linear(float(c)) for c in mean])
    g = np.array(gain if isinstance(gain, (tuple, list)) else (gain, gain, gain), dtype=float)
    target = np.array([L.srgb_to_linear(c) for c in L.PALETTE[key]]) * g
    ratio = target / np.maximum(mean, 1e-4)
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.blend_type = 'MULTIPLY'
    mix.inputs[0].default_value = 1.0
    mix.inputs[2].default_value = (float(ratio[0]), float(ratio[1]), float(ratio[2]), 1.0)
    mix.location = (-250, 200)
    nt.links.new(tex_node.outputs["Color"], mix.inputs[1])
    nt.links.new(mix.outputs[0], bsdf.inputs["Base Color"])
    m["wv_tinted"] = 1
    m.diffuse_color = (float(target[0]), float(target[1]), float(target[2]), 1.0)
    print(f"TINT {m.name}: mean {tuple(round(float(c), 3) for c in mean)} -> {key} x{tuple(round(float(c), 3) for c in ratio)}")


# ---------------------------------------------------------------- swept tubes
def sweep(name, centres, sections, mat, plane="xy"):
    """A tube through `centres` with a 2-D `sections[i]` (list of (a, b)) at each;
    plane 'xy' lays the ring flat (near-vertical members), 'yz' stands it up
    (members running along X), 'xz' for members running along Y. Capped."""
    bm = bmesh.new()
    rings = []
    for c, sec in zip(centres, sections):
        ring = []
        for (a, b) in sec:
            if plane == "xy":
                p = (c[0] + a, c[1] + b, c[2])
            elif plane == "yz":
                p = (c[0], c[1] + a, c[2] + b)
            else:
                p = (c[0] + a, c[1], c[2] + b)
            ring.append(bm.verts.new(p))
        rings.append(ring)
    n = len(rings[0])
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            bm.faces.new([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]])
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return L.from_bmesh(name, bm, (0, 0, 0), mat)


def circle(r, n=8):
    return [(math.cos(2 * math.pi * i / n) * r, math.sin(2 * math.pi * i / n) * r) for i in range(n)]


def rrect(d, h, rc, s=1.0):
    """Rounded rectangle d × h with corner radius rc, 12 points, scaled by s."""
    pts = []
    cx, cy = d / 2 - rc, h / 2 - rc
    for (sx, sy, a0) in ((1, 1, 0.0), (-1, 1, 90.0), (-1, -1, 180.0), (1, -1, 270.0)):
        for k in range(3):
            a = math.radians(a0 + k * 45.0)
            pts.append(((sx * cx + math.cos(a) * rc) * s, (sy * cy + math.sin(a) * rc) * s))
    return pts


def slab(name, w, d, z0, z1, rc, mat, k=5):
    """A rounded-rectangle slab (table tops, trays): w × d in XY from z0 to z1,
    corner radius rc, k points per corner arc."""
    pts = []
    hw, hd = w / 2 - rc, d / 2 - rc
    for (sx, sy, a0) in ((1, 1, 0.0), (-1, 1, 90.0), (-1, -1, 180.0), (1, -1, 270.0)):
        for i in range(k):
            a = math.radians(a0 + 90.0 * i / (k - 1))
            pts.append((sx * hw + math.cos(a) * rc, sy * hd + math.sin(a) * rc))
    return L.prism(name, pts, z1 - z0, (0, 0, z0), mat)


# ---------------------------------------------------------------- uv
def metric_uv(o, ua, va, tile=0.5, local=False, layer=L.ART_UV):
    """Write the `art` uv layer as a METRIC planar projection (u = coord[ua] / tile,
    v = coord[va] / tile). World coordinates by default; `local` uses object
    coordinates × scale (bars: local z runs along the member)."""
    bpy.context.view_layer.update()
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    was = me.uv_layers.active
    uvl = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    mw = o.matrix_world
    sc = o.scale
    for poly in me.polygons:
        for li in poly.loop_indices:
            c = me.vertices[me.loops[li].vertex_index].co
            p = Vector((c.x * sc.x, c.y * sc.y, c.z * sc.z)) if local else (mw @ c)
            uvl.data[li].uv = (p[ua] / tile, p[va] / tile)
    me.uv_layers.active = was
    return uvl


# ---------------------------------------------------------------- cloth
def skirt(name, r_top, z_top, mat, r_hem=None, z_hem=0.006, n=64, rows=7, pleats=14,
          depth=0.014, hem_wave=0.006, rnd=None, taper=None, seed=1, ramp=1.4):
    """A round linen skirt: a lathe from the table's edge (r_top at z_top) to the
    grass, with `pleats` soft vertical folds whose depth grows from 0 at the top to
    `depth` at the hem, a slightly wavy hem, and a hem radius r_hem (default: r_top
    + a small flare). `taper` = a callable r(t) (t 0 top → 1 hem) overriding the
    linear radius, for a high-top's tapered skirt. Open at both ends (the top is
    covered by the table's own top; the hem sits on the grass)."""
    if r_hem is None:
        r_hem = r_top + 0.02
    bm = bmesh.new()
    rings = []
    ph = [(rnd.uniform(0, 2 * math.pi) if rnd else 0.37 * k) for k in range(3)]
    for j in range(rows + 1):
        t = j / rows
        z = z_top + (z_hem - z_top) * t
        rb = taper(t) if taper else (r_top + (r_hem - r_top) * t)
        amp = depth * (t ** ramp)
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            fold = math.sin(pleats * a + ph[0]) + 0.35 * math.sin(2 * pleats * a + ph[1] + 1.7 * t)
            r = rb + amp * fold
            zz = z + (hem_wave * (0.5 + 0.5 * math.sin(pleats * a + ph[0])) * t) if hem_wave else z
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, zz)))
        rings.append(ring)
    for j in range(rows):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            bm.faces.new([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]])
    return L.from_bmesh(name, bm, (0, 0, 0), mat)


def rect_skirt(name, w, d, z_top, mat, z_hem=0.006, per_m=24, rows=7, pleat_len=0.30,
               depth=0.014, corner_r=0.04, rnd=None, uv_tile=None, ramp=1.4):
    """A rectangular table's draped skirt: a rounded-rectangle loop (corners r
    `corner_r`) lathed down to the grass with soft folds. w along X, d along Y."""
    # perimeter loop as points
    pts = []
    hw, hd = w / 2, d / 2
    def arc(cx, cy, a0, a1, k):
        for i in range(k):
            a = math.radians(a0 + (a1 - a0) * i / k)
            pts.append((cx + math.cos(a) * corner_r, cy + math.sin(a) * corner_r))
    kx = max(2, int((w - 2 * corner_r) * per_m))
    ky = max(2, int((d - 2 * corner_r) * per_m))
    for i in range(kx):        # front edge (−Y) left → right
        pts.append((-hw + corner_r + (w - 2 * corner_r) * i / kx, -hd))
    arc(hw - corner_r, -hd + corner_r, -90, 0, 4)
    for i in range(ky):        # right edge
        pts.append((hw, -hd + corner_r + (d - 2 * corner_r) * i / ky))
    arc(hw - corner_r, hd - corner_r, 0, 90, 4)
    for i in range(kx):        # back edge right → left
        pts.append((hw - corner_r - (w - 2 * corner_r) * i / kx, hd))
    arc(-hw + corner_r, hd - corner_r, 90, 180, 4)
    for i in range(ky):        # left edge
        pts.append((-hw, hd - corner_r - (d - 2 * corner_r) * i / ky))
    arc(-hw + corner_r, -hd + corner_r, 180, 270, 4)
    n = len(pts)
    # arc-length parameter for the folds
    s, acc = [], 0.0
    for i in range(n):
        s.append(acc)
        x0, y0 = pts[i]; x1, y1 = pts[(i + 1) % n]
        acc += math.hypot(x1 - x0, y1 - y0)
    total = acc
    pleats = max(4, round(total / pleat_len))
    ph = rnd.uniform(0, 2 * math.pi) if rnd else 0.0
    bm = bmesh.new()
    rings = []
    for j in range(rows + 1):
        t = j / rows
        z = z_top + (z_hem - z_top) * t
        amp = depth * (t ** ramp)
        flare = 0.02 * t
        ring = []
        for i in range(n):
            x, y = pts[i]
            ang = 2 * math.pi * s[i] / total
            fold = math.sin(pleats * ang + ph) + 0.35 * math.sin(2 * pleats * ang + 1.3 + 1.7 * t)
            nx, ny = (x / hw if abs(x) >= hw - 1e-6 else 0.0), (y / hd if abs(y) >= hd - 1e-6 else 0.0)
            if abs(nx) < 1e-6 and abs(ny) < 1e-6:            # corner arcs: radial from the corner centre
                cx = math.copysign(hw - corner_r, x); cy = math.copysign(hd - corner_r, y)
                ln = math.hypot(x - cx, y - cy) or 1.0
                nx, ny = (x - cx) / ln, (y - cy) / ln
            else:
                ln = math.hypot(nx, ny) or 1.0
                nx, ny = nx / ln, ny / ln
            off = flare + amp * fold
            ring.append(bm.verts.new((x + nx * off, y + ny * off, z + 0.004 * t * (0.5 + 0.5 * fold))))
        rings.append(ring)
    for j in range(rows):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            bm.faces.new([A[i], A[(i + 1) % n], B[(i + 1) % n], B[i]])
    o = L.from_bmesh(name, bm, (0, 0, 0), mat)
    if uv_tile:
        # metric uv: u = distance along the perimeter, v = height (vertex k → ring k // n, point k % n)
        me = o.data
        if not me.uv_layers:
            me.uv_layers.new(name="UVMap")
        was = me.uv_layers.active
        uvl = me.uv_layers.get(L.ART_UV) or me.uv_layers.new(name=L.ART_UV)
        for poly in me.polygons:
            us = [s[me.loops[li].vertex_index % n] for li in poly.loop_indices]
            ref = us[0]
            for li, u in zip(poly.loop_indices, us):
                if u - ref < -total / 2:
                    u += total
                elif u - ref > total / 2:
                    u -= total
                zc = me.vertices[me.loops[li].vertex_index].co.z
                uvl.data[li].uv = (u / uv_tile, zc / uv_tile)
        me.uv_layers.active = was
    return o


def soft_cloth(o, strength=0.006, scale=3.0, seed=1):
    """Surface noise on an already-dense cloth mesh (no subdivision)."""
    L.displace_noise(o, strength=strength, scale=scale, seed=seed, subdiv=0)
