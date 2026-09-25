#!/usr/bin/env python3
"""Re-grade an already-keyed RGBA foliage map in place (KAN-208 wave 4).

    python3 assets/blender/regrade_foliage.py assets/textures/casuarina.webp "#44583a"

Why: casuarina.webp (commit 9c9331a) was installed without a `balance` step and
has no raw plate in art_raw/, so gen_art.py cannot re-install it. Measured on
the file: opaque mean (109, 111, 97) — a near-neutral grey-sage — plus a
lavender cast on the strand edges where the magenta backdrop survived the key
(R and B above G). Under the venue's 2.1 key light and ACES that renders as the
"pale grey/white spiky ghosts" on the ceremony lawn. The map WAS applied; it was
simply grey.

Two steps, alpha untouched:
  1. magenta despill — where (r + b)/2 > g, pull r and b down to g (a green
     strand has g ≥ (r+b)/2, so the test never touches a clean needle);
  2. balance — per-channel gain so the OPAQUE mean lands on the target hex
     (gen_art.balance's rule, measured over alpha > 127 only, as the frond
     atlas does: three quarters of the transparent rectangle is not foliage).
The transparent texels are then flooded with the opaque mean so the mip chain
never averages grey into the needles.
"""
import sys
import numpy as np
from PIL import Image


def main(path, target):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    over = (r + b) / 2 > g
    r[over] = np.minimum(r[over], g[over])
    b[over] = np.minimum(b[over], g[over])
    m = al > 127
    mean = rgb[m].mean(axis=0)
    t = np.array([int(target.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
    rgb *= t / np.maximum(mean, 1)
    rgb[al < 8] = rgb[m].mean(axis=0)
    out = np.dstack([np.clip(rgb, 0, 255), al]).astype(np.uint8)
    Image.fromarray(out).save(path, "WEBP", quality=92, method=6, exact=True)
    print(f"{path}: opaque mean {mean.round(1).tolist()} -> {rgb[m].mean(axis=0).round(1).tolist()} "
          f"(target {target}); despilled {int(over.sum())} px")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
