"""cocktail_drinks — everything OPAQUE in and on the fifteen cocktails on the
round bar: the four liquids, the coconut foam, the ice, and the garnishes.
KAN-208 wave 3; the glass shells are `cocktail_glassware` (geometry only, the
game's glassPale) — see generators/_drinks.py for why it is two assets.

BAKED like any prop (albedo × AO, one material), because nothing here is
transparent: the liquid is modelled as the solid the glass's inner face
bounds up to the fill line, 1.2 mm inside the wall, so the glassPale shell
draws over it and the colour reads through the glass.

  spritz ×4   aperol to 17 cm in the bowl; a pink-grapefruit half-wheel
              against the far wall breaking the surface; a rosemary sprig
              standing up out of the glass (decor-cocktail-menu art)
  tall ×3     cranberry-coconut pink; a 1.2 cm coconut-foam cap; a mint leaf
              and a sliver of pink fruit on the rim
  highball ×4 rum yellow in the 10-facet glass (the liquid is faceted too, so
              it never pokes through a facet's middle); a mint sprig and half
              a passion fruit on top
  rocks ×4    amber to 7 cm; two ice cubes breaking the surface; an orange
              twist over the rim

Origin = the bar TOP at its centre (join origin=None) — same frame and
placement as cocktail_glassware. Draws a seeded rng for garnish yaw only.
"""
import math
import wv_lib as L
import _drinks as D

NAME = "cocktail_drinks"
ATLAS = 512
BEVEL = 0
AO_DIST = 0.08
AO_STRENGTH = 0.35
TRIS = 6500
FRONT = "-Z"
ORIGIN = "base"


def _leaf(name, c, length, width, yaw, pitch, key):
    """a small flat leaf: a lens-shaped prism, base at `c`, pointing (yaw, pitch)"""
    pts = []
    for k in range(7):
        t = k / 6
        pts.append((t * length, math.sin(t * math.pi) * width / 2))
    for k in range(5, 0, -1):
        t = k / 6
        pts.append((t * length, -math.sin(t * math.pi) * width / 2))
    o = L.prism(name, pts, 0.0015, (0, 0, 0), key)
    # Euler XYZ: tip the leaf's length (+X) up by `pitch` about Y, then yaw it
    o.rotation_euler = (0, -pitch, yaw)
    o.location = c
    return o


