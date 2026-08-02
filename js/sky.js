// sky.js — the dome, the sun/moon, the stars, the fog and the WHOLE global
// lighting rig. Two palettes: golden-hour day (the aerials: bright cyan-blue
// zenith over a pale warm horizon) and night (deep indigo with an amber glow
// where the resort's own lights are).
//
// The dome is a BackSide sphere that rides with the camera, so it is always
// exactly SKY.R away and can never be flown through — CFG.FLY_MAX_ALT (150)
// stays comfortably inside it, and it also stays inside the camera's far plane.
//
// Exports:  buildSky(G)       — dome + lights + fog, pushes one ticker
//           setSkyNight(on)   — instant cross-set of every palette above
//           isNight()         — current state, for other modules

import * as THREE from 'three';
import { CFG } from './config.js';
import { SITE } from './site.js';
import { mulberry32 } from './materials.js';

/* ═══════════════════════════════════════════════════════════════════════
   tuning — wants to live in CFG.LIGHT eventually (see report); config.js
   belongs to another module, so it stays local for now.
   ═══════════════════════════════════════════════════════════════════════ */
/* low golden-hour sun out over the water (west-north-west), and a high moon
   behind the campus so the villas rim-light at night */
const SUN_DIR = new THREE.Vector3(-0.82, 0.30, -0.30).normalize();
const MOON_DIR = new THREE.Vector3(0.45, 0.62, 0.35).normalize();

/* The shadow camera must hold SITE.SUITE ∪ SITE.POOL plus `pad` metres. That
   box is axis-aligned in world space but the light looks along a diagonal, so
   the orthographic half-extent is the box rotated into light space — worked
   out from SITE, not guessed, and taken as the worst case of sun vs moon. */
function shadowFit(pad) {
  const S = SITE;
  const x0 = Math.min(S.SUITE.cx - S.SUITE.w / 2, S.POOL.cx - S.POOL.w / 2) - pad;
  const x1 = Math.max(S.SUITE.cx + S.SUITE.w / 2, S.POOL.cx + S.POOL.w / 2) + pad;
  const z0 = Math.min(S.SUITE.cz - S.SUITE.d / 2, S.POOL.cz - S.POOL.d / 2) - pad;
  const z1 = Math.max(S.SUITE.cz + S.SUITE.d / 2, S.POOL.cz + S.POOL.d / 2) + pad;
  const hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  let half = 0;
  for (const d of [SUN_DIR, MOON_DIR]) {
    const a = Math.atan2(d.z, d.x);
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    half = Math.max(half, hx * c + hz * s, hx * s + hz * c);
  }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, half: Math.ceil(half) + 1 };
}

const SKY = {
  R: Math.max(300, CFG.SKY_R),          // ≫ FLY_MAX_ALT (220), ≪ CFG.FAR (3000)
  SEG: [48, 28],
  STARS: 1100,
  STAR_FADE: 1.6,                       // seconds for the star field to come up

  SUN_DIR, MOON_DIR,

  /* ≈78 m half-extent → 2048 over 156 m ≈ 7.6 cm/texel, enough to read palm
     frond shadows on the deck without a 4 k map on mobile */
  SHADOW: { ...shadowFit(40), map: 2048, dist: 200, near: 20, far: 430 },

  DAY: {
    hemiSky: 0xbfe3ff, hemiGround: 0x6d7a44, hemi: CFG.LIGHT.HEMI_DAY,
    key: 0xffd7a2, keyI: CFG.LIGHT.SUN_DAY,
    amb: 0xa8c8e4, ambI: 0.28,
    /* The reference is a DRONE PHOTO — crisp to the horizon, not a misty
       morning. FogExp2 fades as 1-exp(-(d·dist)²), so 0.0015 leaves the
       enclave (≤120 m) essentially clear, the hotel crescent at 270 m only
       lightly veiled, and still dissolves the 900 m ocean edge.
       Anything ≥0.004 swallows the campus — that was the washed-out look. */
    fog: 0xa9cfe4, fogD: 0.0015,
    haze: 0xf1e0c2, hazeO: 0.22,
    env: CFG.LIGHT.ENV_DAY,
  },
  NIGHT: {
    hemiSky: 0x2b3a5e, hemiGround: 0x141a22, hemi: CFG.LIGHT.HEMI_NIGHT,
    key: 0x9fb8e8, keyI: CFG.LIGHT.SUN_NIGHT,
    amb: 0x4a3a30, ambI: 0.34,     // warm fill so the resort's own lights carry
    fog: 0x0a1020, fogD: 0.0026,
    haze: 0xffab5e, hazeO: 0.34,
    env: CFG.LIGHT.ENV_NIGHT,
  },
};

