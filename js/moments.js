// moments.js — the six moments, each dressing a REAL place: five on the 隐逸居
// campus and, since 2026-08-02, the Welcome Brunch on the Westin's rooftop
// terrace 285 m east (see site.js MOMENT_PLACES / HOTEL_ROOF + the briefs).
//
// House pattern: every moment's props are built ONCE here and toggled with
// .visible; nothing is rebuilt on switch. Colliders are swapped (statics + the
// live moment's list), never accumulated. Each moment also carries a `night`
// flag — switching moments moves the sun.
import * as THREE from 'three';
import { CFG } from './config.js';
import { SITE, HOTEL_ROOF } from './site.js';
import { setFacing, syncCamera } from './player.js';
import { setNight } from './world.js';
import { mulberry32 } from './materials.js';
import * as models from './models.js';
import { t as tr, mt } from './i18n.js';

const rnd = mulberry32(CFG.SEED);

/* ── the Blender-authored GLB props (assets/models/, KAN-207) ───────────────
   `have(name)` is the ONE gate: true only when the GLB actually loaded as a
   single mesh, so every call site below keeps its old primitive path as the
   fallback behind it (assets/blender/INTEGRATION.md §1). models.preload() has
   resolved before initMoments runs — main.js awaits it — so nothing here is
   ever asked about a model still in flight. */
const have = (name) => models.has(name) && !!models.geometry(name);
const ART_DIR = new URL('../assets/art/', import.meta.url).href;

/* ── local materials (self-contained; the shell modules own their own) ── */
const linen = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: .85 });
const timber = new THREE.MeshStandardMaterial({ color: 0x3a281e, roughness: .7 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: .3, metalness: .85 });
const glassy = new THREE.MeshPhysicalMaterial({
  color: 0xdfeef0, roughness: .1, transmission: .85, thickness: .4, transparent: true, opacity: .5,
});
const foliage = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: .95 });
const blush = new THREE.MeshStandardMaterial({ color: 0xf2d7d9, roughness: .9 });
const deckDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .6 });
const bulb = new THREE.MeshStandardMaterial({
  color: 0xfff0cf, emissive: 0xffcf87, emissiveIntensity: 2.2, toneMapped: false,
});
const TEAL_HEX = 0x1f8fa5;   // the clubhouse teal — also the parasol_round_canopy instance tint
const teal = new THREE.MeshStandardMaterial({
  color: TEAL_HEX, roughness: .85, side: THREE.DoubleSide,
});

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

/* ═══════════════════════════════════════════════════════════════════════════
   THE WEDDING DESIGNER'S PALETTE — Rosa Wed 蔷薇婚礼, the real 2027-03-20 design
   (reference/photos/decor-*.jpg, seven renders from the couple's planner).
   Dusty/powder BLUE + cream + ivory + white over PALE-GREEN foliage —
   hydrangea, garden roses, delphinium. Everything soft and pale against the
   sea. It outranks anything previously inferred: the ceremony this replaced
   was plain white folding chairs under a green-and-blush arch, and there is
   no blue and no timber anywhere in that. Get the colour right first.

   ⚠ NAMES. The planner's renders romanise the surnames as "Feng" and "Zheng".
   THE COUPLE ARE FUNG AND CHENG — Carl Fung and Rachel Cheng. Never transcribe
   a name straight off a reference render; every piece of lettering in this file
   uses the project's own copy (see wedding-app, the title card and CFG.SEED).
   ═══════════════════════════════════════════════════════════════════════════ */
const PAL = {
  HYDRANGEA: 0x92b8de,   // the powder-blue hydrangea heads — the signature
  DELPH: 0x7099c9,   // delphinium / the deeper blue in the ground clusters
  MIST: 0xbcd3ea,   // palest blue, the fabric flower and the far blooms
  CREAM: 0xecd7ae,   // the champagne garden rose
  IVORY: 0xf6ecd8,
  WHITE: 0xfdfbf6,
  LEAF: 0x94ae87,   // PALE sage — NOT the 0x3f6b3a the old dressing used
  LEAF_D: 0x74906b,
  OAK: 0xc3a37c,   // the cross-back chairs — light, grey-warm, not orange
  OAK_D: 0xa88a66,
  PEARL: 0xf5efe2,
  STONE: 0xdfe4e8,   // the welcome sign's pale board
};

/* materials — this file owns its own, house rule */
const oak = new THREE.MeshStandardMaterial({ color: PAL.OAK, roughness: .72 });
const chiffon = new THREE.MeshStandardMaterial({
  color: 0xfaf7f0, roughness: .96, side: THREE.DoubleSide, transparent: true, opacity: .8,
});
const petalM = new THREE.MeshStandardMaterial({
  color: 0xfbf8f1, roughness: .9, side: THREE.DoubleSide,
});
/* tinted per instance — base MUST stay white or instanceColor is multiplied down */
const bloomM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .88 });
const crystalM = new THREE.MeshStandardMaterial({
  color: 0xe8f0f6, roughness: .1, metalness: .12, emissive: 0x93aec4, emissiveIntensity: .3,
});
const pearlM = new THREE.MeshStandardMaterial({ color: PAL.PEARL, roughness: .3, metalness: .06 });
const frameW = new THREE.MeshStandardMaterial({ color: 0xfcfbf7, roughness: .5 });
const linenW = new THREE.MeshStandardMaterial({ color: 0xf7f3e9, roughness: .88 });
const bronzeD = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: .55, metalness: .45 });
const wireM = new THREE.LineBasicMaterial({ color: 0x33302c });
const strawM = new THREE.MeshStandardMaterial({ color: 0xd9b688, roughness: .92 });
const steelM = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: .45, metalness: .6 });
const fluteM = new THREE.MeshStandardMaterial({ color: 0xefe2d4, roughness: .82, flatShading: true });
const glassPale = new THREE.MeshStandardMaterial({
  color: 0xdfeef0, roughness: .16, transparent: true, opacity: .45,
});

/* shared unit geometries — every bucket below scales ONE of these per instance */
const G_BOX = new THREE.BoxGeometry(1, 1, 1);
const G_ROD = new THREE.CylinderGeometry(1, 1, 1, 8);
const G_DISC = new THREE.CylinderGeometry(1, 1, 1, 18);
const G_BLOOM = new THREE.SphereGeometry(1, 6, 4);   // 36 tris — × ~3,000
const G_BEAD = new THREE.OctahedronGeometry(1, 0);
const G_PETAL = new THREE.CircleGeometry(1, 5);
/* the chair drape: an OPEN cone, wide end at +Y. Flip it with rot.x = π for the
   skirt that falls behind the seat. */
const G_DRAPE = new THREE.CylinderGeometry(1, .16, 1, 10, 1, true);
const G_SKIRT = new THREE.CylinderGeometry(1, 1, 1, 20, 1, true);
const G_CONE = new THREE.ConeGeometry(1, 1, 20);
const G_FLUTE = new THREE.CylinderGeometry(1, 1, 1, 14);   // flatShading → flutes
/* KAN-208 wave 3 — the festoon's bulb and the pearl swags' pearl, both REAL
   size (scale 1 / a uniform radius), both on materials this file already
   instances, so neither adds a program:
   · G_BULB — a globe bulb with its neck, hanging DOWN from y 0 (the socket's
     foot): a 9 cm globe centred 6.5 cm under the socket. 48 tris. The old
     festoon hung an 11 × 14 cm SPHERE, which read as a ping-pong ball in the
     day and a white disc at night.
   · G_PEARL — an icosahedron (20 tris): round at 2.2 cm, where the octahedron
     bead the swags used read as a DIAMOND — and at 7 cm the old ones were the
     size of eggs, lined up in columns because all nine strands shared one x
     grid (see plinthPair). */
const G_BULB = new THREE.LatheGeometry([
  new THREE.Vector2(0.0, 0.0), new THREE.Vector2(.014, 0.0), new THREE.Vector2(.014, -.018),
  new THREE.Vector2(.024, -.030), new THREE.Vector2(.040, -.048), new THREE.Vector2(.045, -.068),
  new THREE.Vector2(.040, -.090), new THREE.Vector2(.024, -.106), new THREE.Vector2(0.0, -.112),
].reverse(), 8);
const G_PEARL = new THREE.IcosahedronGeometry(1, 0);

/* ── ONE DRAW CALL PER KIND OF THING, however many there are ────────────────
   This design IS repetition: sixty cross-back chairs, ~1,300 blooms, ~400
   pearls, a hundred festoon bulbs, fifteen straw hats. Built as plain Meshes
   the ceremony alone stood 720 of them. A `bucket` collects placements while
   the moment is being authored and bakes ONE InstancedMesh at the end; a
   `tinted` bucket carries a per-instance colour, which is what lets every
   hydrangea, rose, leaf and lemon on the campus share one sphere and one
   material.
   ⚠ Bake into the MOMENT'S GROUP, never into the scene — world.js adopts that
   group into the rotated enclave and the instances ride along inside it. An
   InstancedMesh added to the scene directly is not a Group and is never
   adopted, so it would stand 90° around the map. */
const _m4 = new THREE.Matrix4();
const _q4 = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _vp = new THREE.Vector3();
const _vs = new THREE.Vector3();
const _cl = new THREE.Color();

const bucket = (geo, mat, tinted = false) => ({ geo, mat, tinted, rows: [] });

/** place one instance. `sc` is a number or [x,y,z]; `rot` is [rx,ry,rz] (XYZ);
 *  `parent` is an optional Matrix4 the whole thing is composed under. */
function put(b, x, y, z, sc, rot, col, parent) {
  const s = typeof sc === 'number' ? [sc, sc, sc] : sc;
  _eu.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0);
  _q4.setFromEuler(_eu);
  _m4.compose(_vp.set(x, y, z), _q4, _vs.set(s[0], s[1], s[2]));
  if (parent) _m4.premultiply(parent);
  b.rows.push([_m4.clone(), col === undefined ? 0xffffff : col]);
}

function bake(b, group) {
  if (!b.rows.length) return null;
  const im = new THREE.InstancedMesh(b.geo, b.mat, b.rows.length);
  for (let i = 0; i < b.rows.length; i++) {
    im.setMatrixAt(i, b.rows[i][0]);
    if (b.tinted) im.setColorAt(i, _cl.setHex(b.rows[i][1]));
  }
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  group.add(im);
  b.rows.length = 0;
  return im;
}

/* every straight run of wire on the campus in ONE LineSegments — the festoon
   used to be bulbs with no cable at all, so a run whose ends were not on a pole
   read as a row of orbs hanging in the sky (see the cocktail note below). */
const wires = () => ({ pts: [] });
function wireRun(w, x1, y1, z1, x2, y2, z2, sag, n = 12) {
  let px = x1, py = y1, pz = z1;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const qx = x1 + (x2 - x1) * t;
    const qz = z1 + (z2 - z1) * t;
    const qy = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
    w.pts.push(px, py, pz, qx, qy, qz);
    px = qx; py = qy; pz = qz;
  }
}
function bakeWires(w, group) {
  if (!w.pts.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(w.pts, 3));
  const l = new THREE.LineSegments(g, wireM);
  group.add(l);
  w.pts.length = 0;
  return l;
}

/** a real festoon run: the CABLE plus the bulbs hanging off it. The old
 *  stringLights() drew bulbs and no wire, which is why every comment in this
 *  file warns that a run whose ends are not on a pole reads as a row of orbs
 *  floating in mid-air. Now the cable is drawn, so it reads either way. */
function festoon(K, x1, y1, z1, x2, y2, z2, sag, n, post = false) {
  wireRun(K.wire, x1, y1, z1, x2, y2, z2, sag, n);
  /* KAN-211 wave E: `post` stands the run's FAR end (x2, z2) on a slim black
     festoon pole — the prewedding and after-party runs used to end in mid-air
     over the turf edge. DERIVED from the run's own endpoint: the pole's top
     cap carries the cable at exactly (x2, y2, z2). Three instances in K.dark
     (an existing bucket: no draw call, no program); no collider — see the
     call sites. */
  if (post) festoonPost(K, x2, y2, z2);
  /* KAN-208 wave 3: every bulb is a SOCKET (a dark 2.6 × 4.5 cm drum on a
     4 cm drop off the cable, in the K.dark bucket) and a real globe bulb
     (G_BULB) under it — two instances in buckets that already exist, so the
     prototype costs no draw call and no program. `bulb` stays emissive at
     every hour, exactly as before (the night look is unchanged: toneMapped
     off, one warm-white point per bulb). */
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
    const y = y1 + (y2 - y1) * t - Math.sin(t * Math.PI) * sag;
    put(K.dark, x, y - .02, z, [.004, .04, .004], null, 0x24211d);   // the drop
    put(K.dark, x, y - .062, z, [.013, .045, .013], null, 0x24211d); // the socket
    put(K.bulb, x, y - .084, z, 1);
  }
}

/** a festoon pole under a run's end at (x, y, z): a Ø 64 mm black steel pole
 *  from a round foot plate on the ground to a cap 60 mm over the cable, plus a
 *  short eye-hook arm the cable ties off to. Ground is y 0 at both sites (the
 *  suite's turf strip). */
const POST_COL = 0x26231f;
function festoonPost(K, x, y, z) {
  const top = y + .06;
  put(K.dark, x, top / 2, z, [.032, top, .032], null, POST_COL);          // the pole
  put(K.dark, x, .012, z, [.11, .024, .11], null, POST_COL);              // foot plate
  put(K.dark, x, .07, z, [.045, .10, .045], null, POST_COL);              // the base collar
  put(K.dark, x, top + .02, z, [.042, .04, .042], null, POST_COL);        // top cap
  put(K.dark, x, y, z, [.008, .09, .008], [Math.PI / 2, 0, 0], POST_COL); // eye-hook arm
}

/** a festoon pole's collider — ONLY where a guest can reach the pole. Every run
 *  ends on SITE.TURF.z1, the hero pool's plinth line; a pole along the plinth
 *  (|x − POOL.cx| within its half-width + coping + .1) already stands inside
 *  the coping's collider band (measured: 0 of 49 walker positions within .40 m
 *  of it are free), so it takes none. The ones past the plinth's end stand on
 *  the open turf corner by the cabanas and get a circle the pole's own size. */
function postCollider(list, x, z) {
  const P = SITE.POOL;
  if (Math.abs(x - P.cx) > P.w / 2 + P.coping + .1) list.push({ x, z, r: .08 });
}

/* ── the tall curved poles the dinner's chandeliers hang from ───────────────
   `decor-dinner-chandeliers.jpg`. The elbow is a quarter torus PRE-ROTATED at
   build time so its two ends sit at local (−R, 0) with a vertical tangent and
   local (0, +R) with a horizontal one: drop the first end on the pole top and
   the fixture hangs R out and R up from there. Pre-rotating the GEOMETRY is
   what lets a plain rot.y of 0 or π mirror the overhang — composing a
   Z-rotation with a Y-rotation through one XYZ Euler does not, and gets you a
   pole bent sideways. (Same family of bug as the arch built edge-on.) */
const POLE_H = 3.6, POLE_R = 1.3;
const ELBOW = new THREE.TorusGeometry(POLE_R, .055, 5, 12, Math.PI / 2).rotateZ(Math.PI / 2);

/** the designer's flower mix, weighted the way the renders read: blue
 *  hydrangea and delphinium against cream and ivory roses, pale sage between. */
function bloomHue(r) {
  if (r < .26) return PAL.HYDRANGEA;
  if (r < .38) return PAL.DELPH;
  if (r < .45) return PAL.MIST;
  if (r < .64) return PAL.CREAM;
  if (r < .80) return PAL.IVORY;
  if (r < .87) return PAL.WHITE;
  return r < .94 ? PAL.LEAF : PAL.LEAF_D;
}

/** a mass of blooms packed into an ellipsoid — the unit every cluster,
 *  installation lobe and table centrepiece in this file is made of. */
function bloomMass(F, cx, cy, cz, rx, ry, rz, n, big = 1, parent) {
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1, v = rnd() * 2 - 1, w2 = rnd() * 2 - 1;
    const k = Math.cbrt(rnd());
    const m = Math.hypot(u, v, w2) || 1;
    const hue = bloomHue(rnd());
    const leaf = hue === PAL.LEAF || hue === PAL.LEAF_D;
    const s = (leaf ? .042 : .052 + rnd() * .052) * big;
    put(F,
      cx + (u / m) * k * rx, cy + (v / m) * k * ry, cz + (w2 / m) * k * rz,
      /* the greens are drawn out into sprigs — that wispy delphinium/eucalyptus
         line is most of what makes the renders read as florist's work rather
         than as a ball pit */
      leaf ? [s * .8, s * (2.2 + rnd() * 2.0), s * .8] : [s, s * (.82 + rnd() * .3), s],
      leaf ? [(rnd() - .5) * .7, 0, (rnd() - .5) * .7] : [0, 0, 0],
      hue, parent);
  }
}

