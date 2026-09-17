#!/usr/bin/env python3
"""Key a generated figure off its chroma-key green backdrop into clean RGBA.

Why this exists
---------------
The first ghost art was generated on a BLACK backdrop and keyed by luminance. That
works for a red cheongsam and fails completely for everything this game actually
wants: the woman's black hair dissolved into the background, and a jiangshi in a
near-black burial robe would have had no body at all. Luminance keying cannot tell
"dark subject" from "dark background", so any horror character — which is to say
every character here — loses exactly the parts that matter.

Generating on green and keying on *hue* separates subject from background by colour
instead of brightness, so black hair, navy cloth and shadowed folds all survive.

The three stages that matter:

  key     alpha from how green a pixel is relative to its own red/blue — a ratio, so
          it holds up across the backdrop's lighting gradient.
  spill   green light bounces off a green wall onto the subject. Without suppression
          every figure wears a green rim and reads as a cut-out. Green is pulled back
          to the red/blue average only where it exceeds it.
  crop    trim to the alpha bounding box so the card's aspect ratio is the FIGURE's
          aspect ratio; the game sizes the card from real-world height, and padding
          baked into the image would silently squash the character.

Usage: chroma_key.py IN.png OUT.png [--tol auto] [--soft auto] [--pad 8] [--max 2048]
                                    [--nocrop] [--mode hue|flat] [--unmix] [--erode N]

wedding-venue-3d copy (2026-09-15) of seventh-floor's keyer. Two additions:

--nocrop   the cocktail-menu plate is a 2x2 GRID of four illustrations and the game
           addresses each quarter by UV, so trimming the whole sheet to its alpha
           bounding box would move the quadrant centres. Keeps the full frame.

--mode flat   a second keyer for subjects that CONTAIN green or yellow. The hue-ratio
           key above is right for a cast of dark ghosts on a photographed green wall,
           and wrong for a watercolour of a yellow rum highball with a sprig of mint:
           measured on that plate, the ratio despill turned the yellow drink orange and
           the mint leaves grey-brown, and the mint (greenness 0.15-0.25) keys as
           backdrop (0.22-0.25). The generated backdrop, though, is FLAT — RGB std 1.3,
           every border pixel within 14 of the median — while the mint sits 58+ away.
           So `flat` keys on RGB distance to the sampled backdrop colour, recovers edge
           colour by UNMIXING against that known backdrop (c = a*s + (1-a)*bg, solve
           for s) instead of despilling, and does not fill enclosed holes (the gaps
           between mint leaves are real). Interior pixels are untouched.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def greenness(rgb: np.ndarray) -> np.ndarray:
    """How green a pixel is relative to its own brightness.

    Normalising by the pixel's own sum makes this immune to the backdrop's light
    falloff — a dim corner of the green wall keys exactly like a brightly lit one,
    which a raw `g - max(r, b)` difference does not.
    """
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    total = np.maximum(r + g + b, 1e-4)
    return (g - np.maximum(r, b)) / total


def backdrop_level(gr: np.ndarray) -> float:
    """Estimate the DIM END of the backdrop's greenness from a ring of border pixels.

    Two things make a fixed threshold useless here:

    1. Generated green screens are not a fixed colour. They come back anywhere from a
       saturated key green to the realistic dark stage green (52,156,81) these prompts
       actually produce, which sits at ~0.20 where a saturated green would be ~0.45.
    2. A photographed backdrop has a lighting gradient across it — in these frames the
       green runs 0.18 in the dark corners to 0.29 near the lamps.

    So the threshold has to sit *below the darkest backdrop pixel*, not at the
    backdrop's average: calibrating to the middle of that range leaves half the wall
    opaque. The subject is nowhere near it — red silk keys at -0.5, black hair at
    -0.03 — so there is a wide empty gap to aim at.

    Pixels at or below 0.05 are dropped before measuring, so a studio ceiling or a
    shoulder clipping the frame edge cannot drag the estimate down.
    """
    h, w = gr.shape
    band = max(2, min(h, w) // 64)
    ring = np.concatenate([
        gr[:band, :].ravel(), gr[-band:, :].ravel(),
        gr[:, :band].ravel(), gr[:, -band:].ravel(),
    ])
    green = ring[ring > 0.05]
    if green.size < ring.size * 0.2:
        return 0.0
    return float(np.percentile(green, 10))


def largest_regions(mask: np.ndarray, keep_frac: float = 0.02) -> np.ndarray:
    """Keep only sizeable connected regions of `mask`, dropping specks.

    A chroma key always leaves a scatter of isolated pixels where backdrop noise landed
    on the subject side of the threshold. On a ghost card those show up in game as
    glowing dust around the figure, because the material is emissive. An explicit
    flood fill avoids adding a scipy dependency to the pipeline.
    """
    h, w = mask.shape
    total = int(mask.sum())
    if total == 0:
        return mask
    labels = np.zeros((h, w), dtype=bool)
    kept = np.zeros_like(mask)
    ys, xs = np.nonzero(mask)
    for idx in range(len(ys)):
        y, x = int(ys[idx]), int(xs[idx])
        if labels[y, x]:
            continue
        stack = [(y, x)]
        labels[y, x] = True
        comp = []
        while stack:
            cy, cx = stack.pop()
            comp.append((cy, cx))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = True
                    stack.append((ny, nx))
        if len(comp) >= total * keep_frac:
            ci = np.array(comp)
            kept[ci[:, 0], ci[:, 1]] = True
    return kept


def fill_enclosed_holes(mask: np.ndarray, max_frac: float = 0.0008) -> np.ndarray:
    """Close small transparent regions that the subject completely surrounds.

    Deep shadow between two limbs is still lit by the green wall behind it, so it keys
    as backdrop and punches a hole through the middle of the subject. The mass of arms
    in the lift came back chewed for exactly this reason.

    A transparent region that touches the image border is real — it is the space around
    the figure. One that does not, and is TINY, is a key failure.

    The threshold is deliberately small (0.08% of the frame). The first attempt used 2%
    and closed the genuine gaps between a mass of reaching arms, which are supposed to
    stay open so the dark lift shows through them. Speckle is what this is for; a gap
    you could see through is not speckle.
    """
    h, w = mask.shape
    holes = ~mask
    seen = np.zeros_like(holes)
    total = mask.size
    out = mask.copy()
    ys, xs = np.nonzero(holes)
    for idx in range(len(ys)):
        y, x = int(ys[idx]), int(xs[idx])
        if seen[y, x]:
            continue
        stack = [(y, x)]
        seen[y, x] = True
        comp = []
        touches_border = False
        while stack:
            cy, cx = stack.pop()
            comp.append((cy, cx))
            if cy == 0 or cx == 0 or cy == h - 1 or cx == w - 1:
                touches_border = True
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and holes[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if not touches_border and len(comp) <= total * max_frac:
            ci = np.array(comp)
            out[ci[:, 0], ci[:, 1]] = True
    return out


def key(img: Image.Image, tol=None, soft=None, despill: float = 1.0, unmix: bool = False):
    """`unmix=True` replaces the despill on EDGE pixels with an unmix against the
    backdrop's median colour (c = a*s + (1-a)*bg, solved for s). The despill pulls a
    green fringe down to the red/blue average, which on a near-WHITE subject (the rose
    petal) reads as a thin dark outline; unmixing gives the fringe the subject's own
    colour instead. Interior pixels keep the ordinary despill."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    gr = greenness(rgb)
    h0, w0 = gr.shape
    band0 = max(2, min(h0, w0) // 64)
    bg_rgb = np.median(np.concatenate([
        rgb[:band0].reshape(-1, 3), rgb[-band0:].reshape(-1, 3),
        rgb[:, :band0].reshape(-1, 3), rgb[:, -band0:].reshape(-1, 3)]), axis=0)

    if tol is None or soft is None:
        bg = backdrop_level(gr)
        if bg <= 0.0:
            print("WARNING: no green backdrop along the border — the shot is probably "
                  "framed wrong (studio ceiling or floor in the corners). Falling back "
                  "to a fixed key; re-shoot rather than trusting this matte.",
                  file=sys.stderr)
            bg = 0.20
        # Fully transparent just under the DARKEST backdrop pixel, fully opaque well
        # below it, in the empty gap between backdrop and subject.
        t_solid = bg * 0.30
        t_clear = bg * 0.88
        tol = t_solid if tol is None else tol
        soft = (t_clear - t_solid) if soft is None else soft
        print(f"  backdrop {bg:.3f} -> opaque<={tol:.3f} clear>={tol + soft:.3f}",
              file=sys.stderr)

    # greenness <= tol -> opaque subject; >= tol + soft -> transparent backdrop.
    alpha = 1.0 - np.clip((gr - tol) / max(soft, 1e-4), 0.0, 1.0)

    # Despill: green light bounces off a green wall onto the subject, and without
    # suppression every figure wears a green rim and reads as a cut-out. Pull green
    # back to the red/blue average wherever it overshoots, scaled by alpha so
    # semi-transparent hair edges do not take a hard colour shift.
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    rb = (r + b) * 0.5
    g2 = g - np.maximum(g - rb, 0.0) * despill * alpha
    if unmix:
        a3 = alpha[..., None]
        edge = (alpha > 0.02) & (alpha < 0.98)
        est = (rgb - (1.0 - a3) * bg_rgb) / np.maximum(a3, 0.15)
        est = np.clip(est, 0.0, 1.0)
        r = np.where(edge, est[..., 0], r)
        g2 = np.where(edge, est[..., 1], g2)
        b = np.where(edge, est[..., 2], b)

    # Drop isolated specks where backdrop noise crossed the threshold. They are
    # invisible in a PNG viewer and very visible in game, because the ghost material
    # is emissive and every speck becomes a floating mote of light.
    keep = largest_regions(fill_enclosed_holes(alpha > 0.5))
    grown = keep.copy()
    for _ in range(3):  # let soft edges survive next to a kept region
        grown[1:, :] |= keep[:-1, :]
        grown[:-1, :] |= keep[1:, :]
        grown[:, 1:] |= keep[:, :-1]
        grown[:, :-1] |= keep[:, 1:]
        keep = grown.copy()
    # `keep` may have closed specks that alpha still reads as transparent. Make those
    # solid — and neutralise their colour, because the pixel underneath is backdrop:
    # turning the alpha up on unmodified green paints green freckles on the subject.
    filled = keep & (alpha <= 0.5)
    if filled.any():
        alpha = np.where(filled, 1.0, alpha)
        flat = np.minimum(np.minimum(r, g2), b) * 0.85   # desaturate, read as shadow
        r = np.where(filled, flat, r)
        g2 = np.where(filled, flat, g2)
        b = np.where(filled, flat, b)
    alpha = np.where(grown, alpha, 0.0)

    rgba = np.concatenate([np.stack([r, g2, b], axis=-1), alpha[..., None]], axis=-1)
    return (np.clip(rgba, 0, 1) * 255).astype(np.uint8)


def key_flat(img: Image.Image, tol=None, soft=None):
    """Key against a FLAT backdrop colour by RGB distance. See the module docstring.

    tol  = distance at which a pixel is fully transparent (default: just above the
           widest spread seen in the border ring)
    soft = width of the transition band above tol (default 26/255 units)
    """
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32)
    h, w = rgb.shape[:2]
    band = max(2, min(h, w) // 64)
    ring = np.concatenate([
        rgb[:band].reshape(-1, 3), rgb[-band:].reshape(-1, 3),
        rgb[:, :band].reshape(-1, 3), rgb[:, -band:].reshape(-1, 3),
    ])
    bg = np.median(ring, axis=0)
    ring_d = np.linalg.norm(ring - bg, axis=-1)
    if ring_d.mean() > 30:
        print("WARNING: the border is not a flat backdrop (mean spread %.1f) — --mode flat "
              "assumes a solid colour; re-shoot or use the hue key." % ring_d.mean(),
              file=sys.stderr)
    t0 = float(np.percentile(ring_d, 99.9)) + 4.0 if tol is None else tol
    t1 = t0 + (26.0 if soft is None else soft)
    print(f"  flat backdrop {bg.astype(int).tolist()} -> clear<={t0:.1f} opaque>={t1:.1f}",
          file=sys.stderr)
    d = np.linalg.norm(rgb - bg, axis=-1)
    alpha = np.clip((d - t0) / max(t1 - t0, 1e-4), 0.0, 1.0)

    # Unmix the edge: an anti-aliased pixel is a*subject + (1-a)*backdrop. Where a is
    # small the estimate is noisy, so fall back toward the observed colour there.
    a3 = alpha[..., None]
    safe = np.maximum(a3, 0.15)
    unmixed = (rgb - (1.0 - a3) * bg) / safe
    col = np.where(a3 > 0.15, unmixed, rgb)

    keep = largest_regions(alpha > 0.5)
    grown = keep.copy()
    for _ in range(3):
        grown[1:, :] |= keep[:-1, :]
        grown[:-1, :] |= keep[1:, :]
        grown[:, 1:] |= keep[:, :-1]
        grown[:, :-1] |= keep[:, 1:]
        keep = grown.copy()
    alpha = np.where(grown, alpha, 0.0)
    rgba = np.concatenate([col, alpha[..., None] * 255.0], axis=-1)
    return np.clip(rgba, 0, 255).astype(np.uint8)


def erode_alpha(arr: np.ndarray, px: int) -> np.ndarray:
    """Shrink the matte by `px` pixels (morphological min filter on alpha).

    The last ring of OPAQUE pixels around a keyed subject is still a mix of subject
    and backdrop — its greenness sits just under the threshold, so it survives the
    key and the despill then darkens it into a thin outline (the rose petal). No
    colour trick recovers a 50/50 mix honestly; dropping the ring does, at the cost
    of `px` pixels off a 1024 px subject."""
    if px <= 0:
        return arr
    from PIL import ImageFilter
    a = Image.fromarray(arr[..., 3]).filter(ImageFilter.MinFilter(2 * px + 1))
    out = arr.copy()
    out[..., 3] = np.asarray(a)
    return out


def alpha_bbox(arr: np.ndarray, thresh: int = 8):
    a = arr[..., 3]
    ys, xs = np.where(a > thresh)
    if len(ys) == 0:
        return None
    return int(ys.min()), int(ys.max()) + 1, int(xs.min()), int(xs.max()) + 1


def save(img: Image.Image, dst: Path):
    """Write the matte. WebP for anything shipped.

    A keyed figure is a big image with a big alpha channel, and PNG is a terrible
    container for it — the cast came to 10.1 MB as PNG and 1.66 MB as lossy WebP with
    alpha, for no visible difference on a card that is lit, fogged and grain-graded
    before the player sees it. The rest of the pipeline already ships WebP (models,
    surfaces), so this just stops the sprites being the exception.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.suffix.lower() == ".webp":
        img.save(dst, "WEBP", quality=88, method=6)
    else:
        img.save(dst, optimize=True)


def finish(arr: np.ndarray, box, pad: int, mx: int, nocrop: bool = False) -> Image.Image:
    if nocrop:
        box = (0, arr.shape[0], 0, arr.shape[1])
        pad = 0
    y0, y1, x0, x1 = box
    y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
    y1, x1 = min(arr.shape[0], y1 + pad), min(arr.shape[1], x1 + pad)
    out = Image.fromarray(arr[y0:y1, x0:x1])
    if max(out.size) > mx:
        s = mx / max(out.size)
        out = out.resize((round(out.width * s), round(out.height * s)), Image.LANCZOS)
    return out


def key_group(pairs, pad: int = 8, mx: int = 2048, despill: float = 1.0,
              tol=None, soft=None):
    """Key several plates of the SAME character to a SHARED crop.

    Animation frames must not each get their own tight bounding box. A jiangshi at the
    top of a hop has straight legs and a lifted hem; the same jiangshi landing is
    shorter and wider. Cropped independently, both fill their frame, so swapping the
    texture on a fixed card rescales the character — he grows and shrinks on every hop
    instead of rising and falling. Sharing the union of the bounding boxes keeps the
    figure's real proportions and its position within the card.
    """
    keyed, boxes = [], []
    for src, _ in pairs:
        arr = key(Image.open(src), tol, soft, despill)
        box = alpha_bbox(arr)
        if box is None:
            raise SystemExit(f"{src}: keyed to nothing — check the backdrop")
        keyed.append(arr)
        boxes.append(box)
    union = (min(b[0] for b in boxes), max(b[1] for b in boxes),
             min(b[2] for b in boxes), max(b[3] for b in boxes))
    for (src, dst), arr in zip(pairs, keyed):
        out = finish(arr, union, pad, mx)
        save(out, Path(dst))
        cov = (np.asarray(out)[..., 3] > 8).mean()
        print(f"{Path(dst).name}  {out.width}x{out.height}  "
              f"aspect={out.width / out.height:.4f}  coverage={cov * 100:.1f}%")


def main():
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        sys.exit(1)

    args = sys.argv[1:]

    def opt(name, default):
        if name in args:
            return float(args[args.index(name) + 1])
        return default

    tol = opt("--tol", None)
    soft = opt("--soft", None)
    pad = int(opt("--pad", 8))
    mx = int(opt("--max", 2048))
    despill = opt("--despill", 1.0)

    if "--group" in args:
        i = args.index("--group")
        pairs = []
        for spec in args[i + 1:]:
            if spec.startswith("--"):
                break
            src, dst = spec.split("::")
            pairs.append((Path(src), Path(dst)))
        key_group(pairs, pad=pad, mx=mx, despill=despill, tol=tol, soft=soft)
        return

    src, dst = Path(args[0]), Path(args[1])
    mode = args[args.index("--mode") + 1] if "--mode" in args else "hue"
    if mode == "flat":
        arr = key_flat(Image.open(src), tol, soft)
    else:
        arr = key(Image.open(src), tol, soft, despill, unmix="--unmix" in args)
    arr = erode_alpha(arr, int(opt("--erode", 0)))
    box = alpha_bbox(arr)
    if box is None:
        raise SystemExit(f"{src}: keyed to nothing — check the backdrop")
    out = finish(arr, box, pad, mx, nocrop="--nocrop" in args)
    save(out, dst)
    cov = (np.asarray(out)[..., 3] > 8).mean()
    print(f"{dst.name}  {out.width}x{out.height}  aspect={out.width / out.height:.4f}  "
          f"coverage={cov * 100:.1f}%")


if __name__ == "__main__":
    main()