/* ═══════════════════════════════════════════════════════════════════════
   module state
   ═══════════════════════════════════════════════════════════════════════ */
let built = false;
let night = false;
let root = null;
let dome = null, haze = null, stars = null, sunDisc = null, moonDisc = null;
let hemi = null, key = null, keyTarget = null, amb = null;
let dayTex = null, nightTex = null;
let ctx = null;                 // the G we were built with
let starOpacity = 0;

/* SphereGeometry maps u=0 → -X, 0.25 → +Z, 0.5 → +X, 0.75 → -Z.
   This turns a world direction into that u so glows land on the right bearing. */
function azToU(dx, dz) {
  return ((Math.atan2(dz, -dx) / (Math.PI * 2)) + 1) % 1;
}

/* ═══════════════════════════════════════════════════════════════════════
   the dome gradient. Canvas row 0 is the zenith (v=1), row h is the nadir.
   x is azimuth, so glows can be painted on a specific bearing.
   ═══════════════════════════════════════════════════════════════════════ */
function domeTex(isNight) {
  const W = 1024, H = 512;
  return skyCanvas(W, H, (g) => {
    const horizon = H * 0.5;
    const grad = g.createLinearGradient(0, 0, 0, H);
    if (isNight) {
      grad.addColorStop(0.00, '#04060f');
      grad.addColorStop(0.22, '#070c1e');
      grad.addColorStop(0.40, '#101a36');
      grad.addColorStop(0.48, '#1b2748');
      grad.addColorStop(0.50, '#26314f');
      grad.addColorStop(0.56, '#141b30');
      grad.addColorStop(1.00, '#070a14');
    } else {
      grad.addColorStop(0.00, '#1567c6');   // deep cyan-blue zenith
      grad.addColorStop(0.20, '#2b86dc');
      grad.addColorStop(0.36, '#63aee8');
      grad.addColorStop(0.45, '#a8d3ee');
      grad.addColorStop(0.49, '#dcecf1');
      grad.addColorStop(0.50, '#f2e4cd');   // pale warm horizon
      grad.addColorStop(0.54, '#c3ccc8');
      grad.addColorStop(1.00, '#7d94a0');
    }
    g.fillStyle = grad; g.fillRect(0, 0, W, H);

    /* a bloom on a given bearing, centred on the horizon */
    const bloom = (u, rx, ry, stops, lift = 0) => {
      const cx = u * W, cy = horizon - lift;
      for (const dx of [-W, 0, W]) {           // drawn three times: wrap the seam
        g.save();
        g.translate(cx + dx, cy); g.scale(rx, ry);
        const r2 = g.createRadialGradient(0, 0, 0, 0, 0, 1);
        for (const s of stops) r2.addColorStop(s[0], s[1]);
        g.fillStyle = r2;
        g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill();
        g.restore();
      }
    };

    if (isNight) {
      /* the resort itself: a broad amber lift on the +X bearing (the main
         Westin crescent) plus a softer one over the enclave */
      bloom(azToU(1, 0.05), W * 0.42, H * 0.30, [
        [0, 'rgba(255,168,84,.34)'], [.45, 'rgba(255,140,64,.12)'], [1, 'rgba(255,140,64,0)'],
      ], -H * 0.02);
      bloom(azToU(0.2, 1), W * 0.22, H * 0.16, [
        [0, 'rgba(255,190,120,.2)'], [1, 'rgba(255,190,120,0)'],
      ], -H * 0.01);
      /* moon halo */
      const mu = azToU(SKY.MOON_DIR.x, SKY.MOON_DIR.z);
      bloom(mu, W * 0.14, H * 0.34, [
        [0, 'rgba(186,206,244,.3)'], [.5, 'rgba(150,176,224,.08)'], [1, 'rgba(150,176,224,0)'],
      ], H * 0.22);
      /* milky band — very faint, keeps the zenith from reading as flat paint */
      const rnd = mulberry32(0x51ade);
      for (let i = 0; i < 260; i++) {
        g.fillStyle = `rgba(148,164,206,${.012 + rnd() * .03})`;
        const x = rnd() * W, y = rnd() * H * .42;
        g.beginPath(); g.ellipse(x, y, 24 + rnd() * 90, 8 + rnd() * 26, rnd(), 0, 7); g.fill();
      }
    } else {
      /* golden-hour bloom on the sun's bearing */
      const su = azToU(SKY.SUN_DIR.x, SKY.SUN_DIR.z);
      bloom(su, W * 0.34, H * 0.34, [
        [0, 'rgba(255,232,182,.62)'], [.35, 'rgba(255,206,140,.24)'], [1, 'rgba(255,196,130,0)'],
      ], H * 0.05);
      /* thin haze clouds hugging the horizon (the aerials' offshore band) */
      const rnd = mulberry32(0xc10d5);
      for (let i = 0; i < 90; i++) {
        const y = horizon - 6 - rnd() * rnd() * H * .3;
        const x = rnd() * W, rx = 40 + rnd() * 200, ry = 3 + rnd() * 9;
        g.fillStyle = `rgba(255,255,255,${.05 + rnd() * .22})`;
        for (const dx of [-W, 0, W]) {
          g.beginPath(); g.ellipse(x + dx, y, rx, ry, 0, 0, 7); g.fill();
        }
      }
      for (let i = 0; i < 26; i++) {          // a few brighter cumulus smudges
        const y = horizon - 20 - rnd() * H * .26;
        const x = rnd() * W, rx = 30 + rnd() * 90, ry = 8 + rnd() * 16;
        g.fillStyle = `rgba(255,250,244,${.1 + rnd() * .2})`;
        for (const dx of [-W, 0, W]) {
          g.beginPath(); g.ellipse(x + dx, y, rx, ry, 0, 0, 7); g.fill();
        }
      }
    }
  });
}

function skyCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.anisotropy = 4;
  return t;
}

/* soft round sprite — used for the sun, the moon and every star */
function discTex(core, mid) {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg.addColorStop(0, core);
  rg.addColorStop(0.16, core);
  rg.addColorStop(0.34, mid);
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* vertical alpha ramp for the horizon haze cylinder */
function hazeTex() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.62, 'rgba(255,255,255,.42)');
  grad.addColorStop(0.86, 'rgba(255,255,255,.92)');
  grad.addColorStop(1, 'rgba(255,255,255,.15)');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ═══════════════════════════════════════════════════════════════════════
   the dome + its furniture
   ═══════════════════════════════════════════════════════════════════════ */
function buildDome() {
  dayTex = domeTex(false);
  nightTex = domeTex(true);

  dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY.R, SKY.SEG[0], SKY.SEG[1]),
    new THREE.MeshBasicMaterial({
      map: night ? nightTex : dayTex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  dome.name = 'skyDome';
  dome.renderOrder = -3;
  dome.frustumCulled = false;

  /* horizon haze band — a shallow open cylinder just inside the dome */
  haze = new THREE.Mesh(
    new THREE.CylinderGeometry(SKY.R * 0.9, SKY.R * 0.9, SKY.R * 0.34, 48, 1, true),
    new THREE.MeshBasicMaterial({
      map: hazeTex(), side: THREE.BackSide, fog: false, transparent: true,
      depthWrite: false,
      opacity: (night ? SKY.NIGHT : SKY.DAY).hazeO,
      color: (night ? SKY.NIGHT : SKY.DAY).haze,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }),
  );
  haze.position.y = SKY.R * 0.045;
  haze.renderOrder = -1;
  haze.frustumCulled = false;
  dome.add(haze);

  /* sun + moon discs. Built while the dome sits at the origin, so their
     local orientation faces the dome centre — i.e. the camera — forever. */
  const mkDisc = (dir, radius, core, mid) => {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 28),
      new THREE.MeshBasicMaterial({
        map: discTex(core, mid), transparent: true, fog: false,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    m.position.copy(dir).multiplyScalar(SKY.R * 0.955);
    m.lookAt(0, 0, 0);
    m.renderOrder = -2;
    m.frustumCulled = false;
    dome.add(m);
    return m;
  };
  sunDisc = mkDisc(SKY.SUN_DIR, SKY.R * 0.048, 'rgba(255,248,225,1)', 'rgba(255,206,132,.55)');
  moonDisc = mkDisc(SKY.MOON_DIR, SKY.R * 0.030, 'rgba(238,244,255,1)', 'rgba(176,198,240,.4)');

  /* stars — seeded, upper hemisphere, additive, faded in by the ticker */
  const rnd = mulberry32(CFG.SEED ^ 0x57a25);
  const pos = new Float32Array(SKY.STARS * 3);
  const col = new Float32Array(SKY.STARS * 3);
  const R = SKY.R * 0.975;
  for (let i = 0; i < SKY.STARS; i++) {
    const a = rnd() * Math.PI * 2;
    const y = 0.03 + Math.pow(rnd(), 0.72) * 0.97;   // thin toward the horizon
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(a) * r * R;
    pos[i * 3 + 1] = y * R;
    pos[i * 3 + 2] = Math.sin(a) * r * R;
    const b = 0.35 + rnd() * 0.65, warm = rnd() < 0.22;
    col[i * 3] = b * (warm ? 1 : 0.86);
    col[i * 3 + 1] = b * 0.9;
    col[i * 3 + 2] = b * (warm ? 0.76 : 1);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sgeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  stars = new THREE.Points(sgeo, new THREE.PointsMaterial({
    size: 1.9, sizeAttenuation: false,
    map: discTex('rgba(255,255,255,1)', 'rgba(255,255,255,.5)'),
    vertexColors: true, transparent: true, opacity: 0, depthWrite: false,
    fog: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  stars.renderOrder = -2;
  stars.frustumCulled = false;
  stars.visible = false;
  dome.add(stars);
}

/* ═══════════════════════════════════════════════════════════════════════
   the lighting rig — everything global lives here
   ═══════════════════════════════════════════════════════════════════════ */
function buildLights(G, parent) {
  const P = night ? SKY.NIGHT : SKY.DAY;

  hemi = new THREE.HemisphereLight(P.hemiSky, P.hemiGround, P.hemi);
  hemi.position.set(0, 60, 0);
  parent.add(hemi);

  amb = new THREE.AmbientLight(P.amb, P.ambI);
  parent.add(amb);

  keyTarget = new THREE.Object3D();
  keyTarget.position.set(SKY.SHADOW.cx, 0, SKY.SHADOW.cz);
  parent.add(keyTarget);

  key = new THREE.DirectionalLight(P.key, P.keyI);
  key.target = keyTarget;
  key.castShadow = true;
  key.shadow.mapSize.set(SKY.SHADOW.map, SKY.SHADOW.map);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.035;
  const sc = key.shadow.camera;
  sc.left = -SKY.SHADOW.half; sc.right = SKY.SHADOW.half;
  sc.top = SKY.SHADOW.half; sc.bottom = -SKY.SHADOW.half;
  sc.near = SKY.SHADOW.near; sc.far = SKY.SHADOW.far;
  sc.updateProjectionMatrix();
  parent.add(key);

  aimKey();

  G.renderer.shadowMap.enabled = true;
  G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

/* park the key light on the current sun/moon bearing, aimed at the suite +
   pool — the shadow camera covers SITE.SUITE and SITE.POOL ±40 m */
function aimKey() {
  const dir = night ? SKY.MOON_DIR : SKY.SUN_DIR;
  key.position.set(
    keyTarget.position.x + dir.x * SKY.SHADOW.dist,
    dir.y * SKY.SHADOW.dist,
    keyTarget.position.z + dir.z * SKY.SHADOW.dist,
  );
  keyTarget.updateMatrixWorld();
}

/* ═══════════════════════════════════════════════════════════════════════
   entry point
   ═══════════════════════════════════════════════════════════════════════ */
export function buildSky(G) {
  if (built) return root;                    // idempotent — safe to call twice
  built = true;
  night = !!G.night;
  ctx = G;

  root = new THREE.Group();
  root.name = 'sky';
  G.scene.add(root);

  buildDome();
  root.add(dome);
  buildLights(G, root);

  const P = night ? SKY.NIGHT : SKY.DAY;
  G.scene.fog = new THREE.FogExp2(P.fog, P.fogD);
  G.scene.background = new THREE.Color(P.fog);
  G.scene.environmentIntensity = P.env;

  /* the renderer may already have compiled programs without shadow support
     (main.js builds the scene before us) — force a recompile once. */
  G.scene.traverse(o => {
    const m = o.material;
    if (!m) return;
    if (Array.isArray(m)) m.forEach(x => { x.needsUpdate = true; });
    else m.needsUpdate = true;
  });

  starOpacity = night ? 1 : 0;
  stars.visible = night;
  stars.material.opacity = starOpacity * 0.95;
  sunDisc.visible = !night;
  moonDisc.visible = night;

  /* the dome rides with the camera: it is then always exactly SKY.R away,
     inside the camera's far plane, and can never be flown out of. */
  const cam = G.camera;
  (G.tickers ||= []).push((dt) => {
    dome.position.copy(cam.position);
    /* stars fade rather than pop */
    const want = night ? 1 : 0;
    if (starOpacity !== want) {
      const step = dt / SKY.STAR_FADE;
      starOpacity = want > starOpacity
        ? Math.min(want, starOpacity + step)
        : Math.max(want, starOpacity - step);
      stars.material.opacity = starOpacity * 0.95;
      stars.visible = starOpacity > 0.001;
    }
  });

  return root;
}

/* ═══════════════════════════════════════════════════════════════════════
   day ↔ night — instant cross-set of dome, lights, fog and haze
   ═══════════════════════════════════════════════════════════════════════ */
export function setSkyNight(on) {
  night = !!on;
  if (!built) return;                        // buildSky() reads `night` on build

  const P = night ? SKY.NIGHT : SKY.DAY;

  dome.material.map = night ? nightTex : dayTex;
  dome.material.needsUpdate = true;

  haze.material.color.setHex(P.haze);
  haze.material.opacity = P.hazeO;

  sunDisc.visible = !night;
  moonDisc.visible = night;

  hemi.color.setHex(P.hemiSky);
  hemi.groundColor.setHex(P.hemiGround);
  hemi.intensity = P.hemi;

  amb.color.setHex(P.amb);
  amb.intensity = P.ambI;

  key.color.setHex(P.key);
  key.intensity = P.keyI;
  aimKey();

  if (ctx) {
    if (ctx.scene.fog) {
      ctx.scene.fog.color.setHex(P.fog);
      ctx.scene.fog.density = P.fogD;
    }
    if (ctx.scene.background && ctx.scene.background.isColor) {
      ctx.scene.background.setHex(P.fog);
    }
    ctx.scene.environmentIntensity = P.env;
  }
}

export function isNight() {
  return night;
}
