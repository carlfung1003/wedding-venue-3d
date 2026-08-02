// moments.js — the six moments, each dressing a REAL place: five on the 隐逸居
// campus and, since 2026-08-02, the Welcome Brunch on the Westin's rooftop
// terrace 285 m east (see site.js MOMENT_PLACES / HOTEL_ROOF + the briefs).
//
// House pattern: every moment's props are built ONCE here and toggled with
// .visible; nothing is rebuilt on switch. Colliders are swapped (statics + the
// live moment's list), never accumulated. Each moment also carries a `night`
// flag — switching moments moves the sun.
import * as THREE from 'three';
import { CFG } from './config.js';
import { SITE, HOTEL_ROOF } from './site.js';
import { setFacing, syncCamera } from './player.js';
import { setNight } from './world.js';
import { mulberry32 } from './materials.js';

const rnd = mulberry32(CFG.SEED);

/* ── local materials (self-contained; the shell modules own their own) ── */
const linen = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: .85 });
const chairW = new THREE.MeshStandardMaterial({ color: 0xf2efe8, roughness: .6 });
const timber = new THREE.MeshStandardMaterial({ color: 0x3a281e, roughness: .7 });
const gold = new THREE.MeshStandardMaterial({ color: 0xd9c08a, roughness: .3, metalness: .85 });
const glassy = new THREE.MeshPhysicalMaterial({
  color: 0xdfeef0, roughness: .1, transmission: .85, thickness: .4, transparent: true, opacity: .5,
});
const foliage = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: .95 });
const blush = new THREE.MeshStandardMaterial({ color: 0xf2d7d9, roughness: .9 });
const deckDark = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: .6 });
const bulb = new THREE.MeshStandardMaterial({
  color: 0xfff0cf, emissive: 0xffcf87, emissiveIntensity: 2.2, toneMapped: false,
});
/* pale limed oak for the ceremony arch + the outdoor dinner rig, and the stone
   its posts stand on — the arch is now seen against open sea and dark mahogany
   reads as a silhouette against it */
const limed = new THREE.MeshStandardMaterial({ color: 0xe4dccb, roughness: .78 });
const stone = new THREE.MeshStandardMaterial({ color: 0xbfb9ad, roughness: .9 });
const teal = new THREE.MeshStandardMaterial({
  color: 0x1f8fa5, roughness: .85, side: THREE.DoubleSide,
});

const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cyl = (r, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

/* one folding chair — the ceremony needs sixty of them */
function chair() {
  const g = new THREE.Group();
  const seat = box(.44, .06, .44, chairW); seat.position.y = .45; g.add(seat);
  const back = box(.44, .5, .05, chairW); back.position.set(0, .72, -.2); g.add(back);
  for (const [x, z] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) {
    const l = box(.04, .45, .04, chairW); l.position.set(x, .225, z); g.add(l);
  }
  return g;
}

/* round dinner table, dressed. `seats` was a hard 10 while the dinner was six
   rounds inside the 60-seat lounge; the dinner is now eight rounds of EIGHT on
   the two pool lawns (Carl, 2026-08-02), so it is a parameter. The ring radius
   stays 1.35 m: a 1.8 m round seats eight at 1.06 m per cover, which is a real
   banquet setting rather than eight people wedged onto a ten-top. */
function roundTable(seats = 8) {
  const g = new THREE.Group();
  const top = cyl(.9, .06, linen, 24); top.position.y = .75; g.add(top);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.9, .86, .75, 24, 1, true), linen);
  skirt.position.y = .375; g.add(skirt);
  // centrepiece: a low bowl of blooms + two tapers
  const bowl = cyl(.22, .12, gold, 14); bowl.position.y = .84; g.add(bowl);
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), i % 3 ? blush : foliage);
    f.position.set((rnd() - .5) * .38, .95 + rnd() * .1, (rnd() - .5) * .38);
    g.add(f);
  }
  for (const s of [-1, 1]) {
    const t = cyl(.02, .34, linen, 8); t.position.set(s * .34, .95, 0); g.add(t);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), bulb);
    fl.position.set(s * .34, 1.15, 0); g.add(fl);
  }
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2;
    const c = chair();
    c.position.set(Math.sin(a) * 1.35, 0, Math.cos(a) * 1.35);
    c.rotation.y = a + Math.PI;
    g.add(c);
  }
  return g;
}

