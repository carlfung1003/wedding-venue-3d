"""Re-derive assets/textures/frangipani_leaf.webp with PINK flowers (KAN-211 wave E).

The arrival court's frangipani card (art_manifest `frangipani_leaf_card`, KAN-211
wave A2) was generated with "some white with a yellow centre and some soft
pink" flowers: measured on the card, 20.6k near-white texels (243, 232, 227)
and 13.0k salmon ones (228, 172, 148) — and in the court the crowns read WHITE-
flowered. The entrance video's trees are the pink-red Plumeria rubra: flower
texels in f_005 / f_007 / f_009 measure (190, 112, 122) / (183, 94, 104) /
(192, 83, 100) — a deep rose pink, sparse.

So every FLOWER texel (red ≥ green, bright; the leaves are green-dominant and
untouched, as is the alpha) is pulled toward a rose pink that keeps the
texel's own shading: pink × (its luminance / the flowers' mean luminance), a
touch deeper than the frames (the render lifts a texture — wave A2 lesson 1)
and the yellow throats kept (texels whose blue is far below green stay
yellow-ish via a smaller weight).

⚠ Run it on the ORIGINAL card only — it reads `git show 40fdfae:…`, never the
file it writes, so re-running is idempotent.

    python3 assets/blender/derive_frangi_pink.py
"""
import io
import subprocess
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REL = "assets/textures/frangipani_leaf.webp"
SRC_REV = "40fdfae"
DST = ROOT / REL
PINK = np.array((176, 70, 96)) / 255.0          # sRGB, graded under f_007's (183, 94, 104)

raw = subprocess.run(["git", "-C", str(ROOT), "show", f"{SRC_REV}:{REL}"],
                     check=True, capture_output=True).stdout
im = Image.open(io.BytesIO(raw)).convert("RGBA")
a = np.asarray(im).astype(float) / 255.0
rgb, al = a[..., :3], a[..., 3:]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)

# flowerness: red at least green (leaves are green-dominant) and bright
m = smooth(-0.02, 0.06, r - g) * smooth(0.50, 0.66, r)
# …and the near-white petals (no leaf texel is that bright and grey)
m = np.maximum(m, smooth(0.70, 0.80, np.minimum(np.minimum(r, g), b + 0.05)))
# yellow throats (blue far below green) keep most of their yellow
m *= 1.0 - 0.7 * smooth(0.12, 0.30, g - b)
Y = rgb @ np.array([.2126, .7152, .0722])
Yref = np.average(Y[m > .5]) if (m > .5).any() else 0.85
shade = np.clip(Y / Yref, 0.35, 1.25)[..., None]
pink = np.clip(PINK[None, None, :] * shade, 0, 1)
# petals are lighter toward the throat on a real bloom: keep 10 % of the old
# near-white on the brightest texels
light = smooth(0.88, 0.98, Y)[..., None] * 0.10
new = pink * (1 - light) + rgb * light
out = rgb * (1 - m[..., None]) + new * m[..., None]
res = np.concatenate([out, al], -1)
Image.fromarray((res * 255 + .5).astype(np.uint8)).save(DST, "WEBP", quality=90, method=6)
fl = (m > .5) & (al[..., 0] > .5)
print(DST, "flower texels", int(fl.sum()), "mean", (out[fl] * 255).mean(0).round(1))
