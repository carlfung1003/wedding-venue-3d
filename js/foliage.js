/* FOLIAGE — the understory's leaf-clump cards and prototypes (KAN-208 wave 4).

   The shrub masses, ground cover, bougainvillea and the river dressing's
   shrubs used to be ONE bucket each of a faceted icosahedron wearing a
   photograph — "crumpled paper balls stretched with a photo". Each is now two
   buckets fed the SAME instance matrices:

     CORE    the old bucket, untouched except its prototype geometry
             (`shrub_core` / `cover_core`, Blender GLBs, ASSET_SPEC Group J):
             its material, instance colours, scatter and rnd() draws are
             exactly what they were;
     FRINGE  a NEW InstancedMesh of alpha-cut leaf-clump cards
             (`shrub_fringe` / `_b` / `cover_fringe`) on one of the two leaf
             materials below — the silhouette.

   ⚠ WHY THE FRINGE HAS NO INSTANCE COLOUR, AND MUST NOT GET ONE. The leaf
   material is built to land on a shader program that ALREADY EXISTS — the palm
   fronds' and the casuarinas' (MeshStandardMaterial + map + alphaTest +
   DoubleSide + instancing, NO instancingColor) — so the program count stays
   115. Give a fringe bucket setColorAt() and three compiles USE_INSTANCING_COLOR
   into a new program (×2: the main frame and the mirror's linear pass). The
   per-instance tint therefore lives only on the core; the card textures are
   graded to sit on it.

   ⚠ THE MAP IS THERE FROM THE START. A canvas stand-in (a soft leafy disc with
   real alpha) is the boot map and the generated photograph replaces it on load
   — the same rule as nature.js photoMap(): USE_MAP and ALPHATEST are compiled
   into the program at the first compile, a map handed over later is a
   recompile. If the file 404s the cards keep the stand-in.

   Night: `setFoliageNight` multiplies the same kind of tint nature.js's
   NIGHT_TABLE does (uniforms only, never needsUpdate) — nature.js calls it
   from setNatureNight, which world.js fans out on every moment switch. */
import * as THREE from 'three';
import * as models from './models.js';

const LEAF = {
  /* day colour is a small warm-green lift/grade on top of the photograph so the
     cards meet the tinted core; night is the shrub row of nature's NIGHT_TABLE */
  shrub: { file: 'shrub_leaf.webp', day: 0xe4eed8, night: 0x445c74, fb: ['#3f6a30', '#2c4d24'] },
  boug:  { file: 'boug_leaf.webp',  day: 0xffffff, night: 0x6b5878, fb: ['#b83a74', '#2f5226'] },
};
const MATS = {};
let night = false;

function fallbackTex(c0, c1) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, c0); gr.addColorStop(.7, c1); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** the ONE shared leaf-card material for `key` ('shrub' | 'boug') */
export function leafMat(key) {
  if (MATS[key]) return MATS[key];
  const L = LEAF[key];
  const m = new THREE.MeshStandardMaterial({
    color: night ? L.night : L.day, map: fallbackTex(...L.fb),
    alphaTest: .5, side: THREE.DoubleSide, roughness: .86, metalness: 0,
  });
  m.name = 'leaf_' + key;
  new THREE.TextureLoader().load(new URL(`../assets/textures/${L.file}`, import.meta.url).href, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;   // one card = the whole clump
    const old = m.map;
    m.map = t;
    m.needsUpdate = true;          // same defines (USE_MAP was there) — a cache hit
    if (old && old.isCanvasTexture) old.dispose();
  }, undefined, () => console.warn(`foliage: ${L.file} did not load — keeping the stand-in`));
  MATS[key] = m;
  return m;
}

export function setFoliageNight(on) {
  night = !!on;
  for (const k in MATS) MATS[k].color.setHex(night ? LEAF[k].night : LEAF[k].day);
}

/* ── prototypes ─────────────────────────────────────────────────────────── */
const _scaled = new Map();
/** the GLB geometry `name` (null when it did not load), optionally a uniformly
    scaled CLONE — campus.js's UNIT_BLOB is radius .5 where the GLBs are radius 1 */
export function protoGeo(name, s = 1) {
  if (!models.has(name)) return null;
  const g = models.geometry(name);
  if (!g || s === 1) return g;
  const k = name + '@' + s;
  if (!_scaled.has(k)) _scaled.set(k, g.clone().scale(s, s, s));
  return _scaled.get(k);
}

/** A FRINGE bucket over `core`'s instances: same matrices, instance for
    instance, split across the fringe variants by index (i % variants.length)
    so neighbours differ. Built from the core's CURRENT matrices — call it
    after the core is filled. Casts no shadow (the core already does), and
    carries no instance colour (see the banner). Returns the meshes (added to
    `parent`), or [] when a prototype is missing. */
const _m = new THREE.Matrix4();
export function fringeFor(core, variants, mat, parent, name, s = 1) {
  const geos = variants.map(v => protoGeo(v, s));
  if (geos.some(g => !g)) return [];
  const out = [];
  geos.forEach((geo, vi) => {
    const idx = [];
    for (let i = vi; i < core.count; i += geos.length) idx.push(i);
    if (!idx.length) return;
    const im = new THREE.InstancedMesh(geo, mat, idx.length);
    im.name = `${name}${geos.length > 1 ? ':' + 'ab'[vi] : ''}`;
    idx.forEach((ci, k) => { core.getMatrixAt(ci, _m); im.setMatrixAt(k, _m); });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = core.receiveShadow;
    im.computeBoundingSphere();
    parent.add(im);
    out.push(im);
  });
  return out;
}