/* cocktail high-top */
function highTop() {
  const g = new THREE.Group();
  const top = cyl(.42, .05, linen, 18); top.position.y = 1.08; g.add(top);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.42, .38, 1.08, 18, 1, true), linen);
  skirt.position.y = .54; g.add(skirt);
  for (let i = 0; i < 3; i++) {
    const fl = cyl(.03, .16, glassy, 8);
    fl.position.set((rnd() - .5) * .5, 1.18, (rnd() - .5) * .5);
    g.add(fl);
  }
  return g;
}

/* a catenary run of festoon bulbs between two points */
function stringLights(x1, z1, x2, z2, y, sag = 1.1, n = 14) {
  const g = new THREE.Group();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const b = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 5), bulb);
    b.position.set(
      x1 + (x2 - x1) * t,
      y - Math.sin(t * Math.PI) * sag,
      z1 + (z2 - z1) * t,
    );
    g.add(b);
  }
  return g;
}

function colLine(list, x1, z1, x2, z2, r) {
  const d = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(d / r));
  for (let i = 0; i <= n; i++) {
    list.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r });
  }
}
/* The same, between two WORLD points, with a floor height under which the
   collider does not exist — and pre-flagged __world so world.js's
   worldifyLateRecords leaves it where it was put. The rooftop moment is the
   only caller; every enclave-local moment keeps using colLine above. */
function colLineY(list, a, b, r, y0) {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / r));
  for (let i = 0; i <= n; i++) {
    list.push({
      x: a.x + (b.x - a.x) * i / n, z: a.z + (b.z - a.z) * i / n, r, y0, __world: true,
    });
  }
}

