// campus.js — THE BUILT CAMPUS of 隐逸居 (Yinyiju), the Westin Sanya Haitang Bay
// clubhouse enclave. Buildings + hardscape only:
//
//   · SITE.ARRIVAL     — the two-storey entrance pavilion: the 280.7 ㎡ /
//                        60-cover 隐逸居酒廊 at courtyard grade, the CHECK-IN
//                        LOBBY above it, the balcony, the internal stair, the
//                        upper walkway, the raised court, the lane and the
//                        car park. THE CLUBHOUSE HAS EXACTLY ONE LOUNGE and
//                        this is it (Carl, 2026-08-04); `buildLounge()` and
//                        the standalone 酒廊 it built at (−44, −16) were
//                        demolished the same day — see SITE.LOUNGE's tombstone
//                        in site.js.
//   · SITE.VILLAS      — 10 guest keys in 3 types (5 Garden Rooms, 3 Garden Pool
//                        2-BR with walled courtyards, 2 two-storey Garden 3-BR)
//   · (SITE.LAWN — the formal GARDEN lawn with its stone edge, ring path and
//                        hedge ring — was DELETED 2026-08-02, see buildLawn's
//                        headstone below)
//   · SITE.GRAND_LAWN / BEACH_LAWN / DINNER_LAWNS / FIRE_PIT
//                      — the grass ground: the big open lawn running west to the
//                        beach, the private beachfront lawn (ceremony + cocktail)
//                        and the two dinner lawns flanking the presidential pool
//   · SITE.PLAZA       — basalt/turf band paving with in-ground lights
//   · SITE.PERGOLA / SIGN_PILLAR / EXT_STAIR
//   · SITE.HOTEL       — the far Westin crescent (fly-mode skyline)
//   · SITE.ROAD        — arrival road, parking, lamp posts
//
// NOT here: water surfaces (water.js), planting (nature.js), the presidential
// suite + atrium (suite.js), interior dressing (moments.js).
//
// Palette (clubhouse-pdf-brief.md): white stucco volumes · flat cantilevered
// roofs with copper/bronze fascia · dark mahogany slats · cream marble ·
// folding glass door-walls · glass balustrades on red-brown timber decks ·
// teal umbrellas · white wicker · bougainvillea.
//
// Everything repeated is an InstancedMesh (see the bucket system) — the whole
// campus lands in well under a hundred draw calls.
import * as THREE from 'three';
import { SITE, HOTEL_ROOF, ROOMS, worldToEnclave, enclaveToWorld,
  ARRIVAL_LOBBY_Y, ARRIVAL_LOUNGE_CEIL, ARRIVAL_LANE_Y } from './site.js';
import { CFG } from './config.js';
import { mulberry32, envKnob } from './materials.js';
/* The Blender-authored props (assets/models/, KAN-207 + the Group E resort
   furniture). ⚠ main.js awaits models.preload() BEFORE buildWorld for this —
   the buckets below are filled synchronously from models.geometry()/material()
   while the roof is being built, exactly as moments.js fills its own. */
import { leafMat, protoGeo, fringeFor } from './foliage.js';
import * as models from './models.js';

/* ════════════════════════════════════════════════════════════════════════
   shared geometry — every box in the campus is ONE unit cube, scaled
   ════════════════════════════════════════════════════════════════════════ */
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const UNIT_CYL = new THREE.CylinderGeometry(.5, .5, 1, 12);
const UNIT_CONE = new THREE.ConeGeometry(.5, 1, 10);
const UNIT_BLOB = new THREE.IcosahedronGeometry(.5, 1);
/* ── the rooftop screen's panel: a unit prism whose top comes to a POINT ──
   reference/photos/hotel-rooftop-pool-day-night.png — the lattice screen is not
   a wall with a straight top, it is a row of tall perforated blades with
   faceted, pointed heads, and that skyline is most of what the roof reads as
   from a distance. One geometry, instanced ~60 times at different heights and
   widths, so the whole screen is a single draw call.
   Centred on the origin (x ±.5, y ±.5, z ±.5) like every other UNIT_*, with the
   apex at y = +.5 and the shoulders at +.22, and UVs taken straight off the
   shape so the perforation tiles with the instance's scale. */
const UNIT_FIN = (() => {
  const s = new THREE.Shape();
  s.moveTo(-.5, -.5); s.lineTo(.5, -.5); s.lineTo(.5, .30);
  s.lineTo(0, .5);    s.lineTo(-.5, .30); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -.5);
  return g;
})();
/* ── the live-band stage's canopy panel ──────────────────────────────────────
   reference/photos/rooftop-bar-live-band.webp — the alcove over the band is a
   fan of big white perforated panels, each an elongated shield that comes to a
   POINT at the BOTTOM, and each outlined in a continuous line of warm gold LED.
   Same one-geometry-many-instances trick as UNIT_FIN, but two differences that
   matter:
     · the apex is DOWN (−Y) IN THE GEOMETRY ITSELF, because these hang rather
       than stand — so an instance needs NO z-flip. (UNIT_FIN's apex is up; copy
       its mat4 call and every panel points at the sky, which is a lantern
       instead of a canopy.);
     · the UVs are remapped to 0…1. ExtrudeGeometry takes a Shape's UVs straight
       off its own x/y, so a shape drawn about the origin yields uv −.5…+.5 —
       which under RepeatWrapping lands the texture's EDGE down the panel's
       MIDDLE. The gold outline is drawn at the texture's border, so without
       this remap every panel would wear a gold CROSS instead of a frame. */
const UNIT_SHIELD = (() => {
  const s = new THREE.Shape();
  s.moveTo(-.5, .5); s.lineTo(.5, .5); s.lineTo(.5, -.18);
  s.lineTo(0, -.5); s.lineTo(-.5, -.18); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -.5);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + .5, uv.getY(i) + .5);
  uv.needsUpdate = true;
  return g;
})();
const WHITE = new THREE.Color(0xffffff);

/* ════════════════════════════════════════════════════════════════════════
   night registry — setCampusNight() walks these three lists
   ════════════════════════════════════════════════════════════════════════ */
const NIGHT = { tint: [], glow: [], lights: [], vis: [] };   // env levels: materials.js envKnob (wave F)
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
/** a mesh that only exists after dark (the pool's star-points) — see setCampusNight */
function nightOnly(mesh) {
  mesh.visible = false;
  NIGHT.vis.push(mesh);
  return mesh;
}

/* ════════════════════════════════════════════════════════════════════════
   canvas textures (the CAMPUS is procedural; the dressing props in
   moments.js are Blender-authored GLBs since KAN-207 — see assets/blender/)
   ════════════════════════════════════════════════════════════════════════ */
/* ── the casuarina's needle sheet ───────────────────────────────────────────
   BOOT FALLBACK ONLY — assets/textures/casuarina.webp replaces it on load.
   Fine strands hanging from the top of the tile and thinning toward the
   bottom, so an alpha-cut cone is solid at its apex and ragged at its rim.
   Wraps horizontally: the cone's u goes once around the circumference. */
function casuNeedleTex() {
  return tex(256, 256, (g, w, h) => {
    const rnd = mulberry32(0xca50a1);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      const x = rnd() * w;
      const len = h * (.34 + rnd() * .62);
      const sway = (rnd() - .5) * 16;
      const v = 58 + rnd() * 34;
      g.strokeStyle = `rgba(${v * .78 | 0},${v | 0},${v * .74 | 0},${.72 + rnd() * .26})`;
      g.lineWidth = .8 + rnd() * 1.2;
      g.beginPath();
      g.moveTo(x, 0);
      g.quadraticCurveTo(x + sway * .5, len * .55, x + sway, len);
      g.stroke();
    }
  });
}

/* Swap a generated photograph over a material's canvas map, once it arrives.
   The material must ALREADY have a map (and its alphaTest) or this is a shader
   recompile — see the banner at casuNeedle. Mirrors nature.js's photoMap(). */
function photoTex(mat, file, repeat) {
  new THREE.TextureLoader().load(
    new URL(`../assets/textures/${file}`, import.meta.url).href,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (repeat) t.repeat.set(repeat[0], repeat[1]);
      const old = mat.map;
      mat.map = t;
      mat.needsUpdate = true;
      if (old && old.isCanvasTexture && old !== t) old.dispose();
    },
    undefined,
    () => console.warn(`campus: ${file} did not load — keeping the canvas fallback`),
  );
}

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
/* the clipped hedges' boot map — replaced by assets/textures/hedge.webp on load
   (see MAT.hedge). Leaf-scale mottle round the photograph's mean, #305027. */
function texHedgeStandIn() {
  return tex(64, 64, (g, w, h) => {
    const rnd = mulberry32(0x4ed9e);
    g.fillStyle = '#305027'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const l = rnd();
      g.fillStyle = l < .4 ? 'rgba(20,40,18,.7)' : l < .8 ? 'rgba(62,98,46,.7)' : 'rgba(98,132,60,.6)';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  });
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

/* ════════════════════════════════════════════════════════════════════════
   THE ARRIVAL PAVILION'S MAPS — reference/entrance-arrival-brief.md +
   frames f_001–f_013. Dark oxidised corten with vertical battens, banded
   curtain-wall piers, jointed paver setts, large-format forecourt paving,
   the 隐逸居 plaque and the fluted brass sconces. All seeded (mulberry32).
   ════════════════════════════════════════════════════════════════════════ */
/* vertical-batten weathered corten: streaked browns/near-blacks with
   occasional orange bleed, a batten seam every 21 px (~0.55 m at the wall's
   repeat) — frames f_001/f_005: the streaks run VERTICALLY down each batten */
function texCorten() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#3d2a1e'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7331);
    /* long vertical weather streaks, batten by batten */
    for (let x = 0; x < w; x += 21) {
      for (let i = 0; i < 14; i++) {
        const t = rnd();
        g.fillStyle = t < .3 ? `rgba(${20 + rnd() * 22 | 0},${16 + rnd() * 14 | 0},${12 + rnd() * 10 | 0},.55)`
          : t < .75 ? `rgba(${86 + rnd() * 40 | 0},${48 + rnd() * 22 | 0},${26 + rnd() * 14 | 0},.4)`
          : `rgba(${150 + rnd() * 60 | 0},${76 + rnd() * 30 | 0},${22 + rnd() * 16 | 0},.28)`;   // orange bleed
        const sx = x + 2 + rnd() * 16, sy = rnd() * h;
        g.fillRect(sx, sy, 2 + rnd() * 5, 18 + rnd() * 90);
      }
      /* the batten seam: dark gap + a thin lit edge */
      g.fillStyle = 'rgba(12,8,6,.85)'; g.fillRect(x - 1.5, 0, 3, h);
      g.fillStyle = 'rgba(190,140,96,.10)'; g.fillRect(x + 1.8, 0, 1.2, h);
    }
    /* mottled patina blotches over everything */
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${40 + rnd() * 90 | 0},${28 + rnd() * 40 | 0},${18 + rnd() * 20 | 0},${.10 + rnd() * .14})`;
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 14, 2 + rnd() * 8, rnd() * 3.2, 0, 6.3);
      g.fill();
    }
  }, [3, 1]);
}

/* the entry piers: alternating horizontal bands — near-black glossy panel /
   lighter taupe-grey stone (frames f_011/f_013) */
function texBands() {
  return tex(128, 256, (g, w, h) => {
    const rnd = mulberry32(9151);
    /* dark-dominant, as f_011/f_013: a wide near-black glossy band, then a
       THIN taupe stone band — the piers read dark with light striping */
    const dark = 40, pale = 18, pitch = dark + pale;
    for (let y = 0; y < h; y += pitch) {
      g.fillStyle = '#141619'; g.fillRect(0, y, w, dark);
      g.fillStyle = 'rgba(110,120,132,.12)'; g.fillRect(0, y + 2, w, 3);     // sheen
      g.fillStyle = '#655f55'; g.fillRect(0, y + dark, w, pale);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = `rgba(${86 + rnd() * 40 | 0},${80 + rnd() * 36 | 0},${70 + rnd() * 30 | 0},.4)`;
        g.fillRect(rnd() * w, y + dark + rnd() * pale, 2 + rnd() * 5, 1 + rnd() * 2.5);
      }
      g.fillStyle = 'rgba(8,8,8,.6)'; g.fillRect(0, y + dark - 1.5, w, 1.5);
      g.fillStyle = 'rgba(8,8,8,.6)'; g.fillRect(0, y + pitch - 1.5, w, 1.5);
    }
  }, [1, 1]);
}

/* the court: jointed rectangular stone setts in staggered courses — NOT the
   flat painted texPark slab (brief delta #2). One tile = 4 courses of ~5 */
function texSett() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#2e2f33'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(5519);
    const ch = 64, cw = 52;
    for (let row = 0; row < 4; row++) {
      const off = (row % 2) * cw * .5;
      for (let x = -1; x < 6; x++) {
        const px = x * cw + off, py = row * ch;
        g.fillStyle = `rgb(${68 + rnd() * 26 | 0},${69 + rnd() * 24 | 0},${72 + rnd() * 24 | 0})`;
        g.fillRect(px + 2, py + 2, cw - 4, ch - 4);
        for (let i = 0; i < 20; i++) {
          g.fillStyle = `rgba(${40 + rnd() * 60 | 0},${40 + rnd() * 58 | 0},${42 + rnd() * 56 | 0},.4)`;
          g.fillRect(px + 3 + rnd() * (cw - 8), py + 3 + rnd() * (ch - 8), 2 + rnd() * 5, 1.5 + rnd() * 4);
        }
      }
    }
  }, [1, 1]);
}

/* the forecourt: light grey matte large-format (~600 mm) paving, straight
   joints (frames f_004–f_009) */
function texForePave() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#a9abaa'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(6673);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(${140 + rnd() * 60 | 0},${142 + rnd() * 58 | 0},${140 + rnd() * 56 | 0},.25)`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3);
    }
    /* light wear clouds */
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${170 + rnd() * 40 | 0},${172 + rnd() * 38 | 0},${168 + rnd() * 36 | 0},.10)`;
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, 12 + rnd() * 34, 8 + rnd() * 20, rnd() * 3.2, 0, 6.3);
      g.fill();
    }
    g.strokeStyle = 'rgba(88,90,90,.55)'; g.lineWidth = 2.5;
    for (let k = 0; k <= w; k += 128) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.moveTo(0, k); g.lineTo(w, k); g.stroke();
    }
  }, [1, 1]);
}

/* the tan/sand circular paving inlay set into the court (frame f_001) */
function texInlay() {
  return tex(256, 256, (g, w, h) => {
    const rnd = mulberry32(2917);
    const cx = w / 2, cy = h / 2;
    for (let r = 128; r > 0; r -= 16) {
      g.fillStyle = `rgb(${168 + rnd() * 24 | 0},${140 + rnd() * 20 | 0},${100 + rnd() * 18 | 0})`;
      g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.fill();
      g.strokeStyle = 'rgba(90,72,50,.5)'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, r, 0, 6.3); g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      const a = rnd() * 6.3, rr = rnd() * 126;
      g.fillStyle = `rgba(${120 + rnd() * 70 | 0},${100 + rnd() * 50 | 0},${70 + rnd() * 40 | 0},.3)`;
      g.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2 + rnd() * 3, 1 + rnd() * 3);
    }
  });
}

/* fluted brass — vertical gold ribs with dark valleys; doubles as its own
   emissiveMap so the sconce glows along its ribs */
function texFlute() {
  return tex(64, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const grd = g.createLinearGradient(x, 0, x + 8, 0);
      grd.addColorStop(0, '#3a2a12'); grd.addColorStop(.45, '#e8b76a');
      grd.addColorStop(.6, '#f6d896'); grd.addColorStop(1, '#4a3416');
      g.fillStyle = grd; g.fillRect(x, 0, 8, h);
    }
  }, [4, 1]);
}

/* the flush white plaque: 隐逸居 over THE SERENE RETREAT (the documented
   real name — the filmed plaque is illegible; the name is from Rachel's
   photos via CLAUDE.md). Dark characters on white, mounted on the corten. */
function texPlaque() {
  return tex(512, 224, (g, w, h) => {
    g.fillStyle = '#f2efe7'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(4111);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${210 + rnd() * 30 | 0},${208 + rnd() * 28 | 0},${198 + rnd() * 26 | 0},.35)`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 1 + rnd() * 3);
    }
    g.fillStyle = '#26221c';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 104px "Songti SC", "STSong", "PingFang SC", serif';
    g.fillText('隐逸居', w / 2, 84);
    g.font = '600 30px "Georgia", serif';
    /* letterspace THE SERENE RETREAT by hand */
    const sub = 'THE SERENE RETREAT';
    let tot = 0;
    const adv = [...sub].map(c => { const a = g.measureText(c).width + 7; tot += a; return a; });
    let px = w / 2 - tot / 2;
    for (let i = 0; i < sub.length; i++) { g.fillText(sub[i], px + adv[i] / 2, 178); px += adv[i]; }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   THE WESTIN CRESCENT'S TWO ELEVATIONS
   Rebuilt 2026-08-02 from real photographs — see reference/hotel-facade-brief.md
   for the frames and what each one settles. Everything before this was inferred
   from a low-resolution aerial and Carl (who has stayed there) said so.

   The building has TWO completely different faces and the old code gave both
   of them the same diagonal white lattice, which is on neither:

   · CONCAVE (west, over the gardens — THE ONE THE CAMPUS SEES): seven storeys
     of guest balconies. Per storey, top to bottom: a bright white SLAB EDGE,
     recessed TEAL-GREEN glazing divided by white mullions, and standing in
     front of it the building's signature — a solid white balustrade shaped as
     a TRIANGLE, apex up, one per bay. The whole 142 m arc reads as a field of
     white triangles on green glass, banded by white slabs.
   · CONVEX (east, the arrival side): a white sculptural SCREEN punched with
     irregular, tapering, leaf-shaped slits in loose vertical columns. Nothing
     rectilinear about it and nothing diagonal either.

   One canvas tile = HOTEL_BAYS bays, tiled HOTEL_TILES times across the whole
   face. THE BAY WIDTH IS THEREFORE r·arc/(BAYS·TILES) AND NOTHING ENFORCES IT —
   which is why TILES is DERIVED as of 2026-08-02 rather than typed.
   It was 9, and 9 was right for a 1.5 rad arc at r 95: 142 m / 36 bays = 3.96 m,
   a real guest-room module. The proportion pass grew the arc to 2.35 rad (Carl:
   *"it's almost a half circle, but the one we have now is very small"*), and
   with TILES pinned at 9 those same 36 bays would have stretched across 223 m —
   6.2 m guest rooms, and at the π the spec points at, 8 m. Nothing would have
   thrown; the building would just have looked wrong in a way that reads as
   "the render is low-detail" rather than as a bug.
   BAY_M is the constant here. TILES follows it, and both maps are 1024² so a
   bay still gets 1024/HOTEL_BAYS = 256 px whatever the building does.
   ════════════════════════════════════════════════════════════════════════ */
const HOTEL_BAYS = 4;
const HOTEL_BAY_M = 3.96;              // one guest-room module, metres
const HOTEL_TILES = Math.max(1, Math.round(
  SITE.HOTEL.r * SITE.HOTEL.arc / (HOTEL_BAYS * HOTEL_BAY_M)));   // 14 at r 95 / arc 2.35

/* ⚠ Both maps are drawn UPSIDE DOWN on purpose. THREE.CanvasTexture ships with
   flipY = true, so canvas-row 0 lands at the TOP of the building — draw a
   storey section reading downwards and every triangle comes out apex-DOWN,
   which is exactly the wrong building. `flipRows` mirrors the canvas once so
   the code below can be read the way an elevation is read: slab, then glazing,
   then the balustrade standing on the floor. Both maps take the same flip, so
   they stay registered with each other. */
function flipRows(g, h, draw) { g.save(); g.translate(0, h); g.scale(1, -1); draw(); g.restore(); }

function texHotelFacade() {
  const F = SITE.HOTEL.floors;
  return tex(1024, 1024, (g, w, h) => flipRows(g, h, () => {
    const row = h / F, bay = w / HOTEL_BAYS, rnd = mulberry32(20270318);
    for (let f = 0; f < F; f++) {
      const y = f * row;
      /* ── the glazed reveal behind the balcony ── */
      for (let b = 0; b < HOTEL_BAYS; b++) {
        const x = b * bay;
        const gr = g.createLinearGradient(0, y + row * .17, 0, y + row);
        gr.addColorStop(0, '#1c414b');      // the deep top of the reveal
        gr.addColorStop(.5, '#356a72');
        gr.addColorStop(1, '#4d878c');      // sky landing in the lower panes
        g.fillStyle = gr;
        g.fillRect(x, y + row * .17, bay, row * .83);
        g.fillStyle = '#e9e5da';            // white mullions: bay edges + centre
        g.fillRect(x, y + row * .17, bay * .075, row * .83);
        g.fillRect(x + bay * .4825, y + row * .17, bay * .045, row * .83);
        g.fillRect(x + bay * .925, y + row * .17, bay * .075, row * .83);
      }
      /* ── the slab edge: the bright horizontal that bands the whole arc ── */
      g.fillStyle = '#f5f2e9'; g.fillRect(0, y, w, row * .17);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, y, w, row * .035);
      g.fillStyle = 'rgba(52,58,56,.34)';    g.fillRect(0, y + row * .17, w, row * .035);
      /* ── THE TRIANGLES. One solid balustrade per bay, standing on the slab
            below and rising almost to the one above. The shaded right cheek is
            what keeps them reading as solid volumes rather than white paint at
            285 m, where the whole triangle is barely three pixels tall. ── */
      for (let b = 0; b < HOTEL_BAYS; b++) {
        const x = b * bay, base = y + row * .998, apex = y + row * .195;
        const k = .93 + rnd() * .07;
        /* the triangles nearly TOUCH — in the photographs the white is the
           ground and the glass shows only as narrow wedges between apexes.
           Leave a wide gap and the elevation inverts into teal-with-white-dots,
           which is what the first pass rendered. */
        g.beginPath();
        g.moveTo(x - bay * .015, base);
        g.lineTo(x + bay * .50, apex);
        g.lineTo(x + bay * 1.015, base);
        g.closePath();
        g.fillStyle = `rgb(${245 * k | 0},${242 * k | 0},${233 * k | 0})`; g.fill();
        g.beginPath();
        g.moveTo(x + bay * .50, apex);
        g.lineTo(x + bay * 1.015, base);
        g.lineTo(x + bay * .50, base);
        g.closePath();
        g.fillStyle = 'rgba(140,144,140,.34)'; g.fill();
      }
      /* the balcony's own nosing, under the triangles */
      g.fillStyle = 'rgba(238,234,224,.9)'; g.fillRect(0, y + row * .965, w, row * .035);
    }
  }), [HOTEL_TILES, 1]);
}

/* The same elevation as an emissive map. reference/video/hotel-frames/dawn_017
   (and screenrec_010) is the night the crescent actually has: NOT a continuous
   ribbon of light, but discrete warm slots — roughly three rooms in five lit,
   the slabs and the concrete triangles staying dark. So the glow is painted
   only into the glazed reveal, above the balustrade's shoulders. */
function texHotelWindows() {
  const F = SITE.HOTEL.floors;
  return tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    flipRows(g, h, () => {
      const row = h / F, bay = w / HOTEL_BAYS, rnd = mulberry32(CFG.SEED % 99991);
      for (let f = 0; f < F; f++) {
        const y = f * row;
        for (let b = 0; b < HOTEL_BAYS; b++) {
          if (rnd() < .40) continue;                       // a dark room
          const x = b * bay, a = .58 + rnd() * .42;
          g.fillStyle = `rgba(255,${186 + rnd() * 46 | 0},${108 + rnd() * 56 | 0},${a})`;
          g.fillRect(x + bay * .095, y + row * .215, bay * .35, row * .31);
          if (rnd() > .32) g.fillRect(x + bay * .555, y + row * .215, bay * .35, row * .31);
        }
      }
    });
  }, [HOTEL_TILES, 1]);
}

/* THE ARRIVAL FACE — reference/photos/hotel-westin-hotel-front.webp, and the
   canopy crop beside it. A white sculptural screen stood off the guest rooms
   and cut with tall, irregular, tapering slits that lean and taper like blades
   of grass, loosely ordered into vertical columns. The rooms behind it read as
   shadow through the openings. */
function texHotelScreen() {
  return tex(512, 1024, (g, w, h) => {
    g.fillStyle = '#f0ede4'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7734), COLS = 6, ROWS = 13;
    const cw = w / COLS, ch = h / ROWS;
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const x = c * cw + cw * (.14 + rnd() * .26);
      const y = r * ch + ch * (.10 + rnd() * .16);
      const sw = cw * (.20 + rnd() * .26), sh = ch * (.46 + rnd() * .34);
      const lean = (rnd() - .5) * sw * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + sw * .95, y + sh * .42, x + lean + sw * .28, y + sh);
      g.lineTo(x + lean, y + sh);
      g.quadraticCurveTo(x + sw * .06, y + sh * .48, x, y);
      g.closePath();
      g.fillStyle = `rgb(${44 + rnd() * 22 | 0},${45 + rnd() * 22 | 0},${44 + rnd() * 20 | 0})`;
      g.fill();
    }
    /* the shadow the screen throws on itself along every column edge */
    g.fillStyle = 'rgba(120,118,108,.16)';
    for (let c = 0; c < COLS; c++) g.fillRect(c * cw, 0, cw * .06, h);
  }, [16, 1]);
}

/* pale mosaic + a soft ripple web — the rooftop pool's basin.
   The ripple is baked into the colour map and SCROLLED in tick(), which is all
   the movement a pool 285 m from the camera can justify (water.js owns the one
   pool that gets a real mirror pass). */
function texRipple() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#bfe4e6'; g.fillRect(0, 0, w, h);
    /* mosaic grid */
    g.strokeStyle = 'rgba(120,178,186,.5)'; g.lineWidth = 1.4;
    for (let k = 0; k <= w; k += 32) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke();
      g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke();
    }
    const rnd = mulberry32(9137);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) {
      g.fillStyle = `rgba(${196 + rnd() * 44 | 0},${228 + rnd() * 24 | 0},${230 + rnd() * 22 | 0},.5)`;
      g.fillRect(x + 1.5, y + 1.5, 29, 29);
    }
    /* interference web = caustics */
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * w, cy = rnd() * h, r0 = 12 + rnd() * 46;
      g.strokeStyle = `rgba(255,255,255,${.10 + rnd() * .16})`;
      g.lineWidth = 1 + rnd() * 2.6;
      for (let k = 0; k < 3; k++) {
        g.beginPath(); g.arc(cx, cy, r0 + k * 9, 0, Math.PI * 2); g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
  }, [1, 1]);
}

/* ── THE CHECK-IN LOBBY + 酒廊 LOUNGE (2026-08-04) ─────────────────────────
   All five maps are read off reference/photos/clubhouse-lounge-checkin-balcony.jpg
   and the three lobby stills (61/62/63.png). ⚠ Every colour here is a HEX
   literal on purpose: Color.setHSL fills in the LINEAR working space, which
   is what turned the corten maroons two stops light on the last pass. */

/* warm orange-brown timber boards — the soffits under both overhangs, the
   deck, the lobby's floor. One canvas, retiled per surface. */
function texWarmTimber() {
  return tex(256, 256, (g, w, h) => {
    const r = mulberry32(0x77a1);
    g.fillStyle = '#8a4a24'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = `rgb(${132 + r() * 34 | 0},${72 + r() * 26 | 0},${36 + r() * 18 | 0})`;
      g.fillRect(0, y, w, 15);
      g.strokeStyle = 'rgba(30,14,6,.55)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, y + 15.5); g.lineTo(w, y + 15.5); g.stroke();
      for (let k = 0; k < 5; k++) {                       // grain
        g.strokeStyle = `rgba(56,26,10,${.10 + r() * .12})`;
        g.beginPath();
        const yy = y + 2 + r() * 11;
        g.moveTo(0, yy);
        g.bezierCurveTo(w / 3, yy + r() * 3 - 1.5, 2 * w / 3, yy - r() * 3 + 1.5, w, yy);
        g.stroke();
      }
    }
  }, [1, 1]);
}

/* charcoal stone in large panels of slightly varying tone — the lounge's
   pier and the round column that carries the overhang */
function texCharcoal() {
  return tex(256, 256, (g, w, h) => {
    const r = mulberry32(0x3c11);
    g.fillStyle = '#33363a'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) {
      for (let x = 0; x < w; x += 86) {
        const v = 44 + r() * 22 | 0;
        g.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
        g.fillRect(x + 1, y + 1, 84, 62);
      }
    }
    g.strokeStyle = 'rgba(18,20,22,.8)'; g.lineWidth = 2;
    for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x <= w; x += 86) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  }, [1, 1]);
}

/* the blue-grey rug with the pale wave/ripple linework of 61.png */
function texRugWave() {
  return tex(512, 512, (g, w, h) => {
    const r = mulberry32(0x9a3f);
    g.fillStyle = '#5d7583'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {                        // woven noise
      g.fillStyle = `rgba(255,255,255,${r() * .05})`;
      g.fillRect(r() * w, r() * h, 3, 2);
    }
    g.lineWidth = 2.2;
    for (let k = 0; k < 9; k++) {
      g.strokeStyle = `rgba(214,226,231,${.30 + r() * .22})`;
      g.beginPath();
      const y0 = 30 + k * 52 + r() * 14;
      g.moveTo(-10, y0);
      for (let x = 0; x <= w + 10; x += 32) {
        g.lineTo(x, y0 + Math.sin((x / w) * Math.PI * (1.6 + k * .25) + k) * (18 + k * 3));
      }
      g.stroke();
    }
  }, [1, 1]);
}

/* the lounge's own plaque — 隐逸居酒廊 over SERENE RETREAT LOUNGE. This is the
   venue's OWN signage, photographed and legible in
   reference/photos/clubhouse-lounge-checkin-balcony.jpg, so it is
   authoritative (the project's "never letter a name off a render" rule is
   about the planner's renders, not about the hotel's own sign). The
   building's plaque on the arrival face stays 隐逸居 / THE SERENE RETREAT. */
function texLoungePlaque() {
  return tex(384, 288, (g, w, h) => {
    g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#a8a296'; g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#3a3630';
    g.textAlign = 'center';
    g.font = '600 46px "Songti SC", "Noto Serif SC", serif';
    g.fillText('隐逸居酒廊', w / 2, h * .44);
    g.font = '300 25px Helvetica, Arial, sans-serif';
    g.fillText('SERENE RETREAT', w / 2, h * .64);
    g.fillText('LOUNGE', w / 2, h * .78);
  }, [1, 1]);
}

/* the lagoon swim-up bar's counter front. reference/photos/resort-swim-up-bar.webp
   letters it "POO[L] BAR" in a loose resort script over a pale cream panel, with
   a small wave glyph between the words — the "L" is behind a stool in the photo
   and is read by inference (resort-pool-complex-brief.md §2g says so). Cream
   ground, not white: it has to sit against MAT.white's counter body without
   reading as a decal stuck on it. */
function texPoolBar() {
  return tex(512, 96, (g, w, h) => {
    g.fillStyle = '#efe9dc'; g.fillRect(0, 0, w, h);
    const r = mulberry32(0x9a11);
    for (let i = 0; i < 900; i++) {                 // plaster tooth
      g.fillStyle = `rgba(0,0,0,${r() * .03})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.fillStyle = '#2f7fb5';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 600 52px "Snell Roundhand", "Apple Chancery", cursive';
    g.fillText('POOL', w * .29, h * .52);
    g.fillText('BAR', w * .72, h * .52);
    /* the wave glyph between the words */
    g.strokeStyle = '#2f7fb5'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = w * .46 + (i / 24) * w * .1;
      const y = h * .52 + Math.sin(i / 24 * Math.PI * 2) * h * .1;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }, [1, 1]);
}

/* the white four-panel cabinet wall behind the check-in desk (63.png) */
function texCabinet() {
  return tex(256, 256, (g, w, h) => {
    const r = mulberry32(0x5be1);
    g.fillStyle = '#efece3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(0,0,0,${r() * .022})`;
      g.fillRect(r() * w, r() * h, 2, 2);
    }
    g.strokeStyle = 'rgba(120,116,106,.55)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(2, 0); g.lineTo(2, h); g.stroke();
    g.beginPath(); g.moveTo(w - 2, 0); g.lineTo(w - 2, h); g.stroke();
  }, [1, 1]);
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

/* ── THE ROOFTOP SCREEN, three maps ─────────────────────────────────────────
   reference/photos/hotel-rooftop-pool-day-night.png. The screen behind the
   cabana daybeds is a white perforated lattice — an interlocking hexagonal /
   floral cut, dense enough that from across the pool it reads as texture and
   from the side you see the sky through it. Alpha-tested rather than blended:
   the holes have to be real (you must be able to see the sky and the sea
   through the screen at grazing angles) and a blended screen would sort badly
   against the water behind it and cost a full transparency pass on 60 panels.

   `texLattice` returns [colour, alpha] off the SAME canvas — the alpha map is
   the pattern's own coverage, so the two can never drift. */
function texLatticePair() {
  const draw = (mode) => (g, w, h) => {
    g.fillStyle = mode === 'a' ? '#000' : '#efe9df';
    g.fillRect(0, 0, w, h);
    const solid = mode === 'a' ? '#fff' : '#fbf7f0';
    const line = mode === 'a' ? '#fff' : '#d8cfc1';
    const N = 4, cell = w / N;
    g.strokeStyle = solid; g.fillStyle = solid;
    /* the frame + the diagonal lattice inside each cell */
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const x = c * cell, y = r * cell, m = cell / 2;
      g.lineWidth = cell * .17;
      g.strokeStyle = solid;
      g.beginPath();                        // the interlocking rosette
      g.moveTo(x + m, y + cell * .06);
      g.lineTo(x + cell * .94, y + m);
      g.lineTo(x + m, y + cell * .94);
      g.lineTo(x + cell * .06, y + m);
      g.closePath(); g.stroke();
      g.lineWidth = cell * .13;
      g.beginPath();
      g.moveTo(x + cell * .06, y + cell * .06); g.lineTo(x + cell * .94, y + cell * .94);
      g.moveTo(x + cell * .94, y + cell * .06); g.lineTo(x + cell * .06, y + cell * .94);
      g.stroke();
      g.strokeStyle = line; g.lineWidth = cell * .10;
      g.strokeRect(x + cell * .03, y + cell * .03, cell * .94, cell * .94);
    }
    /* every panel keeps a solid margin so the blade reads as a blade */
    g.fillStyle = solid;
    g.fillRect(0, 0, w, h * .045); g.fillRect(0, h * .955, w, h * .045);
    g.fillRect(0, 0, w * .05, h);  g.fillRect(w * .95, 0, w * .05, h);
  };
  const col = tex(256, 256, draw('c'));
  const alp = tex(256, 256, draw('a'));
  alp.colorSpace = THREE.NoColorSpace;
  return [col, alp];
}

/* the blue light projected across the screen after dark — irregular vertical
   filaments, so the night roof reads as a light show and not a blue wall */
function texScreenGlow() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#040a18'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(5501);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const x0 = rnd() * w, amp = 8 + rnd() * 34;
      g.strokeStyle = `rgba(${60 + rnd() * 60 | 0},${150 + rnd() * 90 | 0},255,${.22 + rnd() * .5})`;
      g.lineWidth = 1.5 + rnd() * 5;
      g.beginPath();
      for (let y = 0; y <= h; y += 8) {
        const x = x0 + Math.sin(y / (26 + rnd() * 6) + i) * amp;
        y ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    for (let i = 0; i < 90; i++) {          // sparkle where the filaments cross
      g.fillStyle = `rgba(190,235,255,${.2 + rnd() * .6})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, .8 + rnd() * 2.4, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/* ── THE ROOFTOP BAR's cladding, two maps ───────────────────────────────────
   reference/photos/rooftop-bar-night.png / rooftop-bar-dusk.png. The bar
   volume is clad in vertical white perforated panels; by day they read as a
   fine dot-punched skin, after dark the whole run is washed with electric-blue
   water-caustic projections. Same recipe as the lattice screen behind the
   daybeds: the wash is an EMISSIVE MAP on the panel material (MAT.rtBarPanel),
   lifted after dark through the glow() registry — never a light. Both drawings
   are non-directional noise, so CanvasTexture.flipY needs no flipRows here. */
function texBarPerf() {
  return tex(128, 128, (g, w, h) => {
    g.fillStyle = '#f1eee5'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8151), N = 12, cell = w / N;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const jx = (rnd() - .5) * 1.4, jy = (rnd() - .5) * 1.4;
      g.fillStyle = `rgba(98,100,106,${.42 + rnd() * .3})`;
      g.beginPath();
      g.arc(c * cell + cell / 2 + jx, r * cell + cell / 2 + jy, cell * .15, 0, Math.PI * 2);
      g.fill();
    }
    /* a bright seam down one edge so each instanced panel reads as a panel */
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(0, 0, 2.5, h);
  });
}

/* the caustic ripple itself: jittered nested rings pulled about by two sine
   fields, 'lighter'-composited over near-black so the crossings flare — the
   ridged-cell read of light through water, in the refs' electric blue.
   Seeded via mulberry32 (house rule: never Math.random). */
function texBarCaustic() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#020817'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(8102);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const cx = rnd() * w, cy = rnd() * h, r0 = 10 + rnd() * 40;
      const wob = 2.5 + rnd() * 6, ph = rnd() * Math.PI * 2;
      g.strokeStyle = `rgba(${50 + rnd() * 70 | 0},${140 + rnd() * 80 | 0},255,${.16 + rnd() * .3})`;
      g.lineWidth = 1.2 + rnd() * 2.8;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        for (let a = 0; a <= 40; a++) {
          const t = a / 40 * Math.PI * 2;
          const rr = r0 + k * 7 + Math.sin(t * 3 + ph) * wob + Math.sin(t * 5 - ph) * wob * .6;
          const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr * .82;
          a ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.closePath(); g.stroke();
      }
    }
    for (let i = 0; i < 70; i++) {            // flare where the ridges cross
      g.fillStyle = `rgba(190,235,255,${.18 + rnd() * .5})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, .8 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  });
}

/* ── THE LIVE-BAND STAGE's canopy panels, three maps ────────────────────────
   reference/photos/rooftop-bar-live-band.webp. Each panel is a white sheet
   punched with a CHEVRON lattice — rows of small triangles, alternating apex-up
   and apex-down — and framed by a continuous warm-gold LED line.

   ⚠ The perforation is drawn SYMMETRIC about the horizontal centre line on
   purpose. CanvasTexture.flipY is true, so a directional row-wise drawing comes
   out upside down (the flipRows trap that cost the hotel facade a pass); an
   up/down triangle lattice is its own mirror image, so there is nothing to get
   wrong. The gold frame is symmetric for the same reason.

   Returns [colour, alpha, goldEdge]: the alpha map cuts the punched triangles
   AND keeps a solid margin all round (the LED has to have something to sit on);
   the gold edge is the emissiveMap. */
function texStagePanelPair() {
  const M = .085;                                    // solid margin, as a fraction
  const holes = (g, w, h, fill) => {
    const rows = 9, cols = 5;
    const x0 = w * M, y0 = h * M, ww = w * (1 - 2 * M), hh = h * (1 - 2 * M);
    const cw = ww / cols, ch = hh / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      /* two triangles per cell, one apex-up one apex-down → the pattern is its
         own vertical mirror, so flipY cannot invert it */
      for (const up of [true, false]) {
        const cx = x0 + c * cw + cw * (up ? .27 : .73), cy = y0 + r * ch + ch / 2;
        const a = cw * .21, b = ch * .30;
        g.fillStyle = fill;
        g.beginPath();
        if (up) { g.moveTo(cx, cy - b); g.lineTo(cx + a, cy + b); g.lineTo(cx - a, cy + b); }
        else { g.moveTo(cx, cy + b); g.lineTo(cx + a, cy - b); g.lineTo(cx - a, cy - b); }
        g.closePath(); g.fill();
      }
    }
  };
  const col = tex(128, 256, (g, w, h) => {
    g.fillStyle = '#f7f3ea'; g.fillRect(0, 0, w, h);
    holes(g, w, h, 'rgba(96,98,104,.62)');           // the punched holes read dark
    g.strokeStyle = 'rgba(216,206,188,.9)'; g.lineWidth = 3;
    g.strokeRect(w * .05, h * .028, w * .90, h * .944);
  });
  const alp = tex(128, 256, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    holes(g, w, h, '#000');                          // black = cut away
  });
  alp.colorSpace = THREE.NoColorSpace;
  /* the LED: a warm-gold band inset from the panel's border, everything else
     black, so only the outline lights */
  const edge = tex(128, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const grad = ['rgba(255,150,20,.35)', 'rgba(255,196,74,1)', 'rgba(255,232,168,1)'];
    const insets = [[.012, 5.5], [.030, 3.0], [.044, 1.4]];
    for (let i = 0; i < 3; i++) {
      const [ins, lw] = insets[i];
      g.strokeStyle = grad[i]; g.lineWidth = lw * (h / 256);
      g.strokeRect(w * (ins + .02), h * ins, w * (1 - 2 * (ins + .02)), h * (1 - 2 * ins));
    }
  });
  return [col, alp, edge];
}

/* the star-points in the pool floor at night (the second half of the night
   photograph: the water is speckled with pin-lights). Alpha-tested dots on a
   sheet 20 mm over the basin, hidden entirely by day. */
function texStarField() {
  const draw = mode => (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(2207);
    for (let i = 0; i < 260; i++) {
      const r = .8 + rnd() * 2.0, a = mode === 'a' ? 1 : .55 + rnd() * .45;
      g.fillStyle = mode === 'a' ? '#fff' : `rgba(180,240,255,${a})`;
      g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2); g.fill();
    }
  };
  const col = tex(256, 256, draw('c'));
  const alp = tex(256, 256, draw('a'));
  alp.colorSpace = THREE.NoColorSpace;
  return [col, alp];
}

/* ════════════════════════════════════════════════════════════════════════
   materials — built once per buildCampus() call
   ════════════════════════════════════════════════════════════════════════ */
function makeMaterials() {
  const warmTimber = texWarmTimber();
  const stucco = texStucco(), roof = texRoof(), deck = texDeck(), slat = texSlat();
  const marble = texMarble(), paver = texPaver(), stone = texStone(), turf = texTurf();
  const hotelFace = texHotelFacade(), hotelWin = texHotelWindows(), sign = texSign();
  const hotelScreen = texHotelScreen();
  const lattice = texLatticePair(), screenGlow = texScreenGlow(), stars = texStarField();
  const barPerf = texBarPerf(), barCaustic = texBarCaustic();
  const stagePanel = texStagePanelPair();

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
    /* KAN-208 wave 2: the clipped hedges wear nature.js's photograph
       (hedge.webp), not a flat faceted green. Built WITH a map from the start
       (a canvas stand-in of the same mean colour) — a map handed over later
       is a recompile — and photoTex() swaps the photograph in on load. White
       base so the picture carries the hue (its mean is balanced to #305027,
       the old flat 0x2f5a2c); tint() still derives the night colour from it,
       which lands where the old one did (0x5c6b86 × the same mean). Not
       flatShading any more: the Blender hedge prototypes are smooth. */
    hedge: tint(new THREE.MeshStandardMaterial({ map: texHedgeStandIn(), color: 0xffffff, roughness: .95 }), 0x5c6b86),
    bougain: tint(new THREE.MeshStandardMaterial({ color: 0xbf3f79, roughness: .92, flatShading: true }), 0x7a6a8c),
    white: tint(new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: .72 }), 0x8f96a6),
    umbrella: tint(new THREE.MeshStandardMaterial({ color: 0x1f8fa5, roughness: .85, side: THREE.DoubleSide }), 0x76839a),
    blackstone: tint(new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: .3, metalness: .18 }), 0x99a1b2),

    /* ── the guest keys' interiors ────────────────────────────────────────
       The keys became rooms you can walk into on 2026-08-02, and a room you
       walk into at night with no light in it is a black box — which is what
       the first pass shipped. There are already 29 point lights on this
       campus, so ten more (one per key) is not free: every MeshStandardMaterial
       in the scene pays for each of them. These two are the cheap answer — a
       warm emissive on the FLOOR and the CEILING only, which are the two
       surfaces you cannot see from outside the building, so the volumes still
       read as white stucco from the air while the doorways and the folding
       glass glow from within. */
    roomFloor: glow(new THREE.MeshStandardMaterial({
      map: retile(marble, 3, 3), roughness: .28, metalness: .04,
      emissive: 0xffb877, emissiveIntensity: 0,
    }), 0, .30),
    roomCeil: glow(new THREE.MeshStandardMaterial({
      map: retile(slat, 3, 3), color: 0x9c7550, roughness: .74,
      emissive: 0xffc38a, emissiveIntensity: 0,
    }), 0, .5),
    /* backdrop-only water for the far resort villas' plunge pools — water.js
       owns every pool you can actually reach; these are just turquoise dots
       seen from the air, and must never cost a reflection pass */
    villaWater: tint(new THREE.MeshStandardMaterial({
      color: 0x2fa8b8, roughness: .12, metalness: .1,
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
    /* the porte-cochère's ribs. Muted blue-STEEL, not the bright cobalt the
       first pass used — in the reference photo the wave roof is a cool
       gunmetal that only reads blue against the white screen behind it. */
    waveCanopy: tint(new THREE.MeshStandardMaterial({ color: 0x6d8398, roughness: .44, metalness: .38,
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
    /* the ARRIVAL face — the white perforated screen, seen from the east */
    hotelBack: tint(new THREE.MeshStandardMaterial({ map: hotelScreen, roughness: .88 }), 0x5e6572),
    /* the crescent's two blank end walls and the tall sky-bar block at its
       north tip: plain white concrete, no screen, no glazing pattern */
    hotelEnd: tint(new THREE.MeshStandardMaterial({ color: 0xeceadf, roughness: .84 }), 0x656c7a),
    /* the bronze circulation cores that break the arc into segments. Warm,
       satin, slightly proud of the facade — the only non-white vertical on the
       whole elevation and the thing that stops 142 m of arc reading as one
       endless band. DoubleSide: it rides the concave face, which is seen from
       INSIDE the cylinder. */
    hotelCore: tint(new THREE.MeshStandardMaterial({
      color: 0x6f5238, roughness: .6, metalness: .22, side: THREE.DoubleSide }), 0x6e6a74),
    /* the white balcony parapets, one open cylinder per floor at the slab's
       outer edge. These are the only part of the balcony rhythm that is real
       geometry, and they are what makes the arc read as balconies rather than
       as a printed texture when the sun rakes across it. */
    hotelRail: tint(new THREE.MeshStandardMaterial({
      color: 0xf3f0e7, roughness: .76, side: THREE.DoubleSide }), 0x8f96a6),
    /* the lobby/restaurant glazing wrapping the podium, deep in its own shadow.
       Warm inside after dark, like every other window on the campus. */
    hotelPodGlass: glow(new THREE.MeshStandardMaterial({
      color: 0x22343a, roughness: .12, metalness: .2, side: THREE.BackSide,
      emissive: 0xffbb72, emissiveIntensity: 0 }), 0, 1.15),

    /* ── the rooftop brunch terrace + infinity pool ─────────────────────────
       Every one of these lands on an arcBand() ribbon or an open cylinder, so
       the maps are re-tiled for "u across the band, v along the crescent". */
    /* pale travertine, NOT the campus's dark basalt paver — a sun deck people
       walk on barefoot, and the light ground is what makes the white furniture
       and the turquoise read from 285 m */
    rtPave: tint(new THREE.MeshStandardMaterial({ map: retile(stone, 3.4, 1), roughness: .9 }), 0x767d8c),
    /* the balustrade needs to be SEEN — MAT.clear (opacity .22) vanishes at any
       distance, and a terrace whose edge you can't see reads as walking off
       into space. A touch more body + a copper cap rail + fin posts. */
    rtGlass: new THREE.MeshStandardMaterial({
      color: 0xcadde4, roughness: .04, metalness: .22,
      transparent: true, opacity: .34, side: THREE.DoubleSide,
    }),
    /* the 1.4 m plinth the terrace sits on: its OUTER face is seen from the
       east, its INNER face from inside the crescent's cylinder (BackSide,
       same trick as hotelFacade/hotelPodium) */
    rtPlinth: tint(new THREE.MeshStandardMaterial({ map: retile(stone, 30, 1), roughness: .9 }), 0x818898),
    rtPlinthIn: tint(new THREE.MeshStandardMaterial({
      map: retile(stone, 30, 1), roughness: .9, side: THREE.BackSide }), 0x818898),
    rtTeak: tint(new THREE.MeshStandardMaterial({ map: retile(deck, 2.2, 1), roughness: .78 }), 0x7f7c8a),
    rtCoping: tint(new THREE.MeshStandardMaterial({ map: retile(marble, 1, 1), roughness: .26 }), 0x8b91a2),
    rtSlat: tint(new THREE.MeshStandardMaterial({ map: retile(slat, 1.6, 1), roughness: .64,
      side: THREE.DoubleSide }), 0x8e8b9c),
    rtBasin: tint(new THREE.MeshStandardMaterial({
      map: texRipple(), roughness: .2, metalness: .06, side: THREE.DoubleSide,
    }), 0x5f7590),
    rtWater: new THREE.MeshStandardMaterial({
      color: 0x2bb0c6, roughness: .08, metalness: .12,
      transparent: true, opacity: .64, emissive: 0x1ea6c4, emissiveIntensity: 0,
      side: THREE.DoubleSide, depthWrite: false,
    }),
    /* the sheet of water falling off the infinity lip — lit from beneath at night */
    rtSpill: new THREE.MeshStandardMaterial({
      color: 0xdff3f6, roughness: .16, metalness: .1, transparent: true, opacity: .46,
      emissive: 0xa9e6f2, emissiveIntensity: 0, side: THREE.BackSide, depthWrite: false,
    }),
    /* underwater niche lights + the coping wash: cool, unlike every other
       emissive on the campus, which is what makes the roof read at 285 m */
    poolGlow: new THREE.MeshStandardMaterial({ color: 0x0e1a1e, emissive: 0x63e3ff, emissiveIntensity: 0 }),
    /* the cove reveal under the terrace lip. It rides the crescent's CONCAVE
       face, so like hotelFacade it is seen from inside the cylinder → BackSide.
       This one line is what makes the roof read from the enclave after dark:
       the water itself is edge-on and invisible from 285 m at 6° of elevation. */
    rtCove: new THREE.MeshStandardMaterial({
      color: 0x0e1a1e, emissive: 0x63e3ff, emissiveIntensity: 0, side: THREE.BackSide }),
    rtCoveWarm: new THREE.MeshStandardMaterial({
      color: 0x1a1a1c, emissive: 0xffc27a, emissiveIntensity: 0, side: THREE.BackSide }),

    /* ── the perforated lattice screen wall behind the cabana daybeds ────────
       alphaTest, not transparent: the holes are real geometry-free voids, they
       sort correctly against the sea and the sky at every angle, and 60 blades
       cost one opaque draw call instead of a blended pass. The emissiveMap is
       the night blue-light wash — zero by day, so the same panels are a plain
       white screen at noon and a projection surface after dark. */
    rtScreen: new THREE.MeshStandardMaterial({
      map: lattice[0], alphaMap: lattice[1], alphaTest: .55,
      color: 0xffffff, roughness: .82, metalness: .02, side: THREE.DoubleSide,
      emissive: 0x3f8dff, emissiveMap: screenGlow, emissiveIntensity: 0,
    }),
    /* the star-points on the pool floor. Same trick, on a sheet 20 mm over the
       basin: alphaTest cuts everything but the dots, and by day the dots are a
       barely-there fleck in the tile. */
    rtStars: new THREE.MeshStandardMaterial({
      map: stars[0], alphaMap: stars[1], alphaTest: .5,
      color: 0x8fd8ee, roughness: .5, side: THREE.DoubleSide,
      emissive: 0xa9edff, emissiveIntensity: 0, depthWrite: false,
    }),

    /* ── the ROOFTOP BAR — the terrace's NORTH room ─────────────────────────
       rtBarPanel follows MAT.rtScreen exactly: a white panel by day, and after
       dark the emissiveMap (texBarCaustic) lifts through the same glow()/tint()
       night wiring, so the bar volume becomes the refs' blue caustic lantern
       for FREE — no lights (see the measured fps note at the screen wall). */
    rtBarPanel: new THREE.MeshStandardMaterial({
      map: barPerf, color: 0xffffff, roughness: .74, metalness: .04,
      emissive: 0x3fa6ff, emissiveMap: barCaustic, emissiveIntensity: 0,
    }),
    /* dark timber decking — the same plank map as the pool half's teak,
       multiplied down to the refs' near-espresso boards, so the two rooms
       read as two floors from the first frame */
    rtDarkTeak: tint(new THREE.MeshStandardMaterial({
      map: retile(deck, 2.2, 1), color: 0x6a4c33, roughness: .84 }), 0x8a879a),
    /* woven/rattan-toned dining chairs (white cushions ride MAT.white) */
    rattan: tint(new THREE.MeshStandardMaterial({ color: 0xb08a5c, roughness: .93 }), 0x8a8194),
    /* ── the live-band stage's canopy panels ────────────────────────────────
       White perforated shields outlined in warm gold LED. alphaTest (not
       transparent) for exactly the reasons MAT.rtScreen is: the punched
       triangles must be real holes that sort correctly against a dusk sky, and
       one opaque draw call beats a blended pass over 20 panels.
       ⚠ The gold is an EMISSIVE MAP, not a light. The campus's point-light
       budget is capped (js/lightbudget.js) and two extra rooftop lights were
       measured at 13–18 % of the frame rate in EVERY view; this whole alcove
       costs zero lights. Its day intensity is deliberately non-zero — the
       reference is dusk and the LED is already burning in it. */
    rtStagePanel: new THREE.MeshStandardMaterial({
      map: stagePanel[0], alphaMap: stagePanel[1], alphaTest: .5,
      color: 0xffffff, roughness: .78, metalness: .03, side: THREE.DoubleSide,
      emissive: 0xffb347, emissiveMap: stagePanel[2], emissiveIntensity: 0,
    }),
    /* the dense green living wall behind the band. Deeper and flatter than the
       campus hedge so it reads as a planted WALL rather than clipped topiary. */
    living: tint(new THREE.MeshStandardMaterial({
      color: 0x2a5228, roughness: 1, flatShading: true }), 0x4e5d78),
    /* the back-bar's bottles. ⚠ WHITE base on purpose — per-instance tints ride
       this bucket and a dark base crushes them all to black (the cocktail-bar
       gotcha, 2026-08-03). */
    bottle: tint(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: .16, metalness: .06 }), 0x8b93a4),

    /* ── THE ARRIVAL PAVILION (entrance-arrival-brief.md) ───────────────────
       Dark corten AS FILMED — Carl settled the palette conflict: this volume
       is an intentional dark accent against the white clubhouse. */
    corten: tint(new THREE.MeshStandardMaterial({ map: texCorten(), roughness: .62, metalness: .34 }), 0x707784),
    bands: tint(new THREE.MeshStandardMaterial({ map: texBands(), roughness: .44, metalness: .12 }), 0x7d8494),
    /* near-black polished stone — the stair, landing, vestibule, plinths */
    blackPolish: tint(new THREE.MeshStandardMaterial({
      color: 0x1b1e21, roughness: .18, metalness: .1 }), 0x99a1b2),
    forePave: tint(new THREE.MeshStandardMaterial({ map: texForePave(), roughness: .94 }), 0x767d8c),
    sett: tint(new THREE.MeshStandardMaterial({ map: texSett(), roughness: .93 }), 0x6f7684),
    settInlay: tint(new THREE.MeshStandardMaterial({ map: texInlay(), roughness: .92 }), 0x8a8494),
    /* white-based flat-shaded planting bucket — instance colours carry the
       species (frangipani greens, cordyline maroon, ixora red, dracaena).
       ⚠ WHITE base on purpose: a dark base crushes instance tints to black
       (the cocktail-bar gotcha). */
    plantFlat: tint(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true }), 0x5c6b86),
    arrTrunk: tint(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9 }), 0x6f7688),
    /* ── the two-storey pavilion: 酒廊 lounge below, check-in lobby above ───
       reference/photos/clubhouse-lounge-checkin-balcony.jpg */
    warmSoffit: tint(new THREE.MeshStandardMaterial({ map: warmTimber, roughness: .74 }), 0x7a6a68),
    warmDeck: tint(new THREE.MeshStandardMaterial({ map: retile(warmTimber, 8, 8), roughness: .84 }), 0x776a6a),
    loungeFloor: tint(new THREE.MeshStandardMaterial({ map: retile(warmTimber, 6, 12), roughness: .5 }), 0x7a6c6a),
    lobbyFloor: tint(new THREE.MeshStandardMaterial({ map: retile(warmTimber, 6, 12), roughness: .42 }), 0x7a6c6a),
    charcoal: tint(new THREE.MeshStandardMaterial({ map: texCharcoal(), roughness: .82 }), 0x656b76),
    stoneCap: tint(new THREE.MeshStandardMaterial({ color: 0x9d968c, roughness: .78 }), 0x767d8c),
    cabinet: tint(new THREE.MeshStandardMaterial({ map: texCabinet(), roughness: .68 }), 0x8f96a6),
    rugWave: tint(new THREE.MeshStandardMaterial({ map: texRugWave(), roughness: .96 }), 0x5d6b86),
    slatWarm: tint(new THREE.MeshStandardMaterial({ color: 0xb99257, roughness: .78 }), 0x8a8194),
    ivory: tint(new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .84 }), 0x8b91a2),
    ivoryWarm: tint(new THREE.MeshStandardMaterial({ color: 0xdfd6c3, roughness: .88 }), 0x878da0),
    /* sheer cream curtains — behind every closed bay of both glass walls */
    sheer: new THREE.MeshStandardMaterial({
      color: 0xf2ebda, roughness: .95, transparent: true, opacity: .42,
      side: THREE.DoubleSide, depthWrite: false }),
    /* the staff. No faces: a body, a head, and the venue's palette. */
    uniform: tint(new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: .86 }), 0x71788a),
    uniformTop: tint(new THREE.MeshStandardMaterial({ color: 0xd9cfb8, roughness: .88 }), 0x878da0),
    skin: tint(new THREE.MeshStandardMaterial({ color: 0xc79b78, roughness: .9 }), 0x7d7f8c),
    hair: tint(new THREE.MeshStandardMaterial({ color: 0x241c17, roughness: .92, flatShading: true }), 0x6a7080),
  };
  /* the arrival's emissives — canopy downlights + fluted brass sconces read
     WARM even in daylight in the video (f_007–f_009), so day intensity > 0 */
  const flute = texFlute();
  m.brassFlute = glow(new THREE.MeshStandardMaterial({
    map: flute, emissive: 0xffc06a, emissiveMap: flute,
    roughness: .35, metalness: .55 }), .5, 2.2);
  m.arrDown = glow(new THREE.MeshStandardMaterial({
    color: 0x14110c, emissive: 0xffd9a0 }), .9, 2.6);
  m.lampShade = glow(new THREE.MeshStandardMaterial({
    color: 0xf3e6cd, emissive: 0xffca86, roughness: .9 }), .35, 1.9);
  const loungePl = texLoungePlaque();
  m.loungePlaque = glow(new THREE.MeshStandardMaterial({
    map: loungePl, emissive: 0xffffff, emissiveMap: loungePl, roughness: .55 }), .08, .8);
  const plaque = texPlaque();
  m.plaque = glow(new THREE.MeshStandardMaterial({
    map: plaque, emissive: 0xffffff, emissiveMap: plaque, roughness: .5 }), .1, 1.0);
  /* the lagoon swim-up bar's counter lettering. A whisper by day, lit after
     dark like every other sign on this campus — and, like them, an EMISSIVE
     rather than a light: js/lightbudget.js caps the visible point lights at 12
     and this pass adds none. */
  const poolBar = texPoolBar();
  m.poolBar = glow(new THREE.MeshStandardMaterial({
    map: poolBar, emissive: 0xffffff, emissiveMap: poolBar, roughness: .62,
    side: THREE.DoubleSide }), .12, .95);
  glow(m.rtScreen, 0, 1.45);
  tint(m.rtScreen, 0xa9b6cc);
  glow(m.rtBarPanel, 0, 1.8);
  tint(m.rtBarPanel, 0xa9b6cc);
  /* the stage LED burns at dusk in the reference, so it is lit by day too */
  glow(m.rtStagePanel, .85, 3.6);
  tint(m.rtStagePanel, 0xb3bccc);
  glow(m.rtStars, 0, 3.4);
  glow(m.rtCove, .04, 3.0);
  glow(m.rtCoveWarm, .04, 2.6);
  tint(m.rtGlass, 0x8a97a8);
  tint(m.rtWater, 0x6f8fa0);
  glow(m.rtWater, .02, .95);
  glow(m.rtSpill, .05, 1.25);
  glow(m.poolGlow, .05, 3.1);
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
/* ⚠⚠ ONE BUCKET KEY PER (GEOMETRY, MATERIAL) PAIR. NO EXCEPTIONS. ⚠⚠
   The FIRST call for a key binds BOTH `geo` and `mat` for the whole build —
   every later call with that key contributes only a MATRIX, and its own
   geometry and material arguments are silently thrown away. So
       inst('tableI', UNIT_BOX, MAT.teak,  …)     ← binds teak
       inst('tableI', UNIT_BOX, MAT.dark,  …)     ← draws in TEAK, not dark
   renders the legs in the top's material and nothing anywhere throws, warns or
   looks broken enough to notice — it just quietly renders the wrong building.

   This has now bitten the project TWICE. 2026-08-04 found it in `buildArrival`
   and left it (it changes the look, which wanted Carl's eye); the fix pass on
   2026-08-06 found 15 collided keys across this file, including the check-in
   staff — five parts in four materials and three geometries, ALL drawn as one
   dark cylinder — and the buffet's marble top drawn as dark teak.

   The rule when you add an instance: if the pair is new, the KEY is new. Name
   the key after the part, never after the room (`arrTableI` + `arrTableLegI`,
   not one `arrTableI`), and if you are unsure, run the census in
   `flushBuckets`'s comment below — it is one grep over this file.

   (Splitting a key is free: it costs one extra InstancedMesh, draws no `rnd()`
   and moves no instance. It is never a reason to reuse one.) */
function inst(key, geo, mat, m, color = null) {
  let b = BUCKETS.get(key);
  if (!b) { b = { geo, mat, ms: [], cs: [], any: false }; BUCKETS.set(key, b); }
  b.ms.push(m); b.cs.push(color);
  if (color) b.any = true;
  return b;
}

/* ── A GLB BUCKET — inst() for a Blender-authored prop ──────────────────────
   `have(name)` is the ONE gate (assets/blender/INTEGRATION.md §1): true only
   when the GLB actually loaded AND came in as a single mesh. Every call site
   below keeps its old primitive path as the `else` branch — models.preload()
   never rejects, so a missing GLB must degrade to boxes, not to a black roof.

   `modelI` routes the model's own geometry + its own baked-atlas material into
   the SAME BUCKETS map, so the flush, the census and the enclave relocation
   pass all treat it like any other instanced part. It obeys the rule over
   inst() by construction and then some: a GLB carries BOTH halves of the pair,
   so its key can never be shared with a primitive bucket OR with another
   model — one new key per model, named `<room><Model>GlbI`.

   ⚠ Never pass a `color` to a baked-albedo model: instanceColor MULTIPLIES the
   map, so anything but white darkens the bake. `canopy_tint` is the one
   documented exception and it is water.js's, not ours. */
const have = (name) => models.has(name) && !!models.geometry(name);
function modelI(key, name, m) {
  return inst(key, models.geometry(name), models.material(name), m);
}
/* The rooftop parasol's canopy (`roof_parasol_canopy`, KAN-208 wave 1) is the
   ONE baked model on this roof that takes a colour: its sole key is
   `canopy_tint`, a PURE WHITE bake, and the teal is ours. ONE clone of it,
   coloured MAT.umbrella's day teal and put on the night-tint registry with the
   same night multiplier the cones had — so the parasols dim with the roof. The
   clone shares the bake's program (same map, same side), which is why the
   program count does not move. Built lazily INSIDE buildWorld, after the night
   registry has been reset. */
let _roofCanopyMat = null;
function roofCanopyMat() {
  if (!_roofCanopyMat) {
    _roofCanopyMat = models.material('roof_parasol_canopy').clone();
    _roofCanopyMat.color.copy(MAT.umbrella.color);   // built by day: the day teal
    tint(_roofCanopyMat, 0x76839a);                   // MAT.umbrella's own night tint
  }
  return _roofCanopyMat;
}
/* stand one rooftop parasol: `m` is the pole-foot matrix, shared by both halves */
function roofParasolI(m) {
  modelI('rtParasolGlbI', 'roof_parasol', m);
  inst('rtParasolCanopyGlbI', models.geometry('roof_parasol_canopy'), roofCanopyMat(), m);
}
const haveRoofParasol = () => have('roof_parasol') && have('roof_parasol_canopy');

/* HOW TO CENSUS THE KEYS (the check that proves the rule above still holds):
   collect every call site's (key, geometry, material) triple and group by key —
   any key carrying two distinct triples is a part rendering in the wrong
   geometry or finish. Two things make a naive grep of `inst(` wrong, and both
   have already hidden a real bug here:
     · THERE IS ONE BUCKETS MAP for the whole builder and flushBuckets() runs
       ONCE, at the end of buildCampus — so keys are shared across every
       function in this file, not just within one. `hedgeI` was bound to
       UNIT_BLOB by buildVillas 200 lines before buildGrassGround asked it for
       a UNIT_BOX, and buildGrassGround's hedge run drew blobs.
     · SEVERAL CALL SITES FORWARD to inst() through a local helper — buildVillas
       and buildSecondPoolPavilion's `put(key, geo, mat, …)`, the car's
       `put(key, mat, …)`, the rooftop dining chair's `at(…, key, mat)` and the
       band's `figure(v, topKey, topMat, …)`. Their literals count too.
     · SINCE THE GROUP E PASS there is a SIXTH form, `modelI(key, 'model', m)`.
       Both halves of its pair are the model, so count it as the triple
       (glb:model, glb:model) — a reused modelI key collides with everything.
     · AND SINCE GROUP F a SEVENTH: buildSwimUpBar's `putM(key, 'model', u, y,
       v)`, which is that function's (u, v) frame wrapped round modelI. Count
       it exactly like modelI; a naive grep for `modelI(` sees only the one
       non-literal forwarding call inside the helper and misses both sites.
   Census all seven forms together, in one namespace, and ignore comments (this
   one included). Clean as of 2026-08-06: 138 keys, 0 collisions; as of
   2026-09-18 (the resort furniture): 146 keys, 0 collisions; as of
   2026-09-20 (the pool wave, +subBarGlbI +subStoolGlbI): 148 keys, 0; and as
   of 2026-09-20 (the interiors, +arrSofaGlbI): 149 keys, 0 — 420 placements
   over seven call forms. */
/* ── KAN-208 wave 2: the clipped-hedge buckets take Blender PROTOTYPES ─────────
   Every call site still says UNIT_BOX / UNIT_BLOB and still pushes the same
   matrix — the swap happens HERE, per key, at flush time. Each prototype keeps
   the unit envelope of the primitive it replaces (±0.5, centred), so no
   matrix, collider or rnd() draw changes, and ONE key still means ONE
   (geometry, material) pair — the census rule above holds by construction.
   GEOMETRY ONLY: MAT.hedge stays ours (hedge.webp). A missing GLB leaves the
   primitive. */
const HEDGE_PROTO = {
  hedgeI: 'hedge_block', arrHedgeI: 'hedge_block', spHedgeI: 'hedge_block',
  hedgeBlobI: 'hedge_mass',
  topiaryI: 'topiary_ball', spTopiaryI: 'topiary_ball',
};
/* ── KAN-208 wave 4: the casuarina tiers and the villa-wall bougainvillea ─────
   Same move, same place. `casuLeafI` takes `casuarina_tier` (drooping needle
   curtains in ConeGeometry(.5, 1)'s exact envelope, no base cap); the three
   bougainvillea keys take `shrub_core` at .5 (UNIT_BLOB is radius .5, the GLB
   radius 1) and gain a leaf-card FRINGE bucket on the same matrices
   (js/foliage.js — boug_leaf.webp, the palm fronds' program, no instance
   colour). The fringe is not a BUCKETS key: it is born here from the finished
   bucket, so the census is unchanged, and world.js relocates its instances
   one by one exactly as it does the core's (same positions, same verdict). */
const WAVE4_PROTO = {
  casuLeafI: ['casuarina_tier', 1],
  bougain: ['shrub_core', .5], bougI: ['shrub_core', .5], subBougI: ['shrub_core', .5],
  /* KAN-211 wave E: the sea band's accents. `agaveI` — each of a rosette's
     eight cone instances becomes a FAN OF THREE keeled blades (`agave_leaf`,
     in ConeGeometry(.5, 1)'s exact envelope) on agaveMat, same matrices, same
     rndB() draws. `crotonI` — the flat orange blob becomes the shrub core
     (.5 clone, UNIT_BLOB is r .5) on crotonMat with its per-instance mottle,
     plus a croton leaf-card fringe (croton_leaf.webp) on the same matrices. */
  agaveI: ['agave_leaf', 1],
  crotonI: ['shrub_core', .3],     // a SMALL core: the croton is its cards (see FRINGE_VARIANTS)
  /* and the arrival terrace's planted batter (its green blobs; see retain()) */
  arrBatterShrubI: ['shrub_core', .5],
};
/* the croton's blob is tall and stands off the ground, so its cards reach
   down its flank (croton_fringe: 26 cards to y −.8, the same lobes) */
const FRINGE_VARIANTS = { crotonI: ['croton_fringe'] };
const WAVE4_FRINGE = {
  bougain: 'boug', bougI: 'boug', subBougI: 'boug', crotonI: 'croton', arrBatterShrubI: 'shrub',
};
/* …and the bougainvillea CORE trades MAT.bougain (a flat-shaded solid pink —
   under the cards it still read as a pink plastic ball, and it is shared with
   the band's guitarist, so it is not ours to change) for nature.js's own
   bougainvillea photograph, boug.webp, on a white base. Instanced + map, no
   instance colour: a program the hedge buckets already compile. Built with a
   canvas map from the start (photoTex's rule), once, lazily inside buildWorld
   so tint() registers it after the night registry reset. */
let _bougPhotoMat = null;
function bougPhotoMat() {
  if (!_bougPhotoMat) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 4;
    const c = cv.getContext('2d'); c.fillStyle = '#6a3048'; c.fillRect(0, 0, 4, 4);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    _bougPhotoMat = tint(new THREE.MeshStandardMaterial({ color: 0xffffff, map: t, roughness: .88 }), 0x6b5878);
    photoTex(_bougPhotoMat, 'boug.webp', [2, 2]);
  }
  return _bougPhotoMat;
}
function flushBuckets(parent) {
  for (const [key, b] of BUCKETS) {
    if (!b.ms.length) continue;
    const proto = HEDGE_PROTO[key];
    if (proto && models.has(proto) && models.geometry(proto)) b.geo = models.geometry(proto);
    const p4 = WAVE4_PROTO[key], g4 = p4 && protoGeo(p4[0], p4[1]);
    if (g4) b.geo = g4;
    if (g4 && WAVE4_FRINGE[key] === 'boug') b.mat = bougPhotoMat();
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
    if (g4 && WAVE4_FRINGE[key]) {
      fringeFor(im, FRINGE_VARIANTS[key] || ['shrub_fringe', 'shrub_fringe_b'],
        leafMat(WAVE4_FRINGE[key]), parent, 'campus:' + key + 'Fringe', .5);
    }
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

/* ── colliders: chains of {x,z,r} circles, house pattern ──
   `yr` is the optional {y0,y1} feet-height window from the collider contract in
   player.js. Omitted = blocks at every height, which is every collider on this
   campus except the crescent's and the rooftop's. */
function colliderLine(list, x1, z1, x2, z2, r, yr) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(len / r));
  for (let i = 0; i <= n; i++) {
    const c = { x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r };
    list.push(yr ? Object.assign(c, yr) : c);
  }
}
/** A chain of circles along an ARC about (cx,cz) — the rooftop's natural shape. */
function colliderArc(list, cx, cz, rad, t0, t1, r, yr, step) {
  const st = step || r * 0.9;
  const n = Math.max(1, Math.ceil(Math.abs(t1 - t0) * rad / st));
  for (let i = 0; i <= n; i++) {
    const th = t0 + (t1 - t0) * i / n;
    const c = { x: cx + Math.sin(th) * rad, z: cz + Math.cos(th) * rad, r };
    list.push(yr ? Object.assign(c, yr) : c);
  }
}
/** a rotated rectangle's four sides, in world space */
function rectCollider(list, cx, cz, w, d, ry, r, yr) {
  const c = Math.cos(ry), s = Math.sin(ry), hx = w / 2, hz = d / 2;
  const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const a = P(-hx, -hz), b = P(hx, -hz), e = P(hx, hz), f = P(-hx, hz);
  colliderLine(list, a[0], a[1], b[0], b[1], r, yr);
  colliderLine(list, b[0], b[1], e[0], e[1], r, yr);
  colliderLine(list, e[0], e[1], f[0], f[1], r, yr);
  colliderLine(list, f[0], f[1], a[0], a[1], r, yr);
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

/** A flat band following the crescent's arc, in the hotel group's own frame
    (origin = arc centre). Radius r ± halfW, sweeping θ from a0 to a1 (a0 < a1
    keeps the normals pointing UP). Built on ribbon() rather than RingGeometry
    on purpose: RingGeometry's UVs are (x,y)/(2·outerRadius), which at r ≈ 100
    squeezes every texture into a 6 % sliver of UV space. */
function arcBand(r, halfW, a0, a1, y, seg = 128, vScale = 6) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const th = a0 + (a1 - a0) * (i / seg);
    pts.push({ x: Math.sin(th) * r, y, z: Math.cos(th) * r });
  }
  return ribbon(pts, halfW, vScale);
}

/* ════════════════════════════════════════════════════════════════════════
   1 · ~~隐逸居酒廊~~ — buildLounge() was DEMOLISHED 2026-08-04
   ────────────────────────────────────────────────────────────────────────
   Carl: *"clubhouse only have one lounge, lets build from scratch and let go
   of the old one when you are done, this should be cleaner build."*

   It built a standalone 20 × 14 m room on a 0.34 m plinth at SITE.LOUNGE
   (−44, −16): three stucco walls, an 8-leaf folding glass door-wall, five
   clerestory slots, a deep flat roof with copper fascia, a slat ceiling with
   cove strips, a bar, a two-step terrace, planters and three point lights.
   The REAL 酒廊 is the GROUND STOREY OF THE ENTRANCE PAVILION (buildArrival,
   section 8 below) — 280.7 ㎡, 60 covers, its own 隐逸居酒廊 / SERENE RETREAT
   LOUNGE plaque, folding glass onto the timber deck and the courtyard, with
   the check-in lobby over it. Two lounges, one clubhouse; this one went.

   ⚠ IT CONSUMED NO rnd() DRAWS — its signature was (G, root), never
   (G, root, rnd) — so removing it does NOT reshuffle any seeded stream in
   this file: buildVillas, buildResortVillas, buildArrival and buildRoad still
   draw from `rnd` in exactly the order they always did. (nature.js's streams
   DO move, deliberately: its lounge hedge screen and the lounge keep-out went
   with the building.)

   Gone with it: the group name 'lounge' in world.js's CAMPUS_ENCLAVE_GROUPS,
   the `lounge-plinth` / `lounge-step` WALK_REGIONS, and atrium.js's east side
   door — which had pointed at nothing since the lounge moved to −X on
   2026-08-01. MAT.loungeFloor / MAT.loungeGlow / MAT.loungePlaque STAY: the
   new 酒廊 uses all three.
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   2 · THE TEN GUEST KEYS, ATTACHED TO THE ATRIUM
   ────────────────────────────────────────────────────────────────────────
   5 Garden Rooms, 3 Garden Pool 2-BR, 2 two-storey Garden 3-BR. Every part
   goes through the instance buckets, so the whole wing costs a handful of
   draw calls.

   Rewritten 2026-08-02 for Carl's "the villa is attached, not detached".
   Three things changed and all three are load-bearing:

   1 · POSITION AND YAW COME FROM site.js's ROOMS, not from a literal here.
       Each key's BACK now lands on the atrium's outer wall face, and its yaw
       points local −Z at the corridor. Local +Z is the front in this builder
       and in water.js's buildVillaPools(), so that one number swings the
       glazing, the deck and the plunge pool to the outside — which is the
       whole of the flip.

   2 · THE KEYS ARE HOLLOW. They were solid stucco boxes ringed by a
       rectCollider: geometry you could look at from a distance. A door you
       cannot walk through is not a door, so each key is now four walls, a
       floor, a ceiling and a fit-out, with a DOORWAY in the back wall lined up
       on the gallery door atrium.js cuts, and the folding glass wall standing
       open at the front onto its own pool.

   3 · NO BACK WALL, NO BACK COLLIDER. The atrium's perimeter facade IS the
       shared wall — one wall, from both sides, with one hole in it. Building a
       second wall behind it (or a collider chain along it) is exactly how a
       shared wall ends up sealing the corridor.

   The size jitter is gone with them: a key whose width is multiplied by a
   random 0.93…1.09 cannot share a wall with anything. Roof tint, wall tint and
   ridge height still vary, which is where the variety actually reads from.
   ════════════════════════════════════════════════════════════════════════ */
function buildVillas(G, root, rnd) {
  const V = SITE.VILLA;
  const T = V.wallT;                 // wall thickness — matches atrium.js
  const FY = V.floorY;               // finished floor over the gallery datum

  for (const R of ROOMS) {
    const { x: vx, z: vz, ry, w: W, d: D, h: H, type } = R;
    const c = Math.cos(ry), s = Math.sin(ry);
    /* local (+z = front / private side, −z = the gallery) → world */
    const W2 = (lx, lz) => [vx + lx * c + lz * s, vz - lx * s + lz * c];
    /** queue an instanced part in villa-local coordinates */
    const put = (key, geo, mat, lx, y, lz, sx, sy, sz, lry = 0, color = null, rx = 0) => {
      const p = W2(lx, lz);
      inst(key, geo, mat, mat4(p[0], y, p[1], sx, sy, sz, ry + lry, rx), color);
    };
    /** a wall-line collider in villa-local coordinates */
    const colL = (ax, az, bx, bz, r = .32, yr) =>
      colliderLine(G.colliders, ...W2(ax, az), ...W2(bx, bz), r, yr);

    /* seeded variation — tints and ridge height only. NOT the footprint. */
    const roofTint = new THREE.Color().setHSL(.075 + rnd() * .05, .04 + rnd() * .07, .40 + rnd() * .20);
    const wallTint = new THREE.Color().setHSL(.10, .05 * rnd(), .87 + rnd() * .10);
    const jitter = (rnd() - .5) * .30;
    const OH = 1.5 + rnd() * .4;               // FRONT eave only — see roofBand
    const HH = H + jitter;                     // ridge height, varied
    const hw = W / 2, hd = D / 2;

    /* the door: `doorAlong` is a coordinate on the atrium face, so convert it
       to an offset along this room's own width. For the north/south arms the
       face runs in world X and local +X maps to −X of the face (ry = π) or +X
       (ry = 0); for the east/west arms it runs in Z. Rather than case-split,
       project the world offset onto the room's local +X axis — one line, and it
       cannot get the sign wrong. */
    const horiz = R.face === 'west' || R.face === 'east';
    const dWorld = horiz ? [0, R.doorAlong - vz] : [R.doorAlong - vx, 0];
    const doorX = dWorld[0] * c - dWorld[1] * s;      // local +X axis is (c, −s)
    const doorHalf = V.doorClear / 2;

    /* ── shared bits ──────────────────────────────────────────────── */
    /* the roof. FLUSH at the back and the sides — the keys in an arm stand
       shoulder to shoulder and an eave over the neighbour is an eave through
       the neighbour, while an eave over the atrium fights its 2F gallery slab
       at exactly the same height. The deep eave lives on the private front,
       where it is the shadow line in the aerial. */
    const roofBand = (y, lx, lz, w, d) => {
      put('roof', UNIT_BOX, MAT.roof, lx, y + .17, lz, w, .3, d, 0, roofTint);
      put('copper', UNIT_BOX, MAT.copper, lx, y - .04, lz, w + .06, .21, d + .06);
      put('darkI', UNIT_BOX, MAT.dark, lx, y - .19, lz, w - .3, .16, d - .3);
    };
    /* Four bands filling the rect `o` minus the rect `h` — the shape of a slab
       with a hole in it, which is what a roof or a ceiling over a light court
       is. Zero-width bands are dropped so a hole flush with an edge degrades to
       three bands rather than to a box of negative depth. */
    const ringBands = (o, h) => [
      [(o.x0 + h.x0) / 2, (o.z0 + o.z1) / 2, h.x0 - o.x0, o.z1 - o.z0],
      [(h.x1 + o.x1) / 2, (o.z0 + o.z1) / 2, o.x1 - h.x1, o.z1 - o.z0],
      [(h.x0 + h.x1) / 2, (o.z0 + h.z0) / 2, h.x1 - h.x0, h.z0 - o.z0],
      [(h.x0 + h.x1) / 2, (h.z1 + o.z1) / 2, h.x1 - h.x0, o.z1 - h.z1],
    ].filter(b => b[2] > .02 && b[3] > .02);
    const wall = (lx, lz, w, d, h, y = 0) =>
      put('stucco', UNIT_BOX, MAT.stucco, lx, y + h / 2, lz, w, h, d, 0, wallTint);
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

    /* ── the shell ────────────────────────────────────────────────────────
       Floor first: a marble plate at FY, the one step up from the gallery.
       Then the two side walls and whatever the front and back need. The back
       wall is the atrium's; all we build is the reveal either side of its hole
       so the room reads as lined rather than as a hole in a box. */
    put('roomFloorI', UNIT_BOX, MAT.roomFloor, 0, FY - .09, 0, W, .18, D);
    /* skirting/reveal at the gallery wall, flanking the doorway */
    for (const sgn of [-1, 1]) {
      const inner = doorX + sgn * doorHalf, outer = sgn * hw;
      const wSeg = Math.abs(outer - inner);
      if (wSeg > .05) wall((inner + outer) / 2, -hd + T / 2, wSeg, T, HH);
    }
    /* the door head over the opening, so the shared wall reads as a door */
    wall(doorX, -hd + T / 2, V.doorClear + .5, T, HH - 2.45, 2.45);
    put('copper', UNIT_BOX, MAT.copper, doorX, 2.40, -hd + T / 2, V.doorClear + .6, .1, T + .06);
    /* side walls, inset so neighbouring keys touch instead of overlapping */
    for (const sgn of [-1, 1]) wall(sgn * (hw - T / 2), 0, T, D, HH);
    colL(-hw + T / 2, -hd, -hw + T / 2, hd, .34);
    colL(hw - T / 2, -hd, hw - T / 2, hd, .34);

    /* ceiling — a timber soffit just under the roof so the room is a room.
       type 0 gets a hole in it: see the light court below. */
    const ceilOuter = { x0: -hw + T, x1: hw - T, z0: -hd + T / 2, z1: hd - T / 2 };
    const WELL = type === 0
      ? { x0: hw - 3.6, x1: hw - 1.4, z0: -hd + 2.6, z1: -hd + 4.8 } : null;
    if (WELL) {
      for (const [bx, bz, bw, bd] of ringBands(ceilOuter, WELL)) {
        put('roomCeilI', UNIT_BOX, MAT.roomCeil, bx, HH - .34, bz, bw, .1, bd);
      }
    } else {
      put('roomCeilI', UNIT_BOX, MAT.roomCeil, 0, HH - .34, 0,
        ceilOuter.x1 - ceilOuter.x0, .1, ceilOuter.z1 - ceilOuter.z0);
    }

    /* a warm interior glow, the thing that makes the gallery read at night */
    put('glowI', UNIT_BOX, MAT.glowLamp, doorX, 2.15, -hd + T + .08, V.doorClear - .3, .06, .06);

    /* ── the private front: a folding glass wall standing OPEN ───────────── */
    const fz = hd - T / 2;
    const gh = Math.min(HH, 3.4) - .5;
    const openHalf = 1.2;                       // the folded-back leaf span
    const openAt = V.openAt[type] || 0;         // and where it stands open
    for (const sgn of [-1, 1]) {
      const inner = openAt + sgn * openHalf, outer = sgn * (hw - T);
      const wSeg = Math.abs(outer - inner);
      if (wSeg <= .05) continue;
      const cxs = (inner + outer) / 2;
      glassBay(cxs, gh / 2 + FY, fz, wSeg, gh);
      mullions(cxs, gh / 2 + FY, fz + .07, wSeg, gh, Math.max(2, Math.round(wSeg / 1.6)));
      colL(inner, fz, outer, fz, .3);
    }
    /* head beam + the two folded leaves stacked against the jambs */
    wall(0, fz, W - T * 2, T, HH - gh - FY, gh + FY);
    for (const sgn of [-1, 1]) {
      put('darkI', UNIT_BOX, MAT.dark, openAt + sgn * (openHalf - .12), gh / 2 + FY, fz - .55, .12, gh, 1.0);
    }

    /* the roof, and a plinth lip that steps down to the deck outside */
    const roofOuter = { x0: -hw - .02, x1: hw + .02, z0: -hd, z1: hd + OH };
    if (WELL) {
      for (const [bx, bz, bw, bd] of ringBands(roofOuter, WELL)) roofBand(HH, bx, bz, bw, bd);
    } else {
      roofBand(HH, 0, (roofOuter.z0 + roofOuter.z1) / 2,
        roofOuter.x1 - roofOuter.x0, roofOuter.z1 - roofOuter.z0);
    }
    put('stoneI', UNIT_BOX, MAT.stone, 0, .1, hd + .45, W, .2, .9);

    /* ── type-specific fit-out + the private outdoor room ─────────────── */
    if (type === 0) {
      /* ── 花园客房 Garden Room, 98 ㎡ ─────────────────────────────────────
            The 阳光泡浴空间 — the sunlit soaking court — is a VOID cut clean
            through the ceiling and the roof (see WELL above): travertine, a
            sunken black-stone tub, a low kerb, open to the sky. Those voids
            are the small bright squares scattered through the roofscape in the
            enclave aerial, and this is the first version of them you can stand
            next to. The previous one was a 2.5 m glazed BOX standing inside
            the room, which in a 9.9 m room read as a wall of green glass
            across your own front door — the well is now a hole in the roof,
            not an object on the floor, and it is set off the door axis and a
            clear 2.6 m in from the gallery wall so nothing stands in the way
            of walking in. */
      const wcx = (WELL.x0 + WELL.x1) / 2, wcz = (WELL.z0 + WELL.z1) / 2;
      const wW = WELL.x1 - WELL.x0, wD = WELL.z1 - WELL.z0;
      put('stonePlaneI', UNIT_PLANE, MAT.stone, wcx, FY + .015, wcz, wW, 1, wD);
      put('blackI', UNIT_BOX, MAT.blackstone, wcx, FY + .06, wcz, wW - .9, .12, wD - .9);
      /* the kerb — three sides, low enough to sit on and to step over */
      for (const [kx, kz, kw, kd] of [
        [wcx, WELL.z0 - .14, wW + .28, .28], [WELL.x0 - .14, wcz, .28, wD],
        [WELL.x1 + .14, wcz, .28, wD]]) {
        put('stoneI', UNIT_BOX, MAT.stone, kx, FY + .17, kz, kw, .34, kd);
        colL(kx - kw / 2, kz, kx + kw / 2, kz, .26);
      }
      stepLight(WELL.x0 - .5, WELL.z1 + .5);
      /* bed platform + headboard, facing the court */
      put('deckI', UNIT_BOX, MAT.deck, -hw * .42, FY + .16, hd * .1, 2.3, .32, 2.1);
      put('whiteI', UNIT_BOX, MAT.white, -hw * .42, FY + .46, hd * .1, 2.1, .28, 1.9);
      put('slatI', UNIT_BOX, MAT.slat, -hw + T + .1, FY + .9, hd * .1, .12, 1.5, 2.5);

      /* the private court: timber deck, low white walls, a parasol */
      put('deckI', UNIT_BOX, MAT.deck, 0, .1, hd + 2.6, W * .92, .2, 3.4);
      const gx = hw + .25, z0 = hd + .2, z1 = hd + 5.2;
      for (const sgn of [-1, 1]) {
        wall(sgn * gx, (z0 + z1) / 2, .24, z1 - z0, .95);
        /* ⚠ y1: a 0.95 m garden wall must not block at 3.6 m. The check-in
           lobby's upper walkway runs over D1's court on its way to the
           atrium, and an all-heights chain here stopped the walker in
           mid-air with nothing visible in front of him. */
        colL(sgn * gx, z0, sgn * gx, z1, .3, { y1: 1.35 });
      }
      parasol(-hw * .35, hd + 2.5);
      lounger(-hw * .35 - 1.4, hd + 2.4, 1);
      stepLight(gx - .4, z0 + .4); stepLight(-gx + .4, z0 + .4);
      put('bougain', UNIT_BLOB, MAT.bougain, gx - .6, 1.0, z1 - 1.4, 1.0, 1.0, .9);

    } else if (type === 1) {
      /* ── 花园泳池双卧套房 Garden Pool 2-BR — two beds, and a WALLED
            courtyard on the private side with the plunge pool and the black
            water wall. water.js owns the water, the spouts and the coping;
            this file used to build a SECOND basin four metres away from it, in
            masonry, which is why the courtyards read as two pools. Gone. */
      /* PLAN: entry hall → living space → folding glass → courtyard, straight
         down the middle, with a bedroom behind a partition on each side.
         NOT a spine wall down the centre-line, which is what the first two
         passes built: the 2-BR doors sit on their rooms' centre-lines, so a
         central partition is a wall across the inside of the front door and
         then a wall across the way out to your own pool. The walk test caught
         it twice — first wedged against it in the doorway, then wedged against
         it in the middle of the room. Both partitions stop short of the
         gallery wall (the hall) and of the glass (the living space), so the
         route in from the corridor and out to the water is clear the whole
         way. */
      const partX = hw * .49, partZ0 = -hd + 3.2, partZ1 = hd - 2.4;
      for (const sgn of [-1, 1]) {
        wall(sgn * partX, (partZ0 + partZ1) / 2, .24, partZ1 - partZ0, HH);
        colL(sgn * partX, partZ0, sgn * partX, partZ1, .3);
        put('deckI', UNIT_BOX, MAT.deck, sgn * (hw - 1.9), FY + .16, hd * .1, 2.3, .32, 2.1);
        put('whiteI', UNIT_BOX, MAT.white, sgn * (hw - 1.9), FY + .46, hd * .1, 2.1, .28, 1.9);
        put('slatI', UNIT_BOX, MAT.slat, sgn * (hw - T - .06), FY + .9, hd * .1, .12, 1.5, 2.5);
      }

      const CW = V.courtW, CD = V.courtD;
      const cz = hd + CD / 2 + .2;
      put('stonePlaneI', UNIT_PLANE, MAT.stone, 0, .12, cz, CW, 1, CD);
      const wallH = 2.45;
      wall(0, cz + CD / 2, CW + .5, .28, wallH);
      for (const sgn of [-1, 1]) {
        wall(sgn * CW / 2, cz, .28, CD, wallH);
        colL(sgn * CW / 2, cz - CD / 2, sgn * CW / 2, cz + CD / 2, .34);
      }
      colL(-CW / 2, cz + CD / 2, CW / 2, cz + CD / 2, .34);
      parasol(CW * .32, cz - CD * .2);
      lounger(CW * .32 - 1.4, cz - CD * .22, 1);
      lounger(CW * .32 + 1.4, cz - CD * .22, 1);
      for (let k = -1; k <= 1; k += 2) stepLight(k * (CW / 2 - .6), cz - CD / 2 + .8);
      put('bougain', UNIT_BLOB, MAT.bougain, -CW / 2 + 1.1, 1.2, cz + CD / 2 - 1.5, 1.1, 1.2, 1.0);
      put('hedgeBlobI', UNIT_BLOB, MAT.hedge, CW / 2 - 1.2, .9, cz + CD / 2 - 1.4, 1.8, 1.5, 1.6);

    } else {
      /* ── 花园三卧套房 Garden 3-BR — TWO storeys, and the only key entered
            twice: once off the ground gallery and once off the atrium's upper
            one. That is why VILLA.floorH2 must equal ATRIUM.floorH — the slab
            below is the floor you step onto from the gallery. */
      const F2 = V.floorH2;
      /* the 2F slab, its soffit, and the upper walls (back wall still the
         atrium's — the same shared wall, one storey up) */
      put('roomFloorI', UNIT_BOX, MAT.roomFloor, 0, F2 - .09, 0, W - T * 2, .18, D - T);
      put('darkI', UNIT_BOX, MAT.dark, 0, F2 - .26, 0, W - T * 2, .16, D - T);
      for (const sgn of [-1, 1]) wall(sgn * (hw - T / 2), 0, T, D, HH - F2, F2);
      for (const sgn of [-1, 1]) {
        const inner = doorX + sgn * doorHalf, outer = sgn * hw;
        const wSeg = Math.abs(outer - inner);
        if (wSeg > .05) wall((inner + outer) / 2, -hd + T / 2, wSeg, T, HH - F2, F2);
      }
      wall(doorX, -hd + T / 2, V.doorClear + .5, T, HH - F2 - 2.35, F2 + 2.35);
      put('copper', UNIT_BOX, MAT.copper, doorX, F2 + 2.30, -hd + T / 2, V.doorClear + .6, .1, T + .06);
      put('glowI', UNIT_BOX, MAT.glowLamp, doorX, F2 + 2.05, -hd + T + .08, V.doorClear - .3, .06, .06);
      put('roomCeilI', UNIT_BOX, MAT.roomCeil, 0, HH - .34, 0, W - T * 2, .1, D - T);

      /* the 2F opens onto a balcony over the pool, glass balustrade + copper
         rail. The balustrade is a collider that only exists UP THERE — the
         ground floor's folding wall stands open in the same plane. */
      const bz1 = hd + 1.7;
      glassBay(0, F2 + 1.35, fz, W - T * 2, 2.0);
      mullions(0, F2 + 1.35, fz + .07, W - T * 2, 2.0, 5);
      put('deckI', UNIT_BOX, MAT.deck, 0, F2 + .06, (fz + bz1) / 2, W - T * 2, .16, bz1 - fz);
      for (let k = -2; k <= 2; k++) {
        put('clearI', UNIT_BOX, MAT.clear, k * (W - 1.4) / 5, F2 + .66, bz1, (W - 1.6) / 5, .95, .06);
      }
      put('copper', UNIT_BOX, MAT.copper, 0, F2 + 1.17, bz1, W - T * 2, .07, .12);
      for (const sgn of [-1, 1]) {
        put('clearI', UNIT_BOX, MAT.clear, sgn * (hw - T), F2 + .66, (fz + bz1) / 2, .06, .95, bz1 - fz);
      }
      colL(-hw, bz1, hw, bz1, .3, { y0: F2 - .4 });
      colL(-hw, fz, openAt - openHalf, fz, .3, { y0: F2 - .4 });
      colL(openAt + openHalf, fz, hw, fz, .3, { y0: F2 - .4 });

      /* fit-out: a bed on each floor and the double-height living bay */
      put('deckI', UNIT_BOX, MAT.deck, hw * .5, F2 + .16, -hd * .1, 2.3, .32, 2.1);
      put('whiteI', UNIT_BOX, MAT.white, hw * .5, F2 + .46, -hd * .1, 2.1, .28, 1.9);
      put('slatI', UNIT_BOX, MAT.slat, hw * .5, F2 + .75, -hd * .1 - 1.15, 2.5, 1.5, .12);
      put('deckI', UNIT_BOX, MAT.deck, -hw * .5, FY + .18, hd * .1, 2.6, .36, 2.2);
      put('whiteI', UNIT_BOX, MAT.white, -hw * .5, FY + .5, hd * .1, 2.4, .3, 2.0);

      /* the private front: deck, garden walls, parasol (the pool is water.js) */
      put('deckI', UNIT_BOX, MAT.deck, 0, .1, hd + 2.9, W * .9, .2, 3.6);
      const gx = hw + .3, z0 = hd + .2, z1 = hd + 5.6;
      for (const sgn of [-1, 1]) {
        wall(sgn * gx, (z0 + z1) / 2, .24, z1 - z0, .95);
        colL(sgn * gx, z0, sgn * gx, z1, .3);
      }
      parasol(hw * .5, hd + 2.9);
      lounger(hw * .5 - 1.5, hd + 2.8, 1);
      lounger(hw * .5 + 1.5, hd + 2.8, 1);
      stepLight(-gx + .5, z0 + .5); stepLight(gx - .5, z0 + .5);
      put('bougain', UNIT_BLOB, MAT.bougain, -gx + .8, 1.1, z1 - 1.2, 1.0, 1.1, .9);
      put('hedgeBlobI', UNIT_BLOB, MAT.hedge, gx - .8, .85, z0 + 1.6, 1.6, 1.4, 1.6);
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
    /* wR/dR, not w/d: `d` became the plunge-pool offset datum when the ten
       guest keys attached to the atrium (see the banner in site.js) and is no
       longer anybody's footprint. */
    const W = V.wR * sc, D = V.dR * sc, H = V.h + (rnd() - .5) * .5;
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

/* ── buildLawn() — DELETED 2026-08-02 (the proportion pass) ────────────────
   It built SITE.LAWN: a 44 m raised turf disc with a stone rim and coping, a
   gravel border, a 132-segment hedge ring, a 7 m paved ring path, an aisle
   threshold with two piers and twenty path lights. That was the ORIGINAL
   ceremony ground; the ceremony moved to BEACH_LAWN on 2026-08-02 and the disc
   became the striped dark-green oval Carl pointed at in his top-down — *"you
   can probably remove this non-existent grass area just in the way of things?"*
   Gone, together with SITE.LAWN, the 'lawn' name in world.js's
   CAMPUS_ENCLAVE_GROUPS, nature.js's framing palm ring and hedge ring, and
   world.js's keepOutDisc.
   What replaced it is buildGrassGround() immediately below — and the whole
   lesson of the reference photo is that the vocabulary above (rim, coping, ring
   path, hedge ring) is exactly what the real ground does NOT have.           */

/* ════════════════════════════════════════════════════════════════════════
   3b · THE GRASS GROUND  (Carl, 2026-08-02)
   ════════════════════════════════════════════════════════════════════════
   The four mown lawns of SITE — GRAND_LAWN, BEACH_LAWN and the two
   DINNER_LAWNS — plus the paths that link them, the planted terrace edge and
   the fire pit. This is the ground three of the six moments now stand on.

   Reference: reference/photos/clubhouse-lawn-to-beach.png (from above the
   clubhouse, looking west out to sea) settles the composition, and the one
   thing it settles hardest is what NOT to build: the big lawn is flat,
   unbroken and completely empty. No hedge ring, no coping, no ring path, no
   ornament — the deleted buildLawn()'s vocabulary was exactly the wrong idea
   out here. What edges it is soft: clipped hedge blocks, rounded topiary and
   shrub masses on the terrace side, palms everywhere else (nature.js).

   ⚠ EVERYTHING HERE GOES THROUGH inst(), and that is not a performance
   choice. world.js re-parents campus.js's content into the rotated enclave
   two ways: named groups listed in its CAMPUS_ENCLAVE_GROUPS set, and
   InstancedMeshes, whose instances it relocates one by one through
   isEnclaveLocal(). That set is a literal in world.js, which this pass does
   not own — a NEW named group would simply not be in it and would stand 90°
   around the map at raw local coordinates, silently. Instances are relocated
   by position and cannot miss. Same reason there are no THREE.PointLights
   out here: a light needs a parent group. The lanterns and the fire bed are
   emissive instances, exactly as buildLawn()'s path lights used to be.      */
const LAWN_Y = .02;          // mown turf, 20 mm proud of nature.js's ground
const PATH_Y = .035;         // paving, proud of the turf

function buildGrassGround(G) {
  const GL = SITE.GRAND_LAWN, BL = SITE.BEACH_LAWN, FP = SITE.FIRE_PIT;
  const rnd = mulberry32((CFG.SEED ^ 0x6a55) >>> 0);
  /* mow stripes: one material, two instance tints. A 49 m sheet of a single
     3 m grass repeat reads as billiard baize from the drone orbit. */
  const MOW = [new THREE.Color(.90, .96, .88), new THREE.Color(1, 1, 1)];

  /** a mown panel, banded across its SHORT axis */
  const panel = (L, bandD) => {
    const w = L.x1 - L.x0, d = L.z1 - L.z0;
    const along = d >= w ? 'z' : 'x';
    const n = Math.max(2, Math.round((along === 'z' ? d : w) / bandD));
    for (let i = 0; i < n; i++) {
      const a0 = i / n, a1 = (i + 1) / n;
      const m = along === 'z'
        ? mat4((L.x0 + L.x1) / 2, LAWN_Y, L.z0 + d * (a0 + a1) / 2, w, 1, d * (a1 - a0))
        : mat4(L.x0 + w * (a0 + a1) / 2, LAWN_Y, (L.z0 + L.z1) / 2, w * (a1 - a0), 1, d);
      inst('lawnI', UNIT_PLANE, MAT.turf, m, MOW[i & 1]);
    }
  };
  const paving = (cx, cz, w, d) =>
    inst('grassPaveI', UNIT_PLANE, MAT.stone, mat4(cx, PATH_Y, cz, w, 1, d));
  /* A path light is a pale stone block with a glowing cap, not a bare
     MAT.glowLamp box: glowLamp's day colour is 0x1a1a1c, and buildLawn() got
     away with that because its lights line a paved ring path. Out here they sit
     on open mown grass in daylight, where a dozen 0.2 m black cubes read as
     bricks dropped on the lawn. */
  const lamp = (x, z) => {
    inst('grassLampI', UNIT_BOX, MAT.stone, mat4(x, .1, z, .22, .2, .22));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, .215, z, .17, .05, .17));
  };

  /* ── the two big lawns ── */
  panel(GL, 3.1);
  panel(BL, 2.9);

  /* ── the spine path: pool terrace → up the grand lawn → the beachfront.
        x = −2 so it threads the gap nature.js leaves in the palm belt
        (placePalms' gapAt: |x| < 5). A path that ends in a palm trunk is the
        kind of thing only a walk test finds. ── */
  const SPX = -2, XZ = BL.z0 - .8;
  paving(SPX, (GL.z0 - 1.4 + XZ) / 2, 3.4, XZ - GL.z0 + 1.4);
  /* ── the cross path along the head of the beachfront lawn: it feeds the
        ceremony aisle at x −22 and the cocktail lawn at x +4 ── */
  paving((-31 + 10) / 2, XZ, 41, 2.6);
  for (let i = 0; i < 9; i++) lamp(SPX + (i & 1 ? 1.85 : -1.85), GL.z0 + 1 + i * 3.7);
  for (let i = 0; i < 9; i++) lamp(-30 + i * 5, XZ + 2.1);

  /* ── the planted terrace edge, between the pool paving and the big lawn.
        Clipped blocks with real gaps rather than one continuous wall: every
        block carries a collider (house rule for hedges) and a 49 m sealed run
        with one opening would funnel everybody through it.

        ⚠ IT STANDS ON THE LAWN'S FIRST METRE, NOT IN FRONT OF IT. At GL.z0 −
        1.3 the run sat in the 3.4 m strip between the hero pool's far coping
        and the lawn — and the pool's coping collider already reaches z ≈ 22.95
        once CFG.PLAYER_R is added, so the only route from the pool deck to the
        lawn became a ~1 m slot, then a hedge. A walk test from the deck simply
        stopped. Pushed to GL.z0 + 0.9 the terrace strip is 2 m of clear
        east–west walking across its whole 49 m, and the hedge is still what you
        see between the paving and the grass, which is the reference photo. ── */
  const EZ = GL.z0 + .9;
  for (let x = GL.x0; x < GL.x1 - 1; ) {
    const w = 2.6 + rnd() * 1.8;
    if (!(x < SPX + 2.6 && x + w > SPX - 2.6)) {           // leave the path open
      const h = .78 + rnd() * .22;
      inst('hedgeI', UNIT_BOX, MAT.hedge, mat4(x + w / 2, h / 2, EZ, w, h, 1.35));
      colliderLine(G.colliders, x + .4, EZ, x + w - .4, EZ, .5);
      if (rnd() > .55) {                                   // rounded topiary
        const r = 1.0 + rnd() * .5;
        inst('topiaryI', UNIT_BLOB, MAT.hedge,
          mat4(x + w / 2 + (rnd() - .5) * 1.4, r * .82, EZ - 1.5 - rnd(), r * 2, r * 1.7, r * 2));
      }
      if (rnd() > .72) {                                   // a bougainvillea mass
        inst('bougI', UNIT_BLOB, MAT.bougain,
          mat4(x + w / 2, .6, EZ + 1.2, 1.7, 1.1, 1.5));
      }
    }
    x += w + 1.9 + rnd() * 1.4;
  }

  /* ── the garden gate in the terrace edge's path gap (Carl's dinner-lawns
        clip, 2026-08-03: f_001–003 / f_013–014 show a small LIGHT-COLOURED
        ornamental gate set into the gap in the hedge wall — the build had
        correctly left the gap open for the walk but nothing stood in it).
        Two square capped posts just off the spine path's 3.4 m paving, and
        two picket leaves STANDING OPEN, swung back onto the lawn side, so
        the gap stays the walk it always was. Only the posts collide (r .2
        leaves a ~3.0 m clear corridor); the leaves follow the lounger rule —
        waist-high ornament is the wrong thing to wall a walkway with, and
        the dinner and pool-deck walks both route through here.            ── */
  {
    const HINGE = 2.05;                     // post centres, just off the paving
    for (const s of [-1, 1]) {
      const gx = SPX + s * HINGE;
      inst('gateI', UNIT_BOX, MAT.white, mat4(gx, .66, EZ, .16, 1.32, .16));
      inst('gateI', UNIT_BOX, MAT.white, mat4(gx, 1.37, EZ, .26, .1, .26));  // cap
      inst('gateI', UNIT_BOX, MAT.white, mat4(gx, 1.49, EZ, .1, .14, .1));   // finial
      G.colliders.push({ x: gx, z: EZ, r: .2 });
      /* the leaf, hinged at the post and swung ~90° open onto the lawn:
         two rails + five pickets, alternating picket heights so it reads
         ornamental garden gate rather than site fence */
      const lx = gx - s * .1;
      for (const ry of [.34, .98]) {
        inst('gateI', UNIT_BOX, MAT.white, mat4(lx, ry, EZ + .92, .055, .07, 1.44));
      }
      for (let k = 0; k < 5; k++) {
        const ph = k % 2 ? .92 : 1.08;
        inst('gateI', UNIT_BOX, MAT.white,
          mat4(lx, ph / 2 + .12, EZ + .28 + k * .32, .05, ph, .05));
      }
    }
  }

  /* ── the fire pit set into the terrace paving beside the pool ──
        A square kerb of pale stone in a wider apron with a dark pebble
        margin, an ember bed that lights after dark. Its kerb is 0.35 m — under
        CFG.STEP_UP, so floorY would happily let a walker stand in the fire;
        the four collider runs are what actually keep them out. */
  {
    const A = FP.w + FP.rim * 2;
    paving(FP.cx, FP.cz, A + 2.4, A + 2.4);
    inst('grassBlackPaveI', UNIT_PLANE, MAT.blackstone,
      mat4(FP.cx, PATH_Y + .004, FP.cz, A, 1, A));
    for (const s of [-1, 1]) {
      inst('firePitI', UNIT_BOX, MAT.stone,
        mat4(FP.cx + s * FP.w / 2, .175, FP.cz, .5, .35, FP.w + .5));
      inst('firePitI', UNIT_BOX, MAT.stone,
        mat4(FP.cx, .175, FP.cz + s * FP.w / 2, FP.w + .5, .35, .5));
      colliderLine(G.colliders, FP.cx + s * (FP.w / 2 + .25), FP.cz - FP.w / 2,
        FP.cx + s * (FP.w / 2 + .25), FP.cz + FP.w / 2, .45);
      colliderLine(G.colliders, FP.cx - FP.w / 2, FP.cz + s * (FP.w / 2 + .25),
        FP.cx + FP.w / 2, FP.cz + s * (FP.w / 2 + .25), .45);
    }
    inst('grassBlackPaveI', UNIT_PLANE, MAT.blackstone,
      mat4(FP.cx, .07, FP.cz, FP.w - .5, 1, FP.w - .5));
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(FP.cx, .10, FP.cz, FP.w - .9, .06, FP.w - .9));
  }

  /* ── two teak benches at the seaward edge, facing the water ──
     KAN-211 wave E: `garden_bench` (a backless slatted teak bench, ASSET_SPEC
     Group O) authored at exactly the old boxes' envelope — 1.90 × .50, seat
     top .475 — one identity-scale instance each. The collider is unchanged;
     the boxes are the fallback. */
  for (const bx of [BL.x0 + 5, BL.x1 - 3]) {
    if (have('garden_bench')) {
      modelI('benchGlbI', 'garden_bench', mat4(bx, 0, BL.z1 - 1.6, 1, 1, 1));
    } else {
      inst('benchI', UNIT_BOX, MAT.deck, mat4(bx, .43, BL.z1 - 1.6, 1.9, .09, .5));
      for (const s of [-1, 1]) {
        inst('benchI', UNIT_BOX, MAT.deck, mat4(bx + s * .78, .21, BL.z1 - 1.6, .12, .43, .44));
      }
    }
    G.colliders.push({ x: bx, z: BL.z1 - 1.6, r: .95 });
  }

  /* ── the sea-edge planting band (Carl's beachfront clips, 2026-08-03).
        Both phone clips show the lawn's boundary with the beach as a groomed
        CONTINUOUS low hedge (~1.0–1.3 m, flat-topped) running the full width
        of the lawn, with spiky agave/yucca rosettes and warm-mottled croton
        shrubs mixed in and a few tall wispy casuarina trees poking through —
        not the bare palms-and-sand edge the build had. It sits just seaward
        of BL.z1, threading nature.js's sparse fringe palms.
        ⚠ TWO CLEAR GAPS, aligned with the corridors nature.js's seaward
        fringe already keeps open (x −22 the ceremony aisle, x +4 the
        cocktail lawn — its gap tests are ±9/±8 about those centres): the
        aisle gap is the ONLY walk from the lawn onto the sand. Hedge blocks
        carry colliders (house rule, same as the terrace edge above); the
        gaps carry NONE. Heights cap at 1.25 m so the sea horizon stays
        clear over the band from the arch (eye 1.7 m at z 71). Own seeded
        stream so the terrace edge's draws upstream never reshuffle.      ── */
  {
    const rndB = mulberry32((CFG.SEED ^ 0xbea0) >>> 0);
    const BAND_Z = BL.z1 + 1.3;
    const CEREM_X = -22, COCK_X = 4;          // nature.js's two fringe corridors
    /* the band = the lawn's full width minus the two walk gaps */
    const spans = [
      [BL.x0, CEREM_X - 4.8],
      [CEREM_X + 4.8, COCK_X - 4.0],
      [COCK_X + 4.0, BL.x1],
    ];
    /* builder-local materials, house style */
    /* KAN-211 wave E: agave a shade bluer and deeper (the glaucous Agave
       americana of the clips — the faceted keeled blades now carry the form,
       the old pale 0x74936c read as paper); the croton core's base drops to a
       mid grey-brown so its instance mottle sits UNDER the leaf-card fringe
       (a bright core read through the cards as a yellow lump). Both are
       uniforms — no program change, no rndB() change. */
    const agaveMat = tint(new THREE.MeshStandardMaterial({
      color: 0x648a7c, roughness: .9, flatShading: true }), 0x5c6b86);
    const crotonMat = tint(new THREE.MeshStandardMaterial({
      color: 0x4a4238, roughness: .92, flatShading: true }), 0x5c6b86);
    const casuBark = tint(new THREE.MeshStandardMaterial({
      color: 0x4c4238, roughness: .95 }), 0x6a7286);
    /* ⚠ The needle mass is an ALPHA-CUT map, not a solid colour, and it is built
       that way from the start on purpose. Three compiles USE_MAP and ALPHATEST
       into the program; handing a bare material a map later is a recompile and a
       new program, and the program count is asserted constant across all 24
       views. So the cone gets a canvas needle sheet at build time and
       assets/textures/casuarina.webp replaces it on load (same swap nature.js
       makes for the palms — see photoMap there).

       Why this is worth a texture at all: three stacked cones in flat dark green
       read as a CONIFER, and once the palms became photographs these were the
       least believable plants on the lawn — Christmas trees on a Hainan beach.
       A casuarina is a fringe of fine needles that hangs; the map is dense at the
       image's top and dissolves into separated strands at its bottom, and
       flipY puts that dense end at the cone's APEX and the ragged end at its
       base rim, so each tier breaks its own silhouette exactly where a real
       tier's needles hang. Geometry, instance count and the rndB() draw order
       are all untouched — this is a material change only.
       Base colour is WHITE so the photograph carries the hue; the night tint
       still multiplies over it. flatShading is off: a 10-sided cone facets
       visibly once a fine texture is on it. */
    const casuNeedle = tint(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: .96, alphaTest: .5, side: THREE.DoubleSide,
      map: casuNeedleTex(),
    }), 0x59688a);
    photoTex(casuNeedle, 'casuarina.webp');
    const CROTON = [0xa6522c, 0xc98f35, 0x86913a, 0x8f3c2c];

    /* a spiky rosette: seven splayed cones round one upright */
    const agave = (ax, az) => {
      const h = .62 + rndB() * .3;
      for (let k = 0; k < 7; k++) {
        inst('agaveI', UNIT_CONE, agaveMat,
          mat4(ax, h * .38, az, .16, h, .16, k * .897 + rndB() * .5, .62 + rndB() * .2));
      }
      inst('agaveI', UNIT_CONE, agaveMat, mat4(ax, h * .5, az, .14, h * 1.15, .14));
    };
    /* a colour-leaf shrub — per-instance warm mottle over a WHITE base
       (a dark base crushes instance tints to black, the cocktail-bar trap) */
    const croton = (cx, cz) => {
      const w = 1.1 + rndB() * .6, hh = .72 + rndB() * .3;
      const col = new THREE.Color(CROTON[(rndB() * CROTON.length) | 0])
        .offsetHSL(0, 0, (rndB() - .5) * .08);
      inst('crotonI', UNIT_BLOB, crotonMat, mat4(cx, hh * .55, cz, w, hh * 1.4, w * .85), col);
    };
    /* a casuarina: thin dark trunk, three narrow stacked needle cones —
       deliberately a different silhouette from the coconut palms */
    const casuarina = (tx, tz) => {
      const th = 6.5 + rndB() * 2.5, lean = (rndB() - .5) * .1;
      inst('casuTrunkI', UNIT_CYL, casuBark, mat4(tx, th * .5, tz, .24, th, .24, 0, 0, lean));
      for (const [f, wf, hf] of [[.52, 2.1, 3.0], [.7, 1.6, 2.5], [.86, 1.05, 2.1]]) {
        inst('casuLeafI', UNIT_CONE, casuNeedle,
          mat4(tx + lean * th * f + (rndB() - .5) * .5, th * f, tz + (rndB() - .5) * .5,
            wf, hf, wf, 0, 0, (rndB() - .5) * .16));
      }
      G.colliders.push({ x: tx, z: tz, r: .3 });
    };

    for (const [s0, s1] of spans) {
      /* the clipped hedge mass. ⚠ the 'hedgeI' bucket renders BLOB geometry
         (the bucket keeps its FIRST geometry — buildVillas registered it with
         UNIT_BLOB), so a lens tapers to nothing at its ends: the blocks must
         OVERLAP (step w − .55, width w + .9) or the run reads scalloped-open
         rather than the continuous clipped band the clips show */
      for (let x = s0; x < s1 - .6; ) {
        const w = Math.min(3.0 + rndB() * 1.6, s1 - x + .4);
        const h = 1.0 + rndB() * .25;
        inst('hedgeBlobI', UNIT_BLOB, MAT.hedge,
          mat4(x + w / 2, h / 2, BAND_Z + (rndB() - .5) * .24, w + .9, h, 1.35 + rndB() * .35));
        colliderLine(G.colliders, x + .4, BAND_Z, x + w - .4, BAND_Z, .5);
        x += w - .55;
      }
      /* agave rosettes every several metres on the lawn shoulder */
      for (let x = s0 + 1.6 + rndB() * 2; x < s1 - 1; x += 5.5 + rndB() * 3) {
        agave(x, BAND_Z - 1.2 - rndB() * .3);
      }
      /* croton colour breaks just seaward of the hedge line */
      for (let x = s0 + 2.5 + rndB() * 2.5; x < s1 - 1; x += 6.5 + rndB() * 4) {
        croton(x, BAND_Z + .9 + rndB() * .7);
      }
    }
    /* the casuarinas — kept out of the fringe's own ±9/±8 view corridors so
       the arch (and the cocktail lawn) still look at open sea */
    for (const tx of [-39.2, -35.4, -31.8, -12.4, -9.6, -5.2, 11.6]) {
      if (Math.abs(tx - CEREM_X) < 9 || Math.abs(tx - COCK_X) < 8) continue;
      casuarina(tx + (rndB() - .5) * .8, BAND_Z + .8 + rndB() * 1.2);
    }
  }

  /* ── the two DINNER lawns and the paved walk between them ── */
  const DW = SITE.DINNER_WALK;
  for (const L of SITE.DINNER_LAWNS) {
    panel(L, 2.8);
    /* a pale mow strip on all four edges — it is what makes a rectangle of
       grass in the middle of a lawn read as a laid-out room */
    for (const s of [-1, 1]) {
      paving((L.x0 + L.x1) / 2, s < 0 ? L.z0 - .35 : L.z1 + .35, L.x1 - L.x0 + 1.4, .7);
      paving(s < 0 ? L.x0 - .35 : L.x1 + .35, (L.z0 + L.z1) / 2, .7, L.z1 - L.z0);
    }
  }
  /* ⚠ PALE STONE HERE, NOT `MAT.paver`, AND THAT IS A DELIBERATE CHOICE.
     These two calls asked for `MAT.paver` for years and silently got
     `MAT.stone`, because `grassPaveI` had already been bound to stone — one of
     the fifteen bucket-key collisions fixed on 2026-08-06. When the collision
     was fixed they finally rendered as the sett texture they had been asking
     for, and it looks WRONG: the campus sett is right against the arrival
     court, but on a 4 m walk between two manicured lawns it reads as a
     multicoloured patchwork under the wedding dinner. So the accident is now
     the intent, stated honestly — pale stone, on the key that is bound to it. */
  inst('grassPaveI', UNIT_PLANE, MAT.stone,
    mat4((DW.x0 + DW.x1) / 2, PATH_Y, (DW.z0 + DW.z1) / 2,
      DW.x1 - DW.x0 - 1.4, 1, DW.z1 - DW.z0));
  /* the apron that joins both lawns back to the pool terrace */
  inst('grassPaveI', UNIT_PLANE, MAT.stone,
    mat4((SITE.DINNER_LAWNS[1].x0 + SITE.DINNER_LAWNS[0].x1) / 2, PATH_Y,
      SITE.DINNER_LAWNS[0].z0 - 2.4,
      SITE.DINNER_LAWNS[0].x1 - SITE.DINNER_LAWNS[1].x0, 1, 3.4));
  for (let i = 0; i < 7; i++) lamp((DW.x0 + DW.x1) / 2, DW.z0 + 1 + i * 3.1);
  return null;
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
   6b · THE ARRIVAL — the clubhouse's front door, its CHECK-IN LOBBY and the
        隐逸居酒廊 LOUNGE underneath it
   ════════════════════════════════════════════════════════════════════════
   References, in the order they settle things:
     · reference/photos/clubhouse-lounge-checkin-balcony.jpg — the COURTYARD
       elevation, and the whole reason this is a two-storey building: check-in
       lobby + cantilevered frameless-glass balcony above, 酒廊 lounge with
       folding glass onto a warm timber deck below, warm timber soffits under
       both overhangs, vertical standing-seam weathered metal over, a charcoal
       stone pier carrying 隐逸居酒廊 / SERENE RETREAT LOUNGE.
     · the three lobby stills (cream low-back sofas with square cushions, a
       blue-grey rug with a pale wave motif, dark timber coffee tables, the
       white four-panel cabinet wall, and the check-in desk itself — a dark
       timber counter with a vertical slat front, a monitor, a shaded lamp and
       a white bowl of dried flowers).
     · reference/entrance-arrival-brief.md + frames f_001–f_013 for the arrival
       face, which is unchanged: dark corten as filmed, the 6-riser near-black
       stone stair, the deep slatted canopy, banded piers, fluted brass
       sconces, the 隐逸居 plaque, frangipani/cordyline/ixora beds, the
       sett-paved court and the lane in off the map's south edge.

   THE ELEVATION. Carl: *"club house entrance is on 2nd floor and its slightly
   elevated"*. A 6-riser stair (0.95 m) cannot lift a court at grade to a 2F
   floor, so the ARRIVAL SIDE stands on higher ground — which is exactly what
   the photograph shows, single-storey from the car park and two storeys from
   the courtyard. SITE.ARRIVAL.terraceY (2.65) + rise (0.95) = 3.60 =
   ATRIUM.floorH. The lane climbs the 2.65 m over its own 38.4 m (6.9 %) and
   the terrace is retained on every open edge; nothing floats.

   ⚠ FRAME CHOICE (option a): EVERYTHING here is ENCLAVE-LOCAL. Unique
   meshes parent under the adopted 'sign' group (g), repeats ride the shared
   inst() buckets — every instance position satisfies isEnclaveLocal(), so
   world.js's relocateInstances() bakes the enclave matrix onto all of them,
   and the collider rewrite maps every collider pushed here. Authoring the
   court/lane WORLD-space through the shared buckets would be silently
   captured by the same test (world x −37…−16, z 107…144 answers "local") —
   that is the trap, and local-everywhere is how this builder avoids it. The
   'Check in' interactable rides the same road (see section H).

   ⚠ COLLIDER HEIGHTS ARE LOAD-BEARING HERE, because this is the first place
   on the campus where two walkable floors sit over each other outside a
   building the walker can only be in one of. `BELOW = {y1: 3.28}` is the
   lounge's level and `ABOVE = {y0: 3.28}` the lobby's; a wall that belongs to
   one and is registered without a range seals the other. The courtyard glass
   line carries BOTH, with different gaps.

   Walkability: site.js WALK_REGIONS, all derived from SITE.ARRIVAL —
   arrival-lane-*, -court, -fore, -stair, -landing, -lobby, -balcony,
   -lounge, -lounge-deck, -stair-int, -link, -slot, -head.
   Zero new THREE.PointLights — every lamp here is emissive.
   ════════════════════════════════════════════════════════════════════════ */
/* KAN-211 wave D: the 酒廊 floor's own env level (day, night) — see buildArrival §D */
const LOUNGE_FLOOR_ENV = [0.30, 0.20];
/* KAN-211 wave E: the check-in lobby's floor — same boards, own envMap, its own
   day colour (a linear multiply on floor_teak; measured, see buildArrival §F) */
const LOBBY_FLOOR_ENV = [0.20, 0.14];
/* KAN-211 wave F: env [day, night] where a knob that now binds earns a
   measured change against a reference photo (CLAUDE.md "KAN-211 WAVE F").
   Keyed by MAT name or GLB name; everything else tracks the scene. */
const ENV_OVERRIDE = {};
const LOBBY_FLOOR_TINT = 0xedcc8f;
/* KAN-211 wave D: the breakfast room's interior buckets hide past this distance
   (m, camera → room centre, in plan) — see buildArrival §D */
const LOUNGE_CULL_D = 38;
function buildArrival(G, g, rnd) {
  const AR = SITE.ARRIVAL;
  const TY = AR.terraceY;                                   // 2.65 raised ground
  const LY = ARRIVAL_LOBBY_Y;                               // 3.60 check-in floor
  const CY = ARRIVAL_LOUNGE_CEIL;                           // 3.28 lounge ceiling
  const B = AR.bldg, LB = AR.LOBBY, DK = AR.DECK, BC = AR.BALC;
  const bayC = (AR.bay.z0 + AR.bay.z1) / 2;                 // the axis, −8
  const bayW = AR.bay.z1 - AR.bay.z0;                       // 9 m
  const rise = AR.rise, rh = rise / AR.risers;              // 0.1583 m risers
  const C = G.colliders;
  const BELOW = { y1: CY };            // blocks the lounge walker only
  const ABOVE = { y0: CY };            // blocks the lobby/walkway walker only

  /* ── KAN-211 WAVE A: the pavilion as BLENDER ARCHITECTURE ─────────────────
     Six GLBs authored IN SITE COORDINATES (assets/blender/generators/_arch.py
     reads js/site.js itself): one shared frame whose origin is the ANCHOR
     (AR.backX, 0, AR.axisZ), so each is ONE identity instance at that point —
     (33, −8) answers true to isEnclaveLocal(), and world.js carries every one
     into the enclave whole. They replace VISUAL boxes only: every collider,
     WALK_REGION, rnd() draw and interactable below is untouched, and each
     replaced primitive keeps its old path as the `else` for a missing GLB.
       arrival_shell   the corten walls (wings, ends, the courtyard band)
       arrival_roof    the mono-pitch roof, seams, fascia, the fold, cedar soffit
       arrival_stair   the 6 risers, the landing, the cheeks (glossy stone)
       arrival_entry   canopy + slatted soffit, banded piers, door frames,
                       sconce plates, the plaque wing's banded wall
       lounge_facade   the courtyard face: folding-door frames, louvres, the
                       tiled charcoal pier, the balcony's edge, fascia, soffit
                       and capping, the lobby's glass-wall frames
       lobby_desk      the check-in counter + slat front + cabinet wall
     plus `arrival_sconce`, GEOMETRY ONLY on our own glowing MAT.brassFlute.
     Baked atlases ride the one instanced baked-map program the props already
     compile; the sconce rides the brassFlute program arrSconceI compiled. */
  const ARCH = ['arrival_shell', 'arrival_roof', 'arrival_stair', 'arrival_entry', 'arrival_soffit'];
  const haveArch = ARCH.every(have) && have('arrival_sconce');
  const haveFacade = have('lounge_facade');
  const haveDesk = have('lobby_desk');
  const ANCHOR = () => mat4(AR.backX, 0, AR.axisZ, 1, 1, 1);
  /* the baked materials join the night registry (a campus material darkens and
     cools after dark; an untinted bake would glow grey against it) and take
     the finish the photographs show — a GLB carries ONE roughness, so it is
     set here per building part. Program-neutral: both are uniforms. */
  /* wave F: the env level is a materials.js envKnob. archMat's old 4th
     argument (corten .45, stair .3, soffit .35, slats .35) was set once, by
     day, on a material with no own envMap — it never bound; waves A/D were
     graded at the scene's level, so the knob defaults to it (ENV_OVERRIDE
     holds the measured exceptions). */
  const archMat = (name, rough, nightHex) => {
    const m = models.material(name);
    if (!m || m.userData.kan211) return;
    m.userData.kan211 = true;
    m.roughness = rough; m.metalness = 0;
    envKnob(m, ENV_OVERRIDE[name] || null, 'campus:archMat ' + name);
    tint(m, nightHex);
  };
  if (haveArch) {
    modelI('arrShellGlbI', 'arrival_shell', ANCHOR());
    modelI('arrRoofGlbI', 'arrival_roof', ANCHOR());
    modelI('arrStairGlbI', 'arrival_stair', ANCHOR());
    modelI('arrEntryGlbI', 'arrival_entry', ANCHOR());
    modelI('arrSoffitGlbI', 'arrival_soffit', ANCHOR());
    /* wave A2: the corten at env .45 / rough .85 — at 1.0 / .72 the PMREM's
       grey sky sat on every panel as a sheen and read washed-out grey-brown;
       the canopy soffit matte and dark (at .42 its slats caught the sky as
       grey-white stripes); the stair polished but warm (env 1.25 → .3, rough .38: the grey sky
       it mirrored at the court's grazing angle turned the charcoal flat
       light grey). ⚠ KAN-211 wave F: the env halves of those numbers never
       bound (no own envMap — three r180 used the scene's .95); what changed
       the look was the roughness. The env level is an envKnob now, at the
       scene's. */
    archMat('arrival_shell', .85, 0x707784);
    archMat('arrival_roof', .85, 0x707784);
    archMat('arrival_stair', .38, 0x99a1b2);
    archMat('arrival_entry', .42, 0x7d8494);
    archMat('arrival_soffit', .88, 0x7a6a68);
  }
  if (haveFacade) {
    modelI('arrFacadeGlbI', 'lounge_facade', ANCHOR());
    archMat('lounge_facade', .55, 0x767d8c);
  }
  if (haveDesk) {
    modelI('arrDeskGlbI', 'lobby_desk', ANCHOR());
    archMat('lobby_desk', .6, 0x8f96a6);
  }
  /* ── KAN-211 WAVE D ────────────────────────────────────────────────────────
     ASSET_SPEC Group N. Same contract as waves A–C: visual only — every
     collider, WALK_REGION, rnd() draw and interactable below is untouched,
     and every replaced primitive keeps its path as the `else` of a flag.
       arch_slat_module     one 0.6 m module of dark mahogany slats with open
                            joints, INSTANCED under the lobby's and the lounge's
                            ceilings (the old slatCeil boxes stay, in MAT.dark,
                            as the black backing the joints show)
       walkway_deck         LINK / SLOT / HEAD: paver deck (top = the old slab's,
                            lobbyY − .02), the LINK's stone fascia + cedar
                            soffit + steel columns, every balustrade's shoe +
                            copper cap (the glass panes stay the game's)
       walkway_pergola      the LINK's corten pergola, now on posts, with
                            channels, cross beams and timber louvre battens
       breakfast_*          the 酒廊's tables (set), banquettes, buffet; the
                            chairs are the roof's `dining_chair_rattan`
     plus floor_teak.webp over MAT.loungeFloor's canvas (a map swap: no
     program). ARRIVAL-frame GLBs are one identity instance at ANCHOR(). */
  const haveSlat = have('arch_slat_module');
  const haveWalk = have('walkway_deck') && have('walkway_pergola');
  const haveBk = ['breakfast_table', 'breakfast_table_two', 'breakfast_banquette',
    'breakfast_buffet', 'dining_chair_rattan'].every(have);
  if (haveWalk) {
    modelI('arrWalkGlbI', 'walkway_deck', ANCHOR());
    modelI('arrPergolaGlbI', 'walkway_pergola', ANCHOR());
    archMat('walkway_deck', .55, 0x767d8c);
    archMat('walkway_pergola', .85, 0x707784);
  }
  if (haveSlat) archMat('arch_slat_module', .6, 0x7a6a68);
  /* a slat ceiling over [x0, x1] × [z0, z1] hanging from yTop: slats run along
     x (toward the glass), rows of ≤ 3.9 m, modules 0.6 m wide across z; every
     other row turned 180° so the module's five tones read as ten */
  const slatCeiling = (x0, x1, z0, z1, yTop) => {
    const nr = Math.max(1, Math.ceil((x1 - x0) / 3.9)), rl = (x1 - x0) / nr;
    const nm = Math.max(1, Math.round((z1 - z0) / .6)), mw = (z1 - z0) / nm;
    for (let r = 0; r < nr; r++) {
      for (let k = 0; k < nm; k++) {
        modelI('arrSlatCeilGlbI', 'arch_slat_module',
          mat4(x0 + (r + .5) * rl, yTop, z0 + (k + .5) * mw, mw / .6, 1, (rl - .012) / 2.0,
            Math.PI / 2 + (r % 2) * Math.PI));
      }
    }
  };

  /* per-surface texture tiling (materials are this builder's own) */
  MAT.forePave.map.repeat.set((AR.fore.x1 - AR.fore.x0) / 1.2, (AR.fore.z1 - AR.fore.z0) / 1.2);
  MAT.sett.map.repeat.set((AR.court.x1 - AR.court.x0) / 1.3, (AR.court.z1 - AR.court.z0) / 1.3);

  /* ══════════════════════════════════════════════════════════════════════
     A · THE RAISED TERRACE — the honest answer to "slightly elevated"
     A 6-riser stair cannot lift a court at grade to a 2F floor, so the
     ARRIVAL SIDE stands on higher ground: the lane climbs 2.65 m over its
     own 38.4 m run (6.9 %) and the court sits on a retained terrace. Nothing
     floats — the whole boundary is a stone retaining wall with a planted
     batter falling away from it, which is what makes it read from the air.
     ══════════════════════════════════════════════════════════════════════ */

  /* the terrace decks: forecourt paving + sett court, both at terraceY */
  box(g, AR.fore.x1 - AR.fore.x0, .1, AR.beds[1].z1 - AR.beds[0].z0,
    (AR.fore.x0 + AR.fore.x1) / 2, TY, (AR.beds[0].z0 + AR.beds[1].z1) / 2, MAT.forePave);
  box(g, AR.court.x1 - AR.court.x0, .1, AR.court.z1 - AR.court.z0,
    (AR.court.x0 + AR.court.x1) / 2, TY, (AR.court.z0 + AR.court.z1) / 2, MAT.sett);

  /* THE RETAINING WALL. The boundary is derived from fore + court as one
     closed polyline (the terrace is an L: the court is deeper in Z than the
     forecourt), walked segment by segment. Each run gets a stone face down to
     grade, a flush cap, and a planted batter outside it. The lane's gap in
     the court's north edge is the only opening. */
  const F = AR.fore, K = AR.court, bd0 = AR.beds[0].z0, bd1 = AR.beds[1].z1;
  const RIM = [
    [F.x0, bd0], [F.x1, bd0], [F.x1, K.z0], [K.x1, K.z0],
    [K.x1, K.z1], [F.x1, K.z1], [F.x1, bd1], [F.x0, bd1],
  ];
  const retain = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < .05) return;
    const ry = Math.atan2(x2 - x1, z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const nx = Math.cos(ry), nz = -Math.sin(ry);          // outward normal
    inst('arrRetainI', UNIT_BOX, MAT.stone,
      mat4(cx + nx * .28, TY / 2, cz + nz * .28, .56, TY, len, ry));
    inst('arrRetainCapI', UNIT_BOX, MAT.blackPolish,
      mat4(cx + nx * .30, TY + .09, cz + nz * .30, .72, .18, len, ry));   // cap
    /* the planted batter: a slope band of clipped mass falling to grade */
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      const px = x1 + (x2 - x1) * t + nx * (.6 + AR.batter / 2);
      const pz = z1 + (z2 - z1) * t + nz * (.6 + AR.batter / 2);
      inst('arrHedgeI', UNIT_BOX, MAT.hedge,
        mat4(px, TY * .32, pz, AR.batter, TY * .64, len / n - .1, ry));
      /* KAN-211 wave E: the batter's blobs take the court's own planting
         language — the maroon ones (ci 1) the `cordyline_clump` prototype
         (the beds' arrCordyGlbI pair: same geometry, same MAT.plantFlat), the
         green ones the shrub CORE + a leaf-card FRINGE (key arrBatterShrubI,
         swapped at flush like the wave-4 bougainvillea). SAME rnd() draws in
         the SAME order (the matrix's four, then the colour's), same matrix,
         same colour — only the key, and so the prototype, changes. */
      const bm = mat4(px + nx * .7, TY * .62 + rnd() * .3, pz + nz * .7,
        1.1 + rnd() * .6, .8 + rnd() * .4, 1.1 + rnd() * .6);
      const ci = Math.floor(rnd() * 3);
      const bcol = new THREE.Color([0x4f7a3c, 0x5e2531, 0x49703a][ci]);
      if (ci === 1 && have('cordyline_clump')) {
        inst('arrCordyGlbI', models.geometry('cordyline_clump'), MAT.plantFlat, bm, bcol);
      } else if (ci !== 1 && protoGeo('shrub_core', .5)) {
        inst('arrBatterShrubI', UNIT_BLOB, MAT.plantFlat, bm, bcol);
      } else {
        inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, bm, bcol);
      }
    }
    colliderLine(C, x1, z1, x2, z2, .4);
  };
  for (let i = 0; i < RIM.length; i++) {
    const a = RIM[i], b = RIM[(i + 1) % RIM.length];
    if (i === RIM.length - 1) continue;                  // the pavilion closes it
    /* the north edge of the court carries the lane's gap */
    if (a[1] === K.z0 && b[1] === K.z0) {
      retain(Math.min(a[0], b[0]), K.z0, AR.laneGap.x0, K.z0);
      retain(AR.laneGap.x1, K.z0, Math.max(a[0], b[0]), K.z0);
    } else retain(a[0], a[1], b[0], b[1]);
  }

  /* ── the lane, CLIMBING. Every y comes from ARRIVAL_LANE_Y, which is the
     point's own arc-length fraction of terraceY — the walker's ramps in
     site.js are built from the same array, so the asphalt is never a
     centimetre off the ground the player is standing on. ── */
  const lanePts = AR.LANE.map(([x, z], i) => ({ x, y: ARRIVAL_LANE_Y[i] + .04, z }));
  g.add(new THREE.Mesh(ribbon(lanePts, AR.laneHalfW, 6), MAT.asphalt));
  /* the lane's own embankment shoulders, both sides, following the climb */
  for (let i = 1; i < AR.LANE.length; i++) {
    const a = AR.LANE[i - 1], b = AR.LANE[i];
    const ya = ARRIVAL_LANE_Y[i - 1], yb = ARRIVAL_LANE_Y[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L, ry = Math.atan2(dx, dz);
    const n = Math.max(2, Math.round(L / 3));
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n, y = ya + (yb - ya) * t;
      if (y < .15) continue;
      for (const s of [-1, 1]) {
        inst('arrHedgeI', UNIT_BOX, MAT.hedge,
          mat4(a[0] + dx * t + s * nx * (AR.laneHalfW + 1.5), y * .34,
            a[1] + dz * t + s * nz * (AR.laneHalfW + 1.5), 3.0, y * .68, L / n - .1, ry));
      }
    }
  }
  for (let i = 0; i < 3; i++) {                             // lamp posts
    const a = AR.LANE[i], b = AR.LANE[i + 1];
    const y = (ARRIVAL_LANE_Y[i] + ARRIVAL_LANE_Y[i + 1]) / 2;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L;
    const px = (a[0] + b[0]) / 2 + nx * 3.4, pz = (a[1] + b[1]) / 2 + nz * 3.4;
    const lry = Math.atan2(-nx, -nz);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(px, y + 3.1, pz, .16, 6.2, .16));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(px - nx * .45, y + 6.3, pz - nz * .45, .3, .18, 1.2, lry));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(px - nx * .9, y + 6.16, pz - nz * .9, .34, .12, .7, lry));
  }
  for (let i = 1; i < AR.LANE.length; i++) {                // low bollard glows
    const a = AR.LANE[i - 1], b = AR.LANE[i];
    const ya = ARRIVAL_LANE_Y[i - 1], yb = ARRIVAL_LANE_Y[i];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L;
    for (const t of [.3, .75]) {
      const x = a[0] + dx * t, z = a[1] + dz * t, y = ya + (yb - ya) * t;
      for (const s of [-1, 1]) {
        inst('glowI', UNIT_BOX, MAT.glowLamp,
          mat4(x + s * nx * (AR.laneHalfW + .55), y + .5, z + s * nz * (AR.laneHalfW + .55), .15, 1.0, .15));
      }
    }
  }

  /* ── the estate gate: the lane's boundary crossing. Everything is derived
        from AR.LANE — move the lane and the gate follows — and it now rides
        the lane's own height so the piers stand ON the drive, not in it. ── */
  {
    const a = AR.LANE[1], b = AR.LANE[2];                   // the segment crossing x 66
    const t = (66 - a[0]) / (b[0] - a[0]);
    const gx = 66, gz = a[1] + (b[1] - a[1]) * t;
    const gy = ARRIVAL_LANE_Y[1] + (ARRIVAL_LANE_Y[2] - ARRIVAL_LANE_Y[1]) * t;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const nx = dz / L, nz = -dx / L;                        // across the lane
    const gry = Math.atan2(nx, nz) + Math.PI / 2;           // box X along (nx, nz)
    for (const s of [-1, 1]) {
      const px = gx + s * nx * (AR.laneHalfW + .85), pz = gz + s * nz * (AR.laneHalfW + .85);
      inst('arrCortenI', UNIT_BOX, MAT.corten, mat4(px, gy + .80, pz, .85, 1.60, .85, gry));
      inst('arrCortenI', UNIT_BOX, MAT.corten, mat4(px, gy + 1.66, pz, .99, .12, .99, gry));
      inst('glowI', UNIT_BOX, MAT.glowLamp,
        mat4(px - s * nx * .46, gy + 1.12, pz - s * nz * .46, .12, .5, .12, gry));
      for (const [d, w] of [[1.9, 2.6], [3.9, 1.9]]) {
        inst('hedgeI', UNIT_BOX, MAT.hedge,
          mat4(px + s * nx * d, gy + .42, pz + s * nz * d, w, .84, 1.05, gry));
      }
      C.push({ x: px, z: pz, r: .62 });
    }
  }

  /* ── the court's dressing, all lifted onto the terrace ── */
  const inlay = new THREE.Mesh(new THREE.CircleGeometry(AR.inlay.r, 40), MAT.settInlay);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(AR.inlay.cx, TY + .0505, AR.inlay.cz);
  g.add(inlay);
  for (let k = 0; k <= AR.stalls.n; k++) {                  // 7 stripes → 6 stalls
    inst('arrStripeI', UNIT_BOX, MAT.white,
      mat4((AR.stalls.x0 + AR.stalls.x1) / 2, TY + .058, AR.stalls.z0 + k * AR.stalls.pitch,
        AR.stalls.x1 - AR.stalls.x0, .012, .12));
  }
  for (const k of [0, 1, 4, 5]) {
    const cz = AR.stalls.z0 + (k + .5) * AR.stalls.pitch;
    const cx = 62.3 + (rnd() - .5) * .3;
    const cry = Math.PI / 2 + (rnd() - .5) * .05;
    parkedCar(cx, cz, cry, CAR_PALETTE[Math.floor(rnd() * CAR_PALETTE.length)], TY);
    for (const s of [-1, 1]) {
      C.push({ x: cx + s * 1.15 * Math.sin(cry), z: cz + s * 1.15 * Math.cos(cry), r: 1.05 });
    }
  }

  /* ── the symmetric kerbed beds: frangipani + hedge + cordyline + ixora ── */
  const kerb = (x1, z1, x2, z2, y) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.round(len / 1.9));
    const kry = Math.atan2(x2 - x1, z2 - z1);
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      inst('arrKerbI', UNIT_BOX, MAT.stone,
        mat4(x1 + (x2 - x1) * t, y + .1, z1 + (z2 - z1) * t, .24, .2, len / n - .05, kry));
    }
  };
  /* ⚠ hex palettes, not setHSL: Color.setHSL fills in the LINEAR working
     space (no sRGB conversion, unlike setHex), so an HSL "dark maroon"
     renders two stops lighter — the first cut's cordyline came out pink. */
  const TRUNKS = [0x4f3b2b, 0x5a4433, 0x453529];
  const CORDY = [0x5e2531, 0x6b2c38, 0x4f1f28];
  /* ── KAN-211 wave A2: the Blender frangipani (generators/frangipani.py) —
     trunks on MAT.arrTrunk with a pale-grey bark colour (the arrTrunkI
     program), rosette cards on leafMat('frangi') (the palm fronds' program).
     ⚠ THE SEEDED STREAM: the blob tree below draws 3 trunks × 7 + 5 canopy masses × 7 + 7
     flecks × 3 = 77 rnd() per tree, and every later placement on the campus hangs off that
     count — so the GLB path draws them all and drops the matrices. Its own
     yaw comes from the position, never from rnd(). */
  const haveFrangi = have('frangipani') && have('frangipani_leaves');
  const frangipani = (fx, fz, fy) => {
    if (haveFrangi) {
      for (let k = 0; k < 77; k++) rnd();
      const m = mat4(fx, fy + .18, fz, 1, 1, 1, (fx * 1.37 + fz * 2.11) % (Math.PI * 2));
      inst('arrFrangiGlbI', models.geometry('frangipani'), MAT.arrTrunk, m, new THREE.Color(0x6c665f));
      inst('arrFrangiLeafGlbI', models.geometry('frangipani_leaves'), leafMat('frangi'), m);
      C.push({ x: fx, z: fz, r: .5 });
      return;
    }
    for (let t = 0; t < 3; t++) {                           // 2–3 leaning trunks
      inst('arrTrunkI', UNIT_CYL, MAT.arrTrunk,
        mat4(fx + (rnd() - .5) * .7, fy + 1.15, fz + (rnd() - .5) * .7,
          .13 + rnd() * .05, 2.3, .13 + rnd() * .05,
          0, (rnd() - .5) * .42, (rnd() - .5) * .42),
        new THREE.Color(TRUNKS[Math.floor(rnd() * TRUNKS.length)]));
    }
    const greens = [0x49703a, 0x557f42, 0x3f6532, 0x5d8a4a];
    for (let c = 0; c < 5; c++) {                           // broad sparse canopy
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(fx + (rnd() - .5) * 2.6, fy + 2.9 + rnd() * .8, fz + (rnd() - .5) * 2.2,
          2.0 + rnd() * 1.2, 1.1 + rnd() * .5, 2.0 + rnd() * 1.2),
        new THREE.Color(greens[Math.floor(rnd() * greens.length)]));
    }
    for (let p = 0; p < 7; p++) {                           // sparse pink flecks
      const a = rnd() * Math.PI * 2, rr = .9 + rnd() * 1.1;
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(fx + Math.cos(a) * rr, fy + 3.3 + rnd() * .7, fz + Math.sin(a) * rr, .3, .22, .3),
        new THREE.Color(0xe8a9bc));
    }
    C.push({ x: fx, z: fz, r: .5 });
  };
  for (const [bi, b] of AR.beds.entries()) {
    const bc = (b.z0 + b.z1) / 2, inner = bi === 0 ? b.z1 : b.z0;
    kerb(AR.bedX0, b.z0, AR.fore.x1, b.z0, TY);
    kerb(AR.bedX0, b.z1, AR.fore.x1, b.z1, TY);
    kerb(AR.bedX0, b.z0, AR.bedX0, b.z1, TY);
    kerb(AR.fore.x1, b.z0, AR.fore.x1, b.z1, TY);
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4((AR.bedX0 + AR.fore.x1) / 2, TY + .1, bc, AR.fore.x1 - AR.bedX0 - .3, .16, b.z1 - b.z0 - .3));
    colliderLine(C, AR.bedX0 + .5, bc, AR.fore.x1 - .3, bc, 1.05);
    for (let hx = AR.bedX0 + .9; hx < AR.fore.x1 - .5; hx += 1.35) {
      inst('arrHedgeI', UNIT_BOX, MAT.hedge,
        mat4(hx + (rnd() - .5) * .1, TY + .52, inner + (bi === 0 ? -.5 : .5),
          1.32, .58 + rnd() * .1, .85));
    }
    /* KAN-211 wave A2: the cordyline + ixora take Blender PROTOTYPES in the
       unit-blob envelope — same matrix, same colour, same rnd() draws, a new
       key each (a GLB carries its own geometry: one key per pair) */
    const cordy = have('cordyline_clump'), ixora = have('cordyline_clump_ixora');
    for (let c = 0; c < 4; c++) {
      inst(cordy ? 'arrCordyGlbI' : 'arrPlantI', cordy ? models.geometry('cordyline_clump') : UNIT_BLOB,
        MAT.plantFlat,
        mat4(AR.bedX0 + 1.2 + c * 1.7 + rnd() * .5, TY + .78, bc + (rnd() - .5) * .7,
          .75 + rnd() * .35, .95 + rnd() * .3, .75 + rnd() * .3),
        new THREE.Color(CORDY[Math.floor(rnd() * CORDY.length)]));
    }
    for (let c = 0; c < 6; c++) {
      inst(ixora ? 'arrIxoraGlbI' : 'arrPlantI', ixora ? models.geometry('cordyline_clump_ixora') : UNIT_BLOB,
        MAT.plantFlat,
        mat4(AR.bedX0 + .8 + rnd() * (AR.fore.x1 - AR.bedX0 - 1.6), TY + .34,
          inner + (bi === 0 ? -.95 : .95) + (rnd() - .5) * .3, .3, .24, .3),
        new THREE.Color(0xc63e1c));
    }
    frangipani(AR.bedX0 + 1.6, bc, TY);
    frangipani(AR.bedX0 + 5.6, bc, TY);
    /* the white bowl planter with its variegated dracaena, on the stair apron */
    const px = AR.stair.x1 + 1.0, pz = bc + (bi === 0 ? .35 : -.35);
    /* KAN-211 wave E: `dracaena_pot` (ASSET_SPEC Group O) — the egg bowl, four
       canes and a dense whorled head of Song-of-India strap leaves, baked, ONE
       instance at the same foot; the pair mirror each other (yaw 0 / π). No
       rnd() was ever drawn here; the collider is unchanged. */
    if (have('dracaena_pot')) {
      modelI('arrDracGlbI', 'dracaena_pot', mat4(px, TY, pz, 1, 1, 1, bi === 0 ? 0 : Math.PI));
    } else {
      inst('arrWhiteCylI', UNIT_CYL, MAT.white, mat4(px, TY + .3, pz, 1.0, .6, 1.0));
      inst('arrTrunkI', UNIT_CYL, MAT.arrTrunk, mat4(px, TY + 1.0, pz, .08, .9, .08),
        new THREE.Color(0x6a5540));
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(px, TY + 1.6, pz, .95, .8, .95),
        new THREE.Color(0xb4c878));
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(px + .25, TY + 1.42, pz - .2, .6, .55, .6),
        new THREE.Color(0x93ab5a));
    }
    C.push({ x: px, z: pz, r: .55 });
  }

  /* ══════════════════════════════════════════════════════════════════════
     B · THE FILMED STAIR — terraceY → lobbyY in the same 6 risers
     ══════════════════════════════════════════════════════════════════════ */
  /* (KAN-211: `arrival_stair` draws all of this when it loaded — the boxes are
     its fallback. The cheeks' colliders are pushed either way.) */
  if (!haveArch) {
    for (let i = 0; i < AR.risers; i++) {
      inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
        mat4(AR.stair.x1 - (i + .5) * AR.tread, TY + (i + 1) * rh / 2, bayC,
          AR.tread, (i + 1) * rh, bayW));
    }
    /* the entry landing between the stair head and the doors */
    inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
      mat4((AR.doorX + AR.stair.x0) / 2, LY - .09, bayC, AR.stair.x0 - AR.doorX, .18, bayW));
  }
  /* side plinths guarding the open flanks of the stair bay */
  for (const s of [0, 1]) {
    const pz = s ? AR.bay.z1 + .45 : AR.bay.z0 - .45;
    if (!haveArch) {
      inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
        mat4((AR.doorX + 46.7) / 2, TY + rise / 2 + .03, pz, 46.7 - AR.doorX, rise + .06, .9));
    }
    rectCollider(C, (AR.doorX + 46.7) / 2, pz, 46.7 - AR.doorX, .9, 0, .3);
  }

  /* ══════════════════════════════════════════════════════════════════════
     C · THE PAVILION SHELL — two storeys, corten over stone
     reference/photos/clubhouse-lounge-checkin-balcony.jpg is the courtyard
     elevation: vertical standing-seam weathered metal above, warm timber
     soffits under BOTH overhangs, a stone capping rail and fascia beam at
     the balcony, a charcoal stone pier at the lounge, warm timber deck.
     ══════════════════════════════════════════════════════════════════════ */
  const bcx = (B.x0 + B.x1) / 2, bcz = (B.z0 + B.z1) / 2;
  const bw = B.x1 - B.x0, bd = B.z1 - B.z0;

  /* the ARRIVAL face: corten cladding either side of the recessed entry bay,
     grade → wingH. The lower 2.65 m of it is buried by the terrace, which is
     exactly why the building reads single-storey from the car park. */
  /* (KAN-211: every corten box in §C is `arrival_shell` / `arrival_roof` /
     `arrival_entry` when those loaded; the colliders are pushed either way.) */
  for (const w of AR.wings) {
    const cz = (w.z0 + w.z1) / 2, cd = w.z1 - w.z0;
    if (!haveArch) {
      inst('arrCortenI', UNIT_BOX, MAT.corten,
        mat4(AR.faceX - .18, AR.wingH / 2, cz, .36, AR.wingH, cd));
    }
    colliderLine(C, AR.faceX - .18, w.z0, AR.faceX - .18, w.z1, .4);
  }
  /* end walls + the buried east flank of the lounge */
  for (const cz of [B.z0 + .18, B.z1 - .18]) {
    if (!haveArch) inst('arrCortenI', UNIT_BOX, MAT.corten, mat4(bcx, AR.wingH / 2, cz, bw, AR.wingH, .36));
    colliderLine(C, B.x0, cz, B.x1, cz, .4);
  }
  if (!haveArch) {
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4(AR.faceX - .18, CY / 2, bcz, .36, CY, bd));          // lounge's east wall
  }
  colliderLine(C, AR.faceX - .18, B.z0, AR.faceX - .18, B.z1, .4, BELOW);

  /* the folded mono-pitch roof: ridge over wings[1] falling to the eave over
     wings[0] — the video's slope (f_001). rotation.x = a sends local +z to
     (0, −sin a, cos a), so a NEGATIVE angle makes y RISE along +z. */
  const run = AR.wings[1].z1 - AR.wings[0].z0;
  const drop = AR.ridgeH - AR.eaveH;
  const ang = -Math.atan2(drop, run);
  const roofC = (AR.ridgeH + AR.eaveH) / 2;
  const roofZ = (AR.wings[0].z0 + AR.wings[1].z1) / 2;
  const roofW = bw + 4.6;                                      // deep courtyard eave
  const roofCX = bcx - 2.0;
  if (!haveArch) {
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4(roofCX, roofC, roofZ, roofW, .34, run + .2, 0, ang, 0));
    /* the WARM TIMBER SOFFIT under the overhang — the photo's signature */
    inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
      mat4(roofCX, roofC - .21, roofZ, roofW - .12, .1, run + .08, 0, ang, 0));
  }
  for (let k = 0; k < 7; k++) {                                // recessed downlights
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(B.x0 - 1.5, roofC - .27 + (roofZ - (B.z0 + 2.4 + k * 3.4)) * Math.tan(ang),
        B.z0 + 2.4 + k * 3.4, .16, .05, .16));
  }
  if (!haveArch) {
    inst('arrCortenI', UNIT_BOX, MAT.corten,                   // front fascia
      mat4(AR.faceX + .38, roofC - .38, roofZ, .16, 1.05, run + .15, 0, ang, 0));
    /* THE FOLD — the angular origami line over the entry (frame f_001) */
    const foldA = -Math.atan2(1.6, bayW + .2);
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4(AR.faceX + .42, AR.wingH + .15, bayC - .1, .14, .8, bayW + .9, 0, foldA, 0));
  }

  /* ── the deep flat entry canopy with slatted soffit + downlights ── */
  const canC = (AR.canopy.x0 + AR.canopy.x1) / 2, canW = AR.canopy.x1 - AR.canopy.x0;
  if (!haveArch) {
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4(canC, AR.canopy.topY - .16, bayC, canW, .32, bayW));
    const soff = box(g, canW - .2, .05, bayW - .2, canC, AR.canopy.soffitY + .025, bayC, MAT.slatCeil);
    soff.name = 'arr-soffit';
  }
  for (let k = 0; k < 6; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(canC + .55, AR.canopy.soffitY - .005, AR.bay.z0 + 1.6 + k * 1.16, .16, .05, .16));
  }

  /* ── the banded piers flanking the recessed door bay ── */
  for (const s of [0, 1]) {
    const z0 = s ? AR.doorGap.z1 : AR.bay.z0, z1 = s ? AR.bay.z1 : AR.doorGap.z0;
    const cz = (z0 + z1) / 2;
    if (!haveArch) {
      inst('arrBandI', UNIT_BOX, MAT.bands,
        mat4((AR.doorX - .1 + 44.2) / 2, LY + (AR.canopy.topY - LY) / 2, cz,
          44.2 - AR.doorX + .1, AR.canopy.topY - LY, z1 - z0));
    }
    rectCollider(C, (AR.doorX - .1 + 44.2) / 2, cz, 44.2 - AR.doorX + .1, z1 - z0, 0, .35);
  }

  /* ── the door bay: dark-framed glass, STANDING OPEN (gap walkable) ── */
  const gapC = (AR.doorGap.z0 + AR.doorGap.z1) / 2, gapW = AR.doorGap.z1 - AR.doorGap.z0;
  if (!haveArch) {
    inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX, LY + 2.55, gapC, .18, .55, gapW + .3));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX, LY + 2.25, gapC, .12, .07, gapW));
    for (const s of [-1, 1]) {
      inst('darkI', UNIT_BOX, MAT.dark,
        mat4(AR.doorX, LY + 1.15, gapC + s * gapW / 2, .14, 2.3, .12));
    }
  }
  for (const s of [-1, 1]) {                                   // the slid-open leaves
    const lz = gapC + s * (gapW / 2 + .5);
    if (haveArch) {
      /* the pane only — arrival_entry carries its bronze stiles and rails, and
         both now stop UNDER the canopy soffit (lobbyY + 1.95), which the old
         2.2 m leaves ran straight through */
      inst('glass', UNIT_BOX, MAT.glass, mat4(AR.doorX - .25, LY + .935, lz, .03, 1.73, .9));
      continue;
    }
    inst('glass', UNIT_BOX, MAT.glass, mat4(AR.doorX - .25, LY + 1.13, lz, .05, 2.2, .95));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX - .25, LY + 2.26, lz, .07, .06, .98));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX - .25, LY + .02, lz, .07, .06, .98));
  }
  /* door-plane colliders — the GAP stays open, and only up here: the lounge
     below has its own east wall, so these guard the lobby's level alone */
  colliderLine(C, AR.doorX, AR.bay.z0, AR.doorX, AR.doorGap.z0, .4, ABOVE);
  colliderLine(C, AR.doorX, AR.doorGap.z1, AR.doorX, AR.bay.z1, .4, ABOVE);

  /* ── one pair of fluted brass cylinder sconces flanking the doors ── */
  for (const s of [-1, 1]) {
    const sz = gapC + s * (gapW / 2 + .35);
    if (haveArch) {
      /* KAN-211: `arrival_sconce` (Ø .20 × .80, origin at its centre) on the
         SAME glowing material, stood off arrival_entry's bronze plate + arm
         (plate face x 44.26, arm to 44.33). Centre 4.85: high on the pier and
         clear of the canopy soffit at 5.55 — the old 1.2 m cylinder at
         LY + 1.7 ran 0.35 m up through it. */
      inst('arrSconceGlbI', models.geometry('arrival_sconce'), MAT.brassFlute,
        mat4(44.44, 4.85, sz, 1, 1, 1));
      continue;
    }
    inst('darkI', UNIT_BOX, MAT.dark, mat4(44.22, LY + 1.7, sz, .08, .55, .3));
    inst('arrSconceI', UNIT_CYL, MAT.brassFlute, mat4(44.34, LY + 1.7, sz, .22, 1.2, .22));
  }

  /* ── the plaque wall: wings[0] gets a banded front panel inside the corten
     frame, carrying the flush white plaque — 隐逸居 / THE SERENE RETREAT ── */
  const plWallZ = (AR.wings[0].z0 + AR.wings[0].z1) / 2 + 2.0;
  if (!haveArch) {
    inst('arrBandI', UNIT_BOX, MAT.bands,
      mat4(AR.faceX + .06, TY + 1.9, plWallZ, .12, 2.9, 5.2));
  }
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.12), MAT.plaque);
  /* KAN-211: the banded wall is RECESSED inside the corten frame now (as f_001
     shows it), its ledges' face at faceX − .27 — the plaque sits 30 mm proud */
  pl.position.set(haveArch ? AR.faceX - .24 : AR.faceX + .15, TY + 2.45, plWallZ);
  pl.rotation.y = Math.PI / 2;
  g.add(pl);

  /* ══════════════════════════════════════════════════════════════════════
     D · THE 酒廊 LOUNGE at courtyard grade — 280 ㎡, breakfast is served
     Carl: "the floor below is actually the club house lounge where people
     will be having breakfast". Folding glass onto a warm timber deck, a
     charcoal stone pier carrying 隐逸居酒廊 / SERENE RETREAT LOUNGE, a dark
     louvre band under the balcony, sheer cream curtains behind the glass.
     ══════════════════════════════════════════════════════════════════════ */
  MAT.loungeFloor.map.repeat.set(bw / 2.2, bd / 2.2);
  /* KAN-211 wave D: the canvas boards rendered salmon-orange; floor_teak.webp is
     cedar_soffit's photographed boards re-graded to the clubhouse's reddish-
     brown interior timber (assets/blender/derive_floor_teak.py), ~1.8 m a tile */
  if (haveSlat) {
    photoTex(MAT.loungeFloor, 'floor_teak.webp', [(bw - .4) / 1.8, (bd - .4) / 1.8]);
    /* the floor's OWN envMap (the same scene.environment texture — same program)
       so its env level binds at all (CLAUDE.md KAN-211 FIX PASS: three ignores
       envMapIntensity without one). At the scene's .95 the grey room env sat on
       the boards as a mauve sheen: measured (181,140,120) against a texture
       mean of (101,60,42). */
    envKnob(MAT.loungeFloor, LOUNGE_FLOOR_ENV, 'campus:MAT.loungeFloor');
  }
  box(g, bw - .4, .1, bd - .4, bcx, .06, bcz, MAT.loungeFloor);
  /* slat ceiling = the lobby slab's underside (wave D: real slats under it, the
     box kept as their black backing) */
  box(g, bw - .5, .1, bd - .5, bcx, CY - .06, bcz, haveSlat ? MAT.dark : MAT.slatCeil);
  if (haveSlat) slatCeiling(bcx - (bw - .5) / 2, bcx + (bw - .5) / 2, bcz - (bd - .5) / 2, bcz + (bd - .5) / 2, CY - .11);
  for (let k = 0; k < 9; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(B.x0 + 2.6 + (k % 3) * 3.6, haveSlat ? CY - .18 : CY - .12, B.z0 + 3.4 + Math.floor(k / 3) * 7.6, .16, .05, .16));
  }
  /* the folding glass wall on the courtyard face, standing OPEN over
     loungeGap; sheer cream curtains behind every closed bay */
  const LG = AR.loungeGap;
  for (const [z0, z1] of [[B.z0 + .4, LG.z0], [LG.z1, B.z1 - .4]]) {
    const seg = z1 - z0;
    if (seg < .2) continue;
    inst('glass', UNIT_BOX, MAT.glass, mat4(B.x0, 1.5, (z0 + z1) / 2, .1, 2.9, seg));
    if (!haveFacade) {                 // KAN-211: lounge_facade draws the frames
      const n = Math.max(2, Math.round(seg / 1.15));
      for (let k = 0; k <= n; k++) {
        inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0 - .02, 1.5, z0 + seg * k / n, .16, 2.94, .11));
      }
      inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0, 3.02, (z0 + z1) / 2, .2, .16, seg));
    }
    for (let k = 0; k < Math.max(2, Math.round(seg / 1.5)); k++) {
      inst('arrSheerI', UNIT_BOX, MAT.sheer,
        mat4(B.x0 + .3, 1.5, z0 + .7 + k * 1.5, .1, 2.7, 1.05));
    }
  }
  /* the two folded-back leaves parked at the opening's jambs */
  for (const lz of [LG.z0 + .5, LG.z1 - .5]) {
    inst('glass', UNIT_BOX, MAT.glass, mat4(B.x0 + .35, 1.5, lz, .06, 2.85, .95));
    if (!haveFacade) inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0 + .35, 2.95, lz, .1, .1, .99));
  }
  /* the DARK LOUVRE BAND above the glass, under the balcony (the photo's line) */
  if (!haveFacade) {
    for (let y = 3.04; y < CY - .01; y += .09) {
      inst('arrLouvreI', UNIT_BOX, MAT.dark, mat4(B.x0 - .12, y, bcz, .1, .05, bd - .5));
    }
  }
  /* the CHARCOAL STONE PIER with the lounge's own plaque */
  const pierZ = B.z1 - 3.6, pierD = 4.6;
  if (!haveFacade) inst('arrPierI', UNIT_BOX, MAT.charcoal, mat4(B.x0 - .05, 1.62, pierZ, .3, 3.24, pierD));
  const lpl = new THREE.Mesh(new THREE.PlaneGeometry(1.15, .88), MAT.loungePlaque);
  lpl.position.set(B.x0 - .22, 2.15, pierZ + .5);
  lpl.rotation.y = -Math.PI / 2;
  g.add(lpl);
  colliderLine(C, B.x0, pierZ - pierD / 2, B.x0, pierZ + pierD / 2, .3, BELOW);
  /* the courtyard face's collider: solid at lounge level except the opening */
  colliderLine(C, B.x0, B.z0, B.x0, LG.z0, .35, BELOW);
  colliderLine(C, B.x0, LG.z1, B.x0, B.z1, .35, BELOW);
  /* the warm timber DECK, then the dark round column carrying the overhang */
  MAT.warmDeck.map.repeat.set((DK.x1 - DK.x0) / 1.4, bd / 1.4);
  box(g, DK.x1 - DK.x0, .12, bd + .8, (DK.x0 + DK.x1) / 2, .06, bcz, MAT.warmDeck);
  for (const cz of [B.z0 + 1.6, B.z1 - 1.6]) {
    inst('arrColI', UNIT_CYL, MAT.charcoal, mat4(DK.x0 + .9, 1.72, cz, .46, 3.44, .46));
    C.push({ x: DK.x0 + .9, z: cz, r: .3, y1: CY });
  }
  /* flowering red-orange shrubs at the deck's corner (the photo) */
  for (let k = 0; k < 5; k++) {
    inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
      mat4(DK.x0 - .5 - rnd() * 1.2, .55 + rnd() * .3, B.z1 + .5 + rnd() * 1.6,
        1.0 + rnd() * .5, .9 + rnd() * .4, 1.0 + rnd() * .5),
      new THREE.Color([0x3f6532, 0xc63e1c, 0xd85a1e][Math.floor(rnd() * 3)]));
  }

  /* ── BREAKFAST: sixty covers. A banquette run down the buried east wall, a
     grid of two- and four-tops across the room, and a buffet/service counter
     at the north end. Everything instanced. ── */
  /* wave D: `dining_chair_rattan` (front +Z — ry = the facing yaw) at a seat
     point .22 m clear of the table edge; the primitive chairs' backs never
     turned with them (their offset was in world z). No chair has a collider. */
  const chairGlb = (cx, cz, ry) => modelI('arrBkChairGlbI', 'dining_chair_rattan', mat4(cx, 0, cz, 1, 1, 1, ry));
  const chair = (cx, cy, cz, cry) => {
    inst('arrChairI', UNIT_BOX, MAT.rattan, mat4(cx, cy + .43, cz, .46, .07, .46, cry));
    inst('arrChairI', UNIT_BOX, MAT.rattan, mat4(cx, cy + .68, cz - .21, .46, .5, .06, cry));
    for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) {
      inst('arrChairLegI', UNIT_BOX, MAT.dark,
        mat4(cx + lx * Math.cos(cry) + lz * Math.sin(cry), cy + .21,
          cz - lx * Math.sin(cry) + lz * Math.cos(cry), .05, .43, .05, cry));
    }
  };
  const setting = (cx, cy, cz) => {
    inst('arrWareI', UNIT_CYL, MAT.white, mat4(cx, cy + .02, cz, .24, .03, .24));
    inst('arrWareI', UNIT_CYL, MAT.white, mat4(cx + .18, cy + .05, cz - .1, .09, .09, .09));
  };
  const table = (cx, cz, seats) => {
    const w = seats === 4 ? 1.5 : .95, d = seats === 4 ? .95 : .95;
    const off = seats === 4 ? [[-.55, 0], [.55, 0], [0, -.62], [0, .62]] : [[-.62, 0], [.62, 0]];
    if (haveBk) {                       // wave D: the set table is ONE baked mesh
      modelI(seats === 4 ? 'arrBkTableGlbI' : 'arrBkTable2GlbI',
        seats === 4 ? 'breakfast_table' : 'breakfast_table_two', mat4(cx, 0, cz, 1, 1, 1));
      for (const [ox, oz] of off) {
        const ex = ox ? Math.sign(ox) * (w / 2 + .22) : 0, ez = oz ? Math.sign(oz) * (d / 2 + .22) : 0;
        chairGlb(cx + ex, cz + ez, Math.atan2(-ox, -oz));
      }
    } else {
      inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(cx, .74, cz, w, .07, d));
      inst('arrTableLegI', UNIT_BOX, MAT.dark, mat4(cx, .37, cz, .12, .74, .12));
      inst('arrTableLegI', UNIT_BOX, MAT.dark, mat4(cx, .03, cz, .7, .06, .7));
      inst('arrWareI', UNIT_CYL, MAT.white, mat4(cx, .82, cz, .12, .12, .12));   // bud vase
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(cx, .95, cz, .22, .2, .22),
        new THREE.Color(0xecd7ae));
      for (const [ox, oz] of off) {
        chair(cx + ox * 1.35, 0, cz + oz * 1.35, Math.atan2(-ox, -oz));
        setting(cx + ox * .42, .76, cz + oz * .42);
      }
    }
    /* ⚠ BELOW. Every collider in this room must carry the lounge's height
       window: the check-in lobby's floor is 3.6 m directly overhead, and an
       all-heights breakfast table walls off the lobby above it — which is
       exactly how the first walk test lost the route to the desk. */
    rectCollider(C, cx, cz, w + .4, d + .4, 0, .26, BELOW);
  };
  let covers = 0;
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      const seats = (r + c) % 3 === 0 ? 2 : 4;
      table(B.x0 + 3.6 + c * 4.2, B.z0 + 3.2 + r * 4.1, seats);
      covers += seats;
    }
  }
  /* the banquette run along the buried east wall — 5 × four-tops against it */
  for (let k = 0; k < 5; k++) {
    const bz = B.z0 + 3.2 + k * 4.1;
    if (haveBk) {
      modelI('arrBkBanqGlbI', 'breakfast_banquette', mat4(B.x1 - 1.0, 0, bz, 1, 1, 1));
      modelI('arrBkTableGlbI', 'breakfast_table', mat4(B.x1 - 2.4, 0, bz, 1.4 / 1.5, 1, .9 / .95));
      /* the old call passed −π/2, which faces a front-+Z chair AWAY from the table */
      for (const oz of [-.6, .6]) chairGlb(B.x1 - 3.32, bz + oz, Math.PI / 2);
    } else {
      inst('arrBanqI', UNIT_BOX, MAT.ivory, mat4(B.x1 - 1.0, .24, bz, 1.1, .48, 3.4));
      inst('arrBanqI', UNIT_BOX, MAT.ivory, mat4(B.x1 - .55, .78, bz, .2, .62, 3.4));
      inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(B.x1 - 2.4, .74, bz, 1.4, .07, .9));
      inst('arrTableLegI', UNIT_BOX, MAT.dark, mat4(B.x1 - 2.4, .37, bz, .12, .74, .12));
      for (const oz of [-.6, .6]) chair(B.x1 - 3.3, 0, bz + oz, -Math.PI / 2);
      setting(B.x1 - 2.4, .76, bz - .2);
      setting(B.x1 - 2.4, .76, bz + .2);
    }
    covers += 4;
  }
  void covers;                                  // 60 covers, per the hotel's spec
  colliderLine(C, B.x1 - 1.6, B.z0 + 1.4, B.x1 - 1.6, B.z1 - 1.4, .3, BELOW);
  /* the buffet / service counter, in the SOUTH-EAST corner. ⚠ It sat over the
     internal stair's mouth in the first cut and stopped the climb dead at
     0.80 m; AR.INTS reaches x 39.5, so the counter starts east of that. */
  const bufX = B.x1 - 2.4, bufZ = B.z1 - 1.15;
  if (haveBk) {
    modelI('arrBkBuffetGlbI', 'breakfast_buffet', mat4(bufX, 0, bufZ, 1, 1, 1));
  } else {
    inst('arrCounterI', UNIT_BOX, MAT.rtDarkTeak, mat4(bufX, .5, bufZ, 3.8, 1.0, .8));
    inst('arrCounterTopI', UNIT_BOX, MAT.marble, mat4(bufX, 1.03, bufZ, 4.0, .07, .95));
    for (let k = 0; k < 4; k++) {
      inst('arrWareI', UNIT_CYL, MAT.white,
        mat4(bufX - 1.4 + k * .95, 1.14, bufZ - .1, .34, .16, .34));
    }
  }
  inst('loungeGlowI', UNIT_BOX, MAT.loungeGlow, mat4(bufX, 1.9, bufZ + .3, 3.6, .07, .1));
  rectCollider(C, bufX, bufZ, 4.2, 1.1, 0, .3, BELOW);
  /* ── wave D: the breakfast room's INTERIOR DISTANCE CULL ────────────────────
     Each baked bucket is ONE InstancedMesh with one bounding sphere round the
     whole room, so the 44 chairs + 15 set tables + banquettes + buffet + both
     slat ceilings (~100k tris) drew — and drew AGAIN in the hero pool's mirror
     — from every view that merely had the pavilion in frustum, e.g. +94k tris
     in the mirror pass at archC-signature-night. Past LOUNGE_CULL_D from the
     room's centre a 1 m chair is < 21 px behind a folding-glass wall; the
     buckets are hidden there (visible flag, both passes; no program, no
     collider, no instance touched). */
  if (haveBk || haveSlat) {
    const lc = enclaveToWorld(bcx, bcz);
    const keys = ['arrBkChairGlbI', 'arrBkTableGlbI', 'arrBkTable2GlbI', 'arrBkBanqGlbI',
      'arrBkBuffetGlbI', 'arrSlatCeilGlbI'];
    let ims = null;
    (G.tickers ||= []).push(() => {
      if (!ims) {
        ims = keys.map(k => G.scene.getObjectByName('campus:' + k)).filter(Boolean);
        if (!ims.length) { ims = null; return; }
      }
      const cp = G.camera.position;
      const on = Math.hypot(cp.x - lc.x, cp.z - lc.z) < LOUNGE_CULL_D;
      if (ims[0].visible !== on) for (const m of ims) m.visible = on;
    });
  }

  /* ══════════════════════════════════════════════════════════════════════
     E · THE INTERNAL STAIR — lounge ⇄ check-in lobby
     ══════════════════════════════════════════════════════════════════════ */
  {
    const S = AR.INTS, n = 19, srun = (S.x1 - S.x0) / n, srise = LY / n;
    const scz = (S.z0 + S.z1) / 2, sw = S.z1 - S.z0;
    for (let i = 0; i < n; i++) {
      inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
        mat4(S.x0 + (i + .5) * srun, (i + 1) * srise / 2, scz, srun, (i + 1) * srise, sw));
    }
    /* a copper handrail on the open (courtyard) side, and a wall on the other */
    for (let i = 0; i <= n; i += 2) {
      inst('arrRailI', UNIT_BOX, MAT.copper,
        mat4(S.x0 + i * srun, i * srise + 1.0, S.z0 - .06, .07, .07, .07));
    }
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4((S.x0 + S.x1) / 2, LY / 2, S.z1 + .18, S.x1 - S.x0, LY, .3));
    colliderLine(C, S.x0, S.z1 + .18, S.x1, S.z1 + .18, .28);
    colliderLine(C, S.x0, S.z0 - .3, S.x1, S.z0 - .3, .28, { y1: LY - .3 });
  }

  /* ══════════════════════════════════════════════════════════════════════
     F · THE CHECK-IN LOBBY at lobbyY — reference 61/62/63.png
     Warm timber floor, a blue-grey rug with a pale wave motif, cream
     low-back sofas facing each other over dark timber tables, big leafy
     planters, a dark timber slat ceiling, and a full-height dark-framed
     glass wall with sheer curtains onto the balcony — which looks DOWN over
     the courtyard, the villa roofs and the pool. That view is the payoff.
     ══════════════════════════════════════════════════════════════════════ */
  const LK = AR.LINK, SL = AR.SLOT, HD = AR.HEAD;
  const lcx = (LB.x0 + LB.x1) / 2, lcz = (LB.z0 + LB.z1) / 2;
  const lw = LB.x1 - LB.x0, ld = LB.z1 - LB.z0;
  MAT.lobbyFloor.map.repeat.set(lw / 2.0, ld / 2.0);
  /* KAN-211 wave E: the lobby floor was still the salmon canvas boards. It takes
     the 酒廊's wave-D recipe — floor_teak.webp (~1.8 m a tile), its OWN envMap
     (the same scene.environment texture: same program) so the env level binds
     — plus a day colour graded to the lobby's own glossy reddish-brown timber
     (f_023, the boards round the rug in shade: median (90, 54, 36)). The night
     tint entry is re-based on the new day colour, so night stays the same
     multiplier it was. */
  if (haveSlat) {
    photoTex(MAT.lobbyFloor, 'floor_teak.webp', [lw / 1.8, ld / 1.8]);
    const e = NIGHT.tint.find(t => t.mat === MAT.lobbyFloor);
    const c = new THREE.Color(LOBBY_FLOOR_TINT);
    MAT.lobbyFloor.color.copy(c);
    if (e) {                       // n = nightHex × d, so re-base it on the new d
      e.n.setRGB(e.n.r / (e.d.r || 1) * c.r, e.n.g / (e.d.g || 1) * c.g, e.n.b / (e.d.b || 1) * c.b);
      e.d.copy(c);
    }
    envKnob(MAT.lobbyFloor, LOBBY_FLOOR_ENV, 'campus:MAT.lobbyFloor');
  }
  box(g, lw, .1, ld, lcx, LY - .05, lcz, MAT.lobbyFloor);
  box(g, lw - .3, .1, ld - .3, lcx, LY + AR.lobbyH - .06, lcz, haveSlat ? MAT.dark : MAT.slatCeil);
  if (haveSlat) slatCeiling(lcx - (lw - .3) / 2, lcx + (lw - .3) / 2, lcz - (ld - .3) / 2, lcz + (ld - .3) / 2,
    LY + AR.lobbyH - .11);
  for (let k = 0; k < 12; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(LB.x0 + 2.2 + (k % 3) * 3.2, LY + AR.lobbyH - (haveSlat ? .18 : .12),
        LB.z0 + 2.6 + Math.floor(k / 3) * 5.4, .16, .05, .16));
  }
  /* the rug — a CanvasTexture, blue-grey with the pale wave lines of 61.png */
  const rug = new THREE.Mesh(UNIT_PLANE, MAT.rugWave);
  rug.scale.set(6.2, 1, 7.4);
  rug.position.set(LB.x0 + 4.4, LY + .012, -13.2);
  g.add(rug);
  const rug2 = new THREE.Mesh(UNIT_PLANE, MAT.rugWave);
  rug2.scale.set(5.4, 1, 5.8);
  rug2.position.set(LB.x0 + 4.4, LY + .012, -4.6);
  g.add(rug2);

  /* the sofas: cream, low-back, square cushions, facing each other */
  const sofa = (cx, cz, cry, len) => {
    const c = Math.cos(cry), s = Math.sin(cry);
    const P = (lx, lz) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
    /* `lobby_sofa` — the whole piece: the seat band, its four loose cushions,
       the low back, the leaning scatters and the four feet, one baked mesh.
       ⚠ THE YAW IS THE TRAP. P() maps local +z to the sofa's OPEN side (the
       back is drawn at P(0, −.42)), and a rotation.y of `cry` puts local +Z
       there — but the GLB's FRONT is −Z, so `ry = cry` seats every sofa
       facing the wall and nothing throws. `cry + π` is the change of basis.
       ⚠ ONE NEW BUCKET KEY. inst() binds geometry AND material on a key's
       first use across the whole builder, so a model — which carries both
       halves of the pair — can never share a key with arrSofaI, arrCushI or
       arrSofaFootI, which keep theirs for the fallback. `arrSofaGlbI` is the
       `<room><Model>GlbI` name modelI() asks for.
       ⚠ FOUR CALL SITES, TWO LENGTHS: 3.4 ×2 on the big rug, 2.8 ×2 south.
       The model is the 3.4; the short pair is scale.x = len / 3.4 = 0.8235,
       along its own length, which is its local X.
       Origin is the sofa's own registration point (not the bbox — the back's
       35 mm overhang would have shifted it 17.5 mm), so it goes at (cx, LY,
       cz) exactly as P(0, 0) did, and its z runs −0.475 … +0.510 in P's frame
       against the primitive's −0.51 … +0.475. rectCollider below is 3.70 ×
       1.10 about the same centre and does not move. */
    const glbSofa = have('lobby_sofa');
    if (glbSofa) {
      modelI('arrSofaGlbI', 'lobby_sofa',
        mat4(cx, LY, cz, len / 3.4, 1, 1, cry + Math.PI));
    } else {
      const seat = P(0, 0);
      inst('arrSofaI', UNIT_BOX, MAT.ivory, mat4(seat[0], LY + .30, seat[1], len, .30, .95, cry));
      const back = P(0, -.42);
      inst('arrSofaI', UNIT_BOX, MAT.ivory, mat4(back[0], LY + .62, back[1], len, .66, .18, cry));
    }
    for (let k = 0; k < Math.round(len / .9); k++) {
      const px = -len / 2 + .55 + k * .9;
      const p = P(px, -.28);
      /* ⚠ THE SEEDED STREAM. This rnd() is drawn in BOTH paths and in the
         same order — the scatter cushions are inside the GLB, but every draw
         after this point on the campus (and there are thousands) depends on
         the count, so the model may not skip one. */
      const jitter = (rnd() - .5) * .2;
      if (!glbSofa) {
        inst('arrCushI', UNIT_BOX, MAT.ivoryWarm,
          mat4(p[0], LY + .68, p[1], .52, .52, .2, cry + jitter));
      }
    }
    if (!glbSofa) {
      for (const lx of [-len / 2 + .18, len / 2 - .18]) {
        for (const lz of [-.38, .38]) {
          const p = P(lx, lz);
          inst('arrSofaFootI', UNIT_BOX, MAT.white, mat4(p[0], LY + .075, p[1], .07, .15, .07, cry));
        }
      }
    }
    /* ⚠ ABOVE, for the mirror-image reason the lounge's furniture is BELOW:
       the 酒廊 is 3.6 m underneath and a sofa registered at every height is a
       sofa standing in the middle of the breakfast room. */
    rectCollider(C, cx, cz, len + .3, 1.1, cry, .28, ABOVE);
  };
  const lowTable = (cx, cz) => {
    inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(cx, LY + .34, cz, 1.5, .1, .9));
    inst('arrTableLegI', UNIT_BOX, MAT.dark, mat4(cx, LY + .16, cz, 1.3, .28, .74));
    inst('arrWareI', UNIT_CYL, MAT.white, mat4(cx, LY + .46, cz - .2, .2, .14, .2));
    inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(cx, LY + .6, cz - .2, .3, .26, .3),
      new THREE.Color(0xbf6f9a));
    rectCollider(C, cx, cz, 1.7, 1.1, 0, .24, ABOVE);
  };
  sofa(LB.x0 + 4.4, -15.6, 0, 3.4);
  sofa(LB.x0 + 4.4, -10.8, Math.PI, 3.4);
  lowTable(LB.x0 + 4.4, -13.2);
  /* the south group sits clear of AR.INTS's well (z −0.8…2.0) — its first
     placement put a sofa across the top of the internal stair */
  sofa(LB.x0 + 4.4, -6.2, 0, 2.8);
  sofa(LB.x0 + 4.4, -3.0, Math.PI, 2.8);
  lowTable(LB.x0 + 4.4, -4.6);

  /* big leafy planters in the corners */
  for (const [px, pz] of [[LB.x0 + 1.3, -18.6], [LB.x0 + 1.3, -6.4],
    [LB.x1 - 1.4, -17.2], [LB.x1 - 1.4, 1.0]]) {
    inst('arrWhiteCylI', UNIT_CYL, MAT.white, mat4(px, LY + .3, pz, .78, .6, .78));
    for (let k = 0; k < 6; k++) {
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(px + (rnd() - .5) * .7, LY + .78 + rnd() * .8, pz + (rnd() - .5) * .7,
          .5 + rnd() * .3, .32 + rnd() * .2, .5 + rnd() * .3),
        new THREE.Color([0x3f6532, 0x557f42, 0x6b8f4a][Math.floor(rnd() * 3)]));
    }
    C.push({ x: px, z: pz, r: .55, y0: CY });
  }

  /* ── the west glass wall + sheer curtains, with the two walkable gaps ── */
  const gaps = AR.lobbyGaps;
  const spans = [[LB.z0, gaps[0].z0], [gaps[0].z1, gaps[1].z0], [gaps[1].z1, LB.z1]];
  for (const [z0, z1] of spans) {
    const seg = z1 - z0;
    if (seg < .2) continue;
    inst('glass', UNIT_BOX, MAT.glass, mat4(LB.x0, LY + 1.45, (z0 + z1) / 2, .1, 2.8, seg));
    if (!haveFacade) {                 // KAN-211: lounge_facade draws frames + transom
      const n = Math.max(2, Math.round(seg / 1.15));
      for (let k = 0; k <= n; k++) {
        inst('darkI', UNIT_BOX, MAT.dark, mat4(LB.x0 - .02, LY + 1.45, z0 + seg * k / n, .16, 2.86, .11));
      }
      inst('darkI', UNIT_BOX, MAT.dark, mat4(LB.x0, LY + 2.92, (z0 + z1) / 2, .2, .16, seg));
      /* the dark horizontal louvre/transom panel above the glass */
      for (let y = LY + 3.0; y < LY + AR.lobbyH - .12; y += .1) {
        inst('arrLouvreI', UNIT_BOX, MAT.dark, mat4(LB.x0 - .1, y, (z0 + z1) / 2, .1, .055, seg));
      }
    }
    for (let k = 0; k < Math.max(2, Math.round(seg / 1.6)); k++) {
      inst('arrSheerI', UNIT_BOX, MAT.sheer,
        mat4(LB.x0 + .3, LY + 1.45, z0 + .8 + k * 1.6, .1, 2.6, 1.1));
    }
    colliderLine(C, LB.x0, z0, LB.x0, z1, .3, ABOVE);
  }
  /* one warm timber panel bay in the upper facade, beside the glass (photo) */
  if (!haveFacade) {
    inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
      mat4(LB.x0 - .16, LY + 1.6, LB.z1 - 3.6, .12, 3.1, 4.4));
  }

  /* ══════════════════════════════════════════════════════════════════════
     G · THE BALCONY — cantilevered, frameless glass, flat stone capping
     ══════════════════════════════════════════════════════════════════════ */
  if (!haveFacade) {                   // KAN-211: lounge_facade's balcony edge
    box(g, BC.x1 - BC.x0, .3, ld + .6, (BC.x0 + BC.x1) / 2, LY - .17, lcz, MAT.blackPolish);
    /* the stone FASCIA BEAM under it, and the warm timber soffit inboard */
    inst('arrCapI', UNIT_BOX, MAT.stoneCap,
      mat4(BC.x0 - .06, LY - .30, lcz, .28, .56, ld + .7));
    inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
      mat4((BC.x0 + BC.x1) / 2, LY - .34, lcz, BC.x1 - BC.x0 - .3, .1, ld + .4));
  }
  /* frameless glass balustrade + the broad flat stone capping rail */
  /* ⚠ the WEST run is broken where the upper walkway leaves the balcony —
     AR.lobbyGaps[0] is the same span the lobby's glass wall opens on and the
     same span AR.LINK occupies, so the three can never drift apart. A rail
     across it is a rail across the only route to the atrium and the suite. */
  const RAIL = [[BC.x0, LB.z0, BC.x0, LK.z0], [BC.x0, LK.z1, BC.x0, LB.z1],
    [BC.x0, LB.z0, BC.x1, LB.z0], [BC.x0, LB.z1, BC.x1, LB.z1]];
  for (const [x1, z1, x2, z2] of RAIL) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ry = Math.atan2(x2 - x1, z2 - z1);
    inst('arrGlassRailI', UNIT_BOX, MAT.clear,
      mat4((x1 + x2) / 2, LY + .53, (z1 + z2) / 2, .05, 1.02, len, ry));
    if (!haveFacade) {
      inst('arrCapI', UNIT_BOX, MAT.stoneCap,
        mat4((x1 + x2) / 2, LY + 1.08, (z1 + z2) / 2, .26, .1, len + .1, ry));
    }
    colliderLine(C, x1, z1, x2, z2, .28, ABOVE);
  }

  /* ══════════════════════════════════════════════════════════════════════
     H · THE CHECK-IN DESK, the cabinet wall, and the staff
     reference 63.png: a dark timber counter with a vertical slat front and a
     solid top, the white four-panel cabinet wall behind it, a monitor, a
     small shaded table lamp, a white bowl of dried flowers, and big leafy
     plants at the corner.
     ══════════════════════════════════════════════════════════════════════ */
  const DX = LB.x0 + 5.4, DZ = LB.z0 + 1.7;            // the corner by the north wall
  const DLEN = 3.8;
  {
    /* the white FOUR-PANEL cabinet wall behind the desk */
    /* ⚠ INSIDE the end wall. LB.z0 is the room's line; the corten end wall's
       own face is 0.36 m of it, so a panel at LB.z0 − 0.12 stands outdoors and
       the desk backs onto bare cladding. */
    const CABZ = LB.z0 + .42;
    /* KAN-211: `lobby_desk` is the cabinet wall, the counter, its slats and the
       monitor when it loaded; the lamp, the bowl and its seeded flowers stay
       ours (their rnd() draws below must not move) */
    if (!haveDesk) {
      for (let k = 0; k < 4; k++) {
        inst('arrCabI', UNIT_BOX, MAT.cabinet,
          mat4(DX - DLEN / 2 + .05 + (k + .5) * (DLEN + .8) / 4, LY + 1.55, CABZ,
            (DLEN + .8) / 4 - .05, 3.0, .12));
      }
      inst('arrCabPlinthI', UNIT_BOX, MAT.rtDarkTeak,
        mat4(DX, LY + .04, CABZ, DLEN + .9, .08, .16));           // its dark plinth
      /* the counter: solid dark timber top over a vertical slat front */
      inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + 1.06, DZ, DLEN, .09, .78));
      inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + .55, DZ - .36, DLEN, 1.02, .07));
      inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + .55, DZ + .36, DLEN, 1.02, .07));
      for (const s of [-1, 1]) {
        inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak,
          mat4(DX + s * DLEN / 2, LY + .55, DZ, .07, 1.02, .78));
      }
      for (let k = 0; k < Math.round(DLEN / .11); k++) {         // the bamboo slats
        inst('arrSlatI', UNIT_BOX, MAT.slatWarm,
          mat4(DX - DLEN / 2 + .1 + k * .11, LY + .53, DZ + .40, .045, .94, .045));
      }
      /* the monitor */
      inst('arrDeskDarkI', UNIT_BOX, MAT.dark, mat4(DX + 1.2, LY + 1.36, DZ - .1, .06, .5, .78));
      inst('arrDeskDarkI', UNIT_BOX, MAT.dark, mat4(DX + 1.2, LY + 1.12, DZ - .1, .2, .06, .3));
    }
    /* the shaded lamp, and the white bowl of dried flowers */
    inst('arrLampI', UNIT_CYL, MAT.dark, mat4(DX + .2, LY + 1.24, DZ - .05, .04, .28, .04));
    inst('arrLampShadeI', UNIT_CONE, MAT.lampShade, mat4(DX + .2, LY + 1.46, DZ - .05, .34, .3, .34));
    inst('arrWhiteCylI', UNIT_CYL, MAT.white, mat4(DX - 1.2, LY + 1.22, DZ - .05, .42, .24, .42));
    for (let k = 0; k < 7; k++) {
      const a = rnd() * Math.PI * 2;
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(DX - 1.2 + Math.cos(a) * .22, LY + 1.5 + rnd() * .3, DZ - .05 + Math.sin(a) * .22,
          .14, .12, .14), new THREE.Color(0xb9c08a));
    }
    /* big leafy plants at the desk's corner */
    for (const pz of [DZ + 1.6, DZ + 2.7]) {
      inst('arrWhiteCylI', UNIT_CYL, MAT.white, mat4(DX + DLEN / 2 + 1.1, LY + .26, pz, .62, .52, .62));
      for (let k = 0; k < 5; k++) {
        inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
          mat4(DX + DLEN / 2 + 1.1 + (rnd() - .5) * .6, LY + .68 + rnd() * .55, pz + (rnd() - .5) * .6,
            .46 + rnd() * .22, .3 + rnd() * .16, .46 + rnd() * .22),
          new THREE.Color([0x3f6532, 0x6b8f4a, 0x8fae63][Math.floor(rnd() * 3)]));
      }
      C.push({ x: DX + DLEN / 2 + 1.1, z: pz, r: .42, y0: CY });
    }
    /* the desk's collider — guests walk UP to it, not through it */
    rectCollider(C, DX, DZ, DLEN + .3, .95, 0, .26, ABOVE);
    colliderLine(C, DX - DLEN / 2 - .2, DZ - .5, DX + DLEN / 2 + .2, DZ - .5, .26, ABOVE);

    /* ── STAFF STANDING BY. Two stylised figures in the venue's palette; no
       faces, and both stand BEHIND the counter so they never block the
       route. Cheap: five instanced boxes each, in the buckets everything
       else here uses. ── */
    /* 1.90 m to the crown, which is not vanity: the counter's top is at
       LY + 1.06, so a 1.6 m figure shows nothing but a hairline above it and
       the desk reads unstaffed from every angle a guest actually stands at. */
    for (const [sx, syaw] of [[DX - .95, .16], [DX + 1.0, -.12]]) {
      const sz = DZ - .82;
      inst('arrStaffI', UNIT_CYL, MAT.uniform, mat4(sx, LY + .48, sz, .38, .96, .3, syaw));
      inst('arrStaffTopI', UNIT_BOX, MAT.uniformTop, mat4(sx, LY + 1.32, sz, .48, .62, .3, syaw));
      inst('arrStaffTopI', UNIT_BOX, MAT.uniformTop,
        mat4(sx - .28, LY + 1.28, sz + .06, .13, .56, .16, syaw));
      inst('arrStaffTopI', UNIT_BOX, MAT.uniformTop,
        mat4(sx + .28, LY + 1.28, sz + .06, .13, .56, .16, syaw));
      inst('arrStaffHeadI', UNIT_CYL, MAT.skin, mat4(sx, LY + 1.76, sz, .23, .28, .23, syaw));
      inst('arrStaffHairI', UNIT_BLOB, MAT.hair, mat4(sx, LY + 1.86, sz - .02, .26, .22, .25, syaw));
      C.push({ x: sx, z: sz, r: .3, y0: CY });
    }
  }

  /* ── THE CHECK-IN SERVICE ────────────────────────────────────────────────
     A PERMANENT world interactable, registered HERE rather than in moments.js
     (which owns the six-moment registry and is not this pass's file). Two
     things make that safe:
       · it is pushed during buildWorld, so it is in place before
         initMoments snapshots anything, and it carries no `enabled` gate —
         setMoment swaps COLLIDERS, never the interactable list;
       · it is authored ENCLAVE-LOCAL with no `__world` flag, so world.js's
         worldifyLateRecords() maps it through enclaveToWorld exactly once,
         the same road every collider pushed here travels. Flagging it
         `__world` here would leave it 90° around the map — the mirror image
         of the Welcome Brunch's opt-out.                                    */
  G.interactables.push({
    x: DX, z: DZ + 1.05, r: 1.5,
    label: () => 'Check in',
    use: () => G.ui.toast('“Welcome to 隐逸居, Mr & Mrs Fung.” Rooms are LEFT along the '
      + 'upper gallery; the presidential suite is RIGHT, across the walkway. 🔑', 4.6),
  });

  /* ══════════════════════════════════════════════════════════════════════
     I · THE UPPER WALKWAY — the two connections, actually walkable
     LINK crosses the courtyard from the balcony; SLOT is the 2.2 m corridor
     between the suite's east wall and Garden Room D1's west wall (the ONLY
     way through to the atrium's south wall from this side — C1/C2/C3 cover
     its whole east wall and D1/D2 its south wall east of x 10.2, which is
     why SITE.EXT_STAIR moved out of it); HEAD is the landing at the new 2F
     door in the atrium's south perimeter.
     ══════════════════════════════════════════════════════════════════════ */
  const walkDeck = (R, mat) => {
    box(g, R.x1 - R.x0, .3, R.z1 - R.z0, (R.x0 + R.x1) / 2, LY - .17, (R.z0 + R.z1) / 2, mat);
  };
  /* KAN-211 wave D: `walkway_deck` + `walkway_pergola` (flag haveWalk, placed
     with the other arrival GLBs above) draw the decks, the columns, the soffit,
     the rails' shoes + caps and the pergola; the colliders below stay. */
  if (!haveWalk) {
    walkDeck(LK, MAT.blackPolish);
    walkDeck(SL, MAT.blackPolish);
    walkDeck(HD, MAT.blackPolish);
  }
  /* the LINK's columns down to the courtyard, and its planted timber soffit */
  for (let x = LK.x0 + 2.4; x < LK.x1 - 1.0; x += 4.6) {
    for (const cz of [LK.z0 + .35, LK.z1 - .35]) {
      if (!haveWalk) inst('arrColI', UNIT_CYL, MAT.charcoal, mat4(x, (LY - .32) / 2, cz, .32, LY - .32, .32));
      C.push({ x, z: cz, r: .26, y1: CY });
    }
  }
  if (!haveWalk) {
    inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
      mat4((LK.x0 + LK.x1) / 2, LY - .34, (LK.z0 + LK.z1) / 2, LK.x1 - LK.x0, .08, LK.z1 - LK.z0 - .2));
    /* a light pergola roof over the LINK so it reads as the clubhouse's own
       covered corridor rather than as a bare bridge */
    for (let x = LK.x0 + 1.2; x < LK.x1; x += 2.3) {
      inst('arrPergolaI', UNIT_BOX, MAT.corten,
        mat4(x, LY + 2.62, (LK.z0 + LK.z1) / 2, .12, .18, LK.z1 - LK.z0 + .5));
    }
    inst('arrPergolaI', UNIT_BOX, MAT.corten,
      mat4((LK.x0 + LK.x1) / 2, LY + 2.74, LK.z0 + .1, LK.x1 - LK.x0, .16, .14));
    inst('arrPergolaI', UNIT_BOX, MAT.corten,
      mat4((LK.x0 + LK.x1) / 2, LY + 2.74, LK.z1 - .1, LK.x1 - LK.x0, .16, .14));
  }

  /* balustrades. Every one carries y0 so it exists only UP HERE — the
     courtyard underneath has to stay walkable end to end. */
  const bal = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ry = Math.atan2(x2 - x1, z2 - z1);
    inst('arrGlassRailI', UNIT_BOX, MAT.clear,
      mat4((x1 + x2) / 2, LY + .53, (z1 + z2) / 2, .05, 1.02, len, ry));
    if (!haveWalk) {                   // wave D: walkway_deck's shoe + copper cap
      inst('arrRailI', UNIT_BOX, MAT.copper,
        mat4((x1 + x2) / 2, LY + 1.06, (z1 + z2) / 2, .07, .07, len, ry));
    }
    colliderLine(C, x1, z1, x2, z2, .26, ABOVE);
  };
  /* ⚠ THE SOUTH RAIL MUST NOT CROSS THE EXTERIOR STAIR'S 2F LANDING.
     It used to run from `SL.x0` (7.80), straight over the landing (SITE
     x 7.55…9.65, z −8.10…−5.55), with two live consequences: the route
     *pool deck → exterior stair → clubhouse 2F* was SEVERED at its last step
     (a walker pushing north off the landing moved 0.00 m in 2.6 s), and
     anyone standing in the z −7.0 ± 0.61 band was walked EAST along the chain
     and ejected off the landing into a 3.8 m fall. The WEST rail already
     stops short at z −8.1 for exactly this reason; this is the same courtesy
     on the south side, and the landing's extent is DERIVED here with site.js's
     own arithmetic rather than re-typed. */
  const _XS = SITE.EXT_STAIR;
  const _xsRun = _XS.steps * _XS.tread;
  const _xsEast = _XS.x - Math.sign(_XS.x) * _XS.landingBack + _XS.landingW / 2;   // 9.65
  const _xsSouth = (_XS.z + _xsRun / 2) - _xsRun + _XS.tread + .2;                 // −5.55
  bal(SL.x1, SL.z1, LK.x1, SL.z1);       // the south edge, EAST of the landing
  bal(_xsEast, SL.z1, SL.x1, SL.z1);     // and the stub between landing and slot
  /* the landing's own east edge: a COLLIDER only. The stair flight's own
     balustrade at x 10.0 already reads as the guard from every angle, and a
     second glass panel 0.35 m inside it would double up. */
  colliderLine(C, _xsEast, _xsSouth, _xsEast, SL.z1, .26, ABOVE);
  bal(SL.x1, LK.z0, LK.x1, LK.z0);   // the link's north edge, east of the slot
  /* the slot's EAST edge over the stretch where D1's own wall is not there */
  bal(SL.x1, -17.8, SL.x1, LK.z0);
  bal(SL.x1, HD.z0, SL.x1, HD.z1);
  /* the slot's WEST edge where the suite's wall has run out (its envelope
     stops at z −13.5) — but NOT over the exterior stair's landing, which is
     how you get up here from the pool deck */
  bal(SL.x0, -13.5, SL.x0, -8.1);
  /* the head landing: its west return and the short south edge over the 1.2 m
     gap between the atrium's south wall and the suite's north wall. NOTHING
     guards x 7.8 for z −13.5…−10.0 on purpose — that is where the walkway
     meets the exterior stair's landing and the suite's 2F balcony. */
  bal(HD.x0, HD.z0 + .4, HD.x0, HD.z1);
  bal(HD.x0, HD.z1, SL.x0, HD.z1);

  /* ══════════════════════════════════════════════════════════════════════
     J · palm keep-out: phantom colliders at feet-height 80 m
     nature.js's placePalms rejects any throw within (collider.r + 1.4) but
     ignores y-ranges, while the walker skips these entirely (feet never at
     80). Without them the seeded scatter can stand a palm in the middle of
     the court/forecourt/lane. Understory shrubs do NOT consult colliders;
     the cull below handles those.
     ══════════════════════════════════════════════════════════════════════ */
  const noPalm = (x, z, r) => C.push({ x, z, r, y0: 80, y1: 80.01 });
  for (let x = B.x0 - 4; x <= 56; x += 3.6) {
    for (let z = B.z0 - 2; z <= B.z1 + 2; z += 4.4) noPalm(x, z, 3.4);
  }
  for (const [x, z, r] of [
    [49.4, -8, 4.8], [52.8, -8, 4.8], [55.8, -8, 4.8],
    [51, -12.6, 3.4], [51, -3.4, 3.4], [54.6, -12.6, 3.4], [54.6, -3.4, 3.4],
    [58, -13.4, 4.4], [58, -2.6, 4.4], [62.2, -13.4, 4.4], [62.2, -2.6, 4.4],
    [60.1, -8, 4.4], [60.1, -16.0, 4.4],
  ]) noPalm(x, z, r);
  for (let i = 1; i < AR.LANE.length; i++) {
    const a = AR.LANE[i - 1], b = AR.LANE[i];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 4));
    for (let k = 0; k <= n; k++) {
      noPalm(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, 4.4);
    }
  }
  /* ⚠ AND ALONG THE UPPER WALKWAY. A palm's trunk collider is r 0.8 with no
     height range, so a palm standing under the LINK walls the bridge off 3.6 m
     above its own crown — which is exactly what the first walk test hit at
     local x 26.8. placePalms rejects a throw within (r + 1.4), so r 2.2 keeps
     the trunks 3.6 m off the centreline and the canopy still overhangs it. */
  for (const R of [AR.LINK, AR.SLOT, AR.HEAD]) {
    const along = R.x1 - R.x0 > R.z1 - R.z0;
    const n = Math.max(1, Math.ceil((along ? R.x1 - R.x0 : R.z1 - R.z0) / 3));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      noPalm(along ? R.x0 + (R.x1 - R.x0) * t : (R.x0 + R.x1) / 2,
        along ? (R.z0 + R.z1) / 2 : R.z0 + (R.z1 - R.z0) * t, 2.2);
    }
  }

  /* ── understory cull ────────────────────────────────────────────────────
     nature.js's shrub scatter is placed against exclusionZones() ALONE — it
     never consults colliders — and none of this ground is in that list, so
     the seeded field drops clumps straight onto the building, the deck, the
     terrace and the lane. nature.js is not this pass's file; instead the
     same collapse world.js already applies to the enclave's footprints
     (scale-to-zero, translation kept) runs here, once, on the first frame
     after the world is up. Palms are DynamicDrawUsage and are skipped. */
  let culled = false;
  const _cm = new THREE.Matrix4(), _cv = new THREE.Vector3(), _cz2 = new THREE.Vector3();
  const inArrival = (wx, wz) => {
    const l = worldToEnclave(wx, wz);
    if (l.x > DK.x0 - 1.2 && l.x < 64.9 && l.z > B.z0 - 1.2 && l.z < B.z1 + 1.2) return true;
    if (l.x > 44.0 && l.x < 64.9 && l.z > -18.3 && l.z < 2.3) return true;
    for (const R of [AR.LINK, AR.SLOT, AR.HEAD]) {
      if (l.x > R.x0 - 1.4 && l.x < R.x1 + 1.4 && l.z > R.z0 - 1.4 && l.z < R.z1 + 1.4) return true;
    }
    for (let i = 1; i < AR.LANE.length; i++) {
      const a = AR.LANE[i - 1], b = AR.LANE[i];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
      let t = ((l.x - a[0]) * dx + (l.z - a[1]) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + dx * t - l.x, pz = a[1] + dz * t - l.z;
      if (px * px + pz * pz < (AR.laneHalfW + 2.0) ** 2) return true;
    }
    return false;
  };
  (G.tickers ||= []).push(() => {
    if (culled) return;
    const nat = G.groups && G.groups.nature;
    if (!nat) return;
    culled = true;
    for (const child of nat.children) {
      if (!child.isInstancedMesh) continue;
      if (child.instanceMatrix.usage === THREE.DynamicDrawUsage) continue;
      let touched = 0;
      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, _cm);
        _cv.setFromMatrixPosition(_cm);
        if (!inArrival(_cv.x, _cv.z)) continue;
        _cm.scale(_cz2);
        child.setMatrixAt(i, _cm);
        touched++;
      }
      if (touched) child.instanceMatrix.needsUpdate = true;
    }
  });
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
  /* nudge the 2F landing back TOWARD the facade — a bare `+ .4` pushed it away
     once EXT_STAIR.x went positive in the suite mirror */
  box(g, 2.1, .24, 2.0, E.x - Math.sign(E.x) * .4, 3.68, z0 - run - .9, MAT.stone);
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
   8 · the main Westin crescent, ~285 m east — the skyline of the whole venue.
   Arc centre sits r metres WEST of SITE.HOTEL.cx so the CONCAVE face looks back
   at the campus. That face is the one that matters and it is now modelled from
   photographs rather than inferred from an aerial — reference/hotel-facade-brief.md
   is the written record; read it before changing a number here.

   What the elevations gave this pass, and what it costs:
     · the balcony rhythm moved into texHotelFacade() — white slab bands, teal
       glazing, and the building's signature white TRIANGULAR balustrades. Free:
       one canvas, same draw call.
     · seven white parapet rings at the balcony slabs' outer edge — the only
       part of the rhythm that is real geometry, so the arc still reads as
       balconies when the sun rakes it. +7 calls.
     · three bronze circulation cores breaking the arc into segments. +3.
     · the roofline the dawn frames show: a stepped-back attic band and a run of
       white plant boxes. +1 (instanced) +1.
     · the taller sky-bar block at the north tip, with its raking blade. +4.
     · the arrival face got its own map (the white perforated screen) and the
       porte-cochère moved to the side of the building it is actually on.
   ⚠ The facade's 6 m batter (rIn → rIn + 6 = 90) is NOT cosmetic: 90 is
   SITE.HOTEL.ROOFTOP.rIn, i.e. the terrace's inner edge lands exactly on the
   top of this lean. Change the batter and the walkable rooftop shears off.
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

  const WX = (th, r) => acx + Math.sin(th) * r;   // arc-local → WORLD, for inst()
  const WZ = (th, r) => acz + Math.cos(th) * r;

  /* concave (campus-facing) wall — leans back 6 m as it rises, landing on
     ROOFTOP.rIn (90). The teal glazing, the white slab bands and the triangular
     balustrades all live in this one map. */
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn + 6, rIn, HT, 96, 1, true, th0, tl),
    MAT.hotelFacade);
  inner.position.y = HT / 2;
  g.add(inner);

  /* the arrival face: the white perforated screen */
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(rOut, rOut, HT, 96, 1, true, th0, tl), MAT.hotelBack);
  outer.position.y = HT / 2; g.add(outer);

  const cap = new THREE.Mesh(new THREE.RingGeometry(rIn + 6, rOut, 96, 1, ph0, tl), MAT.greenRoof);
  cap.rotation.x = -Math.PI / 2; cap.position.y = HT + .05; g.add(cap);
  const capLip = new THREE.Mesh(
    new THREE.CylinderGeometry(rOut + .3, rOut + .3, 1.2, 96, 1, true, th0, tl), MAT.white);
  capLip.position.y = HT - .3; g.add(capLip);

  /* ── the balcony slabs and their parapets ─────────────────────────────────
     One slab per storey, projecting 1.5 m in over the storey below (a real
     balcony depth), with a 1.05 m white parapet standing on its outer edge.
     In every reference frame the parapet is the LIT edge — it catches the sun
     while the reveal behind it stays in shadow — so it is what draws the seven
     horizontals across the arc. Two meshes per floor, both 96-segment sectors:
     ~380 triangles each, and the pair is worth more than any texture trick. */
  for (let f = 1; f < H.floors; f++) {
    const r = rIn + 6 * (f / H.floors);
    const slabEdge = new THREE.Mesh(new THREE.RingGeometry(r - 1.5, r + .18, 96, 1, ph0, tl), MAT.white);
    slabEdge.rotation.x = -Math.PI / 2;
    slabEdge.position.y = f * H.floorH;
    g.add(slabEdge);
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(r - 1.5, r - 1.5, 1.05, 96, 1, true, th0, tl), MAT.hotelRail);
    rail.position.y = f * H.floorH + .525;
    g.add(rail);
  }

  /* ── the three bronze circulation cores ───────────────────────────────────
     Full height, slightly proud of the lean on both faces, at the segment
     joints the photographs show. Without them 142 m of identical balcony reads
     as one endless band; with them the crescent has the three-part composition
     it actually has.
     ⚠ They must stand PROUD OF THE BALCONY LINE, not of the facade. The
     parapets are 1.5 m in front of the wall, so a core that projects the 0.4 m
     a real one does is hidden behind them and shows only as orange flecks in
     the gaps between floors — which is what the first attempt rendered. These
     run 2.4 m in front of the wall at grade, i.e. ~0.9 m clear of the rails. */
  for (const d of [-.42, 0, .46]) {
    const th = Math.PI / 2 + d, dth = .040;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(rIn + 4.3, rIn - 1.7, HT + .9, 8, 1, true, th - dth / 2, dth),
      MAT.hotelCore);
    core.position.y = (HT + .9) / 2;
    g.add(core);
  }

  /* ── the roofline ─────────────────────────────────────────────────────────
     reference/video/hotel-frames/trim1_002 + dawn_001: the crescent does NOT
     end in a clean parapet. It ends in a stepped-back attic band and a run of
     white plant/lift boxes standing proud of it, and that broken skyline is
     most of what the building reads as in silhouette at dusk.

     ⚠ 2026-08-02 — THE ROOFLINE ONLY EXISTS WHERE THE TERRACE DOES NOT.
     Both of these were authored against a BARE green roof cap, and both were
     left standing when the walkable brunch terrace was built over the same
     band a pass later. Nothing threw; the terrace simply grew up around them:
       · the attic band (r 91.4, y 25.2…27.8) came out of the rooftop POOL
         1.28 m proud of the water and ran the whole length of it — a white
         wall straight across the infinity edge, which is the one view this
         venue exists for. It is in the deck-level screenshot as the band
         between the water and the sea.
       · the eleven plant boxes sat at r 93 / 95.4 / 97.8 — i.e. across the
         water (90.10…96.40), the coping and the teak — up to 5.1 m tall, so
         they stood IN the pool and among the daybeds. That is exactly what
         Carl photographed in bug-rooftop-white-boxes.png: "a lot of random
         white boxes here".
     Over the terrace the job is already done, and better: the 1.4 m terrace
     plinth IS the stepped-back band, and the 5.1 m lattice screen, the two
     head-houses, the bar volume and the daybed canopies ARE the broken
     skyline. So both are clamped to the two bare end sectors of the cap, past
     the terrace's own sweep and DERIVED from ROOFTOP.arcHalf so they cannot
     drift back under it however the arc changes.
     The NORTH sector gets none of the boxes: the sky-bar block already stands
     there (θ = C + arc/2, 17 m of it), which is the same silhouette job. So
     the crescent ends in a stepped mass at BOTH tips, which is what the dawn
     frames show.

     ⚠ 2026-08-03 — NOTHING TALL STANDS SEAWARD OF r ≈ 98.5 ON THESE SECTORS.
     Carl, over the infinity pool: "this infinity pool view is being blocked by
     these umbrella and extra building blocks — guests should be able to enjoy
     an unobstructed view while swimming at the edge of the infinity pool."
     The first clamp put the attic band at r 91.4 and the plant boxes at
     93/97.9, up to 5.1 m tall — angularly clear of the terrace, but a swimmer
     looking ALONG the arc past the glazed south end stared straight at them
     where the sea horizon should be (the end sector starts 2 m past the
     glass). The silhouette job survives — same sectors, same stepped masses —
     pushed INLAND onto the cap's back band (r ≥ ~99, the band the head-houses
     and screen wall already occupy on the terrace itself) and cut down, so the
     along-arc frame from water level past the glazed end is sky and sea. */
  const RA = SITE.HOTEL.ROOFTOP.arcHalf;
  const CAP_ENDS = [[th0 + .05, Math.PI / 2 - RA - .02],
    [Math.PI / 2 + RA + .02, th0 + tl - .05]];
  for (const [s, e] of CAP_ENDS) {
    if (e - s < .015) continue;
    const attic = new THREE.Mesh(
      new THREE.CylinderGeometry(rIn + 15.0, rIn + 15.0, 2.2, 12, 1, true, s, e - s),
      MAT.hotelEnd);
    attic.position.y = HT + 1.1; g.add(attic);
  }
  {
    /* the south sector, inboard of the 2 m end wall and outboard of the
       terrace's glazed end: two radial ranks, two boxes each — on the back
       band (98.9…105.1 across both ranks, inside the cap rail at 105.4) */
    const [s0, s1] = CAP_ENDS[0];
    const lo = s0 + .022, hi = s1 - .012;
    for (let i = 0; i < 4; i++) {
      const th = lo + (hi - lo) * (.22 + .56 * ((i >> 1) & 1));
      const r = rIn + 16.6 + (i & 1) * 2.8, hgt = 1.8 + (i % 4) * .5;
      inst('hotelBoxI', UNIT_BOX, MAT.hotelEnd,
        mat4(WX(th, r), HT + hgt / 2, WZ(th, r), 3.4 + (i % 3), hgt, 3.4, th));
    }
  }

  /* podium (in front, campus side) + the two end walls that close the sector.
     The podium is the resort's lobby/restaurant storey and in every reference
     frame it is mostly GLASS under a deep shadow — 142 m of blank pale stone,
     which is what it was, is the one thing on this building you never see. */
  const pod = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn - 4, rIn - 4, 6.4, 96, 1, true, th0, tl), MAT.hotelPodium);
  pod.position.y = 3.2; g.add(pod);
  const podGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(rIn - 4.25, rIn - 4.25, 3.9, 96, 1, true, th0 + .02, tl - .04),
    MAT.hotelPodGlass);
  podGlass.position.y = 3.0; g.add(podGlass);
  const podCap = new THREE.Mesh(new THREE.RingGeometry(rIn - 4, rOut + 4, 96, 1, ph0, tl), MAT.paver);
  podCap.rotation.x = -Math.PI / 2; podCap.position.y = 6.45; g.add(podCap);

  for (const s of [-1, 1]) {
    const th = Math.PI / 2 + s * tl / 2;
    const end = box(g, DEP, HT, 2.0, dirX(th) * H.r, HT / 2, dirZ(th) * H.r, MAT.hotelEnd);
    end.rotation.y = th - Math.PI / 2;
  }

  /* ── the sky-bar block at the north tip ───────────────────────────────────
     Every wide frame of this building (trim1_002, dawn_001, dawn_017) has the
     same silhouette: a long low arc that rises at ONE end into a taller block
     carrying the rooftop bar. Three boxes and a parapet — kept RESTRAINED on
     purpose. The first attempt gave it 12.6 m and a raking blade and at 285 m
     it read as a monolith parked beside the hotel; the building's whole
     character is the long horizontal, and the tip should lift it, not fight it.
     It sits at θ = C + .75, outside the walkable terrace's ±.62 sweep, so it
     adds nothing to the height field and needs no collider — the terrace's own
     glazed end already closes the deck 0.13 rad short of it. */
  {
    const th = Math.PI / 2 + tl / 2, TH = HT + 5.4;
    const bx = dirX(th) * H.r, bz = dirZ(th) * H.r, ry = th - Math.PI / 2;
    box(g, DEP, TH, 17.0, bx, TH / 2, bz, MAT.hotelEnd, ry);
    /* the band of sea-facing glazing across its upper floors, inset so it reads
       as a glazed core rather than a grey panel stuck on the end */
    box(g, .4, 15.4, 14.0, bx - Math.sin(th) * (DEP / 2 - .35), 4.2 + 15.4 / 2,
      bz - Math.cos(th) * (DEP / 2 - .35), MAT.glass, ry);
    /* the bar pavilion on its cap, set back off the parapet */
    box(g, 12.4, 3.0, 8.6, bx, TH + 1.5, bz, MAT.hotelEnd, ry);
  }

  /* ── the porte-cochère ────────────────────────────────────────────────────
     MOVED to the arrival (convex, east) face, which is where the reference
     photograph puts it — it was on the concave face, where it read from the
     campus as a blue ribbon floating in front of the guest rooms with nothing
     behind it. Three undulating steel ribs sweeping down off the screen wall
     to a row of posts, per reference/photos/hotel-westin-hotel-front.webp. */
  for (let k = 0; k < 3; k++) {
    const wave = [], rc = rOut + 7 + k * 3.6;
    for (let i = 0; i <= 22; i++) {
      const th = Math.PI / 2 - .22 + (i / 22) * .44;
      wave.push({
        x: dirX(th) * rc,
        y: 11.4 - k * 1.9 + Math.sin(i / 22 * Math.PI * 3 + k * .7) * 1.5,
        z: dirZ(th) * rc,
      });
    }
    g.add(new THREE.Mesh(ribbon(wave, 1.9, 10), MAT.waveCanopy));
    if (k === 2) for (let i = 2; i < 22; i += 5) {
      box(g, .45, wave[i].y, .45, wave[i].x, wave[i].y / 2, wave[i].z, MAT.white);
    }
  }

  /* ── the wave-roofed conference / spa building ─────────────────────────────
     It stood at (H.cx − 30, H.cz + 78) = a 46 × 26 m block just off the
     crescent's southern end, which was fine while the arc swept 1.5 rad and
     stopped at θ 47°. At 2.35 rad the arc reaches θ 22.7° and its southern tip
     lands at (192.6, 97.7) with the building mass running out to r 106 — the
     old position is INSIDE that. Carl's steer for this pass was explicit —
     *"I care less about any other random building blocks right now"* — so
     rather than spend the composition on finding it a new home it moved down
     the arc to the crescent's own south-west apron, at r 118 on the tip's
     bearing: still reading as the resort's low back-of-house wing in a fly-by,
     comfortably outside the podium (r 80) and the collider ring (r ≤ 109), and
     out of the frame the top-down composes. */
  {
    const cth = Math.PI / 2 - tl / 2 - .10;
    const conf = new THREE.Group();
    conf.position.set(acx + Math.sin(cth) * 118, 0, acz + Math.cos(cth) * 118);
    conf.rotation.y = cth;
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
  }

  /* the rooftop brunch terrace — the one part of the crescent people stand in */
  buildHotelRoof(G, g, acx, acz);

  /* ── coarse collider ring so a walker can't stroll into the crescent ───────
     Circles of r 14 on the arc: together they wall off r ∈ [81, 109] across the
     whole sweep. That is the right answer at grade and was the WRONG answer
     everywhere else — being y-agnostic it also walled off the rooftop terrace
     26.6 m above it, which is why the roof could never be stood on.
     `y1` is the fix: the ring stops existing for a walker whose feet are at or
     above the green roof cap, which is the only place there is anything to
     stand on up there. See the collider contract in player.js.
     H.floors * H.floorH is the cap (25.2); the terrace deck is 1.4 m over it.
     ⚠ The COUNT is derived (2026-08-02). It was a hard 27, which spaced the
     circles 5.5 m apart over a 142 m arc; the proportion pass grew the face to
     223 m and 27 circles would have sat 8.6 m apart. They would still have
     overlapped — 14 m circles at 8.6 m always do — but the chain's *effective*
     inner radius rises as the spacing grows, and the point of a derived count
     is that the next change to `arc` cannot quietly thin it out. */
  const RING_TOP = H.ROOFTOP.roofY;
  const RING_N = Math.max(26, Math.round(H.r * tl / 5.5));
  for (let i = 0; i <= RING_N; i++) {
    const th = Math.PI / 2 - tl / 2 + (i / RING_N) * tl;
    G.colliders.push({ x: acx + dirX(th) * H.r, z: acz + dirZ(th) * H.r, r: 14, y1: RING_TOP });
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   8b · THE ROOFTOP INFINITY POOL — SITE.HOTEL.ROOFTOP
   Carl & Rachel host the wedding party up here on 2027-03-18, two days before
   the wedding, so unlike the rest of the crescent this has to survive being
   looked at from three metres as well as from 285.

   Two coordinate frames are in play and mixing them silently shears the whole
   terrace off the building:
     · ring / cylinder meshes go into `g`, whose origin is the ARC CENTRE
       (SITE.HOTEL.cx − r, SITE.HOTEL.cz) = (190, 10). Local, polar-ish.
     · anything through inst() goes into a bucket that flushBuckets() parents
       to `root` — no transform — so those need WORLD coordinates. WX()/WZ().

   ⚠ REBUILT 2026-08-02 — THE WATER RUNS TO THE EDGE OF THE BUILDING.
   Carl: "the hotel top pool should be an infinity pool to the edge of the
   building, we have some tables toward the edge of the building now." The
   section used to be balustrade → catch trough → infinity edge → water →
   deck, so the FIRST 0.9 m off the parapet was hardware and the water started
   behind it. It is inverted now, off
   reference/photos/hotel-rooftop-pool-day-night.png: the lip is on the facade
   line, the trough is cantilevered BELOW it where you cannot see it, and the
   inner balustrade survives only past the ends of the water — a rail across
   the pool's own angular span would be standing in it.

   Radial section, west (the sea) → east:
     89.42  catch trough, hung off the facade 0.78 m under the water line
     89.90  the white lip — 0.20 m of coping and then nothing
     90.00  rIn: the terrace's inner edge / top of the leaning facade
     90.10  THE INFINITY EDGE
     96.40  pool back wall, marble coping
     97.20  teak deck — loungers at 98.2, four-poster daybeds at 100.9
    102.30  back paving: planters
    102.90  THE PERFORATED LATTICE SCREEN WALL, 5.6 m of pointed blades
    103.20  a 1.35 m step down onto the existing green roof cap, which runs to 106
   ⚠ SINCE 2026-08-03 THAT SECTION IS THE POOL ROOM'S — the terrace is TWO
   rooms (site.js "THE ROOFTOP IS TWO ROOMS"): the infinity pool keeps the
   SOUTH half (poolTc ± poolTh), the ROOFTOP BAR takes the NORTH half
   (barTc ± barTh) — dark boards, the caustic-clad bar volume, rattan dining,
   a planted canopy, a live-band stage — and a 9 m paved cross-walk divides
   them on the crescent's centre bearing. The eight brunch four-tops are
   HOTEL_ROOF.brunchTables, all inside the pool half; moments.js dresses the
   same list.
   ════════════════════════════════════════════════════════════════════════ */
/* The lounger row, in ONE place — buildHotelRoof() stands them up and
   roofColliders() rings them, and both used to carry the same literal `16` and
   the same literal `±0.335`.

   When the terrace only spanned ±0.62 the loungers were the middle of it and
   the eight brunch four-tops stood in among them — the Welcome Brunch spawn
   was literally being nudged 0.19 m by a lounger's collider. `pitch` is a
   metre figure at the lounger radius, so the count follows the run. */
/* ⚠ 2026-08-03, the two-rooms split: loungers belong to the POOL room only —
   a dining terrace with sun loungers through the middle of it is two hotels —
   so the run is now ONE stretch, on the pool half's outer reach (south). Its
   INNER limit is DERIVED from the outermost entry of HOTEL_ROOF.brunchTables
   (site.js promises exactly this beside the list): outermost four-top, plus
   its chair ring, plus a lounger half, plus walking room. */
const LOUNGE_CLEAR_M = 5.3;       // past the outermost four-top's chairs, metres

/* The collider radius of a chair-ringed rooftop table — the bar room's round
   and square tops and the eight brunch four-tops, which carry the same 1.02 m
   chairs. It is ALSO the figure moments.js rings the brunch tables with, and
   the two must stay equal: see the note beside the brunch ring in
   roofColliders(). 0.95 was measured on 2026-08-04 (1.35 fenced the brunch
   room off against the coping); it leaves 0.56 m between two settings on the
   3.20 m pitch and still clears the 0.68 m cloth by 0.27 m. */
const TABLE_R = .95;
function loungerRow(R) {
  const C = Math.PI / 2, pitch = 4.39 / R.loungeR;
  const maxOff = Math.max(...HOTEL_ROOF.brunchTables.map(t => Math.abs(t.th - C)));
  const inner = maxOff + LOUNGE_CLEAR_M / R.loungeR;
  const outer = R.arcHalf - 0.06;
  const th = [];
  for (let a = inner; a <= outer + 1e-9; a += pitch) {
    if (Math.abs(a - R.coreArcHalf) < 0.050) continue;        // the head-house
    th.push(C - a);               // the pool room is the SOUTH half: θ < C
  }
  return { th, pitch };
}

/* The daybed row, same contract as loungerRow — ONE list that buildHotelRoof()
   stands beds on and roofColliders() rings, so a bed and its collider can
   never disagree. Pool half only (the bar half's inland elevation is the bar
   volume, not cabanas), dodging the south head-house. */
/* ⚠ 2026-08-04, the SHORT pool: the beds run SOUTH of the water now, not along
   it. Two reasons and both are evidence:
     · reference/photos/rooftop-pool-bar-daylight.webp puts the screen wall and
       the cabanas to the LEFT of the pool — which is SOUTH, because θ > C is
       north and standing on the terrace facing the sea puts north on your
       right. The photograph is the plan.
     · the pool room's inland teak is 5.1 m deep and now holds the eight brunch
       four-tops at r 99.0. A daybed is 2.8 m deep at r 100.9; the two rows used
       to interpenetrate (they did on the old long pool too, unnoticed, because
       the tables and the beds shared the same 90 m half).
   The run therefore ends 2.2 m short of the water and carries on south for the
   ~69 m of deck the short pool released — which is exactly what the photograph
   shows past the frame's left edge. */
function daybedRow(R) {
  const C = Math.PI / 2, out = [];
  const hi = R.poolTc - R.poolTh - .022;      // 2.2 m clear of the pool's south end
  for (let th = C - R.arcHalf + .030; th <= hi + 1e-9; th += .0486) {
    if (Math.abs(Math.abs(th - C) - R.coreArcHalf) < .045) continue;
    out.push(th);
  }
  return out;
}

/* ══ THE BAR ZONE + THE DINING TERRACE, in ONE place ════════════════════════
   buildHotelRoof() builds it and roofColliders() rings it from the SAME
   object — the lockstep rule that already governs loungerRow/daybedRow.
   Everything here is derived from the rooms' own bounds (barTc ± barTh,
   dineTc ± dineTh), the bridge bearing and the head-house bearing; no typed
   fraction of the arc, and every LENGTH is quoted in metres at its own radius.

   ⚠ REPLANNED 2026-08-04 for Carl's two corrections — *"the bar is very close
   by the pool"* and *"the pool is definitely a lot shorter"*. The old bar was
   half a 202 m terrace with the counter floating 45 m from the water; it is a
   20 m room now, a 6 m walk from the pool's coping, and everything north of it
   is a separate DINING TERRACE.

   THE BAR, off reference/photos/rooftop-pool-bar-daylight.webp (right of
   frame): a long counter with a dark stone top and a vertical fluted timber
   front, stools with white cushions along the pool side, a back-bar of bottles
   and ice wells behind it, and a cantilevered planted canopy with trailing
   greenery on a white column above. The caustic-clad volume that used to sprawl
   is kept as the room's BACKDROP — Carl-approved, and it is what makes the roof
   read at night — but it now stands behind the counter and stops there.
     · counter — 10.0 m, its south end BAR_SET metres into the room, so the walk
                 from the pool's near coping to the first stool is ~9 m.
     · backbar — the working line, 1.25 m behind the counter.
     · canopy  — the planted cantilever on ONE white column, past the counter.
     · segs    — the caustic volume, on the back band behind the counter only.
     · lounge  — the photograph's foreground: timber-framed chairs with white
                 cushions round low side tables, on the deck seaward of the bar.

   THE DINING TERRACE, off reference/photos/rooftop-bar-live-band.webp:
     · longTables — LONG COMMUNAL TABLES, the signature of that photograph.
                 They run ALONG the arc, which points their length at the stage.
     · tables  — the round/square four-tops built 2026-08-03, filling the reach
                 south of each long table.
     · stage   — the live-band alcove at the terrace's north end, facing SOUTH
                 down the run of tables.
     · beds    — freestanding planting beds along both rooms' inner edge.
   Two things stand inside the dining terrace and both are DODGED, never built
   around: the north head-house, and the stair bridge's landing — that gap is
   the only way in from the tower and a table in it walls the roof off.       */
/* the back-bar's bottle colours — spirits, wine, a couple of clear ones.
   ⚠ hex, never Color.setHSL: setHSL fills in LINEAR space and every one of
   these would come out two stops light (the arrival's corten, 2026-08-03). */
const BOTTLE_TINT = [0x2f5a2c, 0x7a4a12, 0xd9c08a, 0x5a2b2b, 0xdfe7e2,
  0x8a5a20, 0x2b3f5a, 0xe8e2d4].map(h => new THREE.Color(h));
const BAR_COUNTER_R = 98.70, BAR_COUNTER_LEN = 10.0, BAR_COUNTER_SET = 2.6;
const DINE_LONG_LEN = 11.0, DINE_LONG_R = [94.4, 98.4];
/* ⚠ THE STAGE'S RADIUS IS A SIGHTLINE, not a taste call. At r 100.0 (its first
   placement) the alcove spanned 97.0…103.0 and the NORTH HEAD-HOUSE — 5.2 m
   wide at r 101.2, occupying 98.9…103.5 — stood between it and the dining
   terrace, so from the long tables you watched a band behind a lift lobby.
   At 97.6 the alcove is 94.6…100.6, dead ahead of both table rows (94.4 / 98.4)
   and past the head-house on the seaward side. */
const STAGE_R = 97.6, STAGE_W = 8.0, STAGE_D = 6.0;
function barLayout(R) {
  const C = Math.PI / 2, T = HOTEL_ROOF.tower;
  const b0 = R.barTc - R.barTh, b1 = R.barTc + R.barTh;        // the 20 m bar zone
  const d0 = R.dineTc - R.dineTh, d1 = R.dineTc + R.dineTh;    // the dining terrace
  const coreN = C + R.coreArcHalf;                             // north head-house

  const CR = BAR_COUNTER_R, CLEN = BAR_COUNTER_LEN;
  const counter = { r: CR, len: CLEN, halfTh: CLEN / 2 / CR,
    tc: b0 + (BAR_COUNTER_SET + CLEN / 2) / CR };
  /* the radial section through the bar, sea → inland, and every gap in it is
     load-bearing: stools 97.80 · counter 98.70 (0.84 deep) · a 0.88 m working
     aisle · back-bar 100.30 (0.60) with its lit shelves at 100.54 · the caustic
     volume's inner panel plane 100.90 · its body 101.95 (2.0 deep) · rOut
     103.20. Move one and check the next two. */
  const backbar = { r: 100.30, tc: counter.tc, halfTh: (CLEN / 2 - .5) / CR };
  const canopy = { r: 99.9, th: b1 - 3.4 / 99.9, halfTh: 3.2 / 99.9 };
  /* ONE run: the volume is the bar's back wall, not a colonnade down the roof.
     It stops clear of the canopy so the two cannot interpenetrate. */
  const segs = [[b0 + .012, canopy.th - canopy.halfTh - .010]];
  const lounge = [];
  for (let th = b0 + 3.0 / 94.5; th <= b1 - 3.0 / 94.5 + 1e-9; th += 6.4 / 94.5) {
    lounge.push({ th, r: 94.5 });
  }

  const stage = { r: STAGE_R, w: STAGE_W, d: STAGE_D,
    halfTang: STAGE_W / 2 / STAGE_R, th: d1 - (STAGE_W / 2 + 1.3) / STAGE_R };
  const bridge = [T.th - T.bridgeTh - 2.2 / 96.6, T.th + T.bridgeTh + 2.2 / 96.6];
  const core = [coreN - 4.2 / 101.2, coreN + 4.2 / 101.2];
  const freeSegs = [[d0 + 1.8 / 96.6, bridge[0]], [bridge[1], core[0]]];

  const longTables = [], tables = [];
  for (const [s, e] of freeSegs) {
    for (const rr of DINE_LONG_R) {
      const half = DINE_LONG_LEN / 2 / rr, tc = e - 1.6 / rr - half;
      if (tc - half <= s) continue;                            // no room: skip it
      longTables.push({ th: tc, r: rr, halfTh: half, len: DINE_LONG_LEN });
      const re = tc - half - 2.6 / rr, pitch = 5.0 / rr;
      for (let th = s + pitch / 2; th <= re + 1e-9; th += pitch) {
        tables.push({ th, r: rr, round: tables.length % 2 === 0 });
      }
    }
  }
  const beds = [];
  for (let th = b0 + .075; th <= b1 - .075 + 1e-9; th += .075) beds.push({ th, r: 91.9 });
  for (let th = d0 + .075; th <= d1 - .075 + 1e-9; th += .085) beds.push({ th, r: 91.9 });
  return { b0, b1, d0, d1, segs, counter, backbar, canopy, lounge,
    stage, longTables, tables, beds, bridge };
}

function buildHotelRoof(G, g, acx, acz) {
  const R = SITE.HOTEL.ROOFTOP;
  const C = Math.PI / 2;                                 // crescent centre bearing
  const a0 = C - R.arcHalf, a1 = C + R.arcHalf;          // terrace sweep
  /* ⚠ THE ROOF IS TWO ROOMS (site.js: "THE ROOFTOP IS TWO ROOMS"). p0/p1 keep
     their old meaning — the WATER's sweep — but the water is the SOUTH room
     now, (poolTc ± poolTh), not the whole dressed band. The bar room is the
     NORTH half, and the 9 m cross-walk (C ± divideHalf) is the paved seam
     between them. The height field is already cut this way in site.js; these
     visuals and roofColliders() must follow it, never the other way round. */
  const p0 = R.poolTc - R.poolTh, p1 = R.poolTc + R.poolTh;  // the pool room, 28 m
  const b0 = R.barTc - R.barTh, b1 = R.barTc + R.barTh;      // the bar zone, 20 m
  const d0 = R.dineTc - R.dineTh, d1 = R.dineTc + R.dineTh;  // the dining terrace
  const DY = R.deckY, WY = R.waterY, BY = R.basinY, RY = R.roofY;
  const PL = DY - RY;                                    // plinth, 1.4 m
  const LEDGE = 90.35;                                   // marble ledge, past the water
  const LIP = R.poolIn - R.lipW;                         // 89.90 — the white hairline
  const TROUGH_Y = WY - R.troughDrop;                    // 25.74
  const rc = (R.rIn + R.rOut) / 2;

  const WX = (th, r) => acx + Math.sin(th) * r;
  const WZ = (th, r) => acz + Math.cos(th) * r;
  /* a flat radial band r0→r1 sweeping s→e. Bands are laid EDGE TO EDGE, never
     stacked: at 285 m the depth buffer (near .08 / far 3000) resolves about
     6 cm, so a coplanar overlay would z-fight from the enclave. */
  const band = (r0, r1, s, e, y, mat, vs = 1) => {
    const m = new THREE.Mesh(arcBand((r0 + r1) / 2, (r1 - r0) / 2, s, e, y, 128, vs), mat);
    g.add(m); return m;
  };
  /* an open cylinder sector — y is its CENTRE */
  const shell = (r, h, y, mat, s = a0, e = a1, seg = 128) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg, 1, true, s, e - s), mat);
    m.position.y = y; g.add(m); return m;
  };

  /* ── the plinth the terrace stands on ── */
  shell(R.rOut, PL, RY + PL / 2, MAT.rtPlinth);
  shell(R.rIn, PL, RY + PL / 2, MAT.rtPlinthIn);
  for (const th of [a0, a1]) {                            // close the two ends
    inst('stoneI', UNIT_BOX, MAT.stone,
      mat4(WX(th, rc), RY + PL / 2, WZ(th, rc), .34, PL, R.rOut - R.rIn, th));
  }

  /* ── the deck, as edge-to-edge bands — never stacked, and now SIX floors:
        · a0…p0        the SOUTH DECK: the daylight photograph's left-hand side
                       — timber, the screen wall, the cabana daybeds, loungers.
                       ~69 m of it, released by the short pool.
        · p0…p1        the POOL room, 28 m: nothing between rIn and the water
                       but the lip; coping → teak → back paving inland of it
        · p1…b0        the paved WALK, 6 m, pool ↔ bar
        · b0…b1        the BAR zone, 20 m: dark timber boards (refs)
        · b1…d0        the planted break, 4 m
        · d0…d1        the DINING TERRACE: dark boards, long communal tables,
                       the live-band stage at its north end
        · d1…a1        the north closing apron                              ── */
  for (const [s, e] of [[a0, p0], [p1, a1]]) {
    band(R.rIn, LEDGE, s, e, DY, MAT.rtCoping, 1.6);           // balustrade ledge
  }
  band(LEDGE, R.poolOut, a0, p0, DY, MAT.rtPave, 1);           // the south deck's inner strip
  band(R.poolOut, 97.2, a0, p1, DY, MAT.rtCoping, 1.6);        // pool coping
  band(97.2, R.teakOut, a0, p1, DY, MAT.rtTeak, 6);            // the timber deck
  band(R.teakOut, R.rOut, a0, p1, DY, MAT.rtPave, 1);          // back paving
  band(LEDGE, R.rOut, p1, b0, DY, MAT.rtPave, 1);              // THE WALK
  band(LEDGE, R.rOut, b0, b1, DY, MAT.rtDarkTeak, 6);          // THE BAR's boards
  band(LEDGE, R.rOut, b1, d0, DY, MAT.rtPave, 1);              // the planted break
  band(LEDGE, R.rOut, d0, d1, DY, MAT.rtDarkTeak, 6);          // THE DINING TERRACE
  band(LEDGE, R.rOut, d1, a1, DY, MAT.rtPave, 1);              // north closing apron

  /* ── the white lip, and the catch trough hung UNDER it off the facade.
        Nothing between the water and the sea but 0.20 m of marble — which is
        the whole point of the photograph — so the trough that any real infinity
        edge needs goes below the eye line, cantilevered past rIn where the
        terrace deck can never see it. ── */
  band(LIP, R.poolIn, p0, p1, WY - .02, MAT.rtCoping, 1.6);    // THE white hairline
  band(R.troughR, LIP, p0, p1, TROUGH_Y, MAT.blackstone, 2);   // trough floor
  shell(R.troughR, .62, TROUGH_Y + .31, MAT.blackstone, p0, p1);
  shell(LIP - .02, WY - TROUGH_Y, (WY + TROUGH_Y) / 2, MAT.rtSpill, p0, p1);

  /* ── the pool: floor, back wall, the infinity lip, two end walls ── */
  band(R.poolIn, R.poolOut, p0, p1, BY, MAT.rtBasin, 3);       // basin floor
  shell(R.poolOut, DY - BY, (BY + DY) / 2, MAT.rtBasin, p0, p1);
  shell(R.poolIn, WY - BY, (BY + WY) / 2, MAT.rtBasin, p0, p1);   // THE lip
  const pmid = (R.poolIn + R.poolOut) / 2, pw = R.poolOut - R.poolIn;
  for (const th of [p0, p1]) {
    inst('rtTileI', UNIT_BOX, MAT.rtBasin,
      mat4(WX(th, pmid), (BY + DY) / 2, WZ(th, pmid), .3, DY - BY, pw, th));
  }
  /* water, and the star-points scattered across the floor under it. The stars
     ride 20 mm over the basin on an alpha-tested sheet and are NIGHT-ONLY —
     `nightOnly()` hides the whole mesh by day, because a fleck that is nearly
     invisible under a metre of water still reads as dirt in a noon screenshot,
     and this is the Welcome Brunch's room. At night they are the second half of
     the reference photograph: the floor speckled with pin-lights. */
  nightOnly(band(R.poolIn, R.poolOut, p0, p1, BY + .02, MAT.rtStars, 4));
  band(R.poolIn, R.poolOut, p0, p1, WY, MAT.rtWater, 5);

  /* three submerged steps at each end of the pool — EXACTLY where site.js
     registers them: poolTc ± (poolTh − 0.022), never the old full-band arc */
  for (const s of [-1, 1]) {
    const th = R.poolTc + s * (R.poolTh - .022);
    for (let k = 0; k < 3; k++) {
      const r = R.poolOut - .55 - k * .55;
      inst('rtTileI', UNIT_BOX, MAT.rtBasin,
        mat4(WX(th, r), BY + (3 - k) * .40 / 2, WZ(th, r), 2.6, (3 - k) * .40, .55, th));
    }
  }

  /* ── balustrades: frameless glass, copper top rail.
        ⚠ The inner run is BROKEN over the pool's sweep. It used to span the
        whole terrace, standing on a marble ledge behind the catch trough; with
        the water on the facade line that ledge is gone and the rail would be
        standing in the pool. Along the water the guard IS the infinity edge —
        a 0.55 m ledge from the deck side, a 26 m drop from the water side, and
        a collider that blocks at every height (roofColliders). ── */
  for (const [s, e] of [[a0, p0], [p1, a1]]) {
    shell(90.18, R.parapetH, DY + R.parapetH / 2, MAT.rtGlass, s, e, 48);
    shell(90.18, .11, DY + R.parapetH, MAT.copper, s, e, 48);
  }
  /* the outer roof edge and the two green-roof end sectors get the same rail —
     it has to close the WHOLE crescent, not just the terrace, or there is a
     25 m drop off the parts of the cap the terrace does not cover */
  const e0 = C - SITE.HOTEL.arc / 2, e1 = C + SITE.HOTEL.arc / 2;
  const capY = RY + .05;
  shell(105.4, R.parapetH, capY + R.parapetH / 2, MAT.rtGlass, e0, e1);
  shell(105.4, .11, capY + R.parapetH, MAT.copper, e0, e1);
  for (const [s, e] of [[e0, a0], [a1, e1]]) {
    shell(90.18, R.parapetH, capY + R.parapetH / 2, MAT.rtGlass, s, e, 24);
    shell(90.18, .11, capY + R.parapetH, MAT.copper, s, e, 24);
  }
  for (const th of [a0, a1]) {                                        // the two ends
    inst('rtGlassI', UNIT_BOX, MAT.rtGlass,
      mat4(WX(th, rc), DY + R.parapetH / 2, WZ(th, rc), .05, R.parapetH, R.rOut - R.rIn, th));
    inst('rtCopperI', UNIT_BOX, MAT.copper,
      mat4(WX(th, rc), DY + R.parapetH, WZ(th, rc), .11, .11, R.rOut - R.rIn, th));
  }
  /* ── the cove reveal under the terrace lip: cool along the pool, warm past
        its ends. Set 140 mm proud of the plinth face because the depth buffer
        (near .08 / far 3000) only resolves ~60 mm at 285 m.
        Along the pool it dropped to 89.28, under the new catch trough (89.42) —
        it used to sit at 89.86, which is now INSIDE the trough. ── */
  shell(89.28, .20, TROUGH_Y - .22, MAT.rtCove, p0, p1);
  shell(89.86, .18, DY - .40, MAT.rtCoveWarm, a0, p0, 32);
  shell(89.86, .18, DY - .40, MAT.rtCoveWarm, p1, a1, 32);

  /* ── the OUTER terrace rail, added 2026-08-02 with walkability ─────────────
     rOut is a 1.35 m drop onto the green roof cap, and the cap is not walkable,
     so before the terrace could be stood on that edge needed a guard — the
     planter run at 102.5 leaves 2 m gaps between pots. Frameless glass to match
     the inner run, broken only where the link bridge arrives (TB). Its collider
     is the thing that stops a brunch guest walking off the back of the roof. */
  const TB = HOTEL_ROOF.tower.th, TBH = HOTEL_ROOF.tower.bridgeTh + .006;
  for (const [s, e] of [[a0, TB - TBH], [TB + TBH, a1]]) {
    shell(103.3, R.parapetH, DY + R.parapetH / 2, MAT.rtGlass, s, e, 64);
    shell(103.3, .11, DY + R.parapetH, MAT.copper, s, e, 64);
  }

  /* fin posts every ~3.9 m — the rhythm is what actually makes a frameless
     glass rail visible at distance; the glass alone is just a haze.
     ⚠ COUNT DERIVED (2026-08-02), same reason as the coarse ring's: it was a
     hard 29 across `a0…a1`, and the terrace's sweep now follows the crescent's
     arc, so a typed count silently changes the SPACING instead of the length. */
  const finN = Math.max(12, Math.round((a1 - a0) * 90.18 / 3.86));
  for (let i = 0; i <= finN; i++) {
    const th = a0 + (a1 - a0) * (i / finN);
    /* ⚠ BROKEN over the pool's sweep like the glass runs above (2026-08-03).
       The glass was already broken there — a rail along the water would stand
       IN it — but the fins still ran the full terrace and a swimmer at the
       infinity edge looked down 65 m of open horizon through a picket of
       copper posts standing in the pool. No glass there = no posts. */
    if (th > p0 - .004 && th < p1 + .004) continue;
    inst('rtCopperI', UNIT_BOX, MAT.copper,
      mat4(WX(th, 90.18), DY + R.parapetH / 2, WZ(th, 90.18), .07, R.parapetH, .12, th));
  }
  for (let i = 0; i <= 24; i++) {
    const th = e0 + (e1 - e0) * (i / 24);
    inst('rtCopperI', UNIT_BOX, MAT.copper,
      mat4(WX(th, 105.4), capY + R.parapetH / 2, WZ(th, 105.4), .07, R.parapetH, .12, th));
  }

  /* ── underwater niche lights along the back wall + a wash into the trough:
        the only COOL emissives on the campus, which is exactly why the roof
        still reads once the rest of the resort goes warm and orange ── */
  const nicheN = Math.max(8, Math.round((p1 - p0) * 96.33 / 7.38));
  for (let i = 0; i < nicheN; i++) {
    const th = p0 + (p1 - p0) * ((i + .5) / nicheN);
    inst('rtLitI', UNIT_BOX, MAT.poolGlow,
      mat4(WX(th, R.poolOut - .07), WY - .3, WZ(th, R.poolOut - .07), .9, .14, .07, th));
    inst('rtLitI', UNIT_BOX, MAT.poolGlow,
      mat4(WX(th, R.troughR + .18), TROUGH_Y + .06, WZ(th, R.troughR + .18), .8, .05, .16, th));
  }

  /* ── loungers on the teak, feet toward the drop — ONE run on the pool
        half's outer stretch, inner limit derived from the brunch four-tops;
        see loungerRow(), which roofColliders() also reads ── */
  const LG = loungerRow(R);
  LG.th.forEach((th, i) => {
    const x = WX(th, R.loungeR), z = WZ(th, R.loungeR);
    /* `sun_lounger` — origin floor centre, front −Z = the FEET, so its head
       is at +Z and `ry = th` (local +Z is radially OUTWARD, i.e. INLAND) puts
       the backrest inland and the feet at the drop, exactly as the three
       boxes below did. NO π here: water.js's makeLounger points the other way
       and carries the π, see ASSET_SPEC Group E. */
    if (have('sun_lounger')) {
      modelI('rtLoungerGlbI', 'sun_lounger', mat4(x, DY, z, 1, 1, 1, th));
    } else {
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + .17, z, .82, .34, 2.05, th));
      inst('rtMarbleI', UNIT_BOX, MAT.marble, mat4(x, DY + .40, z, .74, .13, 1.9, th));
      const bx = WX(th, R.loungeR + .92), bz = WZ(th, R.loungeR + .92);
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(bx, DY + .58, bz, .82, .62, .13, th, .5));
    }
    if (i % 2 === 1) {                       // a side table between each pair
      const tth = th + .012;
      inst('rtSlatI', UNIT_BOX, MAT.slat,
        mat4(WX(tth, R.loungeR - 1.3), DY + .22, WZ(tth, R.loungeR - 1.3), .5, .44, .5, tth));
    }
    /* a parasol standing between every other pair, half a pitch along — same
       list, so a parasol can never end up over open water or off the deck */
    if (i % 2 === 0 && i + 1 < LG.th.length && Math.abs(LG.th[i + 1] - th) < LG.pitch * 1.5) {
      const pth = th + (LG.th[i + 1] - th) / 2;
      const px = WX(pth, R.loungeR + 1.35), pz = WZ(pth, R.loungeR + 1.35);
      /* `roof_parasol` + its tinted canopy — authored AT this cone's envelope
         (r 1.75, rim 2.32, apex 3.12, pole Ø .11), so scale 1. Pole foot on
         the deck; ry = pth only turns the ribs, the parasol is round. */
      if (haveRoofParasol()) {
        roofParasolI(mat4(px, DY, pz, 1, 1, 1, pth));
      } else {
        inst('poleI', UNIT_CYL, MAT.dark, mat4(px, DY + 1.25, pz, .11, 2.5, .11));
        inst('rtUmbI', UNIT_CONE, MAT.umbrella, mat4(px, DY + 2.72, pz, 3.5, .8, 3.5));
      }
    }
  });

  /* ── deck lanterns along the back of the teak, ~8 m apart — the SOUTH DECK
        only. They used to run to p1, which since 2026-08-04 would stand them
        at r 99.9 in the middle of the brunch four-tops' row at r 99.0; the bar
        and the dining terrace light themselves (candles, bed strips, the
        caustic wash, the stage's gold LED). ── */
  const lantN = Math.max(4, Math.round((p0 - a0) * 99.9 / 8.26));
  for (let i = 0; i < lantN; i++) {
    const th = a0 + (p0 - a0) * ((i + .5) / lantN);
    const x = WX(th, 99.9), z = WZ(th, 99.9);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .55, z, .1, 1.1, .1));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 1.24, z, .26, .38, .26, th));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(x, DY + 1.46, z, .32, .07, .32, th));
  }

  /* (the central "bar pavilion" that used to stand here, dead on the
     crescent's axis, is GONE — the two-rooms split put the cross-walk exactly
     where it stood. Its job — a counter, stools, a lit back-bar and its one
     warm point light — moved into the BAR ROOM below, same light count.) */

  /* ════════════════════════════════════════════════════════════════════════
     THE CABANA DAYBEDS — the inland long side of the pool, POOL HALF ONLY
     (the bar room's inland elevation is the caustic bar volume — daybeds do
     not belong in a dining room). The reference photograph's inland side is
     an unbroken RUN of white four-poster daybeds with drawn curtains, on
     timber decking, one every five metres for the length of the water. That
     rhythm, backed by the lattice screen, is the pool room's whole elevation.

     Every part rides an EXISTING instance bucket, so the daybeds — ~250
     instances — cost zero additional draw calls.

     `TX/TZ` take a tangential offset in METRES as well as a radius, which is
     what a rectangular object on a curve needs: the four posts of one bed are
     at the corners of a rectangle, not at four points on an arc.
     The bed list is daybedRow(R) — the SAME list roofColliders() rings.
     ════════════════════════════════════════════════════════════════════════ */
  const TX = (th, r, v = 0) => acx + Math.sin(th) * r + Math.cos(th) * v;
  const TZ = (th, r, v = 0) => acz + Math.cos(th) * r - Math.sin(th) * v;

  const GR = R.gardenR, dayTh = daybedRow(R);
  for (const th of dayTh) {
    const x = WX(th, GR), z = WZ(th, GR);
    /* `daybed` — the whole four-poster in ONE instance: deck platform, slatted
       base, mattress, bolster, two throw cushions, four posts, the timber trim
       and the white canopy, plus the curtains TIED BACK against the posts (the
       photograph beats the code on the drapes, inside the code's own planes —
       ASSET_SPEC Group E). Origin floor centre, front −Z = the open side, so
       `ry = th` puts the bolster inland at +Z, as the boxes did.
       NOT in the GLB and still drawn below: the warm lamp strip, the tray
       table, the planted pot and its hedge blob. */
    if (have('daybed')) {
      modelI('rtDaybedGlbI', 'daybed', mat4(x, DY, z, 1, 1, 1, th));
    } else {
      inst('deckI', UNIT_BOX, MAT.deck, mat4(x, DY + .11, z, 3.30, .22, 2.80, th));
      inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(x, DY + .38, z, 2.86, .34, 2.30, th));
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + .62, z, 2.72, .26, 2.16, th));
      // the bolster along the back, and two throw cushions
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(WX(th, GR + .92), DY + .84, WZ(th, GR + .92), 2.60, .44, .30, th));
      for (const v of [-.62, .62]) {
        inst('rtWhiteI', UNIT_BOX, MAT.white,
          mat4(TX(th, GR + .62, v), DY + .86, TZ(th, GR + .62, v), .46, .30, .18, th));
      }
      // four posts and the canopy they carry
      for (const v of [-1.44, 1.44]) for (const dr of [-1.18, 1.18]) {
        inst('rtSlatI', UNIT_BOX, MAT.slat,
          mat4(TX(th, GR + dr, v), DY + 1.42, TZ(th, GR + dr, v), .11, 2.40, .11, th));
      }
      /* the canopy is WHITE — a stretched fabric roof with a thin timber trim,
         not the dark slatted lid the old cabanas had. Six of those read as brown
         boxes; nineteen would have read as a fence. */
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + 2.68, z, 3.22, .20, 2.70, th));
      inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(x, DY + 2.55, z, 3.26, .07, 2.74, th));
      // curtains: one at each end plus a half-drape on each back corner
      for (const v of [-1.40, 1.40]) {
        inst('rtWhiteI', UNIT_BOX, MAT.white,
          mat4(TX(th, GR, v), DY + 1.42, TZ(th, GR, v), .09, 2.30, 2.34, th));
        inst('rtWhiteI', UNIT_BOX, MAT.white,
          mat4(TX(th, GR + 1.14, v * .60), DY + 1.42, TZ(th, GR + 1.14, v * .60),
            .74, 2.30, .09, th));
      }
    }
    // the warm lamp under the canopy — this is what lights the row after dark
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 2.54, z, 2.20, .09, .34, th));
    // a low timber tray table at the foot, and a dark planted pot beside it
    inst('rtSlatI', UNIT_BOX, MAT.slat,
      mat4(WX(th, GR - 1.62), DY + .40, WZ(th, GR - 1.62), .92, .38, .74, th));
    const pth = th + 2.35 / GR;
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(WX(pth, GR + .35), DY + .34, WZ(pth, GR + .35), .82, .68, .82, pth));
    inst('hedgeBlobI', UNIT_BLOB, MAT.hedge,
      mat4(WX(pth, GR + .35), DY + .96, WZ(pth, GR + .35), 1.24, 1.02, 1.24));
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE PERFORATED LATTICE SCREEN WALL.
     "Model the screen wall — it is what makes the roof read at distance, day
     and night." A run of tall white blades of alternating height, each a
     perforated lattice with a POINTED head (UNIT_FIN), plus a taller, narrower
     accent fin standing 0.2 m proud every fourth bay. Alpha-tested, so the sky
     shows through the holes; one geometry and one material, so the whole
     screen is a SINGLE draw call.

     ⚠ IT ENDS AT THE POOL, at p1 — over the bar and the dining terrace the
     caustic volume and the stage alcove ARE the back-band elevation, and two
     competing screens would read as scaffolding. Since the short pool of
     2026-08-04 the run is mostly SOUTH of the water, which is where the
     daylight photograph puts it: screen wall and cabanas to the left, pool
     centre, bar right.

     At night the material's emissiveMap (texScreenGlow) lifts to 1.45 and the
     screen becomes the blue projection wall from the photograph. That is why
     it is emissive rather than lit: a point light strong enough to paint 100 m
     of screen would have washed the whole terrace.
     ════════════════════════════════════════════════════════════════════════ */
  const SR = R.screenR, dSth = R.screenW / SR;
  /* The bays are nearly the SAME height on purpose (±6 %) and 2 % wider than
     their pitch, so they touch: a continuous wall to the shoulder line with a
     row of points above it, which is what the photograph shows. The first pass
     ran 0.78…1.08 and the screen came out as a picket of separate white tents
     with sky between them. */
  const RHYTHM = [1.00, .96, 1.04, .94, 1.02, .97, 1.06, .95];
  let sIdx = 0;
  for (let th = C - R.arcHalf + dSth * .5; th <= p1 - dSth * .7; th += dSth) {
    sIdx++;
    if (Math.abs(Math.abs(th - C) - R.coreArcHalf) < .045) continue;  // head-house
    const h = R.screenH * RHYTHM[sIdx % RHYTHM.length];
    inst('rtScreenI', UNIT_FIN, MAT.rtScreen,
      mat4(WX(th, SR), DY + h / 2, WZ(th, SR), R.screenW * 1.02, h, .16, th));
    if (sIdx % 4 === 1) {                      // the proud accent blade
      const ah = h + 1.15;
      inst('rtScreenI', UNIT_FIN, MAT.rtScreen,
        mat4(WX(th, SR - .24), DY + ah / 2, WZ(th, SR - .24), R.screenW * .50, ah, .24, th));
    }
    // a solid plinth so the blades do not read as floating
    inst('rtWhiteI', UNIT_BOX, MAT.white,
      mat4(WX(th, SR), DY + .30, WZ(th, SR), R.screenW * 1.02, .60, .34, th));
  }
  /* ⚠ NO extra lights here, and that is a measured decision, not an oversight.
     Two cool point lights washing the screen (0 by day, 26 at night) cost
     13–18 % of the frame rate in EVERY view — the campus already carries 34
     lights and every lit fragment on the map loops over all of them, so a light
     that only matters 285 m away after dark is paid for by the suite at noon.
     Baseline 78 / 98 / 106 / 110 fps (suite · roof · aerial · river) fell to
     68 / 82 / 90 / 89 with them in. The screen's emissiveMap does the job for
     nothing; see MAT.rtScreen. */

  /* ── the eight brunch four-tops. This is where the wedding party eats on
        2027-03-18. THE LIST IS HOTEL_ROOF.brunchTables — published once in
        site.js, dressed by moments.js, stood up here; the spawn is derived
        from entries 3 and 4 of the same list, so a literal in this loop is a
        drift waiting to happen. All eight are inside the POOL half. ── */
  HOTEL_ROOF.brunchTables.forEach((t, k) => {
    const th = t.th, r = t.r;
    const x = WX(th, r), z = WZ(th, r);
    /* `four_top` — the BARE table (timber top at y .785 over a Ø .14 pedestal
       and its disc foot). Radially symmetric, so no yaw is needed.
       ⚠ Its top face must stay at .785 and nothing may exceed r .68 below
       y .75: moments.js dresses this same table for the Welcome Brunch with a
       linen skirt r .68→.72 and a cloth disc at .755….805, and the GLB has to
       sit INSIDE that. (The four chairs below are not part of this row of the
       spec and stay as they were.) */
    if (have('four_top')) {
      modelI('rtFourTopGlbI', 'four_top', mat4(x, DY, z, 1, 1, 1));
    } else {
      inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .36, z, .14, .72, .14));
      inst('rtTopI', UNIT_CYL, MAT.marble, mat4(x, DY + .75, z, 1.35, .07, 1.35));
    }
    for (let c = 0; c < 4; c++) {                       // four chairs
      const ca = c * Math.PI / 2 + .4;
      const cxp = x + Math.cos(ca) * 1.05, czp = z - Math.sin(ca) * 1.05;
      /* `dining_chair_rattan` — THE SAME CHAIR as the bar room's dining
         terrace (KAN-208 wave 1, a deliberate look decision): the pool room
         and the dining terrace are one roof, and one chair is what makes them
         read as one restaurant. Same seat point (1.05 m out, facing in) and the
         same change of basis as diningChair(): ca is the OUTWARD bearing and
         the GLB's front is local +Z, so ry = ca − π/2.
         ⚠ ITS BACK IS 1.07 m, NOT THE BOXES' 0.87. That is the real height of
         a dining chair at a .785 table, and moments.js's brunch slipcovers are
         cut to THIS back (they used to be radial fins, like the boxes' backs —
         see dressWelcomeBrunch). The footprint is 0.46 × 0.50 against the boxes'
         0.50 × 0.50, so the back still stops at r 1.30 = TABLE_R + PLAYER_R and
         roofColliders() rings nothing differently. */
      if (have('dining_chair_rattan')) {
        modelI('rtBrunchChairGlbI', 'dining_chair_rattan',
          mat4(cxp, DY, czp, 1, 1, 1, ca - Math.PI / 2));
        continue;
      }
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(cxp, DY + .23, czp, .5, .46, .5, ca));
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(x + Math.cos(ca) * 1.28, DY + .62, z - Math.sin(ca) * 1.28, .5, .5, .08, ca));
    }
    if (k % 2 === 0) {                                   // a parasol over every other one
      /* `roof_parasol` scaled onto THIS cone's envelope (r 1.50, rim 2.51,
         pole Ø .09) from the lounger row's (r 1.75, rim 2.32, Ø .11):
         (1.50/1.75, 2.51/2.32, 1.50/1.75). Three's instancing normalises a
         non-uniform scale for the normals. The pole foot is the table centre:
         the scaled base (Ø .39 × .05) hides inside four_top's Ø .62 × .055
         disc foot, and the pole rises through the pedestal and the top. */
      if (haveRoofParasol()) {
        roofParasolI(mat4(x, DY, z, 1.5 / 1.75, 2.51 / 2.32, 1.5 / 1.75, th));
      } else {
        inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + 1.35, z, .09, 2.7, .09));
        inst('rtUmbI', UNIT_CONE, MAT.umbrella, mat4(x, DY + 2.86, z, 3.0, .7, 3.0));
      }
    }
  });

  /* ── the two stair / lift head-houses: the only way up here ── */
  for (const s of [-1, 1]) {
    const th = C + s * R.coreArcHalf;
    const x = WX(th, 101.2), z = WZ(th, 101.2);
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + 1.8, z, 5.2, 3.6, 4.6, th));
    inst('rtCopperI', UNIT_BOX, MAT.copper, mat4(x, DY + 3.68, z, 5.6, .22, 5.0, th));
    inst('glass', UNIT_BOX, MAT.glass,
      mat4(WX(th, 98.85), DY + 1.6, WZ(th, 98.85), 3.0, 2.4, .12, th));
    inst('rtSlatI', UNIT_BOX, MAT.slat,
      mat4(WX(th, 103.5), DY + 1.7, WZ(th, 103.5), 4.4, 3.0, .16, th));
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(WX(th, 98.7), DY + 2.9, WZ(th, 98.7), 2.4, .1, .14, th));
  }

  /* ── planting on the back band.
        The old run of 26 planters at r 102.5 is GONE: the lattice screen and
        its plinth now occupy 102.73…103.07, and a 1.2 m deep planter in a
        0.43 m gap is a planter inside a wall. Its job — dark pots with clipped
        topiary along the inland side — moved into the daybed loop above, one
        pot per bed, which is what the reference photograph actually shows.
        Bougainvillea stays, as a splash every fourth bed on the deck side. ── */
  dayTh.forEach((th, i) => {
    if (i % 4 !== 2) return;
    const bth = th - 2.35 / GR;
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(WX(bth, GR + .35), DY + .30, WZ(bth, GR + .35), .74, .60, .74, bth));
    inst('bougain', UNIT_BLOB, MAT.bougain,
      mat4(WX(bth, GR + .35), DY + 1.10, WZ(bth, GR + .35), 1.5, 1.3, 1.1));
  });
  /* and a soft green rim on the green-roof cap outside the terrace. Its sweep
     overhangs the terrace by 0.12 rad at each end so the planting carries on
     past the glazed ends onto the bare cap — which is what the ±0.74 literal
     did against the old ±0.62, and stops being true the moment the terrace
     grows. Clamped inside the crescent's own arc. */
  const rimHalf = Math.min(R.arcHalf + .12, SITE.HOTEL.arc / 2 - .01);
  const rimN = Math.max(12, Math.round(2 * rimHalf * 104.4 / 7.36) + 1);
  for (let i = 0; i < rimN; i++) {
    const th = (C - rimHalf) + (i / (rimN - 1)) * rimHalf * 2;
    inst('hedgeBlobI', UNIT_BLOB, MAT.hedge,
      mat4(WX(th, 104.4), RY + .55, WZ(th, 104.4), 3.0, 1.1, 1.7));
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE ROOFTOP BAR — the NORTH room. refs: rooftop-bar-night.png (the blue
     caustic volume over its flared colonnade) + rooftop-bar-dusk.png (the
     dark boards, the rattan dining, the planted canopy on one pedestal).
     The whole plan comes from barLayout(R) — roofColliders() reads the SAME
     object, so a solid and its collider cannot disagree. Everything repeated
     rides an instance bucket; the only light is the counter's, MOVED here
     from the deleted central pavilion (count unchanged — see the fps note at
     the screen wall: the caustic wash is EMISSIVE, never a light).
     ════════════════════════════════════════════════════════════════════════ */
  const BL = barLayout(R);

  /* ── the backdrop: the elevated caustic-clad volume on its splayed
        tree-columns. Carl-approved and it is what makes the roof read after
        dark, so it stays — but since 2026-08-04 it is the BAR's back wall, one
        run behind the counter, not a colonnade down half the building.
        Per clad bay: a dark body box + recessed white cap, caustic panels on
        BOTH faces (the east face reads from fly mode), a flared column every
        second bay with a warm soffit light between — panel planes stand
        ≥140 mm off the body faces, the coplanar-overlay rule. Panels use
        alternating heights so the top reads as the refs' crenellation.
        ⚠ The body is 2.0 m deep now, not 2.4, and its inner panel plane moved
        100.15 → 100.75: the back-bar's cabinets and bottle shelves stand in the
        band it used to occupy, and the old planted base at r 100.3 stood
        exactly where the bartender does. That planting moved to BL.beds. ── */
  const BAY = 1.62, RV = 101.95;              // clad bay (m) · volume centre radius
  const PANEL_H = [0, .75, .3, 1.05, .15, .9, .45, 1.2];   // + base 4.7 m
  for (const [s, e] of BL.segs) {
    const n = Math.max(4, Math.round((e - s) * RV / BAY));
    const dth = (e - s) / n;
    /* end caps — without them each segment ends on the bays' bare dark body,
       a black monolith from inside the room. Caustic panels, like the faces. */
    for (const tq of [s - .0008, e + .0008]) {
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(tq, RV), DY + 4.9, WZ(tq, RV), .12, 4.9, 2.45, tq));
    }
    for (let i = 0; i < n; i++) {
      const th = s + (i + .5) * dth;
      inst('darkI', UNIT_BOX, MAT.dark,
        mat4(WX(th, RV), DY + 4.63, WZ(th, RV), BAY + .06, 4.15, 2.0, th));
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(WX(th, RV), DY + 6.83, WZ(th, RV), BAY + .06, .30, 2.1, th));
      const h = 4.7 + PANEL_H[i % PANEL_H.length];
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(th, 100.90), DY + 2.45 + h / 2, WZ(th, 100.90), BAY - .10, h, .12, th));
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(th, 103.05), DY + 2.45 + h / 2, WZ(th, 103.05), BAY - .10, h, .12, th));
      if (i % 2 === 0) {                      // the flared tree-column
        inst('rtWhiteCylI', UNIT_CYL, MAT.white,
          mat4(WX(th, 101.5), DY + .85, WZ(th, 101.5), .52, 1.7, .52));
        inst('rtWhiteConeI', UNIT_CONE, MAT.white,
          mat4(WX(th, 101.5), DY + 2.12, WZ(th, 101.5), 2.0, .85, 2.0, th, Math.PI));
      } else {                                // warm soffit light between columns
        inst('glowI', UNIT_BOX, MAT.glowLamp,
          mat4(WX(th, 101.6), DY + 2.38, WZ(th, 101.6), 1.35, .10, .5, th));
      }
    }
  }

  /* ── THE BAR COUNTER, from reference/photos/rooftop-pool-bar-daylight.webp.
        A DARK STONE TOP over a VERTICAL FLUTED TIMBER front, stools with white
        cushions along the pool side, and behind it the back-bar: base cabinets
        with the ice wells let into them and two lit shelves of bottles above.
        10.0 m of counter, its south end 2.6 m into the room — from the pool's
        near coping to the first stool is ~9 m, which is Carl's "the bar is very
        close by the pool". Its ONE warm point light is the deleted central
        pavilion's, moved; the campus light count does not change. ── */
  const CT = BL.counter, BB = BL.backbar;
  const ctSeg = 8, ctD = (2 * CT.halfTh) / ctSeg;      // fluted bays along the run
  pointLight(g, Math.sin(CT.tc) * (CT.r + .6), DY + 2.2, Math.cos(CT.tc) * (CT.r + .6), 0, 38, 26);
  for (let k = 0; k < ctSeg; k++) {
    const th = CT.tc - CT.halfTh + (k + .5) * ctD;
    const x = WX(th, CT.r), z = WZ(th, CT.r);
    /* the fluted front: four slim timber staves per bay, standing 60 mm proud
       of the carcass, which is what reads as fluting at any distance */
    inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak, mat4(x, DY + .53, z, ctD * CT.r + .04, 1.06, .84, th));
    for (let f = 0; f < 4; f++) {
      const fv = (f - 1.5) * (ctD * CT.r / 4);
      inst('rtSlatI', UNIT_BOX, MAT.slat,
        mat4(TX(th, CT.r - .48, fv), DY + .55, TZ(th, CT.r - .48, fv), .16, 1.02, .09, th));
    }
    // the dark stone top, overhanging the fluting on the guest side
    inst('rtDkTopBoxI', UNIT_BOX, MAT.blackPolish,
      mat4(WX(th, CT.r - .06), DY + 1.10, WZ(th, CT.r - .06), ctD * CT.r + .06, .10, 1.06, th));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + .18, z, ctD * CT.r * .8, .1, .12, th));
    // one stool per bay, on the pool side
    const stx = WX(th, 97.80), stz = WZ(th, 97.80);
    /* `bar_stool` — the code's pedestal with the photograph's finish (bronze
       foot and column, timber footrail + seat band, ivory cushion).
       ⚠ Ø .46 IS LOAD-BEARING: roofColliders() says the stool line reaches
       r 97.59 and the counter arc is authored stricter than that, so nothing
       may exceed r .23 from this axis. models.json: 0.46 × 0.824 × 0.455. */
    if (have('bar_stool')) {
      modelI('rtBarStoolGlbI', 'bar_stool', mat4(stx, DY, stz, 1, 1, 1));
    } else {
      inst('poleI', UNIT_CYL, MAT.dark, mat4(stx, DY + .025, stz, .44, .05, .44));       // foot disc
      inst('poleI', UNIT_CYL, MAT.dark, mat4(stx, DY + .36, stz, .11, .62, .11));        // pedestal
      inst('rtSlatCylI', UNIT_CYL, MAT.slat, mat4(stx, DY + .26, stz, .34, .045, .34));  // footrest ring
      inst('rtSlatCylI', UNIT_CYL, MAT.slat, mat4(stx, DY + .70, stz, .46, .06, .46));   // seat band
      inst('rtWhiteCylI', UNIT_CYL, MAT.white, mat4(stx, DY + .775, stz, .42, .09, .42)); // cushion
    }
  }
  /* the back-bar: cabinets + two ice wells + lit bottle shelves */
  {
    const bbSeg = 6, bbD = (2 * BB.halfTh) / bbSeg;
    for (let k = 0; k < bbSeg; k++) {
      const th = BB.tc - BB.halfTh + (k + .5) * bbD;
      const w = bbD * BB.r + .04;
      inst('darkI', UNIT_BOX, MAT.dark, mat4(WX(th, BB.r), DY + .47, WZ(th, BB.r), w, .94, .60, th));
      inst('rtDkTopBoxI', UNIT_BOX, MAT.blackPolish,
        mat4(WX(th, BB.r), DY + .97, WZ(th, BB.r), w, .06, .64, th));
      if (k === 1 || k === 4) {               // the ice wells, let into the top
        inst('rtSlatCylI', UNIT_CYL, MAT.slat,
          mat4(WX(th, BB.r - .06), DY + 1.02, WZ(th, BB.r - .06), .52, .06, .52));
      }
      // the bottles, in their own rows on the two lit shelves
      for (const [sh, y] of [[0, 1.64], [1, 2.19]]) {
        for (let b = 0; b < 5; b++) {
          const bth = th + (b - 2) * (bbD / 5.4);
          inst('rtBottleI', UNIT_CYL, MAT.bottle,
            mat4(WX(bth, BB.r + .24), DY + y + .16, WZ(bth, BB.r + .24), .11, .32, .11),
            BOTTLE_TINT[(k * 5 + b + sh * 3) % BOTTLE_TINT.length]);
        }
      }
    }
    for (const y of [1.58, 2.13]) {           // the two shelves, and their strips
      const s0 = BB.tc - BB.halfTh, s1 = BB.tc + BB.halfTh;
      inst('rtSlatI', UNIT_BOX, MAT.slat,
        mat4(WX((s0 + s1) / 2, BB.r + .24), DY + y, WZ((s0 + s1) / 2, BB.r + .24),
          (s1 - s0) * BB.r, .06, .42, (s0 + s1) / 2));
      inst('inLightBarI', UNIT_BOX, MAT.inLight,
        mat4(WX((s0 + s1) / 2, BB.r + .12), DY + y + .04, WZ((s0 + s1) / 2, BB.r + .12),
          (s1 - s0) * BB.r - .3, .07, .10, (s0 + s1) / 2));
    }
  }

  /* ── the bar's forecourt: the photograph's foreground — timber-framed lounge
        chairs with white cushions round a low side table, on the deck seaward
        of the counter, facing the sea ── */
  for (const L of BL.lounge) {
    for (const v of [-1.25, 1.25]) {
      const cx0 = TX(L.th, L.r, v), cz0 = TZ(L.th, L.r, v);
      for (const [u, w] of [[-.42, -.42], [-.42, .42], [.42, -.42], [.42, .42]]) {
        inst('rtSlatI', UNIT_BOX, MAT.slat,
          mat4(TX(L.th, L.r + u, v + w), DY + .17, TZ(L.th, L.r + u, v + w), .07, .34, .07, L.th));
      }
      inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(cx0, DY + .38, cz0, 1.02, .08, 1.02, L.th));
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(cx0, DY + .46, cz0, .92, .16, .92, L.th));
      inst('rtSlatI', UNIT_BOX, MAT.slat,       // the raked back frame
        mat4(TX(L.th, L.r + .48, v), DY + .74, TZ(L.th, L.r + .48, v), .09, .68, .98, L.th));
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(TX(L.th, L.r + .40, v), DY + .76, TZ(L.th, L.r + .40, v), .12, .58, .86, L.th));
    }
    inst('rtSlatCylI', UNIT_CYL, MAT.slat,      // the round side table between them
      mat4(WX(L.th, L.r), DY + .22, WZ(L.th, L.r), .62, .44, .62));
    inst('rtDkTopI', UNIT_CYL, MAT.rtDarkTeak,
      mat4(WX(L.th, L.r), DY + .445, WZ(L.th, L.r), .66, .04, .66));
  }

  /* ── dining: REAL furniture (Carl, 2026-08-03: "the table and chairs are
        very very low fidelity on the deck, lets improve them"), rebuilt
        against rooftop-bar-dusk.png — woven-toned frames, white cushions,
        dark timber tops. Same BL.tables list, same table centres, so the
        collider circles in roofColliders() did not move.
          · round tables: pedestal — foot disc, column, a timber edge band
            with the dark top surface sitting proud of it (the rim reads).
          · square tables: four timber legs under the same band + top.
          · chairs: four legs, a timber seat frame under a white cushion, and
            a framed backrest (two uprights + top rail) holding an inset woven
            panel — the cross-back precedent: many scalings of one unit box,
            still the same instance buckets, one draw call per bucket.
          · a place-setting hint: one white plate per cover on the table edge.
        Per-seat yaw/pull jitter is SEEDED (mulberry32, house rule — never
        Math.random) so the room never shuffles between loads. The candles
        stay; zero lights added. ── */
  const rndSeat = mulberry32(83017);
  /* ONE chair, authored at (x, z) facing the table along +ca. Extracted
     2026-08-04 so the long communal tables seat the SAME woven chair as the
     round ones — that repetition is what makes the dining terrace read as one
     restaurant in reference/photos/rooftop-bar-live-band.webp. */
  const diningChair = (cx1, cz1, ca) => {
    /* `dining_chair_rattan` — timber frame, curved top rail, a real woven
       rattan field and a white box cushion.
       ⚠ THE YAW. This helper authors the chair's BACK at local +X (`at`'s
       +lx is outward, behind the sitter) while the GLB is the chair family's
       +Z-front convention — back at local −Z. ry = ca − π/2 is the change of
       basis between them; ry = ca seats everyone sideways.
       Envelope 0.46 × 0.499 × 1.072 against the boxes' 0.46 × 0.48 × 1.075,
       so nothing here reaches the tables' TABLE_R rings any differently. */
    if (have('dining_chair_rattan')) {
      modelI('rtDineChairGlbI', 'dining_chair_rattan',
        mat4(cx1, DY, cz1, 1, 1, 1, ca - Math.PI / 2));
      return;
    }
    const ux = Math.cos(ca), uz = -Math.sin(ca);
    const vx = Math.sin(ca), vz = Math.cos(ca);
    const at = (lx, lz, y, sx, sy, sz, key, mat) =>
      inst(key, UNIT_BOX, mat,
        mat4(cx1 + ux * lx + vx * lz, y, cz1 + uz * lx + vz * lz, sx, sy, sz, ca));
    for (const [lx, lz] of [[-.19, -.18], [-.19, .18], [.20, -.18], [.20, .18]]) {
      at(lx, lz, DY + .22, .05, .44, .05, 'rtSlatI', MAT.slat);            // four legs
    }
    at(0, 0, DY + .465, .48, .05, .46, 'rtSlatI', MAT.slat);               // seat frame
    at(0, 0, DY + .535, .44, .09, .42, 'rtWhiteI', MAT.white);             // white cushion
    for (const lz of [-.18, .18]) {
      at(.20, lz, DY + .75, .05, .55, .05, 'rtSlatI', MAT.slat);           // back uprights
    }
    at(.20, 0, DY + 1.045, .05, .06, .41, 'rtSlatI', MAT.slat);            // top rail
    at(.21, 0, DY + .77, .035, .40, .30, 'rtRattanI', MAT.rattan);         // woven inset panel
  };
  for (const t of BL.tables) {
    const x = WX(t.th, t.r), z = WZ(t.th, t.r);
    if (t.round) {
      inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .035, z, .60, .07, .60));        // foot disc
      inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .38, z, .13, .62, .13));         // column
      inst('rtSlatCylI', UNIT_CYL, MAT.slat, mat4(x, DY + .715, z, 1.34, .07, 1.34)); // edge band
      inst('rtDkTopI', UNIT_CYL, MAT.rtDarkTeak, mat4(x, DY + .768, z, 1.26, .036, 1.26));
    } else {
      for (const [u, v] of [[-.48, -.48], [-.48, .48], [.48, -.48], [.48, .48]]) {
        inst('rtSlatI', UNIT_BOX, MAT.slat,
          mat4(TX(t.th, t.r + u, v), DY + .34, TZ(t.th, t.r + u, v), .07, .68, .07, t.th));
      }
      inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(x, DY + .715, z, 1.19, .07, 1.19, t.th));
      inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak, mat4(x, DY + .768, z, 1.13, .036, 1.13, t.th));
    }
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + .85, z, .1, .12, .1));  // candle
    for (let c = 0; c < 4; c++) {
      const ca = c * Math.PI / 2 + (t.round ? .79 : .4) + t.th + (rndSeat() - .5) * .24;
      const cd = 1.02 + (rndSeat() - .5) * .08;
      diningChair(x + Math.cos(ca) * cd, z - Math.sin(ca) * cd, ca);
      inst('rtWhiteCylI', UNIT_CYL, MAT.white,                               // the plate
        mat4(x + Math.cos(ca) * .42, DY + .795, z - Math.sin(ca) * .42, .27, .018, .27));
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE LONG COMMUNAL DINING TABLES — Carl, 2026-08-04, from
     reference/photos/rooftop-bar-live-band.webp: *"here is the reference
     picture of the rooftop bar live band"*. That photograph is not really a
     picture of a band, it is a picture of a DINING ROOM — bare dark tables
     running the length of the deck, woven chairs down both sides with white
     cushions, candles and full glassware settings at every cover, and the
     stage at the end of the run. The long-table rhythm is the bar's signature
     and it is what the round four-tops alone could not say.

     They run ALONG the arc, which points their length at the stage. Every
     part rides a bucket that already existed, so 4 × 11 m of communal table
     with 96 covers is ZERO new draw calls beyond the glassware.
     ════════════════════════════════════════════════════════════════════════ */
  const rndLong = mulberry32(51993);
  for (const LT of BL.longTables) {
    const R0 = LT.r, W = LT.len;
    const nLeg = 4, nSeat = Math.round(W / .88);
    const c0 = WX(LT.th, R0), cz0 = WZ(LT.th, R0);
    /* the top: ONE box per table — a long box on a curve is a chord, and at
       11 m over a 94 m radius the sagitta is 16 cm, which reads as straight */
    inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(c0, DY + .715, cz0, W, .08, 1.14, LT.th));
    inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak, mat4(c0, DY + .775, cz0, W - .06, .04, 1.06, LT.th));
    for (let l = 0; l < nLeg; l++) {           // trestle legs, in pairs
      const lv = (l - (nLeg - 1) / 2) * (W - 1.9) / (nLeg - 1);
      for (const u of [-.40, .40]) {
        inst('rtSlatI', UNIT_BOX, MAT.slat,
          mat4(TX(LT.th, R0 + u, lv), DY + .35, TZ(LT.th, R0 + u, lv), .09, .70, .09, LT.th));
      }
      inst('rtSlatI', UNIT_BOX, MAT.slat,      // the stretcher between them
        mat4(TX(LT.th, R0, lv), DY + .22, TZ(LT.th, R0, lv), .07, .07, .86, LT.th));
    }
    for (let s = 0; s < nSeat; s++) {
      const sv = (s - (nSeat - 1) / 2) * (W - .5) / (nSeat - 1);
      for (const side of [-1, 1]) {
        /* facing the table: the chair sits 1.02 m out, turned to look inward */
        const cd = 1.02 + (rndLong() - .5) * .06;
        /* diningChair()'s +X is OUTWARD (behind the sitter). The outward unit
           vector on the +r side is (sin th, cos th) and at() builds its own as
           (cos ca, −sin ca), so ca = th − π/2 on that side and th + π/2 on the
           other. Getting this sign wrong seats everyone facing the sea. */
        const ca = LT.th - side * Math.PI / 2 + (rndLong() - .5) * .16;
        diningChair(TX(LT.th, R0 + side * cd, sv), TZ(LT.th, R0 + side * cd, sv), ca);
        // the cover: plate, then the photograph's full glassware — two stems
        inst('rtWhiteCylI', UNIT_CYL, MAT.white,
          mat4(TX(LT.th, R0 + side * .40, sv), DY + .805,
            TZ(LT.th, R0 + side * .40, sv), .27, .018, .27));
        for (const [gu, gv, gh] of [[.60, -.16, .17], [.62, .16, .13]]) {
          inst('rtStemI', UNIT_CYL, MAT.rtGlass,
            mat4(TX(LT.th, R0 + side * gu, sv + gv), DY + .80 + gh / 2,
              TZ(LT.th, R0 + side * gu, sv + gv), .07, gh, .07));
        }
      }
      if (s % 3 === 1) {                       // candles down the centre line
        inst('rtSlatCylI', UNIT_CYL, MAT.slat,
          mat4(TX(LT.th, R0, sv), DY + .84, TZ(LT.th, R0, sv), .13, .10, .13));
        inst('glowI', UNIT_BOX, MAT.glowLamp,
          mat4(TX(LT.th, R0, sv), DY + .95, TZ(LT.th, R0, sv), .10, .14, .10));
      }
    }
  }

  /* ── freestanding planting beds along the inner edge, warm strips on the
        room-facing side, stood 175 mm proud ── */
  for (const b of BL.beds) {
    const x = WX(b.th, b.r), z = WZ(b.th, b.r);
    inst('darkI', UNIT_BOX, MAT.dark, mat4(x, DY + .30, z, 2.4, .6, .85, b.th));
    inst('hedgeBlobI', UNIT_BLOB, MAT.hedge, mat4(x, DY + .92, z, 2.7, 1.0, 1.05));
    inst('inLightBarI', UNIT_BOX, MAT.inLight,
      mat4(WX(b.th, b.r + .60), DY + .10, WZ(b.th, b.r + .60), 2.2, .09, .10, b.th));
  }

  /* ── THE CANTILEVERED PLANTED CANOPY on ONE white column — the daylight
        photograph's top-right corner, trailing greenery over the bar. It used
        to stand on the bridge bearing 45 m up the roof; it belongs over the
        back-bar, which is where it is now. ── */
  {
    const x = WX(BL.canopy.th, BL.canopy.r), z = WZ(BL.canopy.th, BL.canopy.r);
    inst('rtWhiteCylI', UNIT_CYL, MAT.white, mat4(x, DY + 1.15, z, .95, 2.3, .95));
    inst('rtWhiteConeI', UNIT_CONE, MAT.white,
      mat4(x, DY + 2.72, z, 3.1, .85, 3.1, BL.canopy.th, Math.PI));
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + 3.32, z, 6.4, .28, 5.0, BL.canopy.th));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 2.98, z, 1.8, .08, 1.8, BL.canopy.th));
    inst('hedgeBlobI', UNIT_BLOB, MAT.hedge, mat4(x, DY + 3.75, z, 5.8, .8, 4.4));
    for (const [u, v] of [[-3.0, 0], [3.0, 0], [0, -2.3], [0, 2.3], [-2.4, -1.9], [2.4, 1.9]]) {
      inst('hedgeBlobI', UNIT_BLOB, MAT.hedge,      // greenery trailing off the edge
        mat4(TX(BL.canopy.th, BL.canopy.r + v, u), DY + 3.05,
          TZ(BL.canopy.th, BL.canopy.r + v, u), 1.0, 1.5, .7, BL.canopy.th));
    }
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE LIVE-BAND STAGE — rebuilt 2026-08-04 from
     reference/photos/rooftop-bar-live-band.webp, replacing the generic
     platform / amp stacks / drum riser that stood here.

     What that photograph actually shows: an alcove at the end of the dining
     run, roofed by a fan of big WHITE PERFORATED PANELS each outlined in a
     continuous line of WARM GOLD LED, carried on SPLAYED white columns; a
     dense GREEN LIVING WALL filling the back of it; and two performers on a
     low platform in front of the greenery.

     ⚠ The gold outline is an emissiveMap (MAT.rtStagePanel), not a light. The
     campus's point-light count is budgeted (js/lightbudget.js, N = 12 slots
     over 31 logical lights) and two extra rooftop lights were MEASURED at
     13–18 % of the frame rate in every view. This entire alcove — panels,
     LED, the wash on the living wall — costs zero lights.

     The stage faces SOUTH, down the length of the long communal tables, so the
     living wall stands on its north flank as a radial wall.
     ════════════════════════════════════════════════════════════════════════ */
  {
    const ST = BL.stage, sx = (r, v) => TX(ST.th, r, v), sz = (r, v) => TZ(ST.th, r, v);
    const rBack = ST.r + ST.d / 2, rFront = ST.r - ST.d / 2;   // 103.0 · 97.0
    const halfW = ST.w / 2;
    // the low platform + its dark timber deck
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(WX(ST.th, ST.r), DY + .21, WZ(ST.th, ST.r), ST.w, .42, ST.d - .6, ST.th));
    inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak,
      mat4(WX(ST.th, ST.r), DY + .45, WZ(ST.th, ST.r), ST.w - .1, .06, ST.d - .7, ST.th));

    /* THE GREEN LIVING WALL, on the stage's north flank — a radial wall of
       densely packed foliage on a dark carrier, so it reads as planted rather
       than as clipped topiary */
    const wth = ST.th + (halfW + .55) / ST.r;
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(WX(wth, ST.r), DY + 2.3, WZ(wth, ST.r), .30, 4.6, ST.d, wth));
    for (let ry = 0; ry < 6; ry++) for (let rr = 0; rr < 7; rr++) {
      const r = rFront + .45 + rr * ((ST.d - .9) / 6);
      inst('livingI', UNIT_BLOB, MAT.living,
        mat4(WX(wth - .17 / ST.r, r), DY + .55 + ry * .78, WZ(wth - .17 / ST.r, r), .62, 1.05, 1.12));
    }

    /* THE CANOPY: splayed white columns, a white soffit, and the fan of
       gold-edged perforated shields hanging across the alcove's south face */
    for (const v of [-halfW + .5, 0, halfW - .5]) {
      inst('rtWhiteCylI', UNIT_CYL, MAT.white,
        mat4(sx(rBack - 1.1, v), DY + 2.35, sz(rBack - 1.1, v), .40, 4.7, .40));
      inst('rtWhiteConeI', UNIT_CONE, MAT.white,
        mat4(sx(rBack - 1.1, v), DY + 5.05, sz(rBack - 1.1, v), 1.9, .95, 1.9, ST.th, Math.PI));
    }
    inst('rtWhiteI', UNIT_BOX, MAT.white,
      mat4(WX(ST.th, ST.r + .3), DY + 5.66, WZ(ST.th, ST.r + .3), ST.w + 1.0, .30, ST.d - .2, ST.th));
    /* the panels: one row across the alcove's SOUTH face, spanning its depth.
       UNIT_SHIELD's apex is already −Y — it hangs point-down as authored, so
       there is no rz here.
       ⚠ TWO AXES THAT ARE EASY TO SWAP, and the first pass swapped both.
       UNIT_SHIELD is a Shape in the XY plane extruded along Z, so `sx` is the
       panel's WIDTH, `sy` its HEIGHT and `sz` its THICKNESS — put the width in
       `sz` and what you see is the EXTRUSION'S SIDE WALL, whose UVs come from
       ExtrudeGeometry's own generator and repeat, so every panel wears the gold
       frame three times over. And this row runs RADIALLY, so its width must lie
       along the radius: `ry = pth + π/2` maps local +X onto the radial
       direction (`ry = pth` would map it onto the tangent). */
    const nPan = 5, pth = ST.th - (halfW + .10) / ST.r;
    const pw = (ST.d - 1.1) / nPan;
    for (let i = 0; i < nPan; i++) {
      const r = rFront + .55 + (i + .5) * pw;
      /* they hang from the soffit and STOP well above head height — at the
         first placement their tips came down to DY + 1.2 and the band was
         behind a curtain of panels */
      const ph = 2.6 + (i % 2) * .30;
      inst('rtStagePanelI', UNIT_SHIELD, MAT.rtStagePanel,
        mat4(WX(pth, r), DY + 5.50 - ph / 2, WZ(pth, r), pw * .94, ph, .14,
          pth + Math.PI / 2));
    }
    /* the same panels return along the back, behind the living wall's head, so
       the alcove reads as a lantern from the dining terrace and from fly mode */
    for (let i = 0; i < 3; i++) {
      const v = (i - 1) * (ST.w / 3);
      inst('rtStagePanelI', UNIT_SHIELD, MAT.rtStagePanel,
        mat4(sx(rBack + .12, v), DY + 5.50 - 1.3, sz(rBack + .12, v),
          ST.w / 3 * .92, 2.6, .16, ST.th));
    }

    /* THE BAND. Two performers on the platform, facing the tables (south):
       the singer at the mic in a dark dress, the guitarist beside her.
       ⚠ A bucket key carries ONE (geometry, material) pair — inst() takes both
       from the FIRST call and silently ignores the rest — so the red top and
       the dark one need different keys, and the legs cannot ride 'poleI'
       (which is MAT.dark). */
    const figure = (v, topKey, topMat, hairY) => {
      const fx = sx(ST.r + .2, v), fz = sz(ST.r + .2, v);
      inst('bandLegI', UNIT_CYL, MAT.uniform, mat4(fx, DY + .82, fz, .30, .84, .26));
      inst(topKey, UNIT_BOX, topMat, mat4(fx, DY + 1.52, fz, .44, .58, .28, ST.th));
      for (const a of [-.27, .27]) {                                                 // arms
        inst('bandArmI', UNIT_CYL, MAT.skin,
          mat4(sx(ST.r + .2, v + a), DY + 1.50, sz(ST.r + .2, v + a), .10, .52, .10));
      }
      inst('bandArmI', UNIT_CYL, MAT.skin, mat4(fx, DY + 1.92, fz, .21, .22, .21));  // head
      inst('bandHairI', UNIT_BLOB, MAT.hair, mat4(fx, hairY, fz, .27, .30, .27));
    };
    figure(-1.0, 'bandDarkI', MAT.uniform, DY + 2.02);   // the singer, dark dress
    figure(1.0, 'bandRedI', MAT.bougain, DY + 2.01);     // the guitarist, red
    // her mic on its stand, and his guitar across his body
    inst('poleI', UNIT_CYL, MAT.dark,
      mat4(sx(ST.r - .55, -1.0), DY + .90, sz(ST.r - .55, -1.0), .04, .90, .04));
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(sx(ST.r - .55, -1.0), DY + 1.40, sz(ST.r - .55, -1.0), .07, .16, .07, ST.th));
    inst('rtSlatCylI', UNIT_CYL, MAT.slat,
      mat4(sx(ST.r - .32, 1.05), DY + 1.34, sz(ST.r - .32, 1.05), .46, .10, .46));
    inst('rtSlatI', UNIT_BOX, MAT.slat,
      mat4(sx(ST.r - .32, 1.62), DY + 1.44, sz(ST.r - .32, 1.62), .80, .07, .07, ST.th));
    // two monitor wedges on the lip, and a pair of slim uplights washing the wall
    for (const u of [-1.9, 1.9]) {
      inst('darkI', UNIT_BOX, MAT.dark,
        mat4(sx(rFront + 1.0, u), DY + .62, sz(rFront + 1.0, u), .55, .3, .4, ST.th));
    }
    for (const r of [rFront + 1.4, rBack - 1.4]) {
      inst('inLightBarI', UNIT_BOX, MAT.inLight,
        mat4(sx(r, halfW + .28), DY + .52, sz(r, halfW + .28), .22, .09, 1.1, ST.th));
    }
  }

  /* the way up, and the colliders that make all of the above stand-on-able */
  buildRoofAccess(G, g, acx, acz);
  roofColliders(G, acx, acz);

  /* one cool point light over the water so the terrace has depth after dark —
     moved with the water to the pool room's own centre bearing */
  pointLight(g, Math.sin(R.poolTc) * 93.6, DY + 2.2, Math.cos(R.poolTc) * 93.6, 0, 30, 34, 0x7fe3ff);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   8c · THE WAY UP — a detached stair tower on the crescent's inland face,
   linked to the terrace by a bridge at deck level.

   The rooftop had geometry since 2026-08-02 and no way to reach it. This is the
   honest version of "a way up": nine switchback flights, 108 real treads, grade
   → 26.60 m, registered in site.js's height field as nine annular ramps and ten
   annular landings (HOTEL_ROOF.tower — read the numbers there, do not re-derive
   them here).

   WHY INLAND, on the ugly side. The concave face is the sea-facing one; a stair
   and a link bridge there would have crossed the infinity edge, in front of the
   one view this venue is for. So the tower stands 4 m off the BACK of the
   crescent, clear of the coarse collider ring (r 81…109), and the bridge lands
   on the garden band at the back of the terrace, beside the east head-house —
   you arrive behind the cabanas and the sea opens up as you walk through. That
   is also how the real building would do it.

   The cost is honest too: at grade the ring still walls off the crescent, so
   reaching the tower door means walking around the end of the arc. The Welcome
   Brunch therefore spawns on the roof. Both routes work; only one is quick.
   ════════════════════════════════════════════════════════════════════════ */
function buildRoofAccess(G, g, acx, acz) {
  const R = SITE.HOTEL.ROOFTOP, T = HOTEL_ROOF.tower;
  const DY = R.deckY;
  const TH = T.th, RM = (T.r0 + T.r1) / 2, DEEP = T.r1 - T.r0;
  const TOP = DY + 1.0;                       // parapet over the tower roof

  /* g-local point at (radius, tangential offset). g sits on the arc centre, so
     these are the same polar numbers HOTEL_ROOF.pt() answers in world space. */
  const S = Math.sin(TH), Cq = Math.cos(TH);
  const gx = (r, v = 0) => S * r + Cq * v;
  const gz = (r, v = 0) => Cq * r - S * v;

  /* ── the shaft: two side walls, a back wall with the door punched out of it,
        an inner wall that stops below the bridge, and a roof ── */
  for (const s of [-1, 1]) {
    box(g, .30, TOP, DEEP, gx(RM, s * (T.half + .15)), TOP / 2, gz(RM, s * (T.half + .15)),
      MAT.stuccoWall, TH);
  }
  box(g, T.half * 2 + .6, 25.6, .30, gx(T.r0 - .15), 12.8, gz(T.r0 - .15), MAT.stuccoWall, TH);
  // outer face: solid above the 2.4 m door, glazed slot the rest of the way up
  box(g, T.half * 2 + .6, TOP - 2.4, .30, gx(T.r1 + .15), 2.4 + (TOP - 2.4) / 2,
    gz(T.r1 + .15), MAT.stuccoWall, TH);
  box(g, 3.0, 23.0, .10, gx(T.r1 + .02), 3.0 + 11.5, gz(T.r1 + .02), MAT.glass, TH);
  box(g, T.half * 2 + 1.0, .34, DEEP + .7, gx(RM), TOP + .17, gz(RM), MAT.copper, TH);
  box(g, T.half * 2 + .9, .18, DEEP + .6, gx(RM), .09, gz(RM), MAT.stone, TH);

  /* ── the flights. 12 treads each, 9 flights, alternating sides of a spine ── */
  const nT = 12, run = T.hr - T.lr;
  const going = run / nT, rise = T.rise / nT;
  for (let k = 1; k <= T.flights; k++) {
    const A = k % 2 === 1;                    // odd flights descend in radius
    const v = A ? -1.15 : 1.15;
    const yBase = (k - 1) * T.rise;
    for (let i = 0; i < nT; i++) {
      // tread i spans going [i, i+1] from the flight's LOW end
      const rLo = A ? T.hr - i * going : T.lr + i * going;
      const rC = A ? rLo - going / 2 : rLo + going / 2;
      const y = yBase + (i + 1) * rise;
      inst('rtTreadI', UNIT_BOX, MAT.marble,
        mat4(acx + gx(rC, v), y - .07, acz + gz(rC, v), 1.7, .14, going + .02, TH));
      inst('rtRiserI', UNIT_BOX, MAT.rtSlat,
        mat4(acx + gx(A ? rLo : rLo + going, v), y - rise / 2 - .07,
          acz + gz(A ? rLo : rLo + going, v), 1.7, rise, .05, TH));
    }
    // the raking soffit, so the flight reads as a solid from underneath
    const len = Math.hypot(run, T.rise);
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.9, .20, len), MAT.stuccoWall);
    m.position.set(gx((T.lr + T.hr) / 2, v), yBase + T.rise / 2 - .28, gz((T.lr + T.hr) / 2, v));
    m.rotation.y = TH;
    m.rotateX(A ? Math.atan2(T.rise, run) : -Math.atan2(T.rise, run));
    g.add(m);
  }
  /* the central spine, floor to roof, and the ten landings */
  box(g, .28, TOP, run, gx((T.lr + T.hr) / 2), TOP / 2, gz((T.lr + T.hr) / 2), MAT.stuccoWall, TH);
  for (let k = 0; k <= T.flights; k++) {
    const lo = k % 2 === 1;                   // odd landing index = inner (low r)
    const y = k * T.rise;
    const r0 = lo ? T.r0 : T.hr, r1 = lo ? T.lr : T.r1;
    inst('rtTreadI', UNIT_BOX, MAT.marble,
      mat4(acx + gx((r0 + r1) / 2), y - .10, acz + gz((r0 + r1) / 2),
        T.half * 2, .20, r1 - r0, TH));
  }
  /* a warm glow at every third landing so the shaft reads as occupied at night */
  for (let k = 2; k <= T.flights; k += 3) {
    const lo = k % 2 === 1;
    const r = lo ? (T.r0 + T.lr) / 2 : (T.hr + T.r1) / 2;
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(acx + gx(r), k * T.rise + 2.3, acz + gz(r), 1.6, .10, .3, TH));
  }

  /* ── the link bridge ── */
  const bR0 = T.bridgeR0, bR1 = T.bridgeR1, bRM = (bR0 + bR1) / 2, bLEN = bR1 - bR0;
  box(g, 3.0, .26, bLEN, gx(bRM), DY - .13, gz(bRM), MAT.rtCoping, TH);
  box(g, 3.4, .22, bLEN - .6, gx(bRM), DY - .40, gz(bRM), MAT.rtSlat, TH);
  for (const s of [-1, 1]) {
    box(g, .05, R.parapetH, bLEN, gx(bRM, s * 1.5), DY + R.parapetH / 2, gz(bRM, s * 1.5),
      MAT.rtGlass, TH);
    box(g, .11, .11, bLEN, gx(bRM, s * 1.5), DY + R.parapetH, gz(bRM, s * 1.5), MAT.copper, TH);
  }
  /* two slim props off the green roof cap — an 8 m span needs to look carried */
  for (const r of [bR0 + 2.2, bR1 - 2.2]) {
    box(g, .26, DY - R.roofY - .4, .26, gx(r), (R.roofY + DY - .4) / 2, gz(r), MAT.stone, TH);
  }
  pointLight(g, gx(bRM), DY + 2.0, gz(bRM), 0, 14, 16);
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   8d · ROOFTOP COLLIDERS — every one of them y-ranged.
   Nothing up here existed as a collider before, because nothing up here could
   be reached. Now that it can, the terrace needs the same treatment as any
   room: guarded edges, solid furniture, and a pool you can get out of.

   `ROOF` = active only for feet at or above 26.0, i.e. only for someone
   standing on the terrace. Push any of these without a y-range and you plant an
   invisible wall in the middle of the resort at grade, 285 m east of the
   campus, where the fly-in path runs.
   ════════════════════════════════════════════════════════════════════════ */
function roofColliders(G, acx, acz) {
  const R = SITE.HOTEL.ROOFTOP, T = HOTEL_ROOF.tower, L = G.colliders;
  const C = Math.PI / 2, DY = R.deckY;
  const a0 = C - R.arcHalf, a1 = C + R.arcHalf;
  /* ⚠ two rooms: the water is (poolTc ± poolTh), the SOUTH half — matching
     both buildHotelRoof() and the height field site.js registers. Key a pool
     chain to the old full band and you wall the bar room off — or worse,
     leave 90 m of painted water with a deck-height floor under it. */
  const p0 = R.poolTc - R.poolTh, p1 = R.poolTc + R.poolTh;
  const ROOF = { y0: DY - .6 };                 // only for people on the terrace
  const SWIM = { y1: DY - .2 };                 // only for people IN the water
  const WX = (th, r) => acx + Math.sin(th) * r;
  const WZ = (th, r) => acz + Math.cos(th) * r;
  const arc = (rad, t0, t1, r, yr) => colliderArc(L, acx, acz, rad, t0, t1, r, yr);
  const radial = (th, r0, r1, r, yr) =>
    colliderLine(L, WX(th, r0), WZ(th, r0), WX(th, r1), WZ(th, r1), r, yr);

  /* ── the edges. Circles sit BEHIND each rail so the player can walk up to the
        glass instead of being held a metre back by their own radius.
        ⚠ 2026-08-02: the inner run is BROKEN over the pool, because the rail
        is. Along the water the infinity edge below is the guard, and it blocks
        at every height rather than only from the deck.
        The outer run moved 104.0 → 103.45 so it stops the walker's CENTRE at
        r 102.40 and their 0.35 m cylinder at 102.75, clear of the lattice
        screen's face at 102.82. At 104.0 the cylinder reached 103.30, i.e.
        straight through the new screen. ── */
  for (const [s, e] of [[a0, p0], [p1, a1]]) arc(89.2, s, e, .70, ROOF);
  arc(103.45, a0, T.th - T.bridgeTh - .01, .70, ROOF);   // outer rail, west run
  arc(103.45, T.th + T.bridgeTh + .01, a1, .70, ROOF);   // outer rail, east run
  radial(a0 - .004, R.rIn, R.rOut, .55, ROOF);           // the two glazed ends
  radial(a1 + .004, R.rIn, R.rOut, .55, ROOF);

  /* ── the pool. The INFINITY EDGE blocks at every height: from the deck side
        it is a 0.55 m ledge you must not be nudged over, and from the water it
        is now a 26 m drop straight off the building. The back wall and the two
        ends block only for a SWIMMER, so a guest on the deck can still step
        into the water — and a swimmer leaves the way they would in life, up the
        submerged steps at either end (registered in site.js, and the only break
        in this ring).
        ⚠ THE ARITHMETIC IS THE OTHER WAY ROUND to every other chain up here.
        Everything else on this terrace is approached from OUTSIDE the pool, but
        this ring is approached from OUTSIDE ITS OWN RADIUS, so what it holds a
        walker at is `rad + r + PLAYER_R`, not `rad − r − PLAYER_R`. It is set
        so that boundary is 90.55: the walker's own 0.35 m cylinder then reaches
        90.20, which is the lip at 90.10 plus a hair — you can stand at the
        infinity edge and look over it, which is the entire point of the venue.
        (Getting this backwards on the first pass parked everyone 1.6 m out in
        the water, staring at their own pool.)
        Fat circles on purpose: r 0.85 at a 0.765 m step closes the same 65 m of
        arc in 85 circles where the old r 0.25 chain took 293. */
  arc(89.35, p0, p1, .85);                               // the infinity edge
  arc(96.75, p0, p1, .28, SWIM);                         // the back wall
  radial(p0 - .006, R.poolIn, R.poolOut, .28, SWIM);
  radial(p1 + .006, R.poolIn, R.poolOut, .28, SWIM);

  /* ── the furniture, all ROOF-only ── */
  /* the daybed row — daybedRow(R), the SAME list buildHotelRoof() stands the
     beds on, so a bed and its collider can never disagree. Two circles per
     bed, at the ends of its 3.3 m platform. */
  for (const th of daybedRow(R)) {
    for (const v of [-.9, .9]) {
      const tt = th + v / R.gardenR;
      L.push({ x: WX(tt, R.gardenR), z: WZ(tt, R.gardenR), r: 1.05, ...ROOF });
    }
  }
  for (const s of [-1, 1]) {                                                // head-houses
    const th = C + s * R.coreArcHalf;
    for (const d of [-1.6, 0, 1.6]) {
      const tt = th + d / 101.2;
      L.push({ x: WX(tt, 101.2), z: WZ(tt, 101.2), r: 1.9, ...ROOF });
    }
  }
  /* (the 26 planters at r 102.5 are gone with their geometry — see the note in
     buildHotelRoof. The outer rail chain above now guards that band on its
     own, and the daybeds' pots sit inside the daybed footprint.) */
  /* loungers — the SAME row buildHotelRoof() builds, from the same helper, so
     a lounger and its collider can never disagree (they each held a literal 16
     and a literal ±0.335 before the terrace's arc became derived) */
  for (const th of loungerRow(R).th) {
    L.push({ x: WX(th, R.loungeR), z: WZ(th, R.loungeR), r: .85, ...ROOF });
  }

  /* ── THE EIGHT BRUNCH FOUR-TOPS — PERMANENT, in all six moments ──────────
     They are built unconditionally by buildHotelRoof() from
     HOTEL_ROOF.brunchTables, but until 2026-08-06 the only circles around them
     were the ones moments.js pushes into `cols.brunch` — so in the other five
     moments the marble tops, their pedestals and thirty-two chairs were
     furniture you walked straight through. Same class of bug as the daybeds
     and loungers above, which is exactly why those two are rung from HERE.

     ⚠ REGISTERED DURING buildWorld, and it has to be: initMoments() snapshots
     G.colliders as the world statics and setMoment() rebuilds the list as
     statics + the live moment's props, so a ring pushed after init is deleted
     by the first moment switch.

     ⚠ THE BRUNCH IS RUNG TWICE AND THAT IS DELIBERATE. moments.js is not this
     pass's file, so its per-table circle stays; these are authored to be the
     SAME CIRCLE — same centre (the same published list), same TABLE_R, same
     ROOF window — so during the Welcome Brunch the two coincide exactly and
     the union is the set that moment already had. A walker pushed out to
     `TABLE_R + PLAYER_R` by one is already outside the other, so nothing
     narrows: the 0.56 m corridor between two settings that the 2026-08-04
     rooftop pass measured is untouched. Do NOT "improve" this by making the
     permanent ring bigger than moments.js's — a fatter twin is the over-ring
     that made the brunch room unwalkable once before. */
  for (const t of HOTEL_ROOF.brunchTables) {
    L.push({ x: WX(t.th, t.r), z: WZ(t.th, t.r), r: TABLE_R, ...ROOF });
  }

  /* ── THE BAR ZONE + THE DINING TERRACE — every solid from the SAME
        barLayout(R) the builder reads. All ROOF-ranged: an unranged circle
        here is an invisible wall at grade where the fly-in path runs.
        The volume chain is FAT circles at r 101.6: they close the whole band
        from ~99.15 out past the outer rail, which is the volume AND the
        back-bar's working aisle behind the counter — nobody walks there. Every
        chain stops at its own list's ends, so the stair bridge's landing and
        the head-house both stay open; the bridge gap is the way IN. ── */
  const BL = barLayout(R);
  for (const [s, e] of BL.segs) arc(101.6, s + .010, e - .010, 2.1, ROOF);
  /* the counter with its stools — stricter than the geometry, which reaches
     97.59 (a stool cushion) to 99.17 (the stone top's guest-side overhang) */
  arc(98.45, BL.counter.tc - BL.counter.halfTh,
    BL.counter.tc + BL.counter.halfTh, 1.05, ROOF);
  L.push({ x: WX(BL.canopy.th, BL.canopy.r), z: WZ(BL.canopy.th, BL.canopy.r),
    r: .95, ...ROOF });                                       // the canopy column
  for (const Lg of BL.lounge) {                               // the lounge groups
    for (const v of [-1.25, 0, 1.25]) {
      const tt = Lg.th + v / Lg.r;
      L.push({ x: WX(tt, Lg.r), z: WZ(tt, Lg.r), r: .85, ...ROOF });
    }
  }
  /* the stage: the platform is 0.42 m, past CFG.STEP_UP, so it is a solid and
     not a surface — the chain is stricter than its 97.3…102.7 footprint. The
     living wall is a RADIAL wall on its north flank. */
  arc(BL.stage.r, BL.stage.th - BL.stage.halfTang + .006,
    BL.stage.th + BL.stage.halfTang - .006, 2.80, ROOF);
  radial(BL.stage.th + (BL.stage.w / 2 + .55) / BL.stage.r,
    BL.stage.r - BL.stage.d / 2, BL.stage.r + BL.stage.d / 2, .35, ROOF);
  for (const LT of BL.longTables) {                           // long communal tables
    arc(LT.r, LT.th - LT.halfTh, LT.th + LT.halfTh, 1.35, ROOF);
  }
  for (const t of BL.tables) {                                // round / square tables
    L.push({ x: WX(t.th, t.r), z: WZ(t.th, t.r), r: TABLE_R, ...ROOF });
  }
  for (const b of BL.beds) {                                  // planting beds
    L.push({ x: WX(b.th, b.r), z: WZ(b.th, b.r), r: 1.0, ...ROOF });
  }

  /* ── the stair tower. Side walls at every height; the inner wall only BELOW
        the bridge, the outer wall only ABOVE the ground-floor door. ── */
  const tv = v => v / ((T.r0 + T.r1) / 2);
  for (const s of [-1, 1]) {
    colliderLine(L, WX(T.th + s * tv(T.half + .1), T.r0), WZ(T.th + s * tv(T.half + .1), T.r0),
      WX(T.th + s * tv(T.half + .1), T.r1), WZ(T.th + s * tv(T.half + .1), T.r1), .30);
  }
  const tang = (rad, r, yr) => colliderLine(L,
    WX(T.th - tv(T.half + .3), rad), WZ(T.th - tv(T.half + .3), rad),
    WX(T.th + tv(T.half + .3), rad), WZ(T.th + tv(T.half + .3), rad), r, yr);
  tang(T.r0 - .16, .28, { y1: DY - .6 });   // inner wall — open only at the bridge
  tang(T.r1 + .16, .28, { y0: 2.4 });       // outer wall — open only at the door
  // the spine between the two flights — falling across it is a two-storey drop
  colliderLine(L, WX(T.th, T.lr), WZ(T.th, T.lr), WX(T.th, T.hr), WZ(T.th, T.hr), .16);
}

/* ════════════════════════════════════════════════════════════════════════
   A PARKED CAR — one place, both car parks (2026-08-04, Carl: *"the cars at
   the parking lots looks very low quality"*).

   Both the north apron and the arrival court used to stand three boxes each —
   a body slab, a glass slab and a dark underbody — which reads as a crate the
   moment you are within thirty metres of it, and the arrival court is now
   somewhere guests actually walk.

   It is still instanced and still cheap: fifteen parts per car, every one on a
   bucket that already existed, so sixteen cars cost ZERO extra draw calls.

   ⚠ Two things worth knowing before editing this:
   · **Per-instance tints must ride a WHITE-based material.** `MAT.car` is the
     tintable one (that is why the lights and the body share it); `MAT.dark`'s
     base crushes any tint to black, which is why the tyres and bumpers take it
     un-tinted and the tail lamps do not.
   · **`mat4`'s 8th/9th arguments are rx/rz** on a 'YXZ' Euler, so the wheels
     are `rz = π/2` — that lays the unit cylinder's axis along the car's own X
     BEFORE the yaw is applied, which is what makes an axle an axle. Scale is
     applied before rotation, so `sy` is the tyre's WIDTH, not its height.
   ════════════════════════════════════════════════════════════════════════ */
const CAR_PALETTE = [0x1c1f24, 0xd8d9dc, 0x8d9299, 0x2a3a52, 0x6d1f22, 0xe4e2dc, 0x3c4046];
const _carCol = new THREE.Color();
const CAR_RIM = new THREE.Color(0xb4b9bf);
const haveCar = () => have('parked_car') && have('parked_car_glass')
  && have('parked_car_trim') && have('parked_car_rims');
function parkedCar(cx, cz, yaw, hex, baseY = 0) {
  /* local (lx, lz) → world, for a body yawed by `yaw`: local +X is
     (cos, 0, −sin) and local +Z is (sin, 0, cos) — the same basis every
     rotated prop on this campus uses. */
  const S = Math.sin(yaw), C = Math.cos(yaw);
  const PX = (lx, lz) => cx + lx * C + lz * S;
  const PZ = (lx, lz) => cz - lx * S + lz * C;
  const body = _carCol.setHex(hex).clone();
  /* the roof and pillars are the body colour a touch darker, so the greenhouse
     reads as a separate volume even on a white car */
  const roof = _carCol.setHex(hex).multiplyScalar(.86).clone();
  const put = (key, mat, lx, y, lz, sx, sy, sz, col = null, rz = 0) =>
    inst(key, key === 'carWheelI' ? UNIT_CYL : UNIT_BOX, mat,
      mat4(PX(lx, lz), baseY + y, PZ(lx, lz), sx, sy, sz, yaw, 0, rz), col);

  /* ── KAN-208 wave 3: the Blender saloon, GEOMETRY ONLY ────────────────────
     Four GLBs in ONE frame (ASSET_SPEC Group I, generators/parked_car.py),
     each on the campus material it replaces, so no program is added and the
     per-instance body tint rides MAT.car exactly as before. Front is local +Z,
     which is the chair-family exception the old boxes already used. The lamps
     ride the rims GLB (silver) and the tail lamps stay our own carI boxes. Draws NO rnd() — the caller drew the colour. */
  if (haveCar()) {
    const m = mat4(cx, baseY, cz, 1, 1, 1, yaw);
    inst('carBodyGlbI', models.geometry('parked_car'), MAT.car, m, body);
    inst('carGlassGlbI', models.geometry('parked_car_glass'), MAT.carGlass, m);
    inst('carTrimGlbI', models.geometry('parked_car_trim'), MAT.dark, m);
    inst('carRimGlbI', models.geometry('parked_car_rims'), MAT.car, m, CAR_RIM);
    /* the head-lamp lenses are IN parked_car_rims: a separate instance 2.2 m
       ahead of the centre crosses world.js's per-instance isEnclaveLocal line
       (z −77.4) on the north apron and gets rotated onto the lawn — which is
       what the old boxes' bonnets, A-pillars and head lamps were doing. The
       tail lamps sit behind the centre, on the world side of that line. */
    for (const lx of [.58, -.58]) {
      put('carI', MAT.car, lx, .87, -2.165, .36, .10, .06,
        _carCol.setHex(0x8c1f18).clone());                          // tail lamps
    }
    return;
  }
  // four wheels on two axles
  for (const lz of [1.34, -1.34]) for (const lx of [.80, -.80]) {
    put('carWheelI', MAT.dark, lx, .33, lz, .66, .24, .66, null, Math.PI / 2);
  }
  put('carI', MAT.car, 0, .70, 0, 1.80, .56, 4.38, body);        // lower body
  put('darkI', MAT.dark, 0, .47, 0, 1.86, .18, 4.16);            // sill shadow
  put('carI', MAT.car, 0, 1.02, 1.36, 1.70, .20, 1.28, body);    // bonnet
  put('carI', MAT.car, 0, 1.02, -1.62, 1.70, .20, 1.02, body);   // boot lid
  put('carGlassI', MAT.carGlass, 0, 1.26, -.08, 1.60, .50, 2.28); // the greenhouse
  put('carI', MAT.car, 0, 1.54, -.08, 1.52, .10, 2.02, roof);    // roof panel
  for (const lx of [.74, -.74]) for (const lz of [1.02, -1.16]) {
    put('carI', MAT.car, lx, 1.26, lz, .10, .52, .16, roof);     // A/C pillars
  }
  put('darkI', MAT.dark, 0, .62, 2.14, 1.82, .28, .22);          // front bumper
  put('darkI', MAT.dark, 0, .62, -2.14, 1.82, .28, .22);         // rear bumper
  for (const lx of [.60, -.60]) {
    put('carI', MAT.car, lx, .92, 2.16, .36, .15, .10, WHITE);   // head lamps
    put('carI', MAT.car, lx, .99, -2.16, .32, .13, .09,
      _carCol.setHex(0x8c1f18).clone());                          // tail lamps
  }
  for (const lx of [.98, -.98]) put('darkI', MAT.dark, lx, 1.18, .78, .17, .11, .10); // mirrors
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

  /* ── the arrival spur and its forecourt ────────────────────────────────────
     ⚠ REROUTED 2026-08-02 (the proportion pass). It used to run out to a
     drop-off circle at (40, −46) that served the clubhouse; the enclave moved
     away in 2026-08-01's fourth pass and the spur has been ending on bare grass
     ever since (it was in CLAUDE.md's polish backlog as "the arrival drive spur
     is orphaned"). This pass moved the enclave 40 m further south again, and it
     also put the lazy river straight across the ground between the road and the
     clubhouse, so "just extend it" is not available: a drive to the front door
     would now need a vehicular bridge over the water.
     The honest resort answer, and the one the site map shows, is that guests
     are dropped at an arrival forecourt inland and walk in. So the spur ends at
     a forecourt beside the existing parking apron — the drive, the car park and
     the head of the resort's spine walk in one place — instead of in a field.  */
  const FC = { x: 34, z: -62 };
  const spur = [
    { x: 4, y: .05, z: RZ + 3 }, { x: 12, y: .05, z: -84 }, { x: 21, y: .05, z: -76 },
    { x: 29, y: .05, z: -69 }, { x: FC.x, y: .05, z: FC.z + 2 }, { x: FC.x, y: .05, z: FC.z },
  ];
  g.add(new THREE.Mesh(ribbon(spur, 3.6, 6), MAT.asphalt));
  const circle = new THREE.Mesh(new THREE.CircleGeometry(6.2, 40), MAT.paver);
  circle.rotation.x = -Math.PI / 2; circle.position.set(FC.x, .06, FC.z); g.add(circle);
  const island = new THREE.Mesh(new THREE.CircleGeometry(2.4, 28), MAT.turf);
  island.rotation.x = -Math.PI / 2; island.position.set(FC.x, .16, FC.z); g.add(island);
  box(g, 5.2, .22, 5.2, FC.x, .08, FC.z, MAT.stone);
  inst('hedgeBlobI', UNIT_BLOB, MAT.hedge, mat4(FC.x, .95, FC.z, 3.2, 1.7, 3.2));

  /* parking apron + parked cars, tucked against the road's campus side
     (east of the drive spur, clear of the lawn) */
  const px = 60, pz = -78;
  slab(g, 44, 9, px, .05, pz, MAT.park);
  for (let i = 0; i < 12; i++) {
    const cx = px - 20 + i * 3.6 + (rnd() - .5) * .25;
    const cz = pz + (rnd() - .5) * .5;
    const ry = (rnd() - .5) * .06;
    parkedCar(cx, cz, ry, CAR_PALETTE[Math.floor(rnd() * CAR_PALETTE.length)]);
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
  if (!MAT) return;
  /* rooftop pool: drift the baked caustic web across the basin. Two texture
     offsets a frame is the entire per-frame cost of that pool — the crescent
     is 285 m out and must never buy a reflection pass (water.js owns the one
     pool that does). */
  const rm = MAT.rtBasin.map;
  if (rm) { rm.offset.x = clock * .006; rm.offset.y = clock * .010; }
  if (!night) return;
  const f = 1 + Math.sin(clock * 1.6) * .035 + Math.sin(clock * 3.7 + 1.1) * .02;
  MAT.loungeGlow.emissiveIntensity = 2.3 * f;
  MAT.glass.emissiveIntensity = 1.05 * (1 + Math.sin(clock * .8 + .5) * .04);
  MAT.hotelFacade.emissiveIntensity = 1.35 * (1 + Math.sin(clock * .55) * .05);
  MAT.sign.emissiveIntensity = 1.55 * (1 + Math.sin(clock * 2.3 + .4) * .025);
  /* the rooftop water breathes a little slower than the resort's warm glow */
  MAT.rtWater.emissiveIntensity = .95 * (1 + Math.sin(clock * .7 + 2.1) * .07);
  MAT.rtSpill.emissiveIntensity = 1.25 * (1 + Math.sin(clock * 1.3) * .09);
  /* the bar volume's caustic wash shimmers — INTENSITY only. The texture
     offsets stay still on purpose: a material has one uv transform and the
     colour map owns it, so scrolling the emissiveMap would do nothing. */
  MAT.rtBarPanel.emissiveIntensity =
    1.8 * (1 + Math.sin(clock * 1.15 + .7) * .10 + Math.sin(clock * 2.6) * .05);
}

/* ── keep the campus's PLANTING off a new footprint ─────────────────────────
   Two builders scatter greenery after this one and NEITHER consults
   G.colliders, which is the only thing a structure's colliders can influence:
     · nature.js's understory + ground cover dart-throw against its own
       exclusionZones() alone — the arrival's SHRUB cull and world.js's
       cullUnderstoryInsideEnclave() both exist for exactly this;
     · water.js's buildRiverDressing() rings EVERY basin with
       `round(rm × 2.4)` shrub clumps set 0.8…5.0 m outside its deck — 42 of
       them around SITE.LAGOON alone. That one is not obvious from nature.js,
       and it is what actually buried the swim-up bar: two ~3 m masses stood
       against its landward face and filled the frame from the deck.
   So the sweep covers BOTH owners' groups. Same one-shot scale-to-zero as the
   two existing culls, and the same two rules: palm buckets are
   DynamicDrawUsage (the sway ticker rewrites their matrices every frame, so
   anything written here is gone by the next one) and the translation is kept
   so nothing re-indexes. Instance positions are taken through matrixWorld —
   the river group and the enclave's `nature:enclave` group are not at the
   origin, and testing raw instance translations would miss in both. */
const _cull_m = new THREE.Matrix4(), _cull_p = new THREE.Vector3(),
  _cull_z = new THREE.Vector3(0, 0, 0);

function cullPlantingAt(G, hit) {
  let done = false;
  (G.tickers ||= []).push(() => {
    if (done) return;
    const roots = [G.groups && G.groups.nature, G.groups && G.groups.water].filter(Boolean);
    if (!roots.length) return;
    done = true;
    for (const root of roots) {
      root.updateMatrixWorld(true);
      root.traverse(o => {
        if (!o.isInstancedMesh) return;
        if (o.instanceMatrix.usage === THREE.DynamicDrawUsage) return;   // palms
        let touched = 0;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _cull_m);
          _cull_p.setFromMatrixPosition(_cull_m).applyMatrix4(o.matrixWorld);
          if (!hit(_cull_p.x, _cull_p.z)) continue;
          _cull_m.scale(_cull_z);
          o.setMatrixAt(i, _cull_m);
          touched++;
        }
        if (touched) o.instanceMatrix.needsUpdate = true;
      });
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════
   11 · THE OPEN PAVILION AT THE SECOND POOL
   ════════════════════════════════════════════════════════════════════════
   Reference: reference/photos/3br-pool-area-view.jpg — shot from a 3-BR
   terrace, over that key's clipped hedge. Beyond the hedge it reads, near to
   far: a shallow curved reflecting pool · a timber deck · the rectangular
   swimming pool · clipped hedge blocks — and standing BETWEEN THE WATERS, an
   OPEN PAVILION: a flat roof on slender dark columns, open on all four sides,
   on a LOW plinth, with the clubhouse behind it. CLAUDE.md's "CARL'S
   DECISIONS — 2026-08-04 §3" names that pavilion as the queued work; this is
   it. (The white curved tower on the photo's horizon is the Regent, and is
   background — deliberately not modelled.)

   ⚠ WHAT THIS IS NOT. `SITE.LOUNGE_POOL` is a HISTORICAL NAME: the standalone
   酒廊 was demolished 2026-08-04 and that water now serves the 3-BR keys and
   the dinner lawns. Nothing here is lounge-named and nothing here is a lounge.

   ── FRAME CHOICE: ENCLAVE-LOCAL, VIA inst() ONLY ────────────────────────────
   Deliberate, and it is the same call `buildGrassGround()` makes for the same
   reason. world.js re-parents campus.js content into the rotated enclave two
   ways: named groups listed in its CAMPUS_ENCLAVE_GROUPS literal (`pergola`,
   `sign`, `extstair`), and per-INSTANCE through isEnclaveLocal(). This pass
   does not own world.js, so a NEW named group would not be in that Set and the
   whole pavilion would stand 90° around the map at raw local coordinates,
   silently. So: EVERY part of this pavilion is an inst() instance, there is no
   group, and every instance position satisfies isEnclaveLocal() (local x
   −63…−49 < 84, local z −16…−4 > −80). Its colliders are pushed enclave-local
   and world.js's collider rewrite maps them through enclaveToWorld().
   Corollary, same as the grass ground: no THREE.PointLight out here — a light
   needs a parent group — so the soffit downlights are emissive instances.

   ── POSITION, DERIVED ───────────────────────────────────────────────────────
   On the pool's long centre-line (`LP.cx`), off its NORTH end, separated from
   the pool's stone apron by a timber deck. That end is where a guest walking
   down from the 3-BR keys arrives, and it is the one flank of the pool with
   open ground: the apron's east edge is the 2.5 m dinner clearance (below),
   the west is the palm belt and the south is the walk to the grand lawn.

   ⚠ THE 2.5 m CLEARANCE IS LOAD-BEARING and nothing here may enter it.
   water.js's buildLoungePool() lays the pool's stone apron at cx ± w/2 ± 4.5
   and cz − d/2 − 5.0 … cz + d/2 + 4.0; against SITE.LOUNGE_POOL that puts its
   east edge at local x −41.5, exactly 2.5 m short of DINNER_LAWNS[1].x0
   (−39) — a measured clearance from the 2026-08-02 pass, re-verified
   2026-08-04. Those four offsets are water.js's; they are mirrored here (not
   re-typed from a screenshot) because the apron's north lip is this pavilion's
   own datum, and site.js — where they would otherwise be published once — is
   not this pass's to edit. If they ever move in water.js, move them here.
   The pavilion's own east edge lands ~11 m west of the lawn, so the clearance
   is untouched by construction as well as by measurement. */
const SP_APRON_W = 4.5;      // water.js buildLoungePool: apron, pool's ±X
const SP_APRON_N = 5.0;      // …its north lip
const SP_APRON_S = 4.0;      // …its south lip
const SP_DECK_RUN = 3.2;     // timber deck between the apron's north lip and
                             // the pavilion's plinth — the photo's boardwalk

function buildSecondPoolPavilion(G) {
  const LP = SITE.LOUNGE_POOL, DL = SITE.DINNER_LAWNS[1];
  const rnd = mulberry32((CFG.SEED ^ 0x2b00) >>> 0);

  /* the second pool's stone apron, re-derived from the published footprint */
  const APRON = {
    x0: LP.cx - LP.w / 2 - SP_APRON_W, x1: LP.cx + LP.w / 2 + SP_APRON_W,
    z0: LP.cz - LP.d / 2 - SP_APRON_N, z1: LP.cz + LP.d / 2 + SP_APRON_S,
  };
  /* the clearance this builder must not eat. Asserted, not assumed — if a
     future move of either footprint closes it, the console says so on boot. */
  const DINNER_GAP = DL.x0 - APRON.x1;
  if (DINNER_GAP < 2.49) {
    console.warn('[campus] second pool apron → outer dinner lawn is only '
      + DINNER_GAP.toFixed(2) + ' m (2.5 expected)');
  }

  const PV = {
    w: 11.0, d: 7.0,                    // 77 ㎡ of open floor
    cx: LP.cx,                          // dead on the pool's long centre-line
    cz: APRON.z0 - SP_DECK_RUN - 7.0 / 2,
    plY: .16,                           // ⚠ LOW on purpose — see below
    colH: 3.05, colT: .17,
    eave: .55, roofT: .26,
  };
  const hx = PV.w / 2, hz = PV.d / 2;
  const roofY = PV.plY + PV.colH;       // underside of the roof slab

  /* ⚠ THE PLINTH IS 0.16 m AND THAT IS A CONSTRAINT, NOT A TASTE. A raised
     floor you can stand on has to be a WALK_REGION, and the registry lives in
     site.js, which this pass does not own. At 0.16 m the plinth reads as a base
     in silhouette (the reference's is low too) while a walker crossing it — who
     stays at floorY 0.000, because nothing here registers a surface — is barely
     a boot-sole out. Give this a real 0.30 m podium only in the same pass that
     registers `second-pool-pavilion` in WALK_REGIONS. */
  inst('spBlackI', UNIT_BOX, MAT.blackPolish,
    mat4(PV.cx, PV.plY / 2, PV.cz, PV.w + 1.0, PV.plY, PV.d + 1.0));
  inst('spStoneI', UNIT_PLANE, MAT.stone,
    mat4(PV.cx, PV.plY + .004, PV.cz, PV.w + .84, 1, PV.d + .84));
  /* a 60 mm outer step, so the plinth is two courses rather than one kerb */
  inst('spBlackI', UNIT_BOX, MAT.blackPolish,
    mat4(PV.cx, .03, PV.cz, PV.w + 2.4, .06, PV.d + 2.4));

  /* ── the timber deck: plinth → the pool's apron. The photo's middle band. ── */
  const dz0 = PV.cz + hz + .5, dz1 = APRON.z0;
  inst('spDeckI', UNIT_PLANE, MAT.deck,
    mat4(PV.cx, .05, (dz0 + dz1) / 2, PV.w + 2.0, 1, dz1 - dz0));
  /* board joints — six shadow lines across the run, so 13 m of deck is not one
     flat plane from the drone orbit */
  for (let i = 1; i < 7; i++) {
    inst('spDarkI', UNIT_BOX, MAT.dark,
      mat4(PV.cx, .054, dz0 + (dz1 - dz0) * i / 7, PV.w + 2.0, .012, .05));
  }

  /* ── the columns: SLENDER, dark, open on all four sides ──
     ⚠ FOUR per long run, and the count is EVEN on purpose. The first layout
     ran five a side plus a mid-column on each short end, which put a column
     dead on the centre-line of all four faces — and the walk test found it
     immediately: a walker aimed at the middle of a face stopped 0.57 m out
     (collider .22 + CFG.PLAYER_R .35) and covered 3.9 m of a 15.2 m crossing.
     An open pavilion has to be enterable head-on, so every face now has a
     clear centre bay: 3.43 m between columns on the long runs, and the 7 m
     short ends span corner to corner with no intermediate post. */
  const cols = [];
  for (let i = 0; i < 4; i++) {
    const x = PV.cx + (i / 3 - .5) * (PV.w - .7);
    for (const s of [-1, 1]) cols.push([x, PV.cz + s * (hz - .35)]);
  }
  for (const [x, z] of cols) {
    inst('spColI', UNIT_BOX, MAT.dark,
      mat4(x, PV.plY + PV.colH / 2, z, PV.colT, PV.colH, PV.colT));
    /* stricter than the geometry, per the house rule — you walk BETWEEN them */
    G.colliders.push({ x, z, r: .22 });
  }

  /* ── the flat roof: slab, copper fascia, warm timber soffit, slat ceiling ── */
  const rw = PV.w + PV.eave * 2, rd = PV.d + PV.eave * 2;
  inst('spSoffitI', UNIT_BOX, MAT.warmSoffit,
    mat4(PV.cx, roofY + .07, PV.cz, rw - .18, .14, rd - .18));
  for (let i = 0; i < 16; i++) {                   // the soffit's slat rhythm
    inst('spSlatI', UNIT_BOX, MAT.slatWarm,
      mat4(PV.cx, roofY + .015, PV.cz + (i / 15 - .5) * (rd - .9),
        rw - .5, .04, .16));
  }
  /* the copper fascia. y 3.33…3.45 against the soffit's 3.21…3.35 — a 20 mm
     OVERLAP, not a shared plane: the first version put its underside exactly on
     the soffit's top face and that is the coplanar pair this file's own rule
     forbids (invisible here only because both faces are back-to-back inside the
     stack, which is luck, not design). */
  inst('spCopperI', UNIT_BOX, MAT.copper,
    mat4(PV.cx, roofY + .18, PV.cz, rw + .08, .12, rd + .08));
  inst('spRoofI', UNIT_BOX, MAT.roof,
    mat4(PV.cx, roofY + .14 + PV.roofT / 2, PV.cz, rw, PV.roofT, rd));

  /* soffit downlights — emissive instances, ZERO new point lights (see the
     frame note above: out here a light would need a parent group) */
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      inst('spDownI', UNIT_BOX, MAT.arrDown,
        mat4(PV.cx + (i / 3 - .5) * (PV.w - 2.2), roofY - .005,
          PV.cz + s * (hz - 1.1), .3, .03, .3));
    }
  }

  /* ── two low timber benches, in the end bays and pushed 1.9 m OFF the short
        axis, so all four centre bays stay walkable (same lesson as the column
        count above — the walk test caught a bench sitting in the end doorway,
        4.1 m of an 18.8 m crossing). ── */
  for (const s of [-1, 1]) {
    const bx = PV.cx + s * (hx - 1.05), bz = PV.cz - 1.9;
    /* KAN-211 wave E: the same `garden_bench` GLB as the lawn's, turned π/2
       and scaled to this seat's own envelope (2.6 long × .62 deep, top at
       plY + .455); the colliders below are untouched */
    if (have('garden_bench')) {
      modelI('spBenchGlbI', 'garden_bench',
        mat4(bx, PV.plY, bz, 2.6 / 1.9, .455 / .475, .62 / .5, Math.PI / 2));
    } else {
      inst('spSlatI', UNIT_BOX, MAT.slatWarm, mat4(bx, PV.plY + .40, bz, .62, .11, 2.6));
      for (const t of [-1, 1]) {
        inst('spDarkI', UNIT_BOX, MAT.dark,
          mat4(bx, PV.plY + .19, bz + t * 1.02, .5, .38, .12));
      }
    }
    G.colliders.push({ x: bx, z: bz, r: .5 });
    G.colliders.push({ x: bx, z: bz + 1.0, r: .45 });
    G.colliders.push({ x: bx, z: bz - 1.0, r: .45 });
  }

  /* ── clipped hedge blocks + topiary: the photo has them THROUGHOUT, and they
        are what stops the pavilion reading as a table on a lawn.

     ⚠ EVERY RUN LEAVES ITS CENTRE-LINE OPEN, and that is not decoration. The
     first layout put a flank block on each short end's centre-line and an
     unbroken five-block run across the back, and the walk test caught it at
     once: the pavilion was enclosed on three sides and a walker approaching
     the local −Z face was held 0.9 m out and moved 0.00 m in six bursts — an
     "open pavilion" you cannot walk into. Both runs now break for the axis
     they straddle, so all four faces are enterable. This is the walk-don't-
     render rule in miniature: it rendered perfectly the whole time. ── */
  const hedge = (x, z, w, h, d) => {
    inst('spHedgeI', UNIT_BOX, MAT.hedge, mat4(x, h / 2, z, w, h, d));
    G.colliders.push({ x, z, r: Math.max(w, d) * .42 });
  };
  for (const s of [-1, 1]) {                       // flanks: clear of z = PV.cz
    for (const t of [-1, 1]) {
      hedge(PV.cx + s * (hx + 2.9), PV.cz + t * 3.15,
        1.5 + rnd() * .3, .85 + rnd() * .22, 2.4);
    }
  }
  /* the back run, with a 3.5 m gap on the centre-line for the way in from the
     clubhouse side; the clubhouse reads over the top of it */
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      hedge(PV.cx + s * (1.75 + 1.25 + i * 2.4), PV.cz - hz - 2.6,
        2.2, .78 + rnd() * .16, 1.15);
    }
  }
  /* rounded topiary punctuation — NO colliders, deliberately: they stand in
     the 1.5 m lap lane beside the plinth, where a collider would pinch the
     route the hedges were just opened for. They are knee-to-waist high. */
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    inst('spTopiaryI', UNIT_BLOB, MAT.hedge,
      mat4(PV.cx + s * (hx + 1.5), .62 + rnd() * .1, PV.cz + t * 2.6,
        1.25, 1.35, 1.25, rnd() * 3));
  }

  /* the pavilion's floor and its boardwalk, cleared of nature's understory —
     the footprint is stated in ENCLAVE-LOCAL coordinates and the query point
     is mapped, exactly like siteFloorY does it */
  cullPlantingAt(G, (wx, wz) => {
    const l = worldToEnclave(wx, wz);
    return l.x > PV.cx - hx - 1.4 && l.x < PV.cx + hx + 1.4
      && l.z > PV.cz - hz - 1.4 && l.z < APRON.z0;
  });
}

/* ════════════════════════════════════════════════════════════════════════
   12 · THE SWIM-UP BAR at the resort's lagoon
   ════════════════════════════════════════════════════════════════════════
   References: reference/photos/resort-swim-up-bar.webp and §2g of
   reference/resort-pool-complex-brief.md. What that photo shows: a timber bar
   standing partly IN the water — a flat SLATTED canopy over a ~2 m back wall
   of BOTTLE SHELVING, a service counter at water level, a row of SUBMERGED
   STOOLS in front of it, "POO[L] BAR" lettering across the counter front, and
   a big white bowl planter (~1 m) on a curved white wall above, overflowing
   with pink bougainvillea. Carl called this one out specifically.

   ── FRAME CHOICE: WORLD SPACE, AND IT MUST NOT BE CAPTURED ──────────────────
   The mirror image of the pavilion above, and the trap runs the other way.
   world.js's adoptCampus() re-parents a campus root child ONLY if its name is
   in CAMPUS_ENCLAVE_GROUPS (`pergola`, `sign`, `extstair`); a group named
   anything else is left alone, which is what this one wants. The instanced
   repeats are the sharper edge: relocateInstances() tests every instance with
   isEnclaveLocal(), which answers TRUE for x < 84. Every part of this bar is
   at world x 139…152 — the nearest is 55 m clear of that line — so nothing
   here is captured. Its colliders are world-space for the same reason
   (isEnclaveLocal false ⇒ world.js's rewrite skips them), and they are pushed
   during buildWorld so initMoments' snapshot keeps them.

   ── POSITION, DERIVED ───────────────────────────────────────────────────────
   Carl puts it toward the NORTH of the pool complex, so it sits on
   SITE.LAGOON's north rim. Three things fix the exact bearing:
     · NORTH  → sin θ < 0, i.e. θ ∈ (180°, 360°) in the ellipse's own parameter.
     · The lagoon's NORTH-EAST quadrant and its centre are somebody else's
       ground (a cabana islet + a spoked pavilion are being added there), so
       every part of this structure stays WEST of the basin's centre line
       (x < SITE.LAGOON.cx) — asserted on boot, below.
     · SITE.RIVER.SPINE enters the basin across the WEST-NORTH-WEST rim (its
       last control points cross the published ellipse between (133, 0.5) and
       (138, 5), θ ≈ 215°) and SITE.RIVER.SPUR leaves through the north-east,
       so neither mouth may be built over.
   That leaves the north-north-west rim, and inside it there is exactly one
   natural slot: water.js sets its lagoon umbrellas out at θ = (i + 0.35)/n·2π
   for n = SITE.LAGOON.umbrellas, so the bar takes the MIDPOINT of the gap
   between umbrellas 7 and 8 — θ = (7.5 + 0.35)/11·2π = 256.9°. Derived from
   the published count, so if the umbrella count ever changes the bar moves to
   the new gap instead of standing inside a parasol. (The (i + 0.35)/n rule is
   water.js's; it is mirrored here for the same reason the apron offsets are
   above — there is nowhere shared to publish it from without editing site.js.)

   ── WHAT YOU CANNOT DO, AND WHY ─────────────────────────────────────────────
   ⚠ You cannot swim up to this swim-up bar. water.js's riverColliders() fills
   EVERY basin interior — the lagoon included — with a rim chain plus a 2.6 m
   grid of r 2.0 circles, so a walker is held at the water's edge everywhere
   around this lagoon and always was. That is pre-existing and deliberate (it
   is also what keeps nature.js's palms out of the water); opening a swimmable
   mouth is a water.js job, not this one. The stools are therefore dressing,
   read from the bank and from the air, exactly as the reference photo reads
   them — from across the water.

   Single-Reflector rule: nothing here is reflective. No water surface, no
   Reflector, no second mirror pass. Zero new THREE.PointLights — the back-bar
   strip lights and the sign are emissive, on the existing night registry. */
const SUB_UMB_PHASE = .35;   // water.js buildRiverDressing: umbrella θ phase

function buildSwimUpBar(G, root) {
  const L = SITE.LAGOON, R = SITE.RIVER;
  const TAU = Math.PI * 2;
  const rnd = mulberry32((CFG.SEED ^ 0x5ba0) >>> 0);

  /* ⚠ NOT in CAMPUS_ENCLAVE_GROUPS, and that is the point — see the banner.
     The name is deliberately not enclave-shaped so nobody adds it to that Set. */
  const g = new THREE.Group();
  g.name = 'resort-poolbar';
  root.add(g);

  /* ── the bank frame at the chosen bearing ── */
  const T = (7.5 + SUB_UMB_PHASE) / L.umbrellas * TAU;
  const rimX = L.cx + L.rx * Math.cos(T), rimZ = L.cz + L.rz * Math.sin(T);
  /* outward normal of the published ellipse — ∇((x/rx)² + (z/rz)²) */
  let nX = (rimX - L.cx) / (L.rx * L.rx), nZ = (rimZ - L.cz) / (L.rz * L.rz);
  const nL = Math.hypot(nX, nZ); nX /= nL; nZ /= nL;
  /* mat4()'s Y-rotation maps local +Z onto (sin ry, cos ry), so this yaw points
     the bar's local +Z OUTWARD (landward) and its local +X along the bank. */
  const ry = Math.atan2(nX, nZ);
  const tX = nZ, tZ = -nX;                        // local +X, along the bank
  /* nudged 0.8 m along the bank so the whole structure clears the basin's
     centre line; see the assertion under COST below */
  const U0 = .8;
  /* (u, v) → world.  u along the bank, v OUTWARD from the water. */
  const wx = (u, v) => rimX + (u + U0) * tX + v * nX;
  const wz = (u, v) => rimZ + (u + U0) * tZ + v * nZ;
  /* `dry` is an EXTRA yaw on top of the bank's, and it comes BEFORE `col` on
     purpose: passing a rotation where inst() expects a colour is a
     `color.toArray is not a function` at flush time, i.e. after the whole
     campus has been built — one of this file's cheaper ways to lose an hour. */
  const put = (key, geo, mat, u, y, v, su, sy, sv, dry = 0, col = null) =>
    inst(key, geo, mat, mat4(wx(u, v), y, wz(u, v), su, sy, sv, ry + dry), col);
  /* the same signature for a Blender-authored prop — `modelI` carries BOTH
     halves of the (geometry, material) pair, so its key can never collide */
  const putM = (key, name, u, y, v, dry = 0) =>
    modelI(key, name, mat4(wx(u, v), y, wz(u, v), 1, 1, 1, ry + dry));

  const WY = R.BASIN_Y;                 // 0.045 — the lagoon's water surface
  const FLOOR = .16;                    // the bar's own service floor
  const TOP = 1.14;                     // counter top — 1.09 above the water
  const CN_U = 8.4, CN_V0 = -1.9, CN_V1 = 2.9, CANO = 3.0;   // the canopy, §4

  /* ── the GLBs (ASSET_SPEC Group F) ───────────────────────────────────────
     `swim_up_bar` is the counter + its stone cap, the back-bar case in bays
     and the flat slatted canopy on four posts, in ONE mesh standing on the
     bar's own service floor with its front (−Z) at the water. What is NOT in
     it, each for a reason, stays below: the plinth and the stepped apron (they
     are ground and carry the rectCollider); the "POOL BAR" plane, whose
     counter front is modelled FLAT AND PLAIN behind it — the boards are
     REVEALS, not proud staves, exactly so a sign plane 12 mm off the face
     still sits right; the per-instance-tinted bottles; the emissive shelf
     reveals; the bowl planter and the stone apron.
     ⚠ THE FOUR POST COLLIDERS ARE PUSHED EITHER WAY — they are measured
     against the primitive and may not move. */
  const glbBar = have('swim_up_bar');
  const glbStool = have('swim_stool');
  if (glbBar) {
    putM('subBarGlbI', 'swim_up_bar', 0, FLOOR, (CN_V0 + CN_V1) / 2);
  }

  /* ── 1 · the plinth the bar stands on, skirted down past the basin floor ── */
  const PL_U = 7.6, PL_V0 = -.9, PL_V1 = 2.9;
  const plV = (PL_V0 + PL_V1) / 2, plD = PL_V1 - PL_V0;
  put('subStoneI', UNIT_BOX, MAT.stone, 0, (FLOOR - R.DEPTH * 1.15) / 2, plV,
    PL_U, FLOOR + R.DEPTH * 1.15, plD);
  put('subDeckI', UNIT_BOX, MAT.warmDeck, 0, FLOOR - .03, plV, PL_U - .3, .07, plD - .3);
  /* a pale step out of the water on the swimmers' side — the reference's
     stepped white apron under the counter */
  put('subWhiteI', UNIT_BOX, MAT.white, 0, WY - .16, PL_V0 - .45, PL_U - 1.0, .34, .9);
  rectCollider(G.colliders, wx(0, plV), wz(0, plV), PL_U, plD, ry, .55);

  /* ── 2 · the counter, and the "POOL BAR" lettering across its front ── */
  const CT_U = 6.6, CT_V = -.1, CT_D = .9;
  if (!glbBar) {
    put('subWhiteI', UNIT_BOX, MAT.white, 0, (FLOOR + TOP - .08) / 2, CT_V,
      CT_U, TOP - .08 - FLOOR, CT_D);
    put('subCapI', UNIT_BOX, MAT.stoneCap, 0, TOP - .04, CT_V, CT_U + .22, .08, CT_D + .22);
  }
  {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.9, .46), MAT.poolBar);
    p.position.set(wx(-.4, CT_V - CT_D / 2 - .012), .82, wz(-.4, CT_V - CT_D / 2 - .012));
    p.rotation.y = ry + Math.PI;                  // face the water
    g.add(p);
  }

  /* ── 3 · the back wall of bottle shelving ── */
  const SH_U = 6.2, SH_V = 1.7, SH_TOP = 2.35;
  if (!glbBar) {
    put('subDarkI', UNIT_BOX, MAT.dark, 0, (FLOOR + SH_TOP) / 2, SH_V + .16,
      SH_U, SH_TOP - FLOOR, .1);
    for (const s of [-1, 1]) {                    // the case's end stiles
      put('subTimberI', UNIT_BOX, MAT.slatWarm, s * (SH_U / 2 - .09),
        (FLOOR + SH_TOP) / 2, SH_V, .18, SH_TOP - FLOOR, .42);
    }
  }
  const shelfY = [];
  for (let i = 0; i < 5; i++) {
    const y = FLOOR + .28 + i * .42;
    shelfY.push(y);
    if (!glbBar) put('subTimberI', UNIT_BOX, MAT.slatWarm, 0, y, SH_V, SH_U - .3, .05, .4);
    /* the lit reveal behind each shelf — emissive, not a light. It stands
       15 mm proud of the case's back panel (held at v 1.81 in the GLB too),
       so it survives the swap unchanged. */
    put('subLitI', UNIT_BOX, MAT.inLight, 0, y + .06, SH_V + .12, SH_U - .5, .04, .05);
  }
  /* the bottles. ⚠ per-instance tints ride MAT.bottle, whose base is WHITE on
     purpose — MAT.dark would crush every one of them to black (the 2026-08-03
     cocktail-bar gotcha). Hex only: Color.setHSL fills in LINEAR space. */
  /* WEIGHTED, not uniform: the photograph's back-bar is mostly clear and amber
     spirit glass with a few coloured labels, and an even draw across six
     saturated hues rendered as a vertical rainbow grid — visibly wrong beside
     the reference. Duplicates in the table are the weights. */
  const GLASS = [0xd8d2c4, 0xd8d2c4, 0xd8d2c4, 0xcbc4b2,        // clear / frosted
                 0x9a6b2f, 0x9a6b2f, 0x8a5a26, 0xbf9a3c,        // amber spirits
                 0x3f5a3a, 0x2f5a34,                            // olive
                 0x6c2118, 0x2c4d78];                           // the odd label
  for (const y of shelfY) {
    const n = 16;
    for (let i = 0; i < n; i++) {
      if (rnd() < .18) continue;                  // gaps read as a real back-bar
      const u = (i / (n - 1) - .5) * (SH_U - .9) + (rnd() - .5) * .12;
      const h = .24 + rnd() * .16;
      put('subBottleI', UNIT_CYL, MAT.bottle, u, y + .03 + h / 2, SH_V + (rnd() - .5) * .12,
        .075 + rnd() * .03, h, .075 + rnd() * .03, 0,
        new THREE.Color(GLASS[(GLASS.length * rnd()) | 0]));
    }
  }

  /* ── 4 · the flat SLATTED canopy on four slender timber posts ──
        ⚠ the posts carry r .28 colliders and MAY NOT MOVE, so the push is
        outside the primitive guard. In the GLB the slats are 85 mm deep, not
        the code's 140: at the code's own 145 mm pitch a 140 mm slat leaves a
        5 mm gap, i.e. a solid black plate, and the photograph is a canopy you
        see sky through. Count, pitch, span and top plane are unchanged. ── */
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const u = su * (CN_U / 2 - .65), v = sv < 0 ? -.15 : 2.55;
    if (!glbBar) {
      put('subTimberI', UNIT_BOX, MAT.slatWarm, u, (FLOOR + CANO) / 2, v,
        .19, CANO - FLOOR, .19);
    }
    G.colliders.push({ x: wx(u, v), z: wz(u, v), r: .28 });
  }
  if (!glbBar) {
    for (const sv of [-1, 1]) {                   // the two edge beams
      put('subTimberI', UNIT_BOX, MAT.slatWarm, 0, CANO + .09,
        sv < 0 ? CN_V0 + .16 : CN_V1 - .16, CN_U, .18, .22);
    }
    put('subTimberI', UNIT_BOX, MAT.slatWarm, 0, CANO + .06, (CN_V0 + CN_V1) / 2,
      CN_U, .12, .22);
    const n = 30, span = CN_V1 - CN_V0;
    for (let i = 0; i < n; i++) {
      put('subTimberI', UNIT_BOX, MAT.slatWarm, 0, CANO + .21,
        CN_V0 + .3 + (i / (n - 1)) * (span - .6), CN_U - .12, .07, .14);
    }
  }

  /* ── 5 · the submerged stools ──
        `swim_stool` is ONE continuous turned pedestal from the basin floor to
        the seat, which fixes something the primitive had wrong: its column ran
        −1.25…−0.55 against a seat at −.395…−.305, so 155 mm of open water
        floated every seat while 200 mm of column was buried under the basin
        floor. The Ø .50 seat, its .09 thickness and its −.305 top are
        unchanged, and the stools carry no collider of their own. ── */
  for (let i = 0; i < 5; i++) {
    const u = (i / 4 - .5) * 5.0;
    if (glbStool) {
      putM('subStoolGlbI', 'swim_stool', u, -R.DEPTH, PL_V0 - .55);
    } else {
      put('subWhiteCylI', UNIT_CYL, MAT.white, u, -.35, PL_V0 - .55, .5, .09, .5);
      put('subWhiteCylI', UNIT_CYL, MAT.white, u, (-.35 - R.DEPTH) / 2 - .2,
        PL_V0 - .55, .17, R.DEPTH - .35, .17);
    }
  }

  /* ── 6 · the white bowl planter of bougainvillea, on its own curved pier.
        Set OUTSIDE the canopy line so the mass reads against the sky from the
        water, which is exactly how the photograph frames it. ── */
  const PI_U = -3.3, PI_V = 3.55;
  for (let i = 0; i < 3; i++) {                   // three boxes fake the curve
    put('subWhiteI', UNIT_BOX, MAT.white, PI_U + (i - 1) * .62, (FLOOR + 2.3) / 2,
      PI_V + Math.abs(i - 1) * .16, .68, 2.3 - FLOOR, .86, 0);
  }
  put('subCapI', UNIT_BOX, MAT.stoneCap, PI_U, 2.33, PI_V, 2.1, .1, 1.02);
  put('subWhiteCylI', UNIT_CYL, MAT.white, PI_U, 2.62, PI_V, 1.24, .5, 1.24);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2, rr = .35 + rnd() * .5;
    put('subBougI', UNIT_BLOB, MAT.bougain,
      PI_U + Math.cos(a) * rr, 2.9 + rnd() * .45 - Math.max(0, rr - .55) * 1.6,
      PI_V + Math.sin(a) * rr * .8, .78 + rnd() * .5, .62 + rnd() * .4,
      .78 + rnd() * .5, rnd() * 3);
  }
  rectCollider(G.colliders, wx(PI_U, PI_V), wz(PI_U, PI_V), 2.0, .9, ry, .5);

  /* ── 7 · a stone apron out to the lagoon's sand deck, so the bar is
        approachable on foot from the bank ── */
  put('subPaveI', UNIT_PLANE, MAT.stone, 0, R.DECK_Y + .02, (PL_V1 + 6.6) / 2,
    5.4, 1, 6.6 - PL_V1);

  /* ── 8 · clear nature's understory off the bar and its approach.
        Measured need, not tidiness: without it two ~3 m shrub masses stood
        hard against the landward face and buried the whole structure from the
        deck. (u, v) → world is not invertible cheaply, so the test is the
        world-space circle that contains the plan, which is what a shrub cull
        wants anyway.) ── */
  {
    const cx = wx(0, 1.3), cz = wz(0, 1.3), rad = 7.6;
    cullPlantingAt(G, (x, z) => (x - cx) ** 2 + (z - cz) ** 2 < rad * rad);
  }

  /* the assertion the banner promises: EVERY part of this bar stays west of
     the basin's centre line, so the other pass's islet and spoked pavilion
     have the centre and the north-east quadrant to themselves. */
  let maxX = -1e9;
  for (const u of [-CN_U / 2, CN_U / 2]) for (const v of [CN_V0, CN_V1, 6.6]) {
    maxX = Math.max(maxX, wx(u, v));
  }
  if (maxX >= L.cx) {
    console.warn('[campus] swim-up bar reaches x ' + maxX.toFixed(2)
      + ', east of SITE.LAGOON.cx ' + L.cx);
  }
  return g;
}

/* ════════════════════════════════════════════════════════════════════════
   public API
   ════════════════════════════════════════════════════════════════════════ */
export function buildCampus(G) {
  BUCKETS.clear();
  NIGHT.tint.length = 0; NIGHT.glow.length = 0; NIGHT.lights.length = 0;
  MAT = makeMaterials();
  /* KAN-211 wave F — the four MAT entries that carried a constructor
     envMapIntensity (villaWater 1.4, rtGlass 1.5, rtWater 1.6, blackPolish
     1.25). None of those ever bound (no own envMap; three r180 used the
     scene's level), so as knobs they default to the scene's (ENV_SCENE) —
     the level every look was graded at — unless ENV_OVERRIDE says otherwise. */
  for (const k of ['villaWater', 'rtGlass', 'rtWater', 'blackPolish']) {
    envKnob(MAT[k], ENV_OVERRIDE[k] || null, 'campus:MAT.' + k);
  }
  photoTex(MAT.hedge, 'hedge.webp');       // KAN-208 wave 2 — see MAT.hedge

  const root = new THREE.Group();
  root.name = 'campus';
  const rnd = mulberry32((CFG.SEED ^ 0x5eed) >>> 0);

  /* (buildLounge(G, root) stood here — demolished 2026-08-04, see section 1.
     It drew nothing from `rnd`, so the order below is unchanged.) */
  buildVillas(G, root, rnd);
  buildResortVillas(G, rnd);
  buildGrassGround(G);
  buildPlaza(G, root);
  buildPergola(G, root);
  /* the arrival pavilion parents its unique meshes INSIDE the adopted 'sign'
     group so they ride the enclave transform — see buildArrival's banner */
  buildArrival(G, buildSign(G, root), rnd);
  buildExtStair(G, root);
  buildHotel(G, root);
  buildRoad(G, root, rnd);
  /* Both of these run LAST and both carry their OWN mulberry32 stream, so the
     shared `rnd` above reaches buildRoad in exactly the state it always did —
     no villa, car or lamp moves because two structures were added. (The
     campus-wide planting DOES shift: buildNature runs after buildWorld's
     campus phase and dart-throws its palms against G.colliders, so the ~120
     circles these two push repel palms that used to stand there. That is the
     intended behaviour, not a regression — same mechanism as the 2026-08-04
     lounge demolition.) */
  buildSecondPoolPavilion(G);          // ENCLAVE-LOCAL — inst() only, no group
  buildSwimUpBar(G, root);             // WORLD SPACE — must not be adopted

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
  for (const m of NIGHT.vis) m.visible = on;
  if (MAT) {
    MAT.glass.opacity = on ? .86 : .5;
    MAT.glass.color.setHex(on ? 0x120d07 : 0x25333a);
    MAT.clear.opacity = on ? .3 : .22;
  }
}