/* One kit of buckets per moment. Twelve instanced draw calls buy the whole
   dressing however many chairs, blooms and pearls it holds. */
function kit() {
  const K = {
    oak: bucket(G_BOX, oak, true),          // every timber member, any shade
    white: bucket(G_BOX, linenW, true),      // every painted / linen box, any shade
    disc: bucket(G_DISC, linenW, true),      // table tops, plinth caps, canopies
    rod: bucket(G_ROD, linenW, true),      // poles, stems, tapers, uprights
    skirt: bucket(G_SKIRT, linenW),           // cloth to the grass
    cone: bucket(G_CONE, linenW, true),      // parasol canopies
    flute: bucket(G_FLUTE, fluteM, true),     // the fluted dessert plinths, buckets
    gold: bucket(G_BOX, gold, true),        // the favour boxes
    flor: bucket(G_BLOOM, bloomM, true),     // every bloom, leaf, fruit and coconut
    pearl: bucket(G_BEAD, pearlM),
    crystal: bucket(G_BEAD, crystalM),
    lamp: bucket(G_BLOOM, bulb),                // candle flames (+ the festoon fallback)
    bulb: bucket(G_BULB, bulb),                 // festoon globe bulbs (wave 3)
    pearlS: bucket(G_PEARL, pearlM),            // the plinth pearl swags (wave 3)
    petal: bucket(G_PETAL, petalM),
    chiffon: bucket(G_DRAPE, chiffon),
    glass: bucket(G_ROD, glassPale),
    straw: bucket(G_DISC, strawM, true),      // hat brims + crowns
    dark: bucket(G_ROD, bronzeD, true),      // the chandelier poles, steel work
    wire: wires(),
  };
  /* a bucket per GLB: ONE InstancedMesh per model per moment, however many are
     placed. Same put() signature as every other bucket, so frame() and the
     curried iput keep working and the "instances go through the prop's own
     frame" rule holds for the GLBs too. ⚠ The material is SHARED across the
     six moments (never cloned) — that is what keeps the program count
     constant. A baked-albedo material multiplies instanceColor into its map,
     so `tinted` is only for assets documented as tintable
     (parasol_round_canopy); everyone else stays at 0xffffff. */
  const mb = new Map();
  K.mdl = (name, tinted = false) => {
    if (!mb.has(name)) {
      const geo = models.geometry(name), mat = models.material(name);
      mb.set(name, geo && mat ? bucket(geo, mat, tinted) : null);
    }
    return mb.get(name);
  };
  /* a GEOMETRY-ONLY GLB on one of OUR materials (KAN-208 wave 3 — the
     cocktail glass shells on glassPale): same one-bucket-per-kind rule, keyed
     by model AND material so a model can never be baked twice in two finishes
     by accident. Reusing a material this file already instances is what keeps
     the program count where it is. */
  K.mdlAs = (name, mat, tinted = false) => {
    const key = name + '@' + mat.uuid;
    if (!mb.has(key)) {
      const geo = models.geometry(name);
      mb.set(key, geo ? bucket(geo, mat, tinted) : null);
    }
    return mb.get(key);
  };
  K._mdl = mb;
  return K;
}
function bakeKit(K, g) {
  for (const k of Object.keys(K)) {
    if (k === 'mdl' || k === 'mdlAs' || k === '_mdl') continue;
    if (k === 'wire') bakeWires(K.wire, g);
    else bake(K[k], g);
  }
  for (const b of K._mdl.values()) if (b) bake(b, g);
}

/* ── THE WOODEN CROSS-BACK CHAIR ────────────────────────────────────────────
   `decor-ceremony-main.jpg` and both dinner renders sit the whole wedding on
   cross-backs, not on the white folding chairs this build had. Eleven timber
   members, every one of them the SAME unit box scaled per instance, so the
   sixty ceremony chairs and the sixty-four dinner covers each cost ONE draw
   call. The chair faces +Z with its back at −Z, which is the convention the old
   chair() had and which the ceremony rows still rely on.
   `drape` ties the white chiffon behind the backrest — ceremony only; the
   dinner chairs in both dinner renders are bare. */
const _cm = new THREE.Matrix4();
const _cq = new THREE.Quaternion();
const _ce = new THREE.Euler();
const _cp = new THREE.Vector3();
const _cs = new THREE.Vector3(1, 1, 1);
const CHAIR_PARTS = [
  //  x     y      z     sx    sy     sz    rz
  [0, .455, 0, .46, .05, .44, 0],   // seat
  [-.205, .2275, .185, .038, .455, .038, 0],   // front legs
  [.205, .2275, .185, .038, .455, .038, 0],
  [-.205, .50, -.195, .038, 1.00, .038, 0],   // back legs, continuous as stiles
  [.205, .50, -.195, .038, 1.00, .038, 0],
  [0, .975, -.195, .45, .075, .05, 0],   // top rail
  [0, .600, -.195, .40, .05, .04, 0],   // lower rail
  [0, .788, -.205, .54, .045, .032, .733],   // the X
  [0, .788, -.205, .54, .045, .032, -.733],
  [-.205, .17, 0, .032, .032, .40, 0],   // side stretchers
  [.205, .17, 0, .032, .032, .40, 0],
];
function xbackChair(B, C, x, z, yaw, drape = false) {
  _ce.set(0, yaw, 0);
  _cq.setFromEuler(_ce);
  _cm.compose(_cp.set(x, 0, z), _cq, _cs.set(1, 1, 1));
  for (const p of CHAIR_PARTS) {
    put(B, p[0], p[1], p[2], [p[3], p[4], p[5]], [0, 0, p[6]], PAL.OAK, _cm);
  }
  if (!drape || !C) return;
  /* the white chiffon: a fan flaring UP and out above the backrest, and a
     skirt falling behind the seat from the same knot. Both are the one open
     cone; the skirt is the same cone turned over (rot.x = π). */
  put(C, 0, 1.06, -.285, [.245, .30, .15], [-.24, 0, 0], 0xffffff, _cm);
  put(C, 0, .615, -.275, [.175, .64, .135], [Math.PI, 0, 0], 0xffffff, _cm);
}
/** the chiffon alone — for a GLB chair whose chair_drape did not load */
function xbackDrape(C, x, z, yaw) {
  _ce.set(0, yaw, 0);
  _cq.setFromEuler(_ce);
  _cm.compose(_cp.set(x, 0, z), _cq, _cs.set(1, 1, 1));
  put(C, 0, 1.06, -.285, [.245, .30, .15], [-.24, 0, 0], 0xffffff, _cm);
  put(C, 0, .615, -.275, [.175, .64, .135], [Math.PI, 0, 0], 0xffffff, _cm);
}
/** ONE cross-back chair at (x, z): the Blender GLB when it loaded — its front
 *  faces +Z at yaw 0, exactly xbackChair's convention, so every caller's yaw
 *  arithmetic is untouched — else the eleven-box primitive. `chair_drape`
 *  takes the chair's matrix verbatim (its own min y is .30, the knot at the
 *  top rail). */
function chairAt(K, x, z, yaw, drape = false) {
  if (have('crossback_chair')) {
    put(K.mdl('crossback_chair'), x, 0, z, 1, [0, yaw, 0]);
    if (!drape) return;
    if (have('chair_drape')) put(K.mdl('chair_drape'), x, 0, z, 1, [0, yaw, 0]);
    else xbackDrape(K.chiffon, x, z, yaw);
    return;
  }
  xbackChair(K.oak, drape ? K.chiffon : null, x, z, yaw, drape);
}

/* ── the low blue-and-cream ground clusters ─────────────────────────────────
   cluster_a/b/c are ~1.30 × .66 × .91 at scale 1 (the old bloomMass lobe was
   1.2 W at big = 1), so the caller's old `big` scales them directly, clamped
   .7–1.4. ONE rnd() picks the variant — drawn exactly where the old bloomMass
   drew its first, or handed in by a caller that already drew it — so the
   seeded stream stays deterministic. All three or none: a row never mixes the
   two looks. */
const CLUSTERS = ['cluster_a', 'cluster_b', 'cluster_c'];
let _haveClusters = null;
function haveClusters() {
  if (_haveClusters === null) _haveClusters = CLUSTERS.every(have);
  return _haveClusters;
}
function clusterAt(K, x, y, z, big, yaw = 0, parent, r = rnd()) {
  const s = Math.min(1.4, Math.max(.7, big));
  put(K.mdl(CLUSTERS[Math.floor(r * 3) % 3]), x, y, z, s, [0, yaw, 0], 0xffffff, parent);
}

/* ── the dressed round, 1.8 m, eight covers ─────────────────────────────────
   Ivory linen to the grass, a low centrepiece of blue hydrangea and cream
   roses with two tapers, glassware, and eight cross-backs on a 1.35 m ring
   (1.06 m per cover — a real banquet setting, not eight people on a ten-top).
   Everything lands in the caller's buckets; the table itself contributes no
   Mesh of its own. */
function roundTable(K, x, z, seats = 8) {
  /* the dressed round itself: the GLB (top surface y .80, sidecar size .804)
     or the disc + skirt; the centrepiece is base-origin and sits on that top */
  const glb = have('round_table');
  if (glb) put(K.mdl('round_table'), x, 0, z, 1, null);
  else {
    put(K.disc, x, .78, z, [.92, .06, .92], null, PAL.IVORY);           // the top
    put(K.skirt, x, .39, z, [.90, .78, .90]);                            // linen to the grass
  }
  const TOP = glb ? .80 : .81;
  const cp = have('centrepiece_low');
  if (cp) put(K.mdl('centrepiece_low'), x, TOP, z, 1, null);
  else {
    bloomMass(K.flor, x, .96, z, .30, .10, .30, 16, .95);
    bloomMass(K.flor, x, 1.06, z, .16, .12, .16, 7, .8);
  }
  /* the two tapers + flames + glasses stay instances; the GLB bowl is .73 wide
     so the tapers step out to clear it */
  const TX = cp ? .44 : .36;
  for (const s of [-1, 1]) {
    put(K.rod, x + s * TX, TOP + .17, z, [.022, .34, .022], null, PAL.IVORY);
    put(K.lamp, x + s * TX, TOP + .36, z, [.035, .05, .035]);
  }
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    put(K.glass, x + Math.sin(a) * .62, TOP + .09, z + Math.cos(a) * .62, [.036, .18, .036]);
    chairAt(K, x + Math.sin(a) * 1.35, z + Math.cos(a) * 1.35, a + Math.PI);
  }
}

/* ── the long rectangular table ─────────────────────────────────────────────
   `decor-dinner-rounds.jpg` mixes bare-timber long tables in among the rounds
   at the edges of the lawn. Eight covers, four a side, so swapping one round
   for one long on each lawn keeps the 64 covers site.js specced. `axis` is the
   table's long direction: 'x' or 'z'. */
function longTable(K, x, z, len, axis = 'x') {
  const ax = axis === 'x';
  const yaw = ax ? 0 : Math.PI / 2;
  const L = (t) => (ax ? [x + t, z] : [x, z + t]);          // along the long axis
  /* the bare-timber table: the GLB is 4.80 along X at yaw 0 and turns with the
     same yaw the chairs use for the 'z' axis; else the planked top + four legs */
  if (have('long_table')) put(K.mdl('long_table'), x, 0, z, 1, [0, yaw, 0]);
  else {
    put(K.oak, x, .755, z, ax ? [len, .07, 1.02] : [1.02, .07, len], null, PAL.OAK);
    for (const sl of [-1, 1]) for (const sw of [-1, 1]) {
      const p = ax ? [x + sl * (len / 2 - .24), z + sw * .38] : [x + sw * .38, z + sl * (len / 2 - .24)];
      put(K.oak, p[0], .36, p[1], [.08, .72, .08], null, PAL.OAK_D);
    }
  }
  const n = Math.max(3, Math.round(len / 1.2));
  for (let i = 0; i < n; i++) {
    const t = -len / 2 + (i + .5) * (len / n);
    const c = L(t);
    bloomMass(K.flor, c[0], .92, c[1], .20, .10, .18, 9, .85);
    const g = ax ? [c[0], c[1] + .26] : [c[0] + .26, c[1]];
    put(K.rod, g[0], .93, g[1], [.022, .30, .022], null, PAL.IVORY);
    put(K.lamp, g[0], 1.09, g[1], [.033, .048, .033]);
    for (const s of [-1, 1]) {
      const gl = ax ? [c[0], c[1] + s * .34] : [c[0] + s * .34, c[1]];
      put(K.glass, gl[0], .87, gl[1], [.036, .18, .036]);
      const ch = ax ? [c[0], c[1] + s * 1.02] : [c[0] + s * 1.02, c[1]];
      chairAt(K, ch[0], ch[1], yaw + (s > 0 ? Math.PI : 0));
    }
  }
}

/* ── the crystal chandeliers ────────────────────────────────────────────────
   Two different fixtures, because the renders show two.
   `beadShade` is the ceremony's: `decor-ceremony-main.jpg` hangs a conical
   skirt of crystal/pearl strands inside each white arch frame.
   `candelabra` is the dinner's: `decor-dinner-chandeliers.jpg` hangs real
   two-tier candle chandeliers off tall curved poles. */
function beadShade(K, x, y, z, r = .55, tiers = 4) {
  put(K.rod, x, y + .30, z, [.014, .60, .014], null, 0xf0f4f7);      // the drop
  put(K.disc, x, y, z, [r * .42, .035, r * .42], null, 0xf6f8fa);    // the canopy
  for (let t = 0; t < tiers; t++) {
    const rr = r * (1 - t * (.62 / tiers));
    const yy = y - .16 - t * .19;
    const n = 12 + (tiers - t) * 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * .21;
      put(K.crystal, x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr,
        [.035, .055, .035], [0, a, 0]);
    }
  }
  for (let i = 0; i < 9; i++) {                                       // the finial strand
    put(K.crystal, x, y - .16 - i * .075, z, [.028, .045, .028], [0, i * .5, 0]);
  }
}
function candelabra(K, x, y, z, r = .58) {
  put(K.rod, x, y + .34, z, [.016, .68, .016], null, 0xeef3f7);
  put(K.disc, x, y + .02, z, [.13, .05, .13], null, 0xf2f6f9);
  put(K.rod, x, y - .34, z, [.05, .72, .05], null, 0xeef3f7);         // the column
  for (const [tier, rr, n] of [[0, r, 8], [1, r * .66, 6]]) {
    const yy = y - .18 - tier * .30;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + tier * .4;
      const cx = x + Math.cos(a) * rr, cz = z + Math.sin(a) * rr;
      /* the arm, as a rod leaning out and up from the column */
      put(K.crystal, x + Math.cos(a) * rr * .5, yy - .05, z + Math.sin(a) * rr * .5,
        [.022, rr, .022], [Math.sin(a) * 1.34, 0, -Math.cos(a) * 1.34]);
      put(K.crystal, cx, yy + .09, cz, [.028, .13, .028]);            // the candle
      put(K.lamp, cx, yy + .18, cz, [.032, .05, .032]);               // its flame
      put(K.crystal, cx, yy - .10, cz, [.05, .05, .05]);              // the bobèche
    }
  }
  for (let i = 0; i < 16; i++) {                                      // swagged crystal
    const a = (i / 16) * Math.PI * 2;
    put(K.crystal, x + Math.cos(a) * r * .8, y - .40 - (i % 3) * .06, z + Math.sin(a) * r * .8,
      [.024, .05, .024]);
  }
}

/* cocktail high-top */
function highTop() {
  const g = new THREE.Group();
  const top = cyl(.42, .05, linen, 18); top.position.y = 1.08; g.add(top);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.42, .38, 1.08, 18, 1, true), linen);
  skirt.position.y = .54; g.add(skirt);
  for (let i = 0; i < 3; i++) {
    const fl = cyl(.03, .16, glassy, 8);
    fl.position.set((rnd() - .5) * .5, 1.18, (rnd() - .5) * .5);
    g.add(fl);
  }
  return g;
}
/** a linen high-top at (x, z): the GLB (top surface y 1.105) with three flutes
 *  on it as K.glass instances — the same two rnd() per flute the old highTop()
 *  drew — or the old Group of Meshes. ⚠ The GLB path's flutes are glassPale,
 *  not `glassy`: that transmission material is what made three render the
 *  whole campus a THIRD time inside the mirror pass at the prewedding deck
 *  (CLAUDE.md, the mirror frustum's finding 1), and the point of this swap is
 *  that it is gone from the deck. The caller adds its own collider. */
