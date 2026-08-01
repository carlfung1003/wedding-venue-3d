// Placeholder hotel venue — a grand ballroom, a foyer, a terrace and a bridal
// suite, all boxes and cylinders sized from CFG. The whole file is meant to be
// rebuilt from the real hotel walkthrough video when it arrives.
//
// Compass: stage at -z ("north"), foyer at +x ("east"), corridor + suite at +z.
import * as THREE from 'three';
import { CFG } from './config.js';
import { M } from './materials.js';

/* Ground height — flat 0 everywhere for now, but this stays the single source
   of truth (house pattern): stage steps, terrace decks and ramps must be
   expressed HERE, never by nudging player.pos.y. */
export function floorY(x, z) {
  return 0;
}

/* ── collider authoring: walls are chains of {x,z,r} circles ── */
function colliderLine(list, x1, z1, x2, z2, r) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(len / r));   // step ≤ r so nothing squeezes through
  for (let i = 0; i <= n; i++) {
    list.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r });
  }
}

function wall(G, x1, z1, x2, z2, h, { y0 = 0, mat = M.wall, collide = true, t = CFG.WALL_T } = {}) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, t), mat);
  mesh.position.set((x1 + x2) / 2, y0 + h / 2, (z1 + z2) / 2);
  mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  G.scene.add(mesh);
  if (collide && y0 === 0) colliderLine(G.colliders, x1, z1, x2, z2, t * 1.5);
  return mesh;
}

/* a doorway = the gap between two wall segments + a lintel over it */
function lintel(G, x1, z1, x2, z2, wallH) {
  wall(G, x1, z1, x2, z2, wallH - CFG.DOOR_H, { y0: CFG.DOOR_H, collide: false });
}

function slab(G, x, y, z, w, l, mat, t = 0.1) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, t, l), mat);
  mesh.position.set(x, y, z);
  G.scene.add(mesh);
  return mesh;
}

function pointLight(G, x, y, z, intensity, dist, color = 0xffd9a8) {
  const l = new THREE.PointLight(color, intensity, dist, 2);
  l.position.set(x, y, z);
  G.scene.add(l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe9c4 }));
  bulb.position.copy(l.position);
  G.scene.add(bulb);
  return l;
}

