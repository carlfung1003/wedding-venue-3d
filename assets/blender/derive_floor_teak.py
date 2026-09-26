"""Derive assets/textures/floor_teak.webp from cedar_soffit.webp (KAN-211 wave D).

The 酒廊's floor was a canvas board pattern (retile(warmTimber)) that rendered
salmon-orange. The clubhouse's interior timber floor (entrance video f_021 /
f_030, the lobby it shares a building with) is a warm mid-dark reddish
brown. cedar_soffit.webp is already a photograph of long straight boards with
dark joints (8 boards a tile), so it is re-balanced per channel in LINEAR light
to MEAN (graded darker than the frames' lit floor — the render lifts a
texture, wave A2 lesson 1) and keeps 70 % of its chroma so neighbouring boards
differ without going candy-orange. A RUNTIME texture (assets/textures — the
bake inputs under assets/blender/ are .vercelignored), swapped over
MAT.loungeFloor's canvas map by campus.js photoTex(): no program is added.

    python3 assets/blender/derive_floor_teak.py
"""
import numpy as np
from PIL import Image
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets/blender/textures/gen/cedar_soffit.webp"
DST = ROOT / "assets/textures/floor_teak.webp"
MEAN = (104, 62, 44)
CHROMA = 0.7

def lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def srgb(c): return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - .055)

a = lin(np.asarray(Image.open(SRC).convert("RGB")).astype(float) / 255)
Y = (a @ np.array([.2126, .7152, .0722]))[..., None]
a = Y + (a - Y) * CHROMA
tgt = lin(np.array(MEAN) / 255)
a = a * (tgt / a.reshape(-1, 3).mean(0))
out = (np.clip(srgb(np.clip(a, 0, 1)), 0, 1) * 255 + .5).astype(np.uint8)
Image.fromarray(out).save(DST, "WEBP", quality=88)
print(DST, out.shape, out.reshape(-1, 3).mean(0).round(1), out.reshape(-1, 3).std(0).round(1))
