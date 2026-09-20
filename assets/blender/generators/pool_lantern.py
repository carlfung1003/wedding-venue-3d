"""pool_lantern — the big floating paper globe on the hero pool. Carl's "pool
balloon", and half of THE signature night shot (the prewedding, 2027-03-19).

⚠ GEOMETRY ONLY — BAKE = False. Read this before changing anything.

water.js's `buildLanterns()` makes a lantern read LIT FROM WITHIN with a stack
of THREE cooperating materials it owns (js/water.js:1719-1743):

  · shell — emissive rice paper, opacity .88, depthWrite STILL TRUE (the water
    sheet is transparent at renderOrder 3 and would paint over a lantern that
    did not write depth);
  · core  — an opaque hot sphere INSIDE it, drawn in the opaque pass, showing
    through wherever the paper is thinnest;
  · rim   — a slightly larger BackSide additive sphere whose far hemisphere
    depth-fails behind the shell, leaving a tight glowing ring on the
    silhouette. That ring is the whole "translucent".

One baked albedo×AO atlas cannot reproduce any of that — it would flatten the
lantern into a painted ball with its own shadows burned in, at night, in the one
shot the project exists for. So this generator sets BAKE = False: make_masters
skips prepare_for_export entirely and the generator owns its own UVs. The game
takes models.geometry('pool_lantern') and pairs it with the stack above.

  UV0 ('UVMap') is a clean CYLINDRICAL wrap — u = 0..1 once around with the seam
  at the BACK (−Y), v = 0..1 foot to crown — because the game maps its own
  seamless `paperTex()` onto it. This is exactly what the atlas smart-unwrap
  would have destroyed.

  ONE mesh, ONE material (export_all.py asserts it), so everything is built in a
  single palette key, `label` (plain paper). The key is only there to keep the
  export happy; the game replaces the material.

── THE ENVELOPE, WHICH IS LOAD-BEARING (js/water.js:1753-1770) ────────────────
  globeGeo = SphereGeometry(R, 24, 16), scaled (1, .86, 1), at hy = R × 1.10
  above the waterline, R = TUNE.LANTERN_R = .70 (js/water.js:101).

So the shell is 0.70 in horizontal radius and 0.602 (= R × .86) in vertical
half-extent, and this model keeps both to the millimetre: 1.400 × 1.400 ×
1.204. The halo, the pool-glow disc and the reflection streak are all sized off
R (haloGeo R×5.6, poolGeo R×6.6, streakGeo R×1.5 × R×4.4), so growing the shell
would put the glow inside the paper.

ORIGIN "floor" — the model's foot, the kayak's precedent (preview_all.py and
tools/viewer.html stand a model on the ground disc, and a centre-origin lantern
shoots half-buried). The shell centre is therefore at size.y / 2 = 0.602 above
the foot, exactly, because the model's vertical extent IS the shell's:

    a drop-in sits at  y = P.waterY + hy − 0.602  =  P.waterY + R × 0.24
                         = P.waterY + 0.168

and the game keeps hy for the core, the rim and the halo.

── WHAT IS MODELLED, AND WHY IT IS NOT A SPHERE ───────────────────────────────
Carl's description: vertical ribs with the paper bulging between them, a top
collar, a bottom ring. So the shell's radius is pinched on each of 12 rib
meridians and bulges to the full 0.70 between them, with a narrow proud spine on
the rib line — a 45° crease that shade_smooth(35°) keeps sharp, which is what
draws the rib as a line of shading rather than a painted stripe. The three
HORIZONTAL torus ribs the primitive carries (ribGeo, js/water.js:1755) are gone:
they are hoops, not ribs, and hoops do not bulge paper.

The dark float ring at the waterline (baseGeo, js/water.js:1758) is NOT in this
GLB and must stay a game object: it is `baseMat`, and a single-material GLB
would render it as glowing paper.
"""
import math
import wv_lib as L
import _pool as P

NAME = "pool_lantern"
BAKE = False              # ⚠ see the banner — the generator owns its own UVs
ATLAS = 256               # unused (no bake); kept so the module reads like the rest
BEVEL = 0
TRIS = 1800
FRONT = "-Z"              # radially symmetric; the seam is at the back
ORIGIN = "floor"
KEY = "label"             # plain paper — one key, because one GLB = one material

R = 0.70                  # TUNE.LANTERN_R          js/water.js:101
SQUASH = 0.86             # shell.scale.set(1, .86, 1)   js/water.js:1774
RZ = R * SQUASH           # 0.602 — the vertical half-extent
RIBS = 12
TH_TOP = 0.42             # polar angle of the collar opening
TH_BOT = 0.38             # polar angle of the hoop opening


def build():
    parts = []
    mat = L.M(KEY)

    # ── the paper: pinched on every rib meridian, bulging to the full R between
    shell = P.ribbed_shell("shell", R, RZ, mat, ribs=RIBS,
                           theta_top=TH_TOP, theta_bot=TH_BOT, rings=10,
                           pinch=0.075, ridge=0.050, sigma=0.05, delta=0.055,
                           cap_bottom=True)
    parts.append(shell)

    # ── the top collar: the card ring the paper is gathered into, capping the
    #    top hole. Its crown is the model's highest point, at exactly +RZ.
    z_top = RZ * math.cos(TH_TOP)                  # 0.5497 — the shell's opening
    r_top = R * math.sin(TH_TOP)                   # 0.2853
    parts.append(L.cyl("collar", r_top + 0.022, (RZ - z_top) * 0.72,
                       (0, 0, z_top + (RZ - z_top) * 0.36), mat, n=20,
                       r2=r_top * 0.86))
    parts.append(L.cyl("crown", r_top * 0.86, (RZ - z_top) * 0.28,
                       (0, 0, RZ - (RZ - z_top) * 0.14), mat, n=20,
                       r2=r_top * 0.46))

    # ── the bottom ring: the wire hoop the paper closes onto. Sits just under
    #    the shell's bottom opening and takes the model's lowest point to −RZ.
    z_bot = -RZ * math.cos(TH_BOT)                 # −0.5592
    r_bot = R * math.sin(TH_BOT)                   # 0.2596
    hoop_r = 0.024
    # ⚠ a 6-sided minor ring puts its lowest VERTEX at r·cos(30°), not at r, so
    #   the centre is lifted by that and not by hoop_r — else the model comes out
    #   3 mm short of the shell's own half-extent.
    parts.append(L.torus("hoop", r_bot * 0.94, hoop_r,
                         (0, 0, -RZ + hoop_r * math.cos(math.pi / 6)),
                         mat, maj=20, mnr=6))
    # three short stays from the hoop up to the paper, so the hoop reads as hung
    for a in P.ring_of(3, math.pi / 6):
        parts.append(L.strut("stay",
                             (math.cos(a) * r_bot * 0.94, math.sin(a) * r_bot * 0.94,
                              -RZ + hoop_r * math.cos(math.pi / 6)),
                             (math.cos(a) * r_bot, math.sin(a) * r_bot, z_bot),
                             0.011, mat, n=5))

    root = L.join(parts, NAME, origin="floor")
    L.shade_smooth(root, angle=35)                 # the rib creases are ~45°: kept
    # ⚠ UV0, not the `art` layer — nothing unwraps this model after us.
    L.cylindrical_uv(root, layer="UVMap", axis=2, repeat=1.0, v_from_height=True)
    return root