export function initMoments(G) {
  const groups = {};
  const cols = {};
  for (const m of CFG.MOMENTS) {
    groups[m.id] = new THREE.Group();
    groups[m.id].visible = false;
    G.scene.add(groups[m.id]);
    cols[m.id] = [];
  }
  /* Five of the six moments dress the ENCLAVE and are authored in enclave-local
     coordinates — world.js adopts their groups into the rotated enclave group
     and rewrites their colliders and interactables on the first frame. The
     Welcome Brunch is 285 m east on the hotel crescent, which is NOT part of
     the enclave, so it opts out of all three: `worldSpace` on the group,
     `__world` on every collider and interactable it registers. Forget one and
     the brunch lands 90° around the map from the roof it is set on. */
  groups.brunch.userData.worldSpace = true;

  /* SITE.LOUNGE and SITE.LAWN used to be dressed here (dinner inside the 酒廊,
     the ceremony on the little circular lawn). Both moments moved outdoors on
     2026-08-02 and neither footprint is read any more — the lounge still
     stands, it is just not a venue, and the circular lawn is a garden. */
  const D = SITE.DECK;

  /* ── 0 · WELCOME BRUNCH — the Westin rooftop, 18 March, two days out ───────
     campus.js already stands eight four-tops and eight parasols on the paved
     aprons at either end of the water; those are the ROOM. This moment is the
     COVER: linen over the marble, settings, low blooms, a champagne service and
     a buffet on the teak, and a menu easel where the bridge arrives. Nothing
     here duplicates a table that is already up there — dress it, don't rebuild
     it. Everything is WORLD space, in HOTEL_ROOF's polar frame. */
  {
    const g = groups.brunch;
    const RF = SITE.HOTEL.ROOFTOP, DY = RF.deckY, C = Math.PI / 2;
    const pt = (th, r) => HOTEL_ROOF.pt(th, r);
    /* a box laid flat on the terrace, turned to face the arc centre */
    const rbox = (w, h, d, th, r, y, m) => {
      const p = pt(th, r);
      const b = box(w, h, d, m);
      b.position.set(p.x, y, p.z);
      b.rotation.y = th;
      g.add(b);
      return b;
    };
    const rcyl = (rad, h, th, r, y, m, seg = 14) => {
      const p = pt(th, r);
      const c = cyl(rad, h, m, seg);
      c.position.set(p.x, y, p.z);
      g.add(c);
      return c;
    };

    /* ── the eight existing four-tops, dressed ── */
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const th = C + s * (RF.poolArcHalf + .035 + k * .055);
      const r = 93.4 + (k % 2) * 1.6;
      const p = pt(th, r);
      /* ⚠ campus.js sizes these tables through mat4() SCALE on a unit cylinder
         of radius 0.5, so `1.35` there is a 1.35 m DIAMETER — a 0.675 m top,
         with the four chairs at 1.05 m. moments.js's cyl() takes a real radius.
         Dress to 0.70 or the cloth swallows the chairs and the table reads as a
         drum. (It did, first try.) */
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(.68, .72, .74, 20, 1, true), linen);
      skirt.position.set(p.x, DY + .38, p.z); g.add(skirt);
      rcyl(.72, .05, th, r, DY + .78, linen, 20);
      // a low bowl of blooms in the centre
      rcyl(.19, .11, th, r, DY + .86, gold);
      for (let i = 0; i < 7; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.065, 8, 6), i % 3 ? blush : foliage);
        f.position.set(p.x + (rnd() - .5) * .28, DY + .94 + rnd() * .07, p.z + (rnd() - .5) * .28);
        g.add(f);
      }
      // four covers: charger, napkin, flute — laid toward the chairs
      for (let c = 0; c < 4; c++) {
        const ca = c * Math.PI / 2 + .4;
        const px = p.x + Math.cos(ca) * .46, pz = p.z - Math.sin(ca) * .46;
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .022, 16), linen);
        plate.position.set(px, DY + .82, pz); g.add(plate);
        const nap = box(.10, .03, .14, blush);
        nap.position.set(px, DY + .85, pz); nap.rotation.y = ca; g.add(nap);
        const fl = cyl(.030, .16, glassy, 8);
        fl.position.set(p.x + Math.cos(ca + .5) * .52, DY + .89, p.z - Math.sin(ca + .5) * .52);
        g.add(fl);
        /* campus.js's chairs are bare white blocks — right for pool furniture,
           thin for a table you now stand two metres from. A linen slip over the
           back and a blush sash is what turns them into event chairs. */
        const bx = p.x + Math.cos(ca) * 1.28, bz = p.z - Math.sin(ca) * 1.28;
        const slip = box(.54, .56, .10, linen);
        slip.position.set(bx, DY + .64, bz); slip.rotation.y = ca; g.add(slip);
        const sash = box(.56, .09, .13, blush);
        sash.position.set(bx, DY + .50, bz); sash.rotation.y = ca; g.add(sash);
      }
      cols.brunch.push({ x: p.x, z: p.z, r: 1.35, y0: DY - .6, __world: true });
    }

    /* ── the buffet: a 7 m draped run on the teak, east of the water ── */
    const BTH = C + .455, BR = 98.4;
    for (let i = 0; i < 5; i++) {
      const th = BTH - .028 + i * .014;
      rbox(1.55, .74, 1.02, th, BR, DY + .37, linen);      // drape
      rbox(1.60, .06, 1.12, th, BR, DY + .77, timber);     // the counter itself
      rbox(1.56, .04, 1.08, th, BR, DY + .81, linen);      // runner over it
    }
    // chafing domes, fruit stands and a bread board along it
    for (let i = 0; i < 4; i++) {
      const th = BTH - .022 + i * .0147;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      const p = pt(th, BR - .1); dome.position.set(p.x, DY + .83, p.z); g.add(dome);
    }
    for (let i = 0; i < 3; i++) {
      const th = BTH - .018 + i * .018;
      rcyl(.06, .34, th, BR + .34, DY + .99, gold, 10);
      rcyl(.30, .05, th, BR + .34, DY + 1.18, linen, 16);
      for (let j = 0; j < 6; j++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.065, 7, 6), j % 2 ? blush : foliage);
        const p = pt(th, BR + .34);
        f.position.set(p.x + (rnd() - .5) * .34, DY + 1.25, p.z + (rnd() - .5) * .34);
        g.add(f);
      }
    }
    colLineY(cols.brunch, pt(BTH - .032, BR), pt(BTH + .032, BR), .62, DY - .6);

    /* ── champagne service, on the pool side of the buffet ── */
    const CTH = C + .383, CR = 97.9;
    rcyl(.54, .80, CTH, CR, DY + .40, linen, 18);
    rcyl(.58, .05, CTH, CR, DY + .82, linen, 18);
    {
      const p = pt(CTH, CR);
      for (let row = 0; row < 3; row++) {
        const n = 4 - row;
        for (let i = 0; i < n; i++) {
          const c = cyl(.052, .15, glassy, 8);
          c.position.set(p.x - (n - 1) * .075 + i * .15, DY + .92 + row * .16, p.z);
          g.add(c);
        }
      }
      // an ice bucket, and a second one on the deck
      const bkt = cyl(.19, .26, gold, 14);
      bkt.position.set(p.x + .55, DY + .95, p.z + .2); g.add(bkt);
      cols.brunch.push({ x: p.x, z: p.z, r: .95, y0: DY - .6, __world: true });
    }

    /* ── a linen runner + a hedge of blooms along the pool coping, so the water
          reads as part of the table setting rather than a lap pool ── */
    for (let i = 0; i < 22; i++) {
      const th = C - .33 + (i / 21) * .66;
      const p = pt(th, 96.9);
      const f = new THREE.Mesh(new THREE.SphereGeometry(.13 + rnd() * .07, 7, 6),
        rnd() > .5 ? blush : foliage);
      f.position.set(p.x, DY + .16, p.z); g.add(f);
    }

    /* ── the menu easel, where the bridge lands ── */
    {
      const T = HOTEL_ROOF.tower;
      const eth = T.th - .012;
      rbox(.92, 1.24, .05, eth, 102.2, DY + 1.02, linen);
      rbox(.07, 1.02, .07, eth, 102.3, DY + .51, timber);
      cols.brunch.push({ ...pt(eth, 102.2), r: .6, y0: DY - .6, __world: true });
    }

    /* ── parasols get a second row over the four-top aprons ── */
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) {
      const th = C + s * (RF.poolArcHalf + .062 + k * .11);
      rcyl(.05, 2.7, th, 91.9, DY + 1.35, timber, 8);
      const p = pt(th, 91.9);
      const um = new THREE.Mesh(new THREE.ConeGeometry(1.55, .62, 12), linen);
      um.position.set(p.x, DY + 2.86, p.z); g.add(um);
    }
  }

  /* ── 1 · PREWEDDING — the suite deck at night, lanterns on the water ── */
  {
    const g = groups.setup;
    // high-tops scattered on the basalt deck, between the glass wall and turf
    for (let i = 0; i < 7; i++) {
      const t = highTop();
      const x = -6.5 + i * 2.2 + (rnd() - .5) * .6;
      const z = D.z0 + 2.2 + rnd() * 3.4;
      t.position.set(x, 0, z);
      g.add(t);
      cols.setup.push({ x, z, r: .5 });
    }
    // festoon lights strung from the roof overhang out to the turf edge
    for (let i = 0; i < 5; i++) {
      const x = -7 + i * 3.5;
      g.add(stringLights(x, D.z0 + .4, x + 1.6, SITE.TURF.z1, 3.6, .9, 10));
    }
    // a welcome easel by the door
    const easel = box(.9, 1.3, .05, linen);
    easel.position.set(-3.4, 1.0, D.z0 + 1.2);
    easel.rotation.y = .3; g.add(easel);
    const legs = box(.06, 1.0, .06, timber);
    legs.position.set(-3.4, .5, D.z0 + 1.3); g.add(legs);
    // champagne tower on a draped table
    const tbl = cyl(.6, .78, linen, 18); tbl.position.set(7.5, .39, D.z0 + 3); g.add(tbl);
    for (let r = 0; r < 3; r++) {
      const n = 4 - r;
      for (let i = 0; i < n; i++) {
        const c = cyl(.05, .14, glassy, 8);
        c.position.set(7.5 - (n - 1) * .07 + i * .14, .85 + r * .15, D.z0 + 3);
        g.add(c);
      }
    }
    cols.setup.push({ x: 7.5, z: D.z0 + 3, r: .7 });
  }

  /* ── 2 · CEREMONY — the private beachfront lawn, facing the sea ────────────
     MOVED 2026-08-02 off SITE.LAWN (the little hedge-ringed disc out by the
     road) to SITE.BEACH_LAWN, the clearing nearest the sand. Carl: *"it's
     actually in a grass lawn area behind the pool and very close to the beach"*.

     THE AISLE RUNS ALONG LOCAL +Z, which is world WEST — so the arch stands
     between the guests and the sea and the blurb ("an arch with the sea behind
     it") is finally describing what you see. Everything follows from that:
     CEREMONY spawns at z 59 with yaw π (fwd = (0,0,+1)), the five rows sit at
     z 62…66 and the arch at z 71, 12 m up the aisle from the spawn.

     ⚠ THE ARCH USED TO BE BUILT EDGE-ON. It was a TorusGeometry — which lies
     in the XY plane, so a π arc spans X — carrying `rotation.y = Math.PI / 2`,
     which maps that span onto Z. The old aisle also ran along Z, so the arch
     stood IN the plane of the aisle: you walked toward a 0.18 m-thick ribbon
     seen end-on, which is most of what "the ceremony arch reads thin" in the
     polish backlog actually was. There is no y-rotation now, and it is built as
     a real structure — two 0.34 m posts on stone bases carrying a 4.8 m span to
     a 5.0 m crown — rather than one 2.4 m tube. ── */
  {
    const g = groups.ceremony;
    const AX = -22, AZ = 71;                       // aisle centre-line, arch line
    const ROW0 = 62, ROWS = 5, PER = 6;
    // 60 chairs: two blocks of 5 rows × 6, aisle down the middle, facing +Z
    for (const side of [-1, 1]) {
      for (let row = 0; row < ROWS; row++) {
        for (let i = 0; i < PER; i++) {
          const c = chair();
          c.position.set(AX + side * (1.6 + i * .62), 0, ROW0 + row * 1.0);
          c.rotation.y = 0;                        // chair() faces +Z unrotated
          g.add(c);
          if (i === 0 && row % 2 === 0) {          // aisle-seat posies
            for (let k = 0; k < 5; k++) {
              const f = new THREE.Mesh(new THREE.SphereGeometry(.055 + rnd() * .035, 6, 5),
                k % 2 ? blush : foliage);
              f.position.set(AX + side * (1.34 + (rnd() - .5) * .22), .92 + rnd() * .12,
                ROW0 + row * 1.0 - .1 + (rnd() - .5) * .2);
              g.add(f);
            }
          }
        }
      }
    }
    // aisle runner: from behind the back row through to under the arch
    const runner = box(3.0, .02, 12.4, linen);
    runner.position.set(AX, .01, 65.4); g.add(runner);

    /* ── the arch ── posts, bases, a 2.4 m-radius crown, heavily dressed */
    const POST_H = 2.6, R = 2.4, TOP = POST_H;
    for (const s of [-1, 1]) {
      const base = box(1.0, .26, 1.0, stone);
      base.position.set(AX + s * R, .13, AZ); g.add(base);
      const post = box(.34, POST_H, .34, limed);
      post.position.set(AX + s * R, .26 + POST_H / 2, AZ); g.add(post);
      cols.ceremony.push({ x: AX + s * R, z: AZ, r: .55 });
    }
    const crown = new THREE.Mesh(new THREE.TorusGeometry(R, .15, 10, 44, Math.PI), limed);
    crown.position.set(AX, TOP + .26, AZ);        // NO rotation.y — spans X
    g.add(crown);
    // foliage + blooms wound over the crown and cascading down both haunches
    for (let i = 0; i < 190; i++) {
      const a = rnd() * Math.PI;
      const drop = rnd() < .34 ? rnd() * 2.2 : 0;   // the cascades
      const rr = R + (rnd() - .35) * .34;
      const f = new THREE.Mesh(new THREE.SphereGeometry(.13 + rnd() * .13, 7, 6),
        rnd() > .58 ? blush : foliage);
      f.position.set(
        AX + Math.cos(a) * rr,
        Math.max(.3, TOP + .26 + Math.sin(a) * rr - drop),
        AZ + (rnd() - .5) * .6,
      );
      g.add(f);
    }
    // two urns of blooms at the head of the aisle
    for (const s of [-1, 1]) {
      const urn = cyl(.34, .7, stone, 14);
      urn.position.set(AX + s * 1.9, .35, AZ - 2.6); g.add(urn);
      for (let i = 0; i < 16; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(.13 + rnd() * .09, 7, 6),
          rnd() > .5 ? blush : foliage);
        f.position.set(AX + s * 1.9 + (rnd() - .5) * .8, .78 + rnd() * .5,
          AZ - 2.6 + (rnd() - .5) * .8);
        g.add(f);
      }
      cols.ceremony.push({ x: AX + s * 1.9, z: AZ - 2.6, r: .5 });
    }
    // petals down the aisle
    for (let i = 0; i < 130; i++) {
      const p = new THREE.Mesh(new THREE.CircleGeometry(.06, 5), blush);
      p.rotation.x = -Math.PI / 2;
      p.position.set(AX + (rnd() - .5) * 2.7, .03, 59.6 + rnd() * 11.6);
      g.add(p);
    }
  }

  /* ── 3 · COCKTAIL — the SAME beachfront lawn, 26 m along it ────────────────
     Carl put the cocktail hour on the ceremony lawn, not at the clubhouse
     terrace pool, so the two share a lawn and are separated within it: the
     ceremony holds the −X half around x −22, the bar and the high-tops the +X
     half around x +4. 14 m of clear grass between the chair block's edge and
     the nearest high-top, which is what keeps them reading as two rooms. ── */
  {
    const g = groups.cocktail;
    const CX = 4, BARZ = 68;
    // the bar, facing back down the lawn at the arriving guests
    const bar = box(6.0, 1.1, .9, timber);
    bar.position.set(CX, .55, BARZ); g.add(bar);
    const barTop = box(6.3, .08, 1.1, linen);
    barTop.position.set(CX, 1.14, BARZ); g.add(barTop);
    const backBar = box(2.6, 1.5, .45, timber);
    backBar.position.set(CX, .75, BARZ + 1.5); g.add(backBar);
    colLine(cols.cocktail, CX - 3.0, BARZ, CX + 3.0, BARZ, .6);
    colLine(cols.cocktail, CX - 1.3, BARZ + 1.5, CX + 1.3, BARZ + 1.5, .5);
    for (let i = 0; i < 16; i++) {
      const fl = cyl(.035, .18, glassy, 8);
      fl.position.set(CX - 2.7 + i * .36, 1.27, BARZ - .2); g.add(fl);
    }
    for (let i = 0; i < 7; i++) {                  // bottles on the back bar
      const b = cyl(.045, .3, glassy, 7);
      b.position.set(CX - .9 + i * .3, 1.65, BARZ + 1.5); g.add(b);
    }
    /* Eight high-tops. Nothing sits closer than 3 m to the COCKTAIL spawn at
       (4, 58.5) and nothing with a PARASOL closer than 6.5: a 1.7 m canopy at
       2.7 m up, three metres away, is the entire frame on the first render. */
    const spots = [[-2.4, 61.6], [3.0, 61.2], [7.4, 62.4], [-1.2, 64.6],
      [4.2, 65.2], [8.4, 65.8], [-3.4, 67.0], [9.2, 68.6]];
    for (const [dx, z] of spots) {
      const x = CX + dx;
      const t = highTop(); t.position.set(x, 0, z); g.add(t);
      cols.cocktail.push({ x, z, r: .5 });
    }
    // three teal parasols, the clubhouse's own colour, over the far tables
    for (const [dx, z] of [[4.2, 65.2], [8.4, 65.8], [-3.4, 67.0]]) {
      const pole = cyl(.045, 2.5, timber, 8);
      pole.position.set(CX + dx, 1.25, z); g.add(pole);
      const um = new THREE.Mesh(new THREE.ConeGeometry(1.7, .55, 12), teal);
      um.position.set(CX + dx, 2.68, z); g.add(um);
    }
    // a raw-bar / canapé table off to one side
    const svc = cyl(.62, .8, linen, 18);
    svc.position.set(CX - 5.4, .4, 64.6); g.add(svc);
    for (let i = 0; i < 10; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 7, 6), i % 3 ? blush : foliage);
      f.position.set(CX - 5.4 + (rnd() - .5) * .8, .86, 64.6 + (rnd() - .5) * .8);
      g.add(f);
    }
    cols.cocktail.push({ x: CX - 5.4, z: 64.6, r: .8 });
    /* Festoon on six real poles. The runs go pole-to-pole at the poles' OWN z,
       not across the middle of the lawn — stringLights draws bulbs and no wire,
       so a run that starts and ends in mid-air is a row of orbs floating over
       the sea. Three rows × two poles each. */
    for (const pz of [59.5, 64, 68.5]) {
      for (const px of [CX - 6, CX + 10]) {
        const p = cyl(.07, 3.6, timber, 8);
        p.position.set(px, 1.8, pz); g.add(p);
        cols.cocktail.push({ x: px, z: pz, r: .3 });
      }
      g.add(stringLights(CX - 6, pz, CX + 10, pz, 3.5, .9, 14));
    }
  }

  /* ── 4 · DINNER — the two lawns flanking the presidential pool ─────────────
     MOVED 2026-08-02 out of the 酒廊. Carl: *"our dinner is actually in this
     two grass area right outside of the pool"*. The lounge is still built and
     still 280 ㎡; it is simply no longer where dinner happens.

     Eight rounds of EIGHT = 64 covers, four per lawn on a 6 m grid, exactly
     what Carl asked for. A head table across the head of the paved walk serves
     both lawns; the dance floor is on the walk between them; the festoon hangs
     off real poles because there is no longer a ceiling to hang it from. The
     two point lights are the only lights any moment adds, and they cost nothing
     while the moment is hidden — WebGLRenderer skips an invisible subtree
     before it collects lights from it. ── */
  {
    const g = groups.dinner;
    const [LA, LB] = SITE.DINNER_LAWNS, DW = SITE.DINNER_WALK;
    const WX = (DW.x0 + DW.x1) / 2;
    for (const L of [LA, LB]) {
      const cx = (L.x0 + L.x1) / 2;
      for (const dx of [-3, 3]) for (const z of [2, 8]) {
        const x = cx + dx;
        const t = roundTable(8);
        t.position.set(x, 0, z);
        g.add(t);
        cols.dinner.push({ x, z, r: 1.5 });
      }
      /* three festoon runs on six real poles — one pair PER RUN, because
         stringLights draws bulbs and no wire and a run whose ends are not on a
         pole reads as a row of orbs hanging in the dark */
      for (let i = 0; i < 3; i++) {
        const z = L.z0 + 1.5 + i * ((L.z1 - L.z0 - 3) / 2);
        for (const s of [-1, 1]) {
          const p = cyl(.08, 4.0, limed, 8);
          p.position.set(cx + s * 5.6, 2.0, z); g.add(p);
          cols.dinner.push({ x: cx + s * 5.6, z, r: .3 });
        }
        g.add(stringLights(cx - 5.6, z, cx + 5.6, z, 3.9, .8, 12));
      }
      const lt = new THREE.PointLight(0xffc98a, 0, 26, 2);
      lt.position.set(cx, 4.2, (L.z0 + L.z1) / 2);
      g.add(lt);
      G.tickers.push(() => { lt.intensity = g.visible ? 16 : 0; });
    }
    // head table across the head of the walk, serving both lawns
    const head = box(6.0, .04, 1.0, linen);
    head.position.set(WX, .76, 13.2); g.add(head);
    const headSkirt = box(6.0, .76, 1.0, linen);
    headSkirt.position.set(WX, .38, 13.2); g.add(headSkirt);
    for (let i = 0; i < 6; i++) {
      const c = chair();
      c.position.set(WX - 2.5 + i, 0, 14.5);
      c.rotation.y = Math.PI; g.add(c);
    }
    colLine(cols.dinner, WX - 3.0, 13.2, WX + 3.0, 13.2, .6);
    // dance floor on the paving between the lawns
    const floor = box(3.0, .04, 7, deckDark);
    floor.position.set(WX, .05, 3); g.add(floor);
    // festoon down the length of the walk, over the dance floor
    for (const s of [-1, 1]) {
      g.add(stringLights(WX + s * 1.4, DW.z0 + 1, WX + s * 1.4, DW.z1 - 1, 3.9, .7, 12));
    }
  }

  /* ── 5 · AFTER PARTY — the pool deck, DJ, mirror ball ── */
  {
    const g = groups.afterparty;
    const booth = box(2.4, 1.1, .8, deckDark);
    booth.position.set(0, .55, D.z0 + 1.4); g.add(booth);
    const face = box(2.2, .5, .06, bulb);
    face.position.set(0, .7, D.z0 + 1.0); g.add(face);
    colLine(cols.afterparty, -1.2, D.z0 + 1.4, 1.2, D.z0 + 1.4, .6);
    for (const s of [-1, 1]) {
      const sp = box(.6, 1.6, .5, deckDark);
      sp.position.set(s * 3.2, .8, D.z0 + 1.2); g.add(sp);
      cols.afterparty.push({ x: s * 3.2, z: D.z0 + 1.2, r: .5 });
    }
    // mirror ball over the deck
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(.45, 1),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: .12, metalness: 1, flatShading: true }));
    ball.position.set(0, 4.2, D.z0 + 4.5);
    g.add(ball);
    G.tickers.push((dt) => { ball.rotation.y += dt * .55; });
    // festoon criss-crossing the deck, denser than the prewedding rig
    for (let i = 0; i < 6; i++) {
      const x = -8 + i * 3.2;
      g.add(stringLights(x, D.z0 + .4, x + 2.4, SITE.TURF.z1, 4.0, 1.0, 12));
    }
    // lounge seating out on the turf
    for (const [x, z] of [[-9, -8], [9, -8], [-11, -4]]) {
      const sofa = box(2.2, .55, .9, linen);
      sofa.position.set(x, .28, z); g.add(sofa);
      cols.afterparty.push({ x, z, r: 1.1 });
    }
  }

  /* ── interactables: one per moment ──
     `when(id)` resolves by MOMENT id, not by index: inserting the Welcome Brunch
     at 0 shifted all five of the originals, and a hard-coded index here fails
     silently (the prompt simply stops appearing on the right moment). */
  const idx = Object.fromEntries(CFG.MOMENTS.map((m, i) => [m.id, i]));
  const when = id => () => G.momentIndex === idx[id];
  const champ = HOTEL_ROOF.pt(Math.PI / 2 + .383, 97.9);
  G.interactables.push(
    { x: champ.x, z: champ.z, r: 1.4, __world: true,
      label: () => 'Pour a glass',
      use: () => G.ui.toast('🥂 To the two of you — and to whoever booked the roof.', 3.4),
      enabled: when('brunch') },
    { x: -3.4, z: D.z0 + 1.2, r: 1.2, label: () => 'Read the welcome sign',
      use: () => G.ui.toast('“Carl & Rachel — welcome to Haitang Bay. Shoes optional.”', 3.4),
      enabled: when('setup') },
    /* all three moved 2026-08-02 with their moments — the arch is on the
       beachfront lawn, the bar is 26 m along the same lawn, and the dance floor
       is on the paved walk between the two dinner lawns. These are the same
       numbers the prop blocks above are built from; if one moves, both move. */
    { x: -22, z: 71, r: 2.4, label: () => 'Stand at the arch',
      use: () => G.ui.toast('This is where the “I do” happens — with the sea right behind you. 💍', 3.4),
      enabled: when('ceremony') },
    { x: 4, z: 68, r: 2.2, label: () => 'Order from the bar',
      use: () => G.ui.toast('🥂 One Yuzu 75, coming right up.', 3), enabled: when('cocktail') },
    { x: (SITE.DINNER_WALK.x0 + SITE.DINNER_WALK.x1) / 2, z: 3, r: 2.2,
      label: () => 'Step onto the dance floor',
      use: () => G.ui.toast('The floor is yours — everyone joins after the second song.', 3.2),
      enabled: when('dinner') },
    { x: 0, z: D.z0 + 1.4, r: 1.6, label: () => 'Request a song',
      use: () => G.ui.toast('🎧 The DJ nods. It was always going to be this song.', 3),
      enabled: when('afterparty') },
  );

  /* statics are everything the builders registered BEFORE any dressing */
  const staticColliders = G.colliders.slice();

  G.momentIndex = -1;
  G.setMoment = (idx, opts = {}) => {
    const m = CFG.MOMENTS[idx];
    if (!m || idx === G.momentIndex) return;
    G.momentIndex = idx;

    for (const mm of CFG.MOMENTS) groups[mm.id].visible = mm === m;

    G.colliders.length = 0;
    G.colliders.push(...staticColliders, ...cols[m.id]);

    setNight(G, !!m.night, { quiet: true });

    if (G.setMode) G.setMode('walk', { quiet: true });
    /* spawn.y is the FEET height, and it has to be set explicitly: floorY only
       ever answers the surface within CFG.STEP_UP of where the feet already
       are, so teleporting to the rooftop with y = 0 would resolve to the ground
       285 m below it and drop the player through the hotel. Omitted for every
       moment at grade, which is all five of the enclave ones. */
    G.player.pos.set(m.spawn.x, (m.spawn.y || 0) + CFG.EYE_HEIGHT, m.spawn.z);
    setFacing(m.spawn.yaw);
    syncCamera(G);

    G.ui.setMoment(m, idx);
    if (!opts.quiet) G.ui.toast(m.blurb, 4.2, true);   // jump the queue
  };
}

export function updateMoments() { /* per-moment animation is registered on G.tickers */ }
