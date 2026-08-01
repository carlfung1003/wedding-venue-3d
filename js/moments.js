// The five moments of the wedding day. Each moment owns a prop group + a
// collider list; dress() shows one group and hides the rest. The ballroom is
// SHARED by Ceremony and Wedding Dinner with different dressing — that's the
// whole mechanic. Groups are built ONCE here and toggled with .visible.
import * as THREE from 'three';
import { CFG } from './config.js';
import { M } from './materials.js';
import { setFacing, syncCamera } from './player.js';

/* ── tiny prop builders — recognizable silhouettes only ── */
function chair(seatMat = M.linen, frameMat = M.gold) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.44, .06, .44), seatMat);
  seat.position.y = .45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(.44, .5, .05), frameMat);
  back.position.set(0, .73, -.2);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.08, .45, .08), frameMat);
  legs.position.y = .22;
  g.add(seat, back, legs);
  return g;   // faces +z (back on the -z side)
}

function roundTable() {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.12, .3, .72, 10), M.dark);
  ped.position.y = .36;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .05, 22), M.linen);
  top.position.y = .74;
  const centerpiece = new THREE.Mesh(new THREE.CylinderGeometry(.07, .05, .3, 8), M.gold);
  centerpiece.position.y = .9;
  const bloom = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), M.blush);
  bloom.position.y = 1.1;
  g.add(ped, top, centerpiece, bloom);
  return g;
}

function hightop() {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(.06, .22, 1.06, 10), M.dark);
  ped.position.y = .53;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .04, 18), M.linen);
  top.position.y = 1.08;
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .12, 6), M.gold);
  candle.position.y = 1.16;
  g.add(ped, top, candle);
  return g;
}

function sofa(mat = M.blush) {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, .42, .75), mat);
  seat.position.y = .21;
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, .5, .2), mat);
  back.position.set(0, .62, -.27);
  g.add(seat, back);
  return g;   // faces +z
}

function put(group, mesh, x, z, ry = 0) {
  mesh.position.x = x; mesh.position.z = z;
  mesh.rotation.y = ry;
  group.add(mesh);
  return mesh;
}

/* module-level FX handles for updateMoments */
const FX = {};

