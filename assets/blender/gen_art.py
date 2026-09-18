#!/usr/bin/env python3
"""Generate The Big Day's textures, art plates and reference sheets from a manifest.

Ported from seventh-floor's gen_art.py (KAN-207). Same shape — manifest → generate
(with reference images) → post-process → install — because the same lesson applies:
generation is stochastic, so the PROMPT reproduces the intent and only the RAW plate
reproduces the asset. Prompts live under version control here; raw output is kept in
assets/art_raw/ (LFS / ignored) so a re-key or a re-tile never needs the model again.

    python3 assets/blender/gen_art.py                 # everything missing
    python3 assets/blender/gen_art.py bloom_blue      # one entry
    python3 assets/blender/gen_art.py --force NAME    # regenerate even if present
    python3 assets/blender/gen_art.py --list          # every entry, kind, output, post
    python3 assets/blender/gen_art.py --crops         # (re)cut the reference crops only
    python3 assets/blender/gen_art.py --no-gen NAME   # re-install from the existing raw

Three kinds of entry, each with its own destination and post-processing:

  texture   -> assets/blender/textures/gen/<out>   materials for the Blender generators
  plate     -> assets/art/<out>                     game-side art the JS hangs on a plane
  refsheet  -> assets/blender/refsheets/<name>.png  orthographic 4-panel sheets for the
                                                    modellers + <name>.measure.json

`dir: "assets/textures"` (optional) overrides a texture's destination directory,
ROOT-relative. The foliage maps nature.js loads at runtime go there rather than to
assets/blender/textures/gen — that directory is a BAKE input and .vercelignore hides
all of assets/blender/ from the deploy, so a runtime texture left in it 404s in
production while working perfectly on localhost.

`post` records what happened to the file between the model and the repo:

  none        installed as generated (single-object textures on a plain ground)
  tile-check  the seams were checked on a 2x2 tile by eye and passed as generated
  tile-blend  the generated image was NOT seamless; made tileable here by offsetting
              half a period on both axes and cross-fading the seams (make_tileable).
              `blend` sets the band as a fraction of the short side (default 0.12)
  key-green   shot on chroma green and keyed to RGBA by chroma_key.py
  key-magenta shot on chroma MAGENTA and keyed to RGBA by chroma_key.py --mode magenta.
              ⚠ Any GREEN subject must be shot this way — see the module docstring of
              chroma_key.py. `bleed` (default 12) floods the subject's colour into the
              transparent region so three's mip chain cannot average magenta into the
              leaf edges.
  frond-atlas key-magenta, then composited into the EXACT layout nature.js's crownGeo
              samples (see frond_atlas()). The only entry that needs it.

`flatten: <frac>` (optional, with `flatten_amount`) high-passes the raw before the
blend — see flatten(). Recorded per entry so a re-install reproduces the file.

House rules baked into the clauses below: every prompt ends with the no-text / no-people
rule (the planner's renders letter the couple as "Feng/Zheng", which is wrong, and the
game draws every word itself), and reference crops come from `_crops` in the manifest so
nothing derived from reference/ that could identify a person is ever needed in the repo
— the crops live in reference/crops/, which .gitignore already covers.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
MANIFEST = HERE / "art_manifest.json"
KEY = HERE / "chroma_key.py"
RAW = ROOT / "assets" / "art_raw"
CROPS = ROOT / "reference" / "crops"
PHOTOS = ROOT / "reference" / "photos"
DEST = {
    "texture": HERE / "textures" / "gen",
    "plate": ROOT / "assets" / "art",
    "refsheet": HERE / "refsheets",
}
GEN = Path.home() / "scripts" / "gcp-media" / "gemini-image.sh"
GEN_REF = Path.home() / "scripts" / "gcp-media" / "gemini-image-ref.py"

# ----------------------------------------------------------------------------- clauses
# What KIND of image this is. One constant per kind so a change to the framing rules
# reaches every entry at once, exactly as seventh-floor's PLATE clause did for its cast.

TILE = (
    " Seamless tileable texture: the material fills the whole square frame edge to edge "
    "and wraps perfectly, so the left edge continues straight into the right edge and the "
    "top edge continues straight into the bottom edge with no visible seam and no repeated "
    "feature. Straight top-down orthographic view, flat even shadowless lighting, no "
    "perspective, no vignette, no border, no frame, no hands, nothing in the frame except "
    "the material itself."
)
FLAT = (
    " Straight top-down orthographic view, flat even soft lighting, no cast shadow, no "
    "vignette, no border, no frame, no other objects in the frame."
)
# `tile: "fill"` — for organic masses. Asking for "seamless tileable" produced a printed
# wallpaper with an internal 3x3 repeat (bloom_blue, first roll); asking for a plain
# edge-to-edge photograph and making it tileable in post (tile-blend) reads as a real
# florist's mass.
FILL = (
    " The material fills the whole square frame edge to edge, continuing past every edge, "
    "every element unique with no repeating pattern. Straight top-down orthographic view, "
    "flat even shadowless lighting, no perspective, no vignette, no border, no frame, no "
    "hands, nothing in the frame except the material itself."
)
GREEN = (
    " Photographed on a flat, solid, evenly lit chroma-key green backdrop that fills every "
    "part of the frame not covered by the subject — no gradient, no shadow on the backdrop, "
    "no floor line, no horizon, no border, no frame."
)
# ⚠ GREEN SUBJECTS ARE SHOT ON MAGENTA. A palm frond on a green screen cannot be keyed
# — the subject IS the backdrop's hue — and a luminance key delivers the matte inverted
# (measured on the test plate: corr(alpha, brightness) = -0.80). Magenta is green's
# opposite, so the same hue ratio separates them cleanly: 58% backdrop, subject mean
# #60782f, backdrop #ee5bb9. Anything magenta or pink in the SUBJECT (bougainvillea)
# must NOT use this — shoot it as an ordinary seamless texture.
MAGENTA = (
    " Photographed on a completely flat, solid, evenly lit bright magenta chroma-key "
    "backdrop — a vivid hot pink-magenta, the same colour in every part of the frame the "
    "subject does not cover — with no gradient, no shading, no shadow cast on the "
    "backdrop, no floor line, no horizon, no border and no frame. Nothing magenta, pink "
    "or purple anywhere on the subject itself."
)
SHEET = (
    " Orthographic reference sheet for a 3D modeller, laid out as ONE SINGLE HORIZONTAL "
    "ROW of exactly four equal panels left to right — NOT a grid, NOT two rows — separated "
    "by thin light-grey vertical divider lines, every panel showing the SAME object at "
    "IDENTICAL height standing on one shared ground line: panel 1 the front orthographic "
    "elevation, panel 2 the left side orthographic elevation, panel 3 the back orthographic "
    "elevation, panel 4 a three-quarter view. Straight-on orthographic projection with no "
    "perspective distortion and no vanishing points, plain white background, even flat "
    "lighting, no cast shadows, no ground texture, no dimension lines, no arrows, no "
    "annotations, no title."
)
NO_TEXT = (
    " There is absolutely no text anywhere in the image: no words, no letters, no numbers, "
    "no labels, no captions, no logos, no watermarks, no signatures, no monograms. No "
    "people, no faces, no hands."
)


def clause(spec):
    kind = spec["kind"]
    if kind == "texture":
        t = spec.get("tile", True)
        c = FILL if t == "fill" else (TILE if t else FLAT)
    elif kind == "plate":
        c = GREEN if spec.get("green") else ""
    elif kind == "refsheet":
        c = SHEET
    else:
        raise SystemExit(f"unknown kind {kind!r}")
    if spec.get("green") and kind != "plate":
        c = GREEN
    if spec.get("magenta"):
        c = MAGENTA
    return c + NO_TEXT


# ----------------------------------------------------------------------------- helpers
def load():
    return json.loads(MANIFEST.read_text())


def run(cmd, env=None):
    e = dict(os.environ)
    if env:
        e.update(env)
    r = subprocess.run([str(c) for c in cmd], env=e, text=True, capture_output=True)
    if r.returncode != 0:
        sys.stderr.write(r.stdout + r.stderr)
        raise SystemExit(f"FAILED: {' '.join(str(c) for c in cmd)}")
    return (r.stdout + r.stderr).strip()


def raw_path(name):
    return RAW / f"{name}.png"


def dest_of(name, spec):
    if spec["kind"] == "refsheet":
        return DEST["refsheet"] / f"{name}.png"
    if spec.get("dir"):
        return ROOT / spec["dir"] / spec["out"]
    return DEST[spec["kind"]] / spec["out"]


# ----------------------------------------------------------------------------- crops
def make_crops(man, only=None):
    """Cut the reference crops the manifest conditions on, from the planner's renders.

    Boxes are FRACTIONS of the source image (x0, y0, x1, y1) so they survive a re-export
    of the render at another resolution. `paint` boxes are filled with the colour sampled
    at `from` — that is how the couple's (wrong) lettering on the dessert counter and the
    "Beverage" cloth are blanked BEFORE the crop is ever shown to the model, so nothing
    it could copy is in the conditioning. Crops never include a person.
    """
    CROPS.mkdir(parents=True, exist_ok=True)
    table = man.get("_crops", {})
    for cname, c in table.items():
        if only and cname not in only:
            continue
        src = PHOTOS / c["src"]
        if not src.exists():
            print(f"  crop {cname}: source {src.name} missing (reference/ is personal media) — skipped")
            continue
        im = Image.open(src).convert("RGB")
        W, H = im.size
        for p in c.get("paint", []):
            sx, sy = p["from"]
            col = im.getpixel((int(sx * W), int(sy * H)))
            x0, y0, x1, y1 = p["box"]
            im.paste(col, (int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
        x0, y0, x1, y1 = c["box"]
        cr = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
        mx = c.get("max", 1024)
        if max(cr.size) > mx:
            s = mx / max(cr.size)
            cr = cr.resize((round(cr.width * s), round(cr.height * s)), Image.LANCZOS)
        cr.save(CROPS / f"{cname}.png", optimize=True)
        print(f"  crop {cname}: {cr.width}x{cr.height} from {src.name}")


# ----------------------------------------------------------------------------- generate
def generate(name, spec, man, force=False):
    RAW.mkdir(parents=True, exist_ok=True)
    raw = raw_path(name)
    if raw.exists() and not force:
        print(f"  {name}: raw exists, skipping generation")
        return raw
    prompt = spec["prompt"].strip() + clause(spec)
    aspect = spec.get("aspect", "1:1")
    size = spec.get("size", "1K")
    refs = [ROOT / r for r in spec.get("refs", [])]
    missing = [r for r in refs if not r.exists()]
    if missing:
        # Crops are derived; rebuild them rather than failing.
        make_crops(man, only={Path(m).stem for m in missing})
        missing = [r for r in refs if not r.exists()]
        if missing:
            raise SystemExit(f"{name}: reference image(s) missing: {[str(m) for m in missing]}")
    tmp = RAW / f"{name}.gen.png"
    if refs:
        print(f"  {name}: generating ({aspect}, {size}) from {[r.name for r in refs]}")
        run([sys.executable, GEN_REF, tmp, prompt, *refs],
            env={"GCP_ASPECT": aspect, "GCP_SIZE": size})
    else:
        print(f"  {name}: generating ({aspect}, {size})")
        run(["bash", GEN, prompt, tmp, aspect, size])
    if not tmp.exists():
        raise SystemExit(f"{name}: generator produced no file")
    tmp.replace(raw)
    return raw


# ----------------------------------------------------------------------------- post
def make_tileable(im: Image.Image, frac: float = 0.12, axis: str = "both") -> Image.Image:
    """Offset half a period on both axes, then cross-fade the original back over the
    resulting centre cross. The borders of the result are the original's centre lines,
    which wrap by construction; the centre of the result is the original's interior,
    which has no seam. The blend band (`frac` of the short side) is where the two meet.

    `axis="y"` (or "x") rolls and cross-fades ONE axis only, leaving the other exactly as
    generated. That is for a plate the model already tiled well on one axis and badly on
    the other: the cross-fade GHOSTS wherever the content has large high-contrast
    features (the croton rosettes doubled visibly across the whole blend cross), so the
    less of it the better, and blending an axis that is already seamless is pure cost.
    """
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    h, w = a.shape[:2]
    rolled = a
    if axis in ("both", "y"):
        rolled = np.roll(rolled, h // 2, axis=0)
    if axis in ("both", "x"):
        rolled = np.roll(rolled, w // 2, axis=1)
    bw = max(2.0, frac * min(h, w))
    ys = np.abs(np.arange(h) - h / 2.0)
    xs = np.abs(np.arange(w) - w / 2.0)
    wy = np.clip(1.0 - ys / bw, 0.0, 1.0) if axis in ("both", "y") else np.zeros(h)
    wx = np.clip(1.0 - xs / bw, 0.0, 1.0) if axis in ("both", "x") else np.zeros(w)
    wgt = np.maximum(wy[:, None], wx[None, :])
    wgt = wgt * wgt * (3.0 - 2.0 * wgt)  # smoothstep
    out = rolled * (1.0 - wgt[..., None]) + a * wgt[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def flatten(im: Image.Image, frac: float = 0.15, amount: float = 1.0) -> Image.Image:
    """High-pass the texture: subtract a wide Gaussian blur and add the mean back.

    A generated fabric or metal sheet carries a slow tone drift across the frame (a
    lighting falloff, a crease, a lighter upper half). tile-blend cannot hide that —
    the cross-fade band inherits the drift on both sides and reads as a faint
    patchwork of squares (linen_ivory, chiffon_white, first install). Removing the
    low frequency first leaves the weave and lets the blend disappear. `frac` is the
    blur radius as a fraction of the short side; `amount` < 1 keeps some of the drift
    (wood figure is low-frequency and wants to survive).
    """
    from PIL import ImageFilter
    rgb = im.convert("RGB")
    r = max(4, int(frac * min(rgb.size)))
    blur = np.asarray(rgb.filter(ImageFilter.GaussianBlur(r)), dtype=np.float32)
    a = np.asarray(rgb, dtype=np.float32)
    mean = a.reshape(-1, 3).mean(axis=0)
    out = a - amount * (blur - mean)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def balance(im: Image.Image, target: str, ref: str = "mean") -> Image.Image:
    """Per-channel gain so the texture's reference colour lands on a palette hex.

    gain = target / reference, applied to every pixel and clipped. `ref` is what is
    measured as the reference: "mean" for a flat material (linen, chiffon, oak — the
    in-engine chair baked from the first oak_light read whitewashed against
    PALETTE.oak), or "p70" (the 70th percentile per channel) for the single heads and
    the bloom masses, which carry their own shading — the lit petals are pushed onto
    the palette and the crevices stay darker instead of the whole image being lifted
    to the mean. Requested by the modelling wave 2026-09-16; the target is recorded
    in `post` as "balanced to #xxxxxx".
    """
    a = np.asarray(im.convert("RGB"), dtype=np.float32)
    flat = a.reshape(-1, 3)
    r = flat.mean(axis=0) if ref == "mean" else np.percentile(flat, 70, axis=0)
    gain = hex_rgb(target) / np.maximum(r, 1.0)
    return Image.fromarray(np.clip(a * gain, 0, 255).astype(np.uint8))


def measure_colour(im: Image.Image):
    a = np.asarray(im.convert("RGB"), dtype=np.float32).reshape(-1, 3)
    f = lambda v: "#%02x%02x%02x" % tuple(int(round(x)) for x in v)
    return f(a.mean(axis=0)), f(np.percentile(a, 70, axis=0))


def tile_preview(im: Image.Image, dst: Path, side: int = 1024):
    """A 2x2 tile at reduced size, for judging the seam with the Read tool."""
    t = im.convert("RGB")
    s = side // 2
    t = t.resize((s, s), Image.LANCZOS)
    sheet = Image.new("RGB", (side, side))
    for dx in (0, s):
        for dy in (0, s):
            sheet.paste(t, (dx, dy))
    sheet.save(dst, optimize=True)


def checker_preview(rgba: Image.Image, dst: Path, side: int = 1024):
    """The keyed plate composed over a DARK and a LIGHT checker, side by side.

    The seventh-floor lesson: a bad matte is invisible in a viewer that shows alpha as
    white, and obvious in game. Two grounds catch both failure modes — fringe that only
    shows on dark, holes that only show on light.
    """
    im = rgba.convert("RGBA")
    s = im.height / max(im.size) * side
    im = im.resize((round(im.width * side / max(im.size)), round(s)), Image.LANCZOS)
    w, h = im.size
    out = Image.new("RGB", (w * 2 + 8, h))
    for i, (a, b) in enumerate(((40, 60), (200, 230))):
        board = Image.new("RGB", (w, h))
        px = board.load()
        cell = 24
        for y in range(h):
            for x in range(w):
                px[x, y] = (a, a, a) if ((x // cell + y // cell) % 2 == 0) else (b, b, b)
        board.paste(im, (0, 0), im)
        out.paste(board, (i * (w + 8), 0))
    out.save(dst, optimize=True)


# --------------------------------------------------------------------------- frond atlas
def _rachis_row(alpha: np.ndarray) -> int:
    """The row the rachis lies on: the row with the most opaque pixels.

    Every leaflet is attached to the rachis, so the rachis row crosses all of them plus
    the bare stem at the butt — it is the maximum of the row-coverage profile by a wide
    margin. Measured, not assumed: the caller prints it and the de-tilt below checks the
    left and right halves against each other.
    """
    return int((alpha > 128).sum(axis=1).argmax())


def frond_atlas(rgba: Image.Image, side: int = 1024, nut_hex: str = "#6a4a2c",
                seed: int = 0x5ea117, dup: float = 0.5, dup_dark: float = 0.72,
                balance_to: str = None):
    """Composite a keyed frond into the EXACT atlas nature.js's crownGeo samples.

    THE LAYOUT IS A CONTRACT, and it is not the one the generator hands you:

      crownGeo (nature.js ~896) writes three UVs per rib — (s, .15), (s, .575), (s, 1) —
      so the blade occupies v .15…1.0 with the RACHIS on v .575, and u runs 0 at the
      frond's butt to 1 at its tip. three uploads with flipY = true, so texture v maps to
      canvas row H*(1 - v):

        v 1.0   -> row 0            the far leaflet tips
        v .575  -> row .425 * H     THE RACHIS
        v .15   -> row .85 * H      the near leaflet tips
        v 0….12 -> rows .88H…H      the opaque coconut patch the nut geometry samples
                                    at uv (.5, .05) — ONE material for the whole crown

      which is exactly what frondTex() draws (`fh = h * .85`, `mid = fh * .5`). Getting
      this wrong does not throw: the frond simply renders with its rachis off-centre and
      its tips cut off, and the nuts render as sky.

    So the keyed plate is de-tilted, measured, and resampled ANISOTROPICALLY — its length
    to the full atlas width, its half-span to .425 * H about the rachis. The anisotropy is
    the point and not a defect: the mesh is 4.6 m long and 0.95 m wide, so a texture that
    is square in pixels is stretched ~4x along the frond, and a photograph laid in
    unstretched would read as a fat leaf.

    RGB under alpha 0 is the atlas's own subject mean, not black and never magenta: three
    mips the colour channels without regard to alpha, so whatever is under the matte is
    averaged into the visible edge at distance (see chroma_key.py --bleed).

    ⚠ `dup` IS NOT A STYLE CHOICE — IT IS WHAT KEEPS DISTANT PALMS ON SCREEN. A real
    frond photographs as a ~50/50 comb of leaflet and gap; measured on this plate, a row
    halfway out along the blade is 0.50 covered. MAT.frond is `alphaTest: .5`, and three
    mips alpha by averaging, so at any distance where the mip footprint spans several
    leaflets that 0.50 lands EXACTLY on the threshold and the frond dissolves — while the
    canvas frondTex it replaces draws an overlapping comb at a 3.4 px pitch and is
    effectively solid (0.67 of the whole atlas opaque). So a second copy of the frond is
    laid UNDER the first, offset by half the measured leaflet pitch and darkened: row
    coverage 0.50 -> 0.67, comfortably clear of the threshold at every mip. It is also
    what frondTex already did for the same reason — "a dark under-comb first, then a
    slightly offset upper comb" — and a coconut palm's leaflets really do stand in two
    ranks, so it reads as the plant rather than as a double exposure.
    """
    im = rgba.convert("RGBA")
    a = np.asarray(im)[..., 3]
    h0, w0 = a.shape
    # de-tilt: compare the rachis row of the left and right thirds
    lo = _rachis_row(np.asarray(im)[:, : w0 // 3, 3])
    hi = _rachis_row(np.asarray(im)[:, -w0 // 3:, 3])
    ang = np.degrees(np.arctan2(hi - lo, w0 * 2 / 3))
    if abs(ang) > 0.4:
        im = im.rotate(ang, resample=Image.BICUBIC, expand=True)
        print(f"    de-tilted {ang:+.2f}deg (rachis rows {lo} -> {hi})")
    arr = np.asarray(im)
    ys, xs = np.nonzero(arr[..., 3] > 8)
    im = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    arr = np.asarray(im)
    H = W = side
    y_r = _rachis_row(arr[..., 3])
    half = max(y_r, arr.shape[0] - 1 - y_r)
    sy = (0.425 * H) / max(half, 1)
    new_h = max(1, int(round(arr.shape[0] * sy)))
    res = im.resize((W, new_h), Image.LANCZOS)
    top = int(round(0.425 * H - y_r * sy))

    rgb_res, alpha_res = res.convert("RGB"), res.getchannel("A")
    if balance_to:
        # ⚠ NOT balance(): its mean is over the whole rectangle, and here three quarters
        # of that rectangle is transparent (black after Pillow's premultiplied resize),
        # so the gain would come out ~4x and blow the blade out. Measure the SUBJECT.
        _a = np.asarray(rgb_res, dtype=np.float32)
        _m = _a[np.asarray(alpha_res) > 200].mean(axis=0)
        rgb_res = Image.fromarray(np.clip(
            _a * (hex_rgb(balance_to) / np.maximum(_m, 1.0)), 0, 255).astype(np.uint8))
    sub = np.asarray(rgb_res, dtype=np.float32)[np.asarray(alpha_res) > 200]
    mean = tuple(int(round(v)) for v in (sub.mean(axis=0) if len(sub) else (60, 110, 45)))

    base = Image.new("RGB", (W, H), mean)        # never black: this is the mip floor
    amap = Image.new("L", (W, H), 0)

    # the under-comb (see the docstring): half a leaflet pitch toward the tip, darker
    if dup:
        av = np.asarray(alpha_res)
        row = av[max(0, int(y_r * sy - 0.45 * 0.425 * H))] > 128
        starts = np.nonzero(row[1:] & ~row[:-1])[0]
        pitch = int(np.median(np.diff(starts))) if len(starts) > 2 else 24
        dx = max(1, int(round(pitch * dup)))
        under = Image.fromarray(
            np.clip(np.asarray(rgb_res, dtype=np.float32) * dup_dark, 0, 255).astype(np.uint8))
        base.paste(under, (dx, top), alpha_res)
        lay = Image.new("L", (W, H), 0)
        lay.paste(alpha_res, (dx, top))
        amap = ImageChops.lighter(amap, lay)
        print(f"    under-comb: leaflet pitch {pitch} px, offset {dx}")
    base.paste(rgb_res, (0, top), alpha_res)
    lay = Image.new("L", (W, H), 0)
    lay.paste(alpha_res, (0, top))
    amap = ImageChops.lighter(amap, lay)

    # the coconut patch (rows .88H…H): opaque husk, seeded so a re-install is identical
    rnd = np.random.default_rng(seed)
    ny0 = int(round(0.88 * H))
    nh = H - ny0
    base_rgb = np.array([int(nut_hex[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)
    field = np.zeros((nh, W, 3), dtype=np.float32) + base_rgb
    # coarse husk blotches + fine fibre, the same read as frondTex's brown patch
    for scale, amp in ((6, 34.0), (24, 20.0), (W // 2, 12.0)):
        n = rnd.normal(0.0, 1.0, (max(2, nh // scale + 2), max(2, W // scale + 2), 1))
        up = np.asarray(Image.fromarray(
            np.clip(n[..., 0] * 64 + 128, 0, 255).astype(np.uint8)).resize((W, nh),
            Image.BICUBIC), dtype=np.float32)
        field += (up[..., None] - 128.0) / 64.0 * amp
    field[:, :, 2] *= 0.86                        # keep it brown, not grey
    band = Image.fromarray(np.clip(field, 0, 255).astype(np.uint8))
    base.paste(band, (0, ny0))
    amap.paste(Image.new("L", (W, nh), 255), (0, ny0))

    out = Image.merge("RGBA", (*base.split(), amap))
    cov = (np.asarray(amap) > 128).mean()
    # leaflet pitch, measured on the row halfway out along the blade
    row = np.asarray(amap)[int(0.425 * H - 0.21 * H)] > 128
    runs = int((row[1:] & ~row[:-1]).sum())
    print(f"    rachis row {int(0.425 * H)}  band top {top}  leaflets on that row {runs}  "
          f"row coverage {row.mean():.2f} (alphaTest .5 needs > .5)  "
          f"atlas coverage {cov * 100:.1f}%  fill #{mean[0]:02x}{mean[1]:02x}{mean[2]:02x}")
    return out


def save_rgba(im: Image.Image, dst: Path, lossless: bool = False, quality: int = 92):
    """⚠ exact=True — libwebp otherwise rewrites the colour of fully transparent pixels."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.suffix.lower() == ".webp":
        im.save(dst, "WEBP", lossless=lossless, quality=quality, method=6, exact=True)
    else:
        im.save(dst, optimize=True)


