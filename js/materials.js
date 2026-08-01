// Every CanvasTexture recipe lives here; the shared material set is exported
// as one M.* object (house pattern, from alice-lunch-party).
import * as THREE from 'three';

/* ── seeded PRNG — never Math.random() for placement or noise (house rule) ── */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ── canvas texture plumbing ── */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;   // color maps only — house rule
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/* ── ballroom carpet: deep plum with a subtle champagne damask dot grid ── */
function carpetTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#33222e'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(7101);
    for (let i = 0; i < 900; i++) {   // pile mottle
      g.fillStyle = `rgba(${28 + rnd() * 26 | 0},${14 + rnd() * 16 | 0},${26 + rnd() * 22 | 0},.2)`;
      g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 5, 2 + rnd() * 5);
    }
    const s = 64;
    g.strokeStyle = 'rgba(216,180,106,.13)';   // diamond lattice
    g.lineWidth = 1.4;
    for (let y = -1; y <= h / s; y++) for (let x = -1; x <= w / s; x++) {
      const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s;
      g.beginPath();
      g.moveTo(cx, cy - s / 2); g.lineTo(cx + s / 2, cy);
      g.lineTo(cx, cy + s / 2); g.lineTo(cx - s / 2, cy);
      g.closePath(); g.stroke();
    }
    g.fillStyle = 'rgba(216,180,106,.45)';     // champagne dots on the lattice points
    for (let y = -1; y <= h / s; y++) for (let x = -1; x <= w / s; x++) {
      const cx = x * s + (y % 2 ? s / 2 : 0), cy = y * s;
      g.beginPath(); g.arc(cx, cy, 3, 0, 7); g.fill();
    }
  }, [8, 13]);
}

/* ── marble: warm off-white tiles with faint grey veining ── */
function marbleTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(3301);
    for (let i = 0; i < 20; i++) {
      g.strokeStyle = `rgba(138,130,118,${.08 + rnd() * .14})`;
      g.lineWidth = .7 + rnd() * 1.6;
      g.beginPath();
      let x = rnd() * w, y = rnd() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 5; k++) {
        const nx = x + (rnd() - .5) * 190, ny = y + (rnd() - .5) * 190;
        g.quadraticCurveTo(x + (rnd() - .5) * 70, y + (rnd() - .5) * 70, nx, ny);
        x = nx; y = ny;
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(120,110,96,.28)';    // tile joints (2×2 per texture repeat)
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.moveTo(1, 1); g.rect(1, 1, w - 2, h - 2);
    g.stroke();
  }, [10, 10]);
}

/* ── wall panels: warm cream with paneling lines and a wainscot band ── */
function wallTex() {
  return tex(512, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#e9dfca'); grad.addColorStop(1, '#ddd0b6');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 128) {         // panel seams
      g.strokeStyle = 'rgba(120,100,70,.18)'; g.lineWidth = 2;
      g.strokeRect(x + 14, 24, 100, h * .56);
      g.strokeStyle = 'rgba(255,248,230,.5)'; g.lineWidth = 1;
      g.strokeRect(x + 17, 27, 94, h * .56 - 6);
    }
    g.fillStyle = 'rgba(150,122,80,.2)';       // wainscot band
    g.fillRect(0, h * .8, w, h * .2);
    g.strokeStyle = 'rgba(180,148,96,.5)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, h * .8); g.lineTo(w, h * .8); g.stroke();
  }, [4, 1]);
}

/* ── wood parquet: alternating grain blocks ── */
function woodTex() {
  return tex(512, 512, (g, w, h) => {
    g.fillStyle = '#7b5a3b'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(5507), s = 64;
    for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
      const horiz = (x + y) % 2 === 0, ox = x * s, oy = y * s;
      g.fillStyle = `rgba(${90 + rnd() * 40 | 0},${62 + rnd() * 28 | 0},${36 + rnd() * 18 | 0},.55)`;
      g.fillRect(ox, oy, s, s);
      g.strokeStyle = 'rgba(48,32,18,.5)'; g.lineWidth = 1.2;
      g.strokeRect(ox + .5, oy + .5, s - 1, s - 1);
      g.strokeStyle = 'rgba(255,224,180,.12)';
      for (let k = 6; k < s; k += 9) {
        g.beginPath();
        if (horiz) { g.moveTo(ox + 2, oy + k); g.lineTo(ox + s - 2, oy + k + (rnd() - .5) * 4); }
        else { g.moveTo(ox + k, oy + 2); g.lineTo(ox + k + (rnd() - .5) * 4, oy + s - 2); }
        g.stroke();
      }
    }
  }, [6, 6]);
}

/* ── white linen: faint weave and warm shadowing ── */
function linenTex() {
  return tex(256, 256, (g, w, h) => {
    g.fillStyle = '#f3eee3'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(9109);
    g.strokeStyle = 'rgba(150,138,116,.07)'; g.lineWidth = 1;
    for (let y = 0; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(255,255,250,${.04 + rnd() * .06})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  }, [3, 3]);
}

/* ── night sky dome: gradient, seeded stars, one soft moon ── */
function skyTex() {
  return tex(1024, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05060f'); grad.addColorStop(.55, '#0b0e1e'); grad.addColorStop(1, '#191527');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(1103);
    for (let i = 0; i < 420; i++) {
      const y = rnd() * rnd() * h * .75;       // stars thin toward the horizon
      g.fillStyle = `rgba(${235 + rnd() * 20 | 0},${232 + rnd() * 18 | 0},${215 + rnd() * 30 | 0},${.25 + rnd() * .7})`;
      g.beginPath(); g.arc(rnd() * w, y, .4 + rnd() * 1.1, 0, 7); g.fill();
    }
    const mx = w * .72, my = h * .26;
    const glow = g.createRadialGradient(mx, my, 4, mx, my, 46);
    glow.addColorStop(0, 'rgba(250,244,224,.9)'); glow.addColorStop(.25, 'rgba(240,230,200,.28)');
    glow.addColorStop(1, 'rgba(240,230,200,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 46, 0, 7); g.fill();
  });
}

/* ══════════════════════════════════════════════════════════════
   the shared material set
   ══════════════════════════════════════════════════════════════ */
export const M = {
  carpet: new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: .96 }),
  marble: new THREE.MeshStandardMaterial({ map: marbleTex(), roughness: .22, metalness: .04 }),
  wall:   new THREE.MeshStandardMaterial({ map: wallTex(), roughness: .85 }),
  gold:   new THREE.MeshStandardMaterial({ color: 0xc9a35c, metalness: .8, roughness: .32,
    emissive: 0x2e2008, emissiveIntensity: .35 }),   // emissive-ish warm accent
  wood:   new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .62 }),
  linen:  new THREE.MeshStandardMaterial({ map: linenTex(), roughness: .9 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x1d1a22, roughness: .7 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: .16 }),
  blush:  new THREE.MeshStandardMaterial({ color: 0xc98a94, roughness: .8 }),
  sage:   new THREE.MeshStandardMaterial({ color: 0x9aa88a, roughness: .85 }),
  sky:    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }),
};
