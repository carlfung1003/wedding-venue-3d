"""_resort — helpers shared by Group E (the resort furniture, the follow-on to
KAN-207's wedding props).

Files starting with `_` are skipped by make_masters.py. Nothing in wv_lib or in
_seating is patched — `tex` and `metric_uv` are re-exported from _seating so the
two groups tint generated textures the same way.

  tex / metric_uv / slab / sweep / circle / rrect   re-exported from _seating
  loft(...)            a closed bmesh loft through a list of 2-D sections — the
                       kayak hull, a lounger's raked back, anything with a
                       varying cross-section.
  pleat_sheet(...)     a hanging cloth panel with soft vertical pleats and a
                       slightly wavy hem (the daybed's back drapes). Flat in the
                       plane named by `plane`; solidify it if it must be seen
                       from behind.
  gathered(...)        a curtain TIED BACK against a post: a fluted column of
                       fabric, pinched at the tie height and flaring below.
  slats(...)           a run of evenly spaced boxes — lounger decks, chair backs,
                       the daybed's base rails.
"""
import math, bmesh
import wv_lib as L
from _seating import tex, metric_uv, slab, sweep, circle, rrect, dielectric, soft_cloth  # noqa: F401


def loft(name, sections, mat, close_start=True, close_end=True):
    """Loft a closed tube through `sections`, each a list of (x, y, z) points of
    the SAME length, ordered consistently around the section."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in sec] for sec in sections]
    n = len(rings[0])
    for j in range(len(rings) - 1):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            try:
                bm.faces.new([A[i], A[i2], B[i2], B[i]])
            except ValueError:
                pass
    if close_start:
        try:
            bm.faces.new(rings[0][::-1])
        except ValueError:
            pass
    if close_end:
        try:
            bm.faces.new(rings[-1])
        except ValueError:
            pass
    o = L.from_bmesh(name, bm, (0, 0, 0), mat)
    L._orient_normals(o)
    return o


def pleat_sheet(name, w, h, mat, pos=(0, 0, 0), plane="xz", cols=17, rows=7,
                pleats=5, depth=0.028, hem_wave=0.02, taper=0.0, rnd=None, seed=0.0):
    """A hanging cloth panel: `w` across, `h` down from z = 0 (so pos is the
    TOP-CENTRE). Soft vertical pleats whose depth grows toward the hem, a wavy
    hem, and an optional outward `taper` (the hem is `taper` wider each side).
    plane 'xz' lies in XZ (the sheet's normal is Y); 'yz' lies in YZ."""
    bm = bmesh.new()
    ph = rnd.uniform(0, 2 * math.pi) if rnd else seed
    rings = []
    for j in range(rows + 1):
        t = j / rows
        z = -h * t
        amp = depth * (t ** 1.2)
        ring = []
        for i in range(cols):
            u = i / (cols - 1)
            a = (u - 0.5) * (w + 2 * taper * t)
            fold = math.sin(pleats * 2 * math.pi * u + ph) + 0.4 * math.sin(2.0 * pleats * 2 * math.pi * u + 1.3)
            off = amp * fold
            zz = z + (hem_wave * t * t * (0.5 + 0.5 * math.cos(pleats * 2 * math.pi * u + ph)))
            ring.append((a, off, zz) if plane == "xz" else (off, a, zz))
        rings.append([bm.verts.new(p) for p in ring])
    for j in range(rows):
        A, B = rings[j], rings[j + 1]
        for i in range(cols - 1):
            bm.faces.new([A[i], A[i + 1], B[i + 1], B[i]])
    return L.from_bmesh(name, bm, pos, mat)


def gathered(name, pos, h, r_top, r_mid, r_bot, mat, n=10, flutes=5, rows=9):
    """A curtain TIED BACK at a post: a fluted column of fabric hanging from
    z = 0 down to −h, pinched to `r_mid` at 55 % of the drop and flaring to
    `r_bot`. `pos` is the hang point."""
    bm = bmesh.new()
    rings = []
    for j in range(rows + 1):
        t = j / rows
        # radius profile: top → the tie → the flared hem
        if t < 0.55:
            k = t / 0.55
            rr = r_top + (r_mid - r_top) * (k ** 1.5)
        else:
            k = (t - 0.55) / 0.45
            rr = r_mid + (r_bot - r_mid) * (k ** 0.75)
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            flute = 1.0 + 0.16 * math.sin(flutes * a + 2.2 * t)
            ring.append(bm.verts.new((math.cos(a) * rr * flute,
                                      math.sin(a) * rr * flute,
                                      -h * t)))
        rings.append(ring)
    for j in range(rows):
        A, B = rings[j], rings[j + 1]
        for i in range(n):
            i2 = (i + 1) % n
            bm.faces.new([A[i], A[i2], B[i2], B[i]])
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    return L.from_bmesh(name, bm, pos, mat)


def slats(prefix, count, axis, span, other, size, z, mat, rot=(0, 0, 0)):
    """`count` boxes of `size` spread evenly over `span` = (lo, hi) along `axis`
    (0 = x, 1 = y); `other` is the fixed coordinate on the other horizontal axis.
    Returns the list."""
    out = []
    lo, hi = span
    for i in range(count):
        t = 0.5 if count == 1 else i / (count - 1)
        c = lo + (hi - lo) * t
        pos = (c, other, z) if axis == 0 else (other, c, z)
        out.append(L.box(f"{prefix}{i}", size, pos, mat, rot=rot))
    return out