function highTopAt(K, g, x, z) {
  if (have('hightop')) {
    put(K.mdl('hightop'), x, 0, z, 1, null);
    for (let i = 0; i < 3; i++) {
      put(K.glass, x + (rnd() - .5) * .5, 1.185, z + (rnd() - .5) * .5, [.03, .16, .03]);
    }
    return;
  }
  const t = highTop(); t.position.set(x, 0, z); g.add(t);
}

/* (stringLights — bulbs as plain Meshes with no cable — was retired in KAN-208
   wave 3: the prewedding, cocktail and after-party runs are festoon() now.) */

function colLine(list, x1, z1, x2, z2, r) {
  const d = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(d / r));
  for (let i = 0; i <= n; i++) {
    list.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r });
  }
}
/* The same, between two WORLD points, with a floor height under which the
   collider does not exist — and pre-flagged __world so world.js's
   worldifyLateRecords leaves it where it was put. The rooftop moment is the
   only caller; every enclave-local moment keeps using colLine above. */
function colLineY(list, a, b, r, y0) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / r));
  for (let i = 0; i <= n; i++) {
    list.push({
      x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n, r, y0, __world: true,
    });
  }
}

/* ── ONE OF THE TWO TALL ASYMMETRIC FLORAL INSTALLATIONS ────────────────────
   `decor-ceremony-main.jpg` flanks the head of the aisle with two of these:
   2.5–3 m towers of cream and ivory garden roses shot through with powder-blue
   hydrangea and delphinium, over pale sage foliage, with the mass carried up
   ONE side — that asymmetry is the whole look and a symmetric cone reads as a
   topiary. `lean` is how far the crown drifts off the base; `hero` widens it. */
function installation(K, cx, cz, h, lean, hero) {
  const N = 24;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    /* a TEARDROP profile, wide at the foot and drawn to a plume — a constant
       width reads as a candle and a straight cone reads as a topiary */
    const w = (1 - Math.pow(t, 1.35) * .80) * (hero ? .78 : .64) + .10;
    bloomMass(K.flor,
      cx + lean * t * t + (rnd() - .5) * .18, .26 + t * (h - .34), cz + (rnd() - .5) * .22,
      w, .19, w * .78, Math.round(52 * (1.15 - t * .55)), 1 - t * .1);
  }
  bloomMass(K.flor, cx, .24, cz, .92, .22, .78, 95, 1.05);       // the skirt on the grass
  /* and the mass that spills sideways at chest height — every one of these in
     the render throws a wing out over the aisle rather than standing upright */
  const side = lean > 0 ? 1 : -1;
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    bloomMass(K.flor, cx + side * (.55 + t * .95), 1.55 - t * .75 + rnd() * .2,
      cz - .1 + (rnd() - .5) * .35, .34, .22, .3, Math.round(30 - t * 12), 1);
  }
  /* the delphinium and eucalyptus that break the silhouette. Short and mostly
     GREEN: at half a metre and pale blue the first pass read as glass shards. */
  for (let i = 0; i < 22; i++) {
    const t = .40 + rnd() * .62;
    put(K.flor, cx + lean * t * t + (rnd() - .5) * .95, .34 + t * h, cz + (rnd() - .5) * .74,
      [.032, .13 + rnd() * .17, .032], [(rnd() - .5) * 1.0, 0, (rnd() - .5) * 1.0],
      rnd() > .34 ? (rnd() > .5 ? PAL.LEAF : PAL.LEAF_D) : PAL.DELPH);
  }
}

/* ── THE PALE-BLUE FABRIC FLOWER ────────────────────────────────────────────
   The one object between the two installations that is not a flower at all:
   a ~1.8 m sculpted chiffon bloom, held at head height over the head of the
   aisle, with two streamers falling out of it. Petals are the shared bloom
   sphere flattened into blades, so it costs no extra draw call. */
function fabricFlower(K, cx, cy, cz) {
  const SKY = 0xa2c2e4, SKY_D = 0x88add6;
  for (let ring = 0; ring < 2; ring++) {
    const n = ring ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * .4;
      const len = (ring ? 1.02 : .66) + rnd() * .22;
      const tilt = (ring ? .22 : .52) + rnd() * .3;
      put(K.flor,
        cx + Math.cos(a) * len * .66, cy + (ring ? -.06 : .18) + Math.sin(tilt) * .14,
        cz + Math.sin(a) * len * .5,
        [len, .085, .44], [0, -a, tilt * .55], ring ? SKY : SKY_D);
    }
  }
  bloomMass(K.flor, cx, cy + .12, cz, .22, .18, .2, 16, 1.2);
  for (const s of [-1, 1]) {                       // the two chiffon streamers
    for (let i = 0; i < 6; i++) {
      put(K.flor, cx + s * (.55 + i * .19), cy - .34 - i * .3, cz + (rnd() - .5) * .3,
        [.34, .06, .19], [0, s * .55, s * (.26 + i * .12)], i % 2 ? SKY : SKY_D);
    }
  }
}

/* ═══ THE CEREMONY EXTRAS ═══════════════════════════════════════════════════
   Five more of the planner's renders, all on the same lawn and all in the same
   blue-and-cream palette. They stand on the −X flank of SITE.BEACH_LAWN,
   behind and to the side of the seating: far enough never to crowd the aisle,
   close enough to be a real walk from the ceremony spawn. Each is authored
   facing −Z at its own origin and dropped through frame(x, z, yaw). */

/* `decor-dessert-bar.jpg` — a 6 m white counter with the couple's names in
   script on its front, a white double-tiered parasol hung with pearl strands
   and small blooms, dispensers, cupcake stands and fluted plinths.
   ⚠ The render letters "Feng&Zheng". They are FUNG and CHENG. */
function dessertBar(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  const iflor = (x, y, z, rx, ry, rz, n, big) => bloomMass(K.flor, x, y, z, rx, ry, rz, n, big, F);
  /* the counter: the Blender GLB (6.0 × .92 × 1.04 under a 6.24 × 1.06 slab,
     its front face flat and blank at z −.46) or the two white boxes. The game
     hangs "Fung & Cheng" on that face either way. */
  if (have('dessert_counter')) iput(K.mdl('dessert_counter'), 0, 0, 0, 1, null);
  else {
    iput(K.white, 0, .52, 0, [6.0, 1.04, .92], null, 0xfcfbf7);
    iput(K.white, 0, 1.075, 0, [6.24, .07, 1.06], null, 0xfefdfa);
  }
  panel(g, F, scriptMat(), 3.0, .78, .35, .58, -.478);

  /* the parasol, standing behind the counter's right half — the GLB carries
     its own sixteen pearl strands and their blooms */
  if (have('parasol_tiered')) iput(K.mdl('parasol_tiered'), 1.05, 0, .34, 1, null);
  else {
    iput(K.rod, 1.05, 1.30, .34, [.045, 2.60, .045], null, PAL.OAK);
    iput(K.cone, 1.05, 2.34, .34, [1.95, .30, 1.95], null, 0xfbf8f0);
    iput(K.cone, 1.05, 2.70, .34, [1.16, .26, 1.16], null, 0xfbf8f0);
    iput(K.flor, 1.05, 2.92, .34, [.05, .08, .05], null, PAL.OAK);
    /* pearl strands + small blooms hanging off the canopy rim */
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const rr = 1.02 + rnd() * .78;
      const px = 1.05 + Math.cos(a) * rr, pz = .34 + Math.sin(a) * rr;
      const n = 6 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) {
        iput(K.pearl, px, 2.30 - k * .105 - rnd() * .02, pz, [.036, .05, .036], [0, a, 0]);
      }
      if (rnd() > .45) {
        iput(K.flor, px, 2.30 - n * .105, pz, [.085, .08, .085], null, bloomHue(rnd()));
      }
    }
  }

  /* the service: two dispensers, two cupcake stands, plates of desserts. The
     slab's top surface is y 1.11 — the base-origin GLBs sit on it. */
  const TOP = 1.11;
  [[-2.35, .155, .34], [-1.75, .145, .30]].forEach(([dx, r, h], i) => {
    if (have('drink_dispenser')) { iput(K.mdl('drink_dispenser'), dx, TOP, -.05, i ? .93 : 1, null); return; }
    iput(K.flute, dx, 1.30, -.05, [r, h, r], null, 0xf4f6f4);
    iput(K.disc, dx, 1.30 + h / 2 + .03, -.05, [r * .8, .05, r * .8], null, PAL.OAK);
    iput(K.flor, dx, 1.16, -.05, [r * .85, .1, r * .85], null, 0xf0d9a4);
  });
  for (const dx of [.15, .78]) {
    if (have('cupcake_stand')) { iput(K.mdl('cupcake_stand'), dx, TOP, -.02, 1, null); continue; }
    iput(K.rod, dx, 1.22, -.02, [.028, .22, .028], null, 0xfdfcf8);
    iput(K.disc, dx, 1.34, -.02, [.26, .022, .26], null, 0xfdfcf8);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.257;
      iput(K.flor, dx + Math.cos(a) * .15, 1.39, -.02 + Math.sin(a) * .15,
        [.05, .05, .05], null, i % 2 ? PAL.IVORY : PAL.CREAM);
    }
  }
  for (const dx of [-1.15, -.55, 1.5, 2.1]) {
    iput(K.disc, dx, 1.125, 0, [.24, .02, .24], null, 0xfbf9f4);
    for (let i = 0; i < 4; i++) {
      iput(K.flor, dx + (rnd() - .5) * .28, 1.17, (rnd() - .5) * .3,
        [.055, .05, .055], null, rnd() > .5 ? PAL.IVORY : PAL.CREAM);
    }
  }
  for (let i = 0; i < 7; i++) {                       // flutes at the far end
    iput(K.glass, 2.5 + (i % 4) * .16, 1.19, -.1 + Math.floor(i / 4) * .22, [.032, .16, .032]);
  }

  /* the fluted plinths at the near end — the GLB is a UNIT r .5 × h 1.0, so
     the old [r, h, r] becomes [r / .5, h, r / .5] — and the florals that
     ground it */
  if (have('plinth_fluted')) {
    iput(K.mdl('plinth_fluted'), -3.85, 0, -.35, [.60, .96, .60], null);
    iput(K.mdl('plinth_fluted'), -3.25, 0, .05, [.52, .72, .52], null);
  } else {
    iput(K.flute, -3.85, .48, -.35, [.30, .96, .30], null, 0xece0d2);
    iput(K.flute, -3.25, .36, .05, [.26, .72, .26], null, 0xece0d2);
  }
  iput(K.flor, -3.85, .99, -.35, [.2, .06, .2], null, PAL.IVORY);
  iflor(-3.85, 1.14, -.35, .22, .16, .2, 12, .95);
  iflor(-3.25, .86, .05, .2, .14, .18, 10, .9);
  if (haveClusters()) {
    clusterAt(K, -2.55, 0, -.42, 1.15, 0, F);
    clusterAt(K, 2.55, 0, -.44, 1.2, 0, F);
  } else {
    iflor(-2.55, .34, -.42, .72, .34, .5, 30, 1.15);
    iflor(2.55, .36, -.44, .80, .38, .52, 34, 1.2);
  }

  colLineFrame(C, F, -3.0, 0, 3.0, 0, .62);
  colAt(C, F, -3.85, -.35, .5);
  colAt(C, F, 1.05, .34, .32);
}

/* `decor-favor-wheelbarrow.jpg` — the barrow of gold favour boxes, circled in
   red in Carl's screenshot, standing at the end of the dessert bar. */
function wheelbarrow(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  const iflor = (x, y, z, rx, ry, rz, n, big) => bloomMass(K.flor, x, y, z, rx, ry, rz, n, big, F);
  /* the GLB carries the pan, the wheel at −Z, the handles rising toward +Z and
     the fifteen gold boxes; the primitive version is everything below it */
  if (have('wheelbarrow')) iput(K.mdl('wheelbarrow'), 0, 0, 0, 1, null);
  else {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(.48, .32, .34, 4), steelM);
    pan.position.set(0, .60, 0);
    pan.rotation.y = Math.PI / 4;
    pan.scale.set(1.25, 1, .74);
    pan.applyMatrix4(F);
    g.add(pan);
    for (const s of [-1, 1]) {
      iput(K.dark, s * .30, .72, .82, [.028, 1.75, .028], [1.30, 0, 0], 0xaab1b6);
      iput(K.dark, s * .28, .21, -.30, [.03, .42, .03], [.2, 0, 0], 0xaab1b6);
    }
    iput(K.dark, 0, .19, -.78, [.19, .08, .19], [0, 0, Math.PI / 2], 0x26241f);
    for (let i = 0; i < 15; i++) {
      const bx = (rnd() - .5) * .92, bz = (rnd() - .5) * .44, by = .80 + (i % 3) * .07;
      iput(K.gold, bx, by, bz, [.105, .12, .105], [0, rnd() * 1.6, 0], 0xd8bd80);
      iput(K.flor, bx, by + .078, bz, [.048, .03, .048], null, PAL.IVORY);
    }
  }
  if (haveClusters()) clusterAt(K, -.72, 0, .28, 1.05, 0, F);
  else iflor(-.72, .3, .28, .55, .28, .4, 22, 1.05);
  colAt(C, F, 0, 0, .78);
}

/* `decor-plinths-and-hats.jpg`, right half — straw hats pegged on three lines
   between two timber posts, with a basket of spares underneath. */
function hatRack(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  const iflor = (x, y, z, rx, ry, rz, n, big) => bloomMass(K.flor, x, y, z, rx, ry, rz, n, big, F);
  const SP = 3.5;
  for (const s of [-1, 1]) colAt(C, F, s * SP / 2, 0, .3);
  /* the GLB: posts at x ±1.75, three lines, fifteen hats, the basket of spares
     at (1.15, .62); else the posts, wires and discs below */
  if (have('hat_rack')) iput(K.mdl('hat_rack'), 0, 0, 0, 1, null);
  else {
    for (const s of [-1, 1]) {
      iput(K.oak, s * SP / 2, 1.14, 0, [.085, 2.28, .085], null, PAL.OAK_D);
    }
    const hat = (hx, hy) => {
      iput(K.straw, hx, hy, -.05, [.20, .016, .20], [Math.PI / 2, 0, 0], 0xdcbd90);
      iput(K.straw, hx, hy, -.10, [.115, .10, .115], [Math.PI / 2, 0, 0], 0xd2b083);
      iput(K.straw, hx, hy, -.09, [.128, .034, .128], [Math.PI / 2, 0, 0], 0x352f28);
    };
    for (let r = 0; r < 3; r++) {
      const y = 1.98 - r * .55;
      const a = fpt(F, -SP / 2, y, 0), b = fpt(F, SP / 2, y, 0);
      wireRun(K.wire, a.x, a.y, a.z, b.x, b.y, b.z, .035, 5);
      for (let i = 0; i < 5; i++) hat(-SP / 2 + (i + .5) * (SP / 5), y - .21);
    }
    iput(K.flute, 1.15, .19, .62, [.42, .38, .42], null, 0xd6b98d);
    for (let i = 0; i < 4; i++) hat(1.15 - .1 + i * .07, .52 + i * .03);
  }
  if (haveClusters()) clusterAt(K, -1.9, 0, .5, 1.05, 0, F);
  else iflor(-1.9, .28, .5, .55, .26, .42, 22, 1.05);
  colAt(C, F, 1.15, .62, .5);
}

/* `decor-plinths-and-hats.jpg`, left half — a pair of white rectangular
   plinths with floral tops and nine strands of pearls swagged between them. */