def build():
    rnd = L.rng(NAME)
    parts = []
    for i, (kind, x, z) in enumerate(D.POS):
        bx, by = x, -z
        n = D.N_FACET if kind == "highball" else D.N_ROUND
        prof = D.liquid_profile(kind)
        if kind == "highball":                     # inscribed in the facets
            prof = [(r * 0.94, zz) for (r, zz) in prof]
        parts.append(D.lathe(f"liq{i}", prof, (bx, by, 0), D.LIQUID[kind], n=n))
        fill = D.FILL[kind]
        rim = D.OUTER[kind][-1][1]
        rr = D.radius_at(kind, fill)
        yaw = rnd.uniform(0, 2 * math.pi)
        cx, sy = math.cos(yaw), math.sin(yaw)
        if kind == "spritz":
            # grapefruit half-wheel against the far wall, standing, half above the surface
            wx, wy = bx + cx * rr * 0.45, by + sy * rr * 0.45
            wheel = L.cyl(f"gf{i}", 0.027, 0.008, (wx, wy, fill), "grapefruit", n=12,
                          rot=(90, 0, math.degrees(yaw) + 90))
            rind = L.cyl(f"gr{i}", 0.030, 0.006, (wx, wy, fill - 0.001), "rind", n=12,
                         rot=(90, 0, math.degrees(yaw) + 90))
            parts += [wheel, rind]
            # rosemary: a stem from the bowl up past the rim, needles along its top half
            a = (bx - cx * rr * 0.3, by - sy * rr * 0.3, fill - 0.03)
            b = (bx - cx * rr * 0.9, by - sy * rr * 0.9, rim + 0.07)
            parts.append(L.strut(f"rs{i}", a, b, 0.0016, "herb", n=4))
            for k in range(9):
                t = 0.45 + k * 0.06
                p = tuple(a[j] + (b[j] - a[j]) * t for j in range(3))
                s = 1 if k % 2 else -1
                q = (p[0] + s * 0.012 * sy, p[1] - s * 0.012 * cx, p[2] + 0.008)
                parts.append(L.strut(f"rn{i}{k}", p, q, 0.0018, "herb", n=3))
        elif kind == "tall":
            foam = [(0.0, fill - 0.002)] + [(D.radius_at(kind, fill) - 0.0012, fill - 0.002),
                                           (D.radius_at(kind, fill + 0.012) - 0.0012, fill + 0.010),
                                           (D.radius_at(kind, fill + 0.012) * 0.7, fill + 0.014),
                                           (0.0, fill + 0.015)]
            parts.append(D.lathe(f"foam{i}", foam, (bx, by, 0), "foam", n=n))
            r2 = D.OUTER[kind][-1][0]
            parts.append(_leaf(f"tl{i}", (bx + cx * r2, by + sy * r2, rim - 0.01), 0.045, 0.020,
                               yaw, math.radians(70), "mint"))
            parts.append(L.cyl(f"ts{i}", 0.018, 0.005, (bx + cx * r2 * 0.8, by + sy * r2 * 0.8, rim + 0.01),
                               "grapefruit", n=10, rot=(70, 0, math.degrees(yaw))))
        elif kind == "highball":
            for k in range(4):
                a = yaw + k * 1.6
                parts.append(_leaf(f"hm{i}{k}", (bx + math.cos(a) * 0.006, by + math.sin(a) * 0.006, fill + 0.012),
                                   0.034, 0.018, a, math.radians(35 + 12 * k), "mint"))
            pf = [(0.0, 0.0), (0.012, 0.002), (0.019, 0.010), (0.020, 0.018), (0.0, 0.018)]
            half = D.lathe(f"pf{i}", pf, (0, 0, 0), "passion", n=10)
            half.location = (bx + cx * 0.02, by + sy * 0.02, fill + 0.004)
            half.rotation_euler = (math.radians(-25) * cx, math.radians(25) * sy, 0)
            parts.append(half)
            parts.append(L.cyl(f"pfp{i}", 0.0175, 0.002, (0, 0, 0), "rum_yellow", n=10))
            parts[-1].location = (bx + cx * 0.02, by + sy * 0.02, fill + 0.0225)
            parts[-1].rotation_euler = half.rotation_euler
        elif kind == "rocks":
            for k in range(2):
                a = yaw + k * 2.4
                c = (bx + math.cos(a) * rr * 0.4, by + math.sin(a) * rr * 0.4, fill - 0.004 + k * 0.004)
                parts.append(L.box(f"ice{i}{k}", (0.028, 0.028, 0.026), c, "ice",
                                   rot=(rnd.uniform(-15, 15), rnd.uniform(-15, 15), math.degrees(a))))
            # the orange twist: a thin strip over the rim, down into the drink
            r2 = D.OUTER[kind][-1][0]
            p0 = (bx + cx * r2 * 0.5, by + sy * r2 * 0.5, fill - 0.01)
            p1 = (bx + cx * r2 * 1.02, by + sy * r2 * 1.02, rim + 0.012)
            p2 = (bx + cx * r2 * 1.25, by + sy * r2 * 1.25, rim - 0.02)
            parts.append(L.bar(f"tw{i}a", p0, p1, 0.012, 0.002, "peel"))
            parts.append(L.bar(f"tw{i}b", p1, p2, 0.012, 0.002, "peel"))
    root = L.join(parts, NAME, origin=None)
    L.shade_smooth(root, angle=35)
    return root