def resize_max(im: Image.Image, mx: int) -> Image.Image:
    if max(im.size) > mx:
        s = mx / max(im.size)
        im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    return im


def save_out(im: Image.Image, dst: Path, quality: int = 92):
    dst.parent.mkdir(parents=True, exist_ok=True)
    ext = dst.suffix.lower()
    if ext == ".webp":
        im.save(dst, "WEBP", quality=quality, method=6)
    elif ext in (".jpg", ".jpeg"):
        im.convert("RGB").save(dst, quality=quality, optimize=True)
    else:
        im.save(dst, optimize=True)


# ----------------------------------------------------------------------------- measure
def measure(path: Path, labels):
    """Vendored from ~/.claude/skills/refsheet-to-3d/measure_sheet.py, returning data.

    Same algorithm: split the sheet into equal panels, threshold each against its own
    border colour, erode hairline dividers, report height, width/height and the width
    profile at seven height fractions. Only TRUE orthographic panels share a scale —
    the three-quarter panel is excluded from the spread check and never measured for
    proportion (43% off on real sheets while the elevations agreed to 0.3%).
    """
    img = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    H, W, _ = img.shape
    panels = len(labels)
    step = W // panels

    def erode(m, axis, r=3):
        out = m.copy()
        for d in range(1, r + 1):
            out &= np.roll(m, d, axis=axis) | np.roll(m, -d, axis=axis)
        return out

    def analyse(sub):
        ring = np.concatenate([sub[:3].reshape(-1, 3), sub[-3:].reshape(-1, 3),
                               sub[:, :3].reshape(-1, 3), sub[:, -3:].reshape(-1, 3)])
        bg = np.median(ring, axis=0)
        mask = (np.abs(sub - bg).sum(axis=2) > 42)
        mask = erode(erode(mask, 1), 0)
        rows = np.where(mask.sum(axis=1) > sub.shape[1] * 0.012)[0]
        cols = np.where(mask.sum(axis=0) > sub.shape[0] * 0.012)[0]
        if len(rows) < 5 or len(cols) < 5:
            return None
        top, bot, left, right = rows[0], rows[-1], cols[0], cols[-1]
        h, w = int(bot - top + 1), int(right - left + 1)
        prof = {}
        for f in (0.05, 0.15, 0.3, 0.5, 0.7, 0.85, 0.95):
            y = int(top + f * (h - 1))
            xs = np.where(mask[y])[0]
            prof[str(f)] = round(float(xs[-1] - xs[0] + 1) / h, 3) if len(xs) else 0.0
        return dict(height_px=h, width_px=w, width_over_height=round(w / h, 3),
                    width_profile=prof,
                    bbox_px=[int(left), int(top), int(right), int(bot)])

    out = {}
    for i, lab in enumerate(labels):
        out[lab] = analyse(img[:, i * step:(i + 1) * step])
    ref_only = ("threequarter", "3q", "perspective", "hero", "detail")
    ortho = {k: v for k, v in out.items() if v and not any(t in k.lower() for t in ref_only)}
    hs = [v["height_px"] for v in ortho.values()]
    verdict = None
    spread = None
    if len(hs) > 1:
        spread = round((max(hs) / min(hs) - 1) * 100, 1)
        verdict = "TRUSTWORTHY" if spread <= 3 else "DO NOT MEASURE — regenerate the sheet"
    return dict(sheet=str(path.name), size=[W, H], panels=out,
                ortho_height_spread_pct=spread, verdict=verdict)