function plinthPair(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  const iflor = (x, y, z, rx, ry, rz, n, big) => bloomMass(K.flor, x, y, z, rx, ry, rz, n, big, F);
  const P = [[-1.30, 1.98], [-.38, 1.40], [1.30, 1.78]];
  for (const [px, ph] of P) {
    /* the GLB is a UNIT .30 × .30 × 1.0 — scale Y to the height */
    if (have('plinth_rect')) iput(K.mdl('plinth_rect'), px, 0, 0, [1, ph, 1], null);
    else iput(K.white, px, ph / 2, 0, [.30, ph, .30], null, 0xfdfcf8);
    colAt(C, F, px, 0, .38);
  }
  /* The floral TOPS stay bloomMass, deliberately. A `cluster_*` is a GROUND
     cluster — 1.3 m wide with a flat foliage underside — and on a 0.30 m plinth
     it reads as a parasol balanced on a post, not as an arrangement standing in
     a vessel. INTEGRATION.md's cluster list is the aisle lining, the runs under
     the towers, the clusters BESIDE each extra, the head-table ends and the
     welcome-board base; a plinth top is none of those. (Tried, looked at,
     reverted.) */
  iflor(-1.30, 2.18, 0, .46, .28, .38, 40, .95);
  iflor(1.30, 1.98, 0, .44, .26, .36, 38, .9);
  iflor(-.38, 1.52, 0, .22, .14, .2, 9, .9);
  if (haveClusters()) {
    clusterAt(K, -1.65, 0, .28, 1.15, 0, F);
    clusterAt(K, 1.55, 0, .3, 1.1, 0, F);
  } else {
    iflor(-1.65, .3, .28, .72, .34, .52, 30, 1.15);
    iflor(1.55, .3, .3, .68, .32, .5, 28, 1.1);
  }
  /* the pearls: nine catenaries between the two tall plinths — instanced,
     either way; the GLB plinths carry none.
     KAN-208 wave 3: STRUNG, not dotted. The render hangs strands of small
     touching pearls; this used to hang 18 octahedra per strand, 5 × 7 cm
     (egg-sized diamonds), on ONE shared x grid — so from the front the nine
     strands' beads lined up into vertical columns and the swag read as a bead
     curtain. Now each strand is walked by ARC LENGTH at a 2.6 cm pitch with a
     2.2 cm round pearl (G_PEARL), so every strand has its own count and phase
     (~1,000 pearls, one draw call — the same bucket kind as before). Same nine
     curves (y0, sag, z), same plinth tops. No rnd(). */
  const PEARL_R = .011, PITCH = .026;
  for (let s = 0; s < 9; s++) {
    const y0 = 1.86 - s * .045, sag = .38 + s * .085, pz = .06 + s * .012;
    const cy = (t) => y0 - Math.sin(t * Math.PI) * sag;
    const M = 96, len = [0];
    for (let k = 1; k <= M; k++) {
      const t0 = (k - 1) / M, t1 = k / M;
      len.push(len[k - 1] + Math.hypot(2.60 / M, cy(t1) - cy(t0)));
    }
    const L = len[M], n = Math.floor(L / PITCH), off = (L - n * PITCH) / 2;
    for (let i = 0, k = 1; i <= n; i++) {
      const d = off + i * PITCH;
      while (k < M && len[k] < d) k++;
      const t = (k - 1 + (d - len[k - 1]) / (len[k] - len[k - 1])) / M;
      iput(K.pearlS, -1.30 + t * 2.60, cy(t), pz, PEARL_R, null);
    }
  }
}

/* `decor-beverage-coconut.jpg` — a white shelving rack of coconuts, and a
   small white canopy cart of fruit with a "Beverage" cloth on its front. */
function coconutStand(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  /* the GLB: four uprights, four shelves of young coconuts, the arch on top */
  if (have('coconut_rack')) iput(K.mdl('coconut_rack'), 0, 0, 0, 1, null);
  else {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      iput(K.rod, sx * .34, 1.02, sz * .24, [.026, 2.04, .026], null, 0xfbfaf6);
    }
    for (let i = 0; i < 4; i++) {
      const y = .42 + i * .48;
      iput(K.white, 0, y, 0, [.74, .035, .54], null, 0xfbfaf6);
      for (let k = 0; k < 2 + (i % 2); k++) {
        iput(K.flor, -.22 + k * .22, y + .15, (rnd() - .5) * .2, [.125, .135, .125], null,
          rnd() > .4 ? 0x7e9a52 : 0xc4bf95);
      }
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(.36, .026, 5, 14, Math.PI), frameW);
    arch.position.set(0, 2.04, 0);
    arch.applyMatrix4(F);
    g.add(arch);
  }
  colAt(C, F, 0, 0, .5);
}
function beverageCart(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  const iflor = (x, y, z, rx, ry, rz, n, big) => bloomMass(K.flor, x, y, z, rx, ry, rz, n, big, F);
  /* the GLB: table, legs, canopy posts, the tilted scalloped canopy, thirteen
     fruit, the steel bucket and two vases — its front edge is plain, the
     "Beverage" cloth is hung by the game below either way */
  if (have('beverage_cart')) iput(K.mdl('beverage_cart'), 0, 0, 0, 1, null);
  else {
    iput(K.white, 0, .88, 0, [1.56, .07, .78], null, 0xfcfbf7);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      iput(K.rod, sx * .70, .43, sz * .32, [.028, .86, .028], null, 0xfcfbf7);
      iput(K.rod, sx * .74, 1.46, sz * .34, [.028, 1.10, .028], null, 0xfcfbf7);
    }
    iput(K.white, 0, 2.02, 0, [1.80, .045, 1.02], [0, 0, .05], 0xfaf8f2);
    const fruit = [0x4e7a3c, 0xe6c455, 0xe08a3c, 0x6f4d78, 0xd8564a];
    for (let i = 0; i < 13; i++) {
      const s = .07 + rnd() * .07;
      iput(K.flor, -.6 + rnd() * 1.2, .95 + s, (rnd() - .5) * .5, [s * 1.3, s, s * 1.1],
        null, fruit[i % fruit.length]);
    }
    iput(K.flute, .58, 1.02, -.08, [.13, .22, .13], null, 0xb9c0c4);
    iflor(-.5, 1.06, -.2, .14, .18, .12, 9, .95);
  }
  panel(g, F, bevMat(), .82, .74, .06, .56, -.40);
  if (haveClusters()) clusterAt(K, -1.05, 0, .35, 1.1, 0, F);
  else iflor(-1.05, .3, .35, .6, .3, .45, 26, 1.1);
  colLineFrame(C, F, -.8, 0, .8, 0, .5);
}

/* ═══ THE ROUND TIMBER-PLANK COCKTAIL BAR — `decor-cocktail-bar.jpg` ═════════
   Carl (ask #3): "the real cocktail bar is a ROUND timber-plank bar, not the
   white counter." A drum of VERTICAL light-pine boards — the plank rhythm IS
   the look; a smooth cylinder reads as a concrete planter — under a round
   plank top overhanging a hand's width. On it: the back-bar bottle cluster, a
   shaker, two strainers, and rows of the four wedding cocktails from
   `decor-cocktail-menu.jpg` in their real colours and glassware. Beside it: a
   white menu easel leaning like the render's, grounded in a lavender/lilac +
   white cluster — the PAL table has no lilac, so those hues are local.
   Authored at the origin facing −Z (the arriving guests) and dropped through
   frame(); every instanced part goes through the curried iput (trap 1). The
   liquids are OPAQUE tinted instances inside transparent glass — opaque
   renders first, so the colour reads through the glass, never behind it. */
function roundBar(K, g, C, F) {
  /* every instanced part of a prop goes through the prop's own frame — miss
     this and the part is built at the enclave origin instead (it happened) */
  const iput = (b, x, y, z, sc, rot, col) => put(b, x, y, z, sc, rot, col, F);
  /* the drum + top: the GLB (30 boards on the 1.05 m ring, plank top to y 1.13,
     nothing on it) or the instanced boards, discs and seams */
  if (have('round_bar')) iput(K.mdl('round_bar'), 0, 0, 0, 1, null);
  else {
    const PINE = [0xe0cba4, 0xd6bd92, 0xdcc59c, 0xd0b788];
    const N = 30, BRR = 1.05;                      // 30 boards on a 1.05 m ring
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      iput(K.oak, Math.sin(a) * BRR, .52, Math.cos(a) * BRR,
        [.215, 1.04, .045], [0, a, 0], PINE[i % 4]);
    }
    /* the top: a plank disc overhanging the drum, a darker shadow ring under
       its rim, and thin dark seams so it reads as boards, not a slab */
    iput(K.disc, 0, 1.045, 0, [1.16, .025, 1.16], null, 0xb59a6c);
    iput(K.disc, 0, 1.10, 0, [1.24, .06, 1.24], null, 0xe3cfa6);
    for (const sx of [-.86, -.44, 0, .44, .86]) {
      const chord = 2 * Math.sqrt(Math.max(.05, 1.19 * 1.19 - sx * sx));
      iput(K.oak, sx, 1.133, 0, [.018, .004, chord * .96], null, 0xb59a6c);
    }
  }
  const Y = 1.13;                                  // the top's working surface

  /* ── the back-bar: eleven bottles in a loose arc at the rear of the top ──
     ⚠ NOT the K.dark bucket: tints MULTIPLY the material color and bronzeD's
     0x2e2a26 base crushes every bottle to black. K.rod's linen base is near
     white, so the glass colours actually read. */
  /* the GLB bottle_set (eleven bottles, the shaker, two strainers) is base-
     origin and sits on the top at (0, 1.13, +.40); else the instanced bottles */
  if (have('bottle_set')) iput(K.mdl('bottle_set'), 0, Y, .40, 1, null);
  else {
    const BOT = [0x3d5c3f, 0x8a5a28, 0xcdd6da, 0x7c3a2d, 0x33506e, 0x9c8144];
    for (let i = 0; i < 11; i++) {
      const a = -1.1 + i * .22;
      const bx = Math.sin(a) * .72, bz = .38 + Math.cos(a) * .34 + (i % 3) * .07;
      const h = .30 + (i % 4) * .035;
      iput(K.rod, bx, Y + h / 2, bz, [.046, h, .046], null, BOT[i % 6]);
      iput(K.rod, bx, Y + h + .05, bz, [.016, .11, .016], null, BOT[(i + 3) % 6]);
    }
    /* the shaker and two hawthorne strainers, right of the bottles */
    iput(K.rod, .82, Y + .12, .18, [.082, .24, .082], null, 0xc6ccd1);
    iput(K.rod, .82, Y + .27, .18, [.055, .07, .055], null, 0xb7bdc2);
    for (const s of [0, 1]) {
      iput(K.rod, .58 + s * .18, Y + .03, .52 + s * .08,
        [.07, .012, .07], [.5, s * .8, .25], 0xb7bdc2);
      iput(K.rod, .70 + s * .18, Y + .09, .60 + s * .08,
        [.012, .16, .012], [1.2, s * .8, 0], 0xb7bdc2);
    }
  }

  /* ── the four wedding cocktails, a row of each like the photo ──
     与我常在 — orange Aperol spritz, stemmed wine glass, grapefruit + rosemary
     心动的旋律 — pink cranberry-coconut (non-alc), tall stemmed glass, foam
     翠露晨光 — yellow rum highball, straight faceted glass, mint
     荔枝尼格罗尼 — amber lychee negroni, rocks tumbler, orange-peel twist */
  /* KAN-208 wave 3: two GLBs in the bar's frame, origin on the top at its
     centre — the fifteen glass SHELLS (geometry only, on OUR glassPale: the
     instanced, untinted glassPale program already exists, and nothing here may
     become a transmission material) and every OPAQUE thing in and on them
     (baked: the four liquids, the coconut foam, ice, grapefruit, rosemary,
     mint, passion fruit, the orange twist). Same fifteen positions as the
     primitives below, which stay as the fallback. Neither path draws rnd(). */
  if (have('cocktail_drinks') && models.geometry('cocktail_glassware')) {
    iput(K.mdl('cocktail_drinks'), 0, Y, 0, 1, null);
    iput(K.mdlAs('cocktail_glassware', glassPale), 0, Y, 0, 1, null);
  } else {
    for (let i = 0; i < 4; i++) {                    // amber rocks tumblers, far left
      const x = -.92 + (i % 2) * .17, z = -.30 - Math.floor(i / 2) * .19 + (i % 2) * .06;
      iput(K.glass, x, Y + .062, z, [.054, .124, .054]);
      iput(K.rod, x, Y + .055, z, [.046, .1, .046], null, 0xb35a1a);
      iput(K.flor, x + .025, Y + .128, z, [.03, .012, .014], [0, .7, .5], 0xe8923a);
    }
    for (let i = 0; i < 4; i++) {                    // yellow faceted highballs
      const x = -.42 + (i % 2) * .16, z = -.42 - Math.floor(i / 2) * .2 + (i % 2) * .05;
      iput(K.flute, x, Y + .095, z, [.04, .19, .04], null, 0xe6cf52);
      iput(K.flor, x, Y + .205, z, [.024, .02, .024], null, 0x3e7a44);
    }
    for (let i = 0; i < 4; i++) {                    // orange spritz, stemmed wine
      const x = .12 + (i % 2) * .17, z = -.34 - Math.floor(i / 2) * .21 + (i % 2) * .07;
      iput(K.glass, x, Y + .004, z, [.038, .008, .038]);
      iput(K.glass, x, Y + .055, z, [.009, .10, .009]);
      iput(K.glass, x, Y + .145, z, [.048, .105, .048]);
      iput(K.flor, x, Y + .135, z, [.041, .048, .041], null, 0xe8722c);
      iput(K.flor, x + .03, Y + .185, z, [.028, .02, .011], [0, 0, .95], 0xf29079);
      iput(K.flor, x - .012, Y + .225, z + .01, [.006, .052, .006], [.35, 0, -.25], 0x4a6b45);
    }
    for (let i = 0; i < 3; i++) {                    // pink talls, right, behind
      const x = .66 + (i % 2) * .17, z = -.18 - i * .14;
      iput(K.glass, x, Y + .004, z, [.036, .008, .036]);
      iput(K.glass, x, Y + .07, z, [.008, .13, .008]);
      iput(K.glass, x, Y + .20, z, [.041, .13, .041]);
      iput(K.rod, x, Y + .185, z, [.034, .095, .034], null, 0xf09fb6);
      iput(K.rod, x, Y + .25, z, [.03, .022, .03], null, 0xfdfbf6);
      iput(K.white, x + .012, Y + .272, z, [.018, .016, .018], null, 0xfdfbf6);
    }
  }

  /* ── the white menu easel, leaning beside the bar like the render ──
        the easel: the GLB (blank board .90 × 1.26, centre y .88, leaning back
        .16, tripod legs; front −Z; origin under the board) turned .42 like the
        old one, or the board box + three oak legs. The menu hangs off whichever
        board is actually standing there — see easelPanel. */
  const menuGLB = have('menu_easel');
  if (menuGLB) iput(K.mdl('menu_easel'), -1.78, 0, -.55, 1, [0, .42, 0]);
  else {
    iput(K.white, -1.78, .88, -.55, [.9, 1.26, .045], [.16, .42, 0], 0xfdfcf8);
    iput(K.oak, -2.0, .55, -.40, [.04, 1.24, .04], [-.2, .42, .12], 0xd6c09a);
    iput(K.oak, -1.55, .55, -.48, [.04, 1.24, .04], [-.2, .42, -.12], 0xd6c09a);
    iput(K.oak, -1.79, .5, -.02, [.04, 1.1, .04], [.3, .42, 0], 0xd6c09a);   // prop leg, BEHIND the board
  }
  easelPanel(g, menuMat(), .78, 1.10, -1.78, -.55, .42, menuGLB, F);

  /* ── the lavender/lilac + white cluster at its base — delphinium-purple
        roses, lilac and white stock over pale sage, per the render ── */
  if (have('lilac_cluster')) iput(K.mdl('lilac_cluster'), -1.6, 0, -.15, 1, [0, .42, 0]);
  else {
    const LIL = [0x8f6fb5, 0xb391cc, 0xcbb4de, 0x9a7fc0, PAL.WHITE, 0xf1eef6,
      PAL.CREAM, PAL.LEAF, PAL.LEAF_D];
    for (let i = 0; i < 55; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd());
      const x = -1.55 + Math.cos(a) * .75 * rr - .35 * rnd();
      const z = -.15 + Math.sin(a) * .55 * rr;
      const s = .05 + rnd() * .05;
      iput(K.flor, x, .10 + rnd() * .5 * (1 - rr * .7), z,
        [s, s * (.85 + rnd() * .3), s], null, LIL[Math.floor(rnd() * LIL.length)]);
    }
    for (let i = 0; i < 6; i++) {                  // the white stock spikes
      const x = -2.05 + rnd() * .8, z = -.35 + rnd() * .55;
      const h = .55 + rnd() * .45;
      iput(K.rod, x, h / 2, z, [.008, h, .008], null, 0x9aa77f);
      for (let k = 0; k < 4; k++) {
        iput(K.flor, x + (rnd() - .5) * .04, h - .05 - k * .07, z + (rnd() - .5) * .04,
          [.028, .026, .028], null, k ? 0xf6f3ec : 0xcbb4de);
      }
    }
  }

  /* the bar blocks as a CIRCLE now, not a line — ten circles around the drum
     stop the walker ~1.85 m out (1.0 + r .5 + PLAYER_R), still comfortably
     inside the interactable's 2.2 m reach */
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    colAt(C, F, Math.sin(a) * 1.0, Math.cos(a) * 1.0, .5);
  }
  colAt(C, F, -1.78, -.45, .55);                   // the easel + its florals
}