export function initMoments(G) {
  const S = G.scene;
  const bz = CFG.BALLROOM.L / 2, bx = CFG.BALLROOM.W / 2;
  const staticColliders = G.colliders.slice();   // world walls/columns, snapshotted before dressing
  const groups = {}, cols = {};

  for (const m of CFG.MOMENTS) {
    groups[m.id] = new THREE.Group();
    groups[m.id].visible = false;
    S.add(groups[m.id]);
    cols[m.id] = [];
  }

  /* ══ 1 · Prewedding Setup — bridal suite ══ */
  {
    const g = groups.setup, c = cols.setup;
    const vanity = put(g, new THREE.Mesh(new THREE.BoxGeometry(.5, .75, 1.4), M.wood), -14.4, 34);
    vanity.position.y = .375;
    const vm = put(g, new THREE.Mesh(new THREE.CircleGeometry(.4, 24), M.chrome), -14.62, 34);
    vm.position.y = 1.5; vm.rotation.y = Math.PI / 2;
    c.push({ x: -14.4, z: 34, r: .8 });
    // garment rack with The Dress
    for (const px of [-10, -8]) {
      const post = put(g, new THREE.Mesh(new THREE.CylinderGeometry(.03, .06, 1.8, 8), M.gold), px, 37.5);
      post.position.y = .9;
    }
    const bar = put(g, new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2, 8), M.gold), -9, 37.5);
    bar.position.y = 1.78; bar.rotation.z = Math.PI / 2;
    const dress = put(g, new THREE.Mesh(new THREE.ConeGeometry(.45, 1.3, 14), M.linen), -9, 37.5);
    dress.position.y = .95;
    const bodice = put(g, new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), M.linen), -9, 37.5);
    bodice.position.y = 1.62;
    c.push({ x: -9, z: 37.5, r: .7 });
    put(g, sofa(), -11, 30.6);   // faces into the room (+z geometry faces the rack)
    c.push({ x: -11, z: 30.6, r: 1 });
    // full-length mirror on the east wall
    const frame = put(g, new THREE.Mesh(new THREE.BoxGeometry(.08, 1.9, .8), M.gold), -7.35, 33);
    frame.position.y = 1;
    const glass = put(g, new THREE.Mesh(new THREE.BoxGeometry(.03, 1.7, .64), M.chrome), -7.3, 33);
    glass.position.y = 1;
    c.push({ x: -7.35, z: 33, r: .5 });
  }

  /* ══ 2 · Ceremony — ballroom dressed with chairs, aisle, arch ══ */
  {
    const g = groups.ceremony, c = cols.ceremony;
    const runner = put(g, new THREE.Mesh(new THREE.PlaneGeometry(2, 24), M.linen), 0, -7);
    runner.rotation.x = -Math.PI / 2; runner.position.y = .05;
    // the arch: a torus arc standing in front of the stage
    const arch = put(g, new THREE.Mesh(new THREE.TorusGeometry(2, .14, 10, 28, Math.PI), M.gold), 0, -19);
    arch.position.y = .2;
    for (const [ax, ay, mat] of [[-1.6, 1.6, M.blush], [1.7, 1.4, M.sage], [0, 2.35, M.blush]]) {
      const bloom = put(g, new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), mat), ax, -19);
      bloom.position.y = ay;
    }
    c.push({ x: -2, z: -19, r: .35 }, { x: 2, z: -19, r: .35 });
    for (let row = 0; row < 6; row++) {
      const z = -13 + row * 2.4;
      for (let k = 0; k < 5; k++) {
        for (const side of [-1, 1]) {
          const x = side * (1.7 + k * .85);
          put(g, chair(), x, z, Math.PI);   // face the stage (-z)
          c.push({ x, z, r: .28 });
        }
      }
    }
  }

  /* ══ 3 · Cocktail Hour — foyer high-tops + bar ══ */
  {
    const g = groups.cocktail, c = cols.cocktail;
    const bar = put(g, new THREE.Mesh(new THREE.BoxGeometry(8, 1.06, .7), M.wood), 21, -23.7);
    bar.position.y = .53;
    const barTop = put(g, new THREE.Mesh(new THREE.BoxGeometry(8.2, .05, .8), M.marble), 21, -23.7);
    barTop.position.y = 1.08;
    for (let i = 0; i < 9; i++) c.push({ x: 17.4 + i * .9, z: -23.7, r: .5 });
    const spots = [[18.5, -14], [24, -10], [18.5, -4], [24, 2], [18.5, 8], [23.5, 14]];
    for (const [x, z] of spots) {
      put(g, hightop(), x, z);
      c.push({ x, z, r: .55 });
    }
  }

  /* ══ 4 · Wedding Dinner — the same ballroom, re-dressed ══ */
  {
    const g = groups.dinner, c = cols.dinner;
    const floor = put(g, new THREE.Mesh(new THREE.BoxGeometry(9, .06, 7), M.wood), 0, -15.5);
    floor.position.y = .03;   // dance floor in front of the stage
    const head = put(g, new THREE.Mesh(new THREE.BoxGeometry(7, .78, 1), M.linen), 0, -22.6);
    head.position.y = CFG.STAGE.H + .39;   // head table up on the stage
    for (const x of [-6.5, 6.5]) {
      for (const z of [-7, -1, 5, 11]) {
        put(g, roundTable(), x, z);
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * Math.PI * 2;
          const cx = x + Math.sin(a) * 1.3, cz = z + Math.cos(a) * 1.3;
          put(g, chair(M.linen, M.dark), cx, cz, a + Math.PI);   // face the table
        }
        c.push({ x, z, r: 1.7 });   // one collider covers table + its ring of ten
      }
    }
  }

  /* ══ 5 · After Party — terrace, DJ + mirror ball + lounges ══ */
  {
    const g = groups.afterparty, c = cols.afterparty;
    const booth = put(g, new THREE.Mesh(new THREE.BoxGeometry(.8, 1.1, 2.4), M.dark), 42.8, 0);
    booth.position.y = .55;
    FX.djGlow = put(g, new THREE.Mesh(new THREE.BoxGeometry(.06, .9, 2.2), M.gold.clone()), 42.35, 0);
    FX.djGlow.position.y = .55;
    const deck = put(g, new THREE.Mesh(new THREE.BoxGeometry(.5, .06, 1.2), M.chrome), 42.7, 0);
    deck.position.y = 1.13;
    c.push({ x: 42.8, z: -.8, r: .7 }, { x: 42.8, z: .8, r: .7 });
    for (const z of [-2.2, 2.2]) {
      const spk = put(g, new THREE.Mesh(new THREE.BoxGeometry(.6, 1.3, .5), M.dark), 42.6, z);
      spk.position.y = .65;
      c.push({ x: 42.6, z, r: .5 });
    }
    const pole = put(g, new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, 3.2, 8), M.dark), 38, 0);
    pole.position.y = 1.6;
    FX.ball = put(g, new THREE.Mesh(new THREE.SphereGeometry(.35, 18, 12), M.chrome), 38, 0);
    FX.ball.position.y = 2.95;
    c.push({ x: 38, z: 0, r: .25 });
    for (const [z, ry] of [[-10.5, 0], [10.5, Math.PI]]) {
      put(g, sofa(M.dark), 31, z, ry);   // lounges face the floor
      c.push({ x: 31, z, r: 1 });
    }
  }

  /* ── one interactable per moment, gated on that moment being live ── */
  const when = i => () => G.momentIndex === i;
  G.interactables.push(
    { x: -7.35, z: 33, r: .5, label: () => 'Check the mirror',
      use: () => G.ui.toast('Deep breath. Everyone out there came for you two.', 3), enabled: when(0) },
    { x: 0, z: -19, r: 1, label: () => 'Stand at the altar',
      use: () => G.ui.toast('This is where the "I do" happens. 💍', 3), enabled: when(1) },
    { x: 21, z: -23.7, r: 4.1, label: () => 'Order a signature cocktail',
      use: () => G.ui.toast('🥂 One Yuzu 75, coming right up.', 3), enabled: when(2) },
    { x: 0, z: -15.5, r: 2, label: () => 'Take the first dance',
      use: () => G.ui.toast('The parquet is yours — everyone else joins after the second song.', 3.2), enabled: when(3) },
    { x: 42.8, z: 0, r: 1.4, label: () => 'Drop a request',
      use: () => G.ui.toast('🎧 The DJ nods. It was always going to be this song.', 3), enabled: when(4) },
  );

  /* ── the switcher: dress the venue, swap colliders, teleport ── */
  G.momentIndex = -1;
  G.setMoment = (idx, opts = {}) => {
    const m = CFG.MOMENTS[idx];
    if (!m || idx === G.momentIndex) return;
    G.momentIndex = idx;
    for (const mm of CFG.MOMENTS) groups[mm.id].visible = mm === m;
    G.colliders.length = 0;
    G.colliders.push(...staticColliders, ...cols[m.id]);
    G.setMode?.('walk', { quiet: true });   // spawns are authored as ground positions
    G.player.pos.set(m.spawn.x, CFG.EYE_HEIGHT, m.spawn.z);
    setFacing(m.spawn.yaw);
    syncCamera(G);
    G.ui.setMoment(m, idx);
    if (!opts.quiet) G.ui.toast(m.blurb, 4);
  };
}

export function updateMoments(G, dt, time) {
  if (G.momentIndex !== 4) return;
  FX.ball.rotation.y += dt * 1.1;
  FX.djGlow.material.emissiveIntensity = .55 + Math.sin(time * 5.2) * .35;
}