export function buildWorld(G) {
  const S = G.scene;
  const B = CFG.BALLROOM, F = CFG.FOYER, C = CFG.CORRIDOR, U = CFG.SUITE, T = CFG.TERRACE;
  const bx = B.W / 2, bz = B.L / 2;                       // ballroom half extents (15, 25)
  const fx2 = bx + F.W;                                   // foyer east face (27)
  const cz2 = bz + C.W;                                   // corridor south face (29)
  const sx2 = -bx + U.W, sz2 = cz2 + U.L;                 // suite east face (-7), south face (39)
  const tx2 = fx2 + T.W, tz = T.L / 2;                    // terrace east face (45), half length (13)

  /* ── sky + ground base ── */
  S.add(new THREE.Mesh(new THREE.SphereGeometry(CFG.SKY_R, 32, 16), M.sky));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(CFG.SKY_R * .98, 48), M.dark);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  S.add(ground);

  /* ── floors (each slightly above the base to avoid z-fighting) ── */
  slab(G, 0, -0.03, 0, B.W, B.L, M.carpet);                          // ballroom carpet
  slab(G, bx + F.W / 2, -0.03, 0, F.W, B.L, M.marble);               // foyer marble
  slab(G, 0, -0.03, bz + C.W / 2, B.W, C.W, M.marble);               // corridor marble
  slab(G, -bx + U.W / 2, -0.03, cz2 + U.L / 2, U.W, U.L, M.carpet);  // suite carpet
  slab(G, fx2 + T.W / 2, -0.03, 0, T.W, T.L, M.wood);                // terrace deck

  /* ── ceilings ── */
  slab(G, 0, B.H, 0, B.W + .6, B.L + .6, M.wall, .25);               // ballroom
  slab(G, bx + F.W / 2, F.H, 0, F.W + .6, B.L + .6, M.wall, .25);    // foyer
  slab(G, 0, C.H, bz + C.W / 2, B.W + .6, C.W + .6, M.wall, .25);    // corridor
  slab(G, -bx + U.W / 2, U.H, cz2 + U.L / 2, U.W + .6, U.L + .6, M.wall, .25);  // suite

  /* ── ballroom walls ── */
  wall(G, -bx, -bz, -bx, bz, B.H);                                   // west
  wall(G, -bx, -bz, bx, -bz, B.H);                                   // north (behind stage)
  wall(G, -bx, bz, -2, bz, B.H);                                     // south, west of corridor door
  wall(G, 2, bz, bx, bz, B.H);                                       // south, east of corridor door
  lintel(G, -2, bz, 2, bz, B.H);
  wall(G, bx, -bz, bx, -8, B.H);                                     // east (shared with foyer), 3 segments
  wall(G, bx, -4, bx, 4, B.H);
  wall(G, bx, 8, bx, bz, B.H);
  lintel(G, bx, -8, bx, -4, B.H);                                    // two ballroom↔foyer doorways
  lintel(G, bx, 4, bx, 8, B.H);

  /* ── foyer walls ── */
  wall(G, bx, -bz, fx2, -bz, F.H);                                   // north end
  wall(G, bx, bz, fx2, bz, F.H);                                     // south end
  wall(G, fx2, -bz, fx2, -3, F.H);                                   // east, with terrace doors at z −3..3
  wall(G, fx2, 3, fx2, bz, F.H);
  lintel(G, fx2, -3, fx2, 3, F.H);

  /* ── corridor + bridal suite ── */
  wall(G, -bx, bz, -bx, cz2, C.H);                                   // corridor west cap
  wall(G, bx, bz, bx, cz2, C.H);                                     // corridor east cap
  wall(G, -bx, cz2, -12, cz2, C.H);                                  // corridor south, west of suite door
  wall(G, -9, cz2, bx, cz2, C.H);                                    // corridor south, east of suite door
  lintel(G, -12, cz2, -9, cz2, C.H);
  wall(G, -bx, cz2, -bx, sz2, U.H);                                  // suite west
  wall(G, sx2, cz2, sx2, sz2, U.H);                                  // suite east
  wall(G, -bx, sz2, sx2, sz2, U.H);                                  // suite south

  /* ── stage (raised platform at the ballroom's north end) ── */
  const SG = CFG.STAGE;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(SG.W, SG.H, SG.D), M.wood);
  stage.position.set(0, SG.H / 2, -bz + SG.D / 2);
  S.add(stage);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(SG.W, .08, .08), M.gold);
  trim.position.set(0, SG.H, -bz + SG.D + .02);
  S.add(trim);
  // floorY is flat, so the stage blocks instead of lifts — front and side edges
  colliderLine(G.colliders, -SG.W / 2, -bz + SG.D, SG.W / 2, -bz + SG.D, .5);
  colliderLine(G.colliders, -SG.W / 2, -bz, -SG.W / 2, -bz + SG.D, .5);
  colliderLine(G.colliders, SG.W / 2, -bz, SG.W / 2, -bz + SG.D, .5);

  /* ── ballroom columns, two rows, gold capitals ── */
  const CL = CFG.COLUMN;
  const colGeo = new THREE.CylinderGeometry(CL.R, CL.R * 1.08, B.H, 14);
  const capGeo = new THREE.CylinderGeometry(CL.R * 1.35, CL.R * 1.1, .35, 14);
  for (let i = 0; i < CL.COUNT; i++) {
    const z = CL.Z0 + i * CL.SPACING;
    for (const x of [-CL.X, CL.X]) {
      const col = new THREE.Mesh(colGeo, M.marble);
      col.position.set(x, B.H / 2, z);
      S.add(col);
      const cap = new THREE.Mesh(capGeo, M.gold);
      cap.position.set(x, B.H - .35, z);
      S.add(cap);
      G.colliders.push({ x, z, r: CL.R + .1 });
    }
  }

  /* ── terrace balustrade (gap where the foyer doors open onto it) ── */
  const railOpts = { mat: M.marble, t: .2 };
  wall(G, fx2, -tz, tx2, -tz, T.RAIL_H, railOpts);
  wall(G, fx2, tz, tx2, tz, T.RAIL_H, railOpts);
  wall(G, tx2, -tz, tx2, tz, T.RAIL_H, railOpts);
  // hotel outer wall flanking the terrace doors (so the terrace reads attached)
  wall(G, fx2, -bz, fx2, -tz, F.H, { collide: false });   // colliders already exist on foyer east
  wall(G, fx2, tz, fx2, bz, F.H, { collide: false });

  /* ── string lights: sagging spans between four terrace poles ── */
  const poles = [[fx2 + 2, -tz + 1.2], [tx2 - 1.2, -tz + 1.2], [tx2 - 1.2, tz - 1.2], [fx2 + 2, tz - 1.2]];
  const poleGeo = new THREE.CylinderGeometry(.05, .07, 3.4, 8);
  for (const [px, pz] of poles) {
    const p = new THREE.Mesh(poleGeo, M.dark);
    p.position.set(px, 1.7, pz);
    S.add(p);
    G.colliders.push({ x: px, z: pz, r: .2 });
  }
  const dots = [];
  for (let s = 0; s < poles.length; s++) {
    const [ax, az] = poles[s], [bx2, bz2] = poles[(s + 1) % poles.length];
    const n = 22;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      dots.push(ax + (bx2 - ax) * t, 3.3 - Math.sin(t * Math.PI) * .55, az + (bz2 - az) * t);
    }
  }
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
  S.add(new THREE.Points(dotGeo, new THREE.PointsMaterial({
    color: 0xffdf9e, size: .16, transparent: true, opacity: .95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })));

  /* ── lighting ── */
  const L = CFG.LIGHT;
  S.add(new THREE.HemisphereLight(0xffe8cc, 0x2a2118, L.HEMI));
  const sun = new THREE.DirectionalLight(0xfff0da, L.SUN);   // soft moonlit key
  sun.position.set(30, 40, 20);
  S.add(sun);
  for (const z of [-14, 0, 14]) pointLight(G, 0, B.H - 1.6, z, L.CHANDELIER, 30);   // chandeliers
  for (const z of [-12, 12]) pointLight(G, bx + F.W / 2, F.H - .8, z, L.FOYER, 20);
  pointLight(G, -bx + U.W / 2, U.H - .5, cz2 + U.L / 2, L.SUITE, 13, 0xffe2bb);
  pointLight(G, 0, C.H - .5, bz + C.W / 2, 14, 12);
  pointLight(G, fx2 + T.W / 2, 3.1, -tz + 1.6, L.TERRACE, 22, 0xffc98a);
  pointLight(G, fx2 + T.W / 2, 3.1, tz - 1.6, L.TERRACE, 22, 0xffc98a);
}
