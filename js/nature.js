// nature.js — the living half of the campus: ground, beach, ocean, palms and
// planting. Everything is procedural geometry + CanvasTexture; no external
// assets. Coordinates come from site.js (SITE.*) — nothing here invents its own.
//
// Reference: reference/photos/clubhouse-aerial.jpeg + westin-site-map.jpeg —
// a dense palm canopy over mown lawn, turquoise shallows going deep blue
// offshore with three white breaker lines, clipped hedges and magenta
// bougainvillea packed against every white wall.
//
// ── TWO FRAMES LIVE IN THIS FILE ────────────────────────────────────────────
// world.js turns the 隐逸居 enclave 90° clockwise and slides it south-west, as
// a rigid body under one group carrying SITE.ENCLAVE. Every SITE.* footprint
// that belongs to the enclave (SUITE, DECK, TURF, POOL, CABANAS, LOUNGERS,
// PERGOLA, PLAZA, ATRIUM, LOUNGE, LOUNGE_POOL, LAWN, VILLAS) is therefore
// ENCLAVE-LOCAL and means nothing in world space until it is mapped. Everything
// else here — GROUND, BEACH, OCEAN, PALM_GROVE, ROAD, LAGOON, HOTEL, BOUNDS —
// is already world space and must never move. So:
//
//   GLOBAL, built at scene root, untransformed
//     · ground / apron / lawn plane · beach · shoreline sheen · ocean + surf
//     · the whole palm population (one world-space InstancedMesh set whose
//       matrices the sway ticker rewrites every frame)
//     · scattered shrub clumps, dune scrub, ground-cover beds
//
//   ENCLAVE-LOCAL, built into `nature:enclave` under G.groups.enclave so it
//   inherits the same transform the buildings do
//     · the ceremony lawn's hedge ring · the hedge behind the cabana run
//     · the plaza hedge runs · the lounge terrace screen
//     · every bougainvillea (all four anchors are building walls)
//
//   Two things a group transform does NOT reach, fixed up by hand:
//     · G.colliders is a flat world-space {x,z,r} list — hedge colliders are
//       pushed through enclaveToWorld() at the point of creation.
//     · the keep-out rects (exclusionZones) are tested against world-space
//       candidate points, so the point is mapped BACK with worldToEnclave().
//
// Exports:  buildNature(G)      — builds everything, pushes colliders + a ticker
//           setNatureNight(on)  — instant day/night material swap

import * as THREE from 'three';
import { SITE, siteFloorY, ENCLAVE, enclaveToWorld, worldToEnclave } from './site.js';
import { CFG } from './config.js';
import { mulberry32 } from './materials.js';

/* ═══════════════════════════════════════════════════════════════════════
   tuning — these want to live in CFG one day (see report); keeping them
   local for now because config.js belongs to another module.
   ═══════════════════════════════════════════════════════════════════════ */
const NAT = {
  /* Metres per grass-texture repeat. At 10 m the 700 m lawn tiled 70× and the
     repeat read as a chequerboard grid all the way to the horizon once the fog
     came down — the bigger the tile, the fewer seams to spot. */
  GRASS_TILE: 42,
  SAND_TILE: 9,
  OCEAN_W: SITE.OCEAN.size, // X extent of the water plane
  OCEAN_L: 1600,            // Z extent — long enough that its ends die in fog
  OCEAN_SEG_X: 140,         // ~6.4 m per segment: 6 samples across a 38 m swell
  OCEAN_SEG_Z: 34,          // crests run shore-parallel, so Z needs almost none
  SHORE_TAPER: 26,          // swell amplitude fades over the last N m of shoal
  WAVE: {
    a1: 0.34, k1: (Math.PI * 2) / 38, w1: 0.55,
    a2: 0.13, k2: (Math.PI * 2) / 17, w2: 0.90,
    a3: 0.07, k3: (Math.PI * 2) / 23, w3: 0.45,
  },
  TRUNK_R: 0.35,            // palm collider radius (spec)
  PALM_GAP: 4.2,            // minimum spacing for scattered palms
  HEDGE: { h: 1.45, t: 1.05, seg: 2.1, colR: 0.8, colStep: 0.7 },
  SWAY: 0.026,              // peak frond-sway tilt, radians
  SEEDS: { palm: 0x5ea117, plant: 0x0b06a13, tex: 0x1eaf00 },
};

/* ═══════════════════════════════════════════════════════════════════════
   canvas-texture plumbing
   ═══════════════════════════════════════════════════════════════════════ */
function tex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;   // colour maps only (house rule)
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/* a speck that wraps across the canvas seams, so tiled ground never shows a grid */
function wrapDot(g, x, y, r, w, h) {
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  if (x < r) { g.beginPath(); g.arc(x + w, y, r, 0, 7); g.fill(); }
  if (x > w - r) { g.beginPath(); g.arc(x - w, y, r, 0, 7); g.fill(); }
  if (y < r) { g.beginPath(); g.arc(x, y + h, r, 0, 7); g.fill(); }
  if (y > h - r) { g.beginPath(); g.arc(x, y - h, r, 0, 7); g.fill(); }
}

/* Scale down a material's fog contribution.
   sky.js runs a fairly thick exp2 haze — right for the palm grove, but the sea
   starts 200 m+ from any drone position, so at full strength the turquoise
   drowns in white and the surf line disappears (Carl's note #5). This keeps
   atmospheric perspective on the water, just at `k` of its normal rate. */
function softenFog(mat, k) {
  const s = k.toFixed(3);
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <fog_vertex>',
      `#ifdef USE_FOG\n\tvFogDepth = - mvPosition.z * ${s};\n#endif`,
    );
  };
  mat.customProgramCacheKey = () => `softfog${s}`;   // appended to the real key
  return mat;
}

/* ═══════════════════════════════════════════════════════════════════════
   textures
   ═══════════════════════════════════════════════════════════════════════ */

/* mown resort lawn — rich jade turf with soft mottling.
   NO mower stripes: the aerials show even, deep green turf, and axis-aligned
   bands on a 700 m plane read as a texture bug from the air (Carl's note). */
function grassTex() {
  return tex(512, 512, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 1);
    g.fillStyle = '#3c6530'; g.fillRect(0, 0, w, h);
    /* Broad tonal patches — irregular and non-directional. Keep these FAINT:
       any feature big enough to recognise becomes the thing your eye tracks
       from tile to tile, and the lawn turns into a chequerboard from the air.
       The macro mottle folded into this material in buildGround() supplies the
       large-scale variation instead, at 1× across the whole lawn in world XZ,
       so it cannot repeat. */
    for (let i = 0; i < 54; i++) {
      const t = rnd();
      g.fillStyle = t < .45
        ? `rgba(${68 + rnd() * 24 | 0},${104 + rnd() * 26 | 0},${46 + rnd() * 18 | 0},.12)`
        : `rgba(${34 + rnd() * 16 | 0},${64 + rnd() * 20 | 0},${32 + rnd() * 14 | 0},.13)`;
      wrapDot(g, rnd() * w, rnd() * h, 20 + rnd() * 78, w, h);
    }
    /* blade speckle — weighted dark so the turf reads deep, not pale */
    for (let i = 0; i < 5600; i++) {
      const l = rnd();
      g.fillStyle = l < .22
        ? `rgba(${92 + rnd() * 40 | 0},${132 + rnd() * 40 | 0},${58 + rnd() * 24 | 0},.46)`
        : l < .64
          ? `rgba(${48 + rnd() * 24 | 0},${82 + rnd() * 24 | 0},${38 + rnd() * 16 | 0},.52)`
          : `rgba(${26 + rnd() * 16 | 0},${52 + rnd() * 18 | 0},${24 + rnd() * 12 | 0},.48)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2.4, 2 + rnd() * 4.5);
    }
  }, [1, 1]);
}

/* one big low-frequency overlay so 60 grass repeats never read as a grid */
function macroTex() {
  return tex(512, 512, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 2);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 130; i++) {
      const x = rnd() * w, y = rnd() * h, r = 18 + rnd() * 90;
      const dark = rnd() < .68;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, dark ? 'rgba(16,38,20,.34)' : 'rgba(150,190,112,.15)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
  });
}

/* Haitang Bay sand — pale warm gold, shell speckle, wind ripples */
function sandTex() {
  return tex(512, 512, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 3);
    g.fillStyle = '#e3d3ad'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = rnd() < .5 ? 'rgba(214,196,158,.5)' : 'rgba(246,238,214,.45)';
      wrapDot(g, rnd() * w, rnd() * h, 30 + rnd() * 80, w, h);
    }
    g.strokeStyle = 'rgba(196,176,138,.28)'; g.lineWidth = 1.6;
    for (let i = 0; i < 26; i++) {           // ripple lines, roughly shore-parallel
      const y = rnd() * h;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * .04 + i) * 4);
      g.stroke();
    }
    for (let i = 0; i < 2600; i++) {
      const l = rnd();
      g.fillStyle = l < .5 ? 'rgba(255,252,240,.5)'
        : l < .85 ? 'rgba(180,160,124,.45)' : 'rgba(126,110,86,.35)';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.8, 1 + rnd() * 1.8);
    }
  }, [1, 1]);
}

/* wet-sand sheen strip laid along the waterline (one-shot gradient across u) */
function wetSandTex() {
  return tex(128, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(92,80,58,0)');
    grad.addColorStop(.34, 'rgba(96,84,60,.62)');
    grad.addColorStop(.66, 'rgba(112,98,72,.5)');
    grad.addColorStop(1, 'rgba(150,132,100,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

/* the sea colour ramp: deep sapphire offshore → aqua → pale turquoise shallows.
   u runs west→east across the plane, so this is a pure distance-from-shore ramp. */
function waterGradTex(night) {
  return tex(512, 32, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    if (night) {
      grad.addColorStop(0.00, '#050b1c');
      grad.addColorStop(0.42, '#08172e');
      grad.addColorStop(0.72, '#0d2b45');
      grad.addColorStop(0.90, '#13415c');
      grad.addColorStop(1.00, '#1b5b73');
    } else {
      /* Haitang Bay in Carl's aerial: sapphire at the horizon running through
         a broad vivid teal to a bright turquoise shoal. Pushed deliberately
         saturated — the scene's exp2 fog eats ~half of it at aerial range. */
      grad.addColorStop(0.00, '#0a3a7a');   // horizon-deep sapphire
      grad.addColorStop(0.26, '#0a5ba4');
      grad.addColorStop(0.50, '#0490bc');
      grad.addColorStop(0.72, '#04bfca');   // the vivid aerial turquoise
      grad.addColorStop(0.88, '#2adfd3');
      grad.addColorStop(0.97, '#78ecdd');
      grad.addColorStop(1.00, '#a8f2e4');   // shallow wash over pale sand
    }
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    /* faint banding so the ramp isn't mathematically smooth */
    const rnd = mulberry32(NAT.SEEDS.tex + 4);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${.012 + rnd() * .03})`;
      g.fillRect(rnd() * w, 0, 2 + rnd() * 26, h);
    }
  });
}

