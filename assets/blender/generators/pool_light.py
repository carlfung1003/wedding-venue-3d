"""pool_light — the underwater light FITTING in the hero pool's long walls.

Source: js/water.js:1036-1059. Eight of them, at x −8.4 / −2.8 / 2.8 / 8.4 on
both long walls of SITE.POOL (w 10, d 25 → hw 5, hd 12.5, js/site.js:253-263):

    const discGeo = new THREE.CircleGeometry(.17, 18);          water.js:1036
    dsc.position.set(x, P.waterY - .62, side * (hd - .02));     water.js:1057
    dsc.rotation.y = side < 0 ? 0 : Math.PI;                     water.js:1058

so the lens is a Ø 0.34 disc whose face sits at y −0.22 (P.waterY .40 − .62),
10 mm proud of the wall plane (the walls stand at ∓(hd − .01), water.js:900-903).
Today it is that bare circle and nothing else — a painted coin on a wall.

⚠ THE GLOWING DISC STAYS THE GAME'S. It is `discMat`, a MeshBasicMaterial whose
opacity is driven by the night registry (1 at night, .06 by day, water.js:1039),
with a `haloMat` corona and a 6.4 × 4.6 additive quad hanging in the water volume
behind it — three layers that turn a black band into a lit basin. This GLB is the
HOUSING only: a stainless flange, a stepped bezel and the dished niche behind it,
so the lens reads as a lamp set INTO the wall instead of stuck onto it.

── ORIGIN AND ROTATION — read both, they are the whole integration ────────────
ORIGIN: the model is re-origined to **the LENS PLANE on the fitting's axis, at
the foot of the flange**: x centred, Blender y = 0 at the lens plane, z = 0 at
the lowest vertex. The sidecar therefore reports `origin: "floor"` truthfully
(bottom at 0) and `min[2] = −0.027`, which is how far the bezel stands proud of
that plane. Because the flange is circular the lens AXIS is at exactly
size.y / 2 above the foot, so:

    position = (x, P.waterY − .62 − size.y / 2, side * (hd − .02))

puts the fitting's lens plane exactly where the disc already is, and the housing
recesses back into the wall.

⚠ ROTATION IS THE INVERSE OF THE DISC'S. A CircleGeometry faces its own +Z, so
`rotation.y = side < 0 ? 0 : π` points it INTO the pool. This asset's front faces
glTF −Z (the house default), so it needs the opposite:

    ry = side < 0 ? Math.PI : 0

Getting it backwards buries the bezel in the wall and leaves the niche facing the
garden — and nothing throws, because a rotationally symmetric fitting looks
identical from either side until you notice the bezel has gone.

── FINISH ─────────────────────────────────────────────────────────────────────
Brushed stainless flange (`steel_l`) over a white reflector throat (`paint_w`) — what a resort
pool niche actually is, and what reads under water against this pool's black
stone. Metal is safe to use as a real metal key now: `bake_atlas` mutes Metallic
for the diffuse pass, so the brushed albedo survives instead of baking near-black
(the lesson that cost the wedding pass its chafing dishes).
"""
import wv_lib as L

NAME = "pool_light"
ATLAS = 256
BEVEL = 0                 # a 600-tri fitting cannot afford a joined-mesh bevel;
                          # the chamfers are profile steps, as `four_top`'s are
AO_DIST = 0.30            # ⚠ 0.15 over a 90 mm throat crushed the whole flange
                          #   to black in the night shot; the recess is shallow
AO_STRENGTH = 0.5
TRIS = 800
FRONT = "-Z"
ORIGIN = "floor"          # …at the LENS PLANE in depth — see the banner

LENS_R = 0.17             # CircleGeometry(.17, 18)        js/water.js:1036
R_OUT = 0.243             # the flange's outer radius
PROUD = 0.026             # how far the bezel stands in front of the lens plane
DEEP = 0.090              # how far the niche recesses behind it


def build():
    parts = []
    # ⚠ every part is modelled about the Z axis and turned by rot=(-90,0,0), which
    #   maps local +Z onto Blender +Y — the asset's FRONT. Building them in Y
    #   directly would mean hand-rolling every lathe.
    ROT = (-90, 0, 0)

    # ── the niche: a solid dished puck, the lamp's throat, recessed behind the
    #    lens plane. Profile is (radius, depth) with depth running back to front.
    parts.append(L.lathe("niche", [
        (0.000, -DEEP), (0.168, -DEEP), (0.180, -DEEP + 0.030),
        (0.186, -0.014), (0.180, 0.000), (0.172, -0.006),
        (0.164, -0.030), (0.000, -0.040),
    ], (0, 0, 0), L.M("paint_w"), n=22, rot=ROT))

    # ── the flange, bolted flat to the wall, and the stepped bezel proud of it
    parts.append(L.tube("flange", R_OUT, 0.182, 0.030, (0, 0.001, 0),
                        L.M("steel_l"), n=26, rot=ROT))
    parts.append(L.tube("bezel", 0.221, 0.190, PROUD - 0.015, (0, 0.021, 0),
                        L.M("steel_l"), n=26, rot=ROT))

    # ── four fixing screws through the flange, at 45° so none sits on the
    #    silhouette's horizontal centreline where it would read as a chip
    F = 0.2125 / (2 ** 0.5)   # on the flange's own band (r .182 … .243)
    for (sx, sz) in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        parts.append(L.cyl("screw", 0.014, 0.010,
                           (sx * F, 0.019, sz * F),
                           L.M("steel"), n=6, rot=ROT))

    root = L.join(parts, NAME, origin=None)
    # x centred, y = 0 at the LENS PLANE (already where it was built), z at the foot
    zmin = min(v.co.z for v in root.data.vertices)
    L.origin_to(root, (0.0, 0.0, zmin))
    L.shade_smooth(root, angle=38)
    return root
