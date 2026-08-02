// campus.js — THE BUILT CAMPUS of 隐逸居 (Yinyiju), the Westin Sanya Haitang Bay
// clubhouse enclave. Buildings + hardscape only:
//
//   · SITE.LOUNGE      — the 280 ㎡ / 60-seat 酒廊, wedding-dinner venue
//   · SITE.VILLAS      — 10 guest keys in 3 types (5 Garden Rooms, 3 Garden Pool
//                        2-BR with walled courtyards, 2 two-storey Garden 3-BR)
//   · SITE.LAWN        — the circular ceremony lawn, stone edge + ring path + hedge
//   · SITE.PLAZA       — basalt/turf band paving with in-ground lights
//   · SITE.PERGOLA / SIGN_PILLAR / EXT_STAIR
//   · SITE.HOTEL       — the far Westin crescent (fly-mode skyline)
//   · SITE.ROAD        — arrival road, parking, lamp posts
//
// NOT here: water surfaces (water.js), planting (nature.js), the presidential
// suite + atrium (suite.js), interior dressing (moments.js). The lounge floor is
// deliberately left EMPTY — the dinner module drops eight rounds onto it.
//
// Palette (clubhouse-pdf-brief.md): white stucco volumes · flat cantilevered
// roofs with copper/bronze fascia · dark mahogany slats · cream marble ·
// folding glass door-walls · glass balustrades on red-brown timber decks ·
// teal umbrellas · white wicker · bougainvillea.
//
// Everything repeated is an InstancedMesh (see the bucket system) — the whole
// campus lands in well under a hundred draw calls.
import * as THREE from 'three';
import { SITE } from './site.js';
import { CFG } from './config.js';
import { mulberry32 } from './materials.js';

/* ════════════════════════════════════════════════════════════════════════
   shared geometry — every box in the campus is ONE unit cube, scaled
   ════════════════════════════════════════════════════════════════════════ */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const UNIT_CYL = new THREE.CylinderGeometry(.5, .5, 1, 12);
const UNIT_CONE = new THREE.ConeGeometry(.5, 1, 10);
const UNIT_BLOB = new THREE.IcosahedronGeometry(.5, 1);
const WHITE = new THREE.Color(0xffffff);

/* ════════════════════════════════════════════════════════════════════════
   night registry — setCampusNight() walks these three lists
   ════════════════════════════════════════════════════════════════════════ */
const NIGHT = { tint: [], glow: [], lights: [] };
let night = false;
let MAT = null;
let clock = 0;

/** darken + cool a material after dark (multiplied onto its day colour) */
function tint(mat, nightHex) {
  NIGHT.tint.push({ mat, d: mat.color.clone(), n: new THREE.Color(nightHex).multiply(mat.color) });
  return mat;
}
/** an emissive that lifts after dark */
function glow(mat, dayI, nightI) {
  mat.emissiveIntensity = dayI;
  NIGHT.glow.push({ mat, d: dayI, n: nightI });
  return mat;
}
function reglight(light, dayI, nightI) {
  light.intensity = dayI;
  NIGHT.lights.push({ light, d: dayI, n: nightI });
  return light;
}

/* ════════════════════════════════════════════════════════════════════════
   canvas textures (no image files anywhere in this project)
   ════════════════════════════════════════════════════════════════════════ */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
/** same canvas, different tiling — cheap variant of an existing map */
function retile(t, rx, ry) {
  const c = t.clone();
  c.needsUpdate = true;
  c.repeat.set(rx, ry);
  return c;
}

function texStucco() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#f4f1e9'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(4021);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(${196 + rnd() * 44 | 0},${190 + rnd() * 44 | 0},${176 + rnd() * 44 | 0},${.05 + rnd() * .09})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.strokeStyle = 'rgba(150,142,126,.10)'; g.lineWidth = 1;
    for (let y = 64; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, [2, 1]);
}

/* flat standing-seam metal — the enclave's signature grey roof plate */
function texRoof() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#7d7972'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(6607);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${104 + rnd() * 76 | 0},${102 + rnd() * 72 | 0},${96 + rnd() * 66 | 0},.28)`;
      g.fillRect(rnd() * w, rnd() * h, 4 + rnd() * 26, 2 + rnd() * 9);
    }
    for (let x = 0; x <= w; x += 32) {
      g.fillStyle = 'rgba(52,50,46,.55)'; g.fillRect(x - 1.5, 0, 3, h);
      g.fillStyle = 'rgba(236,233,226,.15)'; g.fillRect(x + 2, 0, 1.5, h);
    }
  }, [9, 1]);
}

/* red-brown timber decking */
function texDeck() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f4128'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3313);
    for (let y = 0; y < h; y += 26) {
      g.fillStyle = `rgb(${96 + rnd() * 42 | 0},${56 + rnd() * 26 | 0},${34 + rnd() * 18 | 0})`;
      g.fillRect(0, y + 1, w, 24);
      g.strokeStyle = 'rgba(255,214,168,.09)'; g.lineWidth = 1;
      for (let k = 4; k < 24; k += 6) {
        g.beginPath(); g.moveTo(0, y + k + rnd() * 2); g.lineTo(w, y + k + rnd() * 2); g.stroke();
      }
      g.fillStyle = 'rgba(30,16,8,.55)'; g.fillRect(0, y, w, 1.5);
    }
  }, [3, 3]);
}

/* dark mahogany vertical slats — partitions, ceilings, screens */
function texSlat() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#2b1a12'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8821);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = `rgb(${68 + rnd() * 30 | 0},${40 + rnd() * 18 | 0},${26 + rnd() * 12 | 0})`;
      g.fillRect(x + 2, 0, 11, h);
      g.fillStyle = 'rgba(226,178,120,.10)'; g.fillRect(x + 2, 0, 2, h);
    }
  }, [8, 1]);
}

/* cream marble — the lounge floor */
function texMarble() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#ece5d6'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(2207);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = `rgba(150,140,124,${.06 + rnd() * .12})`;
      g.lineWidth = .6 + rnd() * 1.5;
      let x = rnd() * w, y = rnd() * h;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        const nx = x + (rnd() - .5) * 200, ny = y + (rnd() - .5) * 200;
        g.quadraticCurveTo(x + (rnd() - .5) * 80, y + (rnd() - .5) * 80, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(128,118,102,.22)'; g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.rect(1, 1, w - 2, h - 2); g.stroke();
  }, [5, 5]);
}

/* dark basalt pavers */
function texPaver() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3a38'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(1511);
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
      g.fillStyle = `rgb(${52 + rnd() * 24 | 0},${51 + rnd() * 22 | 0},${49 + rnd() * 22 | 0})`;
      g.fillRect(x + 1, y + 1, 62, 62);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(${20 + rnd() * 60 | 0},${20 + rnd() * 58 | 0},${20 + rnd() * 55 | 0},.35)`;
        g.fillRect(x + 2 + rnd() * 58, y + 2 + rnd() * 58, 2 + rnd() * 5, 2 + rnd() * 5);
      }
    }
  }, [4, 4]);
}

/* pale travertine / cream stone — plinths, coping, courtyards */
function texStone() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#cfc6b4'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(9403);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${186 + rnd() * 46 | 0},${178 + rnd() * 44 | 0},${160 + rnd() * 44 | 0},${.18 + rnd() * .3})`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 9, 1 + rnd() * 4);
    }
    g.strokeStyle = 'rgba(140,130,112,.30)'; g.lineWidth = 1.5;
    for (let k = 0; k <= 256; k += 85) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.moveTo(0, k); g.lineTo(w, k); g.stroke();
    }
  }, [6, 6]);
}

/* mown turf with mower stripes */
function texTurf() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4e7738'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(6151);
    for (let y = 0; y < h; y += 32) {
      g.fillStyle = (y / 32) % 2 ? 'rgba(126,168,86,.16)' : 'rgba(38,66,28,.16)';
      g.fillRect(0, y, w, 32);
    }
    for (let i = 0; i < 2200; i++) {
      g.fillStyle = `rgba(${58 + rnd() * 80 | 0},${100 + rnd() * 74 | 0},${44 + rnd() * 46 | 0},.5)`;
      g.fillRect(rnd() * w, rnd() * h, 1.5, 2.5);
    }
  }, [8, 8]);
}

/* asphalt with a dashed centre line (uv.v runs along the ribbon) */
function texAsphalt() {
  return tex(128, 256, (g, w, h) => {
    g.fillStyle = '#34353a'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7717);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(${58 + rnd() * 60 | 0},${58 + rnd() * 58 | 0},${60 + rnd() * 58 | 0},.3)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.fillStyle = 'rgba(226,222,206,.55)';
    g.fillRect(w / 2 - 2, h * .28, 4, h * .44);
    g.fillStyle = 'rgba(226,222,206,.30)';
    g.fillRect(3, 0, 3, h); g.fillRect(w - 6, 0, 3, h);
  }, [1, 1]);
}