/* seamless ripple normal map — integer harmonics so it tiles exactly.
   NO colorSpace: normal maps must stay linear (r180). */
function waterNormalTex() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S), d = img.data;
  const K = n => (Math.PI * 2 * n) / S;
  const k3 = K(3), k5 = K(5), k8 = K(8), k9 = K(9), k13 = K(13);
  const H = (x, y) =>
    0.52 * Math.sin(x * k8 + y * k3) +
    0.30 * Math.sin(x * k3 - y * k9 + 1.7) +
    0.18 * Math.sin((x + y) * k13 + 2.9) +
    0.12 * Math.sin(x * k5 - y * k5 + 0.6);
  const STR = 1.35;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = H(x + 1, y) - H(x - 1, y);
      const dy = H(x, y + 1) - H(x, y - 1);
      const nx = -dx * STR, ny = -dy * STR, nz = 1;
      const l = Math.hypot(nx, ny, nz), i = (y * S + x) * 4;
      d[i]     = (nx / l * .5 + .5) * 255;
      d[i + 1] = (ny / l * .5 + .5) * 255;
      d[i + 2] = (nz / l * .5 + .5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 60);
  t.anisotropy = 4;
  return t;
}

/* surf foam: alpha streaks. u = across the band, v = along the shore. */
function foamTex(seed, softness) {
  return tex(256, 512, (g, w, h) => {
    const rnd = mulberry32(seed);
    g.clearRect(0, 0, w, h);
    /* the band body — soft at both edges */
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(.34, `rgba(255,255,255,${.5 * softness})`);
    grad.addColorStop(.58, `rgba(255,255,255,${.85 * softness})`);
    grad.addColorStop(.82, `rgba(240,252,255,${.4 * softness})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    /* punch holes + add crests so it reads as broken foam, not a painted stripe */
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 240; i++) {
      g.fillStyle = `rgba(0,0,0,${.25 + rnd() * .7})`;
      wrapDot(g, rnd() * w, rnd() * h, 4 + rnd() * 26, w, h);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 200; i++) {
      g.fillStyle = `rgba(255,255,255,${.2 + rnd() * .6})`;
      const y = rnd() * h, x = w * (.3 + rnd() * .5);
      g.fillRect(x, y, 3 + rnd() * 16, 1 + rnd() * 3);
    }
    for (let i = 0; i < 320; i++) {
      g.fillStyle = `rgba(255,255,255,${.3 + rnd() * .6})`;
      wrapDot(g, rnd() * w, rnd() * h, .8 + rnd() * 2.6, w, h);
    }
  });
}

/* coconut-palm trunk: stacked leaf-scar rings, grey-brown, lichen mottle.
   Rings are the read that says "coconut palm" rather than "pole", so they are
   deliberately high-contrast — at 16 repeats over an 11 m trunk that lands at
   roughly the real 25 cm scar pitch. */
function barkTex() {
  return tex(128, 512, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 5);
    g.fillStyle = '#8b7a63'; g.fillRect(0, 0, w, h);
    const rings = 22, s = h / rings;
    for (let i = 0; i < rings; i++) {
      const y = i * s;
      g.fillStyle = `rgba(${104 + rnd() * 36 | 0},${92 + rnd() * 30 | 0},${72 + rnd() * 24 | 0},.9)`;
      g.fillRect(0, y, w, s * .76);
      g.fillStyle = 'rgba(38,30,22,.62)';                // scar groove — deeper
      g.fillRect(0, y + s * .76, w, s * .24);
      g.fillStyle = 'rgba(240,232,212,.2)';              // sun-bleached top edge
      g.fillRect(0, y, w, 2.2);
      /* a couple of curved scar chevrons per ring — breaks the barcode look */
      g.strokeStyle = 'rgba(52,42,30,.3)'; g.lineWidth = 1.3;
      for (let k = 0; k < 3; k++) {
        const x0 = rnd() * w, yy = y + s * (.2 + rnd() * .45);
        g.beginPath(); g.moveTo(x0, yy);
        g.quadraticCurveTo(x0 + 14, yy + 2.4, x0 + 30, yy);
        g.stroke();
      }
    }
    for (let i = 0; i < 620; i++) {                       // fibre + lichen
      const l = rnd();
      g.fillStyle = l < .5 ? 'rgba(52,42,30,.34)'
        : l < .8 ? 'rgba(214,206,184,.18)' : 'rgba(118,132,96,.2)';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 5);
    }
  }, [1.2, 16]);
}

/* Frond atlas. Texture v 0.15→1 is the frond (leaflet comb, alpha-cut);
   v 0→0.10 is a solid coconut-brown patch the nut geometry samples, so the
   whole crown stays ONE material / ONE draw call per variant. */
function frondTex() {
  return tex(512, 512, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 6);
    g.clearRect(0, 0, w, h);
    const fh = h * .85;            // frond band occupies canvas rows 0..fh
    const mid = fh * .5;
    /* leaflets — a DENSE comb either side of the rachis, angled toward the tip.
       Two passes: a dark under-comb first, then a slightly offset upper comb,
       so the alpha-tested blade reads as solid dark green foliage rather than
       the stringy willow it was at 5 px pitch. */
    for (let pass = 0; pass < 2; pass++) {
      const x0 = pass ? 5.6 : 3;
      for (let x = x0; x < w - 6; x += 3.4) {
        const s = x / w;
        const reach = Math.sin(Math.PI * Math.pow(s, .58)) * mid * 1.06;
        for (const side of [-1, 1]) {
          const len = reach * (pass ? .82 + rnd() * .3 : .96 + rnd() * .1);
          const lean = 12 + rnd() * 20;            // sweep toward the tip
          const tone = rnd();
          g.strokeStyle = pass === 0
            ? `rgba(${20 + rnd() * 16 | 0},${52 + rnd() * 20 | 0},${22 + rnd() * 12 | 0},.98)`
            : tone < .5
              ? `rgba(${32 + rnd() * 18 | 0},${76 + rnd() * 22 | 0},${30 + rnd() * 14 | 0},.98)`
              : tone < .86
                ? `rgba(${46 + rnd() * 20 | 0},${96 + rnd() * 24 | 0},${38 + rnd() * 14 | 0},.97)`
                : `rgba(${84 + rnd() * 30 | 0},${128 + rnd() * 28 | 0},${50 + rnd() * 18 | 0},.95)`;
          g.lineWidth = pass ? 2.6 + rnd() * 1.6 : 3.4 + rnd() * 1.8;
          g.beginPath();
          g.moveTo(x, mid);
          g.quadraticCurveTo(x + lean * .5, mid + side * len * .55,
                             x + lean, mid + side * len);
          g.stroke();
        }
      }
    }
    /* rachis */
    g.strokeStyle = 'rgba(96,106,52,.98)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(w * .99, mid); g.stroke();
    g.strokeStyle = 'rgba(168,178,110,.55)'; g.lineWidth = 1.8;
    g.beginPath(); g.moveTo(0, mid - 2); g.lineTo(w * .99, mid - 2); g.stroke();
    /* coconut patch (bottom rows → texture v ≈ 0.05) */
    g.fillStyle = '#6a4a2c'; g.fillRect(0, h * .88, w, h * .12);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = rnd() < .5 ? 'rgba(42,28,16,.5)' : 'rgba(148,116,78,.45)';
      g.fillRect(rnd() * w, h * .88 + rnd() * h * .12, 2 + rnd() * 6, 1 + rnd() * 3);
    }
  });
}

/* clipped hedge / topiary: dense tight foliage */
function hedgeTex() {
  return tex(256, 256, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 7);
    g.fillStyle = '#24401f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const l = rnd();
      g.fillStyle = l < .3
        ? `rgba(${64 + rnd() * 30 | 0},${106 + rnd() * 30 | 0},${48 + rnd() * 20 | 0},.9)`
        : l < .72
          ? `rgba(${40 + rnd() * 20 | 0},${74 + rnd() * 22 | 0},${34 + rnd() * 14 | 0},.9)`
          : `rgba(${20 + rnd() * 14 | 0},${42 + rnd() * 16 | 0},${20 + rnd() * 10 | 0},.85)`;
      const x = rnd() * w, y = rnd() * h, r = 1.6 + rnd() * 3.4;
      wrapDot(g, x, y, r, w, h);
    }
  }, [2, 1]);
}

/* looser tropical shrub leaves — bigger blades, jade/olive spread */
function shrubTex() {
  return tex(256, 256, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 8);
    g.fillStyle = '#2c4a26'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const l = rnd();
      g.fillStyle = l < .34
        ? `rgba(${78 + rnd() * 34 | 0},${124 + rnd() * 34 | 0},${54 + rnd() * 22 | 0},.9)`
        : l < .74
          ? `rgba(${46 + rnd() * 22 | 0},${84 + rnd() * 26 | 0},${38 + rnd() * 16 | 0},.9)`
          : `rgba(${24 + rnd() * 16 | 0},${50 + rnd() * 18 | 0},${26 + rnd() * 12 | 0},.88)`;
      const x = rnd() * w, y = rnd() * h, a = rnd() * 7;
      g.save(); g.translate(x, y); g.rotate(a);
      g.beginPath(); g.ellipse(0, 0, 3 + rnd() * 9, 1.6 + rnd() * 3.4, 0, 0, 7); g.fill();
      g.restore();
    }
  }, [2, 2]);
}

/* Bougainvillea — an ACCENT, not a colour field. In the aerials it is a
   scatter of small rose patches half-lost in dark leaf, so this texture is
   mostly foliage with deep-rose bracts through it, and nothing near the
   fluorescent magenta the first pass used. */
function bougTex() {
  return tex(256, 256, (g, w, h) => {
    const rnd = mulberry32(NAT.SEEDS.tex + 9);
    g.fillStyle = '#22381f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {          // dark leaf body — now dominant
      g.fillStyle = `rgba(${22 + rnd() * 22 | 0},${48 + rnd() * 26 | 0},${24 + rnd() * 16 | 0},.92)`;
      wrapDot(g, rnd() * w, rnd() * h, 2 + rnd() * 7, w, h);
    }
    for (let i = 0; i < 620; i++) {          // bracts — deep rose / carmine
      const l = rnd();
      g.fillStyle = l < .46
        ? `rgba(${162 + rnd() * 26 | 0},${34 + rnd() * 24 | 0},${78 + rnd() * 26 | 0},.94)`
        : l < .82
          ? `rgba(${186 + rnd() * 24 | 0},${58 + rnd() * 28 | 0},${100 + rnd() * 26 | 0},.9)`
          : `rgba(${122 + rnd() * 26 | 0},${24 + rnd() * 18 | 0},${58 + rnd() * 22 | 0},.92)`;
      const x = rnd() * w, y = rnd() * h;
      g.save(); g.translate(x, y); g.rotate(rnd() * 7);
      g.beginPath(); g.ellipse(0, 0, 1.8 + rnd() * 3.2, 1.4 + rnd() * 2.2, 0, 0, 7); g.fill();
      g.restore();
    }
    for (let i = 0; i < 90; i++) {           // sparse cream flower centres
      g.fillStyle = `rgba(248,236,206,${.18 + rnd() * .3})`;
      wrapDot(g, rnd() * w, rnd() * h, .6 + rnd() * 1.1, w, h);
    }
    for (let i = 0; i < 240; i++) {          // shadow pockets — keeps it deep
      g.fillStyle = `rgba(10,20,12,${.2 + rnd() * .3})`;
      wrapDot(g, rnd() * w, rnd() * h, 1.6 + rnd() * 5, w, h);
    }
  }, [2, 2]);
}

/* ═══════════════════════════════════════════════════════════════════════
   module state
   ═══════════════════════════════════════════════════════════════════════ */
let built = false;
let night = false;
let root = null;              // THREE.Group holding everything GLOBAL nature owns
let encRoot = null;           // THREE.Group under G.groups.enclave — enclave planting
const MAT = {};               // named materials, for the night swap
/* live uniform objects for the grass macro-mottle (see buildGround) — shared by
   reference with the compiled program, so setNatureNight can retune them
   without touching the material or forcing a recompile */
const macroU = {
  macroAmt: { value: .5 },
  macroTint: { value: new THREE.Color(0xffffff) },
};
const anim = {                // per-frame handles
  ocean: null, surf: [], palms: [], palmMeshes: [], water: null,
};

/* day → night colour/response table. `c` multiplies the map, so a white day
   colour keeps the texture honest and the night colour tints it moonlit. */
const NIGHT_TABLE = {
  apron:   { day: { c: 0x4e6238, r: 1 },   night: { c: 0x1b2430, r: 1 } },
  grass:   { day: { c: 0xffffff, r: .95 }, night: { c: 0x4a6076, r: .98 } },
  /* not a material any more — read straight by setNatureNight into the
     macroAmt / macroTint uniforms folded into MAT.grass */
  macro:   { day: { c: 0xffffff, o: .5 },  night: { c: 0x54687e, o: .34 } },
  sand:    { day: { c: 0xffffff, r: .96 }, night: { c: 0x6d7c92, r: .97 } },
  wet:     { day: { c: 0xffffff, o: .55 }, night: { c: 0x8fa3bd, o: .4 } },
  bark:    { day: { c: 0xffffff, r: .88 }, night: { c: 0x53637a, r: .9 } },
  frond:   { day: { c: 0xffffff, r: .82 }, night: { c: 0x4d6580, r: .88 } },
  hedge:   { day: { c: 0xffffff, r: .92 }, night: { c: 0x415a72, r: .95 } },
  shrub:   { day: { c: 0xffffff, r: .9 },  night: { c: 0x445c74, r: .94 } },
  boug:    { day: { c: 0xffffff, r: .86 }, night: { c: 0x6b5878, r: .9 } },
  cover:   { day: { c: 0xffffff, r: .95 }, night: { c: 0x3e5468, r: .97 } },
  foam:    { day: { c: 0xffffff, o: .85 }, night: { c: 0xa9c2dd, o: .55 } },
};

function applyNightTo(key, mat, on) {
  const row = NIGHT_TABLE[key]; if (!row || !mat) return;
  const v = on ? row.night : row.day;
  if (v.c !== undefined) mat.color.setHex(v.c);
  if (v.r !== undefined) mat.roughness = v.r;
  if (v.o !== undefined) mat.opacity = v.o;
  /* deliberately NO needsUpdate: colour/roughness/opacity are uniforms, and
     world.js flips night on every moment switch — a recompile of eleven
     materials per switch would be a visible hitch. */
}

/* ═══════════════════════════════════════════════════════════════════════
   site helpers
   ═══════════════════════════════════════════════════════════════════════ */

/* where the sand meets the sea — solved from siteFloorY so it survives any
   future change to the beach slope. */
function shorelineX() {
  let lo = SITE.BEACH.x0, hi = SITE.BEACH.x1;      // f(lo) < oceanY < f(hi)
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) * .5;
    if (siteFloorY(m, 0) < SITE.OCEAN.y) lo = m; else hi = m;
  }
  return (lo + hi) * .5;
}

/* Everything a plant must not grow through, SPLIT BY FRAME. Rects are
   axis-aligned in the frame they are authored in (villa rotations are all
   < 0.15 rad, so the bounding rect is close enough).

   `local` — the 隐逸居 enclave's own footprints, exactly as site.js writes
     them: the frame the six builder modules were written against. world.js
     turns that whole body 90° clockwise and slides it south-west, so these
     rects address ground the enclave has LEFT until they are mapped.
   `world` — the arrival road, the lagoon and the hotel crescent. Backdrop,
     already world space, must never be transformed (see the ENCLAVE block in
     site.js for the full list of what is and isn't rigid-body).

   Which side of the split a footprint lands on is decided ONLY by whether
   world.js re-parents its builder under the enclave group — not by where it
   happens to sit on the map. */
function exclusionZones() {
  const S = SITE;
  const local = { rects: [], discs: [] }, world = { rects: [], discs: [] };
  const rect = (t, cx, cz, w, d) => t.rects.push({ cx, cz, hw: w * .5, hd: d * .5 });

  /* ── ENCLAVE-LOCAL ── */
  rect(local, S.SUITE.cx, S.SUITE.cz, S.SUITE.w + S.SUITE.roofOverhang * 2, S.SUITE.d + S.SUITE.roofOverhang * 2);
  rect(local, S.SUITE.pantry.cx, S.SUITE.pantry.cz, S.SUITE.pantry.w, S.SUITE.pantry.d);
  rect(local, S.SUITE.spa.cx, S.SUITE.spa.cz, S.SUITE.spa.w, S.SUITE.spa.d);
  rect(local, S.DECK.cx, (S.DECK.z0 + S.DECK.z1) * .5, S.DECK.w, S.DECK.z1 - S.DECK.z0);
  rect(local, S.DECK.cx, (S.TURF.z0 + S.TURF.z1) * .5, S.DECK.w, S.TURF.z1 - S.TURF.z0);
  rect(local, S.POOL.cx, S.POOL.cz, S.POOL.w + 3, S.POOL.d + 3);
  /* the pavilion + lounger runs now go along Z on the pool's east long side
     ({x, z0, z1}, not {x0, x1, z}) — reading the old keys here yielded NaN
     rects, which silently disable the keep-out and let palms grow through the
     furniture */
  rect(local, S.CABANAS.x, (S.CABANAS.z0 + S.CABANAS.z1) * .5, 6, S.CABANAS.z1 - S.CABANAS.z0 + 2);
  rect(local, S.LOUNGERS.x, (S.LOUNGERS.z0 + S.LOUNGERS.z1) * .5, 6, S.LOUNGERS.z1 - S.LOUNGERS.z0 + 2);
  rect(local, S.PERGOLA.cx, S.PERGOLA.cz, S.PERGOLA.w + 1, S.PERGOLA.d + 1);
  rect(local, (S.PLAZA.x0 + S.PLAZA.x1) * .5, (S.PLAZA.z0 + S.PLAZA.z1) * .5,
       S.PLAZA.x1 - S.PLAZA.x0, S.PLAZA.z1 - S.PLAZA.z0);
  /* the atrium is a two-storey courtyard building and was never in this list —
     the palms had no business standing in it even before the move */
  rect(local, S.ATRIUM.cx, S.ATRIUM.cz, S.ATRIUM.w + 2, S.ATRIUM.d + 2);
  rect(local, S.LOUNGE.cx, S.LOUNGE.cz, S.LOUNGE.w + 2, S.LOUNGE.d + 2);
  rect(local, S.LOUNGE_POOL.cx, S.LOUNGE_POOL.cz, S.LOUNGE_POOL.w + 3, S.LOUNGE_POOL.d + 3);
  for (const [vx, vz] of S.VILLAS) rect(local, vx, vz, S.VILLA.w + 7, S.VILLA.d + 8);
  local.discs.push({ cx: S.LAWN.cx, cz: S.LAWN.cz, r: S.LAWN.hedgeR + 1.5 });

  /* ── WORLD ── */
  rect(world, 0, S.ROAD.z, 500, 14);
  world.discs.push({ cx: S.LAGOON.cx, cz: S.LAGOON.cz, r: Math.max(S.LAGOON.rx, S.LAGOON.rz) + 4 });
  world.discs.push({ cx: S.HOTEL.cx, cz: S.HOTEL.cz, r: S.HOTEL.r + 8 });

  return { local, world };
}

function hitsZone(set, x, z, m) {
  for (const r of set.rects) {
    if (Math.abs(x - r.cx) < r.hw + m && Math.abs(z - r.cz) < r.hd + m) return true;
  }
  for (const d of set.discs) {
    const dx = x - d.cx, dz = z - d.cz;
    if (dx * dx + dz * dz < (d.r + m) * (d.r + m)) return true;
  }
  return false;
}

/* (x, z) are always WORLD coordinates — every caller scatters over world space
   (the grove band, SITE.BOUNDS, the beach).

   The enclave rects are tested by pushing the CANDIDATE POINT back into
   enclave-local space rather than by transforming the rects. A rotated rect is
   no longer axis-aligned, so transforming it means either swapping w/d (exact,
   but only for a rotation that is a multiple of 90°) or growing it to an AABB
   (safe but sloppy). Mapping the point is exact for ANY rotation and cannot
   silently degrade if ENCLAVE.rotY is ever changed to something that is not a
   right angle. The margin `m` needs no adjustment: enclaveToWorld is a rigid
   motion — rotation plus translation, no scale — so distances are preserved. */
function makeBlocked(zones) {
  return (x, z, m = 0) => {
    if (hitsZone(zones.world, x, z, m)) return true;
    const l = worldToEnclave(x, z);
    return hitsZone(zones.local, l.x, l.z, m);
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   ground + beach
   ═══════════════════════════════════════════════════════════════════════ */
function buildGround() {
  const N = SITE.GROUND.size;

  /* a hazy apron far below the datum, so the lawn's edge and the ocean's
     never show as a cut line from fly mode. Sits under the water line, so
     the sea covers the half of it that runs offshore. */
  MAT.apron = new THREE.MeshStandardMaterial({ color: 0x4e6238, roughness: 1, metalness: 0 });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), MAT.apron);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(SITE.BEACH.x1 + 900, -0.95, 0);
  root.add(apron);

  /* lawn — starts where the sand stops (siteFloorY is flat 0 from here east) */
  const gcx = SITE.BEACH.x1 + N / 2;
  const gt = grassTex();
  gt.repeat.set(N / NAT.GRASS_TILE, N / NAT.GRASS_TILE);
  MAT.grass = new THREE.MeshStandardMaterial({
    map: gt, roughness: .95, metalness: 0,
    /* The lawn is one 700 m sheet that runs UNDER every building on the campus,
       and several of those floors sit exactly on the datum: the suite's marble
       slab tops out at y = 0, the "THE WESTIN" turf band is at y = 0. Coplanar
       geometry z-fights, and a horizontal plane z-fights worst at exactly the
       grazing angles you get standing on it — which is the other half of why
       the great-room floor read green at night. A positive polygonOffset pushes
       the lawn AWAY from the camera in depth, so anything sharing its plane
       wins cleanly. (MAT.sand does the same thing at the beach seam.) */
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  /* ── the macro mottle ──────────────────────────────────────────────────
     One low-frequency overlay at 1× across the whole 700 m ground, so the ~17
     grass repeats never read as a chequerboard from the air.

     It used to be a SECOND 700 × 700 plane at y = .012 with
     `transparent: true, opacity: .5, depthWrite: false` and polygonOffset −2.
     Three problems, all the same problem: a transparent object is queued in the
     transparent pass, which runs after ALL opaque geometry no matter what its
     renderOrder says; it sat ABOVE the datum while the suite's marble floor
     tops out at y = 0 and the pool's basalt pavers at y = −.004; and the
     negative polygonOffset pulled it toward the camera so it won the depth test
     even at grazing angles. Net effect: a half-opacity dark-green wash painted
     over the marble and the deck, which at night read as green floor.

     So the mottle is folded INTO the grass material instead. No second plane,
     no transparency, no depth fight — it is now literally part of the lawn
     surface and cannot cover anything standing on it. Sampled by world XZ
     (not by uv) so it stays independent of the mesh's own uv transform, and
     mixed into diffuseColor exactly as the alpha blend used to: the texture's
     alpha is the blend factor, `macroAmt` is the old material opacity and
     `macroTint` the old material colour, both still driven by NIGHT_TABLE. */
  const mt = macroTex();
  mt.wrapS = mt.wrapT = THREE.RepeatWrapping;
  MAT.grass.userData.macro = mt;
  const macroFrame = {
    macroMap: { value: mt },
    macroOrigin: { value: new THREE.Vector2(gcx - N / 2, -N / 2) },
    macroScale: { value: 1 / N },
    ...macroU,
  };
  MAT.grass.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, macroFrame);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMacroPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\n\tvMacroPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 vMacroPos;\nuniform sampler2D macroMap;'
        + '\nuniform vec2 macroOrigin;\nuniform float macroScale;'
        + '\nuniform float macroAmt;\nuniform vec3 macroTint;')
      .replace('#include <map_fragment>',
        '#include <map_fragment>\n\t{\n'
        + '\t\tvec4 macroTexel = texture2D( macroMap, ( vMacroPos.xz - macroOrigin ) * macroScale );\n'
        + '\t\tdiffuseColor.rgb = mix( diffuseColor.rgb, macroTexel.rgb * macroTint, macroTexel.a * macroAmt );\n'
        + '\t}');
  };
  /* appended to the real program key — keeps this one variant out of the cache
     slot every other MeshStandardMaterial in the campus shares */
  MAT.grass.customProgramCacheKey = () => 'grassmacro1';

  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(N, N), MAT.grass);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(gcx, 0, 0);
  lawn.receiveShadow = true;
  root.add(lawn);

  /* beach — its own sloped sheet, heights read straight off siteFloorY */
  const bx0 = SITE.BEACH.x0 - 22, bx1 = SITE.BEACH.x1 + .4;
  const bw = bx1 - bx0, bl = N;
  const bgeo = new THREE.PlaneGeometry(bw, bl, 56, 44);
  const bp = bgeo.attributes.position;
  const rnd = mulberry32(NAT.SEEDS.tex + 11);
  const bcx = (bx0 + bx1) * .5;
  for (let i = 0; i < bp.count; i++) {
    const wx = bp.getX(i) + bcx, wz = -bp.getY(i);
    /* dune noise fades out over the last 6 m so the sand meets the lawn dead
       flat at the datum — the overlap strip is settled by polygonOffset below */
    const seam = Math.max(0, Math.min(1, (SITE.BEACH.x1 - wx) / 6));
    bp.setZ(i, siteFloorY(wx, wz) + (rnd() - .5) * .07 * seam);
  }
  bgeo.computeVertexNormals();
  const st = sandTex();
  st.repeat.set(bw / NAT.SAND_TILE, bl / NAT.SAND_TILE);
  MAT.sand = new THREE.MeshStandardMaterial({
    map: st, roughness: .96, metalness: 0,
    /* pushed back FURTHER than the lawn (which is now on 1/1 — see MAT.grass),
       so the 0.4 m strip where the two sheets overlap still resolves to grass.
       These two numbers are a pair: raise the lawn's and this one follows, or
       the seam starts flickering. */
    polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2,
  });
  const beach = new THREE.Mesh(bgeo, MAT.sand);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(bcx, 0, 0);
  beach.receiveShadow = true;
  root.add(beach);

  /* wet-sand sheen hugging the waterline */
  const sx = shorelineX();
  const wt = wetSandTex();
  wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(1, 40);
  MAT.wet = new THREE.MeshStandardMaterial({
    map: wt, transparent: true, opacity: .55, depthWrite: false,
    roughness: .35, metalness: .05,
  });
  const ww = 16;
  const wgeo = new THREE.PlaneGeometry(ww, bl, 12, 24);
  const wp = wgeo.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    const wx = wp.getX(i) + sx, wz = -wp.getY(i);
    wp.setZ(i, siteFloorY(wx, wz) + .035);
  }
  wgeo.computeVertexNormals();
  const wet = new THREE.Mesh(wgeo, MAT.wet);
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(sx, 0, 0);
  wet.renderOrder = -1;
  root.add(wet);

  return sx;
}

/* ═══════════════════════════════════════════════════════════════════════
   ocean — flat plane, swell displaced on the CPU with analytic normals,
   plus four scrolling surf bands (three breakers + the shore wash).
   ═══════════════════════════════════════════════════════════════════════ */
function buildOcean(shoreX) {
  const OW = NAT.OCEAN_W, OL = NAT.OCEAN_L;
  const east = SITE.OCEAN.x1 + 48;          // tuck the east edge under the sand
  const cx = east - OW / 2;

  const geo = new THREE.PlaneGeometry(OW, OL, NAT.OCEAN_SEG_X, NAT.OCEAN_SEG_Z);
  /* both colour ramps are baked once — the night flip only swaps the
     reference, never re-draws a canvas (it fires on every moment switch) */
  MAT.waterMaps = [waterGradTex(false), waterGradTex(true)];
  for (const t of MAT.waterMaps) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  MAT.water = new THREE.MeshStandardMaterial({
    map: MAT.waterMaps[night ? 1 : 0],
    normalMap: waterNormalTex(),
    normalScale: new THREE.Vector2(.55, .55),
    roughness: .12, metalness: .28, envMapIntensity: .8,
  });
  const sea = new THREE.Mesh(geo, MAT.water);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(cx, SITE.OCEAN.y, 0);
  root.add(sea);

  /* cache the undisplaced lattice — only the local z (world y) moves */
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const n = pos.count;
  const bx = new Float32Array(n), by = new Float32Array(n);
  for (let i = 0; i < n; i++) { bx[i] = pos.getX(i); by[i] = pos.getY(i); }
  pos.setUsage(THREE.DynamicDrawUsage);
  nor.setUsage(THREE.DynamicDrawUsage);
  anim.ocean = { geo, pos, nor, bx, by, n, cx, shoreX };

  /* surf: [offset from shoreline, width, opacity, run-up, period, phase] */
  const bands = [
    { dx: 1.5, w: 11, o: .92, runup: 2.6, T: 7.5, ph: 0.0, y: .085, soft: 1.0 },
    { dx: -7, w: 6.5, o: .85, runup: 1.8, T: 9.0, ph: 1.9, y: .07, soft: .95 },
    { dx: -19, w: 5.0, o: .7, runup: 1.3, T: 11.5, ph: 3.4, y: .06, soft: .8 },
    { dx: -34, w: 4.0, o: .5, runup: 1.0, T: 14.0, ph: 5.1, y: .05, soft: .62 },
  ];
  MAT.foam = [];
  bands.forEach((b, i) => {
    const ft = foamTex(NAT.SEEDS.tex + 20 + i, b.soft);
    ft.wrapS = THREE.ClampToEdgeWrapping;
    ft.wrapT = THREE.RepeatWrapping;
    ft.repeat.set(1, OL / 26);
    const m = new THREE.MeshStandardMaterial({
      map: ft, transparent: true, opacity: b.o, depthWrite: false,
      roughness: .8, metalness: 0, color: 0xffffff,
    });
    MAT.foam.push(m);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b.w, OL, 1, 1), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(shoreX + b.dx, SITE.OCEAN.y + b.y, 0);
    mesh.renderOrder = 1;
    root.add(mesh);
    anim.surf.push({ mesh, m, base: shoreX + b.dx, ...b });
  });
}

/* the swell field — h and its two derivatives, shared by ticker + normals */
function waveAt(wx, wz, t, out) {
  const W = NAT.WAVE;
  const p1 = wx * W.k1 + t * W.w1;
  const p2 = wx * W.k2 + wz * .03 - t * W.w2;
  const p3 = wz * W.k3 + wx * .05 + t * W.w3;
  const s1 = Math.sin(p1), s2 = Math.sin(p2), s3 = Math.sin(p3);
  out[0] = W.a1 * s1 + W.a2 * s2 + W.a3 * s3;                       // height
  out[1] = W.a1 * W.k1 * Math.cos(p1) + W.a2 * W.k2 * Math.cos(p2)
         + W.a3 * .05 * Math.cos(p3);                               // dh/dX
  out[2] = W.a2 * .03 * Math.cos(p2) + W.a3 * W.k3 * Math.cos(p3);  // dh/dZ
}

/* ═══════════════════════════════════════════════════════════════════════
   coconut palms — the signature vegetation (the aerials are 60 % canopy)
   ═══════════════════════════════════════════════════════════════════════ */

/* tapered cylinder bent into the classic coconut lean, base flared */
function trunkGeo(o) {
  const H = o.h;
  const g = new THREE.CylinderGeometry(o.rTop, o.rBot, H, 7, 9, true);
  g.translate(0, H / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = Math.max(0, Math.min(1, y / H));
    const flare = t < .11 ? (0.11 - t) * 3.0 : 0;      // bulbous root collar
    const neck = t > .90 ? (t - .90) * 2.4 : 0;        // crownshaft swell up top
    const k = t * t * .8 + t * .2;                      // k(1) === 1
    p.setX(i, p.getX(i) * (1 + flare + neck) + o.bendX * k);
    p.setZ(i, p.getZ(i) * (1 + flare + neck) + o.bendZ * k);
  }
  g.computeVertexNormals();
  return g;
}

/* the crown: n drooping fronds + a nut cluster, all in ONE indexed geometry
   so a palm is exactly two draw calls no matter how many are on screen. */
function crownGeo(rnd, o) {
  const pos = [], uv = [], idx = [];
  const S = 5, V0 = .15;
  for (let f = 0; f < o.fronds; f++) {
    const az = (f / o.fronds) * Math.PI * 2 + (rnd() - .5) * .55;
    const L = o.frondL * (.82 + rnd() * .36);
    const W = o.frondW * (.85 + rnd() * .3);
    const rise = .72 + rnd() * .5, fall = 1.3 + rnd() * .55;
    const ca = Math.cos(az), sa = Math.sin(az);
    const base = pos.length / 3;
    for (let j = 0; j <= S; j++) {
      const s = j / S;
      const px = L * s * ca, pz = L * s * sa;
      const py = L * (rise * s - fall * s * s);
      const hw = W * .5 * Math.sin(Math.PI * Math.pow(s, .7)) + .02;
      const drop = hw * .55;
      pos.push(px - sa * hw, py - drop, pz + ca * hw);   // left edge
      pos.push(px, py, pz);                              // rachis
      pos.push(px + sa * hw, py - drop, pz - ca * hw);   // right edge
      uv.push(s, V0, s, V0 + (1 - V0) * .5, s, 1);
    }
    for (let j = 0; j < S; j++) {
      const a = base + j * 3, b = a + 3;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
      idx.push(a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
    }
  }
  /* coconuts — UVs pinned to the atlas's opaque brown patch */
  if (o.nuts) {
    const nut = new THREE.OctahedronGeometry(.17, 0);
    const np = nut.attributes.position;
    for (let k = 0; k < o.nuts; k++) {
      const a = rnd() * Math.PI * 2, r = .22 + rnd() * .26;
      const ox = Math.cos(a) * r, oz = Math.sin(a) * r, oy = -.22 - rnd() * .22;
      const base = pos.length / 3;
      for (let i = 0; i < np.count; i++) {
        pos.push(np.getX(i) + ox, np.getY(i) * 1.15 + oy, np.getZ(i) + oz);
        uv.push(.5, .05);
      }
      for (let i = 0; i < np.count; i += 3) idx.push(base + i, base + i + 1, base + i + 2);
    }
    nut.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.translate(o.bendX, o.h, o.bendZ);      // sit the crown on the bent trunk top
  return g;
}

/* three silhouettes — tall & leaning, mid, and a stocky young palm */
function palmVariants(rnd) {
  const specs = [
    { h: 11.5, rTop: .17, rBot: .34, bendX: 1.9, bendZ: .5, fronds: 9, frondL: 4.6, frondW: .95, nuts: 5 },
    { h: 8.6, rTop: .18, rBot: .33, bendX: -1.3, bendZ: 1.1, fronds: 8, frondL: 4.1, frondW: .88, nuts: 4 },
    { h: 5.8, rTop: .2, rBot: .32, bendX: .7, bendZ: -.9, fronds: 7, frondL: 3.5, frondW: .8, nuts: 0 },
  ];
  return specs.map(s => ({ trunk: trunkGeo(s), crown: crownGeo(rnd, s), spec: s }));
}

/* seeded placement: the grove band as a jittered grid (planted, like the
   reference), then dart-thrown scatter through the campus, then a ring
   around the ceremony lawn. */
function placePalms(G, blocked, preColliders) {
  const rnd = mulberry32(CFG.SEED ^ NAT.SEEDS.palm);
  const out = [];
  const gap2 = NAT.PALM_GAP * NAT.PALM_GAP;

  const clearOfWorld = (x, z) => {
    for (let i = 0; i < preColliders; i++) {
      const c = G.colliders[i];
      const dx = x - c.x, dz = z - c.z, rr = c.r + 1.4;
      if (dx * dx + dz * dz < rr * rr) return false;
    }
    return true;
  };
  const farEnough = (x, z) => {
    for (let i = 0; i < out.length; i++) {
      const dx = x - out[i].x, dz = z - out[i].z;
      if (dx * dx + dz * dz < gap2) return false;
    }
    return true;
  };
  const push = (x, z) => {
    out.push({ x, z, y: siteFloorY(x, z) - .18 });
    return true;
  };

  /* 1 — the grove band between the campus and the beach */
  const P = SITE.PALM_GROVE;
  const bw = P.x1 - P.x0, bl = P.z1 - P.z0;
  const cols = Math.max(1, Math.round(Math.sqrt(P.count * (bw / bl))));
  const rows = Math.ceil(P.count / cols);
  const cw = bw / cols, cl = bl / rows;
  let made = 0;
  for (let r = 0; r < rows && made < P.count; r++) {
    for (let c = 0; c < cols && made < P.count; c++) {
      const x = P.x0 + (c + .5 + (rnd() - .5) * .8) * cw;
      const z = P.z0 + (r + .5 + (rnd() - .5) * .8) * cl;
      if (blocked(x, z, 2) || !clearOfWorld(x, z)) continue;
      push(x, z); made++;
    }
  }

  /* 2 — palms threaded through the campus itself */
  const B = SITE.BOUNDS;
  for (let i = 0, tries = 0; i < SITE.SCATTER_PALMS && tries < SITE.SCATTER_PALMS * 60; tries++) {
    const x = SITE.BEACH.x1 + 2 + rnd() * (112 - SITE.BEACH.x1);
    const z = B.z0 + 8 + rnd() * (B.z1 - B.z0 - 16);
    if (blocked(x, z, 3) || !clearOfWorld(x, z) || !farEnough(x, z)) continue;
    push(x, z); i++;
  }

  /* 3 — the ring that frames the ceremony lawn (SITE.LAWN.palms).
     The palm population is GLOBAL — one world-space InstancedMesh set whose
     matrices the sway ticker rewrites every frame, so it cannot be parented
     under the enclave. But SITE.LAWN is enclave-local, so this ring's positions
     are mapped through enclaveToWorld() and the palms land around the lawn
     WHERE IT NOW IS while staying in the global buckets. */
  const L = SITE.LAWN;
  for (let i = 0; i < L.palms; i++) {
    const a = (i / L.palms) * Math.PI * 2 + rnd() * .12;
    const r = L.hedgeR + 2.6 + rnd() * 2.4;
    const p = enclaveToWorld(L.cx + Math.cos(a) * r, L.cz + Math.sin(a) * r);
    push(p.x, p.z);
  }
  return out;
}

function buildPalms(G, blocked, preColliders) {
  const rnd = mulberry32(CFG.SEED ^ (NAT.SEEDS.palm + 7));
  const variants = palmVariants(rnd);

  MAT.bark = new THREE.MeshStandardMaterial({ map: barkTex(), roughness: .88, metalness: 0 });
  MAT.frond = new THREE.MeshStandardMaterial({
    map: frondTex(), alphaTest: .5, side: THREE.DoubleSide,
    roughness: .82, metalness: 0,
  });

  const spots = placePalms(G, blocked, preColliders);
  const buckets = variants.map(() => []);
  for (const s of spots) {
    /* bias: tall palms in the grove and along the beach, stocky ones inland */
    const roll = rnd();
    const v = s.x < SITE.BEACH.x1 + 12 ? (roll < .62 ? 0 : roll < .9 ? 1 : 2)
                                       : (roll < .34 ? 0 : roll < .78 ? 1 : 2);
    s.v = v;
    s.s = (v === 0 ? .82 : .86) + rnd() * .36;
    s.rotY = rnd() * Math.PI * 2;
    s.leanX = (rnd() - .5) * .1;
    s.leanZ = (rnd() - .5) * .1;
    s.ph = rnd() * Math.PI * 2;
    s.f = .55 + rnd() * .45;
    s.amp = NAT.SWAY * (.55 + rnd() * .9);
    s.i = buckets[v].length;
    buckets[v].push(s);
    G.colliders.push({ x: s.x, z: s.z, r: NAT.TRUNK_R });
  }

  const dummy = new THREE.Object3D();
  variants.forEach((V, vi) => {
    const list = buckets[vi];
    if (!list.length) return;
    const tm = new THREE.InstancedMesh(V.trunk, MAT.bark, list.length);
    const cm = new THREE.InstancedMesh(V.crown, MAT.frond, list.length);
    tm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    tm.castShadow = cm.castShadow = true;
    tm.receiveShadow = true;
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.leanX, p.rotY, p.leanZ);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      tm.setMatrixAt(i, dummy.matrix);
      cm.setMatrixAt(i, dummy.matrix);
    });
    tm.instanceMatrix.needsUpdate = cm.instanceMatrix.needsUpdate = true;
    tm.computeBoundingSphere(); cm.computeBoundingSphere();
    root.add(tm, cm);
    anim.palmMeshes[vi] = { tm, cm, list };
  });
  anim.palms = spots;
  return spots.length;
}

/* ═══════════════════════════════════════════════════════════════════════
   understory — clipped hedges, shrub masses, bougainvillea, ground cover
   ═══════════════════════════════════════════════════════════════════════ */

/* a low-poly blob with noise-scaled vertices; reads as a foliage mass */
function blobGeo(rnd, detail, rough) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (rnd() - .5) * rough;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

/* Lay a hedge run and its collider chain. pts = [[x,z],…] polyline, in whatever
   frame the run is authored in. `toWorld` maps a point from that frame into
   world space for the COLLIDERS only — G.colliders is a flat world-space list
   that no group transform reaches, while the geometry itself inherits the
   transform from its parent group. Every hedge in this file is enclave-local,
   so every call passes enclaveToWorld; the parameter exists so a future global
   hedge can be added without anyone having to notice the difference. */
function hedgeRun(G, pts, h, t, segs, colliders, toWorld) {
  const H = NAT.HEDGE;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < .01) continue;
    const n = Math.max(1, Math.round(len / H.seg));
    for (let s = 0; s < n; s++) {
      const a = (s + .5) / n;
      segs.push({
        x: x0 + dx * a, z: z0 + dz * a,
        w: len / n + .06, h, t, rot: Math.atan2(dx, dz),
      });
    }
    if (colliders) {
      /* half-open: the next run's first circle closes the seam, so a long
         chain never doubles its colliders at the joints */
      const steps = Math.max(1, Math.ceil(len / H.colStep));
      for (let s = 0; s < steps; s++) {
        const a = s / steps;
        const px = x0 + dx * a, pz = z0 + dz * a;
        const p = toWorld ? toWorld(px, pz) : { x: px, z: pz };
        G.colliders.push({ x: p.x, z: p.z, r: H.colR });
      }
    }
  }
}

/* The x-span a plaza-edge hedge may occupy at depth z, or null if nothing
   worth building is left. Both ends are clamped and BOTH clamps matter:
     · EAST — stop short of the hero pool's WEST coping. A hedge in the water
       is a collider in the middle of the signature shot.
     · WEST — stop short of the west-arm villas, whose footprints reach into
       the plaza. A hedge inside a building is just as wrong.
   Derived, never hard-coded: SITE.PLAZA moved from east of the deck (x 10…30)
   to west of it (x −32…−12) when the pool was rotated, and the old clamp —
   which pinned the runs' START to the pool's EAST coping at x = +7.5 — then
   sat east of the plaza's own east edge. Both runs were laid backwards from
   there: one across the pool's north end, one clean through the suite's great
   room at waist height, colliders and all. */
function plazaHedgeSpan(z) {
  const P = SITE.PLAZA, V = SITE.VILLA;
  const clearW = Math.max(V.w, V.w2, V.courtW) / 2 + 1.5;
  const clearD = Math.max(V.d, V.d2, V.courtD) / 2 + 1.5;
  let x0 = P.x0 + 1;
  for (const [vx, vz] of SITE.VILLAS) {
    if (vx > P.x1) continue;                     // that arm is east of the plaza
    if (Math.abs(vz - z) < clearD) x0 = Math.max(x0, vx + clearW);
  }
  const x1 = Math.min(P.x1, SITE.POOL.cx - SITE.POOL.w / 2 - 2.5);
  return x1 - x0 > 2.5 ? [x0, x1] : null;
}

function buildUnderstory(G, blocked, enc) {
  const rnd = mulberry32(CFG.SEED ^ NAT.SEEDS.plant);
  const dummy = new THREE.Object3D();
  const H = NAT.HEDGE;

  /* ── hedges — ALL FOUR RUNS ARE ENCLAVE-LOCAL ──────────────────────────
     Every clipped hedge in the campus belongs to the clubhouse: the ceremony
     lawn's ring, the wall behind the cabana run, the two plaza runs and the
     lounge terrace screen. So the whole InstancedMesh goes into `enc` and
     inherits the enclave transform exactly like the buildings do; only the
     collider chains are mapped by hand (hedgeRun's last argument). */
  const segs = [];

  /* the ceremony lawn's hedge ring, with a 7 m entrance facing the campus */
  const L = SITE.LAWN;
  const openA = Math.atan2(SITE.SUITE.cz - L.cz, SITE.SUITE.cx - L.cx);
  const half = 3.6 / L.hedgeR;                     // half-angle of the gap
  const RING = 132;
  for (let i = 0; i < RING; i++) {
    const a0 = openA + half + (i / RING) * (Math.PI * 2 - half * 2);
    const a1 = openA + half + ((i + 1) / RING) * (Math.PI * 2 - half * 2);
    hedgeRun(G, [
      [L.cx + Math.cos(a0) * L.hedgeR, L.cz + Math.sin(a0) * L.hedgeR],
      [L.cx + Math.cos(a1) * L.hedgeR, L.cz + Math.sin(a1) * L.hedgeR],
    ], H.h * (.94 + rnd() * .14), H.t, segs, true, enclaveToWorld);
  }

  /* Hedge wall behind the pool cabanas. The run marches along Z at a fixed X,
     like SITE.CABANAS itself ({x, z0, z1}) — this read the pre-rotation
     {x0, x1, z} keys, so every coordinate in it was undefined: `C.z + 3` is
     NaN, hedgeRun's length test is `NaN < .01` = false, and both of its loops
     then run `s < NaN` zero times. The wall silently did not exist, and the
     bougainvillea anchored to it (below) placed four instances at NaN.
     "Behind" = east (+X), away from the pool — the cabanas are on the pool's
     east long side and the hedge screens them from the villa arm beyond. */
  const C = SITE.CABANAS, cabX = C.x + 3.0;
  hedgeRun(G, [[cabX, C.z0 - 1.6], [cabX, C.z1 + 1.6]], 1.85, 1.2, segs, true, enclaveToWorld);

  /* clipped runs framing the event plaza, north and south. plazaHedgeSpan()
     clips each run to ground that is actually plaza — see its comment; these
     two runs used to reach across the pool and through the great room. */
  const P = SITE.PLAZA;
  for (const pz of [P.z0 - 1.4, P.z1 + 1.4]) {
    const span = plazaHedgeSpan(pz);
    if (span) hedgeRun(G, [[span[0], pz], [span[1], pz]], 1.05, .9, segs, true, enclaveToWorld);
  }

  /* lounge terrace screen */
  const LG = SITE.LOUNGE;
  hedgeRun(G, [[LG.cx - LG.w / 2 - 2, LG.cz + LG.d / 2 + 2.4],
               [LG.cx + LG.w / 2 + 2, LG.cz + LG.d / 2 + 2.4]], 1.25, 1.0, segs, true, enclaveToWorld);

  MAT.hedge = new THREE.MeshStandardMaterial({ map: hedgeTex(), roughness: .92, metalness: 0 });
  const hgeo = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
  const hp = hgeo.attributes.position;                     // rough the clipped top
  for (let i = 0; i < hp.count; i++) {
    if (hp.getY(i) > .4) hp.setY(i, hp.getY(i) + (rnd() - .5) * .1);
  }
  hgeo.computeVertexNormals();
  const hedge = new THREE.InstancedMesh(hgeo, MAT.hedge, segs.length);
  hedge.castShadow = hedge.receiveShadow = true;
  const col = new THREE.Color();
  segs.forEach((s, i) => {
    dummy.position.set(s.x, s.h * .5, s.z);
    dummy.rotation.set(0, s.rot, 0);
    dummy.scale.set(s.t, s.h, s.w);
    dummy.updateMatrix();
    hedge.setMatrixAt(i, dummy.matrix);
    col.setHSL(.26 + (rnd() - .5) * .035, .34 + rnd() * .12, .34 + rnd() * .1);
    hedge.setColorAt(i, col);
  });
  hedge.instanceMatrix.needsUpdate = true;
  if (hedge.instanceColor) hedge.instanceColor.needsUpdate = true;
  hedge.computeBoundingSphere();
  enc.add(hedge);                    // enclave-local — rides the group transform

  /* ── shrub masses — GLOBAL ────────────────────────────────────────────
     Dart-thrown over the whole campus in WORLD coordinates and kept out of the
     buildings by blocked(), which now tests the enclave rects in the enclave's
     own frame. They stay on the nature root at scene origin. */
  const shrubs = [];
  const B = SITE.BOUNDS;
  for (let i = 0, tries = 0; i < 210 && tries < 9000; tries++) {
    const x = SITE.BEACH.x1 + 1 + rnd() * (118 - SITE.BEACH.x1);
    const z = B.z0 + 6 + rnd() * (B.z1 - B.z0 - 12);
    if (blocked(x, z, 1.4)) continue;
    const n = 2 + (rnd() * 4 | 0);                 // clumps, never lone bushes
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 2.4;
      const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r, ss = .7 + rnd() * 1.3;
      /* the clump CENTRE cleared the buildings by 1.4 m but a member can sit
         2.4 m out, so test the member too — the three rnd() calls above stay
         unconditional, so skipping one never shifts the seeded sequence */
      if (blocked(sx, sz, .6)) continue;
      shrubs.push({ x: sx, z: sz, s: ss });
    }
    i++;
  }
  /* dune scrub where the lawn meets the sand */
  for (let i = 0; i < 90; i++) {
    const x = SITE.BEACH.x1 - 2 + rnd() * 16;
    const z = B.z0 + rnd() * (B.z1 - B.z0);
    shrubs.push({ x, z, s: .55 + rnd() * .8, dune: true });
  }

  MAT.shrub = new THREE.MeshStandardMaterial({ map: shrubTex(), roughness: .9, metalness: 0 });
  const sgeo = blobGeo(mulberry32(NAT.SEEDS.plant + 3), 1, .5);
  const shrub = new THREE.InstancedMesh(sgeo, MAT.shrub, Math.max(1, shrubs.length));
  shrub.castShadow = shrub.receiveShadow = true;
  shrubs.forEach((s, i) => {
    const y = siteFloorY(s.x, s.z);
    dummy.position.set(s.x, y + s.s * .52, s.z);
    dummy.rotation.set((rnd() - .5) * .3, rnd() * 6.28, (rnd() - .5) * .3);
    dummy.scale.set(s.s * (.9 + rnd() * .5), s.s * (.7 + rnd() * .5), s.s * (.9 + rnd() * .5));
    dummy.updateMatrix();
    shrub.setMatrixAt(i, dummy.matrix);
    col.setHSL(s.dune ? .21 + rnd() * .04 : .25 + (rnd() - .5) * .07,
               s.dune ? .22 + rnd() * .12 : .3 + rnd() * .2,
               .3 + rnd() * .18);
    shrub.setColorAt(i, col);
  });
  shrub.instanceMatrix.needsUpdate = true;
  if (shrub.instanceColor) shrub.instanceColor.needsUpdate = true;
  shrub.computeBoundingSphere();
  root.add(shrub);

  /* ── bougainvillea — a SPARSE ACCENT, not a hedge ──────────────────────
     This used to place 128 mounds at up to 1.9× scale and the aerial read as
     a magenta rash (Carl's note). In the references it is a handful of small
     pink patches tucked against white walls — a few percent of the greenery.
     campus.js ALSO dresses each villa's walls, so nothing is placed there.

     ENCLAVE-LOCAL, all of it: every anchor is a building wall (the cabana run,
     the suite's west and east flanks, the lounge terrace) plus a few along the
     lawn's hedge ring. The mesh joins `enc` with the hedges. Anchor 1 tracks
     the cabana hedge above and picks up the same {x, z0, z1} fix — it was
     placing four instances at NaN. */
  const anchors = [
    { x0: cabX - 2.2, x1: cabX - 1.4, z0: C.z0 + 1, z1: C.z1 - 1, n: 4 },
    /* The suite's flanks SWAPPED when its interior plan was un-mirrored on
       2026-08-01 (the spa annex moved west). These anchors are hard offsets
       from SUITE.cx, so they didn't move — the spa moved on top of them, and
       two mounds ended up growing inside the massage room. Mirrored to match. */
    { x0: SITE.SUITE.cx + 10, x1: SITE.SUITE.cx + 12.5, z0: SITE.SUITE.cz - 6, z1: SITE.SUITE.cz + 3, n: 3 },
    { x0: SITE.SUITE.cx - 17.5, x1: SITE.SUITE.cx - 15, z0: SITE.SUITE.cz - 4, z1: SITE.SUITE.cz + 4, n: 3 },
    { x0: LG.cx - 9, x1: LG.cx + 9, z0: LG.cz + LG.d / 2 + 3, z1: LG.cz + LG.d / 2 + 4.2, n: 4 },
  ];
  const bougs = [];
  for (const a of anchors) {
    for (let i = 0; i < a.n; i++) {
      bougs.push({
        x: a.x0 + rnd() * (a.x1 - a.x0),
        z: a.z0 + rnd() * (a.z1 - a.z0),
        s: .55 + rnd() * .45,
      });
    }
  }
  /* a few along the lawn's hedge ring, well spaced */
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2, r = L.hedgeR + 1.1 + rnd() * .9;
    bougs.push({ x: L.cx + Math.cos(a) * r, z: L.cz + Math.sin(a) * r, s: .5 + rnd() * .4 });
  }

  MAT.boug = new THREE.MeshStandardMaterial({ map: bougTex(), roughness: .86, metalness: 0 });
  const bgeo = blobGeo(mulberry32(NAT.SEEDS.plant + 5), 1, .42);
  const boug = new THREE.InstancedMesh(bgeo, MAT.boug, bougs.length);
  boug.castShadow = boug.receiveShadow = true;
  bougs.forEach((b, i) => {
    /* ground height is a WORLD function — sample it at the mapped position,
       then use it as a local y (the enclave group has no tilt and no y offset,
       so local y and world y are the same number) */
    const bw = enclaveToWorld(b.x, b.z);
    const y = siteFloorY(bw.x, bw.z);
    dummy.position.set(b.x, y + b.s * .55, b.z);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(b.s * (1 + rnd() * .5), b.s * (.75 + rnd() * .45), b.s * (1 + rnd() * .5));
    dummy.updateMatrix();
    boug.setMatrixAt(i, dummy.matrix);
    col.setHSL(.9 + rnd() * .09, .55 + rnd() * .35, .45 + rnd() * .18);
    boug.setColorAt(i, col);
  });
  boug.instanceMatrix.needsUpdate = true;
  if (boug.instanceColor) boug.instanceColor.needsUpdate = true;
  boug.computeBoundingSphere();
  enc.add(boug);                     // enclave-local — rides the group transform

  /* ── low ground-cover beds — GLOBAL, same rules as the shrubs ─────── */
  const cover = [];
  for (let i = 0, tries = 0; i < 34 && tries < 3000; tries++) {
    const x = SITE.BEACH.x1 + 4 + rnd() * (114 - SITE.BEACH.x1);
    const z = B.z0 + 8 + rnd() * (B.z1 - B.z0 - 16);
    if (blocked(x, z, 1.0)) continue;
    const n = 7 + (rnd() * 8 | 0);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 3.4;
      const cx2 = x + Math.cos(a) * r, cz2 = z + Math.sin(a) * r, cs = .8 + rnd() * 1.5;
      if (blocked(cx2, cz2, .4)) continue;          // beds spread 3.4 m — see shrubs
      cover.push({ x: cx2, z: cz2, s: cs });
    }
    i++;
  }
  MAT.cover = new THREE.MeshStandardMaterial({ map: shrubTex(), roughness: .95, metalness: 0 });
  const cgeo = blobGeo(mulberry32(NAT.SEEDS.plant + 8), 0, .55);
  const covr = new THREE.InstancedMesh(cgeo, MAT.cover, Math.max(1, cover.length));
  covr.receiveShadow = true;
  cover.forEach((c2, i) => {
    const y = siteFloorY(c2.x, c2.z);
    dummy.position.set(c2.x, y + .06, c2.z);
    dummy.rotation.set(0, rnd() * 6.28, 0);
    dummy.scale.set(c2.s, .22 + rnd() * .16, c2.s);
    dummy.updateMatrix();
    covr.setMatrixAt(i, dummy.matrix);
    col.setHSL(.24 + (rnd() - .5) * .06, .32 + rnd() * .22, .26 + rnd() * .14);
    covr.setColorAt(i, col);
  });
  covr.instanceMatrix.needsUpdate = true;
  if (covr.instanceColor) covr.instanceColor.needsUpdate = true;
  covr.computeBoundingSphere();
  root.add(covr);

  return { hedges: segs.length, shrubs: shrubs.length, bougs: bougs.length, cover: cover.length };
}

/* ═══════════════════════════════════════════════════════════════════════
   entry point
   ═══════════════════════════════════════════════════════════════════════ */
export function buildNature(G) {
  if (built) return root;                    // idempotent — safe to call twice
  built = true;
  night = !!G.night;

  root = new THREE.Group();
  root.name = 'nature';
  G.scene.add(root);
  G.colliders ||= [];

  /* The enclave's own planting. world.js publishes G.enclave = { group, rotY,
     matrix, toWorld } before it calls any builder, so joining the rigid body is
     just a parent change — the hedges and bougainvillea then turn and slide
     with the suite, the pool and the villas, and nothing here has to know the
     numbers. The fallback rebuilds the same transform locally so this module
     still renders correctly if it is ever built without world.js (a standalone
     harness, a future scene). Deliberately NOT a child of `root`: world.js's
     cullUnderstoryInsideEnclave() sweeps nature's root children for instances
     standing inside the relocated footprints, and this content is supposed to
     stand there. */
  encRoot = new THREE.Group();
  encRoot.name = 'nature:enclave';
  const host = (G.enclave && G.enclave.group) || (G.groups && G.groups.enclave);
  if (host) {
    host.add(encRoot);
  } else {
    encRoot.rotation.y = ENCLAVE.rotY;
    encRoot.position.set(ENCLAVE.ox, 0, ENCLAVE.oz);
    root.add(encRoot);
  }

  const zones = exclusionZones();
  const blocked = makeBlocked(zones);
  /* snapshot the world's own colliders BEFORE planting, so palms only test
     against buildings — not against each other twice */
  const preColliders = G.colliders.length;

  const shoreX = buildGround();
  buildOcean(shoreX);
  const palmCount = buildPalms(G, blocked, preColliders);
  const under = buildUnderstory(G, blocked, encRoot);

  /* ── one ticker for the whole of nature ── */
  const w = [0, 0, 0];
  const dummy = new THREE.Object3D();
  (G.tickers ||= []).push((dt, t) => {
    /* ocean swell — analytic normals, no computeVertexNormals per frame */
    const o = anim.ocean;
    if (o) {
      const arr = o.pos.array, narr = o.nor.array;
      for (let i = 0; i < o.n; i++) {
        const wx = o.bx[i] + o.cx, wz = -o.by[i];
        /* waves shoal and flatten as they run up the sand */
        let taper = (o.shoreX - wx) / NAT.SHORE_TAPER;
        taper = taper < 0 ? 0 : taper > 1 ? 1 : taper;
        waveAt(wx, wz, t, w);
        const i3 = i * 3;
        arr[i3 + 2] = w[0] * taper;
        const nx = -w[1] * taper, ny = w[2] * taper;
        const l = Math.sqrt(nx * nx + ny * ny + 1);
        narr[i3] = nx / l; narr[i3 + 1] = ny / l; narr[i3 + 2] = 1 / l;
      }
      o.pos.needsUpdate = true;
      o.nor.needsUpdate = true;
      /* drift the ripple normals so the specular never sits still */
      const nm = MAT.water.normalMap;
      nm.offset.x = (nm.offset.x + dt * .012) % 1;
      nm.offset.y = (nm.offset.y - dt * .006 + 1) % 1;
    }

    /* surf — swash run-up plus a slow breathing pulse */
    for (const b of anim.surf) {
      const ph = t * (Math.PI * 2 / b.T) + b.ph;
      b.mesh.position.x = b.base + Math.sin(ph) * b.runup;
      const pulse = .55 + .45 * (.5 + .5 * Math.sin(ph * 2 + b.ph));
      b.m.opacity = b.o * pulse * (night ? .62 : 1);
      b.m.map.offset.y = (b.m.map.offset.y + dt * .015) % 1;
    }

    /* frond sway — the whole palm leans a couple of centimetres off vertical */
    const gust = .62 + .38 * Math.sin(t * .21) + .12 * Math.sin(t * .07 + 1.3);
    for (const M2 of anim.palmMeshes) {
      if (!M2) continue;
      for (let i = 0; i < M2.list.length; i++) {
        const p = M2.list[i];
        const a = p.amp * gust;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(
          p.leanX + Math.sin(t * p.f + p.ph) * a,
          p.rotY,
          p.leanZ + Math.cos(t * p.f * .83 + p.ph) * a * .8,
        );
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        M2.tm.setMatrixAt(i, dummy.matrix);
        M2.cm.setMatrixAt(i, dummy.matrix);
      }
      M2.tm.instanceMatrix.needsUpdate = true;
      M2.cm.instanceMatrix.needsUpdate = true;
    }
  });

  if (night) setNatureNight(true);

  root.userData.stats = {
    palms: palmCount, ...under,
    colliders: G.colliders.length - preColliders,
  };
  return root;
}

/* ═══════════════════════════════════════════════════════════════════════
   day ↔ night — instant, no tween
   ═══════════════════════════════════════════════════════════════════════ */
export function setNatureNight(on) {
  night = !!on;
  if (!built) return;                        // buildNature() re-applies on build

  for (const k of ['apron', 'grass', 'sand', 'wet', 'bark', 'frond',
                   'hedge', 'shrub', 'boug', 'cover']) {
    applyNightTo(k, MAT[k], night);
  }
  if (MAT.foam) for (const m of MAT.foam) applyNightTo('foam', m, night);

  /* the macro mottle is no longer a material of its own — it is a pair of
     uniforms inside MAT.grass (see buildGround). Same numbers, same table. */
  const mv = night ? NIGHT_TABLE.macro.night : NIGHT_TABLE.macro.day;
  macroU.macroAmt.value = mv.o;
  macroU.macroTint.value.setHex(mv.c);

  /* the sea gets a whole new colour ramp, not just a tint */
  if (MAT.water) {
    MAT.water.map = MAT.waterMaps[night ? 1 : 0];
    MAT.water.roughness = night ? .07 : .12;
    MAT.water.metalness = night ? .42 : .28;
    MAT.water.envMapIntensity = night ? .35 : .8;
    MAT.water.normalScale.set(night ? .32 : .55, night ? .32 : .55);
    MAT.water.emissive.setHex(night ? 0x061224 : 0x000000);
    MAT.water.emissiveIntensity = night ? 1 : 0;
    /* no needsUpdate — swapping between two live maps keeps the same program */
  }
}
