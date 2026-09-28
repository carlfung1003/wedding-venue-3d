/* GLB model registry — the Blender-authored props (assets/blender/, KAN-207).

   Loads every model in assets/models/models.json once and hands out either a
   clone (`get` / `place`) or the ONE shared BufferGeometry + Material
   (`geometry` / `material`) so a caller can build
       new THREE.InstancedMesh(models.geometry('crossback_chair'), models.material('crossback_chair'), 60)
   — sixty chairs in one draw call, which is how moments.js already draws them.

   Every asset is one mesh with one baked albedo×AO atlas (see
   assets/blender/README.md). A GLB with more than one mesh is a pipeline
   error; `geometry()` warns and returns null rather than guessing.

   A missing model must never take the page down: every failure path warns and
   returns null, so call sites keep their old primitives as the fallback.

   Ported from seventh-floor's js/models.js. Differences: no ?b= cache-busting
   (Vercel serves max-age=0, must-revalidate; the manifest is fetched with
   cache:'no-cache'), Draco self-hosted at the importmap's exact three
   version (vendor/, KAN-235), and paths resolve against THIS MODULE so tools/viewer.html (one
   directory down) reads the same files as index.html. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { envKnob } from './materials.js';
import { PHONE } from './perftier.js';

/* 'assets/models/' relative to the site root, resolved via the module URL. */
const DIR = new URL('../assets/models/', import.meta.url).href;
/* KAN-235: self-hosted beside three (see index.html), and the glTF build of the
   decoder (the one three's own GLTF examples use — KHR_draco_mesh_compression's
   branch) as WASM, with its asm.js twin in the same folder as the fallback
   DRACOLoader picks when WebAssembly is missing. */
const DRACO_PATH = new URL('../vendor/three@0.180.0/examples/jsm/libs/draco/gltf/', import.meta.url).href;

let manifest = null;
/* KAN-235: the PHONE tier's 1024² twins of the 2048² atlases (assets/models/lo/,
   derived by assets/blender/derive_lo.py). lo.json says which hi GLB each one
   was derived FROM (its bytes + tris); a twin is used only while that still
   matches models.json, so a re-exported GLB that was not re-derived loads its
   hi self instead of a stale atlas. Never fetched on the full tier. */
let lo = {};
/* name -> { root, mesh } (mesh is the single Mesh, or null if the GLB had several)
   | null when the load failed. The template is never added to a scene. */
const cache = new Map();
let _aniso = 8;
let _loader = null, _draco = null;
const IDENTITY = new THREE.Matrix4();

export function setAnisotropy(n) { _aniso = Math.max(1, n | 0); }

function loader() {
  if (!_loader) {
    const draco = _draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_PATH);
    /* KAN-235: WASM (DRACOLoader's default; it falls back to the JS decoder by
       itself where WebAssembly is missing). This used to force { type: 'js' }
       with the note "wasm needs COOP/COEP we do not set" — it does not: COOP/COEP
       gate SharedArrayBuffer, and the Draco worker is plain single-threaded
       WASM. The glTF WASM decoder is 71 KB on the wire against the JS one's
       144 KB, and decodes the 140 GLBs faster (measured in CLAUDE.md
       "PERFORMANCE — KAN-235"); the decoded geometry is bit-identical (same C++,
       checked by hashing every attribute of every GLB both ways). */
    _loader = new GLTFLoader();
    _loader.setDRACOLoader(draco);
  }
  return _loader;
}

/* Material rules — the names are the contract with wv_bake.apply_baked():
     *_emit       keep glowing: emissive intensity ≥ 1, tone-mapped
     mirror       metalness 1, roughness .12 (the mirror ball)
     canopy_tint  white albedo; the game multiplies an instance colour in (teal parasols)
     crystal      the faint blue emissive moments.js gives its crystal beads */
function prepMaterial(m) {
  if (!m) return;
  if (m.map) m.map.anisotropy = _aniso;   // map.colorSpace stays as GLTFLoader set it
  m.fog = true;
  const name = (m.name || '').replace(/\.\d{3}$/, '');   // tolerate a Blender `.001` suffix
  const emitByName = /_emit$/.test(name);
  const emitByColour = !!(m.emissive && m.emissive.getHex() !== 0x000000);
  if (emitByName || emitByColour) {
    if (!emitByColour) m.emissive.copy(m.color);   // a *_emit that lost its factor
    m.emissiveIntensity = Math.max(m.emissiveIntensity || 1, 1);
    m.toneMapped = true;
  }
  if (name === 'mirror') {
    /* A mirror is its reflection, not its albedo: the baked atlas is dark grey
       (AO in every tile gap) and a dark base colour multiplied into a
       metalness-1 reflection is a black ball — which is what the first
       in-engine shot showed. Drop the map, use the light base the procedural
       ball had, and let the PMREM environment do the work. */
    m.map = null;
    m.color.set(0xdfe6ea);
    m.metalness = 1; m.roughness = 0.12;
    /* KAN-211 wave F: an env knob. The 1.4 set here until wave F never bound
       (no own envMap — the ball rendered at the scene's .95 / .30). */
    envKnob(m, null, 'models:mirror');
    m.needsUpdate = true;
  }
  if (name === 'canopy_tint') m.color.set(0xffffff);
  if (name === 'crystal') {
    m.roughness = Math.min(m.roughness, 0.1); m.metalness = Math.max(m.metalness, 0.12);
    m.emissive.set(0x93aec4); m.emissiveIntensity = 0.3; m.toneMapped = true;
  }
}

