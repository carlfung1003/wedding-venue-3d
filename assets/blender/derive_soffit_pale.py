"""Derive textures/gen/soffit_pale.webp from cedar_soffit.webp (KAN-211 fix pass).

Carl, 2026-09-25: the suite's roof soffit is "white pale-ish" as he remembers it
(his word outranks pimg-002's deep shade). IMG_8095's overhang reads a warm
near-neutral, R:G:B ~ 1 : .95 : .89. The cedar keeps its board-to-board and
grain LUMINANCE variation, but most of its chroma is removed (a board that is
redder than its neighbour would otherwise turn mauve under a warm-neutral
grade), then each channel is re-balanced in LINEAR light to MEAN.

    python3 assets/blender/derive_soffit_pale.py
"""
import numpy as np
from PIL import Image
from pathlib import Path

HERE = Path(__file__).parent / "textures" / "gen"
SRC, DST = HERE / "cedar_soffit.webp", HERE / "soffit_pale.webp"
MEAN = (126, 117, 111)      # sRGB target mean — renders ~(126,119,112) at archC-roof-edge
CHROMA = 0.15               # fraction of the cedar's own chroma kept
CONTRAST = 1.0              # luminance variation kept (the joints must stay dark)

def lin(c): return np.where(c <= .04045, c / 12.92, ((c + .055) / 1.055) ** 2.4)
def srgb(c): return np.where(c <= .0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - .055)

a = lin(np.asarray(Image.open(SRC).convert("RGB")).astype(float) / 255)
Y = (a @ np.array([.2126, .7152, .0722]))[..., None]
Ym = Y.mean()
Y2 = Ym + (Y - Ym) * CONTRAST
a = Y2 + (a - Y) * CHROMA * (Y2 / np.maximum(Y, 1e-6))
tgt = lin(np.array(MEAN) / 255)
a = a * (tgt / a.reshape(-1, 3).mean(0))
out = (np.clip(srgb(np.clip(a, 0, 1)), 0, 1) * 255 + .5).astype(np.uint8)
Image.fromarray(out).save(DST, "WEBP", quality=90)
print(DST, out.reshape(-1, 3).mean(0).round(1), out.reshape(-1, 3).std(0).round(1))
