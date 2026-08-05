// campus.js — THE BUILT CAMPUS of 隐逸居 (Yinyiju), the Westin Sanya Haitang Bay
// clubhouse enclave. Buildings + hardscape only:
//
//   · SITE.LOUNGE      — the 280 ㎡ / 60-seat 酒廊, wedding-dinner venue
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
import { SITE, HOTEL_ROOF, ROOMS, worldToEnclave,
  ARRIVAL_LOBBY_Y, ARRIVAL_LOUNGE_CEIL, ARRIVAL_LANE_Y } from './site.js';
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

    /* ── THE ARRIVAL PAVILION (entrance-arrival-brief.md) ───────────────────
       Dark corten AS FILMED — Carl settled the palette conflict: this volume
       is an intentional dark accent against the white clubhouse. */
    corten: tint(new THREE.MeshStandardMaterial({ map: texCorten(), roughness: .62, metalness: .34 }), 0x707784),
    bands: tint(new THREE.MeshStandardMaterial({ map: texBands(), roughness: .44, metalness: .12 }), 0x7d8494),
    /* near-black polished stone — the stair, landing, vestibule, plinths */
    blackPolish: tint(new THREE.MeshStandardMaterial({
      color: 0x1b1e21, roughness: .18, metalness: .1, envMapIntensity: 1.25 }), 0x99a1b2),
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
  glow(m.rtScreen, 0, 1.45);
  tint(m.rtScreen, 0xa9b6cc);
  glow(m.rtBarPanel, 0, 1.8);
  tint(m.rtBarPanel, 0xa9b6cc);
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
    const agaveMat = tint(new THREE.MeshStandardMaterial({
      color: 0x74936c, roughness: .9, flatShading: true }), 0x5c6b86);
    const crotonMat = tint(new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: .92, flatShading: true }), 0x5c6b86);
    const casuBark = tint(new THREE.MeshStandardMaterial({
      color: 0x4c4238, roughness: .95 }), 0x6a7286);
    const casuNeedle = tint(new THREE.MeshStandardMaterial({
      color: 0x3d4d38, roughness: .96, flatShading: true }), 0x59688a);
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
        inst('hedgeI', UNIT_BLOB, MAT.hedge,
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
    inst('arrRetainI', UNIT_BOX, MAT.blackPolish,
      mat4(cx + nx * .30, TY + .09, cz + nz * .30, .72, .18, len, ry));   // cap
    /* the planted batter: a slope band of clipped mass falling to grade */
    const n = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i < n; i++) {
      const t = (i + .5) / n;
      const px = x1 + (x2 - x1) * t + nx * (.6 + AR.batter / 2);
      const pz = z1 + (z2 - z1) * t + nz * (.6 + AR.batter / 2);
      inst('arrHedgeI', UNIT_BOX, MAT.hedge,
        mat4(px, TY * .32, pz, AR.batter, TY * .64, len / n - .1, ry));
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(px + nx * .7, TY * .62 + rnd() * .3, pz + nz * .7,
          1.1 + rnd() * .6, .8 + rnd() * .4, 1.1 + rnd() * .6),
        new THREE.Color([0x4f7a3c, 0x5e2531, 0x49703a][Math.floor(rnd() * 3)]));
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
  const frangipani = (fx, fz, fy) => {
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
    for (let c = 0; c < 4; c++) {
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(AR.bedX0 + 1.2 + c * 1.7 + rnd() * .5, TY + .78, bc + (rnd() - .5) * .7,
          .75 + rnd() * .35, .95 + rnd() * .3, .75 + rnd() * .3),
        new THREE.Color(CORDY[Math.floor(rnd() * CORDY.length)]));
    }
    for (let c = 0; c < 6; c++) {
      inst('arrPlantI', UNIT_BLOB, MAT.plantFlat,
        mat4(AR.bedX0 + .8 + rnd() * (AR.fore.x1 - AR.bedX0 - 1.6), TY + .34,
          inner + (bi === 0 ? -.95 : .95) + (rnd() - .5) * .3, .3, .24, .3),
        new THREE.Color(0xc63e1c));
    }
    frangipani(AR.bedX0 + 1.6, bc, TY);
    frangipani(AR.bedX0 + 5.6, bc, TY);
    /* the white bowl planter with its variegated dracaena, on the stair apron */
    const px = AR.stair.x1 + 1.0, pz = bc + (bi === 0 ? .35 : -.35);
    inst('arrWhiteCylI', UNIT_CYL, MAT.white, mat4(px, TY + .3, pz, 1.0, .6, 1.0));
    inst('arrTrunkI', UNIT_CYL, MAT.arrTrunk, mat4(px, TY + 1.0, pz, .08, .9, .08),
      new THREE.Color(0x6a5540));
    inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(px, TY + 1.6, pz, .95, .8, .95),
      new THREE.Color(0xb4c878));
    inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(px + .25, TY + 1.42, pz - .2, .6, .55, .6),
      new THREE.Color(0x93ab5a));
    C.push({ x: px, z: pz, r: .55 });
  }

  /* ══════════════════════════════════════════════════════════════════════
     B · THE FILMED STAIR — terraceY → lobbyY in the same 6 risers
     ══════════════════════════════════════════════════════════════════════ */
  for (let i = 0; i < AR.risers; i++) {
    inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
      mat4(AR.stair.x1 - (i + .5) * AR.tread, TY + (i + 1) * rh / 2, bayC,
        AR.tread, (i + 1) * rh, bayW));
  }
  /* the entry landing between the stair head and the doors */
  inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
    mat4((AR.doorX + AR.stair.x0) / 2, LY - .09, bayC, AR.stair.x0 - AR.doorX, .18, bayW));
  /* side plinths guarding the open flanks of the stair bay */
  for (const s of [0, 1]) {
    const pz = s ? AR.bay.z1 + .45 : AR.bay.z0 - .45;
    inst('arrBlackI', UNIT_BOX, MAT.blackPolish,
      mat4((AR.doorX + 46.7) / 2, TY + rise / 2 + .03, pz, 46.7 - AR.doorX, rise + .06, .9));
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
  for (const w of AR.wings) {
    const cz = (w.z0 + w.z1) / 2, cd = w.z1 - w.z0;
    inst('arrCortenI', UNIT_BOX, MAT.corten,
      mat4(AR.faceX - .18, AR.wingH / 2, cz, .36, AR.wingH, cd));
    colliderLine(C, AR.faceX - .18, w.z0, AR.faceX - .18, w.z1, .4);
  }
  /* end walls + the buried east flank of the lounge */
  for (const cz of [B.z0 + .18, B.z1 - .18]) {
    inst('arrCortenI', UNIT_BOX, MAT.corten, mat4(bcx, AR.wingH / 2, cz, bw, AR.wingH, .36));
    colliderLine(C, B.x0, cz, B.x1, cz, .4);
  }
  inst('arrCortenI', UNIT_BOX, MAT.corten,
    mat4(AR.faceX - .18, CY / 2, bcz, .36, CY, bd));            // lounge's east wall
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
  inst('arrCortenI', UNIT_BOX, MAT.corten,
    mat4(roofCX, roofC, roofZ, roofW, .34, run + .2, 0, ang, 0));
  /* the WARM TIMBER SOFFIT under the overhang — the photo's signature */
  inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
    mat4(roofCX, roofC - .21, roofZ, roofW - .12, .1, run + .08, 0, ang, 0));
  for (let k = 0; k < 7; k++) {                                // recessed downlights
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(B.x0 - 1.5, roofC - .27 + (roofZ - (B.z0 + 2.4 + k * 3.4)) * Math.tan(ang),
        B.z0 + 2.4 + k * 3.4, .16, .05, .16));
  }
  inst('arrCortenI', UNIT_BOX, MAT.corten,                     // front fascia
    mat4(AR.faceX + .38, roofC - .38, roofZ, .16, 1.05, run + .15, 0, ang, 0));
  /* THE FOLD — the angular origami line over the entry (frame f_001) */
  const foldA = -Math.atan2(1.6, bayW + .2);
  inst('arrCortenI', UNIT_BOX, MAT.corten,
    mat4(AR.faceX + .42, AR.wingH + .15, bayC - .1, .14, .8, bayW + .9, 0, foldA, 0));

  /* ── the deep flat entry canopy with slatted soffit + downlights ── */
  const canC = (AR.canopy.x0 + AR.canopy.x1) / 2, canW = AR.canopy.x1 - AR.canopy.x0;
  inst('arrCortenI', UNIT_BOX, MAT.corten,
    mat4(canC, AR.canopy.topY - .16, bayC, canW, .32, bayW));
  const soff = box(g, canW - .2, .05, bayW - .2, canC, AR.canopy.soffitY + .025, bayC, MAT.slatCeil);
  soff.name = 'arr-soffit';
  for (let k = 0; k < 6; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(canC + .55, AR.canopy.soffitY - .005, AR.bay.z0 + 1.6 + k * 1.16, .16, .05, .16));
  }

  /* ── the banded piers flanking the recessed door bay ── */
  for (const s of [0, 1]) {
    const z0 = s ? AR.doorGap.z1 : AR.bay.z0, z1 = s ? AR.bay.z1 : AR.doorGap.z0;
    const cz = (z0 + z1) / 2;
    inst('arrBandI', UNIT_BOX, MAT.bands,
      mat4((AR.doorX - .1 + 44.2) / 2, LY + (AR.canopy.topY - LY) / 2, cz,
        44.2 - AR.doorX + .1, AR.canopy.topY - LY, z1 - z0));
    rectCollider(C, (AR.doorX - .1 + 44.2) / 2, cz, 44.2 - AR.doorX + .1, z1 - z0, 0, .35);
  }

  /* ── the door bay: dark-framed glass, STANDING OPEN (gap walkable) ── */
  const gapC = (AR.doorGap.z0 + AR.doorGap.z1) / 2, gapW = AR.doorGap.z1 - AR.doorGap.z0;
  inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX, LY + 2.55, gapC, .18, .55, gapW + .3));
  inst('darkI', UNIT_BOX, MAT.dark, mat4(AR.doorX, LY + 2.25, gapC, .12, .07, gapW));
  for (const s of [-1, 1]) {
    inst('darkI', UNIT_BOX, MAT.dark,
      mat4(AR.doorX, LY + 1.15, gapC + s * gapW / 2, .14, 2.3, .12));
  }
  for (const s of [-1, 1]) {                                   // the slid-open leaves
    const lz = gapC + s * (gapW / 2 + .5);
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
    inst('darkI', UNIT_BOX, MAT.dark, mat4(44.22, LY + 1.7, sz, .08, .55, .3));
    inst('arrSconceI', UNIT_CYL, MAT.brassFlute, mat4(44.34, LY + 1.7, sz, .22, 1.2, .22));
  }

  /* ── the plaque wall: wings[0] gets a banded front panel inside the corten
     frame, carrying the flush white plaque — 隐逸居 / THE SERENE RETREAT ── */
  const plWallZ = (AR.wings[0].z0 + AR.wings[0].z1) / 2 + 2.0;
  inst('arrBandI', UNIT_BOX, MAT.bands,
    mat4(AR.faceX + .06, TY + 1.9, plWallZ, .12, 2.9, 5.2));
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.12), MAT.plaque);
  pl.position.set(AR.faceX + .15, TY + 2.45, plWallZ);
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
  box(g, bw - .4, .1, bd - .4, bcx, .06, bcz, MAT.loungeFloor);
  /* slat ceiling = the lobby slab's underside */
  box(g, bw - .5, .1, bd - .5, bcx, CY - .06, bcz, MAT.slatCeil);
  for (let k = 0; k < 9; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(B.x0 + 2.6 + (k % 3) * 3.6, CY - .12, B.z0 + 3.4 + Math.floor(k / 3) * 7.6, .16, .05, .16));
  }
  /* the folding glass wall on the courtyard face, standing OPEN over
     loungeGap; sheer cream curtains behind every closed bay */
  const LG = AR.loungeGap;
  for (const [z0, z1] of [[B.z0 + .4, LG.z0], [LG.z1, B.z1 - .4]]) {
    const seg = z1 - z0;
    if (seg < .2) continue;
    inst('glass', UNIT_BOX, MAT.glass, mat4(B.x0, 1.5, (z0 + z1) / 2, .1, 2.9, seg));
    const n = Math.max(2, Math.round(seg / 1.15));
    for (let k = 0; k <= n; k++) {
      inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0 - .02, 1.5, z0 + seg * k / n, .16, 2.94, .11));
    }
    inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0, 3.02, (z0 + z1) / 2, .2, .16, seg));
    for (let k = 0; k < Math.max(2, Math.round(seg / 1.5)); k++) {
      inst('arrSheerI', UNIT_BOX, MAT.sheer,
        mat4(B.x0 + .3, 1.5, z0 + .7 + k * 1.5, .1, 2.7, 1.05));
    }
  }
  /* the two folded-back leaves parked at the opening's jambs */
  for (const lz of [LG.z0 + .5, LG.z1 - .5]) {
    inst('glass', UNIT_BOX, MAT.glass, mat4(B.x0 + .35, 1.5, lz, .06, 2.85, .95));
    inst('darkI', UNIT_BOX, MAT.dark, mat4(B.x0 + .35, 2.95, lz, .1, .1, .99));
  }
  /* the DARK LOUVRE BAND above the glass, under the balcony (the photo's line) */
  for (let y = 3.04; y < CY - .01; y += .09) {
    inst('arrLouvreI', UNIT_BOX, MAT.dark, mat4(B.x0 - .12, y, bcz, .1, .05, bd - .5));
  }
  /* the CHARCOAL STONE PIER with the lounge's own plaque */
  const pierZ = B.z1 - 3.6, pierD = 4.6;
  inst('arrPierI', UNIT_BOX, MAT.charcoal, mat4(B.x0 - .05, 1.62, pierZ, .3, 3.24, pierD));
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
  const chair = (cx, cy, cz, cry) => {
    inst('arrChairI', UNIT_BOX, MAT.rattan, mat4(cx, cy + .43, cz, .46, .07, .46, cry));
    inst('arrChairI', UNIT_BOX, MAT.rattan, mat4(cx, cy + .68, cz - .21, .46, .5, .06, cry));
    for (const [lx, lz] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) {
      inst('arrChairI', UNIT_BOX, MAT.dark,
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
    inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(cx, .74, cz, w, .07, d));
    inst('arrTableI', UNIT_BOX, MAT.dark, mat4(cx, .37, cz, .12, .74, .12));
    inst('arrTableI', UNIT_BOX, MAT.dark, mat4(cx, .03, cz, .7, .06, .7));
    inst('arrWareI', UNIT_CYL, MAT.white, mat4(cx, .82, cz, .12, .12, .12));   // bud vase
    inst('arrPlantI', UNIT_BLOB, MAT.plantFlat, mat4(cx, .95, cz, .22, .2, .22),
      new THREE.Color(0xecd7ae));
    const off = seats === 4 ? [[-.55, 0], [.55, 0], [0, -.62], [0, .62]] : [[-.62, 0], [.62, 0]];
    for (const [ox, oz] of off) {
      chair(cx + ox * 1.35, 0, cz + oz * 1.35, Math.atan2(-ox, -oz));
      setting(cx + ox * .42, .76, cz + oz * .42);
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
    inst('arrBanqI', UNIT_BOX, MAT.ivory, mat4(B.x1 - 1.0, .24, bz, 1.1, .48, 3.4));
    inst('arrBanqI', UNIT_BOX, MAT.ivory, mat4(B.x1 - .55, .78, bz, .2, .62, 3.4));
    inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(B.x1 - 2.4, .74, bz, 1.4, .07, .9));
    inst('arrTableI', UNIT_BOX, MAT.dark, mat4(B.x1 - 2.4, .37, bz, .12, .74, .12));
    for (const oz of [-.6, .6]) chair(B.x1 - 3.3, 0, bz + oz, -Math.PI / 2);
    setting(B.x1 - 2.4, .76, bz - .2);
    setting(B.x1 - 2.4, .76, bz + .2);
    covers += 4;
  }
  void covers;                                  // 60 covers, per the hotel's spec
  colliderLine(C, B.x1 - 1.6, B.z0 + 1.4, B.x1 - 1.6, B.z1 - 1.4, .3, BELOW);
  /* the buffet / service counter, in the SOUTH-EAST corner. ⚠ It sat over the
     internal stair's mouth in the first cut and stopped the climb dead at
     0.80 m; AR.INTS reaches x 39.5, so the counter starts east of that. */
  const bufX = B.x1 - 2.4, bufZ = B.z1 - 1.15;
  inst('arrCounterI', UNIT_BOX, MAT.rtDarkTeak, mat4(bufX, .5, bufZ, 3.8, 1.0, .8));
  inst('arrCounterI', UNIT_BOX, MAT.marble, mat4(bufX, 1.03, bufZ, 4.0, .07, .95));
  for (let k = 0; k < 4; k++) {
    inst('arrWareI', UNIT_CYL, MAT.white,
      mat4(bufX - 1.4 + k * .95, 1.14, bufZ - .1, .34, .16, .34));
  }
  inst('glowI', UNIT_BOX, MAT.loungeGlow, mat4(bufX, 1.9, bufZ + .3, 3.6, .07, .1));
  rectCollider(C, bufX, bufZ, 4.2, 1.1, 0, .3, BELOW);

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
  box(g, lw, .1, ld, lcx, LY - .05, lcz, MAT.lobbyFloor);
  box(g, lw - .3, .1, ld - .3, lcx, LY + AR.lobbyH - .06, lcz, MAT.slatCeil);
  for (let k = 0; k < 12; k++) {
    inst('arrDownI', UNIT_BOX, MAT.arrDown,
      mat4(LB.x0 + 2.2 + (k % 3) * 3.2, LY + AR.lobbyH - .12,
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
    const seat = P(0, 0);
    inst('arrSofaI', UNIT_BOX, MAT.ivory, mat4(seat[0], LY + .30, seat[1], len, .30, .95, cry));
    const back = P(0, -.42);
    inst('arrSofaI', UNIT_BOX, MAT.ivory, mat4(back[0], LY + .62, back[1], len, .66, .18, cry));
    for (let k = 0; k < Math.round(len / .9); k++) {
      const px = -len / 2 + .55 + k * .9;
      const p = P(px, -.28);
      inst('arrCushI', UNIT_BOX, MAT.ivoryWarm,
        mat4(p[0], LY + .68, p[1], .52, .52, .2, cry + (rnd() - .5) * .2));
    }
    for (const lx of [-len / 2 + .18, len / 2 - .18]) {
      for (const lz of [-.38, .38]) {
        const p = P(lx, lz);
        inst('arrSofaI', UNIT_BOX, MAT.white, mat4(p[0], LY + .075, p[1], .07, .15, .07, cry));
      }
    }
    /* ⚠ ABOVE, for the mirror-image reason the lounge's furniture is BELOW:
       the 酒廊 is 3.6 m underneath and a sofa registered at every height is a
       sofa standing in the middle of the breakfast room. */
    rectCollider(C, cx, cz, len + .3, 1.1, cry, .28, ABOVE);
  };
  const lowTable = (cx, cz) => {
    inst('arrTableI', UNIT_BOX, MAT.rtDarkTeak, mat4(cx, LY + .34, cz, 1.5, .1, .9));
    inst('arrTableI', UNIT_BOX, MAT.dark, mat4(cx, LY + .16, cz, 1.3, .28, .74));
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
    const n = Math.max(2, Math.round(seg / 1.15));
    for (let k = 0; k <= n; k++) {
      inst('darkI', UNIT_BOX, MAT.dark, mat4(LB.x0 - .02, LY + 1.45, z0 + seg * k / n, .16, 2.86, .11));
    }
    inst('darkI', UNIT_BOX, MAT.dark, mat4(LB.x0, LY + 2.92, (z0 + z1) / 2, .2, .16, seg));
    /* the dark horizontal louvre/transom panel above the glass */
    for (let y = LY + 3.0; y < LY + AR.lobbyH - .12; y += .1) {
      inst('arrLouvreI', UNIT_BOX, MAT.dark, mat4(LB.x0 - .1, y, (z0 + z1) / 2, .1, .055, seg));
    }
    for (let k = 0; k < Math.max(2, Math.round(seg / 1.6)); k++) {
      inst('arrSheerI', UNIT_BOX, MAT.sheer,
        mat4(LB.x0 + .3, LY + 1.45, z0 + .8 + k * 1.6, .1, 2.6, 1.1));
    }
    colliderLine(C, LB.x0, z0, LB.x0, z1, .3, ABOVE);
  }
  /* one warm timber panel bay in the upper facade, beside the glass (photo) */
  inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
    mat4(LB.x0 - .16, LY + 1.6, LB.z1 - 3.6, .12, 3.1, 4.4));

  /* ══════════════════════════════════════════════════════════════════════
     G · THE BALCONY — cantilevered, frameless glass, flat stone capping
     ══════════════════════════════════════════════════════════════════════ */
  box(g, BC.x1 - BC.x0, .3, ld + .6, (BC.x0 + BC.x1) / 2, LY - .17, lcz, MAT.blackPolish);
  /* the stone FASCIA BEAM under it, and the warm timber soffit inboard */
  inst('arrCapI', UNIT_BOX, MAT.stoneCap,
    mat4(BC.x0 - .06, LY - .30, lcz, .28, .56, ld + .7));
  inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
    mat4((BC.x0 + BC.x1) / 2, LY - .34, lcz, BC.x1 - BC.x0 - .3, .1, ld + .4));
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
    inst('arrCapI', UNIT_BOX, MAT.stoneCap,
      mat4((x1 + x2) / 2, LY + 1.08, (z1 + z2) / 2, .26, .1, len + .1, ry));
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
    for (let k = 0; k < 4; k++) {
      inst('arrCabI', UNIT_BOX, MAT.cabinet,
        mat4(DX - DLEN / 2 + .05 + (k + .5) * (DLEN + .8) / 4, LY + 1.55, CABZ,
          (DLEN + .8) / 4 - .05, 3.0, .12));
    }
    inst('arrCabI', UNIT_BOX, MAT.rtDarkTeak,
      mat4(DX, LY + .04, CABZ, DLEN + .9, .08, .16));             // its dark plinth
    /* the counter: solid dark timber top over a vertical slat front */
    inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + 1.06, DZ, DLEN, .09, .78));
    inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + .55, DZ - .36, DLEN, 1.02, .07));
    inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak, mat4(DX, LY + .55, DZ + .36, DLEN, 1.02, .07));
    for (const s of [-1, 1]) {
      inst('arrDeskI', UNIT_BOX, MAT.rtDarkTeak,
        mat4(DX + s * DLEN / 2, LY + .55, DZ, .07, 1.02, .78));
    }
    for (let k = 0; k < Math.round(DLEN / .11); k++) {           // the bamboo slats
      inst('arrSlatI', UNIT_BOX, MAT.slatWarm,
        mat4(DX - DLEN / 2 + .1 + k * .11, LY + .53, DZ + .40, .045, .94, .045));
    }
    /* the monitor, the shaded lamp, and the white bowl of dried flowers */
    inst('arrDeskI', UNIT_BOX, MAT.dark, mat4(DX + 1.2, LY + 1.36, DZ - .1, .06, .5, .78));
    inst('arrDeskI', UNIT_BOX, MAT.dark, mat4(DX + 1.2, LY + 1.12, DZ - .1, .2, .06, .3));
    inst('arrLampI', UNIT_CYL, MAT.dark, mat4(DX + .2, LY + 1.24, DZ - .05, .04, .28, .04));
    inst('arrLampI', UNIT_CONE, MAT.lampShade, mat4(DX + .2, LY + 1.46, DZ - .05, .34, .3, .34));
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
      inst('arrStaffI', UNIT_BOX, MAT.uniformTop, mat4(sx, LY + 1.32, sz, .48, .62, .3, syaw));
      inst('arrStaffI', UNIT_BOX, MAT.uniformTop,
        mat4(sx - .28, LY + 1.28, sz + .06, .13, .56, .16, syaw));
      inst('arrStaffI', UNIT_BOX, MAT.uniformTop,
        mat4(sx + .28, LY + 1.28, sz + .06, .13, .56, .16, syaw));
      inst('arrStaffI', UNIT_CYL, MAT.skin, mat4(sx, LY + 1.76, sz, .23, .28, .23, syaw));
      inst('arrStaffI', UNIT_BLOB, MAT.hair, mat4(sx, LY + 1.86, sz - .02, .26, .22, .25, syaw));
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
  walkDeck(LK, MAT.blackPolish);
  walkDeck(SL, MAT.blackPolish);
  walkDeck(HD, MAT.blackPolish);
  /* the LINK's columns down to the courtyard, and its planted timber soffit */
  for (let x = LK.x0 + 2.4; x < LK.x1 - 1.0; x += 4.6) {
    for (const cz of [LK.z0 + .35, LK.z1 - .35]) {
      inst('arrColI', UNIT_CYL, MAT.charcoal, mat4(x, (LY - .32) / 2, cz, .32, LY - .32, .32));
      C.push({ x, z: cz, r: .26, y1: CY });
    }
  }
  inst('arrSoffitI', UNIT_BOX, MAT.warmSoffit,
    mat4((LK.x0 + LK.x1) / 2, LY - .34, (LK.z0 + LK.z1) / 2, LK.x1 - LK.x0, .08, LK.z1 - LK.z0 - .2));
  /* a light pergola roof over the LINK so it reads as the clubhouse's own
     covered corridor rather than as a bare bridge */
  for (let x = LK.x0 + 1.2; x < LK.x1; x += 2.3) {
    inst('arrRailI', UNIT_BOX, MAT.corten,
      mat4(x, LY + 2.62, (LK.z0 + LK.z1) / 2, .12, .18, LK.z1 - LK.z0 + .5));
  }
  inst('arrRailI', UNIT_BOX, MAT.corten,
    mat4((LK.x0 + LK.x1) / 2, LY + 2.74, LK.z0 + .1, LK.x1 - LK.x0, .16, .14));
  inst('arrRailI', UNIT_BOX, MAT.corten,
    mat4((LK.x0 + LK.x1) / 2, LY + 2.74, LK.z1 - .1, LK.x1 - LK.x0, .16, .14));

  /* balustrades. Every one carries y0 so it exists only UP HERE — the
     courtyard underneath has to stay walkable end to end. */
  const bal = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const ry = Math.atan2(x2 - x1, z2 - z1);
    inst('arrGlassRailI', UNIT_BOX, MAT.clear,
      mat4((x1 + x2) / 2, LY + .53, (z1 + z2) / 2, .05, 1.02, len, ry));
    inst('arrRailI', UNIT_BOX, MAT.copper,
      mat4((x1 + x2) / 2, LY + 1.06, (z1 + z2) / 2, .07, .07, len, ry));
    colliderLine(C, x1, z1, x2, z2, .26, ABOVE);
  };
  bal(SL.x0, SL.z1, LK.x1, SL.z1);   // the whole south edge, slot + link
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
function daybedRow(R) {
  const C = Math.PI / 2, out = [];
  const hi = R.poolTc + R.poolTh - .038;      // clear of the cross-walk's edge
  for (let th = C - R.arcHalf + .030; th <= hi + 1e-9; th += .0486) {
    if (Math.abs(Math.abs(th - C) - R.coreArcHalf) < .045) continue;
    out.push(th);
  }
  return out;
}

