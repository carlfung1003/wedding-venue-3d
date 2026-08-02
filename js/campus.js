// campus.js — THE BUILT CAMPUS of 隐逸居 (Yinyiju), the Westin Sanya Haitang Bay
// clubhouse enclave. Buildings + hardscape only:
//
//   · SITE.LOUNGE      — the 280 ㎡ / 60-seat 酒廊, wedding-dinner venue
//   · SITE.VILLAS      — 10 guest keys in 3 types (5 Garden Rooms, 3 Garden Pool
//                        2-BR with walled courtyards, 2 two-storey Garden 3-BR)
//   · SITE.LAWN        — the formal GARDEN lawn out by the road (NOT the
//                        ceremony ground any more): stone edge + ring path + hedge
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
import { SITE, HOTEL_ROOF, ROOMS } from './site.js';
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
const WHITE = new THREE.Color(0xffffff);

/* ════════════════════════════════════════════════════════════════════════
   night registry — setCampusNight() walks these three lists
   ════════════════════════════════════════════════════════════════════════ */
const NIGHT = { tint: [], glow: [], lights: [], vis: [] };
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
  const stucco = texStucco(), roof = texRoof(), deck = texDeck(), slat = texSlat();
  const marble = texMarble(), paver = texPaver(), stone = texStone(), turf = texTurf();
  const hotelFace = texHotelFacade(), hotelWin = texHotelWindows(), sign = texSign();
  const lattice = texLatticePair(), screenGlow = texScreenGlow(), stars = texStarField();

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
      color: 0xcadde4, roughness: .04, metalness: .22, envMapIntensity: 1.5,
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
      color: 0x2bb0c6, roughness: .08, metalness: .12, envMapIntensity: 1.6,
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
  };
  glow(m.rtScreen, 0, 1.45);
  tint(m.rtScreen, 0xa9b6cc);
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
        colL(sgn * gx, z0, sgn * gx, z1, .3);
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
      put('hedgeI', UNIT_BLOB, MAT.hedge, CW / 2 - 1.2, .9, cz + CD / 2 - 1.4, 1.8, 1.5, 1.6);

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
   3b · THE GRASS GROUND  (Carl, 2026-08-02)
   ════════════════════════════════════════════════════════════════════════
   The four mown lawns of SITE — GRAND_LAWN, BEACH_LAWN and the two
   DINNER_LAWNS — plus the paths that link them, the planted terrace edge and
   the fire pit. This is the ground three of the six moments now stand on.

   Reference: reference/photos/clubhouse-lawn-to-beach.png (from above the
   clubhouse, looking west out to sea) settles the composition, and the one
   thing it settles hardest is what NOT to build: the big lawn is flat,
   unbroken and completely empty. No hedge ring, no coping, no ring path, no
   ornament — buildLawn()'s vocabulary above is exactly the wrong idea out
   here. What edges it is soft: clipped hedge blocks, rounded topiary and
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
   emissive instances, like buildLawn()'s path lights.                       */
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
     MAT.glowLamp box: glowLamp's day colour is 0x1a1a1c, and buildLawn() gets
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

  /* ── the fire pit set into the terrace paving beside the pool ──
        A square kerb of pale stone in a wider apron with a dark pebble
        margin, an ember bed that lights after dark. Its kerb is 0.35 m — under
        CFG.STEP_UP, so floorY would happily let a walker stand in the fire;
        the four collider runs are what actually keep them out. */
  {
    const A = FP.w + FP.rim * 2;
    paving(FP.cx, FP.cz, A + 2.4, A + 2.4);
    inst('grassPaveI', UNIT_PLANE, MAT.blackstone,
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
    inst('grassPaveI', UNIT_PLANE, MAT.blackstone,
      mat4(FP.cx, .07, FP.cz, FP.w - .5, 1, FP.w - .5));
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(FP.cx, .10, FP.cz, FP.w - .9, .06, FP.w - .9));
  }

  /* ── two teak benches at the seaward edge, facing the water ── */
  for (const bx of [BL.x0 + 5, BL.x1 - 3]) {
    inst('benchI', UNIT_BOX, MAT.deck, mat4(bx, .43, BL.z1 - 1.6, 1.9, .09, .5));
    for (const s of [-1, 1]) {
      inst('benchI', UNIT_BOX, MAT.deck, mat4(bx + s * .78, .21, BL.z1 - 1.6, .12, .43, .44));
    }
    G.colliders.push({ x: bx, z: BL.z1 - 1.6, r: .95 });
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
  inst('grassPaveI', UNIT_PLANE, MAT.paver,
    mat4((DW.x0 + DW.x1) / 2, PATH_Y, (DW.z0 + DW.z1) / 2,
      DW.x1 - DW.x0 - 1.4, 1, DW.z1 - DW.z0));
  /* the apron that joins both lawns back to the pool terrace */
  inst('grassPaveI', UNIT_PLANE, MAT.paver,
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

  /* the rooftop brunch terrace — the one part of the crescent people stand in */
  buildHotelRoof(G, g, acx, acz);

  /* ── coarse collider ring so a walker can't stroll into the crescent ───────
     27 circles of r 14 on the arc: together they wall off r ∈ [81, 109] across
     the whole 1.5 rad sweep. That is the right answer at grade and was the WRONG
     answer everywhere else — being y-agnostic it also walled off the rooftop
     terrace 26.6 m above it, which is why the roof could never be stood on.
     `y1` is the fix: the ring stops existing for a walker whose feet are at or
     above the green roof cap, which is the only place there is anything to
     stand on up there. See the collider contract in player.js.
     H.floors * H.floorH is the cap (25.2); the terrace deck is 1.4 m over it. */
  const RING_TOP = H.ROOFTOP.roofY;
  for (let i = 0; i <= 26; i++) {
    const th = Math.PI / 2 - tl / 2 + (i / 26) * tl;
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
   Past each END of the water (|θ − C| > poolArcHalf) the old section survives:
   marble ledge → glass balustrade → paving → the eight brunch four-tops at
   r 93.4 / 95.0, which are pinned there by moments.js and must not move.
   ════════════════════════════════════════════════════════════════════════ */
function buildHotelRoof(G, g, acx, acz) {
  const R = SITE.HOTEL.ROOFTOP;
  const C = Math.PI / 2;                                 // crescent centre bearing
  const a0 = C - R.arcHalf, a1 = C + R.arcHalf;          // terrace sweep
  const p0 = C - R.poolArcHalf, p1 = C + R.poolArcHalf;  // pool sweep
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

  /* ── the deck, as edge-to-edge bands. Only the two END aprons carry anything
        between rIn and the water now; over the pool's own sweep the deck stops
        dead at rIn and the next thing is the lip. ── */
  for (const [s, e] of [[a0, p0], [p1, a1]]) {
    band(R.rIn, LEDGE, s, e, DY, MAT.rtCoping, 1.6);           // balustrade ledge
    band(LEDGE, R.poolOut, s, e, DY, MAT.rtPave, 1);           // the brunch aprons
  }
  band(R.poolOut, 97.2, a0, a1, DY, MAT.rtCoping, 1.6);        // pool coping
  band(97.2, R.teakOut, a0, a1, DY, MAT.rtTeak, 6);            // the timber deck
  band(R.teakOut, R.rOut, a0, a1, DY, MAT.rtPave, 1);          // back paving

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

  /* three submerged steps at each end of the pool */
  for (const s of [-1, 1]) {
    const th = C + s * (R.poolArcHalf - .022);
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

  /* fin posts every ~3 m — the rhythm is what actually makes a frameless glass
     rail visible at distance; the glass alone is just a haze */
  for (let i = 0; i <= 29; i++) {
    const th = a0 + (a1 - a0) * (i / 29);
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
  for (let i = 0; i < 15; i++) {
    const th = p0 + (p1 - p0) * ((i + .5) / 15);
    inst('rtLitI', UNIT_BOX, MAT.poolGlow,
      mat4(WX(th, R.poolOut - .07), WY - .3, WZ(th, R.poolOut - .07), .9, .14, .07, th));
    inst('rtLitI', UNIT_BOX, MAT.poolGlow,
      mat4(WX(th, R.troughR + .18), TROUGH_Y + .06, WZ(th, R.troughR + .18), .8, .05, .16, th));
  }

  /* ── 16 loungers on the teak, feet toward the drop ── */
  for (let i = 0; i < 16; i++) {
    const th = C - .335 + (i / 15) * .67;
    const x = WX(th, R.loungeR), z = WZ(th, R.loungeR);
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + .17, z, .82, .34, 2.05, th));
    inst('rtMarbleI', UNIT_BOX, MAT.marble, mat4(x, DY + .40, z, .74, .13, 1.9, th));
    const bx = WX(th, R.loungeR + .92), bz = WZ(th, R.loungeR + .92);
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(bx, DY + .58, bz, .82, .62, .13, th, .5));
    if (i % 2 === 1) {                       // a side table between each pair
      const tth = th + .012;
      inst('rtSlatI', UNIT_BOX, MAT.slat,
        mat4(WX(tth, R.loungeR - 1.3), DY + .22, WZ(tth, R.loungeR - 1.3), .5, .44, .5, tth));
    }
  }

  /* ── 8 parasols between the pairs ── */
  for (let i = 0; i < 8; i++) {
    const th = C - .30 + (i / 7) * .60;
    const x = WX(th, R.loungeR + 1.35), z = WZ(th, R.loungeR + 1.35);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + 1.25, z, .11, 2.5, .11));
    inst('rtUmbI', UNIT_CONE, MAT.umbrella, mat4(x, DY + 2.72, z, 3.5, .8, 3.5));
  }

  /* ── deck lanterns along the back of the teak ── */
  for (let i = 0; i < 15; i++) {
    const th = a0 + (a1 - a0) * ((i + .5) / 15);
    const x = WX(th, 99.9), z = WZ(th, 99.9);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .55, z, .1, 1.1, .1));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 1.24, z, .26, .38, .26, th));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(x, DY + 1.46, z, .32, .07, .32, th));
  }

  /* ── the bar pavilion, dead centre on the crescent's axis ── */
  const bH = R.barH, bA = R.barArcHalf;
  shell(R.rOut, bH, DY + bH / 2, MAT.rtSlat, C - bA, C + bA);                  // back wall
  band(99.7, R.rOut + .3, C - bA - .012, C + bA + .012, DY + bH, MAT.rtSlat, 1.1);
  band(99.6, R.rOut + .4, C - bA - .015, C + bA + .015, DY + bH - .22, MAT.copper, 4);
  for (const dr of [99.9, R.rOut - .2]) for (let k = 0; k < 3; k++) {
    const th = C - bA + (k / 2) * bA * 2;
    inst('poleI', UNIT_CYL, MAT.dark, mat4(WX(th, dr), DY + bH / 2, WZ(th, dr), .17, bH, .17));
  }
  for (let i = 0; i < 7; i++) {                                                 // curved counter
    const th = C - bA * .82 + (i / 6) * bA * 1.64;
    const x = WX(th, 100.7), z = WZ(th, 100.7);
    inst('rtSlatI', UNIT_BOX, MAT.slat, mat4(x, DY + .53, z, 2.3, 1.06, .9, th));
    inst('rtMarbleI', UNIT_BOX, MAT.marble, mat4(x, DY + 1.09, z, 2.42, .1, 1.02, th));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + .18, z, 2.1, .1, .12, th));
    const sth = th - bA * .1;                                                   // a stool
    inst('poleI', UNIT_CYL, MAT.dark, mat4(WX(sth, 99.6), DY + .33, WZ(sth, 99.6), .1, .66, .1));
    inst('rtWhiteI', UNIT_BOX, MAT.white,
      mat4(WX(sth, 99.6), DY + .70, WZ(sth, 99.6), .48, .12, .48, sth));
  }
  for (let i = 0; i < 5; i++) {                                                 // lit back-bar
    const th = C - bA * .8 + (i / 4) * bA * 1.6;
    inst('glowI', UNIT_BOX, MAT.glowLamp,
      mat4(WX(th, R.rOut - .16), DY + 1.55, WZ(th, R.rOut - .16), 2.2, .09, .1, th));
    inst('inLightI', UNIT_BOX, MAT.inLight,
      mat4(WX(th, 101.3), DY + bH - .16, WZ(th, 101.3), 2.2, .09, 1.5, th));
  }
  pointLight(g, Math.sin(C) * 101, DY + bH - .5, Math.cos(C) * 101, 0, 42, 30);

  /* ════════════════════════════════════════════════════════════════════════
     THE CABANA DAYBEDS — the inland long side of the pool.
     Replaces the six solid white cabana boxes that used to stand here. The
     reference photograph's inland side is an unbroken RUN of white four-poster
     daybeds with drawn curtains, on timber decking, one every five metres for
     the length of the water — not six pavilions with gaps between them. That
     rhythm, backed by the lattice screen, is the roof's whole elevation.

     Every part rides an EXISTING instance bucket, so nineteen daybeds — ~250
     instances — cost zero additional draw calls.

     `TX/TZ` take a tangential offset in METRES as well as a radius, which is
     what a rectangular object on a curve needs: the four posts of one bed are
     at the corners of a rectangle, not at four points on an arc.
     ════════════════════════════════════════════════════════════════════════ */
  const TX = (th, r, v = 0) => acx + Math.sin(th) * r + Math.cos(th) * v;
  const TZ = (th, r, v = 0) => acz + Math.cos(th) * r - Math.sin(th) * v;
  const TBth = HOTEL_ROOF.tower.th;
  /* everything on the back band has to dodge the same three obstructions */
  const blocked = th => {
    const d = Math.abs(th - C);
    return d < R.barArcHalf + .028 ||                 // the bar pavilion
      Math.abs(d - R.coreArcHalf) < .045 ||           // the two head-houses
      Math.abs(th - TBth) < .050;                     // the link bridge's landing
  };

  const GR = R.gardenR, dayTh = [];
  for (let th = C - R.arcHalf + .030; th <= C + R.arcHalf - .030; th += .0486) {
    if (blocked(th)) continue;
    dayTh.push(th);
  }
  for (const th of dayTh) {
    const x = WX(th, GR), z = WZ(th, GR);
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
    // the warm lamp under the canopy — this is what lights the row after dark
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 2.54, z, 2.20, .09, .34, th));
    // a low timber tray table at the foot, and a dark planted pot beside it
    inst('rtSlatI', UNIT_BOX, MAT.slat,
      mat4(WX(th, GR - 1.62), DY + .40, WZ(th, GR - 1.62), .92, .38, .74, th));
    const pth = th + 2.35 / GR;
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(WX(pth, GR + .35), DY + .34, WZ(pth, GR + .35), .82, .68, .82, pth));
    inst('hedgeI', UNIT_BLOB, MAT.hedge,
      mat4(WX(pth, GR + .35), DY + .96, WZ(pth, GR + .35), 1.24, 1.02, 1.24));
  }

  /* ════════════════════════════════════════════════════════════════════════
     THE PERFORATED LATTICE SCREEN WALL.
     "Model the screen wall — it is what makes the roof read at distance, day
     and night." A run of tall white blades of alternating height, each a
     perforated lattice with a POINTED head (UNIT_FIN), plus a taller, narrower
     accent fin standing 0.2 m proud every fourth bay. Alpha-tested, so the sky
     shows through the holes; one geometry and one material, so the whole
     screen — ~70 blades over 128 m of arc — is a SINGLE draw call.

     At night the material's emissiveMap (texScreenGlow) lifts to 1.45 and the
     screen becomes the blue projection wall from the photograph. That is why
     it is emissive rather than lit: a point light strong enough to paint 128 m
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
  for (let th = C - R.arcHalf + dSth * .5; th <= C + R.arcHalf - dSth * .4; th += dSth) {
    sIdx++;
    if (blocked(th)) continue;
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

  /* ── brunch seating on the paved aprons past each end of the water. This is
        where the wedding party eats on 2027-03-18: four tops, parasols, and
        nothing between them and the sea but the glass. ── */
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
    const th = C + s * (R.poolArcHalf + .035 + k * .055);
    const r = 99.2 + (k % 2) * 1.6;   // inland of the water — Carl: the pool takes the edge, not the tables
    const x = WX(th, r), z = WZ(th, r);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + .36, z, .14, .72, .14));
    inst('rtTopI', UNIT_CYL, MAT.marble, mat4(x, DY + .75, z, 1.35, .07, 1.35));
    for (let c = 0; c < 4; c++) {                       // four white chairs
      const ca = c * Math.PI / 2 + .4;
      const cxp = x + Math.cos(ca) * 1.05, czp = z - Math.sin(ca) * 1.05;
      inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(cxp, DY + .23, czp, .5, .46, .5, ca));
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(x + Math.cos(ca) * 1.28, DY + .62, z - Math.sin(ca) * 1.28, .5, .5, .08, ca));
    }
    if (k % 2 === 0) {                                   // a parasol over every other one
      inst('poleI', UNIT_CYL, MAT.dark, mat4(x, DY + 1.35, z, .09, 2.7, .09));
      inst('rtUmbI', UNIT_CONE, MAT.umbrella, mat4(x, DY + 2.86, z, 3.0, .7, 3.0));
    }
  }

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
  /* and a soft green rim on the green-roof cap outside the terrace */
  for (let i = 0; i < 22; i++) {
    const th = (C - .74) + (i / 21) * 1.48;
    inst('hedgeI', UNIT_BLOB, MAT.hedge,
      mat4(WX(th, 104.4), RY + .55, WZ(th, 104.4), 3.0, 1.1, 1.7));
  }

  /* the way up, and the colliders that make all of the above stand-on-able */
  buildRoofAccess(G, g, acx, acz);
  roofColliders(G, acx, acz);

  /* one cool point light over the water so the terrace has depth after dark */
  pointLight(g, Math.sin(C) * 93.6, DY + 2.2, Math.cos(C) * 93.6, 0, 30, 34, 0x7fe3ff);
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
      inst('rtTreadI', UNIT_BOX, MAT.rtSlat,
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
  const p0 = C - R.poolArcHalf, p1 = C + R.poolArcHalf;
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
  arc(100.7, C - R.barArcHalf * .95, C + R.barArcHalf * .95, .55, ROOF);   // bar counter
  /* the daybed row — the same angular sweep, the same three exclusions and the
     same 0.0486 step buildHotelRoof() uses, so a bed and its collider can never
     disagree. Two circles per bed, at the ends of its 3.3 m platform. */
  for (let th = C - R.arcHalf + .030; th <= C + R.arcHalf - .030; th += .0486) {
    const d = Math.abs(th - C);
    if (d < R.barArcHalf + .028) continue;
    if (Math.abs(d - R.coreArcHalf) < .045) continue;
    if (Math.abs(th - T.th) < .050) continue;
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
  for (let i = 0; i < 16; i++) {                                            // loungers
    const th = C - .335 + (i / 15) * .67;
    L.push({ x: WX(th, R.loungeR), z: WZ(th, R.loungeR), r: .85, ...ROOF });
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
  buildGrassGround(G);
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
  for (const m of NIGHT.vis) m.visible = on;
  if (MAT) {
    MAT.glass.opacity = on ? .86 : .5;
    MAT.glass.color.setHex(on ? 0x120d07 : 0x25333a);
    MAT.clear.opacity = on ? .3 : .22;
  }
}