/* ── prop frames ────────────────────────────────────────────────────────────
   A dressing prop is authored ONCE at the origin facing −Z (which is how you
   look at it in the render) and then dropped somewhere on the lawn turned by
   `yaw`. `put`'s parent matrix carries the instanced parts; `colAt` carries the
   colliders through the same transform so the two can never disagree. */
function frame(x, z, yaw) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, 0, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(1, 1, 1),
  );
}
const _fv = new THREE.Vector3();
function colAt(list, F, lx, lz, r) {
  _fv.set(lx, 0, lz).applyMatrix4(F);
  list.push({ x: _fv.x, z: _fv.z, r });
}
/** a chain of colliders along a line in a prop's local frame */
function colLineFrame(list, F, x1, z1, x2, z2, r) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / r));
  for (let i = 0; i <= n; i++) {
    colAt(list, F, x1 + (x2 - x1) * i / n, z1 + (z2 - z1) * i / n, r);
  }
}
/** a point in a prop's local frame, as a fresh Vector3 (for wire endpoints) */
function fpt(F, x, y, z) { return new THREE.Vector3(x, y, z).applyMatrix4(F); }
/* ── THE EASEL BOARD'S FACE, MEASURED ───────────────────────────────────────
   `menu_easel` carries a BLANK board by contract and the game hangs its own
   texture a few mm proud of it. The GLB's board is NOT where the old primitive
   box was: raycasting the geometry along +Z at the board's own heights gives a
   front face at **z −0.2102 at y .88**, leaning back .16 rad (dz/dy = +.1612,
   atan → .1598 — the spec's lean, confirmed). The old box was .045 thick about
   z 0, so its face sat at −.0225; hanging the panel at that offset puts it
   **19 cm INSIDE** the GLB. That is not theoretical — it is what the first pass
   of this integration shipped: the cocktail menu and the prewedding welcome
   sign both went blank, each texture rendering correctly but behind the board.
   The face normal leans with the board and points forward and slightly UP (a
   board leaning back shows its face tilted toward you), which is exactly what
   `(0,0,-1).applyEuler(lean, yaw, 0)` gives — so the ROTATION the old code used
   was always right and only the reference point was wrong. */
const EASEL_LEAN = .16;
const EASEL_FACE_Y = .88;
const EASEL_FACE_Z = -.2102;      // the GLB board's face, by raycast
const EASEL_BOX_Z = -.0225;       // the old .045 box's face — the fallback path
/** hang a texture on an easel's board face, 3 cm proud, parallel to the board.
 *  (x, z) is the easel's foot, `yaw` its turn, `glb` which board is standing
 *  there; `F` an optional prop frame the whole thing rides (the round bar's). */
function easelPanel(g, mat, w, h, x, z, yaw, glb, F) {
  const fz = glb ? EASEL_FACE_Z : EASEL_BOX_Z;
  const n = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(EASEL_LEAN, yaw, 0));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(
    x + fz * Math.sin(yaw) + n.x * .03,
    EASEL_FACE_Y + n.y * .03,
    z + fz * Math.cos(yaw) + n.z * .03,
  );
  m.rotation.set(EASEL_LEAN, yaw + Math.PI, 0);   // flush on the board's face
  if (F) m.applyMatrix4(F);
  g.add(m);
  return m;
}

/** a flat panel (a Mesh, not an instance) standing in a prop's local frame */
function panel(g, F, mat, w, h, lx, ly, lz) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(lx, ly, lz);
  m.rotation.y = Math.PI;                       // the plane's face looks −Z
  m.applyMatrix4(F);
  g.add(m);
  return m;
}

/* ── LETTERING ──────────────────────────────────────────────────────────────
   ⚠ The planner's renders romanise the surnames as "Feng" and "Zheng". The
   couple are Carl FUNG and Rachel CHENG. Every string below is the project's
   own copy (wedding-app / the title card), NOT a transcription off a render.
   The date is the render's and is correct — it is CFG.SEED, 2027-03-20. */
/** an art plate from assets/art/, decoded async; a failure warns and leaves
 *  the text-only paint in place (the words are the game's either way) */
function loadArt(file, onload) {
  const img = new Image();
  img.onload = () => onload(img);
  img.onerror = () => console.warn('moments: art plate failed to load —', ART_DIR + file);
  img.src = ART_DIR + file;
}
function texWelcomeSign() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 896;
  const x = c.getContext('2d');
  /* the marble drift's control points come off the seeded stream ONCE, here,
     synchronously — the async repaint under the art replays them, so a late
     image can never consume (or re-order) a draw */
  const drift = [];
  for (let i = 0; i < 22; i++) {
    drift.push([rnd() * 896, (rnd() - .5) * 130, (rnd() - .5) * 130, (rnd() - .5) * 90]);
  }
  const paint = (img) => {
    const gr = x.createLinearGradient(0, 0, 60, 896);
    gr.addColorStop(0, '#f4f7f9'); gr.addColorStop(.5, '#e5ebef'); gr.addColorStop(1, '#cfd8de');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 896);
    if (img) {
      /* welcome-board-art.webp — the florals, no text — as the base layer */
      x.drawImage(img, 0, 0, 512, 896);
    } else {
      x.globalAlpha = .13; x.strokeStyle = '#8fa2ae'; x.lineWidth = 2;
      for (const [y0, d1, d2, d3] of drift) {       // a faint marble drift
        x.beginPath();
        x.moveTo(0, y0);
        x.bezierCurveTo(170, y0 + d1, 340, y0 + d2, 512, y0 + d3);
        x.stroke();
      }
      x.globalAlpha = 1;
    }
    /* the lettering, on top — the game's own copy. The plate's clear centre
       runs y ≈ 262…718 (measured), so the block sits inside that band. */
    x.textAlign = 'center';
    x.fillStyle = '#7f8c97';
    /* fitted to 372 px (≤ 88 px type), not a fixed 104 px: at 104 the italic
       "Welcome" ran wider than the arch at that height and lost its W and e to
       the board's own edge (and, since wave 3, to the moulding's inner lip) */
    let fs = 88;
    do {                                   // fit, whatever serif the OS supplies
      x.font = `italic 600 ${fs}px Georgia, "Times New Roman", serif`;
      fs -= 2;
    } while (x.measureText('Welcome').width > 372 && fs > 40);
    x.fillText('Welcome', 256, 350);
    x.font = '600 26px Georgia, serif';
    x.fillText('T O   O U R   W E D D I N G', 256, 398);
    x.fillStyle = '#77848f';
    x.font = 'italic 600 78px Georgia, serif';
    x.fillText('Carl', 256, 505);
    x.font = 'italic 400 46px Georgia, serif';
    x.fillText('&', 256, 566);
    x.font = 'italic 600 78px Georgia, serif';
    x.fillText('Rachel', 256, 640);
    x.fillStyle = '#8b98a3';
    x.font = '500 34px Georgia, serif';
    x.fillText('2 0 2 7 . 0 3 . 2 0', 256, 706);
  };
  paint(null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  loadArt('welcome-board-art.webp', (img) => { paint(img); t.needsUpdate = true; });
  return t;
}
/** transparent script lettering, for the dessert bar's front */
function texScript(line1, line2, w = 640, h = 200) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.textAlign = 'center';
  x.fillStyle = '#20242a';
  x.font = `italic 700 ${Math.round(h * .40)}px Georgia, "Times New Roman", serif`;
  x.fillText(line1, w * .44, h * .46);
  x.fillText(line2, w * .58, h * .90);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function texWord(word, col = '#5d7fa8') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.globalAlpha = .5;
  for (let i = 0; i < 9; i++) {                 // the render's scattered ochre dots
    x.fillStyle = '#e9ab55';
    x.beginPath();
    x.ellipse(rnd() * 256, rnd() * 256, 9 + rnd() * 13, 6 + rnd() * 9, 0, 0, 6.3);
    x.fill();
  }
  x.globalAlpha = 1;
  x.textAlign = 'center';
  x.fillStyle = col;
  x.font = 'italic 600 46px Georgia, serif';
  x.fillText(word, 128, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Lazily built so the CanvasTextures are only paid for when a moment that
   needs them is dressed, and so nothing touches `document` at import time. */
let _scriptMat = null, _bevMat = null, _signMats = null, _menuMat = null;
function scriptMat() {
  return (_scriptMat ||= new THREE.MeshStandardMaterial({
    map: texScript('Fung &', 'Cheng'), transparent: true, depthWrite: false, roughness: .9,
  }));
}
function bevMat() {
  return (_bevMat ||= new THREE.MeshStandardMaterial({
    map: texWord('Beverage'), transparent: true, roughness: .92, side: THREE.DoubleSide,
  }));
}
/* the welcome board's two materials, cached — the ceremony decor is emitted
   TWICE since the cocktail share (see dressCeremonyDecor) and the second
   emission must not pay for (or re-randomise) a second CanvasTexture */
function signMats() {
  return (_signMats ||= [
    new THREE.MeshStandardMaterial({ map: texWelcomeSign(), roughness: .82 }),
    new THREE.MeshStandardMaterial({ color: PAL.STONE, roughness: .86 }),
  ]);
}
/* the round bar's menu — `decor-cocktail-menu.jpg`, the four wedding cocktails.
   The drink NAMES are the planner's own copy and are correct as written; only
   the surnames on that sheet were mis-romanised (see LETTERING above). */
function texCocktailMenu() {
  /* authored in a 320 × 448 space, rendered at 2× — the drinks are drawn art
     now (assets/art/menu-drinks.webp), and worth the texels */
  const S = 2;
  const c = document.createElement('canvas');
  c.width = 320 * S; c.height = 448 * S;
  const x = c.getContext('2d');
  const rows = [
    ['#e8722c', '与我常在'],
    ['#f0a0b8', '心动的旋律'],
    ['#e3c93e', '翠露晨光'],
    ['#c47a2e', '荔枝尼格罗尼'],
  ];
  /* the plate is RGBA, four 1024² quadrants in reading order = menu order:
     the spritz in a stem, the pink coconut tall, the yellow highball, the
     amber rocks. Each crop is the quadrant's measured alpha bbox [x, y, w, h]. */
  const CROPS = [[372, 54, 281, 919], [366, 55, 291, 910], [321, 52, 381, 913], [261, 185, 530, 704]];
  const paint = (img) => {
    x.setTransform(S, 0, 0, S, 0, 0);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fdfbf4'; x.fillRect(0, 0, 320, 448);
    x.textAlign = 'center';
    x.fillStyle = '#e07b28';
    x.font = '600 44px "Songti SC", Georgia, serif';
    x.fillText('鸡尾酒', 160, 64);
    x.font = 'italic 600 26px Georgia, serif';
    x.fillText('Wedding Cocktails', 160, 102);
    x.font = '500 30px "Songti SC", Georgia, serif';
    rows.forEach(([col, name], i) => {
      const y = 168 + i * 72;
      if (img) {
        /* the drink beside its name, 64 tall, aspect kept, where the dot was */
        const [cx, cy, cw, ch] = CROPS[i];
        const qx = (i % 2) * 1024, qy = (i >> 1) * 1024;
        const h = 64, w = Math.min(56, h * cw / ch);
        x.drawImage(img, qx + cx, qy + cy, cw, ch, 56 - w / 2, y - 12 - h / 2, w, h);
      } else {
        x.fillStyle = col;
        x.beginPath(); x.arc(56, y - 10, 13, 0, 6.3); x.fill();
      }
      x.fillStyle = '#5a5148';
      x.fillText(name, 186, y);
    });
  };
  paint(null);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  loadArt('menu-drinks.webp', (img) => { paint(img); t.needsUpdate = true; });
  return t;
}
function menuMat() {
  return (_menuMat ||= new THREE.MeshStandardMaterial({
    map: texCocktailMenu(), roughness: .9,
  }));
}

/* ═══ THE CEREMONY DECOR, AS A FUNCTION — because it dresses TWO moments ════
   Carl (ask #3, 2026-08-02): "Cocktail hour keeps the ceremony decor — same
   lawn, an hour apart; only the seating would be cleared."
   The moment system toggles ONE prop group per moment, so sharing means
   EMITTING TWICE: once into groups.ceremony (seated = true) and once into
   groups.cocktail (seated = false). Each moment's kit bakes its own
   InstancedMeshes — the instance tables duplicate, the geometry and the
   materials are shared, and that is the cheap, correct way to do it. The
   sixty cross-back chairs and their drapes are the only thing gated: the
   seating is struck between the two events, everything else stands.
   Colliders land in the CALLER'S list (CC), so each moment carries its own
   copy of the installation/arch/board/extras colliders and the swap in
   setMoment keeps working unchanged.
   ⚠ The body below is the 2026-08-02 decor pass MOVED, not rewritten — same
   props, same positions, same colliders, same rnd draw order, so the ceremony
   emission is exactly what it was before the share. */
function dressCeremonyDecor(K, g, CC, seated) {
  const AX = -22, AZ = 71.4;                     // aisle centre-line, its head
  const ROW0 = 62, ROWS = 5, PER = 6;

  /* ── sixty wooden cross-back chairs, each with its white chiffon drape ──
     Eleven timber members apiece and two cones of chiffon, all instanced:
     the whole seating block is TWO draw calls where it used to be 360
     meshes. 0.62 m of pitch leaves the drapes just touching, which is how
     the render reads. */
  for (const side of [-1, 1]) {
    for (let row = 0; row < ROWS; row++) {
      const rz = ROW0 + row * 1.0;
      /* the chairs draw NO rnd, so clearing them (seated = false) cannot
         shift the seeded stream — the row-end posies stay either way */
      if (seated) for (let i = 0; i < PER; i++) {
        chairAt(K, AX + side * (1.6 + i * .62), rz, 0, true);
      }
      bloomMass(K.flor, AX + side * 1.36, .95, rz - .1, .18, .13, .15, 10, .85);
    }
  }

  /* ── the aisle is GRASS STREWN WITH PETALS. The render has no runner and
        the old 3 × 12.4 m linen slab was the single most wrong thing in the
        frame — it read as a carpet showroom against a lawn. ── */
  for (let i = 0; i < 330; i++) {
    const s = .034 + rnd() * .032;
    put(K.petal, AX + (rnd() - .5) * 2.9, .026 + rnd() * .008, 58.6 + rnd() * 13.8,
      [s, s, 1], [-Math.PI / 2, 0, rnd() * 6.283]);
  }

  /* ── low floral clusters lining both sides, thickening toward the head ── */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const t = i / 10;
      const cz = 58.8 + t * 13.4;
      if (cz > 61.3 && cz < 67.0) continue;      // the seating's own frontage
      const big = .82 + t * .75;
      /* ONE draw serves both the x jitter (as before) and the GLB variant */
      const r = rnd();
      const cx = AX + side * (1.6 + r * .6);
      if (haveClusters()) clusterAt(K, cx, 0, cz, big, 0, undefined, r);
      else bloomMass(K.flor, cx, .26 * big, cz, .6 * big, .28 * big, .48 * big, Math.round(20 + t * 16), big);
    }
    for (let i = 0; i < 5; i++) {                // the run right under the towers
      const r = rnd();
      const cx = AX + side * (1.5 + r * 2.5);
      if (haveClusters()) clusterAt(K, cx, 0, 68.2 + i * .95, 1.1, 0, undefined, r);
      else bloomMass(K.flor, cx, .3, 68.2 + i * .95, .68, .32, .54, 25, 1.05);
    }
  }

  /* ── the two tall asymmetric floral installations, and the fabric flower ── */
  /* the GLB towers' origin is the tower AXIS at the foot (not the bbox centre),
     so they land on the old towers' (cx, cz); yaw 0 in this frame puts the
     hero's wing over the aisle toward +X and the small tower's toward −X,
     exactly as the old `lean` did (models.json: hero x −1.0…+1.9, small
     x −1.9…+1.0). */
  if (have('installation_hero')) put(K.mdl('installation_hero'), AX - 3.10, 0, AZ + .30, 1, null);
  else installation(K, AX - 3.10, AZ + .30, 3.30, .62, true);
  if (have('installation_small')) put(K.mdl('installation_small'), AX + 3.10, 0, AZ + .10, 1, null);
  else installation(K, AX + 3.10, AZ + .10, 2.95, -.58, false);
  CC.push({ x: AX - 3.10, z: AZ + .30, r: 1.05 }, { x: AX + 3.10, z: AZ + .10, r: 1.05 });
  /* the fabric flower sits AGAINST the +X tower, not floating between the two
     — in the render the two masses overlap and read as one installation. The
     GLB's origin is the flower's CENTRE (its streamers hang 1.9 m below it). */
  if (have('fabric_flower')) put(K.mdl('fabric_flower'), AX + 1.35, 2.35, AZ + .28, 1, null);
  else fabricFlower(K, AX + 1.35, 2.35, AZ + .28);

  /* ── the two white arch frames, each hanging a crystal / pearl chandelier.
        Outboard of the seating and forward of the last row, so no post ever
        stands in the walk. ── */
  const ARC_R = 1.12, ARC_POST = 2.30, ARC_Z = 69.0;
  for (const s of [-1, 1]) {
    const ax = AX + s * 4.55;
    for (const p of [-1, 1]) CC.push({ x: ax + p * ARC_R, z: ARC_Z, r: .3 });
    /* the frame: the GLB (posts at x ±1.12, h 2.30, semicircle to the apex at
       3.42 — spans X at yaw 0, like the torus) or the two rods + torus */
    if (have('arch_frame')) put(K.mdl('arch_frame'), ax, 0, ARC_Z, 1, null);
    else {
      for (const p of [-1, 1]) {
        put(K.rod, ax + p * ARC_R, ARC_POST / 2, ARC_Z, [.048, ARC_POST, .048], null, 0xfcfbf7);
      }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(ARC_R, .048, 5, 20, Math.PI), frameW);
      arc.position.set(ax, ARC_POST, ARC_Z);     // NO rotation.y — spans X
      g.add(arc);
    }
    /* the chandelier: the GLB is hook-origin (y 0 = the hook, its own drop rod
       hangs below), so it is placed AT the apex; beadShade's drop rod spans
       y … y + .60, so the primitive is placed .60 under it */
    if (have('bead_chandelier')) put(K.mdl('bead_chandelier'), ax, ARC_POST + ARC_R, ARC_Z, 1, null);
    else beadShade(K, ax, ARC_POST + ARC_R - .60, ARC_Z, .60, 5);
  }

  /* ── the welcome board ── an arched slab of pale stone at the head of the
        seating, exactly where the render stands it. The Shape is authored in
        0…1 so ExtrudeGeometry's own UV generator hands the canvas straight
        onto the front cap; it is scaled to metres afterwards and re-centred
        so `rotation.y` turns it about itself and not about its left edge. */
  {
    /* At the mouth of the aisle, 2.9 m off its centre-line: far enough out
       ⚠ Its position is a FRAMING constraint, not a taste one. Anything
       within a couple of metres of the CEREMONY spawn and off to the side is
       outside a 44.6° half-FOV and is never seen — the first two tries put it
       at the aisle mouth and it was simply not in the shot. At 5.45 m off the
       centre-line it has to be ≥ 5.5 m up the aisle to be in frame, so it
       stands just past the last row (z 66) beside the block, angled back at
       the guests — which is also where the render has it. */
    const SW = 1.14, SH = 2.02, sx = AX + 5.45, sz = 66.8;
    const sh = new THREE.Shape();
    sh.moveTo(.10, 0);
    sh.lineTo(.90, 0);
    sh.lineTo(.925, .47);
    sh.bezierCurveTo(.955, .845, .745, 1.0, .49, 1.0);
    sh.bezierCurveTo(.245, 1.0, .05, .85, .075, .47);
    sh.closePath();
    const sgeo = new THREE.ExtrudeGeometry(sh, {
      depth: .055, bevelEnabled: false, curveSegments: 12,
    });
    sgeo.scale(SW, SH, 1);
    sgeo.translate(-SW / 2, 0, 0);
    const board = new THREE.Mesh(sgeo, signMats());
    board.position.set(sx, 0, sz);
    board.rotation.y = -2.44;                    // faces back down the aisle
    g.add(board);
    /* KAN-208 wave 3: the moulded frame + plinth foot (welcome_board_frame).
       Authored in the BOARD's own frame — x centred, z through the board with
       its mid-plane at .0275 — so it takes the board's position and turn
       verbatim. The board, its canvas and its lettering stay ours. */
    if (have('welcome_board_frame')) {
      put(K.mdl('welcome_board_frame'), sx, 0, sz, 1, [0, -2.44, 0]);
    }
    CC.push({ x: sx, z: sz, r: .55 });
    if (haveClusters()) {
      clusterAt(K, sx + .45, 0, sz - .3, 1.1, -2.44);
      clusterAt(K, sx - .5, 0, sz + .35, 1.0, -2.44);
    } else {
      bloomMass(K.flor, sx + .45, .3, sz - .3, .55, .3, .45, 34, 1.1);
      bloomMass(K.flor, sx - .5, .28, sz + .35, .48, .26, .4, 26, 1.0);
    }
  }

  /* ── THE EXTRAS ── on the −X flank of BEACH_LAWN (x −40…12, z 58…75),
        behind and to the side of the seating so the aisle and the spawn at
        (−22, 59) stay clear. Every one faces +X, i.e. back at the ceremony,
        which is yaw = −π/2 for a prop authored facing −Z. ── */
  const IN = -Math.PI / 2;
  hatRack(K, g, CC, frame(-34.6, 60.2, IN));
  plinthPair(K, g, CC, frame(-30.8, 63.6, IN));
  dessertBar(K, g, CC, frame(-35.8, 67.2, IN));
  wheelbarrow(K, g, CC, frame(-35.2, 71.2, IN));
  coconutStand(K, g, CC, frame(-32.6, 73.0, IN + .5));
  beverageCart(K, g, CC, frame(-35.6, 73.4, IN + .3));
}

