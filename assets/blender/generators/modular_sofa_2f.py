"""modular_sofa_2f — ONE CURVED MODULE of the 2F lounge's white modular sofa.

Source: js/suite.js:1376-1387 (`buildSecondFloor`, "the curved white modular
sofa on a teal rug"). Four modules are placed on an arc:

  const arcC = [-2.0, -19.3], R = 2.35;
  for (let i = 0; i < 4; i++) {
    const a = -1.05 + i * .52;
    const cx = arcC[0] + Math.sin(a) * R, cz = arcC[1] + Math.cos(a) * R;
    seat = box(g, MT.ivoryWhite, 1.25, .42, 1.0,  cx, YF2 + .21, cz, -a);
    back = box(g, MT.ivoryWhite, 1.25, .50, .28,  cx, YF2 + .55, cz, -a);
    back.translateZ(-.42);
    box(g, teal|tealDeep, .34, .32, .13, cx, YF2 + .52, cz, -a + .2).translateZ(-.26);
  }

so each module is 1.25 wide x 1.00 deep x .42 high with a .28-deep back panel
whose centre is .42 behind the module centre (y .30 .. .80), and the four sit at
**R = 2.35 on a .52 rad pitch** with their open sides facing radially OUTWARD,
away from `arcC`. The rug under them is x -4.6 .. .6, z -19.4 .. -15.6 (:1377).

  1.465 W x 1.120 D x 0.800 H   (the assembled ring: inner r 1.79, outer 2.85)
  origin  floor, on the module's own radial CENTRE LINE at r 2.35 — which is
          exactly the point `box()` places the straight module at — so a drop-in
          sits at `(cx, YF2, cz)` with no offset.
  front   -Z = the OPEN side, radially outward. `box()`'s last argument is
          negated (`m.rotation.y = -ry`), so the call site's `-a` yields
          `rotation.y = a`, which points the primitive's local +Z outward.
          **This GLB faces -Z, so it needs `rotation.y = a + Math.PI`** — i.e.
          the call site passes `-(a + Math.PI)`. `rotation.y = a` seats every
          module backwards, facing the bedroom wall, and nothing throws.

⚠ suite.js is MIRRORED (its 1a): the call site reflects x through `mx()` and
negates rotation.y, which is the whole reason the arc's yaws arrive as `-a`.
The module is symmetric about its own radial centre plane, so the reflection is
a no-op on the shape; only the sign of the yaw the integrator passes changes,
and it is already being negated by `box()` today.

⚠ The 2F lounge furniture carries **no colliders at all** (js/suite.js:1580-1640
registers the great room, the dining end, the credenzas, the sideboard and the
annex; nothing on the second floor but the walls and the stair). Nothing to
preserve here but the silhouette on the rug.

THE CURVE IS THE POINT, AND IT IS FREE. Modelled as an annulus sector of
half-angle 0.26 rad about an axis at Blender (0, -2.35) — so the module's two
side faces are RADIAL PLANES and consecutive modules abut EXACTLY at the code's
own .52 rad pitch, with no wedge-shaped gaps and no overlap. The cost is that
the outer arc's chord is 1.465 m against the straight box's 1.25 and the radial
bbox 1.120 against 1.060: the assembled ring's inner and outer radii are the
code's to the millimetre and the only thing that changed is that the gaps
BETWEEN four straight boxes on a curve are now filled with sofa.

DELIBERATE DEVIATIONS:
 1 · **the back starts at the seat top (.42), not at .30.** The code's back
     panel begins 120 mm inside the seat block — interpenetration, not form.
     Its visible height above the seat (.42 -> .80) and its rear plane (r 1.79)
     are both unchanged, so nothing about the silhouette moves.
 2 · **a 20 mm recessed plinth** (r 1.87 .. 2.83, z 0 .. .10) under the seat, and
     a 18 mm cushion seam on the front face at z .29 .. .31. Both are reveals,
     never proud: the outer radius stays 2.85 and the height stays .42/.80.
 3 · **the teal accent pillow is NOT in this GLB.** It alternates `MT.teal` /
     `MT.tealDeep` by index and carries its own yaw, i.e. a per-instance tint
     stream a single baked atlas cannot reproduce (the same call the sofa
     island's pillows and the swim-up bar's bottles get). Nor is the round
     `ivoryWhite` ottoman (:1388) or the coffee table (:1390).

FINISH. MT.ivoryWhite #e9e5da at roughness .58. This is the ONE Group G asset on
a flat palette key rather than a gained `linen_ivory.webp`, and deliberately: a
lofted annulus sector has a dead-flat seat top, and `metric_uv`'s planar (x, z)
projection collapses to a single texture row there — the weave would bake as
radial streaks across the most visible surface on the piece. `wv_bake.FAMILY`
puts `linen` in the `linen` family, whose finish graph is procedural (noise and
wave nodes on generated coordinates), so it needs no UV at all and cannot streak.
"""
import wv_lib as L
import _interior as I

NAME = "modular_sofa_2f"
ATLAS = 512
BEVEL = 0                 # the profile carries its own radii
AO_DIST = 0.30            # upholstery indoors
AO_STRENGTH = 0.5
TRIS = 3000
FRONT = "-Z"
ORIGIN = "floor"
MAT_NAME = "modular_sofa_2f"

R_C = 2.35                # suite.js:1378
HALF = 0.26               # half of the code's .52 rad pitch
R_IN_BACK = 1.79          # back panel rear   (R - .42 - .28/2)
R_IN_SEAT = 1.85          # seat inner face   (R - .50)
R_BACK_F = 2.11           # back panel front  (R - .42 + .28/2)
R_OUT = 2.85              # seat front        (R + .50)
SEAT_Z = 0.42
BACK_Z = 0.80
PLINTH_Z, PLINTH_IN = 0.10, 0.02
STATIONS = 15


def _profile():
    """The module's radial cross-section as a closed [(radius, z), …] loop,
    counter-clockwise: floor outward, up the front, back along the seat, up the
    back's front face, over its top, down its rear, and home."""
    p = [(R_IN_SEAT + PLINTH_IN, 0.0),
         (R_OUT - PLINTH_IN, 0.0),
         (R_OUT - PLINTH_IN, PLINTH_Z - 0.02),
         (R_OUT, PLINTH_Z)]
    p += [(R_OUT, 0.280), (R_OUT - 0.018, 0.293),      # the cushion seam
          (R_OUT - 0.018, 0.313), (R_OUT, 0.326)]
    p += I.round_corner(R_OUT - 0.060, SEAT_Z - 0.060, 0.060, 0, 90, k=3)
    p += [(R_BACK_F + 0.02, SEAT_Z), (R_BACK_F, SEAT_Z + 0.04)]
    p += I.round_corner(R_BACK_F - 0.060, BACK_Z - 0.060, 0.060, 0, 90, k=3)
    p += I.round_corner(R_IN_BACK + 0.060, BACK_Z - 0.060, 0.060, 90, 180, k=3)
    p += [(R_IN_BACK, SEAT_Z), (R_IN_SEAT, SEAT_Z),
          (R_IN_SEAT, PLINTH_Z), (R_IN_SEAT + PLINTH_IN, PLINTH_Z - 0.02)]
    return p


def build():
    linen = "linen"                       # flat key: the linen FAMILY is procedural
    root = I.wedge(NAME, _profile(), R_C, HALF, linen, stations=STATIONS)
    root = L.join([root], NAME, origin=None)   # verts already on the module's frame
    L.shade_smooth(root, angle=34)
    return root