# ----------------------------------------------------------------------------- install
def install(name, spec):
    raw = raw_path(name)
    if not raw.exists():
        raise SystemExit(f"{name}: no raw at {raw}")
    kind = spec["kind"]
    # `post` is "<mode>[; <record>...]" — the first token drives the install, the rest
    # is a record of what else was done (e.g. "tile-blend; balanced to #c3a37c").
    post = spec.get("post", "none").split(";")[0].strip()
    dest = dest_of(name, spec)
    dest.parent.mkdir(parents=True, exist_ok=True)

    if kind == "refsheet":
        im = resize_max(Image.open(raw).convert("RGB"), spec.get("max", 2048))
        im.save(dest, optimize=True)
        labels = spec.get("panels", ["front", "side", "back", "threequarter"])
        m = measure(dest, labels)
        mp = dest.with_suffix(".measure.json")
        mp.write_text(json.dumps(m, indent=2))
        print(f"  {dest.name}  {im.width}x{im.height}  spread={m['ortho_height_spread_pct']}%  "
              f"{m['verdict']}")
        return

    if post == "frond-atlas":
        tmp = RAW / f"{name}.keyed.png"
        run([sys.executable, KEY, raw, tmp, "--mode", "magenta", "--pad", "0",
             "--max", str(spec.get("max", 2048)), "--bleed", str(spec.get("bleed", 12)),
             *(["--erode", str(spec["erode"])] if spec.get("erode") else [])])
        im = frond_atlas(Image.open(tmp), side=spec.get("side", 1024),
                         nut_hex=spec.get("nut", "#6a4a2c"),
                         dup=spec.get("dup", 0.5), dup_dark=spec.get("dup_dark", 0.72),
                         balance_to=(spec.get("balance") or {}).get("target"))
        save_rgba(im, dest, lossless=spec.get("lossless", False),
                  quality=spec.get("quality", 92))
        checker_preview(im, RAW / f"{name}.check.png")
        print(f"  {dest.name}  {im.width}x{im.height}  post={post}  "
              f"{dest.stat().st_size // 1024} KB")
        return

    if post in ("key-green", "key-magenta"):
        args = [sys.executable, KEY, raw, dest, "--max", str(spec.get("max", 2048))]
        if post == "key-magenta":
            args += ["--mode", "magenta", "--bleed", str(spec.get("bleed", 12))]
        for k in ("tol", "soft", "despill", "pad"):
            if k in spec:
                args += [f"--{k}", str(spec[k])]
        if spec.get("crop") is False:
            args.append("--nocrop")
        if spec.get("mode"):
            args += ["--mode", spec["mode"]]
        if spec.get("unmix"):
            args.append("--unmix")
        if spec.get("erode"):
            args += ["--erode", str(spec["erode"])]
        print("  " + run(args).replace("\n", "\n  "))
        checker_preview(Image.open(dest), RAW / f"{name}.check.png")
        return

    im = Image.open(raw).convert("RGB")
    if spec.get("flatten"):
        im = flatten(im, spec["flatten"], spec.get("flatten_amount", 1.0))
    if post == "tile-blend":
        im = make_tileable(im, spec.get("blend", 0.12), spec.get("blend_axis", "both"))
    im = resize_max(im, spec.get("max", 1024))
    colour = ""
    if spec.get("balance"):
        b = spec["balance"]
        im = balance(im, b["target"], b.get("ref", "mean"))
        mean, p70 = measure_colour(im)
        colour = f"  balanced -> mean {mean} p70 {p70} (target {b['target']}, ref {b.get('ref', 'mean')})"
    save_out(im, dest, spec.get("quality", 92))
    if post in ("tile-check", "tile-blend"):
        tile_preview(im, RAW / f"{name}.tile.png")
    print(f"  {dest.name}  {im.width}x{im.height}  post={spec.get('post', 'none')}{colour}")