/* ══ THE BAR ROOM's plan, in ONE place ══════════════════════════════════════
   buildHotelRoof() builds it and roofColliders() rings it from the SAME
   object — the lockstep rule that already governs loungerRow/daybedRow.
   Everything here is derived from the room's own bounds (barTc ± barTh), the
   bridge bearing and the head-house bearing; no typed fraction of the arc.

   The plan, off reference/photos/rooftop-bar-night.png + rooftop-bar-dusk.png:
     · segs    — the elevated caustic-clad bar volume, on the back band around
                 the old screen radius. TWO runs, because the link bridge lands
                 between them (the gap is the way in from the stair tower) and
                 the run stops short of the north head-house.
     · counter — the drinks counter at deck level in front of the long run
                 (the old central pavilion's job, moved inside the room; the
                 pavilion straddling the cross-walk is gone).
     · canopy  — the cantilevered planted canopy on ONE flared pedestal,
                 placed on the bridge bearing so arriving guests walk under it.
     · stage   — the live-band stage (Carl's ask), against the back band in
                 the north corner past the head-house.
     · tables  — two staggered arcs of dining tables (round + square) between
                 the inner rail and the counter.
     · beds    — freestanding planting beds along the inner edge.            */
function barLayout(R) {
  const C = Math.PI / 2, T = HOTEL_ROOF.tower;
  const b0 = R.barTc - R.barTh, b1 = R.barTc + R.barTh;
  const coreN = C + R.coreArcHalf;
  const segs = [[b0 + .038, T.th - .058], [T.th + .058, coreN - .052]];
  const counter = { tc: (segs[0][0] + segs[0][1]) / 2, halfTh: .036, r: 99.35 };
  const canopy = { th: T.th, r: 97.0 };
  const stage = { th: (coreN + .052 + b1 - .02) / 2, r: 100.5, halfTang: 3.5 / 100.5 };
  const tables = [];
  for (const [rr, odd] of [[93.9, 0], [97.7, 1]]) {
    const pitch = 5.4 / rr;
    for (let th = b0 + .062 + odd * pitch / 2; th <= b1 - .062 + 1e-9; th += pitch) {
      if (Math.abs(th - canopy.th) < .055) continue;          // under the canopy
      if (rr > 96 && th > stage.th - stage.halfTang - .058) continue;   // the stage front
      tables.push({ th, r: rr, round: tables.length % 2 === 0 });
    }
  }
  const beds = [];
  for (let th = b0 + .11; th <= b1 - .11 + 1e-9; th += .165) beds.push({ th, r: 91.75 });
  return { b0, b1, segs, counter, canopy, stage, tables, beds };
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
  const p0 = R.poolTc - R.poolTh, p1 = R.poolTc + R.poolTh;  // the pool room
  const b0 = R.barTc - R.barTh, b1 = R.barTc + R.barTh;      // the bar room
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

  /* ── the deck, as edge-to-edge bands — never stacked, and now FOUR floors:
        · a0…p0        the south apron: the full pool-side section, as before
        · p0…p1        the POOL room: nothing between rIn and the water but the
                       lip; coping → teak → back paving inland of it
        · p1…b0        the CROSS-WALK: one paved band, rail ledge to back band
        · b0…b1        the BAR room: dark timber boards the whole way (refs)
        · b1…a1        the north apron: plain paving closing the terrace  ── */
  for (const [s, e] of [[a0, p0], [p1, a1]]) {
    band(R.rIn, LEDGE, s, e, DY, MAT.rtCoping, 1.6);           // balustrade ledge
  }
  band(LEDGE, R.poolOut, a0, p0, DY, MAT.rtPave, 1);           // the brunch apron
  band(R.poolOut, 97.2, a0, p1, DY, MAT.rtCoping, 1.6);        // pool coping
  band(97.2, R.teakOut, a0, p1, DY, MAT.rtTeak, 6);            // the timber deck
  band(R.teakOut, R.rOut, a0, p1, DY, MAT.rtPave, 1);          // back paving
  band(LEDGE, R.rOut, p1, b0, DY, MAT.rtPave, 1);              // THE CROSS-WALK
  band(LEDGE, R.rOut, b0, b1, DY, MAT.rtDarkTeak, 6);          // THE BAR ROOM's boards
  band(LEDGE, R.rOut, b1, a1, DY, MAT.rtPave, 1);              // north closing apron

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
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + .17, z, .82, .34, 2.05, th));
    inst('rtMarbleI', UNIT_BOX, MAT.marble, mat4(x, DY + .40, z, .74, .13, 1.9, th));
    const bx = WX(th, R.loungeR + .92), bz = WZ(th, R.loungeR + .92);
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(bx, DY + .58, bz, .82, .62, .13, th, .5));
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
      inst('poleI', UNIT_CYL, MAT.dark, mat4(px, DY + 1.25, pz, .11, 2.5, .11));
      inst('rtUmbI', UNIT_CONE, MAT.umbrella, mat4(px, DY + 2.72, pz, 3.5, .8, 3.5));
    }
  });

  /* ── deck lanterns along the back of the teak, ~8 m apart — pool side only;
        the bar room lights itself (candles, bed strips, the caustic wash) ── */
  const lantN = Math.max(4, Math.round((p1 - a0) * 99.9 / 8.26));
  for (let i = 0; i < lantN; i++) {
    const th = a0 + (p1 - a0) * ((i + .5) / lantN);
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
     screen is a SINGLE draw call.

     ⚠ POOL HALF ONLY since the two-rooms split — over the bar room the
     elevated bar volume IS the back-band elevation, and two competing screens
     would read as scaffolding. The run stops at the cross-walk's edge.

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
    inst('hedgeI', UNIT_BLOB, MAT.hedge,
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

  /* ── the hero: the elevated bar volume on its splayed tree-columns.
        Per clad bay: a dark body box + recessed white cap, caustic panels on
        BOTH faces (the east face reads from fly mode), a flared column every
        second bay with a warm soffit light between — panel planes stand
        ≥140 mm off the body faces, the coplanar-overlay rule. Panels use
        alternating heights so the top reads as the refs' crenellation. ── */
  const BAY = 1.62, RV = 101.55;              // clad bay (m) · volume centre radius
  const PANEL_H = [0, .75, .3, 1.05, .15, .9, .45, 1.2];   // + base 4.7 m
  for (const [s, e] of BL.segs) {
    const n = Math.max(4, Math.round((e - s) * RV / BAY));
    const dth = (e - s) / n;
    /* end caps — without them each segment ends on the bays' bare dark body,
       a black monolith from inside the room. Caustic panels, like the faces. */
    for (const tq of [s - .0008, e + .0008]) {
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(tq, RV), DY + 4.9, WZ(tq, RV), .12, 4.9, 2.85, tq));
    }
    for (let i = 0; i < n; i++) {
      const th = s + (i + .5) * dth;
      inst('darkI', UNIT_BOX, MAT.dark,
        mat4(WX(th, RV), DY + 4.63, WZ(th, RV), BAY + .06, 4.15, 2.4, th));
      inst('rtWhiteI', UNIT_BOX, MAT.white,
        mat4(WX(th, RV), DY + 6.83, WZ(th, RV), BAY + .06, .30, 2.5, th));
      const h = 4.7 + PANEL_H[i % PANEL_H.length];
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(th, 100.15), DY + 2.45 + h / 2, WZ(th, 100.15), BAY - .10, h, .12, th));
      inst('rtBarPanelI', UNIT_BOX, MAT.rtBarPanel,
        mat4(WX(th, 102.95), DY + 2.45 + h / 2, WZ(th, 102.95), BAY - .10, h, .12, th));
      if (i % 2 === 0) {                      // the flared tree-column
        inst('rtWhiteCylI', UNIT_CYL, MAT.white,
          mat4(WX(th, 100.6), DY + .85, WZ(th, 100.6), .52, 1.7, .52));
        inst('rtWhiteConeI', UNIT_CONE, MAT.white,
          mat4(WX(th, 100.6), DY + 2.12, WZ(th, 100.6), 2.0, .85, 2.0, th, Math.PI));
        inst('poleI', UNIT_CYL, MAT.dark,     // plain prop on the back row
          mat4(WX(th, 102.7), DY + 1.28, WZ(th, 102.7), .6, 2.55, .6));
      } else {                                // warm soffit light between columns
        inst('glowI', UNIT_BOX, MAT.glowLamp,
          mat4(WX(th, 100.9), DY + 2.38, WZ(th, 100.9), 1.35, .10, .5, th));
        /* a planted base under the colonnade line, uplight strip stood
           170 mm proud of its face (the 285 m depth buffer resolves ~60 mm) */
        inst('darkI', UNIT_BOX, MAT.dark,
          mat4(WX(th, 100.3), DY + .34, WZ(th, 100.3), 1.30, .68, .9, th));
        inst('hedgeI', UNIT_BLOB, MAT.hedge,
          mat4(WX(th, 100.35), DY + .95, WZ(th, 100.35), 1.6, .95, 1.2));
        inst('inLightI', UNIT_BOX, MAT.inLight,
          mat4(WX(th, 99.68), DY + .10, WZ(th, 99.68), 1.30, .09, .10, th));
      }
    }
  }

  /* ── the counter, at deck level in front of the long run — the deleted
        central pavilion's function, and its ONE warm point light ── */
  const CT = BL.counter, ctD = 1.55 / CT.r;
  pointLight(g, Math.sin(CT.tc) * (CT.r + .6), DY + 2.2, Math.cos(CT.tc) * (CT.r + .6), 0, 38, 26);
  for (let k = 0; k < 5; k++) {
    const th = CT.tc + (k - 2) * ctD;
    const x = WX(th, CT.r), z = WZ(th, CT.r);
    inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak, mat4(x, DY + .53, z, 1.5, 1.06, .9, th));
    inst('rtMarbleI', UNIT_BOX, MAT.marble, mat4(x, DY + 1.09, z, 1.62, .1, 1.02, th));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + .18, z, 1.35, .1, .12, th));
    /* a proper barstool in the dining furniture's language (same pass:
       pedestal, timber band, white cushion) — foot disc, column, a timber
       footrest ring and seat band with the round white cushion on top.
       Seat top DY + .82 against the DY + 1.14 counter top. Same position
       (sth, r 98.55) and count as the old pole+slab; every part rides an
       existing bucket (poleI / rtSlatCylI / rtWhiteCylI) so the room's
       draw calls and colliders do not move. */
    const sth = th + ctD * .25;                                             // a stool
    const stx = WX(sth, 98.55), stz = WZ(sth, 98.55);
    inst('poleI', UNIT_CYL, MAT.dark, mat4(stx, DY + .025, stz, .44, .05, .44));       // foot disc
    inst('poleI', UNIT_CYL, MAT.dark, mat4(stx, DY + .36, stz, .11, .62, .11));        // pedestal
    inst('rtSlatCylI', UNIT_CYL, MAT.slat, mat4(stx, DY + .26, stz, .34, .045, .34));  // footrest ring
    inst('rtSlatCylI', UNIT_CYL, MAT.slat, mat4(stx, DY + .70, stz, .46, .06, .46));   // seat band
    inst('rtWhiteCylI', UNIT_CYL, MAT.white, mat4(stx, DY + .775, stz, .42, .09, .42)); // cushion
  }
  for (let k = 0; k < 3; k++) {               // the lit back-bar shelves, 150 mm
    const th = CT.tc + (k - 1) * ctD * 1.6;   // proud of the panel plane
    inst('inLightI', UNIT_BOX, MAT.inLight,
      mat4(WX(th, 99.88), DY + 1.6, WZ(th, 99.88), 2.2, .09, .12, th));
    inst('inLightI', UNIT_BOX, MAT.inLight,
      mat4(WX(th, 99.88), DY + 2.15, WZ(th, 99.88), 2.2, .09, .12, th));
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
        stay; zero lights added; the only new bucket is the round tables'
        slat-toned cylinder (rtSlatCylI), +1 draw call for the whole room. ── */
  const rndSeat = mulberry32(83017);
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
      /* chair-local frame under mat4's ry = ca: +X is outward (away from the
         table, behind the sitter), +Z runs across the seat */
      const ux = Math.cos(ca), uz = -Math.sin(ca);
      const vx = Math.sin(ca), vz = Math.cos(ca);
      const cx1 = x + ux * cd, cz1 = z + uz * cd;
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
      inst('rtWhiteCylI', UNIT_CYL, MAT.white,                               // the plate
        mat4(x + ux * .42, DY + .795, z + uz * .42, .27, .018, .27));
    }
  }

  /* ── freestanding planting beds along the inner edge, warm strips on the
        room-facing side, stood 175 mm proud ── */
  for (const b of BL.beds) {
    const x = WX(b.th, b.r), z = WZ(b.th, b.r);
    inst('darkI', UNIT_BOX, MAT.dark, mat4(x, DY + .30, z, 2.4, .6, .85, b.th));
    inst('hedgeI', UNIT_BLOB, MAT.hedge, mat4(x, DY + .92, z, 2.7, 1.0, 1.05));
    inst('inLightI', UNIT_BOX, MAT.inLight,
      mat4(WX(b.th, b.r + .60), DY + .10, WZ(b.th, b.r + .60), 2.2, .09, .10, b.th));
  }

  /* ── the cantilevered planted canopy on ONE flared pedestal (refs, right of
        frame) — on the bridge bearing, so arriving guests walk in under it ── */
  {
    const x = WX(BL.canopy.th, BL.canopy.r), z = WZ(BL.canopy.th, BL.canopy.r);
    inst('rtWhiteCylI', UNIT_CYL, MAT.white, mat4(x, DY + 1.15, z, .95, 2.3, .95));
    inst('rtWhiteConeI', UNIT_CONE, MAT.white,
      mat4(x, DY + 2.72, z, 3.1, .85, 3.1, BL.canopy.th, Math.PI));
    inst('rtWhiteI', UNIT_BOX, MAT.white, mat4(x, DY + 3.32, z, 6.2, .28, 5.2, BL.canopy.th));
    inst('glowI', UNIT_BOX, MAT.glowLamp, mat4(x, DY + 2.98, z, 1.8, .08, 1.8, BL.canopy.th));
    inst('hedgeI', UNIT_BLOB, MAT.hedge, mat4(x, DY + 3.75, z, 5.6, .8, 4.6));
    for (const [u, v] of [[-2.9, 0], [2.9, 0], [0, -2.4], [0, 2.4], [-2.4, -2.0], [2.4, 2.0]]) {
      inst('hedgeI', UNIT_BLOB, MAT.hedge,      // greenery trailing off the edge
        mat4(TX(BL.canopy.th, BL.canopy.r + v, u), DY + 3.05,
          TZ(BL.canopy.th, BL.canopy.r + v, u), 1.0, 1.5, .7, BL.canopy.th));
    }
  }

  /* ── the live-band stage (Carl's ask): a low platform against the back
        band past the north head-house, with a modest dark backline ── */
  {
    const ST = BL.stage, sx = (r, v) => TX(ST.th, r, v), sz = (r, v) => TZ(ST.th, r, v);
    inst('darkI', UNIT_BOX, MAT.dark, mat4(WX(ST.th, ST.r), DY + .21, WZ(ST.th, ST.r), 7.0, .42, 4.0, ST.th));
    inst('rtDkI', UNIT_BOX, MAT.rtDarkTeak, mat4(WX(ST.th, ST.r), DY + .45, WZ(ST.th, ST.r), 6.9, .06, 3.9, ST.th));
    for (const u of [-2.6, 2.6]) {              // amp stacks
      inst('darkI', UNIT_BOX, MAT.dark, mat4(sx(ST.r + 1.4, u), DY + .93, sz(ST.r + 1.4, u), .8, .9, .55, ST.th));
    }
    inst('darkI', UNIT_BOX, MAT.dark, mat4(sx(ST.r + 1.2, 0), DY + .93, sz(ST.r + 1.2, 0), 1.5, .9, .9, ST.th));
    for (const u of [-1.6, 0, 1.6]) {           // mic stands
      inst('poleI', UNIT_CYL, MAT.dark, mat4(sx(ST.r - 1.1, u), DY + 1.23, sz(ST.r - 1.1, u), .05, 1.5, .05));
      inst('darkI', UNIT_BOX, MAT.dark, mat4(sx(ST.r - 1.1, u), DY + 2.0, sz(ST.r - 1.1, u), .18, .1, .18, ST.th));
    }
    for (const u of [-1.2, 1.2]) {              // monitor wedges on the lip
      inst('darkI', UNIT_BOX, MAT.dark, mat4(sx(ST.r - 1.7, u), DY + .62, sz(ST.r - 1.7, u), .55, .3, .4, ST.th));
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

  /* ── THE BAR ROOM — every solid from the SAME barLayout(R) the builder
        reads. (The old central pavilion's counter arc at C ± barArcHalf is
        gone with the pavilion.) All ROOF-ranged: an unranged circle here is
        an invisible wall at grade where the fly-in path runs.
        The volume chain is FAT circles at r 101.4: they block the whole band
        from ~99.05 out to past the outer rail, so there is no walkable
        sliver behind the volume, and they stop at each segment's end so the
        bridge gap stays open — that gap is the way IN from the stair. ── */
  const BL = barLayout(R);
  for (const [s, e] of BL.segs) arc(101.4, s + .010, e - .010, 1.9, ROOF);
  arc(BL.counter.r, BL.counter.tc - BL.counter.halfTh,
    BL.counter.tc + BL.counter.halfTh, .55, ROOF);            // the counter
  L.push({ x: WX(BL.canopy.th, BL.canopy.r), z: WZ(BL.canopy.th, BL.canopy.r),
    r: .95, ...ROOF });                                       // the canopy pedestal
  arc(BL.stage.r, BL.stage.th - BL.stage.halfTang + .006,
    BL.stage.th + BL.stage.halfTang - .006, 1.55, ROOF);      // the stage
  for (const t of BL.tables) {                                // dining tables
    L.push({ x: WX(t.th, t.r), z: WZ(t.th, t.r), r: .95, ...ROOF });
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
  inst('hedgeI', UNIT_BLOB, MAT.hedge, mat4(FC.x, .95, FC.z, 3.2, 1.7, 3.2));

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
  buildGrassGround(G);
  buildPlaza(G, root);
  buildPergola(G, root);
  /* the arrival pavilion parents its unique meshes INSIDE the adopted 'sign'
     group so they ride the enclave transform — see buildArrival's banner */
  buildArrival(G, buildSign(G, root), rnd);
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