/* parking apron: asphalt + white stall lines */
function texPark() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3a3b40'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(4457);
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `rgba(${64 + rnd() * 56 | 0},${64 + rnd() * 54 | 0},${66 + rnd() * 54 | 0},.28)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    g.fillStyle = 'rgba(230,226,212,.6)';
    for (let x = 0; x < w; x += 64) g.fillRect(x, h * .18, 3, h * .64);
  }, [3, 1]);
}

/* main hotel facade: 7 terraced floors, white lattice exoskeleton (p1 aerial) */
function texHotelFacade() {
  const F = SITE.HOTEL.floors;
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#cfcabe'; g.fillRect(0, 0, w, h);
    const row = h / F, rnd = mulberry32(1237);
    for (let f = 0; f < F; f++) {
      const y = h - (f + 1) * row;
      g.fillStyle = '#2e353c'; g.fillRect(0, y + row * .18, w, row * .5);      // glazing band
      g.fillStyle = '#e6e1d4'; g.fillRect(0, y + row * .68, w, row * .32);     // slab edge
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, y + row * .68, w, 3);
      for (let x = 0; x < w; x += 64) {                                        // balcony dividers
        g.fillStyle = `rgba(228,224,212,${.5 + rnd() * .3})`;
        g.fillRect(x, y + row * .12, 5, row * .6);
      }
    }
    /* white lattice exoskeleton — diagonal ribs over the whole face */
    g.strokeStyle = 'rgba(248,246,238,.55)'; g.lineWidth = 5;
    for (let x = -h; x < w + h; x += 74) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke();
      g.beginPath(); g.moveTo(x + h, 0); g.lineTo(x, h); g.stroke();
    }
    g.strokeStyle = 'rgba(248,246,238,.75)'; g.lineWidth = 6;
    for (let x = 0; x < w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [26, 1]);
}

/* the same grid as an emissive map — hundreds of warm windows, seeded on/off */
function texHotelWindows() {
  const F = SITE.HOTEL.floors;
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const row = h / F, rnd = mulberry32(CFG.SEED % 99991);
    for (let f = 0; f < F; f++) {
      const y = h - (f + 1) * row;
      for (let x = 6; x < w; x += 32) {
        const on = rnd();
        if (on < .34) continue;
        const a = .45 + on * .55;
        g.fillStyle = `rgba(${255},${196 + rnd() * 40 | 0},${118 + rnd() * 50 | 0},${a})`;
        g.fillRect(x, y + row * .22, 20, row * .42);
      }
    }
  }, [26, 1]);
}

/* the illuminated signage plate */
function texSign() {
  return tex(512, 256, (g, w, h) => {
    g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f3ead6'; g.lineWidth = 5;
    g.strokeRect(w / 2 - 46, 22, 92, 92);
    g.fillStyle = '#f3ead6';
    g.font = 'bold 72px Helvetica, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('H', w / 2, 70);
    const label = 'THE WESTIN';
    g.font = '600 40px Helvetica, Arial, sans-serif';
    const sp = 15, wid = label.split('').reduce((a, ch) => a + g.measureText(ch).width + sp, -sp);
    let x = w / 2 - wid / 2;
    g.textAlign = 'left';
    for (const ch of label) { g.fillText(ch, x, 168); x += g.measureText(ch).width + sp; }
    g.fillStyle = 'rgba(243,234,214,.55)';
    g.fillRect(w / 2 - 80, 204, 160, 3);
  });
}

/* ════════════════════════════════════════════════════════════════════════
   materials — built once per buildCampus() call
   ════════════════════════════════════════════════════════════════════════ */
function makeMaterials() {
  const stucco = texStucco(), roof = texRoof(), deck = texDeck(), slat = texSlat();
  const marble = texMarble(), paver = texPaver(), stone = texStone(), turf = texTurf();
  const hotelFace = texHotelFacade(), hotelWin = texHotelWindows(), sign = texSign();

  const m = {
    stucco: tint(new THREE.MeshStandardMaterial({ map: stucco, roughness: .93 }), 0x7e8798),
    stuccoWall: tint(new THREE.MeshStandardMaterial({ map: retile(stucco, 4, .5), roughness: .95 }), 0x767f90),
    roof: tint(new THREE.MeshStandardMaterial({ map: roof, roughness: .58, metalness: .35 }), 0x69707e),
    copper: tint(new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: .42, metalness: .72 }), 0x9e9086),
    dark: tint(new THREE.MeshStandardMaterial({ color: 0x27241f, roughness: .78 }), 0x8a90a0),
    slat: tint(new THREE.MeshStandardMaterial({ map: slat, roughness: .66 }), 0x8e8b9c),
    slatCeil: tint(new THREE.MeshStandardMaterial({ map: retile(slat, 26, 3), roughness: .6 }), 0x8e8b9c),
    deck: tint(new THREE.MeshStandardMaterial({ map: deck, roughness: .8 }), 0x7f7c8a),
    marble: tint(new THREE.MeshStandardMaterial({ map: marble, roughness: .24, metalness: .04 }), 0x8b91a2),
    paver: tint(new THREE.MeshStandardMaterial({ map: paver, roughness: .9 }), 0x6f7684),
    stone: tint(new THREE.MeshStandardMaterial({ map: stone, roughness: .88 }), 0x818898),
    turf: tint(new THREE.MeshStandardMaterial({ map: turf, roughness: .98 }), 0x5b6b82),
    turfStrip: tint(new THREE.MeshStandardMaterial({ map: retile(turf, 2, 6), roughness: .98 }), 0x5b6b82),
    hedge: tint(new THREE.MeshStandardMaterial({ color: 0x2f5a2c, roughness: 1, flatShading: true }), 0x5c6b86),
    bougain: tint(new THREE.MeshStandardMaterial({ color: 0xbf3f79, roughness: .92, flatShading: true }), 0x7a6a8c),
    white: tint(new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .72 }), 0x8f96a6),
    umbrella: tint(new THREE.MeshStandardMaterial({ color: 0x1f8fa5, roughness: .85, side: THREE.DoubleSide }), 0x76839a),
    blackstone: tint(new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: .3, metalness: .18 }), 0x99a1b2),
    /* backdrop-only water for the far resort villas' plunge pools — water.js
       owns every pool you can actually reach; these are just turquoise dots
       seen from the air, and must never cost a reflection pass */
    villaWater: tint(new THREE.MeshStandardMaterial({
      color: 0x2fa8b8, roughness: .12, metalness: .1, envMapIntensity: 1.4,
    }), 0x5f7590),
    asphalt: tint(new THREE.MeshStandardMaterial({ map: texAsphalt(), roughness: .95 }), 0x7d8290),
    park: tint(new THREE.MeshStandardMaterial({ map: texPark(), roughness: .95 }), 0x7d8290),
    car: tint(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .34, metalness: .5 }), 0x8089a0),
    carGlass: tint(new THREE.MeshStandardMaterial({ color: 0x1b2228, roughness: .16, metalness: .3 }), 0x9aa2b4),
    greenRoof: tint(new THREE.MeshStandardMaterial({ color: 0x53763f, roughness: .96,
      side: THREE.DoubleSide }), 0x5d6c86),
    /* the crescent's podium is seen from inside its cylinder, like the facade */
    hotelPodium: tint(new THREE.MeshStandardMaterial({ map: retile(stone, 30, 1), roughness: .9,
      side: THREE.BackSide }), 0x818898),
    waveCanopy: tint(new THREE.MeshStandardMaterial({ color: 0x2f6fa8, roughness: .5, metalness: .25,
      side: THREE.DoubleSide }), 0x707d96),

    /* glazing — warm interiors switch on after dark */
    glass: new THREE.MeshStandardMaterial({
      color: 0x25333a, roughness: .07, metalness: .16, transparent: true, opacity: .5,
      emissive: 0xffb45e, emissiveIntensity: 0, side: THREE.DoubleSide,
    }),
    clear: new THREE.MeshStandardMaterial({
      color: 0xbfd4dc, roughness: .05, metalness: .1, transparent: true, opacity: .22,
      side: THREE.DoubleSide,
    }),

    /* emissives */
    glowLamp: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, emissive: 0xffc27a, emissiveIntensity: 0 }),
    inLight: new THREE.MeshStandardMaterial({ color: 0x101012, emissive: 0xffd39a, emissiveIntensity: 0 }),
    loungeGlow: new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xffb769, emissiveIntensity: 0 }),
    sign: new THREE.MeshStandardMaterial({
      map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0, roughness: .5,
    }),
    /* the crescent's concave face is seen from INSIDE its cylinder → BackSide */
    hotelFacade: new THREE.MeshStandardMaterial({
      map: hotelFace, emissive: 0xffb265, emissiveMap: hotelWin, emissiveIntensity: 0,
      roughness: .82, side: THREE.BackSide,
    }),
    hotelBack: tint(new THREE.MeshStandardMaterial({ map: retile(hotelFace, 26, 1), roughness: .9 }), 0x606776),
  };
  tint(m.hotelFacade, 0x6d7482);
  glow(m.glass, 0, 1.05);
  glow(m.glowLamp, .04, 2.6);
  glow(m.inLight, .04, 2.2);
  glow(m.loungeGlow, .16, 2.3);
  glow(m.sign, .18, 1.55);
  glow(m.hotelFacade, 0, 1.35);
  return m;
}

/* ════════════════════════════════════════════════════════════════════════
   instance buckets — every repeated part is queued here and flushed into
   one InstancedMesh per (geometry, material) pair
   ════════════════════════════════════════════════════════════════════════ */
const BUCKETS = new Map();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
const _e = new THREE.Euler();

function mat4(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) {
  _p.set(x, y, z); _s.set(sx, sy, sz);
  _e.set(rx, ry, rz, 'YXZ');
  _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(_p, _q, _s);
}
function inst(key, geo, mat, m, color = null) {
  let b = BUCKETS.get(key);
  if (!b) { b = { geo, mat, ms: [], cs: [], any: false }; BUCKETS.set(key, b); }
  b.ms.push(m); b.cs.push(color);
  if (color) b.any = true;
  return b;
}
function flushBuckets(parent) {
  for (const [key, b] of BUCKETS) {
    if (!b.ms.length) continue;
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.ms.length);
    im.name = 'campus:' + key;
    for (let i = 0; i < b.ms.length; i++) {
      im.setMatrixAt(i, b.ms[i]);
      if (b.any) im.setColorAt(i, b.cs[i] || WHITE);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    parent.add(im);
  }
  BUCKETS.clear();
}

/* ── plain (non-instanced) helpers ── */
function box(parent, w, h, d, x, y, z, mat, ry = 0) {
  const m = new THREE.Mesh(UNIT_BOX, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}
function slab(parent, w, d, x, y, z, mat, ry = 0) {
  const m = new THREE.Mesh(UNIT_PLANE, mat);
  m.scale.set(w, 1, d); m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  parent.add(m);
  return m;
}
function pointLight(parent, x, y, z, dayI, nightI, dist, color = 0xffcf96) {
  const l = new THREE.PointLight(color, 0, dist, 2);
  l.position.set(x, y, z);
  parent.add(l);
  return reglight(l, dayI, nightI);
}

/* ── colliders: chains of {x,z,r} circles, house pattern ── */
function colliderLine(list, x1, z1, x2, z2, r) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(len / r));
  for (let i = 0; i <= n; i++) {
    list.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r });
  }
}
/** a rotated rectangle's four sides, in world space */
function rectCollider(list, cx, cz, w, d, ry, r) {
  const c = Math.cos(ry), s = Math.sin(ry), hx = w / 2, hz = d / 2;
  const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const a = P(-hx, -hz), b = P(hx, -hz), e = P(hx, hz), f = P(-hx, hz);
  colliderLine(list, a[0], a[1], b[0], b[1], r);
  colliderLine(list, b[0], b[1], e[0], e[1], r);
  colliderLine(list, e[0], e[1], f[0], f[1], r);
  colliderLine(list, f[0], f[1], a[0], a[1], r);
}

/* ════════════════════════════════════════════════════════════════════════
   ribbon geometry — the arrival road, the drive spur, the wave canopies
   pts: [{x,y,z}] centreline, halfW metres either side. uv.u across, uv.v along.
   ════════════════════════════════════════════════════════════════════════ */
function ribbon(pts, halfW, vScale = 6) {
  const pos = [], uv = [], idx = [];
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const L = Math.hypot(tx, tz) || 1;
    tx /= L; tz /= L;
    const nx = -tz, nz = tx;
    if (i > 0) run += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    pos.push(p.x + nx * halfW, p.y, p.z + nz * halfW);
    pos.push(p.x - nx * halfW, p.y, p.z - nz * halfW);
    uv.push(0, run / vScale, 1, run / vScale);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   1 · 隐逸居酒廊 — the 280 ㎡ lounge. THE WEDDING DINNER ROOM.
   20 × 14 m, 4.2 m clear, folding glass door-wall on the south (glassZ),
   mahogany slat ceiling, cream marble floor, bar along the north wall.
   Floor is left EMPTY on purpose — moments.js seats 60 in here.
   ════════════════════════════════════════════════════════════════════════ */
function buildLounge(G, root) {
  const L = SITE.LOUNGE;
  const g = new THREE.Group(); g.name = 'lounge'; root.add(g);
  const hx = L.w / 2, hz = L.d / 2;
  const x0 = L.cx - hx, x1 = L.cx + hx;          // 26 … 46
  const z0 = L.cz - hz, z1 = L.glassZ;           // -37 … -23
  const T = .3, PL = .34;                        // wall thickness, plinth height

  /* plinth — pushed south/east only; the atrium owns the ground west of x=26 */
  box(g, L.w + 2.4, PL, L.d + 3.0, L.cx + .5, PL / 2, L.cz + .3, MAT.stone);
  slab(g, L.w - .6, L.d - .6, L.cx, PL + .02, L.cz, MAT.marble);

  /* three solid walls + the two short returns that frame the glass */
  const wallH = L.h;
  const wall = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    const m = box(g, len, wallH, T, (ax + bx) / 2, PL + wallH / 2, (az + bz) / 2, MAT.stuccoWall);
    m.rotation.y = -Math.atan2(bz - az, bx - ax);
    colliderLine(G.colliders, ax, az, bx, bz, .45);
    return m;
  };
  wall(x0, z0, x1, z0);            // north
  wall(x0, z0, x0, z1);            // west
  wall(x1, z0, x1, z1);            // east
  const gw = 14, gx0 = L.cx - gw / 2, gx1 = L.cx + gw / 2;
  wall(x0, z1, gx0, z1);           // south return (west)
  wall(gx1, z1, x1, z1);           // south return (east)

  /* the folding glass door-wall: 8 leaves, two folded open at the west jamb */
  const leaves = 8, lw = gw / leaves, lh = wallH - .35;
  for (let i = 0; i < leaves; i++) {
    const cx = gx0 + lw * (i + .5);
    if (i < 2) {                                    // folded back against the jamb
      const fold = (i === 0 ? 1 : -1) * 1.15;
      inst('glass', UNIT_BOX, MAT.glass,
        mat4(gx0 + .5 + i * .34, PL + lh / 2 + .1, z1 + .55, lw * .9, lh, .07, fold));
      inst('darkI', UNIT_BOX, MAT.dark,
        mat4(gx0 + .5 + i * .34, PL + lh + .16, z1 + .55, lw * .9, .12, .12, fold));
      continue;
    }
    inst('glass', UNIT_BOX, MAT.glass, mat4(cx, PL + lh / 2 + .1, z1, lw - .07, lh, .07));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(gx0 + lw * i, PL + lh / 2 + .1, z1, .09, lh, .13));
  }
  inst('darkI', UNIT_BOX, MAT.dark, mat4(gx1, PL + lh / 2 + .1, z1, .09, lh, .13));
  inst('darkI', UNIT_BOX, MAT.dark, mat4(L.cx, PL + lh + .12, z1, gw, .16, .18));   // head track

  /* clerestory slots high on the north wall (deeper than the wall, so they
     read from inside and out) */
  for (let i = 0; i < 5; i++) {
    inst('glass', UNIT_BOX, MAT.glass,
      mat4(x0 + 2.4 + i * 3.6, PL + wallH - .75, z0, 2.4, .9, .38));
  }

  /* flat roof: deep overhang, copper fascia, dark soffit */
  const OH = 2.0, ry0 = PL + wallH;
  box(g, L.w + OH * 2, .34, L.d + OH * 2, L.cx, ry0 + .35, L.cz, MAT.roof);
  box(g, L.w + OH * 2 + .14, .24, L.d + OH * 2 + .14, L.cx, ry0 + .08, L.cz, MAT.copper);
  box(g, L.w + OH * 2 - .5, .18, L.d + OH * 2 - .5, L.cx, ry0 - .07, L.cz, MAT.dark);

  /* dark mahogany slat ceiling + warm cove strips */
  slab(g, L.w - .8, L.d - .8, L.cx, ry0 - .2, L.cz, MAT.slatCeil).rotation.x = Math.PI;
  for (const [cx, cz, w, d] of [
    [L.cx, z0 + .5, L.w - 1.6, .18], [L.cx, z1 - .5, L.w - 1.6, .18],
    [x0 + .5, L.cz, .18, L.d - 1.6], [x1 - .5, L.cz, .18, L.d - 1.6],
  ]) box(g, w, .1, d, cx, ry0 - .34, cz, MAT.loungeGlow);

  /* bar counter along the north wall + lit back-bar */
  const bx = L.cx, bz = z0 + 1.15;
  box(g, 8.4, 1.05, 1.0, bx, PL + .53, bz, MAT.slat);
  box(g, 8.7, .1, 1.15, bx, PL + 1.1, bz, MAT.marble);
  box(g, 8.4, 2.3, .3, bx, PL + 1.15, z0 + .42, MAT.slat);
  box(g, 7.8, .07, .12, bx, PL + 2.0, z0 + .58, MAT.loungeGlow);
  box(g, 7.8, .07, .12, bx, PL + 1.35, z0 + .58, MAT.loungeGlow);
  colliderLine(G.colliders, bx - 4.2, bz, bx + 4.2, bz, .62);

  /* interior lights */
  pointLight(g, L.cx - 5.5, PL + 3.3, L.cz, 4, 34, 22);
  pointLight(g, L.cx, PL + 3.3, L.cz + 1.5, 4, 30, 22);
  pointLight(g, L.cx + 5.5, PL + 3.3, L.cz, 4, 34, 22);

  /* south terrace: paving down two steps to the lounge-pool deck */
  box(g, L.w + 3, .18, .9, L.cx, PL - .09, z1 + .55, MAT.stone);
  box(g, L.w + 3.6, .16, .9, L.cx, PL - .26, z1 + 1.45, MAT.stone);
  slab(g, L.w + 6, 4.6, L.cx, .06, z1 + 4.2, MAT.paver);

  /* planters flanking the opening + a bougainvillea against each return */
  for (const s of [-1, 1]) {
    inst('stoneI', UNIT_BOX, MAT.stone, mat4(L.cx + s * (gw / 2 + 1.1), PL + .35, z1 + .8, 1.5, .7, 1.5));
    inst('hedgeI', UNIT_BLOB, MAT.hedge, mat4(L.cx + s * (gw / 2 + 1.1), PL + .95, z1 + .8, 1.5, 1.1, 1.5));
    inst('bougain', UNIT_BLOB, MAT.bougain,
      mat4(L.cx + s * (hx - 1.2), PL + 1.1, z1 - .5, 1.9, 2.0, 1.4));
  }

  /* step lights along the terrace edge */
  for (let i = 0; i < 7; i++) {
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(L.cx - 8.4 + i * 2.8, PL - .2, z1 + 1.0, .22, .1, .22));
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   2 · the ten guest villas — 5 Garden Rooms, 3 Garden Pool 2-BR,
   2 two-storey Garden 3-BR. Every part goes through the instance buckets,
   so the whole cluster costs a handful of draw calls.
   ════════════════════════════════════════════════════════════════════════ */
function buildVillas(G, root, rnd) {
  const V = SITE.VILLA;

  for (const [vx, vz, ry, type] of SITE.VILLAS) {
    const c = Math.cos(ry), s = Math.sin(ry);
    /* local (+z = front / deck side) → world */
    const W2 = (lx, lz) => [vx + lx * c + lz * s, vz - lx * s + lz * c];
    /** queue an instanced part in villa-local coordinates */
    const put = (key, geo, mat, lx, y, lz, sx, sy, sz, lry = 0, color = null, rx = 0) => {
      const p = W2(lx, lz);
      inst(key, geo, mat, mat4(p[0], y, p[1], sx, sy, sz, ry + lry, rx), color);
    };
    const collideRect = (lx, lz, w, d, r = .42) => {
      const p = W2(lx, lz);
      rectCollider(G.colliders, p[0], p[1], w, d, ry, r);
    };

    /* seeded variation — nothing in the cluster is a copy-paste of anything */
    const sc = .93 + rnd() * .16;
    const roofTint = new THREE.Color().setHSL(.075 + rnd() * .05, .04 + rnd() * .07, .40 + rnd() * .20);
    const wallTint = new THREE.Color().setHSL(.10, .05 * rnd(), .87 + rnd() * .10);
    const OH = 1.45 + rnd() * .5;
    const jitter = (rnd() - .5) * .35;

    const W = (type === 2 ? V.w2 : type === 1 ? V.w + 1.5 : V.w) * sc;
    const D = (type === 2 ? V.d2 : type === 1 ? V.d + 1 : V.d) * sc;
    const H = (type === 2 ? V.h2 : V.h) + jitter;

    /* ── shared bits ──────────────────────────────────────────────── */
    const roofSlab = (lx, lz, w, d, y) => {
      put('roof', UNIT_BOX, MAT.roof, lx, y + .17, lz, w, .3, d, 0, roofTint);
      put('copper', UNIT_BOX, MAT.copper, lx, y - .04, lz, w + .12, .21, d + .12);
      put('darkI', UNIT_BOX, MAT.dark, lx, y - .19, lz, w - .45, .16, d - .45);
    };
    const glassBay = (lx, y, lz, w, h, d = .1) =>
      put('glass', UNIT_BOX, MAT.glass, lx, y, lz, w, h, d);
    const mullions = (lx, y, lz, w, h, n) => {
      for (let k = 0; k <= n; k++) {
        put('darkI', UNIT_BOX, MAT.dark, lx - w / 2 + k * w / n, y, lz, .09, h, .14);
      }
    };
    const lounger = (lx, lz, flip) => {
      put('whiteI', UNIT_BOX, MAT.white, lx, .42, lz, .78, .18, 2.0);
      put('whiteI', UNIT_BOX, MAT.white, lx, .27, lz, .68, .3, 1.8);
      put('whiteI', UNIT_BOX, MAT.white, lx, .72, lz + flip * .82, .78, .14, .82, 0, null, flip * .55);
    };
    const parasol = (lx, lz) => {
      put('poleI', UNIT_CYL, MAT.dark, lx, 1.35, lz, .07, 2.7, .07);
      put('umbrellaI', UNIT_CONE, MAT.umbrella, lx, 2.62, lz, 3.4, .6, 3.4);
    };
    const stepLight = (lx, lz) =>
      put('glowI', UNIT_BOX, MAT.glowLamp, lx, .16, lz, .18, .12, .18);

    /* plinth under everything */
    put('stoneI', UNIT_BOX, MAT.stone, 0, .11, 0, W + 1.4, .22, D + 1.4);

    if (type === 0) {
      /* ── 花园客房 Garden Room, 98 ㎡, single storey with a soaking-tub
            light well cut clean through the roof plan ────────────────── */
      const lwx = -W * .24, lwz = -D * .16, lhx = 1.75, lhz = 1.55;   // the void
      const RX = W / 2 + OH, RZ = D / 2 + OH;
      /* mass, split around the void */
      const mass = (cx, cz, w, d) =>
        put('stucco', UNIT_BOX, MAT.stucco, cx, H / 2, cz, w, H, d, 0, wallTint);
      mass((-W / 2 + lwx - lhx) / 2, 0, lwx - lhx + W / 2, D);
      mass((lwx + lhx + W / 2) / 2, 0, W / 2 - lwx - lhx, D);
      mass(lwx, (-D / 2 + lwz - lhz) / 2, lhx * 2, lwz - lhz + D / 2);
      mass(lwx, (lwz + lhz + D / 2) / 2, lhx * 2, D / 2 - lwz - lhz);
      /* roof ring around the same void */
      roofSlab((-RX + lwx - lhx) / 2, 0, lwx - lhx + RX, D + OH * 2, H);
      roofSlab((lwx + lhx + RX) / 2, 0, RX - lwx - lhx, D + OH * 2, H);
      roofSlab(lwx, (-RZ + lwz - lhz) / 2, lhx * 2, lwz - lhz + RZ, H);
      roofSlab(lwx, (lwz + lhz + RZ) / 2, lhx * 2, RZ - lwz - lhz, H);
      /* the light well itself: travertine floor, sunken tub, folding doors */
      put('stonePlaneI', UNIT_PLANE, MAT.stone, lwx, .24, lwz, lhx * 2 - .1, 1, lhz * 2 - .1);
      put('stoneI', UNIT_BOX, MAT.stone, lwx - .5, .5, lwz, 1.7, .55, 1.05);
      put('blackI', UNIT_BOX, MAT.blackstone, lwx - .5, .62, lwz, 1.45, .34, .8);
      glassBay(lwx + lhx - .06, 1.35, lwz, .1, 2.3, lhz * 1.6);
      stepLight(lwx + .55, lwz + 1.1);

      /* front glazing + deck */
      const gw = W * .68, gh = H - .5;
      glassBay(W * .06, gh / 2 + .26, D / 2 + .05, gw, gh);
      mullions(W * .06, gh / 2 + .26, D / 2 + .12, gw, gh, 4);
      glassBay(-W * .3, 1.9, -D / 2 - .05, 2.2, 1.4);
      put('slatI', UNIT_BOX, MAT.slat, W * .3, 1.2, -D / 2 - .07, 1.2, 2.4, .14);   // entry door
      put('slatI', UNIT_BOX, MAT.slat, W / 2 + .1, H * .45, D * .08, .16, H * .78, D * .5);
      put('deckI', UNIT_BOX, MAT.deck, 0, .1, D / 2 + 2.5, W * .9, .2, 4.8);
      collideRect(0, 0, W, D);

      /* low white garden wall around the deck, with a gap on the axis */
      const gx = W * .45 + .3, z0 = D / 2 + .2, z1 = D / 2 + 5.0;
      for (const sgn of [-1, 1]) {
        put('stucco', UNIT_BOX, MAT.stucco, sgn * gx, .48, (z0 + z1) / 2, .24, .95, z1 - z0, 0, wallTint);
        put('stucco', UNIT_BOX, MAT.stucco, sgn * (gx / 2 + .55), .48, z1, gx - 1.1, .95, .24, 0, wallTint);
        colliderLine(G.colliders, ...W2(sgn * gx, z0), ...W2(sgn * gx, z1), .35);
      }
      parasol(-W * .2, D / 2 + 2.7);
      lounger(-W * .2 - 1.5, D / 2 + 2.6, 1);
      lounger(-W * .2 + 1.5, D / 2 + 2.6, 1);
      stepLight(gx - .5, z0 + .4); stepLight(-gx + .5, z0 + .4);
      put('bougain', UNIT_BLOB, MAT.bougain, gx - .6, 1.0, z1 - 1.4, 1.0, 1.0, .9);

    } else if (type === 1) {
      /* ── 花园泳池双卧套房 Garden Pool 2-BR, 208 ㎡ — single storey opening
            through a full-width folding door-wall onto a WALLED courtyard
            with an L-shaped plunge basin and a 3-spout black water wall.
            (water.js fills the basin; the masonry is ours) ─────────────── */
      put('stucco', UNIT_BOX, MAT.stucco, 0, H / 2, 0, W, H, D, 0, wallTint);
      roofSlab(0, 0, W + OH * 2, D + OH * 2, H);
      collideRect(0, 0, W, D);

      const gw = W * .82, gh = H - .5;
      glassBay(0, gh / 2 + .26, D / 2 + .05, gw, gh);
      mullions(0, gh / 2 + .26, D / 2 + .12, gw, gh, 6);
      glassBay(-W * .28, 1.9, -D / 2 - .05, 2.4, 1.4);
      put('slatI', UNIT_BOX, MAT.slat, W * .28, 1.2, -D / 2 - .07, 1.2, 2.4, .14);
      put('slatI', UNIT_BOX, MAT.slat, -W / 2 - .1, H * .45, D * .05, .16, H * .78, D * .5);

      /* courtyard: travertine paving, 2.4 m walls on three sides */
      const CW = V.courtW, CD = V.courtD;
      const cz = D / 2 + CD / 2 + .2;
      put('stonePlaneI', UNIT_PLANE, MAT.stone, 0, .12, cz, CW, 1, CD);
      const wallH = 2.45;
      put('stucco', UNIT_BOX, MAT.stucco, 0, wallH / 2, cz + CD / 2, CW + .5, wallH, .28, 0, wallTint);
      for (const sgn of [-1, 1]) {
        put('stucco', UNIT_BOX, MAT.stucco, sgn * CW / 2, wallH / 2, cz, .28, wallH, CD, 0, wallTint);
        colliderLine(G.colliders, ...W2(sgn * CW / 2, cz - CD / 2), ...W2(sgn * CW / 2, cz + CD / 2), .4);
      }
      colliderLine(G.colliders, ...W2(-CW / 2, cz + CD / 2), ...W2(CW / 2, cz + CD / 2), .4);

      /* the black stone water wall + three copper spouts (the p11 hero shot) */
      const wwz = cz + CD / 2 - .35;
      put('blackI', UNIT_BOX, MAT.blackstone, -CW * .12, 1.25, wwz, 5.0, 2.5, .35);
      for (let k = -1; k <= 1; k++) {
        put('copper', UNIT_BOX, MAT.copper, -CW * .12 + k * 1.5, 1.92, wwz - .32, .5, .1, .42);
        put('glowI', UNIT_BOX, MAT.glowLamp, -CW * .12 + k * 1.5, 1.72, wwz - .3, .34, .06, .2);
      }

      /* L-shaped plunge basin — stone curb + dark basin floor standing just
         proud of the travertine, so water.js can lay its surface at ~0.22.
         The long leg runs up to the water wall so the spouts pour into it. */
      const pw = V.poolW, pd = V.poolD, px = -CW * .1;
      const basin = (lx, lz, w, d) => {
        put('stoneI', UNIT_BOX, MAT.stone, lx, .12, lz, w + .8, .3, d + .8);   // curb, top .27
        put('blackI', UNIT_BOX, MAT.blackstone, lx, .02, lz, w, .56, d);       // basin, top .30
      };
      const legZ = cz + CD / 2 - pd / 2 - .4;
      basin(px, legZ, pw, pd);                                          // leg along the wall
      basin(px - pw / 2 + pd / 2, legZ - pd / 2 - 1.7, pd, 3.4);        // the L arm
      /* shallow spa ledge in the corner of the L */
      put('stoneI', UNIT_BOX, MAT.stone, px + pw / 2 - 1.3, .26, legZ, 2.2, .12, pd - .8);

      parasol(CW * .3, cz - CD * .18);
      lounger(CW * .3 - 1.4, cz - CD * .2, 1);
      lounger(CW * .3 + 1.4, cz - CD * .2, 1);
      for (let k = -1; k <= 1; k += 2) stepLight(k * (CW / 2 - .6), cz - CD / 2 + .8);
      put('bougain', UNIT_BLOB, MAT.bougain, -CW / 2 + 1.1, 1.2, cz + CD / 2 - 1.5, 1.1, 1.2, 1.0);
      put('hedgeI', UNIT_BLOB, MAT.hedge, CW / 2 - 1.2, .9, cz + CD / 2 - 1.4, 1.8, 1.5, 1.6);

    } else {
      /* ── 花园三卧套房 Garden 3-BR, 168 ㎡ — TWO storeys, glass-balustrade
            balcony on red-brown timber, double-height living bay ───────── */
      const H1 = 3.8, H2 = H - H1;
      const W1 = W, D1 = D, W3 = W * .84, D3 = D * .78;
      put('stucco', UNIT_BOX, MAT.stucco, 0, H1 / 2, 0, W1, H1, D1, 0, wallTint);
      put('stucco', UNIT_BOX, MAT.stucco, -W * .04, H1 + H2 / 2, -D * .09, W3, H2, D3, 0, wallTint);
      roofSlab(-W * .04, -D * .09, W3 + OH * 2, D3 + OH * 2, H);

      /* double-height living bay + ground glazing */
      const gh = H1 - .5;
      glassBay(-W * .22, gh / 2 + .26, D1 / 2 + .05, W * .42, gh);
      mullions(-W * .22, gh / 2 + .26, D1 / 2 + .12, W * .42, gh, 3);
      const bayH = H1 + 1.7, bayW = W * .3;
      glassBay(W * .28, bayH / 2, D1 / 2 + .05, bayW, bayH);               // the tall bay
      mullions(W * .28, bayH / 2, D1 / 2 + .12, bayW, bayH, 2);
      for (const sgn of [-1, 1]) {                                          // bay side fins
        put('stucco', UNIT_BOX, MAT.stucco, W * .28 + sgn * bayW / 2, H1 + .95, D1 / 2 - .3,
          .26, 1.9, .8, 0, wallTint);
      }
      put('roof', UNIT_BOX, MAT.roof, W * .28, bayH + .16, D1 / 2 - .35, bayW + 1.1, .26, 1.6, 0, roofTint);
      put('copper', UNIT_BOX, MAT.copper, W * .28, bayH - .02, D1 / 2 - .35, bayW + 1.2, .2, 1.7);
      /* corner-glazed master upstairs */
      glassBay(-W * .04, H1 + H2 / 2, -D * .09 + D3 / 2 + .05, W3 * .62, H2 - .7);
      glassBay(-W * .04 - W3 / 2 - .05, H1 + H2 / 2, -D * .09, .1, H2 - .7, D3 * .5);
      put('slatI', UNIT_BOX, MAT.slat, W * .3, 1.2, -D1 / 2 - .07, 1.2, 2.4, .14);

      /* balcony on red-brown timber decking, glass balustrade + copper rail */
      const bz0 = D * .31, bz1 = D * .495;
      const bzc = (bz0 + bz1) / 2, bzd = bz1 - bz0;
      put('deckI', UNIT_BOX, MAT.deck, -W * .12, H1 + .09, bzc, W * .62, .18, bzd);
      for (let k = -1; k <= 1; k++) {
        put('clearI', UNIT_BOX, MAT.clear, -W * .12 + k * W * .2, H1 + .68, bz1, W * .19, .95, .06);
      }
      put('copper', UNIT_BOX, MAT.copper, -W * .12, H1 + 1.19, bz1, W * .62, .07, .12);
      for (const sgn of [-1, 1]) {
        put('clearI', UNIT_BOX, MAT.clear, -W * .12 + sgn * W * .31, H1 + .68, bzc, .06, .95, bzd);
      }

      collideRect(0, 0, W1, D1);
      put('deckI', UNIT_BOX, MAT.deck, 0, .1, D1 / 2 + 2.6, W * .86, .2, 5.0);
      const gx = W * .43 + .3, z0 = D1 / 2 + .2, z1 = D1 / 2 + 5.2;
      for (const sgn of [-1, 1]) {
        put('stucco', UNIT_BOX, MAT.stucco, sgn * gx, .48, (z0 + z1) / 2, .24, .95, z1 - z0, 0, wallTint);
        colliderLine(G.colliders, ...W2(sgn * gx, z0), ...W2(sgn * gx, z1), .35);
      }
      parasol(W * .22, D1 / 2 + 2.8);
      lounger(W * .22 - 1.5, D1 / 2 + 2.7, 1);
      lounger(W * .22 + 1.5, D1 / 2 + 2.7, 1);
      stepLight(-gx + .5, z0 + .5); stepLight(gx - .5, z0 + .5);
      put('bougain', UNIT_BLOB, MAT.bougain, -gx + .8, 1.1, z1 - 1.2, 1.0, 1.1, .9);
      put('hedgeI', UNIT_BLOB, MAT.hedge, gx - .8, .85, z0 + 1.6, 1.6, 1.4, 1.6);
    }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   3 · the circular ceremony lawn — raised turf disc, stone edge band,
   ring path and hedge ring, with a 5 m aisle gap on the south side.
   The middle stays EMPTY (the arch is moments.js, the palms are nature.js).
   ════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════
   THE REST OF THE RESORT — villas that are NOT Carl's.
   On the site map these fill the whole ground between the 隐逸居 enclave and
   the main hotel, and the enclave only reads as small BECAUSE they surround
   it. Pure backdrop: no interiors, no colliders worth walking into, one
   instanced box family. Cheap on purpose — there are ~50 of them and they
   exist to be seen from the air.
   ════════════════════════════════════════════════════════════════════════ */
function buildResortVillas(G, rnd) {
  const V = SITE.VILLA;
  for (const [vx, vz, ry] of SITE.RESORT_VILLAS) {
    const sc = .88 + rnd() * .3;
    const W = V.w * sc, D = V.d * sc, H = V.h + (rnd() - .5) * .5;
    const OH = 1.3 + rnd() * .5;
    const roofTint = new THREE.Color().setHSL(.075 + rnd() * .05, .04 + rnd() * .07, .40 + rnd() * .20);
    const wallTint = new THREE.Color().setHSL(.10, .05 * rnd(), .86 + rnd() * .11);

    /* body + flat overhanging roof — the two shapes that read from 100 m up */
    inst('stucco', UNIT_BOX, MAT.stucco, mat4(vx, H / 2, vz, W, H, D, ry), wallTint);
    inst('roofI', UNIT_BOX, MAT.roof,
      mat4(vx, H + .17, vz, W + OH * 2, .34, D + OH * 2, ry), roofTint);
    /* a glazed front face so the night lights have somewhere to come from */
    inst('glass', UNIT_BOX, MAT.glass,
      mat4(vx + Math.sin(ry) * (D / 2), H * .46, vz + Math.cos(ry) * (D / 2),
        W * .72, H * .62, .1, ry));
    /* private plunge pool + deck, the thing that makes the aerial read right */
    const px = vx - Math.sin(ry) * (D / 2 + 3.4);
    const pz = vz - Math.cos(ry) * (D / 2 + 3.4);
    inst('deckI', UNIT_BOX, MAT.deck, mat4(px, .06, pz, W * .9, .12, 5.4, ry));
    inst('poolI', UNIT_BOX, MAT.villaWater,
      mat4(px, .14, pz, V.poolW * sc * .8, .12, V.poolD * sc * .7, ry));
    if (rnd() < .6) {
      inst('umbI', UNIT_BOX, MAT.umbrella,
        mat4(px + W * .3, 2.1, pz + 1.6, 2.2, .1, 2.2, ry));
    }
    /* one coarse collider so a walker can't stroll through the backdrop */
    rectCollider(G.colliders, vx, vz, W, D, ry, 1.1);
  }
}

function buildLawn(G, root) {
  const L = SITE.LAWN;
  const g = new THREE.Group(); g.name = 'lawn'; root.add(g);
  g.position.set(L.cx, 0, L.cz);

  /* Kept deliberately low: floorY(x,z) is flat 0 across the campus, so any
     rise here is a rise the walker does NOT get. If floorY ever grows a lawn
     term (inside SITE.LAWN.r → +rim) this can go back up to ~0.35. */
  const rim = .18;
  /* raised turf disc */
  const disc = new THREE.Mesh(new THREE.CircleGeometry(L.r, 72), MAT.turf);
  disc.rotation.x = -Math.PI / 2; disc.position.y = rim;
  g.add(disc);
  /* stone rim + coping band */
  const side = new THREE.Mesh(new THREE.CylinderGeometry(L.r + .02, L.r + .02, rim, 72, 1, true), MAT.stone);
  side.position.y = rim / 2; g.add(side);
  const coping = new THREE.Mesh(new THREE.RingGeometry(L.r, L.r + .65, 72), MAT.stone);
  coping.rotation.x = -Math.PI / 2; coping.position.y = rim + .01; g.add(coping);

  /* gravel border, hedge ring and paved ring path — all split by the aisle gap */
  const gapHalf = 2.6 / L.hedgeR;                       // ≈ 5 m opening, at the south
  const start = -Math.PI / 2 + gapHalf, span = Math.PI * 2 - gapHalf * 2;

  const border = new THREE.Mesh(new THREE.RingGeometry(L.r + .65, L.hedgeR - .9, 48, 1, start, span), MAT.stone);
  border.rotation.x = -Math.PI / 2; border.position.y = .05; g.add(border);

  const path = new THREE.Mesh(
    new THREE.RingGeometry(L.hedgeR + .95, L.hedgeR + 3.8, 72, 1, start, span), MAT.paver);
  path.rotation.x = -Math.PI / 2; path.position.y = .04; g.add(path);

  const hedgeGeo = new THREE.TorusGeometry(L.hedgeR, .72, 6, 96, span).rotateX(-Math.PI / 2);
  const hedge = new THREE.Mesh(hedgeGeo, MAT.hedge);
  hedge.rotation.y = start;                              // rotate the gap to the south
  hedge.position.y = .85; hedge.scale.set(1, 1.6, 1);
  g.add(hedge);

  /* the aisle threshold: paving through the gap + two stone piers */
  const tz = L.hedgeR + 1.4;
  box(g, 5.0, .1, 5.6, 0, .06, tz, MAT.stone);
  for (const s of [-1, 1]) {
    box(g, .8, 1.5, .8, s * 3.0, .75, L.hedgeR + .2, MAT.stone);
    box(g, 1.0, .16, 1.0, s * 3.0, 1.56, L.hedgeR + .2, MAT.blackstone);
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(L.cx + s * 3.0, 1.68, L.cz + L.hedgeR + .2, .55, .1, .55));
  }
  /* path lights around the ring */
  for (let i = 0; i < 20; i++) {
    const a = start + span * (i + .5) / 20;
    const r = L.hedgeR + 2.4;
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(L.cx + Math.cos(a) * r, .16, L.cz - Math.sin(a) * r, .2, .12, .2));
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   4 · the event plaza — alternating basalt paver bands and turf strips
   ════════════════════════════════════════════════════════════════════════ */
function buildPlaza(G, root) {
  const P = SITE.PLAZA;
  const w = P.x1 - P.x0, d = P.z1 - P.z0, cz = (P.z0 + P.z1) / 2;
  const bandW = 2.2, gapW = .62, pitch = bandW + gapW;
  const n = Math.floor((w + gapW) / pitch);
  const used = n * pitch - gapW, x0 = P.x0 + (w - used) / 2;

  for (let i = 0; i < n; i++) {
    const cx = x0 + bandW / 2 + i * pitch;
    inst('paverI', UNIT_BOX, MAT.paver, mat4(cx, .04, cz, bandW, .09, d));
    if (i < n - 1) {
      inst('turfStripI', UNIT_BOX, MAT.turfStrip,
        mat4(cx + bandW / 2 + gapW / 2, .03, cz, gapW, .07, d));
      for (let k = 0; k < 3; k++) {                       // in-ground fittings
        inst('inLightI', UNIT_CYL, MAT.inLight,
          mat4(cx + bandW / 2 + gapW / 2, .075, P.z0 + d * (k + .5) / 3, .17, .07, .17));
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════════════════════════════════
   5 · pergola — flat white canopy on square columns, white daybed under it
   ════════════════════════════════════════════════════════════════════════ */
function buildPergola(G, root) {
  const P = SITE.PERGOLA;
  const g = new THREE.Group(); g.name = 'pergola'; root.add(g);
  const hx = P.w / 2, hz = P.d / 2;
  box(g, P.w + .8, .24, P.d + .8, P.cx, P.h + .12, P.cz, MAT.white);
  box(g, P.w + .5, .1, P.d + .5, P.cx, P.h - .04, P.cz, MAT.white);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = P.cx + sx * (hx - .2), z = P.cz + sz * (hz - .2);
    box(g, .24, P.h, .24, x, P.h / 2, z, MAT.white);
    G.colliders.push({ x, z, r: .3 });
  }
  /* daybed */
  box(g, 2.6, .34, 1.75, P.cx, .17, P.cz + .2, MAT.white);
  box(g, 2.5, .22, 1.65, P.cx, .45, P.cz + .2, MAT.white);
  for (const s of [-1, 1]) box(g, .55, .3, .5, P.cx + s * .85, .7, P.cz - .45, MAT.white);
  box(g, 2.6, .1, .34, P.cx, .68, P.cz - .72, MAT.white);
  /* stone base + two uplights */
  slab(g, P.w + 2.2, P.d + 2.2, P.cx, .05, P.cz, MAT.stone);
  for (const s of [-1, 1]) {
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(P.cx + s * (hx - .2), .16, P.cz + hz - .2, .22, .12, .22));
  }
  pointLight(g, P.cx, P.h - .35, P.cz, 0, 14, 11);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   6 · the signage pillar — dark monolith, illuminated "THE WESTIN" / H
   ════════════════════════════════════════════════════════════════════════ */
function buildSign(G, root) {
  const S = SITE.SIGN_PILLAR;
  const g = new THREE.Group(); g.name = 'sign'; root.add(g);
  box(g, 2.0, .18, 1.0, S.x, .09, S.z, MAT.stone);
  box(g, 1.35, 2.75, .46, S.x, 1.4, S.z, MAT.blackstone);
  box(g, 1.45, .1, .56, S.x, 2.8, S.z, MAT.copper);
  /* the lit plate, both faces */
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.05, .52), MAT.sign);
    p.position.set(S.x, 1.62, S.z + s * .245);
    if (s < 0) p.rotation.y = Math.PI;
    g.add(p);
  }
  pointLight(g, S.x, .55, S.z + .9, 0, 9, 7, 0xffd9a6);
  G.colliders.push({ x: S.x, z: S.z, r: .75 });
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   7 · the exterior stair — glass balustrade, up to the suite's 2F balcony
   ════════════════════════════════════════════════════════════════════════ */
function buildExtStair(G, root) {
  const E = SITE.EXT_STAIR;
  const g = new THREE.Group(); g.name = 'extstair'; root.add(g);
  const steps = 19, rise = 3.8 / steps, tread = .3, wide = 1.6;
  const z0 = E.z + (steps * tread) / 2;                  // bottom (south end)

  for (let i = 0; i < steps; i++) {
    const z = z0 - i * tread;
    inst('stoneI', UNIT_BOX, MAT.stone, mat4(E.x, rise * (i + 1) - rise / 2, z, wide, rise, tread));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(E.x, rise * (i + 1) - rise * .12, z - tread * .48, wide - .06, .03, .05));
  }
  /* soffit stringer — the flight climbs toward -z, so the slope is +pitch
     (rotation.x = a sends local +z to (0, -sin a, cos a)) */
  const run = steps * tread, pitch = Math.atan2(3.8, run);
  const soff = box(g, wide + .12, .22, Math.hypot(run, 3.8), E.x, 1.85, E.z - .1, MAT.stucco);
  soff.rotation.x = pitch;
  /* landing at the 2F balcony */
  box(g, 2.1, .24, 2.0, E.x + .4, 3.68, z0 - run - .9, MAT.stone);
  /* glass balustrades + copper handrails, both sides */
  for (const s of [-1, 1]) {
    const b = box(g, .05, 1.0, Math.hypot(run, 3.8), E.x + s * (wide / 2 + .04), 2.42, E.z - .1, MAT.clear);
    b.rotation.x = pitch;
    const h = box(g, .07, .07, Math.hypot(run, 3.8), E.x + s * (wide / 2 + .04), 2.94, E.z - .1, MAT.copper);
    h.rotation.x = pitch;
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(E.x + s * (wide / 2 - .1), .18, z0 + .1, .16, .1, .16));
  }
  colliderLine(G.colliders, E.x - wide / 2 - .2, z0, E.x - wide / 2 - .2, z0 - run, .3);
  colliderLine(G.colliders, E.x + wide / 2 + .2, z0, E.x + wide / 2 + .2, z0 - run, .3);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   8 · the main Westin crescent, ~175 m east — pure silhouette work.
   Arc centre sits r metres WEST of SITE.HOTEL.cx so the concave face (with
   its terraced balconies and lattice exoskeleton) looks back at the campus.
   ════════════════════════════════════════════════════════════════════════ */
function buildHotel(G, root) {
  const H = SITE.HOTEL;
  const g = new THREE.Group(); g.name = 'hotel'; root.add(g);
  const acx = H.cx - H.r, acz = H.cz;                    // arc centre (80, 10)
  g.position.set(acx, 0, acz);

  const HT = H.floors * H.floorH;                        // 25.2 m
  const DEP = 22;                                        // building depth
  const rIn = H.r - DEP / 2, rOut = H.r + DEP / 2;
  const tl = H.arc;

  /* Angle conventions (r180, don't guess): CylinderGeometry's theta starts at
     +Z and sweeps toward +X — dir(θ) = (sinθ, cosθ). RingGeometry's phi starts
     at +X in its own XY plane, and after rotateX(-π/2) maps to (cosφ, -sinφ).
     So φ = θ - π/2. The building must sit at +X of its arc centre (the centre
     is r metres west of SITE.HOTEL.cx), i.e. centred on θ = π/2. */
  const th0 = Math.PI / 2 - tl / 2;                      // cylinder sector start
  const ph0 = -tl / 2;                                   // the same sector, for rings
  const dirX = th => Math.sin(th) * 1, dirZ = th => Math.cos(th) * 1;

  /* concave (campus-facing) wall — leans back as it rises = terraced section */
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn + 6, rIn, HT, 96, 1, true, th0, tl),
    MAT.hotelFacade);
  inner.position.y = HT / 2;
  g.add(inner);

  /* outer wall + roof cap */
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(rOut, rOut, HT, 96, 1, true, th0, tl), MAT.hotelBack);
  outer.position.y = HT / 2; g.add(outer);

  const cap = new THREE.Mesh(new THREE.RingGeometry(rIn + 6, rOut, 96, 1, ph0, tl), MAT.greenRoof);
  cap.rotation.x = -Math.PI / 2; cap.position.y = HT + .05; g.add(cap);
  const capLip = new THREE.Mesh(
    new THREE.CylinderGeometry(rOut + .3, rOut + .3, 1.2, 96, 1, true, th0, tl), MAT.white);
  capLip.position.y = HT - .3; g.add(capLip);

  /* terraced balcony bands on the inner face, one per floor */
  for (let f = 1; f < H.floors; f++) {
    const r = rIn + 6 * (f / H.floors);
    const band = new THREE.Mesh(new THREE.RingGeometry(r - 1.8, r + .2, 96, 1, ph0, tl), MAT.white);
    band.rotation.x = -Math.PI / 2;
    band.position.y = f * H.floorH;
    g.add(band);
  }

  /* podium (in front, campus side) + the two end walls that close the sector */
  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn - 4, rIn - 4, 6.4, 96, 1, true, th0, tl), MAT.hotelPodium);
  pod.position.y = 3.2; g.add(pod);
  const podCap = new THREE.Mesh(new THREE.RingGeometry(rIn - 4, rOut + 4, 96, 1, ph0, tl), MAT.paver);
  podCap.rotation.x = -Math.PI / 2; podCap.position.y = 6.45; g.add(podCap);

  for (const s of [-1, 1]) {
    const th = Math.PI / 2 + s * tl / 2;
    const end = box(g, DEP, HT, 2.0, dirX(th) * H.r, HT / 2, dirZ(th) * H.r, MAT.hotelBack);
    end.rotation.y = th - Math.PI / 2;
  }

  /* blue wave-form entry canopy on the concave face (deck p1) */
  const wave = [], rc = rIn - 5;
  for (let i = 0; i <= 26; i++) {
    const th = Math.PI / 2 - .30 + (i / 26) * .60;
    wave.push({
      x: dirX(th) * rc, y: 9.5 + Math.sin(i / 26 * Math.PI * 3) * 1.9, z: dirZ(th) * rc,
    });
  }
  const canopy = new THREE.Mesh(ribbon(wave, 7, 10), MAT.waveCanopy);
  g.add(canopy);
  for (let i = 2; i < 26; i += 6) {
    box(g, .5, 9.5, .5, wave[i].x, 4.75, wave[i].z, MAT.white);
  }

  /* wave-roofed conference / spa building with green roofs, SW of the crescent */
  const conf = new THREE.Group();
  conf.position.set(H.cx - 30, 0, H.cz + 78);            // world coords — joins root
  root.add(conf);
  box(conf, 46, 9, 26, 0, 4.5, 0, MAT.stuccoWall);
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const x = -23 + (i / 20) * 46;
      pts.push({ x, y: 9.4 + Math.sin(i / 20 * Math.PI * 2 + k) * 1.6, z: -9 + k * 9 });
    }
    conf.add(new THREE.Mesh(ribbon(pts, 4.6, 8), MAT.greenRoof));
  }

  /* coarse collider ring so a walker can't stroll into the crescent */
  for (let i = 0; i <= 26; i++) {
    const th = Math.PI / 2 - tl / 2 + (i / 26) * tl;
    G.colliders.push({ x: acx + dirX(th) * H.r, z: acz + dirZ(th) * H.r, r: 14 });
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   9 · arrival road, parking apron, lamp posts, drive spur to the clubhouse
   ════════════════════════════════════════════════════════════════════════ */
function buildRoad(G, root, rnd) {
  const g = new THREE.Group(); g.name = 'road'; root.add(g);
  const RZ = SITE.ROAD.z;

  /* the main band: a lazy S along the north edge */
  const main = [];
  for (let i = 0; i <= 60; i++) {
    const x = -130 + (i / 60) * 285;
    main.push({ x, y: .04, z: RZ + Math.sin((x + 60) / 78) * 7.5 });
  }
  g.add(new THREE.Mesh(ribbon(main, 4.6, 6), MAT.asphalt));

  /* the spur down to the clubhouse drop-off */
  const spur = [
    { x: 4, y: .05, z: RZ + 3 }, { x: 12, y: .05, z: -80 }, { x: 22, y: .05, z: -68 },
    { x: 32, y: .05, z: -58 }, { x: 39, y: .05, z: -50 }, { x: 40, y: .05, z: -46 },
  ];
  g.add(new THREE.Mesh(ribbon(spur, 3.6, 6), MAT.asphalt));
  const circle = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), MAT.paver);
  circle.rotation.x = -Math.PI / 2; circle.position.set(40, .06, -46); g.add(circle);
  const island = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), MAT.turf);
  island.rotation.x = -Math.PI / 2; island.position.set(40, .16, -46); g.add(island);
  box(g, 5.2, .22, 5.2, 40, .08, -46, MAT.stone);
  inst('hedgeI', UNIT_BLOB, MAT.hedge, mat4(40, .95, -46, 3.2, 1.7, 3.2));

  /* parking apron + parked cars, tucked against the road's campus side
     (east of the drive spur, clear of the lawn) */
  const px = 60, pz = -78;
  slab(g, 44, 9, px, .05, pz, MAT.park);
  const carCol = new THREE.Color();
  const palette = [0x1c1f24, 0xd8d9dc, 0x8d9299, 0x2a3a52, 0x6d1f22, 0xe4e2dc, 0x3c4046];
  for (let i = 0; i < 12; i++) {
    const cx = px - 20 + i * 3.6 + (rnd() - .5) * .25;
    const cz = pz + (rnd() - .5) * .5;
    const ry = (rnd() - .5) * .06;
    carCol.setHex(palette[Math.floor(rnd() * palette.length)]);
    inst('carI', UNIT_BOX, MAT.car, mat4(cx, .62, cz, 1.85, .82, 4.4, ry), carCol.clone());
    inst('carGlassI', UNIT_BOX, MAT.carGlass, mat4(cx, 1.24, cz - .18, 1.62, .62, 2.3, ry));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(cx, .3, cz, 1.95, .5, 4.1, ry));
  }

  /* lamp posts along the north edge of the road */
  for (let i = 0; i <= 16; i++) {
    const x = -120 + i * 16;
    const z = RZ + Math.sin((x + 60) / 78) * 7.5 - 6.4;
    inst('poleI', UNIT_CYL, MAT.dark, mat4(x, 3.1, z, .16, 6.2, .16));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(x, 6.3, z + .45, .3, .18, 1.2));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, 6.16, z + .9, .34, .12, .7));
  }
  /* and a shorter run of bollard lights down the spur */
  for (let i = 1; i < spur.length; i++) {
    const a = spur[i - 1], b = spur[i];
    for (const t of [.33, .78]) {
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x + 4.6, .55, z, .16, 1.1, .16));
      inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x - 4.6, .55, z, .16, 1.1, .16));
    }
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   per-frame: a slow breath on the warm interiors (night only)
   ════════════════════════════════════════════════════════════════════════ */
function tick(dt) {
  clock += (typeof dt === 'number' && dt > 0 ? dt : .016);
  if (!night || !MAT) return;
  const f = 1 + Math.sin(clock * 1.6) * .035 + Math.sin(clock * 3.7 + 1.1) * .02;
  MAT.loungeGlow.emissiveIntensity = 2.3 * f;
  MAT.glass.emissiveIntensity = 1.05 * (1 + Math.sin(clock * .8 + .5) * .04);
  MAT.hotelFacade.emissiveIntensity = 1.35 * (1 + Math.sin(clock * .55) * .05);
  MAT.sign.emissiveIntensity = 1.55 * (1 + Math.sin(clock * 2.3 + .4) * .025);
}

/* ════════════════════════════════════════════════════════════════════════
   public API
   ════════════════════════════════════════════════════════════════════════ */
export function buildCampus(G) {
  BUCKETS.clear();
  NIGHT.tint.length = 0; NIGHT.glow.length = 0; NIGHT.lights.length = 0;
  MAT = makeMaterials();

  const root = new THREE.Group();
  root.name = 'campus';
  const rnd = mulberry32((CFG.SEED ^ 0x5eed) >>> 0);

  buildLounge(G, root);
  buildVillas(G, root, rnd);
  buildResortVillas(G, rnd);
  buildLawn(G, root);
  buildPlaza(G, root);
  buildPergola(G, root);
  buildSign(G, root);
  buildExtStair(G, root);
  buildHotel(G, root);
  buildRoad(G, root, rnd);

  flushBuckets(root);
  G.scene.add(root);
  setCampusNight(false);
  (G.tickers ||= []).push(tick);
  return root;
}

/** Warm interiors + window grids on, path lights on, roofs and facades cool. */
export function setCampusNight(on) {
  night = !!on;
  for (const t of NIGHT.tint) t.mat.color.copy(on ? t.n : t.d);
  for (const e of NIGHT.glow) e.mat.emissiveIntensity = on ? e.n : e.d;
  for (const l of NIGHT.lights) l.light.intensity = on ? l.n : l.d;
  if (MAT) {
    MAT.glass.opacity = on ? .86 : .5;
    MAT.glass.color.setHex(on ? 0x120d07 : 0x25333a);
    MAT.clear.opacity = on ? .3 : .22;
  }
}
