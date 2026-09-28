#!/usr/bin/env python3
"""derive_lo.py — the PHONE tier's GLBs (KAN-235).

    python3 assets/blender/derive_lo.py            # every GLB with an atlas > 1024
    python3 assets/blender/derive_lo.py --check    # report stale / missing, write nothing

Run with the SYSTEM python3 (Pillow), not Blender's. For every GLB in
assets/models/models.json whose embedded atlas is larger than LO_MAX (ten of the
twelve 2048² architecture atlases — EXCLUDE keeps two), writes assets/models/lo/<name>.glb: the SAME GLB —
same JSON, same Draco geometry, same material — with only the atlas resampled to
LO_MAX (Lanczos) and re-encoded as WebP q80 (export_all.py's own setting). Then
assets/models/lo/lo.json records, per name, the hi GLB's byte size + tris it was
derived from. js/models.js uses a lo GLB ONLY on the phone tier (js/perftier.js)
and ONLY when that record still matches models.json — so a re-exported hi GLB
whose lo twin was not re-derived falls back to the hi one by itself, never to a
stale atlas on the new geometry.

Why: on a phone the twelve 2048² atlases are 256 MiB of the ~670 MiB of GPU
textures (w × h × 4 B × 4/3 mips) and 2.6 MB of the download; the ten twins save
160 MiB and 1.2 MB. The mip chain below 1024 is the same image, so anything that
samples below mip 0 (everything more than a few metres away on a 390 px screen)
renders the same texels. See CLAUDE.md "PERFORMANCE — KAN-235" for the
side-by-sides.

⚠ After export_all.py re-exports any of these GLBs, re-run this script (the
--check mode lists what is stale); until then the phone gets the hi GLB."""
import io
import json
import struct
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
MODELS = HERE.parent / 'models'
LO = MODELS / 'lo'
LO_MAX = 1024
# Kept at 2048 on the phone too — judged in tools/perf-lo-ab.mjs (the exact
# in-page A/B at 390 px): at 1024 the walkway pergola's fine vertical corten
# streaks (the wave-A2 look pass) smear, and the island bar's photographed
# thatch — already atlas-starved (UV_WEIGHT) — goes visibly soft under the roof.
EXCLUDE = {'walkway_pergola', 'island_bar'}
QUALITY = 80


def read_glb(p):
    b = p.read_bytes()
    magic, ver, length = struct.unpack('<III', b[:12])
    assert magic == 0x46546C67 and ver == 2, p
    jlen, jtype = struct.unpack('<II', b[12:20])
    j = json.loads(b[20:20 + jlen])
    off = 20 + jlen
    blen, btype = struct.unpack('<II', b[off:off + 8])
    assert btype == 0x004E4942
    return j, b[off + 8:off + 8 + blen]


def write_glb(p, j, views):
    """views: list of bytes, one per bufferView, in index order."""
    out = bytearray()
    for i, data in enumerate(views):
        while len(out) % 4:
            out.append(0)
        j['bufferViews'][i]['byteOffset'] = len(out)
        j['bufferViews'][i]['byteLength'] = len(data)
        out += data
    while len(out) % 4:
        out.append(0)
    j['buffers'][0]['byteLength'] = len(out)
    js = json.dumps(j, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(out)
    p.write_bytes(struct.pack('<III', 0x46546C67, 2, total)
                  + struct.pack('<II', len(js), 0x4E4F534A) + js
                  + struct.pack('<II', len(out), 0x004E4942) + bytes(out))


def main():
    check = '--check' in sys.argv
    manifest = json.loads((MODELS / 'models.json').read_text())
    rec_path = LO / 'lo.json'
    old = json.loads(rec_path.read_text()) if rec_path.exists() else {}
    rec, stale = {}, []
    for name, info in manifest.items():
        j, binchunk = read_glb(MODELS / f'{name}.glb')
        imgs = j.get('images') or []
        big = []
        for im in imgs:
            bv = j['bufferViews'][im['bufferView']]
            o = bv.get('byteOffset', 0)
            data = binchunk[o:o + bv['byteLength']]
            w, h = Image.open(io.BytesIO(data)).size
            if max(w, h) > LO_MAX:
                big.append((im, data, w, h))
        if not big or name in EXCLUDE:
            continue
        want = {'srcBytes': info['bytes'], 'srcTris': info.get('tris')}
        prev = old.get(name)
        if check:
            if not prev or prev.get('srcBytes') != want['srcBytes'] or prev.get('srcTris') != want['srcTris'] \
                    or not (LO / f'{name}.glb').exists():
                stale.append(name)
            continue
        views = []
        for i, bv in enumerate(j['bufferViews']):
            o = bv.get('byteOffset', 0)
            views.append(binchunk[o:o + bv['byteLength']])
        for im, data, w, h in big:
            s = LO_MAX / max(w, h)
            src = Image.open(io.BytesIO(data))
            mode = 'RGBA' if src.mode in ('RGBA', 'LA', 'P') else 'RGB'
            small = src.convert(mode).resize((round(w * s), round(h * s)), Image.LANCZOS)
            buf = io.BytesIO()
            small.save(buf, 'WEBP', quality=QUALITY, method=6)
            views[im['bufferView']] = buf.getvalue()
            im['mimeType'] = 'image/webp'
        LO.mkdir(exist_ok=True)
        write_glb(LO / f'{name}.glb', j, views)
        size = (LO / f'{name}.glb').stat().st_size
        rec[name] = {**want, 'bytes': size, 'atlas': LO_MAX}
        print(f'{name:28s} {info["bytes"]:>9,} → {size:>9,} B')
    if check:
        print('stale / missing:', stale or 'none')
        sys.exit(1 if stale else 0)
    rec_path.write_text(json.dumps(rec, indent=1, sort_keys=True) + '\n')
    print(f'{len(rec)} lo GLBs · {sum(r["srcBytes"] for r in rec.values()):,} → {sum(r["bytes"] for r in rec.values()):,} B')


if __name__ == '__main__':
    main()
