"""atrium_portal — the atrium's framed way through to the PRESIDENTIAL SUITE, and
its 2F twin, the check-in walkway's door onto the upper gallery (KAN-211 wave C).

Two GLBs from one module, both SITE-frame singletons in the atrium frame
(origin (SITE.ATRIUM.cx, 0, cz) = (8, 0, −41)), each ONE identity instance:

  atrium_portal        replaces atrium.js buildPortal's two M.column piers, the
                       M.darkWall header and the copper reveal. KEPT (game
                       meshes): the warm E.portalStrip line and the lit plaque.
  atrium_portal_link   replaces buildLinkDoor's piers, header, copper band and
                       threshold (2F, y0 = H1). KEPT: its warm strip.

⚠ THE HOLE IS RE-DERIVED WITH atrium.js's OWN ARITHMETIC, not typed: the
facade divides the south wall into n = round(w / module) bays and drops every
bay whose span touches the requested gap, so the hole is the gap rounded OUT to
whole bays (buildFacade's `inGap`). The portal's request is PORTAL {x0 −5, x1 5}
(an atrium.js literal — mirrored here as PORTAL; change one, change both); the
link's is ARRIVAL_ATRIUM_DOOR.along ± DOOR_EPS, a single bay. atrium.js
checks the live hole against these numbers in the console (see buildPortal).

The language is atrium_door's (wave B): honed black stone piers laid in
courses with real joints, a stone lintel with a projecting architrave, a
copper reveal, a stone threshold — plus, for the portal, the two slim bronze
hangers the plaque now hangs from (it floated), and a honed stone path across
the 1.5 m of grass between the portal and the suite's north doors.
"""
import wv_lib as L
import _arch as A

NAME = "atrium_portal"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.4
AO_STRENGTH = 0.5
TRIS = 3000
FRONT = "-Z"
ORIGIN = "site"
PACK_SHAPE = "CONCAVE"
UV_WEIGHT = {"at_joint": 0.05}

PORTAL = (-5.0, 5.0)        # atrium.js `const PORTAL = { x0: -5, x1: 5 }`
WALL_T = 0.30               # atrium.js WALL_T
DOOR_EPS = 0.05             # atrium.js DOOR_EPS (a single bay either way)


def hole(T, span):
    """buildFacade's inGap(), for the SOUTH wall (ox = cx, dx = +1)."""
    n = max(4, round(T["w"] / T["module"]))
    mw = T["w"] / n
    a, b = span[0] - T["cx"], span[1] - T["cx"]
    lo, hi = float("inf"), float("-inf")
    for i in range(n):
        lx = -T["w"] / 2 + (i + .5) * mw
        if lx + mw * .5 > a and lx - mw * .5 < b:
            lo, hi = min(lo, lx - mw * .5), max(hi, lx + mw * .5)
    return T["cx"] + lo, T["cx"] + hi


def pier(parts, name, xa, xb, y0, y1, za, zb, courses):
    parts.append(A.box(f"{name}core", xa + .006, xb - .006, y0, y1, za + .006, zb - .006, "at_joint"))
    for i in range(courses):
        ya = y0 + (y1 - y0) * i / courses
        yb = y0 + (y1 - y0) * (i + 1) / courses - .008
        c = A.box(f"{name}{i}", xa, xb, ya, yb, za, zb, "at_col")
        L.bevel([c], width=.005, segments=1)
        parts.append(c)


