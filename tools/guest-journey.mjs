/* THE GUEST JOURNEY — the whole chain, in order, the way a wedding guest
   actually experiences it. No individual pass has walked this end to end.
   Every leg uses real key input and logs feet height. */
import { createRequire } from 'node:module';
/* Playwright is not a dependency of this project (it has none — it is a static
   site). Borrow the copy in ~/projects/wedding-app, which is where every
   verification pass on this venue has taken it from. */
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH
  || '/Users/carlfung/projects/wedding-app/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=metal'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const bad = [];
  page.on('pageerror', e => bad.push('PAGE: ' + e));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') bad.push(m.type() + ': ' + m.text()); });

  await page.goto(process.env.VENUE_URL || 'http://127.0.0.1:8803/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game, null, { timeout: 180000 });

  const out = await page.evaluate(async () => {
    const g = window.__game, G = g.G;
    const P = await import('./js/player.js');
    const S = await import('./js/site.js');
    const { CFG } = await import('./js/config.js');
    const EYE = CFG.EYE_HEIGHT;
    const legs = [];
    g.skipIntro(); G.player.locked = true;

    const feet = () => +(G.player.pos.y - EYE).toFixed(3);
    const key = (c, d) => document.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, bubbles: true }));
    const step = n => { for (let i = 0; i < n; i++) P.updatePlayer(G, 1 / 60); };
    const e2w = (x, z) => S.enclaveToWorld(x, z);
    const at = () => ({ x: +G.player.pos.x.toFixed(1), z: +G.player.pos.z.toFixed(1) });
    const prompt = () => (G.player.nearest ? G.player.nearest.label() : null);

    /* walk toward a world target in bursts, re-aiming each burst; records the
       minimum feet seen (a fall shows up as a dip) and whether it stalled */
    const walkTo = (name, tx, tz, bursts = 8, secs = 0.9) => {
      let minF = 99, stalls = 0, moved = 0;
      for (let b = 0; b < bursts; b++) {
        const p0 = { x: G.player.pos.x, z: G.player.pos.z };
        P.setFacing(Math.atan2(-(tx - p0.x), -(tz - p0.z)));
        key('KeyW', true);
        for (let i = 0; i < Math.round(secs * 60); i++) { P.updatePlayer(G, 1 / 60); minF = Math.min(minF, feet()); }
        key('KeyW', false);
        const d = Math.hypot(G.player.pos.x - p0.x, G.player.pos.z - p0.z);
        moved += d; if (d < 0.25) stalls++;
        if (Math.hypot(tx - G.player.pos.x, tz - G.player.pos.z) < 2.2) break;
      }
      const dist = +Math.hypot(tx - G.player.pos.x, tz - G.player.pos.z).toFixed(2);
      legs.push({ leg: name, feet: feet(), minFeet: +minF.toFixed(3),
        moved: +moved.toFixed(1), stalls, distToTarget: dist,
        arrived: dist < 3.0, prompt: prompt(), at: at() });
    };
    const teleport = (wx, wy, wz) => { G.player.pos.set(wx, wy + EYE, wz); step(6); };

    /* ── 1 · ARRIVE: dropped at the car park ── */
    g.setMoment(1); step(4);              // prewedding dressing = the venue "as built"
    if (G.night) g.toggleNight();
    const AR = S.SITE.ARRIVAL;
    const carLx = 62.3, carLz = AR.stalls.z0 + 1.5 * AR.stalls.pitch;
    const car = e2w(carLx, carLz);
    teleport(car.x, AR.terraceY, car.z);
    legs.push({ leg: '0 · standing at the car', feet: feet(), at: at() });

    /* 2 · across the court and up the forecourt to the stair foot */
    const foreLx = (AR.fore.x0 + AR.fore.x1) / 2;
    const fore = e2w(foreLx, (AR.fore.z0 + AR.fore.z1) / 2);
    walkTo('1 · car → forecourt', fore.x, fore.z, 8);

    /* 3 · up the six-riser stair into the check-in lobby */
    const lobby = e2w((AR.LOBBY.x0 + AR.LOBBY.x1) / 2, (AR.LOBBY.z0 + AR.LOBBY.z1) / 2);
    walkTo('2 · forecourt → up the stair → lobby', lobby.x, lobby.z, 10);

    /* 4 · to the check-in desk — the prompt is the test */
    const checkIn = G.interactables.find(i => i.label && i.label() === 'Check in');
    if (checkIn) walkTo('3 · lobby → check-in desk', checkIn.x, checkIn.z, 8);
    legs.push({ leg: '3a · CHECK IN prompt', prompt: prompt(),
      inReach: prompt() === 'Check in' });

    /* 5 · the fork LEFT: desk → the lobby's west opening → the LINK → the SLOT
       → the atrium's upper gallery, i.e. "where is my room".
       ⚠ WAYPOINTS ARE REQUIRED and that is not a bug: a straight line from the
       lobby to the slot runs into the lobby's WEST WALL (local x 33), and a
       line aimed north out of the LINK runs into the LINK's own north rail.
       You walk through the doorway, like in a building. An earlier version of
       this harness aimed straight at the target, stalled ten times, and looked
       exactly like a broken route. */
    const LB = AR.LOBBY, SL = AR.SLOT, LK = AR.LINK;
    const gap = AR.lobbyGaps[1];
    const wp = (n, lx, lz, secs) => {
      const t = e2w(lx, lz), a = { x: G.player.pos.x, z: G.player.pos.z };
      P.setFacing(Math.atan2(-(t.x - a.x), -(t.z - a.z)));
      key('KeyW', true);
      let minF = 99;
      for (let i = 0; i < Math.round(secs * 60); i++) { P.updatePlayer(G, 1 / 60); minF = Math.min(minF, feet()); }
      key('KeyW', false);
      legs.push({ leg: n, feet: feet(), minFeet: +minF.toFixed(3),
        moved: +Math.hypot(G.player.pos.x - a.x, G.player.pos.z - a.z).toFixed(2), at: at() });
    };
    wp('4a · desk → the west opening', LB.x0 + 0.6, (gap.z0 + gap.z1) / 2, 3);
    wp('4b · out onto the walkway', LK.x1 - 2.0, (LK.z0 + LK.z1) / 2, 3);
    wp('4c · west along the walkway', LK.x0 + 1.2, (LK.z0 + LK.z1) / 2, 5);
    wp('4d · …and on', LK.x0 + 1.2, (LK.z0 + LK.z1) / 2, 5);
    wp('4e · turn north into the slot', (SL.x0 + SL.x1) / 2, SL.z0 + 2, 3);
    wp('4f · up the slot to the gallery', (SL.x0 + SL.x1) / 2, SL.z0 - 26, 7);

    /* 6 · down to the courtyard and out to the pool deck */
    const deck = e2w(S.SITE.DECK.cx, (S.SITE.DECK.z0 + S.SITE.DECK.z1) / 2);
    teleport(deck.x, 0, deck.z);
    legs.push({ leg: '5 · at the pool deck (teleport: the gallery stair is its own test)', feet: feet() });

    /* 7 · THE WEDDING DAY, in order. Each moment: spawn flat, reach its beat. */
    const beats = [
      [2, 'Stand at the arch', '6 · CEREMONY'],
      [3, 'Order from the bar', '7 · COCKTAIL'],
      [4, 'Step onto the dance floor', '8 · DINNER'],
      [5, 'Request a song', '9 · AFTER PARTY'],
    ];
    for (const [mi, label, name] of beats) {
      g.setMoment(mi); step(6);
      const spawnFeet = feet();
      const it = G.interactables.find(i => i.label && i.label() === label && (!i.enabled || i.enabled()));
      if (it) walkTo(name, it.x, it.z, 8);
      legs[legs.length - 1].spawnFeet = spawnFeet;
      legs[legs.length - 1].beatReached = prompt() === label;
    }

    /* 8 · the morning after: the rooftop brunch */
    g.setMoment(0); step(6);
    const champ = G.interactables.find(i => i.label && i.label() === 'Pour a glass');
    const bf = feet();
    if (champ) walkTo('10 · BRUNCH → champagne', champ.x, champ.z, 8);
    legs[legs.length - 1].spawnFeet = bf;
    legs[legs.length - 1].beatReached = prompt() === 'Pour a glass';

    return { legs, lights: (() => { let n = 0, v = 0; G.scene.traverse(o => { if (o.isPointLight) { n++; if (o.visible) v++; } }); return { logical: n, visible: v }; })() };
  });

  const rows = out.legs;
  console.log('=== THE GUEST JOURNEY ===');
  for (const r of rows) {
    const bits = [`feet ${r.feet ?? '-'}`];
    if (r.minFeet !== undefined) bits.push(`min ${r.minFeet}`);
    if (r.spawnFeet !== undefined) bits.push(`spawn ${r.spawnFeet}`);
    if (r.moved !== undefined) bits.push(`moved ${r.moved}m`);
    if (r.stalls !== undefined) bits.push(`stalls ${r.stalls}`);
    if (r.arrived !== undefined) bits.push(r.arrived ? 'ARRIVED' : `SHORT by ${r.distToTarget}m`);
    if (r.beatReached !== undefined) bits.push(r.beatReached ? 'BEAT ✓' : 'BEAT ✗');
    if (r.inReach !== undefined) bits.push(r.inReach ? 'PROMPT ✓' : 'PROMPT ✗');
    console.log(`  ${r.leg.padEnd(46)} ${bits.join('  ')}`);
  }
  console.log('lights', JSON.stringify(out.lights));
  console.log('ERRORS', JSON.stringify(bad));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