# ----------------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("names", nargs="*")
    ap.add_argument("--force", action="store_true", help="regenerate even if the raw exists")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--crops", action="store_true", help="only (re)cut the reference crops")
    ap.add_argument("--no-gen", action="store_true", help="re-install from the existing raw")
    a = ap.parse_args()

    man = load()
    entries = {k: v for k, v in man.items() if not k.startswith("_")}

    if a.list:
        for k, v in entries.items():
            d = dest_of(k, v).relative_to(ROOT)
            refs = len(v.get("refs", []))
            print(f"{k:26s} {v['kind']:8s} {str(d):48s} post={v.get('post', 'none'):10s} "
                  f"{v.get('aspect', '1:1'):5s} {v.get('size', '1K'):3s} refs={refs}")
        return

    if a.crops:
        make_crops(man, only=set(a.names) or None)
        return

    names = a.names or list(entries)
    for n in names:
        if n not in entries:
            raise SystemExit(f"unknown entry: {n}")
    names = [n for n in entries if n in names]

    # One entry failing (a 429 after retries, or the model answering text-only with
    # finishReason IMAGE_RECITATION — see linen_ivory/oak_light notes in the manifest)
    # must not take the rest of the batch down with it: generate what can be generated,
    # install what has a raw, report the failures at the end, exit non-zero.
    failed = []
    if not a.no_gen:
        for n in names:
            print(f"[{n}]", flush=True)
            try:
                generate(n, entries[n], man, force=a.force)
            except SystemExit as e:
                print(f"  {n}: FAILED — {str(e)[:160]}", flush=True)
                failed.append(n)

    print("[install]", flush=True)
    for n in names:
        if n in failed or not raw_path(n).exists():
            continue
        install(n, entries[n])
    if failed:
        print(f"[failed] {' '.join(failed)}  (re-run: gen_art.py {' '.join(failed)})")
        sys.exit(2)


if __name__ == "__main__":
    main()