def build():
    T = A.atrium()
    S = A.suite()
    H1, Z1 = T["H1"], T["Z1"]
    hx0, hx1 = hole(T, PORTAL)
    parts = []
    with A.frame("atrium"):
        pw, d = .9, WALL_T + .5                      # buildPortal's pier + depth
        za, zb = Z1 - d / 2, Z1 + d / 2
        hh = H1
        pier(parts, "pw", hx0 - pw, hx0, 0, hh - .62, za, zb, 3)
        pier(parts, "pe", hx1, hx1 + pw, 0, hh - .62, za, zb, 3)
        # the lintel (header .62 deep as before) + a projecting architrave both faces
        lt = A.box("lintel", hx0 - pw, hx1 + pw, hh - .62, hh, za, zb, "at_col")
        L.bevel([lt], width=.005, segments=1)
        parts.append(lt)
        for f, z in ((-1, za), (1, zb)):
            zz = sorted((z, z + f * .035))
            ar = A.box(f"arch{f}", hx0 - .10, hx1 + .10, hh - .76, hh - .62, zz[0], zz[1], "at_col_b")
            L.bevel([ar], width=.006, segments=1)
            parts.append(ar)
            for s, x in ((-1, hx0), (1, hx1)):
                xa, xb = sorted((x, x - s * .10))
                j = A.box(f"archj{f}{s}", xa, xb, 0, hh - .62, zz[0], zz[1], "at_col_b")
                L.bevel([j], width=.006, segments=1)
                parts.append(j)
        # the copper reveal lining the head (buildPortal: hh − .66, .1 tall)
        parts.append(A.box("copper", hx0, hx1, hh - .71, hh - .62, za - .02, zb + .02, "at_copper"))
        # threshold across the hole
        th = A.box("thresh", hx0 - .05, hx1 + .05, 0, .02, za - .05, zb + .05, "at_col_b")
        parts.append(th)
        # the plaque's hangers: buildPortal hangs a 1.9 × .48 plane at
        # (cx, hh − 1.35, z − .32), i.e. top at hh − 1.11
        cx = (hx0 + hx1) / 2
        for s in (-1, 1):
            parts.append(A.box(f"hang{s}", cx + s * .8 - .008, cx + s * .8 + .008, hh - 1.12, hh - .71,
                               Z1 - .32 - .008, Z1 - .32 + .008, "ar_bronze"))
        parts.append(A.box("pl_back", cx - .98, cx + .98, hh - 1.62, hh - 1.08, Z1 - .315, Z1 - .30, "ar_bronze"))
        # a honed stone path over the grass to the suite's north doors (SITE x
        # 1.6 … 3.4 — suite.js authors −3.4 … −1.6 and reflects it)
        sz0, sz1 = zb, S["ZN"] - S["EWT"] / 2
        n = 3
        for k in range(n):
            a = sz0 + (sz1 - sz0) * k / n + .006
            b = sz0 + (sz1 - sz0) * (k + 1) / n - .006
            p = A.box(f"path{k}", 1.2, 3.8, 0, .015, a, b, "at_coping")
            parts.append(p)
        return L.join(parts, NAME, origin=None)


def build_link():
    T = A.atrium()
    H1, Z1 = T["H1"], T["Z1"]
    along = A.site()["AD2"]["along"]
    hx0, hx1 = hole(T, (along - DOOR_EPS, along + DOOR_EPS))
    parts = []
    with A.frame("atrium"):
        y0 = H1
        hh, pw, d = H1 - .35, .7, WALL_T + .42      # buildLinkDoor's numbers
        za, zb = Z1 - d / 2, Z1 + d / 2
        pier(parts, "pw", hx0 - pw, hx0, y0, y0 + hh, za, zb, 3)
        pier(parts, "pe", hx1, hx1 + pw, y0, y0 + hh, za, zb, 3)
        lt = A.box("lintel", hx0 - pw, hx1 + pw, y0 + hh, y0 + H1, za, zb, "at_col")
        L.bevel([lt], width=.005, segments=1)
        parts.append(lt)
        for f, z in ((-1, za), (1, zb)):
            zz = sorted((z, z + f * .035))
            ar = A.box(f"arch{f}", hx0 - .10, hx1 + .10, y0 + hh - .14, y0 + hh, zz[0], zz[1], "at_col_b")
            L.bevel([ar], width=.006, segments=1)
            parts.append(ar)
            for s, x in ((-1, hx0), (1, hx1)):
                xa, xb = sorted((x, x - s * .10))
                j = A.box(f"archj{f}{s}", xa, xb, y0 + .02, y0 + hh - .14, zz[0], zz[1], "at_col_b")
                L.bevel([j], width=.006, segments=1)
                parts.append(j)
        parts.append(A.box("copper", hx0, hx1, y0 + hh - .09, y0 + hh, za - .04, zb + .04, "at_copper"))
        parts.append(A.box("thresh", hx0 - .15, hx1 + .15, y0, y0 + .02, Z1 - .28, Z1 + .28, "at_col_b"))
        return L.join(parts, NAME + "_link", origin=None)
