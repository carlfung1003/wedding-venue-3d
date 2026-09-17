"""installation_hero — the taller of the two asymmetric floral towers at the head
of the aisle (`decor-ceremony-main.jpg`, left of the fabric flower).

ASSET_SPEC Group B: h 3.30, teardrop foot r ~.78 at z .26 drawn to a plume (×.20
at the top), crown drifting +X by .62 (x = .62·t²), a skirt on the grass r .92 ×
.78 at z ~.24, a wing spilling toward +X at chest height (x .55 → 1.50, z 1.55 →
.80), 22 eucalyptus sprigs, delphinium at the plume. Cream/ivory/white garden
roses + powder-blue hydrangea (~45 % blue by area) over pale sage. Front −Z.

Built by _florals.build_installation() — see that module's docstring for how the
mass is made (a textured core, photographed head domes, Poisson packing).
Origin = the tower's AXIS at the foot (the spec's "base centre"), NOT the bbox
centre: the wing reaches x ≈ 1.85 and would drag a bbox origin .45 m sideways.
The game reads real extents from the sidecar's min/size.
"""
import wv_lib as L
import _florals as F

NAME = "installation_hero"
ATLAS = 1024
BEVEL = 0
AO_DIST = 0.3        # the crevices between heads are centimetres; .5 would bake the whole side grey
AO_STRENGTH = 0.5
TRIS = 45000
FRONT = "-Z"
ORIGIN = "floor"


def build():
    return F.build_installation(NAME, h=3.30, W=0.78, lean=0.62, side=+1, heads=560)