export function initMoments(G) {
  const groups = {};
  const cols = {};
  /* published for main.js's shader warm-up: renderer.compile() traverses only
     VISIBLE objects, so a material that lives solely in a hidden moment group
     is not compiled behind the loading card and pays for itself mid-game the
     first time that moment is shown. main.js makes all six visible across the
     warm-up and restores them. (It used to be free by accident: every moment's
     materials also existed in the ceremony, which is the moment dressed at
     warm-up time. The GLB props ended that — the festoon's LineBasicMaterial
     became dinner-only the moment the hat rack stopped drawing wire lines, and
     the program count went 113 → 114 on the first dinner switch.) */
  G.momentGroups = groups;
  for (const m of CFG.MOMENTS) {
    groups[m.id] = new THREE.Group();
    groups[m.id].name = `moment:${m.id}`;   // so tests can find a moment's props
    groups[m.id].visible = false;
    G.scene.add(groups[m.id]);
    cols[m.id] = [];
  }
  /* Five of the six moments dress the ENCLAVE and are authored in enclave-local
     coordinates — world.js adopts their groups into the rotated enclave group
     and rewrites their colliders and interactables on the first frame. The
     Welcome Brunch is 285 m east on the hotel crescent, which is NOT part of
     the enclave, so it opts out of all three: `worldSpace` on the group,
     `__world` on every collider and interactable it registers. Forget one and
     the brunch lands 90° around the map from the roof it is set on. */
  groups.brunch.userData.worldSpace = true;

  /* SITE.LOUNGE and SITE.LAWN used to be dressed here (dinner inside the
     standalone 酒廊, the ceremony on the little circular lawn). Both moments
     moved outdoors on 2026-08-02 and this file has read neither footprint
     since. Both keys are now GONE from site.js as well — SITE.LAWN on
     2026-08-02, SITE.LOUNGE on 2026-08-04 when Carl's "clubhouse only have one
     lounge" retired the standalone building in favour of the 酒廊 under the
     check-in lobby. Nothing here had to change for either: ⚠ THE DINNER SPAWN
     WAS NEVER THE LOUNGE'S. It is MOMENT_PLACES_LOCAL.DINNER (−17, −3), out on
     the inner pool lawn, and it still lands flat at feet 0.000 facing its own
     six rounds and two longs. */
  const D = SITE.DECK;

  /* ── 0 · WELCOME BRUNCH — the Westin rooftop, 18 March, two days out ───────
     THE ROOFTOP IS THREE ROOMS (site.js): the infinity pool — 28 m of it since
     Carl's 2026-08-04 correction — then a 6 m paved walk, the bar zone, and the
     dining terrace, with ~69 m of open deck south of the water. The brunch
     lives ENTIRELY in the POOL ROOM. campus.js stands the eight four-tops — the
     list is HOTEL_ROOF.brunchTables, published once so the two files can no
     longer disagree — and this moment is the COVER: linen over the marble,
     settings, low blooms, a champagne service at the walk, a buffet against the
     screen wall behind the tables, and a menu easel at the room's threshold.
     Nothing here duplicates a table that is already up there — dress it, don't
     rebuild it. Everything is WORLD space, in HOTEL_ROOF's polar frame, and
     everything registered carries __world (miss one and it lands 90° around the
     map, silently).
     ⚠ Every bearing below is keyed to (poolTc ± poolTh) or to the published
     table list, so the whole dressing followed the water when it shrank from
     89 m to 28 m. The only numbers that had to be re-authored are the ones that
     were quoted as a LENGTH along a 90 m room. */
  let champPt;               // the champagne service — "Pour a glass" shares it
  {
    const g = groups.brunch;
    /* the GLB buckets bake into this group, which is worldSpace — so their
       instances are authored in WORLD coordinates and ride the group as-is */
    const K = kit();
    const RF = SITE.HOTEL.ROOFTOP, DY = RF.deckY;
    const pt = (th, r) => HOTEL_ROOF.pt(th, r);
    /* a box laid flat on the terrace, turned to face the arc centre */
    const rbox = (w, h, d, th, r, y, m) => {
      const p = pt(th, r);
      const b = box(w, h, d, m);
      b.position.set(p.x, y, p.z);
      b.rotation.y = th;
      g.add(b);
      return b;
    };
    const rcyl = (rad, h, th, r, y, m, seg = 14) => {
      const p = pt(th, r);
      const c = cyl(rad, h, m, seg);
      c.position.set(p.x, y, p.z);
      g.add(c);
      return c;
    };

    /* ── the eight existing four-tops, dressed ──
       HOTEL_ROOF.brunchTables IS the table list — campus.js stands them up and
       this loop dresses them, and neither holds a literal any more (both used
       to carry `C + s * (.075 + k * .145)` / `99.2 + (k % 2) * 1.6`, half of
       which is in the BAR room since the split — dressed tables that no longer
       exist there). */
    for (const { th, r } of HOTEL_ROOF.brunchTables) {
      const p = pt(th, r);
      /* ⚠ campus.js sizes these tables through mat4() SCALE on a unit cylinder
         of radius 0.5, so `1.35` there is a 1.35 m DIAMETER — a 0.675 m top,
         with the four chairs at 1.05 m. moments.js's cyl() takes a real radius.
         Dress to 0.70 or the cloth swallows the chairs and the table reads as a
         drum. (It did, first try.) */
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.68, .72, .74, 20, 1, true), linen);
      skirt.position.set(p.x, DY + .38, p.z); g.add(skirt);
      rcyl(.72, .05, th, r, DY + .78, linen, 20);
      // a low bowl of blooms in the centre
      rcyl(.19, .11, th, r, DY + .86, gold);
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), i % 3 ? blush : foliage);
        f.position.set(p.x + (rnd() - .5) * .28, DY + .94 + rnd() * .07, p.z + (rnd() - .5) * .28);
        g.add(f);
      }
      // four covers: charger, napkin, flute — laid toward the chairs
      for (let c = 0; c < 4; c++) {
        const ca = c * Math.PI / 2 + .4;
        const px = p.x + Math.cos(ca) * .46, pz = p.z - Math.sin(ca) * .46;
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .022, 16), linen);
        plate.position.set(px, DY + .82, pz); g.add(plate);
        const nap = box(.10, .03, .14, blush);
        nap.position.set(px, DY + .85, pz); nap.rotation.y = ca; g.add(nap);
        const fl = cyl(.030, .16, glassy, 8);
        fl.position.set(p.x + Math.cos(ca + .5) * .52, DY + .89, p.z - Math.sin(ca + .5) * .52);
        g.add(fl);
        /* A linen slip over the chair's back and a blush sash round it is what
           turns resort furniture into event chairs.
           ⚠ KAN-208 wave 1: campus.js seats these tables on the bar room's
           `dining_chair_rattan` now (back stiles + a curved top rail at radial
           1.23…1.31, woven panel y .565…965, top rail to y 1.075, cushion top
           .58). The slip is cut to THAT back — .50 wide ACROSS the chair (its
           yaw is the chair's own, ca − π/2, so local x is tangential), y .60 …
           1.10, clear of the cushion. The old slip had yaw ca, which lays a box's
           long side along the RADIUS: it and the box chair's back were both
           radial fins, which is why they never looked like a chair back. The
           fallback (no GLB → campus.js's box chairs) keeps the old fin, which
           still matches ITS back. */
        if (models.has('dining_chair_rattan') && have('chair_slipcover')) {
          /* KAN-211 wave E: `chair_slipcover` — a fitted linen sleeve over the
             rattan back, closed over its curved rail, soft folds, a blush sash
             tied in a bow behind (ASSET_SPEC Group O). Authored IN THE CHAIR'S
             OWN FRAME, so it takes the chair's exact matrix: campus.js seats
             `rtBrunchChairGlbI` at 1.05 m out on bearing ca with yaw ca − π/2. */
          put(K.mdl('chair_slipcover'), p.x + Math.cos(ca) * 1.05, DY, p.z - Math.sin(ca) * 1.05,
            1, [0, ca - Math.PI / 2, 0]);
        } else if (models.has('dining_chair_rattan')) {
          const bx = p.x + Math.cos(ca) * 1.27, bz = p.z - Math.sin(ca) * 1.27;
          const slip = box(.50, .50, .10, linen);
          slip.position.set(bx, DY + .85, bz); slip.rotation.y = ca - Math.PI / 2; g.add(slip);
          const sash = box(.52, .08, .12, blush);
          sash.position.set(bx, DY + .72, bz); sash.rotation.y = ca - Math.PI / 2; g.add(sash);
        } else {
          const bx = p.x + Math.cos(ca) * 1.28, bz = p.z - Math.sin(ca) * 1.28;
          const slip = box(.54, .56, .10, linen);
          slip.position.set(bx, DY + .64, bz); slip.rotation.y = ca; g.add(slip);
          const sash = box(.56, .09, .13, blush);
          sash.position.set(bx, DY + .50, bz); sash.rotation.y = ca; g.add(sash);
        }
      }
      /* ⚠ 1.35 → 0.95 with the short pool (2026-08-04). The eight four-tops are
         one row on a 3.16 m pitch now; at r 1.35 each table claimed 1.70 m with
         the player's own radius, so two neighbours' claims OVERLAPPED and the
         brunch room could not be walked at all — you were fenced against the
         coping. 0.95 is the SAME figure campus.js gives its bar dining tables
         (whose chairs sit at the same 1.02 m), leaves a 0.56 m corridor between
         two settings, and still rings the 0.68 m cloth with 0.27 m to spare. */
      cols.brunch.push({ x: p.x, z: p.z, r: .95, y0: DY - .6, __world: true });
    }

    /* ── the buffet: a 7 m draped run, on the pool room's BACK PAVING ──
       ⚠ RE-KEYED 2026-08-04 with the short pool. It used to stand BGAP metres
       past the outermost four-top, along the arc — which on a 28 m pool room
       puts it 2 m outside the room, on the south deck among the loungers. The
       pool room is 29.8 m of arc at r 99 and the eight four-tops (one row now)
       take 25.9 m of that, so there is no room for it BESIDE them; it goes
       BEHIND them instead, against the lattice screen wall, which is where a
       hotel puts a breakfast buffet anyway.
       The section: four-tops at r 99.0 reaching 100.32 with their chair backs ·
       a 0.97 m service aisle · the buffet at 101.85 (101.29…102.41) · 0.32 m
       clear of the screen's plinth at 102.73. Centred on the room's own bearing
       so it can never drift off the tables. */
    const BR = 101.85;
    const BTH = RF.poolTc;
    if (have('buffet_run')) {
      /* the 7 m GLB run (chafing dishes, platters, juice, plates on it) is
         7.09 along X at yaw 0; yaw BTH lays it along the arc's tangent — the
         same rotation rbox gives its segments — with its front (−Z) on the
         inward radial, toward the tables and the water */
      const p = pt(BTH, BR);
      put(K.mdl('buffet_run'), p.x, DY, p.z, 1, [0, BTH, 0]);
    } else {
      for (let i = 0; i < 5; i++) {
        const th = BTH - .028 + i * .014;
        rbox(1.55, .74, 1.02, th, BR, DY + .37, linen);      // drape
        rbox(1.60, .06, 1.12, th, BR, DY + .77, timber);     // the counter itself
        rbox(1.56, .04, 1.08, th, BR, DY + .81, linen);      // runner over it
      }
      // chafing domes, fruit stands and a bread board along it
      for (let i = 0; i < 4; i++) {
        const th = BTH - .022 + i * .0147;
        const dome = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
        const p = pt(th, BR - .1); dome.position.set(p.x, DY + .83, p.z); g.add(dome);
      }
      for (let i = 0; i < 3; i++) {
        const th = BTH - .018 + i * .018;
        rcyl(.06, .34, th, BR + .34, DY + .99, gold, 10);
        rcyl(.30, .05, th, BR + .34, DY + 1.18, linen, 16);
        for (let j = 0; j < 6; j++) {
          const f = new THREE.Mesh(new THREE.SphereGeometry(.065, 7, 6), j % 2 ? blush : foliage);
          const p = pt(th, BR + .34);
          f.position.set(p.x + (rnd() - .5) * .34, DY + 1.25, p.z + (rnd() - .5) * .34);
          g.add(f);
        }
      }
    }
    colLineY(cols.brunch, pt(BTH - .032, BR), pt(BTH + .032, BR), .62, DY - .6);

    /* ── champagne service — at the pool room's threshold onto the paved walk,
          greeting arrivals coming down from the bar (the old C + .383 is in the
          bar zone now). 1.0 m inside the seam, quoted in metres at its own
          radius: at 1.4 m it would clash with the first of the eight four-tops,
          whose row starts _BT_EDGE = 3.8 m in (site.js). The "Pour a glass"
          interactable is DERIVED from this same point below — one source of
          truth, they can never drift apart again. ── */
    /* ⚠ THE RADIUS IS A WALKABILITY CONSTRAINT, not a taste one. At r 97.9 the
       service's 0.95 m collider (1.30 m with the player) plus the easel's at
       98.9 formed one blob spanning r 96.60…99.85 across the pool room's only
       threshold — a scripted walk from the water to the paved walk simply
       stalled in it. At 99.6 the blob is 97.95…100.90 and there are two ways
       past: the coping strip seaward of it and the back paving behind it. */
    const CR = 99.6;
    const CTH = RF.poolTc + RF.poolTh - 1.0 / CR;
    {
      const p = pt(CTH, CR);
      champPt = p;
      if (have('champagne_service')) {
        /* the 1.6 × .8 draped service (two buckets, a tray of flutes), long
           axis along the arc, front to the coping strip the walkers use */
        put(K.mdl('champagne_service'), p.x, DY, p.z, 1, [0, CTH, 0]);
      } else {
        rcyl(.54, .80, CTH, CR, DY + .40, linen, 18);
        rcyl(.58, .05, CTH, CR, DY + .82, linen, 18);
        for (let row = 0; row < 3; row++) {
          const n = 4 - row;
          for (let i = 0; i < n; i++) {
            const c = cyl(.052, .15, glassy, 8);
            c.position.set(p.x - (n - 1) * .075 + i * .15, DY + .92 + row * .16, p.z);
            g.add(c);
          }
        }
        // an ice bucket, and a second one on the deck
        const bkt = cyl(.19, .26, gold, 14);
        bkt.position.set(p.x + .55, DY + .95, p.z + .2); g.add(bkt);
      }
      cols.brunch.push({ x: p.x, z: p.z, r: .95, y0: DY - .6, __world: true });
    }

    /* ── a hedge of blooms along the pool coping, so the water reads as part
          of the table setting rather than a lap pool. Keyed to the POOL'S OWN
          span — the old C ± .33 straddled the crescent's centre, which put half
          the run on the cross-walk and in the bar room.
          ⚠ 2026-08-04: the run is now the pool's WHOLE coping (0.26 rad, 25 m)
          instead of a 0.66 rad reach of a 90 m one, so the blooms sit at 1.2 m
          rather than 2.9 m — a real flower run along a real pool.
          ⚠ THE COUNT IS LOAD-BEARING at 22 and must stay: every moment after
          this block shares the one seeded stream (mulberry32(CFG.SEED)), so
          adding or dropping a draw here re-jitters the entire ceremony. Two
          rnd() per bloom, 44 in this loop, unchanged. ── */
    const HEDGE_A = RF.poolTc - RF.poolTh + .02, HEDGE_B = RF.poolTc + RF.poolTh - .02;
    for (let i = 0; i < 22; i++) {
      const th = HEDGE_A + (i / 21) * (HEDGE_B - HEDGE_A);
      const p = pt(th, 96.9);
      const f = new THREE.Mesh(new THREE.SphereGeometry(.13 + rnd() * .07, 7, 6),
        rnd() > .5 ? blush : foliage);
      f.position.set(p.x, DY + .16, p.z); g.add(f);
    }

    /* ── the menu easel — at the pool room's threshold, beside the champagne.
          It used to stand where the bridge lands (the tower bearing), but that
          is the middle of the BAR room's dining deck now; a walker off the
          bridge crosses the bar half and the cross-walk, and the brunch greets
          them HERE, at its own doorway. Turned +90° to face along the arc at
          the arrivals rather than out to sea. ── */
    {
      const eth = RF.poolTc + RF.poolTh - .006, er = 98.9;
      if (have('menu_easel')) {
        /* the GLB's front is −Z at yaw 0; pt() puts local −Z at yaw θ on the
           inward radial, so yaw θ − π/2 turns the board's face to +θ — along
           the arc, at the arrivals off the cross-walk. Its board stays blank,
           as the linen box was. */
        const p = pt(eth, er);
        put(K.mdl('menu_easel'), p.x, DY, p.z, 1, [0, eth - Math.PI / 2, 0]);
      } else {
        const ebd = rbox(.92, 1.24, .05, eth, er, DY + 1.02, linen);
        ebd.rotation.y = eth + Math.PI / 2;
        const elg = rbox(.07, 1.02, .07, eth - .12 / er, er, DY + .51, timber);
        elg.rotation.y = eth + Math.PI / 2;
      }
      cols.brunch.push({ ...pt(eth, er), r: .6, y0: DY - .6, __world: true });
    }

    /* ── NO parasols on the apron — deliberately (Carl, 2026-08-03). ─────────
          The old design stood a 2 × 2 of linen parasols on the seaward apron
          past the pool's south end (r 92.6…95.5); Carl's screenshot showed
          them standing straight across the along-the-arc sightline from the
          water: "guests should be able to enjoy an unobstructed view while
          swimming at the edge of the infinity pool." Everything seaward of the
          pool's back wall (r < ~97) on either apron stays CLEAR — the glass
          end walls and the sea are the whole composition. Shade near the water
          is already provided inland of the back wall: the lounger runs carry
          parasols between pairs (campus.js) and the daybeds have canopies. Do
          not reinstate anything tall on the aprons seaward of the coping. ── */
    bakeKit(K, g);
  }

  /* ── 1 · PREWEDDING — the suite deck at night, lanterns on the water ── */
  {
    const g = groups.setup;
    const K = kit();
    // high-tops scattered on the basalt deck, between the glass wall and turf
    for (let i = 0; i < 7; i++) {
      const x = -6.5 + i * 2.2 + (rnd() - .5) * .6;
      const z = D.z0 + 2.2 + rnd() * 3.4;
      highTopAt(K, g, x, z);
      cols.setup.push({ x, z, r: .5 });
    }
    // festoon lights strung from the roof overhang out to the turf edge
    for (let i = 0; i < 5; i++) {
      const x = -7 + i * 3.5;
      festoon(K, x, 3.6, D.z0 + .4, x + 1.6, 3.6, SITE.TURF.z1, .9, 10, true);   // wave E: on a post
      postCollider(cols.setup, x + 1.6, SITE.TURF.z1);
    }
    /* a welcome easel by the door — the same easel the cocktail bar uses, and
       the same blank-board contract, so the welcome sign hangs on the measured
       face rather than at the old box's */
    const wEaselGLB = have('menu_easel');
    if (wEaselGLB) put(K.mdl('menu_easel'), -3.4, 0, D.z0 + 1.2, 1, [0, .3, 0]);
    else {
      const easel = box(.9, 1.3, .05, linen);
      easel.position.set(-3.4, 1.0, D.z0 + 1.2);
      easel.rotation.y = .3; g.add(easel);
      const legs = box(.06, 1.0, .06, timber);
      legs.position.set(-3.4, .5, D.z0 + 1.3); g.add(legs);
    }
    easelPanel(g, signMats()[0], .64, 1.12, -3.4, D.z0 + 1.2, .3, wEaselGLB);
    // champagne tower on a draped table
    if (have('champagne_tower')) {
      /* the GLB's coupes are frosted and OPAQUE — this is the swap that
         retires the `glassy` transmission material from the deck, and with it
         the third campus render inside the mirror pass */
      put(K.mdl('champagne_tower'), 7.5, 0, D.z0 + 3, 1, null);
    } else {
      const tbl = cyl(.6, .78, linen, 18); tbl.position.set(7.5, .39, D.z0 + 3); g.add(tbl);
      for (let r = 0; r < 3; r++) {
        const n = 4 - r;
        for (let i = 0; i < n; i++) {
          const c = cyl(.05, .14, glassy, 8);
          c.position.set(7.5 - (n - 1) * .07 + i * .14, .85 + r * .15, D.z0 + 3);
          g.add(c);
        }
      }
    }
    cols.setup.push({ x: 7.5, z: D.z0 + 3, r: .7 });
    bakeKit(K, g);
  }

  /* ── 2 · CEREMONY — the private beachfront lawn, facing the sea ────────────
     RE-DRESSED 2026-08-02 from the couple's own planner's renders (Rosa Wed
     蔷薇婚礼) — `reference/photos/decor-ceremony-main.jpg` is the key image and
     five more carry the extras. What stood here before was INFERRED: sixty
     white folding chairs under a green-and-blush torus arch, with a linen
     runner. None of that is in the design and none of it is here now.

     What the render actually shows, and what is built below:
       · wooden CROSS-BACK chairs, each tied with a white chiffon drape;
       · two tall asymmetric floral installations flanking the head of the
         aisle — cream, ivory and POWDER-BLUE hydrangea over pale sage — with a
         big pale-blue fabric flower sculpture held between them;
       · two slim white arch frames over the aisle, each hanging a crystal /
         pearl chandelier;
       · a GRASS aisle strewn with petals (there is no runner in the render),
         lined both sides with low floral clusters;
       · a tall pale arched welcome board at the head of the seating.

     THE AISLE STILL RUNS ALONG LOCAL +Z, which is world WEST, so the whole
     installation stands between the guests and the sea — the frame the render
     is composed on. CEREMONY spawns at z 59 with yaw π (fwd = (0,0,+1)), the
     five rows sit at z 62…66 and the head of the aisle is z 71.4.

     ⚠ The old arch was once built EDGE-ON: a TorusGeometry lies in the XY
     plane, so a π arc spans X — and it carried `rotation.y = Math.PI / 2`,
     which mapped that span onto Z, the aisle's own axis. The two white frames
     below have NO y-rotation for exactly that reason: they span X, ACROSS the
     aisle, which is what the render shows.

     ⚠ NAMES. The render letters the board "Feng jiaheng & Zheng". The couple
     are Carl FUNG and Rachel CHENG — see the LETTERING note at the top. ── */
  {
    /* the authoring MOVED to dressCeremonyDecor (module scope, above) on
       2026-08-03 so the cocktail hour can emit the same decor — same props,
       same positions, same colliders, same rnd order, so this emission is
       byte-for-byte the ceremony the decor pass verified. `true` = seated:
       the sixty chairs and their drapes belong to the ceremony alone. */
    const K = kit();
    dressCeremonyDecor(K, groups.ceremony, cols.ceremony, true);
    bakeKit(K, groups.ceremony);
  }

  /* ── 3 · COCKTAIL — the SAME beachfront lawn, 26 m along it ────────────────
     Carl put the cocktail hour on the ceremony lawn, not at the clubhouse
     terrace pool, so the two share a lawn and are separated within it: the
     ceremony holds the −X half around x −22, the bar and the high-tops the +X
     half around x +4. 14 m of clear grass between the chair block's edge and
     the nearest high-top, which is what keeps them reading as two rooms.
     TWO THINGS ARE NOT IN THIS BLOCK, on purpose (Carl's ask #3, 2026-08-03):
     the CEREMONY DECOR carries over (same lawn, an hour apart — only the
     seating is cleared) and the bar is a ROUND TIMBER-PLANK bar, not the old
     6 m counter. Both are authored in the "COCKTAIL, the redress" block AFTER
     the other five moments — everything shares one seeded stream, and putting
     the new draws at the tail is what keeps the other moments' dressing
     byte-for-byte identical. This block keeps only what it always had minus
     the straight bar: the high-tops, the teal parasols, the canapé table and
     the festoon poles. ── */
  /* the cocktail's kit is filled by BOTH cocktail blocks — this one and the
     redress at the tail — and baked ONCE there, so every GLB kind and every
     bucket is still one InstancedMesh for the moment */
  const KC = kit();
  {
    const g = groups.cocktail;
    const K = KC;
    const CX = 4;
    /* Eight high-tops. Nothing sits closer than 3 m to the COCKTAIL spawn at
       (4, 58.5) and nothing with a PARASOL closer than 6.5: a 1.7 m canopy at
       2.7 m up, three metres away, is the entire frame on the first render. */
    const spots = [[-2.4, 61.6], [3.0, 61.2], [7.4, 62.4], [-1.2, 64.6],
      [4.2, 65.2], [8.4, 65.8], [-3.4, 67.0], [9.2, 68.6]];
    for (const [dx, z] of spots) {
      const x = CX + dx;
      highTopAt(K, g, x, z);
      cols.cocktail.push({ x, z, r: .5 });
    }
    // three teal parasols, the clubhouse's own colour, over the far tables
    /* the GLB parasol is two meshes at one origin: pole + ribs untinted, and
       the WHITE canopy in a tinted bucket carrying the teal as its instance
       colour (the canopy_tint material is the one asset documented as
       tintable). Both or neither, so a parasol is never half-swapped. */
    const parasolGLB = have('parasol_round') && have('parasol_round_canopy');
    for (const [dx, z] of [[4.2, 65.2], [8.4, 65.8], [-3.4, 67.0]]) {
      if (parasolGLB) {
        put(K.mdl('parasol_round'), CX + dx, 0, z, 1, null);
        put(K.mdl('parasol_round_canopy', true), CX + dx, 0, z, 1, null, TEAL_HEX);
        continue;
      }
      const pole = cyl(.045, 2.5, timber, 8);
      pole.position.set(CX + dx, 1.25, z); g.add(pole);
      const um = new THREE.Mesh(new THREE.ConeGeometry(1.7, .55, 12), teal);
      um.position.set(CX + dx, 2.68, z); g.add(um);
    }
    // a raw-bar / canapé table off to one side
    if (have('canape_table')) put(K.mdl('canape_table'), CX - 5.4, 0, 64.6, 1, null);
    else {
      const svc = cyl(.62, .8, linen, 18);
      svc.position.set(CX - 5.4, .4, 64.6); g.add(svc);
      for (let i = 0; i < 10; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 7, 6), i % 3 ? blush : foliage);
        f.position.set(CX - 5.4 + (rnd() - .5) * .8, .86, 64.6 + (rnd() - .5) * .8);
        g.add(f);
      }
    }
    cols.cocktail.push({ x: CX - 5.4, z: 64.6, r: .8 });
    /* Festoon on six real poles. The runs go pole-to-pole at the poles' OWN z,
       not across the middle of the lawn — stringLights draws bulbs and no wire,
       so a run that starts and ends in mid-air is a row of orbs floating over
       the sea. Three rows × two poles each. */
    for (const pz of [59.5, 64, 68.5]) {
      for (const px of [CX - 6, CX + 10]) {
        const p = cyl(.07, 3.6, timber, 8);
        p.position.set(px, 1.8, pz); g.add(p);
        cols.cocktail.push({ x: px, z: pz, r: .3 });
      }
      festoon(K, CX - 6, 3.5, pz, CX + 10, 3.5, pz, .9, 14);   // was stringLights (no cable)
    }
  }

  /* ── 4 · DINNER — the two lawns flanking the presidential pool ─────────────
     MOVED 2026-08-02 out of the 酒廊. Carl: *"our dinner is actually in this
     two grass area right outside of the pool"*. The lounge is still built and
     still 280 ㎡; it is simply no longer where dinner happens.

     RE-DRESSED 2026-08-02 from `decor-dinner-rounds.jpg` and
     `decor-dinner-chandeliers.jpg`. What the two renders add to what was here:
       · WOODEN CROSS-BACK chairs, not white folding blocks — the same chair the
         ceremony uses, which is what makes the day read as one wedding;
       · a couple of LONG rectangular tables mixed in among the rounds, bare
         timber, at the edge of each lawn;
       · festoon that is actually STRUNG — a real catenary cable with the bulbs
         hung off it, criss-crossing the lawns overhead, not free-floating orbs;
       · CRYSTAL CHANDELIERS hung from tall curved poles over the tables, which
         is the signature of the second render and the thing that makes a lawn
         at dusk read as a dining room.

     COVERS ARE UNCHANGED AT 64, which is what site.js's DINNER_LAWNS geometry
     is sized for: six rounds of eight plus two longs of eight. One round per
     lawn became a long, on the paved-walk side; the outboard rounds are
     untouched on their 6 m grid.

     The two point lights are still the only lights any moment adds, and they
     still cost nothing while the moment is hidden — WebGLRenderer skips an
     invisible subtree before it collects lights from it. ── */
  {
    const g = groups.dinner;
    const K = kit();
    const DC = cols.dinner;
    const [LA, LB] = SITE.DINNER_LAWNS, DW = SITE.DINNER_WALK;
    const WX = (DW.x0 + DW.x1) / 2;
    /* the long table sits on the walk side of each lawn: the inner lawn's is on
       its −X edge, the outer lawn's on its +X edge, so the two frame the walk */
    const LONG_DX = [-3, 3];
    for (let li = 0; li < 2; li++) {
      const L = li ? LB : LA;
      const cx = (L.x0 + L.x1) / 2;
      for (const dx of [-3, 3]) for (const z of [2, 8]) {
        const x = cx + dx;
        if (z === 2 && dx === LONG_DX[li]) {
          longTable(K, x, z, 4.8, 'z');            // eight covers, four a side
          colLine(DC, x, z - 2.0, x, z + 2.0, 1.15);
        } else {
          roundTable(K, x, z, 8);
          DC.push({ x, z, r: 1.5 });
        }
      }

      /* ── the chandelier poles: a tall dark stem curving over the tables, with
            a two-tier crystal candelabra on the end of it. The elbow geometry
            is pre-rotated at build time so a plain rot.y of 0 or π mirrors the
            overhang — composing a Z-rotation with a Y-rotation through one XYZ
            Euler does NOT, and gets you a pole bent sideways. ── */
      for (const [px, pz, dir] of [[cx - 5.9, 3.4, 1], [cx + 5.9, 9.2, -1]]) {
        put(K.dark, px, POLE_H / 2, pz, [.075, POLE_H, .075], null, 0x33302b);
        put(K.disc, px, .06, pz, [.28, .12, .28], null, 0x2a2723);
        const el = new THREE.Mesh(ELBOW, bronzeD);
        el.position.set(px + dir * POLE_R, POLE_H, pz);
        if (dir < 0) el.rotation.y = Math.PI;
        g.add(el);
        /* the fixture hangs from the elbow's end. The GLB is hook-origin and
           carries its own drop rod, so it is placed AT the hook; the primitive
           candelabra() starts its rod .68 above the point it is given, so it
           is placed .68 under it. candelabra_flames is a second GLB (emissive)
           at the SAME hook — the K.lamp flames are the primitive's alone. */
        const hx = px + dir * POLE_R, hy = POLE_H + POLE_R;
        if (have('candelabra')) {
          put(K.mdl('candelabra'), hx, hy, pz, 1, null);
          if (have('candelabra_flames')) put(K.mdl('candelabra_flames'), hx, hy, pz, 1, null);
        } else candelabra(K, hx, hy - .68, pz, .56);
        DC.push({ x: px, z: pz, r: .4 });
      }

      /* ── festoon: three runs across the lawn on six real poles, now with the
            cable drawn. A run whose ends are not on a pole reads as a row of
            orbs hanging in the dark, which is what this was. ── */
      for (let i = 0; i < 3; i++) {
        const z = L.z0 + 1.5 + i * ((L.z1 - L.z0 - 3) / 2);
        for (const s of [-1, 1]) {
          put(K.rod, cx + s * 5.6, 2.0, z, [.055, 4.0, .055], null, 0x4d463c);
          DC.push({ x: cx + s * 5.6, z, r: .3 });
        }
        festoon(K, cx - 5.6, 3.9, z, cx + 5.6, 3.9, z, .8, 13);
      }
      /* and two long runs down the LENGTH of each lawn, between the same poles
         — the render's sky is a lattice of these, not three parallel lines */
      for (const s of [-1, 1]) {
        festoon(K, cx + s * 5.6, 3.9, L.z0 + 1.5, cx + s * 5.6, 3.9, L.z1 - 1.5, 1.0, 14);
      }

      const lt = new THREE.PointLight(0xffc98a, 0, 26, 2);
      lt.position.set(cx, 4.2, (L.z0 + L.z1) / 2);
      g.add(lt);
      G.tickers.push(() => { lt.intensity = g.visible ? 16 : 0; });
    }

    /* ── the head table across the head of the walk, serving both lawns ── */
    {
      const hw = 6.0;
      /* the ivory-draped head table: the GLB (6.07 × 1.08, top .80, front −Z
         toward the dance floor) or the two white boxes */
      const ht = have('head_table');
      if (ht) put(K.mdl('head_table'), WX, 0, 13.2, 1, null);
      else {
        put(K.white, WX, .78, 13.2, [hw, .06, 1.0], null, PAL.IVORY);
        put(K.white, WX, .385, 13.2, [hw - .06, .78, .96], null, 0xf6f0e4);
      }
      const HT = ht ? .80 : .81;
      for (let i = 0; i < 5; i++) {
        const cx2 = WX - 2.2 + i * 1.1;
        bloomMass(K.flor, cx2, HT + .12, 13.2, .26, .12, .2, 12, .9);
        put(K.rod, cx2 + .5, HT + .16, 13.0, [.022, .32, .022], null, PAL.IVORY);
        put(K.lamp, cx2 + .5, HT + .33, 13.0, [.033, .048, .033]);
      }
      for (let i = 0; i < 6; i++) {
        chairAt(K, WX - 2.5 + i, 14.5, Math.PI);
        put(K.glass, WX - 2.5 + i, HT + .09, 12.75, [.036, .18, .036]);
      }
      colLine(DC, WX - 3.0, 13.2, WX + 3.0, 13.2, .6);
      /* and the ceremony's own blue-and-cream clusters at either end of it */
      if (haveClusters()) {
        clusterAt(K, WX - 3.3, 0, 13.0, 1.1, 0);
        clusterAt(K, WX + 3.3, 0, 13.0, 1.1, 0);
      } else {
        bloomMass(K.flor, WX - 3.3, .32, 13.0, .55, .3, .45, 24, 1.1);
        bloomMass(K.flor, WX + 3.3, .32, 13.0, .55, .3, .45, 24, 1.1);
      }
    }

    /* ── the dance floor on the paving between the lawns, with the festoon
          running the length of the walk over it ── */
    const floor = box(3.0, .04, 7, deckDark);
    floor.position.set(WX, .05, 3); g.add(floor);
    for (const s of [-1, 1]) {
      festoon(K, WX + s * 1.4, 3.9, DW.z0 + 1, WX + s * 1.4, 3.9, DW.z1 - 1, .7, 12);
    }

    bakeKit(K, g);
  }

  /* ── 5 · AFTER PARTY — the pool deck, DJ, mirror ball ── */
  {
    const g = groups.afterparty;
    const K = kit();
    /* the DJ booth: the GLB (2.4 × .8 × 1.1, laptop + controller + lamp on
       top, front −Z as the old face was) with its emissive facia as a second
       GLB at the same origin; else the dark box + bulb face */
    if (have('dj_booth')) {
      put(K.mdl('dj_booth'), 0, 0, D.z0 + 1.4, 1, null);
      if (have('dj_booth_facia')) put(K.mdl('dj_booth_facia'), 0, 0, D.z0 + 1.4, 1, null);
      else {
        const face = box(2.2, .5, .06, bulb);
        face.position.set(0, .7, D.z0 + 1.0); g.add(face);
      }
    } else {
      const booth = box(2.4, 1.1, .8, deckDark);
      booth.position.set(0, .55, D.z0 + 1.4); g.add(booth);
      const face = box(2.2, .5, .06, bulb);
      face.position.set(0, .7, D.z0 + 1.0); g.add(face);
    }
    colLine(cols.afterparty, -1.2, D.z0 + 1.4, 1.2, D.z0 + 1.4, .6);
    for (const s of [-1, 1]) {
      if (have('speaker')) put(K.mdl('speaker'), s * 3.2, 0, D.z0 + 1.2, 1, null);
      else {
        const sp = box(.6, 1.6, .5, deckDark);
        sp.position.set(s * 3.2, .8, D.z0 + 1.2); g.add(sp);
      }
      cols.afterparty.push({ x: s * 3.2, z: D.z0 + 1.2, r: .5 });
    }
    // mirror ball over the deck — a CLONE (models.get), not an instance, so
    // the existing rotation ticker keeps turning it; origin at the ball's centre
    let ball = have('mirror_ball') ? models.get('mirror_ball') : null;
    if (!ball) {
      ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 1),
        new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: .12, metalness: 1, flatShading: true }));
    }
    ball.position.set(0, 4.2, D.z0 + 4.5);
    g.add(ball);
    G.tickers.push((dt) => { ball.rotation.y += dt * .55; });
    // festoon criss-crossing the deck, denser than the prewedding rig
    for (let i = 0; i < 6; i++) {
      const x = -8 + i * 3.2;
      festoon(K, x, 4.0, D.z0 + .4, x + 2.4, 4.0, SITE.TURF.z1, 1.0, 12, true);   // wave E: on a post
      postCollider(cols.afterparty, x + 2.4, SITE.TURF.z1);
    }
    // lounge seating out on the turf — the GLB sofa's front is −Z at yaw 0, so
    // yaw π turns it to +Z, toward the pool, as the boxes were read
    for (const [x, z] of [[-9, -8], [9, -8], [-11, -4]]) {
      if (have('lounge_sofa')) put(K.mdl('lounge_sofa'), x, 0, z, 1, [0, Math.PI, 0]);
      else {
        const sofa = box(2.2, .55, .9, linen);
        sofa.position.set(x, .28, z); g.add(sofa);
      }
      cols.afterparty.push({ x, z, r: 1.1 });
    }
    bakeKit(K, g);
  }

  /* ── 3b · COCKTAIL, the redress — Carl's ask #3, authored LAST on purpose ──
     "Cocktail hour keeps the ceremony decor — same lawn, an hour apart; only
     the seating would be cleared. And the real cocktail bar is a ROUND
     timber-plank bar, not the white counter."
     · The ceremony decor is emitted a SECOND time, into the cocktail group —
       one prop group per moment means sharing = duplicating the instances,
       which is cheap and correct: geometry and materials are shared, only the
       instance tables double (see dressCeremonyDecor). seated = false clears
       the sixty chairs; the decor's colliders land in cols.cocktail, so the
       installations block during cocktail exactly as they do an hour earlier.
     · The round plank bar stands where the straight counter stood (x 4, z 68),
       so the spawn sightline and "Order from the bar" are untouched.
     ⚠ This block sits AFTER all six moments' own authoring because everything
     shares the one seeded stream — its draws go at the TAIL, which is what
     keeps the other five moments (the ceremony emission included) rendering
     byte-for-byte as they did before this pass. Do not move it earlier. */
  {
    const g = groups.cocktail;
    const K = KC;                                  // the same kit block 3 filled
    dressCeremonyDecor(K, g, cols.cocktail, false);
    roundBar(K, g, cols.cocktail, frame(4, 68, 0));
    bakeKit(K, g);
  }

  /* ── interactables: one per moment ──
     `when(id)` resolves by MOMENT id, not by index: inserting the Welcome Brunch
     at 0 shifted all five of the originals, and a hard-coded index here fails
     silently (the prompt simply stops appearing on the right moment). */
  const idx = Object.fromEntries(CFG.MOMENTS.map((m, i) => [m.id, i]));
  const when = id => () => G.momentIndex === idx[id];
  /* champPt is the champagne service the brunch block just placed — the prompt
     rides the prop, so moving one can never strand the other again */
  G.interactables.push(
    /* KAN-232: copy is i18n keys — label() and the toast resolve at render time,
       so a switch of language re-renders the prompt and a card already up.
       `id` is stable across languages: tests find an interactable by it. */
    { id: 'pour', x: champPt.x, z: champPt.z, r: 1.4, __world: true,
      label: () => tr('act.pour'),
      use: () => G.ui.toast(() => tr('say.pour'), 3.4),
      enabled: when('brunch') },
    { id: 'sign', x: -3.4, z: D.z0 + 1.2, r: 1.2, label: () => tr('act.sign'),
      use: () => G.ui.toast(() => tr('say.sign'), 3.4),
      enabled: when('setup') },
    /* all three moved 2026-08-02 with their moments — the arch is on the
       beachfront lawn, the bar is 26 m along the same lawn, and the dance floor
       is on the paved walk between the two dinner lawns. These are the same
       numbers the prop blocks above are built from; if one moves, both move. */
    { id: 'arch', x: -22, z: 71, r: 2.4, label: () => tr('act.arch'),
      use: () => G.ui.toast(() => tr('say.arch'), 3.4),
      enabled: when('ceremony') },
    /* the drink is on the REAL menu — decor-cocktail-menu.jpg; the old
       "Yuzu 75" was not one of the four wedding cocktails */
    { id: 'bar', x: 4, z: 68, r: 2.2, label: () => tr('act.bar'),
      use: () => G.ui.toast(() => tr('say.bar'), 3.2),
      enabled: when('cocktail') },
    { id: 'dance', x: (SITE.DINNER_WALK.x0 + SITE.DINNER_WALK.x1) / 2, z: 3, r: 2.2,
      label: () => tr('act.dance'),
      use: () => G.ui.toast(() => tr('say.dance'), 3.2),
      enabled: when('dinner') },
    { id: 'song', x: 0, z: D.z0 + 1.4, r: 1.6, label: () => tr('act.song'),
      use: () => G.ui.toast(() => tr('say.song'), 3),
      enabled: when('afterparty') },
  );

  /* statics are everything the builders registered BEFORE any dressing */
  const staticColliders = G.colliders.slice();

  G.momentIndex = -1;
  G.setMoment = (idx, opts = {}) => {
    const m = CFG.MOMENTS[idx];
    if (!m || idx === G.momentIndex) return;
    G.momentIndex = idx;

    for (const mm of CFG.MOMENTS) groups[mm.id].visible = mm === m;

    G.colliders.length = 0;
    G.colliders.push(...staticColliders, ...cols[m.id]);

    setNight(G, !!m.night, { quiet: true });

    if (G.setMode) G.setMode('walk', { quiet: true });
    /* spawn.y is the FEET height, and it has to be set explicitly: floorY only
       ever answers the surface within CFG.STEP_UP of where the feet already
       are, so teleporting to the rooftop with y = 0 would resolve to the ground
       285 m below it and drop the player through the hotel. Omitted for every
       moment at grade, which is all five of the enclave ones. */
    G.player.pos.set(m.spawn.x, (m.spawn.y || 0) + CFG.EYE_HEIGHT, m.spawn.z);
    setFacing(m.spawn.yaw);
    syncCamera(G);

    G.ui.setMoment(m, idx);
    if (!opts.quiet) G.ui.toast(() => mt(m, 'blurb'), 4.2, true);   // jump the queue
  };
}

export function updateMoments() { /* per-moment animation is registered on G.tickers */ }