function prepare(root) {
  const meshes = [];
  root.traverse((n) => { if (n.isMesh) meshes.push(n); });
  for (const n of meshes) {
    n.castShadow = false;       // match the current props (the sun's shadow map is finite)
    n.receiveShadow = true;
    const mats = Array.isArray(n.material) ? n.material : [n.material];
    for (const m of mats) prepMaterial(m);
  }
  let mesh = null;
  if (meshes.length === 1) {
    /* The InstancedMesh path uses the geometry alone and never sees the node's
       transform, so bake any transform the exporter left into the vertices once;
       clones and instances then agree. (Blender's Y-up export normally writes
       identity nodes — this is the safety net.) */
    const m = meshes[0];
    root.updateMatrixWorld(true);
    if (!m.matrixWorld.equals(IDENTITY)) {
      m.geometry.applyMatrix4(m.matrixWorld);
      m.geometry.computeBoundingBox();
      m.geometry.computeBoundingSphere();
    }
    if (m.parent !== root) { root.clear(); root.add(m); }
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1);
    m.updateMatrix();
    mesh = m;
  }
  return { root, mesh };
}

export async function loadManifest() {
  if (manifest) return manifest;
  const loP = PHONE
    ? fetch(DIR + 'lo/lo.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : {})).catch(() => ({}))
    : Promise.resolve({});
  try {
    const r = await fetch(DIR + 'models.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    manifest = await r.json();
  } catch (err) {
    console.warn('models: no manifest at', DIR + 'models.json', '—', err && err.message,
      '(every has() is false; call sites keep their primitives)');
    manifest = {};
  }
  lo = await loP;
  return manifest;
}
function glbURL(name) {
  const r = lo[name], m = manifest && manifest[name];
  return r && m && r.srcBytes === m.bytes && r.srcTris === m.tris ? `${DIR}lo/${name}.glb` : `${DIR}${name}.glb`;
}
/* tests / probes: which GLBs this tier actually loads from lo/ */
export function loNames() { return Object.keys(lo).filter(n => glbURL(n).includes('/lo/')); }

export function names() { return Object.keys(manifest || {}); }
export function info(name) { return (manifest || {})[name] || null; }

function loadOne(name) {
  return new Promise((resolve) => {
    loader().load(
      glbURL(name),
      (gltf) => {
        const entry = prepare(gltf.scene);
        entry.root.name = name;
        if (!entry.mesh) console.warn(`models: ${name}.glb has ${countMeshes(entry.root)} meshes — geometry()/material() will return null`);
        cache.set(name, entry);
        resolve(entry);
      },
      undefined,
      (err) => {
        console.warn('models: failed to load', name, err && err.message);
        cache.set(name, null);
        resolve(null);
      },
    );
  });
}

function countMeshes(root) { let n = 0; root.traverse((o) => { if (o.isMesh) n++; }); return n; }

/* Load everything in the manifest, reporting 0..1 progress. Resolves to the
   cache; never rejects. */
export async function preload(onProgress) {
  /* KAN-235: fetch + compile the Draco decoder NOW, beside the manifest, not
     when the first GLB lands — on a 10 Mbps phone it used to queue behind ~7 MB
     of GLBs (done at 6.8 s while the first GLB had arrived at 2.5 s), so every
     decode waited for it. DRACOLoader.preload() is its own API for exactly this. */
  loader();
  _draco.preload();
  await loadManifest();
  const list = Object.keys(manifest);
  let done = 0;
  await Promise.all(list.map((n) => loadOne(n).then((r) => {
    done++;
    if (onProgress) onProgress(done / list.length, n, !!r);
    return r;
  })));
  return cache;
}

/* True if the model actually loaded — call sites use it to skip their old fallback. */
export function has(name) { return !!cache.get(name); }

/* A fresh instance. Geometry and material are shared with the template, so a
   clone is cheap — only the node transforms are new. */
export function get(name) {
  const t = cache.get(name);
  if (t === undefined) { console.warn('models: not preloaded:', name); return null; }
  if (t === null) return null;
  return t.root.clone(true);
}

/* Place a clone in one call: position, yaw (radians), uniform scale. */
export function place(parent, name, x, y, z, ry = 0, s = 1) {
  const m = get(name);
  if (!m) return null;
  m.position.set(x, y, z);
  m.rotation.y = ry;
  if (s !== 1) m.scale.setScalar(s);
  parent.add(m);
  return m;
}

/* The single shared BufferGeometry / Material, for InstancedMesh. null (with a
   warning) if the model is missing or the GLB carries more than one mesh. */
function single(name, what) {
  const t = cache.get(name);
  if (t === undefined) { console.warn(`models: ${what}(): not preloaded:`, name); return null; }
  if (t === null) return null;
  if (!t.mesh) { console.warn(`models: ${what}(): ${name}.glb is not a single mesh`); return null; }
  return t.mesh;
}
export function geometry(name) { const m = single(name, 'geometry'); return m ? m.geometry : null; }
export function material(name) { const m = single(name, 'material'); return m ? m.material : null; }
