"""coconut_rack — the white arched shelving rack of young coconuts
(decor-beverage-coconut.jpg, left; refsheets/coconut_rack.png).

Spec row: 4 uprights Ø .026 at x ±.34, z ±.24, h 2.04; 4 shelves .74 × .54 × .035
at y .42 / .90 / 1.38 / 1.86; a semicircular arch r .36 on top; 2–3 green young
coconuts (Ø .25, cut flat tops) per shelf. Origin floor centre; front −Z.
Budget 4,000 / 512 / bevel 0, AO_DIST .15 (shelves are an interior).

Two arches (front and back, as the reference sheet's three-quarter shows) spring
from the uprights and are tied across the top. Coconuts are lathes with the
flat cut top as a separate `coconut_cut` disc; each shelf gets 2 or 3 with a
seeded offset and yaw so no two read the same.
"""
import math
import wv_lib as L

NAME = "coconut_rack"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.15
AO_STRENGTH = 0.5
TRIS = 4000
FRONT = "-Z"
ORIGIN = "floor"

UP_R, UP_H = 0.013, 2.04
UX, UY = 0.34, 0.24
SHELF = (0.74, 0.54, 0.035)
SHELF_Z = (0.42, 0.90, 1.38, 1.86)
ARCH_R = 0.36
COCO_R = 0.125


def _coconut(i, x, y, z, rnd):
    r = COCO_R * rnd.uniform(0.94, 1.04)
    h = r * 1.85
    prof = [(0, 0), (r * 0.55, 0), (r * 0.88, h * 0.13), (r, h * 0.36), (r * 0.97, h * 0.62),
            (r * 0.82, h * 0.85), (r * 0.56, h), (0, h)]
    body = L.lathe(f"coco{i}", prof, (x, y, z), "coconut", n=12, rot=(0, 0, rnd.uniform(0, 360)))
    cut = L.cyl(f"cut{i}", r * 0.55, 0.006, (x, y, z + h), "coconut_cut", n=12)
    return [body, cut]


def _arch(y):
    parts = []
    n = 10
    pts = []
    for j in range(n + 1):
        a = math.pi * j / n
        pts.append((-ARCH_R * math.cos(a), y, UP_H + ARCH_R * math.sin(a)))
    for j in range(n):
        parts.append(L.strut(f"arch{y:+.2f}_{j}", pts[j], pts[j + 1], UP_R * 0.85, "paint_w", n=7))
    return parts


def build():
    rnd = L.rng(NAME)
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts.append(L.cyl(f"up{sx}{sy}", UP_R, UP_H, (sx * UX, sy * UY, UP_H / 2), "paint_w", n=8))
            parts.append(L.cyl(f"foot{sx}{sy}", UP_R * 1.6, 0.01, (sx * UX, sy * UY, 0.005), "paint_w", n=8))
    for k, z in enumerate(SHELF_Z):
        parts.append(L.box(f"shelf{k}", SHELF, (0, 0, z - SHELF[2] / 2), "paint_w"))
        # a fine lip rail along the front and back of each shelf
        for sy in (-1, 1):
            parts.append(L.cyl(f"rail{k}{sy}", 0.008, SHELF[0], (0, sy * (SHELF[1] / 2 - 0.01), z + 0.01), "paint_w", n=6, rot=(0, 90, 0)))
    # the top: two arches + side ties at the uprights' heads
    for sy in (-1, 1):
        parts += _arch(sy * UY)
        parts.append(L.cyl(f"head{sy}", UP_R * 0.85, 2 * UX, (0, sy * UY, UP_H), "paint_w", n=7, rot=(0, 90, 0)))
    for sx in (-1, 1):
        parts.append(L.cyl(f"tie{sx}", UP_R * 0.85, 2 * UY, (sx * UX, 0, UP_H), "paint_w", n=7, rot=(90, 0, 0)))
    # coconuts: 2–3 per shelf
    counts = (2, 3, 3, 2)
    ci = 0
    for k, z in enumerate(SHELF_Z):
        n = counts[k]
        xs = [(-0.16, 0.17), (-0.22, 0.0, 0.22)][n - 2]
        for x in xs:
            parts += _coconut(ci, x + rnd.uniform(-0.02, 0.02), rnd.uniform(-0.06, 0.06), z, rnd)
            ci += 1
    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=40)
    return root
